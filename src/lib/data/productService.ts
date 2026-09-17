import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  serverTimestamp,
  increment,
  limit,
  orderBy,
  startAfter,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase';
import { storageService } from './storageService';
import { sanitizeForFirestore, serializeProductForFirestore } from '../firestoreUtils';
import { Product, ProductColorVariant } from '../../types';
import { notificationEngine } from '../notificationEngine';
import { deriveStockStatus, DEFAULT_LOW_STOCK_THRESHOLD } from './inventoryService';
import { auditService } from './auditService';
import { getProductCanonicalSlug, normalizeSlug } from '../seoUtils';

const COLLECTION_NAME = 'products';

// Helper to determine whether an input string is a valid Firestore document ID rather than a URL slug.
// Slugs contain hyphens, underscores, spaces, or Arabic characters.
// Document IDs are purely alphanumeric strings (standard auto IDs are 20 characters).
function isLikelyFirestoreDocId(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  if (val.includes('-') || val.includes('_') || val.includes(' ') || val.includes('%')) {
    return false;
  }
  return /^[a-zA-Z0-9]{15,30}$/.test(val);
}

// In-memory cache for public products to avoid redundant Firestore reads
let productsCache: { data: Product[], timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const pendingRequests = new Map<string, Promise<Product[]>>();

export function extractProductImageUrls(prod: any): string[] {
  if (!prod) return [];
  const urls: string[] = [];
  if (typeof prod.mainImageUrl === 'string' && prod.mainImageUrl) {
    urls.push(prod.mainImageUrl);
  }
  if (Array.isArray(prod.additionalImages)) {
    urls.push(...prod.additionalImages);
  }
  if (Array.isArray(prod.colorVariants)) {
    prod.colorVariants.forEach((v: any) => {
      if (v.mainImage) urls.push(v.mainImage);
      if (Array.isArray(v.images)) urls.push(...v.images);
    });
  }
  if (Array.isArray(prod.variants)) {
    prod.variants.forEach((v: any) => {
      if (v.mainImage) urls.push(v.mainImage);
      if (v.imageUrl) urls.push(v.imageUrl);
      if (Array.isArray(v.images)) urls.push(...v.images);
    });
  }
  if (Array.isArray(prod.colors)) {
    prod.colors.forEach((c: any) => {
      if (c.imageUrl) urls.push(c.imageUrl);
      if (c.mainImage) urls.push(c.mainImage);
      if (Array.isArray(c.images)) urls.push(...c.images);
    });
  }
  return Array.from(new Set(urls.filter((u) => typeof u === 'string' && u.length > 0 && !u.startsWith('data:') && !u.startsWith('blob:'))));
}

export function normalizeProductDoc(data: any, id: string): Product {
  const stock = typeof data.stockQuantity === 'number' ? data.stockQuantity : (data.isAvailable !== false ? 10 : 0);
  const threshold = typeof data.lowStockThreshold === 'number' ? data.lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD;
  const isComingSoon = data.stockStatus === 'coming_soon';
  const isAvailable = isComingSoon ? false : (data.isAvailable !== false && stock > 0);
  const status = data.stockStatus || deriveStockStatus(stock, threshold, isAvailable, isComingSoon);

  const rawVariants = data.colorVariants || data.variants || data.colors || [];
  const colorVariants: ProductColorVariant[] = (Array.isArray(rawVariants) ? rawVariants : []).map((v: any, idx: number) => {
    const colorName = (v.colorName || v.name || '').trim();
    const colorCode = (v.colorCode || v.hex || '').trim();
    const rawMain = (v.mainImage || v.imageUrl || '').trim();
    const mainImage = (!rawMain.startsWith('data:') && !rawMain.startsWith('blob:')) ? rawMain : '';

    const rawImages: any[] = Array.isArray(v.images) ? v.images : [];
    const images: string[] = [];
    rawImages.forEach((img) => {
      if (typeof img === 'string' && img.trim().length > 0) {
        const trimmed = img.trim();
        if (!trimmed.startsWith('data:') && !trimmed.startsWith('blob:') && !images.includes(trimmed)) {
          images.push(trimmed);
        }
      }
    });

    if (mainImage && !images.includes(mainImage)) {
      images.unshift(mainImage);
    }

    return {
      id: v.id || `variant_${idx}_${Date.now()}`,
      colorName,
      colorCode,
      mainImage: mainImage || (images.length > 0 ? images[0] : null),
      images,
      sku: v.sku?.trim() || undefined,
      stockQuantity: typeof v.stockQuantity === 'number' ? v.stockQuantity : undefined,
      price: typeof v.price === 'number' ? v.price : undefined,
      oldPrice: typeof v.oldPrice === 'number' ? v.oldPrice : undefined,
      active: v.active !== false,
      name: colorName,
      hex: colorCode,
      imageUrl: mainImage || (images.length > 0 ? images[0] : '')
    };
  });

  const derivedColorImageMap: Record<string, string[]> = {};
  const derivedImageColorMap: Record<string, string> = {};

  colorVariants.forEach((v) => {
    if (v.colorName) {
      if (!derivedColorImageMap[v.colorName]) {
        derivedColorImageMap[v.colorName] = [];
      }
      (v.images || []).forEach((img) => {
        if (!derivedColorImageMap[v.colorName].includes(img)) {
          derivedColorImageMap[v.colorName].push(img);
        }
        derivedImageColorMap[img] = v.colorName;
      });
      if (v.mainImage) {
        derivedImageColorMap[v.mainImage] = v.colorName;
      }
    }
  });

  const mainImageUrl = (colorVariants[0]?.mainImage || colorVariants[0]?.images?.[0]) ||
    (typeof data.mainImageUrl === 'string' && !data.mainImageUrl.startsWith('data:') ? data.mainImageUrl : '');

  return {
    id,
    ...data,
    colorVariants,
    colors: colorVariants,
    variants: colorVariants,
    colorImageMap: derivedColorImageMap,
    imageColorMap: derivedImageColorMap,
    mainImageUrl,
    additionalImages: colorVariants.length > 0 ? [] : (Array.isArray(data.additionalImages) ? data.additionalImages.filter((img: any) => typeof img === 'string' && !img.startsWith('data:')) : []),
    stockQuantity: stock,
    lowStockThreshold: threshold,
    stockStatus: status,
    isAvailable,
    trackInventory: data.trackInventory !== false,
    showExactStockToCustomer: Boolean(data.showExactStockToCustomer),
    whatsappClicks: data.whatsappClicks || 0
  } as Product;
}

export const productService = {
  clearCache() {
    productsCache = null;
    pendingRequests.clear();
    if (typeof window !== 'undefined') {
      fetch('/api/cache/clear', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({type: 'products'}) 
      }).catch(()=>{});
    }
  },

  mapDocToProduct(docSnap: any): Product {
    return normalizeProductDoc(docSnap.data(), docSnap.id);
  },

  async getAllProducts(includeUnpublished = false): Promise<Product[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (!includeUnpublished && productsCache && (Date.now() - productsCache.timestamp < CACHE_TTL)) {
      return [...productsCache.data];
    }

    const reqKey = includeUnpublished ? 'all_products_admin' : 'all_products_public';
    if (pendingRequests.has(reqKey)) {
      return pendingRequests.get(reqKey)!;
    }

    const fetchPromise = (async () => {
      try {
        if (!isAdmin && !includeUnpublished) {
          try {
            const res = await fetch('/api/cache/products');
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
              const rawData = await res.json();
              if (Array.isArray(rawData)) {
                const products = rawData.map((d: any) => normalizeProductDoc(d, d.id));
                products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                productsCache = { data: [...products], timestamp: Date.now() };
                return products;
              }
            }
          } catch (fetchErr) {
            console.warn('Failed to fetch from server cache, falling back to Firestore:', fetchErr);
          }
        }

        const colRef = collection(db, COLLECTION_NAME);
        const constraints: any[] = [];
        if (!includeUnpublished) {
          constraints.push(where('isPublished', '==', true));
        }
        
        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);
        const products = snapshot.docs.map(docSnap => normalizeProductDoc(docSnap.data(), docSnap.id));
        products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        if (!includeUnpublished) {
          productsCache = { data: [...products], timestamp: Date.now() };
        }
        return products;
      } catch (error: any) {
        console.error('Error fetching products:', error);
        if (productsCache?.data) return [...productsCache.data];
        throw new Error(error?.message || 'تعذر جلب المنتجات من قاعدة البيانات.');
      } finally {
        pendingRequests.delete(reqKey);
      }
    })();

    pendingRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (!ids || ids.length === 0) return [];
    const all = await this.getAllProducts();
    return all.filter(p => ids.includes(p.id));
  },

  async getNewArrivals(limitNum: number = 10): Promise<Product[]> {
    const all = await this.getAllProducts();
    return all.filter(p => p.isAvailable && p.stockStatus !== 'out_of_stock' && p.stockStatus !== 'coming_soon').slice(0, limitNum);
  },

  async getFeaturedProducts(limitNum: number = 10): Promise<Product[]> {
    const all = await this.getAllProducts();
    return all.filter(p => p.isFeatured).slice(0, limitNum);
  },

  async getProductsByCategory(categoryId: string, limitNum?: number): Promise<Product[]> {
    const all = await this.getAllProducts();
    const filtered = all.filter(p => p.categoryId === categoryId || (p.categoryIds && p.categoryIds.includes(categoryId)));
    return limitNum ? filtered.slice(0, limitNum) : filtered;
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    if (!slug) return null;
    const rawSlug = slug.trim();
    const cleanSlug = rawSlug.toLowerCase();

    console.log('[productService.getProductBySlug] 1. Slug searched:', {
      rawSlug,
      cleanSlug
    });

    // Priority A: First try Firestore query
    // collection("products") where("slug", "==", cleanSlug) where("isPublished", "==", true) limit(1)
    if (db) {
      try {
        console.log('[productService.getProductBySlug] Priority A: Executing direct Firestore query for slug:', cleanSlug);
        const q = query(
          collection(db, COLLECTION_NAME),
          where('slug', '==', cleanSlug),
          where('isPublished', '==', true),
          limit(1)
        );
        const snap = await getDocs(q);
        const returnedDocIds = snap.docs.map(d => d.id);
        const returnedProductSlugs = snap.docs.map(d => d.data().slug);

        console.log('[productService.getProductBySlug] Priority A Query Results:', {
          slugSearched: cleanSlug,
          querySnapshotSize: snap.size,
          returnedDocumentIds: returnedDocIds,
          returnedProductSlugs: returnedProductSlugs
        });

        if (!snap.empty) {
          const docSnap = snap.docs[0];
          console.log('[productService.getProductBySlug] Priority A MATCH FOUND. Doc ID:', docSnap.id);
          return normalizeProductDoc(docSnap.data(), docSnap.id);
        }
      } catch (err) {
        console.error('[productService.getProductBySlug] Priority A query error:', err);
      }
    }

    // Priority B: If no result, query all published products from cache: getAllProducts(false) and find product.slug === cleanSlug
    try {
      console.log('[productService.getProductBySlug] Priority B: Querying published products from cache via getAllProducts(false)...');
      const allProducts = await this.getAllProducts(false);
      const allDocIds = allProducts.map(p => p.id);
      const allSlugs = allProducts.map(p => p.slug);

      console.log('[productService.getProductBySlug] Priority B Cache State:', {
        slugSearched: cleanSlug,
        totalPublishedProducts: allProducts.length,
        returnedDocumentIds: allDocIds,
        returnedProductSlugs: allSlugs
      });

      const matchedProduct = allProducts.find(p => {
        const pSlug = (p.slug || '').trim().toLowerCase();
        // 1. Direct case-insensitive match
        if (pSlug === cleanSlug) return true;

        // 2. Base slug match (strip random generated numeric suffix e.g. "vivo-y05-3841" -> "vivo-y05")
        const pBaseSlug = pSlug.replace(/-\d{3,6}$/, '');
        if (pBaseSlug === cleanSlug) return true;

        // 3. Prefix match with hyphen (e.g. "vivo-y05" matches "vivo-y05-3841")
        if (pSlug.startsWith(cleanSlug + '-')) return true;

        // 4. Canonical SEO slug match
        if (getProductCanonicalSlug(p).toLowerCase() === cleanSlug) return true;

        // 5. Normalized name match
        if (normalizeSlug(p.name || '').toLowerCase() === cleanSlug) return true;

        // 6. Direct product ID match if slug equals product.id
        if (p.id.toLowerCase() === cleanSlug) return true;

        return false;
      });

      if (matchedProduct) {
        console.log('[productService.getProductBySlug] Priority B MATCH FOUND:', {
          slugSearched: cleanSlug,
          matchedId: matchedProduct.id,
          matchedName: matchedProduct.name,
          matchedSlug: matchedProduct.slug
        });
        return matchedProduct;
      } else {
        console.log('[productService.getProductBySlug] Priority B: No match found among published products for slug:', cleanSlug);
      }
    } catch (err) {
      console.error('[productService.getProductBySlug] Priority B error querying published products:', err);
    }

    // Priority C: Only use getDoc(products/{id}) if the input is clearly a Firestore document ID, not a slug.
    // Do not call getDoc with slug values.
    if (db && isLikelyFirestoreDocId(rawSlug)) {
      try {
        console.log('[productService.getProductBySlug] Priority C: Input is verified as a Firestore document ID. Executing getDoc("products/' + rawSlug + '")');
        const docRef = doc(db, COLLECTION_NAME, rawSlug);
        const docSnap = await getDoc(docRef);

        console.log('[productService.getProductBySlug] Priority C Results:', {
          idSearched: rawSlug,
          exists: docSnap.exists(),
          returnedDocId: docSnap.id,
          returnedSlug: docSnap.exists() ? docSnap.data().slug : null
        });

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.isPublished !== false) {
            console.log('[productService.getProductBySlug] Priority C MATCH FOUND by direct doc ID:', docSnap.id);
            return normalizeProductDoc(data, docSnap.id);
          }
        }
      } catch (err) {
        console.error('[productService.getProductBySlug] Priority C direct getDoc error:', err);
      }
    } else {
      console.log('[productService.getProductBySlug] Priority C: Input "' + rawSlug + '" is a slug value, NOT a Firestore document ID. getDoc(products/{id}) skipped.');
    }

    console.warn('[productService.getProductBySlug] Product not found for slug or ID:', cleanSlug);
    return null;
  },

  async getProductById(id: string): Promise<Product | null> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return normalizeProductDoc(snap.data(), snap.id);
      }
      return null;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  },

  async saveProductSafely(id: string, productData: any, isNew: boolean = false): Promise<any> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    const docRef = doc(db, COLLECTION_NAME, id);
    const sanitizedPayload = serializeProductForFirestore(productData, id);

    if (isNew) {
      await setDoc(docRef, sanitizedPayload);
    } else {
      const updatePayload: Record<string, any> = {
        ...sanitizedPayload,
        colors: deleteField(),
        variants: deleteField(),
        colorImageMap: deleteField(),
        imageColorMap: deleteField()
      };
      if (Array.isArray(sanitizedPayload.colorVariants) && sanitizedPayload.colorVariants.length > 0) {
        updatePayload.additionalImages = deleteField();
      }
      await updateDoc(docRef, updatePayload);
    }
    this.clearCache();
    return sanitizedPayload;
  },

  async createProduct(productData: Omit<Product, 'id'>): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const newDocRef = doc(colRef);
    const stock = typeof productData.stockQuantity === 'number' ? productData.stockQuantity : (productData.isAvailable !== false ? 10 : 0);
    const threshold = typeof productData.lowStockThreshold === 'number' ? productData.lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD;
    const isComingSoon = productData.stockStatus === 'coming_soon';
    const isAvailable = isComingSoon ? false : (productData.isAvailable !== false && stock > 0);
    const status = productData.stockStatus || deriveStockStatus(stock, threshold, isAvailable, isComingSoon);

    await this.saveProductSafely(newDocRef.id, {
      ...productData,
      stockQuantity: stock,
      lowStockThreshold: threshold,
      stockStatus: status,
      isAvailable,
      trackInventory: productData.trackInventory !== false,
      showExactStockToCustomer: Boolean(productData.showExactStockToCustomer),
      oldPrice: productData.oldPrice !== undefined ? (productData.oldPrice || null) : null,
      whatsappClicks: productData.whatsappClicks || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, true);

    try {
      await auditService.recordAuditLog({
        action: 'PRODUCT_CREATED',
        entityType: 'product',
        entityId: newDocRef.id,
        entityName: productData.name,
        after: { name: productData.name }
      });
    } catch (e) {}
    return newDocRef.id;
  },

  async updateProduct(id: string, productData: Partial<Product>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    let oldUrls: string[] = [];
    let oldProduct: Product | null = null;
    if (snap.exists()) {
      oldProduct = normalizeProductDoc(snap.data(), snap.id);
      oldUrls = extractProductImageUrls(oldProduct);
    }

    const currentStock = typeof productData.stockQuantity === 'number' ? productData.stockQuantity : (oldProduct?.stockQuantity ?? 10);
    const currentThreshold = typeof productData.lowStockThreshold === 'number' ? productData.lowStockThreshold : (oldProduct?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD);
    const isComingSoon = productData.stockStatus === 'coming_soon' || (oldProduct?.stockStatus === 'coming_soon' && !productData.stockStatus);
    const isAvailable = isComingSoon ? false : (productData.isAvailable !== undefined ? productData.isAvailable : currentStock > 0);
    const status = productData.stockStatus || deriveStockStatus(currentStock, currentThreshold, isAvailable, isComingSoon);

    await this.saveProductSafely(id, {
      ...productData,
      stockQuantity: currentStock,
      lowStockThreshold: currentThreshold,
      stockStatus: status,
      isAvailable,
      updatedAt: serverTimestamp()
    }, false);

    if (oldUrls.length > 0) {
      const newUrls = extractProductImageUrls(productData);
      const removedUrls = oldUrls.filter(url => !newUrls.includes(url));
      if (removedUrls.length > 0) await storageService.safeDeleteFiles(removedUrls);
    }
  },

  async incrementWhatsAppClicks(productId: string): Promise<void> {
    if (!db || !productId) return;
    try {
      const docRef = doc(db, COLLECTION_NAME, productId);
      await updateDoc(docRef, { whatsappClicks: increment(1) });
    } catch (error) {}
  },

  async deleteProduct(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    let urlsToDelete: string[] = [];
    if (snap.exists()) {
      urlsToDelete = extractProductImageUrls(normalizeProductDoc(snap.data(), snap.id));
    }
    await deleteDoc(docRef);
    this.clearCache();
    if (urlsToDelete.length > 0) await storageService.safeDeleteFiles(urlsToDelete);
  },

  async getPaginatedProducts(
    pageSize = 12, 
    lastDoc: any = null, 
    options: { categoryId?: string; isFeatured?: boolean; searchQuery?: string } = {}
  ): Promise<{ products: Product[]; lastVisible: any }> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const constraints: QueryConstraint[] = [
        where('isPublished', '==', true),
        orderBy('sortOrder'),
        limit(pageSize)
      ];
      if (options.categoryId && options.categoryId !== 'all') constraints.push(where('categoryId', '==', options.categoryId));
      if (options.isFeatured) constraints.push(where('isFeatured', '==', true));
      if (lastDoc) constraints.push(startAfter(lastDoc));

      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map(docSnap => this.mapDocToProduct(docSnap));
      return { products, lastVisible: snapshot.docs[snapshot.docs.length - 1] };
    } catch (error) {
      const all = await this.getAllProducts(false);
      let filtered = all;
      if (options.categoryId && options.categoryId !== 'all') filtered = filtered.filter(p => p.categoryId === options.categoryId);
      if (options.isFeatured) filtered = filtered.filter(p => p.isFeatured);
      return { products: filtered.slice(0, pageSize), lastVisible: null };
    }
  },

  async duplicateProduct(id: string): Promise<string> {
    const existing = await this.getProductById(id);
    if (!existing) throw new Error('Product not found');
    const { id: _, ...rest } = existing;
    return this.createProduct({
      ...rest,
      name: `${existing.name} (نسخة)`,
      slug: `${existing.slug}-copy-${Date.now().toString().slice(-4)}`,
      sku: `${existing.sku}-COPY`,
      isPublished: false,
      sortOrder: (existing.sortOrder || 0) + 1
    });
  }
};
