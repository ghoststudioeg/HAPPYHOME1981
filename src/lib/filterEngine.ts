import { Product, Category } from '../types';
import { extractBrand } from './brandUtils';
import { normalizeSearchText, searchProducts } from './searchUtils';

export type AvailabilityFilter = 'all' | 'in_stock' | 'low_stock';
export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'views' | 'best-selling' | 'featured';

export interface FilterState {
  search: string;
  category: string;
  brands: string[];
  minPrice: number | '' | null;
  maxPrice: number | '' | null;
  availability: AvailabilityFilter;
  featuredOnly: boolean;
  sortBy: SortOption;
  
  // Specific dynamic attributes
  ram: string[];
  storage: string[];
  processor: string[];
  is5G: boolean | null;
  battery: string[];
  camera: string[];
  screenSize: string[];
  resolution: string[];
  isSmartTv: boolean | null;
  bagType: string[];
  bagSize: string[];
  colors: string[];
  
  // Generic dynamic specs for any category
  dynamicSpecs: Record<string, string[]>;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  category: 'all',
  brands: [],
  minPrice: '',
  maxPrice: '',
  availability: 'all',
  featuredOnly: false,
  sortBy: 'newest',
  ram: [],
  storage: [],
  processor: [],
  is5G: null,
  battery: [],
  camera: [],
  screenSize: [],
  resolution: [],
  isSmartTv: null,
  bagType: [],
  bagSize: [],
  colors: [],
  dynamicSpecs: {}
};

export interface FilterOption {
  value: string;
  label: string;
  count: number;
  colorHex?: string;
}

export interface DynamicFilterGroup {
  id: string;
  key: string;
  label: string;
  type: 'checkbox' | 'boolean' | 'color';
  options: FilterOption[];
}

export type CategoryArchetype = 
  | 'phones' 
  | 'bags' 
  | 'screens' 
  | 'tablets' 
  | 'audio' 
  | 'appliances' 
  | 'general';

/**
 * Detects the category archetype from category object, name, or slug.
 */
export function detectCategoryArchetype(
  categoryOrSlug?: Category | string | null,
  fallbackSlug?: string
): CategoryArchetype {
  let target = '';
  if (categoryOrSlug) {
    if (typeof categoryOrSlug === 'object') {
      target = `${categoryOrSlug.name || ''} ${categoryOrSlug.slug || ''} ${categoryOrSlug.description || ''}`;
    } else {
      target = categoryOrSlug;
    }
  } else if (fallbackSlug) {
    target = fallbackSlug;
  }

  if (!target) return 'general';
  const norm = normalizeSearchText(target);

  if (
    norm.includes('موبايل') || 
    norm.includes('هاتف') || 
    norm.includes('smartphone') || 
    norm.includes('phone')
  ) {
    return 'phones';
  }

  if (
    norm.includes('شنط') || 
    norm.includes('حقائب') || 
    norm.includes('حقيبه') || 
    norm.includes('bag') || 
    norm.includes('backpack') ||
    norm.includes('سفر') ||
    norm.includes('مدرسي')
  ) {
    return 'bags';
  }

  if (
    norm.includes('شاش') || 
    norm.includes('تلفزيون') || 
    norm.includes('screen') || 
    norm.includes('tv')
  ) {
    return 'screens';
  }

  if (
    norm.includes('تابلت') || 
    norm.includes('تاب') || 
    norm.includes('ايباد') || 
    norm.includes('tablet') || 
    norm.includes('ipad')
  ) {
    return 'tablets';
  }

  if (
    norm.includes('سماع') || 
    norm.includes('اسبيكر') || 
    norm.includes('صوت') || 
    norm.includes('headphone') || 
    norm.includes('speaker') || 
    norm.includes('audio')
  ) {
    return 'audio';
  }

  if (
    norm.includes('منزل') || 
    norm.includes('كهربا') || 
    norm.includes('مطبخ') || 
    norm.includes('appliance')
  ) {
    return 'appliances';
  }

  return 'general';
}

/**
 * Extracts all available dynamic filters based on the category archetype and actual product data.
 */
