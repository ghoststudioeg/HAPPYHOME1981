import React from 'react';
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';

interface MobileBottomNavProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export function MobileBottomNav({ currentPath, navigate }: MobileBottomNavProps) {
  const { user, cartCount } = useAuth();
  const { isDark } = useTheme();

  // Highlight active item
  const getActiveTab = () => {
    const pathOnly = currentPath.split('?')[0] || '/';
    if (pathOnly === '/') return 'home';
    if (
      pathOnly === '/categories' || 
      pathOnly.startsWith('/category/') || 
      pathOnly === '/category' || 
      pathOnly === '/category-detail' || 
      pathOnly.startsWith('/category-detail')
    ) return 'categories';
    if (pathOnly === '/cart' || pathOnly === '/checkout') return 'cart';
    if (
      pathOnly === '/profile' || 
      pathOnly === '/login' || 
      pathOnly === '/favorites' || 
      pathOnly === '/orders' || 
      pathOnly.startsWith('/orders/') || 
      pathOnly.startsWith('/profile')
    ) return 'account';
    return '';
  };

  const activeTab = getActiveTab();

  const handleSearchClick = () => {
    // Dispatch a custom event to toggle the mobile search bar in Header.tsx
    window.dispatchEvent(new CustomEvent('toggle-mobile-search'));
  };

  const handleAccountClick = () => {
    if (user) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  const navItems = [
    {
      id: 'home',
      label: 'الرئيسية',
      icon: Home,
      onClick: () => navigate('/'),
    },
    {
      id: 'categories',
      label: 'الأقسام',
      icon: Grid,
      onClick: () => navigate('/categories'),
    },
    {
      id: 'search',
      label: 'البحث',
      icon: Search,
      onClick: handleSearchClick,
    },
    {
      id: 'cart',
      label: 'السلة',
      icon: ShoppingBag,
      onClick: () => navigate('/cart'),
      badge: cartCount,
    },
    {
      id: 'account',
      label: 'حسابي',
      icon: User,
      onClick: handleAccountClick,
    },
  ];

  return (
    <nav 
      id="mobile-bottom-nav"
      className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden px-4 border-t flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-200 select-none ${
        isDark 
          ? 'bg-[#07111C]/90 border-white/[0.08] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]' 
          : 'bg-white/95 border-slate-200/80 shadow-[0_-8px_25px_rgba(0,0,0,0.06)]'
      }`}
      style={{
        height: 'var(--mobile-bottom-nav-height)',
        paddingBottom: 'var(--mobile-safe-area-bottom, 0px)'
      }}
      dir="rtl"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl relative transition-all duration-200 cursor-pointer ${
              isActive 
                ? isDark
                  ? 'text-[#E0B84A] bg-[#D4AF37]/10'
                  : 'text-[#8A6B10] bg-[#D4AF37]/15'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={{ minWidth: '60px', minHeight: '44px' }}
            aria-label={item.label}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-[2px]'}`} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[var(--background)] animate-pulse">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight select-none whitespace-nowrap">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
