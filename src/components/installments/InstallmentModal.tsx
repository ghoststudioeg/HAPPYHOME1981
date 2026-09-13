import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  MessageCircle,
  Check
} from 'lucide-react';
import {
  FinancingProvider,
  InstallmentPlan,
  InstallmentCalculationResult,
  ProductInstallmentConfig
} from '../../types/installment';
import { StoreSettings } from '../../types';
import {
  filterEligiblePlans,
  calculateManualInstallment,
  formatInstallmentWhatsAppMessage
} from '../../lib/installments/calculationEngine';
import { ProviderLogo } from './ProviderLogo';
import { InstallmentProviderLogo } from './InstallmentProviderLogo';

interface InstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productPrice: number;
  productConfig?: ProductInstallmentConfig;
  providers: FinancingProvider[];
  plans: InstallmentPlan[];
  initialProviderId?: string;
  settings?: StoreSettings;
}

export function InstallmentModal({
  isOpen,
  onClose,
  productName,
  productPrice,
  productConfig,
  providers,
  plans,
  initialProviderId,
  settings
}: InstallmentModalProps) {
  // Filter eligible providers
  const eligibleProviders = useMemo(() => {
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
  }, [providers, plans, productPrice, productConfig]);

  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // Sync initial provider when modal opens
  useEffect(() => {
    if (isOpen && eligibleProviders.length > 0) {
      if (
        initialProviderId &&
        eligibleProviders.some((p) => p.id === initialProviderId)
      ) {
        setSelectedProviderId(initialProviderId);
      } else if (
        !selectedProviderId ||
        !eligibleProviders.some((p) => p.id === selectedProviderId)
      ) {
        setSelectedProviderId(eligibleProviders[0].id);
      }
    }
  }, [isOpen, initialProviderId, eligibleProviders]);

  const currentProvider = useMemo(() => {
    return (
      eligibleProviders.find((p) => p.id === selectedProviderId) ||
      eligibleProviders[0] ||
      null
    );
  }, [eligibleProviders, selectedProviderId]);

  // Plans for current provider
  const eligiblePlans = useMemo(() => {
    if (!currentProvider) return [];
    return filterEligiblePlans(plans, currentProvider, productPrice, productConfig);
  }, [plans, currentProvider, productPrice, productConfig]);

  // Sync plan selection
  useEffect(() => {
    if (eligiblePlans.length > 0) {
      if (!selectedPlanId || !eligiblePlans.some((p) => p.id === selectedPlanId)) {
        setSelectedPlanId(eligiblePlans[0].id);
      }
    } else {
      setSelectedPlanId('');
    }
  }, [eligiblePlans, selectedPlanId]);

  const currentPlan = useMemo(() => {
    return eligiblePlans.find((p) => p.id === selectedPlanId) || eligiblePlans[0] || null;
  }, [eligiblePlans, selectedPlanId]);

  // Final calculation result
  const calculationResult: InstallmentCalculationResult | null = useMemo(() => {
    if (!currentPlan || !currentProvider || productPrice <= 0) return null;
    const override = productConfig?.planOverrides?.[currentPlan.id];
    return calculateManualInstallment(productPrice, currentPlan, currentProvider, override);
  }, [productPrice, currentPlan, currentProvider, productConfig]);

  // WhatsApp Inquiry action
  const handleStartWhatsAppInquiry = () => {
    if (!calculationResult) return;
    const whatsappNum = settings?.whatsappNumber?.replace(/[^\d+]/g, '') || '';
    const message = formatInstallmentWhatsAppMessage({
      productName,
      productPrice: calculationResult.productPrice,
      providerName: calculationResult.providerName,
      isDirectStore: calculationResult.isDirectStore,
      months: calculationResult.months,
      downPayment: calculationResult.downPayment,
      financedAmount: calculationResult.financedAmount,
      feeAmount: calculationResult.feeAmount,
      totalPayable: calculationResult.totalPayable,
      monthlyPayment: calculationResult.monthlyPayment
    });

    const targetUrl = whatsappNum
      ? `https://wa.me/${whatsappNum}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="installment-plans-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl glass-panel-elevated bg-[var(--surface-elevated)] border border-[var(--border)] shadow-2xl rounded-3xl overflow-hidden z-10 my-auto text-[var(--text-primary)]">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Modal Header */}
        <div className="relative border-b border-[var(--border)] p-5 sm:p-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--accent-bg)] border border-[#D4AF37]/35 flex items-center justify-center text-[#D4AF37] shadow-inner shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="installment-plans-modal-title"
                className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight"
              >
                خطط التقسيط
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate max-w-[280px] sm:max-w-md">
                {productName} •{' '}
                <span className="text-[#D4AF37] font-bold">
                  {productPrice.toLocaleString('ar-EG')} جنيه
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* 1. PROVIDERS SELECTOR BAR */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-[var(--text-secondary)] block">اختر جهة التقسيط:</span>
            <div className="flex items-center gap-3 flex-wrap">
              {eligibleProviders.map((prov) => (
                <InstallmentProviderLogo
                  key={prov.id}
                  provider={prov}
                  isSelected={prov.id === selectedProviderId}
                  onClick={() => setSelectedProviderId(prov.id)}
                />
              ))}
            </div>
          </div>

          {/* 2. ACTIVE PROVIDER BANNER */}
          {currentProvider && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ProviderLogo provider={currentProvider} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">{currentProvider.name}</h3>
                    {currentProvider.isDirectStore && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-500 text-[10px] font-bold flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        تقسيط مباشر من المحل
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {currentProvider.description ||
                      (currentProvider.isDirectStore
                        ? 'التقسيط المباشر يتم من خلال المحل، وتخضع الموافقة والشروط لإجراءات المحل.'
                        : 'اختر خطة السداد المناسبة لك')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. AVAILABLE PLANS LIST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">خطط التقسيط المتاحة</h4>
              <span className="text-xs text-[var(--text-secondary)] font-bold">
                {eligiblePlans.length} خطة سداد
              </span>
            </div>

            {eligiblePlans.length === 0 ? (
              <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--text-secondary)]">
                لا توجد خطط تقسيط متاحة لهذه الجهة بحدود سعر هذا المنتج.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {eligiblePlans.map((plan) => {
                  const isSelected = plan.id === selectedPlanId;
                  const cardCalc = calculateManualInstallment(
                    productPrice,
                    plan,
                    currentProvider,
                    productConfig?.planOverrides?.[plan.id]
                  );

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-4 rounded-2xl border text-right transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-[var(--accent-bg)] border-[#D4AF37] shadow-md ring-1 ring-[#D4AF37]/20'
                          : 'bg-[var(--surface)] border-[var(--border)] hover:border-[#D4AF37]/40 text-[var(--text-secondary)]'
                      }`}
                    >
                      {/* Duration */}
                      <div className="flex items-center justify-between w-full">
                        <span className="text-base font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[#D4AF37]" />
                          {plan.months} شهر
                        </span>

                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      {/* Monthly Payment (LARGEST NUMBER) */}
                      <div className="my-0.5">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                          القسط الشهري التقديري
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black text-[#D4AF37] tracking-tight">
                            {cardCalc.monthlyPayment.toLocaleString('ar-EG')}
                          </span>
                          <span className="text-xs font-bold text-[var(--text-secondary)]">جنيه / شهر</span>
                        </div>
                      </div>

                      {/* Breakdown Details */}
                      <div className="pt-2 border-t border-[var(--border)] space-y-1 text-xs text-[var(--text-secondary)]">
                        <div className="flex items-center justify-between">
                          <span>المقدم:</span>
                          <strong className={cardCalc.downPayment > 0 ? 'text-[var(--text-primary)] font-bold' : 'text-emerald-500 font-bold'}>
                            {cardCalc.downPayment > 0
                              ? `${cardCalc.downPayment.toLocaleString('ar-EG')} جنيه`
                              : 'بدون مقدم'}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>المبلغ المتبقي:</span>
                          <strong className="text-[var(--text-primary)] font-bold">
                            {cardCalc.financedAmount.toLocaleString('ar-EG')} جنيه
                          </strong>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>إجمالي التقسيط:</span>
                          <strong className="text-[var(--text-primary)] font-bold">
                            {cardCalc.totalPayable.toLocaleString('ar-EG')} جنيه
                          </strong>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. FINANCIAL SUMMARY SECTION */}
          {calculationResult && (
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">ملخص التقسيط</h4>

              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5 space-y-3 shadow-inner">
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">سعر المنتج:</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {calculationResult.productPrice.toLocaleString('ar-EG')} جنيه
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">المقدم:</span>
                    <span className="font-bold text-emerald-500">
                      {calculationResult.downPayment > 0
                        ? `${calculationResult.downPayment.toLocaleString('ar-EG')} جنيه`
                        : 'بدون مقدم'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">المبلغ المتبقي:</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {calculationResult.financedAmount.toLocaleString('ar-EG')} جنيه
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">الزيادة / الفائدة:</span>
                    <span className="font-bold text-amber-500">
                      {calculationResult.feeAmount > 0
                        ? `${calculationResult.feeAmount.toLocaleString('ar-EG')} جنيه`
                        : '0 جنيه (بدون زيادة)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between col-span-2 pt-2 border-t border-[var(--border)]">
                    <span className="text-[var(--text-primary)] font-bold">إجمالي التقسيط:</span>
                    <span className="font-bold text-[var(--text-primary)] text-sm sm:text-base">
                      {calculationResult.totalPayable.toLocaleString('ar-EG')} جنيه
                    </span>
                  </div>
                </div>

                {/* Monthly Payment Summary Highlight */}
                <div className="p-3.5 rounded-xl bg-[var(--accent-bg)] border border-[#D4AF37]/35 flex items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="text-[10px] font-bold text-[#D4AF37] block uppercase tracking-wider">
                      القسط الشهري التقديري ({calculationResult.months} شهر)
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-[#D4AF37] tracking-tight">
                        {calculationResult.monthlyPayment.toLocaleString('ar-EG')}
                      </span>
                      <span className="text-xs font-bold text-[var(--text-secondary)]">جنيه / شهرياً</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                القسط المعروض تقديري وتخضع الموافقة والشروط النهائية لإجراءات جهة التقسيط / المحل.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer: WhatsApp CTA */}
        <div className="border-t border-[var(--border)] p-4 sm:p-6 bg-[var(--surface-elevated)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface)] font-bold text-xs transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={!calculationResult}
            onClick={handleStartWhatsAppInquiry}
            className="flex-1 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:hover:scale-100"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>ابدأ طلب التقسيط</span>
          </button>
        </div>
      </div>
    </div>
  );
}
