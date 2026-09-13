import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'حدث خطأ، حاول مرة أخرى.',
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 glass-panel-elevated rounded-3xl border border-rose-500/20 shadow-[0_20px_50px_rgba(244,63,94,0.1)] max-w-md mx-auto" dir="rtl">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-6 shadow-inner ring-1 ring-rose-500/20">
        <AlertCircle className="w-8 h-8" />
      </div>
      
      <div className="space-y-2 mb-8">
        <h3 className="text-lg font-black text-[#F8FAFC]">حصل خطأ غير متوقع</h3>
        <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
          {message || 'نعتذر عن هذا الخلل، يبدو أن هناك مشكلة في الاتصال بالخادم حالياً.'}
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2.5 px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-black rounded-xl border border-rose-500/25 transition-all cursor-pointer active:scale-95 group"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span>حاول مرة أخرى</span>
        </button>
      )}
    </div>
  );
}
