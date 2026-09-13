import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, 
  Check, 
  BellOff, 
  ExternalLink, 
  Package, 
  ShoppingBag, 
  Tag, 
  Info, 
  X, 
  Truck, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  TrendingDown, 
  Clock, 
  Trash2,
  CheckCheck,
  PackageCheck,
  Megaphone,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { notificationService } from '../lib/notificationService';
import { Notification, NotificationType } from '../types';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationBellProps {
  navigate: (path: string) => void;
}

function formatRelativeTimeArabic(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'الآن';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    
    return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getNotificationBadge(type: NotificationType, isDark: boolean) {
  if (isDark) {
    switch (type) {
      case 'order_created':
        return { label: 'طلب جديد', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'order_confirmed':
        return { label: 'تم التأكيد', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'order_preparing':
        return { label: 'جاري التجهيز', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
      case 'order_ready_to_ship':
        return { label: 'جاهز للشحن', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'order_shipped':
        return { label: 'تم الشحن', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
      case 'order_delivered':
        return { label: 'تم التسليم', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'order_cancelled':
        return { label: 'ملغي', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'order_status_changed':
        return { label: 'حالة الطلب', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'payment_received':
        return { label: 'تم الدفع', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'payment_pending':
        return { label: 'بانتظار الدفع', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'payment_failed':
        return { label: 'تعذر الدفع', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'product_back_in_stock':
        return { label: 'توفر مجدداً', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'favorite_product_discount':
      case 'favorite_price_drop':
        return { label: 'خصم المفضلة', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'coupon':
        return { label: 'كوبون خصم', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'admin_announcement':
        return { label: 'تنويه المتجر', color: 'text-[#E0B84A] bg-[#D4AF37]/10 border-[#D4AF37]/30' };
      default:
        return { label: 'إشعار', color: 'text-[#94A3B8] bg-white/[0.05] border-white/[0.1]' };
    }
  } else {
    // Light mode - high-contrast readable text
    switch (type) {
      case 'order_created':
        return { label: 'طلب جديد', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'order_confirmed':
        return { label: 'تم التأكيد', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'order_preparing':
        return { label: 'جاري التجهيز', color: 'text-sky-700 bg-sky-50 border-sky-200' };
      case 'order_ready_to_ship':
        return { label: 'جاهز للشحن', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      case 'order_shipped':
        return { label: 'تم الشحن', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
      case 'order_delivered':
        return { label: 'تم التسليم', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'order_cancelled':
        return { label: 'ملغي', color: 'text-rose-700 bg-rose-50 border-rose-200' };
      case 'order_status_changed':
        return { label: 'حالة الطلب', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      case 'payment_received':
        return { label: 'تم الدفع', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'payment_pending':
        return { label: 'بانتظار الدفع', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'payment_failed':
        return { label: 'تعذر الدفع', color: 'text-rose-700 bg-rose-50 border-rose-200' };
      case 'product_back_in_stock':
        return { label: 'توفر مجدداً', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'favorite_product_discount':
      case 'favorite_price_drop':
        return { label: 'خصم المفضلة', color: 'text-rose-700 bg-rose-50 border-rose-200' };
      case 'coupon':
        return { label: 'كوبون خصم', color: 'text-purple-700 bg-purple-50 border-purple-200' };
      case 'admin_announcement':
        return { label: 'تنويه المتجر', color: 'text-[#8A6B10] bg-[#D4AF37]/10 border-[#D4AF37]/35' };
      default:
        return { label: 'إشعار', color: 'text-slate-600 bg-slate-100 border-slate-200' };
    }
  }
}

function getNotificationIcon(type: NotificationType, isDark: boolean) {
  if (isDark) {
    switch (type) {
      case 'order_created':
        return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
      case 'order_confirmed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'order_preparing':
        return <Package className="w-4 h-4 text-sky-400" />;
      case 'order_ready_to_ship':
        return <PackageCheck className="w-4 h-4 text-blue-400" />;
      case 'order_shipped':
        return <Truck className="w-4 h-4 text-indigo-400" />;
      case 'order_delivered':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'order_cancelled':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'order_status_changed':
        return <Package className="w-4 h-4 text-blue-400" />;
      case 'payment_received':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'payment_pending':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'payment_failed':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'product_back_in_stock':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'favorite_product_discount':
        return <Flame className="w-4 h-4 text-rose-400" />;
      case 'favorite_price_drop':
        return <TrendingDown className="w-4 h-4 text-emerald-400" />;
      case 'coupon':
        return <Tag className="w-4 h-4 text-purple-400" />;
      case 'admin_announcement':
        return <Megaphone className="w-4 h-4 text-[#E0B84A]" />;
      default:
        return <Info className="w-4 h-4 text-[#D4AF37]" />;
    }
  } else {
    // Light mode - darker high-contrast icons
    switch (type) {
      case 'order_created':
        return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'order_confirmed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'order_preparing':
        return <Package className="w-4 h-4 text-sky-600" />;
      case 'order_ready_to_ship':
        return <PackageCheck className="w-4 h-4 text-blue-600" />;
      case 'order_shipped':
        return <Truck className="w-4 h-4 text-indigo-600" />;
      case 'order_delivered':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'order_cancelled':
        return <XCircle className="w-4 h-4 text-rose-600" />;
      case 'order_status_changed':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'payment_received':
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case 'payment_pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'payment_failed':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'product_back_in_stock':
        return <Sparkles className="w-4 h-4 text-amber-600" />;
      case 'favorite_product_discount':
        return <Flame className="w-4 h-4 text-rose-600" />;
      case 'favorite_price_drop':
        return <TrendingDown className="w-4 h-4 text-emerald-600" />;
      case 'coupon':
        return <Tag className="w-4 h-4 text-purple-600" />;
      case 'admin_announcement':
        return <Megaphone className="w-4 h-4 text-[#B38F1E]" />;
      default:
        return <Info className="w-4 h-4 text-[#D4AF37]" />;
    }
  }
}

export function NotificationBell({ navigate }: NotificationBellProps) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 380 });

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const panelWidth = Math.min(380, vw - 24);
      
      // Calculate ideal left position for RTL
      let left = rect.left;
      if (left + panelWidth > vw - 12) {
        left = vw - panelWidth - 12;
      }
      if (left < 12) {
        left = 12;
      }

      setCoords({
        top: rect.bottom + 8,
        left: left,
        width: panelWidth
      });
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }

    const unsubscribe = notificationService.subscribeToNotifications(user.uid, (data) => {
      setNotifications(data);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayedNotifications = filterMode === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications;

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    await notificationService.markAsRead(user.uid, id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    await notificationService.deleteNotification(user.uid, id);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await notificationService.markAllAsRead(user.uid);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!user) return;
    
    if (!notification.read) {
      await notificationService.markAsRead(user.uid, notification.notificationId);
    }

    if (notification.relatedId && notification.relatedType) {
      if (notification.relatedType === 'order') {
        navigate(`/profile?tab=orders&orderId=${notification.relatedId}`);
      } else if (notification.relatedType === 'product') {
        navigate(`/product/${notification.relatedId}`);
      }
    }
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl glass-pill flex items-center justify-center text-[#94A3B8] hover:text-[#E0B84A] border border-white/[0.08] hover:border-[#D4AF37]/30 transition-all cursor-pointer active:scale-95 shrink-0"
        title="التنبيهات والإشعارات"
        aria-label="مركز إشعارات العميل"
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-md border border-[#050B14] animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[1000] pointer-events-auto">
            {/* Dark backdrop overlay on mobile */}
            <div
              className="fixed inset-0 bg-black/40 sm:bg-transparent backdrop-blur-[2px] sm:backdrop-blur-none"
              onClick={() => setIsOpen(false)}
            />

            <AnimatePresence>
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: 'calc(85vh - 60px)',
                }}
                className={`${
                  isDark 
                    ? 'glass-panel-elevated shadow-[0_20px_60px_rgba(0,0,0,0.85)] border-[#D4AF37]/30 liquid-reflection' 
                    : 'bg-white shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-slate-200/80'
                } rounded-2xl overflow-hidden flex flex-col z-[1001] transition-all duration-200`}
              >
                {/* Header */}
                <div className={`p-3.5 border-b flex items-center justify-between transition-colors duration-200 ${
                  isDark 
                    ? 'bg-[#07111C]/90 border-white/[0.08]' 
                    : 'bg-slate-50 border-slate-200/60'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                      isDark 
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30' 
                        : 'bg-[#D4AF37]/10 border-[#D4AF37]/20'
                    }`}>
                      <Bell className="w-3.5 h-3.5 text-[#E0B84A]" />
                    </div>
                    <div>
                      <h3 className={`text-xs sm:text-sm font-black transition-colors ${isDark ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>الإشعارات</h3>
                      {unreadCount > 0 && (
                        <p className="text-[10px] text-[#E0B84A] font-bold">
                          {unreadCount} غير مقروء
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                          isDark 
                            ? 'bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border-[#D4AF37]/25 text-[#E0B84A]' 
                            : 'bg-[#D4AF37]/8 hover:bg-[#D4AF37]/15 border-[#D4AF37]/20 text-[#8A6B10]'
                        }`}
                        title="تحديد الكل كمقروء"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>تحديد الكل</span>
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                        isDark 
                          ? 'glass-pill text-[#94A3B8] hover:text-white hover:bg-white/[0.08]' 
                          : 'bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'
                      }`}
                      aria-label="إغلاق"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className={`flex items-center px-3 py-2 border-b gap-1.5 transition-colors duration-200 ${
                  isDark 
                    ? 'bg-[#091424]/90 border-white/[0.06]' 
                    : 'bg-slate-50/50 border-slate-200/60'
                }`}>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterMode === 'all'
                        ? isDark
                          ? 'bg-[#D4AF37]/20 text-[#E0B84A] border border-[#D4AF37]/30'
                          : 'bg-[#D4AF37]/15 text-[#8A6B10] border border-[#D4AF37]/30'
                        : isDark
                          ? 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    الكل ({notifications.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('unread')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      filterMode === 'unread'
                        ? isDark
                          ? 'bg-[#D4AF37]/20 text-[#E0B84A] border border-[#D4AF37]/30'
                          : 'bg-[#D4AF37]/15 text-[#8A6B10] border border-[#D4AF37]/30'
                        : isDark
                          ? 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>غير المقروءة</span>
                    {unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Notifications List */}
                <div className={`flex-1 overflow-y-auto custom-scrollbar transition-colors duration-200 ${
                  isDark 
                    ? 'divide-y divide-white/[0.04] bg-[#05080D]/95' 
                    : 'divide-y divide-slate-100 bg-white'
                }`}>
                  {displayedNotifications.length === 0 ? (
                    <div className="py-12 px-4 text-center space-y-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto transition-colors ${
                        isDark 
                          ? 'bg-white/[0.03] border border-white/[0.06] text-[#94A3B8]' 
                          : 'bg-slate-100 border border-slate-200/80 text-slate-400'
                      }`}>
                        <BellOff className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className={`text-xs font-bold transition-colors ${isDark ? 'text-[#F8FAFC]' : 'text-slate-800'}`}>
                          {filterMode === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات حالياً'}
                        </p>
                        <p className={`text-[10px] transition-colors ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          {filterMode === 'unread' ? 'لقد اطلعت على جميع التحديثات بنجاح' : 'ستظهر هنا تحديثات طلباتك والعروض المخصصة'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    displayedNotifications.map((notif) => {
                      const badge = getNotificationBadge(notif.type, isDark);
                      return (
                        <div
                          key={notif.notificationId}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3 sm:p-3.5 transition-colors cursor-pointer relative group flex gap-3 transition-colors duration-150 ${
                            notif.read 
                              ? isDark
                                ? 'bg-transparent opacity-80 hover:opacity-100 hover:bg-white/[0.02]' 
                                : 'bg-white hover:bg-slate-50/60'
                              : isDark
                                ? 'bg-[#D4AF37]/[0.05] hover:bg-[#D4AF37]/[0.09] border-r-2 border-[#D4AF37]'
                                : 'bg-[#D4AF37]/[0.06] hover:bg-[#D4AF37]/[0.10] border-r-2 border-[#D4AF37]'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border transition-colors ${
                            notif.read 
                              ? isDark 
                                ? 'bg-white/[0.02] border-white/[0.05]' 
                                : 'bg-slate-100 border-slate-200/80' 
                              : isDark
                                ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30'
                                : 'bg-[#D4AF37]/15 border-[#D4AF37]/40'
                          }`}>
                            {getNotificationIcon(notif.type, isDark)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-[9px] text-[#64748B]">
                                {formatRelativeTimeArabic(notif.createdAt)}
                              </span>
                            </div>
                            <h4 className={`text-xs font-bold mb-0.5 transition-colors line-clamp-1 ${
                              isDark ? 'text-[#F8FAFC] group-hover:text-[#E0B84A]' : 'text-slate-900 group-hover:text-[#B38F1E]'
                            }`}>
                              {notif.title}
                            </h4>
                            <p className={`text-[11px] leading-relaxed line-clamp-2 transition-colors ${
                              isDark ? 'text-[#94A3B8]' : 'text-slate-600'
                            }`}>
                              {notif.message}
                            </p>
                            
                            <div className="mt-2 flex items-center justify-between gap-2">
                              {notif.relatedId ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold hover:underline transition-colors ${
                                  isDark ? 'text-[#E0B84A]' : 'text-[#B38F1E]'
                                }`}>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>{notif.relatedType === 'order' ? 'عرض تفاصيل الطلب' : 'عرض المنتج'}</span>
                                </span>
                              ) : <span />}

                              {/* Action buttons */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!notif.read && (
                                  <button
                                    onClick={(e) => handleMarkAsRead(e, notif.notificationId)}
                                    className={`p-1 rounded-md transition-colors ${
                                      isDark 
                                        ? 'text-[#94A3B8] hover:text-[#E0B84A] hover:bg-white/[0.05]' 
                                        : 'text-slate-500 hover:text-[#B38F1E] hover:bg-slate-100'
                                    }`}
                                    title="تحديد كمقروء"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleDelete(e, notif.notificationId)}
                                  className={`p-1 rounded-md transition-colors ${
                                    isDark 
                                      ? 'text-[#94A3B8] hover:text-rose-400 hover:bg-rose-500/10' 
                                      : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                  }`}
                                  title="حذف الإشعار"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {!notif.read && (
                            <div className="shrink-0 flex items-center">
                              <div className={`w-2 h-2 rounded-full ${
                                isDark 
                                  ? 'bg-[#E0B84A] shadow-[0_0_8px_rgba(224,184,74,0.6)]' 
                                  : 'bg-[#B38F1E] shadow-[0_0_6px_rgba(179,143,30,0.4)]'
                              }`} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Link to Profile Notifications Tab */}
                <div className={`p-2.5 border-t flex items-center justify-between px-4 transition-colors duration-200 ${
                  isDark 
                    ? 'bg-[#07111C]/90 border-white/[0.08]' 
                    : 'bg-slate-50 border-slate-200/60'
                }`}>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/profile?tab=notifications');
                    }}
                    className={`text-[11px] font-black transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isDark ? 'text-[#F8FAFC] hover:text-[#E0B84A]' : 'text-slate-800 hover:text-[#B38F1E]'
                    }`}
                  >
                    <span>مركز الإشعارات الكامل</span>
                    <ExternalLink className="w-3 h-3 text-[#D4AF37]" />
                  </button>
                  <span className={`text-[10px] transition-colors ${isDark ? 'text-[#64748B]' : 'text-slate-500'}`}>
                    {notifications.length} إشعار
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>,
          document.body
        )}
    </div>
  );
}
