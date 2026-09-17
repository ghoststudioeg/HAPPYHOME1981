import React, { useMemo } from 'react';
import { Shield, ChevronLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { Category, Product } from '../../types';
import { InsurancePolicy } from '../../types/insurance';
import { getApplicablePoliciesForProduct } from '../../lib/insurance/insuranceEngine';

interface InsuranceProductBadgeProps {
  product: Product;
  productPrice: number;
  category?: Category | null;
  policies: InsurancePolicy[];
  onOpenModal: (selectedPolicyId?: string) => void;
}

export function InsuranceProductBadge({
  product,
  productPrice,
  category,
  policies,
  onOpenModal
}: InsuranceProductBadgeProps) {
  const applicablePolicies = useMemo(() => {
    if (!product || productPrice <= 0 || !policies || policies.length === 0) {
      return [];
    }
    return getApplicablePoliciesForProduct(policies, product, productPrice, category);
  }, [product, productPrice, category, policies]);

  if (applicablePolicies.length === 0) {
    return null;
  }

  // Calculate lowest available insurance price
  const lowestPrice = Math.min(...applicablePolicies.map(item => item.calculation.price));
  const hasFreeOption = applicablePolicies.some(item => item.calculation.isFree || item.calculation.price === 0);

  return (
    <div
      onClick={() => onOpenModal()}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/5 to-transparent border border-emerald-500/25 hover:border-emerald-500/40 p-3 sm:p-3.5 text-[var(--text-primary)] transition-all my-2.5 shadow-sm hover:shadow-md cursor-pointer group"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Icon & Titles */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-105 transition-transform">
            <Shield className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-[var(--text-primary)]">
                تأمين فوري متاح
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                {applicablePolicies.length > 1 ? `${applicablePolicies.length} باقات حماية` : applicablePolicies[0].policy.name}
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
              {hasFreeOption ? (
                <span className="text-emerald-500 font-bold">مشمول مجانًا مع الجهاز</span>
              ) : (
                <span>
                  يبدأ من <strong className="text-[#D4AF37] font-black">{lowestPrice.toLocaleString('ar-EG')} ج.م</strong> معتمدة من شركة فوري
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Side: Action Link */}
        <div className="flex items-center gap-1 text-xs font-black text-emerald-500 group-hover:text-emerald-400 shrink-0">
          <span className="hidden sm:inline">عرض التفاصيل</span>
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        </div>
      </div>
    </div>
  );
}
