export * from './types/installment';
import { ProductInstallmentConfig } from './types/installment';

export interface CategoryHero {
  enabled: boolean;
  desktopImageUrl?: string;
  mobileImageUrl?: string;
  imageSizeMode?: 'contain' | 'cover';
  title?: string;
  subtitle?: string;
  badgeText?: string;
  ctaText?: string;
  ctaType?: 'whatsapp' | 'product_page' | 'category_filter' | 'custom_link';
  ctaLink?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  visibility: boolean;
  sortOrder: number;
  parentId?: string | null;
  hero?: CategoryHero;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSpecifications {
  ram?: string;
  storage?: string;
  processor?: string;
  rearCamera?: string;
  frontCamera?: string;
  battery?: string;
  chargingSpeed?: string;
  fingerprint?: string;
  screen?: string;
  network?: string;
  os?: string;
  [key: string]: string | undefined;
}

export interface ProductColor {
  name: string;
  hex?: string;
  imageUrl?: string;
  active?: boolean;
  sku?: string;
  stockQuantity?: number;
  price?: number;
  oldPrice?: number;
}

export interface ProductColorVariant {
  id?: string;
  colorName: string;
  colorCode?: string;
  mainImage: string | null;
  images: string[];
  sku?: string;
  stockQuantity?: number;
  price?: number;
  oldPrice?: number;
  active?: boolean;
  // Legacy read compatibility aliases:
  name?: string;
  hex?: string;
  imageUrl?: string;
}

export interface ProductGallerySettings {
  autoSlideEnabled?: boolean;
  autoSlideInterval?: number;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'coming_soon';

export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName?: string;
  sku: string;
  price: number;
  oldPrice?: number | null;
  description: string;
  features: string[];
  
  // Canonical Color & Image Model
  colorVariants?: ProductColorVariant[];

  // Global / Fallback images (used for cards, search, and products without variants)
  mainImageUrl?: string;
  additionalImages?: string[];

  // Legacy fields (READ-ONLY compatibility, not written to Firestore):
  colors?: ProductColorVariant[];
  variants?: ProductColorVariant[];
  colorImageMap?: Record<string, string[]>;
  imageColorMap?: Record<string, string>;

  specifications?: ProductSpecifications;
  gallerySettings?: ProductGallerySettings;
  isAvailable: boolean;
  isFeatured: boolean;
  isPublished: boolean;
  stockQuantity: number;
  lowStockThreshold?: number;
  stockStatus?: StockStatus;
  trackInventory?: boolean;
  showExactStockToCustomer?: boolean;
  sortOrder: number;
  whatsappClicks?: number;
  averageRating?: number;
  reviewCount?: number;
  installmentConfig?: ProductInstallmentConfig;
  companyId?: string;
  isDeleted?: boolean;
  viewsCount?: number;
  purchasesCount?: number;
  ratingAverage?: number;
  reviewsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export interface Review {
  reviewId: string;
  productId: string;
  productName?: string;
  customerUid: string;
  customerName: string;
  customerPhotoURL?: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  isApproved?: boolean; // compatibility
  createdAt: string;
  updatedAt: string;
  id?: string; // compatibility
}

export type ProductReview = Review;

export interface WhatsAppNotificationToggles {
  NEW_ORDER: boolean;
  ORDER_STATUS_CHANGED: boolean;
  ORDER_CANCELLED: boolean;
  NEW_CUSTOMER: boolean;
  LOW_STOCK: boolean;
  OUT_OF_STOCK: boolean;
  RESTOCKED: boolean;
  COUPON_USED: boolean;
  SYSTEM_ERROR: boolean;
  HERO_BANNER_CHANGED: boolean;
  OTHER?: boolean;
}

export interface StoreSettings {
  storeName: string;
  logoUrl: string;
  lightLogoUrl?: string;
  darkLogoUrl?: string;
  whatsappNumber: string;
  phone: string;
  facebookUrl: string;
  instagramUrl: string;
  address: string;
  workingHours: string;
  heroTitle: string;
  heroSubtitle: string;
  tagline?: string;
  galleryAutoSlideEnabled?: boolean;
  galleryAutoSlideInterval?: number;
  
