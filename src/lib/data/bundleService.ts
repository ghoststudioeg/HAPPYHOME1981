import { supabaseDb } from './supabaseDb';
import { BundleOffer, Product } from '../../types';
import { productService } from './productService';
import { auditService } from './auditService';

const BUNDLE_COLLECTION = 'bundle_offers';

let bundlesCache: { data: BundleOffer[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export function isBundleActive(bundle: BundleOffer): boolean {
  if (!bundle.isActive) return false;
  const now = Date.now();
  if (bundle.startAt) {
    const start = new Date(bundle.startAt).getTime();
    if (!isNaN(start) && now < start) return false;
  }
  if (bundle.endAt) {
    const end = new Date(bundle.endAt.includes('T') ? bundle.endAt : `${bundle.endAt}T23:59:59`).getTime();
    if (!isNaN(end) && now > end) return false;
  }
  return true;
}

export function calculateBundleStock(bundleProducts: Product[]): number {
  if (!bundleProducts || bundleProducts.length === 0) return 0;
  const stocks = bundleProducts.map((p) => {
    if (!p.isAvailable || p.isPublished === false || p.isDeleted) return 0;
    return typeof p.stockQuantity === 'number' ? p.stockQuantity : 0;
  });
  return Math.max(0, Math.min(...stocks));
}

export const bundleService = {
  clearCache() {
    bundlesCache = null;
  },

  async getAllBundles(forceRefresh = false): Promise<BundleOffer[]> {
    const now = Date.now();
    if (!forceRefresh && bundlesCache && now - bundlesCache.timestamp < CACHE_TTL) {
      return [...bundlesCache.data];
    }

    try {
      const list = await supabaseDb.getCollection<BundleOffer>(BUNDLE_COLLECTION);
      list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      bundlesCache = { data: list, timestamp: now };
      return list;
    } catch (err) {
      console.warn('Failed to fetch bundles from Supabase:', err);
      return bundlesCache?.data || [];
    }
  },

  async getActiveBundles(): Promise<BundleOffer[]> {
    const all = await this.getAllBundles();
    return all.filter(isBundleActive);
  },

  async getHomeBundles(): Promise<BundleOffer[]> {
    const active = await this.getActiveBundles();
    return active.filter((b) => b.showOnHome !== false);
  },

  async getBundleById(id: string): Promise<BundleOffer | null> {
    if (!id) return null;
    const all = await this.getAllBundles();
    return all.find((b) => b.id === id) || null;
  },

  async getBundleBySlug(slug: string): Promise<BundleOffer | null> {
    if (!slug) return null;
    const cleanSlug = decodeURIComponent(slug).trim().toLowerCase();
    const all = await this.getAllBundles();
    return all.find(
      (b) => b.slug?.toLowerCase() === cleanSlug || b.id.toLowerCase() === cleanSlug
    ) || null;
  },

  async resolveBundleProducts(bundle: BundleOffer): Promise<Product[]> {
    if (!bundle.productIds || bundle.productIds.length === 0) return [];
    try {
      const allProducts = await productService.getAllProducts(false);
      return bundle.productIds
        .map((pid) => allProducts.find((p) => p.id === pid))
        .filter((p): p is Product => !!p);
    } catch (err) {
      console.warn('Error resolving bundle products:', err);
      return [];
    }
  },

  async createBundle(data: Omit<BundleOffer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error('اسم العرض مطلوب');
    if (!data.productIds || data.productIds.length < 2) {
      throw new Error('يجب اختيار منتجين على الأقل لإنشاء عرض مركب');
    }
    if (!data.imageUrl) {
      throw new Error('يرجى رفع تصميم أو صورة العرض');
    }

    const cleanSlug = (data.slug?.trim() || cleanName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\u0600-\u06FF-]/g, ''))
      .toLowerCase()
      .slice(0, 100);

    const docId = data.id || `bundle_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newBundle: BundleOffer = {
      ...data,
      id: docId,
      name: cleanName,
      slug: cleanSlug,
      createdAt: nowIso,
      updatedAt: nowIso,
      viewsCount: 0,
      clicksCount: 0,
      purchasesCount: 0
    };

    await supabaseDb.setDoc(BUNDLE_COLLECTION, docId, newBundle);
    this.clearCache();

    auditService.recordAuditLog({
      entityType: 'promotion',
      action: 'create',
      entityId: docId,
      entityName: cleanName,
      before: null,
      after: newBundle,
      customSummary: `تم إنشاء عرض مركب جديد "${cleanName}" يشمل ${data.productIds.length} منتجات`
    }).catch(() => {});

    return docId;
  },

  async updateBundle(id: string, updates: Partial<BundleOffer>): Promise<void> {
    if (!id) return;
    const existing = await this.getBundleById(id);
    await supabaseDb.updateDoc(BUNDLE_COLLECTION, id, updates);
    this.clearCache();

    if (existing) {
      auditService.recordAuditLog({
        entityType: 'promotion',
        action: 'update',
        entityId: id,
        entityName: existing.name,
        before: existing,
        after: { ...existing, ...updates },
        customSummary: `تم تعديل بيانات العرض المركب "${existing.name}"`
      }).catch(() => {});
    }
  },

  async deleteBundle(id: string): Promise<void> {
    if (!id) return;
    const existing = await this.getBundleById(id);
    await supabaseDb.deleteDoc(BUNDLE_COLLECTION, id);
    this.clearCache();

    if (existing) {
      auditService.recordAuditLog({
        entityType: 'promotion',
        action: 'delete',
        entityId: id,
        entityName: existing.name,
        before: existing,
        after: null,
        customSummary: `تم حذف العرض المركب "${existing.name}"`
      }).catch(() => {});
    }
  },

  async recordView(bundleId: string): Promise<void> {
    const bundle = await this.getBundleById(bundleId);
    if (bundle) {
      await this.updateBundle(bundleId, { viewsCount: (bundle.viewsCount || 0) + 1 });
    }
  },

  async recordClick(bundleId: string): Promise<void> {
    const bundle = await this.getBundleById(bundleId);
    if (bundle) {
      await this.updateBundle(bundleId, { clicksCount: (bundle.clicksCount || 0) + 1 });
    }
  }
};
