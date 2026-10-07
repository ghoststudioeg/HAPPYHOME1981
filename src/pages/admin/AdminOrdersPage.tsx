import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useEffect, useState, useCallback } from 'react';
import { orderService, isValidOrderStatusTransition } from '../../lib/data/orderService';
import { settingsService } from '../../lib/data/settingsService';
import { Order, OrderStatus, StoreSettings } from '../../types';
import { InvoiceModal, openWhatsAppInvoice, getInvoiceNumber } from '../../components/InvoiceModal';
import {

  Search,
  Calendar,
  X,
  Eye,
  RefreshCw,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  User,
  Copy,
  FileText,
  Truck,
  DollarSign,
  Clock,
  ChevronDown,
  Loader2,
  CheckCircle,
  Package,
  XOctagon,
  MessageCircle,
  Printer,
  Download,
  Share2
} from 'lucide-react';

const orderStatusLabels: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'تم التأكيد',
  preparing: 'جاري التجهيز',
  ready_to_ship: 'جاهز للشحن',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي'
};

const orderStatusColors: Record<OrderStatus, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  preparing: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ready_to_ship: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  shipped: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  delivered: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  cancelled: 'bg-rose-500/10 text-rose-500 border-rose-500/20'
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  paid: 'تم الدفع',
  failed: 'فشل الدفع',
  cancelled: 'ملغي'
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  failed: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  cancelled: 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border)]'
};

