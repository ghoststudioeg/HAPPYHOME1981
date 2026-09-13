import React from 'react';
import { StoreSettings } from '../types';
import { catalogService } from '../lib/data/catalogService';
import { Phone, MessageCircle, MapPin, Clock, Facebook, Instagram } from 'lucide-react';

interface ContactPageProps {
  settings: StoreSettings;
}

export function ContactPage({ settings }: ContactPageProps) {
  const whatsappUrl = catalogService.getWhatsAppUrl(
    settings.whatsappNumber,
    'مرحبًا، أريد الاستفسار عن منتجات البيت السعيد'
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-12" dir="rtl">
      {/* Title */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-5xl font-black text-[#F8FAFC]">
          تواصل معنا
        </h1>
        <p className="text-sm sm:text-base text-[#94A3B8] max-w-xl mx-auto">
          يسعدنا تواصلكم واستقبال استفساراتكم بشأن المنتجات أو التوفر في المعرض في أي وقت.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Contact Info Cards */}
        <div className="space-y-4">
          {/* WhatsApp Direct */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-6 glass-panel-elevated hover:border-emerald-500/50 rounded-3xl transition-all shadow-xl liquid-reflection border border-emerald-500/30"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform border border-emerald-500/30">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-400">القناة الأسرع للتواصل</span>
                <h3 className="text-lg font-black text-[#F8FAFC]">محادثة واتساب الرسمية</h3>
                <p className="text-xs text-[#94A3B8]">اضغط هنا لبدء المحادثة الفورية مع إدارة المعرض</p>
                <p className="text-sm font-mono text-emerald-400 font-bold pt-1" dir="ltr">
                  {settings.whatsappNumber}
                </p>
              </div>
            </div>
          </a>

          {/* Phone */}
          <div className="p-6 glass-panel rounded-3xl border border-white/[0.06]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl glass-panel text-[#E0B84A] flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F8FAFC]">الاتصال الهاتفي المباشر</h3>
                <p className="text-xs text-[#94A3B8]">للتحدث المباشر مع موظف خدمة العملاء</p>
                <a
                  href={`tel:${settings.phone}`}
                  className="inline-block text-base font-bold text-[#E0B84A] hover:underline pt-1 font-mono"
                  dir="ltr"
                >
                  {settings.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="p-6 glass-panel rounded-3xl border border-white/[0.06]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl glass-panel text-[#E0B84A] flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F8FAFC]">العنوان والموقع</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed pt-1">
                  {settings.address}
                </p>
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="p-6 glass-panel rounded-3xl border border-white/[0.06]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl glass-panel text-[#E0B84A] flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F8FAFC]">مواعيد العمل الرسمية</h3>
                <p className="text-sm text-[#94A3B8] pt-1">
                  {settings.workingHours}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Media & Direct Inquiry */}
        <div className="glass-panel-elevated rounded-3xl p-8 flex flex-col justify-between space-y-8 liquid-reflection border border-white/[0.08]">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-[#F8FAFC]">
              حسابات التواصل الاجتماعي
            </h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              تابع صفحاتنا الرسمية للاطلاع على العروض الحصرية، أحدث الواصلين في المعرض، والتخفيضات الموسمية.
            </p>

            <div className="space-y-3 pt-2">
              {settings.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl glass-panel hover:border-[#D4AF37]/40 text-[#F8FAFC] hover:text-[#E0B84A] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Facebook className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-bold">صفحة فيسبوك الرسمية</span>
                  </div>
                  <span className="text-xs text-[#94A3B8] font-bold">متابعة</span>
                </a>
              )}

              {settings.instagramUrl && (
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl glass-panel hover:border-[#D4AF37]/40 text-[#F8FAFC] hover:text-[#E0B84A] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Instagram className="w-5 h-5 text-pink-400" />
                    <span className="text-sm font-bold">حساب إنستغرام</span>
                  </div>
                  <span className="text-xs text-[#94A3B8] font-bold">متابعة</span>
                </a>
              )}
            </div>
          </div>

          <div className="p-6 glass-panel rounded-2xl border border-white/[0.06] space-y-3">
            <h4 className="text-sm font-bold text-[#E0B84A]">ملاحظة هامة</h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              «البيت السعيد» هو معرض رقمي لخدمة زبائن متجرنا، نوفر إمكانية الحجز والاستفسار الفوري عن جميع المعروضات عبر تطبيق واتساب لراحتكم وسرعة الاستجابة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
