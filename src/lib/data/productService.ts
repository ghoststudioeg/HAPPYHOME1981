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
import { normalizeSlug, getProductCanonicalSlug } from '../seoUtils';
import { auditService } from './auditService';

const COLLECTION_NAME = 'products';

// In-memory cache for public products to avoid redundant Firestore reads
let productsCache: { data: Product[], timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  // Normalize colorVariants from canonical or legacy structures
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

  // Dynamically derive in-memory colorImageMap & imageColorMap for any consumer
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

  // Merge any older legacy colorImageMap / imageColorMap stored in old docs
  if (data.colorImageMap && typeof data.colorImageMap === 'object') {
    Object.entries(data.colorImageMap).forEach(([col, urls]) => {
      if (typeof col === 'string' && Array.isArray(urls)) {
        if (!derivedColorImageMap[col]) derivedColorImageMap[col] = [];
        urls.forEach((u) => {
          if (typeof u === 'string' && !u.startsWith('data:') && !derivedColorImageMap[col].includes(u)) {
            derivedColorImageMap[col].push(u);
            derivedImageColorMap[u] = col;
          }
        });
      }
    });
  }

  if (data.imageColorMap && typeof data.imageColorMap === 'object') {
    Object.entries(data.imageColorMap).forEach(([u, col]) => {
      if (typeof u === 'string' && typeof col === 'string' && !u.startsWith('data:')) {
        derivedImageColorMap[u] = col;
        if (!derivedColorImageMap[col]) derivedColorImageMap[col] = [];
        if (!derivedColorImageMap[col].includes(u)) derivedColorImageMap[col].push(u);
      }
    });
  }

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
  },

  mapDocToProduct(docSnap: any): Product {
    return normalizeProductDoc(docSnap.data(), docSnap.id);
  },

  async getAllProducts(includeUnpublished = false): Promise<Product[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    // Serve from cache if available and not expired (public only)
    if (!includeUnpublished && productsCache && (Date.now() - productsCache.timestamp < CACHE_TTL)) {
      return [...productsCache.data];
    }
    
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const constraints: any[] = [];
      if (!includeUnpublished) {
        constraints.push(where('isPublished', '==', true));
      }
      
      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);

      const products = snapshot.docs.map(docSnap => normalizeProductDoc(docSnap.data(), docSnap.id));

      // Sort locally to avoid needing composite indexes in Firestore
      products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      // Update cache for public requests
      if (!includeUnpublished) {
        productsCache = { data: [...products], timestamp: Date.now() };
      }

      return products;
    } catch (error: any) {
      console.error('Error fetching products:', error);
      throw new Error(error?.message || 'تعذر جلب المنتجات من قاعدة البيانات.');
    }
  },

  async getProductsByCategory(categoryId: string, limitCount = 20): Promise<Product[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(
        colRef, 
        where('isPublished', '==', true), 
        where('categoryId', '==', categoryId),
        orderBy('sortOrder'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => this.mapDocToProduct(docSnap));
    } catch (error) {
      // Fallback to local filtering if index is missing or error
      const all = await this.getAllProducts(false);
      return all.filter(p => p.categoryId === categoryId).slice(0, limitCount);
    }
  },

  async getFeaturedProducts(limitCount = 10): Promise<Product[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(
        colRef, 
        where('isPublished', '==', true), 
        where('isFeatured', '==', true),
        orderBy('sortOrder'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => this.mapDocToProduct(docSnap));
    } catch (error) {
      const all = await this.getAllProducts(false);
      return all.filter(p => p.isFeatured === true).slice(0, limitCount);
    }
  },

  async getNewArrivals(limitCount = 10): Promise<Product[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(
        colRef, 
        where('isPublished', '==', true), 
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => this.mapDocToProduct(docSnap));
    } catch (error) {
      const all = await this.getAllProducts(false);
      return [...all].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }).slice(0, limitCount);
    }
  },

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (!db || !ids.length) return [];
    
    // Split into chunks of 10 because Firestore 'in' query has a limit of 10/30 depending on version
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }

    try {
      const results: Product[] = [];
      for (const chunk of chunks) {
        const colRef = collection(db, COLLECTION_NAME);
        const q = query(colRef, where('__name__', 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach(d => results.push(this.mapDocToProduct(d)));
      }
      return results;
    } catch (error) {
      console.error('Error fetching products by IDs:', error);
      return [];
    }
  },


  async getProductBySlug(identifier: string): Promise<Product | null> {
    if (!identifier) return null;
    const raw = identifier.trim();
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {}

    const all = await this.getAllProducts(false);

    // 1. Exact match by slug or id (raw or decoded)
    const exact = all.find(p => 
      p.slug === raw || 
      p.slug === decoded || 
      p.id === raw || 
      p.id === decoded
    );
    if (exact) return exact;

    // 2. Match by stable canonical slug (e.g. oppo-a6x matching oppo-a6x-3128)
    const targetNormalized = normalizeSlug(decoded);
    const byCanonical = all.find(p => {
      const pCanonical = getProductCanonicalSlug(p);
      return pCanonical === targetNormalized || normalizeSlug(p.name) === targetNormalized;
    });
    if (byCanonical) return byCanonical;

    // 3. Match without legacy trailing random digits (e.g. -3128, -1525)
    const byPrefix = all.find(p => {
      if (!p.slug) return false;
      const stripped = p.slug.replace(/-\d{3,6}$/, '');
      return stripped === targetNormalized || stripped === raw || stripped === decoded;
    });
    if (byPrefix) return byPrefix;

    // 4. Direct fetch by ID in case product was recently published or queried directly
    try {
      const direct = await this.getProductById(raw);
      if (direct && direct.isPublished !== false) return direct;
    } catch {}

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

    productsCache = null;
    return sanitizedPayload;
  },

  async createProduct(productData: Omit<Product, 'id'>): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    try {
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

      // Record audit log
      try {
        await auditService.recordAuditLog({
          action: 'PRODUCT_CREATED',
          entityType: 'product',
          entityId: newDocRef.id,
          entityName: productData.name,
          before: null,
          after: {
            name: productData.name,
            price: productData.price,
            oldPrice: productData.oldPrice,
            stockQuantity: stock,
            categoryId: productData.categoryId,
            isPublished: productData.isPublished !== false
          }
        });
      } catch (e) {
        console.warn('Could not record product creation audit log:', e);
      }

      // Check stock event
      try {
        if (!isAvailable || stock === 0) {
          await notificationEngine.fireStoreEvent({
            eventType: 'OUT_OF_STOCK',
            payload: { productId: newDocRef.id, productName: productData.name, stock: 0 }
          });
        }
      } catch (e) {}

      return newDocRef.id;
    } catch (error: any) {
      console.error('Error creating product:', error);
      throw new Error(error?.message || 'تعذر إنشاء المنتج في قاعدة البيانات.');
    }
  },

  async updateProduct(id: string, productData: Partial<Product>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      // Get old product to compare images & availability
      const snap = await getDoc(docRef);
      let oldUrls: string[] = [];
      let oldProduct: Product | null = null;
      if (snap.exists()) {
        oldProduct = normalizeProductDoc(snap.data(), snap.id);
        oldUrls = extractProductImageUrls(oldProduct);
      }

      const currentStock = typeof productData.stockQuantity === 'number'
        ? productData.stockQuantity
        : (oldProduct && typeof oldProduct.stockQuantity === 'number' ? oldProduct.stockQuantity : 10);

      const currentThreshold = typeof productData.lowStockThreshold === 'number'
        ? productData.lowStockThreshold
        : (oldProduct && typeof oldProduct.lowStockThreshold === 'number' ? oldProduct.lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD);

      const isComingSoon = productData.stockStatus === 'coming_soon' || (oldProduct?.stockStatus === 'coming_soon' && !productData.stockStatus);
      const isAvailable = isComingSoon ? false : (productData.isAvailable !== undefined ? productData.isAvailable : currentStock > 0);
      const status = productData.stockStatus || deriveStockStatus(currentStock, currentThreshold, isAvailable, isComingSoon);

      await this.saveProductSafely(id, {
        ...productData,
        stockQuantity: currentStock,
        lowStockThreshold: currentThreshold,
        stockStatus: status,
        isAvailable,
        oldPrice: productData.oldPrice !== undefined ? (productData.oldPrice || null) : undefined,
        updatedAt: serverTimestamp()
      }, false);

      // Record Audit Logs for Product Update
      try {
        const prodName = productData.name || oldProduct?.name || id;
        
        // 1. Price Change Check
        if (oldProduct && productData.price !== undefined && productData.price !== oldProduct.price) {
          await auditService.recordAuditLog({
            action: 'PRODUCT_PRICE_CHANGED',
            entityType: 'product',
            entityId: id,
            entityName: prodName,
            before: { price: oldProduct.price, oldPrice: oldProduct.oldPrice },
            after: { price: productData.price, oldPrice: productData.oldPrice }
          });
        }
        
        // 2. Stock Change Check
        if (oldProduct && productData.stockQuantity !== undefined && productData.stockQuantity !== oldProduct.stockQuantity) {
          await auditService.recordAuditLog({
            action: 'PRODUCT_STOCK_CHANGED',
            entityType: 'product',
            entityId: id,
            entityName: prodName,
            before: { stockQuantity: oldProduct.stockQuantity },
            after: { stockQuantity: productData.stockQuantity }
          });
        }

        // 3. Published Toggled Check
        if (oldProduct && productData.isPublished !== undefined && productData.isPublished !== oldProduct.isPublished) {
          await auditService.recordAuditLog({
            action: 'PRODUCT_PUBLISHED_TOGGLED',
            entityType: 'product',
            entityId: id,
            entityName: prodName,
            before: { isPublished: oldProduct.isPublished },
            after: { isPublished: productData.isPublished }
          });
        }

        // General Edit Audit Log (if not purely price/stock/publish toggle)
        const isPureSpecificChange =
          oldProduct &&
          Object.keys(productData).length === 1 &&
          ('price' in productData || 'stockQuantity' in productData || 'isPublished' in productData);

        if (!isPureSpecificChange) {
          await auditService.recordAuditLog({
            action: 'PRODUCT_EDITED',
            entityType: 'product',
            entityId: id,
            entityName: prodName,
            before: oldProduct ? {
              name: oldProduct.name,
              price: oldProduct.price,
              stockQuantity: oldProduct.stockQuantity,
              categoryId: oldProduct.categoryId,
              isPublished: oldProduct.isPublished
            } : null,
            after: {
              name: productData.name || oldProduct?.name,
              price: productData.price !== undefined ? productData.price : oldProduct?.price,
              stockQuantity: currentStock,
              categoryId: productData.categoryId || oldProduct?.categoryId,
              isPublished: productData.isPublished !== undefined ? productData.isPublished : oldProduct?.isPublished
            }
          });
        }
      } catch (e) {
        console.warn('Could not record product update audit log:', e);
      }

      // Trigger Stock Events if availability changed
      try {
        if (oldProduct) {
          if (oldProduct.isAvailable && !isAvailable) {
            await notificationEngine.fireStoreEvent({
              eventType: 'OUT_OF_STOCK',
              payload: { productId: id, productName: productData.name || oldProduct.name, stock: 0 }
            });
          } else if (!oldProduct.isAvailable && isAvailable && currentStock > 0) {
            await notificationEngine.fireStoreEvent({
              eventType: 'RESTOCKED',
              payload: { productId: id, productName: productData.name || oldProduct.name, stock: currentStock }
            });
          }
        }
      } catch (e) {
        console.warn('Could not fire stock notification event:', e);
      }
      
      // Identify removed URLs
      if (oldUrls.length > 0) {
        const imageFieldsUpdated = 'mainImageUrl' in productData || 'additionalImages' in productData || 'colors' in productData || 'colorVariants' in productData;
        
        if (imageFieldsUpdated) {
          const newUrls = extractProductImageUrls(productData);
          const removedUrls = oldUrls.filter(url => !newUrls.includes(url));
          if (removedUrls.length > 0) {
            await storageService.safeDeleteFiles(removedUrls);
          }
        }
      }

    } catch (error: any) {
      console.error('Error updating product:', error);
      throw new Error(error?.message || 'تعذر تحديث المنتج في قاعدة البيانات.');
    }
  },

  async incrementWhatsAppClicks(productId: string): Promise<void> {
    if (!db || !productId) return;
    try {
      const docRef = doc(db, COLLECTION_NAME, productId);
      await updateDoc(docRef, {
        whatsappClicks: increment(1)
      });
    } catch (error) {
      console.warn('Failed to increment WhatsApp clicks:', error);
    }
  },

  async deleteProduct(id: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      let urlsToDelete: string[] = [];
      if (snap.exists()) {
        const product = normalizeProductDoc(snap.data(), snap.id);
        urlsToDelete = extractProductImageUrls(product);
      }
      
      // 1. Delete Firestore record first
      await deleteDoc(docRef);
      productsCache = null;

      // Record audit log
      try {
        const deletedProd = snap.exists() ? (snap.data() as Product) : null;
        await auditService.recordAuditLog({
          action: 'PRODUCT_DELETED',
          entityType: 'product',
          entityId: id,
          entityName: deletedProd?.name || id,
          before: deletedProd ? {
            name: deletedProd.name,
            price: deletedProd.price,
            stockQuantity: deletedProd.stockQuantity,
            categoryId: deletedProd.categoryId
          } : null,
          after: null
        });
      } catch (e) {
        console.warn('Could not record product deletion audit log:', e);
      }
      
      // 2. Safely delete storage files (will skip if referenced elsewhere)
      if (urlsToDelete.length > 0) {
        await storageService.safeDeleteFiles(urlsToDelete);
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      throw new Error(error?.message || 'تعذر حذف المنتج من قاعدة البيانات.');
    }
  },

  async getPaginatedProducts(
    pageSize = 12, 
    lastDoc: any = null, 
    options: { categoryId?: string; isFeatured?: boolean; searchQuery?: string } = {}
  ): Promise<{ products: Product[]; lastVisible: any }> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const constraints: QueryConstraint[] = [
        where('isPublished', '==', true),
        orderBy('sortOrder'),
        limit(pageSize)
      ];

      if (options.categoryId && options.categoryId !== 'all') {
        constraints.push(where('categoryId', '==', options.categoryId));
      }
      
      if (options.isFeatured) {
        constraints.push(where('isFeatured', '==', true));
      }

      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);
      
      const products = snapshot.docs.map(docSnap => this.mapDocToProduct(docSnap));
      const newLastDoc = snapshot.docs[snapshot.docs.length - 1];

      return { products, lastVisible: newLastDoc };
    } catch (error) {
      console.error('Error fetching paginated products:', error);
      // Fallback: fetch all and slice if index is missing
      const all = await this.getAllProducts(false);
      let filtered = all;
      if (options.categoryId && options.categoryId !== 'all') {
        filtered = filtered.filter(p => p.categoryId === options.categoryId);
      }
      if (options.isFeatured) {
        filtered = filtered.filter(p => p.isFeatured);
      }
      return { products: filtered.slice(0, pageSize), lastVisible: null };
    }
  },

  async duplicateProduct(id: string): Promise<string> {
    const existing = await this.getProductById(id);
    if (!existing) {
      throw new Error('Product not found for duplication');
    }
    const { id: _, ...rest } = existing;
    const duplicatedData: Omit<Product, 'id'> = {
      ...rest,
      name: `${existing.name} (نسخة)`,
      slug: `${existing.slug}-copy-${Date.now().toString().slice(-4)}`,
      sku: `${existing.sku}-COPY`,
      isPublished: false,
      sortOrder: (existing.sortOrder || 0) + 1
    };
    return this.createProduct(duplicatedData);
  }
};
