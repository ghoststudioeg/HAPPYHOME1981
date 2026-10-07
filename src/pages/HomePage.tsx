import React, { useEffect, useState } from 'react';
import { catalogService, HomeCatalogData } from '../lib/data/catalogService';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { NewsTicker } from '../components/home/NewsTicker';
import { HeroBannerSlider } from '../components/home/HeroBannerSlider';
import { CategoryGrid } from '../components/home/CategoryGrid';
import { NewArrivalsSection } from '../components/home/NewArrivalsSection';
import { LimitedOffersSection } from '../components/home/LimitedOffersSection';
import { FlashSaleSection } from '../components/home/FlashSaleSection';
import { ComingSoonSection } from '../components/home/ComingSoonSection';
import { RecommendedProductsSection } from '../components/home/RecommendedProductsSection';
import { WhatsAppCtaBanner } from '../components/home/WhatsAppCtaBanner';
import { AboutBeitElSaeedSection } from '../components/home/AboutBeitElSaeedSection';
import { BundleOffersSection } from '../components/home/BundleOffersSection';
import { ShopByBrandSection } from '../components/home/ShopByBrandSection';
import { useAuth } from '../lib/authContext';
import { ProductCard } from '../components/ProductCard';

interface HomePageProps {
  navigate: (path: string) => void;
}

