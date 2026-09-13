import React, { useMemo } from 'react';
import { Promotion, Product } from '../../types';
import { Flame, Sparkles, ArrowLeft, Clock } from 'lucide-react';
import { ProductCard } from '../ProductCard';
import { FlashSaleCountdown } from '../FlashSaleCountdown';
import { getEffectiveProductPrice } from '../../lib/campaignPricing';

interface FlashSaleSectionProps {
  promotions: Promotion[];
  products: Product[];
  whatsappNumber?: string;
  onSelectProduct: (slug: string) => void;
  onExpire?: () => void;
}

export function FlashSaleSection({
  promotions,
  products,
  whatsappNumber,
  onSelectProduct,
  onExpire
}: FlashSaleSectionProps) {
  // Filter active flash sales
  const activeFlashSales = useMemo(() => {
    const now = Date.now();
    return promotions.filter((promo) => {
      if (promo.isActive === false || !promo.isFlashSale) return false;
      const start = promo.startDate ? new Date(promo.startDate).getTime() : 0;
      const end = promo.endDate
        ? new Date(promo.endDate.includes('T') ? promo.endDate : `${promo.endDate}T23:59:59`).getTime()
        : Infinity;
      return now >= start && now <= end;
    });
  }, [promotions]);

  // Find all products covered by active flash sales
  const flashSaleProductEntries = useMemo(() => {
    if (activeFlashSales.length === 0 || !products || products.length === 0) return [];

    const list: { product: Product; promotion: Promotion; effectivePrice: number; discountPercent: number | null }[] = [];
    const seenProductIds = new Set<string>();

    for (const promo of activeFlashSales) {
      for (const prod of products) {
        if (seenProductIds.has(prod.id)) continue;

        const isTargeted =
          (Array.isArray(promo.productIds) && promo.productIds.includes(prod.id)) ||
          (Boolean(prod.categoryId) && Array.isArray(promo.categoryIds) && promo.categoryIds.includes(prod.categoryId!));

        if (isTargeted) {
          const pricing = getEffectiveProductPrice(prod, [], [promo]);
          if (pricing.effectivePrice < prod.price) {
            seenProductIds.add(prod.id);
            list.push({
              product: prod,
              promotion: promo,
              effectivePrice: pricing.effectivePrice,
              discountPercent: pricing.discountPercent
            });
          }
        }
      }
    }

    return list;
  }, [activeFlashSales, products]);

  if (activeFlashSales.length === 0 || flashSaleProductEntries.length === 0) {
    return null;
  }

  // Find nearest ending date among active flash sales for section header
  const earliestEndingSale = activeFlashSales.reduce((prev, curr) => {
    const prevEnd = new Date(prev.endDate).getTime();
    const currEnd = new Date(curr.endDate).getTime();
    return currEnd < prevEnd ? curr : prev;
  }, activeFlashSales[0]);

  return (
    <section id="homepage-flash-sales-section" className="w-full py-8 sm:py-12 relative overflow-hidden" dir="rtl">
      {/* Dynamic Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-72 bg-gradient-to-r from-rose-600/10 via-amber-500/10 to-rose-600/10 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header with Live Countdown */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 glass-panel-elevated bg-[var(--surface-elevated)] p-5 sm:p-7 rounded-3xl border border-rose-500/30 shadow-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/30 to-amber-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-lg">
              <Flame className="w-6 h-6 animate-pulse text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  عروض لفترة محدودة (فلاش سيل)
                </h2>
                <span className="text-[10px] sm:text-xs font-black text-rose-500 dark:text-rose-300 bg-rose-500/15 border border-rose-500/40 px-3 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-300" />
                  <span>تخفيضات استثنائية</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                أسعار حصرية ومخفضة تنتهي فوراً بانتهاء العداد التنازلي.
              </p>
            </div>
          </div>

          {/* Section Master Timer */}
          {earliestEndingSale && (
            <div className="flex flex-col items-start md:items-end w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-[var(--border)]">
              <span className="text-[11px] font-bold text-[var(--text-secondary)] mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-rose-400" />
                <span>ينتهي أقرب عرض خلال:</span>
              </span>
              <FlashSaleCountdown
                endDate={earliestEndingSale.endDate}
                onExpire={onExpire}
              />
            </div>
          )}
        </div>

        {/* Product Cards Grid with Promotional Prices & Live Timers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {flashSaleProductEntries.map(({ product, promotion, effectivePrice }) => (
            <ProductCard
              key={product.id}
              product={product}
              effectivePrice={effectivePrice}
              isCampaignActive={true}
              isFlashSale={true}
              flashSaleEndDate={promotion.endDate}
              badgeText={promotion.badgeText || 'عرض لفترة محدودة'}
              onSelect={(slug) => onSelectProduct(slug)}
              whatsappNumber={whatsappNumber}
              showQuickWhatsApp={true}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
