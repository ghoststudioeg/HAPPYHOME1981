import { supabaseDb } from './supabaseDb';
import { HomepageSettings, LimitedOffer, ComingSoonItem, HeroBanner, NewsTickerItem } from '../../types';
import { auditService } from './auditService';

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  newArrivalsEnabled: true,
  newArrivalsLimit: 8,
  limitedOffersEnabled: true,
  comingSoonEnabled: true,
  categoriesEnabled: true,
  newsTickerEnabled: true,
  newsTickerSpeed: 5,
  newsTickerDirection: 'rtl',
  newsTickerBgStyle: 'dark',
  heroBannersEnabled: true,
  heroSlideIntervalSeconds: 6
};

const BANNERS_COLLECTION = 'homepage_banners';
const TICKER_COLLECTION = 'homepage_tickers';
const OFFERS_COLLECTION = 'homepage_offers';
const COMING_SOON_COLLECTION = 'homepage_coming_soon';

let settingsCache: { data: HomepageSettings; timestamp: number } | null = null;
let bannersCache: { data: HeroBanner[]; timestamp: number } | null = null;
let newsCache: { data: NewsTickerItem[]; timestamp: number } | null = null;
let offersCache: { data: LimitedOffer[]; timestamp: number } | null = null;
let comingSoonCache: { data: ComingSoonItem[]; timestamp: number } | null = null;

const CACHE_TTL = 5 * 60 * 1000;

