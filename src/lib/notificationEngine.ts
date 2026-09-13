import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from './firebase';
import {
  AdminStoreNotification,
  StoreEventType,
  StoreSettings,
  WhatsAppDeliveryStatus,
  OrderStatus
} from '../types';
import { buildNotificationContent, NotificationTemplatePayload } from './notifications/templates';
import { settingsService } from './data/settingsService';
import { checkIsAdminEmail } from './authUtils';
import { sanitizeForFirestore } from './firestoreUtils';

// Note: Dynamic imports are used inside methods for notificationService and userService to break circular dependencies

export interface FireStoreEventInput {
  eventId?: string;
  eventType: StoreEventType;
  payload?: NotificationTemplatePayload;
  titleOverride?: string;
  messageOverride?: string;
  customerUid?: string;
  forceRetry?: boolean;
}

// ============================================================================
// Centralized Admin Notification Subscription Manager (Singleton Pattern)
// Ensures strictly ONE active Firestore onSnapshot listener across the app,
// eliminates duplicate listeners, prevents infinite reconnect loops,
// classifies errors properly, and provides graceful polling fallback.
// ============================================================================

type AdminNotificationCallback = (notifications: AdminStoreNotification[]) => void;

const adminSubscribers = new Set<AdminNotificationCallback>();
let cachedAdminNotifications: AdminStoreNotification[] = [];
let activeSnapshotUnsubscribe: (() => void) | null = null;
let activeAuthUnsubscribe: (() => void) | null = null;
let pollingIntervalTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveTransportFailures = 0;
let pipelineSessionId = 0;
let isRealtimeActive = false;
let pipelineTeardownTimer: ReturnType<typeof setTimeout> | null = null;

function broadcastAdminNotifications(list: AdminStoreNotification[]) {
  cachedAdminNotifications = list;
  adminSubscribers.forEach((callback) => {
    try {
      callback(list);
    } catch (e) {
      console.warn('[Notification Engine] Subscriber callback failed:', e);
    }
  });
}

function stopAdminNotificationPipeline() {
  pipelineSessionId++; // Invalidate any pending async verification
  if (activeSnapshotUnsubscribe) {
    try {
      activeSnapshotUnsubscribe();
    } catch (e) {}
    activeSnapshotUnsubscribe = null;
  }
  if (activeAuthUnsubscribe) {
    try {
      activeAuthUnsubscribe();
    } catch (e) {}
    activeAuthUnsubscribe = null;
  }
  if (pollingIntervalTimer) {
    clearInterval(pollingIntervalTimer);
    pollingIntervalTimer = null;
  }
  isRealtimeActive = false;
  consecutiveTransportFailures = 0;
}

async function fetchAdminNotificationsOnce(session: number): Promise<void> {
  if (!db || session !== pipelineSessionId || adminSubscribers.size === 0) return;
  try {
    const colRef = collection(db, 'admin_notifications');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);

    if (session !== pipelineSessionId || adminSubscribers.size === 0) return;

    const list: AdminStoreNotification[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        eventType: (d.eventType || 'OTHER') as StoreEventType,
        title: d.title || '',
        message: d.message || '',
        relatedId: d.relatedId,
        relatedType: d.relatedType,
        createdAt: d.createdAt || new Date().toISOString(),
        read: d.read ?? false,
        priority: d.priority || 'medium',
        whatsappStatus: d.whatsappStatus || 'not_configured',
        whatsappError: d.whatsappError || '',
        payload: d.payload
      });
    });

    broadcastAdminNotifications(list);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      console.warn('[Notification Engine] Access denied by Firestore security rules for admin_notifications.');
      return;
    }
    console.warn('[Notification Engine] Periodic notification query notice:', err?.message || err);
  }
}

function startGracefulPollingFallback(session: number) {
  if (pollingIntervalTimer) {
    clearInterval(pollingIntervalTimer);
    pollingIntervalTimer = null;
  }

  // Fetch immediately
  fetchAdminNotificationsOnce(session);

  // Poll gently every 35 seconds (avoids tight loops and excessive reads)
  pollingIntervalTimer = setInterval(() => {
    if (session !== pipelineSessionId || adminSubscribers.size === 0) {
      if (pollingIntervalTimer) {
        clearInterval(pollingIntervalTimer);
        pollingIntervalTimer = null;
      }
      return;
    }
    fetchAdminNotificationsOnce(session);
  }, 35000);
}

