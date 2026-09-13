import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { StoreSettings } from '../../types';
import { DEFAULT_STORE_SETTINGS } from './seedData';
import { sanitizeForFirestore } from '../firestoreUtils';

const COLLECTION_NAME = 'storeSettings';
const SETTING_DOC_ID = 'main';

// In-memory cache for settings to avoid redundant Firestore reads
let settingsCache: StoreSettings | null = null;
let settingsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const settingsService = {
  clearCache() {
    settingsCache = null;
    settingsCacheTime = 0;
  },

  async getSettings(): Promise<StoreSettings> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    // Serve from cache if fresh
    if (settingsCache && (Date.now() - settingsCacheTime < CACHE_TTL)) {
      return { ...settingsCache };
    }

    try {
      const docRef = doc(db, COLLECTION_NAME, SETTING_DOC_ID);
      const snapshot = await getDoc(docRef);

      let settings: StoreSettings;
      if (!snapshot.exists()) {
        settings = DEFAULT_STORE_SETTINGS;
      } else {
        settings = {
          ...DEFAULT_STORE_SETTINGS,
          ...snapshot.data()
        } as StoreSettings;
      }

      // Save to cache
      settingsCache = { ...settings };
      settingsCacheTime = Date.now();

      return settings;
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      throw new Error(error?.message || 'تعذر جلب إعدادات المتجر.');
    }
  },

  async updateSettings(newSettings: Partial<StoreSettings>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTING_DOC_ID);
      const snap = await getDoc(docRef);
      let oldLogoUrl: string | null = null;
      if (snap.exists()) {
        const currentData = snap.data() as StoreSettings;
        if (currentData.logoUrl) {
          oldLogoUrl = currentData.logoUrl;
        }
      }
      
      const sanitizedPayload = sanitizeForFirestore({
        ...newSettings,
        updatedAt: serverTimestamp()
      });

      await setDoc(docRef, sanitizedPayload, { merge: true });
      
      // Invalidate cache immediately
      this.clearCache();

      if (oldLogoUrl && newSettings.logoUrl && oldLogoUrl !== newSettings.logoUrl) {
        // import storageService at top of file, or use if already there
        // Actually, storageService is not imported. I will import it if not present.
        const { storageService } = await import('./storageService');
        await storageService.safeDeleteFile(oldLogoUrl);
      }
    } catch (error: any) {
      console.error('Error updating settings:', error);
      throw new Error(error?.message || 'تعذر حفظ إعدادات المتجر.');
    }
  },

  async seedInitialSettings(): Promise<void> {
    if (!db) return;
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTING_DOC_ID);
      const sanitizedPayload = sanitizeForFirestore({
        ...DEFAULT_STORE_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await setDoc(docRef, sanitizedPayload, { merge: true });
    } catch (e) {
      console.error('Could not seed store settings to remote Firestore:', e);
    }
  }
};
