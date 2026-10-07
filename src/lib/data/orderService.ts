import { supabaseDb } from './supabaseDb';
import { Order, OrderStatus, OrderItem } from '../../types';
import { SelectedInsuranceSnapshot } from '../../types/insurance';
import { auditService } from './auditService';

export interface ValidatedOrderCalculation {
  subtotal: number;
  discount: number;
  shipping: number;
  shippingCost: number;
  total: number;
  isValid: boolean;
  couponCode?: string;
  couponError?: string;
}

export interface CheckoutInput {
  customerUid?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  shippingAddress: string;
  customerNotes?: string;
  items: any[];
  couponCode?: string;
  paymentMethod?: string;
  selectedInsurance?: SelectedInsuranceSnapshot;
  idempotencyKey?: string;
}

export const statusTranslations: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  preparing: 'قيد التجهيز',
  ready_to_ship: 'جاهز للشحن',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي'
};

export function isValidOrderStatusTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true;
  if (current === 'cancelled') return false;
  if (next === 'cancelled') return true;

  const statusOrder: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready_to_ship', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(current);
  const nextIndex = statusOrder.indexOf(next);

  if (currentIndex === -1 || nextIndex === -1) return false;
  return nextIndex > currentIndex;
}

export const orderService = {
  async getAllOrders(): Promise<Order[]> {
    try {
      const orders = await supabaseDb.getCollection<Order>('orders');
      return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  },

  async getOrders(limit?: number): Promise<Order[]> {
    const orders = await this.getAllOrders();
    return limit ? orders.slice(0, limit) : orders;
  },

  async getCustomerOrders(customerUid: string): Promise<Order[]> {
    if (!customerUid) return [];
    try {
      const orders = await this.getAllOrders();
      return orders.filter((o) => o.customerUid === customerUid || (o as any).customer_uid === customerUid);
    } catch {
      return [];
    }
  },

  async getUserOrders(customerUid: string): Promise<Order[]> {
    return this.getCustomerOrders(customerUid);
  },

  async getOrderById(id: string): Promise<Order | null> {
    if (!id) return null;
    try {
      const doc = await supabaseDb.getDoc<Order>('orders', id);
      return doc;
    } catch {
      return null;
    }
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<void> {
    if (!orderId) return;
    await supabaseDb.updateDoc('orders', orderId, {
      orderStatus: status,
      updatedAt: new Date().toISOString()
    });
    await auditService.logAction('UPDATE', 'order', orderId, { status, note });
  },

  async updateOrderPaymentStatus(orderId: string, paymentStatus: string): Promise<void> {
    if (!orderId) return;
    await supabaseDb.updateDoc('orders', orderId, {
      paymentStatus,
      updatedAt: new Date().toISOString()
    });
    await auditService.logAction('UPDATE', 'order', orderId, { paymentStatus });
  },

  async getActiveCustomerCarts(): Promise<any[]> {
    try {
      return await supabaseDb.getCollection('carts');
    } catch {
      return [];
    }
  },

  /**
   * Universal Server Checkout Proxy Routing
   */
  async processCheckout(input: CheckoutInput): Promise<{ orderId: string; invoiceNumber: string }> {
    const idToken = typeof window !== 'undefined' ? (window as any).firebaseIdToken || '' : '';
    
    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify(input)
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`خطأ في استجابة الخادم (${res.status})`);
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'تعذر إتمام طلب الشراء.');
    }

    return {
      orderId: data.orderId,
      invoiceNumber: data.invoiceNumber
    };
  },

  async validateOrderTotals(input: any, arg2?: any, arg3?: any): Promise<ValidatedOrderCalculation> {
    return { subtotal: 0, discount: 0, shipping: 0, shippingCost: 0, total: 0, isValid: true };
  },
  async placeCheckoutOrder(input: CheckoutInput): Promise<{ orderId: string; invoiceNumber: string }> {
    return this.processCheckout(input);
  },
  async createOrder(order: any): Promise<string> {
    const id = order.id || `order_${Date.now()}`;
    await supabaseDb.setDoc('orders', id, { ...order, id });
    return id;
  }
};
