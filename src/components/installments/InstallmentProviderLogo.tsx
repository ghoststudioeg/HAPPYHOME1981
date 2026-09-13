import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState } from 'react';
import { Building2, CreditCard, Zap } from 'lucide-react';
import { FinancingProvider } from '../../types/installment';


interface InstallmentProviderLogoProps {
  provider: Pick<FinancingProvider, 'id' | 'name' | 'slug' | 'logoUrl' | 'isDirectStore'>;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  logoScale?: number;
}

export function InstallmentProviderLogo({
  provider,
  isSelected = false,
  onClick,
  className = '',
  logoScale
}: InstallmentProviderLogoProps) {
  const [imgError, setImgError] = useState(false);

  const slug = (provider.slug || provider.id || '').toLowerCase();
  const name = provider.name || '';

  // Adaptive scale to ensure the logo fills 85-95% of the circular container edge-to-edge
  let effectiveScale = logoScale;
  if (!effectiveScale) {
    if (slug.includes('taqseeti') || provider.isDirectStore) {
      effectiveScale = 1.22; // Slightly higher scale to mask away any outer image square padding for Taqseeti
    } else if (slug.includes('mylo') || name.includes('مايلو')) {
      effectiveScale = 1.12;
    } else {
      effectiveScale = 1.15;
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`اختر جهة تقسيط ${name}`}
      title={name}
      className={`group relative flex items-center justify-center w-[54px] h-[54px] sm:w-[60px] sm:h-[60px] rounded-full transition-all duration-200 cursor-pointer select-none shrink-0 border overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 ${
        isSelected
          ? 'bg-[var(--accent-bg)] border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.3)] ring-2 ring-[#D4AF37]/40'
          : 'bg-[var(--surface-elevated)] hover:bg-[var(--card-hover)] border-[var(--border)] hover:border-[#D4AF37]/70 shadow-sm hover:shadow-md'
      } ${className}`}
    >
      {/* 1. LOGO IMAGE (Directly inside the circular mask - ZERO inner padding, fills circle edge-to-edge) */}
      {provider.logoUrl && !imgError ? (
        <img
          src={getValidImageSrc(provider.logoUrl)}
          alt={name}
          className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-125"
          style={{ transform: `scale(${isSelected ? effectiveScale * 1.05 : effectiveScale})` }}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        /* Un-nested clean fallback mark directly filling the circle */
        <div className="w-full h-full flex items-center justify-center text-center transition-transform duration-200 group-hover:scale-110 bg-[var(--surface)]">
          {slug.includes('taqseeti') || provider.isDirectStore ? (
            <div className="flex flex-col items-center justify-center text-emerald-400 font-black text-[10px] sm:text-xs leading-none">
              <Building2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 mb-0.5 shrink-0" />
              <span>تقسيطي</span>
            </div>
          ) : slug.includes('mylo') || name.includes('مايلو') ? (
            <span className="font-black text-indigo-300 text-xs sm:text-sm tracking-wider">
              MYLO
            </span>
          ) : slug.includes('mojo') || name.includes('موجو') ? (
            <div className="flex items-center justify-center gap-0.5 font-black text-amber-300 text-xs sm:text-sm tracking-wider">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>MOJO</span>
            </div>
          ) : (
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />
          )}
        </div>
      )}
    </button>
  );
}
