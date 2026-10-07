import { supabaseDb } from './supabaseDb';
import { AuditLog } from '../../types';

export const auditService = {
  async logAction(action: string, entityType: string, entityId?: string, details?: any): Promise<void> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const log: any = {
      id,
      action,
      entityType: entityType as any,
      entityId: entityId || '',
      details: details || {},
      timestamp: new Date().toISOString()
    };
    try {
      await supabaseDb.setDoc('audit_logs', id, log);
    } catch {}
  },

  async recordAuditLog(payload: any): Promise<void> {
    await this.logAction(payload.action || 'UPDATE', payload.entityType || 'system', payload.entityId, payload);
  },

  async getAuditLogs(arg1?: any, arg2?: any, arg3?: any): Promise<{ logs: AuditLog[]; lastDoc: any; hasMore: boolean }> {
    try {
      let limitCount = 25;
      let lastDoc: any = null;
      let filters: any = {};

      if (typeof arg1 === 'number') {
        limitCount = arg1;
        lastDoc = arg2;
        filters = arg3 || {};
      } else if (typeof arg1 === 'object' && arg1 !== null) {
        filters = arg1;
        limitCount = typeof arg2 === 'number' ? arg2 : 25;
        lastDoc = arg3;
      }

      const logs = await supabaseDb.getCollection<AuditLog>('audit_logs');
      let filtered = [...logs];

      if (filters.entityType && filters.entityType !== 'all') {
        filtered = filtered.filter(l => String(l.entityType) === String(filters.entityType));
      }
      if (filters.action) {
        filtered = filtered.filter(l => String(l.action) === String(filters.action));
      }
      if (filters.startDate) {
        filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= new Date(filters.startDate).getTime());
      }
      if (filters.endDate) {
        filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= new Date(filters.endDate).getTime());
      }

      const sorted = filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return { logs: sorted.slice(0, limitCount), lastDoc: null, hasMore: sorted.length > limitCount };
    } catch {
      return { logs: [], lastDoc: null, hasMore: false };
    }
  }
};
