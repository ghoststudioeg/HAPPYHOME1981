import { Product } from '../types';
import { extractBrand } from './brandUtils';

/**
 * Normalizes Arabic and English text for accurate search matching.
 * - Converts Arabic alef variations (أ, إ, آ, ٱ) to 'ا'
 * - Converts taa marbouta (ة) to 'ه'
 * - Converts alif maqsura and yaa variations (ى, ئ) to 'ي'
 * - Converts waw hamza (ؤ) to 'و'
 * - Strips Arabic diacritics / tashkeel (َ, ً, ُ, ٌ, ِ, ٍ, ْ, ّ, ٰ)
 * - Strips Arabic tatweel / kashida (ـ)
 * - Lowercases English text and removes excess punctuation
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';

  let normalized = text
    .toString()
    .toLowerCase()
    // Strip Arabic diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Strip tatweel / kashida
    .replace(/\u0640/g, '')
    // Normalize Alef forms: أ, إ, آ, ٱ -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Taa Marbouta: ة -> ه
    .replace(/ة/g, 'ه')
    // Normalize Yaa / Alif Maqsura: ى, ئ -> ي
    .replace(/[ىئ]/g, 'ي')
    // Normalize Waw Hamza: ؤ -> و
    .replace(/ؤ/g, 'و')
    // Normalize common punctuation to space
    .replace(/[,\-_/:;.+&|#~*()\[\]{}"'\\؟?!]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Arabic <-> English synonyms & brand dictionary
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Mobile / Phone
  موبايل: ['موبايلات', 'هاتف', 'هواتف', 'تليفون', 'mobile', 'phone', 'smartphone'],
  موبايلات: ['موبايل', 'هاتف', 'هواتف', 'تليفون', 'mobile', 'phone', 'smartphone'],
  هاتف: ['موبايل', 'موبايلات', 'هواتف', 'phone', 'mobile', 'smartphone'],
  هواتف: ['موبايل', 'موبايلات', 'هاتف', 'phone', 'mobile', 'smartphone'],
  mobile: ['موبايل', 'موبايلات', 'هاتف', 'phone', 'smartphone'],
  phone: ['موبايل', 'هاتف', 'smartphone', 'mobile'],

  // Brands
  سامسونج: ['samsung', 'galaxy', 'جالكسي'],
  samsung: ['سامسونج', 'galaxy', 'جالكسي'],
  galaxy: ['سامسونج', 'samsung', 'جالكسي'],
  جالكسي: ['سامسونج', 'samsung', 'galaxy'],

  اوبو: ['oppo', 'أوبو'],
  oppo: ['اوبو', 'أوبو'],

  شاومي: ['xiaomi', 'redmi', 'poco', 'ريدمي', 'بوكو'],
  xiaomi: ['شاومي', 'redmi', 'poco', 'ريدمي', 'بوكو'],
  ريدمي: ['redmi', 'xiaomi', 'شاومي'],
  redmi: ['ريدمي', 'xiaomi', 'شاومي'],
  بوكو: ['poco', 'xiaomi', 'شاومي'],
  poco: ['بوكو', 'xiaomi', 'شاومي'],

  ابل: ['apple', 'iphone', 'ايفون', 'ipad', 'ايباد'],
  apple: ['ابل', 'iphone', 'ايفون', 'ipad', 'ايباد'],
  ايفون: ['iphone', 'apple', 'ابل'],
  iphone: ['ايفون', 'apple', 'ابل'],

  هواوي: ['huawei', 'honor', 'هونر'],
  huawei: ['هواوي'],
  هونر: ['honor', 'huawei'],
  honor: ['هونر'],

  ريلمي: ['realme'],
  realme: ['ريلمي'],

  فيفو: ['vivo'],
  vivo: ['فيفو'],

  انفينكس: ['infinix', 'انفينيكس'],
  انفينيكس: ['infinix', 'انفينكس'],
  infinix: ['انفينكس', 'انفينيكس'],

  تكنو: ['tecno'],
  tecno: ['تكنو'],

  نوكيا: ['nokia'],
  nokia: ['نوكيا'],

  سوني: ['sony', 'playstation', 'بلايستيشن'],
  sony: ['سوني'],

  الجي: ['lg', 'ال جي', 'إل جي'],
  lg: ['الجي', 'ال جي', 'إل جي'],

  توشيبا: ['toshiba'],
  toshiba: ['توشيبا'],

  تورنيدو: ['tornado'],
  tornado: ['تورنيدو'],

  هايسنس: ['hisense'],
  hisense: ['هايسنس'],

  // Bags / School / Travel
  شنطة: ['شنط', 'حقيبة', 'حقائب', 'bag', 'backpack'],
  شنط: ['شنطة', 'حقيبة', 'حقائب', 'bag', 'backpack', 'bags'],
  حقيبة: ['حقائب', 'شنطة', 'شنط', 'bag', 'backpack'],
  حقائب: ['حقيبة', 'شنطة', 'شنط', 'bags', 'backpack'],
  مدرسة: ['مدرسي', 'مدرسية', 'school'],
  مدرسية: ['مدرسة', 'مدرسي', 'school'],
  school: ['مدرسة', 'مدرسية', 'شنطة مدرسية'],
  سفر: ['ترولي', 'travel', 'luggage', 'suitcase'],
  ترولي: ['سفر', 'عجلات', 'trolley', 'travel'],
  travel: ['سفر', 'ترولي', 'حقيبة سفر', 'luggage'],
  bag: ['شنطة', 'شنط', 'حقيبة'],
  backpack: ['شنطة ظهر', 'شنطة', 'حقيبة'],

  // TV / Screens
  شاشة: ['شاشات', 'تلفزيون', 'تلفزيونات', 'tv', 'screen', 'television'],
  شاشات: ['شاشة', 'تلفزيون', 'تلفزيونات', 'tv', 'screens', 'television'],
  تلفزيون: ['تلفزيونات', 'شاشة', 'شاشات', 'tv', 'smart tv', 'television'],
  تلفزيونات: ['تلفزيون', 'شاشة', 'شاشات', 'tv', 'screens', 'television'],
  tv: ['شاشة', 'شاشات', 'تلفزيون', 'تلفزيونات', 'screen'],
  screen: ['شاشة', 'شاشات', 'تلفزيون'],
  سمارت: ['smart', 'smart tv', 'ذكي'],
  smart: ['سمارت', 'smart tv', 'ذكي'],

  // Tablets
  تابلت: ['تاب', 'ايباد', 'لوحي', 'tablet', 'ipad', 'tab'],
  تاب: ['تابلت', 'ايباد', 'tablet'],
  ايباد: ['ipad', 'تابلت', 'apple'],
  tablet: ['تابلت', 'تاب', 'ايباد'],
  ipad: ['ايباد', 'تابلت', 'apple'],

  // Audio / Headphones
  سماعة: ['سماعات', 'ايربودز', 'headphone', 'headphones', 'earbuds', 'airpods'],
  سماعات: ['سماعة', 'ايربودز', 'headphone', 'headphones', 'earbuds', 'airpods'],
  headphone: ['سماعة', 'سماعات'],
  headphones: ['سماعة', 'سماعات'],
  earbuds: ['سماعة', 'سماعات', 'ايربودز'],
  airpods: ['ايربودز', 'سماعات ابل', 'سماعة'],
  اسبيكر: ['اسبيكرات', 'مكبر صوت', 'speaker', 'speakers'],
  اسبيكرات: ['اسبيكر', 'مكبر صوت', 'speaker', 'speakers'],
  speaker: ['اسبيكر', 'اسبيكرات', 'مكبر صوت'],

  // Accessories
  شاحن: ['شواحن', 'شحن', 'charger'],
  شواحن: ['شاحن', 'charger'],
  charger: ['شاحن', 'شواحن'],
  باوربانك: ['باور بانك', 'powerbank', 'power bank', 'بطارية خارجية'],
  powerbank: ['باوربانك', 'باور بانك', 'power bank'],

  // General specs
  بوصة: ['inch', '"'],
  inch: ['بوصة', 'بوصه'],
  جيجا: ['gb', 'gigabyte'],
  gb: ['جيجا', 'جيجابايت']
};

/**
 * Expands a normalized query token with known equivalent synonyms
 */
