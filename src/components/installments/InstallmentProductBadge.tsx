import React, { useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import {
  FinancingProvider,
  InstallmentPlan,
  ProductInstallmentConfig
} from '../../types/installment';
import { filterEligiblePlans } from '../../lib/installments/calculationEngine';
import { InstallmentProviderLogo } from './InstallmentProviderLogo';

interface InstallmentProductBadgeProps {
  productPrice: number;
  productConfig?: ProductInstallmentConfig;
  providers: FinancingProvider[];
  plans: InstallmentPlan[];
  onOpenModal: (providerId?: string) => void;
}

export function InstallmentProductBadge({
  productPrice,
  productConfig,
  providers,
  plans,
  onOpenModal
}: InstallmentProductBadgeProps) {
  // Filter eligible providers that have at least 1 active plan for this product price
  const eligibleProviders = useMemo(() => {
    if (productPrice <= 0) return [];
    if (productConfig && productConfig.enabled === false) return [];

    return providers
      .filter((prov) => {
        if (!prov.enabled) return false;
        if (
          productConfig?.allowedProviderIds &&
          productConfig.allowedProviderIds.length > 0 &&
          !productConfig.allowedProviderIds.includes(prov.id)
        ) {
          return false;
        }
        const providerPlans = filterEligiblePlans(plans, prov, productPrice, productConfig);
        return providerPlans.length > 0;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [productPrice, productConfig, providers, plans]);

  if (eligibleProviders.length === 0) {
    return null;
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-[var(--card)] border border-[var(--border-strong)] p-3.5 sm:p-4 text-[var(--text-primary)] transition-all my-3 shadow-lg"
      dir="rtl"
    >
      {/* Background subtle ambient light */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Compact Section Header */}
      <div className="relative flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <div className="flex items-baseline gap-2">
            <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
              التقسيط متاح
            </span>
            <span className="text-[11px] text-[var(--text-secondary)] font-normal">
              اختر جهة التقسيط
            </span>
          </div>
        </div>
      </div>

      {/* Provider Logos ONLY — Centered Circles, NO Names underneath */}
      <div className="relative flex items-center justify-center gap-3 sm:gap-3.5 flex-wrap">
        {eligibleProviders.map((prov) => (
          <InstallmentProviderLogo
            key={prov.id}
            provider={prov}
            onClick={() => onOpenModal(prov.id)}
          />
        ))}
      </div>
    </div>
  );
}
