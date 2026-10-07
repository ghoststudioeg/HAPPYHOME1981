import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useEffect, useState, useRef } from 'react';
import { orderService } from '../lib/data/orderService';
import { settingsService } from '../lib/data/settingsService';
import { useAuth } from '../lib/authContext';
import { Order, StoreSettings } from '../types';
import { getInvoiceNumber, generateWhatsAppInvoiceMessage, openWhatsAppInvoice } from '../components/InvoiceModal';
import {

  Printer,
  Download,
  MessageCircle,
  ArrowRight,
  Loader2,
  FileText,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface InvoicePrintPageProps {
  orderId: string;
  navigate?: (path: string) => void;
}

export function InvoicePrintPage({ orderId, navigate }: InvoicePrintPageProps) {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const printTriggered = useRef(false);

  // Parse URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const shouldAutoPrint = urlParams.get('print') === 'true' || urlParams.get('autoPrint') === 'true';

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!orderId) {
        setError('رقم الطلب غير صحيح');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [fetchedOrder, fetchedSettings] = await Promise.all([
          orderService.getOrderById(orderId),
          settingsService.getSettings().catch(() => null)
        ]);

        if (!isMounted) return;

        if (!fetchedOrder) {
          setError('لم يتم العثور على الفاتورة أو الطلب المطلوب');
          setLoading(false);
          return;
        }

        // Security check
        const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
        const isAdmin = user && user.email && adminEmails.some(e => e.toLowerCase() === user.email?.toLowerCase());
        const isOwner = user && (fetchedOrder.customerUid === user.uid || fetchedOrder.customerEmail === user.email);
        const isGuestOrder = fetchedOrder.customerUid === 'guest';

        if (!isAdmin && !isOwner && !isGuestOrder) {
          // If logged in as someone else trying to access another customer's invoice
          if (user) {
            setError('غير مصرح لك باستعراض هذه الفاتورة');
            setLoading(false);
            return;
          }
        }

        setOrder(fetchedOrder);
        setSettings(fetchedSettings);
        setLoading(false);
      } catch (err) {
        console.error('Error loading invoice page:', err);
        if (isMounted) {
          setError('حدث خطأ أثناء تحميل الفاتورة');
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [orderId, user]);

  // Handle auto-print after data & images finish loading
  useEffect(() => {
    if (shouldAutoPrint && !loading && order && !printTriggered.current) {
      printTriggered.current = true;
      // Wait for DOM render and image load
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoPrint, loading, order]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    if (navigate) {
      const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
      const isAdmin = user && user.email && adminEmails.some(e => e.toLowerCase() === user.email?.toLowerCase());
      if (isAdmin) {
        navigate('/admin/orders');
      } else {
        navigate('/profile');
      }
    } else {
      window.history.back();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">جاري إعداد وتحميل بيانات الفاتورة...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center dir-rtl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black mb-2">{error || 'لم يتم العثور على الفاتورة'}</h2>
        <p className="text-xs text-slate-400 mb-6 max-w-md">
          قد تكون الفاتورة غير موجودة أو ليس لديك صلاحية للوصول إليها.
        </p>
        <button
          onClick={handleBack}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرجوع</span>
        </button>
      </div>
    );
  }

  const invNumber = getInvoiceNumber(order);
  const dateObj = new Date(order.invoiceCreatedAt || order.createdAt);
  const formattedDate = dateObj.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = dateObj.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const storeName = settings?.storeName || 'متجر البيت السعيد';
  const logoUrl = settings?.logoUrl;
  const storePhone = settings?.phone || '01000000000';
  const storeWhatsApp = settings?.whatsappNumber || settings?.phone || '';
  const storeAddress = settings?.address || 'القاهرة، مصر';
  const workingHours = settings?.workingHours || 'يومياً من 10 صباحاً حتى 10 مساءً';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dir-rtl font-sans selection:bg-amber-200">
      {/* Top Controls Bar - Hidden when printing */}
      <div className="no-print sticky top-0 z-50 bg-slate-900 text-white border-b border-white/10 shadow-xl p-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="رجوع"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-black flex items-center gap-2 text-white">
                <span>فاتورة شراء رسمية</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {invNumber}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">طلب #{order.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer hover:scale-105"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
              title="يمكنك اختياح 'حفظ كـ PDF' من نافذة طباعة المتصفح"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>حفظ كـ PDF</span>
            </button>

            <button
              onClick={() => openWhatsAppInvoice(order, settings)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال عبر واتساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main A4 Printable Canvas Area */}
      <div className="p-4 sm:p-8 md:p-12">
        <div
          id="printable-invoice-area"
          className="printable-invoice bg-white text-slate-900 p-6 sm:p-10 md:p-12 rounded-2xl shadow-xl border border-slate-200 max-w-4xl mx-auto space-y-8 text-right font-sans"
        >
          {/* Header Section: Store Identity & Invoice Number */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-900 pb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={getValidImageSrc(logoUrl)}
                    alt={storeName}
                    onLoad={() => setImageLoaded(true)}
                    className="w-16 h-16 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 font-black text-2xl shadow-md">
                    🏡
                  </div>
                )}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{storeName}</h1>
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

            {/* Document Metadata Box */}
            <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl space-y-2.5 w-full sm:w-auto min-w-[240px]">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-bold">رقم الفاتورة:</span>
                <span className="text-sm font-black text-slate-900 font-mono tracking-wider">{invNumber}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-bold">رقم الطلب:</span>
                <span className="text-xs font-bold text-amber-800 font-mono">#{order.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
                <span className="text-xs text-slate-500 font-bold">تاريخ الإصدار:</span>
                <span className="text-xs font-bold text-slate-800">{formattedDate} ({formattedTime})</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-slate-500 font-bold">طريقة الدفع:</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  {order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'cod'
                    ? 'الدفع عند الاستلام'
                    : order.paymentMethod}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Shipping Information Grid */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-[11px] font-black text-amber-800 block mb-1 uppercase tracking-wider">بيانات العميل</span>
              <p className="text-base font-black text-slate-900">{order.customerName}</p>
              <p className="text-xs text-slate-700 mt-1 font-mono font-bold" dir="ltr">{order.customerPhone}</p>
              {order.customerEmail && order.customerEmail !== 'guest@example.com' && (
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{order.customerEmail}</p>
              )}
            </div>

            <div>
              <span className="text-[11px] font-black text-amber-800 block mb-1 uppercase tracking-wider">عنوان الشحن والتوصيل</span>
              <p className="text-xs font-bold text-slate-800 leading-relaxed">{order.shippingAddress}</p>
              {order.customerNotes && (
                <p className="text-xs text-slate-600 mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                  <strong>ملاحظات العميل:</strong> {order.customerNotes}
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">تفاصيل المنتجات والمشتريات</h2>
            <div className="overflow-x-auto border-2 border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-200 text-slate-900 font-black">
                    <th className="p-3.5 text-center w-12">#</th>
                    <th className="p-3.5">اسم المنتج</th>
                    <th className="p-3.5 text-center">الكمية</th>
                    <th className="p-3.5 text-left">سعر الوحدة وقت الشراء</th>
                    <th className="p-3.5 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {order.items.map((item, idx) => {
                    const unitPrice = item.priceAtPurchase;
                    const lineTotal = item.lineTotal || (unitPrice * item.quantity);
                    const isBundle = Boolean(item.isBundle || (item.bundleItems && item.bundleItems.length > 0));
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 page-break-inside-avoid">
                        <td className="p-3.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3.5 font-bold text-slate-900 text-sm space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isBundle && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                عرض مركب
                              </span>
                            )}
                            <span className="text-slate-900 font-bold">{isBundle ? `عرض: ${item.bundleName || item.productName}` : item.productName}</span>
                          </div>
                          {isBundle && item.bundleItems && item.bundleItems.length > 0 && (
                            <div className="pr-3 border-r-2 border-amber-300 text-[11px] text-slate-600 space-y-0.5 pt-0.5">
                              <span className="font-semibold text-slate-700 block">المنتجات المشمولة:</span>
                              <ul className="list-disc list-inside space-y-0.5">
                                {item.bundleItems.map((bi, bIdx) => (
                                  <li key={bIdx}>{bi.productName}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.installmentPlan && (
                            <div className="text-[10px] text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-1">
                              💳 نظام التقسيط: {item.installmentPlan.monthlyPayment.toLocaleString('ar-EG')} ج.م شهرياً × {item.installmentPlan.months} شهر ({item.installmentPlan.providerName})
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-black text-sm">{item.quantity.toLocaleString('ar-EG')}</td>
                        <td className="p-3.5 text-left font-mono font-bold text-slate-700">
                          {unitPrice.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3.5 text-left font-mono font-black text-slate-900 text-sm">
                          {lineTotal.toLocaleString('ar-EG')} ج.م
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-2">
            <div className="text-xs text-slate-500 space-y-1.5 max-w-sm">
              <p className="font-bold text-slate-800">الشروط والأحكام والضمان:</p>
              <p className="leading-relaxed text-[11px] text-slate-600">
                • تعتبر هذه الفاتورة سند ملكية وضمان معتمد للمنتجات الموضحة أعلاه.
                <br />
                • الأسعار المدونة هي أسعار المنتجات المعتمدة وقت إتمام الطلب.
              </p>
            </div>

            <div className="w-full sm:w-80 bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-700 pb-1.5 border-b border-slate-200">
                <span className="font-bold">الإجمالي الفرعي:</span>
                <span className="font-mono font-bold text-sm">{order.subtotal.toLocaleString('ar-EG')} ج.م</span>
              </div>

              {order.discount > 0 && (
                <div className="flex justify-between items-center text-emerald-800 font-bold pb-1.5 border-b border-slate-200">
                  <span>
                    الخصم {order.couponCode ? `(كوبون: ${order.couponCode})` : ''}:
                  </span>
                  <span className="font-mono text-sm">- {order.discount.toLocaleString('ar-EG')} ج.م</span>
                </div>
              )}

              {order.selectedInsurance && (
                <div className="flex justify-between items-center text-emerald-800 font-bold pb-1.5 border-b border-slate-200">
                  <span>
                    🛡️ تأمين فوري ({order.selectedInsurance.name}):
                  </span>
                  <span className="font-mono text-sm">
                    {order.selectedInsurance.isFree ? 'مشمول مجانًا' : `+ ${order.selectedInsurance.insurancePrice.toLocaleString('ar-EG')} ج.م`}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-700 pb-1.5 border-b border-slate-200">
                <span className="font-bold">مصاريف الشحن والتوصيل:</span>
                <span className="font-mono font-bold text-sm">
                  {order.shippingCost > 0 ? `${order.shippingCost.toLocaleString('ar-EG')} ج.م` : 'مجاني'}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-900 font-black text-lg pt-1">
                <span>الإجمالي النهائي:</span>
                <span className="font-mono text-amber-700">{order.total.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t-2 border-slate-200 pt-6 text-center space-y-2">
            <p className="text-base font-black text-slate-900">
              شكرًا لاختياركم {storeName} ❤️
            </p>
            <p className="text-xs text-slate-500">
              نتمنى لكم تجربة تسوق رائعة | في حال وجود أي استفسار يسعدنا خدمتكم عبر الهاتف: {storePhone}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
