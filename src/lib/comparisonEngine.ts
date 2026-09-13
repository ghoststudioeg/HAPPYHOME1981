import { Product } from '../types';
import {
  LucideIcon,
  Layers,
  HardDrive,
  Battery,
  Zap,
  Camera,
  Sparkles,
  Smartphone,
  Radio,
  Fingerprint,
  Cpu,
  Tv,
  ShieldCheck,
  Gauge,
  Thermometer,
  Wind,
  Sliders
} from 'lucide-react';
import { isMobileProduct } from './recommendations';

/**
 * Result of a single specification comparison row
 */
export interface SpecComparisonRow {
  key: string;
  label: string;
  icon: LucideIcon;
  valA: string;
  valB: string;
  status: 'A' | 'B' | 'tie' | 'insufficient_data';
  weight: number;
  scoreA: number;
  scoreB: number;
  reason: string;
  isMeasurable: boolean;
  advantageText?: string;
}

/**
 * The final calculated comparison verdict
 */
export interface DetailedComparisonResult {
  categoryCompatible: boolean;
  rows: SpecComparisonRow[];
  weightedScoreA: number;
  weightedScoreB: number;
  normalizedScoreA: number; // 0-100 percentage
  normalizedScoreB: number; // 0-100 percentage
  winner: 'A' | 'B' | 'tie' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low';
  strengthsA: string[];
  strengthsB: string[];
  summary: string;
  maxPossibleScore: number;
  actualComparableScore: number;
  priceDiff: number;
  cheaperProduct: 'A' | 'B' | 'equal';
}

export type ComparisonDirection =
  | 'higher_is_better'
  | 'lower_is_better'
  | 'boolean'
  | 'categorical'
  | 'screen_tech'
  | 'informational';

export interface SpecRule {
  key: string;
  aliases: string[];
  label: string;
  icon: LucideIcon;
  direction: ComparisonDirection;
  weight: number;
  unit?: string;
}

/**
 * Normalize Arabic numerals to Western numerals
 */
export function normalizeNumerals(str: string): string {
  if (!str) return '';
  const arabicNumerals = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(arabicNumerals[i], i.toString());
  }
  return res;
}

/**
 * Retrieve specification value checking key and aliases
 */
export function getSpecRawValue(
  specs: Record<string, any> | undefined,
  primaryKey: string,
  aliases: string[] = []
): string {
  if (!specs) return '';

  const candidates = [primaryKey, ...aliases];
  for (const c of candidates) {
    if (specs[c] !== undefined && specs[c] !== null && String(specs[c]).trim() !== '') {
      return String(specs[c]).trim();
    }
  }

  // Case-insensitive fallback
  const specKeys = Object.keys(specs);
  for (const c of candidates) {
    const matched = specKeys.find((k) => k.toLowerCase() === c.toLowerCase());
    if (matched && specs[matched] !== undefined && specs[matched] !== null && String(specs[matched]).trim() !== '') {
      return String(specs[matched]).trim();
    }
  }

  return '';
}

/**
 * Specialized parser for numeric values with units
 */
