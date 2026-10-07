import { supabaseDb, supabaseAdmin } from './supabaseDb';
import { Product } from '../../types';
import { notificationEngine } from '../notificationEngine';
import { deriveStockStatus, DEFAULT_LOW_STOCK_THRESHOLD } from './inventoryService';
import { auditService } from './auditService';
import { getProductCanonicalSlug, normalizeSlug } from '../seoUtils';

const COLLECTION_NAME = 'products';

let productsCache: { data: Product[]; timestamp: number } | null = null;
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
  return Array.from(new Set(urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)));
}

export const productService = {
  invalidateCache() {
    productsCache = null;
  },

  async getAllProducts(includeUnpublished = false): Promise<Product[]> {
    const now = Date.now();
    if (!includeUnpublished && productsCache && now - productsCache.timestamp < CACHE_TTL) {
      return productsCache.data;
    }

    try {
      // 1. Try PostgreSQL table in Supabase first
      let query = supabaseAdmin.from('products').select('*');
      
      // Attempt to filter by is_published if the column is expected to exist
      // If it doesn't exist, the query will fail and we'll handle it in the catch/error block
      if (!includeUnpublished) {
        query = query.eq('is_published', true);
      }
      
      const { data, error } = await query;

      let rawData: any[] = [];

      if (!error && Array.isArray(data)) {
        rawData = data;
      } else {
        // Fallback to Supabase JSON store or simple select without filters
        rawData = await supabaseDb.getCollection<any>(COLLECTION_NAME);
      }

      // 2. Always map raw data to the Product interface to ensure camelCase consistency
      const list: Product[] = rawData.map((d: any) => ({
        id: String(d.id),
        name: d.name || '',
        slug: d.slug || '',
        categoryId: d.category_id || d.categoryId || '',
        companyId: d.company_id || d.companyId || '',
        sku: d.sku || '',
        price: Number(d.price) || 0,
        oldPrice: d.old_price !== undefined ? (d.old_price !== null ? Number(d.old_price) : undefined) : (d.oldPrice !== undefined ? Number(d.oldPrice) : undefined),
        description: d.description || '',
        features: Array.isArray(d.features) ? d.features : typeof d.features === 'string' ? d.features.split('\n') : [],
        specifications: d.specifications || {},
        colorVariants: d.color_variants || d.colorVariants || [],
        mainImageUrl: d.main_image_url || d.mainImageUrl || '',
        additionalImages: d.additional_images || d.additionalImages || [],
        stockQuantity: typeof d.stock_quantity === 'number' ? d.stock_quantity : (typeof d.stockQuantity === 'number' ? d.stockQuantity : 0),
        stockStatus: d.stock_status || d.stockStatus || 'in_stock',
        isAvailable: d.is_available ?? d.isAvailable ?? true,
        isFeatured: d.is_featured ?? d.isFeatured ?? false,
        isPublished: d.is_published ?? d.isPublished ?? true,
        isDeleted: d.is_deleted ?? d.isDeleted ?? false,
        viewsCount: d.views_count || d.viewsCount || 0,
        purchasesCount: d.purchases_count || d.purchasesCount || 0,
        ratingAverage: d.rating_average || d.ratingAverage || 0,
        reviewsCount: d.reviews_count || d.reviewsCount || 0,
        sortOrder: d.sort_order || d.sortOrder || 0,
        createdAt: d.created_at || d.createdAt || new Date().toISOString(),
        updatedAt: d.updated_at || d.updatedAt || new Date().toISOString()
      }));

      const filtered = list.filter((p) => {
        if (p.isDeleted) return false;
        if (!includeUnpublished && !p.isPublished) return false;
        return true;
      });

      if (!includeUnpublished) {
        productsCache = { data: filtered, timestamp: now };
      }

      console.log(`[DIAGNOSTIC] productService.getAllProducts returning ${filtered.length} products (includeUnpublished=${includeUnpublished})`);
      return filtered;
    } catch (err) {
      console.error('Error in productService.getAllProducts:', err);
      return productsCache?.data || [];
    }
  },

  async getProductById(id: string): Promise<Product | null> {
    const products = await this.getAllProducts(true);
    return products.find((p) => p.id === id) || null;
  },

  async getProductBySlug(slugInput: string): Promise<Product | null> {
    const normalizedInput = normalizeSlug(slugInput);
    const products = await this.getAllProducts(true);
    return products.find((p) => {
      if (p.id === slugInput) return true;
      const canonical = getProductCanonicalSlug(p);
      return normalizeSlug(canonical) === normalizedInput || normalizeSlug(p.slug) === normalizedInput;
    }) || null;
  },

  async getProductsByCategory(categoryId: string, limitNum?: number): Promise<Product[]> {
    const products = await this.getAllProducts(false);
    const filtered = products.filter((p) => p.categoryId === categoryId);
    return limitNum ? filtered.slice(0, limitNum) : filtered;
  },

  async getProductsByCompany(companyId: string): Promise<Product[]> {
    const products = await this.getAllProducts(false);
    return products.filter((p) => p.companyId === companyId);
  },

  async getNewArrivals(limitNum = 8): Promise<Product[]> {
    const products = await this.getAllProducts(false);
    return products
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limitNum);
  },

  async getFeaturedProducts(limitNum = 12): Promise<Product[]> {
    const products = await this.getAllProducts(false);
    return products
      .filter((p) => p.isFeatured)
      .slice(0, limitNum);
  },

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (!ids || ids.length === 0) return [];
    const products = await this.getAllProducts(true);
    return products.filter((p) => ids.includes(p.id));
  },

  async createProduct(productData: Omit<Product, 'id'>): Promise<string> {
    this.invalidateCache();
    const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newProduct: Product = {
      ...productData,
      id,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await supabaseDb.setDoc(COLLECTION_NAME, id, newProduct);

    try {
      await supabaseAdmin.from('products').upsert([{
        id,
        name: newProduct.name,
        slug: newProduct.slug,
        category_id: newProduct.categoryId || null,
        company_id: newProduct.companyId || null,
        sku: newProduct.sku,
        price: newProduct.price,
        old_price: newProduct.oldPrice || null,
        description: newProduct.description,
        main_image_url: newProduct.mainImageUrl,
        is_available: newProduct.isAvailable,
        is_featured: newProduct.isFeatured,
        is_published: newProduct.isPublished,
        is_deleted: false,
        stock_quantity: newProduct.stockQuantity
      }]);
    } catch {}

    await auditService.logAction('CREATE', 'product', id, { name: newProduct.name });
    return id;
  },

  async updateProduct(id: string, partial: Partial<Product>): Promise<void> {
    this.invalidateCache();
    await supabaseDb.updateDoc(COLLECTION_NAME, id, partial);

    try {
      const dbPayload: any = { updated_at: new Date().toISOString() };
      if (partial.name !== undefined) dbPayload.name = partial.name;
      if (partial.slug !== undefined) dbPayload.slug = partial.slug;
      if (partial.categoryId !== undefined) dbPayload.category_id = partial.categoryId;
      if (partial.companyId !== undefined) dbPayload.company_id = partial.companyId;
      if (partial.sku !== undefined) dbPayload.sku = partial.sku;
      if (partial.price !== undefined) dbPayload.price = partial.price;
      if (partial.oldPrice !== undefined) dbPayload.old_price = partial.oldPrice;
      if (partial.description !== undefined) dbPayload.description = partial.description;
      if (partial.features !== undefined) dbPayload.features = Array.isArray(partial.features) ? partial.features.join('\n') : partial.features;
      if (partial.mainImageUrl !== undefined) dbPayload.main_image_url = partial.mainImageUrl;
      if (partial.stockQuantity !== undefined) dbPayload.stock_quantity = partial.stockQuantity;
      if (partial.isAvailable !== undefined) dbPayload.is_available = partial.isAvailable;
      if (partial.isFeatured !== undefined) dbPayload.is_featured = partial.isFeatured;
      if (partial.isPublished !== undefined) dbPayload.is_published = partial.isPublished;
      if (partial.isDeleted !== undefined) dbPayload.is_deleted = partial.isDeleted;
      if (partial.sortOrder !== undefined) dbPayload.sort_order = partial.sortOrder;

      await supabaseAdmin.from('products').update(dbPayload).eq('id', id);
    } catch {}

    await auditService.logAction('UPDATE', 'product', id, partial);
  },

  /**
   * Soft Delete implementation strictly as specified in security guidelines.
   * Product is marked as is_deleted = true, is_published = false, is_available = false
   * to preserve historic orders, bundle items, and analytics intact.
   */
  async deleteProduct(id: string): Promise<void> {
    this.invalidateCache();
    await this.updateProduct(id, {
      isDeleted: true,
      isPublished: false,
      isAvailable: false
    });
    await auditService.logAction('SOFT_DELETE', 'product', id, { reason: 'Soft deleted by admin' });
  },

  async incrementViews(id: string): Promise<void> {
    try {
      const prod = await this.getProductById(id);
      if (prod) {
        await this.updateProduct(id, { viewsCount: (prod.viewsCount || 0) + 1 });
      }
    } catch {}
  },

  async duplicateProduct(id: string): Promise<string> {
    const prod = await this.getProductById(id);
    if (!prod) throw new Error('المنتج غير موجود.');
    const newProduct: Omit<Product, 'id'> = {
      ...prod,
      name: `${prod.name} (نسخة)`,
      slug: `${prod.slug}-copy-${Date.now()}`
    };
    return await this.createProduct(newProduct);
  },

  async incrementWhatsAppClicks(id: string): Promise<void> {
    try {
      const prod = await this.getProductById(id);
      if (prod) {
        await this.updateProduct(id, { whatsappClicks: ((prod as any).whatsappClicks || 0) + 1 });
      }
    } catch {}
  }
};
