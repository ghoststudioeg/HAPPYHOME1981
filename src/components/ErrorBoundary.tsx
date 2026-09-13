import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-[#050B14] flex items-center justify-center p-6 text-center" dir="rtl">
          <div className="max-w-2xl w-full bg-[#0A1A30] border border-[#D4AF37]/30 p-8 rounded-2xl shadow-2xl overflow-hidden">
            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center text-[#D4AF37] text-3xl mx-auto mb-6">
              ⚠️
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">حدث خطأ غير متوقع</h1>
            <p className="text-[#E2E8F0] mb-8 leading-relaxed">
              نعتذر عن هذا العطل الفني. قد يكون هناك مشكلة في الاتصال أو خطأ في تحميل البيانات.
            </p>
            
            {isDev && this.state.error && (
              <div className="mb-8 p-6 bg-red-900/10 border border-red-500/20 rounded-xl text-left">
                <p className="text-red-400 font-bold mb-2 text-sm border-b border-red-500/20 pb-2">Developer Diagnostics (Arabic Storefront):</p>
                <div className="max-h-60 overflow-auto scrollbar-thin scrollbar-thumb-red-500/20">
                  <pre className="text-red-300 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                    {this.state.error.stack || this.state.error.toString()}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 py-3.5 bg-[#D4AF37] hover:bg-[#E0B84A] text-[#050B14] font-bold rounded-xl transition-all shadow-lg shadow-[#D4AF37]/10 active:scale-95"
              >
                تحديث الصفحة
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 active:scale-95"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
