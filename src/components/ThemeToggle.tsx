import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/themeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center gap-2 p-2 rounded-xl transition-all duration-300 glass-pill hover:border-[#D6A83A]/50 focus:outline-none focus:ring-2 focus:ring-[#D6A83A]/30 cursor-pointer ${className}`}
      title={isDark ? 'التبديل إلى الوضع النهاري (Light Mode)' : 'التبديل إلى الوضع الليلي (Dark Mode)'}
      aria-label="تبديل المظهر"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-600 transition-transform duration-300 rotate-0 hover:-rotate-12" />
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-bold font-sans">
          {isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
        </span>
      )}
    </button>
  );
}
