import React, { useState, useEffect } from 'react';
import { Flame, Sparkles, Smartphone, Truck, Bell, ChevronLeft } from 'lucide-react';
import { NewsTickerItem } from '../../types';

interface NewsTickerProps {
  items: NewsTickerItem[];
  speed?: number;
  direction?: 'rtl' | 'ltr';
  bgStyle?: 'dark' | 'gold' | 'emerald';
  onNavigate?: (path: string) => void;
}

export function NewsTicker({
  items,
  speed = 5,
  direction = 'rtl',
  bgStyle = 'dark',
  onNavigate
}: NewsTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const intervalMs = Math.max(2, speed) * 1000;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [items.length, speed, isPaused]);

  if (!items || items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex] || items[0];

  const getIcon = (type: string) => {
    switch (type) {
      case 'offer':
        return <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />;
      case 'new_arrival':
        return <Smartphone className="w-3.5 h-3.5 text-[#E0B84A] shrink-0" />;
      case 'alert':
        return <Bell className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'delivery':
        return <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'news':
      default:
        return <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />;
    }
  };

  const getBadgeText = (type: string) => {
    switch (type) {
      case 'offer':
        return 'عرض خاص';
      case 'new_arrival':
        return 'وصل حديثًا';
      case 'alert':
        return 'تنبيه';
      case 'delivery':
        return 'متوفر الآن';
      case 'news':
      default:
        return 'آخر الأخبار';
    }
  };

  const handleClick = (link?: string) => {
    if (!link) return;
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else if (onNavigate) {
      onNavigate(link);
    }
  };

  // Background style choices
  let bgClasses = 'bg-[var(--surface)] border-y border-[var(--border)]';
  if (bgStyle === 'gold') {
    bgClasses = 'bg-[#D4AF37]/10 border-y border-[#D4AF37]/30';
  } else if (bgStyle === 'emerald') {
    bgClasses = 'bg-emerald-500/10 border-y border-emerald-500/25';
  }

  return (
    <div
      className={`w-full backdrop-blur-xl py-2 px-3 sm:px-6 relative overflow-hidden select-none transition-all ${bgClasses}`}
      dir={direction}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        {/* Label Tag */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[#E0B84A] font-bold text-[11px]">
            {getIcon(currentItem.type)}
            <span>{getBadgeText(currentItem.type)}</span>
          </span>
          <span className="text-[var(--text-muted)] hidden sm:inline">•</span>
        </div>

        {/* Ticker Content */}
        <div className="flex-1 min-w-0 overflow-hidden flex items-center justify-start">
          <div
            key={currentItem.id || currentIndex}
            onClick={() => handleClick(currentItem.link)}
            className={`flex items-center gap-2 font-medium text-[var(--text-primary)] hover:text-[#E0B84A] transition-colors truncate ${
              currentItem.link ? 'cursor-pointer' : ''
            } animate-in fade-in slide-in-from-bottom-1 duration-200`}
          >
            <span className="truncate text-xs sm:text-[13px]">{currentItem.text}</span>
            {currentItem.link && (
              <span className="hidden sm:inline-flex items-center gap-0.5 text-[10.5px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded-md shrink-0">
                <span>تصفح</span>
                <ChevronLeft className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        {/* Multi-item Indicators */}
        {items.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`خبر رقم ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === currentIndex
                    ? 'w-4 bg-[#D4AF37]'
                    : 'w-1.5 bg-[var(--text-muted)] hover:bg-[var(--text-primary)]'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
