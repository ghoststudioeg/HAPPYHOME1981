import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoreSettings, ProductGallerySettings } from '../../types';
import {

  ChevronLeft,
  ChevronRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Play,
  Pause
} from 'lucide-react';

interface ProductGalleryProps {
  productName: string;
  mainImageUrl: string;
  additionalImages?: string[];
  galleryImages?: string[];
  selectedColorImage?: string;
  gallerySettings?: ProductGallerySettings;
  storeSettings?: StoreSettings | null;
  isFeatured?: boolean;
  discountPercent?: number | null;
  sku?: string;
}

export function ProductGallery({
  productName,
  mainImageUrl,
  additionalImages = [],
  galleryImages,
  selectedColorImage,
  gallerySettings,
  storeSettings,
  isFeatured,
  discountPercent,
  sku
}: ProductGalleryProps) {
  // 1. Consolidate images array (removing duplicates and empty values)
  const images = React.useMemo(() => {
    if (galleryImages && galleryImages.length > 0) {
      const clean = galleryImages.filter(img => img && img.trim());
      return clean.length > 0 ? clean : ['/logo.svg'];
    }

    const list: string[] = [];
    if (selectedColorImage && selectedColorImage.trim()) {
      list.push(selectedColorImage.trim());
    }
    if (mainImageUrl && mainImageUrl.trim()) {
      if (!list.includes(mainImageUrl.trim())) {
        list.push(mainImageUrl.trim());
      }
    }
    (additionalImages || []).forEach((img) => {
      if (img && img.trim() && !list.includes(img.trim())) {
        list.push(img.trim());
      }
    });
    return list.length > 0 ? list : ['/logo.svg'];
  }, [mainImageUrl, additionalImages, galleryImages, selectedColorImage]);

  // Gallery Active Index
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset activeIndex when gallery changes
  useEffect(() => {
    setActiveIndex(0);
  }, [galleryImages, selectedColorImage, mainImageUrl]);

  // Auto-Slide Settings Resolution
  const autoSlideEnabled =
    gallerySettings?.autoSlideEnabled !== undefined
      ? gallerySettings.autoSlideEnabled
      : storeSettings?.galleryAutoSlideEnabled ?? true;

  const autoSlideIntervalSeconds =
    gallerySettings?.autoSlideInterval && gallerySettings.autoSlideInterval > 0
      ? gallerySettings.autoSlideInterval
      : storeSettings?.galleryAutoSlideInterval && storeSettings.galleryAutoSlideInterval > 0
      ? storeSettings.galleryAutoSlideInterval
      : 5;

  // Interaction / State Hooks for Auto-Slide
  const [isHovered, setIsHovered] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  // Touch Swipe tracking for Mobile
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // Zoom Modal State
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDraggingZoom, setIsDraggingZoom] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pinch to Zoom tracking for mobile
  const pinchStartDistanceRef = useRef<number | null>(null);

  // When selectedColorImage changes, switch activeIndex to it
  useEffect(() => {
    if (selectedColorImage) {
      const idx = images.indexOf(selectedColorImage);
      if (idx !== -1) {
        setActiveIndex(idx);
      }
    }
  }, [selectedColorImage, images]);

  // Ensure activeIndex remains within bounds if images change
  useEffect(() => {
    if (activeIndex >= images.length) {
      setActiveIndex(0);
    }
  }, [images.length, activeIndex]);

  // Navigation handlers (RTL Aware: Next = ChevronLeft, Prev = ChevronRight)
  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Auto Slide Interval Timer
  useEffect(() => {
    if (!autoSlideEnabled || images.length <= 1 || isHovered || isPausedByUser || isZoomOpen) {
      return;
    }

    const intervalMs = autoSlideIntervalSeconds * 1000;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoSlideEnabled, autoSlideIntervalSeconds, images.length, isHovered, isPausedByUser, isZoomOpen]);

  // Touch Handlers for Mobile Swipe on Main Image
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchEndXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartXRef.current !== null) {
      touchEndXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) return;
    const deltaX = touchEndXRef.current - touchStartXRef.current;
    const threshold = 40; // minimum distance for swipe

    if (deltaX < -threshold) {
      // Swiped Left -> Next Image in RTL
      handleNext();
    } else if (deltaX > threshold) {
      // Swiped Right -> Previous Image in RTL
      handlePrev();
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // Zoom Modal Controls
  const openZoom = () => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
    setIsZoomOpen(true);
    window.dispatchEvent(new CustomEvent('hide-bottom-nav'));
  };

  const closeZoom = useCallback(() => {
    setIsZoomOpen(false);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
    window.dispatchEvent(new CustomEvent('show-bottom-nav'));
  }, []);

  // Guarantee that bottom navigation returns when component is unmounted
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('show-bottom-nav'));
    };
  }, []);

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setZoomPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  // Keyboard navigation inside Zoom or Gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isZoomOpen) {
        if (e.key === 'Escape') {
          closeZoom();
        } else if (e.key === 'ArrowLeft') {
          handleNext();
        } else if (e.key === 'ArrowRight') {
          handlePrev();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen, closeZoom, handleNext, handlePrev]);

  // Mouse Wheel Zoom inside Modal
  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!isZoomOpen) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomScale((prev) => Math.min(prev + 0.25, 4));
    } else {
      setZoomScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setZoomPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Dragging Zoomed Image
  const handleMouseDownZoom = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    setIsDraggingZoom(true);
    dragStartRef.current = { x: e.clientX - zoomPosition.x, y: e.clientY - zoomPosition.y };
  };

  const handleMouseMoveZoom = (e: React.MouseEvent) => {
    if (!isDraggingZoom || zoomScale <= 1) return;
    setZoomPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUpZoom = () => {
    setIsDraggingZoom(false);
  };

  // Mobile Pinch Zoom in Modal
  const handleZoomTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistanceRef.current = dist;
    } else if (e.touches.length === 1 && zoomScale > 1) {
      setIsDraggingZoom(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - zoomPosition.x,
        y: e.touches[0].clientY - zoomPosition.y
      };
    }
  };

  const handleZoomTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist / pinchStartDistanceRef.current;
      setZoomScale((prev) => Math.min(Math.max(prev * delta, 1), 4));
      pinchStartDistanceRef.current = dist;
    } else if (e.touches.length === 1 && isDraggingZoom && zoomScale > 1) {
      setZoomPosition({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    }
  };

  const handleZoomTouchEnd = () => {
    pinchStartDistanceRef.current = null;
    setIsDraggingZoom(false);
  };

  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = (failedUrl: string) => {
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(failedUrl);
      return newSet;
    });
  };

  const activeImageSrc = failedImages.has(images[activeIndex]) 
    ? (images.find(img => !failedImages.has(img)) || '/logo.svg')
    : (images[activeIndex] || mainImageUrl);

  return (
    <section aria-label="معرض صور المنتج" className="w-full" dir="rtl">
      {/* Unified Gallery Card Container */}
      <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden glass-panel-elevated border border-[var(--border)] shadow-xl group select-none flex flex-col">
        {/* Main Image Showcase Stage */}
        <div
          className="relative w-full aspect-square sm:aspect-[16/10] md:aspect-[16/9] max-h-[480px] flex items-center justify-center overflow-hidden bg-[var(--surface-elevated)]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Active Image */}
          <img
            src={getValidImageSrc(activeImageSrc)}
            alt={`${productName} - صورة ${activeIndex + 1}`}
            onClick={openZoom}
            onError={() => handleImageError(activeImageSrc)}
            className="w-full h-full object-contain p-2 sm:p-4 transition-all duration-300 cursor-zoom-in hover:scale-[1.02]"
          />

          {/* Badges Overlay */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10 pointer-events-none">
            {isFeatured && (
              <span className="bg-[#D6A83A] text-[#070D16] text-[11px] font-black px-2.5 py-1 rounded-md shadow-md">
                منتج مميز
              </span>
            )}
            {discountPercent && discountPercent > 0 && (
              <span className="bg-rose-600 text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-md">
                خصم {discountPercent}%
              </span>
            )}
          </div>

          {/* SKU & Image Counter Badge */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 pointer-events-none">
            {images.length > 1 && (
              <span className="bg-[var(--surface-elevated)] backdrop-blur-md text-[#D4AF37] text-[10px] font-bold px-2.5 py-1 rounded-lg border border-[var(--border)] shadow-md font-mono">
                {activeIndex + 1} / {images.length}
              </span>
            )}
            {sku && (
              <span className="font-mono text-[10px] bg-[var(--surface-elevated)] backdrop-blur-md text-[var(--text-secondary)] px-2 py-1 rounded-lg border border-[var(--border)]">
                SKU: {sku}
              </span>
            )}
          </div>

          {/* Expand / Zoom Button Overlay */}
          <button
            type="button"
            onClick={openZoom}
            aria-label="تكبير صورة المنتج"
            className="absolute top-3 left-3 z-10 p-2 bg-[var(--surface-elevated)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-black rounded-xl border border-[var(--border)] transition-all cursor-pointer shadow-lg backdrop-blur-md group-hover:opacity-100 sm:opacity-90 opacity-100"
            title="عرض الصورة بملء الشاشة المكبرة"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Navigation Arrows over Main Image (if more than 1 image) */}
          {images.length > 1 && (
            <>
            {/* Previous Arrow (In RTL, Right Button = Previous) */}
              <button
                type="button"
                onClick={handlePrev}
                aria-label="الصورة السابقة"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-[var(--surface-elevated)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-black border border-[var(--border)] hover:border-[#D4AF37] backdrop-blur-md transition-all cursor-pointer shadow-xl active:scale-95 group-hover:opacity-100 opacity-90"
                title="الصورة السابقة"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Next Arrow (In RTL, Left Button = Next) */}
              <button
                type="button"
                onClick={handleNext}
                aria-label="الصورة التالية"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-[var(--surface-elevated)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-black border border-[var(--border)] hover:border-[#D4AF37] backdrop-blur-md transition-all cursor-pointer shadow-xl active:scale-95 group-hover:opacity-100 opacity-90"
                title="الصورة التالية"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Auto Slide Indicator / Pause Toggle (Optional Control) */}
          {images.length > 1 && autoSlideEnabled && (
            <div className="absolute bottom-3 left-3 z-10">
              <button
                type="button"
                onClick={() => setIsPausedByUser((p) => !p)}
                className="p-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[10px] font-bold rounded-lg border border-[var(--border)] backdrop-blur-md flex items-center gap-1 cursor-pointer transition-colors"
                title={isPausedByUser ? 'تشغيل العرض التلقائي' : 'إيقاف العرض التلقائي مؤقتًا'}
              >
                {isPausedByUser ? (
                  <>
                    <Play className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">تشغيل التلقائي</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3 text-[#D6A83A]" />
                    <span className="hidden sm:inline">{autoSlideIntervalSeconds}ث</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Thumbnails Navigation Strip INSIDE the Same Gallery Container */}
        {images.length > 1 && (
          <div className="p-3 sm:p-4 bg-[var(--surface-elevated)] border-t border-[var(--border)] flex items-center justify-center gap-2.5 overflow-x-auto scrollbar-thin">
            {images.map((img, idx) => {
              if (failedImages.has(img)) return null;
              const isActive = activeIndex === idx || (failedImages.has(images[activeIndex]) && img === activeImageSrc);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-[var(--surface)] border-2 transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#D4AF37] shadow-md shadow-[#D4AF37]/25 scale-95 ring-2 ring-[#D4AF37]/30'
                      : 'border-[var(--border)] hover:border-[#D4AF37]/50 opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`عرض الصورة ${idx + 1}`}
                >
                  <img
                    src={getValidImageSrc(img)}
                    alt={`${productName} - مصغرة ${idx + 1}`}
                    onError={() => handleImageError(img)}
                    className="w-full h-full object-cover"
                  />
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-1 bg-[#D4AF37]" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          Full-Screen Interactive Zoom Modal
         ========================================================================= */}
      {isZoomOpen && (
        <div
          className="fixed inset-0 z-50 bg-[var(--overlay-heavy)] backdrop-blur-xl flex flex-col justify-between overflow-hidden animate-fade-in select-none"
          onWheel={handleWheelZoom}
        >
          {/* Zoom Modal Header */}
          <div className="p-4 bg-[var(--surface-elevated)] flex items-center justify-between z-20 gap-3 border-b border-[var(--border)] shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-md">
                {productName}
              </span>
              {images.length > 1 && (
                <span className="text-xs text-[#D4AF37] font-mono bg-[var(--surface)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                  {activeIndex + 1} من {images.length}
                </span>
              )}
            </div>

            {/* Zoom Controls & Close Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleZoomIn}
                aria-label="تكبير"
                className="p-2 bg-[var(--surface)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-black rounded-xl border border-[var(--border)] transition-all cursor-pointer"
                title="تكبير (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleZoomOut}
                aria-label="تصغير"
                className="p-2 bg-[var(--surface)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-black rounded-xl border border-[var(--border)] transition-all cursor-pointer"
                title="تصغير (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {zoomScale !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  aria-label="إعادة الضبط"
                  className="p-2 bg-[var(--surface)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-black rounded-xl border border-[var(--border)] transition-all cursor-pointer text-xs font-bold"
                  title="إعادة الحجم الطبيعي"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={closeZoom}
                aria-label="إغلاق التكبير"
                className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all cursor-pointer shadow-lg mr-2"
                title="إغلاق (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Zoom Modal Main Display Stage */}
          <div
            className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing p-4"
            onMouseDown={handleMouseDownZoom}
            onMouseMove={handleMouseMoveZoom}
            onMouseUp={handleMouseUpZoom}
            onTouchStart={handleZoomTouchStart}
            onTouchMove={handleZoomTouchMove}
            onTouchEnd={handleZoomTouchEnd}
            onClick={(e) => {
              // Close backdrop if scale is 1 and click wasn't on image or controls
              if (e.target === e.currentTarget && zoomScale === 1) {
                closeZoom();
              }
            }}
          >
            <img
              src={getValidImageSrc(activeImageSrc)}
              alt={productName}
              onError={() => handleImageError(activeImageSrc)}
              style={{
                transform: `scale(${zoomScale}) translate(${zoomPosition.x / zoomScale}px, ${zoomPosition.y / zoomScale}px)`,
                transition: isDraggingZoom ? 'none' : 'transform 0.2s cubic-bezier(0.1, 0.7, 0.1, 1)'
              }}
              className="max-w-full max-h-full object-contain pointer-events-auto"
              draggable={false}
            />

            {/* Navigation Arrows inside Modal */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="الصورة السابقة"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3.5 rounded-full bg-[var(--overlay)] hover:bg-[#D4AF37] text-white hover:text-black border border-white/20 transition-all cursor-pointer shadow-2xl backdrop-blur-md"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="الصورة التالية"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3.5 rounded-full bg-[var(--overlay)] hover:bg-[#D4AF37] text-white hover:text-black border border-white/20 transition-all cursor-pointer shadow-2xl backdrop-blur-md"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Zoom Modal Footer / Mini Thumbnails Strip */}
          {images.length > 1 && (
            <div className="p-4 bg-[var(--surface-elevated)] z-20 flex justify-center border-t border-[var(--border)]">
              <div className="flex items-center gap-2 overflow-x-auto max-w-full px-2 py-1 scrollbar-thin">
                {images.map((img, idx) => {
                  if (failedImages.has(img)) return null;
                  const isActive = activeIndex === idx || (failedImages.has(images[activeIndex]) && img === activeImageSrc);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActiveIndex(idx);
                        handleResetZoom();
                      }}
                      className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                        isActive
                          ? 'border-[#D4AF37] scale-105 shadow-lg shadow-[#D4AF37]/30'
                          : 'border-[var(--border)] opacity-50 hover:opacity-100'
                      }`}
                    >
                      <img src={getValidImageSrc(img)} alt={`Mini ${idx + 1}`} onError={() => handleImageError(img)} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
