import React from 'react';
import { motion } from 'motion/react';
import { Home, Search, MessageCircle, AlertCircle } from 'lucide-react';
import { SEO } from '../components/SEO';

interface NotFoundPageProps {
  navigate: (path: string) => void;
  type?: 'product' | 'category' | 'page';
}

export function NotFoundPage({ navigate, type = 'page' }: NotFoundPageProps) {
  const titles = {
    product: 'المنتج غير موجود',
    category: 'القسم غير موجود',
    page: 'الصفحة غير موجودة'
  };

  const messages = {
    product: 'عذراً، يبدو أن المنتج الذي تبحث عنه غير متوفر حالياً أو تم حذفه من المعرض.',
    category: 'عذراً، القسم الذي تحاول الوصول إليه غير متوفر أو تم نقله.',
    page: 'الصفحة التي تحاول الوصول إليها غير موجودة أو تم تغيير رابطها.'
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-20" dir="rtl">
      <SEO 
        title={titles[type]} 
        description={messages[type]} 
        noIndex={true} 
      />
      <div className="max-w-md w-full text-center space-y-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative inline-block"
        >
          <div className="absolute inset-0 bg-[#D4AF37]/20 blur-[60px] rounded-full" />
          <div className="relative w-32 h-32 mx-auto glass-panel rounded-[2.5rem] flex items-center justify-center border border-[#D4AF37]/30 shadow-2xl">
            <AlertCircle className="w-16 h-16 text-[#D4AF37]" />
          </div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -bottom-2 -right-2 bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg"
          >
            404 ERROR
          </motion.div>
        </motion.div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black text-white">{titles[type]}</h1>
          <p className="text-[#94A3B8] leading-relaxed">
            {messages[type]}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-[#D4AF37] to-[#B88A24] text-[#05080D] font-black rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Home className="w-5 h-5" />
            <span>الرئيسية</span>
          </button>
          
          <button
            onClick={() => navigate('/products')}
            className="flex items-center justify-center gap-2 py-4 px-6 glass-panel border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all cursor-pointer"
          >
            <Search className="w-5 h-5" />
            <span>تصفح المنتجات</span>
          </button>
        </div>

        <div className="pt-10 border-t border-white/5">
          <p className="text-xs text-zinc-500 mb-4">هل تحتاج لمساعدة؟ تواصل معنا</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/contact')}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-white/5 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
