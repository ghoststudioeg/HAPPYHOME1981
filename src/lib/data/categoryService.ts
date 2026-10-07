import { supabaseDb, supabaseAdmin } from './supabaseDb';
import { Category } from '../../types';
import { auditService } from './auditService';

const COLLECTION_NAME = 'categories';
let categoriesCache: { data: Category[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export const categoryService = {
  clearCache() {
    categoriesCache = null;
  },

  async getCategories(includeHidden?: boolean): Promise<Category[]> {
    const now = Date.now();
    const showHidden = !!includeHidden;
    if (!showHidden && categoriesCache && now - categoriesCache.timestamp < CACHE_TTL) {
      return [...categoriesCache.data];
    }

    try {
      let query = supabaseAdmin.from('categories').select('*');
      if (!showHidden) {
        query = query.eq('is_visible', true);
      }
      const { data, error } = await query;

      let rawData: any[] = [];

      if (!error && Array.isArray(data)) {
        rawData = data;
      } else {
        rawData = await supabaseDb.getCollection<any>(COLLECTION_NAME);
      }

      // 2. Always map raw data to the Category interface
      let list: Category[] = rawData.map((d: any) => ({
        id: String(d.id),
        name: d.name || '',
        slug: d.slug || '',
        description: d.description || '',
        image: d.image_url || d.image || '',
        visibility: d.is_visible ?? d.visibility ?? true,
        sortOrder: d.sort_order ?? d.sortOrder ?? 0,
        parentId: d.parent_id || d.parentId || null
      }));

      list = list.filter((c) => includeHidden || c.visibility);
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'ar'));

      if (!includeHidden) {
        categoriesCache = { data: [...list], timestamp: now };
      }

      return list;
    } catch (err) {
      console.error('Error fetching categories from Supabase:', err);
      return categoriesCache?.data || [];
    }
  },

  async getCategoryById(id: string): Promise<Category | null> {
    const categories = await this.getCategories(true);
    return categories.find((c) => c.id === id || c.slug === id) || null;
  },

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const categories = await this.getCategories(true);
    return categories.find((c) => c.slug === slug || c.id === slug) || null;
  },

  async getCategoryByIdOrSlug(idOrSlug: string): Promise<Category | null> {
    return this.getCategoryBySlug(idOrSlug);
  },

  async getAdjacentCategories(categoryId: string): Promise<{ previous: Category | null; next: Category | null }> {
    const categories = await this.getCategories();
    const index = categories.findIndex((c) => c.id === categoryId);
    if (index === -1) return { previous: null, next: null };
    return {
      previous: index > 0 ? categories[index - 1] : null,
      next: index < categories.length - 1 ? categories[index + 1] : null
    };
  },

  async createCategory(categoryData: Omit<Category, 'id'>): Promise<string> {
    this.clearCache();
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newCategory: Category = {
      ...categoryData,
      id,
      visibility: categoryData.visibility ?? true
    };

    await supabaseDb.setDoc(COLLECTION_NAME, id, newCategory);

    try {
      await supabaseAdmin.from('categories').upsert([{
        id,
        name: newCategory.name,
        slug: newCategory.slug,
        description: newCategory.description,
        image_url: newCategory.image,
        is_visible: newCategory.visibility,
        sort_order: newCategory.sortOrder
      }]);
    } catch {}

    await auditService.logAction('CREATE', 'category', id, { name: newCategory.name });
    return id;
  },

  async updateCategory(id: string, categoryData: Partial<Category>): Promise<void> {
    this.clearCache();
    await supabaseDb.updateDoc(COLLECTION_NAME, id, categoryData);

    try {
      const dbPayload: any = { updated_at: new Date().toISOString() };
      if (categoryData.name !== undefined) dbPayload.name = categoryData.name;
      if (categoryData.slug !== undefined) dbPayload.slug = categoryData.slug;
      if (categoryData.description !== undefined) dbPayload.description = categoryData.description;
      if (categoryData.image !== undefined) dbPayload.image_url = categoryData.image;
      if (categoryData.visibility !== undefined) dbPayload.is_visible = categoryData.visibility;
      if (categoryData.sortOrder !== undefined) dbPayload.sort_order = categoryData.sortOrder;

      await supabaseAdmin.from('categories').update(dbPayload).eq('id', id);
    } catch {}

    await auditService.logAction('UPDATE', 'category', id, categoryData);
  },

  async deleteCategory(id: string): Promise<void> {
    this.clearCache();
    await supabaseDb.deleteDoc(COLLECTION_NAME, id);
    try {
      await supabaseAdmin.from('categories').delete().eq('id', id);
    } catch {}
    await auditService.logAction('DELETE', 'category', id, { reason: 'Deleted by admin' });
  }
};