function attachAdminFirestoreListener(session: number) {
  if (!db || session !== pipelineSessionId || adminSubscribers.size === 0) return;

  // Clean up any prior listener or polling
  if (activeSnapshotUnsubscribe) {
    try {
      activeSnapshotUnsubscribe();
    } catch (e) {}
    activeSnapshotUnsubscribe = null;
  }
  if (pollingIntervalTimer) {
    clearInterval(pollingIntervalTimer);
    pollingIntervalTimer = null;
  }

  const colRef = collection(db, 'admin_notifications');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));

  try {
    activeSnapshotUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (session !== pipelineSessionId || adminSubscribers.size === 0) return;

        isRealtimeActive = true;
        consecutiveTransportFailures = 0;

        const list: AdminStoreNotification[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            eventType: (d.eventType || 'OTHER') as StoreEventType,
            title: d.title || '',
            message: d.message || '',
            relatedId: d.relatedId,
            relatedType: d.relatedType,
            createdAt: d.createdAt || new Date().toISOString(),
            read: d.read ?? false,
            priority: d.priority || 'medium',
            whatsappStatus: d.whatsappStatus || 'not_configured',
            whatsappError: d.whatsappError || '',
            payload: d.payload
          });
        });

        broadcastAdminNotifications(list);
      },
      (err) => {
        if (session !== pipelineSessionId || adminSubscribers.size === 0) return;

        // Classify the error:
        if (err.code === 'permission-denied') {
          console.warn('[Notification Engine] Access denied by Firestore security rules for admin_notifications.');
          if (activeSnapshotUnsubscribe) {
            activeSnapshotUnsubscribe();
            activeSnapshotUnsubscribe = null;
          }
          cachedAdminNotifications = [];
          broadcastAdminNotifications([]);
          return;
        }

        if (err.code === 'failed-precondition') {
          console.warn('[Notification Engine] Precondition or index requirement notice:', err.message);
          fetchAdminNotificationsOnce(session);
          return;
        }

        // Transient / Transport / WebChannel error (e.g. unavailable, stream closed)
        consecutiveTransportFailures++;
        console.warn(`[Notification Engine] WebChannel transport notice (${consecutiveTransportFailures}): ${err.code || 'stream-notice'}`);

        // DO NOT invoke onSnapshot again! Firebase SDK manages normal reconnect behavior.
        // Keep cachedAdminNotifications so the UI retains existing state.

        // If repeated persistent transport failures occur in this sandboxed environment (3 consecutive fatal stream errors):
        if (consecutiveTransportFailures >= 3) {
          console.info('[Notification Engine] Switching to gentle polling fallback (every 35s) due to environment transport restrictions.');
          if (activeSnapshotUnsubscribe) {
            try {
              activeSnapshotUnsubscribe();
            } catch (e) {}
            activeSnapshotUnsubscribe = null;
          }
          startGracefulPollingFallback(session);
        }
      }
    );
  } catch (err: any) {
    console.warn('[Notification Engine] Failed to initialize snapshot listener:', err);
    startGracefulPollingFallback(session);
  }
}

function startAdminNotificationPipeline() {
  if (!db || !auth) {
    console.warn('[Notification Engine] Firebase not initialized.');
    broadcastAdminNotifications([]);
    return;
  }

  const session = ++pipelineSessionId;

  // Stop previous listeners
  if (activeSnapshotUnsubscribe) {
    activeSnapshotUnsubscribe();
    activeSnapshotUnsubscribe = null;
  }
  if (pollingIntervalTimer) {
    clearInterval(pollingIntervalTimer);
    pollingIntervalTimer = null;
  }

  activeAuthUnsubscribe = onAuthStateChanged(auth, async (authUser) => {
    if (session !== pipelineSessionId || adminSubscribers.size === 0) return;

    if (!authUser) {
      console.log('[Notification Engine] User signed out. Pausing admin notifications.');
      cachedAdminNotifications = [];
      broadcastAdminNotifications([]);
      if (activeSnapshotUnsubscribe) {
        activeSnapshotUnsubscribe();
        activeSnapshotUnsubscribe = null;
      }
      if (pollingIntervalTimer) {
        clearInterval(pollingIntervalTimer);
        pollingIntervalTimer = null;
      }
      return;
    }

    // Authoritative Admin Verification:
    let isAdmin = authUser.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22' || checkIsAdminEmail(authUser.email);
    if (!isAdmin) {
      try {
        const { userService } = await import('./data/userService');
        const profile = await userService.getUserProfile(authUser.uid);
        if (session !== pipelineSessionId || adminSubscribers.size === 0) return;
        isAdmin = profile?.role === 'admin';
      } catch (err) {
        console.warn('[Notification Engine] Error checking admin role:', err);
      }
    }

    if (session !== pipelineSessionId || adminSubscribers.size === 0) return;

    if (!isAdmin) {
      console.warn('[Notification Engine] Access denied: user is not an administrator.');
      cachedAdminNotifications = [];
      broadcastAdminNotifications([]);
      return;
    }

    // Admin verified! Attach single Firestore listener
    attachAdminFirestoreListener(session);
  });
}