export function expandSearchTokens(rawQuery: string): string[] {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return [];

  const tokens = normalized.split(' ').filter(Boolean);
  const expandedSet = new Set<string>();

  for (const token of tokens) {
    expandedSet.add(token);

    // Look up in synonyms dictionary
    if (SEARCH_SYNONYMS[token]) {
      for (const syn of SEARCH_SYNONYMS[token]) {
        expandedSet.add(normalizeSearchText(syn));
      }
    }

    // Check partial key matches
    for (const [key, syns] of Object.entries(SEARCH_SYNONYMS)) {
      const normKey = normalizeSearchText(key);
      if (normKey === token || normKey.includes(token) || token.includes(normKey)) {
        expandedSet.add(normKey);
        for (const s of syns) {
          expandedSet.add(normalizeSearchText(s));
        }
      }
    }
  }

  return Array.from(expandedSet).filter(Boolean);
}

/**
 * Searches and scores products against a search query.
 * Matches:
 * - Product Name (high priority)
 * - SKU (exact/prefix high priority)
 * - Brand (high priority)
 * - Category Name
 * - Relevant Specifications (RAM, storage, processor, screen, resolution, camera, etc.)
 * - Product description & features
 */
export function searchProducts(
  products: Product[],
  query: string,
  limitCount?: number
): Product[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return products;

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const expandedTokens = expandSearchTokens(query);

  const scoredProducts: { product: Product; score: number }[] = [];

  for (const product of products) {
    const normName = normalizeSearchText(product.name);
    const normSku = normalizeSearchText(product.sku);
    const normCat = normalizeSearchText(product.categoryName);
    const normDesc = normalizeSearchText(product.description);
    const brand = extractBrand(product.name);
    const normBrand = normalizeSearchText(brand);

    // Collect all specification values into normalized strings
    const specsArray: string[] = [];
    if (product.specifications) {
      for (const [key, val] of Object.entries(product.specifications)) {
        if (typeof val === 'string' && val.trim()) {
          specsArray.push(`${normalizeSearchText(key)} ${normalizeSearchText(val)}`);
        }
      }
    }
    const specsString = specsArray.join(' ');

    // Collect features & colors
    const featuresString = (product.features || []).map(f => normalizeSearchText(f)).join(' ');
    const colorsString = (product.colors || []).map(c => normalizeSearchText(c.name)).join(' ');

    const combinedSearchText = `${normName} ${normSku} ${normBrand} ${normCat} ${specsString} ${featuresString} ${colorsString} ${normDesc}`;

    let score = 0;

    // 1. Exact full query phrase match
    if (normName.includes(normalizedQuery)) {
      score += 100;
      if (normName.startsWith(normalizedQuery)) score += 50;
    }
    if (normSku === normalizedQuery || normSku.startsWith(normalizedQuery)) {
      score += 150;
    } else if (normSku.includes(normalizedQuery)) {
      score += 80;
    }
    if (normBrand === normalizedQuery || normBrand.includes(normalizedQuery)) {
      score += 60;
    }
    if (normCat.includes(normalizedQuery)) {
      score += 40;
    }
    if (specsString.includes(normalizedQuery)) {
      score += 35;
    }
    if (colorsString.includes(normalizedQuery)) {
      score += 30;
    }

    // 2. Tokenized match across all expanded tokens
    let matchedTokenCount = 0;
    for (const token of queryTokens) {
      let tokenMatched = false;

      // Direct match
      if (normName.includes(token)) {
        score += 25;
        tokenMatched = true;
      } else if (normSku.includes(token)) {
        score += 30;
        tokenMatched = true;
      } else if (normBrand.includes(token)) {
        score += 20;
        tokenMatched = true;
      } else if (normCat.includes(token)) {
        score += 15;
        tokenMatched = true;
      } else if (specsString.includes(token)) {
        score += 15;
        tokenMatched = true;
      } else if (colorsString.includes(token)) {
        score += 10;
        tokenMatched = true;
      } else if (featuresString.includes(token)) {
        score += 8;
        tokenMatched = true;
      } else if (normDesc.includes(token)) {
        score += 5;
        tokenMatched = true;
      }

      // Synonym match
      if (!tokenMatched) {
        for (const expToken of expandedTokens) {
          if (expToken !== token && combinedSearchText.includes(expToken)) {
            score += 12;
            tokenMatched = true;
            break;
          }
        }
      }

      if (tokenMatched) {
        matchedTokenCount++;
      }
    }

    // Only include if at least one token or strong match was found
    // If multiple tokens in query, reward products matching ALL tokens
    if (matchedTokenCount === queryTokens.length && queryTokens.length > 1) {
      score += 50;
    }

    if (score > 0 && matchedTokenCount > 0) {
      scoredProducts.push({ product, score });
    }
  }

  // Sort by highest score first, then by product sortOrder
  scoredProducts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.product.sortOrder || 0) - (b.product.sortOrder || 0);
  });

  const results = scoredProducts.map(sp => sp.product);
  return limitCount ? results.slice(0, limitCount) : results;
}
