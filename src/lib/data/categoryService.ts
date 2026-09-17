import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { storageService } from './storageService';
import { sanitizeForFirestore } from '../firestoreUtils';
import { Category } from '../../types';
import { auditService } from './auditService';

const COLLECTION_NAME = 'categories';

// In-memory cache for public categories to avoid redundant Firestore reads
let categoriesCache: { data: Category[], timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const pendingRequests = new Map<string, Promise<Category[]>>();

export const categoryService = {
  clearCache() {
    categoriesCache = null;
    pendingRequests.clear();
    if (typeof window !== 'undefined') {
      fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'categories'}) }).catch(()=>{});
    }
  },

  async getCategories(includeHidden = false): Promise<Category[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (!includeHidden && categoriesCache && (Date.now() - categoriesCache.timestamp < CACHE_TTL)) {
      return [...categoriesCache.data];
    }

    const reqKey = includeHidden ? 'all_cats_admin' : 'all_cats_public';
    if (pendingRequests.has(reqKey)) {
      return pendingRequests.get(reqKey)!;
    }
    
    const fetchPromise = (async () => {
      try {
        if (!isAdmin && !includeHidden) {
          try {
            const res = await fetch('/api/cache/categories');
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
              const list = await res.json();
              if (Array.isArray(list)) {
                list.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'ar'));
                categoriesCache = { data: [...list], timestamp: Date.now() };
                return list;
              }
            }
          } catch (fetchErr) {
            console.warn('Failed to fetch categories from server cache:', fetchErr);
          }
        }

        const colRef = collection(db, COLLECTION_NAME);
        const constraints: any[] = [];
        if (!includeHidden) {
          constraints.push(where('visibility', '==', true));
        }
        
        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);
        
        const list = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as Category));
        
        list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'ar'));
        
        if (!includeHidden) {
          categoriesCache = { data: [...list], timestamp: Date.now() };
        }
        return list;
      } catch (error: any) {
        console.error('Error fetching categories:', error);
        if (categoriesCache?.data) return [...categoriesCache.data];
        throw new Error(error?.message || 'تعذر جلب الأقسام من قاعدة البيانات.');
      } finally {
        pendingRequests.delete(reqKey);
      }
    })();

    pendingRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  async getCategoryById(id: string): Promise<Category | null> {
    if (!db || !id) return null;
    const trimmedId = id.trim();
    try {
      const docRef = doc(db, COLLECTION_NAME, trimmedId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Category;
      }
      const all = await this.getCategories(false);
      return all.find(c => c.id === trimmedId) || null;
    } catch (error) {
      console.error('Error in getCategoryById:', error);
      return null;
    }
  },

  async getCategoryByIdOrSlug(identifier: string): Promise<Category | null> {
    if (!identifier) return null;
    const raw = identifier.trim();
    try {
      const categories = await this.getCategories(false);
      return categories.find(c => c.id === raw || c.slug === raw) || null;
    } catch (error) {
      console.error('Error in getCategoryByIdOrSlug:', error);
      return null;
    }
  },

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.getCategoryByIdOrSlug(slug);
  },

  async getAdjacentCategories(currentCategoryIdOrSlug: string): Promise<{ previous: Category | null; next: Category | null }> {
    try {
      const categories = await this.getCategories(false);
      const idx = categories.findIndex(c => c.id === currentCategoryIdOrSlug || c.slug === currentCategoryIdOrSlug);
      if (idx === -1) return { previous: null, next: null };
      return {
        previous: idx > 0 ? categories[idx - 1] : null,
        next: idx < categories.length - 1 ? categories[idx + 1] : null
      };
    } catch {
      return { previous: null, next: null };
    }
  },

  async createCategory(categoryData: Omit<Category, 'id'>): Promise<string> {
    const colRef = collection(db, COLLECTION_NAME);
    const newDocRef = doc(colRef);
    const sanitizedPayload = sanitizeForFirestore({
      ...categoryData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await setDoc(newDocRef, sanitizedPayload);
    this.clearCache();
    return newDocRef.id;
  },

  async updateCategory(id: string, categoryData: Partial<Category>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const sanitizedPayload = sanitizeForFirestore({
      ...categoryData,
      updatedAt: serverTimestamp()
    });
    await updateDoc(docRef, sanitizedPayload);
    this.clearCache();
  },

  async deleteCategory(id: string, force = false): Promise<void> {
    if (!force) {
      const productsCol = collection(db, 'products');
      const q = query(productsCol, where('categoryId', '==', id));
      const pSnap = await getDocs(q);
      if (!pSnap.empty) {
        throw new Error(`القسم يحتوي على (${pSnap.size}) منتج. يرجى نقلهم أولاً.`);
      }
    }
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    this.clearCache();
  }
};
