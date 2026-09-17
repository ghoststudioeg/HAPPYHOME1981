import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { productService } from '../lib/data/productService';
import { categoryService } from '../lib/data/categoryService';
import { settingsService } from '../lib/data/settingsService';
import { catalogService } from '../lib/data/catalogService';
import { homepageService } from '../lib/data/homepageService';
import { promotionService } from '../lib/data/promotionService';
import { getEffectiveProductPrice, EffectivePriceDetails } from '../lib/campaignPricing';
import { Product, Category, StoreSettings, ProductSpecifications, ProductColor, ProductColorVariant, HeroBanner, Promotion } from '../types';
import { ProductColorSelector } from '../components/product/ProductColorSelector';
import { ProductReviewsSection } from '../components/product/ProductReviewsSection';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { getRecommendedProducts } from '../lib/recommendations';
import { RecommendedProductsSection } from '../components/product/RecommendedProductsSection';
import { RecentlyViewedSection } from '../components/product/RecentlyViewedSection';
import { recentlyViewedService } from '../lib/data/recentlyViewedService';
import { ProductComparisonModal } from '../components/comparison/ProductComparisonModal';
import { ProductGallery } from '../components/product/ProductGallery';
import { FlashSaleCountdown } from '../components/FlashSaleCountdown';
import {
  MessageCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Share2,
  ArrowLeft,
  Tag,
  Cpu,
  HardDrive,
  Camera,
  ScanFace,
  Battery,
  Zap,
  Fingerprint,
  Smartphone,
  Wifi,
  Layers,
  Scale,
  Palette,
  Heart,
  ShoppingCart,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Info,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { analyticsService } from '../lib/data/analyticsService';
import { SEO } from '../components/SEO';
import { NotFoundPage } from './NotFoundPage';
import { ProductShareModal } from '../components/product/ProductShareModal';
import { getProductCanonicalSlug, getProductCanonicalUrl, buildProductShareData } from '../lib/seoUtils';
import { installmentService } from '../lib/data/installmentService';
import { FinancingProvider, InstallmentPlan } from '../types/installment';
import { InstallmentProductBadge } from '../components/installments/InstallmentProductBadge';
import { InstallmentModal } from '../components/installments/InstallmentModal';
import { ProductPdfInquiryModal } from '../components/product/ProductPdfInquiryModal';
import { insuranceService } from '../lib/data/insuranceService';
import { InsurancePolicy } from '../types/insurance';
import { InsuranceProductBadge } from '../components/insurance/InsuranceProductBadge';
import { InsuranceModal } from '../components/insurance/InsuranceModal';

interface ProductDetailPageProps {
  slug: string;
  navigate: (path: string) => void;
}

interface SpecItemConfig {
  key: keyof ProductSpecifications;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MOBILE_SPEC_CONFIG: SpecItemConfig[] = [
  { key: 'ram', label: 'الرام', icon: Cpu },
  { key: 'storage', label: 'المساحة الداخلية', icon: HardDrive },
  { key: 'processor', label: 'المعالج', icon: Cpu },
  { key: 'rearCamera', label: 'الكاميرا الخلفية', icon: Camera },
  { key: 'frontCamera', label: 'الكاميرا الأمامية', icon: ScanFace },
  { key: 'battery', label: 'البطارية', icon: Battery },
  { key: 'chargingSpeed', label: 'سرعة الشحن', icon: Zap },
  { key: 'fingerprint', label: 'البصمة', icon: Fingerprint },
  { key: 'screen', label: 'الشاشة', icon: Smartphone },
  { key: 'network', label: 'الشبكة', icon: Wifi },
  { key: 'os', label: 'نظام التشغيل', icon: Layers }
];

export function ProductDetailPage({ slug, navigate }: ProductDetailPageProps) {
  const { user, isFavorite, toggleFavorite, addToCart } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [resolvedCategory, setResolvedCategory] = useState<Category | null>(null);
  const [categoryStatus, setCategoryStatus] = useState<'loading' | 'found' | 'missing' | 'none'>('loading');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeBanners, setActiveBanners] = useState<HeroBanner[]>([]);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductColorVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Comparison Modal State
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  // Product Details PDF Inquiry Modal State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [comparisonTargetProduct, setComparisonTargetProduct] = useState<Product | null>(null);

  // Installment State
  const [installmentProviders, setInstallmentProviders] = useState<FinancingProvider[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [selectedInstallmentProviderId, setSelectedInstallmentProviderId] = useState<string | undefined>(undefined);

  // Fawry Insurance State
  const [insurancePolicies, setInsurancePolicies] = useState<InsurancePolicy[]>([]);
  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [selectedInsurancePolicy, setSelectedInsurancePolicy] = useState<InsurancePolicy | null>(null);

  // Temporary Diagnostic Debug State
  const [debugInfo, setDebugInfo] = useState<{
    receivedIdentifier: string;
    pathname: string;
    queryExecuted: string;
    firebaseResponse: string;
    finalErrorMessage: string | null;
    timestamp: string;
  } | null>(null);

  const favorited = product ? isFavorite(product.id) : false;

  const handleSelectColor = (col: any) => {
    setSelectedVariant(col);
    setSelectedColor(col);
  };

  const { activeMainImage, activeGalleryImages } = useMemo(() => {
    if (!product) {
      return { activeMainImage: undefined, activeGalleryImages: [] };
    }

    const colorName = selectedVariant?.colorName || selectedVariant?.name || selectedColor?.name || (selectedColor as any)?.colorName;

    if (colorName) {
      // Collect images explicitly belonging to this color
      let colorImages: string[] = [];

      // A) Variant explicit images
      let variantMainImage: string | undefined = undefined;
      if (selectedVariant) {
        const rawMain = selectedVariant.mainImage || (selectedVariant as any).imageUrl;
        variantMainImage = getValidImageSrc(rawMain);
        if (selectedVariant.images && selectedVariant.images.length > 0) {
          colorImages.push(...selectedVariant.images);
        }
      }

      // B) colorImageMap for this color
      if (product.colorImageMap && product.colorImageMap[colorName]) {
        colorImages.push(...product.colorImageMap[colorName]);
      }

      // C) imageColorMap check across main & additional images
      if (product.imageColorMap) {
        const mappedUrls = Object.entries(product.imageColorMap)
          .filter(([_, col]) => col === colorName)
          .map(([url]) => url);
        colorImages.push(...mappedUrls);
      }

      // Deduplicate images while maintaining order, and filter using isValidImageSrc
      let uniqueColorImages = Array.from(
        new Set(colorImages.filter(isValidImageSrc))
      );

      // Ensure variantMainImage is placed at the front of uniqueColorImages if it exists
      if (variantMainImage) {
        if (!uniqueColorImages.includes(variantMainImage)) {
          uniqueColorImages.unshift(variantMainImage);
        } else {
          uniqueColorImages = [variantMainImage, ...uniqueColorImages.filter(img => img !== variantMainImage)];
        }
      }

      if (uniqueColorImages.length > 0) {
        return {
          activeMainImage: variantMainImage || uniqueColorImages[0],
          activeGalleryImages: uniqueColorImages
        };
      }
    }

    // Fallback for products without variants or colors
    const defaultList = Array.from(
      new Set(
        [
          ...(product.mainImageUrl ? [product.mainImageUrl] : []),
          ...(product.additionalImages || [])
        ].filter(isValidImageSrc)
      )
    );

    return {
      activeMainImage: getValidImageSrc(product.mainImageUrl) || (defaultList.length > 0 ? defaultList[0] : undefined),
      activeGalleryImages: defaultList
    };
  }, [product, selectedVariant, selectedColor]);

  const loadData = async () => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    console.log('[ProductDetailPage Debug] === LOAD DATA STARTED ===');
    console.log('[ProductDetailPage Debug] 1. URL Identifier:', {
      pathname: currentPath,
      param: slug,
      decodedValue: decodeURIComponent(slug || '')
    });

    try {
      setLoading(true);
      setError(null);
      setResolvedCategory(null);
      setCategoryStatus('loading');

      const queryDescription = `productService.getProductBySlug("${slug}") & getAllProducts(false) [collection: 'products', filter: 'isPublished == true']`;
      console.log('[ProductDetailPage Debug] 2. Query Executed:', queryDescription);

      const [prod, setts, prods, banners, promos, instProviders, instPlans, insPolicies] = await Promise.all([
        productService.getProductBySlug(slug),
        settingsService.getSettings(),
        productService.getAllProducts(false),
        homepageService.getActiveBanners().catch(() => []),
        promotionService.getActivePromotions().catch(() => []),
        installmentService.getProviders().catch(() => []),
        installmentService.getPlans().catch(() => []),
        insuranceService.getPolicies().catch(() => [])
      ]);

      console.log('[ProductDetailPage Debug] 3. Firebase Response:', {
        status: prod ? 'Product Document Found' : 'Product Document Not Found',
        id: prod?.id,
        slug: prod?.slug,
        name: prod?.name,
        isPublished: prod?.isPublished,
        dataKeys: prod ? Object.keys(prod) : []
      });

      if (!prod) {
        console.warn('[ProductDetailPage Debug] Product not found in Firestore for slug/id:', slug);
        setDebugInfo({
          receivedIdentifier: slug,
          pathname: currentPath,
          queryExecuted: queryDescription,
          firebaseResponse: 'Document not found (null returned from query)',
          finalErrorMessage: 'لم يتم العثور على المنتج المطلوب في قاعدة البيانات.',
          timestamp: new Date().toLocaleTimeString()
        });
        setError('product_not_found');
        setLoading(false);
        return;
      }

      setDebugInfo({
        receivedIdentifier: slug,
        pathname: currentPath,
        queryExecuted: queryDescription,
        firebaseResponse: `Success: Document found (id: ${prod.id}, name: "${prod.name}", isPublished: ${prod.isPublished}, totalKeys: ${Object.keys(prod).length})`,
        finalErrorMessage: null,
        timestamp: new Date().toLocaleTimeString()
      });

      setProduct(prod);
      setSettings(setts);
      setAllProducts(prods || []);
      setActiveBanners(banners || []);
      setActivePromotions(promos || []);
      setInstallmentProviders(instProviders || []);
      setInstallmentPlans(instPlans || []);
      setInsurancePolicies(insPolicies || []);

      // Set default color / variant if available
      const variantList = prod.variants || prod.colorVariants;
      if (variantList && variantList.length > 0) {
        const firstActive = variantList.find((v) => v.active !== false) || variantList[0];
        setSelectedVariant(firstActive);
        setSelectedColor(firstActive as any);
      } else if (prod.colors && prod.colors.length > 0) {
        const firstCol = prod.colors.find((c) => c.active !== false) || prod.colors[0];
        setSelectedColor(firstCol as any);
        setSelectedVariant(null);
      } else {
        setSelectedVariant(null);
        setSelectedColor(null);
      }

      const catId = prod.categoryId?.trim();
      const catName = prod.categoryName?.trim();

      if (catId) {
        const cat = await categoryService.getCategoryByIdOrSlug(catId);
        if (cat) {
          setResolvedCategory(cat);
          setCategoryStatus('found');
        } else if (catName) {
          const catByName = await categoryService.getCategoryByIdOrSlug(catName);
          if (catByName) {
            setResolvedCategory(catByName);
            setCategoryStatus('found');
          } else {
            setCategoryStatus('missing');
          }
        } else {
          setCategoryStatus('missing');
        }
      } else if (catName) {
        const catByName = await categoryService.getCategoryByIdOrSlug(catName);
        if (catByName) {
          setResolvedCategory(catByName);
          setCategoryStatus('found');
        } else {
          setCategoryStatus('missing');
        }
      } else {
        setCategoryStatus('none');
      }
    } catch (err: any) {
      console.error('[ProductDetailPage Debug] Failed to load product details:', err);
      const errMsg = err?.message || String(err);
      setDebugInfo({
        receivedIdentifier: slug,
        pathname: currentPath,
        queryExecuted: `productService.getProductBySlug("${slug}") & Firestore queries`,
        firebaseResponse: `Error: ${errMsg}`,
        finalErrorMessage: errMsg,
        timestamp: new Date().toLocaleTimeString()
      });
      setError('حدث خطأ أثناء تحميل بيانات المنتج من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (product && settings) {
      const pageTitle = `${product.name} | ${settings.storeName}`;
      const pageDesc = product.description.slice(0, 160);
      const pageImage = product.mainImageUrl || '/logo-square.svg';
      const pageUrl = window.location.href;

      document.title = pageTitle;
      
      const updateMeta = (selector: string, content: string) => {
        let el = document.querySelector(selector);
        if (el) {
          el.setAttribute('content', content);
        } else {
          const meta = document.createElement('meta');
          if (selector.startsWith('meta[name')) {
            meta.setAttribute('name', selector.split('"')[1]);
          } else if (selector.startsWith('meta[property')) {
            meta.setAttribute('property', selector.split('"')[1]);
          }
          meta.setAttribute('content', content);
          document.head.appendChild(meta);
        }
      };

      updateMeta('meta[name="description"]', pageDesc);
      updateMeta('meta[property="og:title"]', pageTitle);
      updateMeta('meta[property="og:description"]', pageDesc);
      updateMeta('meta[property="og:image"]', pageImage);
      updateMeta('meta[property="og:url"]', pageUrl);
    }
  }, [product, settings]);

  useEffect(() => {
    loadData();
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (product?.id) {
      analyticsService.trackEvent('product_view', {
        productId: product.id,
        categoryId: product.categoryId,
        userUid: user?.uid
      });

      // Record recently viewed product view on actual product page visit
      recentlyViewedService.recordProductView(product, user?.uid).catch(err => {
        console.warn('Could not record recently viewed product:', err);
      });
    }
  }, [product?.id, user?.uid]);

  const effectiveProductForPricing = useMemo(() => {
    if (!product) return null;
    if (selectedVariant && selectedVariant.price !== undefined && selectedVariant.price !== null && selectedVariant.price > 0) {
      return {
        ...product,
        price: selectedVariant.price,
        oldPrice: selectedVariant.oldPrice !== undefined ? selectedVariant.oldPrice : product.oldPrice
      };
    }
    return product;
  }, [product, selectedVariant]);

  const pricingDetails: EffectivePriceDetails = useMemo(() => {
    if (!effectiveProductForPricing) {
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
    return getEffectiveProductPrice(effectiveProductForPricing, activeBanners, activePromotions);
  }, [effectiveProductForPricing, activeBanners, activePromotions]);

  const isVariantAvailable = useMemo(() => {
    if (!product) return false;
    if (!product.isAvailable || product.stockStatus === 'out_of_stock' || product.stockStatus === 'coming_soon') {
      return false;
    }
    if (selectedVariant) {
      if (selectedVariant.active === false) return false;
      if (selectedVariant.stockQuantity !== undefined && selectedVariant.stockQuantity <= 0) return false;
    }
    return true;
  }, [product, selectedVariant]);

  const canonicalSlug = product ? getProductCanonicalSlug(product) : slug;
  const canonicalUrl = product ? getProductCanonicalUrl(product) : (typeof window !== 'undefined' ? window.location.href.split('?')[0] : '');

  // Normalize address bar to stable canonical URL
  useEffect(() => {
    if (product && canonicalSlug && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const targetPath = `/product/${canonicalSlug}`;
      if (currentPath !== targetPath && !currentPath.endsWith('/' + encodeURIComponent(canonicalSlug))) {
        window.history.replaceState({}, '', targetPath);
      }
    }
  }, [product, canonicalSlug]);

  const handleShare = async () => {
    if (!product) return;
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const shareData = buildProductShareData({
      product,
      effectivePrice: pricingDetails.effectivePrice,
      isCampaignActive: pricingDetails.isCampaignActive,
      storeName: settings?.storeName
    });

    if (isMobile && navigator.share && navigator.canShare) {
      try {
        await navigator.share({
          title: shareData.title,
          text: shareData.text,
          url: shareData.url,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    setShareModalOpen(true);
  };

  const handleWhatsAppClick = () => {
    if (product?.id) {
      productService.incrementWhatsAppClicks(product.id);
      analyticsService.trackEvent('whatsapp_clicked', {
        productId: product.id,
        categoryId: product.categoryId,
        userUid: user?.uid
      });
    }
  };

  const handleOpenComparison = (targetProduct?: Product) => {
    setComparisonTargetProduct(targetProduct || null);
    setIsComparisonOpen(true);
  };

  const recommendedProducts = useMemo(() => {
    if (!product || allProducts.length === 0) return [];
    return getRecommendedProducts(product, allProducts, {
      limit: 4,
      priceTolerancePercent: 20
    });
  }, [product, allProducts]);

  if (error === 'product_not_found' || (!loading && !product)) {
    return <NotFoundPage navigate={navigate} type="product" />;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12" dir="rtl">
        <LoadingSkeleton type="details" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-2xl mx-auto my-16 px-4 space-y-6" dir="rtl">
        <ErrorState message={error || 'تعذر العثور على المنتج المطلوب.'} onRetry={loadData} />
        {debugInfo && (
          <div className="rounded-2xl bg-slate-900 border border-amber-500/40 p-4 text-xs font-mono text-amber-200/90 space-y-2 shadow-xl" dir="ltr">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <span className="font-bold text-amber-400">🔍 Product Details Diagnostic Debug Info</span>
              <span className="text-[10px] text-amber-400/60">{debugInfo.timestamp}</span>
            </div>
            <div><strong className="text-white">Received ID / Slug:</strong> {debugInfo.receivedIdentifier}</div>
            <div><strong className="text-white">URL Pathname:</strong> {debugInfo.pathname}</div>
            <div><strong className="text-white">Query Executed:</strong> {debugInfo.queryExecuted}</div>
            <div><strong className="text-white">Firebase Response:</strong> {debugInfo.firebaseResponse}</div>
            {debugInfo.finalErrorMessage && (
              <div><strong className="text-rose-400">Final Error Message:</strong> <span className="text-rose-300">{debugInfo.finalErrorMessage}</span></div>
            )}
          </div>
        )}
      </div>
    );
  }

  const discountPercent =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  const isMobileCategory =
    (resolvedCategory?.name && resolvedCategory.name.includes('موبايل')) ||
    (resolvedCategory?.slug && (resolvedCategory.slug.includes('smartphones') || resolvedCategory.slug.includes('mobile'))) ||
    (product.categoryName && product.categoryName.includes('موبايل')) ||
    (product.categoryId && (product.categoryId.includes('smartphones') || product.categoryId.includes('mobile')));

  const activeSpecs = MOBILE_SPEC_CONFIG.filter((spec) => {
    const val = product.specifications?.[spec.key];
    return typeof val === 'string' && val.trim().length > 0;
  });

  const shouldShowSpecs = isMobileCategory && activeSpecs.length > 0;
  const hasDescription = Boolean(product.description && product.description.trim().length > 0);
  const hasFeatures = Boolean(product.features && product.features.length > 0);

  const whatsappLink = settings?.whatsappNumber
    ? catalogService.getWhatsAppInquiryUrl(
        settings.whatsappNumber,
        `${product.name} - السعر: ${pricingDetails.effectivePrice.toLocaleString('ar-EG')} ج.م${pricingDetails.isCampaignActive ? ' (سعر العرض الترويجي)' : ''}`
      )
    : `https://wa.me/?text=${encodeURIComponent(`مرحبًا، أود الاستفسار عن منتج: ${product.name} بسعر ${pricingDetails.effectivePrice.toLocaleString('ar-EG')} ج.م`)}`;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] transition-colors duration-200 pb-6 lg:pb-12" dir="rtl">
      {/* Client-side SEO injection */}
      <SEO 
        title={product.name}
        description={product.description?.slice(0, 160)}
        image={product.mainImageUrl}
        price={pricingDetails.effectivePrice}
        currency="EGP"
        availability={product.isAvailable && product.stockStatus !== 'out_of_stock' && product.stockStatus !== 'coming_soon' ? 'in stock' : 'out of stock'}
        type="product"
        canonicalUrl={canonicalUrl}
        url={canonicalUrl}
        siteName={settings?.storeName || 'متجر البيت السعيد 1981'}
      />
      {/* 1. Breadcrumb and Desktop Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-[10px] sm:text-xs text-[var(--text-secondary)] flex-wrap mb-4 sm:mb-6">
          <button onClick={() => navigate('/')} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">الرئيسية</button>
          <ChevronRight className="w-3 h-3 rotate-180 shrink-0" />
          {categoryStatus === 'found' && resolvedCategory && (
            <>
              <button onClick={() => navigate(`/category/${resolvedCategory.slug || resolvedCategory.id}`)} className="hover:text-[#E0B84A] transition-colors cursor-pointer font-semibold">{resolvedCategory.name}</button>
              <ChevronRight className="w-3 h-3 rotate-180 shrink-0" />
            </>
          )}
          <span className="text-[#E0B84A] font-bold truncate max-w-[150px] sm:max-w-xs">{product.name}</span>
        </nav>
      </div>

      {/* 2. Main Grid Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-28 sm:pb-24 lg:pb-16">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 sm:gap-8 xl:gap-12 items-start">
          
          {/* Left Column (Desktop: Gallery, Specs, Description, Recommendations, Reviews | Mobile: contents) */}
          <div className="contents lg:block lg:col-span-7 xl:col-span-8 lg:space-y-8 xl:space-y-12">
            
            {/* 1. Image Gallery (Mobile Order #1) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="order-1 lg:order-none sticky-gallery w-full"
            >
              <ProductGallery
                productName={product.name}
                mainImageUrl={activeMainImage}
                galleryImages={activeGalleryImages}
                gallerySettings={product.gallerySettings}
                storeSettings={settings}
                isFeatured={product.isFeatured}
                discountPercent={discountPercent}
                sku={selectedVariant?.sku || product.sku}
              />
            </motion.div>

            {/* 7. Key Specifications Section (Mobile Order #7) */}
            {shouldShowSpecs && (
              <section className="order-7 lg:order-none glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full">
                <div className="flex items-center justify-between border-r-3 sm:border-r-4 border-[#D4AF37] pr-3 sm:pr-4">
                  <h2 className="text-base sm:text-lg lg:text-xl font-black text-[var(--text-primary)]">المواصفات التقنية</h2>
                  <button onClick={() => handleOpenComparison()} className="text-xs text-[#E0B84A] hover:underline font-bold flex items-center gap-1.5 cursor-pointer">
                    <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>مقارنة مع هاتف آخر</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-4">
                  {activeSpecs.map((spec) => (
                    <div key={spec.key} className="glass-panel border border-[var(--border)] p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col gap-2 sm:gap-3 group hover:border-[#D4AF37]/30 transition-all">
                      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[11px] sm:text-xs font-bold">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center text-[#D4AF37] group-hover:scale-110 transition-transform">
                          <spec.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <span className="truncate">{spec.label}</span>
                      </div>
                      <span className="text-xs sm:text-sm font-black text-[var(--text-primary)] truncate">{product.specifications?.[spec.key]}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 8. Description & Features / Why Choose This Product (Mobile Order #8) */}
            {(hasDescription || hasFeatures) && (
              <section className="order-8 lg:order-none glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 w-full">
                {hasFeatures && (
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-[#E0B84A] border-r-3 sm:border-r-4 border-[#D4AF37] pr-3 sm:pr-4">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>لماذا تختار هذا المنتج؟</span>
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                      {product.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 sm:gap-3 glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--border)]">
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)] leading-relaxed">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {hasDescription && (
                  <div className={`space-y-3 sm:space-y-4 ${hasFeatures ? 'pt-5 sm:pt-6 border-t border-[var(--border)]' : ''}`}>
                    <h2 className="text-base sm:text-lg lg:text-xl font-black text-[var(--text-primary)] border-r-3 sm:border-r-4 border-[#D4AF37] pr-3 sm:pr-4">التفاصيل والوصف</h2>
                    <div className="text-xs sm:text-sm lg:text-base text-[var(--text-secondary)] leading-relaxed whitespace-pre-line pr-1 font-normal">
                      {product.description}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 9. Reviews Section (Mobile Order #9) */}
            <div className="order-9 lg:order-none w-full">
              <ProductReviewsSection
                product={product}
                navigate={navigate}
                onReviewSubmitted={() => {
                  productService.getProductBySlug(slug).then((updatedProd) => {
                    if (updatedProd) setProduct(updatedProd);
                  });
                }}
              />
            </div>

            {/* 10. Recommendations Section (Mobile Order #10) */}
            {recommendedProducts.length > 0 && (
              <div className="order-10 lg:order-none w-full">
                <RecommendedProductsSection
                  currentProduct={product}
                  recommendedProducts={recommendedProducts}
                  onSelectProduct={(targetSlug) => navigate(`/product/${targetSlug}`)}
                  onOpenComparison={(targetProd) => handleOpenComparison(targetProd)}
                />
              </div>
            )}

            {/* 11. Recently Viewed Products Section (Mobile Order #11) */}
            <div className="order-11 lg:order-none w-full">
              <RecentlyViewedSection
                excludeProductId={product.id}
                navigate={navigate}
              />
            </div>
          </div>

          {/* Right Column (Desktop: Sticky Sidebar | Mobile: contents) */}
          <div className="contents lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 lg:space-y-6">
            
            {/* 2. Primary Info Box (Identity, Price, Stock, Colors, Primary CTA, Favorites/Compare, Badges) (Mobile Order #2) */}
            <motion.section 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="order-2 lg:order-none glass-panel-elevated rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 shadow-2xl relative overflow-hidden w-full"
            >
              {/* Background Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#D4AF37]/10 blur-[80px] rounded-full pointer-events-none" />
              
              {/* Category & Rating */}
              <div className="flex items-center justify-between gap-4">
                {categoryStatus === 'found' && resolvedCategory ? (
                  <button onClick={() => navigate(`/category/${resolvedCategory.slug || resolvedCategory.id}`)} className="text-[10px] font-black text-[#D4AF37] px-3 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 uppercase tracking-widest hover:bg-[#D4AF37]/20 transition-colors cursor-pointer">
                    {resolvedCategory.name}
                  </button>
                ) : <div />}
                
                {product.reviewCount ? (
                  <div className="flex items-center gap-2 bg-[var(--surface-elevated)] px-3 py-1.5 rounded-full border border-[var(--border)]">
                    <Star className="w-3 h-3 fill-[#D4AF37] text-[#D4AF37]" />
                    <span className="text-[10px] font-black text-[var(--text-primary)]">{product.averageRating?.toFixed(1)}</span>
                    <span className="text-[9px] text-[var(--text-muted)]">({product.reviewCount})</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">لا توجد تقييمات بعد</span>
                )}
              </div>

              {/* Title & SKU & Guarantee */}
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[var(--text-primary)] leading-snug tracking-tight">
                  {product.name}
                </h1>
                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">SKU: {product.sku}</span>
                  <div className="h-1 w-1 rounded-full bg-[var(--border)]" />
                  <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ضمان الوكيل المعتمد</span>
                  </div>
                </div>
              </div>

              {/* Price Block */}
              <div className="py-4 sm:py-6 border-y border-[var(--border)] space-y-3">
                {/* Flash Sale Countdown Timer (when flash sale is active) */}
                {pricingDetails.isCampaignActive && pricingDetails.isFlashSale && pricingDetails.flashSaleEndDate && (
                  <div className="rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent border border-rose-500/30 p-3 sm:p-4 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-rose-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span>{pricingDetails.badgeText || 'عرض لفترة محدودة'}</span>
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">ينتهي العرض خلال:</span>
                    </div>
                    <FlashSaleCountdown
                      endDate={pricingDetails.flashSaleEndDate}
                      onExpire={() => {
                        // Automatically revert to base price when countdown reaches 0
                        loadData();
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-[#D4AF37] tracking-tight">
                      {pricingDetails.effectivePrice.toLocaleString('ar-EG')}
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#D4AF37]">ج.م</span>
                  </div>

                  {pricingDetails.isCampaignActive ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)]">السعر الأصلي:</span>
                        <span className="text-sm text-[var(--text-muted)] line-through decoration-rose-500/50">
                          {pricingDetails.originalBasePrice.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border flex items-center gap-1 shadow-sm ${
                          pricingDetails.isFlashSale
                            ? 'text-rose-600 bg-rose-500/10 border-rose-500/30'
                            : 'text-black bg-[#D4AF37] border-[#D4AF37]'
                        }`}>
                          <Sparkles className="w-3 h-3" />
                          <span>{pricingDetails.badgeText || (pricingDetails.isFlashSale ? 'عرض لفترة محدودة' : 'سعر العرض الترويجي')}</span>
                        </span>
                        {pricingDetails.savingsAmount && pricingDetails.discountPercent && (
                          <span className="text-[10px] font-black text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            وفر {pricingDetails.savingsAmount.toLocaleString('ar-EG')} ج.م ({pricingDetails.discountPercent}%)
                          </span>
                        )}
                      </div>
                    </div>
                  ) : product.oldPrice && product.oldPrice > product.price ? (
                    <div className="flex flex-col">
                      <span className="text-sm text-[var(--text-muted)] line-through decoration-rose-500/50">
                        {product.oldPrice.toLocaleString('ar-EG')} ج.م
                      </span>
                      <span className="text-[10px] font-black text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded mt-0.5 border border-rose-500/20">
                        وفر { (product.oldPrice - product.price).toLocaleString('ar-EG') } ج.م ({discountPercent}%)
                      </span>
                    </div>
                  ) : null}
                </div>
                
                {/* Stock Status */}
                <div className="flex items-center gap-2">
                  {product.stockStatus === 'coming_soon' ? (
                    <div className="flex items-center gap-1.5 text-sky-400 text-[11px] font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      <span>قريباً في المعرض</span>
                    </div>
                  ) : !isVariantAvailable ? (
                    <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-black">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>
                        {selectedVariant
                          ? `اللون المحدد (${selectedVariant.colorName || selectedVariant.name}) غير متوفر حالياً`
                          : 'نفد من المخزون حالياً'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>متوفر وجاهز للشحن الفوري</span>
                      {selectedVariant?.stockQuantity !== undefined ? (
                        <span className="text-amber-400 text-[10px] mr-1">(متوفر {selectedVariant.stockQuantity} قطعة)</span>
                      ) : (
                        product.trackInventory && product.showExactStockToCustomer && product.stockQuantity <= (product.lowStockThreshold || 5) && (
                          <span className="text-amber-400 text-[10px] mr-1">(باقي {product.stockQuantity} فقط!)</span>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Installment Badge Teaser */}
                <InstallmentProductBadge
                  productPrice={pricingDetails.effectivePrice}
                  productConfig={product.installmentConfig}
                  providers={installmentProviders}
                  plans={installmentPlans}
                  onOpenModal={(providerId) => {
                    setSelectedInstallmentProviderId(providerId);
                    setInstallmentModalOpen(true);
                  }}
                />

                {/* Fawry Product Insurance Badge */}
                <InsuranceProductBadge
                  product={product}
                  productPrice={pricingDetails.effectivePrice}
                  category={resolvedCategory}
                  policies={insurancePolicies}
                  onOpenModal={(policyId) => {
                    if (policyId) {
                      const found = insurancePolicies.find(p => p.id === policyId);
                      if (found) setSelectedInsurancePolicy(found);
                    }
                    setInsuranceModalOpen(true);
                  }}
                />
              </div>

              {/* Colors / Variants Selector */}
              {((product.variants && product.variants.length > 0) || (product.colorVariants && product.colorVariants.length > 0) || (product.colors && product.colors.length > 0)) && (
                <div className="py-2 border-t border-[var(--border)]">
                  <ProductColorSelector
                    variants={product.variants || product.colorVariants}
                    colors={product.colors}
                    selectedVariant={selectedVariant || selectedColor}
                    onSelectVariant={(item) => handleSelectColor(item)}
                  />
                </div>
              )}

              {/* Primary Purchase CTA & Actions */}
              <div className="space-y-3 pt-2 sm:pt-4">
                <button
                  disabled={!isVariantAvailable}
                  onClick={() => addToCart(product.id, 1)}
                  className="w-full py-3.5 sm:py-4 px-6 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-black font-black rounded-2xl transition-all shadow-[0_15px_40px_-10px_rgba(212,175,55,0.4)] hover:shadow-[0_20px_50px_-10px_rgba(212,175,55,0.5)] hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>إضافة إلى السلة</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <button
                    onClick={() => toggleFavorite(product)}
                    className={`py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs active:scale-95 cursor-pointer ${
                      favorited 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                        : 'bg-[var(--surface)] border-[var(--border)] hover:border-[#D4AF37]/50 text-[var(--text-secondary)]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${favorited ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{favorited ? 'في المفضلة' : 'المفضلة'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenComparison()}
                    className="py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[#D4AF37]/50 text-[var(--text-secondary)] hover:text-[#D4AF37] transition-all flex items-center justify-center gap-2 font-bold text-xs active:scale-95 cursor-pointer"
                  >
                    <Scale className="w-4 h-4" />
                    <span>قارن الآن</span>
                  </button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="pt-4 sm:pt-6 grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <Truck className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-[8px] sm:text-[9px] font-bold text-[var(--text-muted)]">شحن سريع</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <RotateCcw className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-[8px] sm:text-[9px] font-bold text-[var(--text-muted)]">إرجاع سهل</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-[8px] sm:text-[9px] font-bold text-[var(--text-muted)]">أمان تام</span>
                </div>
              </div>
            </motion.section>

            {/* 12. Support CTA (Mobile Order #12) */}
            <div className="order-12 lg:order-none glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-l-4 border-emerald-500/40 flex items-center justify-between gap-4 w-full">
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-black text-emerald-500 uppercase tracking-wide">هل لديك أي استفسار؟</h4>
                <p className="text-[10px] sm:text-xs text-[var(--text-secondary)]">تواصل مع فريقنا مباشرة عبر واتساب</p>
              </div>
              <button
                onClick={() => {
                  handleWhatsAppClick();
                  setPdfModalOpen(true);
                }}
                className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-500 text-black hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20 shrink-0 cursor-pointer border-0"
                aria-label="تواصل عبر واتساب"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>

            {/* 13. Share & Extra Links (Mobile Order #13) */}
            <div className="order-13 lg:order-none flex items-center justify-between gap-4 pt-3 sm:pt-4 border-t border-[var(--border)] w-full">
              <button 
                id="share-product-main-btn"
                onClick={handleShare} 
                className="flex-1 py-3 px-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center gap-2 text-xs font-bold text-[var(--text-primary)] transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#D4AF37]" />
                <span>مشاركة المنتج</span>
              </button>
              <button onClick={() => navigate('/products')} className="py-3 px-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[#D4AF37] transition-all cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                <span>المزيد من المنتجات</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Mobile Sticky Bottom Actions (Floating) - Stacked beautifully above Mobile Bottom Nav */}
      <AnimatePresence>
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed lg:hidden inset-x-0 z-40 p-3 bg-[var(--surface-elevated)] backdrop-blur-xl border-t border-[var(--border)] shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex items-center"
          style={{ bottom: 'var(--mobile-bottom-nav-height, 0px)', height: 'var(--mobile-action-bar-height)' }}
        >
          <div className="max-w-md mx-auto flex items-center gap-3 w-full">
            <button
              disabled={!isVariantAvailable}
              onClick={() => addToCart(product.id, 1)}
              className="flex-1 h-12 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-black font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-30 cursor-pointer"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm">أضف للسلة</span>
            </button>
            
            <button
              id="mobile-share-btn"
              onClick={handleShare}
              className="w-12 h-12 bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
              aria-label="مشاركة المنتج"
              title="مشاركة المنتج"
            >
              <Share2 className="w-5 h-5 text-[#D4AF37]" />
            </button>
            <button
              onClick={() => {
                handleWhatsAppClick();
                setPdfModalOpen(true);
              }}
              className="w-12 h-12 bg-emerald-500 text-black rounded-2xl flex items-center justify-center shadow-lg active:scale-95 cursor-pointer border-0"
              aria-label="تواصل عبر واتساب"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 4. Comparison Modal */}
      {product && (
        <ProductComparisonModal
          isOpen={isComparisonOpen}
          onClose={() => {
            setIsComparisonOpen(false);
            setComparisonTargetProduct(null);
          }}
          productA={product}
          initialProductB={comparisonTargetProduct}
          allProducts={allProducts}
          storeSettings={settings}
          onNavigateToProduct={(targetSlug) => navigate(`/product/${targetSlug}`)}
        />
      )}

      {/* 5. Product Share Modal */}
      {product && (
        <ProductShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          product={product}
          effectivePrice={pricingDetails.effectivePrice}
          isCampaignActive={pricingDetails.isCampaignActive}
          storeName={settings?.storeName}
        />
      )}

      {/* 6. Installment Calculation & Provider Selection Modal */}
      {product && (
        <InstallmentModal
          isOpen={installmentModalOpen}
          onClose={() => setInstallmentModalOpen(false)}
          productName={product.name}
          productPrice={pricingDetails.effectivePrice}
          productConfig={product.installmentConfig}
          providers={installmentProviders}
          plans={installmentPlans}
          initialProviderId={selectedInstallmentProviderId}
          settings={settings || undefined}
        />
      )}

      {/* 6.5. Fawry Insurance Details & Selection Modal */}
      {product && (
        <InsuranceModal
          isOpen={insuranceModalOpen}
          onClose={() => setInsuranceModalOpen(false)}
          product={product}
          productPrice={pricingDetails.effectivePrice}
          category={resolvedCategory}
          policies={insurancePolicies}
          initialSelectedPolicyId={selectedInsurancePolicy?.id}
          onSelectPolicy={(policy) => {
            setSelectedInsurancePolicy(policy);
          }}
          settings={settings}
        />
      )}

      {/* 7. Product PDF Inquiry & Generation Modal */}
      {product && pdfModalOpen && (
        <ProductPdfInquiryModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          product={product}
          selectedVariant={selectedVariant}
          selectedColor={selectedColor}
          activeMainImage={activeMainImage}
          activeGalleryImages={activeGalleryImages}
          pricingDetails={pricingDetails}
          resolvedCategory={resolvedCategory}
          installmentProviders={installmentProviders}
          installmentPlans={installmentPlans}
          insurancePolicies={insurancePolicies}
          initialInsurancePolicy={selectedInsurancePolicy}
          settings={settings}
        />
      )}

      {/* Diagnostic Debug Details Box */}
      {debugInfo && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 mb-4">
          <details className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-3.5 text-xs font-mono text-slate-300">
            <summary className="cursor-pointer font-bold text-slate-300 select-none flex items-center justify-between">
              <span>🔍 Diagnostic Debug Information (Product Details)</span>
              <span className="text-[10px] text-emerald-400 font-sans">Firebase OK</span>
            </summary>
            <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-700/40 text-[11px]" dir="ltr">
              <div><strong className="text-white">Received ID / Slug:</strong> {debugInfo.receivedIdentifier}</div>
              <div><strong className="text-white">URL Pathname:</strong> {debugInfo.pathname}</div>
              <div><strong className="text-white">Query Executed:</strong> {debugInfo.queryExecuted}</div>
              <div><strong className="text-white">Firebase Response:</strong> {debugInfo.firebaseResponse}</div>
              {debugInfo.finalErrorMessage && (
                <div><strong className="text-rose-400">Final Error Message:</strong> {debugInfo.finalErrorMessage}</div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
