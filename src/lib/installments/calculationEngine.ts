import {
  InstallmentPlan,
  ProductInstallmentPlanOverride,
  ProductInstallmentConfig,
  InstallmentCalculationResult,
  FinancingProvider,
  FeeCalculationBase
} from '../../types/installment';

/**
 * Checks whether a given plan is eligible for a specified product price
 */
export function isPlanEligibleForPrice(plan: InstallmentPlan, productPrice: number): boolean {
  if (!plan.enabled) return false;
  if (productPrice <= 0) return false;
  if (plan.minProductPrice !== undefined && plan.minProductPrice > 0 && productPrice < plan.minProductPrice) {
    return false;
  }
  if (plan.maxProductPrice !== undefined && plan.maxProductPrice > 0 && productPrice > plan.maxProductPrice) {
    return false;
  }
  return true;
}

/**
 * Filters plans based on provider enablement, product price, and product configuration overrides
 */
export function filterEligiblePlans(
  plans: InstallmentPlan[],
  provider: FinancingProvider,
  productPrice: number,
  productConfig?: ProductInstallmentConfig
): InstallmentPlan[] {
  if (!provider.enabled) return [];
  if (productConfig && productConfig.enabled === false) return [];

  // Check if provider is allowed for this product
  if (
    productConfig?.allowedProviderIds &&
    productConfig.allowedProviderIds.length > 0 &&
    !productConfig.allowedProviderIds.includes(provider.id)
  ) {
    return [];
  }

  return plans
    .filter((plan) => plan.providerId === provider.id)
    .filter((plan) => {
      // Check if plan is specifically disabled or not allowed in product config
      if (
        productConfig?.allowedPlanIds &&
        productConfig.allowedPlanIds.length > 0 &&
        !productConfig.allowedPlanIds.includes(plan.id)
      ) {
        return false;
      }
      return isPlanEligibleForPrice(plan, productPrice);
    })
    .sort((a, b) => a.displayOrder - b.displayOrder || a.months - b.months);
}

/**
 * Centralized Manual Installment Calculation Engine
 * Strictly guarantees:
 * 1. Product price is never mutated
 * 2. Source is explicitly 'manual'
 * 3. Supports no_extra_cost, percentage_fee, and fixed_fee calculations
 * 4. Supports optional down payment (percentage, fixed, or none)
 * 5. Applies product-specific overrides without mutating the global plan
 */