// Available status steps in standard pipeline
const statusSteps: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSetStatusFilter = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(window.location.search);
    if (status && status !== 'all') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleSetStartDate = (val: string) => {
    setStartDate(val);
    const params = new URLSearchParams(window.location.search);
    if (val) {
      params.set('start', val);
    } else {
      params.delete('start');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleSetEndDate = (val: string) => {
    setEndDate(val);
    const params = new URLSearchParams(window.location.search);
    if (val) {
      params.set('end', val);
    } else {
      params.delete('end');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedOrders = await orderService.getOrders(100);
      setOrders(fetchedOrders);
    } catch (err) {
      console.warn('Could not fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch orders & store settings on mount + sync URL params
  useEffect(() => {
    fetchOrders();

    settingsService.getSettings().then(setStoreSettings).catch(e => {
      console.warn('Could not fetch store settings for orders page:', e);
    });

    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
    const startParam = params.get('start');
    if (startParam) {
      setStartDate(startParam);
    }
    const endParam = params.get('end');
    if (endParam) {
      setEndDate(endParam);
    }
  }, [fetchOrders]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`تم نسخ ${label} إلى الحافظة.`);
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingStatus(true);
    try {
      await orderService.updateOrderStatus(orderId, nextStatus);
      triggerToast(`تم تحديث حالة الطلب إلى "${orderStatusLabels[nextStatus]}" بنجاح.`);
      
      // Update the active modal view details in real-time with updated statusHistory
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => {
          if (!prev) return null;
          const currentHist = Array.isArray(prev.statusHistory) ? prev.statusHistory : [];
          const now = new Date().toISOString();
          
          // Generate a local mockup of status notes from the backend logic
          const statusNotes: Record<OrderStatus, string> = {
            new: 'تم استلام طلبك بنجاح وهو قيد المراجعة الآن.',
            confirmed: 'تم تأكيد طلبك ومراجعته من قبل إدارة المتجر.',
            preparing: 'بدأ فريقنا في تجهيز وتعبئة طلبك بعناية فائقة.',
            ready_to_ship: 'تم الانتهاء من التجهيز والطلب جاهز للتسليم لشركة الشحن.',
            shipped: 'تم شحن طلبك وتسليمه لشركة الشحن وهو في طريقه إليك الآن.',
            delivered: 'تم تسليم الطلب إليك بنجاح. شكراً لثقتك بنا!',
            cancelled: 'تم إلغاء الطلب بالكامل وإعادة المنتجات إلى المخزون.'
          };

          return {
            ...prev,
            orderStatus: nextStatus,
            updatedAt: now,
            statusHistory: [
              ...currentHist,
              {
                status: nextStatus,
                timestamp: now,
                note: statusNotes[nextStatus] || '',
                updatedBy: 'admin'
              }
            ]
          };
        });
      }
    } catch (err: any) {
      console.error('Failed to update status:', err);
      const errMsg = err?.message || '';
      if (errMsg.includes('لا يمكن تعديل')) {
        triggerToast(errMsg);
      } else {
        triggerToast('حدث خطأ أثناء تحديث حالة الطلب: ' + (err?.message || 'يرجى المحاولة لاحقاً.'));
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, nextPaymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled') => {
    setUpdatingStatus(true);
    try {
      await orderService.updateOrderPaymentStatus(orderId, nextPaymentStatus);
      triggerToast(`تم تحديث حالة الدفع إلى "${paymentStatusLabels[nextPaymentStatus] || nextPaymentStatus}" بنجاح.`);
      
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => {
          if (!prev) return null;
          const currentHist = Array.isArray(prev.statusHistory) ? prev.statusHistory : [];
          const now = new Date().toISOString();
          return {
            ...prev,
            paymentStatus: nextPaymentStatus,
            updatedAt: now,
            statusHistory: [
              ...currentHist,
              {
                status: prev.orderStatus || 'new',
                timestamp: now,
                note: `تم تحديث حالة الدفع إلى [${paymentStatusLabels[nextPaymentStatus] || nextPaymentStatus}] من قبل الإدارة.`,
                updatedBy: 'admin'
              }
            ]
          };
        });
      }
    } catch (err: any) {
      console.error('Failed to update payment status:', err);
      triggerToast('حدث خطأ أثناء تحديث حالة الدفع: ' + (err?.message || 'يرجى المحاولة لاحقاً.'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filter and Search Logic
  const filteredOrders = orders.filter((order) => {
    // 1. Text Search matches: order ID, invoice number, customer name, phone, or email
    const searchLower = searchTerm.toLowerCase().trim();
    const invNum = getInvoiceNumber(order).toLowerCase();
    const idMatches = order.id.toLowerCase().includes(searchLower) || order.id.slice(-6).toLowerCase().includes(searchLower);
    const invMatches = invNum.includes(searchLower);
    const nameMatches = order.customerName.toLowerCase().includes(searchLower);
    const phoneMatches = order.customerPhone.includes(searchLower);
    const emailMatches = order.customerEmail.toLowerCase().includes(searchLower);
    const textMatches = searchTerm === '' || idMatches || invMatches || nameMatches || phoneMatches || emailMatches;

    // 2. Status matches
    let statusMatches = true;
    if (statusFilter === 'active') {
      statusMatches = order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered';
    } else if (statusFilter !== 'all') {
      statusMatches = order.orderStatus === statusFilter;
    }

    // 3. Payment Status matches
    const paymentMatches = paymentStatusFilter === 'all' || order.paymentStatus === paymentStatusFilter;

    // 4. Date matches
    let dateMatches = true;
    if (order.createdAt) {
      const orderDateStr = order.createdAt.split('T')[0]; // YYYY-MM-DD
      if (startDate && orderDateStr < startDate) {
        dateMatches = false;
      }
      if (endDate && orderDateStr > endDate) {
        dateMatches = false;
      }
    }

    return textMatches && statusMatches && paymentMatches && dateMatches;
  });

  // Analytics snapshots
  const activeOrdersCount = orders.filter(o => o.orderStatus !== 'cancelled' && o.orderStatus !== 'delivered').length;
  const newOrdersCount = orders.filter(o => o.orderStatus === 'new').length;
  const totalRevenue = orders
    .filter(o => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6" dir="rtl">
      {/* Top Banner Alert Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-3 shadow-2xl animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">إدارة الطلبات 🛒</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">متابعة ومعالجة مبيعات وحالات طلبات المتجر في الوقت الفعلي</p>
        </div>
      </div>

      {/* Analytics Counter strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">الطلبات النشطة</span>
            <span className="text-xl sm:text-2xl font-black text-[var(--text-primary)] block">{activeOrdersCount} طلب</span>
          </div>
          <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">طلبات جديدة معلقة</span>
            <span className="text-xl sm:text-2xl font-black text-amber-500 block">{newOrdersCount} طلب</span>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] flex items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">المبيعات المعتمدة</span>
            <span className="text-xl sm:text-2xl font-black text-[#D4AF37] block">{totalRevenue.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search section */}
      <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Searching customer details */}
          <div className="md:col-span-2 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم الطلب، اسم العميل، الهاتف، أو البريد الإلكتروني..."
              className="w-full h-11 pr-11 pl-4 rounded-xl bg-[var(--surface-elevated)] focus:bg-[var(--surface)] border border-[var(--border)] focus:border-[#D4AF37]/50 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] transition-all"
            />
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-4 top-1/2 -translate-y-1/2" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Start Date filter */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleSetStartDate(e.target.value)}
              className="w-full h-11 pr-11 pl-4 rounded-xl bg-[var(--surface-elevated)] focus:bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none transition-all"
              title="تاريخ البداية"
            />
            <Calendar className="w-4 h-4 text-[var(--text-muted)] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            {startDate && (
              <button
                onClick={() => handleSetStartDate('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* End Date filter */}
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleSetEndDate(e.target.value)}
              className="w-full h-11 pr-11 pl-4 rounded-xl bg-[var(--surface-elevated)] focus:bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none transition-all"
              title="تاريخ النهاية"
            />
            <Calendar className="w-4 h-4 text-[var(--text-muted)] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            {endDate && (
              <button
                onClick={() => handleSetEndDate('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Horizontal scrollable Status selection row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <span className="text-[10px] font-bold text-[var(--text-muted)] ml-2">فلترة حسب الحالة:</span>
          <button
            onClick={() => handleSetStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm'
            }`}
          >
            الكل ({orders.length})
          </button>
          <button
            onClick={() => handleSetStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm'
            }`}
          >
            تحت التنفيذ ({orders.filter(o => o.orderStatus !== 'cancelled' && o.orderStatus !== 'delivered').length})
          </button>
          {statusSteps.map((status) => {
            const count = orders.filter(o => o.orderStatus === status).length;
            return (
              <button
                key={status}
                onClick={() => handleSetStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  statusFilter === status
                    ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                    : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm'
                }`}
              >
                {orderStatusLabels[status]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List Table / Grid */}
      {loading ? (
        <div className="p-16 text-center text-[var(--text-secondary)] space-y-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto" />
          <p className="text-xs">جاري تحميل ومزامنة سجل طلبات الشراء...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 text-center text-[var(--text-muted)] space-y-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="w-12 h-12 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <Package className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-[var(--text-primary)]">لم نجد أي طلبات تتطابق مع بحثك وفلاترك.</p>
            <p className="text-[11px] text-[var(--text-muted)]">تأكد من اختيار نطاق تاريخ صحيح أو تصفية الحالات.</p>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border)] text-[var(--text-secondary)] font-bold">
                <tr>
                  <th className="px-5 py-4">المرجع / المعرف</th>
                  <th className="px-5 py-4">العميل</th>
                  <th className="px-5 py-4">العنوان</th>
                  <th className="px-5 py-4">التاريخ</th>
                  <th className="px-5 py-4 text-center">حالة الطلب</th>
                  <th className="px-5 py-4 text-left">قيمة الطلب</th>
                  <th className="px-5 py-4 text-center">خيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredOrders.map((order) => {
                  const dateObj = new Date(order.createdAt);
                  const formattedDate = dateObj.toLocaleDateString('ar-EG', {
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <tr key={order.id} className="hover:bg-[var(--surface-elevated)]/60 transition-colors">
                      {/* ID */}
                      <td className="px-5 py-4 font-mono font-bold text-[var(--text-primary)]">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>

                      {/* Customer info */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-[var(--text-primary)]">{order.customerName}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">{order.customerPhone}</div>
                      </td>

                      {/* Shipping Address */}
                      <td className="px-5 py-4 max-w-[200px] truncate text-[var(--text-secondary)]" title={order.shippingAddress}>
                        {order.shippingAddress}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-[var(--text-muted)]">
                        {formattedDate}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${orderStatusColors[order.orderStatus] || ''}`}>
                          {orderStatusLabels[order.orderStatus] || order.orderStatus}
                        </span>
                      </td>

                      {/* Total cost */}
                      <td className="px-5 py-4 text-left font-black text-[#D4AF37] font-mono">
                        {order.total.toLocaleString('ar-EG')} ج.م
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] border border-[var(--border)] transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]"
                            title="التفاصيل وتحديث الحالة"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">التفاصيل</span>
                          </button>

                          <button
                            onClick={() => setInvoiceOrder(order)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] border border-amber-500/30 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                            title="عرض وطباعة الفاتورة"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">الفاتورة</span>
                          </button>

                          <button
                            onClick={() => openWhatsAppInvoice(order, storeSettings || undefined)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                            title="إرسال رابط الفاتورة عبر واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">واتساب</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal / Drawer overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface-elevated)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-sm">
                  <Package className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">
                    معالجة طلب رقم: #{selectedOrder.id.slice(-8).toUpperCase()}
                  </h3>
                  <div className="flex items-center gap-2 text-[9.5px] text-[var(--text-muted)] mt-0.5">
                    <span>تاريخ الإضافة: {new Date(selectedOrder.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-xl border border-transparent hover:border-[var(--border)] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

             {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right custom-scrollbar">
              {/* Status Update Control Section */}
              <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide">
                    <RefreshCw className="w-4 h-4" />
                    <span>تحديث حالة الطلب</span>
                  </h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${orderStatusColors[selectedOrder.orderStatus] || ''}`}>
                    الحالة الحالية: {orderStatusLabels[selectedOrder.orderStatus] || selectedOrder.orderStatus}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {statusSteps.map((status) => {
                    const isActive = selectedOrder.orderStatus === status;
                    if (status === 'cancelled') return null;

                    const isValid = isValidOrderStatusTransition(selectedOrder.orderStatus, status);

                    return (
                      <button
                        key={status}
                        disabled={updatingStatus || isActive || !isValid}
                        onClick={() => handleUpdateStatus(selectedOrder.id, status)}
                        title={!isValid ? `لا يمكن الانتقال مباشرة من ${orderStatusLabels[selectedOrder.orderStatus]} إلى ${orderStatusLabels[status]}` : ''}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          isActive
                            ? 'bg-[#D4AF37]/25 border-[#D4AF37]/50 text-[#D4AF37]'
                            : isValid
                            ? 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[#D4AF37]/40 hover:text-[var(--text-primary)] shadow-sm'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)] opacity-40'
                        }`}
                      >
                        {orderStatusLabels[status]}
                      </button>
                    );
                  })}
                </div>

                {/* Cancellation row */}
                {isValidOrderStatusTransition(selectedOrder.orderStatus, 'cancelled') && selectedOrder.orderStatus !== 'cancelled' && (
                  <div className="pt-2 border-t border-[var(--border)] flex justify-end">
                    <button
                      disabled={updatingStatus}
                      onClick={() => {
                        if (confirm('هل أنت متأكد من رغبتك في إلغاء هذا الطلب بالكامل؟')) {
                          handleUpdateStatus(selectedOrder.id, 'cancelled');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <XOctagon className="w-3.5 h-3.5" />
                      <span>إلغاء الطلب بالكامل</span>
                    </button>
                  </div>
                )}

                {/* Real-time Status History Timeline */}
                {Array.isArray(selectedOrder.statusHistory) && selectedOrder.statusHistory.length > 0 && (
                  <div className="pt-4 border-t border-[var(--border)] space-y-3">
                    <h5 className="text-[10px] font-black text-[var(--text-secondary)] flex items-center gap-1.5 uppercase tracking-wide">
                      <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>سجل تتبع الحالات الزمني للطلب (Status History Log)</span>
                    </h5>
                    <div className="relative pr-4 border-r border-[var(--border)] space-y-4">
                      {selectedOrder.statusHistory.map((hist, index) => {
                        const dateStr = new Date(hist.timestamp).toLocaleString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        return (
                          <div key={index} className="relative">
                            {/* Dot indicator */}
                            <div className="absolute -right-[21px] top-1.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37] ring-4 ring-[var(--surface)]" />
                            <div className="text-xs">
                              <span className="font-bold text-[var(--text-primary)]">
                                {orderStatusLabels[hist.status] || hist.status}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] mr-2">
                                {dateStr} • بواسطة {hist.updatedBy === 'admin' ? 'الإدارة' : 'النظام'}
                              </span>
                              {hist.note && (
                                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                                  {hist.note}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Administrative Payment Verification Card */}
              <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide">
                    <DollarSign className="w-4 h-4" />
                    <span>تأكيد استلام الدفع (Payment Verification)</span>
                  </h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${paymentStatusColors[selectedOrder.paymentStatus || 'pending'] || ''}`}>
                    حالة الدفع: {paymentStatusLabels[selectedOrder.paymentStatus || 'pending'] || (selectedOrder.paymentStatus || 'قيد الانتظار')}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  طريقة الدفع المحددة: <strong className="text-[var(--text-primary)]">{selectedOrder.paymentMethod === 'pay_now' ? 'الدفع الآن (تحويل)' : 'الدفع نقدًا عند الاستلام'}</strong>
                </p>

                <div className="flex flex-wrap gap-2 pt-1.5">
                  {['pending', 'paid', 'failed', 'cancelled'].map((payStatus) => {
                    const isActive = (selectedOrder.paymentStatus || 'pending') === payStatus;
                    return (
                      <button
                        key={payStatus}
                        disabled={updatingStatus || isActive}
                        onClick={() => handleUpdatePaymentStatus(selectedOrder.id, payStatus as any)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                          isActive
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {paymentStatusLabels[payStatus] || payStatus}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Profile info card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3 shadow-sm">
                  <h4 className="text-[11px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide border-b border-[var(--border)] pb-2">
                    <User className="w-4 h-4" />
                    <span>بيانات العميل الشخصية</span>
                  </h4>
                  <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                    <div className="flex justify-between items-center">
                      <span>الاسم:</span>
                      <span className="font-bold text-[var(--text-primary)]">{selectedOrder.customerName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>رقم الهاتف:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[var(--text-primary)]">{selectedOrder.customerPhone}</span>
                        <button
                          onClick={() => handleCopyText(selectedOrder.customerPhone, 'رقم الهاتف')}
                          className="text-[var(--text-muted)] hover:text-[#D4AF37] transition-colors cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>البريد الإلكتروني:</span>
                      <span className="font-mono text-[var(--text-muted)]">{selectedOrder.customerEmail}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[var(--text-muted)] opacity-60">
                      <span>الرقم المعرف:</span>
                      <span className="font-mono">{selectedOrder.customerUid}</span>
                    </div>
                  </div>
                </div>

                {/* Delivery and Notes Info */}
                <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3 shadow-sm">
                  <h4 className="text-[11px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide border-b border-[var(--border)] pb-2">
                    <Truck className="w-4 h-4" />
                    <span>تفاصيل التوصيل والملاحظات</span>
                  </h4>
                  <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                    <div className="flex justify-between items-start gap-2">
                      <span className="shrink-0">العنوان:</span>
                      <span className="text-[var(--text-primary)] font-medium leading-relaxed text-left">{selectedOrder.shippingAddress}</span>
                    </div>
                    {selectedOrder.customerNotes && (
                      <div className="pt-2 border-t border-[var(--border)] space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] block">ملاحظات العميل:</span>
                        <p className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed italic">
                          {selectedOrder.customerNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ordered Products snapshot details */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide">
                  <Package className="w-4 h-4" />
                  <span>المنتجات المطلوبة في سلة العميل</span>
                </h4>

                <div className="border border-[var(--border)] rounded-2xl p-4 bg-[var(--surface-elevated)] space-y-3 shadow-sm">
                  {selectedOrder.items.map((item, idx) => {
                    const isBundle = Boolean(item.isBundle || (item.bundleItems && item.bundleItems.length > 0));
                    return (
                      <div
                        key={idx}
                        className="py-3 border-b border-[var(--border)] last:border-0 last:pb-0 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {item.productImage ? (
                              <img
                                src={getValidImageSrc(item.productImage)}
                                alt={item.productName}
                                className="w-12 h-12 rounded-xl object-contain bg-[var(--surface)] p-1 border border-[var(--border)] shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-xl shrink-0" />
                            )}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isBundle && (
                                  <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                                    عرض مركب
                                  </span>
                                )}
                                <span className="text-xs font-bold text-[var(--text-primary)] block">{item.productName}</span>
                              </div>
                              <span className="text-[11px] text-[var(--text-muted)] block">
                                الكمية: {item.quantity.toLocaleString('ar-EG')} × {item.priceAtPurchase.toLocaleString('ar-EG')} ج.م
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-[var(--text-primary)] font-mono shrink-0">
                            {(item.lineTotal || (item.priceAtPurchase * item.quantity)).toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>

                        {/* Bundle Constituent Items Breakdown */}
                        {isBundle && item.bundleItems && item.bundleItems.length > 0 && (
                          <div className="mr-6 pr-3 border-r-2 border-[#D4AF37]/40 bg-[var(--surface)]/60 rounded-lg p-2.5 space-y-1.5 text-xs">
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] block">
                              المنتجات المشمولة في هذا العرض:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {item.bundleItems.map((bi, bIdx) => (
                                <div key={bIdx} className="flex items-center gap-2">
                                  {bi.productImage && (
                                    <img
                                      src={getValidImageSrc(bi.productImage)}
                                      alt={bi.productName}
                                      className="w-6 h-6 rounded object-contain bg-black/30 p-0.5 border border-[var(--border)]"
                                    />
                                  )}
                                  <span className="text-[11px] text-[var(--text-primary)] font-semibold truncate">{bi.productName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Installment Plan Breakdown if any */}
                        {item.installmentPlan && (
                          <div className="mr-6 text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20 inline-flex items-center gap-1.5">
                            <span>💳 خطة التقسيط المعتمدة:</span>
                            <span>{item.installmentPlan.monthlyPayment.toLocaleString('ar-EG')} ج.م شهرياً × {item.installmentPlan.months} شهر ({item.installmentPlan.providerName})</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Final calculation totals */}
              <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3 max-w-sm mr-auto shadow-sm">
                <h4 className="text-[11px] font-black text-[#D4AF37] flex items-center gap-1.5 uppercase tracking-wide border-b border-[var(--border)] pb-2">
                  <DollarSign className="w-4 h-4" />
                  <span>ملخص الحساب والرسوم</span>
                </h4>
                <div className="text-xs text-[var(--text-muted)] space-y-2">
                  <div className="flex justify-between">
                    <span>قيمة المشتريات:</span>
                    <span className="text-[var(--text-primary)] font-mono">{(selectedOrder.subtotal || selectedOrder.total).toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="flex justify-between text-rose-500">
                    <span>الخصومات والتحفيز:</span>
                    <span className="font-mono">-{selectedOrder.discount.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span>تكلفة التوصيل والشحن:</span>
                    <span className="text-[var(--text-primary)] font-mono">{selectedOrder.shippingCost === 0 ? 'مجاني' : `${selectedOrder.shippingCost.toLocaleString('ar-EG')} ج.م`}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--border)] pt-2 font-black text-sm">
                    <span className="text-[var(--text-primary)]">الإجمالي النهائي:</span>
                    <span className="text-[#D4AF37] font-mono">{selectedOrder.total.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[var(--surface-elevated)]">
              <div className="flex items-center flex-wrap gap-2">
                <button
                  onClick={() => setInvoiceOrder(selectedOrder)}
                  className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#b88e2c] text-black rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <FileText className="w-4 h-4" />
                  <span>عرض الفاتورة وخيارات PDF</span>
                </button>

                <button
                  onClick={() => openWhatsAppInvoice(selectedOrder, storeSettings || undefined)}
                  className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>إرسال تفاصيل الطلب (واتساب)</span>
                </button>

                <button
                  onClick={() => setInvoiceOrder(selectedOrder)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>إرسال الفاتورة PDF (واتساب)</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all cursor-pointer mr-auto"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Printable Invoice Modal */}
      <InvoiceModal
        order={invoiceOrder}
        isOpen={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        storeSettings={storeSettings || undefined}
      />
    </div>
  );
}
