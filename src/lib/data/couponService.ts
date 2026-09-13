import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  deleteDoc,
  orderBy,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { Coupon, OrderItem } from '../../types';
import { auditService } from './auditService';

export const couponService = {
  /**
   * Fetch all coupons for Admin Dashboard.
   */
  async getAllCoupons(): Promise<Coupon[]> {
    if (!db) return [];
    try {
      const colRef = collection(db, 'coupons');
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Coupon));
    } catch (err) {
      console.error('Error fetching coupons:', err);
      return [];
    }
  },

  /**
   * Get a single coupon by its code.
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    if (!db || !code) return null;
    const cleanCode = code.toUpperCase().trim();
    try {
      // 1. Try direct document reference lookup first (fast, reliable, transaction-friendly)
      const docRef = doc(db, 'coupons', cleanCode);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Coupon;
      }

      // 2. Fallback to query in case coupon is stored under random ID
      const colRef = collection(db, 'coupons');
      const q = query(colRef, where('code', '==', cleanCode));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as Coupon;
    } catch (err) {
      console.error('Error fetching coupon by code:', err);
      return null;
    }
  },

  /**
   * Create or update a coupon.
   */
  async saveCoupon(couponData: Partial<Coupon>): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const code = couponData.code?.toUpperCase().trim();
    if (!code) throw new Error('رمز الكوبون مطلوب');
    
    // For new coupons, use the uppercase code as the ID to allow atomic transaction checks.
    // For existing ones, preserve their current ID.
    const id = couponData.id || code;
    const now = new Date().toISOString();
    
    const data = {
      ...couponData,
      id,
      code,
      updatedAt: now,
      createdAt: couponData.createdAt || now
    };

    await setDoc(doc(db, 'coupons', id), data, { merge: true });

    try {
      await auditService.recordAuditLog({
        action: couponData.id ? 'COUPON_EDITED' : 'COUPON_CREATED',
        entityType: 'coupon',
        entityId: id,
        entityName: `كوبون ${code}`,
        after: { code, value: couponData.value, type: couponData.type }
      });
    } catch (e) {}

    return id;
  },

  /**
   * Delete a coupon.
   */
  async deleteCoupon(id: string): Promise<void> {
    if (!db || !id) return;

    try {
      const snap = await getDoc(doc(db, 'coupons', id));
      const deletedCoupon = snap.exists() ? snap.data() : null;

      await deleteDoc(doc(db, 'coupons', id));

      await auditService.recordAuditLog({
        action: 'COUPON_DELETED',
        entityType: 'coupon',
        entityId: id,
        entityName: deletedCoupon?.code ? `كوبون ${deletedCoupon.code}` : id,
        before: deletedCoupon ? { code: deletedCoupon.code } : null,
        after: null
      });
    } catch (e) {
      if (db) await deleteDoc(doc(db, 'coupons', id));
    }
  },

  /**
   * Validate a coupon for a specific order.
   * Returns { valid: boolean; discount: number; error?: string }
   */
  async validateCoupon(
    code: string, 
    customerUid: string, 
    subtotal: number, 
    items: OrderItem[]
  ): Promise<{ valid: boolean; discountAmount: number; error?: string; coupon?: Coupon }> {
    const coupon = await this.getCouponByCode(code);
    
    if (!coupon) {
      return { valid: false, discountAmount: 0, error: 'كود الخصم غير موجود' };
    }

    if (!coupon.active) {
      return { valid: false, discountAmount: 0, error: 'كود الخصم غير مفعل حالياً' };
    }

    const now = new Date();
    if (coupon.startAt && new Date(coupon.startAt) > now) {
      return { valid: false, discountAmount: 0, error: 'هذا الكود لم يبدأ العمل به بعد' };
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      return { valid: false, discountAmount: 0, error: 'انتهت صلاحية كود الخصم' };
    }

    if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discountAmount: 0, error: 'تم استهلاك الحد الأقصى لاستخدام هذا الكود' };
    }

    if (coupon.minimumOrder !== undefined && subtotal < coupon.minimumOrder) {
      return { valid: false, discountAmount: 0, error: `الحد الأدنى للطلب لاستخدام هذا الكود هو ${coupon.minimumOrder} ج.م` };
    }

    // Check per-customer limit
    if (coupon.perCustomerLimit !== undefined && customerUid) {
      const ordersCol = collection(db, 'orders');
      const q = query(
        ordersCol, 
        where('customerUid', '==', customerUid), 
        where('couponCode', '==', coupon.code)
      );
      const ordersSnap = await getDocs(q);
      if (ordersSnap.size >= coupon.perCustomerLimit) {
        return { valid: false, discountAmount: 0, error: 'لقد استنفدت عدد مرات استخدام هذا الكود' };
      }
    }

    // Calculate discount based on applicable products/categories
    let applicableSubtotal = 0;
    const hasRestrictions = coupon.applicableProductIds.length > 0 || coupon.applicableCategoryIds.length > 0;

    if (!hasRestrictions) {
      applicableSubtotal = subtotal;
    } else {
      // To support category restrictions, we need to know the category of each product in the cart
      // We can fetch the products briefly to check categories
      for (const item of items) {
        let isApplicable = false;
        
        // 1. Check direct product restriction
        if (coupon.applicableProductIds.includes(item.productId)) {
          isApplicable = true;
        } 
        
        // 2. Check category restriction
        if (!isApplicable && coupon.applicableCategoryIds.length > 0) {
          try {
            const prodRef = doc(db, 'products', item.productId);
            const prodSnap = await getDoc(prodRef);
            if (prodSnap.exists()) {
              const prodData = prodSnap.data();
              if (coupon.applicableCategoryIds.includes(prodData.categoryId)) {
                isApplicable = true;
              }
            }
          } catch (e) {
            console.warn(`Failed to check category for product ${item.productId}:`, e);
          }
        }

        if (isApplicable) {
          applicableSubtotal += item.lineTotal;
        }
      }

      if (applicableSubtotal === 0) {
        return { valid: false, discountAmount: 0, error: 'هذا الكود لا يشمل المنتجات الموجودة في سلتك' };
      }
    }

    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (applicableSubtotal * coupon.value) / 100;
      if (coupon.maximumDiscount !== undefined && discountAmount > coupon.maximumDiscount) {
        discountAmount = coupon.maximumDiscount;
      }
    } else {
      discountAmount = coupon.value;
      if (discountAmount > applicableSubtotal) {
        discountAmount = applicableSubtotal;
      }
    }

    return { valid: true, discountAmount, coupon };
  },

  /**
   * Securely increment coupon usage count using a transaction or atomic increment.
   */
  async incrementUsage(couponId: string): Promise<void> {
    if (!db || !couponId) return;
    const docRef = doc(db, 'coupons', couponId);
    await updateDoc(docRef, {
      usedCount: increment(1),
      updatedAt: new Date().toISOString()
    });
  }
};
