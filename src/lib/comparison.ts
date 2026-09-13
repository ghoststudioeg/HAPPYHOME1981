import { Product } from '../types';
import { isSameCategory, isMobileProduct } from './recommendations';
import {
  calculateComparison,
  comparePhones as calculatePhoneComparison,
  compareProducts as calculateGeneralProductComparison
} from './comparisonEngine';
import {
  Cpu,
  HardDrive,
  Camera,
  Battery,
  Zap,
  Fingerprint,
  Smartphone,
  Radio,
  Layers,
  Sparkles,
  Tv,
  WashingMachine,
  ShieldCheck,
  Gauge,
  Thermometer,
  Wind,
  Sliders,
  HelpCircle,
  LucideIcon
} from 'lucide-react';

export type WinnerType = 'A' | 'B' | 'tie' | 'none';

export interface SpecComparisonRow {
  key: string;
  label: string;
  icon: LucideIcon;
  valA: string;
  valB: string;
  winner: WinnerType;
  advantageText?: string;
  isMeasurable: boolean;
}

export interface ComparisonResult {
  productA: Product;
  productB: Product;
  isCategoryMismatch: boolean;
  mismatchWarning?: string;
  rows: SpecComparisonRow[];
  scoreA: number | null; 
  scoreB: number | null; 
  winsA: number;
  winsB: number;
  ties: number;
  totalComparableSpecs: number;
  overallWinner: 'A' | 'B' | 'tie' | 'insufficient';
  summaryText: string;
  disclaimerText: string;
  priceDiff: number;
  cheaperProduct: 'A' | 'B' | 'equal';
  
  // New Engine Fields
  confidence: 'high' | 'medium' | 'low';
  strengthsA: string[];
  strengthsB: string[];
  actualComparableScore: number;
  maxPossibleScore: number;
}

/**
 * Filter products strictly compatible with the current product for comparison
 * Requirements:
 * 1. ONLY display compatible products from the SAME category as the current product.
 * 2. Use categoryId as the PRIMARY filtering key.
 * 3. Filter happens BEFORE rendering the selector list.
 * 4. Never use price similarity.
 */
export function getCompatibleComparisonProducts(currentProduct: Product, allProducts: Product[]): Product[] {
  if (!currentProduct || !allProducts || !Array.isArray(allProducts)) return [];

  const targetCategoryId = currentProduct.categoryId ? String(currentProduct.categoryId).trim() : '';
  const targetCategoryName = (currentProduct.categoryName || '').trim().toLowerCase();
  const currentIsMobile = isMobileProduct(currentProduct);

  return allProducts.filter((p) => {
    // 1. Must not be the current product itself
    if (!p || p.id === currentProduct.id) return false;

    // 2. Must be published/active
    if (p.isPublished === false) return false;

    // 3. Strict categoryId filtering as the primary key
    if (targetCategoryId) {
      const pCatId = p.categoryId ? String(p.categoryId).trim() : '';
      if (!pCatId || pCatId !== targetCategoryId) {
        return false;
      }
    } else if (targetCategoryName) {
      // Fallback only if currentProduct has no categoryId
      const pCatName = (p.categoryName || '').trim().toLowerCase();
      if (!pCatName || pCatName !== targetCategoryName) {
        return false;
      }
    } else {
      if (!isSameCategory(p, currentProduct)) {
        return false;
      }
    }

    // 4. Strict category type isolation: mobile phones can NEVER appear in school-bags or appliances lists, and vice-versa
    if (currentIsMobile !== isMobileProduct(p)) {
      return false;
    }

    return true;
  });
}

/**
 * Get the singular noun for a category (e.g., "هاتف", "حقيبة")
 */
export function getCategoryNoun(product: Product): string {
  if (!product) return 'منتجاً';
  
  if (isMobileProduct(product)) {
    return 'هاتفاً';
  }
  
  const categoryName = (product.categoryName || '').toLowerCase();
  if (categoryName.includes('ثلاجة') || categoryName.includes('fridge')) return 'ثلاجة';
  if (categoryName.includes('حقيبة') || categoryName.includes('شنط') || categoryName.includes('bag')) return 'حقيبة';
  if (categoryName.includes('شاشة') || categoryName.includes('تلفزيون') || categoryName.includes('tv')) return 'شاشة';
  if (categoryName.includes('غسالة') || categoryName.includes('washer')) return 'غسالة';
  if (categoryName.includes('تكييف') || categoryName.includes('ac') || categoryName.includes('air conditioner')) return 'تكييفاً';
  
  return 'منتجاً';
}

/**
 * Get dynamic label for "Change Product" based on category
 */
