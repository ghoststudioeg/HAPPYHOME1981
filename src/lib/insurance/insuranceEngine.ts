import { Category, Product } from '../../types';
import {
  InsuranceCalculationResult,
  InsurancePolicy,
  InsurancePriceRule,
  SelectedInsuranceSnapshot
} from '../../types/insurance';

/**
 * Initial Default Insurance Policies seeded on fresh setups or when reset.
 * All values are admin-configurable and stored in Firestore / cache.
 */
export const DEFAULT_INSURANCE_POLICIES: InsurancePolicy[] = [
  {
    id: 'fawry-full-device-12m',
    name: 'تأمين فوري الشامل للجهاز (12 شهر)',
    provider: 'فوري',
    type: 'full_device',
    durationMonths: 12,
    coverageType: 'حماية كاملة للجهاز ضد الحوادث والتلف والكسر',
    scopeType: 'all_eligible',
    categoryIds: [],
    productIds: [],
    excludedProductIds: [],
    eligibleCategoryKeywords: [
      'موبايل',
      'هاتف',
      'هواتف',
      'smartphones',
      'mobile',
      'كهرب',
      'منزل',
      'أجهزة',
      'شاشات',
      'تلفزيون',
      'تلفزيونات',
      'appliances',
      'electronics'
    ],
    pricingMode: 'tiered_rules',
    isFree: false,
    priceRules: [
      { id: 'tier-1', minPrice: 1000, maxPrice: 2000, insurancePrice: 200, active: true, sortOrder: 1 },
      { id: 'tier-2', minPrice: 2000, maxPrice: 3000, insurancePrice: 300, active: true, sortOrder: 2 },
      { id: 'tier-3', minPrice: 3000, maxPrice: 4000, insurancePrice: 400, active: true, sortOrder: 3 },
      { id: 'tier-4', minPrice: 4000, maxPrice: 6000, insurancePrice: 500, active: true, sortOrder: 4 },
      { id: 'tier-5', minPrice: 6000, maxPrice: 9000, insurancePrice: 1000, active: true, sortOrder: 5 },
      { id: 'tier-6', minPrice: 9000, maxPrice: 15000, insurancePrice: 1500, active: true, sortOrder: 6 }
    ],
    shortDescription: 'تغطية شاملة ومعتمدة من فوري لمدة عام كامل',
    coverageDescription: 'تغطية حوادث الكسر العرضي، التلف الكهربائي الناتج عن التذبذب، والسوائل، مع استبدال بقطع غيار أصلية عبر شبكة مراكز فوري المعتمدة في مصر.',
    customerNotes: 'وثيقة تأمين رسمية معتمدة من شركة فوري لمدة 12 شهراً. تسري الوثيقة من تاريخ الشراء وتغطي الصيانة والإصلاح في مراكز الخدمة المعتمدة وفقاً للشروط والأحكام.',
    badgeText: 'حماية فوري المعتمدة',
    active: true,
    sortOrder: 1
  },
  {
    id: 'fawry-screen-6m',
    name: 'تأمين فوري للشاشة (6 شهور)',
    provider: 'فوري',
    type: 'screen',
    durationMonths: 6,
    coverageType: 'حماية خاصة بالشاشة ضد الكسر العرضي',
    scopeType: 'all_eligible',
    categoryIds: [],
    productIds: [],
    excludedProductIds: [],
    eligibleCategoryKeywords: [
      'موبايل',
      'هاتف',
      'هواتف',
      'smartphones',
      'mobile'
    ],
    pricingMode: 'fixed_price',
    fixedPrice: 500,
    isFree: false,
    priceRules: [],
    shortDescription: 'حماية خاصة لشاشة الهاتف ضد الكسر لمدة 6 أشهر',
    coverageDescription: 'تغطية صيانة أو تغيير شاشة الهاتف الأصلية لمرة واحدة خلال مدة الوثيقة في حالة الكسر غير المتعمد دون أي تكاليف خفية.',
    customerNotes: 'وثيقة خاصة بشاشة الهواتف الذكية معتمدة من فوري لمدة 6 شهور، تغطي استبدال شاشة أصلية واحدة من خلال مراكز الصيانة المعتمدة.',
    badgeText: 'حماية شاشة فوري',
    active: true,
    sortOrder: 2
  }
];

/**
 * Checks if a product belongs to mobile phones based on category and product fields
 */
export function isMobileProduct(product: Product, category?: Category | null): boolean {
  const catName = (category?.name || product.categoryName || '').toLowerCase();
  const catSlug = (category?.slug || product.categoryId || '').toLowerCase();
  const prodName = (product.name || '').toLowerCase();

  const mobileKeywords = ['موبايل', 'هاتف', 'هواتف', 'smartphones', 'mobile', 'iphone', 'samsung', 'xiaomi', 'redmi', 'oppo', 'realme'];
  return mobileKeywords.some(kw => catName.includes(kw) || catSlug.includes(kw) || prodName.includes(kw));
}

