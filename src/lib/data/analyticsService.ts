import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AnalyticsEvent, AnalyticsEventType } from '../../types';
import { sanitizeForFirestore } from '../firestoreUtils';

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

export const analyticsService = {
  /**
   * Track an interaction event.
   * Ensures data is sanitized and failures do not interrupt the UI.
   */
  async trackEvent(
    eventType: AnalyticsEventType, 
    data: { productId?: string; categoryId?: string; userUid?: string; metadata?: any } = {}
  ) {
    if (!db) return;
    
    try {
      const rawEvent: Omit<AnalyticsEvent, 'id'> = {
        eventType,
        productId: data.productId,
        categoryId: data.categoryId,
        userUid: data.userUid,
        sessionId: getSessionId(),
        timestamp: new Date().toISOString(),
        metadata: data.metadata || {}
      };

      // Sanitize the entire event object recursively
      const sanitizedEvent = sanitizeForFirestore(rawEvent);

      await addDoc(collection(db, 'analytics_events'), sanitizedEvent);
    } catch (err) {
      // Isolate analytics failures from the rest of the application
      const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
      if (isDev) {
        console.warn(`[Analytics] Failed to track event "${eventType}":`, err);
      }
    }
  },

  /**
   * Fetch events within a date range (Admin only).
   */
  async getEventsByRange(startDate: Date, endDate: Date): Promise<AnalyticsEvent[]> {
    if (!db) return [];
    try {
      const q = query(
        collection(db, 'analytics_events'),
        where('timestamp', '>=', startDate.toISOString()),
        where('timestamp', '<=', endDate.toISOString()),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AnalyticsEvent));
    } catch (err) {
      console.error('Error fetching analytics events:', err);
      return [];
    }
  }
};
