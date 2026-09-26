import React, { useState, useEffect } from 'react';
import { Mic, MicOff, AlertCircle, X } from 'lucide-react';
import { useVoiceSearch } from '../../lib/useVoiceSearch';

interface VoiceSearchButtonProps {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onSubmit?: (query: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  title?: string;
}

export const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
  onTranscript,
  onSubmit,
  className = '',
  size = 'md',
  title = 'البحث الصوتي',
}) => {
  const [showErrorToast, setShowErrorToast] = useState<string | null>(null);

  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    toggleListening,
    stopListening,
  } = useVoiceSearch({
    lang: 'ar-EG',
    stripCommandPrefixes: true,
    onTranscript: (text, isFinal) => {
      onTranscript(text, isFinal);
    },
    onFinalResult: (finalText) => {
      if (onSubmit && finalText.trim()) {
        onSubmit(finalText.trim());
      }
    },
    onError: (err) => {
      setShowErrorToast(err);
    },
  });

  // Auto-dismiss error toast after 4 seconds
  useEffect(() => {
    if (showErrorToast) {
      const timer = setTimeout(() => {
        setShowErrorToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showErrorToast]);

  const currentSpeakingText = interimTranscript || transcript;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isSupported) {
            setShowErrorToast('متصفحك الحالي لا يدعم ميزة البحث الصوتي (Web Speech API). جرب متصفح Chrome أو Safari.');
            return;
          }
          toggleListening();
        }}
        title={!isSupported ? 'البحث الصوتي غير مدعوم في هذا المتصفح' : isListening ? 'إيقاف الاستماع' : title}
        className={`relative transition-all duration-200 flex items-center justify-center rounded-full cursor-pointer focus:outline-none ${
          size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
        } ${
          isListening
            ? 'bg-rose-500/20 text-rose-500 ring-2 ring-rose-500/50 animate-pulse'
            : !isSupported
            ? 'text-[var(--text-muted)] opacity-50 hover:opacity-80'
            : 'text-[var(--text-secondary)] hover:text-[#D4AF37] hover:bg-[var(--surface-elevated)]'
        } ${className}`}
        aria-label={isListening ? 'إيقاف البحث بالصوت' : 'بدء البحث بالصوت'}
      >
        {isListening ? (
          <>
            <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
            <Mic className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} z-10 animate-bounce`} />
          </>
        ) : !isSupported ? (
          <MicOff className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        ) : (
          <Mic className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        )}
      </button>

      {/* Active Voice Listening Popup Overlay / Indicator */}
      {isListening && (
        <div
          dir="rtl"
          className="absolute top-full mt-2 -left-1 sm:left-auto sm:right-0 z-50 min-w-[240px] max-w-xs p-3 rounded-2xl glass-panel-elevated border border-rose-500/30 shadow-xl shadow-rose-950/20 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold text-rose-400">جاري الاستماع...</span>
            </div>
            <button
              type="button"
              onClick={stopListening}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded-md hover:bg-[var(--surface)] transition-colors"
              title="إلغاء"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-2">
            تحدّث باسم المنتج أو الموديل (مثال: <span className="text-[#D4AF37]">"تلفزيون سامسونج"</span> أو <span className="text-[#D4AF37]">"غسالة إل جي"</span>)
          </p>

          {currentSpeakingText && (
            <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)]">
              "{currentSpeakingText}"
            </div>
          )}

          {/* Sound waves representation */}
          <div className="flex items-center justify-center gap-1 mt-2.5 h-3">
            <span className="w-1 bg-rose-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" style={{ height: '60%' }} />
            <span className="w-1 bg-rose-500 rounded-full animate-[pulse_0.4s_ease-in-out_infinite]" style={{ height: '100%' }} />
            <span className="w-1 bg-rose-500 rounded-full animate-[pulse_0.7s_ease-in-out_infinite]" style={{ height: '40%' }} />
            <span className="w-1 bg-rose-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" style={{ height: '80%' }} />
            <span className="w-1 bg-rose-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" style={{ height: '50%' }} />
          </div>
        </div>
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <div
          dir="rtl"
          className="absolute top-full mt-2 -left-2 sm:left-auto sm:right-0 z-50 min-w-[220px] max-w-xs p-2.5 rounded-xl bg-red-950/90 border border-red-500/40 text-red-200 shadow-lg text-[11px] flex items-start gap-2 animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-tight">{showErrorToast}</div>
          <button
            type="button"
            onClick={() => setShowErrorToast(null)}
            className="text-red-300 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
