import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/authContext';
import { StoreSettings, Product } from '../types';
import { productService } from '../lib/data/productService';
import { ProductCard } from '../components/ProductCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import {
  Heart,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  LogIn
} from 'lucide-react';

interface FavoritesPageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
}

export function FavoritesPage({ navigate, settings }: FavoritesPageProps) {
  const { user, loading: authLoading, favoriteIds } = useAuth();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    productService.getAllProducts(false)
      .then((prods) => {
        if (isMounted) {
          setAllProducts(prods);
          setProductsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error preloading products for favorites resolved:', err);
        if (isMounted) {
          setProductsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter latest product list based on favorited IDs from Firestore
  const favoriteProducts = allProducts.filter((p) => favoriteIds.has(p.id));

  const pageLoading = authLoading || productsLoading;

  if (pageLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8" dir="rtl">
        <LoadingSkeleton type="grid" count={4} />
      </div>
    );
  }

  // If Guest visits /favorites
  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6" dir="rtl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.15)]">
          <Heart className="w-10 h-10 text-[#E0B84A] fill-[#D4AF37]/20" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#F8FAFC]">قائمة المفضلة الخاصة بك</h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed max-w-sm mx-auto">
            يرجى تسجيل الدخول للوصول إلى قائمتك المفضلة ومزامنة أجهزتك ومنتجاتك المحفوظة عبر جميع أجهزتك.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-[#05080D] font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-110 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول الآن</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl glass-pill text-xs font-bold text-[#CBD5E1] hover:text-[#F8FAFC] transition-colors cursor-pointer"
          >
            تصفح المنتجات
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8" dir="rtl">
      {/* Breadcrumb Navigation */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-[#94A3B8]">
        <button
          onClick={() => navigate('/')}
          className="hover:text-[#F8FAFC] transition-colors cursor-pointer"
        >
          الرئيسية
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 rotate-180 shrink-0" />
        <span className="text-[#E0B84A] font-bold">قائمة المفضلة</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Heart className="w-5 h-5 fill-rose-500/20" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#F8FAFC]">قائمة المفضلة</h1>
            <span className="bg-white/[0.08] text-[#E0B84A] text-xs font-bold px-2.5 py-0.5 rounded-full border border-white/[0.06]">
              {favoriteProducts.length} {favoriteProducts.length === 1 ? 'منتج' : 'منتجات'}
            </span>
          </div>
          <p className="text-xs text-[#94A3B8]">
            المنتجات والأجهزة التي قمت بحفظها للرجوع إليها ومتابعة أسعارها في أي وقت
          </p>
        </div>

        <button
          onClick={() => navigate('/products')}
          className="self-start sm:self-auto inline-flex items-center gap-2 text-xs font-bold text-[#E0B84A] hover:underline cursor-pointer"
        >
          <span>تصفح المزيد من المنتجات</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Empty State */}
      {favoriteProducts.length === 0 ? (
        <div className="glass-panel-elevated rounded-3xl p-10 sm:p-16 text-center space-y-5 border border-white/[0.08]">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#64748B]">
            <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 text-[#94A3B8]" />
          </div>

          <div className="space-y-2 max-w-sm mx-auto">
            <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">قائمة المفضلة فارغة حالياً</h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              لم تقم بإضافة أي منتجات إلى قائمتك المفضلة بعد. تصفح أحدث أجهزة الموبايل والإلكترونيات وانقر على رمز القلب لحفظها.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-xs rounded-xl shadow-lg hover:brightness-110 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>تصفح المنتجات الآن</span>
          </button>
        </div>
      ) : (
        /* Favorites Grid using standard ProductCard */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {favoriteProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={(slug) => navigate(`/product/${slug}`)}
              whatsappNumber={settings.whatsappNumber}
              showQuickWhatsApp={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
