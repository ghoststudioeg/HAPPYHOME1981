import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  CreditCard,
  Building2,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Percent,
  Coins,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Upload,
  ArrowUp,
  ArrowDown,
  X,
  Copy,
  Calculator,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FinancingProvider,
  InstallmentPlan,
  InstallmentCalculationType,
  DownPaymentType,
  FeeCalculationBase,
  IntegrationMode
} from '../../types/installment';
import { installmentService } from '../../lib/data/installmentService';
import { storageService } from '../../lib/data/storageService';
import { calculateManualInstallment } from '../../lib/installments/calculationEngine';
import { ProviderLogo } from '../../components/installments/ProviderLogo';
import { InstallmentProviderLogo } from '../../components/installments/InstallmentProviderLogo';

export function AdminInstallmentsPage() {
  const [activeTab, setActiveTab] = useState<'providers' | 'plans'>('providers');
  const [loading, setLoading] = useState<boolean>(true);
  const [providers, setProviders] = useState<FinancingProvider[]>([]);
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selected filter for plans tab
  const [filterProviderId, setFilterProviderId] = useState<string>('all');

  // Provider Modal state
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<FinancingProvider | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [providerFormData, setProviderFormData] = useState({
    id: '',
    name: '',
    slug: '',
    logoUrl: '',
    enabled: true,
    integrationMode: 'manual' as IntegrationMode,
    description: '',
    displayOrder: 1,
    isDirectStore: false,
    directStoreDisclaimer: ''
  });

  // Plan Modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InstallmentPlan | null>(null);

  // Test price for live preview inside plan editor
  const [testProductPrice, setTestProductPrice] = useState<number>(10000);

  const [planFormData, setPlanFormData] = useState({
    id: '',
    providerId: '',
    months: 12,
    calculationType: 'no_extra_cost' as InstallmentCalculationType,
    percentage: 0,
    fixedFee: 0,
    feeCalculationBase: 'remaining_amount' as FeeCalculationBase,
    downPaymentType: 'none' as DownPaymentType,
    downPaymentValue: 0,
    minProductPrice: '' as string | number,
    maxProductPrice: '' as string | number,
    enabled: true,
    displayOrder: 1,
    disclaimer: ''
  });

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [provs, pls] = await Promise.all([
        installmentService.getProviders(),
        installmentService.getPlans()
      ]);
      setProviders(provs.sort((a, b) => a.displayOrder - b.displayOrder));
      setPlans(pls.sort((a, b) => a.displayOrder - b.displayOrder));
    } catch (err) {
      console.error('Error loading installment data:', err);
      setFeedback({ type: 'error', message: 'تعذر تحميل بيانات التقسيط من قاعدة البيانات.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ----------------------------------------------------
  // Provider Handlers & Logo Management
  // ----------------------------------------------------
  const handleOpenAddProvider = () => {
    setEditingProvider(null);
    setProviderFormData({
      id: `provider-${Date.now()}`,
      name: '',
      slug: '',
      logoUrl: '',
      enabled: true,
      integrationMode: 'manual',
      description: '',
      displayOrder: providers.length + 1,
      isDirectStore: false,
      directStoreDisclaimer: ''
    });
    setProviderModalOpen(true);
  };

  const handleOpenEditProvider = (prov: FinancingProvider) => {
    setEditingProvider(prov);
    setProviderFormData({
      id: prov.id,
      name: prov.name,
      slug: prov.slug,
      logoUrl: prov.logoUrl || '',
      enabled: prov.enabled,
      integrationMode: prov.integrationMode || 'manual',
      description: prov.description || '',
      displayOrder: prov.displayOrder || 1,
      isDirectStore: Boolean(prov.isDirectStore),
      directStoreDisclaimer: prov.directStoreDisclaimer || ''
    });
    setProviderModalOpen(true);
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const targetId = providerFormData.id || `provider-${Date.now()}`;
      const uploadedUrl = await storageService.uploadProviderLogo(targetId, file);
      setProviderFormData((prev) => ({ ...prev, logoUrl: uploadedUrl }));
      showFeedback('success', 'تم رفع شعار جهة التقسيط بنجاح.');
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      showFeedback('error', err?.message || 'فشل رفع الشعار.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setProviderFormData((prev) => ({ ...prev, logoUrl: '' }));
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerFormData.name.trim()) {
      showFeedback('error', 'يرجى إدخال اسم جهة التقسيط.');
      return;
    }

    try {
      const generatedSlug =
        providerFormData.slug.trim() ||
        providerFormData.id.toLowerCase().replace(/[^\w-]/g, '-');
      await installmentService.saveProvider({
        ...providerFormData,
        slug: generatedSlug,
        displayOrder: Number(providerFormData.displayOrder) || 1
      });
      setProviderModalOpen(false);
      showFeedback('success', 'تم حفظ بيانات جهة التقسيط والشعار بنجاح.');
      await loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'حدث خطأ أثناء حفظ جهة التقسيط.');
    }
  };

  const handleToggleProvider = async (prov: FinancingProvider) => {
    try {
      await installmentService.saveProvider({
        ...prov,
        enabled: !prov.enabled
      });
      showFeedback('success', `تم ${!prov.enabled ? 'تفعيل' : 'تعطيل'} ${prov.name}.`);
      await loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'فشل تغيير حالة جهة التقسيط.');
    }
  };

  const handleReorderProvider = async (prov: FinancingProvider, direction: 'up' | 'down') => {
    const currentIndex = providers.findIndex((p) => p.id === prov.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= providers.length) return;

    const targetProv = providers[targetIndex];
    const newCurrentOrder = targetProv.displayOrder;
    const newTargetOrder = prov.displayOrder;

    try {
      await Promise.all([
        installmentService.saveProvider({ ...prov, displayOrder: newCurrentOrder }),
        installmentService.saveProvider({ ...targetProv, displayOrder: newTargetOrder })
      ]);
      await loadData();
      showFeedback('success', 'تم تحديث ترتيب جهات التقسيط.');
    } catch (err) {
      console.error(err);
      showFeedback('error', 'فشل تحديث الترتيب.');
    }
  };

  const handleDeleteProvider = async (prov: FinancingProvider) => {
    if (!window.confirm(`هل أنت متأكد من حذف جهة التقسيط "${prov.name}" وجميع خططها؟`)) {
      return;
    }
    try {
      await installmentService.deleteProvider(prov.id);
      showFeedback('success', `تم حذف ${prov.name}.`);
      await loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'فشل حذف جهة التقسيط.');
    }
  };

  // ----------------------------------------------------
  // Plan Handlers
  // ----------------------------------------------------
  const handleOpenAddPlan = () => {
    setEditingPlan(null);
    const defaultProv = providers[0]?.id || '';
    setPlanFormData({
      id: `plan-${Date.now()}`,
      providerId: filterProviderId !== 'all' ? filterProviderId : defaultProv,
      months: 12,
      calculationType: 'no_extra_cost',
      percentage: 0,
      fixedFee: 0,
      feeCalculationBase: 'remaining_amount',
      downPaymentType: 'none',
      downPaymentValue: 0,
      minProductPrice: '',
      maxProductPrice: '',
      enabled: true,
      displayOrder: plans.length + 1,
      disclaimer: ''
    });
    setPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan: InstallmentPlan) => {
    setEditingPlan(plan);
    setPlanFormData({
      id: plan.id,
      providerId: plan.providerId,
      months: plan.months,
      calculationType: plan.calculationType,
      percentage: plan.percentage,
      fixedFee: plan.fixedFee,
      feeCalculationBase: plan.feeCalculationBase || 'remaining_amount',
      downPaymentType: (plan.downPaymentType === 'fixed_amount' ? 'fixed' : plan.downPaymentType) as DownPaymentType,
      downPaymentValue: plan.downPaymentValue,
      minProductPrice: plan.minProductPrice !== undefined ? plan.minProductPrice : '',
      maxProductPrice: plan.maxProductPrice !== undefined ? plan.maxProductPrice : '',
      enabled: plan.enabled,
      displayOrder: plan.displayOrder,
      disclaimer: plan.disclaimer || ''
    });
    setPlanModalOpen(true);
  };

  const handleDuplicatePlan = async (plan: InstallmentPlan) => {
    try {
      const duplicated: InstallmentPlan = {
        ...plan,
        id: `plan-${Date.now()}`,
        months: plan.months + 6,
        displayOrder: plans.length + 1
      };
      await installmentService.savePlan(duplicated);
      showFeedback('success', `تم نسخ الخطة وإضافة مدة ${duplicated.months} شهر جديدة.`);
      await loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'فشل نسخ الخطة.');
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planFormData.providerId) {
      showFeedback('error', 'يرجى اختيار جهة التقسيط التابعة للخطة.');
      return;
    }
    if (planFormData.months <= 0) {
      showFeedback('error', 'يجب أن تكون مدة التقسيط شهراً واحداً على الأقل.');
      return;
    }

    try {
      const minP =
        planFormData.minProductPrice !== '' ? Number(planFormData.minProductPrice) : undefined;
      const maxP =
        planFormData.maxProductPrice !== '' ? Number(planFormData.maxProductPrice) : undefined;

      if (minP !== undefined && maxP !== undefined && minP > maxP) {
        showFeedback('error', 'الحد الأدنى للسعر لا يمكن أن يكون أكبر من الحد الأقصى.');
        return;
      }

      await installmentService.savePlan({
        ...planFormData,
        months: Number(planFormData.months),
        percentage: Number(planFormData.percentage) || 0,
        fixedFee: Number(planFormData.fixedFee) || 0,
        feeCalculationBase: planFormData.feeCalculationBase,
        downPaymentValue: Number(planFormData.downPaymentValue) || 0,
        minProductPrice: minP,
        maxProductPrice: maxP,
        displayOrder: Number(planFormData.displayOrder) || 1
      });

      setPlanModalOpen(false);
      showFeedback('success', 'تم حفظ خطة التقسيط بنجاح.');
      await loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'حدث خطأ أثناء حفظ خطة التقسيط.');
    }
  };

  const handleTogglePlan = async (plan: InstallmentPlan) => {
    try {
      await installmentService.savePlan({
        ...plan,
        enabled: !plan.enabled
      });
      showFeedback('success', `تم ${!plan.enabled ? 'تفعيل' : 'تعطيل'} خطة ${plan.months} شهر.`);
      await loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'فشل تغيير حالة الخطة.');
    }
  };

  const handleDeletePlan = async (plan: InstallmentPlan) => {
    if (!window.confirm(`هل أنت متأكد من حذف هذه الخطة (${plan.months} شهر)؟`)) {
      return;
    }
    try {
      await installmentService.deletePlan(plan.id);
      showFeedback('success', 'تم حذف خطة التقسيط.');
      await loadData();
    } catch (err) {
      console.error(err);
      showFeedback('error', 'فشل حذف الخطة.');
    }
  };

  const filteredPlans = useMemo(() => {
    if (filterProviderId === 'all') return plans;
    return plans.filter((p) => p.providerId === filterProviderId);
  }, [plans, filterProviderId]);

  // LIVE CALCULATOR PREVIEW CALCULATION FOR ADMIN FORM
  const livePreviewResult = useMemo(() => {
    const dummyPlan: InstallmentPlan = {
      id: planFormData.id || 'preview-plan',
      providerId: planFormData.providerId || 'preview-provider',
      months: Math.max(1, Number(planFormData.months) || 1),
      calculationType: planFormData.calculationType,
      percentage: Number(planFormData.percentage) || 0,
      fixedFee: Number(planFormData.fixedFee) || 0,
      feeCalculationBase: planFormData.feeCalculationBase,
      downPaymentType: planFormData.downPaymentType,
      downPaymentValue: Number(planFormData.downPaymentValue) || 0,
      enabled: true,
      displayOrder: 1
    };

    const targetProv = providers.find((p) => p.id === planFormData.providerId);
    return calculateManualInstallment(testProductPrice, dummyPlan, targetProv);
  }, [planFormData, testProductPrice, providers]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-['Cairo'] pb-20" dir="rtl">
      {/* 1. Header Section */}
      <div className="relative pt-8 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-bg)] border border-[var(--accent)]/30 flex items-center justify-center shadow-lg shadow-[var(--accent)]/10">
                <CreditCard className="w-6 h-6 text-[var(--accent)]" />
              </div>
              <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">إدارة أنظمة التقسيط</h1>
            </div>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl font-medium">
              قم بتكوين وإدارة شركات التقسيط، البنوك، وخطط الدفع المتاحة لعملائك في المتجر.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="p-3 rounded-2xl bg-[var(--surface-elevated)]/50 hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shadow-sm"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--accent)]' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            {activeTab === 'providers' ? (
              <button
                onClick={handleOpenAddProvider}
                className="px-6 py-3 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة جهة تقسيط</span>
              </button>
            ) : (
              <button
                onClick={handleOpenAddPlan}
                className="px-6 py-3 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة خطة تقسيط</span>
              </button>
            )}
          </div>
        </div>

        {/* Operating Mode Banner */}
        <div className="mt-8 p-5 rounded-3xl bg-[var(--surface-elevated)]/30 backdrop-blur-md border border-[var(--border)] flex items-start gap-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <strong className="font-bold text-[var(--text-primary)] block mb-1">
              التحكم الكامل بقواعد التقسيط
            </strong>
            يمكنك تحديد قيمة أو نسبة المقدم، نسبة الزيادة، الرسوم الإدارية، وطريقة التطبيق (على المبلغ المتبقي بعد المقدم أو على سعر المنتج بالكامل) مع معاينة حية فورية للحسبة قبل الاعتماد.
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-2 mt-12 p-1.5 bg-[var(--surface-elevated)]/50 backdrop-blur-xl border border-[var(--border)] rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'providers'
                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>جهات التقسيط</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              activeTab === 'providers' ? 'bg-white/20' : 'bg-[var(--surface-elevated)]'
            }`}>
              {providers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>خطط التقسيط</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              activeTab === 'plans' ? 'bg-white/20' : 'bg-[var(--surface-elevated)]'
            }`}>
              {plans.length}
            </span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-sm font-bold flex items-center gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
            <span className="text-sm font-bold">جاري تحميل بيانات التقسيط...</span>
          </div>
        ) : (
          <>
            {/* TAB A: PROVIDERS MANAGEMENT */}
            {activeTab === 'providers' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map((prov, index) => {
                  const provPlansCount = plans.filter((p) => p.providerId === prov.id).length;
                  return (
                    <div
                      key={prov.id}
                      className={`group bg-[var(--surface)] border rounded-3xl transition-all flex flex-col overflow-hidden relative h-full ${
                        prov.enabled
                          ? 'border-[var(--border)] hover:border-[var(--accent)]/40 hover:shadow-2xl hover:shadow-[var(--accent)]/5'
                          : 'border-[var(--border)] opacity-60 grayscale'
                      }`}
                    >
                      {/* Provider Header/Banner */}
                      <div className="h-24 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] relative overflow-hidden">
                        <div className="absolute top-4 right-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm border ${
                            prov.enabled 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}>
                            {prov.enabled ? 'نشط' : 'متوقف'}
                          </span>
                        </div>
                        
                        <div className="absolute -bottom-6 left-6">
                          <div className="w-20 h-20 rounded-2xl bg-white p-1.5 shadow-xl border border-[var(--border)] group-hover:scale-105 transition-transform">
                            <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center bg-zinc-50">
                              <ProviderLogo provider={prov} size="md" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-16 p-6 space-y-4 flex-grow flex flex-col">
                        <div className="flex-grow space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${prov.isDirectStore ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                {prov.isDirectStore ? 'تقسيط مباشر' : 'جهة خارجية'}
                              </span>
                            </div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                              {prov.name}
                            </h3>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
                              slug: {prov.slug}
                            </span>
                          </div>

                          {prov.description && (
                            <p className="text-[var(--text-secondary)] text-sm line-clamp-2 min-h-[40px] leading-relaxed">
                              {prov.description}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-3 py-4 border-y border-[var(--border)]">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-[var(--text-muted)] font-bold">الخطط</span>
                              <div className="text-sm font-bold text-[var(--text-primary)]">
                                {provPlansCount} خطط سداد
                              </div>
                            </div>
                            <div className="space-y-0.5 text-left">
                              <span className="text-[10px] text-[var(--text-muted)] font-bold">الترتيب</span>
                              <div className="text-sm font-mono font-bold text-[var(--accent)]">
                                #{prov.displayOrder}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleReorderProvider(prov, 'up')}
                              className="p-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-20 cursor-pointer border border-[var(--border)]"
                              title="تحريك لأعلى"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === providers.length - 1}
                              onClick={() => handleReorderProvider(prov, 'down')}
                              className="p-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-20 cursor-pointer border border-[var(--border)]"
                              title="تحريك لأسفل"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProvider(prov)}
                              className="px-4 py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] text-xs font-bold transition-all cursor-pointer border border-[var(--border)] flex items-center gap-1.5"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProvider(prov)}
                              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all cursor-pointer border border-rose-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* TAB B: INSTALLMENT PLANS TABLE */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              {/* Provider Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[var(--surface-elevated)]/30 border border-[var(--border)] backdrop-blur-md">
                <div className="flex items-center gap-3 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                  <div className="flex items-center gap-2 shrink-0">
                    <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-xs font-bold text-[var(--text-muted)] whitespace-nowrap ml-1">تصفية:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterProviderId('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                      filterProviderId === 'all'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg shadow-[var(--accent)]/20'
                        : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]'
                    }`}
                  >
                    الكل ({plans.length})
                  </button>
                  {providers.map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => setFilterProviderId(prov.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-2 ${
                        filterProviderId === prov.id
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg shadow-[var(--accent)]/20'
                          : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]'
                      }`}
                    >
                      <ProviderLogo provider={prov} size="sm" />
                      {prov.name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleOpenAddPlan}
                  className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-white font-black text-xs flex items-center justify-center gap-2 hover:bg-[var(--accent-light)] transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة خطة تقسيط</span>
                </button>
              </div>

              {/* REAL MANAGEMENT TABLE */}
              {filteredPlans.length === 0 ? (
                <div className="py-20 text-center space-y-4 bg-[var(--surface-elevated)]/20 rounded-3xl border border-dashed border-[var(--border)]">
                  <div className="w-16 h-16 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center mx-auto">
                    <Layers className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-[var(--text-primary)]">لا توجد خطط تقسيط</p>
                    <p className="text-sm text-[var(--text-secondary)]">لا توجد خطط مضافة لهذه الجهة حتى الآن.</p>
                  </div>
                  <button
                    onClick={handleOpenAddPlan}
                    className="px-6 py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-xs font-bold text-[var(--accent)] transition-all cursor-pointer inline-flex items-center gap-2 border border-[var(--border)]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة خطة الآن</span>
                  </button>
                </div>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)]/50 text-[var(--text-muted)]">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">جهة التقسيط</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">المدة</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">المقدم</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">الفائدة</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">الرسوم</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider">الحالة</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredPlans.map((plan) => {
                          const prov = providers.find((p) => p.id === plan.providerId);
                          const isNoExtraCost =
                            plan.calculationType === 'no_extra_cost' ||
                            (plan.percentage === 0 && plan.fixedFee === 0);

                          return (
                            <tr
                              key={plan.id}
                              className={`hover:bg-[var(--surface-elevated)]/30 transition-colors group ${
                                !plan.enabled ? 'opacity-50 grayscale' : ''
                              }`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-white p-1 border border-[var(--border)] flex items-center justify-center">
                                    <ProviderLogo provider={prov!} size="sm" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-[var(--text-primary)] block">
                                      {prov?.name || plan.providerId}
                                    </span>
                                    {prov?.isDirectStore && (
                                      <span className="text-[9px] text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded">
                                        مباشر
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-black border border-blue-500/20">
                                  {plan.months} شهر
                                </span>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                {plan.downPaymentType === 'none' || plan.downPaymentValue <= 0 ? (
                                  <span className="text-emerald-400 font-bold">بدون مقدم</span>
                                ) : (
                                  <span className="text-[var(--text-primary)] font-bold">
                                    {plan.downPaymentValue}{plan.downPaymentType === 'percentage' ? '%' : ' ج.م'}
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                {isNoExtraCost ? (
                                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    بدون فوائد
                                  </span>
                                ) : (
                                  <span className="font-bold text-amber-400">
                                    {plan.calculationType === 'percentage_fee' ? `+${plan.percentage}%` : '-'}
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-[var(--text-secondary)] font-medium">
                                  {plan.fixedFee > 0 ? `${plan.fixedFee} ج.م` : '0'}
                                </span>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlan(plan)}
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black cursor-pointer transition-all border ${
                                    plan.enabled
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${plan.enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-400'}`} />
                                  {plan.enabled ? 'نشط' : 'معطل'}
                                </button>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicatePlan(plan)}
                                    className="p-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-sky-400 hover:text-sky-300 transition-all cursor-pointer border border-[var(--border)]"
                                    title="نسخ الخطة"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPlan(plan)}
                                    className="p-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-all cursor-pointer border border-[var(--border)]"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePlan(plan)}
                                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all cursor-pointer border border-rose-500/20"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </main>

      {/* MODAL: ADD / EDIT PROVIDER */}
      <AnimatePresence>
        {providerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setProviderModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-8 shadow-2xl z-10 my-auto text-[var(--text-primary)]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-bg)] flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <h2 className="text-xl font-black">
                    {editingProvider ? 'تعديل جهة التقسيط' : 'إضافة جهة تقسيط جديدة'}
                  </h2>
                </div>
                <button
                  onClick={() => setProviderModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProvider} className="space-y-6">
                {/* LOGO MANAGEMENT SECTION */}
                <div className="p-6 rounded-2xl bg-[var(--surface-elevated)]/30 border border-[var(--border)] space-y-4">
                  <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">
                    شعار جهة التقسيط (Logo)
                  </label>

                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-2xl bg-white p-2 shadow-xl border border-[var(--border)] overflow-hidden flex items-center justify-center">
                        <ProviderLogo
                          provider={{
                            id: providerFormData.id || 'preview',
                            name: providerFormData.name || 'جهة تقسيط',
                            slug: providerFormData.slug,
                            logoUrl: providerFormData.logoUrl,
                            isDirectStore: providerFormData.isDirectStore
                          }}
                          size="lg"
                        />
                      </div>
                      {providerFormData.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 z-20 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors shadow-lg border-2 border-[var(--surface)]"
                          title="حذف الشعار"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 flex-1 text-center sm:text-right">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                        className="hidden"
                        id="provider-logo-file-input"
                      />

                      <label
                        htmlFor="provider-logo-file-input"
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:bg-[var(--accent-light)] transition-all cursor-pointer shadow-lg shadow-[var(--accent)]/10"
                      >
                        {uploadingLogo ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جاري الرفع...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>{providerFormData.logoUrl ? 'استبدال الشعار' : 'رفع شعار جديد'}</span>
                          </>
                        )}
                      </label>

                      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                        يتم تخزين الشعار المرفوع واستخدامه مباشرة في كروت المزودين بصفحة المنتج.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">اسم جهة التقسيط *</label>
                    <input
                      type="text"
                      required
                      value={providerFormData.name}
                      onChange={(e) => setProviderFormData({ ...providerFormData, name: e.target.value })}
                      placeholder="مثال: تقسيطي، مايلو، موجو"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">المعرف المختصر (Slug)</label>
                      <input
                        type="text"
                        value={providerFormData.slug}
                        onChange={(e) => setProviderFormData({ ...providerFormData, slug: e.target.value })}
                        placeholder="مثال: taqseeti"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-mono focus:border-[var(--accent)] outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">ترتيب العرض</label>
                      <input
                        type="number"
                        min="1"
                        value={providerFormData.displayOrder}
                        onChange={(e) => setProviderFormData({ ...providerFormData, displayOrder: Number(e.target.value) })}
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Direct Store Toggle */}
                  <div className="p-4 rounded-2xl bg-[var(--surface-elevated)]/20 border border-[var(--border)] flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-[var(--text-primary)] block">تقسيط مباشر من المحل</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        تحديد الجهة كتقسيط داخلي للمتجر (مثل "تقسيطي")
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={providerFormData.isDirectStore}
                        onChange={(e) => setProviderFormData({ ...providerFormData, isDirectStore: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[var(--surface-elevated)] peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                    </label>
                  </div>

                  {providerFormData.isDirectStore && (
                    <div>
                      <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">
                        تنويه التقسيط المباشر
                      </label>
                      <input
                        type="text"
                        value={providerFormData.directStoreDisclaimer}
                        onChange={(e) =>
                          setProviderFormData({ ...providerFormData, directStoreDisclaimer: e.target.value })
                        }
                        placeholder="التقسيط المباشر يتم من خلال المحل..."
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">الوصف</label>
                    <textarea
                      rows={3}
                      value={providerFormData.description}
                      onChange={(e) => setProviderFormData({ ...providerFormData, description: e.target.value })}
                      placeholder="وصف مختصر لمزايا التقسيط عبر هذه الجهة"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none resize-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setProviderModalOpen(false)}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 rounded-xl bg-[var(--accent)] text-white font-black text-sm hover:bg-[var(--accent-light)] transition-all cursor-pointer shadow-lg shadow-[var(--accent)]/20 active:scale-95"
                  >
                    حفظ البيانات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* MODAL: ADD / EDIT INSTALLMENT PLAN WITH LIVE CALCULATION PREVIEW */}
      <AnimatePresence>
        {planModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setPlanModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-8 shadow-2xl z-10 my-auto text-[var(--text-primary)]"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-bg)] flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <h2 className="text-xl font-black">
                    {editingPlan ? 'تعديل خطة التقسيط' : 'إضافة خطة تقسيط جديدة'}
                  </h2>
                </div>
                <button
                  onClick={() => setPlanModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">جهة التقسيط *</label>
                      <select
                        required
                        value={planFormData.providerId}
                        onChange={(e) => setPlanFormData({ ...planFormData, providerId: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all appearance-none"
                      >
                        <option value="">اختر الجهة...</option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.isDirectStore ? '(مباشر)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">
                        عدد الشهور (المدة) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={planFormData.months}
                        onChange={(e) => setPlanFormData({ ...planFormData, months: Number(e.target.value) })}
                        placeholder="مثال: 12"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                      />
                    </div>

                    <div className="p-6 rounded-2xl bg-[var(--surface-elevated)]/30 border border-[var(--border)] space-y-4">
                      <div>
                        <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">نوع المقدم</label>
                        <select
                          value={planFormData.downPaymentType}
                          onChange={(e) => setPlanFormData({ ...planFormData, downPaymentType: e.target.value as DownPaymentType })}
                          className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                        >
                          <option value="none">بدون مقدم (0)</option>
                          <option value="percentage">نسبة مئوية (%)</option>
                          <option value="fixed">مبلغ ثابت (ج.م)</option>
                        </select>
                      </div>

                      {planFormData.downPaymentType !== 'none' && (
                        <div className="animate-in slide-in-from-top-2">
                          <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">قيمة المقدم</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={planFormData.downPaymentValue}
                              onChange={(e) => setPlanFormData({ ...planFormData, downPaymentValue: Number(e.target.value) })}
                              className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs font-bold">
                              {planFormData.downPaymentType === 'percentage' ? '%' : 'ج.م'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calculations Column */}
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-[var(--surface-elevated)]/30 border border-[var(--border)] space-y-4">
                      <div>
                        <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">نوع احتساب الزيادة</label>
                        <select
                          value={planFormData.calculationType}
                          onChange={(e) => setPlanFormData({ ...planFormData, calculationType: e.target.value as InstallmentCalculationType })}
                          className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                        >
                          <option value="no_extra_cost">بدون فوائد (0%)</option>
                          <option value="percentage_fee">نسبة مئوية (%)</option>
                          <option value="fixed_fee">مبلغ ثابت (ج.م)</option>
                        </select>
                      </div>

                      {planFormData.calculationType !== 'no_extra_cost' && (
                        <div className="animate-in slide-in-from-top-2">
                          <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">
                            {planFormData.calculationType === 'percentage_fee' ? 'نسبة الزيادة (%)' : 'مبلغ الرسوم الثابتة (ج.م)'}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={planFormData.calculationType === 'percentage_fee' ? planFormData.percentage : planFormData.fixedFee}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (planFormData.calculationType === 'percentage_fee') {
                                setPlanFormData({ ...planFormData, percentage: val });
                              } else {
                                setPlanFormData({ ...planFormData, fixedFee: val });
                              }
                            }}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                          />
                        </div>
                      )}

                      {planFormData.calculationType === 'percentage_fee' && (
                        <div className="pt-2 animate-in slide-in-from-top-2">
                          <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">طريقة تطبيق الزيادة</label>
                          <select
                            value={planFormData.feeCalculationBase}
                            onChange={(e) => setPlanFormData({ ...planFormData, feeCalculationBase: e.target.value as any })}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                          >
                            <option value="remaining_amount">على المبلغ المتبقي بعد المقدم</option>
                            <option value="full_price">على سعر المنتج بالكامل</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="p-6 rounded-[2rem] bg-gradient-to-br from-[var(--accent)]/10 to-transparent border border-[var(--accent)]/20 shadow-inner">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-5 h-5 text-[var(--accent)]" />
                          <h4 className="text-sm font-black text-[var(--text-primary)]">معاينة الحسبة</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--text-muted)] font-bold">سعر تجريبي:</span>
                          <input
                            type="number"
                            value={testProductPrice}
                            onChange={(e) => setTestProductPrice(Number(e.target.value))}
                            className="w-20 bg-transparent text-left font-black text-[var(--accent)] outline-none border-b border-[var(--accent)]/30 focus:border-[var(--accent)]"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[10px] text-[var(--text-muted)] block mb-1">القسط الشهري</span>
                            <span className="text-3xl font-black text-[var(--accent)] leading-none">
                              {livePreviewResult.monthlyPayment.toLocaleString('ar-EG')}
                              <span className="text-xs font-bold mr-1">ج.م</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[var(--text-muted)] block mb-1">إجمالي المبلغ</span>
                            <span className="text-lg font-bold text-[var(--text-primary)]">
                              {livePreviewResult.totalPayable.toLocaleString('ar-EG')}
                              <span className="text-[10px] mr-1 text-[var(--text-secondary)]">ج.م</span>
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--accent)]/10">
                          <div className="p-3 rounded-xl bg-[var(--surface-elevated)]/50">
                            <span className="text-[9px] text-[var(--text-muted)] block">المقدم</span>
                            <span className="text-xs font-bold text-emerald-400">
                              {livePreviewResult.downPayment.toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-[var(--surface-elevated)]/50">
                            <span className="text-[9px] text-[var(--text-muted)] block">الزيادة</span>
                            <span className="text-xs font-bold text-amber-400">
                              +{livePreviewResult.feeAmount.toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">الحد الأدنى (ج.م)</label>
                      <input
                        type="number"
                        value={planFormData.minProductPrice}
                        onChange={(e) => setPlanFormData({ ...planFormData, minProductPrice: e.target.value })}
                        placeholder="اختياري"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">الحد الأقصى (ج.م)</label>
                      <input
                        type="number"
                        value={planFormData.maxProductPrice}
                        onChange={(e) => setPlanFormData({ ...planFormData, maxProductPrice: e.target.value })}
                        placeholder="اختياري"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">ملاحظة / توضيح للخطة</label>
                    <input
                      type="text"
                      value={planFormData.disclaimer}
                      onChange={(e) => setPlanFormData({ ...planFormData, disclaimer: e.target.value })}
                      placeholder="مثال: عروض خاصة بدون فوائد"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:border-[var(--accent)] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-8 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setPlanModalOpen(false)}
                    className="px-8 py-3 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-3 rounded-xl bg-[var(--accent)] text-white font-black text-sm hover:bg-[var(--accent-light)] transition-all cursor-pointer shadow-lg shadow-[var(--accent)]/20 active:scale-95"
                  >
                    حفظ الخطة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
