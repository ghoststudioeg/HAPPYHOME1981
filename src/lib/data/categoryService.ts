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

export const categoryService = {
  async getCategories(includeHidden = false): Promise<Category[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    // Serve from cache if available and not expired (public only)
    if (!includeHidden && categoriesCache && (Date.now() - categoriesCache.timestamp < CACHE_TTL)) {
      return [...categoriesCache.data];
    }

    try {
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
      
      // Sort locally according to admin order to avoid needing composite indexes in Firestore
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'ar'));
      
      // Update cache for public requests
      if (!includeHidden) {
        categoriesCache = { data: [...list], timestamp: Date.now() };
      }

      return list;
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      throw new Error(error?.message || 'تعذر جلب الأقسام من قاعدة البيانات.');
    }
  },

  async getCategoryById(id: string): Promise<Category | null> {
    if (!db || !id) return null;
    const trimmedId = id.trim();
    if (!trimmedId) return null;

    try {
      // 1. Direct document lookup by Firestore ID
      const docRef = doc(db, COLLECTION_NAME, trimmedId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return {
          id: snap.id,
          ...snap.data()
        } as Category;
      }

      // 2. If not found by direct ID, check decoded ID
      let decodedId = trimmedId;
      try {
        decodedId = decodeURIComponent(trimmedId);
      } catch {}

      if (decodedId !== trimmedId) {
        const decodedDocRef = doc(db, COLLECTION_NAME, decodedId);
        const decodedSnap = await getDoc(decodedDocRef);
        if (decodedSnap.exists()) {
          return {
            id: decodedSnap.id,
            ...decodedSnap.data()
          } as Category;
        }
      }

      // 3. Fallback: check all categories list
      const all = await this.getCategories(true);
      return all.find(c => c.id === trimmedId || c.id === decodedId) || null;
    } catch (error) {
      console.error('Error in getCategoryById:', error);
      return null;
    }
  },

  async getCategoryByIdOrSlug(identifier: string): Promise<Category | null> {
    if (!identifier || typeof identifier !== 'string') return null;
    const raw = identifier.trim();
    if (!raw) return null;

    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }

    // Step 1: Direct document ID lookup in Firestore first (Primary ID resolution)
    const byDirectId = await this.getCategoryById(raw);
    if (byDirectId) return byDirectId;

    if (decoded !== raw) {
      const byDecodedId = await this.getCategoryById(decoded);
      if (byDecodedId) return byDecodedId;
    }

    // Step 2: Query / scan categories for matching slug, decoded slug, or name
    try {
      const categories = await this.getCategories(true);

      // Exact ID match
      const matchId = categories.find(c => c.id === raw || c.id === decoded);
      if (matchId) return matchId;

      // Match by slug (raw, decoded, or case-insensitive)
      const matchSlug = categories.find(c => {
        if (!c.slug) return false;
        let catSlugDecoded = c.slug;
        try {
          catSlugDecoded = decodeURIComponent(c.slug);
        } catch {}

        return (
          c.slug === raw ||
          c.slug === decoded ||
          catSlugDecoded === raw ||
          catSlugDecoded === decoded ||
          c.slug.toLowerCase() === raw.toLowerCase() ||
          c.slug.toLowerCase() === decoded.toLowerCase()
        );
      });
      if (matchSlug) return matchSlug;

      // Match by Arabic/English name (if category was renamed or legacy product referenced name)
      const matchName = categories.find(c => {
        if (!c.name) return false;
        const normCatName = c.name.trim().toLowerCase();
        const normRaw = raw.toLowerCase();
        const normDecoded = decoded.toLowerCase();
        return (
          normCatName === normRaw ||
          normCatName === normDecoded ||
          normCatName.replace(/\s+/g, '-') === normRaw ||
          normCatName.replace(/\s+/g, '-') === normDecoded
        );
      });
      if (matchName) return matchName;

      return null;
    } catch (error) {
      console.error('Error resolving category by identifier:', error);
      return null;
    }
  },

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return this.getCategoryByIdOrSlug(slug);
  },

  async getAdjacentCategories(currentCategoryIdOrSlug: string): Promise<{ previous: Category | null; next: Category | null }> {
    try {
      const categories = await this.getCategories(false);
      if (!categories || categories.length === 0) {
        return { previous: null, next: null };
      }

      // Strictly sorted according to admin-configured sortOrder
      categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'ar'));

      const raw = currentCategoryIdOrSlug.trim();
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        decoded = raw;
      }

      const currentIndex = categories.findIndex(c => {
        let catSlugDecoded = c.slug;
        try {
          catSlugDecoded = decodeURIComponent(c.slug || '');
        } catch {}

        return (
          c.id === raw ||
          c.id === decoded ||
          c.slug === raw ||
          c.slug === decoded ||
          catSlugDecoded === raw ||
          catSlugDecoded === decoded ||
          (c.name && c.name.trim().toLowerCase() === decoded.toLowerCase())
        );
      });

      if (currentIndex === -1) {
        return { previous: null, next: null };
      }

      const previous = currentIndex > 0 ? categories[currentIndex - 1] : null;
      const next = currentIndex < categories.length - 1 ? categories[currentIndex + 1] : null;

      return { previous, next };
    } catch (error) {
      console.error('Error fetching adjacent categories:', error);
      return { previous: null, next: null };
    }
  },

  async createCategory(categoryData: Omit<Category, 'id'>): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const newDocRef = doc(colRef);
      
      const sanitizedPayload = sanitizeForFirestore({
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description || '',
        image: categoryData.image || '',
        parentId: categoryData.parentId || null,
        visibility: categoryData.visibility !== false,
        sortOrder: categoryData.sortOrder || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await setDoc(newDocRef, sanitizedPayload);
      categoriesCache = null;

      try {
        await auditService.recordAuditLog({
          action: 'CATEGORY_CREATED',
          entityType: 'category',
          entityId: newDocRef.id,
          entityName: categoryData.name,
          before: null,
          after: { name: categoryData.name, slug: categoryData.slug }
        });
      } catch (e) {}

      return newDocRef.id;
    } catch (error: any) {
      console.error('Error creating category:', error);
      throw new Error(error?.message || 'تعذر إنشاء القسم في قاعدة البيانات.');
    }
  },

  async updateCategory(id: string, categoryData: Partial<Category>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      let oldUrls: string[] = [];
      if (snap.exists()) {
        const cat = snap.data() as Category;
        if (cat.image) oldUrls.push(cat.image);
        if (cat.hero?.desktopImageUrl) oldUrls.push(cat.hero.desktopImageUrl);
        if (cat.hero?.mobileImageUrl) oldUrls.push(cat.hero.mobileImageUrl);
      }

      const sanitizedPayload = sanitizeForFirestore({
        ...categoryData,
        parentId: categoryData.parentId !== undefined ? (categoryData.parentId || null) : undefined,
        updatedAt: serverTimestamp()
      });

      await updateDoc(docRef, sanitizedPayload);
      categoriesCache = null;

      try {
        const catName = categoryData.name || (snap.exists() ? snap.data().name : id);
        await auditService.recordAuditLog({
          action: 'CATEGORY_EDITED',
          entityType: 'category',
          entityId: id,
          entityName: catName,
          before: snap.exists() ? { name: snap.data().name, slug: snap.data().slug } : null,
          after: { name: categoryData.name || snap.data()?.name, slug: categoryData.slug || snap.data()?.slug }
        });
      } catch (e) {}
      
      if (oldUrls.length > 0) {
        let newUrls: string[] = [];
        if (categoryData.image) newUrls.push(categoryData.image);
        if (categoryData.hero?.desktopImageUrl) newUrls.push(categoryData.hero.desktopImageUrl);
        if (categoryData.hero?.mobileImageUrl) newUrls.push(categoryData.hero.mobileImageUrl);
        
        const imageFieldsUpdated = 'image' in categoryData || 'hero' in categoryData;
        if (imageFieldsUpdated) {
          const removedUrls = oldUrls.filter(url => !newUrls.includes(url));
          if (removedUrls.length > 0) {
            await storageService.safeDeleteFiles(removedUrls);
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating category:', error);
      throw new Error(error?.message || 'تعذر تحديث القسم في قاعدة البيانات.');
    }
  },

  async deleteCategory(id: string, force = false): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      // Check linked products unless force is true
      if (!force) {
        const productsCol = collection(db, 'products');
        const q = query(productsCol, where('categoryId', '==', id));
        const pSnap = await getDocs(q);
        if (!pSnap.empty) {
          throw new Error(`لا يمكن حذف هذا القسم لأنه يحتوي على (${pSnap.size}) منتج مرتبطة به. يرجى نقل أو حذف المنتجات أولاً.`);
        }
      }

      let urlsToDelete: string[] = [];
      const docRef = doc(db, COLLECTION_NAME, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const cat = snap.data() as Category;
        if (cat.image) urlsToDelete.push(cat.image);
        if (cat.hero) {
          if (cat.hero.desktopImageUrl) urlsToDelete.push(cat.hero.desktopImageUrl);
          if (cat.hero.mobileImageUrl) urlsToDelete.push(cat.hero.mobileImageUrl);
        }
      }
      
      await deleteDoc(docRef);
      categoriesCache = null;

      try {
        const deletedCat = snap.exists() ? snap.data() : null;
        await auditService.recordAuditLog({
          action: 'CATEGORY_DELETED',
          entityType: 'category',
          entityId: id,
          entityName: deletedCat?.name || id,
          before: deletedCat ? { name: deletedCat.name, slug: deletedCat.slug } : null,
          after: null
        });
      } catch (e) {}
      
      if (urlsToDelete.length > 0) {
        await storageService.safeDeleteFiles(urlsToDelete);
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      throw new Error(error?.message || 'تعذر حذف القسم من قاعدة البيانات.');
    }
  }
};
