const fs = require('fs');

// 1. Fix server.ts 'Query' type
let serverTs = fs.readFileSync('server.ts', 'utf-8');
serverTs = serverTs.replace(/let queryRef = collection\(clientDb, collectionName\);/g, 'let queryRef: any = collection(clientDb, collectionName);');
serverTs = serverTs.replace(/let q = collection\(clientDb, collectionName\);/g, 'let q: any = collection(clientDb, collectionName);');
fs.writeFileSync('server.ts', serverTs);

// 2. Fix homepageService.ts Banner -> HeroBanner
let homepageService = fs.readFileSync('src/lib/data/homepageService.ts', 'utf-8');
homepageService = homepageService.replace(/Banner\[\]/g, 'HeroBanner[]');
homepageService = homepageService.replace(/as Banner/g, 'as HeroBanner');
homepageService = homepageService.replace(/import { (.*) } from '\.\.\/\.\.\/types';/g, (match, p1) => {
  if (!p1.includes('HeroBanner')) {
    return `import { ${p1}, HeroBanner } from '../../types';`;
  }
  return match;
});
fs.writeFileSync('src/lib/data/homepageService.ts', homepageService);

// 3. Restore missing methods in productService.ts
let productService = fs.readFileSync('src/lib/data/productService.ts', 'utf-8');
const missingMethods = `
  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (!ids || ids.length === 0) return [];
    const all = await this.getAllProducts();
    return all.filter(p => ids.includes(p.id));
  },

  async getNewArrivals(limitNum: number = 10): Promise<Product[]> {
    const all = await this.getAllProducts();
    return all.filter(p => p.isAvailable && p.stockStatus !== 'out_of_stock' && p.stockStatus !== 'coming_soon').slice(0, limitNum);
  },

  async getFeaturedProducts(limitNum: number = 10): Promise<Product[]> {
    const all = await this.getAllProducts();
    return all.filter(p => p.isFeatured).slice(0, limitNum);
  },

  async getProductsByCategory(categoryId: string, limitNum?: number): Promise<Product[]> {
    const all = await this.getAllProducts();
    const filtered = all.filter(p => p.categoryId === categoryId || (p.categoryIds && p.categoryIds.includes(categoryId)));
    return limitNum ? filtered.slice(0, limitNum) : filtered;
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    const all = await this.getAllProducts(true);
    return all.find(p => p.slug === slug || p.id === slug) || null;
  },
`;

productService = productService.replace(
  /async getProductById\(/,
  missingMethods.trim() + '\n\n  async getProductById('
);
fs.writeFileSync('src/lib/data/productService.ts', productService);

console.log('Fixed TS errors.');