export function getChangeProductLabel(product: Product): string {
  const noun = getCategoryNoun(product);
  if (noun === 'منتجاً') return 'تغيير المنتج';
  
  // Handling female/male nouns for "تغيير"
  if (noun === 'ثلاجة' || noun === 'حقيبة' || noun === 'شاشة' || noun === 'غسالة') {
    return `تغيير ال${noun}`;
  }
  
  if (noun === 'هاتفاً') return 'تغيير الهاتف';
  if (noun === 'تكييفاً') return 'تغيير التكييف';

  return 'تغيير المنتج';
}

/**
 * Dictionary mapping common spec keys across categories to Arabic labels and icons
 */
const KNOWN_SPEC_METADATA: Record<string, { label: string; icon: LucideIcon; isMeasurable: boolean }> = {
  // Smartphones / Electronics
  ram: { label: 'الذاكرة العشوائية (RAM)', icon: Layers, isMeasurable: true },
  storage: { label: 'المساحة التخزينية', icon: HardDrive, isMeasurable: true },
  battery: { label: 'سعة البطارية', icon: Battery, isMeasurable: true },
  chargingSpeed: { label: 'سرعة الشحن', icon: Zap, isMeasurable: true },
  rearCamera: { label: 'الكاميرا الخلفية', icon: Camera, isMeasurable: true },
  frontCamera: { label: 'الكاميرا الأمامية', icon: Sparkles, isMeasurable: true },
  screen: { label: 'الشاشة ومعدل التحديث', icon: Smartphone, isMeasurable: true },
  screenSize: { label: 'حجم الشاشة (بوصة)', icon: Tv, isMeasurable: true },
  resolution: { label: 'دقة الشاشة', icon: Tv, isMeasurable: false },
  processor: { label: 'المعالج / الشريحة', icon: Cpu, isMeasurable: false },
  network: { label: 'شبكات الاتصال', icon: Radio, isMeasurable: false },
  fingerprint: { label: 'مستشعر الأمان والأنظمة', icon: Fingerprint, isMeasurable: false },
  os: { label: 'نظام التشغيل', icon: Smartphone, isMeasurable: false },

  // Home Appliances (TVs, Washers, Fridges, ACs, etc.)
  capacity: { label: 'السعة الحجمية (كجم / لتر)', icon: WashingMachine, isMeasurable: true },
  volume: { label: 'الحجم التخزيني (لتر)', icon: WashingMachine, isMeasurable: true },
  spinSpeed: { label: 'سرعة الدوران (RPM)', icon: Gauge, isMeasurable: true },
  power: { label: 'القدرة / الطاقة (واط)', icon: Zap, isMeasurable: true },
  warranty: { label: 'مدة الضمان', icon: ShieldCheck, isMeasurable: true },
  coolingType: { label: 'تكنولوجيا التبريد (نوفروست)', icon: Thermometer, isMeasurable: false },
  energyClass: { label: 'كفاءة الطاقة', icon: Gauge, isMeasurable: false },
  noiseLevel: { label: 'مستوى الضوضاء', icon: Wind, isMeasurable: false },
  motorType: { label: 'نوع المحرك / الإنفرتر', icon: Cpu, isMeasurable: false }
};

/**
 * Format dynamic key into clean Arabic title if unknown
 */
function formatSpecKeyLabel(key: string): string {
  if (KNOWN_SPEC_METADATA[key]) {
    return KNOWN_SPEC_METADATA[key].label;
  }
  // Convert camelCase or snake_case to Space Capitalized
  const words = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Get icon for spec key
 */
function getSpecIcon(key: string): LucideIcon {
  return KNOWN_SPEC_METADATA[key]?.icon || Sliders;
}

/**
 * Arabic to Western numeral conversion
 */
function normalizeNumerals(str: string): string {
  const arabicNumerals = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(arabicNumerals[i], i.toString());
  }
  return res;
}

/**
 * Extracts numeric metric with unit from string value
 */
function parseNumericValue(val: string, key: string): { num: number; unit?: string } | null {
  if (!val) return null;
  
  // Normalize numerals and basic cleanup
  let clean = normalizeNumerals(val.trim().toLowerCase());
  
  // Special handling for camera: extract first (primary) megapixel value
  if (key === 'rearCamera' || key === 'frontCamera') {
    // Matches patterns like "50 MP", "13+2+2", "13.0 ميجا", "50 ميجابكسل"
    const match = clean.match(/(\d+(?:\.\d+)?)\s*(?:mp|ميجابكسل|ميجا)/i) || 
                  clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]), unit: 'MP' } : null;
  }

  // TB to GB conversion
  if (/tb|تيرا/i.test(clean)) {
    const match = clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]) * 1024, unit: 'GB' } : null;
  }

  // GB
  if (/gb|g|جيجا/i.test(clean)) {
    const match = clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]), unit: 'GB' } : null;
  }

  // mAh
  if (/mah|مللي/i.test(clean)) {
    const match = clean.match(/(\d{3,5})/);
    return match ? { num: parseInt(match[1], 10), unit: 'mAh' } : null;
  }

  // Watt W
  if (/\b\d+\s*(?:w|watt|واط|وات)\b/i.test(clean)) {
    const match = clean.match(/(\d+)/);
    return match ? { num: parseInt(match[1], 10), unit: 'W' } : null;
  }

  // Hz
  if (/hz|هرتز/i.test(clean)) {
    const match = clean.match(/(\d+)/);
    return match ? { num: parseInt(match[1], 10), unit: 'Hz' } : null;
  }

  // Inches
  if (/بوصة|inch|inches|"/i.test(clean)) {
    const match = clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]), unit: 'بوصة' } : null;
  }

  // Generic standalone numbers
  const numMatch = clean.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return { num: parseFloat(numMatch[1]) };
  }

  return null;
}