export function HomePage({ navigate }: HomePageProps) {
  console.log('[BOOT 6] HomePage render started');
  const { user, isAdmin, favoriteIds } = useAuth();
  const [data, setData] = useState<HomeCatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await catalogService.getHomeData();
      setData(res);
    } catch (err: any) {
      console.error('Error loading homepage catalog data:', err);
      setError('تعذر الاتصال بقاعدة البيانات، يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8" dir="rtl">
      <div className="h-10 bg-[#07111C]/60 rounded-xl border border-white/[0.06] animate-pulse" />
      <div className="h-72 sm:h-96 bg-[#07111C]/60 rounded-3xl border border-white/[0.06] animate-pulse" />
      <LoadingSkeleton type="category-list" count={4} />
      <LoadingSkeleton type="grid" count={4} />
    </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto my-16 px-4" dir="rtl">
        <ErrorState message={error || 'تعذر تحميل بيانات الكتالوج'} onRetry={loadData} />
      </div>
    );
  }

  const {
    settings,
    homepageSettings,
    categories,
    newArrivals,
    limitedOffers,
    comingSoonItems,
    heroBanners,
    newsTickerItems,
    allProducts
  } = data;

  const favoriteProducts = allProducts ? allProducts.filter((p) => favoriteIds.has(p.id)) : [];

  const showTicker = homepageSettings.newsTickerEnabled !== false && newsTickerItems && newsTickerItems.length > 0;
  const showHero = homepageSettings.heroBannersEnabled !== false && heroBanners && heroBanners.length > 0;
  const showCategories = homepageSettings.categoriesEnabled !== false && categories && categories.length > 0;
  const showNewArrivals = homepageSettings.newArrivalsEnabled !== false && newArrivals && newArrivals.length > 0;
  const showLimitedOffers = homepageSettings.limitedOffersEnabled !== false && limitedOffers && limitedOffers.length > 0;
  const showComingSoon = homepageSettings.comingSoonEnabled !== false && comingSoonItems && comingSoonItems.length > 0;

  console.log('[BOOT 9] UI rendering products. Count:', newArrivals?.length);
  return (
    <div className="w-full space-y-6 sm:space-y-10 pb-16" dir="rtl">
      
      {/* 1. News Ticker (شريط الأخبار والإعلانات التفاعلي) */}
      {showTicker && (
        <NewsTicker
          items={newsTickerItems}
          speed={homepageSettings.newsTickerSpeed || 5}
          direction={homepageSettings.newsTickerDirection || 'rtl'}
          bgStyle={homepageSettings.newsTickerBgStyle || 'dark'}
          onNavigate={(path) => navigate(path)}
        />
      )}

      {/* 2. Hero Banner Slider (سلايدر إعلانات الهيرو الفاخر) */}
      {showHero && (
        <HeroBannerSlider
          banners={heroBanners}
          settings={settings}
          allProducts={allProducts}
          intervalSeconds={homepageSettings.heroSlideIntervalSeconds || 6}
          onNavigate={(path) => navigate(path)}
        />
      )}

      {/* 3. Categories Grid (أقسام المتجر الرئيسية) */}
      {showCategories && (
        <CategoryGrid
          categories={categories}
          products={allProducts}
          onSelectCategory={(slug) => navigate(`/category/${slug}`)}
        />
      )}

      {/* 4. Shop By Brand Section (تسوق حسب الماركة والشركة) */}
      <ShopByBrandSection onNavigate={(path) => navigate(path)} />

      {/* customer-specific Favorites Section (❤️ مفضلتك) */}
      {user && !isAdmin && (
        <section id="homepage-favorites-section" className="w-full py-6 sm:py-8" dir="rtl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-rose-500 to-pink-500 animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
                    ❤️ مفضلتك
                  </h2>
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/25">
                    الوصول السريع
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  المنتجات التي قمت بحفظها لتصل إليها بسرعة في أي وقت
                </p>
              </div>
            </div>

            {favoriteProducts.length > 0 ? (
              /* Product Cards Grid using unified luxury ProductCard */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                {favoriteProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={(slug) => navigate(`/product/${slug}`)}
                    whatsappNumber={settings.whatsappNumber}
                    showQuickWhatsApp={true}
                  />
                ))}
              </div>
            ) : (
              /* Subtle Empty State */
              <div className="rounded-2xl glass-panel p-8 sm:p-10 text-center border border-white/[0.05] max-w-md mx-auto">
                <div className="text-4xl mb-3 animate-bounce">❤️</div>
                <h3 className="text-sm sm:text-base font-black text-[#F8FAFC]">
                  مفيش منتجات في المفضلة لسه
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                  أضف المنتجات اللي عجبتك للمفضلة وهتلاقيها هنا.
                </p>
                <button
                  onClick={() => {
                    const productsEl = document.getElementById('recommended-section') || document.getElementById('new-arrivals-section') || window;
                    if (productsEl === window) {
                      navigate('/products');
                    } else {
                      (productsEl as HTMLElement).scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="mt-4 px-5 py-2.5 rounded-xl text-xs font-black bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 transition-all cursor-pointer active:scale-98"
                >
                  استكشف المنتجات
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. New Arrivals (وصل حديثًا) */}
      {showNewArrivals && (
        <NewArrivalsSection
          products={newArrivals}
          whatsappNumber={settings.whatsappNumber}
          onSelectProduct={(slug) => navigate(`/product/${slug}`)}
          onViewAll={() => navigate('/products')}
        />
      )}

      {/* 5. Flash Sales / Limited Time Promotions (عروض لفترة محدودة - فلاش سيل) */}
      {data.flashSalePromotions && data.flashSalePromotions.length > 0 && (
        <FlashSaleSection
          promotions={data.flashSalePromotions}
          products={allProducts}
          whatsappNumber={settings.whatsappNumber}
          onSelectProduct={(slug) => navigate(`/product/${slug}`)}
          onExpire={loadData}
        />
      )}

      {/* Bundle Offers Section (العروض المركبة وباقات التوفير 2 في 1) */}
      <BundleOffersSection onSelectBundle={(slug) => navigate(`/offer/${slug}`)} />

      {/* Legacy Limited Time Offers (if configured) */}
      {showLimitedOffers && (
        <LimitedOffersSection
          offers={limitedOffers}
          whatsappNumber={settings.whatsappNumber}
          onSelectProduct={(slug) => navigate(`/product/${slug}`)}
        />
      )}

      {/* 6. Coming Soon (قادم قريبًا) */}
      {showComingSoon && (
        <ComingSoonSection items={comingSoonItems} />
      )}

      {/* 7. Recommended Products (ترشيحات البيت السعيد) */}
      {allProducts && allProducts.length > 0 && (
        <RecommendedProductsSection
          products={allProducts}
          whatsappNumber={settings.whatsappNumber}
          onSelectProduct={(slug) => navigate(`/product/${slug}`)}
          onViewAll={() => navigate('/products')}
        />
      )}

      {/* 8. About El Beit El Saeed Section (عن البيت السعيد - منذ 1981) */}
      <AboutBeitElSaeedSection onNavigate={(path) => navigate(path)} />

      {/* 9. Direct WhatsApp CTA Banner (دعوة التواصل عبر واتساب) */}
      <WhatsAppCtaBanner
        whatsappNumber={settings.whatsappNumber}
        phone={settings.phone}
        workingHours={settings.workingHours}
      />
    </div>
  );
}
