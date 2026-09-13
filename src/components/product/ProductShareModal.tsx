import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';
import { Product } from '../../types';
import { buildProductShareData } from '../../lib/seoUtils';


interface ProductShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  effectivePrice: number;
  isCampaignActive?: boolean;
  storeName?: string;
}

export function ProductShareModal({
  isOpen,
  onClose,
  product,
  effectivePrice,
  isCampaignActive,
  storeName = 'متجر البيت السعيد 1981'
}: ProductShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen || !product) return null;

  const shareData = buildProductShareData({
    product,
    effectivePrice,
    isCampaignActive,
    storeName
  });

  const canWebShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareData.whatsappText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleWebShare = async () => {
    if (!canWebShare) {
      handleCopyLink();
      return;
    }
    try {
      await navigator.share({
        title: shareData.title,
        text: shareData.text,
        url: shareData.url
      });
    } catch (err: any) {
      // Ignore user aborting the share sheet
      if (err?.name !== 'AbortError') {
        handleCopyLink();
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-[#0B1320] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#F8FAFC]">مشاركة المنتج</h3>
                <p className="text-xs text-[#94A3B8]">شارك تفاصيل المنتج والرابط المباشر مع أصدقائك</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product Preview Card */}
          <div className="my-5 p-3.5 sm:p-4 rounded-2xl bg-[#05080D] border border-white/5 flex gap-3.5 items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#0B1320] border border-white/10 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
              {product.mainImageUrl ? (
                <img
                  src={getValidImageSrc(product.mainImageUrl)}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <img
                  src="/logo-square.svg"
                  alt={product.name}
                  className="w-12 h-12 object-contain opacity-50"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-[#F8FAFC] line-clamp-2 mb-1">{product.name}</h4>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-black text-[#D4AF37]">
                  {effectivePrice.toLocaleString('ar-EG')} ج.م
                </span>
                {isCampaignActive && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    عرض ترويجي
                  </span>
                )}
              </div>
              {shareData.shortDescription && (
                <p className="text-[11px] text-[#94A3B8] line-clamp-1">{shareData.shortDescription}</p>
              )}
            </div>
          </div>

          {/* Share Action Buttons */}
          <div className="space-y-2.5">
            {/* 1. WhatsApp Share - Direct URL Scheme */}
            <a
              id="whatsapp-share-btn"
              href={shareData.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-black text-sm flex items-center justify-between shadow-lg shadow-[#25D366]/20 transition-all hover:scale-[1.01] active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-black fill-current" />
                </div>
                <span>مشاركة عبر واتساب (WhatsApp)</span>
              </div>
              <ExternalLink className="w-4 h-4 opacity-70" />
            </a>

            {/* 2. Web Share API (Mobile / Supported Browsers) */}
            {canWebShare && (
              <button
                id="native-web-share-btn"
                onClick={handleWebShare}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-[#05080D] font-black text-sm flex items-center justify-between shadow-lg shadow-[#D4AF37]/10 transition-all hover:scale-[1.01] active:scale-98 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-[#05080D]" />
                  </div>
                  <span>مشاركة عبر تطبيقات الهاتف (Share Sheet)</span>
                </div>
                <span className="text-xs opacity-75">مباشر</span>
              </button>
            )}

            {/* 3. Copy Link */}
            <button
              id="copy-product-link-btn"
              onClick={handleCopyLink}
              className={`w-full py-3.5 px-4 rounded-2xl border text-sm font-bold flex items-center justify-between transition-all active:scale-98 cursor-pointer ${
                copied
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                </div>
                <span>{copied ? 'تم نسخ الرابط بنجاح!' : 'نسخ رابط المنتج المباشر'}</span>
              </div>
              <span className="text-xs text-zinc-500 font-mono">/product/...</span>
            </button>

            {/* 4. Copy Full Summary */}
            <button
              id="copy-product-summary-btn"
              onClick={handleCopySummary}
              className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                copiedText
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-transparent hover:bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>{copiedText ? 'تم نسخ نص وتفاصيل المنتج!' : 'نسخ النص الكامل مع السعر والرابط'}</span>
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* URL Display */}
          <div className="mt-4 p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 select-all overflow-hidden">
            <span className="truncate">{shareData.url}</span>
            <span className="shrink-0 text-[10px] text-[#D4AF37] font-sans">رابط دائم ومستقر</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
