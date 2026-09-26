import { useState, useEffect, useRef, useCallback } from 'react';

// Declarations for browser Web Speech API
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

export interface UseVoiceSearchOptions {
  lang?: string; // default: 'ar-EG'
  continuous?: boolean;
  stripCommandPrefixes?: boolean;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
}

export interface UseVoiceSearchResult {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
}

/**
 * Clean up common Arabic spoken command prefixes like "ابحث عن", "عايز", "عاوز"
 */
export function cleanVoiceQuery(rawQuery: string): string {
  if (!rawQuery) return '';
  let cleaned = rawQuery.trim();

  // Common Arabic prefixes in voice searches
  const prefixes = [
    /^(ابحث\s+عن\s+|ابحثي\s+عن\s+|ابحث\s+على\s+|ابحث\s+|بحث\s+عن\s+)/i,
    /^(دور\s+على\s+|دوري\s+على\s+|فتش\s+عن\s+)/i,
    /^(عايز\s+|عاوز\s+|عايزة\s+|عاوزة\s+|محتاج\s+|محتاجة\s+)/i,
    /^(اريد\s+|أريد\s+|بدي\s+|بدنا\s+)/i,
    /^(search\s+for\s+|search\s+|find\s+)/i,
  ];

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '').trim();
  }

  // Remove trailing dots or punctuation
  cleaned = cleaned.replace(/[.،,؟?]+$/, '').trim();

  return cleaned || rawQuery.trim();
}

export function useVoiceSearch(options: UseVoiceSearchOptions = {}): UseVoiceSearchResult {
  const {
    lang = 'ar-EG',
    continuous = false,
    stripCommandPrefixes = true,
    onTranscript,
    onFinalResult,
    onError,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef(false);

  // Check browser support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  const getRecognitionInstance = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      isManuallyStoppedRef.current = false;
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalStr = '';
      let interimStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';

        if (result.isFinal) {
          finalStr += text;
        } else {
          interimStr += text;
        }
      }

      const activeText = finalStr || interimStr;
      const processedText = stripCommandPrefixes ? cleanVoiceQuery(activeText) : activeText;

      if (finalStr) {
        const processedFinal = stripCommandPrefixes ? cleanVoiceQuery(finalStr) : finalStr;
        setTranscript(processedFinal);
        setInterimTranscript('');
        onTranscript?.(processedFinal, true);
        onFinalResult?.(processedFinal);
      } else {
        setInterimTranscript(processedText);
        onTranscript?.(processedText, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      let arabicErrorMsg = 'حدث خطأ أثناء التعرف على الصوت';

      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          arabicErrorMsg = 'يرجى السماح بصلاحية الميكروفون في المتصفح لاستخدام البحث الصوتي';
          break;
        case 'no-speech':
          arabicErrorMsg = 'لم يتم سماع أي صوت، يرجى المحاولة مرة أخرى';
          break;
        case 'audio-capture':
          arabicErrorMsg = 'لم يتم العثور على ميكروفون صالح في جهازك';
          break;
        case 'network':
          arabicErrorMsg = 'خطأ في الاتصال بالشبكة لخدمة التعرف على الصوت';
          break;
        case 'aborted':
          // Aborted by user, not an error to display
          arabicErrorMsg = '';
          break;
        default:
          arabicErrorMsg = event.message || 'تعذر معالجة الصوت، يرجى إعادة المحاولة';
      }

      if (arabicErrorMsg) {
        setError(arabicErrorMsg);
        onError?.(arabicErrorMsg);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  }, [lang, continuous, stripCommandPrefixes, onTranscript, onFinalResult, onError]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const msg = 'متصفحك لا يدعم خاصية البحث الصوتي (Web Speech API)';
      setError(msg);
      onError?.(msg);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const instance = getRecognitionInstance();
      if (!instance) return;

      recognitionRef.current = instance;
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      instance.start();
    } catch (err: any) {
      console.warn('Speech recognition start error:', err);
      // If already started, ignore or restart
      if (err.name !== 'InvalidStateError') {
        setError('تعذر بدء التعرف على الصوت، يرجى المحاولة ثانية');
      }
    }
  }, [isSupported, getRecognitionInstance, onError]);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        recognitionRef.current.abort();
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}