/**
 * Checks if a product is eligible for electrical / home appliance coverage
 */
export function isApplianceOrDeviceProduct(product: Product, category?: Category | null): boolean {
  if (isMobileProduct(product, category)) return true;

  const catName = (category?.name || product.categoryName || '').toLowerCase();
  const catSlug = (category?.slug || product.categoryId || '').toLowerCase();
  const prodName = (product.name || '').toLowerCase();

  const keywords = [
    'كهرب',
    'منزل',
    'أجهزة',
    'شاشات',
    'تلفزيون',
    'شاشة',
    'غسالة',
    'ثلاجة',
    'بوتاجاز',
    'تكييف',
    'سخان',
    'مروحة',
    'خلاط',
    'مكواة',
    'appliances',
    'electronics',
    'tv',
    'screen'
  ];

  return keywords.some(kw => catName.includes(kw) || catSlug.includes(kw) || prodName.includes(kw));
}

/**
 * Determines whether an insurance policy is applicable to a specific product
 * Priority Hierarchy:
 * 1. Product exclusions (excludedProductIds) -> NOT applicable
 * 2. Product-specific inclusions (productIds) -> APPLICABLE
 * 3. Category inclusions (scopeType === 'category') -> Checks categoryIds
 * 4. All eligible (scopeType === 'all_eligible') -> Enforces domain compatibility
 */
export function isPolicyApplicableToProduct(
  policy: InsurancePolicy,
  product: Product,
  resolvedCategory?: Category | null
): boolean {
  if (!policy.active) return false;

  // 1. Explicit Product Exclusion (highest priority negative check)
  if (policy.excludedProductIds && policy.excludedProductIds.includes(product.id)) {
    return false;
  }

  // 2. Explicit Product Inclusion (highest priority positive override)
  if (policy.productIds && policy.productIds.includes(product.id)) {
    return true;
  }

  // 3. Category Scope
  if (policy.scopeType === 'category') {
    if (!policy.categoryIds || policy.categoryIds.length === 0) return false;
    const catId = product.categoryId || resolvedCategory?.id;
    return Boolean(catId && policy.categoryIds.includes(catId));
  }

  // 4. Product-only Scope (if scopeType is 'product' and product not in list, return false)
  if (policy.scopeType === 'product') {
    return Boolean(policy.productIds && policy.productIds.includes(product.id));
  }

  // 5. "All Eligible Products" Scope (scopeType === 'all_eligible')
  // Compatibility domain guards:
  if (policy.type === 'screen') {
    // Screen insurance is strictly for mobile phones / screen devices unless explicitly configured by Admin
    return isMobileProduct(product, resolvedCategory);
  }

  if (policy.type === 'full_device') {
    // Check keywords if specified
    if (policy.eligibleCategoryKeywords && policy.eligibleCategoryKeywords.length > 0) {
      const catName = (resolvedCategory?.name || product.categoryName || '').toLowerCase();
      const catSlug = (resolvedCategory?.slug || product.categoryId || '').toLowerCase();
      const prodName = (product.name || '').toLowerCase();

      return policy.eligibleCategoryKeywords.some(kw => {
        const k = kw.toLowerCase().trim();
        return k && (catName.includes(k) || catSlug.includes(k) || prodName.includes(k));
      });
    }

    // Default heuristic for full device
    return isApplianceOrDeviceProduct(product, resolvedCategory);
  }

  // Custom policy types default to true if all_eligible
  return true;
}

/**
 * Calculates the exact insurance price dynamically based on policy configuration
 * STRICT REQUIREMENT: No hardcoded pricing ranges. Evaluates Admin priceRules or fixedPrice dynamically.
 */
export function calculateInsuranceForProduct(
  policy: InsurancePolicy,
  effectiveProductPrice: number
): InsuranceCalculationResult {
  if (!policy.active) {
    return { available: false, price: 0, isFree: false, reason: 'وثيقة التأمين غير مفعلة حالياً' };
  }

  // 1. Free Insurance Policy
  if (policy.isFree) {
    return { available: true, price: 0, isFree: true };
  }

  // 2. Fixed Price Mode (e.g. Screen Insurance)
  if (policy.pricingMode === 'fixed_price') {
    const price = typeof policy.fixedPrice === 'number' ? policy.fixedPrice : 0;
    return {
      available: true,
      price: Math.max(0, price),
      isFree: price === 0
    };
  }

  // 3. Tiered Price Rules Mode (e.g. Full Device Insurance)
  const activeRules = (policy.priceRules || [])
    .filter(r => r.active !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.minPrice - b.minPrice);

  if (activeRules.length === 0) {
    return {
      available: false,
      price: 0,
      isFree: false,
      reason: 'لا توجد شرائح تسعير محددة لهذه الوثيقة'
    };
  }

  // Find matching price range
  // Boundary logic: minPrice <= price && price <= maxPrice
  const matchedRule = activeRules.find(
    rule => effectiveProductPrice >= rule.minPrice && effectiveProductPrice <= rule.maxPrice
  );

  if (!matchedRule) {
    return {
      available: false,
      price: 0,
      isFree: false,
      reason: 'سعر هذا المنتج خارج النطاق السعري لتغطية الوثيقة'
    };
  }

  return {
    available: true,
    price: matchedRule.insurancePrice,
    isFree: matchedRule.insurancePrice === 0,
    matchedRule
  };
}

