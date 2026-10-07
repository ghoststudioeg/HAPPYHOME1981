import { supabaseDb } from './supabaseDb';
import { ProductReview } from '../../types';

export const reviewService = {
  async getProductReviews(productId: string): Promise<ProductReview[]> {
    if (!productId) return [];
    try {
      const allReviews = await supabaseDb.getCollection<ProductReview>('product_reviews');
      return allReviews.filter((r) => (r.productId === productId || (r as any).product_id === productId) && r.isApproved !== false);
    } catch {
      return [];
    }
  },

  async addReview(reviewData: Omit<ProductReview, 'id' | 'createdAt'>): Promise<string> {
    const id = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newReview: ProductReview = {
      ...reviewData,
      id,
      isApproved: true,
      createdAt: new Date().toISOString()
    };
    await supabaseDb.setDoc('product_reviews', id, newReview);
    return id;
  },

  async getReviewsForAdmin(limitOrFilters?: any): Promise<ProductReview[]> {
    try {
      const list = await supabaseDb.getCollection<ProductReview>('product_reviews');
      if (limitOrFilters && typeof limitOrFilters === 'object') {
        const { status, productId } = limitOrFilters;
        let filtered = [...list];
        if (status && status !== 'all') {
          if (status === 'approved') {
            filtered = filtered.filter(r => r.isApproved === true || (r as any).status === 'approved');
          } else if (status === 'pending') {
            filtered = filtered.filter(r => r.isApproved === false || (r as any).status === 'pending');
          } else if (status === 'rejected') {
            filtered = filtered.filter(r => (r as any).status === 'rejected');
          }
        }
        if (productId && productId !== 'all') {
          filtered = filtered.filter(r => r.productId === productId || (r as any).product_id === productId);
        }
        return filtered;
      }
      const limit = typeof limitOrFilters === 'number' ? limitOrFilters : undefined;
      return limit ? list.slice(0, limit) : list;
    } catch {
      return [];
    }
  },

  async updateReviewStatus(arg1: string, arg2: any, arg3?: any): Promise<void> {
    try {
      const list = await supabaseDb.getCollection<any>('product_reviews');
      
      if (typeof arg2 === 'string' && typeof arg3 === 'string') {
        const productId = arg1;
        const customerUid = arg2;
        const newStatus = arg3;
        const isApproved = newStatus === 'approved';
        
        const review = list.find(r => 
          (r.productId === productId || r.product_id === productId) && 
          (r.customerUid === customerUid || r.userId === customerUid || r.firebase_uid === customerUid)
        );
        if (review) {
          await supabaseDb.updateDoc('product_reviews', review.id, { isApproved, status: newStatus });
        }
      } else {
        const id = arg1;
        const isApproved = !!arg2;
        const note = arg3;
        const status = isApproved ? 'approved' : 'rejected';
        await supabaseDb.updateDoc('product_reviews', id, { isApproved, note, status });
      }
    } catch (err) {
      console.error('[ReviewService] Error updating review status:', err);
    }
  },

  async deleteReview(id: string, reason?: string): Promise<void> {
    await supabaseDb.deleteDoc('product_reviews', id);
  },

  async getPendingReviews(): Promise<ProductReview[]> {
    const all = await this.getReviewsForAdmin();
    return all.filter((r) => r.isApproved === false);
  },

  async getApprovedReviews(productId: string): Promise<ProductReview[]> {
    return this.getProductReviews(productId);
  },

  async getUserReview(productId: string, userId: string): Promise<ProductReview | null> {
    try {
      const allReviews = await supabaseDb.getCollection<ProductReview>('product_reviews');
      return allReviews.find((r) => 
        ((r as any).productId === productId || (r as any).product_id === productId) && 
        ((r as any).userId === userId || (r as any).customerUid === userId || (r as any).user_id === userId)
      ) || null;
    } catch {
      return null;
    }
  },

  async submitReview(productId: string | any, userId?: string, reviewData?: any): Promise<string> {
    if (typeof productId === 'object' && productId !== null) {
      return this.addReview(productId);
    }
    const merged = {
      productId,
      userId,
      ...reviewData
    };
    return this.addReview(merged);
  }
};
