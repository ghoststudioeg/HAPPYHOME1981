const fs = require('fs');
let code = fs.readFileSync('src/lib/data/homepageService.ts', 'utf-8');

const newGetAllBanners = `
  async getAllBanners(): Promise<Banner[]> {
    if (!db) return [];
    
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    
    if (bannersCache && (Date.now() - bannersCache.timestamp < CACHE_TTL)) {
      return [...bannersCache.data];
    }
    
    try {
      if (!isAdmin) {
        try {
          const res = await fetch('/api/cache/banners');
          if (res.ok) {
            const list = await res.json();
            list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            bannersCache = { data: [...list], timestamp: Date.now() };
            return list;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch banners from server cache:', fetchErr);
        }
      }

      const colRef = collection(db, BANNERS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const list: Banner[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data()
        } as Banner);
      });
      const sorted = list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      bannersCache = { data: sorted, timestamp: Date.now() };
      return sorted;
    } catch (error) {
      console.error('Error fetching banners:', error);
      return [];
    }
  },
`;

code = code.replace(
  /async getAllBanners\([^\{]*\{[\s\S]*?(?=async getActiveBanners)/,
  newGetAllBanners.trim() + '\n\n  '
);

const newGetAllOffers = `
  async getAllOffers(): Promise<LimitedOffer[]> {
    if (!db) return [];
    
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (offersCache && (Date.now() - offersCache.timestamp < CACHE_TTL)) {
      return [...offersCache.data];
    }
    
    try {
      if (!isAdmin) {
        try {
          const res = await fetch('/api/cache/offers');
          if (res.ok) {
            const list = await res.json();
            offersCache = { data: [...list], timestamp: Date.now() };
            return list;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch offers from server cache:', fetchErr);
        }
      }

      const colRef = collection(db, OFFERS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const list: LimitedOffer[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data()
        } as LimitedOffer);
      });
      
      let enrichedList = [...list];
      if (isAdmin) {
        // Enforce product images directly in admin cache to prevent discrepancies
        try {
          // Dynamic import to avoid circular dependency if possible, but here we just use the loaded productService
          const { productService } = await import('./productService');
          const publishedProducts = await productService.getAllProducts(false);
          const productsMap = new Map();
          publishedProducts.forEach(p => productsMap.set(p.id, p));
          enrichedList = list.map(offer => {
            const prod = productsMap.get(offer.productId);
            if (prod) {
              offer.productImage = prod.mainImageUrl || offer.productImage;
              offer.productName = prod.name || offer.productName;
            }
            return offer;
          });
        } catch (e) {
          console.warn('Could not enrich limited offers', e);
        }
      }
      
      offersCache = { data: enrichedList, timestamp: Date.now() };
      return enrichedList;
    } catch (error) {
      console.error('Error fetching limited offers:', error);
      return [];
    }
  },
`;

code = code.replace(
  /async getAllOffers\([^\{]*\{[\s\S]*?(?=async getActiveOffers)/,
  newGetAllOffers.trim() + '\n\n  '
);

const newGetAllComingSoon = `
  async getAllComingSoon(): Promise<ComingSoonItem[]> {
    if (!db) return [];
    
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (comingSoonCache && (Date.now() - comingSoonCache.timestamp < CACHE_TTL)) {
      return [...comingSoonCache.data];
    }
    
    try {
      if (!isAdmin) {
        try {
          const res = await fetch('/api/cache/comingSoon');
          if (res.ok) {
            const list = await res.json();
            list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            comingSoonCache = { data: [...list], timestamp: Date.now() };
            return list;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch comingSoon from server cache:', fetchErr);
        }
      }

      const colRef = collection(db, COMING_SOON_COLLECTION);
      const snapshot = await getDocs(colRef);
      const list: ComingSoonItem[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data()
        } as ComingSoonItem);
      });
      const sorted = list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      comingSoonCache = { data: sorted, timestamp: Date.now() };
      return sorted;
    } catch (error) {
      console.error('Error fetching coming soon items:', error);
      return [];
    }
  },
`;

code = code.replace(
  /async getAllComingSoon\([^\{]*\{[\s\S]*?(?=async getActiveComingSoon)/,
  newGetAllComingSoon.trim() + '\n\n  '
);

code = code.replace(/bannersCache = null;/g, `bannersCache = null;
      if (typeof window !== 'undefined') {
        fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'banners'}) }).catch(()=>{});
      }`);

code = code.replace(/offersCache = null;/g, `offersCache = null;
      if (typeof window !== 'undefined') {
        fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'offers'}) }).catch(()=>{});
      }`);

code = code.replace(/comingSoonCache = null;/g, `comingSoonCache = null;
      if (typeof window !== 'undefined') {
        fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'comingSoon'}) }).catch(()=>{});
      }`);

fs.writeFileSync('src/lib/data/homepageService.ts', code);
console.log('homepageService patched');
