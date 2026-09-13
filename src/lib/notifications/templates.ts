import { StoreEventType } from '../../types';

export interface NotificationTemplatePayload {
  orderId?: string;
  customerUid?: string;
  customerName?: string;
  customerPhone?: string;
  total?: number;
  products?: { name: string; quantity: number; price?: number }[];
  status?: string;
  productName?: string;
  productId?: string;
  stock?: number;
  couponCode?: string;
  heroTitle?: string;
  errorMessage?: string;
  date?: string;
  [key: string]: any;
}

export interface RenderedTemplate {
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  relatedType?: 'order' | 'product' | 'customer' | 'coupon' | 'hero' | 'system';
  relatedId?: string;
}

export function buildNotificationContent(
  eventType: StoreEventType,
  payload: NotificationTemplatePayload = {}
): RenderedTemplate {
  const formattedDate = payload.date || new Date().toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const shortOrderId = payload.orderId ? `#${payload.orderId.slice(-6).toUpperCase()}` : '';

  switch (eventType) {
    case 'NEW_ORDER': {
      const productSummary = payload.products && payload.products.length > 0
        ? payload.products.map(p => `• ${p.name} (الكمية: ${p.quantity})`).join('\n')
        : 'تفاصيل المنتجات داخل الطلب';
      return {
        title: `طلب جديد بقيمة ${payload.total ? payload.total.toLocaleString('ar-EG') : 0} ج.م`,
        message: `تم تقديم طلب جديد ${shortOrderId} بواسطة ${payload.customerName || 'عميل'} (${payload.customerPhone || 'بدون رقم'}).\nالمنتجات:\n${productSummary}`,
        priority: 'high',
        relatedType: 'order',
        ...(payload.orderId ? { relatedId: payload.orderId } : {})
      };
    }

    case 'ORDER_STATUS_CHANGED': {
      return {
        title: `تحديث حالة الطلب ${shortOrderId}`,
        message: `تم تغيير حالة الطلب ${shortOrderId} للعميل ${payload.customerName || ''} إلى "${payload.status || 'تحديث جديد'}".`,
        priority: 'medium',
        relatedType: 'order',
        ...(payload.orderId ? { relatedId: payload.orderId } : {})
      };
    }

    case 'ORDER_CANCELLED': {
      return {
        title: `إلغاء الطلب ${shortOrderId}`,
        message: `تم إلغاء الطلب ${shortOrderId} للعميل ${payload.customerName || ''} (${payload.customerPhone || 'بدون رقم'}).`,
        priority: 'high',
        relatedType: 'order',
        ...(payload.orderId ? { relatedId: payload.orderId } : {})
      };
    }

    case 'NEW_CUSTOMER': {
      return {
        title: `عميل جديد انضم للمتجر`,
        message: `قام العميل ${payload.customerName || 'جديد'} (${payload.customerPhone || 'بدون هاتف'}) بإنشاء حساب جديد في المتجر بتاريخ ${formattedDate}.`,
        priority: 'low',
        relatedType: 'customer',
        ...(payload.customerUid ? { relatedId: payload.customerUid } : {})
      };
    }

    case 'LOW_STOCK': {
      return {
        title: `تنبيه مخزون منخفض: ${payload.productName || 'منتج'}`,
        message: `وصلت كمية المنتج "${payload.productName}" إلى مستوى منخفض (${payload.stock ?? 0} قطع متبقية). يرجى المتابعة وتعديل المخزون.`,
        priority: 'medium',
        relatedType: 'product',
        ...(payload.productId ? { relatedId: payload.productId } : {})
      };
    }

    case 'OUT_OF_STOCK': {
      return {
        title: `نفد المخزون: ${payload.productName || 'منتج'}`,
        message: `نفدت كمية المنتج "${payload.productName}" بالكامل (المخزون الحالي: 0). تم تغيير حالة التوفر تلقائياً.`,
        priority: 'critical',
        relatedType: 'product',
        ...(payload.productId ? { relatedId: payload.productId } : {})
      };
    }

    case 'RESTOCKED': {
      return {
        title: `إعادة توفير المنتج: ${payload.productName || 'منتج'}`,
        message: `تمت إعادة توفير المنتج "${payload.productName}" بالكامل. الكمية المتاحة الآن: ${payload.stock ?? 1} قطعة.`,
        priority: 'medium',
        relatedType: 'product',
        ...(payload.productId ? { relatedId: payload.productId } : {})
      };
    }

    case 'COUPON_USED': {
      return {
        title: `استخدام كود خصم: ${payload.couponCode}`,
        message: `تم استخدام كود الخصم "${payload.couponCode}" في الطلب ${shortOrderId} بواسطة العميل ${payload.customerName || ''}.`,
        priority: 'low',
        relatedType: 'coupon',
        ...(payload.couponCode ? { relatedId: payload.couponCode } : {})
      };
    }

    case 'HERO_BANNER_CHANGED': {
      const bannerRelatedId = payload.bannerId || payload.heroBannerId || payload.productId;
      return {
        title: `تحديث لافتات العرض والأنشطة`,
        message: `تمت إضافة/تحديث لافتة الهيرو والترويج "${payload.heroTitle || 'عرض جديد'}" بنجاح.`,
        priority: 'low',
        relatedType: 'hero',
        ...(bannerRelatedId ? { relatedId: bannerRelatedId } : {})
      };
    }

    case 'SYSTEM_ERROR': {
      return {
        title: `خطأ مهم في النظام`,
        message: `تم تسجيل خطأ في النظام: ${payload.errorMessage || 'حدث خطأ غير متوقع أثناء معالجة البيانات.'}`,
        priority: 'critical',
        relatedType: 'system'
      };
    }

    default: {
      return {
        title: `حدث في المتجر`,
        message: payload.errorMessage || 'تم تسجيل حدث جديد في المتجر.',
        priority: 'low',
        relatedType: 'system'
      };
    }
  }
}