export function parseNumericSpec(val: string, key: string): { num: number; unit?: string } | null {
  if (!val || val === 'غير محدد') return null;

  let clean = normalizeNumerals(val.trim().toLowerCase()).replace(/,/g, '');

  // Camera handling (MP): e.g. "13 MP", "13 ميجابكسل", "13+2+2", "50 ميجابيكسل", "108MP"
  if (key === 'rearCamera' || key === 'frontCamera') {
    // Check for explicit megapixel mention first
    const mpMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:mp|ميجابكسل|ميجابيكسل|ميجا\s*بكسل|ميجا\s*بيكسل|ميجا)/i);
    if (mpMatch) {
      return { num: parseFloat(mpMatch[1]), unit: 'MP' };
    }
    // Fallback: extract first number if it represents primary camera sensor
    const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      return { num: parseFloat(numMatch[1]), unit: 'MP' };
    }
    return null;
  }

  // Storage handling: TB to GB
  if (/tb|تيرا/i.test(clean)) {
    const match = clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]) * 1024, unit: 'GB' } : null;
  }
  if (key === 'storage' || /gb|جيجا/i.test(clean)) {
    const match = clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]), unit: 'GB' } : null;
  }

  // RAM handling (GB): handles "4 GB", "8GB", "4+4 GB"
  if (key === 'ram') {
    // If format is like "4+4" or "8+8", primary RAM is the first number
    const match = clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]), unit: 'GB' } : null;
  }

  // Battery handling (mAh): "5000 mAh", "5000 مللي"
  if (key === 'battery' || /mah|مللي/i.test(clean)) {
    const match = clean.match(/(\d{3,5})/);
    return match ? { num: parseInt(match[1], 10), unit: 'mAh' } : null;
  }

  // Charging Speed (W): "33W", "67 واط", "18 وات"
  if (key === 'chargingSpeed' || /\b\d+\s*(?:w|watt|واط|وات)\b/i.test(clean)) {
    const match = clean.match(/(\d+)/);
    return match ? { num: parseInt(match[1], 10), unit: 'W' } : null;
  }

  // Refresh Rate (Hz): "120Hz", "90 هرتز"
  if (key === 'refreshRate' || /hz|هرتز|هيرتز/i.test(clean)) {
    const match = clean.match(/(\d+)/);
    return match ? { num: parseInt(match[1], 10), unit: 'Hz' } : null;
  }

  // Display Size (Inches): "6.67 بوصة", "6.5\""
  if (key === 'screenSize' || /بوصة|inch|inches|"/i.test(clean)) {
    const match = clean.match(/(\d+(?:\.\d+)?)/);
    return match ? { num: parseFloat(match[1]), unit: 'بوصة' } : null;
  }

  // Resolution handling (Width x Height or Pixels): e.g. "1080 x 2400"
  if (key === 'resolution') {
    const match = clean.match(/(\d{3,})\s*[x*×]\s*(\d{3,})/);
    if (match) {
      return { num: parseInt(match[1], 10) * parseInt(match[2], 10), unit: 'px' };
    }
    if (/2k|qhd|1440/i.test(clean)) return { num: 3686400, unit: 'px' };
    if (/fhd\+|1080/i.test(clean)) return { num: 2592000, unit: 'px' };
    if (/hd\+|720/i.test(clean)) return { num: 1152000, unit: 'px' };
  }

  // Generic number extraction
  const genericMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (genericMatch) {
    return { num: parseFloat(genericMatch[1]) };
  }

  return null;
}

/**
 * Categorical Processor Tier Ranking (Higher = Better performance)
 */
export function getProcessorTier(name: string): { tier: number; label: string } {
  const n = name.toLowerCase();

  // Tier 6: Flagship Ultra
  if (/snapdragon 8 gen 3|a18 pro|a17 pro|dimensity 9300/i.test(n)) {
    return { tier: 6, label: 'فئة رائدة فائقة' };
  }
  // Tier 5: Flagship
  if (/snapdragon 8 gen 2|a16|dimensity 9200|dimensity 9000|exynos 2400/i.test(n)) {
    return { tier: 5, label: 'فئة رائدة' };
  }
  // Tier 4.5: Sub-flagship / Premium Midrange
  if (/snapdragon 8\+|snapdragon 7\+ gen 2|dimensity 8300|a15|exynos 2200/i.test(n)) {
    return { tier: 4.5, label: 'فئة شبه رائدة' };
  }
  // Tier 4: High Performance
  if (/snapdragon 8 gen 1|snapdragon 888|dimensity 8200|dimensity 8100|a14|exynos 2100/i.test(n)) {
    return { tier: 4, label: 'أداء عالي' };
  }
  // Tier 3.5: Upper Midrange
  if (/snapdragon 7s gen 2|snapdragon 7 gen 1|snapdragon 778|dimensity 7200|dimensity 7050|dimensity 1080|exynos 1480|exynos 1380/i.test(n)) {
    return { tier: 3.5, label: 'فئة متوسطة عليا' };
  }
  // Tier 3: Solid Midrange
  if (/helio g99|helio g96|helio g95|snapdragon 695|snapdragon 4 gen 2|dimensity 6080|dimensity 700|exynos 1280/i.test(n)) {
    return { tier: 3, label: 'فئة متوسطة متوازنة' };
  }
  // Tier 2.5: Budget Midrange
  if (/helio g88|helio g85|helio g80|snapdragon 680|snapdragon 685|unisoc t616|unisoc t612|unisoc t606/i.test(n)) {
    return { tier: 2.5, label: 'فئة اقتصادية متقدمة' };
  }
  // Tier 2: Entry-level
  if (/helio g37|helio g36|helio g35|helio p35|exynos 850|snapdragon 4/i.test(n)) {
    return { tier: 2, label: 'فئة اقتصادية' };
  }
  // Tier 1: Basic Entry
  if (/helio a|unisoc sc|quad[\s-]?core/i.test(n)) {
    return { tier: 1, label: 'استخدام أساسي' };
  }

  return { tier: 0, label: 'غير مصنف' };
}

