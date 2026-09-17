import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useEffect, useState, useRef } from 'react';
import { Order, StoreSettings } from '../types';
import { settingsService } from '../lib/data/settingsService';
import {
  generateInvoicePdfFromElement,
  buildOrderTextForWhatsApp,
  openWhatsAppClickToChat,
  formatWhatsAppPhone
} from '../lib/pdfGenerator';
import {

  Printer,
  FileText,
  Share2,
  X,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  MessageCircle,
  Download,
  AlertCircle,
  Send,
  Loader2
} from 'lucide-react';

interface InvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  storeSettings?: StoreSettings | null;
  isAdmin?: boolean;
}

export function getInvoiceNumber(order: Order): string {
  if (order.invoiceNumber) return order.invoiceNumber;
  const year = order.createdAt ? new Date(order.createdAt).getFullYear() : 2026;
  const shortId = (order.id || '000000').slice(-6).toUpperCase();
  return `INV-${year}-${shortId}`;
}

export function generateWhatsAppInvoiceMessage(order: Order, settings?: StoreSettings | null): string {
  return buildOrderTextForWhatsApp(order, settings);
}

export function openWhatsAppInvoice(order: Order, settings?: StoreSettings | null) {
  const text = buildOrderTextForWhatsApp(order, settings);
  const targetPhone = order.customerPhone || settings?.whatsappNumber || settings?.phone || '';
  openWhatsAppClickToChat(targetPhone, text);
}

