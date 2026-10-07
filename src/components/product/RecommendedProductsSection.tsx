import { resolveImageUrl } from '../../utils/imageUtils';
import React, { useState } from 'react';
import { Product } from '../../types';
import { extractBrand } from '../../lib/brandUtils';
import { Scale, Eye, Sparkles, Package } from 'lucide-react';


interface RecommendedProductsSectionProps {
  currentProduct: Product;
  recommendedProducts: Product[];
  onSelectProduct: (slug: string) => void;
  onOpenComparison: (productToCompare: Product) => void;
}

function RecommendedProductCard({
  product,
  currentProduct,
  onSelectProduct,
  onOpenComparison,
  compareBtnText
}: {
  product: Product;
  currentProduct: Product;
  onSelectProduct: (slug: string) => void;
  onOpenComparison: (productToCompare: Product) => void;
  compareBtnText: string;
}) {
  const [imgError, setImgError] = useState(false);
  const brand = extractBrand(product.name);
  const resolvedImg = resolveImageUrl(product.mainImageUrl);
  const discountPercent =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  return (
    <div className="group rounded-2xl overflow-hidden glass-card-interactive flex flex-col justify-between">
      {/* Product Top: Image & Badges */}
      <div
        onClick={() => onSelectProduct(product.slug)}
        className="relative aspect-[4/3] w-full bg-[var(--background)] overflow-hidden flex items-center justify-center p-2.5 cursor-pointer"
      >
        {resolvedImg && !imgError ? (
          <img
            src={resolvedImg}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center select-none bg-gradient-to-b from-[#0A1A30]/60 to-[#050B14]/80">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37] mb-1.5 group-hover:scale-105 transition-transform duration-300">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-[#E2E8F0] line-clamp-1 max-w-[90%] group-hover:text-[#D4AF37] transition-colors">
              {product.name}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 z-10">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md glass-pill text-[var(--text-secondary)]">
            {brand}
          </span>
          {discountPercent ? (
            <span className="bg-rose-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              خصم {discountPercent}%
            </span>
          ) : null}
        </div>

        {!product.isAvailable && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="bg-[var(--background)]/90 text-[var(--text-muted)] text-[9px] font-bold px-2 py-0.5 rounded-md border border-[var(--border)]">
              غير متوفر
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3.5 flex flex-col flex-1 justify-between space-y-3 bg-[var(--surface-secondary)]/50">
        <div onClick={() => onSelectProduct(product.slug)} className="cursor-pointer space-y-1">
          <h3 className="font-bold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-[#E0B84A] transition-colors line-clamp-2 leading-snug">
            {product.name}
          </h3>

          {/* Price */}
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-[#E0B84A] font-black text-sm sm:text-base">
              {product.price.toLocaleString('ar-EG')}{' '}
              <span className="text-[10px] font-bold text-[#D4AF37]">ج.م</span>
            </span>
            {product.oldPrice && product.oldPrice > product.price && (
              <span className="text-[var(--text-muted)] text-[10px] line-through">
                {product.oldPrice.toLocaleString('ar-EG')} ج.م
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons: Compare + View */}
        <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenComparison(product);
            }}
            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-[#D4AF37]/15 hover:bg-[#D4AF37] text-[#E0B84A] hover:text-black border border-[#D4AF37]/30 hover:border-transparent transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            title={`مقارنة مواصفات ${product.name} مع ${currentProduct.name}`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{compareBtnText}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectProduct(product.slug)}
            className="w-full py-1.5 px-3 rounded-xl text-[11px] font-semibold glass-pill hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <Eye className="w-3 h-3" />
            <span>عرض التفاصيل</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecommendedProductsSection({
  currentProduct,
  recommendedProducts,
  onSelectProduct,
  onOpenComparison
}: RecommendedProductsSectionProps) {
  if (!recommendedProducts || recommendedProducts.length === 0) {
    return null;
  }

  const isMobile = 
    (currentProduct.categoryName || '').toLowerCase().includes('موبايل') || 
    (currentProduct.categoryName || '').toLowerCase().includes('هواتف') || 
    (currentProduct.categoryName || '').toLowerCase().includes('phone') ||
    (currentProduct.categoryId || '').toLowerCase().includes('phone') ||
    (currentProduct.categoryId || '').toLowerCase().includes('mobile');

  const titleText = isMobile 
    ? 'هواتف قد تعجبك' 
    : `${currentProduct.categoryName || 'منتجات'} قد تعجبك`;

  const compareBtnText = isMobile 
    ? 'قارن مع هذا الهاتف' 
    : 'قارن مع هذا المنتج';

  return (
    <section
      aria-label="منتجات قد تعجبك"
      className="glass-panel rounded-3xl p-5 sm:p-7 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-r-3 border-[#D4AF37] pr-3">
        <div>
          <h2 className="text-base sm:text-lg md:text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <span>{titleText}</span>
            <span className="text-[10px] font-bold text-[#E0B84A] glass-pill-gold px-2.5 py-0.5 rounded-md">
              ترشيحات ذكية
            </span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            ترشيح من نفس القسم والفئة السعرية
          </p>
        </div>

        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>مقارنة مباشرة بضغطة واحدة</span>
        </div>
      </div>

      {/* Grid of Recommended Products */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {recommendedProducts.map((product) => (
          <RecommendedProductCard
            key={product.id}
            product={product}
            currentProduct={currentProduct}
            onSelectProduct={onSelectProduct}
            onOpenComparison={onOpenComparison}
            compareBtnText={compareBtnText}
          />
        ))}
      </div>
    </section>
  );
}
