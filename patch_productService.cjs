const fs = require('fs');
let code = fs.readFileSync('src/lib/data/productService.ts', 'utf-8');

const newGetAllProducts = `
  async getAllProducts(includeUnpublished = false): Promise<Product[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    // Check if we are in admin area
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    // Serve from local memory cache if available and not expired
    if (!includeUnpublished && productsCache && (Date.now() - productsCache.timestamp < CACHE_TTL)) {
      return [...productsCache.data];
    }
    
    try {
      // Optimally fetch from the server-side cache for public visitors to save Firestore reads
      if (!isAdmin && !includeUnpublished) {
        try {
          const res = await fetch('/api/cache/products');
          if (res.ok) {
            const rawData = await res.json();
            const products = rawData.map((d: any) => normalizeProductDoc(d, d.id));
            products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            productsCache = { data: [...products], timestamp: Date.now() };
            return products;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch from server cache, falling back to Firestore:', fetchErr);
        }
      }

      // Fallback or Admin - direct Firestore query
      const colRef = collection(db, COLLECTION_NAME);
      const constraints: any[] = [];
      if (!includeUnpublished) {
        constraints.push(where('isPublished', '==', true));
      }
      
      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);

      const products = snapshot.docs.map(docSnap => normalizeProductDoc(docSnap.data(), docSnap.id));

      products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      if (!includeUnpublished) {
        productsCache = { data: [...products], timestamp: Date.now() };
      }

      return products;
    } catch (error: any) {
      console.error('Error fetching products:', error);
      throw new Error(error?.message || 'تعذر جلب المنتجات من قاعدة البيانات.');
    }
  },
`;

code = code.replace(
  /async getAllProducts\([^\{]*\{[\s\S]*?(?=async getProductById)/,
  newGetAllProducts.trim() + '\n\n  '
);

fs.writeFileSync('src/lib/data/productService.ts', code);
console.log('productService patched');
