import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from './lib/router';
import { settingsService } from './lib/data/settingsService';
import { StoreSettings } from './types';
import { DEFAULT_STORE_SETTINGS } from './lib/data/seedData';
import { AuthProvider, useAuth } from './lib/authContext';
import { ThemeProvider } from './lib/themeContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Public Components & Pages (Commented for isolation)
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LoginPromptModal } from './components/LoginPromptModal';
import { BackToTop } from './components/BackToTop';
import { MobileBottomNav } from './components/MobileBottomNav';
import { NotFoundPage } from './pages/NotFoundPage';

import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { LoginPage } from './pages/LoginPage';

import { ProductsPage } from './pages/ProductsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CategoryDetailPage } from './pages/CategoryDetailPage';
import { ProductDetailPage } from './pages/ProductDetailPage';

import { ProfilePage } from './pages/ProfilePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { InvoicePrintPage } from './pages/InvoicePrintPage';

// Admin Components & Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminHomepagePage } from './pages/admin/AdminHomepagePage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminCouponsPage } from './pages/admin/AdminCouponsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage';
import { AdminAuditLogPage } from './pages/admin/AdminAuditLogPage';
import { AdminInstallmentsPage } from './pages/admin/AdminInstallmentsPage';
import { AdminInsurancePage } from './pages/admin/AdminInsurancePage';

