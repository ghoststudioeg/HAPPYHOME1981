import React from 'react';
import { StoreLogo } from './StoreLogo';
import { StoreSettings } from '../types';
import { catalogService } from '../lib/data/catalogService';
import { Phone, MessageCircle, MapPin, Clock, Facebook, Instagram, ShieldCheck, Sparkles } from 'lucide-react';

interface FooterProps {
  settings: StoreSettings;
  navigate: (path: string) => void;
}

export function Footer({ settings, navigate }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const whatsAppUrl = catalogService.getWhatsAppUrl(settings.whatsappNumber);

  return (
    <footer className="bg-[var(--surface)] border-t border-[var(--border)] text-[var(--text-secondary)] relative liquid-reflection transition-colors duration-200" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Col */}
          <div className="space-y-4">
            <div
              className="cursor-pointer inline-flex items-center select-none transition-opacity hover:opacity-90"
              onClick={() => navigate('/')}
              title={settings.storeName}
            >
              <StoreLogo 
                settings={settings}
                className="h-8 sm:h-9 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.08)]"
              />
            </div>
            <p className="text-sm text-[var(--text-primary)] font-bold leading-relaxed">
              {settings.tagline || 'قسط كل اللي نفسك فيه'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              متجر البيت السعيد — خبرة 45 سنة من الجودة والثقة في تقديم أحدث الموبايلات، الأجهزة الإلكترونية والمنزلية بأفضل الأسعار وأسهل نظم التقسيط في مصر.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold text-[var(--text-secondary)]">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>منذ عام 1981</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 border-r-3 border-[#D4AF37] pr-3">
              روابط سريعة
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-[#E0B84A] transition-colors cursor-pointer"
                >
                  الرئيسية
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/products')}
                  className="hover:text-[#E0B84A] transition-colors cursor-pointer"
                >
                  تصفح المنتجات
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/categories')}
                  className="hover:text-[#E0B84A] transition-colors cursor-pointer"
                >
                  جميع الأقسام
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/about')}
                  className="hover:text-[#E0B84A] transition-colors cursor-pointer"
                >
                  عن البيت السعيد
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/contact')}
                  className="hover:text-[#E0B84A] transition-colors cursor-pointer"
                >
                  تواصل معنا
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 border-r-3 border-[#D4AF37] pr-3">
              بيانات التواصل
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a href={`tel:${settings.phone.replace(/[^0-9]/g, '')}`} className="hover:text-[#D4AF37] transition-colors" dir="ltr">
                  {settings.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#D4AF37] transition-colors"
                  dir="ltr"
                >
                  واتساب: {settings.whatsappNumber}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{settings.workingHours}</span>
              </li>
            </ul>
          </div>

          {/* Social & Catalog Guarantee */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 border-r-3 border-[#D4AF37] pr-3">
              تابعنا وتواصل
            </h4>
            <div className="flex items-center gap-2.5">
              {settings.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-[var(--text-primary)] hover:text-[#E0B84A] hover:border-[#D4AF37]/50 transition-all"
                  aria-label="فيسبوك"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {settings.instagramUrl && (
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-[var(--text-primary)] hover:text-[#E0B84A] hover:border-[#D4AF37]/50 transition-all"
                  aria-label="انستجرام"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl glass-pill flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 transition-all"
                aria-label="واتساب"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>

            <div className="p-3.5 glass-panel rounded-xl border border-[var(--border)] flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <span>متجر البيت السعيد — 45 سنة من الخبرة والثقة المتبادلة.</span>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <p>
            © {currentYear} <span className="text-[#E0B84A] font-bold">{settings.storeName}</span>. جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-4">
            <span>45 سنة من الخبرة والثقة</span>
            <span>•</span>
            <button
              onClick={() => navigate('/admin/login')}
              className="hover:text-[#E0B84A] transition-colors cursor-pointer"
            >
              دخول المشرف
            </button>
          </div>
        </div>

        {/* Developer Credit Signature */}
        <div className="mt-8 pt-6 border-t border-[var(--border)]/40 text-center flex flex-col items-center gap-1.5 select-none">
          <span className="text-[10px] tracking-wider text-[var(--text-muted)] uppercase font-semibold">
            Developed by
          </span>
          <h4 className="text-sm font-extrabold text-[#D4AF37] tracking-[0.12em] transition-colors hover:text-[#E0B84A] font-sans">
            GHOST STUDIO
          </h4>
          <div className="flex items-center gap-3.5 mt-1 text-xs">
            <a 
              href="tel:01118412902" 
              className="text-[var(--text-secondary)] hover:text-[#E0B84A] transition-colors font-medium flex items-center gap-1"
              aria-label="Phone: 01118412902"
              dir="ltr"
            >
              <Phone className="w-3 h-3 text-[#D4AF37]" />
              <span>01118412902</span>
            </a>
            <span className="text-[var(--text-muted)]/30 font-light">|</span>
            <a 
              href={`https://wa.me/201118412902?text=${encodeURIComponent('مرحباً GHOST STUDIO، أريد الاستفسار عن تصميم وتطوير موقع أو متجر إلكتروني.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-secondary)] hover:text-[#E0B84A] transition-colors font-medium flex items-center gap-1"
              aria-label="WhatsApp with Ghost Studio"
              dir="ltr"
            >
              <MessageCircle className="w-3 h-3 text-emerald-500" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
