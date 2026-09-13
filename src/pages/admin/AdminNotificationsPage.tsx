import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/authContext';
import {
  Bell,
  Send,
  Users,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Tag,
  Package,
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
  UserPlus,
  ShieldAlert,
  Flame,
  CheckCheck,
  Trash2,
  ExternalLink,
  MessageCircle,
  RotateCw,
  Search,
  Filter,
  Layers
} from 'lucide-react';
import { notificationService } from '../../lib/notificationService';
import { userService } from '../../lib/data/userService';
import { notificationEngine } from '../../lib/notificationEngine';
import { UserProfileData, NotificationType, AdminStoreNotification, StoreEventType } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

export function AdminNotificationsPage({ navigate }: { navigate: (path: string) => void }) {
  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'feed' | 'broadcast'>('feed');

  // Real-Time Admin Notifications Feed State
  const [notifications, setNotifications] = useState<AdminStoreNotification[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Broadcast Announcement State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('admin_announcement');
  const [target, setTarget] = useState<'all' | 'selected'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfileData[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { loading, isAdmin } = useAuth();

  // 1. Real-time subscription to Admin Notifications
  useEffect(() => {
    if (loading || !isAdmin) return;

    const unsubscribe = notificationEngine.subscribeToAdminNotifications((data) => {
      setNotifications(data);
    });

    return () => unsubscribe();
  }, [loading, isAdmin]);

  // 2. Load users for broadcast targeting
  useEffect(() => {
    if (loading || !isAdmin) return;

    async function loadUsers() {
      try {
        const users = await userService.getAllUsers();
        setAllUsers(users);
      } catch (e) {
        console.error('Failed to load users:', e);
      }
    }
    loadUsers();
  }, [loading, isAdmin]);

  // Handlers for Feed Actions
  const handleMarkAllAsRead = async () => {
    try {
      await notificationEngine.markAllAsRead();
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const handleClearRead = async () => {
    try {
      await notificationEngine.clearReadNotifications();
    } catch (e) {
      console.error('Failed to clear read notifications:', e);
    }
  };

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    try {
      if (!currentRead) {
        await notificationEngine.markAsRead(id);
      }
    } catch (e) {
      console.error('Failed to toggle read status:', e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationEngine.deleteNotification(id);
    } catch (e) {
      console.error('Failed to delete notification:', e);
    }
  };

  const handleRetryWhatsApp = async (id: string) => {
    try {
      setRetryingId(id);
      const success = await notificationEngine.retryWhatsAppNotification(id);
      if (success) {
        setBroadcastStatus({ type: 'success', message: 'تمت إعادة إرسال رسالة الواتساب بنجاح!' });
        setTimeout(() => setBroadcastStatus(null), 3000);
      } else {
        setBroadcastStatus({ type: 'error', message: 'فشل إرسال رسالة الواتساب. تأكد من إعدادات المفتاح والرقم.' });
        setTimeout(() => setBroadcastStatus(null), 4000);
      }
    } catch (e: any) {
      console.error('Retry error:', e);
    } finally {
      setRetryingId(null);
    }
  };

  // Broadcast form submission
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    setBroadcastLoading(true);
    setBroadcastStatus(null);

    try {
      if (target === 'all') {
        await notificationService.createAnnouncementForAll({ title, message });
      } else {
        if (selectedUserIds.length === 0) {
          throw new Error('يجب اختيار مستخدم واحد على الأقل');
        }
        await notificationService.createAnnouncementForSelected(selectedUserIds, { title, message });
      }
      setBroadcastStatus({ type: 'success', message: 'تم إرسال التنبيهات الجماعية للعملاء بنجاح' });
      setTitle('');
      setMessage('');
      setSelectedUserIds([]);
    } catch (e: any) {
      setBroadcastStatus({ type: 'error', message: e.message || 'فشل إرسال التنبيهات' });
    } finally {
      setBroadcastLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Filtering Logic for Admin Notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchMessage = n.message.toLowerCase().includes(q);
      const matchId = n.relatedId?.toLowerCase().includes(q);
      if (!matchTitle && !matchMessage && !matchId) return false;
    }

    // 2. Event Category Filter
    if (filterType === 'unread' && n.read) return false;
    if (filterType === 'orders' && !['NEW_ORDER', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED'].includes(n.eventType)) return false;
    if (filterType === 'stock' && !['LOW_STOCK', 'OUT_OF_STOCK', 'RESTOCKED'].includes(n.eventType)) return false;
    if (filterType === 'customers' && n.eventType !== 'NEW_CUSTOMER') return false;
    if (filterType === 'marketing' && !['COUPON_USED', 'HERO_BANNER_CHANGED'].includes(n.eventType)) return false;

    // 3. Priority Filter
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;

    return true;
  });

  // Icon Resolver for Store Event Types
  const getEventIcon = (eventType: StoreEventType) => {
    switch (eventType) {
      case 'NEW_ORDER':
        return <ShoppingBag className="w-5 h-5 text-emerald-400" />;
      case 'ORDER_STATUS_CHANGED':
        return <RefreshCw className="w-5 h-5 text-sky-400" />;
      case 'ORDER_CANCELLED':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'NEW_CUSTOMER':
        return <UserPlus className="w-5 h-5 text-purple-400" />;
      case 'LOW_STOCK':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'OUT_OF_STOCK':
        return <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />;
      case 'RESTOCKED':
        return <CheckCircle className="w-5 h-5 text-teal-400" />;
      case 'COUPON_USED':
        return <Tag className="w-5 h-5 text-[#D4AF37]" />;
      case 'SYSTEM_ERROR':
        return <Flame className="w-5 h-5 text-rose-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-[var(--border)]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                <span>مركز إشعارات الأحداث والواتساب</span>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-500 text-white animate-pulse">
                    {unreadCount} جديد
                  </span>
                )}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                متابعة لحظية لجميع طلبات المتجر، تنبيهات المخزون، والعملاء وتكامل الواتساب
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'feed' ? 'broadcast' : 'feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-[#D4AF37] text-[#05080D]'
                : 'glass-panel border border-[var(--border)] text-[var(--text-primary)] hover:border-[#D4AF37]/50'
            }`}
          >
            {activeTab === 'feed' ? (
              <>
                <Send className="w-4 h-4" />
                <span>إرسال إشعار جماعي</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                <span>عرض سجّل الأحداث المباشر</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Tab Navigation */}
      {activeTab === 'feed' ? (
        <div className="space-y-5">
          {/* Controls Bar: Filters & Actions */}
          <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الطلب، اسم العميل، أو عنوان التنبيه..."
                className="w-full glass-input rounded-xl pr-10 pl-4 py-2 text-xs text-[var(--text-primary)] border border-[var(--border)] outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl overflow-x-auto">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'unread', label: `غير مقروء (${unreadCount})` },
                { id: 'orders', label: 'الطلبات' },
                { id: 'stock', label: 'المخزون' },
                { id: 'customers', label: 'العملاء' },
                { id: 'marketing', label: 'العروض' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    filterType === f.id
                      ? 'bg-[#D4AF37] text-[#05080D]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                onClick={handleMarkAllAsRead}
                title="تحديد الكل كمقروء"
                className="px-3 py-2 rounded-xl text-xs font-bold glass-panel border border-[var(--border)] text-[var(--text-secondary)] hover:text-emerald-500 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">تحديد الكل كُمقروء</span>
              </button>

              <button
                onClick={handleClearRead}
                title="حذف المقروء"
                className="px-3 py-2 rounded-xl text-xs font-bold glass-panel border border-[var(--border)] text-[var(--text-secondary)] hover:text-rose-500 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">تنظيف المقروء</span>
              </button>
            </div>
          </div>

          {/* Notifications Feed List */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="glass-panel p-12 rounded-2xl border border-[var(--border)] text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-secondary)]">
                  <Bell className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)]">لا توجد إشعارات مطابقة حالياً</p>
                <p className="text-xs text-[var(--text-secondary)]">سيتم تسجيل وتنبيه أي حدث جديد يحدث في المتجر تلقائياً هنا.</p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredNotifications.map((n) => (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`glass-panel p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      !n.read 
                        ? 'bg-gradient-to-r from-[#D4AF37]/15 via-transparent to-transparent border-[#D4AF37]/40 shadow-sm' 
                        : 'border-[var(--border)] opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Event Icon */}
                      <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] shrink-0 mt-0.5 sm:mt-0">
                        {getEventIcon(n.eventType)}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`text-xs sm:text-sm font-bold ${!n.read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            {n.title}
                          </h3>

                          {/* Priority Badge */}
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            n.priority === 'critical' ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' :
                            n.priority === 'high' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                          }`}>
                            {n.priority === 'critical' ? 'حرج' : n.priority === 'high' ? 'مهم' : 'عادي'}
                          </span>

                          {/* WhatsApp Delivery Status Badge */}
                          {n.whatsappStatus && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${
                              n.whatsappStatus === 'sent' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                              n.whatsappStatus === 'failed' ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' :
                              n.whatsappStatus === 'pending' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
                              'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                            }`}>
                              <MessageCircle className="w-3 h-3" />
                              <span>
                                {n.whatsappStatus === 'sent' && 'تم إرسال الواتساب'}
                                {n.whatsappStatus === 'failed' && 'فشل إرسال الواتساب'}
                                {n.whatsappStatus === 'pending' && 'جاري الإرسال عبر الواتساب...'}
                                {n.whatsappStatus === 'not_configured' && 'الواتساب غير مُكوّن'}
                                {n.whatsappStatus === 'disabled' && 'الواتساب معطل'}
                              </span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                          {n.message}
                        </p>

                        {/* Relative Timestamp */}
                        <div className="flex items-center gap-2 pt-1 text-[10px] text-[var(--text-secondary)]">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(n.createdAt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          {n.relatedId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[#D4AF37]">مُعرف: #{n.relatedId.slice(-8).toUpperCase()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls for Single Notification */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Retry WhatsApp button if failed */}
                      {(n.whatsappStatus === 'failed' || n.whatsappStatus === 'not_configured') && (
                        <button
                          onClick={() => handleRetryWhatsApp(n.id)}
                          disabled={retryingId === n.id}
                          title="إعادة المحاولة عبر الواتساب"
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <RotateCw className={`w-3 h-3 ${retryingId === n.id ? 'animate-spin' : ''}`} />
                          <span>إعادة إرسال</span>
                        </button>
                      )}

                      {/* Read Toggle */}
                      <button
                        onClick={() => handleToggleRead(n.id, n.read)}
                        title={n.read ? 'مقروء' : 'تحديد كـ مقروء'}
                        className={`p-2 rounded-xl transition-all ${
                          n.read ? 'text-[#64748B] hover:text-[#F8FAFC]' : 'text-[#D4AF37] hover:bg-[#D4AF37]/10'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>

                      {/* Delete Notification */}
                      <button
                        onClick={() => handleDelete(n.id)}
                        title="حذف الإشعار"
                        className="p-2 rounded-xl text-[#64748B] hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      ) : (
        /* Broadcast Announcements Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/[0.08]">
              <h2 className="text-lg font-bold text-[#F8FAFC] mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-[#D4AF37]" />
                <span>إرسال تنبيه جماعي مخصص للعملاء</span>
              </h2>

              <form onSubmit={handleSendBroadcast} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#94A3B8] mr-1">نوع التنبيه</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as NotificationType)}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm text-[#F8FAFC]"
                    >
                      <option value="admin_announcement">إعلان إداري عام</option>
                      <option value="coupon">قسيمة تخفيض</option>
                      <option value="favorite_product_discount">خصم على المفضلة</option>
                      <option value="product_back_in_stock">توفر منتج</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#94A3B8] mr-1">الجمهور المستهدف</label>
                    <div className="flex gap-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setTarget('all')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          target === 'all' ? 'bg-[#D4AF37] text-[#05080D]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        كل العملاء ({allUsers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTarget('selected')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          target === 'selected' ? 'bg-[#D4AF37] text-[#05080D]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        عملاء محددين ({selectedUserIds.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#94A3B8] mr-1">عنوان التنبيه</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: خصم خاص 20% لفترة محدودة!"
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm text-[#F8FAFC]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#94A3B8] mr-1">نص الرسالة</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب تفاصيل الإشعار هنا..."
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm min-h-[120px] text-[#F8FAFC]"
                    required
                  />
                </div>

                {target === 'selected' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#94A3B8] mr-1">اختر العملاء ({selectedUserIds.length})</label>
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="text-[10px] text-rose-400 font-bold hover:underline"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 glass-panel-inner rounded-xl">
                      {allUsers.filter(u => u.role !== 'admin').map(u => (
                        <div
                          key={u.uid}
                          onClick={() => toggleUserSelection(u.uid)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                            selectedUserIds.includes(u.uid)
                              ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#E0B84A]'
                              : 'bg-white/[0.02] border-white/[0.05] text-[#94A3B8] hover:border-white/[0.1]'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 opacity-70" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold truncate">{u.displayName || 'عميل مجهول'}</p>
                            <p className="text-[9px] opacity-60 truncate">{u.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {broadcastStatus && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                    broadcastStatus.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  }`}>
                    {broadcastStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <p className="text-xs font-bold">{broadcastStatus.message}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={broadcastLoading || !title || !message}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-sm flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(212,175,55,0.2)] disabled:opacity-50 disabled:grayscale transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {broadcastLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#05080D]/30 border-t-[#05080D] rounded-full animate-spin" />
                      <span>جاري الإرسال للعملاء...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال التنبيه الجماعي الآن</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-2xl border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-black text-[#F8FAFC] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>إحصائيات الإشعارات</span>
              </h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <p className="text-[10px] font-bold text-[#94A3B8] mb-1">إجمالي العملاء المسجلين</p>
                  <p className="text-xl font-black text-[#F8FAFC]">{allUsers.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <p className="text-[10px] font-bold text-[#94A3B8] mb-1">إجمالي أحداث المتجر المسجلة</p>
                  <p className="text-xl font-black text-[#D4AF37]">{notifications.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
