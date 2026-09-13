import {
  FinancingProvider,
  InstallmentPlan,
  ProductInstallmentConfig,
  ProductInstallmentPlanOverride,
  InstallmentCalculationResult
} from '../../types/installment';
import { InstallmentProviderAdapter } from './adapters/InstallmentProviderAdapter';
import { ManualProviderAdapter } from './adapters/ManualProviderAdapter';
import { APIProviderAdapter } from './adapters/APIProviderAdapter';

export class InstallmentProviderService {
  /**
   * Factory method to obtain the appropriate provider adapter.
   * If provider.integrationMode === 'api', uses APIProviderAdapter (ready for future backend).
   * Otherwise uses ManualProviderAdapter.
   */
  static getAdapter(provider: FinancingProvider): InstallmentProviderAdapter {
    if (provider.integrationMode === 'api') {
      return new APIProviderAdapter(provider);
    }
    return new ManualProviderAdapter(provider);
  }

  /**
   * Calculates installment for a selected plan via the provider adapter
   */
  static async calculate(
    provider: FinancingProvider,
    plan: InstallmentPlan,
    productPrice: number,
    override?: ProductInstallmentPlanOverride
  ): Promise<InstallmentCalculationResult> {
    const adapter = this.getAdapter(provider);
    return adapter.calculate(productPrice, plan, override);
  }

  /**
   * Filters and retrieves eligible plans for a provider and product
   */
  static async getEligiblePlans(
    provider: FinancingProvider,
    allPlans: InstallmentPlan[],
    productPrice: number,
    productConfig?: ProductInstallmentConfig
  ): Promise<InstallmentPlan[]> {
    const adapter = this.getAdapter(provider);
    return adapter.getEligiblePlans(allPlans, productPrice, productConfig);
  }

  /**
   * Computes the lowest estimated monthly payment across all eligible plans for a product,
   * ideal for product cards and teaser badges.
   */
  static getLowestMonthlyPayment(
    providers: FinancingProvider[],
    plans: InstallmentPlan[],
    productPrice: number,
    productConfig?: ProductInstallmentConfig
  ): { monthlyPayment: number; months: number; providerName: string } | null {
    if (productPrice <= 0) return null;
    if (productConfig && productConfig.enabled === false) return null;

    let lowest: { monthlyPayment: number; months: number; providerName: string } | null = null;

    for (const provider of providers) {
      if (!provider.enabled) continue;
      if (
        productConfig?.allowedProviderIds &&
        productConfig.allowedProviderIds.length > 0 &&
        !productConfig.allowedProviderIds.includes(provider.id)
      ) {
        continue;
      }

      const adapter = this.getAdapter(provider);
      // Synchronous calculation check for badge
      const providerPlans = plans.filter((p) => p.providerId === provider.id && p.enabled);
      for (const plan of providerPlans) {
        if (
          productConfig?.allowedPlanIds &&
          productConfig.allowedPlanIds.length > 0 &&
          !productConfig.allowedPlanIds.includes(plan.id)
        ) {
          continue;
        }

        if (plan.minProductPrice && productPrice < plan.minProductPrice) continue;
        if (plan.maxProductPrice && productPrice > plan.maxProductPrice) continue;

        const override = productConfig?.planOverrides?.[plan.id];
        // Calculate manually
        const res = (adapter as ManualProviderAdapter).provider 
          ? (adapter as ManualProviderAdapter) 
          : new ManualProviderAdapter(provider);
        
        // Quick estimate
        const safePrice = productPrice;
        const downType = override?.downPaymentType ?? plan.downPaymentType;
        const downVal = override?.downPaymentValue ?? plan.downPaymentValue;
        let down = 0;
        if (downType === 'percentage') {
          down = Math.round((safePrice * Math.min(100, downVal || 0)) / 100);
        } else if (downType === 'fixed') {
          down = Math.min(safePrice, Math.round(downVal || 0));
        }

        const financed = Math.max(0, safePrice - down);
        let fee = 0;
        if (plan.calculationType === 'percentage_fee') {
          const pct = override?.percentage ?? plan.percentage;
          fee = Math.round((financed * (pct || 0)) / 100);
        } else if (plan.calculationType === 'fixed_fee') {
          fee = Math.round(override?.fixedFee ?? plan.fixedFee ?? 0);
        }

        const total = financed + fee;
        const m = Math.max(1, plan.months);
        const monthly = Math.round(total / m);

        if (!lowest || monthly < lowest.monthlyPayment) {
          lowest = {
            monthlyPayment: monthly,
            months: m,
            providerName: provider.name
          };
        }
      }
    }

    return lowest;
  }
}