function StoreApp() {
  const { currentPath, navigate } = useRouter();
  const { loginPromptOpen, closeLoginPrompt, toastMessage } = useAuth();
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  useEffect(() => {
    async function initSettings() {
      try {
        const data = await settingsService.getSettings();
        setSettings(data);
      } catch (e) {
        console.warn('Using default settings fallback:', e);
      }
    }
    initSettings();
  }, []);

  // Parse path & parameters
  const { route, param, searchParams, isNotFound } = useMemo(() => {
    const urlParts = currentPath.split('?');
    const pathOnly = urlParts[0] || '/';
    const queryString = urlParts[1] || '';
    const params = new URLSearchParams(queryString);

    // Static mapping
    const staticRoutes = [
      '/', '/products', '/offers', '/categories', '/category', '/about', '/contact', 
      '/login', '/profile', '/favorites', '/cart', '/checkout', '/admin'
    ];
    
    // Dynamic routes check
    if (pathOnly.startsWith('/product/')) {
      const raw = pathOnly.replace('/product/', '');
      let param = raw;
      try {
        param = decodeURIComponent(raw);
      } catch {}
      return { route: 'product-detail', param, searchParams: params, isNotFound: false };
    }
    if (pathOnly.startsWith('/categories/') || pathOnly.startsWith('/category/')) {
      const raw = pathOnly.startsWith('/categories/') ? pathOnly.replace('/categories/', '') : pathOnly.replace('/category/', '');
      let param = raw;
      try {
        param = decodeURIComponent(raw);
      } catch {}
      return { route: 'category-detail', param, searchParams: params, isNotFound: false };
    }
    if (pathOnly.startsWith('/order-confirmation')) {
      const raw = pathOnly.replace('/order-confirmation/', '').replace('/order-confirmation', '');
      let param = raw;
      try {
        param = decodeURIComponent(raw);
      } catch {}
      const orderId = param || params.get('orderId') || params.get('id') || '';
      return { route: 'order-confirmation', param: orderId, searchParams: params, isNotFound: false };
    }
    if (pathOnly.startsWith('/invoice/') || pathOnly === '/invoice') {
      const raw = pathOnly.replace('/invoice/', '').replace('/invoice', '');
      let param = raw;
      try {
        param = decodeURIComponent(raw);
      } catch {}
      const orderId = param || params.get('id') || params.get('orderId') || '';
      return { route: 'invoice-print', param: orderId, searchParams: params, isNotFound: false };
    }

    const isMatched = staticRoutes.some(sr => pathOnly === sr || (pathOnly.startsWith('/admin') && sr === '/admin'));
    
    return { 
      route: pathOnly, 
      param: '', 
      searchParams: params, 
      isNotFound: !isMatched && !pathOnly.startsWith('/admin')
    };
  }, [currentPath]);

  // State to track if a fullscreen viewer (like zoom) is active
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  useEffect(() => {
    const handleHide = () => setIsFullscreenActive(true);
    const handleShow = () => setIsFullscreenActive(false);

    window.addEventListener('hide-bottom-nav', handleHide);
    window.addEventListener('show-bottom-nav', handleShow);
    return () => {
      window.removeEventListener('hide-bottom-nav', handleHide);
      window.removeEventListener('show-bottom-nav', handleShow);
    };
  }, []);

  // Is this an admin route?
  const isAdminRoute = currentPath.startsWith('/admin');
  const isAdminLogin = currentPath === '/admin/login';

  // Determine if mobile bottom navigation should be shown
  const shouldShowBottomNav = useMemo(() => {
    if (isAdminRoute) return false;
    if (isFullscreenActive) return false;
    const pathOnly = currentPath.split('?')[0] || '/';
    
    // Completely hide bottom nav only for the standalone print invoice layout
    if (pathOnly.startsWith('/invoice') || route === 'invoice-print') return false;
    
    return true;
  }, [isAdminRoute, isFullscreenActive, currentPath, route]);

  // Determine if main content needs bottom padding (for bottom nav or product details sticky bar)
  const hasBottomStickyBar = useMemo(() => {
    if (isAdminRoute) return false;
    const pathOnly = currentPath.split('?')[0] || '/';
    if (pathOnly.startsWith('/invoice') || route === 'invoice-print') return false;
    return true; // Keep bottom safe padding active to ensure last elements are scrollable
  }, [isAdminRoute, route, currentPath]);

  // Determine the mobile action bar height dynamically based on route
  const mobileActionBarHeight = useMemo(() => {
    const pathOnly = currentPath.split('?')[0] || '/';
    if (pathOnly.startsWith('/product/') || route === 'product-detail') {
      return '72px'; // Height of the sticky buy/whatsapp bar on product page
    }
    if (pathOnly === '/cart') {
      return '80px'; // Height of the sticky checkout bar on cart page
    }
    return '0px';
  }, [currentPath, route]);

  const totalReservedPadding = useMemo(() => {
    if (!shouldShowBottomNav) return '0px';
    // Base bottom nav is 64px, then we add the action bar if present, and 24px of breathing space
    return `calc(var(--mobile-bottom-nav-height, 64px) + ${mobileActionBarHeight} + 24px)`;
  }, [shouldShowBottomNav, mobileActionBarHeight]);

  // Render public page
  const renderPublicPage = () => {
    if (isNotFound) {
      return <NotFoundPage navigate={navigate} type="page" />;
    }

    switch (route) {
      case '/':
        return <HomePage navigate={navigate} />;
      case '/products':
        return (
          <ProductsPage
            navigate={navigate}
            initialQuery={searchParams.get('q') || ''}
            initialCategory={searchParams.get('category') || 'all'}
            initialFeatured={searchParams.get('featured') === 'true'}
          />
        );
      case '/offers':
        return (
          <ProductsPage
            navigate={navigate}
            initialQuery=""
            initialCategory="all"
            initialFeatured={true}
          />
        );
      case '/categories':
      case '/category':
        return <CategoriesPage navigate={navigate} />;
      case 'category-detail':
        return <CategoryDetailPage slug={param} navigate={navigate} />;
      case 'product-detail':
        return <ProductDetailPage slug={param} navigate={navigate} />;
      case '/about':
        return <AboutPage settings={settings} navigate={navigate} />;
      case '/contact':
        return <ContactPage settings={settings} />;
      case '/login':
        return <LoginPage navigate={navigate} settings={settings} />;
      case '/profile':
        return <ProfilePage navigate={navigate} settings={settings} />;
      case '/favorites':
        return <FavoritesPage navigate={navigate} settings={settings} />;
      case '/cart':
        return <CartPage navigate={navigate} settings={settings} />;
      case '/checkout':
        return <CheckoutPage navigate={navigate} settings={settings} />;
      case 'order-confirmation':
      case '/order-confirmation':
        return <OrderConfirmationPage orderId={param} navigate={navigate} settings={settings} />;
      default:
        return <HomePage navigate={navigate} />;
    }
  };

  // Render admin content
  const renderAdminContent = () => {
    switch (route) {
      case '/admin':
        return <AdminDashboardPage navigate={navigate} />;
      case '/admin/homepage':
        return <AdminHomepagePage navigate={navigate} />;
      case '/admin/products':
        return <AdminProductsPage />;
      case '/admin/categories':
        return <AdminCategoriesPage />;
      case '/admin/orders':
        return <AdminOrdersPage />;
      case '/admin/reviews':
        return <AdminReviewsPage navigate={navigate} />;
      case '/admin/notifications':
        return <AdminNotificationsPage navigate={navigate} />;
      case '/admin/coupons':
        return <AdminCouponsPage />;
      case '/admin/analytics':
        return <AdminAnalyticsPage />;
      case '/admin/promotions':
        return <AdminPromotionsPage />;
      case '/admin/audit-logs':
        return <AdminAuditLogPage />;
      case '/admin/installments':
        return <AdminInstallmentsPage />;
      case '/admin/insurance':
        return <AdminInsurancePage />;
      case '/admin/settings':
        return <AdminSettingsPage onSettingsUpdated={(newSetts) => setSettings(newSetts)} />;
      default:
        return <AdminDashboardPage navigate={navigate} />;
    }
  };

  // Render standalone invoice page if on /invoice route
  if (route === 'invoice-print') {
    return <InvoicePrintPage orderId={param} navigate={navigate} />;
  }

  return (
    <div 
      className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] font-['Cairo',sans-serif] selection:bg-[#D6A62E]/30 flex flex-col justify-between relative overflow-x-hidden" 
      dir="rtl"
      style={{
        '--mobile-bottom-nav-height': shouldShowBottomNav ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : '0px',
        '--mobile-action-bar-height': mobileActionBarHeight,
        '--mobile-safe-area-bottom': 'env(safe-area-inset-bottom, 0px)',
        '--total-reserved-padding': totalReservedPadding
      } as React.CSSProperties}
    >
      {/* Ambient background lighting effects for physical glass depth */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden dark:block hidden" aria-hidden="true">
        {/* Soft dark navy orb top right */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#0A1A30]/40 blur-[130px]" />
        {/* Subtle warm amber/gold atmospheric glow top center/left */}
        <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] rounded-full bg-[#D6A62E]/[0.035] blur-[140px]" />
        {/* Soft deep blue glow bottom */}
        <div className="absolute -bottom-40 right-1/3 w-[700px] h-[700px] rounded-full bg-[#081526]/50 blur-[150px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen justify-between">
        {isAdminRoute ? (
          isAdminLogin ? (
            <AdminLoginPage
              navigate={navigate}
              settings={settings}
              onLoginSuccess={() => navigate('/admin')}
            />
          ) : (
            <AdminLayout
              currentPath={route}
              navigate={navigate}
              settings={settings}
            >
              {renderAdminContent()}
            </AdminLayout>
          )
        ) : (
          <div 
            className="flex flex-col min-h-screen justify-between flex-1"
            style={{ paddingBottom: 'var(--total-reserved-padding, 0px)' }}
          >
            <Header currentPath={currentPath} navigate={navigate} settings={settings} />
            <main className="flex-1">{renderPublicPage()}</main>
            <Footer settings={settings} navigate={navigate} />
            <BackToTop />
            {shouldShowBottomNav && (
              <MobileBottomNav currentPath={currentPath} navigate={navigate} />
            )}
          </div>
        )}
      </div>

      {/* Global Guest Login Prompt Modal */}
      <LoginPromptModal
        isOpen={loginPromptOpen}
        onClose={closeLoginPrompt}
        onNavigateToLogin={() => navigate('/login')}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-80 bg-[#0A1A30]/95 backdrop-blur-md border border-[#D4AF37]/30 p-4 rounded-xl shadow-[0_12px_40px_rgba(212,175,55,0.15)] flex items-center gap-3 z-[2000] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#E0B84A] shrink-0">
            🔔
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-[#F8FAFC]">تنبيه</p>
            <p className="text-[11px] text-[#E2E8F0] mt-0.5">{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <StoreApp />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
