import React, { useState, useMemo } from 'react';
import {
  X,
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Product, StoreSettings } from '../../types';
import { InsurancePolicy } from '../../types/insurance';
import { getApplicablePoliciesForProduct } from '../../lib/insurance/insuranceEngine';

interface InsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  productPrice: number;
  category?: Category | null;
  policies: InsurancePolicy[];
  initialSelectedPolicyId?: string;
  onSelectPolicy?: (policy: InsurancePolicy | null) => void;
  settings?: StoreSettings | null;
}

export function InsuranceModal({
  isOpen,
  onClose,
  product,
  productPrice,
  category,
  policies,
  initialSelectedPolicyId,
  onSelectPolicy,
  settings
}: InsuranceModalProps) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(
    initialSelectedPolicyId || null
  );
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);

  const applicablePolicies = useMemo(() => {
    if (!product || productPrice <= 0 || !policies || policies.length === 0) {
      return [];
    }
    return getApplicablePoliciesForProduct(policies, product, productPrice, category);
  }, [product, productPrice, category, policies]);

  // If initial policy passed was not in list, auto-select first
  React.useEffect(() => {
    if (applicablePolicies.length > 0 && !selectedPolicyId) {
      setSelectedPolicyId(applicablePolicies[0].policy.id);
    }
  }, [applicablePolicies, selectedPolicyId]);

  if (!isOpen) return null;

  const handleInquireWhatsApp = (policy: InsurancePolicy, priceText: string) => {
    const cleanNumber = settings?.whatsappNumber?.replace(/[+\s-]/g, '') || '201019811981';
    const message = `مرحباً، أستفسر عن تأمين فوري:\n\nالمنتج: *${product.name}*\nسعر المنتج: *${productPrice.toLocaleString('ar-EG')} ج.م*\nالوثيقة: *${policy.name}*\nالمدة: *${policy.durationMonths} شهراً*\nالتغطية: *${policy.coverageType}*\nقيمة الوثيقة: *${priceText}*\n\nيرجى تزويدي بمزيد من التفاصيل وكيفية التفعيل.`;
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleApplySelection = () => {
    if (!onSelectPolicy) {
      onClose();
      return;
    }
    const found = applicablePolicies.find(item => item.policy.id === selectedPolicyId);
    onSelectPolicy(found ? found.policy : null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-elevated)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                  حماية وتأمين الأجهزة — فوري
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  وثائق حماية معتمدة رسمياً ومقدمة عبر شبكة فوري
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product Quick Recap */}
          <div className="px-4 sm:px-6 py-3 bg-[var(--surface-elevated)]/50 border-b border-[var(--border)] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[var(--text-secondary)]">المنتج:</span>
              <span className="font-bold text-[var(--text-primary)] truncate max-w-xs">{product.name}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[var(--text-secondary)]">السعر:</span>
              <span className="font-black text-[#D4AF37]">{productPrice.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>

          {/* Body List of Policies */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {applicablePolicies.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)] space-y-2">
                <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
                <p className="text-sm font-bold text-[var(--text-primary)]">لا توجد باقات تأمين متاحة لهذا المنتج حالياً</p>
                <p className="text-xs">تواصل مع خدمة العملاء للاستفسار عن إمكانية إضافة وثيقة حماية خاصة.</p>
              </div>
            ) : (
              applicablePolicies.map(({ policy, calculation }) => {
                const isSelected = selectedPolicyId === policy.id;
                const isNotesExpanded = expandedNotesId === policy.id;
                const priceFormatted = calculation.isFree || calculation.price === 0
                  ? 'مجانًا'
                  : `${calculation.price.toLocaleString('ar-EG')} ج.م`;

                return (
                  <div
                    key={policy.id}
                    onClick={() => setSelectedPolicyId(policy.id)}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/10'
                        : 'bg-[var(--surface)] border-[var(--border)] hover:border-emerald-500/40'
                    }`}
                  >
                    {/* Active Selection Indicator */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-black'
                              : 'border-[var(--border)] bg-[var(--surface-elevated)]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base font-black text-[var(--text-primary)]">
                              {policy.name}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              مقدم الخدمة: {policy.provider}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-[#D4AF37] border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{policy.durationMonths} شهر</span>
                            </span>
                          </div>

                          <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                            {policy.coverageType}
                          </p>

                          {policy.shortDescription && (
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                              {policy.shortDescription}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Pricing Tag */}
                      <div className="text-left shrink-0">
                        <div className="text-base sm:text-lg font-black text-emerald-500">
                          {priceFormatted}
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {calculation.isFree ? 'مشمول بالعرض' : 'شامل الضريبة'}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Customer Notes & Conditions */}
                    {(policy.coverageDescription || policy.customerNotes) && (
                      <div className="mt-3 pt-3 border-t border-[var(--border)]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedNotesId(isNotesExpanded ? null : policy.id);
                          }}
                          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold transition-colors cursor-pointer"
                        >
                          <Info className="w-3.5 h-3.5 text-emerald-500" />
                          <span>شروط وضوابط التغطية</span>
                          {isNotesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isNotesExpanded && (
                          <div className="mt-2 text-[11px] text-[var(--text-secondary)] bg-[var(--surface-elevated)] p-3 rounded-xl space-y-1.5 leading-relaxed border border-[var(--border)]">
                            {policy.coverageDescription && (
                              <p><strong className="text-[var(--text-primary)]">تفاصيل التغطية:</strong> {policy.coverageDescription}</p>
                            )}
                            {policy.customerNotes && (
                              <p><strong className="text-[var(--text-primary)]">ملاحظات العميل:</strong> {policy.customerNotes}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-6 border-t border-[var(--border)] bg-[var(--surface-elevated)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 w-full sm:w-auto">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>يتم تسجيل وثيقة التأمين رسمياً برقم تسلسلي معتمد</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {onSelectPolicy && (
                <button
                  onClick={() => {
                    onSelectPolicy(null);
                    onClose();
                  }}
                  className="py-2.5 px-4 rounded-xl border border-[var(--border)] hover:bg-[var(--surface)] text-xs font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  بدون تأمين
                </button>
              )}

              {applicablePolicies.length > 0 && selectedPolicyId && (
                <button
                  onClick={() => {
                    const found = applicablePolicies.find(item => item.policy.id === selectedPolicyId);
                    if (found) {
                      handleInquireWhatsApp(
                        found.policy,
                        found.calculation.isFree ? 'مجانًا' : `${found.calculation.price} ج.م`
                      );
                    }
                  }}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md hover:shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>استفسار واتساب</span>
                </button>
              )}

              {onSelectPolicy && (
                <button
                  onClick={handleApplySelection}
                  className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-black text-xs font-black shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  تأكيد الاختيار
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
