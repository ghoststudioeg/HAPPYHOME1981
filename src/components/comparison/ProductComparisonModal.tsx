import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useMemo, useEffect } from 'react';
import { Product, StoreSettings } from '../../types';
import { 
  compareProducts, 
  comparePhones,
  ComparisonResult, 
  getCompatibleComparisonProducts, 
  getChangeProductLabel,
  getCategoryNoun
} from '../../lib/comparison';
import { extractBrand } from '../../lib/brandUtils';
import { isSameCategory, isMobileProduct } from '../../lib/recommendations';
import { productService } from '../../lib/data/productService';
import {

  X,
  Trophy,
  Scale,
  Search,
  MessageCircle,
  ExternalLink,
  TrendingDown,
  Sparkles,
  Info
} from 'lucide-react';

interface ProductComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  productA: Product;
  initialProductB?: Product | null;
  allProducts: Product[];
  storeSettings?: StoreSettings | null;
  onNavigateToProduct: (slug: string) => void;
}

export function ProductComparisonModal({
  isOpen,
  onClose,
  productA,
  initialProductB,
  allProducts,
  storeSettings,
  onNavigateToProduct
}: ProductComparisonModalProps) {
  // All published candidates from the SAME category, excluding productA
  const candidateProducts = useMemo(() => {
    return getCompatibleComparisonProducts(productA, allProducts);
  }, [allProducts, productA]);

  // Selected Product B state
  const [selectedProductBId, setSelectedProductBId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeviceBSearch, setShowDeviceBSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync selectedProductBId strictly with candidates
  useEffect(() => {
    if (candidateProducts.length === 0) {
      setSelectedProductBId('');
      return;
    }

    // If initialProductB is provided and belongs to the candidates list, select it
    if (initialProductB && candidateProducts.some((c) => c.id === initialProductB.id)) {
      setSelectedProductBId(initialProductB.id);
      return;
    }

    // If current selectedProductBId is not in candidateProducts, reset to the first compatible candidate
    if (!selectedProductBId || !candidateProducts.some((c) => c.id === selectedProductBId)) {
      setSelectedProductBId(candidateProducts[0].id);
    }
  }, [initialProductB, candidateProducts, selectedProductBId]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const productB = useMemo(() => {
    return candidateProducts.find((p) => p.id === selectedProductBId) || candidateProducts[0] || null;
  }, [candidateProducts, selectedProductBId]);

  // Centralized data-driven comparison computation
  const comparison: ComparisonResult | null = useMemo(() => {
    if (!productA || !productB) return null;
    return isMobileProduct(productA)
      ? comparePhones(productA, productB)
      : compareProducts(productA, productB);
  }, [productA, productB]);

  // Filtered products for Product B switcher
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidateProducts;
    const q = searchQuery.toLowerCase().trim();
    return candidateProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        extractBrand(p.name).toLowerCase().includes(q)
    );
  }, [candidateProducts, searchQuery]);

  if (!isOpen) return null;

  // WhatsApp handler
  const handleWhatsAppInquiry = (prod: Product) => {
    productService.incrementWhatsAppClicks(prod.id);
    const whatsappNum = (storeSettings?.whatsappNumber || '201000000000').replace(/[^0-9]/g, '');
    const message = `مرحباً، أنا مهتم بالمقارنة في المتجر وأود الاستفسار عن الموبايل: ${prod.name} (كود: ${prod.sku || prod.id}) وسعره ${prod.price.toLocaleString('ar-EG')} ج.م`;
    const url = `https://wa.me/${whatsappNum}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const brandA = extractBrand(productA.name);
  const brandB = productB ? extractBrand(productB.name) : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[var(--overlay)] backdrop-blur-2xl overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl glass-panel-elevated border border-[#D4AF37]/35 rounded-3xl shadow-[var(--shadow)] overflow-hidden flex flex-col max-h-[92vh] text-[var(--text-primary)] liquid-reflection"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--background)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#E0B84A]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                <span>مقارنة المواصفات الذكية</span>
                <span className="text-[10px] font-bold text-[#E0B84A] glass-pill-gold px-2 py-0.5 rounded-full">
                  مباشر
                </span>
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">مقارنة تفصيلية دقيقة مستندة لبيانات المواصفات الفعلية للأجهزة</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl glass-pill hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق المقارنة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5 custom-scrollbar">
          {/* Top Showcase: Device A vs Device B Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 relative">
            {/* VS Badge in Center */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[var(--background)] border-2 border-[#D4AF37] items-center justify-center shadow-lg text-[#E0B84A] font-black text-xs">
              VS
            </div>

            {/* Device A (Current Product) */}
            <div className="glass-panel border border-[#D4AF37]/35 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[var(--background)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                  <img
                    src={getValidImageSrc(productA.mainImageUrl || '/logo.svg')}
                    alt={productA.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md glass-pill-gold">
                      {brandA}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">الهاتف الحالي</span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{productA.name}</h3>

                  <div className="flex items-baseline gap-2 pt-0.5">
                    <span className="text-base sm:text-lg font-black text-[#E0B84A]">
                      {productA.price.toLocaleString('ar-EG')}{' '}
                      <span className="text-xs font-bold text-[#D4AF37]">ج.م</span>
                    </span>
                    {productA.oldPrice && productA.oldPrice > productA.price && (
                      <span className="text-xs text-[var(--text-muted)] line-through">
                        {productA.oldPrice.toLocaleString('ar-EG')} ج.م
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Device A */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => handleWhatsAppInquiry(productA)}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>طلب عبر واتساب</span>
                </button>
              </div>
            </div>

            {/* Device B (Compared Product) */}
            <div className="glass-panel border border-[var(--border)] hover:border-[#D4AF37]/30 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
              {productB ? (
                <>
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[var(--background)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                      <img
                        src={getValidImageSrc(productB.mainImageUrl || '/logo.svg')}
                        alt={productB.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md glass-pill text-sky-500">
                          {brandB}
                        </span>

                        <button
                          type="button"
                          onClick={() => setShowDeviceBSearch(!showDeviceBSearch)}
                          className="text-[11px] text-[#E0B84A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{showDeviceBSearch ? 'إخفاء القائمة' : getChangeProductLabel(productA)}</span>
                        </button>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{productB.name}</h3>

                      <div className="flex items-baseline gap-2 pt-0.5">
                        <span className="text-base sm:text-lg font-black text-[#E0B84A]">
                          {productB.price.toLocaleString('ar-EG')}{' '}
                          <span className="text-xs font-bold text-[#D4AF37]">ج.م</span>
                        </span>
                        {productB.oldPrice && productB.oldPrice > productB.price && (
                          <span className="text-xs text-[var(--text-muted)] line-through">
                            {productB.oldPrice.toLocaleString('ar-EG')} ج.م
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons for Device B */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => handleWhatsAppInquiry(productB)}
                      className="flex-1 py-2 px-3 rounded-xl glass-pill hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>طلب عبر واتساب</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToProduct(productB.slug);
                      }}
                      className="py-2 px-3 rounded-xl glass-pill text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-xs flex items-center gap-1 cursor-pointer"
                      title="عرض صفحة المنتج"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>عرض</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <p className="text-xs text-[var(--text-secondary)]">لا يوجد {getCategoryNoun(productA)} محدد للمقارنة</p>
                  <button
                    type="button"
                    onClick={() => setShowDeviceBSearch(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs cursor-pointer"
                  >
                    اختر {getCategoryNoun(productA)}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Device Switcher Drawer */}
          {showDeviceBSearch && (
            <div className="glass-panel border border-[#D4AF37]/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                  <Search className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>اختر {getCategoryNoun(productA)} آخر لمقارنته مع {productA.name}:</span>
                </div>
                <button
                  onClick={() => {
                    setShowDeviceBSearch(false);
                    setError(null);
                  }}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  إغلاق
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-[10px] text-red-500 font-bold">
                  {error}
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، الماركة أو الكود..."
                  className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                />
              </div>

              {filteredCandidates.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  {filteredCandidates.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => {
                        // Final compatibility validation before changing
                        if (isSameCategory(productA, cand)) {
                          setSelectedProductBId(cand.id);
                          setShowDeviceBSearch(false);
                          setError(null);
                        } else {
                          setError("لا يمكن مقارنة منتجات من أنواع مختلفة. اختر منتجًا من نفس القسم.");
                        }
                      }}
                      className={`p-2 rounded-xl text-right transition-all flex items-center gap-2 border cursor-pointer ${
                        selectedProductBId === cand.id
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[var(--text-primary)]'
                          : 'glass-panel border-[var(--border)] hover:border-[#D4AF37]/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <img
                        src={getValidImageSrc(cand.mainImageUrl || '/logo.svg')}
                        alt={cand.name}
                        className="w-8 h-8 rounded-lg object-contain bg-[var(--background)] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold truncate">{cand.name}</p>
                        <p className="text-[10px] text-[#D4AF37]">{cand.price.toLocaleString('ar-EG')} ج.م</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-[var(--surface)] rounded-xl border border-dashed border-[var(--border)]">
                  <p className="text-xs text-[var(--text-secondary)] font-bold">
                    {searchQuery ? 'لم يتم العثور على نتائج للبحث.' : 'لا توجد منتجات أخرى متاحة للمقارنة في هذا القسم.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Comparison Score & Summary Banner */}
          {comparison && (
            <div className="glass-panel-elevated rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 border border-[#D4AF37]/25">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#E0B84A] shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
                      <span>التقييم ومعدل التفوق</span>
                      {comparison.overallWinner === 'A' && (
                        <span className="text-[10px] font-black bg-[#D4AF37] text-black px-2 py-0.5 rounded-md">
                          تفوق {brandA}
                        </span>
                      )}
                      {comparison.overallWinner === 'B' && (
                        <span className="text-[10px] font-black bg-sky-500 text-white px-2 py-0.5 rounded-md">
                          تفوق {brandB}
                        </span>
                      )}
                      {comparison.overallWinner === 'tie' && (
                        <span className="text-[10px] font-bold glass-pill text-[var(--text-primary)] px-2 py-0.5 rounded-md">
                          تعادل في المواصفات
                        </span>
                      )}
                      {/* Confidence Indicator */}
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                        comparison.confidence === 'high' 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                          : comparison.confidence === 'medium'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                          : 'bg-red-500/10 border-red-500/30 text-red-500'
                      }`}>
                        دقة: {comparison.confidence === 'high' ? 'عالية' : comparison.confidence === 'medium' ? 'متوسطة' : 'محدودة'}
                      </span>
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{comparison.summaryText}</p>
                    <p className="text-[11px] text-[#D4AF37] mt-1 font-medium italic">
                      {comparison.disclaimerText}
                    </p>
                  </div>
                </div>

                {/* Price Difference Indicator */}
                {comparison.priceDiff !== 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel border border-[var(--border)] text-xs shrink-0">
                    {comparison.cheaperProduct === 'A' ? (
                      <span className="text-emerald-500 flex items-center gap-1 font-bold">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{productA.name} أوفر بـ {Math.abs(comparison.priceDiff).toLocaleString('ar-EG')} ج.م</span>
                      </span>
                    ) : (
                      <span className="text-emerald-500 flex items-center gap-1 font-bold">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{productB?.name} أوفر بـ {Math.abs(comparison.priceDiff).toLocaleString('ar-EG')} ج.م</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Side-by-side Score Visualizer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-primary)] truncate max-w-[180px]">{productA.name}</span>
                    <span className="font-black text-[#E0B84A]">
                      {comparison.scoreA !== null ? `${comparison.scoreA}%` : 'مواصفات مسجلة'}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--background)] border border-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] transition-all duration-700"
                      style={{ width: `${Math.max(5, comparison.scoreA ?? 50)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)]">تفوق في {comparison.winsA} مواصفات</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-primary)] truncate max-w-[180px]">{productB?.name}</span>
                    <span className="font-black text-sky-500">
                      {comparison.scoreB !== null ? `${comparison.scoreB}%` : 'مواصفات مسجلة'}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--background)] border border-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-700"
                      style={{ width: `${Math.max(5, comparison.scoreB ?? 50)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)]">تفوق في {comparison.winsB} مواصفات</p>
                </div>
              </div>
            </div>
          )}

          {/* Side-by-side Specifications Comparison Table */}
          {comparison && (
            <div className="glass-panel border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-[var(--background)] px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-xs font-black text-[var(--text-primary)]">جدول المقارنة التفصيلي للمواصفات</span>
                <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                  <Info className="w-3 h-3 text-[#D4AF37]" />
                  <span>المواصفات غير المسجلة تظهر "غير محدد"</span>
                </span>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {/* Price Row */}
                <div className="grid grid-cols-12 items-center p-3.5 sm:p-4 bg-[var(--surface)]">
                  <div className="col-span-4 sm:col-span-3 text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                    <span>السعر في المعرض</span>
                  </div>

                  <div className="col-span-4 sm:col-span-4 text-center px-2">
                    <span className="text-xs sm:text-sm font-black text-[#E0B84A]">
                      {productA.price.toLocaleString('ar-EG')} ج.م
                    </span>
                    {comparison.cheaperProduct === 'A' && (
                      <span className="block text-[10px] font-bold text-emerald-500 mt-0.5">السعر الأقل</span>
                    )}
                  </div>

                  <div className="col-span-4 sm:col-span-5 text-center px-2">
                    {productB && (
                      <>
                        <span className="text-xs sm:text-sm font-black text-sky-500">
                          {productB.price.toLocaleString('ar-EG')} ج.م
                        </span>
                        {comparison.cheaperProduct === 'B' && (
                          <span className="block text-[10px] font-bold text-emerald-500 mt-0.5">السعر الأقل</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Specs Rows */}
                {comparison.rows.map((row) => {
                  const Icon = row.icon;
                  const isWinnerA = row.winner === 'A';
                  const isWinnerB = row.winner === 'B';

                  return (
                    <div
                      key={row.key}
                      className="grid grid-cols-12 items-center p-3 sm:p-4 hover:bg-[var(--surface-elevated)] transition-colors"
                    >
                      <div className="col-span-4 sm:col-span-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg glass-panel flex items-center justify-center text-[#D4AF37] shrink-0">
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold text-[var(--text-secondary)] leading-snug">
                          {row.label}
                        </span>
                      </div>

                      <div className="col-span-4 sm:col-span-4 text-center px-2">
                        <div
                          className={`inline-block py-1 px-2.5 rounded-xl text-xs sm:text-sm transition-all relative ${
                            isWinnerA
                              ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/40 font-black text-[var(--text-primary)] shadow-xs'
                              : row.valA === 'غير محدد'
                              ? 'text-[var(--text-muted)] text-[11px]'
                              : 'font-semibold text-[var(--text-primary)]'
                          }`}
                        >
                          {row.valA}
                          {isWinnerA && (
                            <Trophy className="w-3 h-3 text-[#D4AF37] absolute -top-1.5 -right-1.5 drop-shadow-lg" />
                          )}
                          {isWinnerA && row.advantageText && (
                            <span className="block text-[9px] font-bold text-[#E0B84A] mt-0.5">
                               {row.advantageText}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="col-span-4 sm:col-span-5 text-center px-2">
                        <div
                          className={`inline-block py-1 px-2.5 rounded-xl text-xs sm:text-sm transition-all relative ${
                            isWinnerB
                              ? 'bg-sky-500/15 border border-sky-500/40 font-black text-[var(--text-primary)] shadow-xs'
                              : row.valB === 'غير محدد'
                              ? 'text-[var(--text-muted)] text-[11px]'
                              : 'font-semibold text-[var(--text-primary)]'
                          }`}
                        >
                          {row.valB}
                          {isWinnerB && (
                            <Trophy className="w-3 h-3 text-sky-500 absolute -top-1.5 -left-1.5 drop-shadow-lg" />
                          )}
                          {isWinnerB && row.advantageText && (
                            <span className="block text-[9px] font-bold text-sky-500 mt-0.5">
                               {row.advantageText}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conclusion / Summary Section for Phones */}
          {comparison && isMobileProduct(productA) && comparison.overallWinner !== 'insufficient' && (
            <div className="glass-panel-elevated border border-[#D4AF37]/35 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-gradient-to-r from-[#D4AF37]/20 to-transparent px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#E0B84A]" />
                <h4 className="text-sm sm:text-base font-black text-[var(--text-primary)]">الخلاصة والفائز بالمقارنة</h4>
              </div>
              
              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--background)] border-2 border-[#D4AF37] flex items-center justify-center p-2 shrink-0">
                      <img 
                        src={getValidImageSrc(comparison.overallWinner === 'A' ? productA.mainImageUrl : productB?.mainImageUrl)} 
                        alt="Winner"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">الفائز النهائي بناءً على المواصفات</div>
                      <div className="text-base sm:text-xl font-black text-[#E0B84A]">
                        {comparison.overallWinner === 'A' ? productA.name : productB?.name}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">
                        أقوى في <span className="font-bold text-[#E0B84A]">{comparison.overallWinner === 'A' ? comparison.winsA : comparison.winsB}</span> من المواصفات المسجلة
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel border border-[var(--border)] rounded-xl p-3.5 space-y-3">
                    <div className="text-[11px] font-black text-[var(--text-secondary)] mb-1">أبرز نقاط قوة {comparison.overallWinner === 'A' ? productA.name : productB?.name}:</div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(comparison.overallWinner === 'A' ? comparison.strengthsA : comparison.strengthsB)
                        .slice(0, 6)
                        .map((label, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-[11px] text-[var(--text-primary)]">
                            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <Trophy className="w-2.5 h-2.5 text-emerald-500" />
                            </div>
                            <span className="font-bold">{label}</span>
                          </li>
                        ))}
                    </ul>
                  </div>

                  {/* Show secondary strengths if they exist */}
                  {(comparison.overallWinner === 'A' ? comparison.strengthsB : comparison.strengthsA).length > 0 && (
                    <div className="p-3.5 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] mb-2">نقاط قوة المنافس ({comparison.overallWinner === 'A' ? productB?.name : productA.name}):</div>
                      <div className="flex flex-wrap gap-2">
                        {(comparison.overallWinner === 'A' ? comparison.strengthsB : comparison.strengthsA).map((label, idx) => (
                          <span key={idx} className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)]">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        fill="none"
                        stroke={comparison.overallWinner === 'A' ? '#D4AF37' : '#0ea5e9'}
                        strokeWidth="8"
                        strokeDasharray={364.4}
                        strokeDashoffset={364.4 - (364.4 * (comparison.overallWinner === 'A' ? (comparison.scoreA || 0) : (comparison.scoreB || 0))) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-[var(--text-primary)]">
                        {comparison.overallWinner === 'A' ? comparison.scoreA : comparison.scoreB}%
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">قوة المواصفات</span>
                    </div>
                  </div>
                  
                  <div className="max-w-[200px]">
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {comparison.overallWinner === 'tie' 
                        ? "المواصفات متقاربة للغاية، القرار النهائي يعتمد على تفضيلك الشخصي للتصميم أو الماركة."
                        : `يتفوق ${comparison.overallWinner === 'A' ? productA.name : productB?.name} بشكل ملحوظ في الأداء العام وتجربة المستخدم.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Disclaimer */}
          <div className="p-3.5 rounded-xl glass-panel border border-[var(--border)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>
              ملاحظة: المقارنة مبنية على المواصفات المتاحة والمعلنة داخل المعرض. لتأكيد أي تفاصيل إضافية أو الحجز، يمكنك التواصل معنا مباشرة على واتساب.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl glass-pill text-xs font-bold text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            إغلاق نافذة المقارنة
          </button>

          <p className="text-[11px] text-[var(--text-secondary)]">
            جميع الأسعار والمواصفات محدثة من قاعدة بيانات المعرض
          </p>
        </div>
      </div>
    </div>
  );
}
