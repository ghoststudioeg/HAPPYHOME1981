import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, sanitizeForFirestore } from '../firebase';
import { UserProfileData, UserFavoriteItem, UserCartItem, Product, UserRole, Address } from '../../types';
import { notificationEngine } from '../notificationEngine';
import { checkIsAdminEmail } from '../authUtils';
import { recentlyViewedService } from './recentlyViewedService';

export const userService = {
  /**
   * Fetch user profile from users/{uid}
   */
  async getUserProfile(uid: string): Promise<UserProfileData | null> {
    if (!db || !uid) return null;
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          uid,
          displayName: data.displayName || '',
          email: data.email || '',
          photoURL: data.photoURL || '',
          phone: data.phone || '',
          address: data.address || '',
          role: data.role === 'admin' ? 'admin' : 'customer',
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || ''
        };
      }
      return null;
    } catch (err) {
      console.warn('Error fetching user profile:', err);
      return null;
    }
  },

  /**
   * Synchronize user profile on login (Google or Email/Password).
   * Automatically populates name, email, photo from Google while PRESERVING
   * manually entered phone and address, and never overwriting an admin role!
   */
  async syncUserProfile(user: User, preferredRole?: UserRole): Promise<UserProfileData> {
    if (!db || !user || !user.uid) {
      throw new Error('قاعدة البيانات غير متاحة حالياً.');
    }

    const uid = user.uid;
    const userRef = doc(db, 'users', uid);

    // 1. Fetch existing profile if available
    let existingProfile: UserProfileData | null = null;
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        existingProfile = snap.data() as UserProfileData;
      }
    } catch (e) {
      console.warn('Could not read existing user doc before sync:', e);
    }

    // 2. Determine authoritative role
    // Admin check:
    // - Is existing profile already an admin?
    // - Is existing profiles/{uid} doc an admin?
    // - Is email in authorized admin emails?
    let isAdmin = false;

    if (checkIsAdminEmail(user.email)) {
      isAdmin = true;
    } else if (existingProfile?.role === 'admin') {
      isAdmin = true;
    } else {
      // Check legacy profiles/{uid} collection
      try {
        const legacySnap = await getDoc(doc(db, 'profiles', uid));
        if (legacySnap.exists() && legacySnap.data()?.role === 'admin') {
          isAdmin = true;
        }
      } catch (e) {
        // Ignore permission error if not admin
      }
    }

    const finalRole: UserRole = isAdmin ? 'admin' : (preferredRole || 'customer');

    // 3. Prepare merged profile data
    const now = new Date().toISOString();
    const resolvedDisplayName = user.displayName || existingProfile?.displayName || user.email?.split('@')[0] || 'عميل المتجر';
    const resolvedPhotoURL = existingProfile?.photoURL || user.photoURL || '';
    const resolvedPhone = existingProfile?.phone || '';
    const resolvedAddress = existingProfile?.address || '';

    const profileData: UserProfileData = {
      uid,
      displayName: resolvedDisplayName.slice(0, 100),
      email: (user.email || existingProfile?.email || '').slice(0, 150),
      photoURL: resolvedPhotoURL.slice(0, 2048),
      phone: resolvedPhone.slice(0, 30),
      address: resolvedAddress.slice(0, 300),
      role: finalRole,
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now
    };

    // 4. Save to Firestore users/{uid}
    try {
      const sanitized = sanitizeForFirestore(profileData);
      await setDoc(userRef, sanitized, { merge: true });

      // Trigger NEW_CUSTOMER store event if this is a brand new customer
      if (!existingProfile && finalRole === 'customer') {
        notificationEngine.fireStoreEvent({
          eventType: 'NEW_CUSTOMER',
          payload: {
            customerUid: uid,
            customerName: profileData.displayName,
            customerPhone: profileData.phone || profileData.email
          }
        }).catch(err => console.warn('New customer event dispatch warning:', err));
      }
    } catch (err: any) {
      console.error('Error writing user profile to Firestore:', err);
      // Even if Firestore write fails (e.g. offline), return in-memory profile
    }

    // 5. If admin, keep legacy profiles/{uid} in sync for full backwards compatibility
    if (isAdmin) {
      try {
        await setDoc(doc(db, 'profiles', uid), {
          email: profileData.email,
          role: 'admin',
          updatedAt: now
        }, { merge: true });
      } catch (e) {
        console.warn('Could not sync legacy admin profile:', e);
      }
    }

    return profileData;
  },

  /**
   * Update editable profile fields (phone, address, displayName)
   */
  async updateUserProfile(
    uid: string,
    updates: {
      displayName?: string;
      phone?: string;
      address?: string;
      photoURL?: string;
    }
  ): Promise<void> {
    if (!db || !uid) throw new Error('تعذر الاتصال بقاعدة البيانات.');

    const cleanData: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (typeof updates.displayName === 'string') {
      cleanData.displayName = updates.displayName.trim().slice(0, 100);
    }
    if (typeof updates.phone === 'string') {
      cleanData.phone = updates.phone.trim().slice(0, 30);
    }
    if (typeof updates.address === 'string') {
      cleanData.address = updates.address.trim().slice(0, 300);
    }
    if (typeof updates.photoURL === 'string') {
      cleanData.photoURL = updates.photoURL.trim().slice(0, 2048);
    }

    const userRef = doc(db, 'users', uid);
    const sanitized = sanitizeForFirestore(cleanData);
    await setDoc(userRef, sanitized, { merge: true });
  },

  /**
   * Get all favorites for a user
   */
  async getFavorites(uid: string): Promise<UserFavoriteItem[]> {
    if (!db || !uid) return [];
    try {
      const favsRef = collection(db, 'users', uid, 'favorites');
      const snap = await getDocs(favsRef);
      const items: UserFavoriteItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          productId: data.productId || d.id,
          productName: data.productName || 'منتج',
          productImage: data.productImage || '',
          price: Number(data.price) || 0,
          oldPrice: data.oldPrice ? Number(data.oldPrice) : undefined,
          categoryName: data.categoryName || '',
          slug: data.slug || d.id,
          addedAt: data.addedAt || ''
        });
      });
      // Sort newest first
      return items.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
    } catch (err) {
      console.warn('Error fetching favorites:', err);
      return [];
    }
  },

  /**
   * Add a product to customer favorites
   */
  async addFavorite(uid: string, product: Product): Promise<void> {
    if (!db || !uid || !product?.id) throw new Error('بيانات المنتج غير صالحة.');

    const favDocRef = doc(db, 'users', uid, 'favorites', product.id);
    const item: Record<string, any> = {
      id: product.id,
      productId: product.id,
      productName: product.name || 'منتج',
      productImage: product.mainImageUrl || '',
      price: product.price || 0,
      categoryName: product.categoryName || '',
      slug: product.slug || product.id,
      addedAt: new Date().toISOString()
    };

    if (product.oldPrice !== undefined && product.oldPrice !== null) {
      item.oldPrice = product.oldPrice;
    }

    const sanitized = sanitizeForFirestore(item);
    await setDoc(favDocRef, sanitized, { merge: true });
  },

  /**
   * Remove a product from customer favorites
   */
  async removeFavorite(uid: string, productId: string): Promise<void> {
    if (!db || !uid || !productId) return;
    const favDocRef = doc(db, 'users', uid, 'favorites', productId);
    await deleteDoc(favDocRef);
  },

  /**
   * One-time delivery of customer favorites (does not hold active WebChannel streams)
   */
  subscribeToFavorites(uid: string, callback: (items: UserFavoriteItem[]) => void): () => void {
    if (!db || !uid) {
      callback([]);
      return () => {};
    }
    this.getFavorites(uid).then(callback).catch(() => callback([]));
    return () => {};
  },

  /**
   * Get all cart items for a user from firestore
   */
  async getCart(uid: string): Promise<UserCartItem[]> {
    if (!db || !uid) return [];
    try {
      const cartRef = collection(db, 'users', uid, 'cart');
      const snap = await getDocs(cartRef);
      const items: UserCartItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          productId: data.productId || d.id,
          quantity: Number(data.quantity) || 1,
          addedAt: data.addedAt || '',
          updatedAt: data.updatedAt || ''
        });
      });
      return items;
    } catch (err) {
      console.warn('Error fetching cart:', err);
      return [];
    }
  },

  /**
   * Add or update item in cart
   */
  async addToCart(uid: string, productId: string, quantity: number): Promise<void> {
    if (!db || !uid || !productId) throw new Error('بيانات السلة غير صالحة.');
    const docRef = doc(db, 'users', uid, 'cart', productId);
    const now = new Date().toISOString();
    const item = {
      productId,
      quantity,
      addedAt: now,
      updatedAt: now
    };
    const sanitized = sanitizeForFirestore(item);
    await setDoc(docRef, sanitized, { merge: true });
  },

  /**
   * Remove item from cart
   */
  async removeFromCart(uid: string, productId: string): Promise<void> {
    if (!db || !uid || !productId) return;
    const docRef = doc(db, 'users', uid, 'cart', productId);
    await deleteDoc(docRef);
  },

  /**
   * Remove only the purchased items from user's cart in firestore
   */
  async removePurchasedCartItems(uid: string, productIds: string[]): Promise<void> {
    if (!db || !uid || !productIds || productIds.length === 0) return;
    try {
      const promises = productIds.map(productId => {
        const docRef = doc(db, 'users', uid, 'cart', productId);
        return deleteDoc(docRef);
      });
      await Promise.all(promises);
    } catch (e) {
      console.warn('Error clearing purchased cart items:', e);
    }
  },

  /**
   * Clear user's cart in firestore
   */
  async clearCart(uid: string): Promise<void> {
    if (!db || !uid) return;
    const cartRef = collection(db, 'users', uid, 'cart');
    const snap = await getDocs(cartRef);
    const promises = snap.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(promises);
  },

  /**
   * One-time delivery of customer cart (does not hold active WebChannel streams)
   */
  subscribeToCart(uid: string, callback: (items: UserCartItem[]) => void): () => void {
    if (!db || !uid) {
      callback([]);
      return () => {};
    }
    this.getCart(uid).then(callback).catch(() => callback([]));
    return () => {};
  },

  /**
   * Fetch all addresses for a user from firestore
   */
  async getAddresses(uid: string): Promise<Address[]> {
    if (!db || !uid) return [];
    try {
      const addressesRef = collection(db, 'users', uid, 'addresses');
      const snap = await getDocs(addressesRef);
      const items: Address[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          addressId: d.id,
          label: data.label || '',
          recipientName: data.recipientName || '',
          phone: data.phone || '',
          governorate: data.governorate || '',
          area: data.area || '',
          street: data.street || '',
          building: data.building || '',
          apartment: data.apartment || '',
          floor: data.floor || '',
          notes: data.notes || '',
          isDefault: !!data.isDefault,
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || ''
        });
      });
      // Sort: default first, then newest first
      return items.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    } catch (err) {
      console.warn('Error fetching addresses:', err);
      return [];
    }
  },

  /**
   * Add a new shipping address
   */
  async addAddress(uid: string, addressData: Omit<Address, 'addressId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db || !uid) throw new Error('بيانات غير صالحة.');
    
    const addressesRef = collection(db, 'users', uid, 'addresses');
    const existing = await this.getAddresses(uid);
    
    // If it's the first address, or isDefault is true, manage default status
    const shouldBeDefault = existing.length === 0 || addressData.isDefault;
    
    const newDocRef = doc(addressesRef);
    const addressId = newDocRef.id;
    const now = new Date().toISOString();
    
    const finalAddress: Address = {
      ...addressData,
      addressId,
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now
    };
    
    const sanitized = sanitizeForFirestore(finalAddress);
    await setDoc(newDocRef, sanitized);
    
    if (shouldBeDefault && existing.length > 0) {
      // Unset previous defaults
      for (const addr of existing) {
        if (addr.isDefault) {
          await setDoc(doc(db, 'users', uid, 'addresses', addr.addressId), { isDefault: false, updatedAt: now }, { merge: true });
        }
      }
    }
    
    return addressId;
  },

  /**
   * Update an existing address
   */
  async updateAddress(uid: string, addressId: string, updates: Partial<Omit<Address, 'addressId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    if (!db || !uid || !addressId) throw new Error('بيانات غير صالحة.');
    
    const addrDocRef = doc(db, 'users', uid, 'addresses', addressId);
    const now = new Date().toISOString();
    
    await setDoc(addrDocRef, {
      ...updates,
      updatedAt: now
    }, { merge: true });
    
    if (updates.isDefault) {
      const existing = await this.getAddresses(uid);
      for (const addr of existing) {
        if (addr.addressId !== addressId && addr.isDefault) {
          await setDoc(doc(db, 'users', uid, 'addresses', addr.addressId), { isDefault: false, updatedAt: now }, { merge: true });
        }
      }
    }
  },

  /**
   * Delete an address
   */
  async deleteAddress(uid: string, addressId: string): Promise<void> {
    if (!db || !uid || !addressId) return;
    
    const addrDocRef = doc(db, 'users', uid, 'addresses', addressId);
    // Fetch it first to check if we are deleting the default address
    const existing = await this.getAddresses(uid);
    const target = existing.find(a => a.addressId === addressId);
    
    await deleteDoc(addrDocRef);
    
    // If we deleted the default address, make the next available address default
    if (target?.isDefault && existing.length > 1) {
      const nextDefault = existing.find(a => a.addressId !== addressId);
      if (nextDefault) {
        const now = new Date().toISOString();
        await setDoc(doc(db, 'users', uid, 'addresses', nextDefault.addressId), { isDefault: true, updatedAt: now }, { merge: true });
      }
    }
  },

  /**
   * Set an address as the default address
   */
  async setDefaultAddress(uid: string, addressId: string): Promise<void> {
    if (!db || !uid || !addressId) return;
    const now = new Date().toISOString();
    const existing = await this.getAddresses(uid);
    
    for (const addr of existing) {
      const isTarget = addr.addressId === addressId;
      if (addr.isDefault !== isTarget) {
        await setDoc(doc(db, 'users', uid, 'addresses', addr.addressId), { isDefault: isTarget, updatedAt: now }, { merge: true });
      }
    }
  },

  /**
   * One-time delivery of customer addresses (does not hold active WebChannel streams)
   */
  subscribeToAddresses(uid: string, callback: (addresses: Address[]) => void): () => void {
    if (!db || !uid) {
      callback([]);
      return () => {};
    }
    this.getAddresses(uid).then(callback).catch(() => callback([]));
    return () => {};
  },

  /**
   * Fetch all users (Admin only)
   */
  async getAllUsers(): Promise<UserProfileData[]> {
    if (!db) return [];
    try {
      const usersColRef = collection(db, 'users');
      const snap = await getDocs(usersColRef);
      return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfileData));
    } catch (err) {
      console.error('Error fetching all users:', err);
      return [];
    }
  },

  /**
   * Recently viewed products delegation
   */
  async getRecentlyViewed(uid: string, maxCount: number = 20) {
    return recentlyViewedService.getRecentlyViewed(uid, undefined, maxCount);
  },

  async addRecentlyViewed(uid: string, product: Product) {
    return recentlyViewedService.recordProductView(product, uid);
  },

  async removeRecentlyViewed(uid: string, productId: string) {
    return recentlyViewedService.removeRecentlyViewed(productId, uid);
  },

  async clearRecentlyViewed(uid: string) {
    return recentlyViewedService.clearRecentlyViewed(uid);
  }
};
