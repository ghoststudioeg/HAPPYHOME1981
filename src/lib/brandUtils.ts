// Known smartphone brands for intelligent extraction and diversity
const KNOWN_BRANDS = [
  'Apple',
  'iPhone',
  'Samsung',
  'Xiaomi',
  'Redmi',
  'Poco',
  'POCO',
  'Oppo',
  'OPPO',
  'Vivo',
  'vivo',
  'Realme',
  'realme',
  'Honor',
  'HONOR',
  'Huawei',
  'Infinix',
  'Tecno',
  'TECNO',
  'Motorola',
  'Moto',
  'OnePlus',
  'Google',
  'Pixel',
  'Sony',
  'Nokia',
  'Nothing',
  'ZTE',
  'Asus',
  'ROG'
];

/**
 * Extracts a normalized brand name from a product name or category.
 */
export function extractBrand(productName: string = ''): string {
  const cleanName = productName.trim();
  if (!cleanName) return 'أخرى';

  // Check against known brand dictionary
  for (const brand of KNOWN_BRANDS) {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    if (regex.test(cleanName)) {
      // Normalize brand casing
      const upper = brand.toUpperCase();
      if (upper === 'IPHONE' || upper === 'APPLE') return 'Apple';
      if (upper === 'SAMSUNG') return 'Samsung';
      if (upper === 'XIAOMI' || upper === 'REDMI' || upper === 'POCO') return 'Xiaomi';
      if (upper === 'OPPO') return 'OPPO';
      if (upper === 'VIVO') return 'Vivo';
      if (upper === 'REALME') return 'Realme';
      if (upper === 'HONOR') return 'Honor';
      if (upper === 'HUAWEI') return 'Huawei';
      if (upper === 'INFINIX') return 'Infinix';
      if (upper === 'TECNO') return 'Tecno';
      if (upper === 'ONEPLUS') return 'OnePlus';
      if (upper === 'GOOGLE' || upper === 'PIXEL') return 'Google';
      return brand;
    }
  }

  // Fallback to first word
  const firstWord = cleanName.split(/[\s-]+/)[0];
  return firstWord || 'أخرى';
}
