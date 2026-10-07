import { supabaseDb } from './data/supabaseDb';
import { AdminStoreNotification, StoreEventType, WhatsAppDeliveryStatus } from '../types';
import { buildNotificationContent, NotificationTemplatePayload } from './notifications/templates';

export interface FireStoreEventInput {
  eventId?: string;
  eventType: StoreEventType;
  payload?: NotificationTemplatePayload;
  titleOverride?: string;
  messageOverride?: string;
  customerUid?: string;
  forceRetry?: boolean;
}

export const notificationEngine = {
  async triggerStoreEvent(input: FireStoreEventInput): Promise<{ adminNotificationId: string | null; success: boolean }> {
    try {
      const rendered = buildNotificationContent(input.eventType, input.payload || {});
      const id = input.eventId || `adm_notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const notification: AdminStoreNotification = {
        id,
        eventType: input.eventType,
        title: input.titleOverride || rendered.title,
        message: input.messageOverride || rendered.message,
        read: false,
        createdAt: new Date().toISOString(),
        priority: rendered.priority || 'medium',
        relatedId: rendered.relatedId,
        relatedType: rendered.relatedType,
        payload: input.payload || {}
      };

      await supabaseDb.setDoc('admin_notifications', id, notification);
      return { adminNotificationId: id, success: true };
    } catch {
      return { adminNotificationId: null, success: false };
    }
  },

  async getAdminNotifications(): Promise<AdminStoreNotification[]> {
    try {
      const list = await supabaseDb.getCollection<AdminStoreNotification>('admin_notifications');
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  },

  async markAsRead(id: string): Promise<void> {
    await supabaseDb.updateDoc('admin_notifications', id, { read: true });
  },

  async markAllAsRead(): Promise<void> {
    const list = await this.getAdminNotifications();
    for (const item of list) {
      if (!item.read) {
        await supabaseDb.updateDoc('admin_notifications', item.id, { read: true });
      }
    }
  },

  async deleteNotification(id: string): Promise<void> {
    await supabaseDb.deleteDoc('admin_notifications', id);
  },

  subscribeToAdminNotifications(callback: (notifications: AdminStoreNotification[]) => void): () => void {
    let active = true;
    const poll = async () => {
      if (!active) return;
      const list = await this.getAdminNotifications();
      if (active) callback(list);
    };

    poll();
    const interval = setInterval(poll, 15000); // 15s efficient polling

    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  async clearReadNotifications(): Promise<void> {
    const list = await this.getAdminNotifications();
    for (const item of list) {
      if (item.read) {
        await supabaseDb.deleteDoc('admin_notifications', item.id);
      }
    }
  },

  async retryWhatsAppNotification(id: string): Promise<boolean> {
    return true;
  }
};
