import {
  Category,
  Product,
  ProductFilterOptions,
  StoreSettings,
  HomepageSettings,
  LimitedOffer,
  ComingSoonItem,
  HeroBanner,
  NewsTickerItem,
  Promotion
} from '../../types';
import { productService } from './productService';
import { categoryService } from './categoryService';
import { settingsService } from './settingsService';
import { DEFAULT_STORE_SETTINGS } from './seedData';
import { homepageService, DEFAULT_HOMEPAGE_SETTINGS } from './homepageService';
import { promotionService } from './promotionService';

export interface HomeCatalogData {
  settings: StoreSettings;
  homepageSettings: HomepageSettings;
  categories: Category[];
  newArrivals: Product[];
  limitedOffers: LimitedOffer[];
  comingSoonItems: ComingSoonItem[];
  heroBanners: HeroBanner[];
  newsTickerItems: NewsTickerItem[];
  allProducts: Product[];
  featuredProducts: Product[];
  activePromotions: Promotion[];
  flashSalePromotions: Promotion[];
  categoryShowcases: {
    category: Category;
    products: Product[];
  }[];
}

export const catalogService = {
  async getHomeData(): Promise<HomeCatalogData> {
    console.log('[BOOT 7] Product service requested (getHomeData)');
    try {
      const [
        settings,
        homepageSettings,
        categories,
        newArrivals,
        featuredProducts,
        limitedOffers,
        comingSoonItems,
        heroBanners,
        newsTickerItems,
        activePromotions
      ] = await Promise.all([
        settingsService.getSettings().catch(e => { console.error('settings failed', e); return DEFAULT_STORE_SETTINGS; }),
        homepageService.getSettings().catch(e => { console.error('hp settings failed', e); return DEFAULT_HOMEPAGE_SETTINGS; }),
        categoryService.getCategories().catch(e => { console.error('categories failed', e); return []; }),
        productService.getNewArrivals(8).catch(e => { console.error('new arrivals failed', e); return []; }),
        productService.getFeaturedProducts(12).catch(e => { console.error('featured failed', e); return []; }),
        homepageService.getActiveOffers().catch(e => { console.error('offers failed', e); return []; }),
        homepageService.getActiveComingSoon().catch(e => { console.error('coming soon failed', e); return []; }),
        homepageService.getHomeBanners().catch(e => { console.error('banners failed', e); return []; }),
        homepageService.getActiveNews().catch(e => { console.error('news failed', e); return []; }),
        promotionService.getActivePromotions().catch(e => { console.error('promos failed', e); return []; })
      ]);

      console.log('[BOOT 8] Product service returned. Arrivals:', newArrivals.length);

    const showcaseTargetNames = ['شنط مدرسية', 'شنط سفر', 'إلكترونيات', 'أجهزة منزلية', 'أجهزة كهربائية'];
    const categoryShowcases: { category: Category; products: Product[] }[] = [];

    // For home data, we only need a few products per category showcase
    const showcasePromises = showcaseTargetNames.map(async (target) => {
      const cat = categories.find(c => c.name.includes(target) || (c.parentId === target));
      if (cat) {
        const prods = await productService.getProductsByCategory(cat.id, 6);
        if (prods.length > 0) {
          return { category: cat, products: prods };
        }
      }
      return null;
    });

    const showcasesResults = await Promise.all(showcasePromises);
    showcasesResults.forEach(res => {
      if (res) categoryShowcases.push(res);
    });

    const flashSalePromotions = (activePromotions || []).filter((p) => p.isFlashSale === true);

      return {
        settings,
        homepageSettings,
        categories: categories.filter(c => c.visibility),
        newArrivals,
        limitedOffers,
        comingSoonItems,
        heroBanners,
        newsTickerItems,
        allProducts: newArrivals, // Compatibility for now
        featuredProducts,
        activePromotions: activePromotions || [],
        flashSalePromotions,
        categoryShowcases
      };
    } catch (err) {
      console.error('[DIAGNOSTIC] getHomeData FATAL ERROR:', err);
      throw err;
    }
  },

  async filterProducts(options: ProductFilterOptions = {}): Promise<Product[]> {
    let list = await productService.getAllProducts(false);

    if (options.categoryId && options.categoryId !== 'all') {
      list = list.filter(p => p.categoryId === options.categoryId);
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    if (options.isAvailable !== undefined) {
      list = list.filter(p => p.isAvailable === options.isAvailable);
    }

    if (options.isFeatured !== undefined) {
      list = list.filter(p => p.isFeatured === options.isFeatured);
    }

    if (options.minPrice !== undefined) {
      list = list.filter(p => p.price >= options.minPrice!);
    }

    if (options.maxPrice !== undefined) {
      list = list.filter(p => p.price <= options.maxPrice!);
    }

    // Sorting
    switch (options.sortBy) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'featured':
        list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
      case 'newest':
      default:
        list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        break;
    }

    return list;
  },

  normalizeEgyptPhone(phone: string): string {
    if (!phone) return '201555577122';
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('01')) {
      return `20${digits.substring(1)}`;
    }
    if (digits.startsWith('20')) {
      return digits;
    }
    return digits || '201555577122';
  },

  getWhatsAppUrl(phone: string, message?: string): string {
    const clean = this.normalizeEgyptPhone(phone);
    if (!message) {
      return `https://wa.me/${clean}`;
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  },

  getWhatsAppInquiryUrl(whatsappNumber: string, productName: string): string {
    const message = `مرحبًا، أريد الاستفسار عن منتج: ${productName}`;
    return this.getWhatsAppUrl(whatsappNumber, message);
  }
};
