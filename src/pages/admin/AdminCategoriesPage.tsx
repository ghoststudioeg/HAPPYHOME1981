import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { categoryService } from '../../lib/data/categoryService';
import { storageService } from '../../lib/data/storageService';
import { Category } from '../../types';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { ConfirmDeleteModal } from '../../components/admin/ConfirmDeleteModal';
import {

  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  Check,
  Upload,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle
} from 'lucide-react';

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete Modal state
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [visibility, setVisibility] = useState(true);
  const [sortOrder, setSortOrder] = useState<number>(0);

  // Category Hero Fields
  const [heroEnabled, setHeroEnabled] = useState(false);
  const [heroDesktopImageUrl, setHeroDesktopImageUrl] = useState('');
  const [heroMobileImageUrl, setHeroMobileImageUrl] = useState('');
  const [heroImageSizeMode, setHeroImageSizeMode] = useState<'contain' | 'cover'>('contain');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroBadgeText, setHeroBadgeText] = useState('');
  const [heroCtaText, setHeroCtaText] = useState('');
  const [heroCtaLink, setHeroCtaLink] = useState('');
  const [heroStartDate, setHeroStartDate] = useState('');
  const [heroEndDate, setHeroEndDate] = useState('');
  const [heroProductId, setHeroProductId] = useState('');
  const [uploadingHeroDesktop, setUploadingHeroDesktop] = useState(false);
  const [uploadingHeroMobile, setUploadingHeroMobile] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const cats = await categoryService.getCategories(true);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setImage('https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80');
    setParentId('');
    setVisibility(true);
    setSortOrder(categories.length + 1);
    
    // Reset Hero
    setHeroEnabled(false);
    setHeroDesktopImageUrl('');
    setHeroMobileImageUrl('');
    setHeroImageSizeMode('contain');
    setHeroTitle('');
    setHeroSubtitle('');
    setHeroBadgeText('');
    setHeroCtaText('');
    setHeroCtaLink('');
    setHeroStartDate('');
    setHeroEndDate('');
    setHeroProductId('');

    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setImage(cat.image);
    setParentId(cat.parentId || '');
    setVisibility(cat.visibility !== false);
    setSortOrder(cat.sortOrder || 0);

    // Populate Hero
    const hero = cat.hero || ({} as any);
    setHeroEnabled(!!hero.enabled);
    setHeroDesktopImageUrl(hero.desktopImageUrl || '');
    setHeroMobileImageUrl(hero.mobileImageUrl || '');
    setHeroImageSizeMode(hero.imageSizeMode || 'contain');
    setHeroTitle(hero.title || '');
    setHeroSubtitle(hero.subtitle || '');
    setHeroBadgeText(hero.badgeText || '');
    setHeroCtaText(hero.ctaText || '');
    setHeroCtaLink(hero.ctaLink || '');
    setHeroStartDate(hero.startDate || '');
    setHeroEndDate(hero.endDate || '');
    setHeroProductId(hero.productId || '');

    setFormError(null);
    setModalOpen(true);
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const uploadedUrl = await storageService.uploadCategoryImage(
        editingCategory?.id || 'new-category',
        file
      );
      setImage(uploadedUrl);
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء رفع صورة القسم.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleHeroDesktopFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingHeroDesktop(true);
      const url = await storageService.uploadFile(
        file,
        `desktop_${editingCategory?.id || Date.now()}_${file.name}`,
        'category-heroes'
      );
      setHeroDesktopImageUrl(url);
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء رفع صورة الهيرو للكمبيوتر.');
    } finally {
      setUploadingHeroDesktop(false);
    }
  };

  const handleHeroMobileFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingHeroMobile(true);
      const url = await storageService.uploadFile(
        file,
        `mobile_${editingCategory?.id || Date.now()}_${file.name}`,
        'category-heroes'
      );
      setHeroMobileImageUrl(url);
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء رفع صورة الهيرو للموبايل.');
    } finally {
      setUploadingHeroMobile(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('اسم القسم مطلوب.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const generatedSlug = slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-');

    const heroObj = {
      enabled: heroEnabled,
      desktopImageUrl: heroDesktopImageUrl,
      mobileImageUrl: heroMobileImageUrl,
      imageSizeMode: heroImageSizeMode,
      title: heroTitle,
      subtitle: heroSubtitle,
      badgeText: heroBadgeText,
      ctaText: heroCtaText,
      ctaLink: heroCtaLink,
      startDate: heroStartDate,
      endDate: heroEndDate,
      productId: heroProductId
    };

    try {
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, {
          name: name.trim(),
          slug: generatedSlug,
          description: description.trim(),
          image: image || '',
          parentId: parentId || null,
          visibility,
          sortOrder: Number(sortOrder) || 0,
          hero: heroObj
        });
      } else {
        await categoryService.createCategory({
          name: name.trim(),
          slug: generatedSlug,
          description: description.trim(),
          image: image || '',
          parentId: parentId || null,
          visibility,
          sortOrder: Number(sortOrder) || 0,
          hero: heroObj
        });
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setFormError(err?.message || 'حدث خطأ أثناء حفظ القسم في Firebase.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      await categoryService.deleteCategory(deletingCategory.id);
      setDeletingCategory(null);
      await loadData();
    } catch (err: any) {
      setDeleteError(err?.message || 'تعذر حذف القسم من قاعدة البيانات.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleVisibility = async (cat: Category) => {
    try {
      await categoryService.updateCategory(cat.id, { visibility: !cat.visibility });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    const currentCat = categories[index];
    const targetCat = categories[targetIdx];

    const currentOrder = currentCat.sortOrder || index + 1;
    const targetOrder = targetCat.sortOrder || targetIdx + 1;

    try {
      await Promise.all([
        categoryService.updateCategory(currentCat.id, { sortOrder: targetOrder }),
        categoryService.updateCategory(targetCat.id, { sortOrder: currentOrder })
      ]);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">إدارة الأقسام</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            إضافة وتعديل الأقسام، ترتيب الظهور، وربط الأقسام الفرعية
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="px-5 py-3 bg-[#D4AF37] hover:bg-[#E0B84A] text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#D4AF37]/20"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة قسم جديد</span>
        </button>
      </div>

      {/* Categories Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="p-4">الترتيب</th>
                  <th className="p-4">القسم</th>
                  <th className="p-4">الرابط (Slug)</th>
                  <th className="p-4">القسم الرئيسي</th>
                  <th className="p-4 text-center">الظهور</th>
                  <th className="p-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {categories.map((cat, idx) => (
                  <tr key={cat.id} className="hover:bg-[var(--surface-elevated)]/60 transition-colors">
                    {/* Sort Order buttons */}
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveOrder(idx, 'up')}
                          className="p-1 rounded bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[#D4AF37] disabled:opacity-30 cursor-pointer border border-[var(--border)]"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === categories.length - 1}
                          onClick={() => moveOrder(idx, 'down')}
                          className="p-1 rounded bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[#D4AF37] disabled:opacity-30 cursor-pointer border border-[var(--border)]"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-[var(--text-muted)] mr-1.5">{cat.sortOrder || idx + 1}</span>
                      </div>
                    </td>

                    {/* Category info */}
                    <td className="p-4 flex items-center gap-3">
                      <img
                        src={getValidImageSrc(cat.image)}
                        alt={cat.name}
                        className="w-11 h-11 rounded-lg object-cover bg-[var(--surface-elevated)] border border-[var(--border)] shadow-sm"
                      />
                      <div>
                        <span className="font-bold text-sm text-[var(--text-primary)] block">{cat.name}</span>
                        {cat.description && (
                          <span className="text-[11px] text-[var(--text-muted)] line-clamp-1">{cat.description}</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 font-mono text-[var(--text-secondary)]">{cat.slug}</td>

                    <td className="p-4 text-[var(--text-secondary)]">
                      {cat.parentId ? (
                        <span className="px-2 py-0.5 bg-[var(--surface-elevated)] rounded border border-[var(--border)] text-[11px] text-[#D4AF37]">
                          {cat.parentId}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">رئيسي</span>
                      )}
                    </td>

                    {/* Visibility */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleToggleVisibility(cat)}
                        title={cat.visibility ? 'إخفاء القسم' : 'إظهار القسم'}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          cat.visibility
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]'
                        }`}
                      >
                        {cat.visibility ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(cat)}
                          title="تعديل القسم"
                          className="p-1.5 text-[var(--text-muted)] hover:text-[#D4AF37] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[var(--border)]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingCategory(cat);
                          }}
                          title="حذف القسم"
                          className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-xl my-8 overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-5 bg-[var(--surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                {editingCategory ? 'تعديل قسم' : 'إضافة قسم جديد'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-right custom-scrollbar">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-500 shadow-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-primary)] pr-1">اسم القسم *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingCategory && !slug) {
                      setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }}
                  required
                  placeholder="مثال: شنط مدرسية"
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-primary)] pr-1">الرابط اللطيف (Slug) *</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  dir="ltr"
                  placeholder="school-bags"
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none font-mono transition-all text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-primary)] pr-1">القسم الرئيسي التابع له (اختياري)</label>
                <input
                  type="text"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  placeholder="مثال: إلكترونيات، المنزل، الشنط"
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  اتركه فارغاً ليكون قسماً مستقلاً بذاته
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-primary)] pr-1">صورة القسم</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border)] shrink-0 shadow-sm">
                    <img src={getValidImageSrc(image)} alt="معاينة" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-2 text-right">
                    <input
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="رابط الصورة أو ارفع صورة جديدة"
                      dir="ltr"
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] text-[var(--text-primary)] text-xs rounded-xl py-2 px-3 outline-none transition-all text-right"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-xs font-bold text-[var(--text-primary)] rounded-lg border border-[var(--border)] cursor-pointer transition-all shadow-sm">
                      {uploadingImage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                      )}
                      <span>رفع صورة إلى Firebase</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFile}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-primary)] pr-1">وصف القسم</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مختصر لمحتويات القسم..."
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D4AF37] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                <input
                  type="checkbox"
                  id="cat-vis"
                  checked={visibility}
                  onChange={(e) => setVisibility(e.target.checked)}
                  className="rounded bg-[var(--surface-elevated)] border-[var(--border)] text-[#D4AF37] focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="cat-vis" className="text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                  ظهور القسم في الموقع والكتالوج العام
                </label>
              </div>

              {/* SECTION: Category Hero Banner */}
              <div className="pt-4 border-t border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between bg-[var(--surface-elevated)] p-3 rounded-xl border border-[var(--border)] shadow-sm">
                  <div className="text-right">
                    <h4 className="text-xs font-black text-[var(--text-primary)]">إعدادات Hero الخاص بالقسم</h4>
                    <p className="text-[11px] text-[var(--text-muted)]">عرض بانر هيرو مميز أعلى صفحة هذا القسم</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroEnabled}
                      onChange={(e) => setHeroEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[var(--surface-secondary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--surface)] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-[var(--border)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                  </label>
                </div>

                {heroEnabled && (
                  <div className="space-y-3 bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] shadow-sm">
                    
                    {/* Desktop & Mobile Image Uploads */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">صورة الكمبيوتر (Desktop)</label>
                        {heroDesktopImageUrl && (
                          <div className="w-full aspect-[21/9] rounded-lg overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border)] mb-2 shadow-sm">
                            <img
                              src={getValidImageSrc(heroDesktopImageUrl)}
                              alt="Hero Desktop Preview"
                              className={`w-full h-full ${heroImageSizeMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                            />
                          </div>
                        )}
                        <input
                          type="text"
                          value={heroDesktopImageUrl}
                          onChange={(e) => setHeroDesktopImageUrl(e.target.value)}
                          placeholder="رابط صورة الكمبيوتر"
                          dir="ltr"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none mb-1.5 focus:border-[#D4AF37] transition-all text-right"
                        />
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[11px] font-bold text-[var(--text-primary)] rounded-lg cursor-pointer border border-[var(--border)] transition-all shadow-sm">
                          {uploadingHeroDesktop ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 text-[#D4AF37]" />}
                          <span>رفع صورة سطح المكتب</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleHeroDesktopFile} />
                        </label>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">صورة الموبايل (Mobile)</label>
                        {heroMobileImageUrl && (
                          <div className="w-full aspect-square rounded-lg overflow-hidden bg-[var(--surface-elevated)] border border-[var(--border)] mb-2 shadow-sm">
                            <img
                              src={getValidImageSrc(heroMobileImageUrl)}
                              alt="Hero Mobile Preview"
                              className={`w-full h-full ${heroImageSizeMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                            />
                          </div>
                        )}
                        <input
                          type="text"
                          value={heroMobileImageUrl}
                          onChange={(e) => setHeroMobileImageUrl(e.target.value)}
                          placeholder="اختياري - لتجاوب الموبايل"
                          dir="ltr"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none mb-1.5 focus:border-[#D4AF37] transition-all text-right"
                        />
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[11px] font-bold text-[var(--text-primary)] rounded-lg cursor-pointer border border-[var(--border)] transition-all shadow-sm">
                          {uploadingHeroMobile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3 text-[#D4AF37]" />}
                          <span>رفع صورة الموبايل</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleHeroMobileFile} />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">مظهر الصورة (Image Mode)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setHeroImageSizeMode('contain')}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            heroImageSizeMode === 'contain'
                              ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]'
                              : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]'
                          }`}
                        >
                          Contain (بدون قص)
                        </button>
                        <button
                          type="button"
                          onClick={() => setHeroImageSizeMode('cover')}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            heroImageSizeMode === 'cover'
                              ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]'
                              : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]'
                          }`}
                        >
                          Cover (ملء المساحة)
                        </button>
                      </div>
                    </div>

                    {/* Titles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">عنوان الهيرو (Title)</label>
                        <input
                          type="text"
                          value={heroTitle}
                          onChange={(e) => setHeroTitle(e.target.value)}
                          placeholder="مثال: خصومات كبرى على الهواتف"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none focus:border-[#D4AF37] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">نص الشارة (Badge)</label>
                        <input
                          type="text"
                          value={heroBadgeText}
                          onChange={(e) => setHeroBadgeText(e.target.value)}
                          placeholder="مثال: عرض لفترة محدودة"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none focus:border-[#D4AF37] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">الوصف الفرعي (Subtitle)</label>
                      <input
                        type="text"
                        value={heroSubtitle}
                        onChange={(e) => setHeroSubtitle(e.target.value)}
                        placeholder="وصف إعلاني جذاب لزوار القسم..."
                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none focus:border-[#D4AF37] transition-all"
                      />
                    </div>

                    {/* Product & CTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">ربط بـ Product ID (اختياري)</label>
                        <input
                          type="text"
                          value={heroProductId}
                          onChange={(e) => setHeroProductId(e.target.value)}
                          placeholder="ID المنتج المميز لهذا القسم"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none focus:border-[#D4AF37] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">نص زر الإجراء (CTA)</label>
                        <input
                          type="text"
                          value={heroCtaText}
                          onChange={(e) => setHeroCtaText(e.target.value)}
                          placeholder="مثال: تسوق العرض الآن"
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none focus:border-[#D4AF37] transition-all"
                        />
                      </div>
                    </div>

                    {/* Scheduling Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">تاريخ البدء</label>
                        <input
                          type="date"
                          value={heroStartDate}
                          onChange={(e) => setHeroStartDate(e.target.value)}
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none focus:border-[#D4AF37] transition-all text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">تاريخ الانتهاء</label>
                        <input
                          type="date"
                          value={heroEndDate}
                          onChange={(e) => setHeroEndDate(e.target.value)}
                          className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg p-2 outline-none focus:border-[#D4AF37] transition-all text-right"
                        />
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border)] transition-colors cursor-pointer shadow-sm"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#E0B84A] text-slate-950 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#D4AF37]/10"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ القسم</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Category Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingCategory)}
        onClose={() => {
          setDeletingCategory(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDeleteCategory}
        title="حذف القسم نهائيًا"
        itemName={deletingCategory?.name}
        message="هل أنت متأكد من حذف هذا القسم؟ سيتم إزالة القسم من شجرة الأقسام، وحذف صورته المعروضة من Supabase Storage."
        warningNote={deleteError || "ملاحظة: إذا كان القسم يحتوي على منتجات مرتبطة به، يجب نقل أو حذف المنتجات أولاً لمنع حدوث أخطاء."}
        loading={deleteLoading}
      />
    </div>
  );
}
