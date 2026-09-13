import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React from 'react';
import { Building2, CreditCard, Zap } from 'lucide-react';
import { FinancingProvider } from '../../types/installment';


interface ProviderLogoProps {
  provider: Pick<FinancingProvider, 'id' | 'name' | 'slug' | 'logoUrl' | 'isDirectStore'>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'card';
  className?: string;
}

export function ProviderLogo({ provider, size = 'md', className = '' }: ProviderLogoProps) {
  const sizeClasses = {
    sm: 'w-9 h-9 rounded-xl text-xs',
    md: 'w-14 h-14 rounded-2xl text-sm',
    lg: 'w-20 h-20 rounded-2xl text-base',
    xl: 'w-28 h-28 rounded-3xl text-lg',
    card: 'w-full h-16 sm:h-20 rounded-2xl text-base'
  }[size];

  const [imgError, setImgError] = React.useState(false);

  // 1. If an actual uploaded image logo exists, render the logo directly occupying the avatar space
  if (provider.logoUrl && !imgError) {
    return (
      <div className={`${sizeClasses} relative flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
        <img
          src={getValidImageSrc(provider.logoUrl)}
          alt={provider.name}
          className="w-full h-full object-contain drop-shadow-md"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // 2. Premium branded single-container fallbacks (NO inner nested frame)
  const slug = (provider.slug || provider.id || '').toLowerCase();

  // Taqseeti (تقسيطي - Direct Store)
  if (slug.includes('taqseeti') || provider.isDirectStore) {
    return (
      <div
        className={`${sizeClasses} bg-gradient-to-br from-emerald-900/90 via-[#06241B] to-emerald-950 flex items-center justify-center text-emerald-400 font-black shadow-lg shrink-0 select-none border border-emerald-500/30 ${className}`}
        title={provider.name}
      >
        <div className="flex items-center gap-1.5 font-black tracking-tight">
          <Building2 className={size === 'sm' ? 'w-4 h-4' : size === 'lg' || size === 'xl' || size === 'card' ? 'w-7 h-7' : 'w-5 h-5'} />
          {size !== 'sm' && <span className="text-xs sm:text-sm">تقسيطي</span>}
        </div>
      </div>
    );
  }

  // Mylo (مايلو)
  if (slug.includes('mylo') || provider.name.includes('مايلو')) {
    return (
      <div
        className={`${sizeClasses} bg-gradient-to-br from-indigo-900/90 via-[#0F0E30] to-violet-950 flex items-center justify-center text-indigo-200 font-black shadow-lg shrink-0 select-none border border-indigo-500/30 ${className}`}
        title={provider.name}
      >
        <div className="flex items-center gap-1 font-black tracking-wider">
          <span className={size === 'sm' ? 'text-xs font-black' : size === 'lg' || size === 'xl' || size === 'card' ? 'text-xl font-black' : 'text-sm font-black'}>
            MYLO
          </span>
        </div>
      </div>
    );
  }

  // Mojo (موجو)
  if (slug.includes('mojo') || provider.name.includes('موجو')) {
    return (
      <div
        className={`${sizeClasses} bg-gradient-to-br from-amber-900/90 via-[#261405] to-rose-950 flex items-center justify-center text-amber-300 font-black shadow-lg shrink-0 select-none border border-amber-500/30 ${className}`}
        title={provider.name}
      >
        <div className="flex items-center gap-1 font-black tracking-wider">
          <Zap className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' || size === 'xl' || size === 'card' ? 'w-6 h-6' : 'w-4 h-4'} />
          {size !== 'sm' && <span className="text-xs sm:text-sm font-black">MOJO</span>}
        </div>
      </div>
    );
  }

  // Generic Clean Fallback
  return (
    <div
      className={`${sizeClasses} bg-[var(--surface-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-[#D4AF37] font-black shrink-0 select-none shadow-md ${className}`}
      title={provider.name}
    >
      <CreditCard className={size === 'sm' ? 'w-4 h-4' : size === 'lg' || size === 'xl' || size === 'card' ? 'w-7 h-7' : 'w-5 h-5'} />
    </div>
  );
}
