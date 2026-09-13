import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../lib/authContext';
import { reviewService } from '../../lib/data/reviewService';
import { Review, Product } from '../../types';
import { Star, MessageSquare, CheckCircle2, Trash2, Edit2, Plus, X, AlertCircle, LogIn, Clock } from 'lucide-react';


interface ProductReviewsSectionProps {
  product: Product;
  navigate?: (path: string) => void;
  onReviewSubmitted?: () => void;
}

export function ProductReviewsSection({ product, navigate, onReviewSubmitted }: ProductReviewsSectionProps) {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userReview, setUserReview] = useState<Review | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadReviewsAndUserStatus = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch approved reviews for this product
      const approvedList = await reviewService.getApprovedReviews(product.id);
      setReviews(approvedList);

      // If user is authenticated, directly fetch their own review (pending or approved)
      if (user?.uid) {
        const existingReview = await reviewService.getUserReview(product.id, user.uid);
        if (existingReview) {
          setUserReview(existingReview);
          setRating(existingReview.rating || 5);
          setComment(existingReview.comment || '');
        } else {
          setUserReview(null);
        }
      } else {
        setUserReview(null);
      }
    } catch (err) {
      console.error('Error loading product reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [product.id, user?.uid]);

  useEffect(() => {
    loadReviewsAndUserStatus();
  }, [loadReviewsAndUserStatus]);

  // Calculate rating distribution from approved reviews
  const totalCount = reviews.length;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;

  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 5 | 4 | 3 | 2 | 1;
    distribution[star]++;
    sum += r.rating;
  });

  const averageCalculated = totalCount > 0 ? sum / totalCount : 0;
  const displayRating = product.averageRating || averageCalculated || 0;
  const displayCount = product.reviewCount !== undefined ? product.reviewCount : totalCount;

  const handleOpenForm = (editing: boolean) => {
    setIsEditing(editing);
    if (editing && userReview) {
      setRating(userReview.rating || 5);
      setComment(userReview.comment || '');
    } else if (!editing) {
      setRating(5);
      setComment('');
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.uid) {
      triggerToast('سجل دخولك عشان تضيف تقييمك.', 'error');
      return;
    }

    const cleanComment = comment.trim();
    if (!cleanComment) {
      triggerToast('يرجى كتابة رأيك الصادق في المنتج.', 'error');
      return;
    }

    try {
      setSubmitting(true);

      const displayName = profile?.displayName || user.displayName || 'عميل المتجر';
      const photoURL = profile?.photoURL || user.photoURL || '';

      await reviewService.submitReview(product.id, user.uid, {
        customerName: displayName,
        customerPhotoURL: photoURL,
        rating,
        comment: cleanComment,
        productName: product.name
      });

      triggerToast('تم إرسال تقييمك بنجاح وهو قيد المراجعة والاعتماد من الإدارة.');
      setShowForm(false);
      setIsEditing(false);

      await loadReviewsAndUserStatus();
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (error: any) {
      console.error('Failed to submit review:', error);
      triggerToast('حصل خطأ أثناء إرسال التقييم، جرّب تاني.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.uid) return;
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف تقييمك لهذا المنتج؟')) return;

    try {
      setSubmitting(true);
      await reviewService.deleteReview(product.id, user.uid);
      triggerToast('تم حذف تقييمك بنجاح.');

      setComment('');
      setRating(5);
      setUserReview(null);
      setIsEditing(false);
      setShowForm(false);

      await loadReviewsAndUserStatus();
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (error: any) {
      console.error('Failed to delete review:', error);
      triggerToast('حصل خطأ أثناء إرسال التقييم، جرّب تاني.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (val: number) => {
    switch (val) {
      case 5:
        return 'ممتاز جداً (5/5)';
      case 4:
        return 'جيد جداً (4/5)';
      case 3:
        return 'جيد (3/5)';
      case 2:
        return 'مقبول (2/5)';
      case 1:
        return 'سيء (1/5)';
      default:
        return `${val} من 5`;
    }
  };

  return (
    <section
      id="product-reviews"
      className="glass-panel rounded-3xl p-5 sm:p-7 space-y-6 relative overflow-hidden"
      dir="rtl"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 max-w-sm p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in ${
            toastType === 'success'
              ? 'bg-[var(--surface-elevated)] border-emerald-500/50 text-emerald-500'
              : 'bg-[var(--surface-elevated)] border-rose-500/50 text-rose-500'
          }`}
        >
          {toastType === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <p className="text-xs font-bold leading-relaxed">{toastMessage}</p>
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-r-3 border-[#D4AF37] pr-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">تقييمات وآراء العملاء</h2>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            آراء وتجارب حقيقية من عملائنا لتقديم أفضل رؤية شفافة حول أداء الهاتف.
          </p>
        </div>

        {/* Action Button: Sign in prompt for guests, Add/Edit review for authenticated users */}
        <div>
          {!user ? (
            <button
              onClick={() => {
                if (navigate) {
                  navigate('/login');
                } else {
                  window.location.href = '/login';
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] hover:text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)] px-3.5 py-2 rounded-xl transition-all cursor-pointer border border-[#D4AF37]/30 shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>سجل دخولك عشان تضيف تقييمك</span>
            </button>
          ) : !showForm ? (
            <button
              onClick={() => handleOpenForm(!!userReview)}
              className="inline-flex items-center gap-1.5 text-xs font-black text-black bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] hover:brightness-110 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
            >
              {userReview ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{userReview ? 'تعديل تقييمك' : 'أضف تقييمك'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* User's own review status banner if exists */}
      {user && userReview && !showForm && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            userReview.status === 'pending'
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-500'
              : userReview.status === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {userReview.status === 'pending' ? (
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {userReview.status === 'pending'
                  ? 'تقييمك قيد المراجعة والاعتماد من الإدارة'
                  : 'تم اعتماد ونشر تقييمك بنجاح'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                تقييمك الحالي: {userReview.rating} من 5 نجوم — &ldquo;{userReview.comment}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => handleOpenForm(true)}
              className="text-xs font-bold text-[#E0B84A] hover:underline px-2 py-1 cursor-pointer"
            >
              تعديل
            </button>
            <button
              onClick={handleDelete}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 px-2 py-1 cursor-pointer"
            >
              حذف
            </button>
          </div>
        </div>
      )}

      {/* Ratings Summary & Breakdown grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
        {/* Metric Summary */}
        <div className="flex flex-col items-center justify-center text-center space-y-2 border-l border-[var(--border)] pl-0 md:pl-6 pb-6 md:pb-0">
          <span className="text-4xl sm:text-5xl font-black text-[#E0B84A] tracking-tight font-mono">
            {displayRating > 0 ? displayRating.toFixed(1) : '0.0'}
          </span>

          {/* Average Stars */}
          <div className="flex items-center gap-0.5 text-[#D4AF37]">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(displayRating) ? 'fill-[#D4AF37]' : 'text-[var(--border)]'
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-[var(--text-secondary)] font-bold">
            {displayCount > 0 ? (
              <>
                بناءً على {displayCount}{' '}
                {displayCount === 1 ? 'تقييم معتمد' : displayCount > 10 ? 'تقييماً معتمداً' : 'تقييمات معتمدة'}
              </>
            ) : (
              'لا توجد تقييمات معتمدة بعد'
            )}
          </p>
        </div>

        {/* Stars distribution progress bars */}
        <div className="col-span-1 md:col-span-2 space-y-2.5 flex flex-col justify-center">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars as 5 | 4 | 3 | 2 | 1];
            const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-3.5 font-bold text-[var(--text-secondary)] text-center font-mono">{stars}</span>
                <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37] shrink-0" />
                <div className="flex-1 h-2 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-10 text-left text-[var(--text-secondary)] font-bold font-mono">
                  {percent.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Submit / Edit Form (only visible if showForm is true) */}
      {showForm && user && (
        <form
          onSubmit={handleSubmit}
          className="p-5 rounded-2xl bg-[var(--surface)] border border-[#D4AF37]/30 space-y-4 animate-fade-in relative"
        >
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setIsEditing(false);
            }}
            className="absolute top-4 left-4 p-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="إغلاق النموذج"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-1">
            <h3 className="text-sm font-black text-[#E0B84A]">
              {isEditing ? 'تعديل تقييمك للمنتج' : 'اكتب رأيك وقيم المنتج'}
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              رأيك يساعد العملاء الآخرين على اتخاذ القرار الصحيح قبل الشراء.
            </p>
          </div>

          {/* Interactive Rating Stars Select with >=44px touch targets */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] block">
              تقييمك بالنجوم <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    aria-label={`تقييم ${star} من 5`}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--border)] text-[#D4AF37] transition-all cursor-pointer active:scale-90"
                  >
                    <Star
                      className={`w-7 h-7 transition-transform ${
                        active ? 'fill-[#D4AF37] text-[#D4AF37] scale-110' : 'text-[var(--border)]'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="text-xs font-black text-[#D4AF37] mr-2">
                {getRatingLabel(hoverRating !== null ? hoverRating : rating)}
              </span>
            </div>
          </div>

          {/* Comment textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] block">
              رأيك وتجربتك للمنتج <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="اكتب انطباعك عن أداء الهاتف، عمر البطارية، جودة الكاميرات، الشاشة، وهل تنصح به؟"
              className="w-full p-3.5 rounded-xl bg-[var(--surface-elevated)] focus:bg-[var(--surface)] border border-[var(--border)] focus:border-[#D4AF37]/50 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-[10px] text-[#94A3B8]">
              يخضع التقييم للمراجعة والاعتماد لضمان الشفافية.
            </div>

            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف التقييم</span>
                </button>
              )}

              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50 active:scale-95"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-[#05080D] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>{isEditing ? 'تعديل التقييم' : 'نشر التقييم'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Reviews List */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-black text-[var(--text-secondary)] border-b border-[var(--border)] pb-2 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          <span>المراجعات المعتمدة ({reviews.length})</span>
        </h3>

        {loading ? (
          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
            <span>جاري تحميل الآراء والتقييمات...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-secondary)] space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-[var(--border)]" />
            <p className="text-xs font-bold text-[var(--text-secondary)]">لا توجد تقييمات معتمدة لهذا المنتج بعد.</p>
            <p className="text-[11px] text-[var(--text-muted)]">كن أول من يشاركنا رأيه وتجربته في هذا الهاتف!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {reviews.map((rev) => {
              const starCount = Math.min(5, Math.max(1, Math.round(rev.rating)));
              return (
                <div
                  key={rev.reviewId}
                  className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[#D4AF37]/30 transition-all space-y-2.5 shadow-sm"
                >
                  {/* Reviewer Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {rev.customerPhotoURL ? (
                        <img
                          src={getValidImageSrc(rev.customerPhotoURL)}
                          alt={rev.customerName}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-[var(--border)]"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4AF37]/10 to-[#E0B84A]/30 flex items-center justify-center text-xs font-black text-[#D4AF37] border border-[var(--border)]">
                          {(rev.customerName || 'ع').slice(0, 1)}
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-[var(--text-primary)]">{rev.customerName}</p>
                          {rev.verifiedPurchase && (
                            <span
                              className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/25 flex items-center gap-0.5 shrink-0"
                              title="شراء مؤكد"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>شراء مؤكد</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-[var(--text-muted)] font-mono">
                          {new Date(rev.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Review Stars */}
                    <div className="flex items-center gap-0.5 text-[#D4AF37]">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= starCount ? 'fill-[#D4AF37]' : 'text-[var(--border)]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Comment Text */}
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed pr-1 font-normal break-words whitespace-pre-line">
                    {rev.comment}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
