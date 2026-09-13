import React from 'react';
import { MessageCircle, PhoneCall, Clock, Sparkles } from 'lucide-react';
import { catalogService } from '../../lib/data/catalogService';

interface WhatsAppCtaBannerProps {
  whatsappNumber: string;
  phone?: string;
  workingHours?: string;
}

export function WhatsAppCtaBanner({
  whatsappNumber,
  phone,
  workingHours
}: WhatsAppCtaBannerProps) {
  const handleOpenWhatsApp = () => {
    const message = 'مرحبًا، أود الاستفسار عن منتجات الكتالوج وتقديم طلب جديد.';
    const url = catalogService.getWhatsAppUrl(whatsappNumber, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="w-full py-8 sm:py-12" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden glass-panel-elevated border border-[#D4AF37]/30 p-6 sm:p-10 liquid-reflection shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          {/* Subtle Ambient Refraction */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[radial-gradient(circle,rgba(212,175,55,0.08)_0%,transparent_70%)] blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-72 h-72 bg-[radial-gradient(circle,rgba(16,185,129,0.08)_0%,transparent_70%)] blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Content Text */}
            <div className="space-y-3 text-center lg:text-right max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-pill-gold text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>خدمة عملاء راقية ومباشرة</span>
              </div>

              <h2 className="text-xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight leading-snug">
                هل تبحث عن جهاز محدد أو ترغب في استفسار فوري؟
              </h2>

              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                فريقنا المعتمد متاح للرد الفوري على استفساراتكم، وتأكيد توفر الأجهزة والأسعار وتفاصيل التقسيط والتوصيل مباشرة عبر واتساب.
              </p>

              {/* Working hours & direct phone */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2 text-xs text-[var(--text-secondary)]">
                {phone && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <PhoneCall className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span dir="ltr">{phone}</span>
                  </span>
                )}
                {workingHours && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{workingHours}</span>
                  </span>
                )}
              </div>
            </div>

            {/* CTA Button */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="group py-4 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm sm:text-base transition-all duration-300 flex items-center gap-3 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.4)] cursor-pointer hover:scale-102 active:scale-98"
              >
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform" />
                <span>تواصل معنا عبر واتساب الآن</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
