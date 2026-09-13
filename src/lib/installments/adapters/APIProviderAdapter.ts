import { InstallmentProviderAdapter } from './InstallmentProviderAdapter';
import {
  FinancingProvider,
  InstallmentPlan,
  ProductInstallmentConfig,
  ProductInstallmentPlanOverride,
  InstallmentCalculationResult
} from '../../../types/installment';
import { ManualProviderAdapter } from './ManualProviderAdapter';

/**
 * APIProviderAdapter
 * Architectural type boundary for future official provider API integrations.
 * 
 * IMPORTANT COMPLIANCE DIRECTIVE:
 * - NO external HTTP or network calls are made.
 * - NO fake or mock API responses are fabricated.
 * - If API mode is not configured, safely defaults to the ManualProviderAdapter.
 */
export class APIProviderAdapter implements InstallmentProviderAdapter {
  readonly provider: FinancingProvider;
  readonly integrationMode = 'api' as const;
  private fallbackManualAdapter: ManualProviderAdapter;

  constructor(provider: FinancingProvider) {
    this.provider = provider;
    this.fallbackManualAdapter = new ManualProviderAdapter(provider);
  }

  async getEligiblePlans(
    plans: InstallmentPlan[],
    productPrice: number,
    productConfig?: ProductInstallmentConfig
  ): Promise<InstallmentPlan[]> {
    // Architectural boundary: Returns eligible plans using manual fallback
    return this.fallbackManualAdapter.getEligiblePlans(plans, productPrice, productConfig);
  }

  async calculate(
    productPrice: number,
    plan: InstallmentPlan,
    override?: ProductInstallmentPlanOverride
  ): Promise<InstallmentCalculationResult> {
    // Architectural boundary: Falls back securely to manual calculation without network traffic
    return this.fallbackManualAdapter.calculate(productPrice, plan, override);
  }
}
