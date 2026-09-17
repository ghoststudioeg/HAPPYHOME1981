const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace getServerStoreSettings
const newGetServerStoreSettings = `
async function getServerStoreSettings(): Promise<any> {
  const now = Date.now();
  if (memoryCache.settings.data && (now - memoryCache.settings.timestamp < CACHE_TTL_SETTINGS)) {
    return memoryCache.settings.data;
  }
  try {
    const snap = await getDoc(doc(clientDb, 'storeSettings', 'main'));
    const data = snap.exists ? snap.data() : null;
    memoryCache.settings = { data, timestamp: now };
    return data;
  } catch {
    return memoryCache.settings.data || null;
  }
}
`;
code = code.replace(/async function getServerStoreSettings\(\)[\s\S]*?(?=async function getServerProducts)/, newGetServerStoreSettings.trim() + '\n\n');

// Replace getServerProducts
const newGetServerProducts = `
async function getServerProducts(): Promise<ServerProduct[]> {
  const products = await fetchWithCache('products', CACHE_TTL_PRODUCTS, 'products');
  return products.map(data => ({
    id: data.id,
    name: data.name || '',
    slug: data.slug || '',
    price: Number(data.price) || 0,
    oldPrice: data.oldPrice ? Number(data.oldPrice) : null,
    description: data.description || '',
    mainImageUrl: data.mainImageUrl || '',
    categoryId: data.categoryId || '',
    categoryName: data.categoryName || '',
    isAvailable: data.isAvailable !== false,
    stockQuantity: typeof data.stockQuantity === 'number' ? data.stockQuantity : 10,
    stockStatus: data.stockStatus || 'in_stock'
  }));
}
`;
code = code.replace(/async function getServerProducts\(\)[\s\S]*?(?=async function getServerPromotions)/, newGetServerProducts.trim() + '\n\n');

// Replace getServerPromotions
const newGetServerPromotions = `
async function getServerPromotions(): Promise<any[]> {
  const promotions = await fetchWithCache('offers', CACHE_TTL_GENERAL, 'limitedOffers');
  const nowDate = new Date();
  const list = [];
  promotions.forEach(data => {
    if (data.isActive) {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      if (nowDate >= s && nowDate <= e) {
        list.push(data);
      }
    }
  });
  return list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
`;
code = code.replace(/async function getServerPromotions\(\)[\s\S]*?(?=async function getServerCategories)/, newGetServerPromotions.trim() + '\n\n');

// Replace getServerCategories
const newGetServerCategories = `
async function getServerCategories(): Promise<any[]> {
  return await fetchWithCache('categories', CACHE_TTL_GENERAL, 'categories');
}
`;
code = code.replace(/async function getServerCategories\(\)[\s\S]*?(?=function normalizeSlugServer)/, newGetServerCategories.trim() + '\n\n');

fs.writeFileSync('server.ts', code);
console.log('SSR cache functions patched');