export function extractAvailableFilters(
  products: Product[],
  archetype: CategoryArchetype
): {
  brands: FilterOption[];
  priceRange: { min: number; max: number };
  colors: FilterOption[];
  dynamicGroups: DynamicFilterGroup[];
} {
  if (products.length === 0) {
    return {
      brands: [],
      priceRange: { min: 0, max: 50000 },
      colors: [],
      dynamicGroups: []
    };
  }

  // 1. Calculate price range
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const brandCountMap = new Map<string, number>();
  const colorMap = new Map<string, { count: number; hex?: string }>();

  // Helper maps for specific archetype specs
  const ramMap = new Map<string, number>();
  const storageMap = new Map<string, number>();
  const processorMap = new Map<string, number>();
  const batteryMap = new Map<string, number>();
  const cameraMap = new Map<string, number>();
  const screenSizeMap = new Map<string, number>();
  const resolutionMap = new Map<string, number>();
  const bagTypeMap = new Map<string, number>();
  const bagSizeMap = new Map<string, number>();

  let has5GCount = 0;
  let hasSmartTvCount = 0;

  // Generic dynamic specs collector
  const genericSpecsMap = new Map<string, Map<string, number>>();

  for (const p of products) {
    if (typeof p.price === 'number') {
      if (p.price < minPrice) minPrice = p.price;
      if (p.price > maxPrice) maxPrice = p.price;
    }

    // Brand
    const b = extractBrand(p.name);
    if (b && b !== 'أخرى') {
      brandCountMap.set(b, (brandCountMap.get(b) || 0) + 1);
    }

    // Colors
    if (p.colors && p.colors.length > 0) {
      for (const c of p.colors) {
        if (c.name) {
          const current = colorMap.get(c.name) || { count: 0, hex: c.hex };
          colorMap.set(c.name, { count: current.count + 1, hex: c.hex || current.hex });
        }
      }
    }

    const specs = p.specifications || {};
    const features = p.features || [];
    const textAll = `${p.name} ${p.description || ''} ${features.join(' ')}`;

    // Archetype-specific extraction
    if (archetype === 'phones' || archetype === 'tablets') {
      // RAM
      const ramVal = specs.ram || extractPattern(textAll, /(\b\d+\s*(?:GB|جيجا)\s*رام|\b\d+\s*GB\s*RAM|\bRAM\s*\d+\s*GB)/i);
      if (ramVal) {
        const clean = normalizeSpecValue(ramVal);
        ramMap.set(clean, (ramMap.get(clean) || 0) + 1);
      }

      // Storage
      const storageVal = specs.storage || extractPattern(textAll, /(\b(?:32|64|128|256|512)\s*(?:GB|جيجا)|\b1\s*(?:TB|تيرابايت))/i);
      if (storageVal) {
        const clean = normalizeSpecValue(storageVal);
        storageMap.set(clean, (storageMap.get(clean) || 0) + 1);
      }

      // Processor
      const procVal = specs.processor || extractPattern(textAll, /(Snapdragon|MediaTek|Helio|Dimensity|Bionic|Unisoc|Exynos|معالج\s+[\w\d]+)/i);
      if (procVal) {
        const clean = normalizeSpecValue(procVal);
        processorMap.set(clean, (processorMap.get(clean) || 0) + 1);
      }

      // 5G Network
      const is5G = specs.network?.includes('5G') || textAll.includes('5G') || textAll.includes('الجيل الخامس');
      if (is5G) has5GCount++;

      // Battery
      const batVal = specs.battery || extractPattern(textAll, /(\b\d{4}\s*(?:mAh|مللي\s*أمبير))/i);
      if (batVal) {
        const clean = normalizeSpecValue(batVal);
        batteryMap.set(clean, (batteryMap.get(clean) || 0) + 1);
      }

      // Camera
      const camVal = specs.rearCamera || extractPattern(textAll, /(\b\d+\s*(?:MP|ميجا\s*بكسل|ميجابكسل))/i);
      if (camVal) {
        const clean = normalizeSpecValue(camVal);
        cameraMap.set(clean, (cameraMap.get(clean) || 0) + 1);
      }
    }

    if (archetype === 'screens') {
      // Screen Size
      const sizeVal = specs.screen || extractPattern(textAll, /(\b\d{2}\s*(?:بوصة|بوصه|inch|"))/i);
      if (sizeVal) {
        const clean = normalizeSpecValue(sizeVal);
        screenSizeMap.set(clean, (screenSizeMap.get(clean) || 0) + 1);
      }

      // Resolution
      const resVal = specs.resolution || extractPattern(textAll, /(4K\s*Ultra\s*HD|4K|Full\s*HD|FHD|1080p|HD|8K)/i);
      if (resVal) {
        const clean = normalizeSpecValue(resVal);
        resolutionMap.set(clean, (resolutionMap.get(clean) || 0) + 1);
      }

      // Smart TV
      const isSmart = textAll.toLowerCase().includes('smart') || textAll.includes('سمارت') || textAll.includes('ذكي');
      if (isSmart) hasSmartTvCount++;
    }

    if (archetype === 'bags') {
      // Bag Type
      if (textAll.includes('مدرس') || textAll.includes('مدرسة')) {
        bagTypeMap.set('مدرسية', (bagTypeMap.get('مدرسية') || 0) + 1);
      }
      if (textAll.includes('ترولي') || textAll.includes('عجلات') || textAll.includes('trolley')) {
        bagTypeMap.set('ترولي بعجلات', (bagTypeMap.get('ترولي بعجلات') || 0) + 1);
      }
      if (textAll.includes('ظهر') || textAll.includes('backpack')) {
        bagTypeMap.set('حقيبة ظهر', (bagTypeMap.get('حقيبة ظهر') || 0) + 1);
      }
      if (textAll.includes('سفر') || textAll.includes('travel')) {
        bagTypeMap.set('حقيبة سفر', (bagTypeMap.get('حقيبة سفر') || 0) + 1);
      }
      if (textAll.includes('كروس') || textAll.includes('cross')) {
        bagTypeMap.set('كروس', (bagTypeMap.get('كروس') || 0) + 1);
      }

      // Bag Size
      const sizeMatch = extractPattern(textAll, /(مقاس\s*\d+|حجم\s*(?:صغير|وسط|كبير)|\b\d{2}\s*(?:بوصة|بوصه|سم))/i);
      if (sizeMatch) {
        const clean = normalizeSpecValue(sizeMatch);
        bagSizeMap.set(clean, (bagSizeMap.get(clean) || 0) + 1);
      }
    }

    // Generic specs inspection for any other structured specifications
    if (specs) {
      for (const [key, val] of Object.entries(specs)) {
        if (typeof val === 'string' && val.trim() && key !== 'ram' && key !== 'storage' && key !== 'processor') {
          if (!genericSpecsMap.has(key)) {
            genericSpecsMap.set(key, new Map());
          }
          const valMap = genericSpecsMap.get(key)!;
          const cleanVal = val.trim();
          valMap.set(cleanVal, (valMap.get(cleanVal) || 0) + 1);
        }
      }
    }
  }

  const brands: FilterOption[] = Array.from(brandCountMap.entries())
    .map(([b, count]) => ({ value: b, label: b, count }))
    .sort((a, b) => b.count - a.count);

  const colors: FilterOption[] = Array.from(colorMap.entries())
    .map(([c, data]) => ({ value: c, label: c, count: data.count, colorHex: data.hex }))
    .sort((a, b) => b.count - a.count);

  const dynamicGroups: DynamicFilterGroup[] = [];

  // Assemble dynamic groups strictly per archetype
  if (archetype === 'phones' || archetype === 'tablets') {
    if (storageMap.size > 0) {
      dynamicGroups.push({
        id: 'storage',
        key: 'storage',
        label: 'مساحة التخزين الداخلي',
        type: 'checkbox',
        options: mapToOptions(storageMap)
      });
    }

    if (ramMap.size > 0) {
      dynamicGroups.push({
        id: 'ram',
        key: 'ram',
        label: 'الذاكرة العشوائية (RAM)',
        type: 'checkbox',
        options: mapToOptions(ramMap)
      });
    }

    if (has5GCount > 0) {
      dynamicGroups.push({
        id: 'is5G',
        key: 'is5G',
        label: 'شبكة الجيل الخامس (5G)',
        type: 'boolean',
        options: [{ value: 'true', label: 'يدعم شبكات 5G', count: has5GCount }]
      });
    }

    if (batteryMap.size > 0) {
      dynamicGroups.push({
        id: 'battery',
        key: 'battery',
        label: 'سعة البطارية',
        type: 'checkbox',
        options: mapToOptions(batteryMap)
      });
    }

    if (cameraMap.size > 0) {
      dynamicGroups.push({
        id: 'camera',
        key: 'camera',
        label: 'دقة الكاميرا',
        type: 'checkbox',
        options: mapToOptions(cameraMap)
      });
    }

    if (processorMap.size > 0) {
      dynamicGroups.push({
        id: 'processor',
        key: 'processor',
        label: 'المعالج',
        type: 'checkbox',
        options: mapToOptions(processorMap)
      });
    }
  } else if (archetype === 'screens') {
    if (screenSizeMap.size > 0) {
      dynamicGroups.push({
        id: 'screenSize',
        key: 'screenSize',
        label: 'حجم الشاشة',
        type: 'checkbox',
        options: mapToOptions(screenSizeMap)
      });
    }

    if (resolutionMap.size > 0) {
      dynamicGroups.push({
        id: 'resolution',
        key: 'resolution',
        label: 'دقة العرض',
        type: 'checkbox',
        options: mapToOptions(resolutionMap)
      });
    }

    if (hasSmartTvCount > 0) {
      dynamicGroups.push({
        id: 'isSmartTv',
        key: 'isSmartTv',
        label: 'شاشة ذكية (Smart TV)',
        type: 'boolean',
        options: [{ value: 'true', label: 'شاشة سمارت ذكية', count: hasSmartTvCount }]
      });
    }
  } else if (archetype === 'bags') {
    if (bagTypeMap.size > 0) {
      dynamicGroups.push({
        id: 'bagType',
        key: 'bagType',
        label: 'نوع الحقيبة',
        type: 'checkbox',
        options: mapToOptions(bagTypeMap)
      });
    }

    if (bagSizeMap.size > 0) {
      dynamicGroups.push({
        id: 'bagSize',
        key: 'bagSize',
        label: 'المقاس / الحجم',
        type: 'checkbox',
        options: mapToOptions(bagSizeMap)
      });
    }
  }

  // Include dynamic generic specs if any exists with multiple values
  for (const [key, valMap] of genericSpecsMap.entries()) {
    if (valMap.size >= 1 && dynamicGroups.length < 8) {
      dynamicGroups.push({
        id: `spec_${key}`,
        key: `spec_${key}`,
        label: formatSpecLabel(key),
        type: 'checkbox',
        options: mapToOptions(valMap)
      });
    }
  }

  return {
    brands,
    priceRange: {
      min: minPrice === Infinity ? 0 : Math.floor(minPrice),
      max: maxPrice === -Infinity ? 50000 : Math.ceil(maxPrice)
    },
    colors,
    dynamicGroups
  };
}

/**
 * Filter products according to FilterState
 */
export function applyFilters(
  products: Product[],
  filterState: FilterState,
  categories?: Category[]
): Product[] {
  let result = [...products];

  // 1. Text Search (Instant search with normalization and synonyms)
  if (filterState.search.trim()) {
    result = searchProducts(result, filterState.search.trim());
  }

  // 2. Category
  if (filterState.category && filterState.category !== 'all') {
    const cat = filterState.category.trim();
    const matchedCategory = categories?.find(
      c => c.id === cat || c.slug === cat || c.name === cat
    );
    const targetIds = matchedCategory ? [matchedCategory.id, matchedCategory.slug, matchedCategory.name] : [cat, decodeURIComponent(cat)];

    result = result.filter(
      p => targetIds.includes(p.categoryId) || targetIds.includes(p.categoryName || '')
    );
  }

  // 3. Brand
  if (filterState.brands.length > 0) {
    result = result.filter(p => {
      const b = extractBrand(p.name);
      return filterState.brands.includes(b);
    });
  }

  // 4. Price range
  if (typeof filterState.minPrice === 'number' && !isNaN(filterState.minPrice)) {
    result = result.filter(p => p.price >= (filterState.minPrice as number));
  }
  if (typeof filterState.maxPrice === 'number' && !isNaN(filterState.maxPrice)) {
    result = result.filter(p => p.price <= (filterState.maxPrice as number));
  }

  // 5. Availability
  if (filterState.availability === 'in_stock') {
    result = result.filter(p => p.isAvailable && p.stockStatus !== 'out_of_stock' && p.stockStatus !== 'coming_soon');
  } else if (filterState.availability === 'low_stock') {
    result = result.filter(p => p.stockStatus === 'low_stock' || (p.stockQuantity > 0 && p.stockQuantity <= (p.lowStockThreshold || 3)));
  }

  // 6. Featured Only
  if (filterState.featuredOnly) {
    result = result.filter(p => p.isFeatured);
  }

  // 7. Dynamic archetype specs
  // RAM
  if (filterState.ram.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.ram || ''}`;
      return filterState.ram.some(r => text.toLowerCase().includes(r.toLowerCase()));
    });
  }

  // Storage
  if (filterState.storage.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.storage || ''}`;
      return filterState.storage.some(s => text.toLowerCase().includes(s.toLowerCase()));
    });
  }

  // Processor
  if (filterState.processor.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.processor || ''}`;
      return filterState.processor.some(pr => text.toLowerCase().includes(pr.toLowerCase()));
    });
  }

  // 5G Network
  if (filterState.is5G === true) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.network || ''}`;
      return text.includes('5G') || text.includes('الجيل الخامس');
    });
  }

  // Battery
  if (filterState.battery.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.battery || ''}`;
      return filterState.battery.some(b => text.toLowerCase().includes(b.toLowerCase()));
    });
  }

  // Camera
  if (filterState.camera.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.rearCamera || ''}`;
      return filterState.camera.some(c => text.toLowerCase().includes(c.toLowerCase()));
    });
  }

  // Screen Size
  if (filterState.screenSize.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.screen || ''}`;
      return filterState.screenSize.some(s => text.toLowerCase().includes(s.toLowerCase()));
    });
  }

  // Resolution
  if (filterState.resolution.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description} ${p.specifications?.resolution || ''}`;
      return filterState.resolution.some(r => text.toLowerCase().includes(r.toLowerCase()));
    });
  }

  // Smart TV
  if (filterState.isSmartTv === true) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description}`.toLowerCase();
      return text.includes('smart') || text.includes('سمارت') || text.includes('ذكي');
    });
  }

  // Bag Type
  if (filterState.bagType.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description}`.toLowerCase();
      return filterState.bagType.some(bt => {
        if (bt === 'مدرسية') return text.includes('مدرس') || text.includes('مدرسة');
        if (bt === 'ترولي بعجلات') return text.includes('ترولي') || text.includes('عجلات') || text.includes('trolley');
        if (bt === 'حقيبة ظهر') return text.includes('ظهر') || text.includes('backpack');
        if (bt === 'حقيبة سفر') return text.includes('سفر') || text.includes('travel');
        if (bt === 'كروس') return text.includes('كروس') || text.includes('cross');
        return text.includes(bt.toLowerCase());
      });
    });
  }

  // Bag Size
  if (filterState.bagSize.length > 0) {
    result = result.filter(p => {
      const text = `${p.name} ${p.description}`;
      return filterState.bagSize.some(sz => text.includes(sz));
    });
  }

  // Colors
  if (filterState.colors.length > 0) {
    result = result.filter(p => {
      if (!p.colors || p.colors.length === 0) return false;
      return p.colors.some(c => filterState.colors.includes(c.name));
    });
  }

  // Dynamic generic specs
  for (const [key, values] of Object.entries(filterState.dynamicSpecs)) {
    if (values && values.length > 0) {
      result = result.filter(p => {
        const val = p.specifications?.[key];
        return val && values.includes(val);
      });
    }
  }

  // 8. Sorting
  result.sort((a, b) => {
    switch (filterState.sortBy) {
      case 'price-asc':
        return a.price - b.price;
      case 'price-desc':
        return b.price - a.price;
      case 'rating': {
        const ratingA = a.averageRating || 0;
        const ratingB = b.averageRating || 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      }
      case 'views': {
        const clicksA = a.whatsappClicks || 0;
        const clicksB = b.whatsappClicks || 0;
        if (clicksB !== clicksA) return clicksB - clicksA;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      case 'best-selling': {
        // WhatsApp clicks + reviews engagement indicator
        const scoreA = (a.whatsappClicks || 0) * 2 + (a.reviewCount || 0) * 3;
        const scoreB = (b.whatsappClicks || 0) * 2 + (b.reviewCount || 0) * 3;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      case 'newest':
      default: {
        const dateA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : (a.createdAt ? new Date(a.createdAt as string).getTime() : 0);
        const dateB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : (b.createdAt ? new Date(b.createdAt as string).getTime() : 0);
        if (dateB !== dateA) return dateB - dateA;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
    }
  });

  return result;
}

/**
 * Parses URLSearchParams into FilterState
 */
export function parseQueryToFilterState(
  searchParams: URLSearchParams,
  defaultCategory = 'all'
): FilterState {
  const state: FilterState = { ...DEFAULT_FILTER_STATE };

  state.search = searchParams.get('q') || '';
  state.category = searchParams.get('category') || defaultCategory;
  
  const brandsParam = searchParams.get('brand') || searchParams.get('brands');
  if (brandsParam) {
    state.brands = brandsParam.split(',').filter(Boolean);
  }

  const minPrice = searchParams.get('minPrice');
  if (minPrice && !isNaN(Number(minPrice))) {
    state.minPrice = Number(minPrice);
  }

  const maxPrice = searchParams.get('maxPrice');
  if (maxPrice && !isNaN(Number(maxPrice))) {
    state.maxPrice = Number(maxPrice);
  }

  const avail = searchParams.get('availability');
  if (avail === 'in_stock' || avail === 'low_stock' || avail === 'all') {
    state.availability = avail;
  }

  if (searchParams.get('featured') === 'true') {
    state.featuredOnly = true;
  }

  const sort = searchParams.get('sort');
  if (sort && ['newest', 'price-asc', 'price-desc', 'rating', 'views', 'best-selling'].includes(sort)) {
    state.sortBy = sort as SortOption;
  }

  const ram = searchParams.get('ram');
  if (ram) state.ram = ram.split(',').filter(Boolean);

  const storage = searchParams.get('storage');
  if (storage) state.storage = storage.split(',').filter(Boolean);

  const processor = searchParams.get('processor');
  if (processor) state.processor = processor.split(',').filter(Boolean);

  if (searchParams.has('is5G')) {
    state.is5G = searchParams.get('is5G') === 'true';
  }

  const battery = searchParams.get('battery');
  if (battery) state.battery = battery.split(',').filter(Boolean);

  const camera = searchParams.get('camera');
  if (camera) state.camera = camera.split(',').filter(Boolean);

  const screenSize = searchParams.get('screenSize') || searchParams.get('size');
  if (screenSize) state.screenSize = screenSize.split(',').filter(Boolean);

  const resolution = searchParams.get('resolution');
  if (resolution) state.resolution = resolution.split(',').filter(Boolean);

  if (searchParams.has('isSmartTv')) {
    state.isSmartTv = searchParams.get('isSmartTv') === 'true';
  }

  const bagType = searchParams.get('bagType');
  if (bagType) state.bagType = bagType.split(',').filter(Boolean);

  const bagSize = searchParams.get('bagSize');
  if (bagSize) state.bagSize = bagSize.split(',').filter(Boolean);

  const colors = searchParams.get('colors') || searchParams.get('color');
  if (colors) state.colors = colors.split(',').filter(Boolean);

  return state;
}

/**
 * Parses a query string or URLSearchParams into FilterState
 */
export function parseFilterStateFromUrl(queryStringOrParams: string | URLSearchParams, defaultCategory = 'all'): FilterState {
  const searchParams = typeof queryStringOrParams === 'string'
    ? new URLSearchParams(queryStringOrParams.startsWith('?') ? queryStringOrParams.slice(1) : queryStringOrParams)
    : queryStringOrParams;
  return parseQueryToFilterState(searchParams, defaultCategory);
}

export const parseUrlToFilterState = parseFilterStateFromUrl;

/**
 * Serializes FilterState into URLSearchParams string
 */
export function filterStateToQueryString(state: FilterState, defaultCategory = 'all'): string {
  const params = new URLSearchParams();

  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.category && state.category !== defaultCategory && state.category !== 'all') {
    params.set('category', state.category);
  }
  if (state.brands.length > 0) params.set('brand', state.brands.join(','));
  if (typeof state.minPrice === 'number' && !isNaN(state.minPrice)) {
    params.set('minPrice', state.minPrice.toString());
  }
  if (typeof state.maxPrice === 'number' && !isNaN(state.maxPrice)) {
    params.set('maxPrice', state.maxPrice.toString());
  }
  if (state.availability !== 'all') params.set('availability', state.availability);
  if (state.featuredOnly) params.set('featured', 'true');
  if (state.sortBy !== 'newest') params.set('sort', state.sortBy);

  if (state.ram.length > 0) params.set('ram', state.ram.join(','));
  if (state.storage.length > 0) params.set('storage', state.storage.join(','));
  if (state.processor.length > 0) params.set('processor', state.processor.join(','));
  if (state.is5G !== null) params.set('is5G', String(state.is5G));
  if (state.battery.length > 0) params.set('battery', state.battery.join(','));
  if (state.camera.length > 0) params.set('camera', state.camera.join(','));
  if (state.screenSize.length > 0) params.set('screenSize', state.screenSize.join(','));
  if (state.resolution.length > 0) params.set('resolution', state.resolution.join(','));
  if (state.isSmartTv !== null) params.set('isSmartTv', String(state.isSmartTv));
  if (state.bagType.length > 0) params.set('bagType', state.bagType.join(','));
  if (state.bagSize.length > 0) params.set('bagSize', state.bagSize.join(','));
  if (state.colors.length > 0) params.set('color', state.colors.join(','));

  const str = params.toString();
  return str ? `?${str}` : '';
}

export const buildFilterUrlQuery = filterStateToQueryString;

/**
 * Helper to count active applied filters
 */
export function countActiveFilters(state: FilterState): number {
  let count = 0;
  if (state.search.trim()) count++;
  if (state.brands.length > 0) count += state.brands.length;
  if (typeof state.minPrice === 'number' && !isNaN(state.minPrice)) count++;
  if (typeof state.maxPrice === 'number' && !isNaN(state.maxPrice)) count++;
  if (state.availability !== 'all') count++;
  if (state.featuredOnly) count++;
  if (state.ram.length > 0) count += state.ram.length;
  if (state.storage.length > 0) count += state.storage.length;
  if (state.processor.length > 0) count += state.processor.length;
  if (state.is5G !== null) count++;
  if (state.battery.length > 0) count += state.battery.length;
  if (state.camera.length > 0) count += state.camera.length;
  if (state.screenSize.length > 0) count += state.screenSize.length;
  if (state.resolution.length > 0) count += state.resolution.length;
  if (state.isSmartTv !== null) count++;
  if (state.bagType.length > 0) count += state.bagType.length;
  if (state.bagSize.length > 0) count += state.bagSize.length;
  if (state.colors.length > 0) count += state.colors.length;
  for (const arr of Object.values(state.dynamicSpecs)) {
    if (arr && arr.length > 0) count += arr.length;
  }
  return count;
}

// Helpers
function extractPattern(text: string, regex: RegExp): string | null {
  const match = text.match(regex);
  return match ? match[0].trim() : null;
}

function normalizeSpecValue(val: string): string {
  return val.replace(/\s+/g, ' ').trim();
}

function mapToOptions(map: Map<string, number>): FilterOption[] {
  return Array.from(map.entries())
    .map(([val, count]) => ({ value: val, label: val, count }))
    .sort((a, b) => b.count - a.count);
}

function formatSpecLabel(key: string): string {
  const map: Record<string, string> = {
    screen: 'الشاشة',
    battery: 'البطارية',
    rearCamera: 'الكاميرا الخلفية',
    frontCamera: 'الكاميرا الأمامية',
    network: 'الشبكة',
    chargingSpeed: 'سرعة الشحن',
    os: 'نظام التشغيل',
    warranty: 'الضمان',
    material: 'الخامة / المادة'
  };
  return map[key] || key;
}
