import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React from 'react';
import { Product } from '../types';
import { Eye, Check, X, Sparkles, MessageCircle, Heart, ShoppingCart, Star } from 'lucide-react';
import { extractBrand } from '../lib/brandUtils';
import { catalogService } from '../lib/data/catalogService';
import { useAuth } from '../lib/authContext';
import { FlashSaleCountdown } from './FlashSaleCountdown';
import { getProductCanonicalSlug } from '../lib/seoUtils';


interface ProductCardProps {
  key?: React.Key;
  product: Product;
  onSelect: (slug: string) => void;
  whatsappNumber?: string;
  showQuickWhatsApp?: boolean;
  effectivePrice?: number;
  isCampaignActive?: boolean;
  isFlashSale?: boolean;
  flashSaleEndDate?: string;
  badgeText?: string;
}

export function ProductCard({
  product,
  onSelect,
  whatsappNumber,
  showQuickWhatsApp = false,
  effectivePrice,
  isCampaignActive = false,
  isFlashSale = false,
  flashSaleEndDate,
  badgeText
}: ProductCardProps) {
  const { isFavorite, toggleFavorite, addToCart } = useAuth();
  const favorited = isFavorite(product.id);

  const currentPrice = effectivePrice !== undefined && isCampaignActive ? effectivePrice : product.price;
  const originalPrice = isCampaignActive ? product.price : product.oldPrice;
  const hasDiscount = originalPrice && originalPrice > currentPrice;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : null;

  const brand = extractBrand(product.name);
  const targetSlug = getProductCanonicalSlug(product) || product.slug || product.id;

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!whatsappNumber) return;
    const url = catalogService.getWhatsAppInquiryUrl(whatsappNumber, product.name);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={() => onSelect(targetSlug)}
      className="group relative rounded-2xl overflow-hidden glass-card-interactive flex flex-col cursor-pointer liquid-reflection focus-visible:outline-2 focus-visible:outline-[#D4AF37] focus-visible:outline-offset-2"
      dir="rtl"
      role="article"
      aria-label={`منتج: ${product.name}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(targetSlug);
        }
      }}
    >
      {/* Product Image Stage - Realistic aspect ratio, no aggressive cropping */}
      <div className="relative aspect-[4/3] w-full bg-[var(--surface-elevated)] border-b border-[var(--border)] overflow-hidden flex items-center justify-center p-2 sm:p-3">
        {/* Soft radial ambient glow behind phone/product */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.08)_0%,transparent_70%)] opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <img
          src={getValidImageSrc(product.mainImageUrl || '/logo.svg')}
          alt={product.name}
          className="w-full h-full object-contain drop-shadow-[0_12px_24px_var(--shadow)] group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 flex flex-col gap-1 z-10">
          {isFlashSale ? (
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-rose-600 to-amber-600 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md border border-rose-400/40 animate-pulse">
              <Sparkles className="w-2.5 h-2.5 text-amber-200" />
              <span>{badgeText || 'عرض لفترة محدودة'}</span>
            </span>
          ) : product.isFeatured ? (
            <span className="inline-flex items-center gap-1 bg-[#D4AF37] text-[#05080D] text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-0.5 rounded-lg shadow-md tracking-tight">
              <Sparkles className="w-2.5 h-2.5" />
              <span>مميز</span>
            </span>
          ) : null}
          {isCampaignActive && discountPercent ? (
            <span className="bg-[#D4AF37] text-[#05080D] text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-lg shadow-sm">
              وفر {discountPercent}%
            </span>
          ) : discountPercent ? (
            <span className="bg-rose-500/90 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-lg shadow-sm border border-rose-400/30">
              خصم {discountPercent}%
            </span>
          ) : null}
        </div>

        {/* Brand Tag & Favorite Heart Button Top Left */}
        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(product);
            }}
            title={favorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            aria-label={favorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl backdrop-blur-md border transition-all flex items-center justify-center cursor-pointer shadow-md active:scale-90 ${
              favorited
                ? 'bg-rose-500/25 border-rose-500/50 text-rose-400'
                : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-400/40'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${favorited ? 'fill-rose-400 text-rose-400 scale-110' : ''}`} />
          </button>
          <span className="glass-pill text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] truncate max-w-[70px] sm:max-w-none">
            {brand}
          </span>
        </div>

        {/* Color Indicators Preview (if available) */}
        {product.colors && product.colors.length > 0 && (
          <div className="absolute bottom-2 left-2 sm:bottom-2.5 sm:left-2.5 z-10 flex items-center gap-1 bg-[var(--surface-elevated)] backdrop-blur-md px-1.5 py-1 rounded-full border border-[var(--border)]">
            {product.colors.slice(0, 4).map((col, idx) => (
              <span
                key={idx}
                title={col.name}
                className="w-2.5 h-2.5 rounded-full border border-white/20"
                style={{ backgroundColor: col.hex || '#64748b' }}
              />
            ))}
            {product.colors.length > 4 && (
              <span className="text-[9px] text-[var(--text-muted)] px-0.5">+{product.colors.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-2.5 sm:p-4 flex flex-col flex-1 justify-between bg-gradient-to-b from-transparent to-white/[0.01]">
        <div>
          {/* Category */}
          {product.categoryName && (
            <div className="text-[var(--text-secondary)] text-[9.5px] sm:text-[10.5px] font-medium tracking-wide mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/80 shrink-0" />
              <span className="truncate">{product.categoryName}</span>
            </div>
          )}

          {/* Product Name */}
          <h3 className="font-bold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-[#E0B84A] transition-colors line-clamp-2 leading-snug mb-1">
            {product.name}
          </h3>

          {/* Rating Display */}
          <div className="flex items-center gap-1.5 my-1 text-[10px]">
            {product.reviewCount && product.reviewCount > 0 && product.averageRating ? (
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5 text-[#D4AF37]">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${
                        star <= Math.round(product.averageRating || 0) ? 'fill-[#D4AF37]' : 'text-[var(--text-muted)]'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-[#E0B84A] font-mono">{product.averageRating.toFixed(1)}</span>
                <span className="text-[var(--text-muted)]">({product.reviewCount})</span>
              </div>
            ) : (
              <span className="text-[var(--text-muted)] text-[9.5px]">لا توجد تقييمات بعد</span>
            )}
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-[var(--border)]">
          {/* Flash Sale Countdown (if active) */}
          {isFlashSale && flashSaleEndDate && (
            <div className="mb-2">
              <FlashSaleCountdown endDate={flashSaleEndDate} compact={true} className="w-full justify-center" />
            </div>
          )}

          {/* Price & Availability */}
          <div className="flex items-baseline justify-between gap-1 mb-2.5">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-[#E0B84A] font-black text-sm sm:text-lg tracking-tight">
                {currentPrice.toLocaleString('ar-EG')}{' '}
                <span className="text-[10px] sm:text-[11px] font-bold text-[#D4AF37]">ج.م</span>
              </span>
              {hasDiscount && (
                <span className="text-[var(--text-muted)] text-[10px] sm:text-[11px] line-through font-mono">
                  {originalPrice?.toLocaleString('ar-EG')}
                </span>
              )}
              {isFlashSale ? (
                <span className="text-[8.5px] bg-rose-500/15 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30 font-bold">
                  {badgeText || 'عرض لفترة محدودة'}
                </span>
              ) : isCampaignActive ? (
                <span className="text-[8.5px] bg-[#D4AF37]/15 text-[#D4AF37] px-1.5 py-0.5 rounded border border-[#D4AF37]/30 font-bold">
                  {badgeText || 'سعر العرض'}
                </span>
              ) : null}
            </div>

            {/* In Stock Indicator */}
            <div className="shrink-0 text-[9.5px] sm:text-[10.5px]">
              {product.isAvailable ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-500 font-medium">
                  <Check className="w-3 h-3" />
                  <span>متوفر</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[var(--text-muted)] font-medium">
                  <X className="w-3 h-3" />
                  <span>نفد</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => onSelect(product.slug)}
              className="flex-1 py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] transition-all duration-200 flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer shadow-xs active:scale-98"
            >
              <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>تفاصيل</span>
            </button>

            <button
              type="button"
              disabled={!product.isAvailable}
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product.id, 1);
              }}
              className="flex-1 py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-xl text-[10px] sm:text-[11px] font-black bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-0.5 sm:gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>أضف للسلة</span>
            </button>

            {showQuickWhatsApp && whatsappNumber && (
              <button
                type="button"
                onClick={handleWhatsApp}
                title="طلب فوري عبر واتساب"
                className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