  // WhatsApp & Admin Notification Settings
  whatsappNotificationsEnabled?: boolean;
  whatsappRecipientPhone?: string;
  whatsappToggles?: WhatsAppNotificationToggles;
  lowStockThreshold?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
}

export interface ProductFilterOptions {
  searchQuery?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'featured';
}

export type PromotionDiscountType = 'fixed_price' | 'percentage' | 'fixed_discount';

export interface Promotion {
  id: string;
  name: string; // Campaign title (e.g. "تخفيضات العيد", "فلاش سيل الجمعة")
  description?: string;
  productIds: string[]; // Specific target product IDs
  categoryIds?: string[]; // Optional target category IDs
  discountType: PromotionDiscountType;
  promotionPrice?: number; // Used for fixed_price (e.g. 8000 EGP)
  discountPercent?: number; // Used for percentage (e.g. 15%)
  discountAmount?: number; // Used for fixed_discount (e.g. 500 EGP off)
  startDate: string; // YYYY-MM-DDTHH:mm or ISO string
  endDate: string; // YYYY-MM-DDTHH:mm or ISO string
  isActive: boolean; // Active toggle
  priority: number; // Higher number = higher precedence during conflicts (e.g. 100 > 10 > 1)
  isFlashSale: boolean; // Flag to activate Flash Sale countdown "عرض لفترة محدودة"
  badgeText?: string; // Optional custom badge (defaults to "عرض لفترة محدودة" or "سعر العرض")
  bannerId?: string; // Linked HeroBanner ID if synchronized
  createdAt?: string;
  updatedAt?: string;
}

export interface LimitedOffer {
  id: string;
  productId: string;
  productName: string;
  productSlug?: string;
  productImage?: string;
  productDescription?: string;
  originalPrice: number;
  offerPrice: number;
  discountPercent: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComingSoonItem {
  id: string;
  productId?: string;
  name: string;
  image: string;
  shortDescription: string;
  expectedDate?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomepageSettings {
  newArrivalsEnabled: boolean;
  newArrivalsLimit: number;
  limitedOffersEnabled: boolean;
  comingSoonEnabled: boolean;
  categoriesEnabled: boolean;
  newsTickerEnabled?: boolean;
  newsTickerSpeed?: number;
  newsTickerDirection?: 'rtl' | 'ltr';
  newsTickerBgStyle?: 'dark' | 'gold' | 'emerald';
  heroBannersEnabled?: boolean;
  heroSlideIntervalSeconds?: number;
  updatedAt?: string;
}

export interface NewsTickerItem {
  id: string;
  text: string;
  type: 'offer' | 'news' | 'new_arrival' | 'alert' | 'custom';
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  link?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type HeroTargetType = 'product' | 'category' | 'page' | 'offer' | 'external' | 'bundle' | 'bundle_offer' | 'none' | 'link';

export type BannerPlacement =
  | 'home_hero'
  | 'home_promo'
  | 'category_all'
  | 'category_specific'
  | 'product_all'
  | 'product_specific'
  | 'offers_page'
  | 'catalog_page'
  | 'custom_section';

export type BannerMediaType = 'image' | 'video';
export type BannerVideoSource = 'direct' | 'youtube';

export interface HeroBanner {
  id: string;
  title: string; // Internal name / Accessible label
  mediaType?: BannerMediaType;
  videoSource?: BannerVideoSource; // 'direct' (MP4/WebM) or 'youtube'
  videoUrl?: string; // Direct HTTPS playable video URL (MP4 / WebM) or YouTube URL
  youtubeVideoId?: string; // Extracted 11-char YouTube video ID
  mobileVideoUrl?: string; // Optional mobile-specific direct video URL or YouTube URL
  mobileYoutubeVideoId?: string; // Extracted 11-char mobile YouTube video ID
  posterImageUrl?: string; // Fallback / preload poster image for desktop
  mobilePosterImageUrl?: string; // Fallback / preload poster image for mobile
  targetType?: HeroTargetType;
  targetValue?: string; // productId, categoryId, internal route path, or external URL
  targetId?: string; // alias/sync for targetValue
  targetUrl?: string; // alias/sync for external/page
  placements?: (BannerPlacement | string)[];
  specificCategoryId?: string;
  specificProductId?: string;
  promotionId?: string; // Optional linked promotion ID to automatically synchronize promotional campaign pricing
  campaignPrice?: number; // Promotional campaign price for linked product (does not mutate base product.price)
  campaignStartDate?: string;
  campaignEndDate?: string;
  displayDuration?: number; // Duration in seconds (e.g. 5)
  subtitle?: string;
  badgeText?: string;
  badgeType?: 'gold' | 'red' | 'emerald' | 'blue';
  desktopImageUrl?: string;
  mobileImageUrl?: string;
  backgroundImageUrl?: string;
  productImageUrl?: string;
  imageSizeMode?: 'contain' | 'cover';
  productId?: string;
  productSlug?: string;
  price?: number;
  oldPrice?: number;
  discountPercent?: number;
  ctaText?: string;
  ctaType?: 'whatsapp' | 'product_page' | 'custom_link';
  ctaLink?: string;
  isActive: boolean;
  sortOrder: number;
  startDate?: string;
  endDate?: string;
  showOnHome?: boolean;
  showOnCatalog?: boolean;
  categoryIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'customer' | 'admin';

export interface UserProfileData {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  phone?: string;
  address?: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserFavoriteItem {
  id: string; // productId
  productId: string;
  productName: string;
  productImage?: string;
  price: number;
  oldPrice?: number;
  categoryName?: string;
  slug: string;
  addedAt: string;
  groupName?: string; // e.g. 'أدوات المطبخ', 'هدايا للمستقبل'
  userUid?: string;
  user_uid?: string;
}

export interface WishlistGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt?: string;
}

export interface RecentlyViewedItem {
  id: string; // productId
  productId: string;
  productName: string;
  productImage?: string;
  price: number;
  oldPrice?: number;
  categoryName?: string;
  slug: string;
  viewedAt: string;
  userUid?: string;
  user_uid?: string;
}

export interface BundleInstallmentPlan {
  providerId?: string;
  providerName?: string;
  months: number; // e.g. 12
  monthlyPayment: number; // e.g. 150 EGP
  downPayment: number; // e.g. 0 EGP or 500 EGP
  totalAmount?: number; // e.g. 1800 EGP
  interestRate?: number;
  adminFees?: number;
  notes?: string;
  isDefault?: boolean;
}

export interface BundleOffer {
  id: string; // e.g. 'sa3a-samaha-2in1'
  name: string; // e.g. "ساعة + سماعة"
  slug: string; // e.g. "sa3a-samaha-2in1"
  description: string;
  badgeText?: string; // e.g. "2 في 1" أو "عرض التوفير"
  imageUrl: string; // Supabase Storage public URL
  productIds: string[]; // Reference array of product IDs in Firestore (no duplicate product data!)
  hasSpecialPrice?: boolean;
  bundlePrice: number; // Final special bundle offer price
  originalTotalPrice?: number; // Sum of individual product prices
  installmentEnabled: boolean;
  installmentHeadline?: string; // e.g. "150 جنيه شهريًا"
  installmentPlans?: BundleInstallmentPlan[];
  defaultPlan?: BundleInstallmentPlan;
  isActive: boolean;
  startAt?: string;
  endAt?: string;
  viewsCount?: number;
  clicksCount?: number;
  purchasesCount?: number;
  sortOrder?: number;
  showOnHome?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserCartItem {
  id: string; // productId or bundleId
  productId: string;
  quantity: number;
  addedAt: string;
  updatedAt: string;
  bundleId?: string;
  isBundle?: boolean;
  bundlePrice?: number;
  selectedInstallmentPlan?: BundleInstallmentPlan;
}

export interface ResolvedCartItem {
  id: string; // productId or bundleId
  productId: string;
  quantity: number;
  addedAt: string;
  updatedAt: string;
  product: Product;
  bundleId?: string;
  isBundle?: boolean;
  bundle?: BundleOffer;
  bundlePrice?: number;
  bundleProducts?: Product[];
  selectedInstallmentPlan?: BundleInstallmentPlan;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  priceAtPurchase: number;
  quantity: number;
  lineTotal: number;
  bundleId?: string;
  bundleName?: string;
  isBundle?: boolean;
  bundleItems?: Array<{
    productId: string;
    productName: string;
    productImage?: string;
    originalPrice: number;
    sku?: string;
  }>;
  installmentPlan?: BundleInstallmentPlan;
}

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled';

export type CouponType = 'percentage' | 'fixed_amount';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minimumOrder?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  perCustomerLimit?: number;
  startAt?: string;
  expiresAt?: string;
  active: boolean;
  applicableProductIds: string[];
  applicableCategoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsEventType = 
  | 'product_view' 
  | 'category_view' 
  | 'search' 
  | 'favorite_added' 
  | 'favorite_removed' 
  | 'cart_added' 
  | 'cart_removed' 
  | 'checkout_started' 
  | 'order_created' 
  | 'order_delivered' 
  | 'order_cancelled' 
  | 'whatsapp_clicked' 
  | 'coupon_used';

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  productId?: string;
  categoryId?: string;
  userUid?: string;
  sessionId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface OrderStatusHistoryEvent {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  updatedBy?: string;
}

export interface Order {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceStatus?: 'issued' | 'cancelled' | 'draft';
  invoiceCreatedAt?: string;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  customerNotes?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  selectedInsurance?: import('./types/insurance').SelectedInsuranceSnapshot;
  total: number;
  couponCode?: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: OrderStatus;
  stockDeducted?: boolean;
  stockRestored?: boolean;
  statusHistory?: OrderStatusHistoryEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  addressId?: string;
  label: string;
  recipientName: string;
  phone: string;
  governorate: string;
  area: string;
  street: string;
  building: string;
  apartment: string;
  floor: string;
  notes?: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type NotificationType = 
  | 'order_created' 
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready_to_ship'
  | 'order_shipped' 
  | 'order_delivered' 
  | 'order_cancelled' 
  | 'order_status_changed'
  | 'payment_received'
  | 'payment_pending'
  | 'payment_failed'
  | 'product_back_in_stock' 
  | 'favorite_product_discount' 
  | 'favorite_price_drop'
  | 'offer_expiring'
  | 'coupon' 
  | 'admin_announcement';
export type RelatedType = 'order' | 'product' | 'promotion' | 'system' | 'customer' | 'coupon' | 'hero';

export interface Notification {
  notificationId: string;
  id?: string;
  userUid?: string;
  user_uid?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedId?: string;
  relatedType?: RelatedType;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  target: 'all' | 'selected';
  selectedUserIds?: string[];
  status: 'sent' | 'scheduled';
  createdAt: string;
}

export type StoreEventType =
  | 'NEW_ORDER'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_CANCELLED'
  | 'NEW_CUSTOMER'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'RESTOCKED'
  | 'COUPON_USED'
  | 'SYSTEM_ERROR'
  | 'HERO_BANNER_CHANGED'
  | 'OTHER';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type WhatsAppDeliveryStatus = 'not_configured' | 'pending' | 'sent' | 'failed' | 'disabled';

export interface AdminStoreNotification {
  id: string;
  eventType: StoreEventType;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: 'order' | 'product' | 'customer' | 'coupon' | 'hero' | 'system';
  createdAt: string;
  read: boolean;
  priority: NotificationPriority;
  whatsappStatus?: WhatsAppDeliveryStatus;
  whatsappError?: string;
  payload?: Record<string, any>;
}

export type InventoryAdjustmentReason =
  | 'order_created'
  | 'order_cancelled'
  | 'manual_adjustment'
  | 'restock'
  | 'damage_loss'
  | 'return_restock'
  | 'initial_stock'
  | 'inventory_audit';

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  change: number; // e.g., -2, +15, -1
  previousStock: number;
  newStock: number;
  reason: InventoryAdjustmentReason;
  referenceId?: string; // Order ID or adjustment reference
  note?: string;
  adjustedBy?: string;
  timestamp: string;
}

export interface InventorySummary {
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  comingSoonCount: number;
  totalStockUnits: number;
}

export type AuditEntityType =
  | 'product'
  | 'category'
  | 'order'
  | 'promotion'
  | 'banner'
  | 'coupon'
  | 'settings';

export type AuditAction =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_EDITED'
  | 'PRODUCT_DELETED'
  | 'PRODUCT_PUBLISHED_TOGGLED'
  | 'PRODUCT_PRICE_CHANGED'
  | 'PRODUCT_STOCK_CHANGED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_EDITED'
  | 'CATEGORY_DELETED'
  | 'BANNER_CREATED'
  | 'BANNER_EDITED'
  | 'BANNER_DELETED'
  | 'PROMOTION_CREATED'
  | 'PROMOTION_EDITED'
  | 'PROMOTION_DELETED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_PAYMENT_CONFIRMED'
  | 'COUPON_CREATED'
  | 'COUPON_EDITED'
  | 'COUPON_DELETED'
  | 'SETTINGS_CHANGED';

export interface AuditLogEntry {
  id: string;
  eventId: string;
  adminUid: string;
  adminEmail: string;
  adminName?: string;
  action: AuditAction | string;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  timestamp: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  summary: string;
}

export interface AuditLogFilters {
  entityType?: AuditEntityType | 'all';
  action?: string | 'all';
  adminEmail?: string | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
}

export * from './types/insurance';

export type CompanyClickAction = 'company_page' | 'external_url' | 'category' | 'product';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
  clickAction?: CompanyClickAction;
  targetValue?: string;
  sortOrder?: number;
  featuredOnHome?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

import { FinancingProvider, InstallmentPlan } from './types/installment';
export type InstallmentProvider = FinancingProvider;
export type { InstallmentPlan };
export type AuditLog = AuditLogEntry;


