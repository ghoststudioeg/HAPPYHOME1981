import { supabaseDb } from './supabaseDb';
import { Coupon } from '../../types';

export const couponService = {
  async getCoupons(): Promise<Coupon[]> {
    try {
      return await supabaseDb.getCollection<Coupon>('coupons');
    } catch {
      return [];
    }
  },

  async getCouponByCode(code: string): Promise<Coupon | null> {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    try {
      return await supabaseDb.getDoc<Coupon>('coupons', cleanCode);
    } catch {
      return null;
    }
  },

  async createCoupon(coupon: Omit<Coupon, 'usedCount' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const cleanCode = coupon.code.trim().toUpperCase();
    const newCoupon: Coupon = {
      ...coupon,
      code: cleanCode,
      usedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await supabaseDb.setDoc('coupons', cleanCode, newCoupon);
  },

  async updateCoupon(code: string, updates: Partial<Coupon>): Promise<void> {
    const cleanCode = code.trim().toUpperCase();
    await supabaseDb.updateDoc('coupons', cleanCode, updates);
  },

  async deleteCoupon(code: string): Promise<void> {
    const cleanCode = code.trim().toUpperCase();
    await supabaseDb.deleteDoc('coupons', cleanCode);
  },

  async getAllCoupons(): Promise<Coupon[]> {
    return this.getCoupons();
  },

  async saveCoupon(coupon: any): Promise<void> {
    const cleanCode = coupon.code.trim().toUpperCase();
    await supabaseDb.setDoc('coupons', cleanCode, coupon);
  },

  async incrementUsage(code: string): Promise<void> {
    const coupon = await this.getCouponByCode(code);
    if (coupon) {
      await this.updateCoupon(code, { usedCount: (coupon.usedCount || 0) + 1 });
    }
  },

  async validateCoupon(code: string, userUidOrCartTotal: any, cartTotalOrOrderItems?: any, orderItems?: any): Promise<any> {
    const isSecondParamUid = typeof userUidOrCartTotal === 'string';
    const uid = isSecondParamUid ? userUidOrCartTotal : 'guest';
    const cartTotal = isSecondParamUid ? Number(cartTotalOrOrderItems || 0) : Number(userUidOrCartTotal || 0);

    const coupon = await this.getCouponByCode(code);
    if (!coupon) return { valid: false, message: 'الكوبون غير موجود', error: 'الكوبون غير موجود' };
    if (!coupon.active) return { valid: false, message: 'الكوبون غير نشط', error: 'الكوبون غير نشط' };
    if (cartTotal < (coupon.minimumOrder || 0)) {
      return { 
        valid: false, 
        message: `الحد الأدنى للطلب لاستخدام هذا الكوبون هو ${coupon.minimumOrder} ج.م`,
        error: `الحد الأدنى للطلب لاستخدام هذا الكوبون هو ${coupon.minimumOrder} ج.م`
      };
    }
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (cartTotal * coupon.value) / 100;
      if (coupon.maximumDiscount && discount > coupon.maximumDiscount) {
        discount = coupon.maximumDiscount;
      }
    } else {
      discount = coupon.value;
    }
    return { valid: true, coupon, discount, discountAmount: discount };
  }
};
