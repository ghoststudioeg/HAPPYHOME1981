export type InsurancePolicyType = 'full_device' | 'screen' | 'custom';
export type InsurancePricingMode = 'tiered_rules' | 'fixed_price';
export type InsuranceScopeType = 'all_eligible' | 'category' | 'product';

export interface InsurancePriceRule {
  id: string;
  minPrice: number;
  maxPrice: number;
  insurancePrice: number;
  active: boolean;
  sortOrder: number;
}

export interface InsurancePolicy {
  id: string;
  name: string; // e.g., "تأمين فوري الكامل — 12 شهر"
  provider: string; // "فوري"
  type: InsurancePolicyType;
  durationMonths: number; // e.g. 12 or 6
  coverageType: string; // e.g. "حماية كاملة للجهاز" أو "حماية الشاشة فقط"
  
  // Scope and Assignment
  scopeType: InsuranceScopeType; // 'all_eligible' | 'category' | 'product'
  categoryIds: string[]; // Specific categories if scopeType === 'category'
  productIds: string[]; // Specific products if scopeType === 'product'
  excludedProductIds?: string[]; // Products explicitly excluded from this policy
  eligibleCategoryKeywords?: string[]; // Keywords for 'all_eligible' matching (e.g. موبايل, أجهزة)

  // Pricing configuration
  pricingMode: InsurancePricingMode; // 'tiered_rules' | 'fixed_price'
  fixedPrice?: number; // Used when pricingMode === 'fixed_price' (e.g. 500 EGP)
  isFree: boolean; // When true, insurancePrice is 0 and shown as "مجانًا"
  priceRules: InsurancePriceRule[]; // Tiered pricing rules

  // Display & Content
  shortDescription?: string;
  coverageDescription?: string;
  customerNotes?: string; // Policy terms & conditions displayed to customers
  badgeText?: string; // e.g. "حماية فوري المعتمدة"
  
  // System flags
  active: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SelectedInsuranceSnapshot {
  policyId: string;
  name: string;
  provider: string; // "فوري"
  type: InsurancePolicyType;
  policyType?: InsurancePolicyType; // Alias for type
  durationMonths: number;
  coverageDurationMonths?: number; // Alias for durationMonths
  coverage: string;
  insurancePrice: number;
  isFree: boolean;
  timestamp: string;
  notes?: string;
}

export interface InsuranceCalculationResult {
  available: boolean;
  price: number;
  isFree: boolean;
  reason?: string;
  matchedRule?: InsurancePriceRule;
}
