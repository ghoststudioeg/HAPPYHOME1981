import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React from 'react';
import { Category, Product } from '../../types';
import { ArrowLeft } from 'lucide-react';


interface CategoryGridProps {
  categories: Category[];
  products: Product[];
  onSelectCategory: (categorySlug: string) => void;
}

export function CategoryGrid({ categories, products, onSelectCategory }: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <section className="w-full py-6 sm:py-8" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#D4AF37] to-[#E0B84A]" />
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                أقسام المتجر
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                تصفح المنتجات والأجهزة حسب الفئات المعتمدة
              </p>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
          {categories.map((cat) => {
            // Only count if products are provided and contain the categoryId
            const prodCount = products.length > 0 
              ? products.filter((p) => p.categoryId === cat.id || p.categoryId === cat.slug).length
              : 0;

            return (
              <div
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="group relative rounded-2xl overflow-hidden glass-card-interactive flex flex-col cursor-pointer liquid-reflection"
              >
                {/* Image Container with subtle gradient */}
                <div className="relative aspect-[16/10] w-full bg-[var(--surface-elevated)] border-b border-[var(--border)] overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={getValidImageSrc(cat.image || '/logo.svg')}
                    alt={cat.name}
                    className="w-full h-full object-contain group-hover:scale-106 transition-transform duration-500 ease-out"
                    loading="lazy"
                  />
                  
                  {prodCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-bold glass-pill text-[#E0B84A] px-2 py-0.5 rounded-lg border border-[var(--border)]">
                      {prodCount} منتج
                    </span>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-3.5 sm:p-4 flex items-center justify-between gap-2 bg-[var(--card)]">
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] group-hover:text-[#E0B84A] transition-colors truncate">
                      {cat.name}
                    </h3>
                    {cat.description && (
                      <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  <div className="w-7 h-7 rounded-xl bg-[var(--surface-elevated)] group-hover:bg-[#D4AF37] group-hover:text-[#05080D] text-[var(--text-secondary)] flex items-center justify-center shrink-0 transition-all duration-200">
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
