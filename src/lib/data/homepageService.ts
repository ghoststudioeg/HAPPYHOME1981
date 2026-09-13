import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { storageService } from './storageService';
import { productService } from './productService';
import { HomepageSettings, LimitedOffer, ComingSoonItem, HeroBanner, NewsTickerItem } from '../../types';
import { sanitizeForFirestore } from '../firestoreUtils';
import { notificationEngine } from '../notificationEngine';
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

const SETTINGS_COLLECTION = 'homepageSettings';
const SETTINGS_DOC_ID = 'main';
const BANNERS_COLLECTION = 'homepageBanners';
const TICKER_COLLECTION = 'newsTicker';
const OFFERS_COLLECTION = 'limitedOffers';
const COMING_SOON_COLLECTION = 'comingSoon';

// In-memory cache to prevent redundant Firestore reads on the public storefront
let settingsCache: { data: HomepageSettings, timestamp: number } | null = null;
let bannersCache: { data: HeroBanner[], timestamp: number } | null = null;
let newsCache: { data: NewsTickerItem[], timestamp: number } | null = null;
let offersCache: { data: LimitedOffer[], timestamp: number } | null = null;
let comingSoonCache: { data: ComingSoonItem[], timestamp: number } | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const homepageService = {
  clearCache() {
    settingsCache = null;
    bannersCache = null;
    newsCache = null;
    offersCache = null;
    comingSoonCache = null;
  },

  // -------------------------------------------------------------
  // 1. Homepage General Settings
  // -------------------------------------------------------------
  async getSettings(): Promise<HomepageSettings> {
    if (!db) return DEFAULT_HOMEPAGE_SETTINGS;

    // Return from cache if fresh
    if (settingsCache && (Date.now() - settingsCache.timestamp < CACHE_TTL)) {
      return { ...settingsCache.data };
    }

    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      const snapshot = await getDoc(docRef);

      let data: HomepageSettings;
      if (!snapshot.exists()) {
        data = DEFAULT_HOMEPAGE_SETTINGS;
      } else {
        data = {
          ...DEFAULT_HOMEPAGE_SETTINGS,
          ...snapshot.data()
        } as HomepageSettings;
      }

      // Update cache
      settingsCache = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.warn('Could not load homepage settings, falling back to defaults:', error);
      return DEFAULT_HOMEPAGE_SETTINGS;
    }
  },

  async updateSettings(settings: Partial<HomepageSettings>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      const sanitizedPayload = sanitizeForFirestore({
        ...settings,
        updatedAt: new Date().toISOString()
      });
      await setDoc(docRef, sanitizedPayload, { merge: true });

      // Invalidate cache
      settingsCache = null;

      try {
        await auditService.recordAuditLog({
          action: 'SETTINGS_CHANGED',
          entityType: 'settings',
          entityId: 'main',
          entityName: 'إعدادات الصفحة الرئيسية',
          after: settings
        });
      } catch (e) {}
    } catch (error: any) {
      console.error('Error updating homepage settings:', error);
      throw new Error(error?.message || 'تعذر حفظ إعدادات الصفحة الرئيسية.');
    }
  },

  // -------------------------------------------------------------
  // 2. Hero Banners (إعلانات السلايدر الرئيسي)
  // -------------------------------------------------------------
  async getAllBanners(): Promise<HeroBanner[]> {
    if (!db) return [];

    // Return from cache if fresh
    if (bannersCache && (Date.now() - bannersCache.timestamp < CACHE_TTL)) {
      return [...bannersCache.data];
    }

    try {
      const colRef = collection(db, BANNERS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const list: HeroBanner[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data()
        } as HeroBanner);
      });
      const sorted = list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      // Update cache
      bannersCache = { data: [...sorted], timestamp: Date.now() };
      return sorted;
    } catch (error) {
      console.error('Error fetching homepage banners:', error);
      return [];
    }
  },

  async getActiveBanners(): Promise<HeroBanner[]> {
    const all = await this.getAllBanners();
    const now = Date.now();

    return all.filter((banner) => {
      if (banner.isActive === false) return false;

      // Optional start date (campaign or standard)
      const startStr = banner.campaignStartDate || banner.startDate;
      if (startStr) {
        const start = new Date(startStr).getTime();
        if (!isNaN(start) && now < start) return false;
      }

      // Optional end date (campaign or standard)
      const endStr = banner.campaignEndDate || banner.endDate;
      if (endStr) {
        const end = new Date(endStr.includes('T') ? endStr : `${endStr}T23:59:59`).getTime();
        if (!isNaN(end) && now > end) return false;
      }

      return true;
    });
  },

  async getHomeBanners(): Promise<HeroBanner[]> {
    const active = await this.getActiveBanners();
    return active.filter((b) => {
      if (Array.isArray(b.placements) && b.placements.length > 0) {
        return b.placements.includes('home_hero');
      }
      return b.showOnHome !== false;
    });
  },

  async getHomePromoBanners(): Promise<HeroBanner[]> {
    const active = await this.getActiveBanners();
    return active.filter((b) => Array.isArray(b.placements) && b.placements.includes('home_promo'));
  },

  async getCatalogBanners(): Promise<HeroBanner[]> {
    const active = await this.getActiveBanners();
    return active.filter((b) => {
      if (Array.isArray(b.placements) && b.placements.length > 0) {
        return b.placements.includes('catalog_page');
      }
      return b.showOnCatalog === true;
    });
  },

  async getCategoryBanners(categoryId: string): Promise<HeroBanner[]> {
    const active = await this.getActiveBanners();
    return active.filter((b) => {
      if (Array.isArray(b.placements) && b.placements.length > 0) {
        if (b.placements.includes('category_all')) return true;
        if (b.placements.includes('category_specific')) {
          return (
            b.specificCategoryId === categoryId ||
            (Array.isArray(b.categoryIds) && b.categoryIds.includes(categoryId))
          );
        }
        return false;
      }
      return Array.isArray(b.categoryIds) && b.categoryIds.includes(categoryId);
    });
  },

  async getProductBanners(productId: string): Promise<HeroBanner[]> {
    const active = await this.getActiveBanners();
    return active.filter((b) => {
      if (Array.isArray(b.placements) && b.placements.length > 0) {
        if (b.placements.includes('product_all')) return true;
        if (b.placements.includes('product_specific')) {
          return (
            b.specificProductId === productId ||
            b.productId === productId ||
            b.targetValue === productId
          );
        }
        return false;
      }
      return false;
    });
  },

  async getOffersBanners(): Promise<HeroBanner[]> {
    const active = await this.getActiveBanners();
    return active.filter((b) => Array.isArray(b.placements) && b.placements.includes('offers_page'));
  },

  async createBanner(bannerData: Omit<HeroBanner, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, BANNERS_COLLECTION);
      const sanitized = sanitizeForFirestore({
        ...bannerData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const docRef = await addDoc(colRef, sanitized);

      // Invalidate cache
      bannersCache = null;

      try {
        await auditService.recordAuditLog({
          action: 'BANNER_CREATED',
          entityType: 'banner',
          entityId: docRef.id,
          entityName: bannerData.title || 'بنر رئيسي جديد',
          after: { title: bannerData.title }
        });
      } catch (e) {}

      try {
        await notificationEngine.fireStoreEvent({
          eventType: 'HERO_BANNER_CHANGED',
          payload: {
            heroTitle: bannerData.title || 'إعلان سلايدر جديد',
            bannerId: docRef.id
          }
        });
      } catch (e) {}

      return docRef.id;
    } catch (error: any) {
      console.error('Error creating banner:', error);
      throw new Error(error?.message || 'تعذر إنشاء الإعلان.');
    }
  },

  async updateBanner(id: string, bannerData: Partial<HeroBanner>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, BANNERS_COLLECTION, id);
      const snap = await getDoc(docRef);
      let oldUrls: string[] = [];
      if (snap.exists()) {
        const item = snap.data() as HeroBanner;
        if (item.desktopImageUrl) oldUrls.push(item.desktopImageUrl);
        if (item.mobileImageUrl) oldUrls.push(item.mobileImageUrl);
        if (item.posterImageUrl) oldUrls.push(item.posterImageUrl);
        if (item.mobilePosterImageUrl) oldUrls.push(item.mobilePosterImageUrl);
        if (item.productImageUrl) oldUrls.push(item.productImageUrl);
        if (item.backgroundImageUrl) oldUrls.push(item.backgroundImageUrl);
      }

      const sanitized = sanitizeForFirestore({
        ...bannerData,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, sanitized);

      // Invalidate cache
      bannersCache = null;

      try {
        const bTitle = bannerData.title || (snap.exists() ? snap.data().title : id);
        await auditService.recordAuditLog({
          action: 'BANNER_EDITED',
          entityType: 'banner',
          entityId: id,
          entityName: bTitle,
          before: snap.exists() ? { title: snap.data().title } : null,
          after: { title: bannerData.title || snap.data()?.title }
        });
      } catch (e) {}

      if (oldUrls.length > 0) {
        let newUrls: string[] = [];
        if (bannerData.desktopImageUrl) newUrls.push(bannerData.desktopImageUrl);
        if (bannerData.mobileImageUrl) newUrls.push(bannerData.mobileImageUrl);
        if (bannerData.posterImageUrl) newUrls.push(bannerData.posterImageUrl);
        if (bannerData.mobilePosterImageUrl) newUrls.push(bannerData.mobilePosterImageUrl);
        if (bannerData.productImageUrl) newUrls.push(bannerData.productImageUrl);
        if (bannerData.backgroundImageUrl) newUrls.push(bannerData.backgroundImageUrl);
        
        const imageFieldsUpdated =
          'desktopImageUrl' in bannerData ||
          'mobileImageUrl' in bannerData ||
          'posterImageUrl' in bannerData ||
          'mobilePosterImageUrl' in bannerData ||
          'productImageUrl' in bannerData ||
          'backgroundImageUrl' in bannerData;
        if (imageFieldsUpdated) {
          const removedUrls = oldUrls.filter(url => !newUrls.includes(url));
          if (removedUrls.length > 0) {
            await storageService.safeDeleteFiles(removedUrls);
          }
        }
      }

      try {
        await notificationEngine.fireStoreEvent({
          eventType: 'HERO_BANNER_CHANGED',
          payload: {
            heroTitle: bannerData.title || 'تحديث لافتة ترويجية',
            bannerId: id
          }
        });
      } catch (e) {}
    } catch (error: any) {
      console.error('Error updating banner:', error);
      throw new Error(error?.message || 'تعذر تعديل الإعلان.');
    }
  },

  async deleteBanner(id: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, BANNERS_COLLECTION, id);
      const snap = await getDoc(docRef);
      let urlsToDelete: string[] = [];
      
      if (snap.exists()) {
        const banner = snap.data() as HeroBanner;
        if (banner.desktopImageUrl) urlsToDelete.push(banner.desktopImageUrl);
        if (banner.mobileImageUrl) urlsToDelete.push(banner.mobileImageUrl);
        if (banner.posterImageUrl) urlsToDelete.push(banner.posterImageUrl);
        if (banner.mobilePosterImageUrl) urlsToDelete.push(banner.mobilePosterImageUrl);
        // DO NOT delete productImageUrl, it belongs to the Product
        if (banner.backgroundImageUrl) urlsToDelete.push(banner.backgroundImageUrl);
      }
      
      // Delete document first
      await deleteDoc(docRef);

      // Invalidate cache
      bannersCache = null;

      try {
        const deletedBanner = snap.exists() ? snap.data() : null;
        await auditService.recordAuditLog({
          action: 'BANNER_DELETED',
          entityType: 'banner',
          entityId: id,
          entityName: deletedBanner?.title || id,
          before: deletedBanner ? { title: deletedBanner.title } : null,
          after: null
        });
      } catch (e) {}
      
      // Safely delete storage files
      if (urlsToDelete.length > 0) {
        await storageService.safeDeleteFiles(urlsToDelete);
      }
    } catch (error: any) {
      console.error('Error deleting banner:', error);
      throw new Error(error?.message || 'تعذر حذف الإعلان.');
    }
  },

  // -------------------------------------------------------------
  // 3. News Ticker (شريط النشرة والأخبار)
  // -------------------------------------------------------------
  async getAllNews(): Promise<NewsTickerItem[]> {
    if (!db) return [];

    // Return from cache if fresh
    if (newsCache && (Date.now() - newsCache.timestamp < CACHE_TTL)) {
      return [...newsCache.data];
    }

    try {
      const colRef = collection(db, TICKER_COLLECTION);
      const snapshot = await getDocs(colRef);
      const list: NewsTickerItem[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data()
        } as NewsTickerItem);
      });
      const sorted = list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      // Update cache
      newsCache = { data: [...sorted], timestamp: Date.now() };
      return sorted;
    } catch (error) {
      console.error('Error fetching news ticker items:', error);
      return [];
    }
  },

  async getActiveNews(): Promise<NewsTickerItem[]> {
    const all = await this.getAllNews();
    const now = Date.now();

    return all.filter((item) => {
      if (!item.isActive) return false;

      if (item.startDate) {
        const start = new Date(item.startDate).getTime();
        if (!isNaN(start) && now < start) return false;
      }

      if (item.endDate) {
        const end = new Date(item.endDate.includes('T') ? item.endDate : `${item.endDate}T23:59:59`).getTime();
        if (!isNaN(end) && now > end) return false;
      }

      return true;
    });
  },

  async createNews(newsData: Omit<NewsTickerItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, TICKER_COLLECTION);
      const sanitized = sanitizeForFirestore({
        ...newsData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const docRef = await addDoc(colRef, sanitized);

      // Invalidate cache
      newsCache = null;

      return docRef.id;
    } catch (error: any) {
      console.error('Error creating news ticker item:', error);
      throw new Error(error?.message || 'تعذر إضافة الخبر.');
    }
  },

  async updateNews(id: string, newsData: Partial<NewsTickerItem>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, TICKER_COLLECTION, id);
      const snap = await getDoc(docRef);
      let oldUrls: string[] = [];
      if (snap.exists()) {
        const item = snap.data() as NewsTickerItem;
        if (item.icon) oldUrls.push(item.icon);
      }
      
      const sanitized = sanitizeForFirestore({
        ...newsData,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, sanitized);

      // Invalidate cache
      newsCache = null;
      
      if (oldUrls.length > 0) {
        let newUrls: string[] = [];
        if (newsData.icon) newUrls.push(newsData.icon);
        
        const imageFieldsUpdated = 'icon' in newsData;
        if (imageFieldsUpdated) {
          const removedUrls = oldUrls.filter(url => !newUrls.includes(url));
          if (removedUrls.length > 0) {
            await storageService.safeDeleteFiles(removedUrls);
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating news ticker item:', error);
      throw new Error(error?.message || 'تعذر تعديل الخبر.');
    }
  },

  async deleteNews(id: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, TICKER_COLLECTION, id);
      await deleteDoc(docRef);
      // DO NOT delete icon image since News items do not upload/own files.

      // Invalidate cache
      newsCache = null;
    } catch (error: any) {
      console.error('Error deleting news ticker item:', error);
      throw new Error(error?.message || 'تعذر حذف الخبر.');
    }
  },

  // -------------------------------------------------------------
  // 4. Limited Offers (عروض لفترة محدودة)
  // -------------------------------------------------------------
  async getAllOffers(): Promise<LimitedOffer[]> {
    if (!db) return [];

    // Return from cache if fresh
    if (offersCache && (Date.now() - offersCache.timestamp < CACHE_TTL)) {
      return [...offersCache.data];
    }

    try {
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
      // Safely enrich offers with authoritative product images/names from published products
      try {
        const publishedProducts = await productService.getAllProducts(false);
        const productsMap = new Map();
        publishedProducts.forEach(p => {
          productsMap.set(p.id, p);
        });
        
        enrichedList = list.map(offer => {
          const prod = productsMap.get(offer.productId);
          if (prod) {
            // Fallback to custom offer image only if product image doesn't exist
            offer.productImage = prod.mainImageUrl || offer.productImage;
            offer.productName = prod.name || offer.productName;
          }
          return offer;
        });
      } catch (enrichError) {
        console.warn('Could not enrich limited offers with product images:', enrichError);
      }

      // Update cache
      offersCache = { data: enrichedList, timestamp: Date.now() };
      return enrichedList;
    } catch (error) {
      console.error('Error fetching limited offers:', error);
      return [];
    }
  },

  async getActiveOffers(): Promise<LimitedOffer[]> {
    const all = await this.getAllOffers();
    const now = Date.now();

    return all.filter((offer) => {
      if (!offer.isActive) return false;

      const start = new Date(`${offer.startDate}T${offer.startTime || '00:00'}:00`).getTime();
      const end = new Date(`${offer.endDate}T${offer.endTime || '23:59'}:00`).getTime();

      if (isNaN(start) || isNaN(end)) return false;
      return now >= start && now <= end;
    });
  },

  async createOffer(offerData: Omit<LimitedOffer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, OFFERS_COLLECTION);
      const sanitized = sanitizeForFirestore({
        ...offerData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const docRef = await addDoc(colRef, sanitized);

      // Invalidate cache
      offersCache = null;

      return docRef.id;
    } catch (error: any) {
      console.error('Error creating offer:', error);
      throw new Error(error?.message || 'تعذر إضافة العرض.');
    }
  },

  async updateOffer(id: string, offerData: Partial<LimitedOffer>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, OFFERS_COLLECTION, id);
      const snap = await getDoc(docRef);
      let oldUrls: string[] = [];
      if (snap.exists()) {
        const item = snap.data() as LimitedOffer;
        if (item.productImage) oldUrls.push(item.productImage);
      }
      
      const sanitized = sanitizeForFirestore({
        ...offerData,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, sanitized);

      // Invalidate cache
      offersCache = null;
      
      if (oldUrls.length > 0) {
        let newUrls: string[] = [];
        if (offerData.productImage) newUrls.push(offerData.productImage);
        
        const imageFieldsUpdated = 'productImage' in offerData;
        if (imageFieldsUpdated) {
          const removedUrls = oldUrls.filter(url => !newUrls.includes(url));
          if (removedUrls.length > 0) {
            await storageService.safeDeleteFiles(removedUrls);
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating offer:', error);
      throw new Error(error?.message || 'تعذر تعديل العرض.');
    }
  },

  async deleteOffer(id: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, OFFERS_COLLECTION, id);
      await deleteDoc(docRef);
      // DO NOT delete the productImage, as it belongs to the Product.

      // Invalidate cache
      offersCache = null;
    } catch (error: any) {
      console.error('Error deleting offer:', error);
      throw new Error(error?.message || 'تعذر حذف العرض.');
    }
  },

  // -------------------------------------------------------------
  // 5. Coming Soon Items (قادم قريبًا)
  // -------------------------------------------------------------
  async getAllComingSoon(): Promise<ComingSoonItem[]> {
    if (!db) return [];

    // Return from cache if fresh
    if (comingSoonCache && (Date.now() - comingSoonCache.timestamp < CACHE_TTL)) {
      return [...comingSoonCache.data];
    }

    try {
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

      // Update cache
      comingSoonCache = { data: sorted, timestamp: Date.now() };
      return sorted;
    } catch (error) {
      console.error('Error fetching coming soon items:', error);
      return [];
    }
  },

  async getActiveComingSoon(): Promise<ComingSoonItem[]> {
    const all = await this.getAllComingSoon();
    return all.filter((item) => item.isActive);
  },

  async createComingSoonItem(itemData: Omit<ComingSoonItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const colRef = collection(db, COMING_SOON_COLLECTION);
      const sanitized = sanitizeForFirestore({
        ...itemData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const docRef = await addDoc(colRef, sanitized);

      // Invalidate cache
      comingSoonCache = null;

      return docRef.id;
    } catch (error: any) {
      console.error('Error creating coming soon item:', error);
      throw new Error(error?.message || 'تعذر إضافة المنتج القادم.');
    }
  },

  async updateComingSoonItem(id: string, itemData: Partial<ComingSoonItem>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, COMING_SOON_COLLECTION, id);
      const snap = await getDoc(docRef);
      let oldUrls: string[] = [];
      if (snap.exists()) {
        const item = snap.data() as ComingSoonItem;
        if (item.image) oldUrls.push(item.image);
      }
      
      const sanitized = sanitizeForFirestore({
        ...itemData,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(docRef, sanitized);

      // Invalidate cache
      comingSoonCache = null;
      
      if (oldUrls.length > 0) {
        let newUrls: string[] = [];
        if (itemData.image) newUrls.push(itemData.image);
        
        const imageFieldsUpdated = 'image' in itemData;
        if (imageFieldsUpdated) {
          const removedUrls = oldUrls.filter(url => !newUrls.includes(url));
          if (removedUrls.length > 0) {
            await storageService.safeDeleteFiles(removedUrls);
          }
        }
      }
    } catch (error: any) {
      console.error('Error updating coming soon item:', error);
      throw new Error(error?.message || 'تعذر تعديل المنتج القادم.');
    }
  },

  async deleteComingSoonItem(id: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, COMING_SOON_COLLECTION, id);
      await deleteDoc(docRef);
      // DO NOT delete the image, as coming soon items use manual URLs or product image references.

      // Invalidate cache
      comingSoonCache = null;
    } catch (error: any) {
      console.error('Error deleting coming soon item:', error);
      throw new Error(error?.message || 'تعذر حذف المنتج القادم.');
    }
  }
};
