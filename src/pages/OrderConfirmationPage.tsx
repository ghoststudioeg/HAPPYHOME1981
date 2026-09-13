import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { Order, StoreSettings } from '../types';
import { orderService } from '../lib/data/orderService';
import { InvoiceModal } from '../components/InvoiceModal';
import { openWhatsAppClickToChat } from '../lib/pdfGenerator';
import {

  CheckCircle,
  ShoppingBag,
  FileText,
  Truck,
  MapPin,
  Phone,
  User,
  Calendar,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Printer,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface OrderConfirmationPageProps {
  orderId?: string;
  navigate: (path: string) => void;
  settings: StoreSettings;
}

export function OrderConfirmationPage({ orderId, navigate, settings }: OrderConfirmationPageProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    // Read orderId from URL query param if not directly passed in props
    let effectiveOrderId = orderId;
    if (!effectiveOrderId) {
      const params = new URLSearchParams(window.location.search);
      effectiveOrderId = params.get('orderId') || undefined;
    }

    if (!effectiveOrderId) {
      setLoading(false);
      setError('لم يتم العثور على رقم الطلب المحدد.');
      return;
    }

    async function loadOrder() {
      try {
        setLoading(true);
        const fetchedOrder = await orderService.getOrderById(effectiveOrderId!);
        if (fetchedOrder) {
          setOrder(fetchedOrder);
        } else {
          setError('لم يتم العثور على بيانات هذا الطلب.');
        }
      } catch (err: any) {
        console.error('Error loading order:', err);
        setError('تعذر تحميل تفاصيل الطلب.');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md animate-in fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-[#E0B84A] mx-auto mb-4" />
        <p className="text-sm font-bold text-[#CBD5E1]">جاري تجهيز تفاصيل الطلب والفاتورة...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-[#F8FAFC] mb-2">{error || 'طلب غير موجود'}</h2>
        <p className="text-xs text-[#94A3B8] mb-6">
          يمكنك مراجعة قائمة طلباتك من حسابك أو الاستمرار في التسوق.
        </p>
        <button
          onClick={() => navigate('/products')}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-xs"
        >
          العودة للمتجر
        </button>
      </div>
    );
  }

  const invoiceNumber = order.invoiceNumber || `INV-${new Date().getFullYear()}-${order.id.slice(-6).toUpperCase()}`;

  const handleWhatsAppPayNow = () => {
    if (!order) return;
    const storeName = settings?.storeName || 'متجر البيت السعيد';
    const invoiceNum = invoiceNumber;
    const orderNum = `#${order.id.slice(-8).toUpperCase()}`;
    const totalVal = `${order.total.toLocaleString('ar-EG')} ج.م`;

    let itemsList = '';
    if (order.items && order.items.length > 0) {
      itemsList = order.items.map((item, idx) => {
        return `${idx + 1}. ${item.productName} (الكمية: ${item.quantity})`;
      }).join('\n');
    }

    const message = `أهلاً بك في متجر ${storeName} ❤️\nلقد قمت بإنشاء طلب جديد وأريد إكمال عملية الدفع:\n\n🔖 رقم الفاتورة: ${invoiceNum}\n📦 رقم الطلب: ${orderNum}\n👤 العميل: ${order.customerName}\n📱 الهاتف: ${order.customerPhone}\n\n🛒 المشتريات:\n${itemsList}\n\n💰 إجمالي القيمة: ${totalVal}\n\nيرجى إرسال تفاصيل وطرق تحويل الأموال المتاحة لإرسال إثبات التحويل وتأكيد طلبي.`;

    openWhatsAppClickToChat(settings?.whatsappNumber || settings?.phone || '', message);
  };

  const isPayNow = order.paymentMethod === 'pay_now';

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12 max-w-4xl animate-in fade-in duration-300">
      
      {/* Success Hero Header */}
      <div className="p-8 rounded-3xl bg-gradient-to-b from-[#D4AF37]/10 via-[#0B1528]/90 to-[#0B1528] border border-[#D4AF37]/30 text-center relative overflow-hidden shadow-2xl mb-8">
        {isPayNow ? (
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-[#E0B84A] text-[#05080D] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(245,158,11,0.35)] animate-pulse">
            <CreditCard className="w-10 h-10" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-400 text-[#05080D] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.35)] animate-bounce">
            <CheckCircle className="w-10 h-10" />
          </div>
        )}

        {isPayNow ? (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تم تسجيل طلبك بنجاح! بانتظار الدفع</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تم تأكيد واستلام طلبك بنجاح!</span>
          </span>
        )}

        <h1 className="text-2xl lg:text-3xl font-black text-[#F8FAFC] mb-2">
          {isPayNow 
            ? `خطوة واحدة متبقية لإتمام طلبك، ${order.customerName}`
            : `شكراً لتسوقك معنا، ${order.customerName}`
          }
        </h1>
        {isPayNow ? (
          <div className="text-xs lg:text-sm text-[#F8FAFC] max-w-lg mx-auto leading-relaxed font-bold bg-[#D4AF37]/10 p-4 rounded-2xl border border-[#D4AF37]/30 mt-4 mb-4">
            طلبك مسجل كـ "قيد الانتظار". يرجى الضغط على زر الواتساب الأخضر بالأسفل للتواصل معنا وإرسال صورة من إثبات الدفع/التحويل لتأكيد وشحن طلبك فوراً.
          </div>
        ) : (
          <p className="text-xs lg:text-sm text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
            تم إنشاء طلبك برقم فاتورة رسمي وموثق. سنقوم بمراجعة الطلب وتجهيزه للشحن السريع فوراً.
          </p>
        )}

        {/* Invoice & Order Number Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-[#CBD5E1] flex items-center gap-2">
            <span className="text-[#94A3B8]">رقم الفاتورة:</span>
            <span className="font-mono font-black text-[#E0B84A]">{invoiceNumber}</span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-[#CBD5E1] flex items-center gap-2">
            <span className="text-[#94A3B8]">تاريخ الطلب:</span>
            <span className="font-mono font-bold text-[#F8FAFC]">
              {new Date(order.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
            </span>
          </div>

          <div className={`px-4 py-2 rounded-xl border text-xs flex items-center gap-1.5 font-bold ${
            isPayNow 
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            <Truck className="w-3.5 h-3.5" />
            <span>{isPayNow ? 'الدفع الآن (تحويل)' : 'الدفع عند الاستلام'}</span>
          </div>
        </div>

        {/* Primary Action Buttons: عرض الفاتورة & عرض الطلب */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          {isPayNow && (
            <button
              onClick={handleWhatsAppPayNow}
              className="px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2.5 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-98 transition-all cursor-pointer w-full sm:w-auto justify-center animate-pulse"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>اضغط هنا لفتح واتساب والدفع وتأكيد الطلب</span>
            </button>
          )}

          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-[#05080D] font-black text-xs lg:text-sm flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>عرض الفاتورة الرسمية وتنزيلها PDF</span>
          </button>

          <button
            onClick={() => navigate('/profile?tab=orders')}
            className="px-6 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-[#F8FAFC] font-bold text-xs lg:text-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-[#E0B84A]" />
            <span>عرض كل طلباتي</span>
          </button>

          <button
            onClick={() => navigate('/products')}
            className="px-6 py-3.5 rounded-xl bg-transparent hover:bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-white font-bold text-xs lg:text-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <span>متابعة التسوق</span>
            <ArrowRight className="w-4 h-4 ltr:rotate-180" />
          </button>
        </div>
      </div>

      {/* Order Details Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Customer & Contact */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-[#E0B84A] border-b border-white/[0.06] pb-2.5">
            <User className="w-4 h-4" />
            <span>بيانات المستلم والتواصل</span>
          </div>
          <div className="space-y-1.5 text-xs text-[#CBD5E1]">
            <p className="font-bold text-[#F8FAFC]">{order.customerName}</p>
            <p className="flex items-center gap-1.5 font-mono text-[#94A3B8]" dir="ltr">
              <Phone className="w-3.5 h-3.5 text-[#64748B]" />
              <span>{order.customerPhone}</span>
            </p>
            {order.customerEmail && (
              <p className="text-[11px] text-[#94A3B8]">{order.customerEmail}</p>
            )}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-[#E0B84A] border-b border-white/[0.06] pb-2.5">
            <MapPin className="w-4 h-4" />
            <span>عنوان التوصيل</span>
          </div>
          <p className="text-xs text-[#CBD5E1] leading-relaxed">
            {order.shippingAddress}
          </p>
          {order.customerNotes && (
            <p className="text-[11px] text-[#94A3B8] bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
              ملاحظات: {order.customerNotes}
            </p>
          )}
        </div>

        {/* Payment Summary */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-[#E0B84A] border-b border-white/[0.06] pb-2.5">
            <CreditCard className="w-4 h-4" />
            <span>طريقة وحالة الدفع</span>
          </div>
          <div className="space-y-1 text-xs">
            <p className="text-[#CBD5E1]">{isPayNow ? 'الدفع الآن (تحويل أو وسيلة أخرى)' : 'الدفع نقدياً عند الاستلام'}</p>
            <p className={`text-[11px] font-bold ${isPayNow ? 'text-amber-400' : 'text-amber-400'}`}>
              {isPayNow ? 'بانتظار التحويل وتأكيد الدفع' : 'بانتظار التحصيل عند التسليم'}
            </p>
            <p className="text-sm font-black text-[#E0B84A] font-mono pt-1">
              {isPayNow ? 'المطلوب سداده:' : 'المطلوب تحصيله:'} {order.total.toLocaleString('ar-EG')} ج.م
            </p>
          </div>
        </div>

      </div>

      {/* Ordered Products Table */}
      <div className="p-6 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] space-y-4">
        <h3 className="text-sm font-black text-[#F8FAFC] flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <ShoppingBag className="w-4 h-4 text-[#E0B84A]" />
          <span>المنتجات المشتراة في هذا الطلب</span>
        </h3>

        <div className="divide-y divide-white/[0.06]">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={getValidImageSrc(item.productImage || 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=100')}
                  alt={item.productName}
                  className="w-12 h-12 object-cover rounded-xl bg-black/40 border border-white/5"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="text-xs font-bold text-[#F8FAFC]">{item.productName}</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {item.quantity} × <span className="font-mono text-[#CBD5E1]">{item.priceAtPurchase.toLocaleString('ar-EG')} ج.م</span>
                  </p>
                </div>
              </div>
              <div className="text-left font-mono font-bold text-xs text-[#E0B84A]">
                {item.lineTotal.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          ))}
        </div>

        {/* Financial Recap */}
        <div className="border-t border-white/[0.08] pt-4 space-y-2 text-xs text-[#94A3B8] max-w-xs mr-auto">
          <div className="flex items-center justify-between">
            <span>قيمة المنتجات:</span>
            <span className="font-mono text-[#F8FAFC] font-semibold">{order.subtotal.toLocaleString('ar-EG')} ج.م</span>
          </div>

          {order.discount > 0 && (
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span>خصم الكوبون ({order.couponCode}):</span>
              <span className="font-mono">-{order.discount.toLocaleString('ar-EG')} ج.م</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span>الشحن:</span>
            {order.shippingCost === 0 ? (
              <span className="text-emerald-400 font-bold">مجاني</span>
            ) : (
              <span className="font-mono text-[#F8FAFC] font-semibold">{order.shippingCost.toLocaleString('ar-EG')} ج.م</span>
            )}
          </div>

          <div className="border-t border-white/[0.08] pt-2 flex items-center justify-between text-sm font-black text-[#F8FAFC]">
            <span>الإجمالي:</span>
            <span className="text-base text-[#E0B84A] font-mono">{order.total.toLocaleString('ar-EG')} ج.م</span>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          order={order}
          storeSettings={settings}
          isAdmin={false}
        />
      )}
    </div>
  );
}
