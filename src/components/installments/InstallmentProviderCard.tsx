import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState } from 'react';
import { Building2, CreditCard, Zap, Check } from 'lucide-react';
import { FinancingProvider } from '../../types/installment';


interface InstallmentProviderCardProps {
  provider: Pick<FinancingProvider, 'id' | 'name' | 'slug' | 'logoUrl' | 'isDirectStore'>;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function InstallmentProviderCard({
  provider,
  isSelected = false,
  onClick,
  className = ''
}: InstallmentProviderCardProps) {
  const [imgError, setImgError] = useState(false);

  const slug = (provider.slug || provider.id || '').toLowerCase();
  const name = provider.name || '';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`اختر جهة تقسيط ${name}`}
      className={`group relative flex flex-col items-center justify-between p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer select-none text-right border focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 w-full sm:w-[155px] md:w-[165px] h-[165px] sm:h-[180px] shrink-0 ${
        isSelected
          ? 'bg-[var(--accent-bg)] border-[#D4AF37] shadow-md text-[var(--text-primary)] ring-2 ring-[#D4AF37]/30'
          : 'glass-panel border-[var(--border)] hover:border-[#D4AF37]/40 shadow-sm hover:shadow-md text-[var(--text-secondary)]'
      } ${className}`}
    >
      {/* Selected indicator badge - subtle top-left accent */}
      {isSelected && (
        <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-[#D4AF37] text-white dark:text-[#05080D] flex items-center justify-center shadow-md z-10">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      )}

      {/* 1. LOGO AREA (Occupies 65-70% of visual height) */}
      <div className="flex-1 w-full min-h-0 flex items-center justify-center p-2 relative overflow-hidden">
        {provider.logoUrl && !imgError ? (
          <img
            src={getValidImageSrc(provider.logoUrl)}
            alt={name}
            className="max-h-full max-w-full object-contain filter drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          /* Un-nested clean fallback mark */
          <div className="w-full h-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
            {slug.includes('taqseeti') || provider.isDirectStore ? (
              <div className="flex items-center gap-1.5 font-black text-emerald-400 text-base sm:text-lg tracking-tight">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                <span>تقسيطي</span>
              </div>
            ) : slug.includes('mylo') || name.includes('مايلو') ? (
              <span className="font-black text-indigo-300 text-lg sm:text-xl tracking-wider">
                MYLO
              </span>
            ) : slug.includes('mojo') || name.includes('موجو') ? (
              <div className="flex items-center gap-1 font-black text-amber-300 text-base sm:text-lg tracking-wider">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span>MOJO</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 font-black text-[#D4AF37] text-sm sm:text-base">
                <CreditCard className="w-5 h-5 shrink-0" />
                <span className="truncate max-w-[90px]">{name}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. PROVIDER NAME AREA (Secondary to logo, clean medium-weight text) */}
      <div className="w-full pt-2.5 border-t border-[var(--border)] text-center shrink-0">
        <span className={`text-xs sm:text-sm font-medium transition-colors block truncate ${
          isSelected ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
        }`}>
          {name}
        </span>
      </div>
    </button>
  );
}
