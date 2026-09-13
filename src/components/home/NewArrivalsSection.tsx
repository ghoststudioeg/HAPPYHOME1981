import React from 'react';
import { Product } from '../../types';
import { ArrowLeft } from 'lucide-react';
import { ProductCard } from '../ProductCard';

interface NewArrivalsSectionProps {
  products: Product[];
  whatsappNumber: string;
  onSelectProduct: (slug: string) => void;
  onViewAll: () => void;
}

export function NewArrivalsSection({
  products,
  whatsappNumber,
  onSelectProduct,
  onViewAll
}: NewArrivalsSectionProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="w-full py-6 sm:py-8" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#D4AF37] to-[#E0B84A]" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
                  وصل حديثًا
                </h2>
                <span className="text-[11px] font-bold text-[#E0B84A] glass-pill-gold px-2.5 py-0.5 rounded-full">
                  أحدث الإضافات
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                أحدث الهواتف والأجهزة المضافة إلى كتالوج البيت السعيد
              </p>
            </div>
          </div>

          <button
            onClick={onViewAll}
            className="group flex items-center gap-1.5 text-xs font-bold text-[#E0B84A] hover:text-[#F8FAFC] glass-pill hover:border-[#D4AF37]/50 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
          >
            <span>عرض الكل</span>
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Product Cards Grid using unified luxury ProductCard */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
              whatsappNumber={whatsappNumber}
              showQuickWhatsApp={true}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