/**
 * Screen technology rating
 */
export function evaluateScreenTech(val: string): number {
  const n = val.toLowerCase();
  if (/amoled|super amoled|oled/i.test(n)) return 3;
  if (/ips|ltps/i.test(n)) return 2;
  if (/tft|pls|lcd/i.test(n)) return 1;
  return 0;
}

/**
 * Explicit structured specification rules for mobile phones
 */
export const PHONE_SPEC_RULES: SpecRule[] = [
  {
    key: 'processor',
    aliases: ['cpu', 'chipset', 'المعالج', 'شريحة المعالجة'],
    label: 'المعالج (الأداء)',
    icon: Cpu,
    direction: 'categorical',
    weight: 20
  },
  {
    key: 'ram',
    aliases: ['memory', 'الرام', 'الذاكرة العشوائية', 'ذاكرة الوصول العشوائي'],
    label: 'الذاكرة العشوائية (RAM)',
    icon: Layers,
    direction: 'higher_is_better',
    weight: 15,
    unit: 'GB'
  },
  {
    key: 'rearCamera',
    aliases: ['camera', 'mainCamera', 'rear_camera', 'الكاميرا الخلفية', 'الكاميرا الرئيسية', 'كاميرا'],
    label: 'الكاميرا الرئيسية',
    icon: Camera,
    direction: 'higher_is_better',
    weight: 15,
    unit: 'MP'
  },
  {
    key: 'battery',
    aliases: ['batteryCapacity', 'البطارية', 'سعة البطارية'],
    label: 'سعة البطارية',
    icon: Battery,
    direction: 'higher_is_better',
    weight: 12,
    unit: 'mAh'
  },
  {
    key: 'chargingSpeed',
    aliases: ['charging', 'fastCharging', 'الشحن', 'سرعة الشحن', 'قدرة الشحن'],
    label: 'سرعة الشحن السريع',
    icon: Zap,
    direction: 'higher_is_better',
    weight: 10,
    unit: 'W'
  },
  {
    key: 'storage',
    aliases: ['rom', 'internalStorage', 'المساحة الداخلية', 'المساحة التخزينية', 'الذاكرة الداخلية'],
    label: 'المساحة التخزينية',
    icon: HardDrive,
    direction: 'higher_is_better',
    weight: 10,
    unit: 'GB'
  },
  {
    key: 'screen',
    aliases: ['display', 'الشاشة', 'نوع الشاشة'],
    label: 'الشاشة ونوع اللوحة',
    icon: Smartphone,
    direction: 'screen_tech',
    weight: 8
  },
  {
    key: 'refreshRate',
    aliases: ['refresh_rate', 'معدل التحديث', 'التردد'],
    label: 'معدل تحديث الشاشة',
    icon: Zap,
    direction: 'higher_is_better',
    weight: 6,
    unit: 'Hz'
  },
  {
    key: 'frontCamera',
    aliases: ['selfieCamera', 'front_camera', 'selfie', 'الكاميرا الأمامية', 'كاميرا السيلفي'],
    label: 'الكاميرا الأمامية (سيلفي)',
    icon: Sparkles,
    direction: 'higher_is_better',
    weight: 6,
    unit: 'MP'
  },
  {
    key: 'resolution',
    aliases: ['screenResolution', 'دقة الشاشة', 'الدقة'],
    label: 'دقة الشاشة',
    icon: Tv,
    direction: 'higher_is_better',
    weight: 5
  },
  {
    key: 'fingerprint',
    aliases: ['security', 'البصمة', 'مستشعر البصمة'],
    label: 'مستشعر البصمة',
    icon: Fingerprint,
    direction: 'boolean',
    weight: 4
  },
  {
    key: 'network',
    aliases: ['connectivity', '5g', 'الشبكة', 'شبكات الاتصال'],
    label: 'دعم شبكات الجيل الخامس 5G',
    icon: Radio,
    direction: 'boolean',
    weight: 4
  },
  {
    key: 'screenSize',
    aliases: ['size', 'حجم الشاشة', 'مقاس الشاشة'],
    label: 'حجم الشاشة (بوصة)',
    icon: Tv,
    direction: 'informational',
    weight: 2
  }
];

