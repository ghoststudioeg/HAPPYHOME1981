import { InstallmentProviderAdapter } from './InstallmentProviderAdapter';
import {
  FinancingProvider,
  InstallmentPlan,
  ProductInstallmentConfig,
  ProductInstallmentPlanOverride,
  InstallmentCalculationResult
} from '../../../types/installment';
import {
  calculateManualInstallment,
  filterEligiblePlans
} from '../calculationEngine';

/**
 * ManualProviderAdapter
 * Fully implements local manual calculation rules.
 * Does not make external network calls.
 */
export class ManualProviderAdapter implements InstallmentProviderAdapter {
  readonly provider: FinancingProvider;
  readonly integrationMode = 'manual' as const;

  constructor(provider: FinancingProvider) {
    this.provider = provider;
  }

  async getEligiblePlans(
    plans: InstallmentPlan[],
    productPrice: number,
    productConfig?: ProductInstallmentConfig
  ): Promise<InstallmentPlan[]> {
    return filterEligiblePlans(plans, this.provider, productPrice, productConfig);
  }

  async calculate(
    productPrice: number,
    plan: InstallmentPlan,
    override?: ProductInstallmentPlanOverride
  ): Promise<InstallmentCalculationResult> {
    return calculateManualInstallment(productPrice, plan, this.provider, override);
  }
}
