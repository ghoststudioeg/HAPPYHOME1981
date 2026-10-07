import { supabaseDb } from './supabaseDb';
import { AnalyticsEvent, AnalyticsEventType } from '../../types';

const SESSION_KEY = 'store_session_id';

function getSessionId() {
  if (typeof window === 'undefined') return 'server_session';
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Client-side allowed analytics events (order_complete is SERVER-ONLY)
const CLIENT_ALLOWED_EVENTS = [
  'page_view',
  'product_view',
  'bundle_click',
  'company_click',
  'whatsapp_click',
  'add_to_cart',
  'checkout_start'
];

export const analyticsService = {
  /**
   * Track an interaction event.
   * Client-side allows standard events, order_complete is blocked on client and tracked server-side.
   */
  async trackEvent(
    eventType: AnalyticsEventType | string, 
    data: { productId?: string; categoryId?: string; userUid?: string; metadata?: any } = {},
    isServer = false
  ) {
    // Prohibit order_complete on client-side
    if (!isServer && eventType === 'order_complete') {
      console.warn('[Analytics] "order_complete" is server-only and cannot be triggered from client-side.');
      return;
    }

    if (!isServer && !CLIENT_ALLOWED_EVENTS.includes(eventType as string)) {
      return;
    }

    try {
      const rawEvent: Omit<AnalyticsEvent, 'id'> = {
        eventType: eventType as AnalyticsEventType,
        productId: data.productId,
        categoryId: data.categoryId,
        userUid: data.userUid,
        sessionId: getSessionId(),
        timestamp: new Date().toISOString(),
        metadata: data.metadata || {}
      };

      const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await supabaseDb.setDoc('analytics_events', id, rawEvent);
    } catch (err) {
      console.warn(`[Analytics] Failed to track event "${eventType}":`, err);
    }
  },

  /**
   * Fetch events within a date range (Admin only).
   */
  async getEventsByRange(startDate: Date, endDate: Date): Promise<AnalyticsEvent[]> {
    try {
      const allEvents = await supabaseDb.getCollection<AnalyticsEvent>('analytics_events');
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      return allEvents
        .filter((e) => e.timestamp >= startIso && e.timestamp <= endIso)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      console.error('Error fetching analytics events from Supabase:', err);
      return [];
    }
  }
};
