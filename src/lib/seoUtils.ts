import { Product, Category } from '../types';

/**
 * Converts any text (Arabic, English, numbers) into a clean, URL-safe slug.
 * Removes special characters and duplicate hyphens.
 */
export function normalizeSlug(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns a stable, clean, human-readable slug for a product.
 * Strips legacy temporary or random timestamp suffixes like -3128 or -1525 if present.
 */
export function getProductCanonicalSlug(product: { name: string; slug?: string; id?: string }): string {
  if (!product) return '';
  
  // If product already has a slug
  if (product.slug) {
    const trimmed = product.slug.trim();
    // Check if ends with random 3 to 6 digits timestamp (e.g. -3128)
    const stripped = trimmed.replace(/-\d{3,6}$/, '');
    if (stripped && stripped.length > 2) {
      return normalizeSlug(stripped);
    }
    return normalizeSlug(trimmed);
  }

  // Fallback to normalized product name
  if (product.name) {
    const fromName = normalizeSlug(product.name);
    if (fromName) return fromName;
  }

  return product.id || '';
}

/**
 * Generates the stable canonical URL for a product.
 */
export function getProductCanonicalUrl(
  product: { name: string; slug?: string; id?: string },
  origin?: string
): string {
  const slug = getProductCanonicalSlug(product);
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/product/${slug}`;
}

/**
 * Returns a stable, clean slug for a category.
 */
export function getCategoryCanonicalSlug(category: { name: string; slug?: string; id?: string }): string {
  if (!category) return '';
  if (category.slug) {
    return normalizeSlug(category.slug);
  }
  if (category.name) {
    return normalizeSlug(category.name);
  }
  return category.id || '';
}

/**
 * Generates the stable canonical URL for a category.
 */
export function getCategoryCanonicalUrl(
  category: { name: string; slug?: string; id?: string },
  origin?: string
): string {
  const slug = getCategoryCanonicalSlug(category);
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/category/${slug}`;
}

/**
 * Builds standard social sharing content for a product.
 * Formats price with currency and indicates promotional price when active.
 */
export function buildProductShareData(params: {
  product: Product;
  effectivePrice: number;
  isCampaignActive?: boolean;
  storeName?: string;
  origin?: string;
}) {
  const { product, effectivePrice, isCampaignActive, storeName = 'متجر البيت السعيد 1981', origin } = params;
  const canonicalUrl = getProductCanonicalUrl(product, origin);
  const priceFormatted = `${effectivePrice.toLocaleString('ar-EG')} ج.م${isCampaignActive ? ' (عرض ترويجي)' : ''}`;
  
  // Clean short description (max 140 chars)
  const shortDescription = product.description 
    ? product.description.replace(/\s+/g, ' ').trim().slice(0, 140)
    : '';

  // Plain text summary (ideal for Web Share API)
  const shareText = `شاهد ${product.name} في ${storeName}\nالسعر: ${priceFormatted}${shortDescription ? `\n${shortDescription}` : ''}`;

  // WhatsApp formatted text with bold markdown
  const whatsappText = `*${product.name}*\n` +
    `💰 *السعر:* ${priceFormatted}\n` +
    (shortDescription ? `📝 ${shortDescription}\n` : '') +
    `\n🔗 *رابط المنتج:*\n${canonicalUrl}`;

  // Standard WhatsApp Web / App share URL (URL-based, no Business API)
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

  return {
    title: product.name,
    text: shareText,
    whatsappText,
    whatsappUrl,
    url: canonicalUrl,
    priceFormatted,
    shortDescription
  };
}
