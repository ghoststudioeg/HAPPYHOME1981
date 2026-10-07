import { supabaseDb, supabaseAdmin } from './supabaseDb';
import { Promotion } from '../../types';
import { auditService } from './auditService';

const COLLECTION_NAME = 'promotions';

// In-memory cache for promotions
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
   * Fetches all promotions from Supabase, sorted by priority desc, then updatedAt desc.
   */
  async getAllPromotions(): Promise<Promotion[]> {
    // Serve from cache if fresh
    if (promotionsCache && (Date.now() - promotionsCache.timestamp < CACHE_TTL)) {
      return [...promotionsCache.data];
    }

    try {
      const list: Promotion[] = [];
      promotionsCache = { data: list, timestamp: Date.now() };
      return list;
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
    if (!id) return null;
    const all = await this.getAllPromotions();
    return all.find(p => p.id === id) || null;
  },

  /**
   * Creates a new promotion.
   */
  async createPromotion(
    promoData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const id = `promo_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newPromo: Promotion = {
      ...promoData,
      id,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await supabaseDb.setDoc(COLLECTION_NAME, id, newPromo);
    
    try {
      await supabaseAdmin.from(COLLECTION_NAME).upsert([{
        id,
        name: newPromo.name,
        badge_text: newPromo.badgeText,
        description: newPromo.description,
        is_flash_sale: newPromo.isFlashSale,
        discount_type: newPromo.discountType,
        discount_percent: newPromo.discountPercent,
        discount_amount: newPromo.discountAmount,
        promotion_price: newPromo.promotionPrice,
        start_date: newPromo.startDate,
        end_date: newPromo.endDate,
        priority: newPromo.priority,
        is_active: newPromo.isActive,
        product_ids: newPromo.productIds,
        category_ids: newPromo.categoryIds,
        created_at: nowIso,
        updated_at: nowIso
      }]);
    } catch {}

    this.clearCache();
    await auditService.logAction('CREATE', 'promotion', id, { name: newPromo.name });
    return id;
  },

  /**
   * Updates an existing promotion.
   */
  async updatePromotion(id: string, promoData: Partial<Promotion>): Promise<void> {
    await supabaseDb.updateDoc(COLLECTION_NAME, id, promoData);
    
    try {
      const dbPayload: any = { updated_at: new Date().toISOString() };
      if (promoData.name !== undefined) dbPayload.name = promoData.name;
      if (promoData.isActive !== undefined) dbPayload.is_active = promoData.isActive;
      // Add other fields as needed
      await supabaseAdmin.from(COLLECTION_NAME).update(dbPayload).eq('id', id);
    } catch {}

    this.clearCache();
    await auditService.logAction('UPDATE', 'promotion', id, promoData);
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
    await supabaseDb.deleteDoc(COLLECTION_NAME, id);
    try {
      await supabaseAdmin.from(COLLECTION_NAME).delete().eq('id', id);
    } catch {}
    this.clearCache();
    await auditService.logAction('DELETE', 'promotion', id);
  },

  /**
   * Detects potential conflicts between promotions targeting the same products.
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
      if (currentPromoId && promo.id === currentPromoId) continue;
      if (promo.isActive === false) continue;

      const promoStart = promo.startDate ? new Date(promo.startDate).getTime() : 0;
      const promoEnd = promo.endDate ? new Date(promo.endDate).getTime() : Infinity;

      const hasDateOverlap = !(targetEnd < promoStart || targetStart > promoEnd);
      if (!hasDateOverlap) continue;

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
