import React, { useEffect, useState } from 'react';
import { authService } from '../../lib/data/authService';
import { StoreSettings } from '../../types';
import { ThemeToggle } from '../../components/ThemeToggle';
import { StoreLogo } from '../../components/StoreLogo';
import {
  LayoutDashboard,
  Package,
  Layers,
  Settings,
  LogOut,
  ExternalLink,
  Shield,
  Menu,
  X,
  Loader2,
  Sparkles,
  ClipboardList,
  Star,
  Bell,
  Ticket,
  TrendingUp,
  Flame,
  History,
  CreditCard,
  Gift,
  Building2
} from 'lucide-react';

interface AdminLayoutProps {
  currentPath: string;
  navigate: (path: string) => void;
  settings: StoreSettings;
  children: React.ReactNode;
}

export function AdminLayout({ currentPath, navigate, settings, children }: AdminLayoutProps) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string>('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthState((user, isAdmin) => {
      if (!user) {
        setAuthorized(false);
        navigate('/login');
      } else if (!isAdmin) {
        setAuthorized(false);
        navigate('/');
      } else {
        setAuthorized(true);
        if (user.email) {
          setCurrentAdminEmail(user.email);
        }
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] text-[var(--text-primary)] gap-4" dir="rtl">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
        <p className="text-sm font-semibold text-[var(--text-secondary)]">جاري التحقق من صلاحيات الإدارة المعتمدة...</p>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const menuItems = [
    { label: 'نظرة عامة', path: '/admin', icon: LayoutDashboard },
    { label: 'الإحصائيات والتحليلات', path: '/admin/analytics', icon: TrendingUp },
    { label: 'العروض والفلاش سيل', path: '/admin/promotions', icon: Flame },
    { label: 'العروض المركبة (Bundles)', path: '/admin/bundles', icon: Gift },
    { label: 'الطلبات', path: '/admin/orders', icon: ClipboardList },
    { label: 'المراجعات والتقييمات', path: '/admin/reviews', icon: Star },
    { label: 'كوبونات الخصم', path: '/admin/coupons', icon: Ticket },
    { label: 'التنبيهات والإشعارات', path: '/admin/notifications', icon: Bell },
    { label: 'إدارة الصفحة الرئيسية', path: '/admin/homepage', icon: Sparkles },
    { label: 'المنتجات', path: '/admin/products', icon: Package },
    { label: 'الشركات (Brands)', path: '/admin/companies', icon: Building2 },
    { label: 'الأقسام', path: '/admin/categories', icon: Layers },
    { label: 'التقسيط', path: '/admin/installments', icon: CreditCard },
    { label: 'تأمين فوري', path: '/admin/insurance', icon: Shield },
    { label: 'سجل التغييرات', path: '/admin/audit-logs', icon: History },
    { label: 'الإعدادات', path: '/admin/settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col md:flex-row relative transition-colors duration-200" dir="rtl">
      {/* Background ambient lighting */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-sky-600/5 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* Mobile Header Bar */}
      <div className="md:hidden sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] cursor-pointer"
            aria-label="القائمة"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div
            onClick={() => navigate('/admin')}
            className="cursor-pointer flex items-center gap-2 select-none"
          >
            <StoreLogo 
              settings={settings}
              className="h-6 w-auto object-contain"
            />
            <span className="text-xs font-bold text-[var(--text-primary)]">لوحة الإدارة</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => navigate('/')}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">المتجر</span>
          </button>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-md transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 z-50 md:z-20
          h-screen w-64 shrink-0
          bg-[var(--surface)] border-l border-[var(--border)]
          flex flex-col justify-between
          transition-transform duration-200 ease-in-out
          shadow-xl md:shadow-none
          ${mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}
      >
        <div>
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div
              onClick={() => {
                navigate('/admin');
                setMobileSidebarOpen(false);
              }}
              className="cursor-pointer flex items-center gap-2.5 select-none transition-opacity hover:opacity-85"
              title={settings.storeName}
            >
              <StoreLogo 
                settings={settings}
                className="h-6 w-auto object-contain shrink-0"
              />
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-xs font-black text-[var(--text-primary)] leading-tight truncate">
                  لوحة الإدارة
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] font-medium leading-none mt-0.5 truncate">
                  {settings.storeName || 'البيت السعيد'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-md"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5 mt-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold
                    transition-all cursor-pointer text-right
                    ${
                      isActive
                        ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4AF37]' : 'text-[var(--text-secondary)]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom: Admin Account & Actions */}
        <div className="p-3.5 border-t border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)]">
            <span className="text-xs font-bold text-[var(--text-primary)]">مظهر اللوحة:</span>
            <ThemeToggle showLabel className="px-2.5 py-1 text-xs" />
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[#D4AF37]/40 transition-all cursor-pointer shadow-sm"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-[#D4AF37]" />
              <span>معاينة المتجر</span>
            </span>
          </button>

          {/* Admin User Info */}
          <div className="p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <Shield className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>حساب المدير المعتمد</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate" dir="ltr">
              {currentAdminEmail}
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
