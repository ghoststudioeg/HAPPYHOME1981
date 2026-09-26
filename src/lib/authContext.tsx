import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, updateProfile } from 'firebase/auth';
import { authService } from './data/authService';
import { userService } from './data/userService';
import { recentlyViewedService } from './data/recentlyViewedService';
import { UserProfileData, UserFavoriteItem, UserCartItem, ResolvedCartItem, Product, UserRole } from '../types';
import { productService } from './data/productService';

import { analyticsService } from './data/analyticsService';

interface AuthContextType {
  user: User | null;
  profile: UserProfileData | null;
  role: UserRole | 'guest';
  isAdmin: boolean;
  isCustomer: boolean;
  loading: boolean;
  favoritesList: UserFavoriteItem[];
  favoriteIds: Set<string>;
  wishlistGroups: string[];
  createWishlistGroup: (name: string) => Promise<boolean>;
  renameWishlistGroup: (oldName: string, newName: string) => Promise<boolean>;
  deleteWishlistGroup: (name: string) => Promise<boolean>;
  moveFavoriteToGroup: (productId: string, targetGroup: string) => Promise<void>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Product, groupName?: string) => Promise<boolean>;
  updateProfileData: (data: { displayName?: string; phone?: string; address?: string; photoURL?: string }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  loginPromptOpen: boolean;
  openLoginPrompt: () => void;
  closeLoginPrompt: () => void;
  toastMessage: string | null;
  triggerToast: (msg: string) => void;
  cartList: UserCartItem[];
  resolvedCartItems: ResolvedCartItem[];
  cartCount: number;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateCartItemQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  clearPurchasedCart: (productIds?: string[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [favoritesList, setFavoritesList] = useState<UserFavoriteItem[]>([]);
  const [cartList, setCartList] = useState<UserCartItem[]>([]);
  const [resolvedProducts, setResolvedProducts] = useState<Product[]>([]);
  const [loginPromptOpen, setLoginPromptOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [wishlistGroups, setWishlistGroups] = useState<string[]>(['المفضلة العامة', 'أدوات المطبخ', 'هدايا للمستقبل']);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Derive role
  const role: UserRole | 'guest' = useMemo(() => {
    if (!user) return 'guest';
    if (isAdmin) return 'admin';
    return profile?.role || 'customer';
  }, [user, isAdmin, profile]);

  const isCustomer = role === 'customer';

  // Listen to Auth State and handle Cart merging
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthState(async (authUser, adminFlag, userProfile) => {
      setUser(authUser);
      setIsAdmin(adminFlag);
      setProfile(userProfile);
      setLoading(false);

      if (authUser) {
        // Merge guest cart with firestore cart
        const local = localStorage.getItem('guest_cart');
        if (local) {
          try {
            const guestItems = JSON.parse(local);
            if (Array.isArray(guestItems) && guestItems.length > 0) {
              const currentFirestoreCart = await userService.getCart(authUser.uid);
              const firestoreMap = new Map(currentFirestoreCart.map(i => [i.productId, i.quantity]));

              for (const gItem of guestItems) {
                const currentQty = firestoreMap.get(gItem.productId) || 0;
                await userService.addToCart(authUser.uid, gItem.productId, currentQty + gItem.quantity);
              }
              localStorage.removeItem('guest_cart');
            }
          } catch (e) {
            console.error('Failed to merge guest cart:', e);
          }
        }

        // Merge guest recently viewed history with firestore account history
        recentlyViewedService.mergeGuestHistoryOnLogin(authUser.uid).catch(e => {
          console.warn('Recently viewed login merge warning:', e);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to real-time favorites when user is logged in
  useEffect(() => {
    if (!user) {
      setFavoritesList([]);
      return;
    }

    const unsubscribe = userService.subscribeToFavorites(user.uid, (items) => {
      setFavoritesList(items);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch product info for cart and favorites only
  useEffect(() => {
    const ids = new Set<string>();
    cartList.forEach(i => ids.add(i.productId));
    favoritesList.forEach(i => ids.add(i.productId));
    
    if (ids.size === 0) {
      setResolvedProducts([]);
      return;
    }

    productService.getProductsByIds(Array.from(ids))
      .then(setResolvedProducts)
      .catch(err => console.error('Error preloading products in auth context:', err));
  }, [cartList, favoritesList]);

  // Subscribe to real-time cart or load guest cart
  useEffect(() => {
    if (!user) {
      const local = localStorage.getItem('guest_cart');
      if (local) {
        try {
          setCartList(JSON.parse(local));
        } catch (e) {
          setCartList([]);
        }
      } else {
        setCartList([]);
      }
      return;
    }

    const unsubscribe = userService.subscribeToCart(user.uid, (items) => {
      setCartList(items);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Fast Set of favorited product IDs
  const favoriteIds = useMemo(() => {
    return new Set(favoritesList.map((f) => f.productId));
  }, [favoritesList]);

  // Sync groups with localStorage and existing item groups
  useEffect(() => {
    const defaultGroups = ['المفضلة العامة', 'أدوات المطبخ', 'هدايا للمستقبل'];
    if (!user) {
      setWishlistGroups(defaultGroups);
      return;
    }
    const storageKey = `happyhome_wishlist_groups_${user.uid}`;
    try {
      const stored = localStorage.getItem(storageKey);
      let groups: string[] = stored ? JSON.parse(stored) : [...defaultGroups];

      // Merge any existing item groups
      const itemGroups = favoritesList
        .map((f) => f.groupName)
        .filter((g): g is string => !!g && g.trim().length > 0);

      itemGroups.forEach((g) => {
        if (!groups.includes(g)) {
          groups.push(g);
        }
      });
      if (!groups.includes('المفضلة العامة')) {
        groups.unshift('المفضلة العامة');
      }
      setWishlistGroups(groups);
      localStorage.setItem(storageKey, JSON.stringify(groups));
    } catch {
      setWishlistGroups(defaultGroups);
    }
  }, [user?.uid, favoritesList]);

  const saveGroups = useCallback((groups: string[]) => {
    setWishlistGroups(groups);
    if (user) {
      try {
        localStorage.setItem(`happyhome_wishlist_groups_${user.uid}`, JSON.stringify(groups));
      } catch (e) {
        console.warn('Failed to save wishlist groups to localStorage:', e);
      }
    }
  }, [user]);

  const createWishlistGroup = useCallback(async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) {
      triggerToast('يرجى كتابة اسم المجموعة.');
      return false;
    }
    if (wishlistGroups.includes(trimmed)) {
      triggerToast('هذه المجموعة موجودة بالفعل.');
      return false;
    }
    const updated = [...wishlistGroups, trimmed];
    saveGroups(updated);
    triggerToast(`تم إنشاء مجموعة "${trimmed}" بنجاح.`);
    return true;
  }, [wishlistGroups, saveGroups, triggerToast]);

  const renameWishlistGroup = useCallback(async (oldName: string, newName: string): Promise<boolean> => {
    const trimmedNew = newName.trim();
    if (!trimmedNew) {
      triggerToast('يرجى كتابة اسم المجموعة الجديد.');
      return false;
    }
    if (trimmedNew === oldName) return true;
    if (wishlistGroups.includes(trimmedNew)) {
      triggerToast('يوجد مجموعة أخرى بهذا الاسم.');
      return false;
    }

    const updated = wishlistGroups.map((g) => (g === oldName ? trimmedNew : g));
    saveGroups(updated);

    // Update items locally & in firestore
    setFavoritesList((prev) =>
      prev.map((item) => (item.groupName === oldName ? { ...item, groupName: trimmedNew } : item))
    );
    if (user) {
      const itemsToUpdate = favoritesList.filter((item) => item.groupName === oldName);
      for (const item of itemsToUpdate) {
        userService.updateFavoriteGroup(user.uid, item.productId, trimmedNew).catch(console.error);
      }
    }
    triggerToast(`تم تعديل اسم المجموعة إلى "${trimmedNew}".`);
    return true;
  }, [wishlistGroups, saveGroups, favoritesList, user, triggerToast]);

  const deleteWishlistGroup = useCallback(async (groupName: string): Promise<boolean> => {
    if (groupName === 'المفضلة العامة') {
      triggerToast('لا يمكن حذف المجموعة الافتراضية.');
      return false;
    }

    const updated = wishlistGroups.filter((g) => g !== groupName);
    saveGroups(updated);

    // Move items in that group to 'المفضلة العامة'
    setFavoritesList((prev) =>
      prev.map((item) => (item.groupName === groupName ? { ...item, groupName: 'المفضلة العامة' } : item))
    );
    if (user) {
      const itemsToMove = favoritesList.filter((item) => item.groupName === groupName);
      for (const item of itemsToMove) {
        userService.updateFavoriteGroup(user.uid, item.productId, 'المفضلة العامة').catch(console.error);
      }
    }
    triggerToast(`تم حذف المجموعة "${groupName}" ونقل منتجاتها إلى المفضلة العامة.`);
    return true;
  }, [wishlistGroups, saveGroups, favoritesList, user, triggerToast]);

  const moveFavoriteToGroup = useCallback(async (productId: string, targetGroup: string): Promise<void> => {
    const cleanGroup = targetGroup.trim() || 'المفضلة العامة';
    setFavoritesList((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, groupName: cleanGroup } : item))
    );
    if (!wishlistGroups.includes(cleanGroup)) {
      saveGroups([...wishlistGroups, cleanGroup]);
    }
    if (user) {
      try {
        await userService.updateFavoriteGroup(user.uid, productId, cleanGroup);
        triggerToast(`تم نقل المنتج إلى "${cleanGroup}".`);
      } catch (err) {
        console.error('Failed to move favorite to group:', err);
        triggerToast('تعذر نقل المنتج، يرجى المحاولة ثانية.');
      }
    }
  }, [wishlistGroups, saveGroups, user, triggerToast]);

  const isFavorite = useCallback(
    (productId: string) => {
      if (!productId) return false;
      return favoriteIds.has(productId);
    },
    [favoriteIds]
  );

  const openLoginPrompt = useCallback(() => setLoginPromptOpen(true), []);
  const closeLoginPrompt = useCallback(() => setLoginPromptOpen(false), []);

  const toggleFavorite = useCallback(
    async (product: Product, groupName: string = 'المفضلة العامة'): Promise<boolean> => {
      if (!product || !product.id) return false;

      // Guest check: prompt login
      if (!user) {
        openLoginPrompt();
        return false;
      }

      const isCurrentlyFav = favoriteIds.has(product.id);

      // Optimistic state update
      if (isCurrentlyFav) {
        setFavoritesList((prev) => prev.filter((item) => item.productId !== product.id));
        try {
          await userService.removeFavorite(user.uid, product.id);
          analyticsService.trackEvent('favorite_removed', { productId: product.id, userUid: user.uid });
          return false;
        } catch (err) {
          console.error('Failed to remove favorite:', err);
          triggerToast("حصل خطأ، جرّب تاني.");
          // Rollback on error
          if (user) {
            userService.getFavorites(user.uid).then(setFavoritesList);
          }
          return true;
        }
      } else {
        const cleanGroup = groupName?.trim() || 'المفضلة العامة';
        const newItem: UserFavoriteItem = {
          id: product.id,
          productId: product.id,
          productName: product.name,
          productImage: product.mainImageUrl || '',
          price: product.price,
          oldPrice: product.oldPrice,
          categoryName: product.categoryName,
          slug: product.slug,
          addedAt: new Date().toISOString(),
          groupName: cleanGroup
        };
        setFavoritesList((prev) => [newItem, ...prev]);
        try {
          await userService.addFavorite(user.uid, product, cleanGroup);
          analyticsService.trackEvent('favorite_added', { 
            productId: product.id, 
            categoryId: product.categoryId,
            userUid: user.uid 
          });
          return true;
        } catch (err) {
          console.error('Failed to add favorite:', err);
          triggerToast("حصل خطأ، جرّب تاني.");
          // Rollback on error
          if (user) {
            userService.getFavorites(user.uid).then(setFavoritesList);
          }
          return false;
        }
      }
    },
    [user, favoriteIds, openLoginPrompt, triggerToast]
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const refreshed = await userService.getUserProfile(user.uid);
      if (refreshed) {
        setProfile(refreshed);
        setIsAdmin(refreshed.role === 'admin');
      }
    } catch (e) {
      console.warn('Error refreshing profile:', e);
    }
  }, [user]);

  const updateProfileData = useCallback(
    async (data: { displayName?: string; phone?: string; address?: string; photoURL?: string }) => {
      if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
      
      // 1. Update Firestore (Canonical source)
      await userService.updateUserProfile(user.uid, data);
      
      // Refresh local profile state
      await refreshProfile();

      // 2. Update Auth Profile (Secondary Sync - Non-blocking)
      const authUpdates: Record<string, string> = {};
      if (typeof data.displayName === 'string' && data.displayName.trim()) {
        authUpdates.displayName = data.displayName.trim();
      }

      // ONLY update Auth photoURL if it's a valid persistent URL (no blob, no data url)
      if (typeof data.photoURL === 'string' && 
          data.photoURL.startsWith('http') && 
          !data.photoURL.includes('blob:') && 
          data.photoURL.length < 1000) {
        authUpdates.photoURL = data.photoURL;
      }
      
      if (Object.keys(authUpdates).length > 0) {
        // Run as non-blocking to prevent UI delay if Firebase Auth sync is slow or fails
        updateProfile(user, authUpdates).catch((e) => {
          console.warn('Firebase Auth profile sync warning (non-blocking):', e.message);
        });
      }
    },
    [user, refreshProfile]
  );

  const handleSignOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setFavoritesList([]);
    setCartList([]);
  }, []);

  // Resolve cart items with latest product details
  const resolvedCartItems = useMemo(() => {
    return cartList
      .map((item) => {
        const found = resolvedProducts.find((p) => p.id === item.productId);
        if (!found) return null;
        return {
          ...item,
          product: found
        };
      })
      .filter((item): item is ResolvedCartItem => item !== null);
  }, [cartList, resolvedProducts]);

  // Cart total count (sum of quantities)
  const cartCount = useMemo(() => {
    return resolvedCartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [resolvedCartItems]);

  // Remove from cart
  const removeFromCart = useCallback(async (productId: string): Promise<void> => {
    if (!productId) return;

    const updatedCartList = cartList.filter((item) => item.productId !== productId);
    setCartList(updatedCartList);

    if (user) {
      try {
        await userService.removeFromCart(user.uid, productId);
        analyticsService.trackEvent('cart_removed', { productId, userUid: user.uid });
        triggerToast("تمت إزالة المنتج من السلة.");
      } catch (e) {
        console.error('Failed to remove from cart:', e);
        triggerToast("حصل خطأ أثناء الإزالة.");
        userService.getCart(user.uid).then(setCartList);
      }
    } else {
      localStorage.setItem('guest_cart', JSON.stringify(updatedCartList));
      analyticsService.trackEvent('cart_removed', { productId });
      triggerToast("تمت إزالة المنتج من السلة.");
    }
  }, [user, cartList, triggerToast]);

  // Add to cart
  const addToCart = useCallback(async (productId: string, quantityToAdd: number = 1): Promise<void> => {
    if (!productId) return;
    
    // Determine current item quantity
    const existingItem = cartList.find((item) => item.productId === productId);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const newQty = currentQty + quantityToAdd;

    const newItem: UserCartItem = {
      id: productId,
      productId,
      quantity: newQty,
      addedAt: existingItem?.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedCartList = existingItem
      ? cartList.map((item) => (item.productId === productId ? newItem : item))
      : [...cartList, newItem];
    setCartList(updatedCartList);

    if (user) {
      try {
        await userService.addToCart(user.uid, productId, newQty);
        analyticsService.trackEvent('cart_added', { 
          productId, 
          userUid: user.uid,
          metadata: { quantity: quantityToAdd }
        });
        triggerToast("تم إضافة المنتج إلى السلة.");
      } catch (e) {
        console.error('Failed to add to cart:', e);
        triggerToast("حصل خطأ أثناء الإضافة.");
        userService.getCart(user.uid).then(setCartList);
      }
    } else {
      localStorage.setItem('guest_cart', JSON.stringify(updatedCartList));
      analyticsService.trackEvent('cart_added', { 
        productId, 
        metadata: { quantity: quantityToAdd }
      });
      triggerToast("تم إضافة المنتج إلى السلة.");
    }
  }, [user, cartList, triggerToast]);

  // Update cart item quantity
  const updateCartItemQuantity = useCallback(async (productId: string, quantity: number): Promise<void> => {
    if (!productId) return;

    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    const updatedCartList = cartList.map((item) =>
      item.productId === productId ? { ...item, quantity, updatedAt: new Date().toISOString() } : item
    );
    setCartList(updatedCartList);

    if (user) {
      try {
        await userService.addToCart(user.uid, productId, quantity);
      } catch (e) {
        console.error('Failed to update cart quantity:', e);
        triggerToast("حصل خطأ أثناء تحديث الكمية.");
        userService.getCart(user.uid).then(setCartList);
      }
    } else {
      localStorage.setItem('guest_cart', JSON.stringify(updatedCartList));
    }
  }, [user, cartList, removeFromCart, triggerToast]);

  // Clear cart
  const clearCart = useCallback(async (): Promise<void> => {
    setCartList([]);
    if (user) {
      try {
        await userService.clearCart(user.uid);
        triggerToast("تم إفراغ السلة بنجاح.");
      } catch (e) {
        console.error('Failed to clear cart:', e);
        triggerToast("حصل خطأ أثناء إفراغ السلة.");
        userService.getCart(user.uid).then(setCartList);
      }
    } else {
      localStorage.removeItem('guest_cart');
      triggerToast("تم إفراغ السلة بنجاح.");
    }
  }, [user, triggerToast]);

  // Clear only purchased cart items
  const clearPurchasedCart = useCallback(async (productIds?: string[]): Promise<void> => {
    if (!productIds || productIds.length === 0) {
      await clearCart();
      return;
    }

    const remaining = cartList.filter(item => !productIds.includes(item.productId));
    setCartList(remaining);

    if (user) {
      try {
        await userService.removePurchasedCartItems(user.uid, productIds);
      } catch (e) {
        console.error('Failed to clear purchased items from cart:', e);
        userService.getCart(user.uid).then(setCartList);
      }
    } else {
      localStorage.setItem('guest_cart', JSON.stringify(remaining));
    }
  }, [user, cartList, clearCart]);

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      isAdmin,
      isCustomer,
      loading,
      favoritesList,
      favoriteIds,
      wishlistGroups,
      createWishlistGroup,
      renameWishlistGroup,
      deleteWishlistGroup,
      moveFavoriteToGroup,
      isFavorite,
      toggleFavorite,
      updateProfileData,
      refreshProfile,
      signOut: handleSignOut,
      loginPromptOpen,
      openLoginPrompt,
      closeLoginPrompt,
      toastMessage,
      triggerToast,
      cartList,
      resolvedCartItems,
      cartCount,
      addToCart,
      updateCartItemQuantity,
      removeFromCart,
      clearCart,
      clearPurchasedCart
    }),
    [
      user,
      profile,
      role,
      isAdmin,
      isCustomer,
      loading,
      favoritesList,
      favoriteIds,
      wishlistGroups,
      createWishlistGroup,
      renameWishlistGroup,
      deleteWishlistGroup,
      moveFavoriteToGroup,
      isFavorite,
      toggleFavorite,
      updateProfileData,
      refreshProfile,
      handleSignOut,
      loginPromptOpen,
      openLoginPrompt,
      closeLoginPrompt,
      toastMessage,
      triggerToast,
      cartList,
      resolvedCartItems,
      cartCount,
      addToCart,
      updateCartItemQuantity,
      removeFromCart,
      clearCart,
      clearPurchasedCart
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
