import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { categoryService } from '../lib/data/categoryService';
import { productService } from '../lib/data/productService';
import { Category, Product } from '../types';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { ChevronLeft } from 'lucide-react';


interface CategoriesPageProps {
  navigate: (path: string) => void;
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" dir="rtl">
        <div className="h-8 glass-panel w-64 mb-8 rounded-xl"></div>
        <LoadingSkeleton count={8} />
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16" dir="rtl">
      <div className="mb-10 text-right">
        <h1 className="text-2xl sm:text-3xl font-black border-r-4 border-[#D4AF37] pr-3 text-[#F8FAFC]">
          أقسام البيت السعيد
        </h1>
        <p className="text-xs sm:text-sm text-[#94A3B8] mt-2 pr-4">
          اختر القسم المطلوب لاستكشاف جميع الأجهزة والمنتجات المتاحة في المعرض
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((cat) => {
          const productCount = products.filter((p) => p.categoryId === cat.id || p.categoryId === cat.slug).length;

          return (
            <div
              key={cat.id}
              onClick={() => navigate(`/category/${cat.slug || cat.id}`)}
              className="group glass-card-interactive rounded-3xl overflow-hidden flex flex-col cursor-pointer"
            >
              <div className="relative aspect-[4/3] w-full bg-[#05080D] overflow-hidden">
                <img
                  src={getValidImageSrc(cat.image)}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05080D] via-transparent to-transparent opacity-85"></div>
                <span className="absolute bottom-3 right-3 text-xs font-bold glass-pill text-[#E0B84A] px-3 py-1 rounded-lg">
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
        })}
      </div>
    </div>
  );
}
