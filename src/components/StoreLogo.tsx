import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React from 'react';
import { useTheme } from '../lib/themeContext';
import { StoreSettings } from '../types';


interface StoreLogoProps {
  settings: StoreSettings;
  className?: string;
  alt?: string;
  fallbackLogo?: string;
}

/**
 * Centralized Store Logo component that automatically switches
 * between light and dark versions based on the current theme.
 * 
 * Logic Priority:
 * Light Theme: lightLogoUrl -> darkLogoUrl -> legacy logoUrl -> default fallback
 * Dark Theme: darkLogoUrl -> lightLogoUrl -> legacy logoUrl -> default fallback
 */
export function StoreLogo({ 
  settings, 
  className = "h-8 w-auto object-contain", 
  alt,
  fallbackLogo = "/logo.svg"
}: StoreLogoProps) {
  const { theme } = useTheme();

  const resolveLogo = () => {
    const { lightLogoUrl, darkLogoUrl, logoUrl } = settings;
    const isCustom = (url?: string) => Boolean(url && url.trim() !== '' && url !== '/logo.svg');
    
    if (theme === 'light') {
      if (isCustom(lightLogoUrl)) return lightLogoUrl!;
      if (isCustom(logoUrl)) return logoUrl!;
      if (isCustom(darkLogoUrl)) return darkLogoUrl!;
      return (lightLogoUrl || logoUrl || darkLogoUrl || fallbackLogo).trim();
    } else {
      if (isCustom(darkLogoUrl)) return darkLogoUrl!;
      if (isCustom(logoUrl)) return logoUrl!;
      if (isCustom(lightLogoUrl)) return lightLogoUrl!;
      return (darkLogoUrl || logoUrl || lightLogoUrl || fallbackLogo).trim();
    }
  };

  return (
    <img
      src={getValidImageSrc(resolveLogo())}
      alt={alt || settings.storeName || 'Store Logo'}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
