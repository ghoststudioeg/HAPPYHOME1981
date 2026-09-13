import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React from 'react';
import { ComingSoonItem } from '../../types';
import { Calendar, Clock, Sparkles } from 'lucide-react';


interface ComingSoonSectionProps {
  items: ComingSoonItem[];
}

export function ComingSoonSection({ items }: ComingSoonSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className="w-full py-8 sm:py-10" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-sky-400 to-indigo-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
                  قادم قريبًا
                </h2>
                <span className="text-[11px] font-bold text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 rounded-full">
                  ترقبوها في المتجر
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                نظرة مسبقة على أحدث المنتجات المتوقع وصولها في الأيام القادمة
              </p>
            </div>
          </div>
        </div>

        {/* Coming Soon Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-2xl overflow-hidden glass-card-interactive flex flex-col liquid-reflection"
            >
              {/* Teaser Image */}
              <div className="relative aspect-[16/10] w-full bg-[#05080D] overflow-hidden flex items-center justify-center p-3">
                <img
                  src={getValidImageSrc(item.image || '/logo.svg')}
                  alt={item.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 opacity-95"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A111A] via-transparent to-transparent pointer-events-none" />

                {/* Status Badges */}
                <div className="absolute top-3 right-3 z-10">
                  <span className="bg-sky-500/90 backdrop-blur-md text-[#05080D] text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>قريبًا</span>
                  </span>
                </div>

                {item.expectedDate && (
                  <div className="absolute bottom-3 right-3 z-10">
                    <span className="glass-panel text-sky-300 border border-sky-500/30 text-[10px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                      <Calendar className="w-3 h-3 text-sky-400" />
                      <span>موعد الوصول المتوقع: {item.expectedDate}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between bg-[#0A111A]/40">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC] group-hover:text-sky-300 transition-colors mb-2 leading-snug">
                    {item.name}
                  </h3>

                  {item.shortDescription && (
                    <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-3">
                      {item.shortDescription}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>متاح للحجز والاستفسار المسبق</span>
                  <span className="text-sky-400 font-bold font-mono">Coming Soon</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
