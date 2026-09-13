import React, { useEffect, useState } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  Calendar,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  Eye,
  FileCode,
  Tag,
  AlertCircle
} from 'lucide-react';
import { auditService } from '../../lib/data/auditService';
import { AuditLogEntry, AuditEntityType, AuditAction, AuditLogFilters } from '../../types';

export function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Filters state
  const [selectedEntityType, setSelectedEntityType] = useState<AuditEntityType | 'ALL'>('ALL');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminEmailFilter, setAdminEmailFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setLastDoc(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const filters: AuditLogFilters = {};
      if (selectedEntityType !== 'ALL') filters.entityType = selectedEntityType;
      if (selectedAction !== 'ALL') filters.action = selectedAction;
      if (adminEmailFilter.trim()) filters.adminEmail = adminEmailFilter.trim();
      if (startDate) filters.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end.toISOString();
      }

      const result = await auditService.getAuditLogs(
        filters,
        25,
        reset ? null : lastDoc
      );

      if (reset) {
        setLogs(result.logs);
      } else {
        setLogs(prev => [...prev, ...result.logs]);
      }

      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [selectedEntityType, selectedAction, startDate, endDate]);

  // Client-side text search filter
  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (log.summary && log.summary.toLowerCase().includes(q)) ||
      (log.entityName && log.entityName.toLowerCase().includes(q)) ||
      (log.adminEmail && log.adminEmail.toLowerCase().includes(q)) ||
      (log.entityId && log.entityId.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q))
    );
  });

  const entityTypeLabels: Record<AuditEntityType, string> = {
    product: 'المنتجات',
    category: 'الأقسام',
    banner: 'البنرات الرئيسية',
    promotion: 'العروض والفلاش سيل',
    order: 'الطلبات',
    coupon: 'كوبونات الخصم',
    settings: 'الإعدادات العامة'
  };

  const actionBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
    PRODUCT_CREATED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'إنشاء منتج' },
    PRODUCT_EDITED: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'تعديل منتج' },
    PRODUCT_DELETED: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'حذف منتج' },
    PRODUCT_PUBLISHED_TOGGLED: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', label: 'تغيير النشر' },
    PRODUCT_PRICE_CHANGED: { bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', label: 'تغيير السعر' },
    PRODUCT_STOCK_CHANGED: { bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-400', label: 'تغيير المخزون' },
    CATEGORY_CREATED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'إنشاء قسم' },
    CATEGORY_EDITED: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'تعديل قسم' },
    CATEGORY_DELETED: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'حذف قسم' },
    BANNER_CREATED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'إنشاء بنر' },
    BANNER_EDITED: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'تعديل بنر' },
    BANNER_DELETED: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'حذف بنر' },
    PROMOTION_CREATED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'إنشاء عرض' },
    PROMOTION_EDITED: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'تعديل عرض' },
    PROMOTION_DELETED: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'حذف عرض' },
    ORDER_STATUS_CHANGED: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', label: 'حالة الطلب' },
    ORDER_PAYMENT_CONFIRMED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'تأكيد الدفع' },
    COUPON_CREATED: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'إنشاء كوبون' },
    COUPON_EDITED: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'تعديل كوبون' },
    COUPON_DELETED: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'حذف كوبون' },
    SETTINGS_CHANGED: { bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', label: 'تغيير الإعدادات' }
  };

  const getBadgeStyle = (action: string) => {
    return actionBadgeStyles[action] || { bg: 'bg-white/5 border-white/10', text: 'text-[#94A3B8]', label: action };
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
              <History className="w-6 h-6" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--text-primary)]">سجل التغييرات والإجراءات الإدارية</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Shield className="w-3 h-3" />
                  محمي وموثق
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                تتبع كامل وغير قابل للتعديل لجميع العمليات والتعديلات المنفذة من قبل مشرفي النظام.
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchLogs(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[#D4AF37]/40 text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50 self-start md:self-auto shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
            تحديث السجل
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] text-right">
          <Filter className="w-4 h-4" />
          <span>تصفية البحث المتقدم</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالنص، اسم العنصر أو البريد..."
              className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl pr-9 pl-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#D4AF37] transition-all"
            />
          </div>

          {/* Entity Type Filter */}
          <div>
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value as any)}
              className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37] cursor-pointer transition-all"
            >
              <option value="ALL">جميع الأقسام والعناصر</option>
              <option value="product">المنتجات</option>
              <option value="category">الأقسام</option>
              <option value="banner">البنرات الرئيسية</option>
              <option value="promotion">العروض والفلاش سيل</option>
              <option value="order">الطلبات</option>
              <option value="coupon">كوبونات الخصم</option>
              <option value="settings">الإعدادات</option>
            </select>
          </div>

          {/* Date Start */}
          <div className="flex items-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-1.5 focus-within:border-[#D4AF37] transition-all">
            <Calendar className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer text-right"
              title="من تاريخ"
            />
          </div>

          {/* Date End */}
          <div className="flex items-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-1.5 focus-within:border-[#D4AF37] transition-all">
            <Calendar className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer text-right"
              title="إلى تاريخ"
            />
          </div>
        </div>

        {(startDate || endDate || selectedEntityType !== 'ALL' || searchQuery) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setSelectedEntityType('ALL');
                setSelectedAction('ALL');
                setSearchQuery('');
                setAdminEmailFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-[#D4AF37] hover:text-[#E0B84A] font-bold transition-colors cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
          </div>
        )}
      </div>

      {/* Audit Logs Table / Cards */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-[var(--text-muted)] space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#D4AF37]" />
            <p className="text-xs font-semibold">جاري تحميل سجل العمليات الإدارية...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)] space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto opacity-20" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">لا توجد سجلات مطابقة للبحث</p>
            <p className="text-xs text-[var(--text-muted)]">لم يتم تسجيل أي عمليات وفقاً للخيارات المحددة.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredLogs.map((entry) => {
              const badge = getBadgeStyle(entry.action);
              return (
                <div
                  key={entry.eventId || entry.id}
                  className="p-4 hover:bg-[var(--surface-elevated)]/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-right"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Action Badge */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-sm ${badge.bg.replace(' emerald-400', ' emerald-500').replace(' blue-400', ' blue-500').replace(' red-400', ' red-500').replace(' amber-400', ' amber-500').replace(' purple-400', ' purple-500').replace(' indigo-400', ' indigo-500')} ${badge.text.replace(' emerald-400', ' emerald-500').replace(' blue-400', ' blue-500').replace(' red-400', ' red-500').replace(' amber-400', ' amber-500').replace(' purple-400', ' purple-500').replace(' indigo-400', ' indigo-500')}`}>
                        <Tag className="w-3 h-3" />
                        {badge.label}
                      </span>

                      {/* Entity Type Tag */}
                      <span className="px-2 py-0.5 rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)] text-[11px] shadow-sm">
                        {entityTypeLabels[entry.entityType] || entry.entityType}
                      </span>

                      {/* Admin email */}
                      <span className="flex items-center gap-1 text-[var(--text-muted)] text-[11px]">
                        <UserCheck className="w-3 h-3 text-[#D4AF37]" />
                        {entry.adminEmail || 'مشرف النظام'}
                      </span>

                      {/* Timestamp */}
                      <span className="flex items-center gap-1 text-[var(--text-muted)] text-[11px]">
                        <Clock className="w-3 h-3 opacity-50" />
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>

                    {/* Event Summary */}
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {entry.summary || entry.entityName || 'تغيير في النظام'}
                    </p>

                    {/* Entity Details snippet */}
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span>العنصر: <strong className="text-[var(--text-primary)]">{entry.entityName || '—'}</strong></span>
                      {entry.entityId && (
                        <span className="text-[10px] font-mono bg-[var(--surface-elevated)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)] shadow-sm">
                          ID: {entry.entityId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* View Details Button */}
                  {(entry.before || entry.after) && (
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[#D4AF37]/30 text-xs font-semibold text-[var(--text-primary)] hover:text-[#D4AF37] transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      معاينة التغييرات
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="p-4 border-t border-[var(--border)] text-center bg-[var(--surface-elevated)]/20">
            <button
              onClick={() => fetchLogs(false)}
              disabled={loadingMore}
              className="px-6 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[#D4AF37]/40 text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
            >
              {loadingMore ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                  جاري تحميل المزيد...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-[#D4AF37]" />
                  تحميل المزيد من السجلات
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Changes Modal / Drawer */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] w-full max-w-2xl rounded-2xl border border-[var(--border)] p-6 space-y-5 my-8 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">تفاصيل التغييرات</h3>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p><strong className="text-[var(--text-muted)]">العملية:</strong> <span className="text-[var(--text-primary)]">{selectedEntry.summary}</span></p>
              <p><strong className="text-[var(--text-muted)]">المشرف:</strong> <span className="text-[#D4AF37] font-bold">{selectedEntry.adminEmail}</span></p>
              <p><strong className="text-[var(--text-muted)]">التاريخ والوقت:</strong> <span className="text-[var(--text-primary)]">{formatDate(selectedEntry.timestamp)}</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before state */}
              <div className="space-y-2 text-right">
                <span className="text-xs font-bold text-rose-500 block">قبل التعديل (Before)</span>
                <pre className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-60 leading-relaxed text-left shadow-inner custom-scrollbar">
                  {selectedEntry.before ? JSON.stringify(selectedEntry.before, null, 2) : 'null (لا يوجد بيانات سابقة)'}
                </pre>
              </div>

              {/* After state */}
              <div className="space-y-2 text-right">
                <span className="text-xs font-bold text-emerald-500 block">بعد التعديل (After)</span>
                <pre className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 overflow-x-auto max-h-60 leading-relaxed text-left shadow-inner custom-scrollbar">
                  {selectedEntry.after ? JSON.stringify(selectedEntry.after, null, 2) : 'null (تم الحذف)'}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-6 py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
