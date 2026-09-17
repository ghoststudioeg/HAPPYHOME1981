const fs = require('fs');
let code = fs.readFileSync('src/lib/data/categoryService.ts', 'utf-8');

const newGetCategories = `
  async getCategories(includeHidden = false): Promise<Category[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (!includeHidden && categoriesCache && (Date.now() - categoriesCache.timestamp < CACHE_TTL)) {
      return [...categoriesCache.data];
    }
    
    try {
      if (!isAdmin && !includeHidden) {
        try {
          const res = await fetch('/api/cache/categories');
          if (res.ok) {
            const list = await res.json();
            list.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'ar'));
            categoriesCache = { data: [...list], timestamp: Date.now() };
            return list;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch categories from server cache, falling back to Firestore:', fetchErr);
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
      throw new Error(error?.message || 'تعذر جلب الأقسام من قاعدة البيانات.');
    }
  },
`;

code = code.replace(
  /async getCategories\([^\{]*\{[\s\S]*?(?=async getCategoryById)/,
  newGetCategories.trim() + '\n\n  '
);

code = code.replace(/categoriesCache = null;/g, `categoriesCache = null;
      if (typeof window !== 'undefined') {
        fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'categories'}) }).catch(()=>{});
      }`);

fs.writeFileSync('src/lib/data/categoryService.ts', code);
console.log('categoryService patched');
