import {
  FinancingProvider,
  InstallmentPlan,
  ProductInstallmentConfig,
  ProductInstallmentPlanOverride,
  InstallmentCalculationResult
} from '../../../types/installment';

export interface InstallmentProviderAdapter {
  readonly provider: FinancingProvider;
  readonly integrationMode: 'manual' | 'api';

  /**
   * Filter and retrieve eligible plans for a given product price and product config
   */
  getEligiblePlans(
    plans: InstallmentPlan[],
    productPrice: number,
    productConfig?: ProductInstallmentConfig
  ): Promise<InstallmentPlan[]>;

  /**
   * Calculate installment result for a selected plan
   */
  calculate(
    productPrice: number,
    plan: InstallmentPlan,
    override?: ProductInstallmentPlanOverride
  ): Promise<InstallmentCalculationResult>;
}
