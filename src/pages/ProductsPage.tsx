import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { productService } from '../lib/data/productService';
import { categoryService } from '../lib/data/categoryService';
import { homepageService } from '../lib/data/homepageService';
import { settingsService } from '../lib/data/settingsService';
import { promotionService } from '../lib/data/promotionService';
import { getEffectiveProductPrice } from '../lib/campaignPricing';
import { Product, Category, HeroBanner, StoreSettings, Promotion } from '../types';
import { ProductCard } from '../components/ProductCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { HeroBannerSlider } from '../components/home/HeroBannerSlider';
import { ProductFiltersSidebar } from '../components/product/ProductFiltersSidebar';
import { ActiveFilterChips } from '../components/product/ActiveFilterChips';
import { Search, SlidersHorizontal, ArrowUpDown, X, Sparkles } from 'lucide-react';
import {
  FilterState,
  DEFAULT_FILTER_STATE,
  detectCategoryArchetype,
  applyFilters,
  parseFilterStateFromUrl,
  buildFilterUrlQuery,
  countActiveFilters,
  SortOption
} from '../lib/filterEngine';
import { analyticsService } from '../lib/data/analyticsService';

interface ProductsPageProps {
  navigate: (path: string, options?: { replace?: boolean; scrollToTop?: boolean }) => void;
  initialQuery?: string;
  initialCategory?: string;
  initialFeatured?: boolean;
}

