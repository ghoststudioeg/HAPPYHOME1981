export type IntegrationMode = 'manual' | 'api';
export type CalculationMode = 'manual' | 'api';
export type CalculationSource = 'manual' | 'api';

export type InstallmentCalculationType = 'no_extra_cost' | 'percentage_fee' | 'fixed_fee';
export type DownPaymentType = 'none' | 'percentage' | 'fixed' | 'fixed_amount';
export type FeeCalculationBase = 'remaining_amount' | 'full_price';

export interface FinancingProvider {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  enabled: boolean;
  calculationMode: CalculationMode;
  integrationMode: IntegrationMode;
  description: string;
  displayOrder: number;
  isDirectStore?: boolean;
  directStoreDisclaimer?: string;
  // Architecture-ready fields for future official API integrations (no secrets stored in client/firestore)
  apiEnabled?: boolean;
  apiBaseUrl?: string;
  providerAccountId?: string;
  integrationStatus?: 'unconfigured' | 'pending' | 'active';
  lastSyncAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstallmentPlan {
  id: string;
  providerId: string;
  months: number;
  calculationType: InstallmentCalculationType;
  percentage: number;
  fixedFee: number;
  downPaymentType: DownPaymentType;
  downPaymentValue: number;
  feeCalculationBase?: FeeCalculationBase; // 'remaining_amount' (default) | 'full_price'
  minProductPrice?: number;
  maxProductPrice?: number;
  enabled: boolean;
  displayOrder: number;
  disclaimer?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductInstallmentPlanOverride {
  percentage?: number;
  fixedFee?: number;
  downPaymentType?: DownPaymentType;
  downPaymentValue?: number;
  feeCalculationBase?: FeeCalculationBase;
}

export interface ProductInstallmentConfig {
  enabled: boolean;
  allowedProviderIds?: string[];
  allowedPlanIds?: string[];
  planOverrides?: Record<string, ProductInstallmentPlanOverride>;
}

export interface InstallmentCalculationResult {
  providerId: string;
  providerName: string;
  providerSlug: string;
  isDirectStore: boolean;
  planId: string;
  months: number;
  productPrice: number;
  downPayment: number;
  financedAmount: number;
  totalPayable: number;
  monthlyPayment: number;
  feeAmount: number;
  feeCalculationBase: FeeCalculationBase;
  calculationType: InstallmentCalculationType;
  calculationSource: CalculationSource;
  disclaimer?: string;
  directStoreDisclaimer?: string;
}
