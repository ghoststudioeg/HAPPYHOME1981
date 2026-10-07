import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleUnhandledError = (event: ErrorEvent) => {
    if (event.message?.includes('WebSocket') || event.message?.includes('[vite]')) return;
    if (event.error && !this.state.hasError) {
      this.setState({
        hasError: true,
        error: event.error instanceof Error ? event.error : new Error(String(event.message || 'Unknown error'))
      });
    }
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (reason && (String(reason).includes('WebSocket') || String(reason?.message).includes('WebSocket'))) return;
    if (!this.state.hasError) {
      const err = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled Promise Rejection'));
      this.setState({
        hasError: true,
        error: err
      });
    }
  };

  public componentDidMount() {
    window.addEventListener('error', this.handleUnhandledError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('error', this.handleUnhandledError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private sanitize(str?: string): string {
    if (!str) return '';
    return str
      .replace(/ey[A-Za-z0-9_-]{30,}/g, '[REDACTED_TOKEN]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
      .replace(/sbp_[a-zA-Z0-9]{20,}/g, '[REDACTED_KEY]');
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error;
      const errorInfo = this.state.errorInfo;

      return (
        <div className="min-h-screen bg-[#050B14] flex items-center justify-center p-6 text-center" dir="rtl">
          <div className="max-w-3xl w-full bg-[#0A1A30] border border-[#D4AF37]/30 p-8 rounded-2xl shadow-2xl overflow-hidden">
            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center text-[#D4AF37] text-3xl mx-auto mb-6">
              ⚠️
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">حدث خطأ في واجهة التطبيق</h1>
            <p className="text-[#E2E8F0] mb-8 leading-relaxed">
              تم التقاط الخطأ بنجاح عبر نظام حماية الواجهة لتجنب الشاشة البيضاء.
            </p>
            
            {error && (
              <div className="mb-8 p-6 bg-red-950/40 border border-red-500/30 rounded-xl text-left" dir="ltr">
                <div className="flex items-center justify-between border-b border-red-500/20 pb-3 mb-4">
                  <span className="text-red-400 font-bold text-xs uppercase tracking-wider">
                    Error Diagnostic: {error.name || 'Error'}
                  </span>
                  <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                    Runtime Error
                  </span>
                </div>
                <div className="space-y-4 font-mono text-[11px] leading-relaxed">
                  <div>
                    <span className="text-red-400 font-semibold block mb-1">Message:</span>
                    <span className="text-red-100 bg-red-900/30 p-2 rounded block">
                      {this.sanitize(error.message || String(error))}
                    </span>
                  </div>
                  {errorInfo?.componentStack && (
                    <div>
                      <span className="text-red-400 font-semibold block mb-1">Component Stack:</span>
                      <pre className="text-red-300/90 whitespace-pre-wrap max-h-36 overflow-auto p-2 bg-black/40 rounded border border-red-500/10 text-[10px]">
                        {this.sanitize(errorInfo.componentStack)}
                      </pre>
                    </div>
                  )}
                  {error.stack && (
                    <div>
                      <span className="text-red-400 font-semibold block mb-1">Stack Trace:</span>
                      <pre className="text-red-300/80 whitespace-pre-wrap max-h-36 overflow-auto p-2 bg-black/40 rounded border border-red-500/10 text-[10px]">
                        {this.sanitize(error.stack)}
                      </pre>
                    </div>
                  )}
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
                onClick={() => { this.setState({ hasError: false, error: null, errorInfo: null }); }}
                className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/10 active:scale-95"
              >
                إعادة المحاولة
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