export const notificationEngine = {
  /**
   * Primary entry point for firing store events across the application.
   * Ensures deterministic idempotency, customer notification generation,
   * Admin Notification Center record creation, and server-side WhatsApp dispatch.
   */
  async fireStoreEvent(input: FireStoreEventInput): Promise<string | null> {
    if (!db) {
      console.warn('Database not ready, skipping store event notification.');
      return null;
    }

    const { eventType, payload = {}, titleOverride, messageOverride, customerUid, forceRetry = false } = input;

    // 1. Generate deterministic event ID to prevent duplicate processing
    let deterministicId = input.eventId;
    if (!deterministicId) {
      if (eventType === 'NEW_ORDER' && payload.orderId) {
        deterministicId = `order_new_${payload.orderId}`;
      } else if (eventType === 'ORDER_STATUS_CHANGED' && payload.orderId) {
        deterministicId = `order_status_${payload.orderId}_${payload.status}`;
      } else if (eventType === 'ORDER_CANCELLED' && payload.orderId) {
        deterministicId = `order_cancelled_${payload.orderId}`;
      } else if (eventType === 'LOW_STOCK' && payload.productId) {
        deterministicId = `stock_low_${payload.productId}_${payload.stock}`;
      } else if (eventType === 'OUT_OF_STOCK' && payload.productId) {
        deterministicId = `stock_out_${payload.productId}`;
      } else if (eventType === 'RESTOCKED' && payload.productId) {
        deterministicId = `stock_restock_${payload.productId}_${Date.now()}`;
      } else if (eventType === 'NEW_CUSTOMER' && payload.customerUid) {
        deterministicId = `customer_new_${payload.customerUid}`;
      } else if (eventType === 'COUPON_USED' && payload.orderId && payload.couponCode) {
        deterministicId = `coupon_${payload.orderId}_${payload.couponCode}`;
      } else {
        deterministicId = `event_${eventType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    }

    try {
      const adminNotifRef = doc(db, 'admin_notifications', deterministicId);

      // 2. Idempotency Check (Duplicate Prevention)
      if (!forceRetry) {
        try {
          const existingSnap = await getDoc(adminNotifRef);
          if (existingSnap.exists()) {
            console.log(`[Notification Engine] Skipping duplicate event ${deterministicId}`);
            return deterministicId;
          }
        } catch (getErr) {
          // If caller lacks read permissions (e.g. unauthenticated guest), proceed with setDoc
        }
      }

      // 3. Render Title, Message, Priority, and Related Links
      const template = buildNotificationContent(eventType, payload);
      const title = titleOverride || template.title;
      const message = messageOverride || template.message;
      const priority = template.priority;
      const relatedType = template.relatedType;
      const relatedId = template.relatedId || payload.orderId || payload.productId || payload.customerUid;

      // 4. Load Store Settings for WhatsApp Toggles & Recipient Phone
      let settings: StoreSettings | null = null;
      try {
        settings = await settingsService.getSettings();
      } catch (err) {
        console.warn('Could not load store settings for notifications:', err);
      }

      const isWhatsappEnabledGlobally = settings?.whatsappNotificationsEnabled ?? true;
      const eventToggleEnabled = settings?.whatsappToggles?.[eventType] ?? true;
      const recipientPhone = settings?.whatsappRecipientPhone || settings?.whatsappNumber || '';

      let initialWhatsappStatus: WhatsAppDeliveryStatus = 'not_configured';
      if (!isWhatsappEnabledGlobally || !eventToggleEnabled) {
        initialWhatsappStatus = 'disabled';
      } else {
        initialWhatsappStatus = 'pending';
      }

      // 5. Construct & Save Admin Notification to Firestore
      const createdAt = new Date().toISOString();
      const adminNotificationData: Record<string, any> = {
        id: deterministicId,
        eventType,
        title,
        message,
        priority,
        createdAt,
        read: false,
        whatsappStatus: initialWhatsappStatus,
        payload: {
          storeName: settings?.storeName || 'المتجر',
          orderId: payload.orderId,
          total: payload.total,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          productName: payload.productName
        }
      };

      if (relatedType) {
        adminNotificationData.relatedType = relatedType;
      }
      if (relatedId) {
        adminNotificationData.relatedId = relatedId;
      }

      const sanitizedPayload = sanitizeForFirestore(adminNotificationData);
      await setDoc(adminNotifRef, sanitizedPayload, { merge: true });

      // 6. Create Customer Notification (if applicable)
      const targetCustomerUid = customerUid || payload.customerUid;
      if (targetCustomerUid && targetCustomerUid !== 'guest' && ['NEW_ORDER', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED'].includes(eventType)) {
        try {
          const { notificationService } = await import('./notificationService');
          const orderId = payload.orderId || relatedId;
          const status = (eventType === 'NEW_ORDER' ? 'new' : (eventType === 'ORDER_CANCELLED' ? 'cancelled' : (payload.status || 'confirmed'))) as OrderStatus;
          const total = payload.total;

          await notificationService.sendCustomerOrderNotification(targetCustomerUid, orderId, status, total);
        } catch (custErr) {
          console.warn('[Notification Engine] Customer notification dispatch error:', custErr);
        }
      }

      // 7. Dispatch to Server-Side WhatsApp Integration (if enabled)
      if (initialWhatsappStatus === 'pending') {
        this.dispatchWhatsAppNotification(adminNotificationData, recipientPhone).catch(err => {
          console.warn('WhatsApp background dispatch error:', err);
        });
      }

      return deterministicId;
    } catch (error) {
      console.error('Fatal error in notification engine fireStoreEvent:', error);
      // Never throw error so calling business operations (checkout, order update) complete successfully
      return null;
    }
  },

  /**
   * Internal helper to dispatch event to server-side WhatsApp handler
   */
  async dispatchWhatsAppNotification(event: AdminStoreNotification, recipientPhone: string): Promise<void> {
    if (!db || !event.id) return;
    const adminNotifRef = doc(db, 'admin_notifications', event.id);

    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      
      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          event,
          recipientPhone
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        await updateDoc(adminNotifRef, {
          whatsappStatus: 'sent',
          whatsappError: ''
        });
      } else {
        const finalStatus: WhatsAppDeliveryStatus = data.whatsappStatus === 'not_configured' ? 'not_configured' : 'failed';
        await updateDoc(adminNotifRef, {
          whatsappStatus: finalStatus,
          whatsappError: data.error || data.message || 'فشل تسليم الرسالة عبر مزود خدمة واتساب'
        });
      }
    } catch (err: any) {
      await updateDoc(adminNotifRef, {
        whatsappStatus: 'failed',
        whatsappError: err?.message || 'تعذر الاتصال بخادم إشعارات واتساب'
      }).catch(() => {});
    }
  },

  /**
   * Real-time subscription for Admin Notifications (Centralized Singleton Pattern).
   * Ensures strictly ONE active Firestore onSnapshot listener across the entire application,
   * completely eliminates duplicate listeners, prevents infinite reconnect loops,
   * accurately classifies errors, and provides a graceful polling fallback.
   */
  subscribeToAdminNotifications(callback: (notifications: AdminStoreNotification[]) => void): () => void {
    if (pipelineTeardownTimer) {
      clearTimeout(pipelineTeardownTimer);
      pipelineTeardownTimer = null;
    }

    adminSubscribers.add(callback);

    // Immediately deliver cached notifications if available so the UI never flashes empty
    if (cachedAdminNotifications.length > 0) {
      try {
        callback(cachedAdminNotifications);
      } catch (e) {
        console.warn('[Notification Engine] Error in initial subscriber callback:', e);
      }
    }

    // If this is the first active subscriber, start the centralized pipeline
    if (adminSubscribers.size === 1 && !activeSnapshotUnsubscribe && !pollingIntervalTimer) {
      startAdminNotificationPipeline();
    }

    // Return clean unsubscription function
    return () => {
      adminSubscribers.delete(callback);
      // When the last subscriber unmounts, cleanly tear down the pipeline with grace period
      if (adminSubscribers.size === 0) {
        if (pipelineTeardownTimer) clearTimeout(pipelineTeardownTimer);
        pipelineTeardownTimer = setTimeout(() => {
          if (adminSubscribers.size === 0) {
            stopAdminNotificationPipeline();
          }
        }, 500);
      }
    };
  },

  /**
   * Explicitly refresh admin notifications on demand
   */
  async refreshAdminNotifications(): Promise<void> {
    await fetchAdminNotificationsOnce(pipelineSessionId);
  },

  /**
   * Mark a single admin notification as read
   */
  async markAsRead(id: string): Promise<void> {
    if (!db || !id) return;
    // Optimistically update memory cache & UI immediately
    const updated = cachedAdminNotifications.map(n => n.id === id ? { ...n, read: true } : n);
    broadcastAdminNotifications(updated);

    const ref = doc(db, 'admin_notifications', id);
    await updateDoc(ref, { read: true }).catch(err => {
      console.warn('[Notification Engine] Failed to update read status:', err);
    });
  },

  /**
   * Mark all admin notifications as read
   */
  async markAllAsRead(): Promise<void> {
    if (!db) return;
    // Optimistically update memory cache & UI immediately
    const updated = cachedAdminNotifications.map(n => ({ ...n, read: true }));
    broadcastAdminNotifications(updated);

    const colRef = collection(db, 'admin_notifications');
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);

    snapshot.forEach(d => {
      if (!d.data().read) {
        batch.update(d.ref, { read: true });
      }
    });

    await batch.commit().catch(err => {
      console.warn('[Notification Engine] Failed to mark all as read:', err);
    });
  },

  /**
   * Delete an admin notification
   */
  async deleteNotification(id: string): Promise<void> {
    if (!db || !id) return;
    // Optimistically update memory cache & UI immediately
    const updated = cachedAdminNotifications.filter(n => n.id !== id);
    broadcastAdminNotifications(updated);

    const ref = doc(db, 'admin_notifications', id);
    await deleteDoc(ref).catch(err => {
      console.warn('[Notification Engine] Failed to delete notification:', err);
    });
  },

  /**
   * Clear all read admin notifications
   */
  async clearReadNotifications(): Promise<void> {
    if (!db) return;
    // Optimistically update memory cache & UI immediately
    const updated = cachedAdminNotifications.filter(n => !n.read);
    broadcastAdminNotifications(updated);

    const colRef = collection(db, 'admin_notifications');
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);

    snapshot.forEach(d => {
      if (d.data().read) {
        batch.delete(d.ref);
      }
    });

    await batch.commit().catch(err => {
      console.warn('[Notification Engine] Failed to clear read notifications:', err);
    });
  },

  /**
   * Retry sending WhatsApp notification for an existing notification record
   */
  async retryWhatsAppNotification(id: string): Promise<boolean> {
    if (!db || !id) return false;
    const ref = doc(db, 'admin_notifications', id);
    const snap = await getDoc(ref);

    if (!snap.exists()) return false;
    const notification = snap.data() as AdminStoreNotification;

    await updateDoc(ref, {
      whatsappStatus: 'pending',
      whatsappError: ''
    });

    let settings: StoreSettings | null = null;
    try {
      settings = await settingsService.getSettings();
    } catch {}

    const recipientPhone = settings?.whatsappRecipientPhone || settings?.whatsappNumber || '';
    await this.dispatchWhatsAppNotification({ ...notification, id }, recipientPhone);

    const updatedSnap = await getDoc(ref);
    return updatedSnap.data()?.whatsappStatus === 'sent';
  },

  /**
   * Check server WhatsApp API status
   */
  async checkWhatsAppServerStatus(): Promise<{ configured: boolean; providerStatus: string; message: string }> {
    try {
      const res = await fetch('/api/notifications/whatsapp/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to check WhatsApp server status:', e);
    }
    return {
      configured: false,
      providerStatus: 'not_configured',
      message: 'تعذر الاتصال بمركز خادم واتساب'
    };
  }
};
