import { getValidImageSrc, isValidImageSrc } from '../utils/imageUtils';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Menu, X, Shield, Phone, MessageCircle, AlertCircle, Heart, LogIn, User as UserIcon, LogOut, ChevronDown, ShoppingCart, Bell, Clock } from 'lucide-react';
import { StoreSettings, Product } from '../types';
import { catalogService } from '../lib/data/catalogService';
import { productService } from '../lib/data/productService';
import { searchProducts } from '../lib/searchUtils';
import { useAuth } from '../lib/authContext';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';


interface HeaderProps {
  currentPath: string;
  navigate: (path: string) => void;
  settings: StoreSettings;
}

export function Header({ currentPath, navigate, settings }: HeaderProps) {
  const { user, profile, isAdmin, signOut, favoritesList, cartCount } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userInitials = (profile?.displayName || user?.displayName || user?.email || 'ع')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const whatsAppUrl = catalogService.getWhatsAppUrl(settings.whatsappNumber);

  const updateDropdownCoords = () => {
    if (avatarButtonRef.current) {
      const rect = avatarButtonRef.current.getBoundingClientRect();
      const menuWidth = 240; // w-60 is 240px
      const viewportWidth = window.innerWidth;
      
      let left = rect.left;
      if (left + menuWidth > viewportWidth - 16) {
        left = viewportWidth - menuWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      setDropdownCoords({
        top: rect.bottom + 8,
        left: left
      });
    }
  };

  useEffect(() => {
    if (userMenuOpen) {
      updateDropdownCoords();
      window.addEventListener('resize', updateDropdownCoords, { passive: true });
      window.addEventListener('scroll', updateDropdownCoords, { passive: true });
    }
    return () => {
      window.removeEventListener('resize', updateDropdownCoords);
      window.removeEventListener('scroll', updateDropdownCoords);
    };
  }, [userMenuOpen]);

  // Lazy load products for header search index
  useEffect(() => {
    let isMounted = true;
    productService.getAllProducts(false).then((prods) => {
      if (isMounted) setProducts(prods);
    }).catch(err => console.warn('Could not preload products for header search', err));
    return () => { isMounted = false; };
  }, []);

  // Filter products in real time with intelligent normalization and synonym support
  const trimmed = searchQuery.trim();
  const searchResults = trimmed ? searchProducts(products, trimmed, 8) : [];

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(target) &&
        mobileSearchRef.current &&
        !mobileSearchRef.current.contains(target)
      ) {
        setIsSearchFocused(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setIsSearchFocused(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Listen for mobile bottom navigation search toggling
  useEffect(() => {
    function handleToggleMobileSearch() {
      setSearchOpen((prev) => {
        const next = !prev;
        if (next) {
          setIsSearchFocused(true);
          // Auto focus the mobile search input
          setTimeout(() => {
            const mobileInput = document.querySelector('input[placeholder="ابحث بالاسم أو الموديل أو القسم..."]') as HTMLInputElement;
            if (mobileInput) {
              mobileInput.focus();
            }
          }, 120);
        }
        return next;
      });
    }

    window.addEventListener('toggle-mobile-search', handleToggleMobileSearch);
    return () => {
      window.removeEventListener('toggle-mobile-search', handleToggleMobileSearch);
    };
  }, []);

  const navLinks = [
    { label: 'الرئيسية', path: '/' },
    { label: 'المنتجات', path: '/products' },
    { label: 'الأقسام', path: '/categories' },
    { label: 'عن المتجر', path: '/about' },
    { label: 'تواصل معنا', path: '/contact' }
  ];

  const handleProductSelect = (slug: string) => {
    setIsSearchFocused(false);
    setSearchOpen(false);
    setMobileMenuOpen(false);
    setSearchQuery('');
    navigate(`/product/${slug}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchFocused(false);
      setSearchOpen(false);
      setMobileMenuOpen(false);
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full" dir="rtl">
      {/* Floating Glass Navbar Container */}
      <div className="glass-nav relative liquid-reflection">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Right side: Brand Logo + Desktop Nav */}
          <div className="flex items-center gap-3 sm:gap-8 min-w-0">
            <div
              onClick={() => navigate('/')}
              className="cursor-pointer flex items-center select-none transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] shrink-0"
              title={settings.storeName}
            >
              <Logo size="md" />
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold">
              {navLinks.map((link) => {
                const isActive = currentPath === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--surface-elevated)] text-[#E0B84A] border border-[#D4AF37]/30 shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Left side: Search & Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2.5">
            
            {/* Desktop Instant Live Search */}
            <div className="hidden sm:block relative" ref={searchContainerRef}>
              <form onSubmit={handleSearchSubmit} className="relative items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="ابحث بالاسم، SKU، أو القسم..."
                  className="glass-input rounded-full py-2.5 pr-9 pl-8 text-xs w-56 md:w-64 lg:w-76 placeholder-[var(--text-muted)] transition-all focus:w-72 md:focus:w-80 lg:focus:w-92"
                />
                <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute right-3 top-3 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }}
                    className="absolute left-3 top-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Desktop Instant Results Dropdown */}
              {isSearchFocused && trimmed.length > 0 && (
                <div className="absolute top-full right-0 w-80 md:w-96 mt-2 glass-panel-elevated rounded-2xl overflow-hidden z-50 divide-y divide-[var(--border)] animate-in fade-in-50 duration-150">
                  <div className="px-4 py-2.5 bg-[var(--surface-elevated)] text-[var(--text-secondary)] text-[11px] font-semibold flex items-center justify-between border-b border-[var(--border)]">
                    <span>نتائج البحث الفوري ({searchResults.length})</span>
                    <span className="text-[10px] text-[var(--text-muted)]">انقر للانتقال للمنتج</span>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="py-8 px-4 text-center space-y-1.5">
                      <AlertCircle className="w-5 h-5 text-amber-400 mx-auto opacity-80" />
                      <p className="text-xs font-bold text-[var(--text-primary)]">لا توجد نتائج مطابقة لبحثك</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">جرب البحث بكلمات أخرى أو كود SKU</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
                      {searchResults.map((prod) => {
                        const discount = prod.oldPrice && prod.oldPrice > prod.price
                          ? Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100)
                          : null;

                        return (
                          <div
                            key={prod.id}
                            onClick={() => handleProductSelect(prod.slug)}
                            className="p-3 hover:bg-[var(--surface-elevated)] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img
                                src={getValidImageSrc(prod.mainImageUrl || '/logo.svg')}
                                alt={prod.name}
                                className="w-10 h-10 rounded-lg object-contain bg-[var(--surface)] p-1 shrink-0 border border-[var(--border)]"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {prod.categoryName && (
                                    <span className="text-[9px] font-semibold text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded">
                                      {prod.categoryName}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono text-[var(--text-muted)]">{prod.sku}</span>
                                </div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[#E0B84A] transition-colors truncate">
                                  {prod.name}
                                </h4>
                              </div>
                            </div>

                            <div className="text-left shrink-0 flex flex-col items-end">
                              <span className="text-xs font-black text-[#E0B84A]">
                                {prod.price.toLocaleString('ar-EG')} <span className="text-[9px] text-[#D4AF37]">ج.م</span>
                              </span>
                              {prod.oldPrice && prod.oldPrice > prod.price && (
                                <span className="text-[9.5px] text-[#64748B] line-through">
                                  {prod.oldPrice.toLocaleString('ar-EG')}
                                </span>
                              )}
                              {discount && (
                                <span className="text-[8px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1 rounded mt-0.5">
                                  خصم {discount}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Search Icon Button */}
            <button
              onClick={() => {
                setSearchOpen(!searchOpen);
                setIsSearchFocused(true);
              }}
              className="hidden w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl glass-pill items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer shrink-0"
              aria-label="بحث في المتجر"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* WhatsApp Quick Direct Button */}
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold glass-pill hover:border-emerald-500/40 hover:text-emerald-300 transition-all"
              title="تواصل مباشر عبر واتساب"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>استفسار واتساب</span>
            </a>

            {/* Shopping Cart Icon Button with Live Item-Count Badge */}
            <button
              onClick={() => navigate('/cart')}
              className="hidden sm:flex relative w-10 h-10 lg:w-11 lg:h-11 rounded-xl glass-pill items-center justify-center text-[var(--text-secondary)] hover:text-[#E0B84A] border border-[var(--border)] hover:border-[#D4AF37]/30 transition-all cursor-pointer active:scale-95 shrink-0"
              title="سلة المشتريات"
              aria-label="عرض سلة المشتريات"
            >
              <ShoppingCart className="w-4 h-4 sm:w-4.5 sm:h-4.5 lg:w-5 lg:h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] text-[9px] sm:text-[10px] font-black w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center shadow-md border border-[var(--background)]">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Notification Bell */}
            <NotificationBell navigate={navigate} />

            {/* Theme Toggle Button */}
            <ThemeToggle className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 shrink-0 flex items-center justify-center" />

            {/* Unified Auth Action */}
            {!user ? (
              <button
                onClick={() => navigate('/login')}
                className="hidden sm:flex h-10 px-3.5 rounded-xl text-xs font-black bg-[var(--surface-elevated)] hover:bg-[#D4AF37] text-[var(--text-primary)] hover:text-[#05080D] border border-[var(--border)] hover:border-transparent transition-all items-center gap-1 shadow-sm cursor-pointer active:scale-98 shrink-0"
                title="تسجيل الدخول"
              >
                <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">تسجيل الدخول</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 sm:gap-2" ref={userMenuRef}>
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="hidden sm:flex h-10 px-3.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] hover:brightness-110 text-[#05080D] transition-all items-center gap-1.5 shadow-[0_2px_14px_rgba(212,175,55,0.25)] cursor-pointer"
                    title="لوحة تحكم المشرف"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>لوحة المشرف</span>
                  </button>
                )}

                {/* Profile Circular Avatar - Direct on dark glass header */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <button
                    ref={avatarButtonRef}
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="relative w-9 h-9 sm:w-10 sm:h-10 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] max-w-[36px] max-h-[36px] sm:max-w-[40px] sm:max-h-[40px] rounded-full overflow-hidden shrink-0 ring-2 ring-[#D4AF37]/50 hover:ring-[#D4AF37] transition-all shadow-md cursor-pointer focus:outline-hidden flex items-center justify-center bg-[#0E1E2E] select-none p-0"
                    style={{ aspectRatio: '1 / 1', borderRadius: '9999px' }}
                    aria-label="قائمة الحساب"
                    title={profile?.displayName || user.displayName || user.email || 'حسابي'}
                  >
                    {profile?.photoURL || user.photoURL ? (
                      <img
                        src={getValidImageSrc(profile?.photoURL || user.photoURL )}
                        alt="الصورة الشخصية"
                        className="w-full h-full object-cover shrink-0 block pointer-events-none"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px', aspectRatio: '1 / 1' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#0E1E2E] to-[#1E293B] flex items-center justify-center text-xs sm:text-sm font-black text-[#E0B84A] select-none">
                        {userInitials}
                      </div>
                    )}
                  </button>

                  {/* Portalized Dropdown Menu */}
                  {userMenuOpen && dropdownCoords && createPortal(
                    <div
                      ref={dropdownRef}
                      style={{
                        position: 'fixed',
                        top: `${dropdownCoords.top}px`,
                        left: `${dropdownCoords.left}px`,
                      }}
                      className="w-60 rounded-2xl glass-panel-elevated p-2 shadow-xl border border-[var(--border)] z-[1000] animate-in fade-in zoom-in-95 duration-150 text-right"
                      dir="rtl"
                    >
                      {/* User Header */}
                      <div className="p-3 border-b border-[var(--border)] space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[var(--text-primary)] truncate">
                            {profile?.displayName || user.displayName || 'عميل المتجر'}
                          </p>
                          {isAdmin ? (
                            <span className="text-[10px] font-bold text-[#E0B84A] bg-[#D4AF37]/15 px-2 py-0.5 rounded-md border border-[#D4AF37]/30 shrink-0">
                              مشرف
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-sky-500 bg-sky-500/15 px-2 py-0.5 rounded-md border border-sky-500/30 shrink-0">
                              عميل
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate" dir="ltr">
                          {user.email}
                        </p>
                      </div>

                      {/* Menu Options */}
                      <div className="py-1.5 space-y-0.5">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigate('/profile');
                          }}
                          className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] hover:text-[#E0B84A] transition-colors flex items-center gap-2.5 cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                          <span>حسابي</span>
                        </button>

                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigate('/favorites');
                          }}
                          className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] hover:text-rose-500 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Heart className="w-4 h-4 text-rose-500" />
                            <span>المفضلة</span>
                          </div>
                          {favoritesList.length > 0 && (
                            <span className="bg-rose-500/20 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {favoritesList.length}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigate('/profile?tab=recently_viewed');
                          }}
                          className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] hover:text-[#E0B84A] transition-colors flex items-center gap-2.5 cursor-pointer"
                        >
                          <Clock className="w-4 h-4 text-[#D4AF37]" />
                          <span>شوهدت مؤخرًا</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              navigate('/admin');
                            }}
                            className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold text-[#E0B84A] hover:bg-[#D4AF37]/15 transition-colors flex items-center gap-2.5 cursor-pointer"
                          >
                            <Shield className="w-4 h-4 text-[#E0B84A]" />
                            <span>لوحة المشرف</span>
                          </button>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="pt-1.5 border-t border-[var(--border)]">
                        <button
                          onClick={async () => {
                            setUserMenuOpen(false);
                            await signOut();
                            navigate('/');
                          }}
                          className="w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center gap-2.5 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>تسجيل الخروج</span>
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-pill flex items-center justify-center text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
              aria-label="القائمة الرئيسية"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Instant Live Search Dropdown */}
      {searchOpen && (
        <div ref={mobileSearchRef} className="sm:hidden px-4 py-3 bg-[var(--background)] backdrop-blur-2xl border-b border-[var(--border)] space-y-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchFocused(true);
              }}
              placeholder="ابحث بالاسم أو الموديل أو القسم..."
              autoFocus
              className="w-full glass-input rounded-xl py-3 pr-10 pl-10 text-xs text-[var(--text-primary)]"
            />
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute right-3.5 top-3.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-3.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Mobile Instant Results List */}
          {trimmed.length > 0 && (
            <div className="glass-panel-elevated rounded-xl overflow-hidden divide-y divide-[var(--border)] max-h-72 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                  لا توجد نتائج مطابقة
                </div>
              ) : (
                searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleProductSelect(prod.slug)}
                    className="p-3 hover:bg-[var(--surface-elevated)] flex items-center justify-between gap-2.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img
                        src={getValidImageSrc(prod.mainImageUrl || '/logo.svg')}
                        alt={prod.name}
                        className="w-9 h-9 rounded-lg object-contain bg-[var(--surface-elevated)] p-1 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] text-[#D4AF37] font-semibold">{prod.categoryName}</div>
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">{prod.name}</div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-xs font-black text-[#E0B84A]">
                        {prod.price.toLocaleString('ar-EG')} ج.م
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile Navigation Drawer with Pure Liquid Glass */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[var(--background)] backdrop-blur-3xl border-b border-[var(--border)] px-5 py-5 space-y-4 shadow-2xl animate-in slide-in-from-top-3 duration-200">
          <div className="pb-3 border-b border-[var(--border)] flex items-center justify-between">
            <div
              onClick={() => {
                navigate('/');
                setMobileMenuOpen(false);
              }}
              className="cursor-pointer select-none"
            >
              <Logo size="sm" />
            </div>
            <span className="text-xs font-bold text-[#E0B84A]">
              {settings.tagline || 'قسط كل اللي نفسك فيه'}
            </span>
          </div>

          {/* Mobile User Auth Panel */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] space-y-3">
            {!user ? (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    navigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول / إنشاء حساب</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      navigate('/favorites');
                      setMobileMenuOpen(false);
                    }}
                    className="py-2 px-3 bg-[var(--surface)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-2 rounded-xl transition-colors cursor-pointer border border-[var(--border)]"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>المفضلة</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate('/cart');
                      setMobileMenuOpen(false);
                    }}
                    className="py-2 px-3 bg-[#D4AF37]/10 text-xs font-bold text-[#E0B84A] hover:text-[#D4AF37] flex items-center justify-center gap-2 rounded-xl transition-colors cursor-pointer border border-[#D4AF37]/20"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-[#E0B84A]" />
                    <span>السلة ({cartCount})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* User Identity */}
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-full overflow-hidden shrink-0 ring-2 ring-[#D4AF37]/50 flex items-center justify-center bg-[var(--surface)] select-none p-0"
                    style={{ aspectRatio: '1 / 1', borderRadius: '9999px' }}
                  >
                    {profile?.photoURL || user.photoURL ? (
                      <img
                        src={getValidImageSrc(profile?.photoURL || user.photoURL )}
                        alt="الصورة الشخصية"
                        className="w-full h-full object-cover shrink-0 block pointer-events-none"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9999px', aspectRatio: '1 / 1' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-[var(--surface)] to-[var(--surface-elevated)] flex items-center justify-center text-xs font-black text-[#E0B84A]">
                        {userInitials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-black text-[var(--text-primary)] truncate">
                        {profile?.displayName || user.displayName || 'عميل المتجر'}
                      </p>
                      {isAdmin && (
                        <span className="text-[10px] font-bold text-[#E0B84A] bg-[#D4AF37]/15 px-2 py-0.5 rounded-md">
                          مشرف
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate" dir="ltr">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setMobileMenuOpen(false);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-[11px] font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5 border border-[var(--border)] cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-[#E0B84A]" />
                    <span>حسابي</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate('/favorites');
                      setMobileMenuOpen(false);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-[11px] font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5 border border-[var(--border)] cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>المفضلة</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate('/profile?tab=recently_viewed');
                      setMobileMenuOpen(false);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-elevated)] text-[11px] font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5 border border-[var(--border)] cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>شوهدت</span>
                  </button>
                </div>

                {/* Shopping Cart Shortcut */}
                <button
                  onClick={() => {
                    navigate('/cart');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/25 text-xs font-bold text-[#E0B84A] flex items-center justify-center gap-2 border border-[#D4AF37]/20 cursor-pointer animate-pulse-subtle"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>سلة المشتريات ({cartCount})</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/admin');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#D4AF37]/15 text-[#E0B84A] text-xs font-bold flex items-center justify-center gap-2 border border-[#D4AF37]/30 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>لوحة تحكم المشرف</span>
                  </button>
                )}

                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await signOut();
                    navigate('/');
                  }}
                  className="w-full py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            )}
          </div>

          {/* Links list */}
          <div className="space-y-1">
            <div className="px-4 py-2 flex items-center justify-between bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] mb-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">مظهر المتجر:</span>
              <ThemeToggle showLabel className="px-3 py-1.5" />
            </div>

            {navLinks.map((link) => {
              const isActive = currentPath === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => {
                    navigate(link.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-right px-4 py-3 rounded-xl text-sm font-bold transition-all min-h-[44px] flex items-center justify-between ${
                    isActive
                      ? 'text-[#E0B84A] bg-[var(--surface-elevated)] border border-[#D4AF37]/30'
                      : 'text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                </button>
              );
            })}
          </div>

          {/* Mobile Bottom Contacts */}
          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 py-2.5 px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 font-bold"
            >
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <span>واتساب المتجر</span>
            </a>
            <a
              href={`tel:${settings.phone.replace(/[^0-9]/g, '')}`}
              className="inline-flex items-center gap-1.5 py-2.5 px-3.5 rounded-xl glass-pill font-semibold text-[var(--text-secondary)]"
              dir="ltr"
            >
              <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{settings.phone}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
