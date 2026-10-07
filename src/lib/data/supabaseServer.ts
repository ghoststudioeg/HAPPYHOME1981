import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClientInstance: SupabaseClient | null = null;

/**
 * Lazy, safe getter for Server-Side Supabase Admin Client.
 * Uses process.env.SUPABASE_URL and process.env.SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).
 * Pure Node.js CJS compatible with zero import.meta.env usage.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const url = (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || 'https://mehfdwqululparywkpde.supabase.co';
  const key = (typeof process !== 'undefined' && (process.env?.SUPABASE_SERVICE_ROLE_KEY || process.env?.SUPABASE_ANON_KEY)) || '';

  if (!url || !key || key.trim() === '') {
    return null;
  }

  try {
    adminClientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return adminClientInstance;
  } catch (err) {
    console.error('[Supabase Server Client Init Error]:', err);
    return null;
  }
}
