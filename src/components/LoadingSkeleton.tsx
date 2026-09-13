import React from 'react';

export function LoadingSkeleton({ type = 'grid', count = 4 }: { type?: 'grid' | 'details' | 'table' | 'profile' | 'category-list'; count?: number }) {
  if (type === 'table') {
    return (
      <div className="w-full space-y-3 animate-pulse" dir="rtl">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="h-14 bg-[#101B2B] rounded-lg border border-[#132235]"></div>
        ))}
      </div>
    );
  }

  if (type === 'details') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse" dir="rtl">
        <div className="aspect-square bg-[#101B2B] rounded-xl border border-[#132235]"></div>
        <div className="space-y-4">
          <div className="h-8 bg-[#101B2B] rounded w-3/4"></div>
          <div className="h-6 bg-[#101B2B] rounded w-1/4"></div>
          <div className="h-24 bg-[#101B2B] rounded"></div>
          <div className="h-12 bg-[#101B2B] rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div className="space-y-6 animate-pulse" dir="rtl">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-[#101B2B] border border-[#132235]"></div>
          <div className="space-y-2">
            <div className="h-6 bg-[#101B2B] rounded w-32"></div>
            <div className="h-4 bg-[#101B2B] rounded w-48"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#101B2B] rounded-xl border border-[#132235]"></div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'category-list') {
    return (
      <div className="flex gap-4 overflow-hidden animate-pulse px-4 sm:px-6" dir="rtl">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-28 space-y-2">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#101B2B] border border-[#132235]"></div>
            <div className="h-3 bg-[#101B2B] rounded w-3/4 mx-auto"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" dir="rtl">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="bg-[#101B2B] rounded-xl border border-[#132235] overflow-hidden animate-pulse flex flex-col"
        >
          <div className="aspect-[4/3] bg-[#132235]"></div>
          <div className="p-4 space-y-2 flex-1">
            <div className="h-3 bg-[#132235] rounded w-1/3"></div>
            <div className="h-4 bg-[#132235] rounded w-4/5"></div>
            <div className="h-5 bg-[#132235] rounded w-1/2 mt-4"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