/**
 * Simple processor performance ranking (Higher = Better tier)
 * Tiers: 1 (Entry), 2 (Mid), 3 (Mid-High), 4 (High), 5 (Flagship)
 */
function getProcessorTier(name: string): number {
  const n = name.toLowerCase();
  
  // Flagship
  if (/snapdragon 8 gen|a17 pro|a18|dimensity 9/i.test(n)) return 5;
  if (/snapdragon 8\+|a16|a15|dimensity 8300|exynos 2400/i.test(n)) return 4.5;
  
  // High
  if (/snapdragon 8|dimensity 8|exynos 2200|exynos 2100|a14|a13/i.test(n)) return 4;
  if (/snapdragon 7 gen|dimensity 7/i.test(n)) return 3.5;
  
  // Mid-High
  if (/snapdragon 7|dimensity 1|dimensity 7|helio g99|helio g96/i.test(n)) return 3;
  
  // Mid
  if (/snapdragon 6|dimensity 6|helio g8|helio g7/i.test(n)) return 2;
  
  // Entry
  if (/unisoc|helio p|helio a|quad core|snapdragon 4/i.test(n)) return 1;
  
  return 0; // Unknown
}

/**
 * Rules defining specification comparison behavior
 */
const SPEC_RULES: Record<string, { higherIsBetter: boolean; weight: number; isBoolean?: boolean; isCategorical?: boolean }> = {
  ram: { higherIsBetter: true, weight: 15 },
  storage: { higherIsBetter: true, weight: 10 },
  processor: { higherIsBetter: true, weight: 20, isCategorical: true },
  rearCamera: { higherIsBetter: true, weight: 20 },
  frontCamera: { higherIsBetter: true, weight: 10 },
  battery: { higherIsBetter: true, weight: 15 },
  chargingSpeed: { higherIsBetter: true, weight: 10 },
  screen: { higherIsBetter: true, weight: 15 },
  network: { higherIsBetter: true, weight: 10, isBoolean: true },
  fingerprint: { higherIsBetter: true, weight: 5, isBoolean: true },
};

/**
 * Dynamic evaluation of winner for a specification row
 */
export function evaluateSpecWinner(
  key: string,
  rawA?: string,
  rawB?: string
): { winner: WinnerType; advantageText?: string; isMeasurable: boolean } {
  const cleanA = (rawA || '').trim();
  const cleanB = (rawB || '').trim();

  if (!cleanA || !cleanB || cleanA === 'غير محدد' || cleanB === 'غير محدد') {
    return { winner: 'none', isMeasurable: false };
  }

  if (cleanA.toLowerCase() === cleanB.toLowerCase()) {
    return { winner: 'tie', advantageText: 'متطابق', isMeasurable: false };
  }

  const rule = SPEC_RULES[key];
  if (!rule) return { winner: 'none', isMeasurable: false };

  // 1. Boolean check (5G, Fingerprint, etc.)
  if (rule.isBoolean) {
    const yesKeywords = ['yes', 'available', 'supported', 'متاح', 'يدعم', 'نعم', 'بصمة', '5g'];
    const isA = yesKeywords.some(k => cleanA.toLowerCase().includes(k));
    const isB = yesKeywords.some(k => cleanB.toLowerCase().includes(k));
    
    if (isA && !isB) return { winner: 'A', advantageText: 'ميزة متوفرة', isMeasurable: true };
    if (!isA && isB) return { winner: 'B', advantageText: 'ميزة متوفرة', isMeasurable: true };
    return { winner: 'tie', isMeasurable: true };
  }

  // 2. Categorical check (Processor)
  if (rule.isCategorical && key === 'processor') {
    const tierA = getProcessorTier(cleanA);
    const tierB = getProcessorTier(cleanB);
    
    if (tierA > 0 && tierB > 0) {
      if (tierA > tierB) return { winner: 'A', advantageText: 'أداء أقوى', isMeasurable: true };
      if (tierB > tierA) return { winner: 'B', advantageText: 'أداء أقوى', isMeasurable: true };
      return { winner: 'tie', isMeasurable: true };
    }
    return { winner: 'none', advantageText: 'مقارنة غير كافية', isMeasurable: false };
  }

  // 3. Numeric check
  const parseA = parseNumericValue(cleanA, key);
  const parseB = parseNumericValue(cleanB, key);

  if (parseA && parseB) {
    const higherWins = rule.higherIsBetter;
    if (parseA.num === parseB.num) return { winner: 'tie', advantageText: 'متطابق', isMeasurable: true };
    
    const aWins = higherWins ? parseA.num > parseB.num : parseA.num < parseB.num;
    const diff = Math.abs(parseA.num - parseB.num);
    const unit = parseA.unit || '';
    const diffText = `(+${diff % 1 === 0 ? diff : diff.toFixed(1)} ${unit})`.trim();

    return {
      winner: aWins ? 'A' : 'B',
      advantageText: aWins ? `أفضل ${diffText}` : `أفضل ${diffText}`,
      isMeasurable: true
    };
  }

  return { winner: 'none', isMeasurable: false };
}

