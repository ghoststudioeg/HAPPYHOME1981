import React, { useEffect, useState, useMemo } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Calculator,
  Layers,
  Sparkles,
  X,
  Info,
  ArrowUpDown,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  InsurancePolicy,
  InsurancePolicyType,
  InsurancePricingMode,
  InsuranceScopeType,
  InsurancePriceRule
} from '../../types/insurance';
import { Category, Product } from '../../types';
import { insuranceService } from '../../lib/data/insuranceService';
import { categoryService } from '../../lib/data/categoryService';
import {
  calculateInsuranceForProduct,
  DEFAULT_INSURANCE_POLICIES,
  validatePriceRules
} from '../../lib/insurance/insuranceEngine';

export function AdminInsurancePage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Reset confirmation modal
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<InsurancePolicy>({
    id: '',
    name: '',
    provider: 'فوري',
    type: 'full_device',
    durationMonths: 12,
    coverageType: '',
    scopeType: 'all_eligible',
    categoryIds: [],
    productIds: [],
    excludedProductIds: [],
    eligibleCategoryKeywords: ['موبايل', 'هاتف', 'كهرب', 'منزل', 'أجهزة', 'شاشات'],
    pricingMode: 'tiered_rules',
    fixedPrice: 500,
    isFree: false,
    priceRules: [],
    shortDescription: '',
    coverageDescription: '',
    customerNotes: '',
    badgeText: 'حماية فوري المعتمدة',
    active: true,
    sortOrder: 1
  });

  // Test Calculator State
  const [testProductPrice, setTestProductPrice] = useState<number>(3500);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Load policies & categories
  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [fetchedPolicies, fetchedCategories] = await Promise.all([
        insuranceService.getPolicies(true),
        categoryService.getCategories(true)
      ]);
      setPolicies(fetchedPolicies);
      setCategories(fetchedCategories);
    } catch (err: any) {
      console.error('Error loading insurance policies:', err);
      const errMsg = 'تعذر تحميل وثائق التأمين من قاعدة البيانات';
      setFetchError(errMsg);
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  // Open editor for new policy
  const handleOpenCreateModal = () => {
    setEditingPolicy(null);
    setFormData({
      id: `fawry-policy-${Date.now()}`,
      name: '',
      provider: 'فوري',
      type: 'full_device',
      durationMonths: 12,
      coverageType: 'حماية شاملة للجهاز ضد الكسر والتلف',
      scopeType: 'all_eligible',
      categoryIds: [],
      productIds: [],
      excludedProductIds: [],
      eligibleCategoryKeywords: ['موبايل', 'هاتف', 'كهرب', 'منزل', 'أجهزة'],
      pricingMode: 'tiered_rules',
      fixedPrice: 500,
      isFree: false,
      priceRules: [
        { id: `rule-1-${Date.now()}`, minPrice: 1000, maxPrice: 3000, insurancePrice: 300, active: true, sortOrder: 1 },
        { id: `rule-2-${Date.now()}`, minPrice: 3000, maxPrice: 6000, insurancePrice: 500, active: true, sortOrder: 2 },
        { id: `rule-3-${Date.now()}`, minPrice: 6000, maxPrice: 15000, insurancePrice: 1000, active: true, sortOrder: 3 }
      ],
      shortDescription: '',
      coverageDescription: '',
      customerNotes: 'وثيقة رسمية معتمدة من فوري تسري لمدة الصلاحية المحددة.',
      badgeText: 'حماية فوري المعتمدة',
      active: true,
      sortOrder: (policies.length + 1)
    });
    setIsModalOpen(true);
  };

  // Open editor for existing policy
  const handleOpenEditModal = (policy: InsurancePolicy) => {
    setEditingPolicy(policy);
    setFormData({
      ...policy,
      priceRules: policy.priceRules ? [...policy.priceRules] : [],
      categoryIds: policy.categoryIds ? [...policy.categoryIds] : [],
      productIds: policy.productIds ? [...policy.productIds] : [],
      excludedProductIds: policy.excludedProductIds ? [...policy.excludedProductIds] : [],
      eligibleCategoryKeywords: policy.eligibleCategoryKeywords ? [...policy.eligibleCategoryKeywords] : []
    });
    setIsModalOpen(true);
  };

  // Duplicate policy
  const handleDuplicate = async (policy: InsurancePolicy) => {
    try {
      const duplicated: InsurancePolicy = {
        ...policy,
        id: `fawry-policy-${Date.now()}`,
        name: `${policy.name} (نسخة)`,
        sortOrder: (policy.sortOrder ?? 0) + 1,
        priceRules: (policy.priceRules || []).map(r => ({ ...r, id: `tier-${Date.now()}-${Math.random().toString(36).substring(2, 5)}` }))
      };
      await insuranceService.savePolicy(duplicated);
      showToast('success', 'تم استنساخ وثيقة التأمين بنجاح.');
      loadData();
    } catch (err: any) {
      showToast('error', 'تعذر استنساخ الوثيقة: ' + (err?.message || ''));
    }
  };

  // Toggle active status
  const handleToggleActive = async (policy: InsurancePolicy) => {
    try {
      const updatedStatus = !policy.active;
      await insuranceService.togglePolicyActive(policy.id, updatedStatus);
      setPolicies(prev => prev.map(p => (p.id === policy.id ? { ...p, active: updatedStatus } : p)));
      showToast('success', updatedStatus ? 'تم تفعيل الوثيقة بنجاح.' : 'تم تعطيل الوثيقة.');
    } catch (err) {
      showToast('error', 'تعذر تحديث حالة الوثيقة.');
    }
  };

  // Delete policy
  const handleDeletePolicy = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف وثيقة التأمين: "${name}"؟`)) {
      return;
    }
    try {
      await insuranceService.deletePolicy(id);
      showToast('success', 'تم حذف الوثيقة بنجاح.');
      loadData();
    } catch (err: any) {
      showToast('error', 'تعذر حذف الوثيقة: ' + (err?.message || ''));
    }
  };

  // Reset to default policies
  const handleResetToDefaults = async () => {
    setSaving(true);
    try {
      await insuranceService.resetToDefaults();
      showToast('success', 'تمت استعادة وثائق وشرائح التأمين الافتراضية بنجاح.');
      setResetConfirmOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', 'تعذر استعادة الإعدادات: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Clear server & client cache
  const handleClearCache = async () => {
    try {
      insuranceService.clearCache();
      showToast('success', 'تم تفريغ الكاش وتحديث البيانات بنجاح.');
      loadData();
    } catch (err) {
      showToast('error', 'تعذر تفريغ الكاش.');
    }
  };

  // Add tier to form
  const handleAddTier = () => {
    const rules = [...(formData.priceRules || [])];
    const lastRule = rules[rules.length - 1];
    const minPrice = lastRule ? lastRule.maxPrice : 1000;
    const maxPrice = minPrice + 2000;
    const insurancePrice = lastRule ? lastRule.insurancePrice + 100 : 250;

    const newRule: InsurancePriceRule = {
      id: `tier-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      minPrice,
      maxPrice,
      insurancePrice,
      active: true,
      sortOrder: rules.length + 1
    };

    setFormData({
      ...formData,
      priceRules: [...rules, newRule]
    });
  };

  // Update tier in form
  const handleUpdateTier = (index: number, updates: Partial<InsurancePriceRule>) => {
    const rules = [...(formData.priceRules || [])];
    rules[index] = { ...rules[index], ...updates };
    setFormData({ ...formData, priceRules: rules });
  };

  // Remove tier from form
  const handleRemoveTier = (index: number) => {
    const rules = [...(formData.priceRules || [])];
    rules.splice(index, 1);
    setFormData({ ...formData, priceRules: rules });
  };

  // Sort tiers by minPrice
  const handleSortTiers = () => {
    const rules = [...(formData.priceRules || [])].sort((a, b) => a.minPrice - b.minPrice);
    rules.forEach((r, idx) => {
      r.sortOrder = idx + 1;
    });
    setFormData({ ...formData, priceRules: rules });
  };

  // Save Policy Form
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('error', 'يرجى إدخال اسم الوثيقة.');
      return;
    }

    if (!formData.provider.trim()) {
      showToast('error', 'يرجى إدخال اسم مقدم الخدمة (مثال: فوري).');
      return;
    }

    // Validation for tiered rules
    if (formData.pricingMode === 'tiered_rules') {
      const validation = validatePriceRules(formData.priceRules);
      if (!validation.valid) {
        showToast('error', validation.errors[0]);
        return;
      }
    }

    setSaving(true);
    try {
      await insuranceService.savePolicy(formData);
      showToast('success', editingPolicy ? 'تم تحديث الوثيقة بنجاح.' : 'تم إنشاء الوثيقة بنجاح.');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Error saving policy:', err);
      showToast('error', 'تعذر حفظ الوثيقة: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Real-time calculation preview for test price
  const testCalculation = useMemo(() => {
    return calculateInsuranceForProduct(formData, testProductPrice);
  }, [formData, testProductPrice]);

  // Validation report for current form's tiers
  const tierValidation = useMemo(() => {
    if (formData.pricingMode !== 'tiered_rules') return null;
    return validatePriceRules(formData.priceRules);
  }, [formData.pricingMode, formData.priceRules]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <span className="text-sm font-bold">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-current hover:opacity-80 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-md">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                  <span>تأمين المنتجات مع فوري</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Fawry Insurance
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                  لوحة تحكم قابلة للتعديل بالكامل: أنشئ وعدّل أسعار وشرائح وثائق التأمين دون كتابة سطر كود
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleClearCache}
              className="p-3 rounded-2xl bg-[var(--surface-elevated)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="تحديث البيانات وتفريغ الكاش"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث الكاش</span>
            </button>

            <button
              onClick={() => setResetConfirmOpen(true)}
              className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-[#D4AF37] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="استعادة الإعدادات والشرائح الافتراضية"
            >
              <Sparkles className="w-4 h-4" />
              <span>استعادة الافتراضي</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة وثيقة تأمين</span>
            </button>
          </div>
        </div>
      </div>

      {/* Policies List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
            <span>وثائق التأمين النشطة والمتاحة</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)]">
              {policies.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-12 text-center text-[var(--text-secondary)] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm font-bold">جاري تحميل وثائق وشرائح التأمين...</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-3xl bg-rose-500/10 border border-rose-500/30 p-12 text-center space-y-4 shadow-xl">
            <AlertCircle className="w-12 h-12 mx-auto text-rose-400" />
            <div>
              <p className="text-base font-bold text-rose-400">{fetchError}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                يرجى التحقق من اتصالك بالإنترنت وصلاحيات حساب المسؤول.
              </p>
            </div>
            <button
              onClick={loadData}
              className="py-2.5 px-5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-300 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        ) : policies.length === 0 ? (
          <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-12 text-center text-[var(--text-secondary)] space-y-4">
            <Shield className="w-12 h-12 mx-auto text-emerald-500/40" />
            <div>
              <p className="text-base font-bold text-[var(--text-primary)]">لا توجد وثائق تأمين مضافة حالياً</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                اضغط على زر "إضافة وثيقة تأمين" أو "استعادة الافتراضي" لبدء تفعيل خدمة فوري.
              </p>
            </div>
            <button
              onClick={handleResetToDefaults}
              className="py-2.5 px-5 rounded-xl bg-emerald-500 text-black text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>استعادة الإعدادات الافتراضية الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {policies.map(policy => {
              const rulesCount = policy.priceRules ? policy.priceRules.filter(r => r.active !== false).length : 0;
              const pricingSummary = policy.isFree
                ? 'مشمول مجانًا'
                : policy.pricingMode === 'fixed_price'
                ? `سعر ثابت: ${(policy.fixedPrice || 0).toLocaleString('ar-EG')} ج.م`
                : `${rulesCount} شرائح أسعار متدرجة`;

              const typeBadge = policy.type === 'full_device'
                ? { label: 'تأمين شامل للجهاز', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
                : policy.type === 'screen'
                ? { label: 'تأمين شاشة', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' }
                : { label: 'مخصص', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };

              return (
                <div
                  key={policy.id}
                  className={`rounded-3xl border p-5 sm:p-6 transition-all relative overflow-hidden flex flex-col justify-between gap-5 ${
                    policy.active
                      ? 'bg-[var(--surface)] border-[var(--border)] hover:border-emerald-500/40 shadow-sm'
                      : 'bg-[var(--surface-elevated)]/50 border-[var(--border)] opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Provider & Status Toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${typeBadge.color}`}>
                          {typeBadge.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {policy.provider}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 font-bold">
                          <Clock className="w-3 h-3 text-[#D4AF37]" />
                          <span>{policy.durationMonths} شهراً</span>
                        </span>
                      </div>

                      {/* Toggle Active Button */}
                      <button
                        onClick={() => handleToggleActive(policy)}
                        className={`p-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                          policy.active
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}
                        title={policy.active ? 'تعطيل الوثيقة' : 'تفعيل الوثيقة'}
                      >
                        {policy.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{policy.active ? 'نشط' : 'معطل'}</span>
                      </button>
                    </div>

                    {/* Policy Name & Coverage */}
                    <div>
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {policy.name}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                        {policy.coverageType}
                      </p>
                    </div>

                    {/* Pricing Mode & Scope Pill */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)] text-xs">
                      <div className="bg-[var(--surface-elevated)] p-2.5 rounded-xl border border-[var(--border)]">
                        <span className="text-[10px] text-[var(--text-muted)] block">نظام التسعير:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5 block truncate">
                          {pricingSummary}
                        </span>
                      </div>

                      <div className="bg-[var(--surface-elevated)] p-2.5 rounded-xl border border-[var(--border)]">
                        <span className="text-[10px] text-[var(--text-muted)] block">نطاق التطبيق:</span>
                        <span className="font-bold text-[var(--text-primary)] mt-0.5 block truncate">
                          {policy.scopeType === 'all_eligible'
                            ? 'المنتجات المتوافقة'
                            : policy.scopeType === 'category'
                            ? `${policy.categoryIds?.length || 0} أقسام محددة`
                            : `${policy.productIds?.length || 0} منتجات محددة`}
                        </span>
                      </div>
                    </div>

                    {/* Customer Notes Preview */}
                    {policy.customerNotes && (
                      <p className="text-[11px] text-[var(--text-muted)] bg-[var(--surface-elevated)]/50 p-2.5 rounded-xl border border-[var(--border)] line-clamp-2">
                        {policy.customerNotes}
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDuplicate(policy)}
                        className="p-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border border-[var(--border)]"
                        title="استنساخ الوثيقة"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(policy.id, policy.name)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer border border-rose-500/20"
                        title="حذف الوثيقة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenEditModal(policy)}
                      className="py-2 px-4 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[#D4AF37] hover:border-[#D4AF37]/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل الشرائح والبيانات</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Create Policy Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col z-10"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-elevated)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                      {editingPolicy ? `تعديل: ${formData.name || 'وثيقة التأمين'}` : 'إنشاء وثيقة تأمين جديدة'}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      تحديد أسعار الشرائح ونطاق التطبيق والشروط المعروضة للعميل
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form Body */}
              <form onSubmit={handleSavePolicy} className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
                {/* 1. Basic Policy Info */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-4 h-4" />
                    <span>البيانات الأساسية ونوع الوثيقة</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">اسم الوثيقة المعروض للعميل *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="مثال: تأمين فوري الشامل للجهاز (12 شهر)"
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">الجهة المقدمة للتأمين *</label>
                      <input
                        type="text"
                        required
                        value={formData.provider}
                        onChange={e => setFormData({ ...formData, provider: e.target.value })}
                        placeholder="فوري"
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">نوع التغطية</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value as InsurancePolicyType })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                      >
                        <option value="full_device">تأمين شامل للجهاز (Full Device)</option>
                        <option value="screen">تأمين شاشة فقط (Screen)</option>
                        <option value="custom">وثيقة مخصصة أخرى</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">مدة الوثيقة (بالشهور)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={formData.durationMonths}
                        onChange={e => setFormData({ ...formData, durationMonths: parseInt(e.target.value) || 12 })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">نص البادج (الشارة)</label>
                      <input
                        type="text"
                        value={formData.badgeText || ''}
                        onChange={e => setFormData({ ...formData, badgeText: e.target.value })}
                        placeholder="حماية فوري المعتمدة"
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">وصف التغطية السريع</label>
                    <input
                      type="text"
                      value={formData.coverageType}
                      onChange={e => setFormData({ ...formData, coverageType: e.target.value })}
                      placeholder="مثال: حماية كاملة للجهاز ضد الحوادث والتلف والكسر"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* 2. Pricing Mode & Tiers Editor */}
                <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-4 h-4" />
                      <span>نظام التسعير وشرائح التكلفة (ديناميكي)</span>
                    </h4>

                    {/* Free Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={formData.isFree}
                        onChange={e => setFormData({ ...formData, isFree: e.target.checked })}
                        className="rounded border-[var(--border)] text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>تأمين مجاني مشمول مع المنتج (0 ج.م)</span>
                    </label>
                  </div>

                  {!formData.isFree && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, pricingMode: 'tiered_rules' })}
                          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                            formData.pricingMode === 'tiered_rules'
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-black shadow-sm'
                              : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <span className="text-xs block font-bold">شرائح أسعار متدرجة</span>
                          <span className="text-[10px] opacity-80 mt-0.5 block">
                            تحديد سعر التأمين حسب شريحة سعر المنتج (1000-2000 ← 200 ج.م، إلخ)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, pricingMode: 'fixed_price' })}
                          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                            formData.pricingMode === 'fixed_price'
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-black shadow-sm'
                              : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <span className="text-xs block font-bold">سعر ثابت موحد</span>
                          <span className="text-[10px] opacity-80 mt-0.5 block">
                            سعر وثيقة موحد لكافة المنتجات المؤهلة (مثال تأمين الشاشة: 500 ج.م)
                          </span>
                        </button>
                      </div>

                      {/* Fixed Price Field */}
                      {formData.pricingMode === 'fixed_price' && (
                        <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2">
                          <label className="text-xs font-bold text-[var(--text-secondary)]">
                            سعر وثيقة التأمين الموحدة (بالجنيه المصري) *
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="0"
                              value={formData.fixedPrice ?? 500}
                              onChange={e => setFormData({ ...formData, fixedPrice: parseFloat(e.target.value) || 0 })}
                              className="w-48 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-xs text-[var(--text-secondary)] font-bold">ج.م</span>
                          </div>
                        </div>
                      )}

                      {/* Tiered Rules Editor */}
                      {formData.pricingMode === 'tiered_rules' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--text-secondary)]">
                              جدول الشرائح السعرية:
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSortTiers}
                                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                              >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                                <span>ترتيب تصاعدي</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleAddTier}
                                className="py-1.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center gap-1 cursor-pointer hover:bg-emerald-500/25 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة شريحة</span>
                              </button>
                            </div>
                          </div>

                          {/* Validation warnings / errors */}
                          {tierValidation && (!tierValidation.valid || tierValidation.warnings.length > 0) && (
                            <div className="space-y-1">
                              {tierValidation.errors.map((err, i) => (
                                <p key={i} className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{err}</span>
                                </p>
                              ))}
                              {tierValidation.warnings.map((warn, i) => (
                                <p key={i} className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl flex items-center gap-1.5">
                                  <Info className="w-3.5 h-3.5 shrink-0" />
                                  <span>{warn}</span>
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Tiers Table */}
                          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-[var(--surface)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                                <tr>
                                  <th className="p-3">#</th>
                                  <th className="p-3">من سعر (ج.م)</th>
                                  <th className="p-3">إلى سعر (ج.م)</th>
                                  <th className="p-3">سعر وثيقة التأمين</th>
                                  <th className="p-3 text-center">الحالة</th>
                                  <th className="p-3 text-center">حذف</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {(formData.priceRules || []).map((rule, idx) => (
                                  <tr key={rule.id || idx} className="hover:bg-[var(--surface)]/50 transition-colors">
                                    <td className="p-3 font-mono text-[var(--text-muted)]">{idx + 1}</td>
                                    <td className="p-3">
                                      <input
                                        type="number"
                                        min="0"
                                        value={rule.minPrice}
                                        onChange={e => handleUpdateTier(idx, { minPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-24 sm:w-28 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="number"
                                        min="0"
                                        value={rule.maxPrice}
                                        onChange={e => handleUpdateTier(idx, { maxPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-24 sm:w-28 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          min="0"
                                          value={rule.insurancePrice}
                                          onChange={e => handleUpdateTier(idx, { insurancePrice: parseFloat(e.target.value) || 0 })}
                                          className="w-24 sm:w-28 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-emerald-500/40 text-xs font-black text-emerald-400"
                                        />
                                        <span className="text-[10px] text-[var(--text-muted)]">ج.م</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTier(idx, { active: rule.active === false ? true : false })}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                          rule.active !== false
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                        }`}
                                      >
                                        {rule.active !== false ? 'مفعل' : 'معطل'}
                                      </button>
                                    </td>
                                    <td className="p-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTier(idx)}
                                        className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                        title="حذف الشريحة"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real-time Interactive Test Calculator */}
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/5 to-transparent border border-emerald-500/25 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-emerald-500" />
                        <span>اختبار حاسبة التأمين مباشرة:</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">سعر المنتج:</span>
                        <input
                          type="number"
                          value={testProductPrice}
                          onChange={e => setTestProductPrice(parseFloat(e.target.value) || 0)}
                          className="w-28 px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-black text-[#D4AF37]"
                        />
                        <span className="text-[10px] text-[var(--text-muted)]">ج.م</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs">
                      {testCalculation.available ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-500 font-bold">✓ مؤهل للتأمين</span>
                            {testCalculation.matchedRule && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                (الشريحة: {testCalculation.matchedRule.minPrice} إلى {testCalculation.matchedRule.maxPrice} ج.م)
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-black text-emerald-500">
                            قيمة الوثيقة: {testCalculation.isFree ? 'مجانًا' : `${testCalculation.price.toLocaleString('ar-EG')} ج.م`}
                          </div>
                        </>
                      ) : (
                        <span className="text-rose-400 font-bold">
                          ✕ غير متاح لهذا السعر ({testCalculation.reason || 'خارج النطاق'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Scope & Category Assignment */}
                <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                  <h4 className="text-xs font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>نطاق التطبيق والاستثناءات</span>
                  </h4>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">تطبيق الوثيقة على:</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, scopeType: 'all_eligible' })}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                          formData.scopeType === 'all_eligible'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-black'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="text-xs block">جميع المنتجات المتوافقة</span>
                        <span className="text-[10px] opacity-75 mt-0.5 block">الهواتف والأجهزة حسب نوع الوثيقة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, scopeType: 'category' })}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                          formData.scopeType === 'category'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-black'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="text-xs block">أقسام محددة فقط</span>
                        <span className="text-[10px] opacity-75 mt-0.5 block">اختيار أقسام معينة من المتجر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, scopeType: 'product' })}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                          formData.scopeType === 'product'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-black'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="text-xs block">منتجات محددة فقط</span>
                        <span className="text-[10px] opacity-75 mt-0.5 block">تخصيص لمنتجات معينة بالـ ID</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Multi-selector if scopeType === 'category' */}
                  {formData.scopeType === 'category' && (
                    <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">اختر الأقسام المؤهلة:</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {categories.map(cat => {
                          const isChecked = (formData.categoryIds || []).includes(cat.id);
                          return (
                            <label
                              key={cat.id}
                              className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors text-xs font-bold ${
                                isChecked
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  const current = formData.categoryIds || [];
                                  const updated = e.target.checked
                                    ? [...current, cat.id]
                                    : current.filter(id => id !== cat.id);
                                  setFormData({ ...formData, categoryIds: updated });
                                }}
                                className="rounded border-[var(--border)] text-emerald-500 focus:ring-emerald-500"
                              />
                              <span className="truncate">{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Customer Notes & Conditions */}
                <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                  <h4 className="text-xs font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    <span>شروط وثيقة التأمين وملاحظات العميل</span>
                  </h4>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">
                      ملاحظات العميل والشروط المعروضة في تفاصيل الوثيقة
                    </label>
                    <textarea
                      rows={3}
                      value={formData.customerNotes || ''}
                      onChange={e => setFormData({ ...formData, customerNotes: e.target.value })}
                      placeholder="وثيقة رسمية معتمدة من شركة فوري لمدة 12 شهراً، تغطي الصيانة في مراكز الخدمة المعتمدة وفقاً للشروط."
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">تفاصيل التغطية الكاملة</label>
                    <textarea
                      rows={2}
                      value={formData.coverageDescription || ''}
                      onChange={e => setFormData({ ...formData, coverageDescription: e.target.value })}
                      placeholder="تغطية حوادث الكسر العرضي، التلف الكهربائي الناتج عن التذبذب، والسوائل..."
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 px-5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-elevated)] text-xs font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black text-xs font-black shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-98 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editingPolicy ? 'حفظ التعديلات' : 'إنشاء الوثيقة'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset to Defaults Confirmation Modal */}
      <AnimatePresence>
        {resetConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetConfirmOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 space-y-4 shadow-2xl z-10"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#D4AF37] mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-[var(--text-primary)]">
                  استعادة الإعدادات الافتراضية؟
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  سيتم استعادة وثائق التأمين الأساسية (تأمين فوري الشامل 12 شهراً بشرائح 200 - 1500 ج.م، وتأمين الشاشة 6 شهور بـ 500 ج.م).
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(false)}
                  className="py-2.5 px-4 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-elevated)] text-xs font-bold text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleResetToDefaults}
                  className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md cursor-pointer transition-colors disabled:opacity-50"
                >
                  {saving ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
