import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  MessageCircle, 
  FileText, 
  Loader2, 
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  Link2,
  Shield,
  Truck,
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ProductColorVariant, ProductColor, StoreSettings, Category } from '../../types';
import { FinancingProvider, InstallmentPlan, InstallmentCalculationResult } from '../../types/installment';
import { filterEligiblePlans, calculateManualInstallment } from '../../lib/installments/calculationEngine';
import { ProviderLogo } from '../installments/ProviderLogo';

// @ts-ignore
import html2pdf from 'html2pdf.js';


interface ProductPdfInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  selectedVariant: ProductColorVariant | null;
  selectedColor: ProductColor | null;
  activeMainImage: string;
  activeGalleryImages: string[];
  pricingDetails: {
    effectivePrice: number;
    originalBasePrice: number;
    isCampaignActive: boolean;
    discountPercent: number | null;
    savingsAmount: number | null;
  };
  resolvedCategory: Category | null;
  installmentProviders: FinancingProvider[];
  installmentPlans: InstallmentPlan[];
  settings: StoreSettings | null;
}

export function ProductPdfInquiryModal({
  isOpen,
  onClose,
  product,
  selectedVariant,
  selectedColor,
  activeMainImage,
  activeGalleryImages,
  pricingDetails,
  resolvedCategory,
  installmentProviders,
  installmentPlans,
  settings
}: ProductPdfInquiryModalProps) {
  const [step, setStep] = useState<'payment_method' | 'cash_timing' | 'provider_selection' | 'duration_selection' | 'delivery_method' | 'review' | 'generating' | 'success' | 'error'>('payment_method');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'installment' | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<FinancingProvider | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<InstallmentCalculationResult | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'branch_pickup' | null>(null);
  const [cashPaymentTiming, setCashPaymentTiming] = useState<'now' | 'on_delivery' | null>(null);
  const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isShareSupported, setIsShareSupported] = useState(false);

  const printContainerRef = useRef<HTMLDivElement>(null);

  // Automatically reset the modal journey whenever opened
  useEffect(() => {
    if (isOpen) {
      setStep('payment_method');
      setPaymentMethod(null);
      setSelectedProvider(null);
      setSelectedPlan(null);
      setDeliveryMethod(null);
      setCashPaymentTiming(null);
      setGenerationState('idle');
      setPdfBlob(null);
      setPdfFile(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const colorName = useMemo(() => {
    return selectedVariant?.colorName || selectedVariant?.name || selectedColor?.name || (selectedColor as any)?.colorName || '';
  }, [selectedVariant, selectedColor]);

  const normalizedFileName = useMemo(() => {
    const safeName = product.name
      .replace(/[\s\t\n]+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '');
    return `البيت-السعيد-${safeName}.pdf`;
  }, [product.name]);

  const canonicalUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      const canonicalSlug = (product as any).canonicalSlug || product.slug || product.id;
      return `${window.location.origin}/product/${canonicalSlug}`;
    }
    return '';
  }, [product]);

  const planPercentage = useMemo(() => {
    if (!selectedPlan || !selectedProvider) return 0;
    const plan = installmentPlans.find(p => p.id === selectedPlan.planId);
    if (!plan) return 0;
    const override = product.installmentConfig?.planOverrides?.[plan.id];
    return override?.percentage !== undefined ? override.percentage : (plan.percentage || 0);
  }, [selectedPlan, selectedProvider, installmentPlans, product.installmentConfig]);

  // WhatsApp Message
  const whatsappMessage = useMemo(() => {
    let msg = `مرحباً، أريد الاستفسار عن:\n\n`;
    msg += `المنتج: *${product.name}*\n`;
    if (colorName) {
      msg += `اللون: *${colorName}*\n`;
    }
    const priceText = `${pricingDetails.effectivePrice.toLocaleString('ar-EG')} ج.م`;
    msg += `السعر: *${priceText}*\n`;

    const deliveryText = deliveryMethod === 'shipping' ? 'الشحن' : 'الاستلام من الفرع';

    if (paymentMethod === 'cash') {
      msg += `طريقة الدفع: *كاش*\n`;
      if (cashPaymentTiming) {
        msg += `الدفع: *${cashPaymentTiming === 'now' ? 'الآن' : 'عند الاستلام'}*\n`;
      }
      msg += `طريقة الاستلام: *${deliveryText}*\n\n`;
      msg += `تم تجهيز ملف PDF يحتوي على تفاصيل المنتج.\n`;
    } else if (paymentMethod === 'installment' && selectedPlan) {
      msg += `جهة التقسيط: *${selectedPlan.providerName}*\n`;
      msg += `المدة: *${selectedPlan.months} أشهر*\n`;
      msg += `المقدم: *${selectedPlan.downPayment > 0 ? `${selectedPlan.downPayment.toLocaleString('ar-EG')} ج.م` : 'بدون مقدم'}*\n`;
      msg += `القسط الشهري التقديري: *${selectedPlan.monthlyPayment.toLocaleString('ar-EG')} ج.م*\n`;
      msg += `طريقة الاستلام: *${deliveryText}*\n\n`;
      msg += `تم تجهيز ملف PDF يحتوي على التفاصيل.\n`;
    } else {
      msg += `طريقة الاستلام: *${deliveryText}*\n\n`;
      msg += `تم تجهيز ملف PDF يحتوي على التفاصيل.\n`;
    }

    if (canonicalUrl) {
      msg += `رابط المنتج: ${canonicalUrl}\n`;
    }
    return msg;
  }, [product.name, colorName, paymentMethod, selectedPlan, deliveryMethod, cashPaymentTiming, pricingDetails.effectivePrice, canonicalUrl]);

  // Get Store WhatsApp Link
  const whatsappUrl = useMemo(() => {
    const cleanNumber = settings?.whatsappNumber?.replace(/[+\s-]/g, '') || '201019811981';
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  }, [settings?.whatsappNumber, whatsappMessage]);

  // Resolve Store Logo for print
  const printLogoUrl = useMemo(() => {
    if (!settings) return '/logo.svg';
    const { lightLogoUrl, logoUrl, darkLogoUrl } = settings;
    if (lightLogoUrl && lightLogoUrl.trim() !== '') return lightLogoUrl;
    if (logoUrl && logoUrl.trim() !== '') return logoUrl;
    if (darkLogoUrl && darkLogoUrl.trim() !== '') return darkLogoUrl;
    return '/logo.svg';
  }, [settings]);

  // Specifications (up to 6 core ones to prevent overflow)
  const dynamicSpecs = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    if (!product.specifications) return list;

    const isMobileCategory =
      (resolvedCategory?.name && resolvedCategory.name.includes('موبايل')) ||
      (resolvedCategory?.slug && (resolvedCategory.slug.includes('smartphones') || resolvedCategory.slug.includes('mobile'))) ||
      (product.categoryName && product.categoryName.includes('موبايل')) ||
      (product.categoryId && (product.categoryId.includes('smartphones') || product.categoryId.includes('mobile')));

    if (isMobileCategory) {
      const MOBILE_SPEC_KEYS = [
        { key: 'ram', label: 'الذاكرة العشوائية (RAM)' },
        { key: 'storage', label: 'المساحة الداخلية' },
        { key: 'processor', label: 'المعالج' },
        { key: 'screen', label: 'الشاشة' },
        { key: 'rearCamera', label: 'الكاميرا الخلفية' },
        { key: 'battery', label: 'البطارية' }
      ];

      MOBILE_SPEC_KEYS.forEach(({ key, label }) => {
        const val = product.specifications?.[key as keyof typeof product.specifications];
        if (val && String(val).trim().length > 0) {
          list.push({ label, value: String(val).trim() });
        }
      });
    } else {
      // Dynamic fallback for non-mobile products
      Object.entries(product.specifications).forEach(([key, val]) => {
        if (val && String(val).trim().length > 0) {
          let label = key;
          if (key === 'dimensions' || key === 'الابعاد' || key === 'الأبعاد') label = 'الأبعاد';
          else if (key === 'weight' || key === 'الوزن') label = 'الوزن';
          else if (key === 'material' || key === 'الخامة' || key === 'الخامات') label = 'الخامة';
          else if (key === 'warranty' || key === 'الضمان') label = 'الضمان';
          else if (key === 'power' || key === 'القدرة' || key === 'الوات') label = 'القدرة الكهربائية';
          else if (key === 'capacity' || key === 'السعة') label = 'السعة';
          else {
            label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
          }
          list.push({ label, value: String(val).trim() });
        }
      });
    }
    return list.slice(0, 7); // Safe limit to prevent page overflows
  }, [product.specifications, resolvedCategory, product]);

  // Installment calculations (compact top 3 plans)
  const eligibleInstallmentPlans = useMemo(() => {
    const list: InstallmentCalculationResult[] = [];
    if (!product || installmentProviders.length === 0 || installmentPlans.length === 0) return [];
    if (product.installmentConfig && product.installmentConfig.enabled === false) return [];

    const price = pricingDetails.effectivePrice;

    // Filter providers
    const filteredProviders = installmentProviders
      .filter((prov) => {
        if (!prov.enabled) return false;
        if (
          product.installmentConfig?.allowedProviderIds &&
          product.installmentConfig.allowedProviderIds.length > 0 &&
          !product.installmentConfig.allowedProviderIds.includes(prov.id)
        ) {
          return false;
        }
        const providerPlans = filterEligiblePlans(installmentPlans, prov, price, product.installmentConfig);
        return providerPlans.length > 0;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    // Calculate plan values for each provider
    filteredProviders.forEach((prov) => {
      const plansForProv = filterEligiblePlans(installmentPlans, prov, price, product.installmentConfig);
      // Take 1 best plan per provider to keep the PDF compact on a single page
      if (plansForProv.length > 0) {
        const bestPlan = plansForProv[plansForProv.length - 1]; // longest duration typically has lowest monthly payment
        const override = product.installmentConfig?.planOverrides?.[bestPlan.id];
        const res = calculateManualInstallment(price, bestPlan, prov, override);
        list.push(res);
      }
    });

    return list.slice(0, 3); // Max 3 providers to fit perfectly
  }, [product, installmentProviders, installmentPlans, pricingDetails.effectivePrice]);

  const activeProviders = useMemo(() => {
    if (!product || installmentProviders.length === 0 || installmentPlans.length === 0) return [];
    if (product.installmentConfig && product.installmentConfig.enabled === false) return [];

    return installmentProviders.filter((prov) => {
      if (!prov.enabled) return false;
      if (
        product.installmentConfig?.allowedProviderIds &&
        product.installmentConfig.allowedProviderIds.length > 0 &&
        !product.installmentConfig.allowedProviderIds.includes(prov.id)
      ) {
        return false;
      }
      const providerPlans = filterEligiblePlans(installmentPlans, prov, pricingDetails.effectivePrice, product.installmentConfig);
      return providerPlans.length > 0;
    }).sort((a, b) => a.displayOrder - b.displayOrder);
  }, [product, installmentProviders, installmentPlans, pricingDetails.effectivePrice]);

  const plansForSelectedProvider = useMemo(() => {
    if (!selectedProvider) return [];
    return filterEligiblePlans(
      installmentPlans,
      selectedProvider,
      pricingDetails.effectivePrice,
      product.installmentConfig
    );
  }, [selectedProvider, installmentPlans, pricingDetails.effectivePrice, product.installmentConfig]);

  // Check Web Share API compatibility on mount/open
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const canShareFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
      setIsShareSupported(canShareFiles);
    }
  }, []);



  // Helper to wait for all nested images to load
  const waitForImages = (container: HTMLElement): Promise<void[]> => {
    const images = Array.from(container.getElementsByTagName('img'));
    const promises = images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // continue on failure
      });
    });
    return Promise.all(promises);
  };

  // Generate PDF from DOM
  const generateProductPdf = async () => {
    try {
      setGenerationState('generating');
      setErrorMessage(null);

      // Brief delay to allow React to mount the hidden offscreen print template
      await new Promise((resolve) => setTimeout(resolve, 800));

      const element = printContainerRef.current;
      if (!element) {
        throw new Error('تعذر العثور على حاوية الطباعة.');
      }

      // Ensure all images are fully resolved before drawing
      await waitForImages(element);

      // PDF styling and scaling config
      const opt = {
        margin: 0,
        filename: normalizedFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Import pdf generator dynamically and clean from default exports
      const html2pdfModule = (html2pdf as any).default || html2pdf;
      
      let blob: Blob;
      try {
        // Output as Blob for sharing
        blob = await html2pdfModule().from(element).set(opt).outputPdf('blob');
      } catch (e: any) {
        console.error('Core PDF engine error:', e);
        throw e;
      }

      setPdfBlob(blob);

      const file = new File([blob], normalizedFileName, { type: 'application/pdf' });
      setPdfFile(file);

      // If Web Share file sharing is fully supported by the browser, invoke it instantly!
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const canShareFile = navigator.canShare({ files: [file] });
        if (canShareFile) {
          await navigator.share({
            files: [file],
            title: product.name,
            text: whatsappMessage
          });
          
          // Redirect to WhatsApp on successful share
          window.open(whatsappUrl, '_blank');
          setGenerationState('success');
          onClose();
          return;
        }
      }

      setGenerationState('success');
    } catch (err: any) {
      console.error('PDF Generation Failure:', err);
      setErrorMessage(err?.message || 'تعذر معالجة وتصدير ملف PDF.');
      setGenerationState('error');
    }
  };

  // Direct download handler
  const handleDownloadPdf = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = normalizedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Manual share triggers
  const handleSharePdf = async () => {
    if (!pdfFile) return;
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: product.name,
          text: whatsappMessage
        });
      } else if (navigator.share) {
        // Fallback share text
        await navigator.share({
          title: product.name,
          text: whatsappMessage,
          url: canonicalUrl
        });
      } else {
        alert('المشاركة غير مدعومة في متصفحك الحالي، يرجى تحميل الملف ومشاركته يدوياً.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Share failed:', err);
      }
    }
  };

  const handleSelectPlan = (plan: InstallmentPlan) => {
    const override = product.installmentConfig?.planOverrides?.[plan.id];
    const result = calculateManualInstallment(
      pricingDetails.effectivePrice,
      plan,
      selectedProvider!,
      override
    );
    setSelectedPlan(result);
  };

  const renderProgress = () => {
    const steps = paymentMethod === 'cash' 
      ? [
          { key: 'payment_method', label: 'طريقة الدفع' },
          { key: 'cash_timing', label: 'توقيت الدفع' },
          { key: 'delivery_method', label: 'الاستلام' },
          { key: 'review', label: 'المراجعة' },
          { key: 'pdf', label: 'ملف الـ PDF' }
        ]
      : [
          { key: 'payment_method', label: 'طريقة الدفع' },
          { key: 'provider_selection', label: 'جهة التقسيط' },
          { key: 'duration_selection', label: 'مدة التقسيط' },
          { key: 'delivery_method', label: 'الاستلام' },
          { key: 'review', label: 'المراجعة' },
          { key: 'pdf', label: 'ملف الـ PDF' }
        ];

    const getCurrentIndex = () => {
      if (generationState === 'generating' || generationState === 'success' || generationState === 'error') {
        return steps.length - 1;
      }
      return steps.findIndex((s) => s.key === step);
    };

    const currentIndex = getCurrentIndex();

    return (
      <div className="flex items-center justify-between w-full px-1 mb-6" dir="rtl">
        {steps.map((s, idx) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300 ${
                idx <= currentIndex 
                  ? 'bg-[#D4AF37] text-[#05080D]' 
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]'
              }`}>
                {idx < currentIndex ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
              </div>
              <span className={`text-[9px] mt-1.5 font-bold transition-all duration-300 ${
                idx <= currentIndex ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 transition-all duration-300 ${
                idx < currentIndex ? 'bg-[#D4AF37]' : 'bg-[var(--border)]'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 1. OFFSCREEN PDF PRINT TEMPLATE - Fixed A4 794px width, Portrait 1122px height */}
      <div className="absolute overflow-hidden w-0 h-0 pointer-events-none" style={{ left: '-9999px', top: '-9999px' }}>
        <div 
          ref={printContainerRef}
          id="pdf-print-root"
          style={{ 
            width: '794px', 
            height: '1122px',
            boxSizing: 'border-box',
            direction: 'rtl', 
            backgroundColor: '#ffffff', 
            fontFamily: "'Cairo', 'Segoe UI', system-ui, sans-serif" 
          }}
        >
          {/* ==================== STRICTLY ONE-PAGE A4 ==================== */}
          <div 
            style={{ 
              width: '794px', 
              height: '1122px', 
              padding: '30px', 
              boxSizing: 'border-box', 
              position: 'relative', 
              backgroundColor: '#ffffff',
              overflow: 'hidden'
            }}
          >
            {/* Header Branding */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '2px solid #D4AF37' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src={getValidImageSrc(printLogoUrl)} 
                  alt="البيت السعيد" 
                  style={{ height: '44px', width: 'auto', maxHeight: '44px', objectFit: 'contain' }}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                />
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', margin: 0, padding: 0 }}>البيت السعيد</h1>
                  <p style={{ fontSize: '9px', color: '#D4AF37', fontWeight: 'bold', margin: '2px 0 0 0' }}>خبرة منذ عام 1981 — ثقة وجودة عبر الأجيال</p>
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '10px', display: 'block', color: '#64748B', fontWeight: 'bold' }}>بروشور معتمد للمنتج</span>
                <span style={{ fontSize: '9px', display: 'block', color: '#64748B', marginTop: '2px' }}>{new Date().toLocaleDateString('ar-EG')}</span>
              </div>
            </div>

            {/* Product Hero Section */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '16px', marginBottom: '14px' }}>
              {/* Left Side (Flex layout): Large Product Image + Compact Color Thumbnails */}
              <div style={{ width: '230px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ width: '230px', height: '160px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                  <img 
                     src={getValidImageSrc(activeMainImage || '/logo.svg')} 
                     alt={product.name} 
                     style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }}
                     crossOrigin="anonymous"
                     referrerPolicy="no-referrer"
                  />
                </div>
                {/* Compact thumbnails underneath */}
                {activeGalleryImages.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    {activeGalleryImages.slice(0, 4).map((imgUrl, idx) => (
                      <div key={idx} style={{ width: '36px', height: '36px', border: imgUrl === activeMainImage ? '1.5px solid #D4AF37' : '1px solid #E2E8F0', borderRadius: '4px', padding: '1px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                        <img 
                          src={getValidImageSrc(imgUrl)} 
                          alt={`معاينة ${idx + 1}`}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '2px' }}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Side: Product Metadata & Compact Price Card */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'right' }}>
                <div>
                  {(product as any).brand && (
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#D4AF37', display: 'block', marginBottom: '2px' }}>
                      {(product as any).brand}
                    </span>
                  )}
                  <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', lineHeight: '1.3', margin: '0 0 4px 0' }}>
                    {product.name}
                  </h2>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    {resolvedCategory?.name && (
                      <span style={{ padding: '2px 6px', backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '4px', fontSize: '8.5px', fontWeight: 'bold' }}>
                        {resolvedCategory.name}
                      </span>
                    )}
                    {product.sku && (
                      <span style={{ fontSize: '8.5px', color: '#64748B', fontFamily: 'monospace' }}>
                        كود: {product.sku}
                      </span>
                    )}
                  </div>

                  {/* Clean Price Card */}
                  <div style={{ backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px' }}>
                    <span style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '2px' }}>سعر الكاش الحالي:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '900', color: '#16A34A', fontFamily: 'system-ui' }}>
                        {pricingDetails.effectivePrice.toLocaleString('ar-EG')} ج.م
                      </span>
                      {pricingDetails.originalBasePrice > pricingDetails.effectivePrice && (
                        <span style={{ fontSize: '11px', textDecoration: 'line-through', color: '#64748B', fontFamily: 'system-ui' }}>
                          {pricingDetails.originalBasePrice.toLocaleString('ar-EG')} ج.م
                        </span>
                      )}
                      {pricingDetails.discountPercent && (
                        <span style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FEE2E2', padding: '1px 5px', borderRadius: '4px', fontSize: '8.5px', fontWeight: 'bold' }}>
                          خصم {pricingDetails.discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compact Variant / Stock info */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {colorName && (
                      <div style={{ flex: 1, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '8.5px', color: '#64748B', display: 'block' }}>اللون المختار:</span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0F172A' }}>{colorName}</span>
                      </div>
                    )}
                    <div style={{ flex: 1, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 8px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '8.5px', color: '#64748B', display: 'block' }}>حالة التوفر:</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: product.isAvailable ? '#16A34A' : '#DC2626' }}>
                        {product.isAvailable ? 'متوفر للتسليم الفوري' : 'غير متوفر'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #E2E8F0', fontSize: '8px', color: '#64748B', lineHeight: '1.3' }}>
                  • الأسعار والخصومات المذكورة سارية وقت طباعة الملف وتخضع للتحديثات المستمرة بالمتجر.
                </div>
              </div>
            </div>

            {/* Specifications & Installments (Balanced Dual Column) */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px', borderTop: '1.5px solid #E2E8F0', paddingTop: '12px' }}>
              {/* Left Column: Specifications */}
              <div style={{ flex: 1, textAlign: 'right' }}>
                <h3 style={{ fontSize: '11px', fontWeight: '900', color: '#D4AF37', borderBottom: '1px solid #E2E8F0', paddingBottom: '3px', margin: '0 0 8px 0' }}>
                  المواصفات الفنية والتفاصيل
                </h3>
                {dynamicSpecs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {dynamicSpecs.map((spec, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9.5px', padding: '4px 0', borderBottom: '1px solid #F8FAFC' }}>
                        <span style={{ color: '#64748B', fontWeight: '500' }}>{spec.label}</span>
                        <span style={{ color: '#0F172A', fontWeight: 'bold', textAlign: 'left', paddingLeft: '4px' }}>{spec.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '9px', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>لا توجد مواصفات فنية إضافية مسجلة لهذا المنتج.</div>
                )}
              </div>

              {/* Right Column: Dynamic Cash Advantage or Selected Installment Plan */}
              <div style={{ flex: 1.1, textAlign: 'right' }}>
                {paymentMethod === 'cash' ? (
                  <>
                    <h3 style={{ fontSize: '11px', fontWeight: '900', color: '#D4AF37', borderBottom: '1px solid #E2E8F0', paddingBottom: '3px', margin: '0 0 8px 0' }}>
                      مزايا الشراء النقدي (كاش)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#0F172A', display: 'block', marginBottom: '4px' }}>✓ خصم الكاش الفوري</span>
                        <span style={{ fontSize: '8.5px', color: '#64748B', lineHeight: '1.4' }}>تم احتساب خصم نقدي خاص ومباشر على سعر المنتج المعلن بالمعرض والصفحة الحالية.</span>
                      </div>
                      <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#0F172A', display: 'block', marginBottom: '4px' }}>✓ الاستلام الفوري</span>
                        <span style={{ fontSize: '8.5px', color: '#64748B', lineHeight: '1.4' }}>المنتج متوفر في فروعنا وجاهز للتسليم والتشغيل المباشر فور إتمام المعاملة.</span>
                      </div>
                      <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#0F172A', display: 'block', marginBottom: '4px' }}>✓ طرق دفع مرنة</span>
                        <span style={{ fontSize: '8.5px', color: '#64748B', lineHeight: '1.4' }}>ندعم الدفع النقدي، المحافظ الإلكترونية (فودافون كاش، إلخ)، والفيزا البنكية بالمعرض.</span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #D4AF37', borderRadius: '8px', padding: '10px 12px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', color: '#0F172A' }}>طريقة الدفع:</span>
                        <span style={{ fontWeight: '900', color: '#D4AF37' }}>
                          كاش — {cashPaymentTiming === 'now' ? 'الدفع الآن' : 'الدفع عند الاستلام'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9.5px', color: '#64748B', paddingTop: '1px' }}>
                        <span style={{ fontWeight: 'bold', color: '#0F172A' }}>طريقة الاستلام المطلوبة:</span>
                        <span style={{ fontWeight: '900', color: '#D4AF37' }}>{deliveryMethod === 'shipping' ? 'الشحن والتوصيل 🚚' : 'الاستلام من الفرع 🏪'}</span>
                      </div>
                    </div>
                  </>
                ) : paymentMethod === 'installment' && selectedPlan ? (
                  <>
                    <h3 style={{ fontSize: '11px', fontWeight: '900', color: '#D4AF37', borderBottom: '1px solid #E2E8F0', paddingBottom: '3px', margin: '0 0 8px 0' }}>
                      خطة التقسيط المختارة
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #D4AF37', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '900', color: '#0F172A' }}>
                            {selectedPlan.isDirectStore ? 'تقسيط مباشر من المحل' : selectedPlan.providerName}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', color: '#64748B' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '2px' }}>
                            <span>مدة التقسيط:</span>
                            <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedPlan.months} أشهر</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '2px' }}>
                            <span>المقدم المطلوب:</span>
                            <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedPlan.downPayment > 0 ? `${selectedPlan.downPayment.toLocaleString('ar-EG')} ج.م` : 'بدون مقدم'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '2px' }}>
                            <span>المبلغ المتبقي:</span>
                            <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedPlan.financedAmount.toLocaleString('ar-EG')} ج.م</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '2px' }}>
                            <span>نسبة رسوم التقسيط:</span>
                            <span style={{ fontWeight: 'bold', color: '#0F172A' }}><bdi>{planPercentage}%</bdi></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '2px' }}>
                            <span>إجمالي التقسيط:</span>
                            <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{selectedPlan.totalPayable.toLocaleString('ar-EG')} ج.م</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '2px' }}>
                            <span>طريقة الاستلام:</span>
                            <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{deliveryMethod === 'shipping' ? 'الشحن 🚚' : 'الاستلام من الفرع 🏪'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                            <span style={{ fontWeight: 'bold', color: '#D4AF37' }}>القسط الشهري:</span>
                            <span style={{ fontWeight: '900', color: '#16A34A', fontSize: '12px', fontFamily: 'system-ui' }}>{selectedPlan.monthlyPayment.toLocaleString('ar-EG')} ج.م / شهر</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748B', marginTop: '2px', lineHeight: '1.3' }}>
                        • القسط المعروض تقديري وتخضع الشروط والموافقة النهائية لإجراءات جهة التقسيط / المحل.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize: '11px', fontWeight: '900', color: '#D4AF37', borderBottom: '1px solid #E2E8F0', paddingBottom: '3px', margin: '0 0 8px 0' }}>
                      تسهيلات تقسيط متميزة بالمعرض
                    </h3>
                    <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <h4 style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#0F172A', margin: '0 0 3px 0' }}>تقسيط مباشر وضمان معتمد</h4>
                      <p style={{ fontSize: '8.5px', color: '#64748B', lineHeight: '1.3', margin: 0 }}>
                        ندعم الدفع النقدي والفيزا البنكية بالمعرض، بالإضافة إلى شراكات مع كبرى شركات التمويل والتقسيط الاستهلاكي المعتمدة لتلبية احتياجاتكم.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Direct Value Add / Trust Icons strip */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px', backgroundColor: '#F8FAFC' }}>
                <Shield style={{ width: '12px', height: '12px', color: '#D4AF37', flexShrink: 0 }} />
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#0F172A', display: 'block' }}>ضمان محلي معتمد</span>
                  <span style={{ fontSize: '8px', color: '#64748B' }}>منتجات أصلية 100٪ بضمان الوكيل</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px', backgroundColor: '#F8FAFC' }}>
                <Truck style={{ width: '12px', height: '12px', color: '#D4AF37', flexShrink: 0 }} />
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#0F172A', display: 'block' }}>شحن منزلي سريع</span>
                  <span style={{ fontSize: '8px', color: '#64748B' }}>توصيل آمن لجميع محافظات مصر</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px', backgroundColor: '#F8FAFC' }}>
                <MessageCircle style={{ width: '12px', height: '12px', color: '#D4AF37', flexShrink: 0 }} />
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#0F172A', display: 'block' }}>خدمة عملاء ممتازة</span>
                  <span style={{ fontSize: '8px', color: '#64748B' }}>متابعة ودعم على مدار الساعة</span>
                </div>
              </div>
            </div>

            {/* Store Information Block with QR code side-by-side */}
            <div style={{ position: 'absolute', bottom: '65px', left: '30px', right: '30px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right' }}>
                <span style={{ fontSize: '9px', fontWeight: '900', color: '#0F172A' }}>معلومات الاتصال بالمعرض والفرع الرئيسي:</span>
                <span style={{ fontSize: '8.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin style={{ width: '10px', height: '10px', color: '#D4AF37', flexShrink: 0 }} />
                  <span>25 شارع النور، منشية عبدالمنعم رياض، ام بيومي، شبرا الخيمة</span>
                </span>
                <span style={{ fontSize: '8.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock style={{ width: '10px', height: '10px', color: '#D4AF37', flexShrink: 0 }} />
                  <span>ساعات العمل المعرض: يومياً من الساعة 12 ظهراً حتى 11 مساءً</span>
                </span>
                <span style={{ fontSize: '8.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone style={{ width: '10px', height: '10px', color: '#D4AF37', flexShrink: 0 }} />
                  <span>الخط المباشر / واتساب المعرض: <bdi dir="ltr">{settings?.whatsappNumber || '01019811981'}</bdi></span>
                </span>
              </div>

              {canonicalUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', borderRight: '1px solid #E2E8F0', paddingRight: '12px', marginRight: '12px' }}>
                  <img 
                    src={getValidImageSrc(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(canonicalUrl)}`)} 
                    alt="عرض المنتج" 
                    style={{ width: '48px', height: '48px', borderRadius: '4px', backgroundColor: '#ffffff' }}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                  />
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#0F172A', whiteSpace: 'nowrap' }}>عرض المنتج على المتجر</span>
                </div>
              )}
            </div>

            {/* Page Footer */}
            <div style={{ position: 'absolute', bottom: '24px', left: '30px', right: '30px', borderTop: '1px solid #E2E8F0', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
              <span style={{ fontSize: '8px', color: '#64748B' }}>البيت السعيد — خبرة وثقة منذ عام 1981</span>
              <span style={{ fontSize: '8px', color: '#64748B', fontWeight: 'bold' }}>بروشور رقمي صفحة 1 من 1</span>
              <span style={{ fontSize: '8px', color: '#64748B' }}>المبيعات / الدعم: <bdi dir="ltr">{settings?.whatsappNumber || '01019811981'}</bdi></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. USER INTERACTION MODAL COVER */}
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#05080D]/85 backdrop-blur-md"
          />

          {/* Dialog Container */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-md bg-[var(--surface-elevated)] border border-[var(--border)] rounded-3xl shadow-2xl p-6 overflow-hidden z-10"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">بروشور تفاصيل المنتج</h3>
                  <p className="text-[10px] text-[var(--text-secondary)]">تجهيز بروشور البيت السعيد</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PROGRESS BAR */}
            {renderProgress()}

            {/* STEP 1: PAYMENT METHOD */}
            {generationState === 'idle' && step === 'payment_method' && (
              <div className="space-y-4">
                <div className="text-right">
                  <h4 className="text-sm font-extrabold text-[var(--text-primary)]">طريقة الدفع</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">اختر طريقة الدفع المناسبة لك لتجهيز تفاصيل البروشور</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-5">
                  <button
                    onClick={() => {
                      setPaymentMethod('cash');
                      setStep('cash_timing');
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl transition-all cursor-pointer hover:border-[#D4AF37] group text-center space-y-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] group-hover:scale-105 transition-transform">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-sm font-black text-[var(--text-primary)]">كاش</span>
                      <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">الدفع النقدي الفوري</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setPaymentMethod('installment');
                      setCashPaymentTiming(null);
                      setStep('provider_selection');
                    }}
                    className="flex flex-col items-center justify-center p-6 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl transition-all cursor-pointer hover:border-[#D4AF37] group text-center space-y-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] group-hover:scale-105 transition-transform">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-sm font-black text-[var(--text-primary)]">تقسيط</span>
                      <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">خطط تمويل مرنة</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP: CASH PAYMENT TIMING */}
            {generationState === 'idle' && step === 'cash_timing' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <h4 className="text-sm font-extrabold text-[var(--text-primary)]">متى سيتم الدفع؟</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">اختر وقت السداد المفضل لديك</p>
                  </div>
                  <button 
                    onClick={() => {
                      setStep('payment_method');
                    }}
                    className="text-xs text-[#D4AF37] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>رجوع</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-5">
                  <button
                    onClick={() => {
                      setCashPaymentTiming('now');
                      setStep('delivery_method');
                    }}
                    className={`flex flex-col items-center justify-center p-6 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border rounded-2xl transition-all cursor-pointer text-center space-y-3 ${
                      cashPaymentTiming === 'now'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-[var(--border)] hover:border-[#D4AF37]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-2xl transition-transform hover:scale-105">
                      💵
                    </div>
                    <div>
                      <span className="block text-sm font-black text-[var(--text-primary)]">الدفع الآن</span>
                      <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">إتمام الدفع مباشرة بالمعرض</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setCashPaymentTiming('on_delivery');
                      setStep('delivery_method');
                    }}
                    className={`flex flex-col items-center justify-center p-6 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border rounded-2xl transition-all cursor-pointer text-center space-y-3 ${
                      cashPaymentTiming === 'on_delivery'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-[var(--border)] hover:border-[#D4AF37]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-2xl transition-transform hover:scale-105">
                      🤝
                    </div>
                    <div>
                      <span className="block text-sm font-black text-[var(--text-primary)]">الدفع عند الاستلام</span>
                      <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">الدفع فورا فور استلام المنتج</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PROVIDER SELECTION */}
            {generationState === 'idle' && step === 'provider_selection' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <h4 className="text-sm font-extrabold text-[var(--text-primary)]">جهة التقسيط</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">اختر جهة التقسيط المناسبة</p>
                  </div>
                  <button 
                    onClick={() => setStep('payment_method')}
                    className="text-xs text-[#D4AF37] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>رجوع</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  {activeProviders.map((prov) => (
                    <button
                      key={prov.id}
                      onClick={() => {
                        setSelectedProvider(prov);
                        setSelectedPlan(null);
                        setStep('duration_selection');
                      }}
                      className="flex flex-col items-center justify-center p-4 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[#D4AF37] rounded-2xl transition-all cursor-pointer text-center space-y-2"
                    >
                      <ProviderLogo provider={prov} size="md" />
                      <span className="text-[10px] font-black text-[var(--text-primary)] line-clamp-1">{prov.name}</span>
                    </button>
                  ))}
                  {activeProviders.length === 0 && (
                    <div className="col-span-3 text-center py-6 text-xs text-[var(--text-secondary)]">
                      لا تتوفر جهات تقسيط حالياً لهذا المنتج.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: DURATION SELECTION */}
            {generationState === 'idle' && step === 'duration_selection' && selectedProvider && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ProviderLogo provider={selectedProvider} size="sm" />
                    <div className="text-right">
                      <h4 className="text-sm font-extrabold text-[var(--text-primary)]">مدة التقسيط</h4>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">اختر مدة التقسيط والبرنامج المناسب</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setStep('provider_selection')}
                    className="text-xs text-[#D4AF37] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>تغيير الجهة</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                  {plansForSelectedProvider.map((plan) => {
                    const override = product.installmentConfig?.planOverrides?.[plan.id];
                    const result = calculateManualInstallment(
                      pricingDetails.effectivePrice,
                      plan,
                      selectedProvider,
                      override
                    );
                    const isSelected = selectedPlan?.planId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[var(--text-primary)]' 
                            : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="block text-xs font-black">{plan.months} أشهر</span>
                        <span className="block text-[10px] opacity-80 mt-1">{result.monthlyPayment.toLocaleString('ar-EG')} ج.م/شهر</span>
                      </button>
                    );
                  })}
                </div>

                {selectedPlan && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl space-y-3 mt-2"
                  >
                    <div className="text-center py-1.5 border-b border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-secondary)] block">القسط الشهري التقديري</span>
                      <span className="text-xl font-black text-emerald-500 block mt-1">{selectedPlan.monthlyPayment.toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م / شهر</span></span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[10px] text-[var(--text-secondary)]">
                      <div className="flex justify-between">
                        <span>سعر المنتج:</span>
                        <span className="font-bold text-[var(--text-primary)]">{selectedPlan.productPrice.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المقدم المطلوب:</span>
                        <span className="font-bold text-[var(--text-primary)]">{selectedPlan.downPayment > 0 ? `${selectedPlan.downPayment.toLocaleString('ar-EG')} ج.م` : 'بدون مقدم'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المبلغ المتبقي:</span>
                        <span className="font-bold text-[var(--text-primary)]">{selectedPlan.financedAmount.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span>إجمالي التقسيط:</span>
                        <span className="font-bold text-[var(--text-primary)]">{selectedPlan.totalPayable.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setStep('delivery_method')}
                      className="w-full py-3 bg-[#D4AF37] hover:bg-[#B88A24] text-[#05080D] text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/10 mt-1"
                    >
                      <span>تأكيد ومتابعة المراجعة</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </div>
            )}

            {/* STEP: DELIVERY METHOD */}
            {generationState === 'idle' && step === 'delivery_method' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <h4 className="text-sm font-extrabold text-[var(--text-primary)]">طريقة الاستلام</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">اختر الطريقة المناسبة لك</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (paymentMethod === 'cash') {
                        setStep('cash_timing');
                      } else {
                        setStep('duration_selection');
                      }
                    }}
                    className="text-xs text-[#D4AF37] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>رجوع</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-5">
                  <button
                    onClick={() => {
                      setDeliveryMethod('shipping');
                      setStep('review');
                    }}
                    className={`flex flex-col items-center justify-center p-6 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border rounded-2xl transition-all cursor-pointer text-center space-y-3 ${
                      deliveryMethod === 'shipping'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-[var(--border)] hover:border-[#D4AF37]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-2xl transition-transform hover:scale-105">
                      🚚
                    </div>
                    <div>
                      <span className="block text-sm font-black text-[var(--text-primary)]">الشحن</span>
                      <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">توصيل المنتج إلى العنوان</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setDeliveryMethod('branch_pickup');
                      setStep('review');
                    }}
                    className={`flex flex-col items-center justify-center p-6 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border rounded-2xl transition-all cursor-pointer text-center space-y-3 ${
                      deliveryMethod === 'branch_pickup'
                        ? 'border-[#D4AF37] bg-[#D4AF37]/5'
                        : 'border-[var(--border)] hover:border-[#D4AF37]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-2xl transition-transform hover:scale-105">
                      🏪
                    </div>
                    <div>
                      <span className="block text-sm font-black text-[var(--text-primary)]">الاستلام من الفرع</span>
                      <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">استلام المنتج من الفرع</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW */}
            {generationState === 'idle' && step === 'review' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <h4 className="text-sm font-extrabold text-[var(--text-primary)]">مراجعة الاستفسار</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">تفاصيل الاستفسار قبل توليد البروشور</p>
                  </div>
                  <button 
                    onClick={() => {
                      setStep('delivery_method');
                    }}
                    className="text-xs text-[#D4AF37] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>تعديل التفاصيل</span>
                  </button>
                </div>

                {paymentMethod === 'cash' ? (
                  <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl space-y-2.5 text-right">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">المنتج:</span>
                        <span className="font-black text-[var(--text-primary)] truncate max-w-[200px]">{product.name}</span>
                      </div>
                      {colorName && (
                        <div className="flex justify-between border-b border-[var(--border)] pb-2">
                          <span className="text-[var(--text-secondary)]">اللون المختار:</span>
                          <span className="font-bold text-[var(--text-primary)]">{colorName}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">نظام السداد:</span>
                        <span className="font-bold text-[#D4AF37]">كاش</span>
                      </div>
                      {cashPaymentTiming && (
                        <div className="flex justify-between border-b border-[var(--border)] pb-2">
                          <span className="text-[var(--text-secondary)]">الدفع:</span>
                          <span className="font-bold text-[var(--text-primary)]">
                            {cashPaymentTiming === 'now' ? 'الآن' : 'عند الاستلام'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">سعر الكاش:</span>
                        <span className="font-black text-emerald-500 text-sm">{pricingDetails.effectivePrice.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-[var(--text-secondary)]">طريقة الاستلام:</span>
                        <span className="font-bold text-[var(--text-primary)]">{deliveryMethod === 'shipping' ? '🚚 الشحن' : '🏪 الاستلام من الفرع'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl space-y-2.5 text-right">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">المنتج:</span>
                        <span className="font-black text-[var(--text-primary)] truncate max-w-[200px]">{product.name}</span>
                      </div>
                      {colorName && (
                        <div className="flex justify-between border-b border-[var(--border)] pb-2">
                          <span className="text-[var(--text-secondary)]">اللون المختار:</span>
                          <span className="font-bold text-[var(--text-primary)]">{colorName}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">جهة التقسيط:</span>
                        <span className="font-black text-[var(--text-primary)]">{selectedPlan?.providerName}</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">مدة التقسيط:</span>
                        <span className="font-bold text-[var(--text-primary)]">{selectedPlan?.months} أشهر</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">المقدم المطلوب:</span>
                        <span className="font-bold text-[var(--text-primary)]">{selectedPlan && selectedPlan.downPayment > 0 ? `${selectedPlan.downPayment.toLocaleString('ar-EG')} ج.م` : 'بدون مقدم'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[var(--border)] pb-2">
                        <span className="text-[var(--text-secondary)]">القسط الشهري التقديري:</span>
                        <span className="font-black text-emerald-500 text-sm">{selectedPlan?.monthlyPayment.toLocaleString('ar-EG')} ج.م / شهر</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-[var(--text-secondary)]">طريقة الاستلام:</span>
                        <span className="font-bold text-[var(--text-primary)]">{deliveryMethod === 'shipping' ? '🚚 الشحن' : '🏪 الاستلام من الفرع'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={generateProductPdf}
                  className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#B88A24] text-[#05080D] text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 mt-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>تجهيز ملف الـ PDF وبدء الاستفسار</span>
                </button>
              </div>
            )}

            {/* LOADING STATE */}
            {generationState === 'generating' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin" />
                <div className="space-y-1.5">
                  <h4 className="text-sm font-extrabold text-[var(--text-primary)]">جاري إنشاء ملف الـ PDF...</h4>
                  <p className="text-xs text-[var(--text-secondary)]">نقوم بتجميع البيانات وتنسيق صور Color Variant المحدد</p>
                </div>
                <div className="w-full bg-[var(--surface)] h-1.5 rounded-full overflow-hidden max-w-[200px] border border-[var(--border)]">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2.5, ease: 'easeInOut' }}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#B88A24] h-full"
                  />
                </div>
              </div>
            )}

            {/* ERROR STATE */}
            {generationState === 'error' && (
              <div className="space-y-5">
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-rose-500">تعذر تجهيز ملف PDF حالياً</h4>
                    <p className="text-[10px] text-[var(--text-secondary)]">{errorMessage || 'حدث خطأ غير متوقع أثناء معالجة المستند.'}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={generateProductPdf}
                    className="w-full py-3 px-4 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Loader2 className="w-3.5 h-3.5" />
                    <span>إعادة المحاولة ثانية</span>
                  </button>

                  <a 
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      onClose();
                    }}
                    className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>إرسال استفسار واتساب بدون PDF</span>
                  </a>
                </div>
              </div>
            )}

            {/* SUCCESS STATE */}
            {generationState === 'success' && (
              <div className="space-y-5">
                {/* PDF File Card */}
                <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-14 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 shrink-0">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <h4 className="text-xs font-black text-[var(--text-primary)] truncate" title={normalizedFileName}>
                      {normalizedFileName}
                    </h4>
                    <p className="text-[10px] text-[var(--text-secondary)]">تم تجهيز ملف البروشور المعتمد بنجاح</p>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <a 
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      onClose();
                    }}
                    className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>فتح واتساب ومشاركة التفاصيل</span>
                  </a>

                  {isShareSupported && (
                    <button 
                      onClick={handleSharePdf}
                      className="w-full py-3 px-4 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4 text-[#D4AF37]" />
                      <span>مشاركة ملف الـ PDF</span>
                    </button>
                  )}

                  <button 
                    onClick={handleDownloadPdf}
                    className="w-full py-3 px-4 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4 text-[#D4AF37]" />
                    <span>تحميل ملف الـ PDF</span>
                  </button>
                </div>

                <p className="text-[10px] text-center text-[var(--text-muted)] leading-relaxed">
                  يمكنك تحميل ملف الـ PDF وإرساله مباشرة لخدمة العملاء على الواتساب، أو استخدام زر المشاركة إذا كان مدعوماً في متصفحك.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </AnimatePresence>
    </>
  );
}
