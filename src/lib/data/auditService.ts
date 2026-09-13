import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { sanitizeForFirestore } from '../firestoreUtils';
import { AuditLogEntry, AuditAction, AuditEntityType, AuditLogFilters } from '../../types';

const COLLECTION_NAME = 'audit_logs';

/**
 * Strips sensitive keys like passwords, secret keys, tokens before saving to audit history.
 */
function sanitizeAuditPayload(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeAuditPayload(item));

  const sensitiveKeywords = [
    'password',
    'token',
    'secret',
    'apikey',
    'servicerole',
    'privatekey',
    'credential',
    'auth'
  ];

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = sensitiveKeywords.some(kw => key.toLowerCase().includes(kw));
    if (isSensitive) {
      sanitized[key] = '[حساس / محمي]';
    } else if (val && typeof val === 'object' && !(val instanceof Date) && typeof (val as any).toDate !== 'function') {
      sanitized[key] = sanitizeAuditPayload(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export interface RecordAuditParams {
  action: AuditAction | string;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  customSummary?: string;
  adminInfo?: {
    uid: string;
    email: string;
    displayName?: string;
  };
}

export const auditService = {
  /**
   * Appends a new immutable audit log record to Firestore.
   */
  async recordAuditLog(params: RecordAuditParams): Promise<string | null> {
    if (!db) {
      console.warn('Firestore database unavailable for audit log recording.');
      return null;
    }

    try {
      const currentUser = auth?.currentUser;
      const adminUid = params.adminInfo?.uid || currentUser?.uid || 'admin_system';
      const adminEmail = params.adminInfo?.email || currentUser?.email || 'admin@store.com';
      const adminName = params.adminInfo?.displayName || currentUser?.displayName || adminEmail.split('@')[0] || 'المشرف';

      const colRef = collection(db, COLLECTION_NAME);
      const newDocRef = doc(colRef);

      const beforeSanitized = params.before ? sanitizeAuditPayload(params.before) : null;
      const afterSanitized = params.after ? sanitizeAuditPayload(params.after) : null;

      // Auto-generate human readable Arabic summary if not provided
      const summary = params.customSummary || this.generateSummary(params);

      const logPayload = sanitizeForFirestore({
        eventId: newDocRef.id,
        adminUid,
        adminEmail,
        adminName,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName || '',
        before: beforeSanitized,
        after: afterSanitized,
        summary,
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      await setDoc(newDocRef, logPayload);
      return newDocRef.id;
    } catch (error) {
      console.error('Failed to record audit log:', error);
      // Audit log recording failure should not break primary admin flow
      return null;
    }
  },

  /**
   * Generates localized Arabic summaries for common admin events.
   */
  generateSummary(params: RecordAuditParams): string {
    const { action, entityType, entityName, before, after } = params;
    const nameStr = entityName || params.entityId;

    switch (action) {
      case 'PRODUCT_CREATED':
        return `تم إنشاء منتج جديد: "${nameStr}"`;
      case 'PRODUCT_EDITED':
        return `تم تعديل بيانات المنتج: "${nameStr}"`;
      case 'PRODUCT_DELETED':
        return `تم حذف المنتج: "${nameStr}"`;
      case 'PRODUCT_PRICE_CHANGED': {
        const oldP = before?.price !== undefined ? `${before.price} جنيه` : '';
        const newP = after?.price !== undefined ? `${after.price} جنيه` : '';
        return `تم تعديل سعر "${nameStr}"${oldP && newP ? ` (من ${oldP} إلى ${newP})` : ''}`;
      }
      case 'PRODUCT_STOCK_CHANGED': {
        const oldS = before?.stockQuantity !== undefined ? before.stockQuantity : '';
        const newS = after?.stockQuantity !== undefined ? after.stockQuantity : '';
        return `تم تعديل مخزون المنتج "${nameStr}"${oldS !== '' && newS !== '' ? ` (من ${oldS} إلى ${newS})` : ''}`;
      }
      case 'PRODUCT_PUBLISHED_TOGGLED': {
        const isPub = after?.isPublished;
        return isPub ? `تم نشر المنتج: "${nameStr}"` : `تم إخفاء/إلغاء نشر المنتج: "${nameStr}"`;
      }
      case 'CATEGORY_CREATED':
        return `تم إنشاء قسم جديد: "${nameStr}"`;
      case 'CATEGORY_EDITED':
        return `تم تعديل بيانات القسم: "${nameStr}"`;
      case 'CATEGORY_DELETED':
        return `تم حذف القسم: "${nameStr}"`;
      case 'BANNER_CREATED':
        return `تم إضافة بنر رئيسي جديد: "${nameStr}"`;
      case 'BANNER_EDITED':
        return `تم تعديل البنر الرئيسي: "${nameStr}"`;
      case 'BANNER_DELETED':
        return `تم حذف البنر الرئيسي: "${nameStr}"`;
      case 'PROMOTION_CREATED':
        return `تم إنشاء عرض ترويجي جديد: "${nameStr}"`;
      case 'PROMOTION_EDITED':
        return `تم تعديل العرض الترويجي: "${nameStr}"`;
      case 'PROMOTION_DELETED':
        return `تم حذف العرض الترويجي: "${nameStr}"`;
      case 'ORDER_STATUS_CHANGED': {
        const oldSt = before?.status || before?.orderStatus;
        const newSt = after?.status || after?.orderStatus;
        return `تم تغيير حالة الطلب #${nameStr}${oldSt && newSt ? ` من (${oldSt}) إلى (${newSt})` : ''}`;
      }
      case 'ORDER_PAYMENT_CONFIRMED':
        return `تم تأكيد استلام دفع الطلب #${nameStr}`;
      case 'COUPON_CREATED':
        return `تم إنشاء كارت خصم جديد: "${nameStr}"`;
      case 'COUPON_EDITED':
        return `تم تعديل كارت الخصم: "${nameStr}"`;
      case 'COUPON_DELETED':
        return `تم حذف كارت الخصم: "${nameStr}"`;
      case 'SETTINGS_CHANGED':
        return `تم تحديث إعدادات المتجر العامة`;
      default:
        return `تم تنفيذ إجراء (${action}) على ${entityType}: "${nameStr}"`;
    }
  },

  /**
   * Fetches paginated audit logs with optional filtering.
   */
  async getAuditLogs(
    filters?: AuditLogFilters,
    pageSize = 20,
    lastSnap?: QueryDocumentSnapshot<DocumentData> | null
  ): Promise<{
    logs: AuditLogEntry[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات.');

    try {
      const colRef = collection(db, COLLECTION_NAME);
      const constraints: any[] = [];

      // Filter by entityType if specified
      if (filters?.entityType && filters.entityType !== 'all') {
        constraints.push(where('entityType', '==', filters.entityType));
      }

      // Order newest first
      constraints.push(orderBy('timestamp', 'desc'));
      constraints.push(limit(pageSize + 1));

      if (lastSnap) {
        constraints.push(startAfter(lastSnap));
      }

      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);

      const docs = snapshot.docs;
      const hasMore = docs.length > pageSize;
      const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

      let logs: AuditLogEntry[] = pageDocs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          eventId: data.eventId || docSnap.id,
          adminUid: data.adminUid || '',
          adminEmail: data.adminEmail || 'مشرف',
          adminName: data.adminName || data.adminEmail || 'مشرف النظام',
          action: data.action || 'UNKNOWN',
          entityType: data.entityType || 'product',
          entityId: data.entityId || '',
          entityName: data.entityName || '',
          timestamp: data.timestamp || new Date().toISOString(),
          before: data.before || null,
          after: data.after || null,
          summary: data.summary || 'تغيير في النظام'
        };
      });

      // Local client-side filters for search, adminEmail, and date range
      if (filters) {
        if (filters.adminEmail && filters.adminEmail !== 'all') {
          const targetEmail = filters.adminEmail.toLowerCase();
          logs = logs.filter(l => l.adminEmail?.toLowerCase().includes(targetEmail));
        }

        if (filters.action && filters.action !== 'all') {
          logs = logs.filter(l => l.action === filters.action);
        }

        if (filters.search && filters.search.trim() !== '') {
          const term = filters.search.trim().toLowerCase();
          logs = logs.filter(l =>
            l.summary?.toLowerCase().includes(term) ||
            l.entityName?.toLowerCase().includes(term) ||
            l.entityId?.toLowerCase().includes(term) ||
            l.adminEmail?.toLowerCase().includes(term) ||
            l.action?.toLowerCase().includes(term)
          );
        }

        if (filters.startDate) {
          const startMs = new Date(filters.startDate).getTime();
          logs = logs.filter(l => new Date(l.timestamp).getTime() >= startMs);
        }

        if (filters.endDate) {
          // Set to end of day
          const endMs = new Date(filters.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          logs = logs.filter(l => new Date(l.timestamp).getTime() <= endMs);
        }
      }

      const nextLastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

      return {
        logs,
        lastDoc: nextLastDoc,
        hasMore
      };
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      throw new Error(error?.message || 'تعذر جلب سجل التغييرات.');
    }
  }
};
