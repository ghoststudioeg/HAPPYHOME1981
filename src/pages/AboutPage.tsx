import React from 'react';
import { StoreSettings } from '../types';
import { ShieldCheck, HeartHandshake, Sparkles, Building2, ChevronLeft } from 'lucide-react';

interface AboutPageProps {
  settings: StoreSettings;
  navigate: (path: string) => void;
}

export function AboutPage({ settings, navigate }: AboutPageProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12" dir="rtl">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-pill text-[#E0B84A] text-xs font-bold">
          <Building2 className="w-4 h-4 text-[#D4AF37]" />
          <span>منذ 1981 — 45 سنة من الخبرة والثقة</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[var(--text-primary)]">
          عن البيت السعيد
        </h1>
        <p className="text-base sm:text-lg text-[#E0B84A] font-bold">
          45 سنة من الخبرة والثقة
        </p>
      </div>

      {/* Main Narrative Card */}
      <div className="glass-panel-elevated rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6 text-[var(--text-primary)] leading-relaxed text-base sm:text-lg liquid-reflection border border-[var(--border)]">
        <p className="text-[var(--text-primary)] font-semibold leading-relaxed">
          منذ عام 1981، والبيت السعيد يواصل تقديم تجربة تسوق تعتمد على الخبرة والثقة وتنوع المنتجات التي تلبي كافة احتياجات المنزل والأسرة.
        </p>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
          انطلق «البيت السعيد» ليكون الاسم الموثوق به لأكثر من أربعة عقود، حيث نحرص على انتقاء المنتجات بعناية فائقة تلائم الاستخدام اليومي وتتحمل ظروف الحياة العملية، بدءًا من الموبايلات والإلكترونيات، وصولاً إلى الأجهزة المنزلية والكهربائية والحقائب والهدايا.
        </p>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
          نؤمن بأن جودة الخدمة وصدق التعامل هما أساس استمراريتنا، ويسعدنا دائماً استقبالكم في مقرنا أو التواصل المباشر معكم عبر واتساب لتقديم كافة الاستشارات والرد على استفساراتكم.
        </p>
      </div>

      {/* Values Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl space-y-3 border border-[var(--border)]">
          <div className="w-11 h-11 rounded-xl glass-panel text-[#E0B84A] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <h3 className="font-bold text-base text-[var(--text-primary)]">مصداقية وجودة</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            لا نساوم على جودة الخامات والتصنيع، وجميع منتجاتنا تخضع للفحص والتدقيق قبل عرضها في متجرنا.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl space-y-3 border border-[var(--border)]">
          <div className="w-11 h-11 rounded-xl glass-panel text-[#E0B84A] flex items-center justify-center">
            <HeartHandshake className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <h3 className="font-bold text-base text-[var(--text-primary)]">خدمة عملاء حقيقية</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            تواصل بشري مباشر عبر الهاتف والواتساب لتسهيل اختيار المنتج الأنسب لاحتياجك.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl space-y-3 border border-[var(--border)]">
          <div className="w-11 h-11 rounded-xl glass-panel text-[#E0B84A] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <h3 className="font-bold text-base text-[var(--text-primary)]">أسعار مدروسة</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            معادلة تجمع بين السعر العادل والمنتج العملي دون مبالغات تجارية.
          </p>
        </div>
      </div>

      {/* Navigation back */}
      <div className="text-center pt-4">
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-sm rounded-xl transition-all shadow-[0_10px_25px_rgba(212,175,55,0.25)] hover:brightness-110 cursor-pointer"
        >
          <span>تصفح منتجات المتجر الآن</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
