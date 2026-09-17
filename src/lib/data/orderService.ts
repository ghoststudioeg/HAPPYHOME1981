import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  orderBy,
  limit,
  runTransaction,
  collectionGroup
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Order, OrderStatus, OrderItem, Product, InventoryLog, Coupon } from '../../types';
import { SelectedInsuranceSnapshot } from '../../types/insurance';
import { notificationEngine } from '../notificationEngine';
import { analyticsService } from './analyticsService';
import { couponService } from './couponService';
import { deriveStockStatus, DEFAULT_LOW_STOCK_THRESHOLD } from './inventoryService';
import { promotionService } from './promotionService';
import { homepageService } from './homepageService';
import { getEffectiveProductPrice } from '../campaignPricing';
import { auditService } from './auditService';

export interface CheckoutInput {
  customerUid?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  shippingAddress: string;
  customerNotes?: string;
  items: { productId: string; quantity: number }[];
  couponCode?: string;
  paymentMethod?: string;
  idempotencyKey?: string;
  selectedInsurance?: SelectedInsuranceSnapshot;
}

export interface ValidatedOrderCalculation {
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  couponCode?: string;
  couponError?: string;
}

const inFlightCheckoutLocks = new Set<string>();

export const statusTranslations: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'تم التأكيد',
  preparing: 'جاري التجهيز',
  ready_to_ship: 'جاهز للشحن',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي'
};

export function isValidOrderStatusTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true;
  if (current === 'delivered' || current === 'cancelled') return false;

  switch (current) {
    case 'new':
      return next === 'confirmed' || next === 'cancelled';
    case 'confirmed':
      return next === 'preparing' || next === 'cancelled';
    case 'preparing':
      return next === 'ready_to_ship' || next === 'cancelled';
    case 'ready_to_ship':
      return next === 'shipped';
    case 'shipped':
      return next === 'delivered';
    default:
      return false;
  }
}

export function getStatusNote(status: OrderStatus): string {
  switch (status) {
    case 'new':
      return 'تم استلام طلبك بنجاح وهو قيد المراجعة الآن.';
    case 'confirmed':
      return 'تم تأكيد طلبك ومراجعته من قبل إدارة المتجر.';
    case 'preparing':
      return 'بدأ فريقنا في تجهيز وتعبئة طلبك بعناية فائقة.';
    case 'ready_to_ship':
      return 'تم الانتهاء من التجهيز والطلب جاهز للتسليم لشركة الشحن.';
    case 'shipped':
      return 'تم شحن طلبك وتسليمه لشركة الشحن وهو في طريقه إليك الآن.';
    case 'delivered':
      return 'تم تسليم الطلب إليك بنجاح. شكراً لثقتك بنا!';
    case 'cancelled':
      return 'تم إلغاء الطلب بالكامل وإعادة المنتجات إلى المخزون.';
    default:
      return '';
  }
}

