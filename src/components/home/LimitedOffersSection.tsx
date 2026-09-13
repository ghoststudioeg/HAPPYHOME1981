import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useEffect } from 'react';
import { LimitedOffer } from '../../types';
import { Clock, Flame, MessageCircle, Eye, Sparkles } from 'lucide-react';
import { catalogService } from '../../lib/data/catalogService';
import { productService } from '../../lib/data/productService';


interface LimitedOffersSectionProps {
  offers: LimitedOffer[];
  whatsappNumber: string;
  onSelectProduct: (slug: string) => void;
}

export function LimitedOffersSection({
  offers,
  whatsappNumber,
  onSelectProduct
}: LimitedOffersSectionProps) {
  // Realtime clock ticker for countdown
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter valid active offers based on current time
  const activeOffers = offers.filter((offer) => {
    if (!offer.isActive) return false;
    const start = new Date(`${offer.startDate}T${offer.startTime || '00:00'}:00`).getTime();
    const end = new Date(`${offer.endDate}T${offer.endTime || '23:59'}:00`).getTime();
    if (isNaN(start) || isNaN(end)) return false;
    return now >= start && now <= end;
  });

  if (activeOffers.length === 0) return null;

  const handleWhatsAppInquiry = async (offer: LimitedOffer) => {
    if (offer.productId) {
      try {
        await productService.incrementWhatsAppClicks(offer.productId);
      } catch (e) {
        console.warn('Could not record whatsapp click:', e);
      }
    }
    const message = `مرحبًا، أريد الاستفسار عن عرض: ${offer.productName}`;
    const url = catalogService.getWhatsAppUrl(whatsappNumber, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="w-full py-8 sm:py-12 relative overflow-hidden" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#E0B84A] flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
                  عروض لفترة محدودة
                </h2>
                <span className="text-[10px] sm:text-[11px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                  فرصة استثنائية
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                تخفيضات استثنائية تنتهي بانتهاء الوقت المحدد
              </p>
            </div>
          </div>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeOffers.map((offer) => {
            const endMs = new Date(`${offer.endDate}T${offer.endTime || '23:59'}:00`).getTime();
            const diffMs = Math.max(0, endMs - now);

            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            return (
              <div
                key={offer.id}
                className="relative rounded-3xl overflow-hidden glass-panel-elevated border border-[#D4AF37]/35 p-5 sm:p-7 flex flex-col justify-between group liquid-reflection shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
              >
                {/* Subtle Ambient Background */}
                {offer.productImage && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-10 blur-3xl pointer-events-none scale-125"
                    style={{ backgroundImage: `url(${offer.productImage})` }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#07111C] via-[#07111C]/80 to-transparent pointer-events-none" />

                <div className="relative z-10">
                  {/* Top Bar: Flash Badge & Discount */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl glass-pill-gold text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>عرض محدود</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-500/20 border border-rose-500/35 text-rose-400 font-black text-xs">
                      خصم {offer.discountPercent}%
                    </span>
                  </div>

                  {/* Main Product Presentation */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center mb-6">
                    {/* Image */}
                    <div className="sm:col-span-5 aspect-[4/3] rounded-2xl bg-[#05080D] border border-white/[0.08] overflow-hidden flex items-center justify-center p-2 shrink-0">
                      <img
                        src={getValidImageSrc(offer.productImage || '/logo.svg')}
                        alt={offer.productName}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    {/* Details */}
                    <div className="sm:col-span-7 space-y-2.5">
                      <h3 className="text-base sm:text-lg font-black text-[#F8FAFC] leading-snug">
                        {offer.productName}
                      </h3>

                      {offer.productDescription && (
                        <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed">
                          {offer.productDescription}
                        </p>
                      )}

                      {/* Pricing */}
                      <div className="flex items-baseline gap-2.5 pt-1">
                        <span className="text-2xl sm:text-3xl font-black text-[#E0B84A] tracking-tight">
                          {offer.offerPrice.toLocaleString('ar-EG')}{' '}
                          <span className="text-xs font-bold text-[#D4AF37]">ج.م</span>
                        </span>
                        {offer.originalPrice > offer.offerPrice && (
                          <span className="text-xs sm:text-sm text-[#64748B] line-through">
                            {offer.originalPrice.toLocaleString('ar-EG')} ج.م
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Live Countdown Display */}
                  <div className="p-4 rounded-2xl bg-[#05080D]/80 border border-white/[0.08] mb-5">
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                      <span className="font-bold text-[#94A3B8] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>ينتهي العرض خلال:</span>
                      </span>
                      <span className="text-[10px] text-[#E0B84A] font-mono">عداد مباشر</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center" dir="ltr">
                      {/* Days */}
                      <div className="glass-panel rounded-xl p-2 border border-white/[0.06]">
                        <span className="text-lg sm:text-xl font-black text-[#F8FAFC] font-mono block">
                          {String(days).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] text-[#94A3B8] font-sans">أيام</span>
                      </div>

                      {/* Hours */}
                      <div className="glass-panel rounded-xl p-2 border border-white/[0.06]">
                        <span className="text-lg sm:text-xl font-black text-[#F8FAFC] font-mono block">
                          {String(hours).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] text-[#94A3B8] font-sans">ساعات</span>
                      </div>

                      {/* Minutes */}
                      <div className="glass-panel rounded-xl p-2 border border-white/[0.06]">
                        <span className="text-lg sm:text-xl font-black text-[#F8FAFC] font-mono block">
                          {String(minutes).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] text-[#94A3B8] font-sans">دقائق</span>
                      </div>

                      {/* Seconds */}
                      <div className="glass-panel rounded-xl p-2 border border-[#D4AF37]/40 text-[#E0B84A]">
                        <span className="text-lg sm:text-xl font-black font-mono block animate-pulse">
                          {String(seconds).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] text-[#E0B84A]/80 font-sans">ثواني</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleWhatsAppInquiry(offer)}
                    className="py-3 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-emerald-500/25 active:scale-98"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>طلب العرض عبر واتساب</span>
                  </button>

                  {offer.productSlug && (
                    <button
                      type="button"
                      onClick={() => onSelectProduct(offer.productSlug!)}
                      className="py-3 px-4 rounded-xl text-xs font-bold glass-pill hover:bg-white/[0.08] text-[#F8FAFC] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <Eye className="w-4 h-4" />
                      <span>تفاصيل المنتج</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