export function InvoiceModal({ order, isOpen, onClose, storeSettings, isAdmin = true }: InvoiceModalProps) {
  const [settings, setSettings] = useState<StoreSettings | null>(storeSettings || null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [fallbackInstructionMessage, setFallbackInstructionMessage] = useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storeSettings && isOpen) {
      settingsService.getSettings().then(setSettings).catch(err => {
        console.warn('Could not load store settings for invoice:', err);
      });
    } else if (storeSettings) {
      setSettings(storeSettings);
    }
  }, [storeSettings, isOpen]);

  if (!isOpen || !order) return null;

  const invNumber = getInvoiceNumber(order);
  const dateObj = new Date(order.invoiceCreatedAt || order.createdAt);
  const formattedDate = dateObj.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const storeName = settings?.storeName || 'متجر البيت السعيد';
  const logoUrl = settings?.logoUrl;
  const storePhone = settings?.phone || '01000000000';
  const storeWhatsApp = settings?.whatsappNumber || settings?.phone || '';
  const storeAddress = settings?.address || 'القاهرة، مصر';
  const workingHours = settings?.workingHours || 'يومياً من 10 صباحاً حتى 10 مساءً';

  const handlePrint = () => {
    try {
      const printUrl = `/invoice/${order.id}?print=true`;
      const win = window.open(printUrl, '_blank');
      if (!win) {
        window.print();
      }
    } catch (e) {
      window.print();
    }
  };

  // Helper to render PDF from current element
  const createPdfResult = async () => {
    const el = printAreaRef.current || document.getElementById('printable-invoice-area');
    if (!el) throw new Error('Invoice element not found');
    return await generateInvoicePdfFromElement(el as HTMLElement, invNumber);
  };

  // 1. Download PDF ("تحميل PDF")
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    try {
      const result = await createPdfResult();
      result.download();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setPdfError('تعذر إنشاء ملف PDF، حاول مرة أخرى.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Share PDF via Web Share API ("مشاركة PDF")
  const handleSharePdf = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    try {
      const result = await createPdfResult();
      const messageText = buildOrderTextForWhatsApp(order, settings);

      if (navigator.canShare && navigator.canShare({ files: [result.file] })) {
        await navigator.share({
          title: `فاتورة ${invNumber} - ${storeName}`,
          text: messageText,
          files: [result.file]
        });
      } else {
        // Fallback if file sharing not supported
        result.download();
        setFallbackInstructionMessage('تم تحميل الفاتورة PDF بنجاح. يمكنك اختيار الملف من التنزيلات والمشاركة تلقائياً.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Share PDF Error:', err);
        setPdfError('تعذر مشاركة ملف PDF، حاول مرة أخرى.');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 3. Send Order Details via WhatsApp text ("إرسال تفاصيل الطلب عبر واتساب")
  const handleSendDetailsWhatsApp = () => {
    openWhatsAppInvoice(order, settings);
  };

  // 4. Send Invoice PDF via WhatsApp ("إرسال الفاتورة PDF عبر واتساب")
  const handleSendPdfWhatsApp = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    setFallbackInstructionMessage(null);

    try {
      const result = await createPdfResult();
      const messageText = buildOrderTextForWhatsApp(order, settings);
      const targetPhone = order.customerPhone || settings?.whatsappNumber || settings?.phone || '';

      if (navigator.canShare && navigator.canShare({ files: [result.file] })) {
        await navigator.share({
          title: `فاتورة ${invNumber}`,
          text: messageText,
          files: [result.file]
        });
      } else {
        // Fallback: Download PDF & Open WhatsApp Click-to-Chat with prefilled message
        result.download();
        openWhatsAppClickToChat(targetPhone, messageText);
        setFallbackInstructionMessage('تم تحميل الفاتورة PDF.\nأرفق الملف في المحادثة ثم اضغط إرسال.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Send PDF WhatsApp Error:', err);
        setPdfError('تعذر إنشاء ملف PDF، حاول مرة أخرى.');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 dir-rtl">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden my-8">
        
        {/* Top Control Header Bar */}
        <div className="no-print p-4 bg-slate-950/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>فاتورة طلب #{order.id.slice(-6).toUpperCase()}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {invNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">معاينة الفاتورة الأصلية وإمكانية الطباعة، التحميل، والمشاركة</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20"
              title="طباعة الفاتورة"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="تحميل PDF"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Download className="w-4 h-4" />}
              <span>تحميل PDF</span>
            </button>

            {/* Share PDF Button */}
            <button
              onClick={handleSharePdf}
              disabled={isGeneratingPdf}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="مشاركة PDF"
            >
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>مشاركة PDF</span>
            </button>

            {/* Admin WhatsApp Actions */}
            {isAdmin && (
              <>
                <button
                  onClick={handleSendDetailsWhatsApp}
                  className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="إرسال تفاصيل الطلب عبر واتساب"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تفاصيل الطلب (واتساب)</span>
                </button>

                <button
                  onClick={handleSendPdfWhatsApp}
                  disabled={isGeneratingPdf}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  title="إرسال الفاتورة PDF عبر واتساب"
                >
                  {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>إرسال الفاتورة PDF عبر واتساب</span>
                </button>
              </>
            )}

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer mr-1"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Alert if PDF fails */}
        {pdfError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}

        {/* Fallback Instruction Dialog Banner */}
        {fallbackInstructionMessage && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-bold space-y-2 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-bold text-amber-300 text-sm">تم تجهيز الفاتورة وترخيص التحميل</p>
              <p className="whitespace-pre-line leading-relaxed text-slate-200">{fallbackInstructionMessage}</p>
            </div>
            <button
              onClick={() => setFallbackInstructionMessage(null)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PRINTABLE INVOICE SHEET AREA */}
        <div className="p-4 sm:p-8 md:p-10 bg-slate-900 overflow-x-auto max-h-[80vh] overflow-y-auto">
          <div
            ref={printAreaRef}
            id="printable-invoice-area"
            className="printable-invoice bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 max-w-3xl mx-auto space-y-8 text-right dir-rtl font-sans"
          >
            {/* Invoice Header: Brand & Document Meta */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6">
              {/* Store Logo & Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={getValidImageSrc(logoUrl)}
                      alt={storeName}
                      className="w-14 h-14 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-black text-xl shadow-md">
                      🏡
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{storeName}</h1>
                    <p className="text-xs text-amber-700 font-bold">فاتورة مبيعات رسمية ومعتمدة</p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{storeAddress}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span dir="ltr">{storePhone}</span>
                    </span>
                    {storeWhatsApp && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span dir="ltr">{storeWhatsApp}</span>
                      </span>
                    )}
                  </div>
                  {workingHours && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>ساعات العمل: {workingHours}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Numbers & Date Stamp */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 w-full sm:w-auto min-w-[200px]">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">رقم الفاتورة:</span>
                  <span className="text-sm font-black text-slate-900 font-mono tracking-wider">{invNumber}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">رقم الطلب:</span>
                  <span className="text-xs font-bold text-amber-700 font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">تاريخ الاصدار:</span>
                  <span className="text-xs font-bold text-slate-700">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500 font-medium">حالة الدفع:</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    {order.paymentStatus === 'paid' ? 'تم الدفع' : 'عند الاستلام (نقداً)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Details Box */}
            <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">بيانات العميل</span>
                <p className="text-sm font-black text-slate-900">{order.customerName}</p>
                <p className="text-xs text-slate-600 mt-1 font-mono" dir="ltr">{order.customerPhone}</p>
                {order.customerEmail && order.customerEmail !== 'guest@example.com' && (
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{order.customerEmail}</p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">عنوان التوصيل والشحن</span>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">{order.shippingAddress}</p>
                {order.customerNotes && (
                  <p className="text-xs text-slate-500 mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                    <strong>ملاحظات العميل:</strong> {order.customerNotes}
                  </p>
                )}
              </div>
            </div>

            {/* Order Items Table */}
            <div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">تفاصيل المنتجات المطلوبة</h2>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-3 text-center w-12">#</th>
                      <th className="p-3">اسم المنتج</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3 text-left">سعر الوحدة</th>
                      <th className="p-3 text-left">إجمالي السطر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {order.items.map((item, idx) => {
                      const unitPrice = item.priceAtPurchase;
                      const lineTotal = item.lineTotal || (unitPrice * item.quantity);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="p-3 text-center font-bold">{item.quantity.toLocaleString('ar-EG')}</td>
                          <td className="p-3 text-left font-mono font-bold text-slate-700">
                            {unitPrice.toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="p-3 text-left font-mono font-black text-slate-900">
                            {lineTotal.toLocaleString('ar-EG')} ج.م
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Breakdown Card */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-2">
              <div className="text-xs text-slate-500 space-y-1 max-w-xs">
                <p className="font-bold text-slate-700">الشروط والأحكام:</p>
                <p className="leading-relaxed text-[11px]">
                  • يُرجى الاحتفاظ بهذه الفاتورة لأغراض الضمان والمراجعة.
                  <br />
                  • جميع الأسعار شاملة المنتجات المحددة وقت الشراء.
                </p>
              </div>

              <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600 pb-1 border-b border-slate-200">
                  <span>الإجمالي الفرعي:</span>
                  <span className="font-mono font-bold">{order.subtotal.toLocaleString('ar-EG')} ج.م</span>
                </div>

                {order.discount > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-bold pb-1 border-b border-slate-200">
                    <span>
                      الخصم {order.couponCode ? `(كوبون: ${order.couponCode})` : ''}:
                    </span>
                    <span className="font-mono">- {order.discount.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                )}

                {order.selectedInsurance && (
                  <div className="flex justify-between items-center text-emerald-700 font-bold pb-1 border-b border-slate-200">
                    <span>
                      🛡️ تأمين فوري ({order.selectedInsurance.name}):
                    </span>
                    <span className="font-mono">
                      {order.selectedInsurance.isFree ? 'مشمول مجانًا' : `+ ${order.selectedInsurance.insurancePrice.toLocaleString('ar-EG')} ج.م`}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-600 pb-1 border-b border-slate-200">
                  <span>مصاريف الشحن والتوصيل:</span>
                  <span className="font-mono font-bold">
                    {order.shippingCost > 0 ? `${order.shippingCost.toLocaleString('ar-EG')} ج.م` : 'مجاني'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-900 font-black text-base pt-1">
                  <span>الإجمالي النهائي:</span>
                  <span className="font-mono text-amber-700">{order.total.toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>
            </div>

            {/* Invoice Footer */}
            <div className="border-t border-slate-200 pt-6 text-center space-y-2">
              <p className="text-sm font-black text-slate-900">
                شكرًا لاختياركم {storeName} ❤️
              </p>
              <p className="text-xs text-slate-500">
                نتمنى لكم تجربة استخدام ممتعة وفريدة | لأي استفسار يرجى التواصل على: {storePhone}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