export const homepageService = {
  clearCache() {
    settingsCache = null;
    bannersCache = null;
    newsCache = null;
    offersCache = null;
    comingSoonCache = null;
  },

  async getSettings(): Promise<HomepageSettings> {
    const now = Date.now();
    if (settingsCache && now - settingsCache.timestamp < CACHE_TTL) {
      return { ...settingsCache.data };
    }
    try {
      const doc = await supabaseDb.getDoc<HomepageSettings>('homepage_settings', 'main');
      const settings = doc ? { ...DEFAULT_HOMEPAGE_SETTINGS, ...doc } : DEFAULT_HOMEPAGE_SETTINGS;
      settingsCache = { data: settings, timestamp: now };
      return settings;
    } catch {
      return DEFAULT_HOMEPAGE_SETTINGS;
    }
  },

  async updateSettings(updates: Partial<HomepageSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...updates };
    await supabaseDb.setDoc('homepage_settings', 'main', updated);
    this.clearCache();
    await auditService.logAction('UPDATE', 'homepage_settings', 'main', updates);
  },

  async getBanners(): Promise<HeroBanner[]> {
    const now = Date.now();
    if (bannersCache && now - bannersCache.timestamp < CACHE_TTL) {
      return [...bannersCache.data];
    }
    try {
      const list = await supabaseDb.getCollection<HeroBanner>(BANNERS_COLLECTION);
      list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      bannersCache = { data: list, timestamp: now };
      return list;
    } catch {
      return [];
    }
  },

  async getHomeBanners(): Promise<HeroBanner[]> {
    return this.getBanners();
  },

  async createBanner(banner: Omit<HeroBanner, 'id'>): Promise<string> {
    const id = `banner_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newBanner: HeroBanner = { ...banner, id };
    await supabaseDb.setDoc(BANNERS_COLLECTION, id, newBanner);
    this.clearCache();
    return id;
  },

  async updateBanner(id: string, updates: Partial<HeroBanner>): Promise<void> {
    await supabaseDb.updateDoc(BANNERS_COLLECTION, id, updates);
    this.clearCache();
  },

  async deleteBanner(id: string): Promise<void> {
    await supabaseDb.deleteDoc(BANNERS_COLLECTION, id);
    this.clearCache();
  },

  async getNewsTickerItems(): Promise<NewsTickerItem[]> {
    const now = Date.now();
    if (newsCache && now - newsCache.timestamp < CACHE_TTL) {
      return [...newsCache.data];
    }
    try {
      const list = await supabaseDb.getCollection<NewsTickerItem>(TICKER_COLLECTION);
      list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      newsCache = { data: list, timestamp: now };
      return list;
    } catch {
      return [];
    }
  },

  async createNewsTickerItem(item: Omit<NewsTickerItem, 'id'>): Promise<string> {
    const id = `ticker_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newItem: NewsTickerItem = { ...item, id };
    await supabaseDb.setDoc(TICKER_COLLECTION, id, newItem);
    this.clearCache();
    return id;
  },

  async updateNewsTickerItem(id: string, updates: Partial<NewsTickerItem>): Promise<void> {
    await supabaseDb.updateDoc(TICKER_COLLECTION, id, updates);
    this.clearCache();
  },

  async deleteNewsTickerItem(id: string): Promise<void> {
    await supabaseDb.deleteDoc(TICKER_COLLECTION, id);
    this.clearCache();
  },

  async getLimitedOffers(): Promise<LimitedOffer[]> {
    const now = Date.now();
    if (offersCache && now - offersCache.timestamp < CACHE_TTL) {
      return [...offersCache.data];
    }
    try {
      const list = await supabaseDb.getCollection<LimitedOffer>(OFFERS_COLLECTION);
      list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      offersCache = { data: list, timestamp: now };
      return list;
    } catch {
      return [];
    }
  },

  async createLimitedOffer(offer: Omit<LimitedOffer, 'id'>): Promise<string> {
    const id = `offer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newOffer: LimitedOffer = { ...offer, id };
    await supabaseDb.setDoc(OFFERS_COLLECTION, id, newOffer);
    this.clearCache();
    return id;
  },

  async updateLimitedOffer(id: string, updates: Partial<LimitedOffer>): Promise<void> {
    await supabaseDb.updateDoc(OFFERS_COLLECTION, id, updates);
    this.clearCache();
  },

  async deleteLimitedOffer(id: string): Promise<void> {
    await supabaseDb.deleteDoc(OFFERS_COLLECTION, id);
    this.clearCache();
  },

  async getComingSoonItems(): Promise<ComingSoonItem[]> {
    const now = Date.now();
    if (comingSoonCache && now - comingSoonCache.timestamp < CACHE_TTL) {
      return [...comingSoonCache.data];
    }
    try {
      const list = await supabaseDb.getCollection<ComingSoonItem>(COMING_SOON_COLLECTION);
      list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      comingSoonCache = { data: list, timestamp: now };
      return list;
    } catch {
      return [];
    }
  },

  async createComingSoonItem(item: Omit<ComingSoonItem, 'id'>): Promise<string> {
    const id = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newItem: ComingSoonItem = { ...item, id };
    await supabaseDb.setDoc(COMING_SOON_COLLECTION, id, newItem);
    this.clearCache();
    return id;
  },

  async updateComingSoonItem(id: string, updates: Partial<ComingSoonItem>): Promise<void> {
    await supabaseDb.updateDoc(COMING_SOON_COLLECTION, id, updates);
    this.clearCache();
  },

  async deleteComingSoonItem(id: string): Promise<void> {
    await supabaseDb.deleteDoc(COMING_SOON_COLLECTION, id);
    this.clearCache();
  },

  async getAllBanners(param?: any): Promise<HeroBanner[]> { return this.getBanners(); },
  async getActiveBanners(param?: any): Promise<HeroBanner[]> { return this.getBanners(); },
  async getCategoryBanners(param?: any): Promise<HeroBanner[]> { return this.getBanners(); },
  async getCatalogBanners(param?: any): Promise<HeroBanner[]> { return this.getBanners(); },
  async getAllNews(): Promise<NewsTickerItem[]> { return this.getNewsTickerItems(); },
  async createNews(item: any): Promise<string> { return this.createNewsTickerItem(item); },
  async updateNews(id: string, updates: any): Promise<void> { return this.updateNewsTickerItem(id, updates); },
  async deleteNews(id: string): Promise<void> { return this.deleteNewsTickerItem(id); },
  async getAllOffers(): Promise<LimitedOffer[]> { return this.getLimitedOffers(); },
  async createOffer(offer: any): Promise<string> { return this.createLimitedOffer(offer); },
  async updateOffer(id: string, updates: any): Promise<void> { return this.updateLimitedOffer(id, updates); },
  async deleteOffer(id: string): Promise<void> { return this.deleteLimitedOffer(id); },
  async getAllComingSoon(): Promise<ComingSoonItem[]> { return this.getComingSoonItems(); },
  async getActiveOffers(): Promise<LimitedOffer[]> { return this.getLimitedOffers(); },
  async getActiveComingSoon(): Promise<ComingSoonItem[]> { return this.getComingSoonItems(); },
  async getActiveNews(): Promise<NewsTickerItem[]> { return this.getNewsTickerItems(); }
};