/**
 * Returns all active, applicable insurance policies for a given product and calculates their prices
 */
export function getApplicablePoliciesForProduct(
  policies: InsurancePolicy[],
  product: Product,
  effectiveProductPrice: number,
  resolvedCategory?: Category | null
): Array<{ policy: InsurancePolicy; calculation: InsuranceCalculationResult }> {
  if (!policies || policies.length === 0) return [];

  const results: Array<{ policy: InsurancePolicy; calculation: InsuranceCalculationResult }> = [];

  const sortedPolicies = [...policies].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const policy of sortedPolicies) {
    if (isPolicyApplicableToProduct(policy, product, resolvedCategory)) {
      const calculation = calculateInsuranceForProduct(policy, effectiveProductPrice);
      if (calculation.available) {
        results.push({ policy, calculation });
      }
    }
  }

  return results;
}

/**
 * Filters and returns all policies applicable and eligible for a product
 */
export function filterEligibleInsurancePolicies(
  policies: InsurancePolicy[],
  product: Product,
  effectiveProductPrice: number,
  resolvedCategory?: Category | null
): InsurancePolicy[] {
  return getApplicablePoliciesForProduct(policies, product, effectiveProductPrice, resolvedCategory).map(r => r.policy);
}

/**
 * Creates an immutable snapshot of a selected insurance policy for storing with orders/inquiries.
 * Ensures future admin price edits never alter historical records.
 */
export function createInsuranceSnapshot(
  policy: InsurancePolicy,
  calculatedPriceOrEffectiveProductPrice: number,
  isFreeOrProductId?: boolean | string
): SelectedInsuranceSnapshot {
  let finalPrice = calculatedPriceOrEffectiveProductPrice;
  let isFree = false;

  if (typeof isFreeOrProductId === 'boolean') {
    isFree = isFreeOrProductId;
  } else {
    const calc = calculateInsuranceForProduct(policy, calculatedPriceOrEffectiveProductPrice);
    finalPrice = calc.price;
    isFree = calc.isFree;
  }

  return {
    policyId: policy.id,
    name: policy.name,
    provider: policy.provider || 'فوري',
    type: policy.type,
    policyType: policy.type,
    durationMonths: policy.durationMonths,
    coverageDurationMonths: policy.durationMonths,
    coverage: policy.coverageType,
    insurancePrice: finalPrice,
    isFree: isFree,
    timestamp: new Date().toISOString(),
    notes: policy.customerNotes
  };
}

/**
 * Validates pricing tier rules (admin dashboard helper)
 */
export function validatePriceRules(rules: InsurancePriceRule[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rules || rules.length === 0) {
    return { valid: true, errors: [], warnings: ['لا توجد شرائح تسعير مضافة حالياً.'] };
  }

  const sorted = [...rules].sort((a, b) => a.minPrice - b.minPrice);

  sorted.forEach((rule, idx) => {
    const label = `الشريحة ${idx + 1} (${rule.minPrice} - ${rule.maxPrice})`;

    if (rule.minPrice < 0) {
      errors.push(`${label}: الحد الأدنى للسعر لا يمكن أن يكون سالباً.`);
    }
    if (rule.maxPrice <= rule.minPrice) {
      errors.push(`${label}: الحد الأقصى للسعر يجب أن يكون أكبر من الحد الأدنى.`);
    }
    if (rule.insurancePrice < 0) {
      errors.push(`${label}: سعر وثيقة التأمين لا يمكن أن يكون سالباً.`);
    }

    // Check overlap with next rule
    if (idx < sorted.length - 1) {
      const nextRule = sorted[idx + 1];
      if (rule.maxPrice > nextRule.minPrice) {
        warnings.push(`يوجد تداخل بين الشريحة (${rule.minPrice} - ${rule.maxPrice}) والشريحة التالية (${nextRule.minPrice} - ${nextRule.maxPrice}).`);
      } else if (rule.maxPrice < nextRule.minPrice) {
        warnings.push(`توجد فجوة سعرية بين ${rule.maxPrice} ج.م و ${nextRule.minPrice} ج.م.`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
