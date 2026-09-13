import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Check, AlertCircle, ArrowLeft, Layers, Tag } from 'lucide-react';
import { Product } from '../../types';
import { searchProducts } from '../../lib/searchUtils';


interface InstantSearchBarProps {
  products: Product[];
  onSelectProduct: (slug: string) => void;
  onSelectCategory?: (categoryId: string) => void;
}

export function InstantSearchBar({
  products,
  onSelectProduct
}: InstantSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter products in real-time with intelligent Arabic/English normalization and synonym support
  const trimmed = query.trim();
  const filteredProducts = trimmed ? searchProducts(products, trimmed, 8) : [];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (slug: string) => {
    setIsOpen(false);
    setQuery('');
    onSelectProduct(slug);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 relative z-30" dir="rtl" ref={containerRef}>
      {/* Search Input Container */}
      <div className="relative group">
        <div className="absolute inset-y-0 right-0 pr-4 sm:pr-5 flex items-center pointer-events-none text-[#9CA9BA] group-focus-within:text-[#D6A83A] transition-colors">
          <Search className="w-5 h-5 sm:w-5 sm:h-5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder="ابحث فورياً عن اسم المنتج، كود SKU، أو القسم..."
          className="w-full bg-[#0B1524]/90 backdrop-blur-xl border border-white/[0.12] focus:border-[#D6A83A]/70 text-[#F5F7FA] placeholder-[#6E7E91] text-xs sm:text-sm font-medium rounded-2xl py-3.5 sm:py-4 pr-11 sm:pr-12 pl-12 shadow-[0_12px_30px_rgba(0,0,0,0.4)] focus:shadow-[0_12px_35px_rgba(214,168,58,0.15)] outline-none transition-all duration-200"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#9CA9BA] hover:text-[#F5F7FA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Instant Dropdown Results */}
      {isOpen && trimmed.length > 0 && (
        <div className="absolute top-full right-4 left-4 sm:right-6 sm:left-6 mt-2 bg-[#0A1422]/98 backdrop-blur-2xl border border-white/[0.12] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden z-50 divide-y divide-white/[0.05] animate-in fade-in-50 duration-150">
          <div className="px-4 py-2.5 bg-[#070E18] text-[#9CA9BA] text-[11px] font-semibold flex items-center justify-between border-b border-white/[0.06]">
            <span>نتائج البحث الفوري ({filteredProducts.length})</span>
            <span className="text-[10px] text-[#6E7E91]">اضغط على المنتج للانتقال المباشر</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-white/[0.03] text-[#9CA9BA] flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5 text-amber-400/80" />
              </div>
              <p className="text-sm font-bold text-[#F5F7FA]">لا توجد منتجات مطابقة لبحثك</p>
              <p className="text-xs text-[#9CA9BA]">
                جرب البحث بكلمات أخرى أو تحقق من كود الموديل SKU.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
              {filteredProducts.map((prod) => {
                const discount = prod.oldPrice && prod.oldPrice > prod.price
                  ? Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100)
                  : null;

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleSelect(prod.slug)}
                    className="p-3 sm:p-4 hover:bg-white/[0.04] transition-colors flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#070D16] border border-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center relative">
                        <img
                          src={getValidImageSrc(prod.mainImageUrl || '/logo.svg')}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {prod.categoryName && (
                            <span className="text-[10px] font-medium text-[#D6A83A] bg-[#D6A83A]/10 px-2 py-0.5 rounded">
                              {prod.categoryName}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-[#6E7E91]">
                            {prod.sku}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#F5F7FA] group-hover:text-[#F0C24F] transition-colors truncate">
                          {prod.name}
                        </h4>
                      </div>
                    </div>

                    <div className="text-left shrink-0 flex flex-col items-end gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm sm:text-base font-black text-[#F0C24F]">
                          {prod.price.toLocaleString('ar-EG')}{' '}
                          <span className="text-[10px] text-[#D6A83A]">ج.م</span>
                        </span>
                        {prod.oldPrice && prod.oldPrice > prod.price && (
                          <span className="text-[10px] text-[#9CA9BA]/60 line-through">
                            {prod.oldPrice.toLocaleString('ar-EG')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {discount ? (
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                            خصم {discount}%
                          </span>
                        ) : null}
                        {prod.isAvailable ? (
                          <span className="text-[9px] font-medium text-emerald-400 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" />
                            <span>متوفر</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-zinc-500">
                            غير متوفر
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[#6E7E91] group-hover:text-[#D6A83A] group-hover:-translate-x-0.5 transition-all mr-1">
                      <ArrowLeft className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
