import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Promotion } from '../../types';
import { sanitizeForFirestore } from '../firestoreUtils';
import { auditService } from './auditService';

const PROMOTIONS_COLLECTION = 'promotions';

// In-memory cache for promotions to avoid redundant Firestore reads
let promotionsCache: { data: Promotion[], timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface PromotionConflict {
  productId: string;
  conflictingPromotionId: string;
  conflictingPromotionName: string;
  currentPriority: number;
  conflictingPriority: number;
  winner: 'current' | 'existing';
  overlapStartDate: string;
  overlapEndDate: string;
}

export const promotionService = {
  clearCache() {
    promotionsCache = null;
  },

  /**
   * Fetches all promotions from Firestore, sorted by priority desc, then updatedAt desc.
   */
  async getAllPromotions(): Promise<Promotion[]> {
    if (!db) return [];

    // Serve from cache if fresh
    if (promotionsCache && (Date.now() - promotionsCache.timestamp < CACHE_TTL)) {
      return [...promotionsCache.data];
    }

    try {
      const colRef = collection(db, PROMOTIONS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const list: Promotion[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data()
        } as Promotion);
      });

      if (list.length === 0) {
        // Automatically seed an initial active flash sale promotion so the engine is immediately active
        try {
          const prodsSnap = await getDocs(collection(db, 'products'));
          const prodIds: string[] = [];
          prodsSnap.forEach((doc) => prodIds.push(doc.id));
          if (prodIds.length > 0) {
            const now = new Date();
            const future = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days ahead
            const samplePromo: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'> = {
              name: 'عروض الفلاش سيل الكبرى',
              badgeText: 'عرض لفترة محدودة',
              description: 'خصومات حصرية لفترة محدودة على المنتجات المختارة',
              isFlashSale: true,
              discountType: 'percentage',
              discountPercent: 15,
              startDate: now.toISOString(),
              endDate: future.toISOString(),
              priority: 10,
              isActive: true,
              productIds: prodIds.slice(0, 4),
              categoryIds: []
            };
            const newId = await this.createPromotion(samplePromo);
            list.push({
              id: newId,
              ...samplePromo,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString()
            });
          }
        } catch (seedErr) {
          console.warn('Could not auto-seed sample promotion:', seedErr);
        }
      }

      const sorted = list.sort((a, b) => {
        const pDiff = (b.priority || 0) - (a.priority || 0);
        if (pDiff !== 0) return pDiff;
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

      // Update cache
      promotionsCache = { data: [...sorted], timestamp: Date.now() };

      return sorted;
    } catch (error) {
      console.error('Error fetching promotions:', error);
      return [];
    }
  },

  /**
   * Returns all promotions that are currently active and unexpired.
   */
  async getActivePromotions(now: Date = new Date()): Promise<Promotion[]> {
    const all = await this.getAllPromotions();
    const currentTime = now.getTime();

    return all.filter((promo) => {
      if (promo.isActive === false) return false;

      // Start date check
      if (promo.startDate) {
        const start = new Date(promo.startDate).getTime();
        if (!isNaN(start) && currentTime < start) return false;
      }

      // End date check
      if (promo.endDate) {
        const end = new Date(promo.endDate.includes('T') ? promo.endDate : `${promo.endDate}T23:59:59`).getTime();
        if (!isNaN(end) && currentTime > end) return false;
      }

      return true;
    });
  },

  /**
   * Returns all currently active Flash Sales (promotions with isFlashSale: true).
   */
  async getActiveFlashSales(now: Date = new Date()): Promise<Promotion[]> {
    const active = await this.getActivePromotions(now);
    return active.filter((p) => p.isFlashSale === true);
  },

  /**
   * Fetches a single promotion by ID.
   */
  async getPromotionById(id: string): Promise<Promotion | null> {
    if (!db || !id) return null;
    try {
      const docRef = doc(db, PROMOTIONS_COLLECTION, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Promotion;
    } catch (error) {
      console.error(`Error fetching promotion ${id}:`, error);
      return null;
    }
  },

  /**
   * Creates a new promotion with sanitized Firestore data.
   */
  async createPromotion(
    promoData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, PROMOTIONS_COLLECTION);
      const sanitized = sanitizeForFirestore({
        ...promoData,
        productIds: Array.isArray(promoData.productIds) ? promoData.productIds : [],
        categoryIds: Array.isArray(promoData.categoryIds) ? promoData.categoryIds : [],
        priority: typeof promoData.priority === 'number' ? promoData.priority : 10,
        isActive: promoData.isActive !== false,
        isFlashSale: Boolean(promoData.isFlashSale),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const docRef = await addDoc(colRef, sanitized);

      // Invalidate cache
      this.clearCache();

      try {
        await auditService.recordAuditLog({
          action: 'PROMOTION_CREATED',
          entityType: 'promotion',
          entityId: docRef.id,
          entityName: promoData.name || 'عرض ترويجي جديد',
          after: { name: promoData.name, discountPercent: promoData.discountPercent }
        });
      } catch (e) {}

      return docRef.id;
    } catch (error: any) {
      console.error('Error creating promotion:', error);
      throw new Error(error?.message || 'تعذر إنشاء العرض الترويجي.');
    }
  },

  /**
   * Updates an existing promotion.
   */
  async updatePromotion(id: string, promoData: Partial<Promotion>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, PROMOTIONS_COLLECTION, id);
      const snap = await getDoc(docRef);
      const sanitized = sanitizeForFirestore({
        ...promoData,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, sanitized);

      // Invalidate cache
      this.clearCache();

      try {
        const pName = promoData.name || (snap.exists() ? snap.data().name : id);
        await auditService.recordAuditLog({
          action: 'PROMOTION_EDITED',
          entityType: 'promotion',
          entityId: id,
          entityName: pName,
          before: snap.exists() ? { name: snap.data().name, isActive: snap.data().isActive } : null,
          after: { name: promoData.name || snap.data()?.name, isActive: promoData.isActive !== undefined ? promoData.isActive : snap.data()?.isActive }
        });
      } catch (e) {}
    } catch (error: any) {
      console.error(`Error updating promotion ${id}:`, error);
      throw new Error(error?.message || 'تعذر تعديل العرض الترويجي.');
    }
  },

  /**
   * Quick toggle of promotion active status.
   */
  async togglePromotionActive(id: string, isActive: boolean): Promise<void> {
    await this.updatePromotion(id, { isActive });
  },

  /**
   * Deletes a promotion.
   */
  async deletePromotion(id: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, PROMOTIONS_COLLECTION, id);
      const snap = await getDoc(docRef);
      await deleteDoc(docRef);

      // Invalidate cache
      this.clearCache();

      try {
        const deletedPromo = snap.exists() ? snap.data() : null;
        await auditService.recordAuditLog({
          action: 'PROMOTION_DELETED',
          entityType: 'promotion',
          entityId: id,
          entityName: deletedPromo?.name || id,
          before: deletedPromo ? { name: deletedPromo.name } : null,
          after: null
        });
      } catch (e) {}
    } catch (error: any) {
      console.error(`Error deleting promotion ${id}:`, error);
      throw new Error(error?.message || 'تعذر حذف العرض الترويجي.');
    }
  },

  /**
   * Detects potential conflicts between promotions targeting the same products.
   * If two promotions overlap in date and target the same product, explicit priority determines the winner.
   * Never randomly selects a price!
   */
  detectConflicts(
    target: Partial<Promotion>,
    allPromotions: Promotion[],
    currentPromoId?: string
  ): PromotionConflict[] {
    const conflicts: PromotionConflict[] = [];
    if (!target.productIds || target.productIds.length === 0) return conflicts;

    const targetStart = target.startDate ? new Date(target.startDate).getTime() : 0;
    const targetEnd = target.endDate ? new Date(target.endDate).getTime() : Infinity;
    const targetPriority = typeof target.priority === 'number' ? target.priority : 10;

    for (const promo of allPromotions) {
      // Skip comparing with self
      if (currentPromoId && promo.id === currentPromoId) continue;
      // Skip inactive promotions
      if (promo.isActive === false) continue;

      const promoStart = promo.startDate ? new Date(promo.startDate).getTime() : 0;
      const promoEnd = promo.endDate ? new Date(promo.endDate).getTime() : Infinity;

      // Check date overlap
      const hasDateOverlap = !(targetEnd < promoStart || targetStart > promoEnd);
      if (!hasDateOverlap) continue;

      // Check product intersection
      const sharedProducts = target.productIds.filter((pId) => promo.productIds?.includes(pId));
      for (const pId of sharedProducts) {
        const promoPriority = typeof promo.priority === 'number' ? promo.priority : 10;
        conflicts.push({
          productId: pId,
          conflictingPromotionId: promo.id,
          conflictingPromotionName: promo.name,
          currentPriority: targetPriority,
          conflictingPriority: promoPriority,
          winner: targetPriority >= promoPriority ? 'current' : 'existing',
          overlapStartDate: promo.startDate,
          overlapEndDate: promo.endDate
        });
      }
    }

    return conflicts;
  }
};
