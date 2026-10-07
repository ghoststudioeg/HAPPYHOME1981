import React, { useState, useEffect, useMemo } from 'react';
import { Company, Product, Category, StoreSettings } from '../types';
import { companyService } from '../lib/data/companyService';
import { categoryService } from '../lib/data/categoryService';
import { productService } from '../lib/data/productService';
import { ProductCard } from '../components/ProductCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { getValidImageSrc } from '../utils/imageUtils';
import { SEO } from '../components/SEO';
import {
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Package,
  Home,
  SlidersHorizontal,
  X,
  ShieldCheck
} from 'lucide-react';

interface CompanyDetailPageProps {
  slug?: string;
  navigate?: (path: string) => void;
  settings?: StoreSettings | null;
}

export function CompanyDetailPage({ slug, navigate, settings }: CompanyDetailPageProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [allCompanyProducts, setAllCompanyProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'price-asc' | 'price-desc'>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  const handleNavigate = (path: string) => {
    if (navigate) {
      navigate(path);
    } else {
      window.location.href = path;
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadCompanyData() {
      if (!slug) {
        setError('لم يتم تحديد الشركة المطلوبة.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const foundCompany = await companyService.getCompanyBySlug(slug);

        if (!isMounted) return;

        if (!foundCompany) {
          setError('عذراً، لم يتم العثور على هذه الشركة أو قد تكون غير متوفرة حالياً.');
          setLoading(false);
          return;
        }

        setCompany(foundCompany);

        // Fetch products for this company and categories in parallel
        const [products, cats] = await Promise.all([
          companyService.getProductsForCompany(foundCompany.id),
          categoryService.getCategories(false)
        ]);

        if (!isMounted) return;

        setAllCompanyProducts(products);
        setCategories(cats);
      } catch (err: any) {
        console.error('Failed to load company detail data:', err);
        if (isMounted) {
          setError('حدث خطأ أثناء تحميل بيانات الشركة. يُرجى المحاولة مرة أخرى.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCompanyData();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Compute available categories within this company's products
  const availableCategories = useMemo(() => {
    const catMap = new Map<string, { id: string; name: string; count: number }>();

    allCompanyProducts.forEach((p) => {
      if (p.categoryId) {
        const existing = catMap.get(p.categoryId);
        if (existing) {
          existing.count += 1;
        } else {
          const matchedCat = categories.find((c) => c.id === p.categoryId);
          catMap.set(p.categoryId, {
            id: p.categoryId,
            name: matchedCat ? matchedCat.name : p.categoryName || 'قسم آخر',
            count: 1
          });
        }
      }
    });

    return Array.from(catMap.values());
  }, [allCompanyProducts, categories]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let list = [...allCompanyProducts];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.features && p.features.some((f) => f.toLowerCase().includes(q)))
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.categoryId === selectedCategory);
    }

    // In stock only filter
    if (inStockOnly) {
      list = list.filter(
        (p) => p.isAvailable && (p.stockStatus !== 'out_of_stock' && p.stockQuantity > 0)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === 'price-asc') {
        return a.price - b.price;
      }
      if (sortBy === 'price-desc') {
        return b.price - a.price;
      }
      // 'featured'
      if (a.isFeatured !== b.isFeatured) {
        return a.isFeatured ? -1 : 1;
      }
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

    return list;
  }, [allCompanyProducts, searchQuery, selectedCategory, inStockOnly, sortBy]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
        {/* Skeleton Header */}
        <div className="p-8 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)] animate-pulse flex flex-col md:flex-row items-center gap-6">
          <div className="w-28 h-28 rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-4 text-center md:text-right">
            <div className="h-8 bg-white/10 rounded-lg w-48 mx-auto md:mx-0" />
            <div className="h-4 bg-white/10 rounded-lg w-3/4 mx-auto md:mx-0" />
          </div>
        </div>

        {/* Skeleton Products */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" dir="rtl">
        <div className="p-8 sm:p-12 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-2xl backdrop-blur-xl">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Building2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] mb-3">
            {error || 'لم يتم العثور على الشركة'}
          </h2>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base mb-8 max-w-md mx-auto">
            تأكد من صحة الرابط أو تصفح الماركات والمنتجات الأخرى المتاحة في متجر البيت السعيد.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => handleNavigate('/')}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0A1118] font-bold text-sm shadow-lg shadow-[#D4AF37]/20 hover:scale-105 active:scale-95 transition-all"
            >
              العودة للرئيسية
            </button>
            <button
              onClick={() => handleNavigate('/products')}
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[var(--text-primary)] font-bold text-sm hover:bg-white/10 transition-all"
            >
              تصفح كل المنتجات
            </button>
          </div>
        </div>
      </div>
    );
  }

  const logoSrc = getValidImageSrc(company.logoUrl);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8" dir="rtl">
      <SEO
        title={`${company.name} | منتجات وأجهزة ماركة ${company.name} في البيت السعيد`}
        description={company.description || `تصفح واشترِ جميع أجهزة ومنتجات ماركة ${company.name} الأصلية بضمان معتمد وأفضل أسعار التقسيط من البيت السعيد.`}
        image={logoSrc || undefined}
      />

      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)]">
        <button
          onClick={() => handleNavigate('/')}
          className="flex items-center gap-1 hover:text-[#D4AF37] transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>الرئيسية</span>
        </button>
        <ChevronLeft className="w-3.5 h-3.5 opacity-50" />
        <button
          onClick={() => handleNavigate('/products')}
          className="hover:text-[#D4AF37] transition-colors"
        >
          <span>المنتجات</span>
        </button>
        <ChevronLeft className="w-3.5 h-3.5 opacity-50" />
        <span className="font-bold text-[#D4AF37]">{company.name}</span>
      </nav>

      {/* Company Premium Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1526]/90 via-[#0F1E36]/80 to-[#070D18]/95 border border-[#D4AF37]/25 shadow-2xl backdrop-blur-2xl p-6 sm:p-10">
        {/* Glow ambient background elements */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8 text-center md:text-right">
          {/* Logo Container */}
          <div className="relative shrink-0">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl sm:rounded-3xl bg-white p-3 shadow-xl shadow-black/40 border-2 border-[#D4AF37]/40 flex items-center justify-center overflow-hidden transition-transform hover:scale-105 duration-300">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={company.name}
                  className="w-full h-full object-contain"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-800">
                  <Building2 className="w-12 h-12 text-[#AA7C11] mb-1" />
                  <span className="text-[10px] font-black tracking-wider uppercase truncate max-w-full px-1">
                    {company.name}
                  </span>
                </div>
              )}
            </div>
            {/* Verified Badge */}
            <div className="absolute -bottom-2.5 -left-2.5 bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0A1118] px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-lg border border-black/30">
              <ShieldCheck className="w-3 h-3" />
              <span>وكيل معتمد</span>
            </div>
          </div>

          {/* Company Info */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                {company.name}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                {allCompanyProducts.length} {allCompanyProducts.length === 1 ? 'منتج' : 'منتجات متوفرة'}
              </span>
            </div>

            <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
              {company.description ||
                `تسوق كافة منتجات وأجهزة ماركة ${company.name} الأصلية المضمونة من متجر البيت السعيد، بأفضل الأسعار وأقوى خطط التقسيط بدون فوائد.`}
            </p>

            {/* Quick Feature Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 text-xs text-slate-300 font-medium">
              <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ضمان محلي أصلي 100%
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                شحن وتوصيل فوري لباب المنزل
              </span>
              <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                إمكانية التقسيط مع فاليو والبنك الأهلي
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Filter Tabs / Pills */}
      {availableCategories.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
            <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>تصفح حسب القسم داخل منتجات {company.name}:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0A1118] shadow-lg shadow-[#D4AF37]/20 scale-105'
                  : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`}
            >
              <span>جميع الأقسام</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  selectedCategory === 'all' ? 'bg-black/20 text-[#0A1118]' : 'bg-white/10 text-slate-300'
                }`}
              >
                {allCompanyProducts.length}
              </span>
            </button>

            {availableCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0A1118] shadow-lg shadow-[#D4AF37]/20 scale-105'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    selectedCategory === cat.id ? 'bg-black/20 text-[#0A1118]' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar Controls */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search input within company products */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`بحث في منتجات ${company.name}...`}
            className="w-full pr-10 pl-9 py-2 rounded-xl text-xs sm:text-sm bg-[var(--background)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#D4AF37]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right side controls (In-stock toggle & Sorting) */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
          {/* In Stock toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-semibold text-[var(--text-secondary)] select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="w-4 h-4 rounded text-[#D4AF37] focus:ring-[#D4AF37] accent-[#D4AF37]"
            />
            <span>المتوفر فقط في المخزن</span>
          </label>

          {/* Sort Select */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1.5 px-3 rounded-xl text-xs sm:text-sm bg-[var(--background)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="featured">المميز والمقترح</option>
              <option value="newest">الأحدث وصولاً</option>
              <option value="price-asc">السعر: من الأقل للأعلى</option>
              <option value="price-desc">السعر: من الأعلى للأقل</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filters Display & Count */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <span>عرض</span>
          <span className="font-bold text-[var(--text-primary)]">{filteredProducts.length}</span>
          <span>من إجمالي</span>
          <span className="font-bold text-[var(--text-primary)]">{allCompanyProducts.length}</span>
          <span>منتج</span>
        </div>

        {(searchQuery || selectedCategory !== 'all' || inStockOnly) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setInStockOnly(false);
            }}
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              onSelect={(productSlug) => handleNavigate(`/product/${productSlug}`)}
              whatsappNumber={settings?.whatsappNumber}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 sm:p-16 rounded-3xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
            لا توجد منتجات مطابقة لخيارات الفلترة
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            جرّب تغيير كلمات البحث أو اختيار قسم مختلف لعرض منتجات شركة {company.name}.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setInStockOnly(false);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#0A1118] font-bold text-xs shadow-md hover:scale-105 transition-all"
          >
            إظهار كل منتجات الشركة
          </button>
        </div>
      )}
    </div>
  );
}
