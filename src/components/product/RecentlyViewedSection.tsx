import { resolveImageUrl } from '../../utils/imageUtils';
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, RecentlyViewedItem, StoreSettings } from '../../types';
import { recentlyViewedService } from '../../lib/data/recentlyViewedService';
import { productService } from '../../lib/data/productService';
import { settingsService } from '../../lib/data/settingsService';
import { homepageService } from '../../lib/data/homepageService';
import { getEffectiveProductPrice } from '../../lib/campaignPricing';
import { useAuth } from '../../lib/authContext';
import {
  Clock,
  Trash2,
  X,
  ShoppingCart,
  Heart,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  Package
} from 'lucide-react';

interface RecentlyViewedSectionProps {
  excludeProductId?: string;
  navigate: (path: string) => void;
  title?: string;
  subtitle?: string;
  limit?: number;
  className?: string;
  showClearButton?: boolean;
}

export function RecentlyViewedSection({
  excludeProductId,
  navigate,
  title = 'شوهدت مؤخرًا',
  subtitle = 'منتجات قمت بتصفحها مؤخرًا أثناء زيارتك',
  limit = 10,
  className = '',
  showClearButton = true
}: RecentlyViewedSectionProps) {
  const { user, isFavorite, toggleFavorite, addToCart } = useAuth();
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeBanners, setActiveBanners] = useState<any[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recentItems, prods, banners, setts] = await Promise.all([
        recentlyViewedService.getRecentlyViewed(user?.uid, excludeProductId, limit),
        productService.getAllProducts(false),
        homepageService.getActiveBanners().catch(() => []),
        settingsService.getSettings().catch(() => null)
      ]);

      setItems(recentItems || []);
      setAllProducts(prods || []);
      setActiveBanners(banners || []);
      setSettings(setts);
    } catch (e) {
      console.warn('Error loading recently viewed products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('recently_viewed_changed', handleUpdate);
    return () => {
      window.removeEventListener('recently_viewed_changed', handleUpdate);
    };
  }, [user?.uid, excludeProductId, limit]);

  // Map recently viewed items to live, valid, published products
  const liveProducts = useMemo(() => {
    if (!items || items.length === 0 || !allProducts || allProducts.length === 0) {
      return [];
    }

    const prodMap = new Map<string, Product>();
    for (const p of allProducts) {
      if (p.isPublished !== false) {
        prodMap.set(p.id, p);
      }
    }

    const result: { recentItem: RecentlyViewedItem; product: Product }[] = [];

    for (const item of items) {
      const prod = prodMap.get(item.productId);
      if (prod) {
        result.push({ recentItem: item, product: prod });
      }
    }

    return result;
  }, [items, allProducts]);

  const handleRemoveItem = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    try {
      await recentlyViewedService.removeRecentlyViewed(productId, user?.uid);
      setItems(prev => prev.filter(i => i.productId !== productId));
    } catch (err) {
      console.warn('Error removing recently viewed item:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await recentlyViewedService.clearRecentlyViewed(user?.uid);
      setItems([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.warn('Error clearing recently viewed history:', err);
    }
  };

  // If no items, do not render section
  if (!loading && liveProducts.length === 0) {
    return null;
  }

  if (loading && items.length === 0) {
    return null;
  }

  return (
    <section className={`w-full rounded-2xl sm:rounded-3xl glass-panel p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 border border-[var(--border)] ${className}`} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#E0B84A] shadow-inner shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg lg:text-xl font-black text-[var(--text-primary)]">{title}</h3>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[#D4AF37] border border-[var(--border)]">
                {liveProducts.length}
              </span>
            </div>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Clear History Button */}
        {showClearButton && liveProducts.length > 0 && (
          <div className="relative">
            {showClearConfirm ? (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[11px] font-bold text-rose-400">مسح الكل؟</span>
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-sm cursor-pointer"
                >
                  نعم، احذف
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-rose-400 transition-colors py-1.5 px-3 rounded-xl bg-[var(--surface-elevated)] hover:bg-rose-500/10 border border-[var(--border)] hover:border-rose-500/20 cursor-pointer"
                title="مسح سجل المنتجات التي شاهدتها"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold">مسح السجل</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Products Slider / Horizontal Scroll / Grid */}
      <div className="relative">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          <AnimatePresence>
            {liveProducts.map(({ product, recentItem }) => {
              const pricing = getEffectiveProductPrice(product, activeBanners);
              const favorited = isFavorite(product.id);
              const isAvailable = product.isAvailable && product.stockStatus !== 'out_of_stock';

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => navigate(`/product/${product.slug || product.id}`)}
                  className="group relative bg-[var(--surface)] hover:bg-[var(--surface-elevated)] rounded-xl sm:rounded-2xl border border-[var(--border)] hover:border-[#D4AF37]/40 p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-lg cursor-pointer"
                >
                  {/* Remove Button */}
                  <button
                    onClick={(e) => handleRemoveItem(e, product.id)}
                    className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-[var(--overlay-heavy)] hover:bg-rose-500 text-white/80 hover:text-white flex items-center justify-center opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-md"
                    title="إزالة من السجل"
                    aria-label="إزالة من السجل"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product);
                    }}
                    className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                      favorited
                        ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                        : 'bg-[var(--overlay)] text-white/70 hover:text-rose-500 opacity-80 sm:opacity-0 group-hover:opacity-100'
                    }`}
                    title={favorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>

                  <div>
                    {/* Image Container */}
                    <div className="relative w-full aspect-square rounded-lg sm:rounded-xl bg-[var(--surface-elevated)] p-2 mb-2 sm:mb-2.5 flex items-center justify-center overflow-hidden border border-[var(--border)]">
                      {(() => {
                        const resolvedImg = resolveImageUrl(product.mainImageUrl);
                        if (resolvedImg) {
                          return (
                            <img
                              src={resolvedImg}
                              alt={product.name}
                              loading="lazy"
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                          );
                        }
                        return (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center select-none bg-gradient-to-b from-[#0A1A30]/60 to-[#050B14]/80">
                            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37] mb-1 group-hover:scale-105 transition-transform duration-300">
                              <Package className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold text-[#E2E8F0] line-clamp-1 max-w-[90%]">
                              {product.name}
                            </span>
                          </div>
                        );
                      })()}
                      {pricing.isCampaignActive && (
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#05080D] text-[9px] font-black flex items-center gap-0.5 shadow-sm z-10">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>عرض</span>
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    {product.categoryName && (
                      <span className="text-[9px] font-bold text-[#D4AF37] truncate block mb-0.5">
                        {product.categoryName}
                      </span>
                    )}

                    {/* Name */}
                    <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2 min-h-[2rem] leading-snug group-hover:text-[#E0B84A] transition-colors">
                      {product.name}
                    </h4>
                  </div>

                  {/* Pricing & Actions */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--border)] space-y-2">
                    <div className="flex items-baseline justify-between gap-1 flex-wrap">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm sm:text-base font-black text-[#D4AF37]">
                          {pricing.effectivePrice.toLocaleString('ar-EG')}
                        </span>
                        <span className="text-[10px] font-black text-[#D4AF37]">ج.م</span>
                      </div>

                      {pricing.isCampaignActive && pricing.originalBasePrice > pricing.effectivePrice ? (
                        <span className="text-[10px] text-[var(--text-muted)] line-through">
                          {pricing.originalBasePrice.toLocaleString('ar-EG')}
                        </span>
                      ) : product.oldPrice && product.oldPrice > product.price ? (
                        <span className="text-[10px] text-[var(--text-muted)] line-through">
                          {product.oldPrice.toLocaleString('ar-EG')}
                        </span>
                      ) : null}
                    </div>

                    {/* Quick Add to Cart Button */}
                    <button
                      disabled={!isAvailable}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product.id, 1);
                      }}
                      className="w-full py-1.5 px-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-[#05080D] font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:hover:bg-[var(--surface-elevated)] disabled:hover:text-[var(--text-primary)] cursor-pointer active:scale-95"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>{isAvailable ? 'أضف للسلة' : 'نفد المخزون'}</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
