import { supabaseDb } from './supabaseDb';
import { RecentlyViewedItem } from '../../types';

export const recentlyViewedService = {
  async getRecentlyViewed(userUid?: string | null, excludeProductId?: string, limitNum?: number): Promise<RecentlyViewedItem[]> {
    const uid = userUid || 'guest';
    let list: RecentlyViewedItem[] = [];

    if (uid === 'guest') {
      const local = localStorage.getItem('guest_recently_viewed');
      if (local) {
        try {
          list = JSON.parse(local);
        } catch {
          list = [];
        }
      }
    } else {
      try {
        const all = await supabaseDb.getCollection<RecentlyViewedItem>('recently_viewed');
        list = all.filter((i) => i.userUid === uid || (i as any).user_uid === uid);
      } catch {
        list = [];
      }
    }

    list.sort((a, b) => new Date(b.viewedAt || 0).getTime() - new Date(a.viewedAt || 0).getTime());

    if (excludeProductId) {
      list = list.filter((i) => i.productId !== excludeProductId);
    }
    if (limitNum) {
      list = list.slice(0, limitNum);
    }
    return list;
  },

  async recordView(arg1: any, arg2?: any): Promise<void> {
    const userUid = typeof arg1 === 'string' ? arg1 : (arg2 || 'guest');
    const product = typeof arg1 === 'string' ? arg2 : arg1;
    if (!product || !product.id) return;

    const uid = userUid || 'guest';
    const item: RecentlyViewedItem = {
      id: `rv_${uid}_${product.id}`,
      userUid: uid,
      user_uid: uid,
      productId: product.id,
      productName: product.name,
      productImage: product.mainImageUrl || '',
      price: product.price,
      slug: product.slug || '',
      viewedAt: new Date().toISOString()
    };

    if (uid === 'guest') {
      const list = await this.getRecentlyViewed('guest');
      const filtered = list.filter(i => i.productId !== product.id);
      filtered.unshift(item);
      localStorage.setItem('guest_recently_viewed', JSON.stringify(filtered.slice(0, 30)));
    } else {
      await supabaseDb.setDoc('recently_viewed', item.id, item);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('recently_viewed_changed'));
    }
  },

  async recordProductView(arg1: any, arg2?: any): Promise<void> {
    return this.recordView(arg1, arg2);
  },

  async removeRecentlyViewed(productId: string, userUid?: string | null): Promise<void> {
    const uid = userUid || 'guest';
    if (uid === 'guest') {
      const list = await this.getRecentlyViewed('guest');
      const filtered = list.filter((i) => i.productId !== productId);
      localStorage.setItem('guest_recently_viewed', JSON.stringify(filtered));
    } else {
      const id = `rv_${uid}_${productId}`;
      await supabaseDb.deleteDoc('recently_viewed', id);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('recently_viewed_changed'));
    }
  },

  async clearRecentlyViewed(userUid?: string | null): Promise<void> {
    const uid = userUid || 'guest';
    if (uid === 'guest') {
      localStorage.removeItem('guest_recently_viewed');
    } else {
      const all = await supabaseDb.getCollection<RecentlyViewedItem>('recently_viewed');
      const userItems = all.filter((i) => i.userUid === uid || (i as any).user_uid === uid);
      for (const item of userItems) {
        await supabaseDb.deleteDoc('recently_viewed', item.id);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('recently_viewed_changed'));
    }
  },

  async mergeGuestHistoryOnLogin(userUid: string): Promise<void> {
    if (!userUid || userUid === 'guest') return;
    const local = localStorage.getItem('guest_recently_viewed');
    if (!local) return;

    try {
      const guestItems = JSON.parse(local);
      if (Array.isArray(guestItems) && guestItems.length > 0) {
        const existing = await this.getRecentlyViewed(userUid);
        const existingProductIds = new Set(existing.map(i => i.productId));

        for (const gItem of guestItems) {
          if (!existingProductIds.has(gItem.productId)) {
            const newItem: RecentlyViewedItem = {
              ...gItem,
              id: `rv_${userUid}_${gItem.productId}`,
              userUid,
              viewedAt: gItem.viewedAt || new Date().toISOString()
            };
            await supabaseDb.setDoc('recently_viewed', newItem.id, newItem);
          }
        }
        localStorage.removeItem('guest_recently_viewed');
      }
    } catch (e) {
      console.error('Failed to merge guest recently viewed:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('recently_viewed_changed'));
    }
  }
};
