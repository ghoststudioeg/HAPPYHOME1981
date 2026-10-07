import { supabaseDb, supabaseAdmin } from './supabaseDb';
import { StoreSettings } from '../../types';
import { DEFAULT_STORE_SETTINGS } from './seedData';
import { auth } from '../firebase';

let settingsCache: StoreSettings | null = null;
let settingsCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

export const settingsService = {
  clearCache() {
    settingsCache = null;
    settingsCacheTime = 0;
  },

  async getSettings(): Promise<StoreSettings> {
    const now = Date.now();
    if (settingsCache && now - settingsCacheTime < CACHE_TTL) {
      return { ...settingsCache };
    }

    const isBrowser = typeof window !== 'undefined';

    // In browser environment: try fetching from server cache endpoint first for fast, reliable data
    if (isBrowser) {
      try {
        const res = await fetch('/api/cache/settings');
        if (res.ok) {
          const apiSettings = await res.json();
          if (apiSettings && typeof apiSettings === 'object') {
            const merged: StoreSettings = {
              ...DEFAULT_STORE_SETTINGS,
              ...apiSettings,
              logoUrl: apiSettings.logoUrl || DEFAULT_STORE_SETTINGS.logoUrl
            };
            settingsCache = { ...merged };
            settingsCacheTime = now;
            return merged;
          }
        }
      } catch (e) {
        console.warn('[settingsService] Browser /api/cache/settings fetch notice:', e);
      }
    }

    try {
      // 1. Check PostgreSQL store_settings table directly
      const { data, error } = await supabaseAdmin.from('store_settings').select('*').limit(1);
      if (!error && Array.isArray(data) && data.length > 0) {
        const d = data[0];
        const settings: StoreSettings = {
          ...DEFAULT_STORE_SETTINGS,
          storeName: d.store_name || DEFAULT_STORE_SETTINGS.storeName,
          logoUrl: d.logo_url || DEFAULT_STORE_SETTINGS.logoUrl,
          whatsappNumber: d.whatsapp_number || DEFAULT_STORE_SETTINGS.whatsappNumber,
          phone: d.phone || DEFAULT_STORE_SETTINGS.phone,
          facebookUrl: d.facebook_url || DEFAULT_STORE_SETTINGS.facebookUrl,
          instagramUrl: d.instagram_url || DEFAULT_STORE_SETTINGS.instagramUrl,
          address: d.address || DEFAULT_STORE_SETTINGS.address,
          workingHours: d.working_hours || DEFAULT_STORE_SETTINGS.workingHours,
          heroTitle: d.hero_title || DEFAULT_STORE_SETTINGS.heroTitle,
          heroSubtitle: d.hero_subtitle || DEFAULT_STORE_SETTINGS.heroSubtitle
        };
        settingsCache = { ...settings };
        settingsCacheTime = now;
        return settings;
      }

      // 2. Fallback to Supabase Storage JSON doc if table was empty
      const doc = await supabaseDb.getDoc<StoreSettings>('store_settings', 'main');
      const settings = doc ? { ...DEFAULT_STORE_SETTINGS, ...doc } : DEFAULT_STORE_SETTINGS;
      settingsCache = { ...settings };
      settingsCacheTime = now;
      return settings;
    } catch (err) {
      console.error('Error fetching settings from Supabase:', err);
      return settingsCache || DEFAULT_STORE_SETTINGS;
    }
  },

  async updateSettings(newSettings: Partial<StoreSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated: StoreSettings = { ...current, ...newSettings };

    const isBrowser = typeof window !== 'undefined';

    if (isBrowser) {
      let idToken = '';
      if (auth?.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch (e) {
          console.warn('Failed to obtain Firebase ID Token for settings update:', e);
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(updated),
        credentials: 'include'
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to save store settings (HTTP ${res.status})`);
      }
    } else {
      const { error } = await supabaseAdmin.from('store_settings').upsert([{
        id: '1c343c7c-e932-4d4b-9ba1-3c7d54ed2f83',
        store_name: updated.storeName,
        logo_url: updated.logoUrl,
        whatsapp_number: updated.whatsappNumber,
        phone: updated.phone,
        facebook_url: updated.facebookUrl,
        instagram_url: updated.instagramUrl,
        address: updated.address,
        working_hours: updated.workingHours,
        hero_title: updated.heroTitle,
        hero_subtitle: updated.heroSubtitle,
        updated_at: new Date().toISOString()
      }]);

      if (error) {
        throw new Error(`PostgreSQL store_settings update failed: ${error.message}`);
      }
    }

    this.clearCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('store-settings-updated'));
    }
  }
};
