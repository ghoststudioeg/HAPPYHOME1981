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
    
    if (theme === 'light') {
      // Light Theme Priority
      if (lightLogoUrl && lightLogoUrl.trim() !== '') return lightLogoUrl;
      if (darkLogoUrl && darkLogoUrl.trim() !== '') return darkLogoUrl;
      if (logoUrl && logoUrl.trim() !== '') return logoUrl;
      return fallbackLogo;
    } else {
      // Dark Theme Priority
      if (darkLogoUrl && darkLogoUrl.trim() !== '') return darkLogoUrl;
      if (lightLogoUrl && lightLogoUrl.trim() !== '') return lightLogoUrl;
      if (logoUrl && logoUrl.trim() !== '') return logoUrl;
      return fallbackLogo;
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