export function calculateManualInstallment(
  productPrice: number,
  plan: InstallmentPlan,
  provider?: FinancingProvider,
  override?: ProductInstallmentPlanOverride
): InstallmentCalculationResult {
  // Guard price against invalid inputs (negative or NaN)
  const safePrice = Math.max(0, Number(productPrice) || 0);

  // Guard months against zero/negative
  const safeMonths = Math.max(1, Math.floor(Number(plan.months) || 1));

  // Determine effective down payment settings
  const downPaymentType = override?.downPaymentType ?? plan.downPaymentType;
  const rawDownPaymentVal = override?.downPaymentValue !== undefined
    ? override.downPaymentValue
    : plan.downPaymentValue;
  const safeDownPaymentVal = Math.max(0, Number(rawDownPaymentVal) || 0);

  let downPayment = 0;
  if (downPaymentType === 'percentage') {
    const cappedPercent = Math.min(100, safeDownPaymentVal);
    downPayment = Math.round((safePrice * cappedPercent) / 100);
  } else if (downPaymentType === 'fixed' || downPaymentType === 'fixed_amount') {
    downPayment = Math.min(safePrice, Math.round(safeDownPaymentVal));
  } else {
    downPayment = 0;
  }

  // Financed amount (remaining balance after down payment)
  const financedAmount = Math.max(0, safePrice - downPayment);

  // Determine effective fee calculation base
  const feeCalculationBase: FeeCalculationBase =
    override?.feeCalculationBase ?? plan.feeCalculationBase ?? 'remaining_amount';

  // Determine effective fees based on calculationType
  let feeAmount = 0;
  if (plan.calculationType === 'percentage_fee') {
    const effectivePercentage = override?.percentage !== undefined
      ? override.percentage
      : plan.percentage;
    const safePercentage = Math.max(0, Number(effectivePercentage) || 0);

    // Apply percentage either to remaining amount (default) or to full product price
    const baseForPercentage = feeCalculationBase === 'full_price' ? safePrice : financedAmount;
    feeAmount = Math.round((baseForPercentage * safePercentage) / 100);
  } else if (plan.calculationType === 'fixed_fee') {
    const effectiveFixedFee = override?.fixedFee !== undefined
      ? override.fixedFee
      : plan.fixedFee;
    feeAmount = Math.max(0, Math.round(Number(effectiveFixedFee) || 0));
  } else {
    // no_extra_cost
    feeAmount = 0;
  }

  const totalPayable = financedAmount + feeAmount;
  const monthlyPayment = safeMonths > 0 ? Math.round((totalPayable / safeMonths) * 100) / 100 : totalPayable;

  return {
    providerId: plan.providerId,
    providerName: provider?.name || 'جهة التقسيط',
    providerSlug: provider?.slug || '',
    isDirectStore: Boolean(provider?.isDirectStore),
    planId: plan.id,
    months: safeMonths,
    productPrice: safePrice,
    downPayment,
    financedAmount,
    totalPayable,
    monthlyPayment,
    feeAmount,
    feeCalculationBase,
    calculationType: plan.calculationType,
    calculationSource: 'manual',
    disclaimer: plan.disclaimer,
    directStoreDisclaimer: provider?.directStoreDisclaimer || (provider?.isDirectStore ? 'التقسيط المباشر يتم من خلال المحل، وتخضع الموافقة والشروط النهائية لإجراءات المحل.' : undefined)
  };
}

/**
 * Formats a clean, standard Arabic WhatsApp inquiry message for installment
 */
export interface WhatsAppInstallmentMessageParams {
  productName: string;
  productPrice: number;
  providerName: string;
  isDirectStore?: boolean;
  months: number;
  downPayment: number;
  financedAmount?: number;
  feeAmount?: number;
  totalPayable: number;
  monthlyPayment: number;
}

export function formatInstallmentWhatsAppMessage(params: WhatsAppInstallmentMessageParams): string {
  const financed = params.financedAmount !== undefined
    ? params.financedAmount
    : Math.max(0, params.productPrice - params.downPayment);

  const lines: string[] = [
    'مرحباً، أرغب في الاستفسار عن تقسيط المنتج:',
    '',
    `• المنتج: ${params.productName}`,
    `• السعر: ${params.productPrice.toLocaleString('ar-EG')} جنيه`,
    `• جهة التقسيط: ${params.providerName}${params.isDirectStore ? ' (تقسيط مباشر من المحل)' : ''}`,
    `• المدة: ${params.months} شهر`,
    `• المقدم: ${params.downPayment > 0 ? `${params.downPayment.toLocaleString('ar-EG')} جنيه` : 'بدون مقدم'}`,
    `• المبلغ المتبقي: ${financed.toLocaleString('ar-EG')} جنيه`
  ];

  if (params.feeAmount && params.feeAmount > 0) {
    lines.push(`• المصاريف / الفائدة: +${params.feeAmount.toLocaleString('ar-EG')} جنيه`);
  }

  lines.push(`• إجمالي المبلغ التقديري: ${params.totalPayable.toLocaleString('ar-EG')} جنيه`);
  lines.push(`• القسط الشهري التقديري: ${params.monthlyPayment.toLocaleString('ar-EG')} جنيه`);
  lines.push('');
  lines.push('ملاحظة: القسط المعروض تقديري وتخضع الموافقة والشروط النهائية لإجراءات جهة التقسيط / المحل.');
  lines.push('');
  lines.push('أرجو تزويدي بالأوراق والشروط المطلوبة لاستكمال الطلب.');

  return lines.join('\n');
}
