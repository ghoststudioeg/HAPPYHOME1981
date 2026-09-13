import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { productService } from '../../lib/data/productService';
import { categoryService } from '../../lib/data/categoryService';
import { orderService } from '../../lib/data/orderService';
import { reviewService } from '../../lib/data/reviewService';
import { analyticsService } from '../../lib/data/analyticsService';
import { notificationEngine } from '../../lib/notificationEngine';
import { Product, Category, Order, OrderStatus, Review, AdminStoreNotification, AnalyticsEvent } from '../../types';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import {

  Package,
  CheckCircle2,
  Sparkles,
  Layers,
  Plus,
  Settings,
  ArrowLeft,
  MessageCircle,
  TrendingUp,
  Flame,
  DollarSign,
  ShoppingCart,
  Users,
  Eye,
  Clock,
  XCircle,
  Truck,
  Activity,
  User as UserIcon,
  MapPin,
  ClipboardList,
  Calendar,
  AlertTriangle,
  Heart,
  Percent,
  Inbox,
  Lock,
  Search,
  Bell,
  CheckCheck,
  CreditCard
} from 'lucide-react';

interface AdminDashboardPageProps {
  navigate: (path: string) => void;
}

// Date Range Helper Function
function getDateRange(filter: 'today' | '7days' | '30days' | 'custom', customStart?: string, customEnd?: string) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (filter === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (filter === '7days') {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (filter === '30days') {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else {
    // Custom range
    if (customStart) {
      start = new Date(`${customStart}T00:00:00`);
    } else {
      start = new Date(0);
    }
    if (customEnd) {
      end = new Date(`${customEnd}T23:59:59`);
    } else {
      end = new Date();
    }
  }
  return { start, end };
}

export function AdminDashboardPage({ navigate }: AdminDashboardPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeCarts, setActiveCarts] = useState<{ userId: string; email: string; name: string; itemsCount: number; items: { productName: string; quantity: number; price: number }[] }[]>([]);
  const [activeCartsError, setActiveCartsError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<AdminStoreNotification[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Time / Date Filter State
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Orders Table Filter State
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Load baseline static and subscription data
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [allProds, allCats, allReviews, allOrders] = await Promise.all([
          productService.getAllProducts(true),
          categoryService.getCategories(true),
          reviewService.getPendingReviews().catch(() => []),
          orderService.getOrders(100).catch(() => [])
        ]);
        if (isMounted) {
          setProducts(allProds);
          setCategories(allCats);
          setReviews(allReviews);
          setOrders(allOrders);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading admin catalog data:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    // Subscribe to Admin Notifications in Realtime (Centralized Singleton)
    const unsubscribeNotifications = notificationEngine.subscribeToAdminNotifications((data) => {
      if (isMounted) {
        setNotifications(data);
      }
    });

    // Load active customer carts
    async function loadCarts() {
      try {
        setActiveCartsError(null);
        const carts = await orderService.getActiveCustomerCarts();
        if (isMounted) {
          setActiveCarts(carts);
        }
      } catch (err) {
        console.error('Error loading active customer carts:', err);
        if (isMounted) {
          setActiveCartsError(err instanceof Error ? err.message : 'Failed to load active customer carts');
        }
      }
    }
    loadCarts();

    return () => {
      isMounted = false;
      unsubscribeNotifications();
    };
  }, []);

  // Fetch Analytics events on date range changes
  useEffect(() => {
    let active = true;

    async function fetchAnalytics() {
      setLoadingAnalytics(true);
      const { start, end } = getDateRange(dateFilter, customStartDate, customEndDate);
      try {
        const events = await analyticsService.getEventsByRange(start, end);
        if (active) {
          setAnalyticsEvents(events);
        }
      } catch (err) {
        console.error('Error fetching analytics events:', err);
      } finally {
        if (active) {
          setLoadingAnalytics(false);
        }
      }
    }

    fetchAnalytics();

    return () => {
      active = false;
    };
  }, [dateFilter, customStartDate, customEndDate]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, orderStatus: newStatus } : null);
      }
    } catch (e) {
      console.error('Failed to update order status:', e);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-[var(--surface)] border border-[var(--border)] rounded-2xl animate-pulse"></div>
          ))}
        </div>
        <LoadingSkeleton type="table" count={5} />
      </div>
    );
  }

  // ==========================================
  // OPERATIONAL CALCULATIONS & METRICS
  // ==========================================
  const { start: filterStart, end: filterEnd } = getDateRange(dateFilter, customStartDate, customEndDate);

  // Helper to construct URL query params for the selected period
  const getPeriodParams = () => {
    const formatDate = (d: Date) => {
      try {
        return d.toISOString().split('T')[0];
      } catch (e) {
        return new Date().toISOString().split('T')[0];
      }
    };
    return `start=${formatDate(filterStart)}&end=${formatDate(filterEnd)}`;
  };

  const getAnalyticsUrl = () => {
    let range: 'today' | '7d' | '30d' | 'custom' = '30d';
    if (dateFilter === 'today') range = 'today';
    else if (dateFilter === '7days') range = '7d';
    else if (dateFilter === '30days') range = '30d';
    else if (dateFilter === 'custom') range = 'custom';
    
    if (range === 'custom') {
      return `/admin/analytics?range=custom&start=${customStartDate}&end=${customEndDate}`;
    }
    return `/admin/analytics?range=${range}`;
  };

  // Filter orders by selected date range
  const dateFilteredOrders = orders.filter((o) => {
    const orderDate = new Date(o.createdAt);
    return orderDate >= filterStart && orderDate <= filterEnd;
  });

  // Order status counts inside date range
  const newOrdersCount = dateFilteredOrders.filter(o => o.orderStatus === 'new').length;
  const pendingOrdersCount = dateFilteredOrders.filter(o => o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled').length;
  const deliveredOrdersCount = dateFilteredOrders.filter(o => o.orderStatus === 'delivered').length;
  const cancelledOrdersCount = dateFilteredOrders.filter(o => o.orderStatus === 'cancelled').length;

  // Authoritative Sales Revenue from actual Orders in range (delivered only)
  const totalSalesRevenue = dateFilteredOrders
    .filter(o => o.orderStatus === 'delivered')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const potentialRevenue = dateFilteredOrders
    .filter(o => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // Inventory Health (Catalog-wide metrics)
  const lowStockThresholdDefault = 5;
  const lowStockProducts = products.filter(p => 
    p.trackInventory !== false && 
    p.stockStatus !== 'coming_soon' && 
    p.stockQuantity > 0 && 
    p.stockQuantity <= (p.lowStockThreshold || lowStockThresholdDefault)
  );
  const outOfStockProducts = products.filter(p => 
    p.stockQuantity === 0 || p.stockStatus === 'out_of_stock'
  );

  // Unique customers who ordered in range
  const uniqueCustomers = new Set<string>();
  dateFilteredOrders.forEach(o => {
    if (o.customerUid && o.customerUid !== 'guest') {
      uniqueCustomers.add(o.customerUid);
    } else if (o.customerEmail) {
      uniqueCustomers.add(o.customerEmail);
    } else if (o.customerPhone) {
      uniqueCustomers.add(o.customerPhone);
    }
  });
  const newCustomersCount = uniqueCustomers.size;

  // Reviews inside date range and overall pending
  const pendingReviewsCount = reviews.filter(r => r.status === 'pending').length;
  const dateFilteredReviews = reviews.filter(r => {
    const d = new Date(r.createdAt);
    return d >= filterStart && d <= filterEnd;
  });

  // Unread Admin Notifications
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  // WhatsApp Clicks (Cumulative total in catalog)
  const totalWhatsAppClicks = products.reduce((acc, p) => acc + (p.whatsappClicks || 0), 0);

  // Overall leads conversions: completed orders / (total inquiries + completed orders)
  const totalLeads = totalWhatsAppClicks + dateFilteredOrders.length;
  const conversionRate = totalLeads > 0 
    ? ((dateFilteredOrders.filter(o => o.orderStatus === 'delivered').length / totalLeads) * 100).toFixed(1) 
    : '0.0';

  // ==========================================
  // PRODUCT & CATEGORY ANALYTICS AGGREGATION
  // ==========================================
  const productPerformanceMap: Record<string, {
    views: number;
    favorites: number;
    carts: number;
    ordersCount: number;
    quantityOrdered: number;
    revenue: number;
  }> = {};

  // Initialize
  products.forEach((p) => {
    productPerformanceMap[p.id] = {
      views: 0,
      favorites: 0,
      carts: 0,
      ordersCount: 0,
      quantityOrdered: 0,
      revenue: 0,
    };
  });

  // Aggregate event interactions inside date range
  analyticsEvents.forEach((ev) => {
    const pId = ev.productId;
    if (pId && productPerformanceMap[pId]) {
      if (ev.eventType === 'product_view') {
        productPerformanceMap[pId].views++;
      } else if (ev.eventType === 'favorite_added') {
        productPerformanceMap[pId].favorites++;
      } else if (ev.eventType === 'cart_added') {
        productPerformanceMap[pId].carts++;
      }
    }
  });

  // Aggregate actual sales in selected period (orders must not be cancelled)
  dateFilteredOrders.forEach((order) => {
    if (order.orderStatus === 'cancelled') return;

    order.items.forEach((item) => {
      const pId = item.productId;
      if (pId && productPerformanceMap[pId]) {
        productPerformanceMap[pId].ordersCount++;
        productPerformanceMap[pId].quantityOrdered += item.quantity;
        const price = item.priceAtPurchase || 0;
        productPerformanceMap[pId].revenue += price * item.quantity;
      }
    });
  });

  // Compile sorted product performance list
  const productPerformanceList = products.map((p) => ({
    ...p,
    stats: productPerformanceMap[p.id] || { views: 0, favorites: 0, carts: 0, ordersCount: 0, quantityOrdered: 0, revenue: 0 }
  })).sort((a, b) => b.stats.revenue - a.stats.revenue || b.stats.quantityOrdered - a.stats.quantityOrdered);

  const topSellingProducts = productPerformanceList.slice(0, 5);

  // Category Performance aggregation
  const categoryPerformanceMap: Record<string, {
    name: string;
    ordersCount: number;
    quantityOrdered: number;
    revenue: number;
  }> = {};

  categories.forEach((cat) => {
    categoryPerformanceMap[cat.id] = {
      name: cat.name,
      ordersCount: 0,
      quantityOrdered: 0,
      revenue: 0,
    };
  });

  dateFilteredOrders.forEach((order) => {
    if (order.orderStatus === 'cancelled') return;

    order.items.forEach((item) => {
      const prod = products.find(p => p.id === item.productId);
      const catId = prod?.categoryId;
      if (catId && categoryPerformanceMap[catId]) {
        categoryPerformanceMap[catId].ordersCount++;
        categoryPerformanceMap[catId].quantityOrdered += item.quantity;
        const price = item.priceAtPurchase || 0;
        categoryPerformanceMap[catId].revenue += price * item.quantity;
      }
    });
  });

  const categoryPerformanceList = Object.entries(categoryPerformanceMap)
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.revenue - a.revenue);

  // Apply order status table filters
  const finalFilteredOrders = dateFilteredOrders.filter((order) => {
    if (statusFilter === 'all') return true;
    return order.orderStatus === statusFilter;
  });

  return (
    <div className="space-y-8" dir="rtl">
      {/* HEADER SECTION & OPERATIONAL CLOCK */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-[var(--border)] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            مركز القيادة والتحكم التشغيلي 🛰️
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed max-w-2xl">
            مراقبة الأداء المالي، تتبع المعاملات اللحظية، وإدارة مؤشرات المخزون والعملاء في بيئة حية ومؤمنة بالكامل.
          </p>
        </div>

        {/* Date Filter & Selector */}
        <div className="flex flex-wrap items-center gap-2.5 bg-[var(--surface)] border border-[var(--border)] p-1.5 rounded-2xl shrink-0 shadow-sm">
          <button
            onClick={() => { setDateFilter('today'); setStatusFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === 'today' ? 'bg-[#D4AF37] text-[#05080D] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => { setDateFilter('7days'); setStatusFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === '7days' ? 'bg-[#D4AF37] text-[#05080D] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => { setDateFilter('30days'); setStatusFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === '30days' ? 'bg-[#D4AF37] text-[#05080D] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            آخر 30 يوم
          </button>
          <button
            onClick={() => { setDateFilter('custom'); setStatusFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dateFilter === 'custom' ? 'bg-[#D4AF37] text-[#05080D] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            نطاق مخصص
          </button>
        </div>
      </div>

      {/* Custom Date Picker Fields */}
      {dateFilter === 'custom' && (
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] flex flex-wrap items-center gap-4 animate-in slide-in-from-top-3 duration-200 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs text-[var(--text-primary)] font-bold">تحديد فترة مخصصة للتحليلات:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)] block">من تاريخ</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono rounded-xl px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)] block">إلى تاريخ</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-mono rounded-xl px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>
          {loadingAnalytics && (
            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 shrink-0 animate-pulse bg-amber-500/10 px-2 py-1 rounded">
              <Clock className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
              جاري حساب الإحصائيات الفورية...
            </span>
          )}
        </div>
      )}

      {/* METRICS INDEX (PRIMARY KEY INDICATORS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Authoritative Revenue Card */}
        <button
          onClick={() => navigate(getAnalyticsUrl())}
          aria-label="عرض تحليل الإيرادات والتحليلات المالية"
          className="bg-[var(--surface)] p-5 rounded-2xl border border-[#D4AF37]/30 flex items-center justify-between shadow-sm relative overflow-hidden group text-right w-full cursor-pointer hover:bg-[var(--surface-elevated)] hover:border-[#D4AF37]/60 hover:shadow-md active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block">الإيرادات المحصلة (مكتملة)</span>
            <h3 className="text-xl sm:text-2xl font-black text-[#D4AF37] font-mono whitespace-nowrap">
              {totalSalesRevenue.toLocaleString('ar-EG')} <span className="text-xs font-bold">ج.م</span>
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] block">المبيعات المتوقعة: {potentialRevenue.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] shrink-0 group-hover:scale-105 transition-transform">
            <DollarSign className="w-6 h-6" />
          </div>
        </button>

        {/* New Orders Card */}
        <button
          onClick={() => navigate(`/admin/orders?status=new&${getPeriodParams()}`)}
          aria-label={`الذهاب للطلبات الجديدة، يوجد ${newOrdersCount} طلب جديد`}
          className="bg-[var(--surface)] p-5 rounded-2xl border border-blue-500/20 flex items-center justify-between group cursor-pointer shadow-sm text-right w-full hover:bg-[var(--surface-elevated)] hover:border-blue-500/40 hover:shadow-md active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block">الطلبات الجديدة</span>
            <h3 className="text-2xl font-black text-blue-500 font-mono flex items-center gap-2">
              {newOrdersCount}
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] block">بانتظار التأكيد والمعالجة</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-105 transition-transform">
            <Inbox className="w-6 h-6" />
          </div>
        </button>

        {/* Pending Active Orders Card */}
        <button
          onClick={() => navigate(`/admin/orders?status=active&${getPeriodParams()}`)}
          aria-label={`الذهاب للطلبات قيد التنفيذ، يوجد ${pendingOrdersCount} طلب`}
          className="bg-[var(--surface)] p-5 rounded-2xl border border-amber-500/20 flex items-center justify-between group cursor-pointer shadow-sm text-right w-full hover:bg-[var(--surface-elevated)] hover:border-amber-500/40 hover:shadow-md active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block">الطلبات قيد التنفيذ</span>
            <h3 className="text-2xl font-black text-amber-500 font-mono">
              {pendingOrdersCount}
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] block">جاري تجهيزها وشحنها للعميل</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-105 transition-transform">
            <Truck className="w-6 h-6" />
          </div>
        </button>

        {/* Delivered Orders Card */}
        <button
          onClick={() => navigate(`/admin/orders?status=delivered&${getPeriodParams()}`)}
          aria-label={`الذهاب للطلبات المستلمة، يوجد ${deliveredOrdersCount} طلب مستلم`}
          className="bg-[var(--surface)] p-5 rounded-2xl border border-emerald-500/20 flex items-center justify-between group cursor-pointer shadow-sm text-right w-full hover:bg-[var(--surface-elevated)] hover:border-emerald-500/40 hover:shadow-md active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block">الطلبات المستلمة</span>
            <h3 className="text-2xl font-black text-emerald-500 font-mono">
              {deliveredOrdersCount}
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] block">تم توصيلها للعميل بنجاح</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </button>

        {/* Conversion Rate Card */}
        <button
          onClick={() => navigate(getAnalyticsUrl())}
          aria-label={`عرض تقرير معدل التحويل الكلي، النسبة الحالية ${conversionRate} في المائة`}
          className="bg-[var(--surface)] p-5 rounded-2xl border border-purple-500/20 flex items-center justify-between group cursor-pointer shadow-sm text-right w-full hover:bg-[var(--surface-elevated)] hover:border-purple-500/40 hover:shadow-md active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider block">معدل التحويل الكلي</span>
            <h3 className="text-2xl font-black text-purple-500 font-mono">
              {conversionRate}%
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] block">إجمالي المؤشرات المتفاعلة: {totalLeads}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 shrink-0 group-hover:scale-105 transition-transform">
            <Activity className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* SECONDARY OPERATIONAL INDICATORS & ENGAGEMENTS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* New Customers */}
        <button
          onClick={() => navigate(getAnalyticsUrl())}
          aria-label={`عرض تحليل العملاء النشطين، إجمالي ${newCustomersCount} عميل`}
          className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center gap-3 shadow-sm hover:border-[#D4AF37]/40 hover:bg-[var(--surface)] active:scale-[0.98] transition-all cursor-pointer text-right w-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] block uppercase">العملاء النشطون</span>
            <span className="text-sm font-black text-[var(--text-primary)] font-mono">{newCustomersCount}</span>
          </div>
        </button>

        {/* WhatsApp Leads */}
        <button
          onClick={() => navigate(getAnalyticsUrl())}
          aria-label={`عرض تقارير نقرات واتساب، إجمالي ${totalWhatsAppClicks} نقرة`}
          className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center gap-3 shadow-sm hover:border-emerald-500/40 hover:bg-[var(--surface)] active:scale-[0.98] transition-all cursor-pointer text-right w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] block uppercase">نقرات واتساب</span>
            <span className="text-sm font-black text-emerald-500 font-mono">{totalWhatsAppClicks}</span>
          </div>
        </button>

        {/* Pending Reviews */}
        <button
          onClick={() => navigate('/admin/reviews?status=pending')}
          aria-label={`إدارة التقييمات المعلقة، يوجد ${pendingReviewsCount} تقييم معلق`}
          className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center gap-3 shadow-sm hover:border-amber-500/40 hover:bg-[var(--surface)] active:scale-[0.98] transition-all cursor-pointer text-right w-full focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] block uppercase">التقييمات المعلقة</span>
            <span className="text-sm font-black text-amber-500 font-mono">{pendingReviewsCount}</span>
          </div>
        </button>

        {/* Low Stock Alerts */}
        <button
          onClick={() => navigate('/admin/products?filter=low_stock')}
          aria-label={`عرض المنتجات ذات المخزون المنخفض، العدد ${lowStockProducts.length}`}
          className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center gap-3 shadow-sm hover:border-rose-500/40 hover:bg-[var(--surface)] active:scale-[0.98] transition-all cursor-pointer text-right w-full focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] block uppercase">مخزون منخفض</span>
            <span className="text-sm font-black text-rose-500 font-mono">{lowStockProducts.length}</span>
          </div>
        </button>

        {/* Out of Stock Alerts */}
        <button
          onClick={() => navigate('/admin/products?filter=out_of_stock')}
          aria-label={`عرض المنتجات المنتهية من المخزون، العدد ${outOfStockProducts.length}`}
          className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center gap-3 shadow-sm hover:border-red-500/40 hover:bg-[var(--surface)] active:scale-[0.98] transition-all cursor-pointer text-right w-full focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500">
            <XCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] block uppercase">نفاد المخزون</span>
            <span className="text-sm font-black text-red-500 font-mono">{outOfStockProducts.length}</span>
          </div>
        </button>

        {/* Unread Notifications Alert */}
        <button
          onClick={() => navigate('/admin/notifications')}
          aria-label={`الذهاب لمركز الإشعارات، يوجد ${unreadNotificationsCount} إشعار جديد`}
          className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center gap-3 shadow-sm hover:border-sky-500/40 hover:bg-[var(--surface)] active:scale-[0.98] transition-all cursor-pointer text-right w-full relative focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-[var(--text-muted)] block uppercase">إشعارات جديدة</span>
            <span className="text-sm font-black text-sky-500 font-mono">{unreadNotificationsCount}</span>
          </div>
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-3.5 right-3 w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
          )}
        </button>
      </div>

      {/* QUICK OPERATIONAL SHORTCUTS */}
      <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] space-y-3.5 shadow-sm">
        <h3 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#D4AF37]" />
          <span>الوصول السريع والإجراءات التشغيلية</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <button
            onClick={() => navigate('/admin/orders?status=new')}
            className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-blue-500/10 hover:border-blue-500/20 text-xs font-bold text-[var(--text-secondary)] hover:text-blue-500 text-center transition-all cursor-pointer flex flex-col items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Inbox className="w-4 h-4" />
            <span>الطلبات الجديدة</span>
          </button>
          <button
            onClick={() => navigate('/admin/products')}
            className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/20 text-xs font-bold text-[var(--text-secondary)] hover:text-[#D4AF37] text-center transition-all cursor-pointer flex flex-col items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          >
            <Package className="w-4 h-4" />
            <span>إدارة المنتجات</span>
          </button>
          <button
            onClick={() => navigate('/admin/products?filter=low_stock')}
            className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-rose-500/10 hover:border-rose-500/20 text-xs font-bold text-[var(--text-secondary)] hover:text-rose-500 text-center transition-all cursor-pointer flex flex-col items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <Layers className="w-4 h-4" />
            <span>إدارة المخزون</span>
          </button>
          <button
            onClick={() => navigate('/admin/installments')}
            className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-emerald-500/10 hover:border-emerald-500/20 text-xs font-bold text-[var(--text-secondary)] hover:text-emerald-500 text-center transition-all cursor-pointer flex flex-col items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <CreditCard className="w-4 h-4" />
            <span>إدارة التقسيط</span>
          </button>
          <button
            onClick={() => navigate('/admin/reviews')}
            className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-amber-500/10 hover:border-amber-500/20 text-xs font-bold text-[var(--text-secondary)] hover:text-amber-500 text-center transition-all cursor-pointer flex flex-col items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <Sparkles className="w-4 h-4" />
            <span>إدارة التقييمات</span>
          </button>
          <button
            onClick={() => navigate('/admin/coupons')}
            className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-purple-500/10 hover:border-purple-500/20 text-xs font-bold text-[var(--text-secondary)] hover:text-purple-500 text-center transition-all cursor-pointer flex flex-col items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <Percent className="w-4 h-4" />
            <span>أكواد الخصم</span>
          </button>
          <button
            onClick={() => navigate('/admin/notifications')}
            className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-sky-500/10 hover:border-sky-500/20 text-xs font-bold text-[var(--text-secondary)] hover:text-sky-500 text-center transition-all cursor-pointer flex flex-col items-center gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <Bell className="w-4 h-4" />
            <span>مركز الإشعارات</span>
          </button>
        </div>
      </div>

      {/* RATIO RATINGS & ORDER STATUS BREAKDOWN */}
      <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border)] space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <span className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider block">تحليل هيكل وتوزيع حالات الطلبات</span>
          <span className="text-[10px] text-[var(--text-muted)]">انقر فوق أي فئة لتصفية جدول المعاملات أدناه</span>
        </div>

        {/* Dynamic Percentage Meter Bar */}
        <div className="space-y-3">
          <div className="h-4 w-full rounded-full bg-[var(--surface-elevated)] overflow-hidden flex">
            {[
              { status: 'new', label: 'جديد', color: 'bg-blue-500', count: dateFilteredOrders.filter(o => o.orderStatus === 'new').length },
              { status: 'confirmed', label: 'مؤكد', color: 'bg-emerald-500', count: dateFilteredOrders.filter(o => o.orderStatus === 'confirmed').length },
              { status: 'preparing', label: 'تجهيز', color: 'bg-amber-500', count: dateFilteredOrders.filter(o => o.orderStatus === 'preparing').length },
              { status: 'ready_to_ship', label: 'جاهز للشحن', color: 'bg-purple-500', count: dateFilteredOrders.filter(o => o.orderStatus === 'ready_to_ship').length },
              { status: 'shipped', label: 'مشحون', color: 'bg-indigo-500', count: dateFilteredOrders.filter(o => o.orderStatus === 'shipped').length },
              { status: 'delivered', label: 'مستلم', color: 'bg-teal-500', count: dateFilteredOrders.filter(o => o.orderStatus === 'delivered').length },
              { status: 'cancelled', label: 'ملغي', color: 'bg-rose-500', count: dateFilteredOrders.filter(o => o.orderStatus === 'cancelled').length }
            ].map((item) => {
              const pct = dateFilteredOrders.length > 0 ? (item.count / dateFilteredOrders.length) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={item.status}
                  className={`${item.color} h-full transition-all cursor-pointer relative group`}
                  style={{ width: `${pct}%` }}
                  onClick={() => setStatusFilter(item.status as OrderStatus)}
                  title={`${item.label}: ${item.count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>

          {/* Indicators Buttons List */}
          <div className="flex flex-wrap items-center gap-3">
            {[
              { status: 'all', label: 'الكل', color: 'border-[var(--border)] text-[var(--text-primary)] bg-[var(--surface-elevated)]', count: dateFilteredOrders.length },
              { status: 'new', label: 'جديد', color: 'border-blue-500/20 text-blue-500 bg-blue-500/5', count: dateFilteredOrders.filter(o => o.orderStatus === 'new').length },
              { status: 'confirmed', label: 'مؤكد', color: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5', count: dateFilteredOrders.filter(o => o.orderStatus === 'confirmed').length },
              { status: 'preparing', label: 'تجهيز', color: 'border-amber-500/20 text-amber-500 bg-amber-500/5', count: dateFilteredOrders.filter(o => o.orderStatus === 'preparing').length },
              { status: 'ready_to_ship', label: 'جاهز للشحن', color: 'border-purple-500/20 text-purple-500 bg-purple-500/5', count: dateFilteredOrders.filter(o => o.orderStatus === 'ready_to_ship').length },
              { status: 'shipped', label: 'مشحون', color: 'border-indigo-500/20 text-indigo-500 bg-indigo-500/5', count: dateFilteredOrders.filter(o => o.orderStatus === 'shipped').length },
              { status: 'delivered', label: 'تم الاستلام', color: 'border-teal-500/20 text-teal-500 bg-teal-500/5', count: dateFilteredOrders.filter(o => o.orderStatus === 'delivered').length },
              { status: 'cancelled', label: 'ملغي', color: 'border-rose-500/20 text-rose-500 bg-rose-500/5', count: dateFilteredOrders.filter(o => o.orderStatus === 'cancelled').length }
            ].map((item) => (
              <button
                key={item.status}
                onClick={() => setStatusFilter(item.status as any)}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  statusFilter === item.status 
                    ? 'ring-2 ring-[#D4AF37] border-transparent scale-105' 
                    : 'opacity-70 hover:opacity-100'
                } ${item.color}`}
              >
                <span>{item.label}</span>
                <span className="font-mono bg-[var(--surface)]/10 px-1.5 py-0.5 rounded text-[10px]">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OPERATIONS & FEEDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incoming Purchase Orders */}
        <div className="lg:col-span-2 bg-[var(--surface)] rounded-3xl p-5 sm:p-6 shadow-lg border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">سجل معاملات طلبات الشراء الواردة</h3>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-elevated)] px-3 py-1 rounded-full border border-[var(--border)] font-mono">
              تصفية: {statusFilter === 'all' ? 'الكل' : statusFilter} ({finalFilteredOrders.length})
            </span>
          </div>

          {finalFilteredOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-1">
              <p>لا توجد طلبات تطابق معيار التصفية المختار للفترة المحددة.</p>
              <p className="text-[10px] text-[var(--text-muted)] opacity-60">اختر معايير تصفية بديلة أو غير النطاق الزمني لعرض المزيد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <tr>
                    <th className="p-3">رقم الطلب</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">رقم الهاتف</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">حالة الطلب</th>
                    <th className="p-3 text-center">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {finalFilteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-[var(--surface-elevated)]/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="p-3 font-bold text-[var(--text-primary)]">
                        {order.customerName}
                      </td>
                      <td className="p-3 font-mono text-[var(--text-secondary)]">{order.customerPhone}</td>
                      <td className="p-3 font-black text-[#D4AF37] font-mono">
                        {(order.total || 0).toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="p-3">
                        {order.orderStatus === 'new' && <span className="text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded text-[10px] border border-blue-500/20">جديد ⏳</span>}
                        {order.orderStatus === 'confirmed' && <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] border border-emerald-500/20">مؤكد ✅</span>}
                        {order.orderStatus === 'preparing' && <span className="text-amber-600 dark:text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded text-[10px] border border-amber-500/20">جاري التجهيز 🚚</span>}
                        {order.orderStatus === 'ready_to_ship' && <span className="text-purple-600 dark:text-purple-500 font-bold bg-purple-500/10 px-2 py-0.5 rounded text-[10px] border border-purple-500/20">جاهز للشحن 📦</span>}
                        {order.orderStatus === 'shipped' && <span className="text-indigo-600 dark:text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] border border-indigo-500/20">تم الشحن 📯</span>}
                        {order.orderStatus === 'delivered' && <span className="text-teal-600 dark:text-teal-500 font-bold bg-teal-500/10 px-2 py-0.5 rounded text-[10px] border border-teal-500/20">مكتمل 🎉</span>}
                        {order.orderStatus === 'cancelled' && <span className="text-rose-600 dark:text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded text-[10px] border border-rose-500/20">ملغي ❌</span>}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1 rounded bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] text-[var(--text-secondary)] transition-all cursor-pointer inline-flex items-center justify-center"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer Live Carts */}
        <div className="bg-[var(--surface)] rounded-3xl p-5 sm:p-6 shadow-lg border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-500" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">تتبع السلات الحية والعملاء</h3>
            </div>
            <span className="text-xs text-purple-500 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20 font-bold font-mono">
              {activeCarts.length} نشطة
            </span>
          </div>

          {activeCartsError ? (
            <div className="py-8 text-center text-xs text-rose-500 bg-rose-500/5 rounded-2xl border border-rose-500/10 p-4 space-y-2">
              <p className="font-bold">⚠️ حصل خطأ أثناء تحميل السلات النشطة</p>
              <p className="text-[10px] opacity-80" dir="ltr">
                {activeCartsError.startsWith('{') ? JSON.parse(activeCartsError).error : activeCartsError}
              </p>
            </div>
          ) : activeCarts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              لا توجد حالياً أي سلات نشطة من العملاء.
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {activeCarts.map((cart, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2.5 relative overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{cart.name}</h4>
                      <span className="text-[9px] text-[var(--text-muted)] block truncate font-mono">{cart.email}</span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/25">
                      {cart.itemsCount} قطع
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[10.5px] text-[var(--text-secondary)]">
                    {cart.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex justify-between gap-2">
                        <span className="truncate max-w-[150px] text-[var(--text-muted)]">{item.productName}</span>
                        <span className="font-mono text-[var(--text-primary)] text-[10px]">الكمية: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ANALYTICAL PERFORMANCE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Performance Table */}
        <div className="lg:col-span-2 bg-[var(--surface)] rounded-3xl p-5 sm:p-6 shadow-lg border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">أداء ومؤشرات المنتجات التفصيلي</h3>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)]">مرتبة حسب المبيعات للمدة المحددة</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                <tr>
                  <th className="p-3">المنتج</th>
                  <th className="p-3 text-center">مشاهدات</th>
                  <th className="p-3 text-center">تفضيلات</th>
                  <th className="p-3 text-center">إضافات للسلة</th>
                  <th className="p-3 text-center">الكمية المباعة</th>
                  <th className="p-3 text-left">إجمالي الإيرادات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {productPerformanceList.slice(0, 10).map((prod) => (
                  <tr key={prod.id} className="hover:bg-[var(--surface-elevated)]/60 transition-colors">
                    <td className="p-3 flex items-center gap-2.5 min-w-[160px]">
                      <img src={getValidImageSrc(prod.mainImageUrl)} alt={prod.name} className="w-8 h-8 rounded object-contain bg-[var(--surface-elevated)] border border-[var(--border)]" />
                      <div className="min-w-0">
                        <span className="font-bold text-[var(--text-primary)] block truncate text-xs">{prod.name}</span>
                        <span className="text-[9px] text-[var(--text-muted)] block font-mono">{prod.sku}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono text-[var(--text-secondary)]">{prod.stats.views}</td>
                    <td className="p-3 text-center font-mono text-rose-500">{prod.stats.favorites}</td>
                    <td className="p-3 text-center font-mono text-purple-500">{prod.stats.carts}</td>
                    <td className="p-3 text-center font-bold text-[var(--text-primary)]">{prod.stats.quantityOrdered}</td>
                    <td className="p-3 text-left font-black text-[#D4AF37] font-mono">{(prod.stats.revenue || 0).toLocaleString('ar-EG')} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Performance Card */}
        <div className="bg-[var(--surface)] rounded-3xl p-5 sm:p-6 shadow-lg border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">مبيعات الأقسام</h3>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)]">مخطط الأقسام والأداء</span>
          </div>

          {categoryPerformanceList.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              لا توجد مبيعات مسجلة لأي قسم في هذه الفترة.
            </div>
          ) : (
            <div className="space-y-4">
              {categoryPerformanceList.map((cat, index) => {
                const totalCatsRev = categoryPerformanceList.reduce((sum, c) => sum + c.revenue, 0);
                const percentage = totalCatsRev > 0 ? (cat.revenue / totalCatsRev) * 100 : 0;
                return (
                  <div key={cat.id} className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{cat.name}</span>
                      <span className="text-xs font-mono font-black text-[#D4AF37]">{cat.revenue.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                      <div className="h-full bg-[#D4AF37] rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>الكمية المطلوبة: {cat.quantityOrdered} قطعة</span>
                      <span>نسبة مساهمة: {percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* DETAILED ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar">
            {/* Title */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">تفاصيل الطلب: #{selectedOrder.id.slice(-6).toUpperCase()}</h3>
                <span className="text-xs text-[var(--text-secondary)]">{new Date(selectedOrder.createdAt).toLocaleString('ar-EG')}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Client Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2 shadow-sm">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block">بيانات العميل</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold">
                    <UserIcon className="w-4 h-4 text-[#D4AF37]" />
                    <span>{selectedOrder.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)] font-mono">
                    <MessageCircle className="w-4 h-4 text-emerald-500" />
                    <span>{selectedOrder.customerPhone}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-2 shadow-sm">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block">عنوان وملاحظات الشحن</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text-primary)]">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span className="font-bold">{selectedOrder.shippingAddress}</span>
                  </div>
                  {selectedOrder.customerNotes && (
                    <div className="text-[11px] text-[var(--text-muted)] bg-[var(--surface)] p-2 rounded-lg leading-relaxed border border-[var(--border)]">
                      * {selectedOrder.customerNotes}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block">المنتجات المطلوبة ({selectedOrder.items.length})</span>
              <div className="space-y-2">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      {item.productImage && (
                        <img src={getValidImageSrc(item.productImage)} alt={item.productName} className="w-10 h-10 rounded-lg object-contain bg-[var(--surface)] p-1 border border-[var(--border)] shrink-0" />
                      )}
                      <div>
                        <span className="text-xs font-bold text-[var(--text-primary)] block">{item.productName}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">{(item.priceAtPurchase || 0).toLocaleString('ar-EG')} ج.م × الكمية: {item.quantity}</span>
                      </div>
                    </div>

                    <span className="text-xs font-black text-[#D4AF37] font-mono">{((item.priceAtPurchase || 0) * item.quantity).toLocaleString('ar-EG')} ج.م</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coupon Application info if present */}
            {selectedOrder.couponCode && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-between text-xs font-bold">
                <span>كود الخصم المطبق: {selectedOrder.couponCode}</span>
                <span>تم خصم: {selectedOrder.discount?.toLocaleString('ar-EG')} ج.م</span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/15 rounded-2xl text-sm">
              <span className="font-black text-[var(--text-primary)]">إجمالي الحساب النهائي شامل الشحن:</span>
              <span className="text-base font-black text-[#E0B84A] font-mono">{(selectedOrder.total || 0).toLocaleString('ar-EG')} ج.م</span>
            </div>

            {/* Update status actions */}
            <div className="space-y-3.5 border-t border-[var(--border)] pt-5">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block text-center">تحديث حالة الطلب الحالي</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'new')}
                  disabled={updatingOrderId !== null}
                  className={`py-2 px-3.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    selectedOrder.orderStatus === 'new'
                      ? 'bg-blue-500/15 border-blue-500 text-blue-500'
                      : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  ⏳ طلب جديد
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'confirmed')}
                  disabled={updatingOrderId !== null}
                  className={`py-2 px-3.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    selectedOrder.orderStatus === 'confirmed'
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500'
                      : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  ✅ تأكيد الطلب
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'preparing')}
                  disabled={updatingOrderId !== null}
                  className={`py-2 px-3.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    selectedOrder.orderStatus === 'preparing'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-500'
                      : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  🚚 قيد التجهيز
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                  disabled={updatingOrderId !== null}
                  className={`py-2 px-3.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    selectedOrder.orderStatus === 'cancelled'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-500'
                      : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  ❌ إلغاء الطلب
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
