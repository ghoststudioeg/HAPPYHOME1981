import {
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  writeBatch
} from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../firebase';
import { Product, RecentlyViewedItem } from '../../types';

const STORAGE_KEY = 'beit_elsaeed_recently_viewed_v1';
const MAX_RECENT_ITEMS = 20;

export const recentlyViewedService = {
  /**
   * Safe local storage reader
   */
  getLocalItems(): RecentlyViewedItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && item.productId && item.productName);
      }
      return [];
    } catch (e) {
      console.warn('Failed to parse recently viewed products from localStorage:', e);
      return [];
    }
  },

  /**
   * Safe local storage writer
   */
  setLocalItems(items: RecentlyViewedItem[]): void {
    try {
      const trimmed = items.slice(0, MAX_RECENT_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('recently_viewed_changed'));
      }
    } catch (e) {
      console.warn('Failed to save recently viewed products to localStorage:', e);
    }
  },

  /**
   * Record a product page view (Only on actual product page view)
   */
  async recordProductView(product: Product, userUid?: string): Promise<void> {
    if (!product || !product.id) return;

    const now = new Date().toISOString();
    const item: RecentlyViewedItem = {
      id: product.id,
      productId: product.id,
      productName: product.name || 'منتج',
      productImage: product.mainImageUrl || '',
      price: Number(product.price) || 0,
      oldPrice: product.oldPrice ? Number(product.oldPrice) : undefined,
      categoryName: product.categoryName || '',
      slug: product.slug || product.id,
      viewedAt: now
    };

    // 1. Update guest / local storage history
    const existing = this.getLocalItems();
    const filtered = existing.filter(i => i.productId !== product.id);
    const updatedList = [item, ...filtered].slice(0, MAX_RECENT_ITEMS);
    this.setLocalItems(updatedList);

    // 2. If authenticated customer, persist to Firestore
    if (userUid && db) {
      try {
        const itemRef = doc(db, 'users', userUid, 'recentlyViewed', product.id);
        const sanitized = sanitizeForFirestore(item);
        await setDoc(itemRef, sanitized, { merge: true });
      } catch (err) {
        console.warn('Could not persist recently viewed product to Firestore:', err);
      }
    }
  },

  /**
   * Get recently viewed items for current user or guest
   */
  async getRecentlyViewed(userUid?: string, excludeProductId?: string, maxCount: number = 20): Promise<RecentlyViewedItem[]> {
    let items: RecentlyViewedItem[] = [];

    if (userUid && db) {
      try {
        const ref = collection(db, 'users', userUid, 'recentlyViewed');
        const snap = await getDocs(ref);
        const remoteItems: RecentlyViewedItem[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data && (data.productId || d.id)) {
            remoteItems.push({
              id: d.id,
              productId: data.productId || d.id,
              productName: data.productName || '',
              productImage: data.productImage || '',
              price: Number(data.price) || 0,
              oldPrice: data.oldPrice ? Number(data.oldPrice) : undefined,
              categoryName: data.categoryName || '',
              slug: data.slug || d.id,
              viewedAt: data.viewedAt || ''
            });
          }
        });

        if (remoteItems.length > 0) {
          // Sort newest first
          remoteItems.sort((a, b) => (b.viewedAt || '').localeCompare(a.viewedAt || ''));
          items = remoteItems.slice(0, MAX_RECENT_ITEMS);
          // Sync to localStorage
          this.setLocalItems(items);
        } else {
          // Fallback to local
          items = this.getLocalItems();
        }
      } catch (e) {
        console.warn('Error fetching recently viewed from Firestore, using local fallback:', e);
        items = this.getLocalItems();
      }
    } else {
      items = this.getLocalItems();
    }

    if (excludeProductId) {
      items = items.filter(i => i.productId !== excludeProductId);
    }

    return items.slice(0, maxCount);
  },

  /**
   * Remove single product from recently viewed history
   */
  async removeRecentlyViewed(productId: string, userUid?: string): Promise<void> {
    if (!productId) return;

    // 1. Remove from local storage
    const current = this.getLocalItems();
    const updated = current.filter(i => i.productId !== productId);
    this.setLocalItems(updated);

    // 2. If authenticated, remove from Firestore
    if (userUid && db) {
      try {
        const itemRef = doc(db, 'users', userUid, 'recentlyViewed', productId);
        await deleteDoc(itemRef);
      } catch (e) {
        console.warn('Failed to remove recently viewed doc from Firestore:', e);
      }
    }
  },

  /**
   * Clear all recently viewed products
   */
  async clearRecentlyViewed(userUid?: string): Promise<void> {
    // 1. Clear local storage
    try {
      localStorage.removeItem(STORAGE_KEY);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('recently_viewed_changed'));
      }
    } catch (e) {
      console.warn('Failed to clear local recently viewed:', e);
    }

    // 2. If authenticated, delete all docs from Firestore
    if (userUid && db) {
      try {
        const ref = collection(db, 'users', userUid, 'recentlyViewed');
        const snap = await getDocs(ref);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach(d => {
            batch.delete(d.ref);
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn('Failed to clear recently viewed subcollection in Firestore:', e);
      }
    }
  },

  /**
   * Merge guest history into user Firestore account on login
   */
  async mergeGuestHistoryOnLogin(userUid: string): Promise<void> {
    if (!userUid || !db) return;

    try {
      const localItems = this.getLocalItems();
      const ref = collection(db, 'users', userUid, 'recentlyViewed');
      const snap = await getDocs(ref);

      const firestoreItems: RecentlyViewedItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data && (data.productId || d.id)) {
          firestoreItems.push({
            id: d.id,
            productId: data.productId || d.id,
            productName: data.productName || '',
            productImage: data.productImage || '',
            price: Number(data.price) || 0,
            oldPrice: data.oldPrice ? Number(data.oldPrice) : undefined,
            categoryName: data.categoryName || '',
            slug: data.slug || d.id,
            viewedAt: data.viewedAt || ''
          });
        }
      });

      // Merge map by productId, keeping latest viewedAt
      const mergedMap = new Map<string, RecentlyViewedItem>();

      for (const item of firestoreItems) {
        mergedMap.set(item.productId, item);
      }

      for (const localItem of localItems) {
        const existing = mergedMap.get(localItem.productId);
        if (!existing || (localItem.viewedAt || '') > (existing.viewedAt || '')) {
          mergedMap.set(localItem.productId, localItem);
        }
      }

      // Convert to sorted array
      const mergedList = Array.from(mergedMap.values())
        .sort((a, b) => (b.viewedAt || '').localeCompare(a.viewedAt || ''))
        .slice(0, MAX_RECENT_ITEMS);

      // Write merged list to Firestore
      const batch = writeBatch(db);
      for (const item of mergedList) {
        const docRef = doc(db, 'users', userUid, 'recentlyViewed', item.productId);
        const sanitized = sanitizeForFirestore(item);
        batch.set(docRef, sanitized, { merge: true });
      }
      await batch.commit();

      // Update local storage to match merged list
      this.setLocalItems(mergedList);
    } catch (err) {
      console.warn('Failed to merge recently viewed history on login:', err);
    }
  }
};
