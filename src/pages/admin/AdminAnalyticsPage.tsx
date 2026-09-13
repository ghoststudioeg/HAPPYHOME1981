import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  Calendar, 
  TrendingUp, 
  Eye, 
  ShoppingCart, 
  MessageCircle, 
  Ticket, 
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Loader2,
  Package,
  Layers,
  Search as SearchIcon
} from 'lucide-react';
import { analyticsService } from '../../lib/data/analyticsService';
import { AnalyticsEvent, AnalyticsEventType } from '../../types';
import { productService } from '../../lib/data/productService';
import { categoryService } from '../../lib/data/categoryService';

type DateRange = 'today' | '7d' | '30d' | 'this_month' | 'custom';

export function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [productsMap, setProductsMap] = useState<Record<string, string>>({});
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({});

  const handleSetDateRange = (range: DateRange) => {
    setDateRange(range);
    const params = new URLSearchParams(window.location.search);
    if (range && range !== '7d') {
      params.set('range', range);
    } else {
      params.delete('range');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleSetCustomStartDate = (start: string) => {
    setCustomStartDate(start);
    const params = new URLSearchParams(window.location.search);
    if (start) {
      params.set('start', start);
    } else {
      params.delete('start');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleSetCustomEndDate = (end: string) => {
    setCustomEndDate(end);
    const params = new URLSearchParams(window.location.search);
    if (end) {
      params.set('end', end);
    } else {
      params.delete('end');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Load initial params from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rangeParam = params.get('range');
    const startParam = params.get('start');
    const endParam = params.get('end');

    if (rangeParam && ['today', '7d', '30d', 'this_month', 'custom'].includes(rangeParam)) {
      setDateRange(rangeParam as DateRange);
    }
    if (startParam) {
      setCustomStartDate(startParam);
    }
    if (endParam) {
      setCustomEndDate(endParam);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      let start = new Date();
      let end = new Date();
      
      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === '7d') {
        start.setDate(start.getDate() - 7);
      } else if (dateRange === '30d') {
        start.setDate(start.getDate() - 30);
      } else if (dateRange === 'this_month') {
        start = new Date(start.getFullYear(), start.getMonth(), 1);
      } else if (dateRange === 'custom' && customStartDate && customEndDate) {
        start = new Date(customStartDate);
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }

      const [eventsList, allProducts, allCategories] = await Promise.all([
        analyticsService.getEventsByRange(start, end),
        productService.getAllProducts(true),
        categoryService.getCategories()
      ]);

      setEvents(eventsList);
      
      // Create maps for IDs to Names
      const pMap: Record<string, string> = {};
      allProducts.forEach(p => pMap[p.id] = p.name);
      setProductsMap(pMap);

      const cMap: Record<string, string> = {};
      allCategories.forEach(c => cMap[c.id] = c.name);
      setCategoriesMap(cMap);

    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange, customStartDate, customEndDate]);

  // Aggregations
  const stats = useMemo(() => {
    const counts = {
      product_view: 0,
      category_view: 0,
      search: 0,
      favorite_added: 0,
      cart_added: 0,
      checkout_started: 0,
      order_created: 0,
      orders_delivered: 0,
      orders_cancelled: 0,
      whatsapp_clicked: 0,
      coupon_used: 0
    };

    let estimatedRevenue = 0;

    events.forEach(ev => {
      if (counts.hasOwnProperty(ev.eventType)) {
        (counts as any)[ev.eventType]++;
      }
      
      if (ev.eventType === 'order_created' && ev.metadata?.total) {
        estimatedRevenue += ev.metadata.total;
      }
    });

    return { ...counts, estimatedRevenue };
  }, [events]);

  // Daily Chart Data
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; views: number; orders: number }> = {};
    
    // Initialize last 7 days or range
    const start = new Date();
    if (dateRange === '7d') start.setDate(start.getDate() - 7);
    else if (dateRange === '30d') start.setDate(start.getDate() - 30);
    else if (dateRange === 'today') start.setHours(0,0,0,0);

    events.forEach(ev => {
      const dateStr = ev.timestamp.split('T')[0];
      if (!days[dateStr]) {
        days[dateStr] = { date: dateStr, views: 0, orders: 0 };
      }
      if (ev.eventType === 'product_view') days[dateStr].views++;
      if (ev.eventType === 'order_created') days[dateStr].orders++;
    });

    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  }, [events, dateRange]);

  // Top Products Data
  const topProducts = useMemo(() => {
    const productStats: Record<string, { name: string; views: number; favorites: number; sales: number }> = {};
    
    events.forEach(ev => {
      const pid = ev.productId;
      if (!pid) return;
      
      if (!productStats[pid]) {
        productStats[pid] = { name: productsMap[pid] || 'منتج غير معروف', views: 0, favorites: 0, sales: 0 };
      }
      
      if (ev.eventType === 'product_view') productStats[pid].views++;
      if (ev.eventType === 'favorite_added') productStats[pid].favorites++;
      if (ev.eventType === 'order_created') productStats[pid].sales++;
    });

    return Object.values(productStats)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }, [events, productsMap]);

  // Category Distribution
  const categoryData = useMemo(() => {
    const catCounts: Record<string, { name: string; value: number }> = {};
    
    events.forEach(ev => {
      if (ev.eventType === 'category_view' && ev.categoryId) {
        const cid = ev.categoryId;
        if (!catCounts[cid]) {
          catCounts[cid] = { name: categoriesMap[cid] || 'قسم غير معروف', value: 0 };
        }
        catCounts[cid].value++;
      }
    });

    return Object.values(catCounts).sort((a, b) => b.value - a.value);
  }, [events, categoriesMap]);

  const COLORS = ['#D4AF37', '#E0B84A', '#F8FAFC', '#94A3B8', '#64748B'];

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" dir="rtl">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
        <p className="text-sm text-[var(--text-secondary)]">جاري تحليل البيانات واستخراج الإحصائيات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#D4AF37]" />
            <span>الإحصائيات والتحليلات</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">نظرة شاملة على أداء المتجر وتفاعل العملاء</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] shadow-sm">
            {(['today', '7d', '30d', 'this_month', 'custom'] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleSetDateRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateRange === r 
                    ? 'bg-[#D4AF37] text-slate-950 shadow-sm' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {r === 'today'
                  ? 'اليوم'
                  : r === '7d'
                  ? 'آخر ٧ أيام'
                  : r === '30d'
                  ? 'آخر ٣٠ يوم'
                  : r === 'this_month'
                  ? 'هذا الشهر'
                  : 'نطاق مخصص'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {dateRange === 'custom' && (
        <div className="bg-[var(--surface)] p-4 rounded-2xl flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-2 border border-[var(--border)] shadow-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] pr-1 block">من تاريخ</label>
            <input 
              type="date" 
              value={customStartDate}
              onChange={(e) => handleSetCustomStartDate(e.target.value)}
              className="bg-[var(--surface-elevated)] h-10 px-3 rounded-xl text-xs text-[var(--text-primary)] border border-[var(--border)] outline-none focus:border-[#D4AF37] transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] pr-1 block">إلى تاريخ</label>
            <input 
              type="date" 
              value={customEndDate}
              onChange={(e) => handleSetCustomEndDate(e.target.value)}
              className="bg-[var(--surface-elevated)] h-10 px-3 rounded-xl text-xs text-[var(--text-primary)] border border-[var(--border)] outline-none focus:border-[#D4AF37] transition-all"
            />
          </div>
          <button 
            onClick={loadData}
            className="h-10 px-6 bg-[#D4AF37]/15 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-slate-950 border border-[#D4AF37]/30 text-xs font-black rounded-xl transition-all cursor-pointer"
          >
            تحديث البيانات
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="مشاهدات المنتجات" 
          value={stats.product_view} 
          icon={Eye} 
          trend="+12%" 
          color="#D4AF37" 
        />
        <MetricCard 
          title="إجمالي الطلبات" 
          value={stats.order_created} 
          icon={ShoppingCart} 
          trend="+5%" 
          color="#38BDF8" 
        />
        <MetricCard 
          title="إيرادات تقديرية" 
          value={`${stats.estimatedRevenue.toLocaleString('ar-EG')} ج.م`} 
          icon={TrendingUp} 
          trend="+8.2%" 
          color="#10B981" 
        />
        <MetricCard 
          title="نقرات واتساب" 
          value={stats.whatsapp_clicked} 
          icon={MessageCircle} 
          trend="-2%" 
          color="#22C55E" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Traffic Chart */}
        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[var(--text-primary)]">حركة المرور والطلبات اليومية</h3>
            <div className="flex items-center gap-4 text-[10px] font-bold">
              <div className="flex items-center gap-1.5 text-[#D4AF37]">
                <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <span>المشاهدات</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#38BDF8]">
                <div className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                <span>الطلبات</span>
              </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-muted)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="views" 
                  stroke="#D4AF37" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#D4AF37', strokeWidth: 0 }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="orders" 
                  stroke="#38BDF8" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#38BDF8', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products Table/Chart */}
        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] space-y-6 shadow-sm">
          <h3 className="text-sm font-black text-[var(--text-primary)]">المنتجات الأكثر رواجاً</h3>
          
          <div className="space-y-4">
            {topProducts.map((p, idx) => (
              <div key={idx} className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[10px] font-black text-[#D4AF37] shadow-sm">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[#D4AF37] transition-colors">{p.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-[var(--text-muted)]">{p.views} مشاهدة</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{p.favorites} تفضيل</span>
                    <span className="text-[10px] text-[#D4AF37] font-bold">{p.sales} مبيعات</span>
                  </div>
                </div>
                <div className="w-24 h-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#D4AF37] rounded-full" 
                    style={{ width: `${Math.min(100, (p.views / (topProducts[0]?.views || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-center py-10 text-xs text-[var(--text-muted)]">لا توجد بيانات كافية للمنتجات</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Distribution */}
        <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] flex flex-col items-center shadow-sm">
          <h3 className="text-sm font-black text-[var(--text-primary)] self-start mb-6">توزيع اهتمام العملاء حسب الأقسام</h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}
                   itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Other metrics */}
        <div className="lg:col-span-2 bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)] space-y-6 shadow-sm">
          <h3 className="text-sm font-black text-[var(--text-primary)]">مؤشرات تفاعل إضافية</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SecondaryMetric label="عمليات البحث" value={stats.search} icon={SearchIcon} />
            <SecondaryMetric label="إضافة للمفضلة" value={stats.favorite_added} icon={TrendingUp} />
            <SecondaryMetric label="إضافة للسلة" value={stats.cart_added} icon={Package} />
            <SecondaryMetric label="بدء الدفع" value={stats.checkout_started} icon={ShoppingCart} />
            <SecondaryMetric label="استخدام الكوبونات" value={stats.coupon_used} icon={Ticket} />
            <SecondaryMetric label="مشاهدات الأقسام" value={stats.category_view} icon={Layers} />
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1">
                <p className="font-bold text-[var(--text-primary)]">تحويل المبيعات (Conversion Rate)</p>
                <p className="text-[10px] text-[var(--text-muted)]">نسبة الطلبات إلى إجمالي مشاهدات المنتجات</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-[#D4AF37]">
                  {stats.product_view > 0 ? ((stats.order_created / stats.product_view) * 100).toFixed(2) : 0}%
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] rounded-full" 
                style={{ width: `${Math.min(100, (stats.order_created / (stats.product_view || 1)) * 1000)}%` }} // Multiplied for visibility if small
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, color }: { title: string; value: string | number; icon: any; trend: string; color: string }) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div className="bg-[var(--surface)] p-5 rounded-3xl border border-[var(--border)] relative overflow-hidden group hover:border-[#D4AF37]/30 transition-all shadow-sm">
      <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-start justify-between">
          <div className="p-2.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] group-hover:bg-[#D4AF37]/10 transition-colors shadow-sm">
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{trend}</span>
          </div>
        </div>
        
        <div>
          <p className="text-[11px] font-bold text-[var(--text-secondary)]">{title}</p>
          <h4 className="text-xl font-black text-[var(--text-primary)] mt-0.5">{value}</h4>
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-2xl group-hover:bg-[#D4AF37]/10 transition-all opacity-0 group-hover:opacity-100" />
    </div>
  );
}

function SecondaryMetric({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="bg-[var(--surface-elevated)] border border-[var(--border)] p-4 rounded-2xl space-y-2 group hover:bg-[var(--surface)] transition-all shadow-sm">
      <div className="flex items-center justify-between">
        <Icon className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[#D4AF37] transition-colors" />
        <span className="text-xs font-black text-[var(--text-primary)]">{value.toLocaleString('ar-EG')}</span>
      </div>
      <p className="text-[10px] font-bold text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
