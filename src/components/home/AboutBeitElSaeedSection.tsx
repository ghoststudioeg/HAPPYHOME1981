import React from 'react';
import { Award, ShieldCheck, Tag, Headphones, ArrowLeft, Sparkles } from 'lucide-react';

interface AboutBeitElSaeedSectionProps {
  onNavigate: (path: string) => void;
}

export function AboutBeitElSaeedSection({ onNavigate }: AboutBeitElSaeedSectionProps) {
  const highlights = [
    {
      icon: Award,
      title: 'خبرة عريقة منذ 1981',
      description: 'أكثر من أربعة عقود في تقديم أفضل الأجهزة الإلكترونية والموبايلات بأعلى معايير المصداقية'
    },
    {
      icon: ShieldCheck,
      title: 'ضمان رسمي معتمد',
      description: 'كافة الأجهزة أصلية بالكامل ومشمولة بضمان الوكلاء المعتمدين في جمهورية مصر العربية'
    },
    {
      icon: Tag,
      title: 'تقسيط مرن يناسب الجميع',
      description: 'قسط كل اللي نفسك فيه بأنظمة سداد ميسرة وعروض أسعار تنافسية تلائم كافة الاحتياجات'
    },
    {
      icon: Headphones,
      title: 'خدمة عملاء مباشرة وراقية',
      description: 'فريق عمل متواجد دائمًا للإجابة على استفساراتكم ومساعدتكم في اختيار الجهاز الأنسب لكم'
    }
  ];

  return (
    <section className="w-full py-6 sm:py-10" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden glass-panel-elevated border border-[#D4AF37]/30 p-8 sm:p-12 liquid-reflection shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          {/* Subtle gold ambient glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-[radial-gradient(circle,rgba(212,175,55,0.12)_0%,transparent_70%)] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[radial-gradient(circle,rgba(212,175,55,0.06)_0%,transparent_70%)] blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Header Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full glass-pill-gold text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>منذ 1981</span>
                <span className="text-white/20">•</span>
                <span>45 سنة من الريادة والثقة</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight leading-tight">
                عن البيت السعيد
              </h2>

              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                منذ عام 1981، والبيت السعيد يواصل تقديم تجربة تسوق تعتمد على الخبرة والأصالة وتنوع المنتجات الإلكترونية والمنزلية التي تلبي تطلعات كل أسرة، مع التزام ثابت بأعلى معايير الجودة وخدمات ما بعد البيع.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/about')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass-pill hover:bg-white/[0.08] hover:border-[#D4AF37]/50 text-[var(--text-primary)] text-xs font-bold transition-all cursor-pointer"
                >
                  <span>اقرأ المزيد عن مسيرتنا</span>
                  <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
                </button>
              </div>
            </div>

            {/* Right Highlights 2x2 Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {highlights.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl glass-panel border border-[var(--border)] hover:border-[#D4AF37]/35 transition-all duration-300 space-y-2 group hover:-translate-y-0.5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/12 border border-[#D4AF37]/25 flex items-center justify-center text-[#E0B84A] group-hover:scale-108 transition-transform">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
