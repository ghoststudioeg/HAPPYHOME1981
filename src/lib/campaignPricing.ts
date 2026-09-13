import { HeroBanner, Product, Promotion } from '../types';

export interface EffectivePriceDetails {
  effectivePrice: number;
  originalBasePrice: number;
  isCampaignActive: boolean;
  campaignBanner: HeroBanner | null;
  activePromotion: Promotion | null;
  isFlashSale: boolean;
  flashSaleEndDate?: string;
  badgeText: string | null;
  discountPercent: number | null;
  savingsAmount: number | null;
  campaignEndDate?: string;
  promotionName?: string;
}

/**
 * Checks whether a promotion is currently active based on dates and active status.
 * Automatically handles future promotions (not yet active) and expired promotions.
 */
export function isPromotionActive(promotion: Promotion, targetDate: Date = new Date()): boolean {
  if (!promotion || promotion.isActive === false) return false;

  const now = targetDate.getTime();

  // Start date check (future promotion check)
  if (promotion.startDate) {
    const start = new Date(promotion.startDate).getTime();
    if (!isNaN(start) && now < start) return false;
  }

  // End date check (expiration check)
  if (promotion.endDate) {
    const end = new Date(
      promotion.endDate.includes('T') ? promotion.endDate : `${promotion.endDate}T23:59:59`
    ).getTime();
    if (!isNaN(end) && now > end) return false;
  }

  return true;
}

/**
 * Checks whether a banner campaign is currently active based on dates and active status.
 * Automatically deactivates expired campaigns without requiring manual admin action.
 */
