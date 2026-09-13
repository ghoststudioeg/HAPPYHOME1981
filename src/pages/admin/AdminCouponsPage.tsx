import React, { useState, useEffect } from 'react';
import { 
  Ticket, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  DollarSign, 
  Percent, 
  Users, 
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Package,
  Layers
} from 'lucide-react';
import { couponService } from '../../lib/data/couponService';
import { productService } from '../../lib/data/productService';
import { categoryService } from '../../lib/data/categoryService';
import { Coupon, CouponType, Product, Category } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

export function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [type, setType] = useState<CouponType>('percentage');
  const [value, setValue] = useState(0);
  const [minimumOrder, setMinimumOrder] = useState<number | undefined>(undefined);
  const [maximumDiscount, setMaximumDiscount] = useState<number | undefined>(undefined);
  const [usageLimit, setUsageLimit] = useState<number | undefined>(undefined);
  const [perCustomerLimit, setPerCustomerLimit] = useState<number | undefined>(undefined);
  const [startAt, setStartAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [active, setActive] = useState(true);
  const [applicableProductIds, setApplicableProductIds] = useState<string[]>([]);
  const [applicableCategoryIds, setApplicableCategoryIds] = useState<string[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [allCoupons, allProducts, allCategories] = await Promise.all([
        couponService.getAllCoupons(),
        productService.getAllProducts(),
        categoryService.getCategories(true)
      ]);
      setCoupons(allCoupons);
      setProducts(allProducts);
      setCategories(allCategories);
    } catch (err) {
      console.error('Failed to load coupons data:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenForm = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setCode(coupon.code);
      setType(coupon.type);
      setValue(coupon.value);
      setMinimumOrder(coupon.minimumOrder);
      setMaximumDiscount(coupon.maximumDiscount);
      setUsageLimit(coupon.usageLimit);
      setPerCustomerLimit(coupon.perCustomerLimit);
      setStartAt(coupon.startAt ? new Date(coupon.startAt).toISOString().slice(0, 16) : '');
      setExpiresAt(coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : '');
      setActive(coupon.active);
      setApplicableProductIds(coupon.applicableProductIds || []);
      setApplicableCategoryIds(coupon.applicableCategoryIds || []);
    } else {
      setEditingCoupon(null);
      setCode('');
      setType('percentage');
      setValue(0);
      setMinimumOrder(undefined);
      setMaximumDiscount(undefined);
      setUsageLimit(undefined);
      setPerCustomerLimit(1);
      setStartAt('');
      setExpiresAt('');
      setActive(true);
      setApplicableProductIds([]);
      setApplicableCategoryIds([]);
    }
    setIsFormOpen(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || value <= 0) {
      setError('يرجى إدخال الكود وقيمة الخصم');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await couponService.saveCoupon({
        id: editingCoupon?.id,
        code,
        type,
        value,
        minimumOrder,
        maximumDiscount,
        usageLimit,
        usedCount: editingCoupon?.usedCount || 0,
        perCustomerLimit,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        active,
        applicableProductIds,
        applicableCategoryIds
      });
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل حفظ الكوبون');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;
    try {
      await couponService.deleteCoupon(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete coupon:', err);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      await couponService.saveCoupon({ ...coupon, active: !coupon.active });
      loadData();
    } catch (err) {
      console.error('Failed to toggle coupon status:', err);
    }
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatus = (coupon: Coupon) => {
    const now = new Date();
    if (!coupon.active) return { label: 'غير مفعل', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20' };
    if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) return { label: 'مستنفد', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return { label: 'منتهي', color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20' };
    if (coupon.startAt && new Date(coupon.startAt) > now) return { label: 'مجدول', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' };
    return { label: 'نشط', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  };

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
            <Ticket className="w-7 h-7 text-[#D4AF37]" />
            <span>إدارة قسائم الخصم (Coupons)</span>
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">قم بإنشاء وتعديل وإدارة أكواد الخصم والعروض الترويجية</p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="h-11 px-6 rounded-xl bg-[#D4AF37] hover:bg-[#E0B84A] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>كوبون جديد</span>
        </button>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">إجمالي الكوبونات</p>
            <h3 className="text-xl font-black text-[var(--text-primary)] font-mono">{coupons.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shadow-sm">
            <Ticket className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">الكوبونات النشطة</p>
            <h3 className="text-xl font-black text-emerald-500 font-mono">
              {coupons.filter(c => getStatus(c).label === 'نشط').length}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">إجمالي الاستخدامات</p>
            <h3 className="text-xl font-black text-[#D4AF37] font-mono">
              {coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">الأكثر استخداماً</p>
            <h3 className="text-xs font-black text-sky-500 truncate max-w-[150px]">
              {(() => {
                const sorted = [...coupons].sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0));
                const top = sorted[0];
                return top && (top.usedCount || 0) > 0 ? `${top.code} (${top.usedCount})` : 'لا يوجد حالياً';
              })()}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 shadow-sm">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="البحث بكود الخصم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pr-11 pl-4 bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] rounded-xl text-sm text-[var(--text-primary)] outline-none transition-all"
          />
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
            <p className="text-xs text-[var(--text-muted)]">جاري تحميل البيانات...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)] shadow-sm">
              <Ticket className="w-8 h-8" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">لا توجد كوبونات مطابقة لبحثك</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)]">
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">الكود</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">النوع / القيمة</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">الاستخدام</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">الصلاحية</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredCoupons.map((coupon) => {
                  const status = getStatus(coupon);
                  return (
                    <tr key={coupon.id} className="group hover:bg-[var(--surface-elevated)]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20 shadow-sm">
                            <Ticket className="w-5 h-5 text-[#D4AF37]" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[var(--text-primary)] tracking-widest">{coupon.code}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">
                              {coupon.applicableProductIds.length > 0 || coupon.applicableCategoryIds.length > 0 
                                ? 'منتجات محددة' 
                                : 'كل المتجر'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-[#D4AF37]">
                            {coupon.type === 'percentage' ? `${coupon.value}%` : `${coupon.value} ج.م`}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {coupon.type === 'percentage' ? 'خصم مئوي' : 'مبلغ ثابت'}
                          </span>
                        </div>
                        {coupon.minimumOrder && (
                          <p className="text-[9px] text-[var(--text-muted)]">للطلبات فوق {coupon.minimumOrder} ج.م</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black border ${status.color.replace('rose-400', 'rose-500').replace('emerald-400', 'emerald-500').replace('amber-400', 'amber-500').replace('sky-400', 'sky-500')}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5 min-w-[120px]">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-[var(--text-muted)]">مرات الاستخدام:</span>
                            <span className="text-[var(--text-primary)]">
                              {coupon.usedCount}
                              {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' / ∞'}
                            </span>
                          </div>
                          {coupon.usageLimit && (
                            <div className="h-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full overflow-hidden shadow-sm">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  (coupon.usedCount / coupon.usageLimit) > 0.9 ? 'bg-rose-500' : 'bg-[#D4AF37]'
                                }`}
                                style={{ width: `${Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                            <Calendar className="w-3 h-3 opacity-50" />
                            <span>
                              {coupon.expiresAt 
                                ? new Date(coupon.expiresAt).toLocaleDateString('ar-EG') 
                                : 'بدون تاريخ انتهاء'}
                            </span>
                          </div>
                          {coupon.expiresAt && (
                            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
                              <Clock className="w-3 h-3 opacity-50" />
                              <span>{new Date(coupon.expiresAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button
                            onClick={() => toggleActive(coupon)}
                            className="p-2 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-muted)] transition-colors shadow-sm"
                            title={coupon.active ? 'إلغاء التفعيل' : 'تفعيل'}
                          >
                            {coupon.active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleOpenForm(coupon)}
                            className="p-2 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-[var(--surface)] text-sky-500 transition-colors shadow-sm"
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(coupon.id)}
                            className="p-2 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-rose-500/10 text-rose-500 transition-colors shadow-sm"
                            title="حذف"
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
        )}
      </div>

      {/* Coupon Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-[var(--surface)] rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-elevated)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20">
                    <Ticket className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-black text-[var(--text-primary)]">
                      {editingCoupon ? 'تعديل كوبون الخصم' : 'إنشاء كوبون جديد'}
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">أدخل تفاصيل الكوبون وشروط الاستخدام</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="w-10 h-10 rounded-xl hover:bg-[var(--surface)] flex items-center justify-center transition-colors text-[var(--text-muted)] border border-transparent hover:border-[var(--border)] shadow-sm"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-8 text-right custom-scrollbar">
                {error && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-3 shadow-sm">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#D4AF37] rounded-full" />
                      الإعدادات الأساسية
                    </h4>
                    
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">كود الخصم (Promo Code)</label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="مثال: RAMADAN20"
                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-black tracking-widest uppercase text-[var(--text-primary)] outline-none transition-all"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">نوع الخصم</label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as CouponType)}
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none transition-all"
                        >
                          <option value="percentage">نسبة مئوية (%)</option>
                          <option value="fixed_amount">مبلغ ثابت (ج.م)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">قيمة الخصم</label>
                        <div className="relative">
                          {type === 'percentage' ? (
                            <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                          ) : (
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                          )}
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(Number(e.target.value))}
                            className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-black text-[var(--text-primary)] outline-none transition-all"
                            required
                            min="0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 text-right">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">تاريخ البدء</label>
                        <input
                          type="datetime-local"
                          value={startAt}
                          onChange={(e) => setStartAt(e.target.value)}
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none transition-all text-right"
                        />
                      </div>
                      <div className="space-y-2 text-right">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">تاريخ الانتهاء</label>
                        <input
                          type="datetime-local"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none transition-all text-right"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] shadow-sm">
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">تفعيل الكوبون</p>
                        <p className="text-[9px] text-[var(--text-muted)]">تحديد ما إذا كان الكود متاحاً للاستخدام حالياً</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActive(!active)}
                        className="transition-all"
                      >
                        {active ? (
                          <ToggleRight className="w-10 h-10 text-[#D4AF37]" />
                        ) : (
                          <ToggleLeft className="w-10 h-10 text-[var(--text-muted)]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Constraints */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-[#D4AF37] uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#D4AF37] rounded-full" />
                      شروط الاستخدام والقيود
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">الحد الأدنى للطلب</label>
                        <input
                          type="number"
                          value={minimumOrder || ''}
                          onChange={(e) => setMinimumOrder(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="مثال: 500 ج.م"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">الحد الأقصى للخصم</label>
                        <input
                          type="number"
                          value={maximumDiscount || ''}
                          onChange={(e) => setMaximumDiscount(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="مثال: 200 ج.م"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">إجمالي عدد الاستخدامات</label>
                        <input
                          type="number"
                          value={usageLimit || ''}
                          onChange={(e) => setUsageLimit(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="مثال: 100 مرة"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1">مرات الاستخدام لكل عميل</label>
                        <input
                          type="number"
                          value={perCustomerLimit || ''}
                          onChange={(e) => setPerCustomerLimit(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="مثال: مرة واحدة"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] h-12 px-4 rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1 flex items-center gap-2">
                          <Layers className="w-3 h-3" />
                          <span>الأقسام المشمولة</span>
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 min-h-[50px] bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] shadow-sm">
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setApplicableCategoryIds(prev => 
                                  prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                );
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border shadow-sm ${
                                applicableCategoryIds.includes(cat.id)
                                  ? 'bg-[#D4AF37] text-slate-950 border-[#D4AF37]'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[#D4AF37]/30'
                              }`}
                            >
                              {cat.name}
                            </button>
                          ))}
                          {categories.length === 0 && <p className="text-[9px] text-[var(--text-muted)]">لا توجد أقسام متاحة</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--text-secondary)] pr-1 flex items-center gap-2">
                          <Package className="w-3 h-3" />
                          <span>المنتجات المشمولة (اختياري)</span>
                        </label>
                        <div className="p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] max-h-40 overflow-y-auto space-y-1 shadow-sm custom-scrollbar">
                          {products.map(prod => (
                            <div
                              key={prod.id}
                              onClick={() => {
                                setApplicableProductIds(prev => 
                                  prev.includes(prod.id) ? prev.filter(id => id !== prod.id) : [...prev, prod.id]
                                );
                              }}
                              className={`p-2 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                                applicableProductIds.includes(prod.id)
                                  ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30'
                                  : 'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--surface)] hover:border-[var(--border)]'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${applicableProductIds.includes(prod.id) ? 'bg-[#D4AF37]' : 'bg-[var(--text-muted)]'}`} />
                              <span className="truncate">{prod.name}</span>
                              <span className="text-[8px] opacity-40 mr-auto font-mono">{prod.sku}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-[var(--border)] flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="h-12 px-8 rounded-xl text-[var(--text-secondary)] font-bold text-sm hover:bg-[var(--surface-elevated)] transition-colors border border-transparent hover:border-[var(--border)] shadow-sm"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-12 px-12 rounded-xl bg-[#D4AF37] hover:bg-[#E0B84A] text-slate-950 font-black text-sm shadow-lg shadow-[#D4AF37]/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>حفظ الكوبون</span>
                      </>
                    )}
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
