import { supabaseDb } from './supabaseDb';
import { User } from 'firebase/auth';
import { UserProfileData, UserFavoriteItem, UserCartItem, Product, UserRole, Address } from '../../types';
import { checkIsAdminEmail } from '../authUtils';

export const userService = {
  async getUserProfile(uid: string): Promise<UserProfileData | null> {
    if (!uid) return null;
    try {
      const doc = await supabaseDb.getDoc<UserProfileData>('users', uid);
      if (doc) {
        return {
          uid,
          displayName: doc.displayName || '',
          email: doc.email || '',
          photoURL: doc.photoURL || '',
          phone: doc.phone || '',
          address: doc.address || '',
          role: doc.role === 'admin' ? 'admin' : 'customer',
          createdAt: doc.createdAt || '',
          updatedAt: doc.updatedAt || ''
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  async syncUserProfile(user: User, preferredRole?: UserRole): Promise<UserProfileData> {
    if (!user || !user.uid) {
      throw new Error('بيانات المستخدم غير مكتملة.');
    }

    const uid = user.uid;
    const existing = await this.getUserProfile(uid);
    const isAdminEmail = checkIsAdminEmail(user.email);

    // Enforce role security: Customer cannot self-promote to admin
    const role: UserRole = existing?.role === 'admin' || isAdminEmail
      ? 'admin'
      : (preferredRole === 'admin' && isAdminEmail ? 'admin' : 'customer');

    const profile: UserProfileData = {
      uid,
      displayName: user.displayName || existing?.displayName || 'عميل المتجر',
      email: user.email || existing?.email || '',
      photoURL: user.photoURL || existing?.photoURL || '',
      phone: existing?.phone || user.phoneNumber || '',
      address: existing?.address || '',
      role,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await supabaseDb.setDoc('users', uid, profile);
    return profile;
  },

  async updateUserProfile(uid: string, updates: Partial<UserProfileData>): Promise<void> {
    if (!uid) return;
    // Strip role updates on client-side to prevent self-elevation
    const safeUpdates = { ...updates };
    delete safeUpdates.role;
    await supabaseDb.updateDoc('users', uid, safeUpdates);
  },

  async getFavorites(uid: string): Promise<UserFavoriteItem[]> {
    if (!uid) return [];
    try {
      const allFavs = await supabaseDb.getCollection<UserFavoriteItem>('favorites');
      return allFavs.filter((f: any) => f.user_uid === uid || f.userUid === uid);
    } catch {
      return [];
    }
  },

  async addFavorite(uid: string, product: Product, groupName = 'المفضلة العامة'): Promise<void> {
    if (!uid || !product) return;
    const favId = `fav_${uid}_${product.id}`;
    const item: UserFavoriteItem = {
      id: favId,
      user_uid: uid,
      userUid: uid,
      productId: product.id,
      productName: product.name,
      productImage: product.mainImageUrl || '',
      price: product.price,
      slug: product.slug || '',
      groupName,
      addedAt: new Date().toISOString()
    };
    await supabaseDb.setDoc('favorites', favId, item);
  },

  async removeFavorite(uid: string, productId: string): Promise<void> {
    if (!uid || !productId) return;
    const favId = `fav_${uid}_${productId}`;
    await supabaseDb.deleteDoc('favorites', favId);
  },

  async getCart(uid: string): Promise<UserCartItem[]> {
    if (!uid) return [];
    try {
      const allCarts = await supabaseDb.getCollection<UserCartItem>('carts');
      return allCarts.filter((c: any) => c.user_uid === uid || c.userUid === uid);
    } catch {
      return [];
    }
  },

  async addToCart(uid: string, arg2: any, arg3?: number, arg4?: any): Promise<void> {
    if (!uid) return;
    let item: any;
    if (typeof arg2 === 'string') {
      item = {
        id: `cart_${uid}_${arg2}`,
        productId: arg2,
        quantity: arg3 || 1,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(arg4 || {})
      };
    } else {
      item = {
        ...arg2,
        id: arg2.id || `cart_${uid}_${arg2.productId}`,
        updatedAt: new Date().toISOString()
      };
    }
    const cartId = item.id;
    const dbItem = { ...item, id: cartId, user_uid: uid, userUid: uid };
    await supabaseDb.setDoc('carts', cartId, dbItem);
  },

  async updateCartQuantity(uid: string, cartItemId: string, quantity: number): Promise<void> {
    if (!uid || !cartItemId) return;
    if (quantity <= 0) {
      await this.removeFromCart(uid, cartItemId);
    } else {
      await supabaseDb.updateDoc('carts', cartItemId, { quantity, updatedAt: new Date().toISOString() });
    }
  },

  async removeFromCart(uid: string, cartItemId: string): Promise<void> {
    if (!uid || !cartItemId) return;
    await supabaseDb.deleteDoc('carts', cartItemId);
  },

  async clearCart(uid: string): Promise<void> {
    if (!uid) return;
    const items = await this.getCart(uid);
    for (const item of items) {
      if (item.id) await supabaseDb.deleteDoc('carts', item.id);
    }
  },

  async removePurchasedCartItems(uid: string, productIds: string[]): Promise<void> {
    for (const pid of productIds) {
      await supabaseDb.deleteDoc('carts', `cart_${uid}_${pid}`);
      await supabaseDb.deleteDoc('carts', `bundle_${pid}`);
    }
  },

  async updateFavoriteGroup(uid: string, productId: string, groupName: string): Promise<void> {
    const favId = `fav_${uid}_${productId}`;
    await supabaseDb.updateDoc('favorites', favId, { groupName });
  },

  subscribeToFavorites(uid: string, callback: (items: UserFavoriteItem[]) => void): () => void {
    let active = true;
    const poll = async () => {
      if (!active) return;
      const items = await this.getFavorites(uid);
      if (active) callback(items);
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  subscribeToCart(uid: string, callback: (items: UserCartItem[]) => void): () => void {
    let active = true;
    const poll = async () => {
      if (!active) return;
      const items = await this.getCart(uid);
      if (active) callback(items);
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  async getAddresses(uid: string): Promise<Address[]> {
    if (!uid) return [];
    try {
      const all = await supabaseDb.getCollection<Address>('user_addresses');
      return all.filter((a: any) => a.user_uid === uid || a.userUid === uid);
    } catch {
      return [];
    }
  },

  async saveAddress(uidOrAddress: any, addressOrNull?: any, isDefault?: boolean): Promise<string> {
    const uid = typeof uidOrAddress === 'string' ? uidOrAddress : 'guest';
    const address = typeof uidOrAddress === 'string' ? addressOrNull : uidOrAddress;
    const id = address?.id || address?.addressId || `addr_${uid}_${Date.now()}`;
    const item = {
      ...address,
      id,
      addressId: id,
      user_uid: uid,
      isDefault: isDefault !== undefined ? isDefault : (address?.isDefault || false),
      createdAt: address?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await supabaseDb.setDoc('user_addresses', id, item);
    return id;
  },

  async deleteAddress(uid: string, addressId: string): Promise<void> {
    if (!uid || !addressId) return;
    await supabaseDb.deleteDoc('user_addresses', addressId);
  },

  async updateAddress(uid: string, arg2: any, arg3?: any): Promise<void> {
    const address = arg3 !== undefined ? arg3 : arg2;
    await this.saveAddress(uid, address);
  },

  async addAddress(uid: string, arg2: any, arg3?: any): Promise<string> {
    const address = arg3 !== undefined ? arg3 : arg2;
    return await this.saveAddress(uid, address);
  },

  async setDefaultAddress(uid: string, addressId: string): Promise<void> {
    const addresses = await this.getAddresses(uid);
    for (const a of addresses) {
      await this.saveAddress(uid, { ...a, isDefault: a.id === addressId });
    }
  },

  async getAllUsers(): Promise<UserProfileData[]> {
    try {
      return await supabaseDb.getCollection<UserProfileData>('users');
    } catch {
      return [];
    }
  }
};
