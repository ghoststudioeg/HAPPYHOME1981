/**
 * YouTube Utility Helper
 * Provides safe validation, video ID extraction, and embed URL generation
 * for Hero Banner video system.
 */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
]);

/**
 * Safely extracts the 11-character YouTube video ID from various YouTube URL formats or direct IDs.
 * Returns null if invalid or unsafe.
 */
export function extractYouTubeVideoId(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reject malicious schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return null;
  }

  // If already a clean 11-character YouTube ID (alphanumeric, dash, underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Verify allowed host
    if (!YOUTUBE_HOSTS.has(hostname)) {
      return null;
    }

    // 1. youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      const pathname = url.pathname.replace(/^\/+/, '');
      const candidate = pathname.split('/')[0]?.split('?')[0];
      if (candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
        return candidate;
      }
    }

    // 2. youtube.com formats
    // 2a. /watch?v=VIDEO_ID
    const vParam = url.searchParams.get('v');
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }

    // 2b. /shorts/VIDEO_ID
    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/i);
    if (shortsMatch && shortsMatch[1]) {
      return shortsMatch[1];
    }

    // 2c. /embed/VIDEO_ID
    const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/i);
    if (embedMatch && embedMatch[1]) {
      return embedMatch[1];
    }

    // 2d. /v/VIDEO_ID
    const vMatch = url.pathname.match(/\/v\/([a-zA-Z0-9_-]{11})/i);
    if (vMatch && vMatch[1]) {
      return vMatch[1];
    }
  } catch {
    // If URL parsing fails, test safe regex with strict domain check
    const regexMatch = trimmed.match(
      /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    if (regexMatch && regexMatch[1] && /^[a-zA-Z0-9_-]{11}$/.test(regexMatch[1])) {
      return regexMatch[1];
    }
  }

  return null;
}

/**
 * Checks if a given string is a YouTube URL or direct YouTube ID.
 */
export function isYouTubeUrl(input: string | undefined | null): boolean {
  return extractYouTubeVideoId(input) !== null;
}

/**
 * Builds the official YouTube embed URL for seamless, muted, looping promotional Hero banners.
 */
export function buildYouTubeEmbedUrl(
  videoId: string,
  options?: {
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    playsinline?: boolean;
  }
): string {
  const {
    autoplay = true,
    muted = true,
    loop = true,
    controls = false,
    playsinline = true
  } = options || {};

  const cleanId = encodeURIComponent(videoId);
  const params = new URLSearchParams();

  if (autoplay) params.set('autoplay', '1');
  if (muted) params.set('mute', '1');
  if (controls) {
    params.set('controls', '1');
  } else {
    params.set('controls', '0');
  }
  if (loop) {
    params.set('loop', '1');
    params.set('playlist', cleanId); // YouTube requirement for single video looping
  }
  if (playsinline) params.set('playsinline', '1');

  // Hero background aesthetic optimizations
  params.set('rel', '0');
  params.set('modestbranding', '1');
  params.set('iv_load_policy', '3'); // Hide video annotations
  params.set('disablekb', '1'); // Disable keyboard controls
  params.set('fs', '0'); // Disable fullscreen button
  params.set('enablejsapi', '1'); // Allow programmatic pause/play

  if (typeof window !== 'undefined' && window.location.origin) {
    params.set('origin', window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${cleanId}?${params.toString()}`;
}

/**
 * Gets high-resolution fallback YouTube thumbnail image URL.
 */
export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' = 'hqdefault'
): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/${quality}.jpg`;
}

/**
 * Safely validates if a URL is a plausible direct video media source (MP4 / WebM / OGG).
 * Rejects non-HTTP schemes, YouTube URLs, and known HTML webpage patterns.
 */
export function isValidDirectMediaUrl(input: string | undefined | null): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;

  // Reject script or dangerous local schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return false;
  }

  // Reject YouTube URLs (these belong in the YouTube embed player layer)
  if (isYouTubeUrl(trimmed)) {
    return false;
  }

  // Must be http, https, blob, or root relative path /
  if (!/^(https?:\/\/|\/|blob:)/i.test(trimmed)) {
    return false;
  }

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const pathname = url.pathname.toLowerCase();
      // Reject obvious webpage extensions
      if (/\.(html?|php|asp|jsp|aspx|cgi|shtml)$/i.test(pathname)) {
        return false;
      }
    }
  } catch {
    return false;
  }

  return true;
}
