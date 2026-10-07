import React, { useState, useEffect, useMemo } from 'react';
import { Company, CompanyClickAction, Category, Product } from '../../types';
import { companyService } from '../../lib/data/companyService';
import { categoryService } from '../../lib/data/categoryService';
import { productService } from '../../lib/data/productService';
import { storageService } from '../../lib/data/storageService';
import { getValidImageSrc } from '../../utils/imageUtils';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ExternalLink,
  Upload,
  Loader2,
  AlertTriangle,
  X,
  Package,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Globe,
  Sliders,
  RefreshCw
} from 'lucide-react';

interface AdminCompaniesPageProps {
  navigate?: (path: string) => void;
}

export function AdminCompaniesPage({ navigate }: AdminCompaniesPageProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    logoUrl: string;
    description: string;
    isActive: boolean;
    clickAction: CompanyClickAction;
    targetValue: string;
    sortOrder: number;
    featuredOnHome: boolean;
  }>({
    name: '',
    slug: '',
    logoUrl: '',
    description: '',
    isActive: true,
    clickAction: 'company_page',
    targetValue: '',
    sortOrder: 0,
    featuredOnHome: true
  });

  // Delete Modal State
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [deleteProductCount, setDeleteProductCount] = useState<number>(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [unlinkProductsOption, setUnlinkProductsOption] = useState(true);

  // Product counts map for all companies
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (force = false) => {
    setLoading(true);
    try {
      if (force) companyService.clearCache();
      const [comps, cats, prods] = await Promise.all([
        companyService.getCompanies(true),
        categoryService.getCategories(true),
        productService.getAllProducts(false)
      ]);

      setCompanies(comps);
      setCategories(cats);
      setProducts(prods);

      // Compute product counts per company
      const counts: Record<string, number> = {};
      prods.forEach((p) => {
        if (p.companyId) {
          counts[p.companyId] = (counts[p.companyId] || 0) + 1;
        }
      });
      setProductCounts(counts);
    } catch (err: any) {
      console.error('Failed to load companies data:', err);
      triggerToast('حدث خطأ أثناء تحميل بيانات الشركات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? c.isActive
          : !c.isActive;

      return matchSearch && matchStatus;
    });
  }, [companies, searchQuery, statusFilter]);

  const handleOpenAddModal = () => {
    setEditingCompany(null);
    setFormData({
      name: '',
      slug: '',
      logoUrl: '',
      description: '',
      isActive: true,
      clickAction: 'company_page',
      targetValue: '',
      sortOrder: companies.length + 1,
      featuredOnHome: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl || '',
      description: company.description || '',
      isActive: company.isActive !== false,
      clickAction: company.clickAction || 'company_page',
      targetValue: company.targetValue || '',
      sortOrder: company.sortOrder ?? 0,
      featuredOnHome: company.featuredOnHome !== false
    });
    setIsModalOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const optimizedBlob = await storageService.optimizeImage(file);
      const fileName = `${Date.now()}_${file.name.replace(/\.[^/.]+$/, '')}.webp`;
      const publicUrl = await storageService.uploadFile(optimizedBlob, fileName, 'companies');
      setFormData((prev) => ({ ...prev, logoUrl: publicUrl }));
      triggerToast('تم رفع شعار الشركة بنجاح عبر Supabase Storage.');
    } catch (err: any) {
      console.error('Logo upload error:', err);
      triggerToast(err?.message || 'فشل رفع الشعار.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      triggerToast('يرجى كتابة اسم الشركة.');
      return;
    }

    setSaving(true);
    try {
      if (editingCompany) {
        await companyService.updateCompany(editingCompany.id, formData);
        triggerToast(`تم تحديث شركة "${formData.name}" بنجاح.`);
      } else {
        await companyService.createCompany(formData);
        triggerToast(`تم إنشاء شركة "${formData.name}" بنجاح.`);
      }
      setIsModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      console.error('Save company error:', err);
      triggerToast(err?.message || 'فشل حفظ الشركة.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeleteModal = (company: Company) => {
    const count = productCounts[company.id] || 0;
    setDeletingCompany(company);
    setDeleteProductCount(count);
    setUnlinkProductsOption(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCompany) return;
    setDeleteLoading(true);
    try {
      await companyService.deleteCompany(deletingCompany.id, unlinkProductsOption);
      triggerToast(
        deleteProductCount > 0 && unlinkProductsOption
          ? `تم حذف الشركة وفصل ${deleteProductCount} منتج مرتبط بأمان.`
          : `تم حذف الشركة "${deletingCompany.name}" بنجاح.`
      );
      setDeletingCompany(null);
      await loadData(true);
    } catch (err: any) {
      console.error('Delete company error:', err);
      triggerToast(err?.message || 'فشل حذف الشركة.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleStatus = async (company: Company) => {
    try {
      const nextStatus = !company.isActive;
      await companyService.updateCompany(company.id, { isActive: nextStatus });
      setCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, isActive: nextStatus } : c))
      );
      triggerToast(nextStatus ? 'تم تفعيل الشركة.' : 'تم إيقاف الشركة.');
    } catch (err: any) {
      triggerToast('تعذر تغيير حالة الشركة.');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1E293B] border border-[#D4AF37]/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-3xl border border-[var(--border)]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center text-[#D4AF37]">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[var(--text-primary)]">
              إدارة الشركات والعلامات التجارية (Brands)
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              إضافة وتعديل العلامات التجارية، وربطها بالمنتجات مع تخصيص إجراءات النقر والشعارات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-all cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة شركة جديدة</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        <div className="md:col-span-8 relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث باسم الشركة أو الرابط (Slug)..."
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl pr-10 pl-4 py-3 outline-none focus:border-[#D4AF37] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="md:col-span-4 flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none focus:border-[#D4AF37] cursor-pointer"
          >
            <option value="all">جميع الحالات (الكل)</option>
            <option value="active">الشركات النشطة فقط</option>
            <option value="inactive">الشركات المعطلة فقط</option>
          </select>
        </div>
      </div>

      {/* Companies List */}
      {loading ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-3 border border-[var(--border)]">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
          <p className="text-xs font-bold text-[var(--text-secondary)]">جاري تحميل الشركات...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4 border border-[var(--border)]">
          <div className="w-16 h-16 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-[var(--text-primary)]">
              {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد شركات مسجلة حتى الآن'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              أضف الشركات المصنعة لمنتجاتك (مثل: ترونيدو، سامسونج، آبل) لربطها بالمنتجات وعرض شعاراتها وصفحاتها.
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة أول شركة</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((company) => {
            const count = productCounts[company.id] || 0;
            const clickAction = company.clickAction || 'company_page';

            return (
              <div
                key={company.id}
                className="glass-panel-elevated rounded-2xl border border-[var(--border)] p-4 flex flex-col justify-between hover:border-[#D4AF37]/50 transition-all group relative overflow-hidden"
              >
                <div>
                  {/* Top Bar: Logo, Name, Active Toggle */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {company.logoUrl ? (
                        <img
                          src={getValidImageSrc(company.logoUrl)}
                          alt={company.name}
                          className="w-12 h-12 rounded-xl object-contain bg-black/40 p-1 border border-[var(--border)] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-black text-base shrink-0">
                          {company.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-[var(--text-primary)] truncate">
                          {company.name}
                        </h3>
                        <p className="text-[11px] font-mono text-[var(--text-muted)] truncate" dir="ltr">
                          /company/{company.slug}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(company)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 transition-all cursor-pointer ${
                        company.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {company.isActive ? 'نشطة' : 'معطلة'}
                    </button>
                  </div>

                  {/* Description if any */}
                  {company.description && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)]">
                      {company.description}
                    </p>
                  )}

                  {/* Metadata Chips */}
                  <div className="space-y-1.5 mb-4 text-[11px]">
                    <div className="flex items-center justify-between text-[var(--text-secondary)] py-1 border-b border-[var(--border)]">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>المنتجات المرتبطة:</span>
                      </span>
                      <span className="font-bold text-[var(--text-primary)] font-mono">
                        {count.toLocaleString('ar-EG')} منتج
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[var(--text-secondary)] py-1 border-b border-[var(--border)]">
                      <span className="flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
                        <span>الإجراء عند النقر:</span>
                      </span>
                      <span className="font-bold text-sky-400 text-[10px]">
                        {clickAction === 'company_page' && 'صفحة الشركة (/company)'}
                        {clickAction === 'external_url' && 'رابط خارجي مخصص'}
                        {clickAction === 'category' && 'قسم محدد'}
                        {clickAction === 'product' && 'منتج محدد'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
                  {navigate && (
                    <button
                      onClick={() => navigate(`/company/${company.slug || company.id}`)}
                      className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>عرض الصفحة</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 mr-auto">
                    <button
                      onClick={() => handleOpenEditModal(company)}
                      className="p-2 rounded-xl bg-[var(--surface)] hover:bg-[#D4AF37]/15 text-[var(--text-secondary)] hover:text-[#D4AF37] border border-[var(--border)] transition-all cursor-pointer"
                      title="تعديل الشركة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenDeleteModal(company)}
                      className="p-2 rounded-xl bg-[var(--surface)] hover:bg-rose-500/15 text-[var(--text-secondary)] hover:text-rose-400 border border-[var(--border)] transition-all cursor-pointer"
                      title="حذف الشركة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar" dir="rtl">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--surface-elevated)] z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[var(--text-primary)]">
                    {editingCompany ? `تعديل شركة: ${editingCompany.name}` : 'إضافة شركة / علامة تجارية جديدة'}
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    أدخل بيانات الشركة وشعارها وإجراء النقر المخصص
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface)] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveCompany} className="p-6 space-y-5">
              {/* Company Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)]">
                    اسم الشركة / Brand <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: ترونيدو، توشيبا، سامسونج..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-primary)]">
                    الرابط المخصص (Slug)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="يُترك فارغاً للإنشاء التلقائي"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none focus:border-[#D4AF37] font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Logo Upload Section */}
              <div className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                <label className="text-xs font-bold text-[var(--text-primary)] block">
                  شعار الشركة (Logo)
                </label>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  يتم رفع الشعار مباشرة إلى Supabase Storage وحفظ الرابط الآمن. يُفضل صورة PNG بخلفية شفافة أو WebP.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  {formData.logoUrl ? (
                    <div className="relative w-20 h-20 rounded-2xl bg-black/50 border border-[#D4AF37]/50 p-1.5 flex items-center justify-center shrink-0">
                      <img
                        src={getValidImageSrc(formData.logoUrl)}
                        alt="Logo Preview"
                        className="max-w-full max-h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, logoUrl: '' }))}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-[var(--surface-elevated)] border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center text-[var(--text-muted)] shrink-0">
                      <Building2 className="w-7 h-7 mb-1 opacity-40" />
                      <span className="text-[9px]">لا يوجد شعار</span>
                    </div>
                  )}

                  <div className="flex-1 w-full space-y-2">
                    <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[#D4AF37] text-xs font-bold text-[var(--text-primary)] cursor-pointer transition-all">
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                          <span>جاري الرفع إلى Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-[#D4AF37]" />
                          <span>رفع شعار جديد</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingLogo}
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="url"
                      value={formData.logoUrl}
                      onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                      placeholder="أو الصق رابط صورة الشعار مباشرة..."
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-[11px] rounded-xl p-2.5 outline-none focus:border-[#D4AF37] font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-primary)]">
                  وصف تعريفي للشركة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="مثال: ترونيدو الرائدة في تصنيع الأجهزة المنزلية بضمان شامل..."
                  className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Click Action Settings */}
              <div className="space-y-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
                <label className="text-xs font-black text-[#D4AF37] block">
                  الإجراء عند الضغط على شعار الشركة
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">نوع الإجراء:</label>
                    <select
                      value={formData.clickAction}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          clickAction: e.target.value as CompanyClickAction,
                          targetValue: ''
                        }))
                      }
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="company_page">A. صفحة الشركة المخصصة (/company/{formData.slug || 'slug'})</option>
                      <option value="external_url">B. رابط خارجي مخصص (URL)</option>
                      <option value="category">C. قسم محدد داخل المتجر (Category)</option>
                      <option value="product">D. منتج محدد داخل المتجر (Product)</option>
                    </select>
                  </div>

                  {/* Dynamic Target Value Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)]">الهدف / القيمة:</label>
                    {formData.clickAction === 'company_page' && (
                      <div className="p-2.5 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] text-[11px] text-[var(--text-muted)] font-mono">
                        /company/{formData.slug || 'company-slug'}
                      </div>
                    )}

                    {formData.clickAction === 'external_url' && (
                      <input
                        type="url"
                        value={formData.targetValue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, targetValue: e.target.value }))}
                        placeholder="https://example.com/brand"
                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37] font-mono"
                        dir="ltr"
                      />
                    )}

                    {formData.clickAction === 'category' && (
                      <select
                        value={formData.targetValue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, targetValue: e.target.value }))}
                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37] cursor-pointer"
                      >
                        <option value="">-- اختر القسم المستهدف --</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.slug || cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {formData.clickAction === 'product' && (
                      <select
                        value={formData.targetValue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, targetValue: e.target.value }))}
                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-2.5 outline-none focus:border-[#D4AF37] cursor-pointer"
                      >
                        <option value="">-- اختر المنتج المستهدف --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.slug || p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Status and Sort Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] cursor-pointer hover:border-[#D4AF37]/50">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded text-[#D4AF37] accent-[#D4AF37] cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">تفعيل الشركة</span>
                    <span className="text-[10px] text-[var(--text-muted)]">إظهار الشعار والصفحة للعملاء</span>
                  </div>
                </label>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[var(--text-primary)]">ترتيب الظهور (Sort Order)</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving || uploadingLogo}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-[#D4AF37]/20 hover:brightness-110 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingCompany ? 'حفظ التعديلات' : 'إنشاء الشركة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--surface-elevated)] border border-rose-500/30 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                تأكيد حذف الشركة "{deletingCompany.name}"
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                هل أنت متأكد من رغبتك في حذف هذه الشركة؟
              </p>
            </div>

            {/* Warning if products are linked */}
            {deleteProductCount > 0 ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2.5 text-xs text-amber-300">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>تنبيه أمان البيانات:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  هذه الشركة مرتبطة بعدد <strong className="text-white font-mono">{deleteProductCount}</strong> من المنتجات في متجرك. لن يتم حذف المنتجات نهائياً.
                </p>

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unlinkProductsOption}
                    onChange={(e) => setUnlinkProductsOption(e.target.checked)}
                    className="w-4 h-4 text-[#D4AF37] accent-[#D4AF37] rounded"
                  />
                  <span className="text-[11px] font-bold text-white">
                    فصل الشركة من المنتجات المرتبطة بأمان مع إبقاء المنتجات سليمة
                  </span>
                </label>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)] text-center">
                لا توجد منتجات مرتبطة بهذه الشركة حالياً.
              </p>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCompany(null)}
                className="px-5 py-2.5 rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white font-bold text-xs cursor-pointer"
              >
                تراجع
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>نعم، حذف الشركة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
