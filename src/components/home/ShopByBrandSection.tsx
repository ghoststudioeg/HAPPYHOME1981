import React, { useEffect, useState } from 'react';
import { Company } from '../../types';
import { companyService } from '../../lib/data/companyService';
import { getValidImageSrc } from '../../utils/imageUtils';
import { Building2, Sparkles, ChevronLeft, ArrowLeft } from 'lucide-react';

interface ShopByBrandSectionProps {
  onNavigate: (path: string) => void;
}

export function ShopByBrandSection({ onNavigate }: ShopByBrandSectionProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadBrands() {
      try {
        const list = await companyService.getCompanies(false);
        if (isMounted) {
          // Filter to active companies, prioritize featured ones, and sort by sortOrder
          const activeList = list
            .filter((c) => c.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'ar'));
          setCompanies(activeList);
        }
      } catch (err) {
        console.warn('Failed to load brands for home section:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadBrands();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || companies.length === 0) {
    return null;
  }

  const handleBrandClick = (company: Company) => {
    const action = company.clickAction || 'company_page';
    const target = company.targetValue?.trim() || '';

    if (action === 'external_url' && target) {
      // Validate safe external URL
      let validUrl = target;
      if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
        validUrl = `https://${validUrl}`;
      }
      try {
        new URL(validUrl);
        window.open(validUrl, '_blank', 'noopener,noreferrer');
        return;
      } catch {
        // Fallback to company page if URL is invalid
        onNavigate(`/company/${company.slug}`);
        return;
      }
    }

    if (action === 'category' && target) {
      onNavigate(`/category/${target}`);
      return;
    }

    if (action === 'product' && target) {
      onNavigate(`/product/${target}`);
      return;
    }

    // Default: company page
    onNavigate(`/company/${company.slug}`);
  };

  return (
    <section className="w-full py-6 sm:py-8" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-6 rounded-full bg-gradient-to-b from-[#D4AF37] to-[#AA7C11]" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
                  تسوق حسب الماركة والشركة
                </h2>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/25">
                  ماركات أصلية 100%
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                تصفح أفضل الشركات والأجهزة المعتمدة بضمان الوكيل الرسمي
              </p>
            </div>
          </div>
        </div>

        {/* Brands Horizontal Slider / Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
          {companies.map((company) => {
            const logoSrc = getValidImageSrc(company.logoUrl);
            return (
              <button
                key={company.id}
                onClick={() => handleBrandClick(company)}
                className="group relative flex flex-col items-center p-3 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] hover:border-[#D4AF37]/50 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 active:scale-95 text-center overflow-hidden"
              >
                {/* Brand Logo Container */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white p-2 flex items-center justify-center shadow-inner overflow-hidden mb-2 border border-slate-200/80 group-hover:border-[#D4AF37] transition-all">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={company.name}
                      className="w-full h-full object-contain filter group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-700">
                      <Building2 className="w-7 h-7 text-[#AA7C11]" />
                    </div>
                  )}
                </div>

                {/* Brand Name */}
                <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[#D4AF37] transition-colors truncate max-w-full">
                  {company.name}
                </span>

                {/* Subtle Glow upon hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#D4AF37]/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
