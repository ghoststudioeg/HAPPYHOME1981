import React from 'react';
import { Heart, LogIn, X, Sparkles } from 'lucide-react';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToLogin: () => void;
}

export function LoginPromptModal({
  isOpen,
  onClose,
  onNavigateToLogin
}: LoginPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass-panel-elevated rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/[0.1] relative space-y-6 liquid-reflection animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Heading */}
        <div className="text-center space-y-3 pt-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-b from-[#D4AF37]/20 to-rose-500/10 border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            <Heart className="w-8 h-8 text-[#E0B84A] fill-[#D4AF37]/30" />
          </div>

          <h3 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
            سجل دخولك لإضافة المنتج إلى المفضلة
          </h3>

          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed max-w-xs mx-auto">
            قم بتسجيل الدخول السريع لحفظ منتجاتك وأجهزتك المفضلة، ومتابعة الأسعار والعروض الخاصة من أي جهاز.
          </p>
        </div>

        {/* Value Props */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2 text-xs text-[#CBD5E1]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#E0B84A] shrink-0" />
            <span>حفظ المنتجات ومقارنتها في أي وقت</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#E0B84A] shrink-0" />
            <span>تسجيل دخول فوري بنقرة واحدة عبر حساب Google</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={() => {
              onClose();
              onNavigateToLogin();
            }}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#D4AF37] via-[#E0B84A] to-[#B88A24] text-[#05080D] font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(212,175,55,0.25)] hover:brightness-110 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول الآن</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 text-xs font-bold text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer text-center"
          >
            متابعة التصفح كزائر
          </button>
        </div>
      </div>
    </div>
  );
}
