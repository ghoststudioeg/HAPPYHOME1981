import {
  calculateManualInstallment,
  filterEligiblePlans,
  formatInstallmentWhatsAppMessage,
  isPlanEligibleForPrice
} from '../calculationEngine';
import { InstallmentPlan, FinancingProvider, ProductInstallmentConfig } from '../../../types/installment';
import { InstallmentProviderService } from '../installmentProviderService';

// Test suite for Installment Calculation Engine & Safety Rules
export function runInstallmentTests(): { success: boolean; results: string[] } {
  const results: string[] = [];
  let success = true;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      results.push(`PASS: ${testName}`);
    } else {
      results.push(`FAIL: ${testName}`);
      success = false;
    }
  }

  const mockProvider: FinancingProvider = {
    id: 'taqseeti',
    name: 'تقسيطي',
    slug: 'taqseeti',
    enabled: true,
    calculationMode: 'manual',
    integrationMode: 'manual',
    description: 'تقسيط مباشر',
    displayOrder: 1,
    isDirectStore: true
  };

  // 1. no_extra_cost calculation test
  const noCostPlan: InstallmentPlan = {
    id: 'plan-6m',
    providerId: 'taqseeti',
    months: 6,
    calculationType: 'no_extra_cost',
    percentage: 0,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    enabled: true,
    displayOrder: 1
  };
  const res1 = calculateManualInstallment(12000, noCostPlan, mockProvider);
  assert(res1.financedAmount === 12000, 'no_extra_cost financed amount equals original price');
  assert(res1.totalPayable === 12000, 'no_extra_cost total payable has no extra fee');
  assert(res1.monthlyPayment === 2000, 'no_extra_cost monthly payment is 12000 / 6 = 2000');
  assert(res1.calculationSource === 'manual', 'calculationSource is strictly manual');

  // 2. percentage fee calculation test
  const pctPlan: InstallmentPlan = {
    id: 'plan-12m',
    providerId: 'taqseeti',
    months: 12,
    calculationType: 'percentage_fee',
    percentage: 10,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    enabled: true,
    displayOrder: 2
  };
  const res2 = calculateManualInstallment(20000, pctPlan, mockProvider);
  assert(res2.feeAmount === 2000, 'percentage_fee fee is 10% of 20000 = 2000');
  assert(res2.totalPayable === 22000, 'percentage_fee total payable is 22000');
  assert(res2.monthlyPayment === Math.round(22000 / 12), 'percentage_fee monthly payment is 1833');

  // 3. fixed fee calculation test
  const fixedPlan: InstallmentPlan = {
    id: 'plan-fixed',
    providerId: 'taqseeti',
    months: 3,
    calculationType: 'fixed_fee',
    percentage: 0,
    fixedFee: 300,
    downPaymentType: 'none',
    downPaymentValue: 0,
    enabled: true,
    displayOrder: 3
  };
  const res3 = calculateManualInstallment(6000, fixedPlan, mockProvider);
  assert(res3.feeAmount === 300, 'fixed_fee adds exactly 300');
  assert(res3.totalPayable === 6300, 'fixed_fee total payable is 6300');
  assert(res3.monthlyPayment === 2100, 'fixed_fee monthly payment is 6300 / 3 = 2100');

  // 4. down payment (percentage and fixed)
  const downPctPlan: InstallmentPlan = {
    ...pctPlan,
    downPaymentType: 'percentage',
    downPaymentValue: 20 // 20%
  };
  const res4 = calculateManualInstallment(10000, downPctPlan, mockProvider);
  assert(res4.downPayment === 2000, '20% down payment on 10000 is 2000');
  assert(res4.financedAmount === 8000, 'financed amount is 8000');
  assert(res4.feeAmount === 800, '10% fee applies to financed amount 8000 = 800');
  assert(res4.totalPayable === 8800, 'total payable is 8800');

  const downFixedPlan: InstallmentPlan = {
    ...pctPlan,
    downPaymentType: 'fixed',
    downPaymentValue: 1500
  };
  const res5 = calculateManualInstallment(10000, downFixedPlan, mockProvider);
  assert(res5.downPayment === 1500, 'fixed down payment is 1500');
  assert(res5.financedAmount === 8500, 'financed amount is 8500');

  // 5. product-specific overrides (override percentage, fixed fee, down payment)
  const res6 = calculateManualInstallment(10000, pctPlan, mockProvider, {
    percentage: 5, // override from 10% to 5%
    downPaymentType: 'fixed',
    downPaymentValue: 1000
  });
  assert(res6.downPayment === 1000, 'override down payment is applied');
  assert(res6.financedAmount === 9000, 'override financed amount is 9000');
  assert(res6.feeAmount === 450, 'override 5% fee on 9000 is 450');
  assert(pctPlan.percentage === 10, 'original global plan percentage was NOT modified');

  // 6. min / max price filtering
  const boundedPlan: InstallmentPlan = {
    ...noCostPlan,
    minProductPrice: 5000,
    maxProductPrice: 25000
  };
  assert(!isPlanEligibleForPrice(boundedPlan, 4000), 'price 4000 is rejected below min 5000');
  assert(isPlanEligibleForPrice(boundedPlan, 10000), 'price 10000 is accepted within [5000, 25000]');
  assert(!isPlanEligibleForPrice(boundedPlan, 30000), 'price 30000 is rejected above max 25000');

  // 7. disabled provider and plan filtering
  const disabledProvider: FinancingProvider = { ...mockProvider, enabled: false };
  const filteredDisabled = filterEligiblePlans([noCostPlan], disabledProvider, 10000);
  assert(filteredDisabled.length === 0, 'disabled provider returns 0 plans');

  const disabledPlan: InstallmentPlan = { ...noCostPlan, enabled: false };
  const filteredPlan = filterEligiblePlans([disabledPlan], mockProvider, 10000);
  assert(filteredPlan.length === 0, 'disabled plan returns 0 plans');

  // 8. product config disabling installments entirely
  const disabledConfig: ProductInstallmentConfig = { enabled: false };
  const filteredConfig = filterEligiblePlans([noCostPlan], mockProvider, 10000, disabledConfig);
  assert(filteredConfig.length === 0, 'product with installmentConfig.enabled = false returns 0 plans');

  // 9. original product.price preservation
  const originalPrice = 18500;
  const resPreserve = calculateManualInstallment(originalPrice, pctPlan, mockProvider);
  assert(resPreserve.productPrice === originalPrice, 'product.price is exactly preserved');

  // 10. WhatsApp message generation
  const waMsg = formatInstallmentWhatsAppMessage({
    productName: 'Samsung Galaxy S24 Ultra',
    productPrice: 45000,
    providerName: 'تقسيطي',
    isDirectStore: true,
    months: 12,
    downPayment: 5000,
    totalPayable: 44000,
    monthlyPayment: 3667
  });
  assert(waMsg.includes('Samsung Galaxy S24 Ultra'), 'WhatsApp message contains product name');
  assert(waMsg.includes((45000).toLocaleString('ar-EG')), 'WhatsApp message contains formatted price');
  assert(waMsg.includes('تقسيطي (تقسيط مباشر من المحل)'), 'WhatsApp message contains direct store note');
  assert(waMsg.includes((3667).toLocaleString('ar-EG')), 'WhatsApp message contains estimated monthly payment');

  // 11. Provider Adapter Architecture works with no external API
  const adapter = InstallmentProviderService.getAdapter(mockProvider);
  assert(adapter.integrationMode === 'manual', 'Adapter resolves to manual mode');

  return { success, results };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('calculationEngine.test')) {
  const { success, results } = runInstallmentTests();
  console.log('=== INSTALLMENT TEST RESULTS ===');
  results.forEach(r => console.log(r));
  if (!success) {
    console.error('TESTS FAILED');
    process.exit(1);
  } else {
    console.log(`\nALL ${results.length} TESTS PASSED!`);
  }
}
