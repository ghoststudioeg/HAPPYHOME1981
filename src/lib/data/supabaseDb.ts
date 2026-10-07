import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabaseClient';

const bucketName = 'product-images';

let serverClientInstance: SupabaseClient | null = null;

/**
 * Allows the server process (server.ts) to inject the admin Supabase client
 * without forcing the browser bundle to import server-only code.
 */
export function setServerSupabaseClient(client: SupabaseClient | null) {
  serverClientInstance = client;
}

/**
 * Returns the active Supabase client.
 * In browser: uses safe browser client getter with public keys.
 * In server: uses injected server admin client.
 */
export function getActiveSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return serverClientInstance;
  }

  return getSupabaseBrowserClient();
}

/**
 * Universal Supabase Collection Storage Layer
 * Safely performs CRUD on Supabase Postgres tables and JSON document storage.
 */
export const supabaseDb = {
  async getCollection<T = any>(collectionName: string): Promise<T[]> {
    const client = getActiveSupabaseClient();
    if (!client) {
      console.warn(`[SupabaseDb] No active Supabase client available to read ${collectionName}`);
      return [];
    }

    console.log(`[DIAGNOSTIC] getCollection starting for ${collectionName}`);
    try {
      // List of collections known to be in PostgreSQL tables
      const tableCollections = ['products', 'categories', 'store_settings', 'product_images'];
      
      if (tableCollections.includes(collectionName)) {
        const { data, error } = await client.from(collectionName).select('*');
        if (!error && Array.isArray(data)) {
          return data as T[];
        }
        return [];
      }

      // Non-table collections default to empty list cleanly without HTTP 400 storage requests
      return [];
    } catch (err: any) {
      console.warn(`[SupabaseDb] Error reading collection ${collectionName}:`, err?.message || err);
      return [];
    }
  },

  async saveCollection<T = any>(collectionName: string, items: T[]): Promise<void> {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
      const startTime = Date.now();
      try {
        let idToken = '';
        try {
          const { auth } = await import('../firebase');
          if (auth?.currentUser) {
            idToken = await auth.currentUser.getIdToken(false);
          }
        } catch {}

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }

        const response = await fetch('/api/supabase/saveCollection', {
          method: 'POST',
          headers,
          body: JSON.stringify({ collectionName, items }),
          credentials: 'include'
        });
        if (response.ok) {
          return;
        }
      } catch (err: any) {
        console.error('[API FETCH ERROR]', {
          url: '/api/supabase/saveCollection',
          method: 'POST',
          error: err?.message || String(err),
          duration: `${Date.now() - startTime}ms`
        });
      }
    }

    const client = getActiveSupabaseClient();
    if (!client) {
      console.warn(`[SupabaseDb] No active Supabase client available to save ${collectionName}`);
      return;
    }

    try {
      const content = JSON.stringify(items, null, 2);
      const uploadData = typeof Blob !== 'undefined'
        ? new Blob([content], { type: 'application/json' })
        : content;

      const { error } = await client.storage
        .from(bucketName)
        .upload(`database/data/${collectionName}.json`, uploadData, {
          contentType: 'application/json',
          upsert: true
        });

      if (error) {
        console.warn(`[SupabaseDb] Storage upload note for ${collectionName}: ${error.message}`);
      }
    } catch (err: any) {
      console.warn(`[SupabaseDb] Warning saving collection ${collectionName}:`, err?.message || err);
    }
  },

  async getDoc<T = any>(collectionName: string, id: string): Promise<T | null> {
    const items = await supabaseDb.getCollection<any>(collectionName);
    return items.find((item) => String(item.id) === String(id) || String(item.code) === String(id) || String(item.firebase_uid) === String(id)) || null;
  },

  async setDoc<T = any>(collectionName: string, id: string, data: T): Promise<T> {
    const items = await supabaseDb.getCollection<any>(collectionName);
    const index = items.findIndex((item) => String(item.id) === String(id) || String(item.code) === String(id) || String(item.firebase_uid) === String(id));
    
    const record = { id, ...data, updatedAt: new Date().toISOString() };
    if (index >= 0) {
      items[index] = { ...items[index], ...record };
    } else {
      items.push(record);
    }

    await supabaseDb.saveCollection(collectionName, items);
    return record as T;
  },

  async updateDoc<T = any>(collectionName: string, id: string, partial: Partial<T>): Promise<void> {
    const items = await supabaseDb.getCollection<any>(collectionName);
    const index = items.findIndex((item) => String(item.id) === String(id) || String(item.code) === String(id) || String(item.firebase_uid) === String(id));
    
    if (index >= 0) {
      items[index] = { ...items[index], ...partial, updatedAt: new Date().toISOString() };
      await supabaseDb.saveCollection(collectionName, items);
    }
  },

  async deleteDoc(collectionName: string, id: string): Promise<void> {
    const items = await supabaseDb.getCollection<any>(collectionName);
    const filtered = items.filter((item) => String(item.id) !== String(id) && String(item.code) !== String(id) && String(item.firebase_uid) !== String(id));
    if (filtered.length !== items.length) {
      await supabaseDb.saveCollection(collectionName, filtered);
    }
  }
};

export const supabaseAdmin = {
  from(tableName: string) {
    const client = getActiveSupabaseClient();
    if (!client) {
      throw new Error(
        `[Supabase Error] No active Supabase client available to query table "${tableName}". ` +
        `Please ensure that environment variables for Supabase are correctly configured ` +
        `(${typeof window === 'undefined' ? 'SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY' : 'VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY'}).`
      );
    }
    return client.from(tableName);
  }
};
