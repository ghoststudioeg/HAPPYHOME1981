import React, { useEffect, useState, useMemo } from 'react';
import { BundleOffer, BundleInstallmentPlan, Product, StoreSettings } from '../types';
import { bundleService, calculateBundleStock, isBundleActive } from '../lib/data/bundleService';
import { useAuth } from '../lib/authContext';
import { getValidImageSrc } from '../utils/imageUtils';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { SEO } from '../components/SEO';
import { openWhatsAppClickToChat } from '../lib/pdfGenerator';
import { jsPDF } from 'jspdf';
import {
  Gift,
  Heart,
  Share2,
  ShoppingCart,
  MessageCircle,
  FileText,
  Clock,
  Sparkles,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  CreditCard,
  Layers,
  ArrowRight,
  Maximize2,
  X,
  ExternalLink,
  Copy,
  Check,
  Coins
} from 'lucide-react';

interface BundleDetailPageProps {
  slug: string;
  navigate: (path: string) => void;
  settings: StoreSettings;
}

export function BundleDetailPage({ slug, navigate, settings }: BundleDetailPageProps) {
  const { addBundleToCart, triggerToast } = useAuth();

  const [bundle, setBundle] = useState<BundleOffer | null>(null);
  const [bundleProducts, setBundleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Installment Plan
  const [selectedPlan, setSelectedPlan] = useState<BundleInstallmentPlan | null>(null);

  // Lightbox Modal for Full Design Image
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Quantity to add
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Copy indicator
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBundleData() {
      setLoading(true);
      setError(null);
      try {
        const found = await bundleService.getBundleBySlug(slug);
        if (!found) {
          if (isMounted) {
            setError('العرض المطلوب غير موجود أو تم إيقافه.');
            setLoading(false);
          }
          return;
        }

        const prods = await bundleService.resolveBundleProducts(found);

        if (isMounted) {
          setBundle(found);
          setBundleProducts(prods);

          // Default installment plan
          const defPlan = found.defaultPlan || (found.installmentPlans && found.installmentPlans[0]) || null;
          setSelectedPlan(defPlan);

          setLoading(false);
        }

        // Record analytical view non-blocking
        bundleService.recordView(found.id).catch(() => {});
      } catch (err: any) {
        console.error('Failed to load bundle detail:', err);
        if (isMounted) {
          setError('حدث خطأ أثناء تحميل بيانات العرض.');
          setLoading(false);
        }
      }
    }

    loadBundleData();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Dynamic Bundle Stock
  const availableStock = useMemo(() => {
    return calculateBundleStock(bundleProducts);
  }, [bundleProducts]);

  const hasStock = availableStock > 0;
  const isOfferActive = bundle ? isBundleActive(bundle) : false;

  // Pricing calculations
  const originalTotalPrice = useMemo(() => {
    if (!bundle) return 0;
    if (bundle.originalTotalPrice && bundle.originalTotalPrice > 0) return bundle.originalTotalPrice;
    return bundleProducts.reduce((sum, p) => sum + (p.price || 0), 0);
  }, [bundle, bundleProducts]);

  const finalBundlePrice = bundle ? bundle.bundlePrice : 0;
  const totalSavings = Math.max(0, originalTotalPrice - finalBundlePrice);
  const savingsPercent = originalTotalPrice > 0 ? Math.round((totalSavings / originalTotalPrice) * 100) : 0;

  // Handle Add to Cart
  const handleAddToCart = async (goToCart = false) => {
    if (!bundle) return;
    if (!hasStock || !isOfferActive) {
      triggerToast('عذراً، هذا العرض غير متوفر للشراء حالياً.');
      return;
    }

    setIsAdding(true);
    try {
      bundleService.recordClick(bundle.id).catch(() => {});
      await addBundleToCart(bundle, quantity, selectedPlan || undefined);
      triggerToast(`تمت إضافة العرض "${bundle.name}" إلى السلة.`);
      if (goToCart) {
        navigate('/cart');
      }
    } catch (err: any) {
      console.error('Error adding bundle to cart:', err);
      triggerToast('حصل خطأ أثناء إضافة العرض إلى السلة.');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle WhatsApp Inquiry
  const handleWhatsAppInquiry = () => {
    if (!bundle) return;
    bundleService.recordClick(bundle.id).catch(() => {});

    const phone = settings.whatsappNumber || settings.phone || '01000000000';
    const storeName = settings.storeName || 'متجر البيت السعيد';
    const pageUrl = window.location.href;

    const productsList = bundleProducts
      .map((p, idx) => `   ${idx + 1}. ${p.name} (سعره الفردي: ${p.price.toLocaleString('ar-EG')} ج.م)`)
      .join('\n');

    let planText = 'طلب شراء كاش بالكامل';
    if (bundle.installmentEnabled && selectedPlan) {
      planText = `\n💳 *خطة التقسيط المختارة:*
   - المزود: ${selectedPlan.providerName || 'التقسيط المباشر'}
   - القسط الشهري: ${selectedPlan.monthlyPayment.toLocaleString('ar-EG')} ج.م شهرياً
   - المدة: ${selectedPlan.months} شهر
   - المقدم: ${selectedPlan.downPayment > 0 ? `${selectedPlan.downPayment.toLocaleString('ar-EG')} ج.م` : 'بدون مقدم'}
   - إجمالي التقسيط: ${selectedPlan.totalAmount ? `${selectedPlan.totalAmount.toLocaleString('ar-EG')} ج.م` : ''}`;
    }

    const message = `السلام عليكم ورحمة الله،
أود الاستفسار والطلب للعرض المركب:
🎁 *[${bundle.name}]*
🔖 شارة العرض: ${bundle.badgeText || '2 في 1'}

📦 *المنتجات المشمولة داخل العرض:*
${productsList}

💵 *السعر العادي الإجمالي:* ${originalTotalPrice.toLocaleString('ar-EG')} ج.م
💰 *سعر العرض الخاص:* *${finalBundlePrice.toLocaleString('ar-EG')} ج.م* (توفير ${totalSavings.toLocaleString('ar-EG')} ج.م)
${planText}

🔗 رابط العرض على الموقع:
${pageUrl}

أرجو تأكيد توفر العرض وترتيب طريقة الاستلام والتوصيل. شكراً لكم!`;

    openWhatsAppClickToChat(phone, message);
  };

  // Generate PDF Summary
  const handleDownloadPdf = () => {
    if (!bundle) return;
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const storeName = settings.storeName || 'متجر البيت السعيد';

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(storeName, 105, 20, { align: 'center' });

      doc.setFontSize(14);
      doc.text(`Special Bundle Offer: ${bundle.name}`, 105, 30, { align: 'center' });
      if (bundle.badgeText) {
        doc.setFontSize(11);
        doc.text(`Badge: ${bundle.badgeText}`, 105, 36, { align: 'center' });
      }

      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);

      doc.setFontSize(12);
      doc.text('Included Products in this Bundle:', 20, 50);

      let yPos = 58;
      bundleProducts.forEach((p, idx) => {
        doc.setFontSize(10);
        doc.text(`${idx + 1}. ${p.name} - Individual Price: ${p.price} EGP`, 25, yPos);
        yPos += 7;
      });

      yPos += 5;
      doc.line(20, yPos, 190, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.text(`Original Sum: ${originalTotalPrice} EGP`, 20, yPos);
      yPos += 7;
      doc.setFontSize(13);
      doc.text(`Bundle Special Price: ${finalBundlePrice} EGP (Save ${totalSavings} EGP)`, 20, yPos);
      yPos += 10;

      if (bundle.installmentEnabled && selectedPlan) {
        doc.text('Selected Installment Plan:', 20, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.text(`- Monthly Payment: ${selectedPlan.monthlyPayment} EGP x ${selectedPlan.months} Months`, 25, yPos);
        yPos += 6;
        doc.text(`- Down Payment: ${selectedPlan.downPayment} EGP`, 25, yPos);
        yPos += 6;
        doc.text(`- Total Amount: ${selectedPlan.totalAmount || (selectedPlan.monthlyPayment * selectedPlan.months)} EGP`, 25, yPos);
        yPos += 10;
      }

      doc.setFontSize(9);
      doc.text(`Store Contact: ${settings.phone || ''} | WhatsApp: ${settings.whatsappNumber || ''}`, 105, 280, { align: 'center' });

      doc.save(`عرض-${bundle.slug || 'bundle'}.pdf`);
      triggerToast('تم تجهيز ملف PDF للعرض بنجاح.');
    } catch (e) {
      console.warn('PDF download error:', e);
      triggerToast('تعذر تنزيل ملف PDF.');
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    triggerToast('تم نسخ رابط العرض.');
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8" dir="rtl">
        <LoadingSkeleton type="details" count={1} />
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="max-w-xl mx-auto my-20 px-4 text-center space-y-5" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-black text-[var(--text-primary)]">العرض غير متوفر</h1>
          <p className="text-xs text-[var(--text-secondary)]">{error || 'لم نتمكن من العثور على هذا العرض المركب.'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="px-6 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs rounded-xl shadow cursor-pointer hover:brightness-110"
        >
          تصفح كافة المنتجات والعروض
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-12" dir="rtl">
      {/* SEO Metadata */}
      <SEO
        title={`${bundle.name} | عرض مركب خاص`}
        description={bundle.description || `عرض مركب حصري: ${bundle.name} بأفضل سعر وتقسيط مريح من ${settings.storeName}.`}
        image={bundle.imageUrl}
        type="product"
      />

      {/* Breadcrumb Navigation */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          الرئيسية
        </button>
        <ChevronRight className="w-3.5 h-3.5 rotate-180 shrink-0 opacity-60" />
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          العروض
        </button>
        <ChevronRight className="w-3.5 h-3.5 rotate-180 shrink-0 opacity-60" />
        <span className="text-[#D4AF37] font-bold truncate max-w-[200px] sm:max-w-none">
          {bundle.name}
        </span>
      </nav>

      {/* Main Bundle Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Bundle Design Graphic (Hero Image) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="relative w-full aspect-square rounded-3xl overflow-hidden border border-[var(--border)] bg-black/60 shadow-2xl group">
            <img
              src={getValidImageSrc(bundle.imageUrl)}
              alt={bundle.name}
              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500 cursor-pointer"
              onClick={() => setIsLightboxOpen(true)}
            />

            {/* Badges Overlay */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black shadow-lg">
                {bundle.badgeText || '2 في 1'}
              </span>
              {totalSavings > 0 && (
                <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-lg">
                  وفر {totalSavings.toLocaleString('ar-EG')} ج.م
                </span>
              )}
            </div>

            {/* Fullscreen Zoom Button */}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="absolute bottom-4 left-4 p-2.5 rounded-xl bg-black/70 hover:bg-[#D4AF37] text-white hover:text-black border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
              title="تكبير التصميم"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-[var(--text-muted)] text-center">
            انقر على الصورة لمعاينة التصميم بالكامل بدقة عالية
          </p>
        </div>

        {/* Right Column: Offer Details & Actions */}
        <div className="lg:col-span-6 space-y-6">
          {/* Header Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5" />
                <span>عرض مركب متكامل</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  hasStock && isOfferActive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
              >
                {hasStock && isOfferActive ? `متوفر جاهز للشحن (${availableStock} باقات)` : 'غير متوفر حالياً'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
              {bundle.name}
            </h1>

            {bundle.description && (
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {bundle.description}
              </p>
            )}
          </div>

          {/* Pricing Highlight Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#D4AF37]/15 via-[var(--surface-elevated)] to-transparent border border-[#D4AF37]/35 shadow-xl space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-bold text-[var(--text-muted)] block">سعر العرض الإجمالي:</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-[#D4AF37]">
                    {finalBundlePrice.toLocaleString('ar-EG')}
                  </span>
                  <span className="text-sm font-bold text-[#D4AF37]">جنيه مصري</span>
                </div>
              </div>

              {totalSavings > 0 && (
                <div className="text-left space-y-1">
                  <span className="text-sm line-through text-[var(--text-muted)] block">
                    {originalTotalPrice.toLocaleString('ar-EG')} ج.م
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    وفرت {totalSavings.toLocaleString('ar-EG')} ج.م ({savingsPercent}%)
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] border-t border-[var(--border)] pt-2.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>هذا السعر يشمل جميع المنتجات المذكورة أدناه في باقة واحدة متكاملة.</span>
            </p>
          </div>

          {/* Installment Plan Breakdown (Crucial Requirement) */}
          {bundle.installmentEnabled && bundle.installmentPlans && bundle.installmentPlans.length > 0 && (
            <div className="p-5 rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)]">
                      {bundle.installmentHeadline || 'تفاصيل نظام التقسيط الخاص بالعرض'}
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)]">اختر خطة التقسيط المناسبة لك</p>
                  </div>
                </div>
              </div>

              {/* Plan Selectors (if multiple) */}
              {bundle.installmentPlans.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {bundle.installmentPlans.map((plan, idx) => {
                    const isSelected = selectedPlan === plan || (selectedPlan?.months === plan.months && selectedPlan?.monthlyPayment === plan.monthlyPayment);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPlan(plan)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                          isSelected
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black shadow-md'
                            : 'glass-panel text-[var(--text-secondary)] hover:text-white border-[var(--border)]'
                        }`}
                      >
                        <span>{plan.months} شهر ({plan.monthlyPayment} ج/شهر)</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active Plan Breakdown Card */}
              {selectedPlan && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-[var(--text-muted)] block">القسط الشهري</span>
                    <span className="text-sm font-black text-[#D4AF37]">
                      {selectedPlan.monthlyPayment.toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-[var(--text-muted)] block">مدة التقسيط</span>
                    <span className="text-sm font-black text-[var(--text-primary)]">
                      {selectedPlan.months} شهر
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-[var(--text-muted)] block">المقدم المطلوب</span>
                    <span className="text-sm font-black text-[var(--text-primary)]">
                      {selectedPlan.downPayment > 0 ? `${selectedPlan.downPayment.toLocaleString('ar-EG')} ج.م` : 'بدون مقدم'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-[var(--text-muted)] block">إجمالي المبلغ</span>
                    <span className="text-sm font-black text-[var(--text-primary)]">
                      {(selectedPlan.totalAmount || (selectedPlan.monthlyPayment * selectedPlan.months + selectedPlan.downPayment)).toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>
                </div>
              )}

              {selectedPlan?.notes && (
                <p className="text-[11px] text-[var(--text-secondary)] italic">
                  💡 {selectedPlan.notes}
                </p>
              )}
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => handleAddToCart(true)}
                disabled={!hasStock || !isOfferActive || isAdding}
                className="flex-1 py-4 px-6 bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-black font-black text-sm rounded-2xl shadow-xl hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>اشتري العرض الآن</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddToCart(false)}
                disabled={!hasStock || !isOfferActive || isAdding}
                className="py-4 px-6 glass-panel hover:bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[#D4AF37]/50 text-[var(--text-primary)] font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span>أضف للسلة</span>
              </button>
            </div>

            {/* WhatsApp Direct Inquiry & PDF Download */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleWhatsAppInquiry}
                className="py-3 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>طلب عبر واتساب</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="py-3 px-4 rounded-xl glass-panel hover:bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <FileText className="w-4 h-4 text-[#D4AF37]" />
                <span>تحميل تفاصيل العرض (PDF)</span>
              </button>
            </div>

            {/* Share / Copy link */}
            <div className="flex items-center justify-end gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[var(--text-muted)] hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم نسخ الرابط' : 'مشاركة هذا العرض'}</span>
              </button>
            </div>
          </div>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-[var(--border)] text-center text-[10px] text-[var(--text-secondary)] font-bold">
            <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>منتجات أصلية 100%</span>
            </div>
            <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center gap-1">
              <Truck className="w-4 h-4 text-[#D4AF37]" />
              <span>توصيل سريع لكافة المحافظات</span>
            </div>
            <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center gap-1">
              <RotateCcw className="w-4 h-4 text-[#D4AF37]" />
              <span>ضمان واسترجاع مرن</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: Products Included in this Bundle */}
      {/* ========================================================================= */}
      <section className="space-y-6 pt-6 border-t border-[var(--border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-6 rounded-full bg-[#D4AF37]" />
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                المنتجات المشمولة في هذا العرض معاً
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              هذا العرض يحتوي على المنتجات التالية معاً كباقة واحدة بسعر خاص ومخفض بدلاً من شرائها منفصلة:
            </p>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] font-black text-xs self-start sm:self-auto">
            {bundleProducts.length} منتجات في باقة واحدة
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundleProducts.map((prod, idx) => (
            <div
              key={prod.id}
              className="glass-panel-elevated rounded-2xl border border-[var(--border)] p-4 flex items-center gap-4 hover:border-[#D4AF37]/40 transition-all duration-200"
            >
              <div className="relative w-20 h-20 bg-black/40 rounded-xl p-1 border border-white/10 shrink-0 flex items-center justify-center">
                <img
                  src={getValidImageSrc(prod.mainImageUrl)}
                  alt={prod.name}
                  className="max-h-full max-w-full object-contain"
                />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D4AF37] text-black font-black text-[10px] flex items-center justify-center shadow">
                  {idx + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-[10px] text-[var(--text-muted)] font-bold block">
                  {prod.categoryName || 'منتج متميز'}
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2">
                  {prod.name}
                </h3>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-black text-[#D4AF37]">
                    السعر الفردي: {prod.price.toLocaleString('ar-EG')} ج.م
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/product/${prod.slug || prod.id}`)}
                    className="text-[11px] text-[var(--text-muted)] hover:text-[#D4AF37] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>تفاصيل</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-5 left-5 text-white p-2 rounded-full bg-black/60 hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={getValidImageSrc(bundle.imageUrl)}
            alt={bundle.name}
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
          />
        </div>
      )}
    </div>
  );
}
