import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React from 'react';
import { motion } from 'motion/react';
import { Check, Palette } from 'lucide-react';
import { ProductColorVariant, ProductColor } from '../../types';


interface ProductColorSelectorProps {
  variants?: ProductColorVariant[];
  colors?: (ProductColorVariant | ProductColor)[];
  selectedVariant?: ProductColorVariant | ProductColor | null;
  onSelectVariant: (variant: any) => void;
  className?: string;
}

export function ProductColorSelector({
  variants,
  colors,
  selectedVariant,
  onSelectVariant,
  className = ''
}: ProductColorSelectorProps) {
  // Unify variants or legacy colors
  const list = (variants && variants.length > 0 ? variants : colors) || [];

  if (!list || list.length === 0) {
    return null;
  }

  // Helper to extract variant name
  const getName = (item: any): string => {
    return item.colorName || item.name || 'لون غير محدد';
  };

  // Helper to extract color hex code
  const getCode = (item: any): string | undefined => {
    return item.colorCode || item.hex;
  };

  // Helper to extract image for swatch
  const getSwatchImage = (item: any): string | undefined => {
    return item.mainImage || item.imageUrl;
  };

  const activeItems = list.filter((v: any) => v.active !== false);
  const displayItems = activeItems.length > 0 ? activeItems : list;

  const currentSelectedName = selectedVariant ? getName(selectedVariant) : '';

  return (
    <div className={`space-y-2.5 ${className}`} dir="rtl">
      {/* Header with Selected Color Name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#D6A83A]" />
          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
            اللون:
          </span>
          {currentSelectedName ? (
            <span className="text-xs sm:text-sm font-black text-[#D6A83A] bg-[#D6A83A]/10 px-2.5 py-0.5 rounded-full border border-[#D6A83A]/25 transition-all">
              {currentSelectedName}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">اختر اللون المفضل</span>
          )}
        </div>

        {displayItems.length > 1 && (
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            {displayItems.length} ألوان متاحة
          </span>
        )}
      </div>

      {/* Swatches Row */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
        {displayItems.map((item: any, idx: number) => {
          const colorName = getName(item);
          const colorHex = getCode(item);
          const swatchImg = getSwatchImage(item);
          const isSelected = currentSelectedName === colorName;
          const isOutOfStock = item.stockQuantity !== undefined && item.stockQuantity <= 0;
          const isWhiteOrLight =
            colorHex?.toLowerCase() === '#ffffff' ||
            colorHex?.toLowerCase() === '#fff' ||
            colorHex?.toLowerCase() === 'white';

          // Gallery image count badge
          const imageCount = item.images ? item.images.length + (item.mainImage ? 1 : 0) : 0;

          return (
            <div key={idx} className="relative group">
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onSelectVariant(item)}
                disabled={isOutOfStock}
                title={`${colorName}${isOutOfStock ? ' (نفدت الكمية)' : ''}${imageCount > 0 ? ` - ${imageCount} صور` : ''}`}
                className={`relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all duration-200 cursor-pointer select-none focus:outline-none ${
                  isOutOfStock ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {/* Smooth Animated Selection Ring */}
                {isSelected && (
                  <motion.span
                    layoutId="colorSelectionHighlight"
                    className="absolute -inset-1.5 rounded-full border-2 border-[#D6A83A] pointer-events-none shadow-[0_0_12px_rgba(214,168,58,0.4)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  />
                )}

                {/* Circle Container */}
                <div
                  className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'border-[#D6A83A]'
                      : isWhiteOrLight
                      ? 'border-zinc-400'
                      : 'border-white/20'
                  }`}
                  style={{
                    backgroundColor: colorHex || '#333333'
                  }}
                >
                  {swatchImg ? (
                    <img
                      src={getValidImageSrc(swatchImg)}
                      alt={colorName}
                      className="w-full h-full object-cover"
                    />
                  ) : !colorHex ? (
                    <span className="text-[10px] font-black text-white uppercase">
                      {colorName.slice(0, 2)}
                    </span>
                  ) : null}
                </div>

                {/* Selected Check Mark */}
                {isSelected && (
                  <span
                    className={`aria-hidden absolute inset-0 m-auto w-5 h-5 rounded-full flex items-center justify-center shadow-sm z-10 ${
                      isWhiteOrLight ? 'bg-black text-white' : 'bg-white text-black'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}

                {/* Out of Stock Line */}
                {isOutOfStock && (
                  <span className="absolute inset-0 m-auto w-full h-[2px] bg-rose-500 rotate-45 rounded-full pointer-events-none" />
                )}
              </motion.button>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-20 whitespace-nowrap">
                <div className="bg-[var(--surface-elevated)] text-[var(--text-primary)] text-[10px] font-bold px-2.5 py-1 rounded-md border border-[var(--border)] shadow-xl">
                  {colorName}
                  {isOutOfStock && <span className="text-rose-400 mr-1">(غير متوفر)</span>}
                  {imageCount > 0 && <span className="text-[#D6A83A] mr-1">({imageCount} صور)</span>}
                </div>
                <div className="w-2 h-2 bg-[var(--surface-elevated)] rotate-45 border-r border-b border-[var(--border)] -mt-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
