import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { useTheme } from '../lib/themeContext';
import { StoreLogo } from './StoreLogo';
import { settingsService } from '../lib/data/settingsService';
import { StoreSettings } from '../types';


interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'square' | 'mark';
  showSlogan?: boolean;
  settings?: StoreSettings | null;
}

export function Logo({
  className = '',
  size = 'md',
  variant = 'full',
  showSlogan = true,
  settings: propSettings
}: LogoProps) {
  const { theme } = useTheme();
  const [internalSettings, setInternalSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchFresh = () => {
      settingsService.getSettings().then(s => {
        if (isMounted) setInternalSettings(s);
      }).catch(console.error);
    };

    fetchFresh();

    window.addEventListener('store-settings-updated', fetchFresh);
    return () => {
      isMounted = false;
      window.removeEventListener('store-settings-updated', fetchFresh);
    };
  }, []);

  const settings = propSettings || internalSettings;

  // Height sizing mapping
  const heightClasses = {
    sm: 'h-7',
    md: 'h-8 sm:h-9',
    lg: 'h-10 sm:h-12',
    xl: 'h-14 sm:h-16'
  }[size];

  // Logic to determine which logo to use
  const getLogoSrc = () => {
    if (!settings) return variant === 'square' ? '/logo-square.svg' : '/logo.svg';

    const { logoUrl, lightLogoUrl, darkLogoUrl } = settings;

    if (theme === 'light') {
      // Priority: Specific Light Logo > Old Generic Logo > Dark Logo > Static Default
      return lightLogoUrl || logoUrl || darkLogoUrl || '/logo.svg';
    } else {
      // Priority: Specific Dark Logo > Old Generic Logo > Light Logo > Static Default
      return darkLogoUrl || logoUrl || lightLogoUrl || '/logo.svg';
    }
  };

  if (variant === 'square') {
    return (
      <div className={`relative aspect-square flex items-center justify-center ${heightClasses} ${className}`}>
        <img
          src={getValidImageSrc(settings?.logoUrl?.includes('square') ? settings.logoUrl : '/logo-square.svg')}
          alt="لوجو المربع"
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  if (variant === 'mark') {
    // Mark variant is an SVG that's typically white, we should make it theme-aware
    const isDark = theme === 'dark';
    const markColor = isDark ? '#FFFFFF' : '#0F172A';
    
    return (
      <svg
        viewBox="0 0 160 100"
        className={`${heightClasses} w-auto object-contain ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Roof line */}
        <path d="M 30 65 L 85 24 L 93 30 L 44 65 Z" fill={markColor} />
        {/* 4 Panes */}
        <rect x="80" y="44" width="8" height="8" rx="1" fill={markColor} />
        <rect x="91" y="44" width="8" height="8" rx="1" fill={markColor} />
        <rect x="80" y="55" width="8" height="8" rx="1" fill={markColor} />
        <rect x="91" y="55" width="8" height="8" rx="1" fill={markColor} />
        {/* Right Rafter */}
        <path d="M 103 48 L 132 65 L 118 65 L 96 52 Z" fill={markColor} />
        {/* 1981 */}
        <text
          x="80"
          y="92"
          textAnchor="middle"
          fill={markColor}
          className="font-black"
          style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 900, fontSize: '24px' }}
        >
          1981
        </text>
      </svg>
    );
  }

  // Default 'full' variant
  if (!settings) {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <img
          src="/logo.svg"
          alt="Loading..."
          className={`${heightClasses} w-auto object-contain`}
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <StoreLogo 
        settings={settings}
        className={`${heightClasses} w-auto object-contain`}
      />
    </div>
  );
}

export default Logo;