export function isBannerCampaignActive(banner: HeroBanner, targetDate: Date = new Date()): boolean {
  if (!banner || banner.isActive === false) return false;

  const now = targetDate.getTime();

  // Check start date if specified
  const startDateStr = banner.campaignStartDate || banner.startDate;
  if (startDateStr) {
    const start = new Date(startDateStr).getTime();
    if (!isNaN(start) && now < start) return false;
  }

  // Check end date if specified
  const endDateStr = banner.campaignEndDate || banner.endDate;
  if (endDateStr) {
    const end = new Date(endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59`).getTime();
    if (!isNaN(end) && now > end) return false;
  }

  return true;
}

/**
 * Calculates the promotional price of a product based on a Promotion entity.
 * Supports:
 * 1. fixed_price (e.g. exactly 8000 EGP)
 * 2. percentage (e.g. 15% off base price)
 * 3. fixed_discount (e.g. 500 EGP off base price)
 */
export function calculatePromotionalPrice(basePrice: number, promotion: Promotion): number {
  if (!promotion || typeof basePrice !== 'number' || isNaN(basePrice)) return basePrice;

  if (promotion.discountType === 'fixed_price') {
    if (typeof promotion.promotionPrice === 'number' && promotion.promotionPrice > 0) {
      return Math.min(basePrice, promotion.promotionPrice);
    }
  } else if (promotion.discountType === 'percentage') {
    if (typeof promotion.discountPercent === 'number' && promotion.discountPercent > 0) {
      const discount = Math.min(100, Math.max(0, promotion.discountPercent));
      return Math.max(0, Math.round(basePrice * (1 - discount / 100)));
    }
  } else if (promotion.discountType === 'fixed_discount') {
    if (typeof promotion.discountAmount === 'number' && promotion.discountAmount > 0) {
      return Math.max(0, basePrice - promotion.discountAmount);
    }
  }

  // Fallback if promotionPrice is present regardless of type
  if (typeof promotion.promotionPrice === 'number' && promotion.promotionPrice > 0) {
    return Math.min(basePrice, promotion.promotionPrice);
  }

  return basePrice;
}

/**
 * Resolves the single highest-priority active Promotion for a given product.
 * Business Rule: Only ONE effective active promotional price at a time.
 * If multiple active promotions target the same product, resolve using explicit priority
 * (higher priority number = higher precedence), then latest updatedAt.
 * Never randomly picks a price.
 */
export function getActivePromotionForProduct(
  productId: string,
  categoryId?: string,
  promotions: Promotion[] = [],
  now: Date = new Date()
): Promotion | null {
  if (!productId || !promotions || !Array.isArray(promotions)) return null;

  const candidatePromotions = promotions.filter((promo) => {
    // 1. Must be active and unexpired
    if (!isPromotionActive(promo, now)) return false;

    // 2. Must target this product directly or through its category
    const isDirectProduct = Array.isArray(promo.productIds) && promo.productIds.includes(productId);
    const isCategoryProduct =
      Boolean(categoryId) && Array.isArray(promo.categoryIds) && promo.categoryIds.includes(categoryId!);

    return isDirectProduct || isCategoryProduct;
  });

  if (candidatePromotions.length === 0) return null;

  // Sort by priority descending (e.g. 100 is higher priority than 10), then by updatedAt descending
  candidatePromotions.sort((a, b) => {
    const prioA = typeof a.priority === 'number' ? a.priority : 10;
    const prioB = typeof b.priority === 'number' ? b.priority : 10;
    if (prioB !== prioA) return prioB - prioA;

    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  return candidatePromotions[0];
}

/**
 * Resolves the single highest-priority active HeroBanner campaign for a given product.
 */
export function getActiveCampaignForProduct(
  productId: string,
  banners: HeroBanner[] = [],
  now: Date = new Date()
): HeroBanner | null {
  if (!productId || !banners || !Array.isArray(banners)) return null;

  const candidateCampaigns = banners.filter((banner) => {
    if (!isBannerCampaignActive(banner, now)) return false;

    const isTargetProduct =
      (banner.targetType === 'product' || !banner.targetType) &&
      (banner.productId === productId || banner.targetValue === productId || banner.targetId === productId);

    if (!isTargetProduct) return false;

    const hasCampaignPrice =
      typeof banner.campaignPrice === 'number' &&
      !isNaN(banner.campaignPrice) &&
      banner.campaignPrice > 0;

    return hasCampaignPrice;
  });

  if (candidateCampaigns.length === 0) return null;

  candidateCampaigns.sort((a, b) => {
    const orderA = a.sortOrder !== undefined ? a.sortOrder : 999;
    const orderB = b.sortOrder !== undefined ? b.sortOrder : 999;
    if (orderA !== orderB) return orderA - orderB;

    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  return candidateCampaigns[0];
}

/**
 * Calculates the effective customer-facing selling price of a product,
 * respecting active centralized Promotions and HeroBanner campaigns without EVER
 * modifying or permanently overwriting the base product.price in storage.
 *
 * Example:
 * basePrice = 8500
 * campaignPrice / promotionPrice = 8000
 * effectivePrice = 8000
 * product.price remains 8500 in database!
 */
export function getEffectiveProductPrice(
  product: Product,
  activeBanners: HeroBanner[] = [],
  activePromotions: Promotion[] = [],
  now: Date = new Date()
): EffectivePriceDetails {
  if (!product) {
    return {
      effectivePrice: 0,
      originalBasePrice: 0,
      isCampaignActive: false,
      campaignBanner: null,
      activePromotion: null,
      isFlashSale: false,
      badgeText: null,
      discountPercent: null,
      savingsAmount: null
    };
  }

  const basePrice = product.price;

  // 1. Check for active promotion
  const promotion = getActivePromotionForProduct(product.id, product.categoryId, activePromotions, now);

  // 2. Check for active banner campaign
  const campaignBanner = getActiveCampaignForProduct(product.id, activeBanners, now);

  // Resolve between promotion and banner campaign
  if (promotion) {
    const calculatedPromoPrice = calculatePromotionalPrice(basePrice, promotion);

    // If banner points to this promotion or product, ensure synchronized price
    if (calculatedPromoPrice < basePrice) {
      const savingsAmount = basePrice - calculatedPromoPrice;
      const discountPercent = Math.round((savingsAmount / basePrice) * 100);
      const isFlashSale = Boolean(promotion.isFlashSale);
      const badgeText = promotion.badgeText || (isFlashSale ? 'عرض لفترة محدودة' : 'سعر العرض');

      return {
        effectivePrice: calculatedPromoPrice,
        originalBasePrice: basePrice,
        isCampaignActive: true,
        campaignBanner: campaignBanner || null,
        activePromotion: promotion,
        isFlashSale,
        flashSaleEndDate: isFlashSale ? promotion.endDate : undefined,
        badgeText,
        discountPercent,
        savingsAmount,
        campaignEndDate: promotion.endDate,
        promotionName: promotion.name
      };
    }
  }

  // Fallback to active banner campaign if no promotion or promotion didn't discount
  if (campaignBanner && campaignBanner.campaignPrice && campaignBanner.campaignPrice > 0) {
    const bannerPrice = campaignBanner.campaignPrice;
    if (bannerPrice < basePrice) {
      const savingsAmount = basePrice - bannerPrice;
      const discountPercent = Math.round((savingsAmount / basePrice) * 100);

      return {
        effectivePrice: bannerPrice,
        originalBasePrice: basePrice,
        isCampaignActive: true,
        campaignBanner,
        activePromotion: null,
        isFlashSale: false,
        badgeText: campaignBanner.badgeText || 'عرض ترويجي',
        discountPercent,
        savingsAmount,
        campaignEndDate: campaignBanner.campaignEndDate || campaignBanner.endDate,
        promotionName: campaignBanner.title
      };
    }
  }

  // Normal product pricing without active promotions or banner campaigns
  const hasBaseDiscount = Boolean(product.oldPrice && product.oldPrice > product.price);
  return {
    effectivePrice: product.price,
    originalBasePrice: product.oldPrice || product.price,
    isCampaignActive: false,
    campaignBanner: null,
    activePromotion: null,
    isFlashSale: false,
    badgeText: null,
    discountPercent: hasBaseDiscount
      ? Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)
      : null,
    savingsAmount: hasBaseDiscount ? product.oldPrice! - product.price : null
  };
}
