import React, { useState, useEffect, useMemo } from 'react';
import { Promotion, Product, Category, HeroBanner, PromotionDiscountType } from '../../types';
import { promotionService } from '../../lib/data/promotionService';
import { productService } from '../../lib/data/productService';
import { categoryService } from '../../lib/data/categoryService';
import { homepageService } from '../../lib/data/homepageService';
import { getEffectiveProductPrice } from '../../lib/campaignPricing';
import { FlashSaleCountdown } from '../../components/FlashSaleCountdown';
import {
  Flame,
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
  ArrowRight
} from 'lucide-react';

export function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter / Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'flash' | 'expired'>('all');

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formBadgeText, setFormBadgeText] = useState('عرض لفترة محدودة');
  const [formDescription, setFormDescription] = useState('');
  const [formIsFlashSale, setFormIsFlashSale] = useState(true);
  const [formDiscountType, setFormDiscountType] = useState<PromotionDiscountType>('fixed_price');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(0);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formPriority, setFormPriority] = useState<number>(10);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSelectedProductIds, setFormSelectedProductIds] = useState<string[]>([]);
  const [formSelectedCategoryIds, setFormSelectedCategoryIds] = useState<string[]>([]);
  const [formBannerId, setFormBannerId] = useState<string>('');

  // Product selection drawer search
  const [productSearch, setProductSearch] = useState('');

  // Preview Modal State
  const [previewPromotion, setPreviewPromotion] = useState<Promotion | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [promos, prods, cats, banList] = await Promise.all([
        promotionService.getAllPromotions(),
        productService.getAllProducts(true),
        categoryService.getCategories(),
        homepageService.getHomeBanners().catch(() => [])
      ]);

      setPromotions(promos);
      setProducts(prods);
      setCategories(cats);
      setBanners(banList);
    } catch (err) {
      console.error('Failed to load promotions data:', err);
      showToast('تعذر تحميل بيانات العروض الترويجية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    const now = new Date();
    const future = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours later

    const formatForInput = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${mins}`;
    };

    setEditingPromotion(null);
    setFormName('');
    setFormBadgeText('عرض لفترة محدودة');
    setFormDescription('');
    setFormIsFlashSale(true);
    setFormDiscountType('fixed_price');
    setFormDiscountValue(0);
    setFormStartDate(formatForInput(now));
    setFormEndDate(formatForInput(future));
    setFormPriority(10);
    setFormIsActive(true);
    setFormSelectedProductIds([]);
    setFormSelectedCategoryIds([]);
    setFormBannerId('');
    setProductSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingPromotion(promo);
    setFormName(promo.name);
    setFormBadgeText(promo.badgeText || 'عرض لفترة محدودة');
    setFormDescription(promo.description || '');
    setFormIsFlashSale(promo.isFlashSale);
    setFormDiscountType(promo.discountType);
    const val =
      promo.discountType === 'fixed_price'
        ? promo.promotionPrice || 0
        : promo.discountType === 'percentage'
        ? promo.discountPercent || 0
        : promo.discountAmount || 0;
    setFormDiscountValue(val);
    setFormStartDate(promo.startDate);
    setFormEndDate(promo.endDate);
    setFormPriority(promo.priority || 0);
    setFormIsActive(promo.isActive);
    setFormSelectedProductIds(promo.productIds || []);
    setFormSelectedCategoryIds(promo.categoryIds || []);
    setFormBannerId(promo.bannerId || '');
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('يرجى كتابة اسم العرض');
      return;
    }

    if (!formStartDate || !formEndDate) {
      showToast('يرجى تحديد موعد البداية والنهاية');
      return;
    }

    if (new Date(formEndDate).getTime() <= new Date(formStartDate).getTime()) {
      showToast('تاريخ انتهاء العرض يجب أن يكون بعد تاريخ البداية');
      return;
    }

    if (formSelectedProductIds.length === 0 && formSelectedCategoryIds.length === 0) {
      showToast('يرجى اختيار منتج واحد على الأقل أو قسم');
      return;
    }

    if (formDiscountValue <= 0) {
      showToast('يرجى تحديد قيمة خصم أو سعر ترويجي صالح');
      return;
    }

    try {
      setSaving(true);
      const promoData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formName.trim(),
        badgeText: formBadgeText.trim() || undefined,
        description: formDescription.trim() || undefined,
        isFlashSale: formIsFlashSale,
        discountType: formDiscountType,
        promotionPrice: formDiscountType === 'fixed_price' ? Number(formDiscountValue) : undefined,
        discountPercent: formDiscountType === 'percentage' ? Number(formDiscountValue) : undefined,
        discountAmount: formDiscountType === 'fixed_discount' ? Number(formDiscountValue) : undefined,
        startDate: formStartDate,
        endDate: formEndDate,
        priority: Number(formPriority) || 0,
        isActive: formIsActive,
        productIds: formSelectedProductIds,
        categoryIds: formSelectedCategoryIds,
        bannerId: formBannerId || undefined
      };

      if (editingPromotion) {
        await promotionService.updatePromotion(editingPromotion.id, promoData);
        showToast('تم تحديث العرض بنجاح');
      } else {
        await promotionService.createPromotion(promoData);
        showToast('تم إنشاء العرض الترويجي بنجاح');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to save promotion:', err);
      showToast('حدث خطأ أثناء حفظ العرض');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      await promotionService.togglePromotionActive(promo.id, !promo.isActive);
      showToast(promo.isActive ? 'تم إيقاف العرض' : 'تم تفعيل العرض');
      loadData();
    } catch (err) {
      console.error('Failed to toggle promotion:', err);
      showToast('حدث خطأ أثناء تغيير حالة العرض');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await promotionService.deletePromotion(id);
      showToast('تم حذف العرض بنجاح');
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete promotion:', err);
      showToast('حدث خطأ أثناء حذف العرض');
    }
  };

  // Detect live conflict warnings for the form
  const formConflicts = useMemo(() => {
    if (!isModalOpen) return [];
    const tempPromo: Promotion = {
      id: editingPromotion ? editingPromotion.id : 'temp',
      name: formName || 'عرض جديد',
      isFlashSale: formIsFlashSale,
      discountType: formDiscountType,
      promotionPrice: formDiscountType === 'fixed_price' ? formDiscountValue : undefined,
      discountPercent: formDiscountType === 'percentage' ? formDiscountValue : undefined,
      discountAmount: formDiscountType === 'fixed_discount' ? formDiscountValue : undefined,
      startDate: formStartDate,
      endDate: formEndDate,
      priority: formPriority,
      isActive: formIsActive,
      productIds: formSelectedProductIds,
      categoryIds: formSelectedCategoryIds,
      createdAt: '',
      updatedAt: ''
    };

    return promotionService.detectConflicts(
      tempPromo,
      promotions.filter((p) => p.id !== (editingPromotion?.id || 'temp'))
    );
  }, [
    isModalOpen,
    editingPromotion,
    formName,
    formIsFlashSale,
    formDiscountType,
    formDiscountValue,
    formStartDate,
    formEndDate,
    formPriority,
    formIsActive,
    formSelectedProductIds,
    formSelectedCategoryIds,
    promotions
  ]);

  // Affected products preview calculation for the modal
  const affectedProductsPreview = useMemo(() => {
    if (!isModalOpen) return [];
    return products.filter((prod) => {
      const matchProduct = formSelectedProductIds.includes(prod.id);
      const matchCategory = Boolean(prod.categoryId && formSelectedCategoryIds.includes(prod.categoryId));
      return matchProduct || matchCategory;
    }).map((prod) => {
      let simulatedEffectivePrice = prod.price;
      if (formDiscountType === 'fixed_price') {
        simulatedEffectivePrice = Math.min(prod.price, formDiscountValue);
      } else if (formDiscountType === 'percentage') {
        simulatedEffectivePrice = Math.round(prod.price * (1 - formDiscountValue / 100));
      } else if (formDiscountType === 'fixed_discount') {
        simulatedEffectivePrice = Math.max(0, prod.price - formDiscountValue);
      }

      const savings = Math.max(0, prod.price - simulatedEffectivePrice);
      const discountPercent = prod.price > 0 ? Math.round((savings / prod.price) * 100) : 0;

      return {
        product: prod,
        originalBasePrice: prod.price,
        effectivePrice: simulatedEffectivePrice,
        savings,
        discountPercent
      };
    });
  }, [
    isModalOpen,
    products,
    formSelectedProductIds,
    formSelectedCategoryIds,
    formDiscountType,
    formDiscountValue
  ]);

  // Filtered promotions list
  const filteredPromotions = useMemo(() => {
    const now = Date.now();
    return promotions.filter((promo) => {
      const matchesSearch =
        promo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (promo.badgeText && promo.badgeText.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const start = new Date(promo.startDate).getTime();
      const end = new Date(promo.endDate).getTime();
      const isCurrentlyActive = promo.isActive && now >= start && now <= end;
      const isExpired = now > end;

      if (filterType === 'active') return isCurrentlyActive;
      if (filterType === 'flash') return promo.isFlashSale;
      if (filterType === 'expired') return isExpired;

      return true;
    });
  }, [promotions, searchQuery, filterType]);

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-elevated)] border border-[#D4AF37] text-[var(--text-primary)] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0 shadow-lg">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              محرك العروض والفلاش سيل (Promotions Engine)
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              إدارة الخصومات الحية والعروض المحدودة بوقت بدون المساس بأسعار المنتجات الأصلية.
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-xs shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء عرض جديد</span>
        </button>
      </div>

      {/* Rules Reassurance Card */}
      <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-between gap-4 flex-wrap text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>الأسعار الأساسية في قاعدة البيانات آمنة وثابتة، يتم احتساب السعر الترويجي لحظياً وقت البيع.</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <span>ينتهي العرض تلقائياً فور انتهاء المهلة المحددة ويعود المنتج لسعره الطبيعي بدون أي تدخل يدوي.</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="البحث في العروض..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl pr-10 pl-4 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full sm:w-auto overflow-x-auto">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'active', label: 'النشطة حالياً' },
            { key: 'flash', label: 'فلاش سيل فقط' },
            { key: 'expired', label: 'المنتهية' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === tab.key
                  ? 'bg-gradient-to-r from-rose-500/20 to-amber-500/20 text-rose-500 border border-rose-500/30'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Promotions List */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <p className="text-xs">جاري تحميل العروض الترويجية...</p>
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-[var(--surface)] p-12 text-center rounded-3xl border border-[var(--border)] shadow-sm space-y-3">
          <Flame className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">لا توجد عروض ترويجية مطابقة</h3>
          <p className="text-xs text-[var(--text-secondary)]">يمكنك البدء بإنشاء عرض فلاش سيل جديد لتنشيط مبيعات المتجر.</p>
          <button
            onClick={openCreateModal}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs font-bold shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء أول عرض</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPromotions.map((promo) => {
            const now = Date.now();
            const start = new Date(promo.startDate).getTime();
            const end = new Date(promo.endDate).getTime();
            const isLive = promo.isActive && now >= start && now <= end;
            const isScheduled = promo.isActive && now < start;
            const isExpired = now > end;

            const targetedProducts = products.filter((p) =>
              (promo.productIds && promo.productIds.includes(p.id)) ||
              (p.categoryId && promo.categoryIds && promo.categoryIds.includes(p.categoryId))
            );

            return (
              <div
                key={promo.id}
                className="bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] hover:border-[#D4AF37]/30 transition-all shadow-sm space-y-4 relative overflow-hidden group"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                      promo.isFlashSale
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    }`}>
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-[var(--text-primary)]">{promo.name}</h3>
                        {promo.isFlashSale && (
                          <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                            فلاش سيل
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--surface-elevated)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                          أولوية: {promo.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {promo.badgeText || 'عرض ترويجي'}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>نشط الآن</span>
                      </span>
                    ) : isScheduled ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-sky-500 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full">
                        <Calendar className="w-3 h-3" />
                        <span>مجدول لاحقاً</span>
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-[var(--text-muted)] bg-[var(--surface-elevated)] border border-[var(--border)] px-2.5 py-1 rounded-full">
                        <XCircle className="w-3 h-3" />
                        <span>منتهي الصلاحية</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        <span>متوقف يدويًا</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Countdown if currently active */}
                {isLive && promo.isFlashSale && (
                  <div className="bg-gradient-to-r from-rose-500/5 via-amber-500/5 to-transparent p-3 rounded-2xl border border-rose-500/10 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-bold">
                      <span className="flex items-center gap-1 text-rose-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>العداد الحي للعملاء:</span>
                      </span>
                      <span>ينتهي في: {new Date(promo.endDate).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <FlashSaleCountdown endDate={promo.endDate} onExpire={loadData} />
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-elevated)] p-3 rounded-2xl border border-[var(--border)]">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">نوع الخصم / السعر:</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {promo.discountType === 'fixed_price'
                        ? `سعر موحد: ${(promo.promotionPrice || 0).toLocaleString('ar-EG')} ج.م`
                        : promo.discountType === 'percentage'
                        ? `خصم ${promo.discountPercent || 0}%`
                        : `خصم ${(promo.discountAmount || 0).toLocaleString('ar-EG')} ج.م`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">المنتجات المشمولة:</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {targetedProducts.length} منتج
                      {promo.categoryIds && promo.categoryIds.length > 0 && ` (${promo.categoryIds.length} قسم)`}
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(promo)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        promo.isActive
                          ? 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'
                          : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                      }`}
                    >
                      {promo.isActive ? 'إيقاف مؤقت' : 'تفعيل'}
                    </button>
                    <button
                      onClick={() => setPreviewPromotion(promo)}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-[var(--surface)] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>معاينة ({targetedProducts.length})</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(promo)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-xl transition-all cursor-pointer"
                      title="تعديل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(promo.id)}
                      className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                      title="حذف"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface-elevated)] p-6 rounded-3xl border border-rose-500/30 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">تأكيد حذف العرض الترويجي</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              هل أنت متأكد من رغبتك في حذف هذا العرض نهائياً؟ ستعود جميع المنتجات المرتبطة به لأسعارها الطبيعية فوراً.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-500/30 hover:bg-rose-600 cursor-pointer"
              >
                نعم، احذف العرض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                    {editingPromotion ? 'تعديل العرض الترويجي' : 'إنشاء عرض فلاش سيل / ترويجي جديد'}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    حدد نوع الخصم، المنتجات المستهدفة، ومواعيد البداية والنهاية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Conflict Warning Banner if detected */}
            {formConflicts.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>تنبيه: تم رصد تعارض مع عروض ترويجية نشطة أخرى!</span>
                </div>
                <p className="text-[11px] opacity-90">
                  بعض المنتجات المحددة مشمولة حالياً في عروض أخرى ({Array.from(new Set(formConflicts.map((c) => c.conflictingPromotionName))).join('، ')}).
                  وفقاً لنظام الأولوية، سيتم تطبيق العرض ذو رقم الأولوية الأعلى ({formPriority}).
                </p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* Row 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)]">اسم العرض الترويجي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فلاش سيل نهاية الأسبوع"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl px-4 py-2.5 text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)]">نص الشارة / البادج</label>
                  <input
                    type="text"
                    placeholder="مثال: عرض لفترة محدودة"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl px-4 py-2.5 text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
              </div>

              {/* Row 2: Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[var(--surface-elevated)] p-4 rounded-2xl border border-[var(--border)]">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)]">طريقة تحديد السعر</label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value as PromotionDiscountType)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl px-3 py-2.5 text-xs text-[var(--text-primary)] outline-none cursor-pointer appearance-none"
                  >
                    <option value="fixed_price">سعر بيع موحد (Fixed Selling Price)</option>
                    <option value="percentage">نسبة مئوية من السعر الأساسي (%)</option>
                    <option value="fixed_discount">خصم مبلغ ثابت (Fixed Amount Off)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)]">
                    {formDiscountType === 'fixed_price'
                      ? 'السعر الترويجي النهائي (ج.م) *'
                      : formDiscountType === 'percentage'
                      ? 'نسبة الخصم (%) *'
                      : 'قيمة الخصم المقتطع (ج.م) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={formDiscountValue || ''}
                    onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl px-4 py-2.5 text-xs text-[var(--text-primary)] outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)]">رقم الأولوية (Priority)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl px-4 py-2.5 text-xs text-[var(--text-primary)] outline-none"
                    placeholder="10"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    الرقم الأعلى يفوز في حال تداخل منتج بين أكثر من عرض.
                  </span>
                </div>
              </div>

              {/* Row 3: Schedule Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    <span>تاريخ ووقت البداية *</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl px-4 py-2 text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    <span>تاريخ ووقت النهاية (انتهاء العرض) *</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-rose-500/50 rounded-2xl px-4 py-2 text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Toggles (Flash sale, active, banner linkage) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <label className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] cursor-pointer hover:bg-[var(--surface)] transition-all">
                  <input
                    type="checkbox"
                    checked={formIsFlashSale}
                    onChange={(e) => setFormIsFlashSale(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-500 focus:ring-0 accent-rose-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">تفعيل وضع الفلاش سيل</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">يُظهر عداد تنازلي وشارة عروض محدودة</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] cursor-pointer hover:bg-[var(--surface)] transition-all">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 accent-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">العرض مفعل</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">يمكن إيقافه يدوياً في أي وقت</span>
                  </div>
                </label>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text-muted)]">ربط مع بانر رئيسي (اختياري)</label>
                  <select
                    value={formBannerId}
                    onChange={(e) => setFormBannerId(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none cursor-pointer appearance-none"
                  >
                    <option value="">-- بدون ربط بانر --</option>
                    {banners.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[var(--surface)]">
                        {b.title} {b.placements?.length ? `(${b.placements.join(', ')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product & Category Selector */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[var(--text-primary)] flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#D4AF37]" />
                    <span>المنتجات المستهدفة ({formSelectedProductIds.length} محدد)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormSelectedProductIds(products.map((p) => p.id))}
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-[var(--border)]">|</span>
                    <button
                      type="button"
                      onClick={() => setFormSelectedProductIds([])}
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                {/* Search in product selector */}
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو القسم لتحديد المنتجات..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none"
                />

                {/* Product Selection List */}
                <div className="max-h-52 overflow-y-auto bg-[var(--surface-elevated)] border border-[var(--border)] rounded-2xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {products
                    .filter((p) =>
                      productSearch
                        ? p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.categoryName && p.categoryName.toLowerCase().includes(productSearch.toLowerCase()))
                        : true
                    )
                    .map((prod) => {
                      const isSelected = formSelectedProductIds.includes(prod.id);
                      return (
                        <div
                          key={prod.id}
                          onClick={() => {
                            if (isSelected) {
                              setFormSelectedProductIds(formSelectedProductIds.filter((id) => id !== prod.id));
                            } else {
                              setFormSelectedProductIds([...formSelectedProductIds, prod.id]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-rose-500/10 border-rose-500/20 text-[var(--text-primary)]'
                              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-rose-500 accent-rose-500"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate text-[var(--text-primary)]">{prod.name}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                {prod.price.toLocaleString('ar-EG')} ج.م • {prod.categoryName || 'قسم آخر'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Live Preview of Affected Products in Modal */}
              {affectedProductsPreview.length > 0 && (
                <div className="space-y-2 pt-2 bg-[var(--surface-elevated)] p-4 rounded-2xl border border-[var(--border)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#E0B84A] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>معاينة الأسعار الناتجة ({affectedProductsPreview.length} منتج)</span>
                    </span>
                    <span className="text-[10px] text-emerald-500 font-bold">
                      السعر الأساسي لا يتغير في قاعدة البيانات
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {affectedProductsPreview.map(({ product, originalBasePrice, effectivePrice, savings, discountPercent }) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between text-xs p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                      >
                        <span className="font-bold text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-xs">
                          {product.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--text-muted)] line-through text-[11px]">
                            {originalBasePrice.toLocaleString('ar-EG')} ج.م
                          </span>
                          <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                          <span className="font-black text-[var(--text-primary)]">
                            {effectivePrice.toLocaleString('ar-EG')} ج.م
                          </span>
                          <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                            وفر {savings.toLocaleString('ar-EG')} ج.م ({discountPercent}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-xs shadow-lg shadow-rose-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>{editingPromotion ? 'حفظ التعديلات' : 'تأكيد وإنشاء العرض'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standalone Preview Modal for existing promotion */}
      {previewPromotion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-base font-black text-[var(--text-primary)]">{previewPromotion.name}</h3>
                <p className="text-xs text-[var(--text-secondary)]">معاينة المنتجات المشمولة والأسعار الترويجية</p>
              </div>
              <button
                onClick={() => setPreviewPromotion(null)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {products
                .filter(
                  (p) =>
                    (previewPromotion.productIds && previewPromotion.productIds.includes(p.id)) ||
                    (p.categoryId && previewPromotion.categoryIds && previewPromotion.categoryIds.includes(p.categoryId))
                )
                .map((prod) => {
                  const pricing = getEffectiveProductPrice(prod, [], [previewPromotion]);
                  return (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{prod.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{prod.categoryName || 'قسم آخر'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-muted)] line-through">
                          {pricing.originalBasePrice.toLocaleString('ar-EG')} ج.م
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="text-xs font-black text-[var(--text-primary)]">
                          {pricing.effectivePrice.toLocaleString('ar-EG')} ج.م
                        </span>
                        {pricing.savingsAmount && (
                          <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            وفر {pricing.savingsAmount.toLocaleString('ar-EG')} ج.م ({pricing.discountPercent}%)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => setPreviewPromotion(null)}
                className="px-5 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
