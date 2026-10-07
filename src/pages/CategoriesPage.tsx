import { resolveImageUrl } from '../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { categoryService } from '../lib/data/categoryService';
import { productService } from '../lib/data/productService';
import { Category, Product } from '../types';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { ChevronLeft, Folder } from 'lucide-react';

interface CategoriesPageProps {
  navigate: (path: string) => void;
}

function CategoryCard({
  cat,
  productCount,
  onClick
}: {
  cat: Category;
  productCount: number;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const resolvedImageUrl = resolveImageUrl(cat.image);

  return (
    <div
      onClick={onClick}
      className="group glass-card-interactive rounded-3xl overflow-hidden flex flex-col cursor-pointer"
    >
      <div className="relative aspect-[4/3] w-full bg-[#05080D] overflow-hidden flex items-center justify-center">
        {resolvedImageUrl && !imgError ? (
          <img
            src={resolvedImageUrl}
            alt={cat.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-gradient-to-b from-[#0A1A30]/80 to-[#050B14]">
            <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37] mb-2 group-hover:scale-105 transition-transform duration-300">
              <Folder className="w-7 h-7" />
            </div>
            <span className="text-sm font-bold text-[#E2E8F0] line-clamp-1 max-w-[90%] group-hover:text-[#D4AF37] transition-colors">
              {cat.name}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05080D] via-transparent to-transparent opacity-85 pointer-events-none"></div>
        <span className="absolute bottom-3 right-3 text-xs font-bold glass-pill text-[#E0B84A] px-3 py-1 rounded-lg z-10">
          {productCount} {productCount === 1 ? 'منتج' : 'منتجات'}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-black text-[#F8FAFC] group-hover:text-[#E0B84A] transition-colors mb-2">
            {cat.name}
          </h3>
          {cat.description && (
            <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed">
              {cat.description}
            </p>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold text-[#E0B84A]">
          <span>تصفح المنتجات</span>
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}

export function CategoriesPage({ navigate }: CategoriesPageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, prods] = await Promise.all([
        categoryService.getCategories(),
        productService.getAllProducts(false)
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error(err);
      setError('تعذر تحميل الأقسام.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
        <div className="h-12 bg-white/5 rounded-2xl animate-pulse max-w-sm" />
        <LoadingSkeleton type="category-list" count={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto my-16 px-4" dir="rtl">
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12" dir="rtl">
      {/* Header */}
      <div className="mb-8 border-r-4 border-[#D4AF37] pr-4">
        <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC]">
          أقسام المتجر
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8] mt-2 pr-4">
          اختر القسم المطلوب لاستكشاف جميع الأجهزة والمنتجات المتاحة في المعرض
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((cat) => {
          const productCount = products.filter((p) => p.categoryId === cat.id || p.categoryId === cat.slug).length;

          return (
            <CategoryCard
              key={cat.id}
              cat={cat}
              productCount={productCount}
              onClick={() => navigate(`/category/${cat.slug || cat.id}`)}
            />
          );
        })}
      </div>
    </div>
  );
}
