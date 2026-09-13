import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  collectionGroup,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Review, ReviewStatus } from '../../types';

export const reviewService = {
  /**
   * Check if a customer is eligible to review a product.
   * Any authenticated customer is allowed to review any visible/published product.
   * Automatically determines if they have previously purchased and received this product.
   */
  async checkUserEligibility(productId: string, customerUid?: string): Promise<{ eligible: boolean; verified: boolean }> {
    if (!customerUid || !productId) {
      return { eligible: false, verified: false };
    }

    try {
      // 1. Any logged in user can review
      const eligible = true;

      // 2. Check for verified purchase (delivered order containing this product)
      const ordersCol = collection(db, 'orders');
      const q = query(
        ordersCol,
        where('customerUid', '==', customerUid),
        where('orderStatus', '==', 'delivered')
      );
      
      const ordersSnap = await getDocs(q);
      let verified = false;
      
      for (const orderDoc of ordersSnap.docs) {
        const orderData = orderDoc.data();
        if (Array.isArray(orderData.items)) {
          const hasProduct = orderData.items.some((item: any) => item.productId === productId);
          if (hasProduct) {
            verified = true;
            break;
          }
        }
      }

      return { eligible, verified };
    } catch (err) {
      console.warn('Error checking review eligibility:', err);
      return { eligible: true, verified: false };
    }
  },

  /**
   * Fetch a single user's existing review for a specific product.
   * Direct O(1) document lookup at products/{productId}/reviews/{customerUid}.
   */
  async getUserReview(productId: string, customerUid: string): Promise<Review | null> {
    if (!db || !customerUid) return null;
    try {
      const reviewDocRef = doc(db, 'products', productId, 'reviews', customerUid);
      const snap = await getDoc(reviewDocRef);
      if (snap.exists()) {
        return snap.data() as Review;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user review:', error);
      return null;
    }
  },

  /**
   * Submit a new review or edit an existing one.
   * Forces single active review per user per product using customerUid as document ID.
   * New or updated customer submissions start as 'pending' for moderation.
   */
  async submitReview(
    productId: string,
    customerUid: string,
    reviewData: {
      customerName?: string;
      customerPhotoURL?: string;
      rating: number;
      comment: string;
      productName?: string;
      verifiedPurchase?: boolean;
    }
  ): Promise<string> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات.');
    if (!customerUid) throw new Error('سجل دخولك عشان تضيف تقييمك.');

    const docId = customerUid; // Enforce at most one review per user per product
    const reviewDocRef = doc(db, 'products', productId, 'reviews', docId);

    const timestamp = new Date().toISOString();

    const existingSnap = await getDoc(reviewDocRef);
    const isEditing = existingSnap.exists();
    const existingData = isEditing ? existingSnap.data() : null;

    // Check for verified purchase status if not already verified
    let verifiedPurchase = existingData?.verifiedPurchase || false;
    if (!verifiedPurchase) {
      const eligibility = await this.checkUserEligibility(productId, customerUid);
      verifiedPurchase = eligibility.verified;
    }

    const validatedRating = Math.min(5, Math.max(1, Math.round(Number(reviewData.rating) || 5)));
    const cleanComment = (reviewData.comment || '').trim();

    const completeReview: Review = {
      reviewId: docId,
      productId,
      productName: reviewData.productName || existingData?.productName || '',
      customerUid,
      customerName: reviewData.customerName || auth.currentUser?.displayName || 'عميل المتجر',
      customerPhotoURL: reviewData.customerPhotoURL || auth.currentUser?.photoURL || '',
      rating: validatedRating,
      comment: cleanComment,
      verifiedPurchase,
      status: 'pending', // Submissions always start as pending for moderation
      createdAt: isEditing ? (existingData?.createdAt || timestamp) : timestamp,
      updatedAt: timestamp
    };

    await setDoc(reviewDocRef, completeReview);

    // If it was already approved before, recalculate product aggregates because status became pending again
    if (isEditing && existingData?.status === 'approved') {
      await this.updateProductRatingsAggregate(productId);
    }

    return docId;
  },

  /**
   * Delete a review.
   */
  async deleteReview(productId: string, customerUid: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات.');
    if (!customerUid) return;

    const reviewDocRef = doc(db, 'products', productId, 'reviews', customerUid);
    const existingSnap = await getDoc(reviewDocRef);
    const wasApproved = existingSnap.exists() && existingSnap.data()?.status === 'approved';

    await deleteDoc(reviewDocRef);

    if (wasApproved) {
      await this.updateProductRatingsAggregate(productId);
    }
  },

  /**
   * Fetch approved reviews for a single product.
   */
  async getApprovedReviews(productId: string): Promise<Review[]> {
    if (!db) return [];

    try {
      const reviewsColRef = collection(db, 'products', productId, 'reviews');
      const q = query(reviewsColRef, where('status', '==', 'approved'));
      const snapshot = await getDocs(q);

      const list: Review[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Review);
      });

      // Sort by createdAt descending
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return list;
    } catch (error) {
      console.error('Error fetching approved reviews:', error);
      return [];
    }
  },

  /**
   * Fetch reviews for admin moderation with database-level filters and limit pagination.
   */
  async getReviewsForAdmin(options: { status?: string; productId?: string; limitCount?: number } = {}): Promise<Review[]> {
    if (!db) return [];
    const limitCount = options.limitCount || 100;
    try {
      let q;
      if (options.productId && options.productId !== 'all') {
        // Direct subcollection query - extremely efficient
        const colRef = collection(db, 'products', options.productId, 'reviews');
        if (options.status && options.status !== 'all') {
          q = query(colRef, where('status', '==', options.status), limit(limitCount));
        } else {
          q = query(colRef, limit(limitCount));
        }
      } else {
        // collectionGroup query with status filter and limit
        const groupRef = collectionGroup(db, 'reviews');
        if (options.status && options.status !== 'all') {
          q = query(groupRef, where('status', '==', options.status), limit(limitCount));
        } else {
          q = query(groupRef, limit(limitCount));
        }
      }

      const snapshot = await getDocs(q);
      const list: Review[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Review);
      });

      // Sort by createdAt descending
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return list;
    } catch (error) {
      console.error('Error fetching admin reviews:', error);
      return [];
    }
  },

  /**
   * Fetch pending reviews with a safe limit for dashboard count.
   */
  async getPendingReviews(): Promise<Review[]> {
    if (!db) return [];
    try {
      const q = query(
        collectionGroup(db, 'reviews'),
        where('status', '==', 'pending'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const list: Review[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Review);
      });
      return list;
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
      return [];
    }
  },

  /**
   * Fetch all reviews for admin moderation using collectionGroup (delegates to optimized version).
   */
  async getAllReviewsForAdmin(): Promise<Review[]> {
    return this.getReviewsForAdmin({ limitCount: 200 });
  },

  /**
   * Update the review status (approve, hide) by Admin.
   */
  async updateReviewStatus(productId: string, customerUid: string, status: ReviewStatus): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات.');

    const reviewDocRef = doc(db, 'products', productId, 'reviews', customerUid);
    await updateDoc(reviewDocRef, {
      status,
      updatedAt: new Date().toISOString()
    });

    // Recalculate ratings
    await this.updateProductRatingsAggregate(productId);
  },

  /**
   * Recalculates product rating stats and stores them on the product document.
   * Only approved reviews count toward public ratings.
   */
  async updateProductRatingsAggregate(productId: string): Promise<void> {
    if (!db || !productId) return;

    try {
      const reviewsColRef = collection(db, 'products', productId, 'reviews');
      const q = query(reviewsColRef, where('status', '==', 'approved'));
      const snapshot = await getDocs(q);

      let sum = 0;
      let count = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (typeof data.rating === 'number') {
          sum += data.rating;
          count++;
        }
      });

      const averageRating = count > 0 ? Number((sum / count).toFixed(1)) : 0;

      // Update Product document
      const productDocRef = doc(db, 'products', productId);
      await updateDoc(productDocRef, {
        averageRating,
        reviewCount: count
      });
    } catch (error) {
      console.error('Error updating product aggregates:', error);
    }
  }
};