/**
 * Generic specification rules for non-mobile products
 */
export const GENERIC_SPEC_RULES: SpecRule[] = [
  {
    key: 'capacity',
    aliases: ['volume', 'السعة', 'السعة الحجمية', 'الحجم التخزيني'],
    label: 'السعة الحجمية',
    icon: Layers,
    direction: 'higher_is_better',
    weight: 15
  },
  {
    key: 'power',
    aliases: ['wattage', 'القدرة', 'القدرة الكهربائية', 'الواط'],
    label: 'القدرة / الطاقة (واط)',
    icon: Zap,
    direction: 'higher_is_better',
    weight: 15
  },
  {
    key: 'warranty',
    aliases: ['ضمان', 'الضمان', 'مدة الضمان'],
    label: 'مدة الضمان (سنوات)',
    icon: ShieldCheck,
    direction: 'higher_is_better',
    weight: 10
  },
  {
    key: 'spinSpeed',
    aliases: ['rpm', 'سرعة الدوران'],
    label: 'سرعة الدوران (RPM)',
    icon: Gauge,
    direction: 'higher_is_better',
    weight: 10
  },
  {
    key: 'coolingType',
    aliases: ['نظام التبريد', 'التبريد'],
    label: 'تكنولوجيا التبريد',
    icon: Thermometer,
    direction: 'boolean',
    weight: 8
  },
  {
    key: 'energyClass',
    aliases: ['كفاءة الطاقة', 'فئة الطاقة'],
    label: 'كفاءة الطاقة',
    icon: Gauge,
    direction: 'informational',
    weight: 8
  },
  {
    key: 'noiseLevel',
    aliases: ['مستوى الضوضاء', 'الهدوء'],
    label: 'مستوى الضوضاء',
    icon: Wind,
    direction: 'lower_is_better',
    weight: 6
  }
];

/**
 * Real data-driven Structured Specification Comparison Engine for Phones
 */