/**
 * Side-by-side comparison engine delegation for phones
 */
export function comparePhones(productA: Product, productB: Product): ComparisonResult {
  const calculation = calculatePhoneComparison(productA, productB);

  return {
    productA,
    productB,
    isCategoryMismatch: !calculation.categoryCompatible,
    mismatchWarning: !calculation.categoryCompatible ? 'لا يمكن مقارنة هواتف من أقسام مختلفة.' : undefined,
    rows: calculation.rows.map(r => ({
      ...r,
      winner: r.status === 'insufficient_data' ? 'none' : r.status,
      advantageText: r.status === 'insufficient_data' ? undefined : (r.advantageText || r.reason)
    })),
    scoreA: calculation.normalizedScoreA,
    scoreB: calculation.normalizedScoreB,
    winsA: calculation.rows.filter(r => r.status === 'A').length,
    winsB: calculation.rows.filter(r => r.status === 'B').length,
    ties: calculation.rows.filter(r => r.status === 'tie').length,
    totalComparableSpecs: calculation.rows.filter(r => r.status !== 'insufficient_data').length,
    overallWinner: calculation.winner === 'insufficient_data' ? 'insufficient' : calculation.winner,
    summaryText: calculation.summary,
    disclaimerText: 'النتيجة تعتمد على المواصفات المسجلة في المتجر وليست تقييمًا عالميًا للمنتج.',
    priceDiff: calculation.priceDiff,
    cheaperProduct: calculation.cheaperProduct,
    confidence: calculation.confidence,
    strengthsA: calculation.strengthsA,
    strengthsB: calculation.strengthsB,
    actualComparableScore: calculation.actualComparableScore,
    maxPossibleScore: calculation.maxPossibleScore
  };
}

/**
 * Side-by-side comparison engine delegation
 */
export function compareProducts(productA: Product, productB: Product): ComparisonResult {
  if (isMobileProduct(productA) && isMobileProduct(productB)) {
    return comparePhones(productA, productB);
  }

  const calculation = calculateComparison(productA, productB);
  
  return {
    productA,
    productB,
    isCategoryMismatch: !calculation.categoryCompatible,
    mismatchWarning: !calculation.categoryCompatible ? 'لا يمكن مقارنة منتجات من أنواع مختلفة.' : undefined,
    rows: calculation.rows.map(r => ({
      ...r,
      winner: r.status === 'insufficient_data' ? 'none' : r.status,
      advantageText: r.status === 'insufficient_data' ? undefined : (r.advantageText || r.reason)
    })),
    scoreA: calculation.normalizedScoreA,
    scoreB: calculation.normalizedScoreB,
    winsA: calculation.rows.filter(r => r.status === 'A').length,
    winsB: calculation.rows.filter(r => r.status === 'B').length,
    ties: calculation.rows.filter(r => r.status === 'tie').length,
    totalComparableSpecs: calculation.rows.filter(r => r.status !== 'insufficient_data').length,
    overallWinner: calculation.winner === 'insufficient_data' ? 'insufficient' : calculation.winner,
    summaryText: calculation.summary,
    disclaimerText: 'النتيجة تعتمد على المواصفات المسجلة في المتجر وليست تقييمًا عالميًا للمنتج.',
    priceDiff: calculation.priceDiff,
    cheaperProduct: calculation.cheaperProduct,
    confidence: calculation.confidence,
    strengthsA: calculation.strengthsA,
    strengthsB: calculation.strengthsB,
    actualComparableScore: calculation.actualComparableScore,
    maxPossibleScore: calculation.maxPossibleScore
  };
}
