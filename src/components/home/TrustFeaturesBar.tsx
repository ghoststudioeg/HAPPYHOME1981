import React from 'react';
import { ShieldCheck, Tag, Layers, MessageCircle } from 'lucide-react';

export function TrustFeaturesBar() {
  const features = [
    {
      icon: ShieldCheck,
      title: 'جودة مضمونة',
      description: 'منتجات أصلية ومفحوصة بدقة فائقة'
    },
    {
      icon: Tag,
      title: 'أسعار منافسة',
      description: 'أفضل قيمة وأسعار مباشرة ومحدثة'
    },
    {
      icon: Layers,
      title: 'تنوع شامل',
      description: 'تشكيلة متجددة من كافة الفئات والأجهزة'
    },
    {
      icon: MessageCircle,
      title: 'تواصل مباشر',
      description: 'استفسار وطلب فوري عبر واتساب'
    }
  ];

  return (
    <div className="w-full border-y border-[var(--border)] bg-[var(--surface)] backdrop-blur-md py-4 sm:py-5 transition-colors duration-200" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 sm:p-2.5 rounded-xl hover:bg-[var(--surface-elevated)] transition-colors"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[#D6A83A] flex items-center justify-center shrink-0 shadow-xs">
                  <Icon className="w-5 h-5 text-[#D6A83A]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] tracking-tight">
                    {feat.title}
                  </h4>
                  <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    {feat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
