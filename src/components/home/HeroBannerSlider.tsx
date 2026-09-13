import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronRight, ChevronLeft, Sparkles, ExternalLink } from 'lucide-react';
import { HeroBanner, StoreSettings, Product } from '../../types';
import { catalogService } from '../../lib/data/catalogService';
import { HeroBannerVideoSlide } from './HeroBannerVideoSlide';


interface HeroBannerSliderProps {
  banners: HeroBanner[];
  settings: StoreSettings;
  allProducts?: Product[];
  intervalSeconds?: number;
  onNavigate: (path: string) => void;
}

export function HeroBannerSlider({
  banners,
  settings,
  allProducts = [],
  intervalSeconds = 5,
  onNavigate
}: HeroBannerSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Filter only active banners if flag is present
  const activeBanners = useMemo(() => {
    if (!banners || banners.length === 0) return [];
    return banners.filter((b) => b.isActive !== false);
  }, [banners]);

  const currentBanner = activeBanners[currentIndex] || activeBanners[0] || null;

  // Auto-rotation timer based on current banner duration or default
  useEffect(() => {
    if (!activeBanners || activeBanners.length <= 1 || isPaused) return;

    const durationSeconds = currentBanner?.displayDuration || intervalSeconds || 5;
    const delayMs = Math.max(2, durationSeconds) * 1000;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, delayMs);

    return () => clearInterval(timer);
  }, [activeBanners, currentIndex, isPaused, currentBanner, intervalSeconds]);

  // Reset index if banners list shrinks
  useEffect(() => {
    if (currentIndex >= activeBanners.length && activeBanners.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeBanners.length, currentIndex]);

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeBanners || activeBanners.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? activeBanners.length - 1 : prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeBanners || activeBanners.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;

    if (diff > 45) {
      // Swiped left (in RTL: Next)
      handleNext();
    } else if (diff < -45) {
      // Swiped right (in RTL: Prev)
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Resolve click destination based on Target Type & Values
  const handleBannerClick = (banner: HeroBanner) => {
    if (!banner) return;

    // 1. Explicit Target Type
    if (banner.targetType === 'product') {
      const val = banner.targetValue || banner.productId;
      const linked = allProducts.find((p) => p.id === val || p.slug === val);
      const slug = linked?.slug || banner.productSlug || val;
      if (slug) {
        onNavigate(`/product/${slug}`);
        return;
      }
    } else if (banner.targetType === 'category') {
      const val = banner.targetValue || (banner.categoryIds && banner.categoryIds[0]);
      if (val) {
        onNavigate(`/category/${val}`);
        return;
      }
    } else if (banner.targetType === 'page') {
      if (banner.targetValue) {
        if (banner.targetValue.startsWith('http')) {
          window.open(banner.targetValue, '_blank', 'noopener,noreferrer');
        } else {
          onNavigate(banner.targetValue);
        }
        return;
      }
    } else if (banner.targetType === 'offer') {
      if (banner.targetValue) {
        if (banner.targetValue.startsWith('http')) {
          window.open(banner.targetValue, '_blank', 'noopener,noreferrer');
        } else {
          onNavigate(banner.targetValue);
        }
        return;
      }
      onNavigate('/offers');
      return;
    } else if (banner.targetType === 'external') {
      if (banner.targetValue) {
        window.open(banner.targetValue, '_blank', 'noopener,noreferrer');
        return;
      }
    }

    // 2. Backward Compatibility Fallbacks
    if (banner.ctaType === 'whatsapp') {
      const msg = `مرحبًا، أود الاستفسار عن عرض: ${banner.title || settings.storeName || ''}`;
      const url = catalogService.getWhatsAppUrl(settings.whatsappNumber, msg);
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (banner.ctaType === 'product_page') {
      const linked = allProducts.find((p) => p.id === banner.productId);
      const slug = banner.productSlug || linked?.slug || banner.productId;
      if (slug) {
        onNavigate(`/product/${slug}`);
        return;
      }
    }

    if (banner.ctaLink) {
      if (banner.ctaLink.startsWith('http')) {
        window.open(banner.ctaLink, '_blank', 'noopener,noreferrer');
      } else {
        onNavigate(banner.ctaLink);
      }
      return;
    }

    if (banner.productSlug || banner.productId) {
      onNavigate(`/product/${banner.productSlug || banner.productId}`);
      return;
    }

    // Default fallback
    onNavigate('/products');
  };

  // If no banners exist at all
  if (!currentBanner) {
    return null;
  }

  // Determine desktop and mobile imagery
  const desktopImg =
    currentBanner.desktopImageUrl ||
    currentBanner.mobileImageUrl ||
    currentBanner.productImageUrl ||
    currentBanner.backgroundImageUrl;

  const mobileImg = currentBanner.mobileImageUrl || desktopImg;
  const imageSizeMode = currentBanner.imageSizeMode || 'contain';

  return (
    <section
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5 relative group"
      dir="rtl"
      aria-label="سلايدر العروض الترويجية الرئيسية"
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Outer Banner Frame */}
      <div
        className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl glass-panel-elevated border border-[var(--border)] shadow-xl select-none aspect-[16/9] sm:aspect-[21/9] md:aspect-[2.6/1] lg:aspect-[2.8/1] min-h-[190px] sm:min-h-[260px] md:min-h-[320px] lg:min-h-[360px] max-h-[480px] flex items-center justify-center transition-all duration-300 hover:shadow-2xl"
      >
        {/* Active Banner Slide */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBanner.id || currentIndex}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: shouldReduceMotion ? 0.1 : 0.45, ease: 'easeOut' }
            }}
            exit={{
              opacity: 0,
              transition: { duration: shouldReduceMotion ? 0.1 : 0.25, ease: 'easeIn' }
            }}
            onClick={() => handleBannerClick(currentBanner)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBannerClick(currentBanner);
              }
            }}
            tabIndex={0}
            role="link"
            aria-label={currentBanner.title || 'إعلان ترويجي'}
            className="w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] relative flex items-center justify-center"
          >
            {/* Screen Reader Accessibility Text */}
            <span className="sr-only">
              {currentBanner.title || 'عرض ترويجي، انقر لمشاهدة التفاصيل'}
            </span>

            {/* Banner Media Presentation (Video or Image) */}
            {currentBanner.mediaType === 'video' &&
            Boolean(
              currentBanner.videoUrl ||
              currentBanner.mobileVideoUrl ||
              currentBanner.youtubeVideoId ||
              currentBanner.mobileYoutubeVideoId
            ) ? (
              <HeroBannerVideoSlide
                banner={currentBanner}
                isPaused={false}
                shouldReduceMotion={Boolean(shouldReduceMotion)}
                imageSizeMode={imageSizeMode}
              />
            ) : desktopImg ? (
              <picture className="w-full h-full flex items-center justify-center">
                {mobileImg && mobileImg !== desktopImg && (
                  <source media="(max-width: 640px)" srcSet={mobileImg} />
                )}
                <img
                  src={getValidImageSrc(desktopImg)}
                  alt={currentBanner.title || 'عرض ترويجي'}
                  loading={currentIndex === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  // @ts-ignore
                  fetchPriority={currentIndex === 0 ? 'high' : 'auto'}
                  className={`w-full h-full ${
                    imageSizeMode === 'cover'
                      ? 'object-cover object-center'
                      : 'object-contain object-center'
                  } transition-transform duration-700 ease-out group-hover:scale-[1.01]`}
                />
              </picture>
            ) : (
              /* Fallback for text-only legacy banners without an image */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[var(--surface-elevated)]">
                <Sparkles className="w-8 h-8 text-[#D4AF37] opacity-60" />
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                  {currentBanner.title}
                </h2>
                {currentBanner.subtitle && (
                  <p className="text-sm text-[var(--text-secondary)] max-w-md">
                    {currentBanner.subtitle}
                  </p>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-3 py-1 rounded-full mt-2">
                  <span>اكتشف العرض الآن</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Carousel Navigation Controls (Arrows) — only if multiple banners */}
        {activeBanners.length > 1 && (
          <>
            {/* Previous Arrow (Right side in RTL) */}
            <button
              type="button"
              onClick={handlePrev}
              aria-label="العرض السابق"
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full glass-panel hover:scale-105 text-[var(--text-primary)] border border-[var(--border)] backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-lg active:scale-95"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Next Arrow (Left side in RTL) */}
            <button
              type="button"
              onClick={handleNext}
              aria-label="العرض التالي"
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full glass-panel hover:scale-105 text-[var(--text-primary)] border border-[var(--border)] backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer shadow-lg active:scale-95"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Pagination Indicators (Bottom Center) */}
            <div
              className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full glass-panel border border-[var(--border)]"
              role="tablist"
              aria-label="صفحات العروض الترويجية"
            >
              {activeBanners.map((banner, index) => {
                const isActive = index === currentIndex;
                return (
                  <button
                    key={banner.id || index}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`الانتقال إلى الإعلان ${index + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(index);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'w-6 sm:w-8 bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]'
                        : 'w-1.5 sm:w-2 bg-[var(--text-secondary)]/40 hover:bg-[var(--text-primary)]'
                    }`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
