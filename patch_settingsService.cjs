const fs = require('fs');
let code = fs.readFileSync('src/lib/data/settingsService.ts', 'utf-8');

const newGetSettings = `
  async getSettings(): Promise<StoreSettings> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');
    
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    if (settingsCache && (Date.now() - settingsCacheTime < CACHE_TTL)) {
      return { ...settingsCache };
    }
    
    try {
      if (!isAdmin) {
        try {
          const res = await fetch('/api/cache/settings');
          if (res.ok) {
            const data = await res.json();
            const settings = data ? { ...DEFAULT_STORE_SETTINGS, ...data } : DEFAULT_STORE_SETTINGS;
            settingsCache = { ...settings };
            settingsCacheTime = Date.now();
            return settings;
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
      throw new Error(error?.message || 'تعذر جلب إعدادات المتجر.');
    }
  },
`;

code = code.replace(
  /async getSettings\([^\{]*\{[\s\S]*?(?=async updateSettings)/,
  newGetSettings.trim() + '\n\n  '
);

code = code.replace(/this\.clearCache\(\);/g, `this.clearCache();
      if (typeof window !== 'undefined') {
        fetch('/api/cache/clear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'settings'}) }).catch(()=>{});
      }`);

fs.writeFileSync('src/lib/data/settingsService.ts', code);
console.log('settingsService patched');
