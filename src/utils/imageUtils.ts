/**
 * Central Image Resolver & URL Validator
 * Safely resolves Supabase Storage paths, full URLs, and handles missing/legacy images.
 */

const SUPABASE_BASE_URL = (
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://mehfdwqululparywkpde.supabase.co'
).replace(/\/+$/, '');

const STORAGE_PREFIX = `${SUPABASE_BASE_URL}/storage/v1/object/public`;

/**
 * Centrally resolves an image path or URL into a clean, valid, public URL.
 * - Leaves valid HTTP/HTTPS URLs untouched (never double-prepends Supabase URL)
 * - Resolves Supabase storage paths (bucket-relative or subfolder) into public URLs
 * - Resolves confirmed local static assets (e.g. /logo.svg)
 * - Returns fallback or null for invalid, empty, or non-existent legacy paths (e.g. /catalog/...)
 * - Never returns undefined for a valid existing URL
 * - Never exposes service-role keys
 * - Works safely across browser and SSR
 */
export function resolveImageUrl(value: unknown, fallback?: unknown): string | null {
  if (typeof value === 'string') {
    const raw = value.trim();
    if (raw) {
      // 1. Data URLs or Blob URLs
      if (raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw;
      }

      // 2. Full HTTP/HTTPS URLs
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        // Prevent accidental nested URL concatenation (e.g. https://domain.com/https://...)
        const lastHttp = raw.lastIndexOf('http://');
        const lastHttps = raw.lastIndexOf('https://');
        const lastProtoIdx = Math.max(lastHttp, lastHttps);
        if (lastProtoIdx > 0) {
          return raw.slice(lastProtoIdx);
        }
        return raw;
      }

      // 3. Known local public static assets
      const confirmedPublicAssets = ['/logo.svg', '/logo-square.svg', '/favicon.svg'];
      if (confirmedPublicAssets.includes(raw)) {
        return raw;
      }

      // 4. Supabase Storage relative paths
      // If it already points to storage API:
      if (raw.startsWith('/storage/v1/object/public/')) {
        return `${SUPABASE_BASE_URL}${raw}`;
      }
      if (raw.startsWith('storage/v1/object/public/')) {
        return `${SUPABASE_BASE_URL}/${raw}`;
      }

      // If path starts with a known bucket: product-images, category-images, site-assets
      const knownBuckets = ['product-images', 'category-images', 'site-assets'];
      for (const bucket of knownBuckets) {
        if (raw === bucket || raw === `/${bucket}`) break;
        if (raw.startsWith(`${bucket}/`)) {
          return `${STORAGE_PREFIX}/${raw}`;
        }
        if (raw.startsWith(`/${bucket}/`)) {
          return `${STORAGE_PREFIX}${raw}`;
        }
      }

      // Known subfolders in default 'product-images' bucket
      const knownSubfolders = ['products/', 'categories/', 'brand/', 'companies/', 'bundle-offers/', 'avatars/'];
      const cleanPath = raw.startsWith('/') ? raw.slice(1) : raw;
      for (const sub of knownSubfolders) {
        if (cleanPath.startsWith(sub)) {
          return `${STORAGE_PREFIX}/product-images/${cleanPath}`;
        }
      }

      // 5. Legacy /catalog/... paths
      // As required: only resolve if the file actually exists in storage.
      // Since no files exist at /catalog/ in storage or locally, do not treat as valid primary image.
      if (raw.startsWith('/catalog/') || raw.startsWith('catalog/')) {
        // Proceed to check fallback below
      }
    }
  }

  if (fallback !== undefined && fallback !== null && fallback !== value) {
    return resolveImageUrl(fallback, null);
  }

  return null;
}

export function isValidImageSrc(value: unknown): value is string {
  const resolved = resolveImageUrl(value);
  return typeof resolved === 'string' && resolved.length > 0;
}

export function getValidImageSrc(value: unknown, fallback?: unknown): string | undefined {
  const resolved = resolveImageUrl(value, fallback);
  return resolved || undefined;
}

