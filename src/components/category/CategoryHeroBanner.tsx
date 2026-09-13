import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React from 'react';
import { Flame, Sparkles, MessageCircle, ArrowLeft, Clock, Percent } from 'lucide-react';
import { Category, Product } from '../../types';
import { catalogService } from '../../lib/data/catalogService';


interface CategoryHeroBannerProps {
  category: Category;
  products?: Product[];
  whatsappNumber?: string;
  onNavigate: (path: string) => void;
}

export function CategoryHeroBanner({
  category,
  products = [],
  whatsappNumber = '201555577122',
  onNavigate
}: CategoryHeroBannerProps) {
  const hero = category.hero;

  // If hero is disabled or not configured
  if (!hero || !hero.enabled) {
    return null;
  }

  // Check scheduling dates
  const now = Date.now();
  if (hero.startDate) {
    const start = new Date(hero.startDate).getTime();
    if (!isNaN(start) && now < start) return null;
  }
  if (hero.endDate) {
    const end = new Date(hero.endDate.includes('T') ? hero.endDate : `${hero.endDate}T23:59:59`).getTime();
    if (!isNaN(end) && now > end) return null;
  }

  // Linked product lookup
  const linkedProduct = hero.productId ? products.find((p) => p.id === hero.productId) : null;

  // Resolve display fields
  const title = hero.title || linkedProduct?.name || category.name;
  const subtitle = hero.subtitle || linkedProduct?.description || category.description;
  const badgeText = hero.badgeText || (linkedProduct ? 'عرض خاص بالقسم' : 'مميز في القسم');
  
  // Desktop vs Mobile image resolution
  const desktopImg = hero.desktopImageUrl || hero.mobileImageUrl;
  const mobileImg = hero.mobileImageUrl || desktopImg;
  const imageSizeMode = hero.imageSizeMode || 'contain';

  // Pricing if linked product exists
  const price = linkedProduct?.price;
  const oldPrice = linkedProduct?.oldPrice;
  const discountPercent = oldPrice && price && oldPrice > price
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : undefined;

  const handleCtaClick = () => {
    if (hero.ctaType === 'whatsapp' || (!hero.ctaType && !hero.ctaLink && !linkedProduct)) {
      const msg = `مرحبًا، أود الاستفسار عن عروض قسم ${category.name}: ${title}`;
      const url = catalogService.getWhatsAppUrl(whatsappNumber, msg);
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (hero.ctaType === 'product_page' && linkedProduct) {
      onNavigate(`/product/${linkedProduct.slug}`);
    } else if (hero.ctaType === 'custom_link' && hero.ctaLink) {
      if (hero.ctaLink.startsWith('http')) {
        window.open(hero.ctaLink, '_blank', 'noopener,noreferrer');
      } else {
        onNavigate(hero.ctaLink);
      }
    } else if (hero.ctaLink) {
      if (hero.ctaLink.startsWith('http')) {
        window.open(hero.ctaLink, '_blank', 'noopener,noreferrer');
      } else {
        onNavigate(hero.ctaLink);
      }
    } else if (linkedProduct) {
      onNavigate(`/product/${linkedProduct.slug}`);
    } else {
      const msg = `مرحبًا، أود الاستفسار عن قسم: ${category.name}`;
      const url = catalogService.getWhatsAppUrl(whatsappNumber, msg);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1728]/95 via-[#08111E]/95 to-[#040912]/95 border border-[#D6A83A]/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)] min-h-[320px] sm:min-h-[380px] flex items-center" dir="rtl">
      
      {/* Background Image Container with Desktop & Mobile Picture handling */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <picture>
          <source media="(max-width: 639px)" srcSet={mobileImg} />
          <img
            src={getValidImageSrc(desktopImg)}
            alt={title}
            className="w-full h-full object-cover opacity-20 sm:opacity-25 filter blur-[2px] scale-105"
          />
        </picture>
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050B14] via-[#050B14]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050B14] via-[#050B14]/60 to-transparent" />
      </div>

      {/* Top right gold light flare */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#D6A83A]/[0.08] blur-[80px] pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 w-full p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Text Details */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-[#D6A83A]/20 to-[#F0C24F]/10 border border-[#D6A83A]/40 text-[#F0C24F] font-bold text-xs shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#D6A83A]" />
              <span>{badgeText}</span>
            </span>

            {discountPercent && discountPercent > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-black text-xs">
                <Percent className="w-3 h-3" />
                <span>خصم {discountPercent}%</span>
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#F5F7FA] tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm lg:text-base text-[#AAB4C3] max-w-2xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {price && price > 0 && (
            <div className="flex items-baseline gap-3 pt-1">
              <div className="flex items-baseline gap-1.5 bg-[#070D16]/80 border border-white/[0.08] px-4 py-2 rounded-2xl">
                <span className="text-xs text-[#AAB4C3]">السعر:</span>
                <span className="text-xl sm:text-2xl font-black text-[#F0C24F]">
                  {price.toLocaleString('ar-EG')}
                </span>
                <span className="text-xs font-bold text-[#D6A83A]">ج.م</span>
              </div>

              {oldPrice && oldPrice > price && (
                <div className="flex items-baseline gap-1 text-xs text-[#9CA9BA]/60 line-through">
                  <span>{oldPrice.toLocaleString('ar-EG')}</span>
                  <span>ج.م</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={handleCtaClick}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#D6A62E] to-[#F0C24F] hover:from-[#E0B64B] hover:to-[#F7CE68] text-[#050B14] font-black text-xs sm:text-sm transition-all duration-200 shadow-[0_4px_20px_rgba(214,166,46,0.35)] flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{hero.ctaText || 'استفسر الآن'}</span>
            </button>

            {linkedProduct && (
              <button
                type="button"
                onClick={() => onNavigate(`/product/${linkedProduct.slug}`)}
                className="px-5 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-[#F5F7FA] font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>مشاهدة المنتج</span>
                <ArrowLeft className="w-4 h-4 text-[#D6A83A]" />
              </button>
            )}
          </div>
        </div>

        {/* Featured Image Column */}
        <div className="lg:col-span-4 flex items-center justify-center relative mt-4 lg:mt-0">
          <div className={`relative w-full max-w-[240px] sm:max-w-[280px] ${imageSizeMode === 'cover' ? 'aspect-square' : 'min-h-[200px] sm:min-h-[240px]'} flex items-center justify-center rounded-2xl overflow-hidden bg-[#05080D]/40`}>
            <div className="absolute inset-2 rounded-full bg-[#D6A83A]/15 blur-2xl pointer-events-none" />
            <picture className="relative z-10 w-full h-full flex items-center justify-center">
              <source media="(max-width: 639px)" srcSet={mobileImg} />
              <img
                src={getValidImageSrc(desktopImg)}
                alt={title}
                className={`w-full h-full ${imageSizeMode === 'cover' ? 'object-cover' : 'object-contain'} drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] hover:scale-105 transition-transform duration-500`}
              />
            </picture>
          </div>
        </div>

      </div>
    </div>
  );
}
