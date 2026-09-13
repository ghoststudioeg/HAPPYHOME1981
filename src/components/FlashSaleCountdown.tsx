import React, { useState, useEffect } from 'react';
import { Clock, Flame } from 'lucide-react';

interface FlashSaleCountdownProps {
  endDate: string; // ISO or YYYY-MM-DDTHH:mm string
  compact?: boolean;
  showIcon?: boolean;
  onExpire?: () => void;
  className?: string;
}

export function FlashSaleCountdown({
  endDate,
  compact = false,
  showIcon = true,
  onExpire,
  className = ''
}: FlashSaleCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(endDate));

  function calculateTimeLeft(targetDateStr: string) {
    if (!targetDateStr) return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, formatted: '00:00:00' };

    const endMs = new Date(
      targetDateStr.includes('T') ? targetDateStr : `${targetDateStr}T23:59:59`
    ).getTime();
    const nowMs = Date.now();
    const diffMs = Math.max(0, endMs - nowMs);

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = days > 0
      ? `${days} يوم و ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`;

    return {
      totalMs: diffMs,
      days,
      hours,
      totalHours,
      minutes,
      seconds,
      formatted
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(endDate);
      setTimeLeft(remaining);
      if (remaining.totalMs <= 0) {
        clearInterval(timer);
        if (onExpire) {
          onExpire();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate, onExpire]);

  if (timeLeft.totalMs <= 0) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-zinc-400 text-xs font-medium ${className}`} dir="rtl">
        <Clock className="w-3.5 h-3.5 text-zinc-500" />
        <span>انتهى العرض</span>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  // Compact inline badge view (e.g. for cards or headers)
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 px-2.5 py-1 rounded-xl text-xs font-bold font-mono tracking-wider ${className}`}
        dir="ltr"
        title="الوقت المتبقي لانتهاء العرض"
      >
        {showIcon && <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0" />}
        <span className="tabular-nums font-black">{timeLeft.formatted}</span>
      </div>
    );
  }

  // Full luxury timer digit boxes (e.g. for Product Page & Flash Sale Section)
  return (
    <div className={`flex items-center gap-2 ${className}`} dir="rtl">
      {showIcon && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
          <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
        </div>
      )}

      <div className="flex items-center gap-1.5 font-mono" dir="ltr">
        {timeLeft.days > 0 && (
          <>
            <div className="flex flex-col items-center bg-[#07111C]/90 border border-rose-500/30 px-2.5 py-1 rounded-xl min-w-[42px] shadow-sm">
              <span className="text-sm font-black text-rose-400 tabular-nums">
                {pad(timeLeft.days)}
              </span>
              <span className="text-[8px] font-sans font-bold text-zinc-400">يوم</span>
            </div>
            <span className="text-rose-500 font-bold">:</span>
          </>
        )}

        <div className="flex flex-col items-center bg-[#07111C]/90 border border-rose-500/30 px-2.5 py-1 rounded-xl min-w-[42px] shadow-sm">
          <span className="text-sm font-black text-[#F8FAFC] tabular-nums">
            {pad(timeLeft.days > 0 ? timeLeft.hours : timeLeft.totalHours)}
          </span>
          <span className="text-[8px] font-sans font-bold text-zinc-400">ساعة</span>
        </div>

        <span className="text-rose-500 font-bold">:</span>

        <div className="flex flex-col items-center bg-[#07111C]/90 border border-rose-500/30 px-2.5 py-1 rounded-xl min-w-[42px] shadow-sm">
          <span className="text-sm font-black text-[#F8FAFC] tabular-nums">
            {pad(timeLeft.minutes)}
          </span>
          <span className="text-[8px] font-sans font-bold text-zinc-400">دقيقة</span>
        </div>

        <span className="text-rose-500 font-bold">:</span>

        <div className="flex flex-col items-center bg-[#07111C]/90 border border-rose-500/40 px-2.5 py-1 rounded-xl min-w-[42px] shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-rose-500/10 animate-pulse pointer-events-none" />
          <span className="text-sm font-black text-rose-400 tabular-nums relative z-10">
            {pad(timeLeft.seconds)}
          </span>
          <span className="text-[8px] font-sans font-bold text-zinc-400 relative z-10">ثانية</span>
        </div>
      </div>
    </div>
  );
}
