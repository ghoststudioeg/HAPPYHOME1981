import React from 'react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'لا توجد منتجات حاليًا.',
  description = 'يمكنك تجربة تغيير خيارات البحث أو تصفح الأقسام الأخرى.',
  actionText,
  onAction
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-[#101B2B] rounded-xl border border-[#132235]" dir="rtl">
      <div className="w-16 h-16 rounded-full bg-[#132235] flex items-center justify-center text-[#D6A83A] mb-4">
        <PackageOpen className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold text-[#F5F5F3] mb-2">{title}</h3>
      <p className="text-sm text-[#AAB4C3] max-w-md mb-6">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-[#D6A83A] hover:bg-[#E0B64B] text-[#070D16] font-bold rounded-lg transition-colors cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