export function comparePhones(productA: Product, productB: Product): DetailedComparisonResult {
  const isCompatible = Boolean(productA.categoryId && productB.categoryId && productA.categoryId === productB.categoryId);
  const specsA = productA.specifications || {};
  const specsB = productB.specifications || {};

  const rows: SpecComparisonRow[] = [];
  let weightedScoreA = 0;
  let weightedScoreB = 0;
  let actualComparableScore = 0;

  PHONE_SPEC_RULES.forEach((rule) => {
    let rawA = getSpecRawValue(specsA, rule.key, rule.aliases);
    let rawB = getSpecRawValue(specsB, rule.key, rule.aliases);

    // Contextual extraction for refresh rate if missing from refreshRate field but present in screen
    if (rule.key === 'refreshRate') {
      if (!rawA) {
        const screenA = getSpecRawValue(specsA, 'screen', ['display', 'الشاشة']);
        const hzMatch = screenA.match(/(\d{2,3})\s*(?:hz|هرتز)/i);
        if (hzMatch) rawA = `${hzMatch[1]} Hz`;
      }
      if (!rawB) {
        const screenB = getSpecRawValue(specsB, 'screen', ['display', 'الشاشة']);
        const hzMatch = screenB.match(/(\d{2,3})\s*(?:hz|هرتز)/i);
        if (hzMatch) rawB = `${hzMatch[1]} Hz`;
      }
    }

    // Contextual extraction for screen size if missing
    if (rule.key === 'screenSize') {
      if (!rawA) {
        const screenA = getSpecRawValue(specsA, 'screen', ['display', 'الشاشة']);
        const inchMatch = screenA.match(/(\d+(?:\.\d+)?)\s*(?:بوصة|inch|")/i);
        if (inchMatch) rawA = `${inchMatch[1]} بوصة`;
      }
      if (!rawB) {
        const screenB = getSpecRawValue(specsB, 'screen', ['display', 'الشاشة']);
        const inchMatch = screenB.match(/(\d+(?:\.\d+)?)\s*(?:بوصة|inch|")/i);
        if (inchMatch) rawB = `${inchMatch[1]} بوصة`;
      }
    }

    // Skip row only if BOTH products lack any information about this spec
    if (!rawA && !rawB) return;

    const valA = (rawA || 'غير محدد').trim();
    const valB = (rawB || 'غير محدد').trim();

    const hasA = valA !== '' && valA !== 'غير محدد';
    const hasB = valB !== '' && valB !== 'غير محدد';

    let status: SpecComparisonRow['status'] = 'insufficient_data';
    let reason = 'بيانات غير كافية للمقارنة';
    let advantageText: string | undefined = undefined;
    let isMeasurable = false;

    if (hasA && hasB) {
      // Both products provide this spec -> It contributes to the mathematically derived score!
      actualComparableScore += rule.weight;

      if (valA.toLowerCase() === valB.toLowerCase()) {
        status = 'tie';
        reason = 'المواصفات متطابقة تماماً';
        advantageText = 'متطابق';
        weightedScoreA += rule.weight * 0.5;
        weightedScoreB += rule.weight * 0.5;
        isMeasurable = true;
      } else {
        // Evaluate based on comparison direction
        switch (rule.direction) {
          case 'categorical': {
            if (rule.key === 'processor') {
              const tierA = getProcessorTier(valA);
              const tierB = getProcessorTier(valB);

              if (tierA.tier > 0 && tierB.tier > 0) {
                if (tierA.tier > tierB.tier) {
                  status = 'A';
                  reason = `أداء معالج أقوى (${tierA.label})`;
                  advantageText = 'أداء أقوى';
                  weightedScoreA += rule.weight;
                } else if (tierB.tier > tierA.tier) {
                  status = 'B';
                  reason = `أداء معالج أقوى (${tierB.label})`;
                  advantageText = 'أداء أقوى';
                  weightedScoreB += rule.weight;
                } else {
                  status = 'tie';
                  reason = `أداء معالج متقارب (${tierA.label})`;
                  advantageText = 'فئة متقاربة';
                  weightedScoreA += rule.weight * 0.5;
                  weightedScoreB += rule.weight * 0.5;
                }
                isMeasurable = true;
              } else {
                reason = 'مقارنة نوعية للمعالج';
              }
            }
            break;
          }

          case 'screen_tech': {
            const techA = evaluateScreenTech(valA);
            const techB = evaluateScreenTech(valB);
            if (techA > 0 && techB > 0 && techA !== techB) {
              if (techA > techB) {
                status = 'A';
                reason = 'تقنية لوحة شاشة أرقى (AMOLED/OLED)';
                advantageText = 'شاشة أفضل';
                weightedScoreA += rule.weight;
              } else {
                status = 'B';
                reason = 'تقنية لوحة شاشة أرقى (AMOLED/OLED)';
                advantageText = 'شاشة أفضل';
                weightedScoreB += rule.weight;
              }
              isMeasurable = true;
            } else {
              status = 'tie';
              reason = 'تقنية شاشة متقاربة';
              weightedScoreA += rule.weight * 0.5;
              weightedScoreB += rule.weight * 0.5;
              isMeasurable = true;
            }
            break;
          }

          case 'boolean': {
            const positiveKeywords = ['yes', 'supported', 'available', 'يدعم', 'نعم', '5g', 'متاح', 'مدمجة', 'جانبية'];
            const negativeKeywords = ['no', 'none', 'not supported', 'لا يدعم', 'لا يوجد', 'غير متاح', '4g فقط'];

            const hasNegA = negativeKeywords.some((k) => valA.toLowerCase().includes(k));
            const hasNegB = negativeKeywords.some((k) => valB.toLowerCase().includes(k));

            const isA = !hasNegA && positiveKeywords.some((k) => valA.toLowerCase().includes(k));
            const isB = !hasNegB && positiveKeywords.some((k) => valB.toLowerCase().includes(k));

            if (isA && !isB) {
              status = 'A';
              reason = 'الميزة متوفرة';
              advantageText = 'ميزة متوفرة';
              weightedScoreA += rule.weight;
            } else if (!isA && isB) {
              status = 'B';
              reason = 'الميزة متوفرة';
              advantageText = 'ميزة متوفرة';
              weightedScoreB += rule.weight;
            } else {
              status = 'tie';
              reason = 'الحالة متطابقة';
              advantageText = 'متطابق';
              weightedScoreA += rule.weight * 0.5;
              weightedScoreB += rule.weight * 0.5;
            }
            isMeasurable = true;
            break;
          }

          case 'higher_is_better':
          case 'lower_is_better': {
            const parsedA = parseNumericSpec(valA, rule.key);
            const parsedB = parseNumericSpec(valB, rule.key);

            if (parsedA && parsedB) {
              const unit = parsedA.unit || parsedB.unit || rule.unit || '';
              const diff = Math.abs(parsedA.num - parsedB.num);
              const diffFormatted = diff % 1 === 0 ? String(diff) : diff.toFixed(1);
              const diffText = diff > 0 ? `(+${diffFormatted} ${unit})`.trim() : '';

              if (parsedA.num === parsedB.num) {
                status = 'tie';
                reason = 'القيمة متطابقة تماماً';
                advantageText = 'متطابق';
                weightedScoreA += rule.weight * 0.5;
                weightedScoreB += rule.weight * 0.5;
              } else {
                const isAWinner =
                  rule.direction === 'higher_is_better'
                    ? parsedA.num > parsedB.num
                    : parsedA.num < parsedB.num;

                if (isAWinner) {
                  status = 'A';
                  reason = `${valA} يتفوق على ${valB} ${diffText}`.trim();
                  advantageText = `أفضل ${diffText}`.trim();
                  weightedScoreA += rule.weight;
                } else {
                  status = 'B';
                  reason = `${valB} يتفوق على ${valA} ${diffText}`.trim();
                  advantageText = `أفضل ${diffText}`.trim();
                  weightedScoreB += rule.weight;
                }
              }
              isMeasurable = true;
            } else {
              reason = 'مقارنة وصفية للمواصفة';
            }
            break;
          }

          case 'informational':
          default: {
            status = 'tie';
            reason = 'مواصفة وصفية للمعلومات';
            weightedScoreA += rule.weight * 0.5;
            weightedScoreB += rule.weight * 0.5;
            break;
          }
        }
      }
    } else if (hasA && !hasB) {
      status = 'insufficient_data';
      reason = `غير مسجل في ${productB.name}`;
    } else if (!hasA && hasB) {
      status = 'insufficient_data';
      reason = `غير مسجل في ${productA.name}`;
    }

    rows.push({
      key: rule.key,
      label: rule.label,
      icon: rule.icon,
      valA,
      valB,
      status,
      weight: rule.weight,
      scoreA: status === 'A' ? rule.weight : status === 'tie' ? rule.weight * 0.5 : 0,
      scoreB: status === 'B' ? rule.weight : status === 'tie' ? rule.weight * 0.5 : 0,
      reason,
      advantageText,
      isMeasurable
    });
  });

  // Calculate normalized percentages based purely on actual comparable data points
  const normalizedScoreA =
    actualComparableScore > 0 ? Math.round((weightedScoreA / actualComparableScore) * 100) : 0;
  const normalizedScoreB =
    actualComparableScore > 0 ? Math.round((weightedScoreB / actualComparableScore) * 100) : 0;

  // Determine overall mathematically verified winner
  let winner: DetailedComparisonResult['winner'] = 'insufficient_data';
  if (actualComparableScore > 0) {
    if (normalizedScoreA > normalizedScoreB) winner = 'A';
    else if (normalizedScoreB > normalizedScoreA) winner = 'B';
    else winner = 'tie';
  }

  // Confidence based on coverage of core phone specs
  const totalPossiblePhoneWeight = PHONE_SPEC_RULES.reduce((acc, r) => acc + r.weight, 0);
  const dataCoverage = actualComparableScore / totalPossiblePhoneWeight;
  let confidence: DetailedComparisonResult['confidence'] = 'low';
  if (dataCoverage >= 0.65) confidence = 'high';
  else if (dataCoverage >= 0.35) confidence = 'medium';

  // Extract real strengths
  const strengthsA = rows.filter((r) => r.status === 'A').map((r) => r.label);
  const strengthsB = rows.filter((r) => r.status === 'B').map((r) => r.label);

  // Summary statement
  let summary = '';
  if (winner === 'A') {
    summary = `يتفوق ${productA.name} في: ${strengthsA.join('، ')}.`;
  } else if (winner === 'B') {
    summary = `يتفوق ${productB.name} في: ${strengthsB.join('، ')}.`;
  } else if (winner === 'tie') {
    summary = 'تقارب تقني متوازن في الأداء والمواصفات المسجلة بين الهاتفين.';
  } else {
    summary = 'نقص في المواصفات المسجلة يمنع تحديد فائز تقني دقيق.';
  }

  const priceA = productA.price || 0;
  const priceB = productB.price || 0;

  return {
    categoryCompatible: isCompatible,
    rows,
    weightedScoreA,
    weightedScoreB,
    normalizedScoreA,
    normalizedScoreB,
    winner,
    confidence,
    strengthsA,
    strengthsB,
    summary,
    maxPossibleScore: totalPossiblePhoneWeight,
    actualComparableScore,
    priceDiff: priceA - priceB,
    cheaperProduct: priceA === priceB ? 'equal' : priceA < priceB ? 'A' : 'B'
  };
}

/**
 * Real data-driven Structured Comparison Engine for general products
 */
export function compareProducts(productA: Product, productB: Product): DetailedComparisonResult {
  if (isMobileProduct(productA) && isMobileProduct(productB)) {
    return comparePhones(productA, productB);
  }

  const isCompatible = Boolean(productA.categoryId && productB.categoryId && productA.categoryId === productB.categoryId);
  const specsA = productA.specifications || {};
  const specsB = productB.specifications || {};

  // Build dynamic rule set from available specification keys across both products
  const ruleMap = new Map<string, SpecRule>();
  GENERIC_SPEC_RULES.forEach((r) => ruleMap.set(r.key, r));

  const allKeys = Array.from(new Set([...Object.keys(specsA), ...Object.keys(specsB)]));
  allKeys.forEach((key) => {
    if (!ruleMap.has(key)) {
      ruleMap.set(key, {
        key,
        aliases: [],
        label: key,
        icon: Sliders,
        direction: 'higher_is_better',
        weight: 10
      });
    }
  });

  const rules = Array.from(ruleMap.values());
  const rows: SpecComparisonRow[] = [];
  let weightedScoreA = 0;
  let weightedScoreB = 0;
  let actualComparableScore = 0;

  rules.forEach((rule) => {
    const rawA = getSpecRawValue(specsA, rule.key, rule.aliases);
    const rawB = getSpecRawValue(specsB, rule.key, rule.aliases);

    if (!rawA && !rawB) return;

    const valA = (rawA || 'غير محدد').trim();
    const valB = (rawB || 'غير محدد').trim();

    const hasA = valA !== '' && valA !== 'غير محدد';
    const hasB = valB !== '' && valB !== 'غير محدد';

    let status: SpecComparisonRow['status'] = 'insufficient_data';
    let reason = 'بيانات غير كافية';
    let advantageText: string | undefined = undefined;
    let isMeasurable = false;

    if (hasA && hasB) {
      actualComparableScore += rule.weight;

      if (valA.toLowerCase() === valB.toLowerCase()) {
        status = 'tie';
        reason = 'المواصفات متطابقة';
        advantageText = 'متطابق';
        weightedScoreA += rule.weight * 0.5;
        weightedScoreB += rule.weight * 0.5;
        isMeasurable = true;
      } else {
        const parsedA = parseNumericSpec(valA, rule.key);
        const parsedB = parseNumericSpec(valB, rule.key);

        if (parsedA && parsedB) {
          const isAWinner =
            rule.direction === 'lower_is_better' ? parsedA.num < parsedB.num : parsedA.num > parsedB.num;

          if (parsedA.num === parsedB.num) {
            status = 'tie';
            reason = 'القيمة متطابقة';
            advantageText = 'متطابق';
            weightedScoreA += rule.weight * 0.5;
            weightedScoreB += rule.weight * 0.5;
          } else if (isAWinner) {
            status = 'A';
            reason = `${valA} يتفوق على ${valB}`;
            advantageText = 'أفضل';
            weightedScoreA += rule.weight;
          } else {
            status = 'B';
            reason = `${valB} يتفوق على ${valA}`;
            advantageText = 'أفضل';
            weightedScoreB += rule.weight;
          }
          isMeasurable = true;
        } else {
          status = 'tie';
          reason = 'مواصفة متقاربة';
          weightedScoreA += rule.weight * 0.5;
          weightedScoreB += rule.weight * 0.5;
        }
      }
    }

    rows.push({
      key: rule.key,
      label: rule.label,
      icon: rule.icon,
      valA,
      valB,
      status,
      weight: rule.weight,
      scoreA: status === 'A' ? rule.weight : status === 'tie' ? rule.weight * 0.5 : 0,
      scoreB: status === 'B' ? rule.weight : status === 'tie' ? rule.weight * 0.5 : 0,
      reason,
      advantageText,
      isMeasurable
    });
  });

  const normalizedScoreA =
    actualComparableScore > 0 ? Math.round((weightedScoreA / actualComparableScore) * 100) : 0;
  const normalizedScoreB =
    actualComparableScore > 0 ? Math.round((weightedScoreB / actualComparableScore) * 100) : 0;

  let winner: DetailedComparisonResult['winner'] = 'insufficient_data';
  if (actualComparableScore > 0) {
    if (normalizedScoreA > normalizedScoreB) winner = 'A';
    else if (normalizedScoreB > normalizedScoreA) winner = 'B';
    else winner = 'tie';
  }

  const strengthsA = rows.filter((r) => r.status === 'A').map((r) => r.label);
  const strengthsB = rows.filter((r) => r.status === 'B').map((r) => r.label);

  const priceA = productA.price || 0;
  const priceB = productB.price || 0;

  return {
    categoryCompatible: isCompatible,
    rows,
    weightedScoreA,
    weightedScoreB,
    normalizedScoreA,
    normalizedScoreB,
    winner,
    confidence: actualComparableScore > 30 ? 'high' : 'medium',
    strengthsA,
    strengthsB,
    summary:
      winner === 'A'
        ? `يتفوق ${productA.name} في: ${strengthsA.join('، ')}.`
        : winner === 'B'
        ? `يتفوق ${productB.name} في: ${strengthsB.join('، ')}.`
        : 'تقارب في المواصفات بين المنتجين.',
    maxPossibleScore: Math.max(actualComparableScore, 100),
    actualComparableScore,
    priceDiff: priceA - priceB,
    cheaperProduct: priceA === priceB ? 'equal' : priceA < priceB ? 'A' : 'B'
  };
}

/**
 * Backward compatibility alias
 */
export const calculateComparison = compareProducts;
