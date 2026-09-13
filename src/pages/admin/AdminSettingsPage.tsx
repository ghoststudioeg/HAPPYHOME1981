import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { settingsService } from '../../lib/data/settingsService';
import { storageService } from '../../lib/data/storageService';
import { StoreSettings } from '../../types';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { ThemeToggle } from '../../components/ThemeToggle';
import {
  Settings,
  Upload,
  Check,
  Loader2,
  AlertCircle,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Sparkles,
  Images,
  Bell,
  ShieldCheck,
  Info
} from 'lucide-react';
import { notificationEngine } from '../../lib/notificationEngine';


interface AdminSettingsPageProps {
  onSettingsUpdated: (settings: StoreSettings) => void;
}

export function AdminSettingsPage({ onSettingsUpdated }: AdminSettingsPageProps) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [storeName, setStoreName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [lightLogoUrl, setLightLogoUrl] = useState('');
  const [darkLogoUrl, setDarkLogoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [address, setAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [galleryAutoSlideEnabled, setGalleryAutoSlideEnabled] = useState(true);
  const [galleryAutoSlideInterval, setGalleryAutoSlideInterval] = useState(5);

  // WhatsApp & Event Notification Settings
  const [whatsappNotificationsEnabled, setWhatsappNotificationsEnabled] = useState(true);
  const [whatsappRecipientPhone, setWhatsappRecipientPhone] = useState('');
  const [whatsappToggles, setWhatsappToggles] = useState({
    NEW_ORDER: true,
    ORDER_STATUS_CHANGED: true,
    ORDER_CANCELLED: true,
    NEW_CUSTOMER: true,
    LOW_STOCK: true,
    OUT_OF_STOCK: true,
    RESTOCKED: true,
    COUPON_USED: true,
    HERO_BANNER_CHANGED: false,
    SYSTEM_ERROR: true
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const s = await settingsService.getSettings();
        setSettings(s);
        setStoreName(s.storeName);
        setTagline(s.tagline || '');
        setLogoUrl(s.logoUrl || '/logo.svg');
        setLightLogoUrl(s.lightLogoUrl || '');
        setDarkLogoUrl(s.darkLogoUrl || '');
        setPhone(s.phone);
        setWhatsappNumber(s.whatsappNumber);
        setFacebookUrl(s.facebookUrl || '');
        setInstagramUrl(s.instagramUrl || '');
        setAddress(s.address);
        setWorkingHours(s.workingHours);
        setHeroTitle(s.heroTitle || '');
        setHeroSubtitle(s.heroSubtitle || '');
        setGalleryAutoSlideEnabled(s.galleryAutoSlideEnabled !== undefined ? s.galleryAutoSlideEnabled : true);
        setGalleryAutoSlideInterval(s.galleryAutoSlideInterval || 5);

        setWhatsappNotificationsEnabled(s.whatsappNotificationsEnabled !== undefined ? s.whatsappNotificationsEnabled : true);
        setWhatsappRecipientPhone(s.whatsappRecipientPhone || s.whatsappNumber || '');
        if (s.whatsappToggles) {
          setWhatsappToggles(prev => ({ ...prev, ...s.whatsappToggles }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLogo(true);
      setError(null);
      const newUrl = await storageService.uploadLogo(file);
      setLogoUrl(newUrl);
    } catch (err: any) {
      setError(err?.message || 'تعذر رفع الشعار.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const updated: Partial<StoreSettings> = {
      storeName: storeName.trim(),
      tagline: tagline.trim(),
      logoUrl: logoUrl.trim(),
      lightLogoUrl: lightLogoUrl.trim(),
      darkLogoUrl: darkLogoUrl.trim(),
      phone: phone.trim(),
      whatsappNumber: whatsappNumber.trim(),
      facebookUrl: facebookUrl.trim(),
      instagramUrl: instagramUrl.trim(),
      address: address.trim(),
      workingHours: workingHours.trim(),
      heroTitle: heroTitle.trim(),
      heroSubtitle: heroSubtitle.trim(),
      galleryAutoSlideEnabled,
      galleryAutoSlideInterval: Number(galleryAutoSlideInterval) || 5,
      whatsappNotificationsEnabled,
      whatsappRecipientPhone: whatsappRecipientPhone.trim(),
      whatsappToggles
    };

    try {
      await settingsService.updateSettings(updated);
      const fresh = await settingsService.getSettings();
      setSettings(fresh);
      onSettingsUpdated(fresh);
      setSuccessMessage('تم حفظ إعدادات المتجر بنجاح في Firebase.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">إعدادات المتجر والهوية</h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5">
          إدارة بيانات التواصل، العنوان، الشعار، والنصوص الترويجية
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-xs text-emerald-500">
          <Check className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-xs text-rose-500">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Theme Preference Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-[#D6A83A] border-b border-[var(--border)] pb-3 flex items-center justify-between">
            <span>مظهر النظام والمتجر (Dark / Light Theme)</span>
            <ThemeToggle showLabel className="px-3 py-1 text-xs" />
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            يمكنك التبديل بسهولة بين الوضع الليلي الفاخر (Dark Theme) والوضع النهاري العصري (Light Theme). يتأثر بهذا الخيار جميع صفحات المتجر ولوحة التحكم.
          </p>
        </div>

        {/* Brand & Logo Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-[#D6A83A] border-b border-[var(--border)] pb-3">
            هوية المتجر والشعار الرسمي
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">اسم المتجر</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">الشعار اللفظي (الـ Tagline)</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="كل احتياجاتك في مكان واحد"
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* LIGHT THEME LOGO */}
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">شعار الوضع النهاري (Light Theme)</label>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <div className="h-20 w-48 flex items-center justify-center p-3 bg-gray-50 rounded-xl border border-gray-100 shrink-0">
                  <img 
                    src={getValidImageSrc(lightLogoUrl || logoUrl || '/logo.svg')} 
                    alt="Light Preview" 
                    className="h-full w-auto object-contain transition-all hover:scale-110" 
                  />
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <p className="text-[10px] text-gray-500 font-medium">يظهر هذا الشعار عندما يكون المتجر في "الوضع الفاتح". يفضل استخدام ألوان داكنة.</p>
                  <input
                    type="text"
                    value={lightLogoUrl}
                    onChange={(e) => setLightLogoUrl(e.target.value)}
                    dir="ltr"
                    placeholder="https://example.com/light-logo.png"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#D6A83A] text-gray-900 text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all placeholder:text-gray-300"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-xs font-bold text-white rounded-xl cursor-pointer transition-all shadow-md active:scale-95">
                      {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-amber-400" />}
                      <span>اختيار ملف للشعار الفاتح</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setUploadingLogo(true);
                            const url = await storageService.uploadLogo(file);
                            setLightLogoUrl(url);
                          } catch (err: any) {
                            setError(err.message);
                          } finally {
                            setUploadingLogo(false);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* DARK THEME LOGO */}
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">شعار الوضع الليلي (Dark Theme)</label>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-[#0A111A] border border-[#1A2A3A] rounded-2xl shadow-xl">
                <div className="h-20 w-48 flex items-center justify-center p-3 bg-[#111E2E] rounded-xl border border-[#1E2E3E] shrink-0">
                  <img 
                    src={getValidImageSrc(darkLogoUrl || logoUrl || '/logo.svg')} 
                    alt="Dark Preview" 
                    className="h-full w-auto object-contain transition-all hover:scale-110" 
                  />
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <p className="text-[10px] text-gray-400 font-medium">يظهر هذا الشعار عندما يكون المتجر في "الوضع الليلي". يفضل استخدام ألوان فاتحة أو ذهبية.</p>
                  <input
                    type="text"
                    value={darkLogoUrl}
                    onChange={(e) => setDarkLogoUrl(e.target.value)}
                    dir="ltr"
                    placeholder="https://example.com/dark-logo.png"
                    className="w-full bg-[#111E2E] border border-[#1A2A3A] focus:border-[#D6A83A] text-white text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all placeholder:text-gray-600"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#D6A83A] hover:bg-[#E0B64B] text-xs font-bold text-[#070D16] rounded-xl cursor-pointer transition-all shadow-md active:scale-95">
                      {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>اختيار ملف للشعار المظلم</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setUploadingLogo(true);
                            const url = await storageService.uploadLogo(file);
                            setDarkLogoUrl(url);
                          } catch (err: any) {
                            setError(err.message);
                          } finally {
                            setUploadingLogo(false);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* OLD LOGO (BACKWARD COMPATIBILITY) */}
            <div className="sm:col-span-2 opacity-50">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] mb-1">الشعار الأساسي (قديم / احتياطي)</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                dir="ltr"
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)] text-[10px] rounded-lg py-1.5 px-3 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-[#D6A83A] border-b border-[var(--border)] pb-3">
            بيانات التواصل وقنوات الواتساب
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#D6A83A]" />
                <span>رقم الهاتف المباشر *</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                dir="ltr"
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none font-mono transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>رقم الواتساب الرسمي للاستفسارات *</span>
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                required
                dir="ltr"
                placeholder="+201000000000"
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none font-mono transition-all placeholder:text-[var(--text-muted)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                تُبنى عليه روابط زر «اسأل عن المنتج على واتساب»
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#D6A83A]" />
                <span>عنوان المتجر والموقع *</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#D6A83A]" />
                <span>مواعيد وساعات العمل *</span>
              </label>
              <input
                type="text"
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                required
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-[#D6A83A] border-b border-[var(--border)] pb-3">
            حسابات التواصل الاجتماعي
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Facebook className="w-3.5 h-3.5 text-blue-400" />
                <span>رابط صفحة فيسبوك</span>
              </label>
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                dir="ltr"
                placeholder="https://facebook.com/..."
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-400" />
                <span>رابط حساب إنستغرام</span>
              </label>
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                dir="ltr"
                placeholder="https://instagram.com/..."
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>
        </div>

        {/* Hero Banner Texts */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-[#D6A83A] border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>نصوص الواجهة الرئيسية (Hero Section)</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">العنوان الرئيسي</label>
              <input
                type="text"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                placeholder="كل ما يحتاجه بيتك في مكان واحد"
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none transition-all placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">العنوان الفرعي</label>
              <textarea
                rows={2}
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="منتجات مختارة للبيت، المدرسة، السفر، الإلكترونيات والهدايا بأسعار مناسبة وجودة تثق فيها."
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl p-3 outline-none leading-relaxed transition-all placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp & Store Event Notification Settings */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <h3 className="text-sm font-bold text-[#D6A83A] flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>إشعارات واتساب وأحداث المتجر (WhatsApp & Store Events)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] flex items-center justify-between transition-all">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">
                  تفعيل إشعارات الواتساب
                </label>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  تلقي إشعارات تلقائية على الواتساب عند وقوع أحداث في المتجر
                </p>
              </div>
              <input
                type="checkbox"
                checked={whatsappNotificationsEnabled}
                onChange={(e) => setWhatsappNotificationsEnabled(e.target.checked)}
                className="rounded bg-[var(--surface)] text-[#D6A83A] focus:ring-0 w-5 h-5 cursor-pointer accent-[#D6A83A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                رقم الواتساب المستلم للإشعارات
              </label>
              <input
                type="text"
                value={whatsappRecipientPhone}
                onChange={(e) => setWhatsappRecipientPhone(e.target.value)}
                placeholder="مثال: 201012345678"
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none dir-ltr transition-all placeholder:text-[var(--text-muted)]"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">أدخل الرقم بالصيغة الدولية بدون (+) أو مسافات.</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-[var(--text-primary)]">
              تخصيص أنواع الأحداث المرسلة عبر الواتساب:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                { key: 'NEW_ORDER', label: 'طلب جديد (NEW_ORDER)' },
                { key: 'ORDER_STATUS_CHANGED', label: 'تغيير حالة الطلب' },
                { key: 'ORDER_CANCELLED', label: 'إلغاء طلب' },
                { key: 'NEW_CUSTOMER', label: 'عميل جديد' },
                { key: 'LOW_STOCK', label: 'تنبيه مخزون منخفض' },
                { key: 'OUT_OF_STOCK', label: 'نفاد المخزون بالكامل' },
                { key: 'RESTOCKED', label: 'إعادة توفير منتج' },
                { key: 'COUPON_USED', label: 'استخدام كود خصم' },
                { key: 'HERO_BANNER_CHANGED', label: 'تغيير إعلانات الهيرو' },
                { key: 'SYSTEM_ERROR', label: 'أخطاء النظام الحادة' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] cursor-pointer hover:border-[#D6A83A]/30 transition-all">
                  <input
                    type="checkbox"
                    checked={!!whatsappToggles[key as keyof typeof whatsappToggles]}
                    onChange={(e) => setWhatsappToggles(prev => ({ ...prev, [key]: e.target.checked }))}
                    disabled={!whatsappNotificationsEnabled}
                    className="rounded bg-[var(--surface)] text-[#D6A83A] focus:ring-0 w-4 h-4 accent-[#D6A83A]"
                  />
                  <span className="text-xs text-[var(--text-primary)] font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Product Gallery Auto Slide Settings */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-[#D6A83A] border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <Images className="w-4 h-4" />
            <span>إعدادات معرض صور المنتجات (Product Gallery)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] flex items-center justify-between transition-all">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">
                  التغيير التلقائي للصور (Auto Slide)
                </label>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  تفعيل/إيقاف تبديل الصور التلقائي افتراضيًا لجميع المنتجات
                </p>
              </div>
              <input
                type="checkbox"
                checked={galleryAutoSlideEnabled}
                onChange={(e) => setGalleryAutoSlideEnabled(e.target.checked)}
                className="rounded bg-[var(--surface)] text-[#D6A83A] focus:ring-0 w-5 h-5 cursor-pointer accent-[#D6A83A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                مدة التغيير التلقائي للصور (بالثواني)
              </label>
              <select
                value={galleryAutoSlideInterval}
                onChange={(e) => setGalleryAutoSlideInterval(Number(e.target.value))}
                disabled={!galleryAutoSlideEnabled}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none disabled:opacity-40 transition-all"
              >
                <option value={3}>3 ثوانٍ (سريع)</option>
                <option value={5}>5 ثوانٍ (افتراضي / متوازن)</option>
                <option value={7}>7 ثوانٍ (هادئ)</option>
                <option value={10}>10 ثوانٍ (بطيء)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 bg-[#D6A83A] hover:bg-[#E0B64B] text-[#070D16] font-bold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#D6A83A]/20 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ في Firebase...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات في Firebase</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
