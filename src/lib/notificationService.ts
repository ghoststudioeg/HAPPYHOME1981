import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  writeBatch,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Notification, NotificationType, RelatedType, OrderStatus } from '../types';
import { sanitizeForFirestore } from './firestoreUtils';

// Centralized singleton manager for customer notifications:
// Guarantees strictly ONE active Firestore onSnapshot listener per userId across the entire app.
// Includes a 500ms unmount grace period for React StrictMode and route transitions.
type CustomerNotificationCallback = (notifications: Notification[]) => void;

interface CustomerSubscriptionState {
  subscribers: Set<CustomerNotificationCallback>;
  cachedNotifications: Notification[];
  unsubscribeFirestore: (() => void) | null;
  cleanupTimer: any | null;
}

const customerSubscriptions = new Map<string, CustomerSubscriptionState>();

export const notificationService = {
  /**
   * Create a customer notification for a specific user
   * Guarantees:
   * - No undefined values sent to Firestore
   * - Deterministic or unique ID
   * - Safe fallback if database errors occur
   */
  async createNotification(userId: string, data: {
    type: NotificationType;
    title: string;
    message: string;
    relatedId?: string;
    relatedType?: RelatedType;
  }): Promise<string | null> {
    if (!db || !userId || userId === 'guest') return null;

    try {
      const notificationRef = doc(collection(db, `users/${userId}/notifications`));
      const notificationData: Record<string, any> = {
        notificationId: notificationRef.id,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        createdAt: new Date().toISOString(),
      };

      if (data.relatedId && data.relatedId.trim()) {
        notificationData.relatedId = data.relatedId.trim();
      }
      if (data.relatedType && data.relatedType.trim()) {
        notificationData.relatedType = data.relatedType.trim();
      }

      const sanitized = sanitizeForFirestore(notificationData);
      await setDoc(notificationRef, sanitized);
      return notificationRef.id;
    } catch (err) {
      console.warn('[Notification Service] Failed to create customer notification:', err);
      return null;
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    if (!db || !userId || !notificationId) return;
    try {
      const notificationRef = doc(db, `users/${userId}/notifications`, notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (err) {
      console.warn('[Notification Service] Failed to mark notification as read:', err);
    }
  },

  /**
   * Mark all unread notifications as read for a customer
   */
  async markAllAsRead(userId: string): Promise<void> {
    if (!db || !userId) return;
    try {
      const notificationsRef = collection(db, `users/${userId}/notifications`);
      const q = query(notificationsRef, where('read', '==', false));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return;

      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.warn('[Notification Service] Failed to mark all as read:', err);
    }
  },

  /**
   * Delete a single notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    if (!db || !userId || !notificationId) return;
    try {
      const notificationRef = doc(db, `users/${userId}/notifications`, notificationId);
      await deleteDoc(notificationRef);
    } catch (err) {
      console.warn('[Notification Service] Failed to delete notification:', err);
    }
  },

  /**
   * Clear all notifications for a customer
   */
  async clearAllNotifications(userId: string): Promise<void> {
    if (!db || !userId) return;
    try {
      const notificationsRef = collection(db, `users/${userId}/notifications`);
      const querySnapshot = await getDocs(query(notificationsRef, limit(100)));
      
      if (querySnapshot.empty) return;

      const batch = writeBatch(db);
      querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    } catch (err) {
      console.warn('[Notification Service] Failed to clear all notifications:', err);
    }
  },

  /**
   * One-time fetch of customer notifications (getDocs).
   * Does not hold open persistent stream connections.
   */
  async getNotifications(userId: string, limitCount: number = 50): Promise<Notification[]> {
    if (!db || !userId || userId === 'guest') return [];
    try {
      const notificationsRef = collection(db, `users/${userId}/notifications`);
      const q = query(notificationsRef, limit(limitCount));
      const snapshot = await getDocs(q);
      const list: Notification[] = snapshot.docs.map(docSnap => docSnap.data() as Notification);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.warn('[Notification Service] Error fetching customer notifications:', err);
      return [];
    }
  },

  /**
   * Centralized real-time subscription for customer notifications.
   * Guarantees:
   * 1. Strictly ONE active Firestore onSnapshot listener per user across the app.
   * 2. No duplicate WebChannel connections.
   * 3. 500ms unmount grace period to protect against React StrictMode and route switches.
   * 4. Safe memory sorting without composite index dependencies.
   */
  subscribeToNotifications(userId: string, callback: CustomerNotificationCallback): () => void {
    if (!db || !userId || userId === 'guest') {
      callback([]);
      return () => {};
    }

    let state = customerSubscriptions.get(userId);
    if (!state) {
      state = {
        subscribers: new Set(),
        cachedNotifications: [],
        unsubscribeFirestore: null,
        cleanupTimer: null
      };
      customerSubscriptions.set(userId, state);
    }

    // Cancel pending unmount cleanup if any (e.g. StrictMode remount or page transition)
    if (state.cleanupTimer) {
      clearTimeout(state.cleanupTimer);
      state.cleanupTimer = null;
    }

    state.subscribers.add(callback);

    // Provide cached data immediately to prevent layout flashes
    if (state.cachedNotifications.length > 0) {
      try {
        callback(state.cachedNotifications);
      } catch (e) {
        console.warn('[Notification Service] Initial callback error:', e);
      }
    } else {
      // Fetch once in background while listener attaches
      this.getNotifications(userId).then((initialList) => {
        if (state && state.cachedNotifications.length === 0 && initialList.length > 0) {
          state.cachedNotifications = initialList;
          callback(initialList);
        }
      }).catch(() => {});
    }

    // Attach single Firestore listener if not already active
    if (!state.unsubscribeFirestore) {
      try {
        const notificationsRef = collection(db, `users/${userId}/notifications`);
        // Limit query without orderBy to avoid composite index requirements
        const q = query(notificationsRef, limit(50));

        state.unsubscribeFirestore = onSnapshot(
          q,
          (snapshot) => {
            const notifications = snapshot.docs.map(docSnap => docSnap.data() as Notification);
            notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            if (state) {
              state.cachedNotifications = notifications;
              state.subscribers.forEach((sub) => {
                try {
                  sub(notifications);
                } catch (subErr) {
                  console.warn('[Notification Service] Subscriber notification dispatch notice:', subErr);
                }
              });
            }
          },
          (err) => {
            console.warn('[Notification Service] Customer notifications listener transport notice:', err?.message || err);
            // Fetch once as a safe fallback without crashing or opening parallel listeners
            notificationService.getNotifications(userId).then((data) => {
              if (state) {
                state.cachedNotifications = data;
                state.subscribers.forEach((sub) => sub(data));
              }
            }).catch(() => {});
          }
        );
      } catch (initErr) {
        console.warn('[Notification Service] Failed to initialize customer notifications listener:', initErr);
        this.getNotifications(userId).then(callback).catch(() => {});
      }
    }

    // Clean unsubscription with 500ms grace period
    return () => {
      const currentState = customerSubscriptions.get(userId);
      if (!currentState) return;

      currentState.subscribers.delete(callback);

      if (currentState.subscribers.size === 0) {
        if (currentState.cleanupTimer) clearTimeout(currentState.cleanupTimer);
        currentState.cleanupTimer = setTimeout(() => {
          if (currentState.subscribers.size === 0) {
            if (currentState.unsubscribeFirestore) {
              try {
                currentState.unsubscribeFirestore();
              } catch (e) {}
              currentState.unsubscribeFirestore = null;
            }
            customerSubscriptions.delete(userId);
          }
        }, 500);
      }
    };
  },

  /**
   * Helper: Send customer order lifecycle notification
   */
  async sendCustomerOrderNotification(
    customerUid: string,
    orderId: string,
    status: OrderStatus | 'new',
    total?: number
  ): Promise<string | null> {
    if (!customerUid || customerUid === 'guest') return null;

    const shortId = orderId ? orderId.slice(-6).toUpperCase() : '';
    let type: NotificationType = 'order_status_changed';
    let title = 'تحديث في حالة طلبك';
    let message = `تم تحديث حالة طلبك رقم #${shortId}.`;

    switch (status) {
      case 'new':
        type = 'order_created';
        title = '✅ تم إنشاء طلبك بنجاح';
        message = `تم استلام وتسجيل طلبك رقم #${shortId}${total ? ` بقيمة ${total.toLocaleString('ar-EG')} ج.م` : ''} بنجاح وهو قيد المراجعة حالياً.`;
        break;
      case 'confirmed':
        type = 'order_confirmed';
        title = '✅ تم تأكيد طلبك';
        message = `تمت مراجعة وتأكيد طلبك رقم #${shortId} من قبل الإدارة، وجاري تحويله للتجهيز.`;
        break;
      case 'preparing':
        type = 'order_preparing';
        title = '📦 جاري تجهيز طلبك';
        message = `بدأ فريقنا في تعبئة وتجهيز محتويات طلبك رقم #${shortId} بعناية فائقة.`;
        break;
      case 'ready_to_ship':
        type = 'order_ready_to_ship';
        title = '📦 طلبك جاهز للشحن';
        message = `تم الانتهاء من تجهيز طلبك رقم #${shortId} وهو بانتظار تسليمه لمندوب الشحن.`;
        break;
      case 'shipped':
        type = 'order_shipped';
        title = '🚚 تم شحن طلبك';
        message = `شحنتك للطلب رقم #${shortId} في طريقها إليك الآن مع شركة الشحن.`;
        break;
      case 'delivered':
        type = 'order_delivered';
        title = '✅ تم تسليم طلبك بنجاح';
        message = `تم تسليم طلبك رقم #${shortId} بنجاح. شكراً لتسوقك معنا ونتمنى لك تجربة ممتعة!`;
        break;
      case 'cancelled':
        type = 'order_cancelled';
        title = '❌ تم إلغاء طلبك';
        message = `تم إلغاء الطلب رقم #${shortId} وإعادة المنتجات إلى المخزون.`;
        break;
    }

    return this.createNotification(customerUid, {
      type,
      title,
      message,
      relatedId: orderId,
      relatedType: 'order'
    });
  },

  /**
   * Helper: Send customer payment status notification
   */
  async sendCustomerPaymentNotification(
    customerUid: string,
    orderId: string,
    paymentStatus: 'paid' | 'pending' | 'failed' | 'cancelled',
    total?: number
  ): Promise<string | null> {
    if (!customerUid || customerUid === 'guest') return null;

    const shortId = orderId ? orderId.slice(-6).toUpperCase() : '';
    let type: NotificationType = 'payment_pending';
    let title = 'تحديث في حالة الدفع';
    let message = `تم تحديث حالة دفع طلبك #${shortId}.`;

    switch (paymentStatus) {
      case 'paid':
        type = 'payment_received';
        title = '💳 تم استلام الدفع';
        message = `تم تأكيد واستلام مبلغ دفعة طلبك رقم #${shortId}${total ? ` بقيمة ${total.toLocaleString('ar-EG')} ج.م` : ''} بنجاح.`;
        break;
      case 'pending':
        type = 'payment_pending';
        title = '⏳ في انتظار تأكيد الدفع';
        message = `طلبك رقم #${shortId} بانتظار مراجعة وتأكيد عملية الدفع.`;
        break;
      case 'failed':
        type = 'payment_failed';
        title = '❌ تعذر تأكيد عملية الدفع';
        message = `تعذر تأكيد الدفع للطلب رقم #${shortId}، يرجى التحقق من تفاصيل الدفع أو اختيار طريقة أخرى.`;
        break;
    }

    return this.createNotification(customerUid, {
      type,
      title,
      message,
      relatedId: orderId,
      relatedType: 'order'
    });
  },

  /**
   * Helper: Send product restock notification to customers who favorited it
   */
  async notifyFavoriteProductStock(userId: string, productId: string, productName: string): Promise<string | null> {
    if (!userId || userId === 'guest') return null;
    return this.createNotification(userId, {
      type: 'product_back_in_stock',
      title: '🎉 توفر مجددًا في المخزون!',
      message: `المنتج (${productName}) الموجود في قائمتك المفضلة أصبح متوفراً الآن وجاهزاً للطلب.`,
      relatedId: productId,
      relatedType: 'product'
    });
  },

  /**
   * Helper: Send discount notification on a favorited product
   */
  async notifyFavoriteProductDiscount(
    userId: string,
    productId: string,
    productName: string,
    discountPrice: number,
    oldPrice?: number
  ): Promise<string | null> {
    if (!userId || userId === 'guest') return null;
    const diff = oldPrice && oldPrice > discountPrice ? ` (وفرت ${(oldPrice - discountPrice).toLocaleString('ar-EG')} ج.م)` : '';
    return this.createNotification(userId, {
      type: 'favorite_product_discount',
      title: '🔥 عرض خاص على منتج في مفضلتك!',
      message: `أصبح سعر (${productName}) الآن ${discountPrice.toLocaleString('ar-EG')} ج.م${diff}. سارع بالطلب قبل انتهاء العرض!`,
      relatedId: productId,
      relatedType: 'product'
    });
  },

  /**
   * Admin announcement for all users
   */
  async createAnnouncementForAll(announcement: {
    title: string;
    message: string;
  }) {
    if (!db) return;
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      
      usersSnapshot.forEach((userDoc) => {
        const notificationRef = doc(collection(db, `users/${userDoc.id}/notifications`));
        batch.set(notificationRef, sanitizeForFirestore({
          notificationId: notificationRef.id,
          type: 'admin_announcement',
          title: announcement.title,
          message: announcement.message,
          read: false,
          createdAt: new Date().toISOString(),
          relatedType: 'system'
        }));
      });
      
      await batch.commit();
    } catch (err) {
      console.warn('[Notification Service] Failed to create announcement for all:', err);
    }
  },

  /**
   * Admin announcement for selected users
   */
  async createAnnouncementForSelected(userIds: string[], announcement: {
    title: string;
    message: string;
  }) {
    if (!db || !userIds || userIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      
      userIds.forEach((userId) => {
        const notificationRef = doc(collection(db, `users/${userId}/notifications`));
        batch.set(notificationRef, sanitizeForFirestore({
          notificationId: notificationRef.id,
          type: 'admin_announcement',
          title: announcement.title,
          message: announcement.message,
          read: false,
          createdAt: new Date().toISOString(),
          relatedType: 'system'
        }));
      });
      
      await batch.commit();
    } catch (err) {
      console.warn('[Notification Service] Failed to create announcement for selected:', err);
    }
  }
};
