import { resolveImageUrl, getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { categoryService } from '../lib/data/categoryService';
import { productService } from '../lib/data/productService';
import { settingsService } from '../lib/data/settingsService';
import { homepageService } from '../lib/data/homepageService';
import { Category, Product, StoreSettings, HeroBanner } from '../types';
import { ProductCard } from '../components/ProductCard';
import { CategoryHeroBanner } from '../components/category/CategoryHeroBanner';
import { HeroBannerSlider } from '../components/home/HeroBannerSlider';
import { getCategoryCanonicalSlug, getCategoryCanonicalUrl } from '../lib/seoUtils';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SEO } from '../components/SEO';
import { NotFoundPage } from './NotFoundPage';
import { ProductFiltersSidebar } from '../components/product/ProductFiltersSidebar';
import { ActiveFilterChips } from '../components/product/ActiveFilterChips';
import {
  ChevronRight,
  ArrowUpDown,
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal,
  Search,
  X
} from 'lucide-react';
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
import { useAuth } from '../lib/authContext';


interface CategoryDetailPageProps {
  slug: string;
  navigate: (path: string, options?: { replace?: boolean; scrollToTop?: boolean }) => void;
}

export function CategoryDetailPage({ slug, navigate }: CategoryDetailPageProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [adjacentCategories, setAdjacentCategories] = useState<{
    previous: Category | null;
    next: Category | null;
  }>({ previous: null, next: null });
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [categoryBanners, setCategoryBanners] = useState<HeroBanner[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mobile Filter Drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Filter state scoped to this category
  const [filterState, setFilterState] = useState<FilterState>(() => {
    const fromUrl = typeof window !== 'undefined'
      ? parseFilterStateFromUrl(window.location.search)
      : DEFAULT_FILTER_STATE;
    return {
      ...fromUrl,
      category: slug
    };
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Resolve category using stored categoryId or slug or decoded identifier
      const [cat, allCats, settingsRes] = await Promise.all([
        categoryService.getCategoryByIdOrSlug(slug),
        categoryService.getCategories(),
        settingsService.getSettings()
      ]);

      if (!cat) {
        setError('category_not_found');
        setLoading(false);
        return;
      }
      setCategory(cat);
      setAllCategories(allCats);
      setStoreSettings(settingsRes);

      // Load products, category banners, and adjacent categories based on admin sort order
      const [all, banners, adjacent] = await Promise.all([
        productService.getAllProducts(false),
        homepageService.getCategoryBanners(cat.id),
        categoryService.getAdjacentCategories(cat.id)
      ]);

      const filtered = all.filter((p) => {
        const pCatId = p.categoryId?.trim();
        const pCatName = p.categoryName?.trim();
        return (
          pCatId === cat.id ||
          pCatId === cat.slug ||
          (cat.slug && decodeURIComponent(pCatId || '') === decodeURIComponent(cat.slug)) ||
          (pCatName && pCatName === cat.name)
        );
      });

      setCategoryProducts(filtered);
      setCategoryBanners(banners || []);
      setAdjacentCategories(adjacent || { previous: null, next: null });
    } catch (err) {
      console.error('Failed to load category details:', err);
      setError('حدث خطأ أثناء تحميل بيانات القسم من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug]);

  useEffect(() => {
    if (category?.id) {
      analyticsService.trackEvent('category_view', {
        categoryId: category.id,
        userUid: user?.uid
      });
    }
  }, [category?.id]);

  const canonicalSlug = category ? getCategoryCanonicalSlug(category) : slug;
  const canonicalUrl = category ? getCategoryCanonicalUrl(category) : (typeof window !== 'undefined' ? `${window.location.origin}/category/${slug}` : '');

  // Normalize address bar to /category/:canonicalSlug
  useEffect(() => {
    if (category && canonicalSlug && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const targetPath = `/category/${canonicalSlug}`;
      if (currentPath !== targetPath && !currentPath.endsWith('/' + encodeURIComponent(canonicalSlug))) {
        window.history.replaceState({}, '', targetPath + window.location.search);
      }
    }
  }, [category, canonicalSlug]);

  // Sync filter changes to URL query string smoothly
  const handleFilterChange = useCallback(
    (newState: FilterState) => {
      setFilterState({ ...newState, category: canonicalSlug });
      const queryString = buildFilterUrlQuery({ ...newState, category: canonicalSlug });
      const targetUrl = queryString
        ? `/category/${canonicalSlug}${queryString}`
        : `/category/${canonicalSlug}`;
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', targetUrl);
      }
    },
    [canonicalSlug]
  );

  const handleResetFilters = useCallback(() => {
    const resetState: FilterState = {
      ...DEFAULT_FILTER_STATE,
      category: canonicalSlug
    };
    handleFilterChange(resetState);
  }, [handleFilterChange, canonicalSlug]);

  // Detect category archetype for dynamic filters
  const archetype = useMemo(() => {
    return detectCategoryArchetype(category, slug);
  }, [category, slug]);

  // Filter and sort products using the search & filter engine
  const filteredProducts = useMemo(() => {
    return applyFilters(categoryProducts, { ...filterState, category: 'all' }, allCategories);
  }, [categoryProducts, filterState, allCategories]);

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

  if (error === 'category_not_found' || (!loading && !category)) {
    return <NotFoundPage navigate={navigate} type="category" />;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8" dir="rtl">
        <div className="h-40 glass-panel rounded-3xl animate-pulse"></div>
        <div className="h-10 bg-[#07111C]/60 rounded-xl border border-white/[0.06] animate-pulse" />
        <LoadingSkeleton type="grid" count={4} />
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="max-w-xl mx-auto my-16 px-4" dir="rtl">
        <ErrorState message={error || 'تعذر العثور على القسم المطلوب.'} onRetry={loadData} />
      </div>
    );
  }

  const hasCategoryHero = category.hero && category.hero.enabled;
  const { previous, next } = adjacentCategories;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8" dir="rtl">
      <SEO
        title={category.name}
        description={category.description?.slice(0, 160)}
        image={category.image}
        canonicalUrl={canonicalUrl}
        url={canonicalUrl}
        type="website"
        siteName={storeSettings?.storeName || 'متجر البيت السعيد 1981'}
      />

      {/* Top Header: Breadcrumbs & Next/Prev Category Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Breadcrumb Navigation: الرئيسية ← الأقسام ← [اسم القسم] */}
        <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <button
            onClick={() => navigate('/')}
            className="hover:text-[#F8FAFC] transition-colors cursor-pointer"
          >
            الرئيسية
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 rotate-180" />
          <button
            onClick={() => navigate('/categories')}
            className="hover:text-[#F8FAFC] transition-colors cursor-pointer"
          >
            الأقسام
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 rotate-180" />
          <span className="text-[#E0B84A] font-bold truncate max-w-[200px]">{category.name}</span>
        </nav>

        {/* Previous / Next Category Controls */}
        {(previous || next) && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {previous && (
              <button
                onClick={() => navigate(`/category/${previous.slug || previous.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-pill hover:bg-white/[0.08] hover:border-[#D4AF37]/50 text-xs font-bold text-[#CBD5E1] hover:text-[#E0B84A] rounded-xl transition-all cursor-pointer shadow-xs"
                title={`القسم السابق: ${previous.name}`}
              >
                <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span className="truncate max-w-[110px] sm:max-w-[140px]">
                  السابق: {previous.name}
                </span>
              </button>
            )}

            {next && (
              <button
                onClick={() => navigate(`/category/${next.slug || next.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-pill hover:bg-white/[0.08] hover:border-[#D4AF37]/50 text-xs font-bold text-[#CBD5E1] hover:text-[#E0B84A] rounded-xl transition-all cursor-pointer shadow-xs"
                title={`القسم التالي: ${next.name}`}
              >
                <span className="truncate max-w-[110px] sm:max-w-[140px]">
                  التالي: {next.name}
                </span>
                <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Category Hero Banner */}
      {categoryBanners.length > 0 ? (
        <HeroBannerSlider
          banners={categoryBanners}
          settings={storeSettings}
          onNavigate={navigate}
        />
      ) : hasCategoryHero ? (
        <CategoryHeroBanner
          category={category}
          products={categoryProducts}
          whatsappNumber={storeSettings?.whatsappNumber}
          onNavigate={navigate}
        />
      ) : (
        <div className="relative overflow-hidden glass-panel-elevated rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 liquid-reflection">
          <div className="space-y-3 text-center md:text-right">
            <h1 className="text-2xl sm:text-3xl font-black border-r-4 border-[#D4AF37] pr-3 text-[#F8FAFC]">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-sm text-[#94A3B8] max-w-xl leading-relaxed pr-4">
                {category.description}
              </p>
            )}
            <p className="text-xs text-[#E0B84A] font-bold pt-1 pr-4">
              يتوفر حالياً {categoryProducts.length} من أحدث المنتجات والقطع المميزة في المعرض
            </p>
          </div>

          {(() => {
            const resolvedCatImg = resolveImageUrl(category.image);
            if (!resolvedCatImg) return null;
            return (
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border border-[var(--border)] shrink-0 bg-[var(--surface)]">
                <img src={resolvedCatImg} alt={category.name} className="w-full h-full object-cover" />
              </div>
            );
          })()}
        </div>
      )}

      {/* Toolbar / Search & Filter Header */}
      <div className="space-y-4 pb-4 border-b border-[var(--border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Search within Category */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={filterState.search}
              onChange={(e) => handleFilterChange({ ...filterState, search: e.target.value })}
              placeholder={`ابحث داخل قسم ${category.name}...`}
              className="w-full glass-input text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-2xl py-2.5 pr-10 pl-9 outline-none focus:border-[#D4AF37]"
            />
            <Search className="w-4 h-4 text-[#D4AF37] absolute right-3.5 top-3 pointer-events-none" />
            {filterState.search && (
              <button
                onClick={() => handleFilterChange({ ...filterState, search: '' })}
                className="absolute left-3 top-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action buttons & Sort */}
          <div className="flex items-center gap-3">
            {/* Mobile Filter Button */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden px-4 py-2.5 glass-panel text-[var(--text-primary)] rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer hover:border-[#D4AF37]/50"
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
                className="glass-panel text-[var(--text-primary)] text-xs font-bold rounded-2xl py-2.5 pr-8 pl-4 outline-none focus:border-[#D4AF37] appearance-none cursor-pointer"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[var(--surface-elevated)] text-[var(--text-primary)]">
                    {opt.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37] absolute right-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        <ActiveFilterChips
          filterState={filterState}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          categoryName={category.name}
        />
      </div>

      {/* Main Grid with Dynamic Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Category-Aware Sidebar Filters */}
        <div className="lg:col-span-1">
          <ProductFiltersSidebar
            products={categoryProducts}
            categories={allCategories}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            archetype={archetype}
            isMobileDrawerOpen={mobileDrawerOpen}
            onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
            totalFilteredCount={filteredProducts.length}
            showCategoryPicker={false}
          />
        </div>

        {/* Products Grid */}
        <main className="lg:col-span-3">
          {filteredProducts.length === 0 ? (
            <div className="glass-panel p-8 sm:p-12 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 text-[#E0B84A] flex items-center justify-center mx-auto border border-[#D4AF37]/20">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                لا توجد منتجات مطابقة لخيارات البحث
              </h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                جرب تعديل أو مسح الفلاتر المختارة لعرض المنتجات المتوفرة في قسم {category.name}.
              </p>
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-xs shadow-lg cursor-pointer hover:brightness-110 active:scale-95 transition-all"
              >
                <span>مسح الفلاتر</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                <span>
                  عرض <strong className="text-[#F8FAFC] font-black">{filteredProducts.length}</strong> من إجمالي {categoryProducts.length} منتج
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={(prodSlug) => navigate(`/product/${prodSlug}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
