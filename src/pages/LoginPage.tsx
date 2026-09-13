import React, { useState } from 'react';
import { authService } from '../lib/data/authService';
import { StoreLogo } from '../components/StoreLogo';
import { StoreSettings } from '../types';
import { ArrowLeft, Lock, Mail, Loader2, AlertCircle, CheckCircle2, KeyRound, UserPlus, LogIn } from 'lucide-react';

interface LoginPageProps {
  navigate: (path: string) => void;
  settings: StoreSettings;
  onLoginSuccess?: (role: string) => void;
  returnPath?: string;
}

export function LoginPage({ navigate, settings, onLoginSuccess, returnPath }: LoginPageProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePostLoginRedirect = (role: string) => {
    if (onLoginSuccess) {
      onLoginSuccess(role);
    }
    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate(returnPath && returnPath !== '/admin/login' && returnPath !== '/login' ? returnPath : '/');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await authService.signInWithGoogle();
      handlePostLoginRedirect(result.role);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'حدث خطأ أثناء تسجيل الدخول عبر Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('يرجى إدخال البريد الإلكتروني أولاً لإرسال رابط تعيين كلمة المرور.');
      return;
    }
    setResetLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await authService.resetPassword(email);
      setSuccessMessage('تم إرسال رابط تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال رابط إعادة تعيين كلمة المرور.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isRegisterMode) {
        const result = await authService.signUp(email, password, displayName);
        handlePostLoginRedirect(result.role);
      } else {
        const result = await authService.signIn(email, password);
        handlePostLoginRedirect(result.role);
      }
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password') {
        setError('بيانات الدخول غير صحيحة. يرجى التأكد من كلمة المرور أو استخدام تسجيل الدخول بـ Google مباشرة.');
      } else {
        setError(err?.message || 'حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 relative" dir="rtl">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Brand Logo and Title */}
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div
            className="cursor-pointer select-none inline-block transition-transform hover:scale-105"
            onClick={() => navigate('/')}
            title={settings.storeName}
          >
            <StoreLogo 
              settings={settings}
              className="h-12 w-auto object-contain mx-auto"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC]">
              {isRegisterMode ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1.5">
              {isRegisterMode
                ? 'انضم إلينا واستمتع بتجربة تسوق مخصصة وحفظ قائمة المفضلة'
                : `مرحباً بك في متجر ${settings.storeName || 'البيت السعيد'}`}
            </p>
          </div>
        </div>

        {/* Login Form Surface */}
        <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] space-y-6 liquid-reflection border border-white/[0.08]">
          {error && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-semibold">{error}</p>
                <p className="text-[11px] text-rose-400/80">
                  نصيحة: يمكنك النقر على زر Google للدخول الفوري دون الحاجة لكلمة مرور.
                </p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Primary Quick Google Sign-In */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading || resetLoading}
              className="w-full py-3.5 px-4 bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-3 shadow-md cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-800" />
                  <span>جاري تسجيل الدخول عبر Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>تسجيل الدخول السريع بحساب Google</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-[#94A3B8]">
              دخول آمن وفوري للعملاء والمشرفين بنقرة واحدة
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-white/[0.08] w-full"></div>
            <span className="bg-[#07111C] px-3 text-[11px] text-[#94A3B8] font-medium shrink-0">
              أو بالبريد الإلكتروني
            </span>
            <div className="border-t border-white/[0.08] w-full"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-bold text-[#F8FAFC] mb-2">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full glass-input text-[#F8FAFC] placeholder-zinc-500 text-sm rounded-xl py-3 px-4 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#F8FAFC] mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  dir="ltr"
                  className="w-full glass-input text-[#F8FAFC] placeholder-zinc-500 text-sm rounded-xl py-3 pr-10 pl-4 outline-none"
                />
                <Mail className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#F8FAFC]">
                  كلمة المرور
                </label>
                {!isRegisterMode && (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resetLoading}
                    className="text-[11px] text-[#E0B84A] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>{resetLoading ? 'جاري الإرسال...' : 'نسيت كلمة المرور؟'}</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="w-full glass-input text-[#F8FAFC] placeholder-zinc-500 text-sm rounded-xl py-3 pr-10 pl-4 outline-none"
                />
                <Lock className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading || resetLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(212,175,55,0.25)] hover:brightness-110 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري المتابعة...</span>
                </>
              ) : isRegisterMode ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء الحساب</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول بكلمة المرور</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div className="pt-2 text-center border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-xs text-[#94A3B8] hover:text-[#E0B84A] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {isRegisterMode ? (
                <span>لديك حساب بالفعل؟ <span className="font-bold text-[#E0B84A] underline">تسجيل الدخول</span></span>
              ) : (
                <span>ليس لديك حساب بعد؟ <span className="font-bold text-[#E0B84A] underline">إنشاء حساب جديد</span></span>
              )}
            </button>
          </div>
        </div>

        {/* Link back to Storefront */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#94A3B8] hover:text-[#E0B84A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 rotate-180" />
            <span>العودة إلى المتجر</span>
          </button>
        </div>
      </div>
    </div>
  );
}
