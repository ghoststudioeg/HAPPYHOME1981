import React, { useState, useEffect, useMemo } from 'react';
import { BundleOffer, BundleInstallmentPlan, Product, StoreSettings } from '../../types';
import { bundleService, calculateBundleStock, isBundleActive } from '../../lib/data/bundleService';
import { productService } from '../../lib/data/productService';
import { storageService } from '../../lib/data/storageService';
import { getValidImageSrc } from '../../utils/imageUtils';
import {
  Gift,
  Plus,
  Search,
  Calendar,
  Clock,
  Tag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Eye,
  Sliders,
  Sparkles,
  Layers,
  Package,
  X,
  Loader2,
  Percent,
  Coins,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  CreditCard,
  Upload,
  RefreshCw,
  Info,
  ChevronDown,
  ArrowUpDown,
  ShoppingBag
} from 'lucide-react';

interface AdminBundlesPageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
}

export function AdminBundlesPage({ navigate, settings }: AdminBundlesPageProps) {
  const [bundles, setBundles] = useState<BundleOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleOffer | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'products' | 'pricing' | 'installment' | 'design'>('general');

  // Delete Confirmation Modal
  const [deletingBundle, setDeletingBundle] = useState<BundleOffer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy URL indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    badgeText: '2 في 1',
    imageUrl: '',
    productIds: [] as string[],
    hasSpecialPrice: true,
    bundlePrice: 0,
    installmentEnabled: false,
    installmentHeadline: '150 جنيه شهريًا',
    installmentPlans: [] as BundleInstallmentPlan[],
    isActive: true,
    startAt: '',
    endAt: '',
    sortOrder: 0,
    showOnHome: true
  });

  // New Plan Input State
  const [newPlan, setNewPlan] = useState<BundleInstallmentPlan>({
    providerName: 'تقسيط مباشر / داخلي',
    months: 12,
    monthlyPayment: 150,
    downPayment: 0,
    totalAmount: 1800,
    interestRate: 0,
    adminFees: 0,
    notes: 'بدون فوائد وبأقل إجراءات',
    isDefault: true
  });

  // Product Picker Search
  const [productSearch, setProductSearch] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (force = false) => {
    setLoading(true);
    try {
      const [bundlesRes, productsRes] = await Promise.all([
        bundleService.getAllBundles(force),
        productService.getAllProducts(false)
      ]);
      setBundles(bundlesRes);
      setProducts(productsRes);
    } catch (err: any) {
      console.error('Failed to load bundle offers:', err);
      triggerToast('تعذر تحميل العروض المركبة.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Products map for instant O(1) lookup
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Selected products for current form
  const selectedProducts = useMemo(() => {
    return formData.productIds
      .map((id) => productsMap.get(id))
      .filter((p): p is Product => !!p);
  }, [formData.productIds, productsMap]);

  // Sum of original prices for selected products
  const computedOriginalPrice = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + (p.price || 0), 0);
  }, [selectedProducts]);

  // Filtered Bundles
  const filteredBundles = useMemo(() => {
    return bundles.filter((b) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.name.toLowerCase().includes(q);
        const matchSlug = b.slug.toLowerCase().includes(q);
        const matchDesc = (b.description || '').toLowerCase().includes(q);
        if (!matchName && !matchSlug && !matchDesc) return false;
      }

      // Status
      const active = isBundleActive(b);
      if (filterStatus === 'active') return active;
      if (filterStatus === 'inactive') return !b.isActive;
      if (filterStatus === 'expired') {
        if (!b.endAt) return false;
        const end = new Date(b.endAt.includes('T') ? b.endAt : `${b.endAt}T23:59:59`).getTime();
        return Date.now() > end;
      }
      return true;
    });
  }, [bundles, searchQuery, filterStatus]);

  // Overall Stats
  const stats = useMemo(() => {
    const total = bundles.length;
    const activeCount = bundles.filter(isBundleActive).length;
    const totalViews = bundles.reduce((sum, b) => sum + (b.viewsCount || 0), 0);
    const totalClicks = bundles.reduce((sum, b) => sum + (b.clicksCount || 0), 0);
    return { total, activeCount, totalViews, totalClicks };
  }, [bundles]);

  const openCreateModal = () => {
    setEditingBundle(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      badgeText: '2 في 1',
      imageUrl: '',
      productIds: [],
      hasSpecialPrice: true,
      bundlePrice: 0,
      installmentEnabled: true,
      installmentHeadline: '150 جنيه شهريًا',
      installmentPlans: [
        {
          providerName: 'تقسيط مباشر / داخلي',
          months: 12,
          monthlyPayment: 150,
          downPayment: 0,
          totalAmount: 1800,
          interestRate: 0,
          adminFees: 0,
          notes: 'تقسيط ميسر بدون فوائد',
          isDefault: true
        }
      ],
      isActive: true,
      startAt: '',
      endAt: '',
      sortOrder: bundles.length,
      showOnHome: true
    });
    setLocalPreviewUrl(null);
    setActiveTab('general');
    setIsModalOpen(true);
  };

  const openEditModal = (bundle: BundleOffer) => {
    setEditingBundle(bundle);
    setFormData({
      name: bundle.name,
      slug: bundle.slug,
      description: bundle.description || '',
      badgeText: bundle.badgeText || '2 في 1',
      imageUrl: bundle.imageUrl,
      productIds: [...bundle.productIds],
      hasSpecialPrice: bundle.hasSpecialPrice ?? true,
      bundlePrice: bundle.bundlePrice,
      installmentEnabled: bundle.installmentEnabled ?? false,
      installmentHeadline: bundle.installmentHeadline || '150 جنيه شهريًا',
      installmentPlans: bundle.installmentPlans ? [...bundle.installmentPlans] : [],
      isActive: bundle.isActive,
      startAt: bundle.startAt || '',
      endAt: bundle.endAt || '',
      sortOrder: bundle.sortOrder || 0,
      showOnHome: bundle.showOnHome ?? true
    });
    setLocalPreviewUrl(null);
    setActiveTab('general');
    setIsModalOpen(true);
  };

  // Image Upload handler matching project standard
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Client-side MIME / extension validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
    if ((file.type && !allowedTypes.includes(file.type.toLowerCase())) && !allowedExts.includes(ext)) {
      triggerToast('نوع الملف غير مدعوم. يُرجى اختيار صورة بصيغة PNG أو JPG أو WebP.');
      e.target.value = '';
      return;
    }

    // 2. Client-side Size Validation (10MB)
    if (file.size > 10 * 1024 * 1024) {
      triggerToast('حجم الصورة أكبر من الحد المسموح به (10 ميجابايت).');
      e.target.value = '';
      return;
    }

    // Instant local preview
    const previewBlob = URL.createObjectURL(file);
    setLocalPreviewUrl(previewBlob);

    try {
      setUploadingImage(true);
      const cdnUrl = await storageService.uploadBundleImage(editingBundle?.id || '', file);

      if (!cdnUrl || cdnUrl.startsWith('data:') || cdnUrl.includes(';base64,')) {
        throw new Error('تعذر استلام رابط صورة صالح من خادم التخزين.');
      }

      setFormData((prev) => ({ ...prev, imageUrl: cdnUrl }));
      triggerToast('تم رفع صورة تصميم العرض بنجاح عبر Supabase Storage.');
    } catch (err: any) {
      console.error('Bundle image upload error:', err);
      triggerToast(err?.message || 'تعذر رفع الصورة.');
      if (!formData.imageUrl) {
        setLocalPreviewUrl(null);
      }
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Toggle Product Selection
  const toggleProductSelection = (productId: string) => {
    setFormData((prev) => {
      const exists = prev.productIds.includes(productId);
      const updated = exists
        ? prev.productIds.filter((id) => id !== productId)
        : [...prev.productIds, productId];
      return { ...prev, productIds: updated };
    });
  };

  // Add Installment Plan
  const handleAddPlan = () => {
    if (newPlan.months <= 0 || newPlan.monthlyPayment <= 0) {
      triggerToast('يرجى تحديد عدد الشهور وقيمة القسط الشهري.');
      return;
    }
    const computedTotal = (newPlan.monthlyPayment * newPlan.months) + (newPlan.downPayment || 0);
    const planToAdd: BundleInstallmentPlan = {
      ...newPlan,
      totalAmount: newPlan.totalAmount || computedTotal
    };

    setFormData((prev) => {
      const plans = [...(prev.installmentPlans || [])];
      if (planToAdd.isDefault) {
        plans.forEach((p) => (p.isDefault = false));
      }
      return {
        ...prev,
        installmentPlans: [...plans, planToAdd]
      };
    });

    setNewPlan({
      providerName: 'تقسيط مباشر / داخلي',
      months: 12,
      monthlyPayment: 150,
      downPayment: 0,
      totalAmount: 1800,
      interestRate: 0,
      adminFees: 0,
      notes: '',
      isDefault: false
    });
    triggerToast('تمت إضافة خطة التقسيط.');
  };

  const handleRemovePlan = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      installmentPlans: prev.installmentPlans.filter((_, i) => i !== index)
    }));
  };

  const handleSetDefaultPlan = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      installmentPlans: prev.installmentPlans.map((p, i) => ({
        ...p,
        isDefault: i === index
      }))
    }));
  };

  // Quick Toggle Active
  const handleToggleActive = async (bundle: BundleOffer) => {
    const nextState = !bundle.isActive;
    try {
      await bundleService.updateBundle(bundle.id, { isActive: nextState });
      setBundles((prev) =>
        prev.map((b) => (b.id === bundle.id ? { ...b, isActive: nextState } : b))
      );
      triggerToast(nextState ? `تم تفعيل العرض "${bundle.name}".` : `تم إيقاف العرض "${bundle.name}".`);
    } catch {
      triggerToast('تعذر تغيير حالة العرض.');
    }
  };

  // Copy Link
  const handleCopyLink = (bundle: BundleOffer) => {
    const url = `${window.location.origin}/offer/${bundle.slug || bundle.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(bundle.id);
    triggerToast('تم نسخ رابط العرض إلى الحافظة.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Save Bundle (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      triggerToast('يرجى إدخال اسم العرض.');
      setActiveTab('general');
      return;
    }
    if (formData.productIds.length < 2) {
      triggerToast('يجب اختيار منتجين على الأقل لإنشاء عرض مركب.');
      setActiveTab('products');
      return;
    }
    if (!formData.imageUrl.trim()) {
      triggerToast('يرجى رفع تصميم أو صورة العرض.');
      setActiveTab('design');
      return;
    }

    const defaultPlan = formData.installmentPlans.find((p) => p.isDefault) || formData.installmentPlans[0];
    const finalPrice = formData.hasSpecialPrice && formData.bundlePrice > 0 ? formData.bundlePrice : computedOriginalPrice;

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || formData.name.trim().replace(/\s+/g, '-').toLowerCase(),
        description: formData.description.trim(),
        badgeText: formData.badgeText.trim() || '2 في 1',
        imageUrl: formData.imageUrl.trim(),
        productIds: formData.productIds,
        hasSpecialPrice: formData.hasSpecialPrice,
        bundlePrice: finalPrice,
        originalTotalPrice: computedOriginalPrice,
        installmentEnabled: formData.installmentEnabled,
        installmentHeadline: formData.installmentHeadline.trim() || undefined,
        installmentPlans: formData.installmentPlans,
        defaultPlan: defaultPlan || undefined,
        isActive: formData.isActive,
        startAt: formData.startAt || undefined,
        endAt: formData.endAt || undefined,
        sortOrder: formData.sortOrder,
        showOnHome: formData.showOnHome
      };

      if (editingBundle) {
        await bundleService.updateBundle(editingBundle.id, payload);
        triggerToast('تم تحديث العرض المركب بنجاح.');
      } else {
        await bundleService.createBundle(payload);
        triggerToast('تم إنشاء العرض المركب بنجاح.');
      }

      setIsModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      console.error('Save bundle failed:', err);
      triggerToast(err?.message || 'حصل خطأ أثناء حفظ العرض.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Bundle
  const handleDeleteConfirm = async () => {
    if (!deletingBundle) return;
    setDeleteLoading(true);
    try {
      await bundleService.deleteBundle(deletingBundle.id);
      setBundles((prev) => prev.filter((b) => b.id !== deletingBundle.id));
      setDeletingBundle(null);
      triggerToast('تم حذف العرض المركب بنجاح.');
    } catch {
      triggerToast('تعذر حذف العرض.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#0D1520] border border-[#D4AF37] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in duration-200">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs sm:text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#E0B84A]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                العروض المركبة (Bundle Offers)
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                أنشئ عروضاً مجمعة (ساعة + سماعة، طقم أدوات، إلخ) مع صور مخصصة وخطط تقسيط واضحة، بدون تكرار المنتجات.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            className="p-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D4AF37]/40 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs rounded-xl shadow-lg hover:brightness-110 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء عرض مركب جديد</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] block">إجمالي العروض</span>
          <div className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">{stats.total}</div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] block">العروض النشطة حالياً</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400">{stats.activeCount}</div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] block">إجمالي المشاهدات</span>
          <div className="text-xl sm:text-2xl font-black text-sky-400">{stats.totalViews.toLocaleString('ar-EG')}</div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] block">الضغطات على الشراء</span>
          <div className="text-xl sm:text-2xl font-black text-[#D4AF37]">{stats.totalClicks.toLocaleString('ar-EG')}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم العرض، الرابط، أو الوصف..."
            className="w-full glass-input rounded-xl pr-10 pl-4 py-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['all', 'active', 'inactive', 'expired'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                filterStatus === status
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'glass-panel text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]'
              }`}
            >
              {status === 'all' && 'الكل'}
              {status === 'active' && 'النشطة'}
              {status === 'inactive' && 'المتوقفة'}
              {status === 'expired' && 'المنتهية'}
            </button>
          ))}
        </div>
      </div>

      {/* Bundles Grid */}
      {loading ? (
        <div className="p-16 text-center text-[var(--text-secondary)] flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <span className="text-xs">جاري تحميل العروض المركبة...</span>
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-3xl border border-[var(--border)] space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] mx-auto">
            <Gift className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-[var(--text-primary)]">لا توجد عروض مركبة مطابقة</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {searchQuery ? 'جرب البحث بكلمة مختلفة أو مسح الفلاتر.' : 'ابدأ بإنشاء أول عرض مركب مجمع لزيادة المبيعات.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-6 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs rounded-xl shadow cursor-pointer hover:brightness-110"
          >
            + إنشاء عرض الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBundles.map((bundle) => {
            const active = isBundleActive(bundle);
            const bundleProducts = bundle.productIds
              .map((id) => productsMap.get(id))
              .filter((p): p is Product => !!p);
            const calculatedStock = calculateBundleStock(bundleProducts);
            const hasStock = calculatedStock > 0;

            const originalSum = bundle.originalTotalPrice || bundleProducts.reduce((s, p) => s + (p.price || 0), 0);
            const savings = Math.max(0, originalSum - bundle.bundlePrice);
            const savingsPercent = originalSum > 0 ? Math.round((savings / originalSum) * 100) : 0;

            return (
              <div
                key={bundle.id}
                className="glass-panel-elevated rounded-3xl border border-[var(--border)] overflow-hidden flex flex-col justify-between hover:border-[#D4AF37]/50 transition-all duration-200 group"
              >
                <div>
                  {/* Banner Design Image Preview */}
                  <div className="relative w-full h-48 bg-black/60 overflow-hidden">
                    <img
                      src={getValidImageSrc(bundle.imageUrl)}
                      alt={bundle.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black border backdrop-blur-md ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {active ? 'نشط ومتاح' : 'متوقف'}
                      </span>
                      {bundle.badgeText && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#D4AF37]/90 text-black shadow">
                          {bundle.badgeText}
                        </span>
                      )}
                    </div>

                    {/* Stock Badge */}
                    <div className="absolute bottom-3 right-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md border ${
                          hasStock
                            ? 'bg-black/60 text-white border-white/20'
                            : 'bg-rose-600/80 text-white border-rose-400'
                        }`}
                      >
                        {hasStock ? `المخزون المتاح: ${calculatedStock} باقات` : 'غير متوفر (نفاد أحد المنتجات)'}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3.5">
                    <div>
                      <h3 className="text-base font-black text-[var(--text-primary)] group-hover:text-[#E0B84A] transition-colors line-clamp-1">
                        {bundle.name}
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5">
                        {bundle.description || 'عرض مركب يحتوي على منتجات مجمعة بسعر مميز.'}
                      </p>
                    </div>

                    {/* Included Products List */}
                    <div className="space-y-1.5 p-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] block">
                        المنتجات الموجودة بالعرض ({bundleProducts.length}):
                      </span>
                      <div className="space-y-1">
                        {bundleProducts.map((prod) => (
                          <div key={prod.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                              <span className="truncate text-[var(--text-primary)] font-semibold">{prod.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[var(--text-muted)] text-[10px]">{prod.price.toLocaleString('ar-EG')} ج.م</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded ${
                                  (prod.stockQuantity || 0) > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                مخزون: {prod.stockQuantity || 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pricing and Installment Section */}
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/25 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-[var(--text-muted)] block">سعر الباقة الخاص:</span>
                          <span className="text-lg font-black text-[#D4AF37]">
                            {bundle.bundlePrice.toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                        {savings > 0 && (
                          <div className="text-left">
                            <span className="text-[11px] line-through text-[var(--text-muted)] block">
                              {originalSum.toLocaleString('ar-EG')} ج.م
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              وفر {savings.toLocaleString('ar-EG')} ج ({savingsPercent}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Installment Badge */}
                      {bundle.installmentEnabled && (
                        <div className="pt-1.5 border-t border-[#D4AF37]/20 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1 text-[#D4AF37] font-bold">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{bundle.installmentHeadline || 'متاح بالتقسيط الميسر'}</span>
                          </div>
                          {bundle.defaultPlan && (
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              {bundle.defaultPlan.monthlyPayment} ج/شهر × {bundle.defaultPlan.months}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Stats & Schedule */}
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1">
                      <div className="flex items-center gap-3">
                        <span title="عدد المشاهدات">👁️ {bundle.viewsCount || 0}</span>
                        <span title="مرات النقر على الشراء">🛒 {bundle.clicksCount || 0}</span>
                      </div>
                      {bundle.endAt && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Clock className="w-3 h-3" />
                          <span>ينتهي: {bundle.endAt.split('T')[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-elevated)]/40 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(bundle)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                        bundle.isActive
                          ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {bundle.isActive ? 'إيقاف' : 'تفعيل'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(bundle)}
                      className="p-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#D4AF37] transition-colors cursor-pointer"
                      title="نسخ رابط العرض"
                    >
                      {copiedId === bundle.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => window.open(`/offer/${bundle.slug || bundle.id}`, '_blank')}
                      className="p-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#D4AF37] transition-colors cursor-pointer"
                      title="معاينة صفحة العرض"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(bundle)}
                      className="px-3 py-1.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingBundle(bundle)}
                      className="p-1.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="حذف العرض"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Create / Edit Bundle Offer */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div
            dir="rtl"
            className="w-full max-w-3xl bg-[#0D1520] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] bg-[var(--surface-elevated)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                    {editingBundle ? `تعديل العرض المركب: ${editingBundle.name}` : 'إنشاء عرض مركب جديد'}
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    اختر المنتجات وضع تصميم العرض ونظام التقسيط الخاص به.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-1 p-2 bg-[var(--surface)] border-b border-[var(--border)] overflow-x-auto scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'general' ? 'bg-[#D4AF37] text-black font-black' : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                1. البيانات العامة
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'products' ? 'bg-[#D4AF37] text-black font-black' : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <span>2. اختيار المنتجات</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
                  {formData.productIds.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pricing')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'pricing' ? 'bg-[#D4AF37] text-black font-black' : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                3. السعر والتوفير
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('installment')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'installment' ? 'bg-[#D4AF37] text-black font-black' : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                4. نظام التقسيط
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('design')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'design' ? 'bg-[#D4AF37] text-black font-black' : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                5. صورة التصميم
              </button>
            </div>

            {/* Modal Body */}
            <form id="bundleForm" onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* TAB 1: General Info */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-primary)]">
                        اسم العرض المركب <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            name: val,
                            slug: prev.slug || val.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\u0600-\u06FF-]/g, '').toLowerCase()
                          }));
                        }}
                        placeholder="مثال: ساعة سمارت + سماعة إيربودز"
                        required
                        className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-primary)]">
                        شارة العرض (Badge)
                      </label>
                      <input
                        type="text"
                        value={formData.badgeText}
                        onChange={(e) => setFormData((prev) => ({ ...prev, badgeText: e.target.value }))}
                        placeholder="مثال: 2 في 1، وفر 300 ج، باقة التوفير"
                        className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      رابط العرض المخصص (Slug)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                        placeholder="sa3a-samaha-2in1"
                        dir="ltr"
                        className="w-full glass-input rounded-xl pl-4 pr-24 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">
                        /offer/
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-primary)]">وصف العرض</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="اشرح مميزات العرض وما يحتويه ولماذا يعتبر صفقة ممتازة للعميل..."
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-primary)]">تاريخ بداية العرض (اختياري)</label>
                      <input
                        type="date"
                        value={formData.startAt}
                        onChange={(e) => setFormData((prev) => ({ ...prev, startAt: e.target.value }))}
                        className="w-full glass-input rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-primary)]">تاريخ انتهاء العرض (اختياري)</label>
                      <input
                        type="date"
                        value={formData.endAt}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endAt: e.target.value }))}
                        className="w-full glass-input rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-[var(--border)]">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="w-4 h-4 accent-[#D4AF37] rounded"
                      />
                      <span>تفعيل العرض فوراً (Active)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={formData.showOnHome}
                        onChange={(e) => setFormData((prev) => ({ ...prev, showOnHome: e.target.checked }))}
                        className="w-4 h-4 accent-[#D4AF37] rounded"
                      />
                      <span>عرض في قسم العروض المركبة بالصفحة الرئيسية</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: Included Products Selection */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-2xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      اختر منتجين أو أكثر من منتجات المتجر الحالية. العرض لا يكرر بيانات المنتج ولا يغير سعره الأصلي، بل يربط المنتجات معاً كوحدة واحدة.
                    </p>
                  </div>

                  {/* Selected Products List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        المنتجات المختارة ({selectedProducts.length}):
                      </span>
                      <span className="text-xs font-black text-[#D4AF37]">
                        إجمالي الأسعار العادية: {computedOriginalPrice.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    {selectedProducts.length === 0 ? (
                      <div className="p-6 border border-dashed border-[var(--border)] rounded-2xl text-center text-xs text-[var(--text-muted)]">
                        لم تقم باختيار أي منتج بعد. استخدم القائمة أدناه لاختيار المنتجات.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {selectedProducts.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={getValidImageSrc(p.mainImageUrl)}
                                alt={p.name}
                                className="w-10 h-10 object-contain rounded-lg bg-black/40 border border-white/10 shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{p.name}</h4>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  {p.categoryName || 'قسم عام'} • المخزون: {p.stockQuantity || 0}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-black text-[var(--text-primary)]">
                                {p.price.toLocaleString('ar-EG')} ج.م
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleProductSelection(p.id)}
                                className="text-rose-400 hover:text-rose-300 p-1 text-xs font-bold"
                              >
                                إزالة
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Search and Picker for All Products */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)] block">
                      اختر من المنتجات المتاحة بالمتجر:
                    </span>
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="ابحث في المنتجات بالاسم أو القسم..."
                      className="w-full glass-input rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[#D4AF37]"
                    />

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      {products
                        .filter((p) => {
                          if (!productSearch.trim()) return true;
                          const q = productSearch.toLowerCase();
                          return p.name.toLowerCase().includes(q) || (p.categoryName || '').toLowerCase().includes(q);
                        })
                        .slice(0, 30)
                        .map((prod) => {
                          const isSelected = formData.productIds.includes(prod.id);
                          return (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => toggleProductSelection(prod.id)}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-right transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#D4AF37]'
                                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:border-[#D4AF37]/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={getValidImageSrc(prod.mainImageUrl)}
                                  alt={prod.name}
                                  className="w-7 h-7 object-contain rounded bg-black/40 shrink-0"
                                />
                                <span className="text-xs font-bold truncate">{prod.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-xs">
                                <span className="font-bold">{prod.price.toLocaleString('ar-EG')} ج.م</span>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${isSelected ? 'border-[#D4AF37] bg-[#D4AF37] text-black' : 'border-zinc-600'}`}>
                                  {isSelected && <Check className="w-3 h-3" />}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Pricing & Special Offer */}
              {activeTab === 'pricing' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-1">
                      <span className="text-[11px] text-[var(--text-muted)] font-bold block">
                        إجمالي أسعار المنتجات العادية:
                      </span>
                      <div className="text-xl font-black text-[var(--text-primary)]">
                        {computedOriginalPrice.toLocaleString('ar-EG')} ج.م
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        (مجموع أسعار المنتجات المحددة بدون خصم)
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 space-y-1">
                      <span className="text-[11px] text-[#D4AF37] font-bold block">
                        سعر العرض المركب النهائي:
                      </span>
                      <div className="text-xl font-black text-[#D4AF37]">
                        {(formData.hasSpecialPrice && formData.bundlePrice > 0 ? formData.bundlePrice : computedOriginalPrice).toLocaleString('ar-EG')} ج.م
                      </div>
                      {formData.hasSpecialPrice && formData.bundlePrice > 0 && computedOriginalPrice > formData.bundlePrice && (
                        <span className="text-[10px] font-bold text-emerald-400 block">
                          وفر {computedOriginalPrice - formData.bundlePrice} ج.م ({Math.round(((computedOriginalPrice - formData.bundlePrice) / computedOriginalPrice) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={formData.hasSpecialPrice}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hasSpecialPrice: e.target.checked }))}
                        className="w-4 h-4 accent-[#D4AF37] rounded"
                      />
                      <span>تحديد سعر خاص ومخفض للعرض المركب (أقل من إجمالي المنتجات)</span>
                    </label>

                    {formData.hasSpecialPrice && (
                      <div className="space-y-1.5 max-w-sm">
                        <label className="text-xs font-bold text-[var(--text-primary)]">
                          أدخل سعر العرض (ج.م) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="number"
                          value={formData.bundlePrice || ''}
                          onChange={(e) => setFormData((prev) => ({ ...prev, bundlePrice: Math.max(0, Number(e.target.value)) }))}
                          placeholder={`مثال: ${Math.max(1, computedOriginalPrice - 200)}`}
                          className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none font-bold"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Installment System */}
              {activeTab === 'installment' && (
                <div className="space-y-5">
                  <div className="p-3.5 bg-sky-500/10 border border-sky-500/25 rounded-2xl flex items-start gap-2.5">
                    <CreditCard className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-[var(--text-secondary)] space-y-1 leading-relaxed">
                      <p className="font-bold text-[var(--text-primary)]">ملاحظة هامة جداً بخصوص التقسيط:</p>
                      <p>
                        القسط الشهري (مثل "150 جنيه شهريًا") لا يُعتبر السعر الإجمالي للعرض. يجب تحديد المقدم وعدد الشهور والقسط الشهري والإجمالي ليظهر للعميل بوضوح تام مثل: <strong>"150 جنيه شهريًا × 12 شهر"</strong>.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={formData.installmentEnabled}
                      onChange={(e) => setFormData((prev) => ({ ...prev, installmentEnabled: e.target.checked }))}
                      className="w-4 h-4 accent-[#D4AF37] rounded"
                    />
                    <span>تفعيل خيار التقسيط لهذا العرض المركب</span>
                  </label>

                  {formData.installmentEnabled && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[var(--text-primary)]">
                          عنوان التقسيط البارز (Headline)
                        </label>
                        <input
                          type="text"
                          value={formData.installmentHeadline}
                          onChange={(e) => setFormData((prev) => ({ ...prev, installmentHeadline: e.target.value }))}
                          placeholder="مثال: 150 جنيه شهريًا، أو قسط براحتك على 12 شهر"
                          className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none font-bold"
                        />
                      </div>

                      {/* Current Plans List */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] block">
                          خطط التقسيط المتاحة للعرض ({formData.installmentPlans.length}):
                        </span>

                        {formData.installmentPlans.length === 0 ? (
                          <div className="p-4 border border-dashed border-[var(--border)] rounded-xl text-center text-xs text-[var(--text-muted)]">
                            لم تقم بإضافة أي خطة تقسيط بعد. أضف خطة باستخدام النموذج أدناه.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {formData.installmentPlans.map((plan, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  plan.isDefault ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40' : 'bg-[var(--surface-elevated)] border-[var(--border)]'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-[var(--text-primary)]">
                                      {plan.providerName || 'التقسيط المباشر'}
                                    </span>
                                    {plan.isDefault && (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#D4AF37] text-black">
                                        الخطة الافتراضية
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[var(--text-secondary)] font-bold">
                                    {plan.monthlyPayment.toLocaleString('ar-EG')} ج.م شهرياً × {plan.months} شهر
                                    {plan.downPayment > 0 ? ` (المقدم: ${plan.downPayment.toLocaleString('ar-EG')} ج.م)` : ' (بدون مقدم)'}
                                    {plan.totalAmount ? ` • الإجمالي: ${plan.totalAmount.toLocaleString('ar-EG')} ج.م` : ''}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {!plan.isDefault && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetDefaultPlan(idx)}
                                      className="text-[11px] text-[#D4AF37] hover:underline font-bold"
                                    >
                                      تعيين كافتراضية
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePlan(idx)}
                                    className="p-1 text-rose-400 hover:text-rose-300 text-xs font-bold"
                                  >
                                    حذف
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add New Plan Sub-form */}
                      <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3">
                        <span className="text-xs font-black text-[#D4AF37] block">
                          + إضافة خطة تقسيط جديدة للعرض:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--text-secondary)]">مزود التقسيط</label>
                            <input
                              type="text"
                              value={newPlan.providerName}
                              onChange={(e) => setNewPlan((p) => ({ ...p, providerName: e.target.value }))}
                              placeholder="valU, Souhoola, Aman, مباشر"
                              className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--text-secondary)]">عدد الشهور</label>
                            <input
                              type="number"
                              value={newPlan.months}
                              onChange={(e) => setNewPlan((p) => ({ ...p, months: Number(e.target.value) }))}
                              className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--text-secondary)]">القسط الشهري (ج.م)</label>
                            <input
                              type="number"
                              value={newPlan.monthlyPayment}
                              onChange={(e) => setNewPlan((p) => ({ ...p, monthlyPayment: Number(e.target.value) }))}
                              className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-[var(--text-secondary)]">المقدم (ج.م)</label>
                            <input
                              type="number"
                              value={newPlan.downPayment}
                              onChange={(e) => setNewPlan((p) => ({ ...p, downPayment: Number(e.target.value) }))}
                              className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newPlan.isDefault}
                              onChange={(e) => setNewPlan((p) => ({ ...p, isDefault: e.target.checked }))}
                              className="w-3.5 h-3.5 accent-[#D4AF37]"
                            />
                            <span>جعلها الخطة الافتراضية</span>
                          </label>

                          <button
                            type="button"
                            onClick={handleAddPlan}
                            className="px-4 py-1.5 bg-[#D4AF37] text-black font-black text-xs rounded-xl hover:brightness-110 cursor-pointer"
                          >
                            + إضافة الخطة
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Design Graphic Upload */}
              {activeTab === 'design' && (
                <div className="space-y-4">
                  <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-2xl flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      ارفع تصميم العرض الكامل (مثل التصميم المنشور على Facebook المحتوي على صور المنتجات وعبارة "2 في 1" و "150 ج شهرياً"). الصورة تحفظ كرابط Supabase Storage فقط ولا يتم تخزين Base64.
                    </p>
                  </div>

                  {/* Upload Box */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      رفع صورة التصميم (Supabase Storage) <span className="text-rose-400">*</span>
                    </label>

                    <div className="p-6 border-2 border-dashed border-[var(--border)] hover:border-[#D4AF37]/60 rounded-3xl text-center space-y-3 bg-[var(--surface)] transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mx-auto">
                        {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                      </div>

                      <div className="space-y-1">
                        <label className="inline-block px-5 py-2 bg-[#D4AF37] text-black font-black text-xs rounded-xl shadow cursor-pointer hover:brightness-110 transition-all">
                          <span>{uploadingImage ? 'جاري الرفع...' : 'اختر تصميم العرض'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          يُفضل استخدام صورة عالية الدقة مربعة أو مستطيلة (PNG / JPG / WebP)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Or Manual URL Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">أو أدخل رابط الصورة المباشر:</label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none font-mono"
                    />
                  </div>

                  {/* Image Preview */}
                  {(localPreviewUrl || formData.imageUrl) && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--text-primary)] block">معاينة التصميم:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalPreviewUrl(null);
                            setFormData((prev) => ({ ...prev, imageUrl: '' }));
                          }}
                          className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>إزالة الصورة</span>
                        </button>
                      </div>

                      <div className="relative w-full max-w-md mx-auto h-56 rounded-2xl overflow-hidden border border-[var(--border)] bg-black/60 shadow-lg group">
                        <img
                          src={localPreviewUrl || getValidImageSrc(formData.imageUrl) || formData.imageUrl}
                          alt="معاينة العرض"
                          className="w-full h-full object-contain"
                        />
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
                            <span className="text-xs font-bold text-white">جاري الرفع إلى Supabase...</span>
                          </div>
                        )}
                        {!uploadingImage && formData.imageUrl && (
                          <div className="absolute bottom-2 left-2 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>تم الحفظ على السحابة</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-elevated)] flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-[var(--text-muted)]">
                المنتجات: {formData.productIds.length} • السعر: {(formData.hasSpecialPrice && formData.bundlePrice > 0 ? formData.bundlePrice : computedOriginalPrice).toLocaleString('ar-EG')} ج.م
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-white"
                >
                  إلغاء
                </button>

                <button
                  form="bundleForm"
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs rounded-xl shadow-lg hover:brightness-110 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingBundle ? 'حفظ التعديلات' : 'نشر العرض المركب'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            dir="rtl"
            className="w-full max-w-sm bg-[#0D1520] border border-[var(--border)] rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-black text-[var(--text-primary)]">تأكيد حذف العرض المركب</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingBundle(null)}
                className="text-[var(--text-muted)] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              هل أنت متأكد من حذف العرض المركب <strong className="text-[var(--text-primary)]">"{deletingBundle.name}"</strong>؟
              <br />
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                ملاحظة: حذف هذا العرض لن يؤثر إطلاقاً على المنتجات الأصلية ولن يغير أسعارها أو مخزونها.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeletingBundle(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>حذف العرض</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