export function ProductsPage({
  navigate,
  initialQuery,
  initialCategory,
  initialFeatured
}: ProductsPageProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogBanners, setCatalogBanners] = useState<HeroBanner[]>([]);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mobile Filter Drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Initialize filter state from URL search params or props
  const [filterState, setFilterState] = useState<FilterState>(() => {
    const fromUrl = typeof window !== 'undefined'
      ? parseFilterStateFromUrl(window.location.search)
      : DEFAULT_FILTER_STATE;

    return {
      ...fromUrl,
      search: initialQuery !== undefined ? initialQuery : fromUrl.search,
      category: initialCategory !== undefined ? initialCategory : fromUrl.category,
      featuredOnly: initialFeatured !== undefined ? initialFeatured : fromUrl.featuredOnly
    };
  });

  // Track initial load
  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [allProds, allCategories, banners, promos, setts] = await Promise.all([
        productService.getAllProducts(false),
        categoryService.getCategories(),
        homepageService.getCatalogBanners().catch(() => []),
        promotionService.getActivePromotions().catch(() => []),
        settingsService.getSettings().catch(() => null)
      ]);

      setAllProducts(allProds);
      setCategories(allCategories);
      setCatalogBanners(banners || []);
      setActivePromotions(promos || []);
      setStoreSettings(setts);
    } catch (err) {
      console.error('Failed to load products data:', err);
      setError('تعذر تحميل المنتجات، يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Listen for browser popstate (back/forward)
  useEffect(() => {
    const handlePop = () => {
      const parsed = parseFilterStateFromUrl(window.location.search);
      setFilterState(parsed);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Sync filter changes to URL query string smoothly
  const handleFilterChange = useCallback((newState: FilterState) => {
    setFilterState(newState);
    const queryString = buildFilterUrlQuery(newState);
    const targetUrl = queryString ? `/products${queryString}` : '/products';
    if (typeof window !== 'undefined' && window.location.pathname === '/products') {
      window.history.replaceState({}, '', targetUrl);
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    const resetState: FilterState = {
      ...DEFAULT_FILTER_STATE,
      category: 'all'
    };
    handleFilterChange(resetState);
  }, [handleFilterChange]);

  // Analytics search tracking
  useEffect(() => {
    if (!filterState.search.trim()) return;
    const timer = setTimeout(() => {
      analyticsService.trackEvent('search', {
        metadata: { query: filterState.search.trim() }
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [filterState.search]);

  // Resolve selected category object
  const selectedCategoryObj = useMemo(() => {
    if (!filterState.category || filterState.category === 'all') return null;
    return (
      categories.find(
        (c) =>
          c.id === filterState.category ||
          c.slug === filterState.category ||
          c.name === filterState.category
      ) || null
    );
  }, [categories, filterState.category]);

  // Detect category archetype for dynamic filters
  const archetype = useMemo(() => {
    return detectCategoryArchetype(selectedCategoryObj, filterState.category);
  }, [selectedCategoryObj, filterState.category]);

  // Filter and sort products using the search & filter engine
  const filteredProducts = useMemo(() => {
    return applyFilters(allProducts, filterState, categories);
  }, [allProducts, filterState, categories]);

  const activeFiltersCount = countActiveFilters(filterState);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'الترتيب: الأحدث' },
    { value: 'price-asc', label: 'السعر: من الأقل للأعلى' },
    { value: 'price-desc', label: 'السعر: من الأعلى للأقل' },
    { value: 'rating', label: 'الأعلى تقييمًا' },
    { value: 'views', label: 'الأكثر مشاهدة' },
    { value: 'best-selling', label: 'الأكثر مبيعًا' },
    { value: 'featured', label: 'المنتجات المميزة أولاً' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8" dir="rtl">
      {/* Catalog Hero Banner */}
      {catalogBanners.length > 0 && (
        <HeroBannerSlider
          banners={catalogBanners}
          settings={storeSettings}
          onNavigate={(path) => navigate(path)}
        />
      )}

      {/* Page Header & Global Search Bar */}
      <div className="space-y-5 pb-6 border-b border-white/[0.08]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black border-r-4 border-[#D4AF37] pr-3 text-[#F8FAFC]">
              {selectedCategoryObj ? selectedCategoryObj.name : 'منتجات البيت السعيد'}
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1.5 pr-4">
              {selectedCategoryObj?.description ||
                'استعرض تشكيلتنا الكاملة مع خيارات التصفية والفرز المتقدمة وأفضل عروض التقسيط'}
            </p>
          </div>

          {/* Quick Stats & Mobile Filter Button */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* Mobile Filter Toggle Button */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden px-4 py-2.5 glass-panel text-[#F8FAFC] rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer hover:border-[#D4AF37]/50 active:scale-95 transition-all"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#D4AF37]" />
              <span>تصفية</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#05080D] font-black text-[10px] flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="relative flex items-center">
              <select
                value={filterState.sortBy}
                onChange={(e) =>
                  handleFilterChange({
                    ...filterState,
                    sortBy: e.target.value as SortOption
                  })
                }
                className="glass-panel text-[#F8FAFC] text-xs font-bold rounded-2xl py-2.5 pr-8 pl-4 outline-none focus:border-[#D4AF37] appearance-none cursor-pointer"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#05080D] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37] absolute right-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Real-time Search Input */}
        <div className="relative max-w-2xl">
          <input
            type="text"
            value={filterState.search}
            onChange={(e) => handleFilterChange({ ...filterState, search: e.target.value })}
            placeholder="ابحث فورياً باسم المنتج، كود SKU، الماركة، أو المواصفات..."
            className="w-full glass-input text-xs sm:text-sm text-[#F8FAFC] placeholder-zinc-500 rounded-2xl py-3 pr-11 pl-10 focus:border-[#D4AF37] outline-none"
          />
          <Search className="w-4 h-4 text-[#D4AF37] absolute right-4 top-3.5 pointer-events-none" />
          {filterState.search && (
            <button
              onClick={() => handleFilterChange({ ...filterState, search: '' })}
              className="absolute left-3.5 top-3.5 text-[#94A3B8] hover:text-[#F8FAFC] p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Active Filters Chips Bar */}
        <ActiveFilterChips
          filterState={filterState}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          categoryName={selectedCategoryObj?.name}
        />
      </div>

      {/* Main Grid & Filters Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Category-Aware Sidebar Filters */}
        <div className="lg:col-span-1">
          <ProductFiltersSidebar
            products={allProducts}
            categories={categories}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            archetype={archetype}
            isMobileDrawerOpen={mobileDrawerOpen}
            onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
            totalFilteredCount={filteredProducts.length}
            showCategoryPicker={true}
          />
        </div>

        {/* Products Grid Main Area */}
        <main className="lg:col-span-3">
          {loading ? (
            <LoadingSkeleton count={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={loadInitialData} />
          ) : filteredProducts.length === 0 ? (
            <div className="glass-panel p-8 sm:p-12 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 text-[#E0B84A] flex items-center justify-center mx-auto border border-[#D4AF37]/20">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                لا توجد منتجات تطابق اختياراتك
              </h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                جرب تقليل الفلاتر المحددة، تعديل نطاق السعر، أو مسح عبارة البحث لعرض المزيد من المنتجات.
              </p>
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-xs shadow-lg cursor-pointer hover:brightness-110 active:scale-95 transition-all"
              >
                <span>مسح جميع الفلاتر</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Product counter header */}
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>
                  عرض <strong className="text-[#F8FAFC] font-black">{filteredProducts.length}</strong> منتج
                </span>
                {filterState.sortBy !== 'newest' && (
                  <span className="text-[11px] text-[#D4AF37] font-bold">
                    {sortOptions.find((o) => o.value === filterState.sortBy)?.label}
                  </span>
                )}
              </div>

              {/* Products Cards Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {filteredProducts.map((product) => {
                  const pricing = getEffectiveProductPrice(product, catalogBanners, activePromotions);
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      effectivePrice={pricing.effectivePrice}
                      isCampaignActive={pricing.isCampaignActive}
                      isFlashSale={pricing.isFlashSale}
                      flashSaleEndDate={pricing.flashSaleEndDate}
                      badgeText={pricing.badgeText || undefined}
                      onSelect={(slug) => navigate(`/product/${slug}`)}
                      whatsappNumber={storeSettings?.whatsappNumber}
                      showQuickWhatsApp={true}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
