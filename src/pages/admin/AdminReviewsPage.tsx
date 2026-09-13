import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useEffect, useState } from 'react';
import { reviewService } from '../../lib/data/reviewService';
import { productService } from '../../lib/data/productService';
import { Review, ReviewStatus, Product } from '../../types';
import { Star, Check, EyeOff, Trash2, ShieldAlert, CheckCircle2, MessageSquare, Filter, RefreshCw, Search } from 'lucide-react';


interface AdminReviewsPageProps {
  navigate: (path: string) => void;
}

export function AdminReviewsPage({ navigate }: AdminReviewsPageProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const handleSetReviewStatus = (status: string) => {
    setSelectedStatus(status);
    const params = new URLSearchParams(window.location.search);
    if (status && status !== 'all') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    window.history.pushState(null, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Actions states
  const [actionLoading, setActionLoading] = useState<string | null>(null); // holds reviewId of item being modified
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allReviews, allProducts] = await Promise.all([
        reviewService.getReviewsForAdmin({ status: selectedStatus, productId: selectedProductId }),
        productService.getAllProducts(true)
      ]);
      setReviews(allReviews);
      setProducts(allProducts);
    } catch (err: any) {
      console.error('Error fetching reviews or products for admin:', err);
      setError('تعذر تحميل بيانات التقييمات والمراجعات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    if (statusParam) {
      setSelectedStatus(statusParam);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedProductId]);

  // Handle status update
  const handleUpdateStatus = async (review: Review, newStatus: ReviewStatus) => {
    try {
      setActionLoading(review.reviewId);
      await reviewService.updateReviewStatus(review.productId, review.customerUid, newStatus);
      triggerToast(newStatus === 'approved' ? 'تم اعتماد ونشر المراجعة بنجاح' : 'تم إخفاء المراجعة بنجاح');
      
      // Refresh local list
      await loadData();
    } catch (err: any) {
      console.error('Error updating review status:', err);
      triggerToast('فشل تحديث حالة المراجعة.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete
  const handleDeleteReview = async (review: Review) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه المراجعة نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    try {
      setActionLoading(review.reviewId);
      await reviewService.deleteReview(review.productId, review.customerUid);
      triggerToast('تم حذف المراجعة وتحديث إحصائيات المنتج بنجاح.');
      
      // Refresh local list
      await loadData();
    } catch (err: any) {
      console.error('Error deleting review:', err);
      triggerToast('فشل حذف المراجعة.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter reviews
  const filteredReviews = reviews.filter((rev) => {
    const productMatch = selectedProductId === 'all' || rev.productId === selectedProductId;
    const ratingMatch = selectedRating === 'all' || String(rev.rating) === selectedRating;
    const statusMatch = selectedStatus === 'all' || rev.status === selectedStatus;
    
    const term = searchQuery.trim().toLowerCase();
    const prod = products.find(p => p.id === rev.productId);
    const searchMatch = !term ||
      (rev.customerName && rev.customerName.toLowerCase().includes(term)) ||
      (rev.productName && rev.productName.toLowerCase().includes(term)) ||
      (prod && prod.name.toLowerCase().includes(term)) ||
      (rev.comment && rev.comment.toLowerCase().includes(term));

    return productMatch && ratingMatch && statusMatch && searchMatch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 max-w-sm p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in ${
          toast.type === 'success' 
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300' 
            : 'bg-rose-950/95 border-rose-500/50 text-rose-300'
        }`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-xs font-bold leading-relaxed">{toast.message}</p>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-[#D4AF37] fill-[#D4AF37]" />
            <span>إدارة المراجعات والتقييمات</span>
          </h1>
          <p className="text-xs text-[#94A3B8]">
            مراجعة واعتماد آراء وتجارب العملاء، وحذف المشاركات غير اللائقة لتأمين دقة التقييمات.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-xs font-bold text-[#CBD5E1] transition-all cursor-pointer border border-white/[0.08]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
          {error}
        </div>
      )}

      {/* Quick Stats overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#D4AF37]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#94A3B8] font-bold">إجمالي المراجعات</p>
            <p className="text-lg font-black text-white">{reviews.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-[#94A3B8] font-bold">المراجعات المعتمدة</p>
            <p className="text-lg font-black text-emerald-400">
              {reviews.filter(r => r.status === 'approved').length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <RefreshCw className="w-4 h-4 animate-spin-slow text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-[#94A3B8] font-bold">بانتظار المراجعة والاعتماد</p>
            <p className="text-lg font-black text-amber-400">
              {reviews.filter(r => r.status === 'pending').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Container */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-2">
          <h2 className="text-xs font-black text-[#CBD5E1] flex items-center gap-1.5 pr-1">
            <Filter className="w-4 h-4 text-[#D4AF37]" />
            <span>تصفية وفرز المراجعات</span>
          </h2>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم العميل، المنتج أو النص..."
              className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-[#091424] text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#D4AF37]/50 outline-none placeholder:text-[#64748B] transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Product Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#94A3B8]">تصفية حسب المنتج</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#091424] text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#D4AF37]/50 outline-none transition-colors"
            >
              <option value="all">كل الهواتف والمنتجات ({products.length})</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Rating Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#94A3B8]">حسب التقييم بالنجوم</label>
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#091424] text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#D4AF37]/50 outline-none transition-colors"
            >
              <option value="all">كل التقييمات بالنجوم</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 نجوم)</option>
              <option value="4">⭐⭐⭐⭐ (4 نجوم)</option>
              <option value="3">⭐⭐⭐ (3 نجوم)</option>
              <option value="2">⭐⭐ (نجمتان)</option>
              <option value="1">⭐ (نجمة واحدة)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#94A3B8]">حالة المراجعة</label>
            <select
              value={selectedStatus}
              onChange={(e) => handleSetReviewStatus(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#091424] text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#D4AF37]/50 outline-none transition-colors"
            >
              <option value="all">كل الحالات</option>
              <option value="pending">⏳ قيد المراجعة والمعاينة</option>
              <option value="approved">⭐ معتمدة ومنشورة للعامة</option>
              <option value="hidden">👁️ مخفية / غير منشورة</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews Table / Lists */}
      {loading ? (
        <div className="text-center py-12 space-y-4">
          <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#94A3B8]">جاري جلب قائمة المراجعات والتقييمات من Firestore...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-16 p-6 rounded-2xl bg-white/[0.01] border border-white/[0.03] space-y-2">
          <ShieldAlert className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-xs font-bold text-[#CBD5E1]">لا توجد مراجعات تطابق خيارات التصفية المحددة.</p>
          <p className="text-[11px] text-[#94A3B8]">تأكد من اختيار فلاتر مختلفة، أو انتظر تقديم مراجعات من العملاء.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[10px] text-[#94A3B8] font-bold">تم العثور على {filteredReviews.length} مراجعة تطابق البحث</p>
          
          <div className="grid grid-cols-1 gap-4">
            {filteredReviews.map((rev) => {
              const prod = products.find(p => p.id === rev.productId);
              return (
                <div 
                  key={rev.reviewId} 
                  className={`p-5 rounded-2xl bg-[#07111C]/60 border transition-all space-y-3.5 relative overflow-hidden ${
                    rev.status === 'pending' 
                      ? 'border-amber-500/20 hover:border-amber-500/40 bg-gradient-to-r from-amber-500/[0.02] to-transparent' 
                      : rev.status === 'approved' 
                      ? 'border-white/[0.04] hover:border-[#D4AF37]/30' 
                      : 'border-zinc-800 bg-zinc-950/40 opacity-70'
                  }`}
                >
                  {/* Status Indicator Band */}
                  {rev.status === 'pending' && (
                    <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />
                  )}

                  {/* Header info */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {rev.customerPhotoURL ? (
                        <img 
                          src={getValidImageSrc(rev.customerPhotoURL)} 
                          alt={rev.customerName} 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-white/[0.08]" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-sm font-black text-[#D4AF37] border border-white/[0.08]">
                          {rev.customerName.slice(0, 1)}
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-black text-white">{rev.customerName}</p>
                          <span className="text-[9px] text-[#64748B] font-semibold">UID: {rev.customerUid.slice(0, 8)}...</span>
                          {rev.verifiedPurchase && (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold shrink-0">
                              شراء مؤكد
                            </span>
                          )}
                        </div>
                        
                        {/* Target Product info */}
                        <div className="text-[10px] flex items-center gap-1">
                          <span className="text-[#94A3B8]">على منتج:</span>
                          <button
                            onClick={() => prod && navigate(`/product/${prod.slug}`)}
                            className="text-[#E0B84A] hover:underline font-bold transition-all text-left"
                          >
                            {rev.productName || prod?.name || 'منتج غير معروف'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right block: rating stars and date */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-0.5 text-[#D4AF37]">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-3.5 h-3.5 ${star <= rev.rating ? 'fill-[#D4AF37]' : 'text-zinc-800'}`} 
                          />
                        ))}
                      </div>
                      <span className="text-[9px] text-[#64748B] font-mono">
                        {new Date(rev.createdAt).toLocaleDateString('ar-EG', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Comment section */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.03]">
                    <p className="text-xs text-[#CBD5E1] leading-relaxed whitespace-pre-line font-normal pr-1">
                      {rev.comment}
                    </p>
                  </div>

                  {/* Action buttons footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#94A3B8] font-bold">الحالة الحالية:</span>
                      {rev.status === 'pending' ? (
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-lg border border-amber-500/20 font-bold">⏳ قيد الانتظار</span>
                      ) : rev.status === 'approved' ? (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 font-bold">⭐ معتمد ومنشور</span>
                      ) : (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-lg border border-zinc-700 font-bold">👁️ مخفي</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Show action loading if active */}
                      {actionLoading === rev.reviewId ? (
                        <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mr-3" />
                      ) : (
                        <>
                          {/* Approve Button */}
                          {rev.status !== 'approved' && (
                            <button
                              onClick={() => handleUpdateStatus(rev, 'approved')}
                              className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>اعتماد ونشر</span>
                            </button>
                          )}

                          {/* Hide Button */}
                          {rev.status !== 'hidden' && (
                            <button
                              onClick={() => handleUpdateStatus(rev, 'hidden')}
                              className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>إخفاء التقييم</span>
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteReview(rev)}
                            className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف المراجعة</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
