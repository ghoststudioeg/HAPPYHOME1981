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
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let pendingSettingsRequest: Promise<StoreSettings> | null = null;

export const settingsService = {
  clearCache() {
    settingsCache = null;
    settingsCacheTime = 0;
    pendingSettingsRequest = null;
  },

  async getSettings(): Promise<StoreSettings> {
    if (!db) return DEFAULT_STORE_SETTINGS;
    
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (settingsCache && (Date.now() - settingsCacheTime < CACHE_TTL)) {
      return { ...settingsCache };
    }

    if (pendingSettingsRequest) return pendingSettingsRequest;
    
    pendingSettingsRequest = (async () => {
      try {
        if (!isAdmin) {
          try {
            const res = await fetch('/api/cache/settings');
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
              const data = await res.json();
              if (data && typeof data === 'object' && !('fallbackToClient' in data && data.ok === false)) {
                const settings = { ...DEFAULT_STORE_SETTINGS, ...data };
                settingsCache = { ...settings };
                settingsCacheTime = Date.now();
                return settings;
              }
            }
          } catch (fetchErr) {
            console.warn('Failed to fetch settings from server cache, falling back to Firestore:', fetchErr);
          }
        }

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
        
        settingsCache = { ...settings };
        settingsCacheTime = Date.now();
        return settings;
      } catch (error: any) {
        console.error('Error fetching settings:', error);
        if (settingsCache) return { ...settingsCache };
        return DEFAULT_STORE_SETTINGS;
      } finally {
        pendingSettingsRequest = null;
      }
    })();

    return pendingSettingsRequest;
  },

  async updateSettings(newSettings: Partial<StoreSettings>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    const docRef = doc(db, COLLECTION_NAME, SETTING_DOC_ID);
    const sanitizedPayload = sanitizeForFirestore({
      ...newSettings,
      updatedAt: serverTimestamp()
    });
    await setDoc(docRef, sanitizedPayload, { merge: true });
    this.clearCache();
    if (typeof window !== 'undefined') {
      fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'settings'}) }).catch(()=>{});
    }
  }
};
