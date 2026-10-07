import { supabaseDb } from './data/supabaseDb';
import { Notification, NotificationType, RelatedType } from '../types';

export const notificationService = {
  async createNotification(userId: string, data: {
    type: NotificationType;
    title: string;
    message: string;
    relatedId?: string;
    relatedType?: RelatedType;
  }): Promise<string | null> {
    if (!userId || userId === 'guest') return null;

    try {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const notification: Notification = {
        id,
        notificationId: id,
        userUid: userId,
        user_uid: userId,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        createdAt: new Date().toISOString(),
        ...(data.relatedId ? { relatedId: data.relatedId } : {}),
        ...(data.relatedType ? { relatedType: data.relatedType } : {})
      };

      await supabaseDb.setDoc('user_notifications', id, notification);
      return id;
    } catch {
      return null;
    }
  },

  async getUserNotifications(userId: string): Promise<Notification[]> {
    if (!userId || userId === 'guest') return [];
    try {
      const all = await supabaseDb.getCollection<Notification>('user_notifications');
      return all
        .filter((n) => n.userUid === userId || (n as any).user_uid === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  },

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    if (!userId || !notificationId) return;
    await supabaseDb.updateDoc('user_notifications', notificationId, { read: true });
  },

  async markAllAsRead(userId: string): Promise<void> {
    if (!userId) return;
    const notifications = await this.getUserNotifications(userId);
    for (const n of notifications) {
      if (!n.read) {
        await supabaseDb.updateDoc('user_notifications', n.id, { read: true });
      }
    }
  },

  subscribeToCustomerNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    let active = true;
    const poll = async () => {
      if (!active) return;
      const list = await this.getUserNotifications(userId);
      if (active) callback(list);
    };

    poll();
    const interval = setInterval(poll, 15000); // Efficient polling every 15s

    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    return this.subscribeToCustomerNotifications(userId, callback);
  },

  async createAnnouncementForAll(data: { title: string; message: string; relatedId?: string; relatedType?: RelatedType }): Promise<void> {
    const users = await supabaseDb.getCollection<any>('users');
    for (const u of users) {
      const uid = u.uid || u.id;
      if (uid) {
        await this.createNotification(uid, {
          type: 'ANNOUNCEMENT' as NotificationType,
          title: data.title,
          message: data.message,
          relatedId: data.relatedId,
          relatedType: data.relatedType
        });
      }
    }
  },

  async createAnnouncementForSelected(userUids: string[], data: { title: string; message: string; relatedId?: string; relatedType?: RelatedType }): Promise<void> {
    for (const uid of userUids) {
      await this.createNotification(uid, {
        type: 'ANNOUNCEMENT' as NotificationType,
        title: data.title,
        message: data.message,
        relatedId: data.relatedId,
        relatedType: data.relatedType
      });
    }
  },

  async clearAllNotifications(userId: string): Promise<void> {
    const notifications = await this.getUserNotifications(userId);
    for (const n of notifications) {
      await supabaseDb.deleteDoc('user_notifications', n.id);
    }
  },

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await supabaseDb.deleteDoc('user_notifications', notificationId);
  }
};
