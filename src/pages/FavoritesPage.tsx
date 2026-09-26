import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { StoreSettings, Product, UserFavoriteItem } from '../types';
import { productService } from '../lib/data/productService';
import { ProductCard } from '../components/ProductCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import {
  Heart,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  LogIn,
  FolderPlus,
  Folder,
  Edit3,
  Trash2,
  ArrowRightLeft,
  Layers,
  X
} from 'lucide-react';
import {
  CreateGroupModal,
  RenameGroupModal,
  MoveToGroupModal,
} from '../components/wishlist/WishlistModals';

interface FavoritesPageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
}

export function FavoritesPage({ navigate, settings }: FavoritesPageProps) {
  const {
    user,
    loading: authLoading,
    favoriteIds,
    favoritesList,
    wishlistGroups,
    createWishlistGroup,
    renameWishlistGroup,
    deleteWishlistGroup,
    moveFavoriteToGroup,
  } = useAuth();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameModalGroup, setRenameModalGroup] = useState<string | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<string | null>(null);
  const [moveModalProduct, setMoveModalProduct] = useState<{
    id: string;
    name: string;
    currentGroup: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    productService
      .getAllProducts(false)
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

  // Map product IDs to their corresponding favorite item metadata (e.g. groupName)
  const favoriteItemsMap = useMemo(() => {
    const map = new Map<string, UserFavoriteItem>();
    favoritesList.forEach((item) => {
      map.set(item.productId, item);
    });
    return map;
  }, [favoritesList]);

  // All favorited products
  const allFavoriteProducts = useMemo(() => {
    return allProducts.filter((p) => favoriteIds.has(p.id));
  }, [allProducts, favoriteIds]);

  // Products filtered by currently selected group
  const displayedProducts = useMemo(() => {
    if (selectedGroup === 'all') {
      return allFavoriteProducts;
    }
    return allFavoriteProducts.filter((p) => {
      const fav = favoriteItemsMap.get(p.id);
      const itemGroup = fav?.groupName || 'المفضلة العامة';
      return itemGroup === selectedGroup;
    });
  }, [allFavoriteProducts, selectedGroup, favoriteItemsMap]);

  // Count items per group
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allFavoriteProducts.length,
    };
    wishlistGroups.forEach((g) => {
      counts[g] = 0;
    });
    allFavoriteProducts.forEach((p) => {
      const fav = favoriteItemsMap.get(p.id);
      const g = fav?.groupName || 'المفضلة العامة';
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [allFavoriteProducts, wishlistGroups, favoriteItemsMap]);

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
            يرجى تسجيل الدخول للوصول إلى قائمتك المفضلة، وتنظيم المنتجات في مجموعات مخصصة، ومزامنتها عبر جميع أجهزتك.
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

  const handleDeleteGroup = async (groupName: string) => {
    await deleteWishlistGroup(groupName);
    setDeleteConfirmGroup(null);
    if (selectedGroup === groupName) {
      setSelectedGroup('all');
    }
  };

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
            <h1 className="text-xl sm:text-2xl font-black text-[#F8FAFC]">قائمة المفضلة والمجموعات</h1>
            <span className="bg-white/[0.08] text-[#E0B84A] text-xs font-bold px-2.5 py-0.5 rounded-full border border-white/[0.06]">
              {allFavoriteProducts.length} {allFavoriteProducts.length === 1 ? 'منتج' : 'منتجات'}
            </span>
          </div>
          <p className="text-xs text-[#94A3B8]">
            نظّم منتجاتك وأجهزتك المفضلة في مجموعات مخصصة (مثل: أدوات المطبخ، هدايا للمستقبل) لمتابعتها بسهولة
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/25 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>مجموعة جديدة</span>
          </button>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#E0B84A] hover:underline cursor-pointer px-2 py-2"
          >
            <span>تصفح المنتجات</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Wishlist Groups Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[var(--border)]">
        {/* All Products Tab */}
        <button
          type="button"
          onClick={() => setSelectedGroup('all')}
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
            selectedGroup === 'all'
              ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] border-transparent shadow-md'
              : 'glass-panel text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D4AF37]/40'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>جميع الرغبات</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              selectedGroup === 'all' ? 'bg-black/20 text-[#05080D]' : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
            }`}
          >
            {groupCounts['all'] || 0}
          </span>
        </button>

        {/* Custom Groups Tabs */}
        {wishlistGroups.map((group) => {
          const isSelected = selectedGroup === group;
          const count = groupCounts[group] || 0;
          return (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] border-transparent shadow-md'
                  : 'glass-panel text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D4AF37]/40'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{group}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-black/20 text-[#05080D]' : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        {/* Add Group Quick Tab */}
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border border-dashed border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>+ إنشاء مجموعة</span>
        </button>
      </div>

      {/* Selected Custom Group Action Toolbar (if a custom group is selected) */}
      {selectedGroup !== 'all' && (
        <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">{selectedGroup}</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                {displayedProducts.length} {displayedProducts.length === 1 ? 'منتج محفوظ' : 'منتجات محفوظة'} في هذه المجموعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {selectedGroup !== 'المفضلة العامة' && (
              <>
                <button
                  type="button"
                  onClick={() => setRenameModalGroup(selectedGroup)}
                  className="px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[#D4AF37] flex items-center gap-1.5 rounded-lg border border-[var(--border)] hover:border-[#D4AF37]/40 bg-[var(--surface)] transition-colors cursor-pointer"
                  title="تعديل اسم المجموعة"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل الاسم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmGroup(selectedGroup)}
                  className="px-3 py-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/10 transition-colors cursor-pointer"
                  title="حذف المجموعة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المجموعة</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty State for All Favorites or Group */}
      {displayedProducts.length === 0 ? (
        <div className="glass-panel-elevated rounded-3xl p-10 sm:p-16 text-center space-y-5 border border-white/[0.08]">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#64748B]">
            {selectedGroup === 'all' ? (
              <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 text-[#94A3B8]" />
            ) : (
              <Folder className="w-8 h-8 sm:w-10 sm:h-10 text-[#D4AF37]" />
            )}
          </div>

          <div className="space-y-2 max-w-sm mx-auto">
            <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
              {selectedGroup === 'all'
                ? 'قائمة المفضلة فارغة حالياً'
                : `المجموعة "${selectedGroup}" فارغة حالياً`}
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {selectedGroup === 'all'
                ? 'لم تقم بإضافة أي منتجات إلى قائمتك المفضلة بعد. تصفح أحدث الأجهزة والإلكترونيات وانقر على رمز القلب لحفظها.'
                : 'يمكنك نقل أي منتج من المفضلة العامة إلى هذه المجموعة، أو تصفح المنتجات وإضافتها.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {selectedGroup !== 'all' && allFavoriteProducts.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedGroup('all')}
                className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
              >
                عرض كل الرغبات ({allFavoriteProducts.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-xs rounded-xl shadow-lg hover:brightness-110 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>تصفح المنتجات الآن</span>
            </button>
          </div>
        </div>
      ) : (
        /* Favorites Grid with Group Action Bar on Each Card */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {displayedProducts.map((product) => {
            const favItem = favoriteItemsMap.get(product.id);
            const currentGroup = favItem?.groupName || 'المفضلة العامة';

            return (
              <div key={product.id} className="flex flex-col justify-between space-y-2">
                <ProductCard
                  product={product}
                  onSelect={(slug) => navigate(`/product/${slug}`)}
                  whatsappNumber={settings.whatsappNumber}
                  showQuickWhatsApp={true}
                />

                {/* Group Tag & Move To Group Quick Button */}
                <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-between gap-1 text-[11px]">
                  <div
                    className="flex items-center gap-1.5 min-w-0 text-[var(--text-secondary)]"
                    title={`المجموعة: ${currentGroup}`}
                  >
                    <Folder className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    <span className="truncate font-bold text-[10px] sm:text-[11px] text-[var(--text-primary)]">
                      {currentGroup}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMoveModalProduct({
                        id: product.id,
                        name: product.name,
                        currentGroup,
                      })
                    }
                    className="text-[10px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1 shrink-0 p-1 cursor-pointer hover:bg-[var(--surface)] rounded-md transition-colors"
                    title="نقل المنتج إلى مجموعة أخرى"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>نقل</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createWishlistGroup}
        existingGroups={wishlistGroups}
      />

      {/* Rename Group Modal */}
      <RenameGroupModal
        isOpen={!!renameModalGroup}
        onClose={() => setRenameModalGroup(null)}
        currentName={renameModalGroup || ''}
        onRename={renameWishlistGroup}
      />

      {/* Move Product to Group Modal */}
      <MoveToGroupModal
        isOpen={!!moveModalProduct}
        onClose={() => setMoveModalProduct(null)}
        productId={moveModalProduct?.id || ''}
        productName={moveModalProduct?.name || ''}
        currentGroup={moveModalProduct?.currentGroup || 'المفضلة العامة'}
        groups={wishlistGroups}
        onMove={moveFavoriteToGroup}
        onCreateGroup={createWishlistGroup}
      />

      {/* Delete Group Confirmation Modal */}
      {deleteConfirmGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            dir="rtl"
            className="w-full max-w-sm bg-[#0D1520] border border-[var(--border)] rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 className="w-4 h-4" />
                <h3 className="text-sm font-black text-[var(--text-primary)]">تأكيد حذف المجموعة</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmGroup(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              هل أنت متأكد من رغبتك في حذف مجموعة <strong className="text-[var(--text-primary)]">"{deleteConfirmGroup}"</strong>؟
              <br />
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                ملاحظة: لن يتم حذف المنتجات، بل سيتم نقلها تلقائياً إلى "المفضلة العامة".
              </span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeleteConfirmGroup(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGroup(deleteConfirmGroup)}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
              >
                حذف ونقل المنتجات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
