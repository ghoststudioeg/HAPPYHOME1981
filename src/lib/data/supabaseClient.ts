import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClientInstance: SupabaseClient | null = null;

/**
 * Lazy, safe getter for the Browser Supabase Client.
 * Uses public VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY.
 * Never throws at module load time to prevent white-screen crashes.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClientInstance) {
    return browserClientInstance;
  }

  let url = '';
  let key = '';

  try {
    if (typeof process !== 'undefined' && process.env) {
      url = process.env.VITE_SUPABASE_URL || '';
      key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
    }
  } catch {}

  // Vite replaces import.meta.env values statically during build
  if (!url) {
    url = import.meta.env.VITE_SUPABASE_URL || '';
  }
  if (!key) {
    key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }

  if (!url) {
    url = 'https://mehfdwqululparywkpde.supabase.co';
  }

  if (!url || !key || key.trim() === '') {
    console.warn('[Supabase Browser Client] Initialization incomplete: missing URL or Key.');
    return null;
  }

  try {
    browserClientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[BOOT] Supabase Browser Client: READY = true');
    return browserClientInstance;
  } catch (err) {
    console.error('[Supabase Browser Client Init Error]:', err);
    return null;
  }
}