export const orderService = {
  /**
   * Safely generate a collision-safe sequential invoice number (e.g. INV-2026-000001)
   */
  async generateUniqueInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    if (!db) {
      const randomSeq = Math.floor(100000 + Math.random() * 900000);
      return `INV-${year}-${randomSeq}`;
    }

    try {
      const counterDocRef = doc(db, 'counters', `invoices_${year}`);
      const nextSeq = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(counterDocRef);
        let seq = 1;
        if (snap.exists()) {
          const data = snap.data();
          seq = (data.seq || 0) + 1;
        }
        transaction.set(counterDocRef, { seq, year, updatedAt: new Date().toISOString() }, { merge: true });
        return seq;
      });

      const padded = String(nextSeq).padStart(6, '0');
      return `INV-${year}-${padded}`;
    } catch (err) {
      console.warn('Failed to generate transaction invoice number, falling back to safe fallback format:', err);
      const fallbackSeq = String(Date.now()).slice(-5) + Math.floor(Math.random() * 10);
      return `INV-${year}-${fallbackSeq}`;
    }
  },

  /**
   * Authoritatively validates items and recalculates order totals directly from Firestore products.
   * NEVER trusts prices sent from the client.
   */
  async validateOrderTotals(
    rawItems: { productId: string; quantity: number }[],
    couponCode?: string,
    customerUid?: string
  ): Promise<ValidatedOrderCalculation> {
    if (!db) throw new Error('Database not initialized');
    if (!rawItems || rawItems.length === 0) {
      throw new Error('السلة فارغة، يرجى إضافة منتجات للطلب.');
    }

    const validatedItems: OrderItem[] = [];
    let calculatedSubtotal = 0;

    // Fetch active promotions and campaigns for authoritative purchase price calculation
    const [activePromotions, activeBanners] = await Promise.all([
      promotionService.getActivePromotions().catch(() => []),
      homepageService.getActiveBanners().catch(() => [])
    ]);

    // Fetch authoritative product data directly from Firestore for every item
    for (const item of rawItems) {
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const prodRef = doc(db, 'products', item.productId);
      const prodSnap = await getDoc(prodRef);

      if (!prodSnap.exists()) {
        throw new Error(`المنتج المطلوب (${item.productId}) غير متوفر حالياً.`);
      }

      const prodData = prodSnap.data();
      const productObj = {
        id: prodSnap.id,
        ...prodData
      } as Product;

      // Calculate effective selling price dynamically respecting active promotions & campaigns
      const pricingDetails = getEffectiveProductPrice(productObj, activeBanners, activePromotions);
      const authoritativePrice = pricingDetails.effectivePrice;
      const lineTotal = authoritativePrice * quantity;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        productId: item.productId,
        productName: prodData.name || 'منتج',
        productImage: prodData.mainImageUrl || (Array.isArray(prodData.additionalImages) ? prodData.additionalImages[0] : '') || '',
        priceAtPurchase: authoritativePrice,
        quantity,
        lineTotal
      });
    }

    // Validate coupon code authoritatively
    let discountAmount = 0;
    let couponErrorMsg: string | undefined;
    const cleanCouponCode = couponCode?.trim().toUpperCase();

    if (cleanCouponCode) {
      try {
        const couponValidation = await couponService.validateCoupon(
          cleanCouponCode,
          customerUid || '',
          calculatedSubtotal,
          validatedItems
        );

        if (couponValidation.valid) {
          discountAmount = couponValidation.discountAmount;
        } else {
          couponErrorMsg = couponValidation.error || 'كود الخصم غير صالح';
        }
      } catch (e) {
        console.warn('Coupon calculation warning:', e);
        couponErrorMsg = 'تعذر التحقق من كود الخصم';
      }
    }

    // Free shipping threshold: 3000 EGP, default shipping: 50 EGP
    const freeShippingThreshold = 3000;
    const standardShippingCost = 50;
    const shippingCost = calculatedSubtotal >= freeShippingThreshold ? 0 : standardShippingCost;

    const finalTotal = Math.max(0, calculatedSubtotal - discountAmount + shippingCost);

    return {
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: discountAmount,
      shippingCost,
      total: finalTotal,
      couponCode: discountAmount > 0 ? cleanCouponCode : undefined,
      couponError: couponErrorMsg
    };
  },

  /**
   * Complete transactional order creation flow with AUTHORITATIVE ATOMIC STOCK DEDUCTION.
   * Now delegates to the secure server-side /api/orders/checkout endpoint.
   */
  async placeCheckoutOrder(input: CheckoutInput): Promise<{ orderId: string; invoiceNumber: string; order: Order }> {
    if (!db) throw new Error('Database not initialized');

    // Deterministic Idempotency protection against rapid double-clicks
    const idempotencyKey = input.idempotencyKey || `checkout_${input.customerUid || 'guest'}_${Date.now()}`;
    if (inFlightCheckoutLocks.has(idempotencyKey)) {
      throw new Error('جاري معالجة الطلب بالفعل، يرجى الانتظار...');
    }
    inFlightCheckoutLocks.add(idempotencyKey);

    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      
      const response = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          ...input,
          idempotencyKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل إتمام الطلب');
      }

      // Fetch the newly created order from Firestore to return a full Order object
      const order = await this.getOrderById(data.orderId);
      if (!order) {
        throw new Error('تم إنشاء الطلب بنجاح ولكن تعذر تحميل التفاصيل حالياً. يرجى مراجعة "طلباتي".');
      }

      // Trigger post-checkout notifications & analytics
      try {
        notificationEngine.fireStoreEvent({
          eventType: 'NEW_ORDER',
          payload: {
            orderId: data.orderId,
            total: order.total,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerUid: order.customerUid,
            products: order.items.map(i => ({ name: i.productName, quantity: i.quantity, price: i.priceAtPurchase }))
          },
          customerUid: order.customerUid !== 'guest' ? order.customerUid : undefined
        }).catch(() => {});

        analyticsService.trackEvent('order_created', {
          userUid: order.customerUid,
          metadata: { orderId: data.orderId, total: order.total, itemsCount: order.items.length }
        });
      } catch {}

      return {
        orderId: data.orderId,
        invoiceNumber: data.invoiceNumber,
        order
      };
    } finally {
      // Release idempotency lock after a short cooldown
      setTimeout(() => {
        inFlightCheckoutLocks.delete(idempotencyKey);
      }, 4000);
    }
  },

  /**
   * Place a new order directly (delegates to transaction logic for atomic stock validation).
   */
  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const res = await this.placeCheckoutOrder({
      customerUid: orderData.customerUid,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhone: orderData.customerPhone,
      shippingAddress: orderData.shippingAddress,
      customerNotes: orderData.customerNotes,
      items: orderData.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      couponCode: orderData.couponCode,
      paymentMethod: orderData.paymentMethod
    });
    return res.orderId;
  },

  /**
   * Helper: Map Firestore document data to an Order object
   */
  mapOrderDoc(id: string, data: any): Order {
    return {
      id,
      invoiceNumber: data.invoiceNumber || undefined,
      invoiceStatus: data.invoiceStatus || undefined,
      invoiceCreatedAt: data.invoiceCreatedAt || undefined,
      customerUid: data.customerUid || data.userId || 'guest',
      customerName: data.customerName || '',
      customerEmail: data.customerEmail || '',
      customerPhone: data.customerPhone || '',
      shippingAddress: data.shippingAddress || data.customerAddress || '',
      customerNotes: data.customerNotes || '',
      items: data.items || [],
      subtotal: data.subtotal || data.totalAmount || 0,
      discount: data.discount || 0,
      shippingCost: data.shippingCost || 0,
      total: data.total || data.totalAmount || 0,
      selectedInsurance: data.selectedInsurance || undefined,
      couponCode: data.couponCode || '',
      paymentMethod: data.paymentMethod || 'cash_on_delivery',
      paymentStatus: data.paymentStatus || 'pending',
      orderStatus: (data.orderStatus || data.status || 'new') as OrderStatus,
      statusHistory: data.statusHistory || [],
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || ''
    };
  },

  /**
   * One-time fetch of all orders for Admin Dashboard & Orders Page (getDocs).
   * Does not open or hold persistent WebChannel stream connections.
   */
  async getOrders(limitCount: number = 100): Promise<Order[]> {
    if (!db) return [];
    try {
      const ordersColRef = collection(db, 'orders');
      const q = query(ordersColRef, orderBy('createdAt', 'desc'), limit(limitCount));
      const snapshot = await getDocs(q);
      const ordersList: Order[] = [];
      snapshot.forEach((doc) => {
        ordersList.push(this.mapOrderDoc(doc.id, doc.data()));
      });
      return ordersList;
    } catch (err: any) {
      console.warn('[Order Service] Fallback getOrders without orderBy:', err?.message || err);
      try {
        const fallbackQ = query(collection(db, 'orders'), limit(limitCount));
        const snapshot = await getDocs(fallbackQ);
        const ordersList: Order[] = [];
        snapshot.forEach((doc) => {
          ordersList.push(this.mapOrderDoc(doc.id, doc.data()));
        });
        return ordersList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (fallbackErr) {
        console.warn('[Order Service] Failed to get orders:', fallbackErr);
        return [];
      }
    }
  },

  /**
   * One-time fetch of a customer's orders for Profile Page (getDocs).
   * Uses simple where query and in-memory sorting, requiring no composite indexes
   * and opening no persistent streaming listeners.
   */
  async getUserOrders(customerUid: string, limitCount: number = 50): Promise<Order[]> {
    if (!db || !customerUid || customerUid === 'guest') return [];
    try {
      const ordersColRef = collection(db, 'orders');
      const q = query(
        ordersColRef,
        where('customerUid', '==', customerUid),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const ordersList: Order[] = [];
      snapshot.forEach((doc) => {
        ordersList.push(this.mapOrderDoc(doc.id, doc.data()));
      });
      return ordersList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      console.warn('[Order Service] Error fetching user orders:', err);
      return [];
    }
  },

  /**
   * One-time delivery of orders (does not open or hold active WebChannel streams)
   */
  subscribeToOrders(callback: (orders: Order[]) => void): () => void {
    if (!db) {
      callback([]);
      return () => {};
    }
    this.getOrders(100).then(callback).catch(() => callback([]));
    return () => {};
  },

  /**
   * One-time delivery of orders for a specific customer (does not open or hold active WebChannel streams)
   */
  subscribeToUserOrders(customerUid: string, callback: (orders: Order[]) => void): () => void {
    if (!db || !customerUid) {
      callback([]);
      return () => {};
    }
    this.getUserOrders(customerUid).then(callback).catch(() => callback([]));
    return () => {};
  },

  /**
   * Fetch a single order by ID from Firestore.
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    if (!db || !orderId) return null;
    try {
      const docRef = doc(db, 'orders', orderId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      const data = snap.data();
      const order: Order = {
        id: snap.id,
        customerUid: data.customerUid || data.userId || 'guest',
        customerName: data.customerName || '',
        customerEmail: data.customerEmail || '',
        customerPhone: data.customerPhone || '',
        shippingAddress: data.shippingAddress || data.customerAddress || '',
        customerNotes: data.customerNotes || '',
        items: data.items || [],
        subtotal: data.subtotal || data.totalAmount || 0,
        discount: data.discount || 0,
        shippingCost: data.shippingCost || 0,
        total: data.total || data.totalAmount || 0,
        couponCode: data.couponCode || '',
        paymentMethod: data.paymentMethod || 'cash_on_delivery',
        paymentStatus: data.paymentStatus || 'pending',
        orderStatus: (data.orderStatus || data.status || 'new') as OrderStatus,
        statusHistory: data.statusHistory || [],
        invoiceId: data.invoiceId,
        invoiceNumber: data.invoiceNumber,
        invoiceStatus: data.invoiceStatus,
        invoiceCreatedAt: data.invoiceCreatedAt,
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || ''
      };
      return order;
    } catch (err) {
      console.error('Error fetching order by ID:', err);
      return null;
    }
  },

  /**
   * Update the status of an existing order with AUTHORITATIVE CANCELLATION RESTOCK RULES:
   * - New/unconfirmed/preparing/ready_to_ship/shipped cancelled order: restore stock
   * - Delivered order: do not restore stock
   * - Prevent double restoration if status changes repeatedly
   */
  async updateOrderStatus(orderId: string, orderStatus: OrderStatus): Promise<void> {
    if (!db || !orderId) return;
    const orderDocRef = doc(db, 'orders', orderId);
    const now = new Date().toISOString();

    let customerUid = '';
    let customerName = '';
    let customerPhone = '';
    const restoredProductEvents: { productId: string; productName: string; stock: number }[] = [];

    // Execute atomic validations and status transitions inside transaction
    await runTransaction(db, async (transaction) => {
      const orderSnap = await transaction.get(orderDocRef);
      if (!orderSnap.exists()) {
        throw new Error(`الطلب (${orderId}) غير موجود.`);
      }

      const orderData = orderSnap.data() as Order;
      customerUid = orderData.customerUid || (orderData as any).userId || '';
      customerName = orderData.customerName || '';
      customerPhone = orderData.customerPhone || '';

      const previousStatus = (orderData.orderStatus || (orderData as any).status || 'new') as OrderStatus;

      // Validate transitions
      if (!isValidOrderStatusTransition(previousStatus, orderStatus)) {
        const arabicPrev = statusTranslations[previousStatus] || previousStatus;
        const arabicNext = statusTranslations[orderStatus] || orderStatus;
        throw new Error(`لا يمكن تعديل حالة الطلب من [${arabicPrev}] إلى [${arabicNext}]. يرجى اتباع تسلسل العمل المعتمد: جديد ← تم التأكيد ← جاري التجهيز ← جاهز للشحن ← تم الشحن ← تم التسليم.`);
      }

      const currentHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
      const nextHistory = [
        ...currentHistory,
        {
          status: orderStatus,
          timestamp: now,
          note: getStatusNote(orderStatus),
          updatedBy: 'admin'
        }
      ];

      if (orderStatus === 'cancelled') {
        const alreadyRestored = Boolean(orderData.stockRestored);
        const wasDelivered = previousStatus === 'delivered';

        // RULE: Only restore stock if not delivered and not already restored
        const shouldRestoreStock = !wasDelivered && !alreadyRestored && Array.isArray(orderData.items) && orderData.items.length > 0;

        if (shouldRestoreStock) {
          for (const item of orderData.items) {
            const prodRef = doc(db, 'products', item.productId);
            const prodSnap = await transaction.get(prodRef);

            if (prodSnap.exists()) {
              const prodData = prodSnap.data() as Product;
              const currentStock = typeof prodData.stockQuantity === 'number'
                ? prodData.stockQuantity
                : (prodData.isAvailable !== false ? 10 : 0);

              const restoredStock = currentStock + (item.quantity || 1);
              const threshold = typeof prodData.lowStockThreshold === 'number'
                ? prodData.lowStockThreshold
                : DEFAULT_LOW_STOCK_THRESHOLD;

              const isComingSoon = prodData.stockStatus === 'coming_soon';
              const nextAvailable = isComingSoon ? false : true;
              const nextStatus = deriveStockStatus(restoredStock, threshold, nextAvailable, isComingSoon);

              // Update product stock
              transaction.update(prodRef, {
                stockQuantity: restoredStock,
                stockStatus: nextStatus,
                isAvailable: nextAvailable,
                updatedAt: now
              });

              // Write immutable inventory audit log
              const logId = `log_${Date.now()}_restore_${item.productId.slice(-4)}_${Math.random().toString(36).substring(2, 6)}`;
              const logRef = doc(db, 'inventory_logs', logId);
              const logEntry: InventoryLog = {
                id: logId,
                productId: item.productId,
                productName: item.productName || prodData.name,
                productSku: prodData.sku,
                change: +item.quantity,
                previousStock: currentStock,
                newStock: restoredStock,
                reason: 'order_cancelled',
                referenceId: orderId,
                note: `استرجاع المخزون لإلغاء الطلب #${orderData.invoiceNumber || orderId.slice(-6)}`,
                adjustedBy: 'admin:status_update',
                timestamp: now
              };

              transaction.set(logRef, logEntry);

              if (currentStock === 0 && restoredStock > 0) {
                restoredProductEvents.push({
                  productId: item.productId,
                  productName: item.productName || prodData.name,
                  stock: restoredStock
                });
              }
            }
          }

          // Update order with stockRestored = true
          transaction.update(orderDocRef, {
            orderStatus: 'cancelled',
            status: 'cancelled',
            stockRestored: true,
            statusHistory: nextHistory,
            updatedAt: now
          });
        } else {
          // If was delivered or already restored, simply update status without changing inventory
          transaction.update(orderDocRef, {
            orderStatus: 'cancelled',
            status: 'cancelled',
            statusHistory: nextHistory,
            updatedAt: now
          });
        }
      } else {
        // Standard status update
        transaction.update(orderDocRef, {
          orderStatus,
          status: orderStatus, // for backwards-compatibility
          statusHistory: nextHistory,
          updatedAt: now
        });
      }
    });

    if (orderStatus === 'delivered') {
      analyticsService.trackEvent('order_delivered', { metadata: { orderId } });
    } else if (orderStatus === 'cancelled') {
      analyticsService.trackEvent('order_cancelled', { metadata: { orderId } });
    }

    // Record Audit Log
    try {
      await auditService.recordAuditLog({
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'order',
        entityId: orderId,
        entityName: `طلب #${orderId.slice(-6)}`,
        after: { status: orderStatus }
      });
    } catch (e) {}

    // Dispatch Centralized Store Event
    try {
      const isCancelled = orderStatus === 'cancelled';
      await notificationEngine.fireStoreEvent({
        eventType: isCancelled ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
        payload: {
          orderId,
          status: statusTranslations[orderStatus] || orderStatus,
          customerName,
          customerPhone,
          customerUid
        },
        customerUid: customerUid || undefined
      });

      // Dispatch restocked alerts if any product went from 0 to positive
      for (const rItem of restoredProductEvents) {
        await notificationEngine.fireStoreEvent({
          eventType: 'RESTOCKED',
          payload: {
            productId: rItem.productId,
            productName: rItem.productName,
            stock: rItem.stock
          }
        });
      }
    } catch (e) {
      console.warn('Could not fire store event for order status change:', e);
    }
  },

  /**
   * Update order payment status and record action in statusHistory
   */
  async updateOrderPaymentStatus(
    orderId: string, 
    paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled',
    adminNote?: string
  ): Promise<void> {
    if (!db || !orderId) return;
    const orderDocRef = doc(db, 'orders', orderId);
    const now = new Date().toISOString();
    let customerUid = '';
    let orderTotal = 0;

    await runTransaction(db, async (transaction) => {
      const orderSnap = await transaction.get(orderDocRef);
      if (!orderSnap.exists()) {
        throw new Error(`الطلب (${orderId}) غير موجود.`);
      }

      const orderData = orderSnap.data() as Order;
      customerUid = orderData.customerUid || '';
      orderTotal = orderData.total || 0;
      const previousPaymentStatus = orderData.paymentStatus || 'pending';
      const currentHistory = Array.isArray(orderData.statusHistory) ? orderData.statusHistory : [];
      const nextHistory = [
        ...currentHistory,
        {
          status: orderData.orderStatus || 'new',
          timestamp: now,
          note: adminNote || `تحديث حالة الدفع من [${previousPaymentStatus}] إلى [${paymentStatus}] من قبل الإدارة.`,
          updatedBy: 'admin'
        }
      ];

      transaction.update(orderDocRef, {
        paymentStatus,
        statusHistory: nextHistory,
        updatedAt: now
      });
    });

    // Record Audit Log
    try {
      const isConfirmed = paymentStatus === 'paid';
      await auditService.recordAuditLog({
        action: isConfirmed ? 'ORDER_PAYMENT_CONFIRMED' : 'ORDER_STATUS_CHANGED',
        entityType: 'order',
        entityId: orderId,
        entityName: `طلب #${orderId.slice(-6)}`,
        after: { paymentStatus }
      });
    } catch (e) {}

    // Notify customer about payment status update
    if (customerUid && customerUid !== 'guest') {
      try {
        const { notificationService } = await import('../notificationService');
        await notificationService.sendCustomerPaymentNotification(customerUid, orderId, paymentStatus, orderTotal);
      } catch (e) {
        console.warn('Could not dispatch customer payment notification:', e);
      }
    }
  },

  /**
   * Fetch all user carts for active cart tracking in the Admin Dashboard.
   */
  async getActiveCustomerCarts(): Promise<{ userId: string; email: string; name: string; itemsCount: number; items: { productName: string; quantity: number; price: number }[] }[]> {
    if (!db || !auth) return [];
    
    // Check if user is logged in
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      return [];
    }
    
    // Quick client-side check to prevent unauthorized query exceptions
    const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
    const isAdmin = adminEmails.some(e => e.toLowerCase() === currentUser.email?.toLowerCase());
    if (!isAdmin) {
      return [];
    }

    try {
      // 1. Fetch active cart items across all users using collectionGroup with a safe limit
      const cartColRef = collectionGroup(db, 'cart');
      const cartSnap = await getDocs(query(cartColRef, limit(150)));
      
      if (cartSnap.empty) {
        return [];
      }

      // Group cart items by userId
      const userCartItems: Record<string, { productId: string; quantity: number }[]> = {};
      for (const itemDoc of cartSnap.docs) {
        const userId = itemDoc.ref.parent.parent?.id;
        if (!userId) continue;

        const itemData = itemDoc.data();
        const productId = itemDoc.id;
        const qty = itemData.quantity || 1;

        if (!userCartItems[userId]) {
          userCartItems[userId] = [];
        }
        userCartItems[userId].push({ productId, quantity: qty });
      }

      const activeCarts: { userId: string; email: string; name: string; itemsCount: number; items: { productName: string; quantity: number; price: number }[] }[] = [];
      const userCache: Record<string, { email: string; name: string }> = {};
      const productCache: Record<string, { name: string; price: number }> = {};

      for (const [userId, items] of Object.entries(userCartItems)) {
        // Resolve user info (cached in-memory per request)
        if (!userCache[userId]) {
          try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              userCache[userId] = {
                email: uData.email || '',
                name: uData.displayName || 'عميل مجهول'
              };
            } else {
              userCache[userId] = { email: '', name: 'عميل مجهول' };
            }
          } catch (err) {
            userCache[userId] = { email: '', name: 'عميل مجهول' };
          }
        }

        const userData = userCache[userId];
        const itemsList: { productName: string; quantity: number; price: number }[] = [];
        let totalQty = 0;

        for (const item of items) {
          const productId = item.productId;
          
          // Resolve product info (cached in-memory per request)
          if (!productCache[productId]) {
            try {
              const prodSnap = await getDoc(doc(doc(db, 'products', productId).parent, productId));
              if (prodSnap.exists()) {
                const pData = prodSnap.data();
                productCache[productId] = {
                  name: pData.name || '',
                  price: pData.price || 0
                };
              } else {
                productCache[productId] = { name: 'منتج غير معروف', price: 0 };
              }
            } catch (err) {
              productCache[productId] = { name: 'منتج غير معروف', price: 0 };
            }
          }

          const prodInfo = productCache[productId];
          totalQty += item.quantity;
          itemsList.push({
            productName: prodInfo.name,
            quantity: item.quantity,
            price: prodInfo.price
          });
        }

        activeCarts.push({
          userId,
          email: userData.email,
          name: userData.name,
          itemsCount: totalQty,
          items: itemsList
        });
      }

      return activeCarts;
    } catch (e) {
      console.error('Failed to load active customer carts:', e);
      return [];
    }
  }
};
