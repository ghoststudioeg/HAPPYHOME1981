import React, { useEffect, useState } from 'react';
import { BundleOffer, Product } from '../../types';
import { bundleService, calculateBundleStock } from '../../lib/data/bundleService';
import { productService } from '../../lib/data/productService';
import { getValidImageSrc } from '../../utils/imageUtils';
import {
  Gift,
  ArrowLeft,
  Sparkles,
  CreditCard,
  CheckCircle2,
  ChevronLeft
} from 'lucide-react';

interface BundleOffersSectionProps {
  onSelectBundle: (slug: string) => void;
}

export function BundleOffersSection({ onSelectBundle }: BundleOffersSectionProps) {
  const [bundles, setBundles] = useState<BundleOffer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      bundleService.getHomeBundles(),
      productService.getAllProducts(false)
    ])
      .then(([homeBundles, prods]) => {
        if (!isMounted) return;
        setBundles(homeBundles);
        setAllProducts(prods);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load homepage bundle offers:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || bundles.length === 0) {
    return null;
  }

  const productsMap = new Map<string, Product>();
  allProducts.forEach((p) => productsMap.set(p.id, p));

  return (
    <section className="w-full py-8 sm:py-12 relative overflow-hidden" dir="rtl">
      {/* Background glow */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Gift className="w-4 h-4" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                عروض التوفير المركبة (باقات 2 في 1)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#D4AF37] text-black shadow-sm">
                عروض حصرية
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              وفّر أكثر واشترِ أجهزتك المفضلة معاً في باقة واحدة بأفضل سعر وأيسر خطة تقسيط.
            </p>
          </div>
        </div>

        {/* Bundles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bundles.map((bundle) => {
            const bundleProducts = bundle.productIds
              .map((id) => productsMap.get(id))
              .filter((p): p is Product => !!p);
            const stock = calculateBundleStock(bundleProducts);
            const hasStock = stock > 0;

            const originalSum = bundle.originalTotalPrice || bundleProducts.reduce((s, p) => s + (p.price || 0), 0);
            const savings = Math.max(0, originalSum - bundle.bundlePrice);

            return (
              <div
                key={bundle.id}
                onClick={() => onSelectBundle(bundle.slug || bundle.id)}
                className="glass-panel-elevated rounded-3xl border border-[var(--border)] overflow-hidden flex flex-col justify-between hover:border-[#D4AF37]/60 hover:shadow-[0_10px_35px_-10px_rgba(212,175,55,0.15)] transition-all duration-300 cursor-pointer group"
              >
                <div>
                  {/* Design Image Banner */}
                  <div className="relative w-full h-52 bg-black/70 overflow-hidden">
                    <img
                      src={getValidImageSrc(bundle.imageUrl)}
                      alt={bundle.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#D4AF37] text-black shadow-md">
                        {bundle.badgeText || '2 في 1'}
                      </span>
                      {savings > 0 && (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-600 text-white shadow-md">
                          وفر {savings.toLocaleString('ar-EG')} ج.م
                        </span>
                      )}
                    </div>

                    {/* Stock Status Indicator */}
                    <div className="absolute bottom-3 right-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold backdrop-blur-md border ${
                          hasStock
                            ? 'bg-black/60 text-white border-white/20'
                            : 'bg-rose-600/80 text-white border-rose-400'
                        }`}
                      >
                        {hasStock ? `متوفر جاهز للشحن (${stock} باقات)` : 'نفدت الكمية مؤقتاً'}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-base font-black text-[var(--text-primary)] group-hover:text-[#E0B84A] transition-colors line-clamp-1">
                      {bundle.name}
                    </h3>

                    {/* Included Products Thumbnails */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] shrink-0">
                        يشمل:
                      </span>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {bundleProducts.slice(0, 3).map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10 shrink-0"
                            title={p.name}
                          >
                            <img
                              src={getValidImageSrc(p.mainImageUrl)}
                              alt={p.name}
                              className="w-4 h-4 object-contain"
                            />
                            <span className="text-[10px] text-[var(--text-primary)] truncate max-w-[80px]">
                              {p.name}
                            </span>
                          </div>
                        ))}
                        {bundleProducts.length > 3 && (
                          <span className="text-[10px] text-[#D4AF37] font-bold">
                            +{bundleProducts.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price and Installment Details */}
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">سعر العرض:</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-[#D4AF37]">
                            {bundle.bundlePrice.toLocaleString('ar-EG')}
                          </span>
                          <span className="text-xs font-bold text-[#D4AF37]">ج.م</span>
                        </div>
                      </div>

                      {originalSum > bundle.bundlePrice && (
                        <div className="text-left">
                          <span className="text-xs line-through text-[var(--text-muted)] block">
                            {originalSum.toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Installment Badge */}
                    {bundle.installmentEnabled && (
                      <div className="p-2 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-between text-[11px] text-[#D4AF37] font-bold">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{bundle.installmentHeadline || 'متاح بالتقسيط المريح'}</span>
                        </div>
                        {bundle.defaultPlan && (
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {bundle.defaultPlan.monthlyPayment} ج/شهر × {bundle.defaultPlan.months}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-elevated)]/30 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                    <span>عرض تفاصيل الباقة</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    عرض لفترة محدودة
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
