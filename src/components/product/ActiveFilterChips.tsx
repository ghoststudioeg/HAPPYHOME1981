import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { FilterState, countActiveFilters } from '../../lib/filterEngine';

interface ActiveFilterChipsProps {
  filterState: FilterState;
  onFilterChange: (newState: FilterState) => void;
  onResetFilters: () => void;
  categoryName?: string;
}

export function ActiveFilterChips({
  filterState,
  onFilterChange,
  onResetFilters,
  categoryName
}: ActiveFilterChipsProps) {
  const activeCount = countActiveFilters(filterState);
  if (activeCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap py-2" dir="rtl">
      <span className="text-[11px] text-[#94A3B8] font-bold shrink-0">الفلاتر المطبقة:</span>

      {/* Search Term Chip */}
      {filterState.search.trim() && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#E0B84A]">
          <span>بحث: "{filterState.search}"</span>
          <button
            onClick={() => onFilterChange({ ...filterState, search: '' })}
            className="hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {/* Brands Chips */}
      {filterState.brands.map((b) => (
        <span
          key={b}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]"
        >
          <span>الماركة: {b}</span>
          <button
            onClick={() =>
              onFilterChange({
                ...filterState,
                brands: filterState.brands.filter((item) => item !== b)
              })
            }
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Price Range Chip */}
      {(filterState.minPrice !== '' || filterState.maxPrice !== '') && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]">
          <span>
            السعر:{' '}
            {filterState.minPrice !== '' ? `من ${filterState.minPrice} ` : ''}
            {filterState.maxPrice !== '' ? `إلى ${filterState.maxPrice} ` : ''}ج.م
          </span>
          <button
            onClick={() => onFilterChange({ ...filterState, minPrice: '', maxPrice: '' })}
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {/* Availability Chip */}
      {filterState.availability !== 'all' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]">
          <span>{filterState.availability === 'in_stock' ? 'متوفر فقط' : 'قليل المخزون'}</span>
          <button
            onClick={() => onFilterChange({ ...filterState, availability: 'all' })}
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {/* Featured Chip */}
      {filterState.featuredOnly && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]">
          <span>مميز فقط</span>
          <button
            onClick={() => onFilterChange({ ...filterState, featuredOnly: false })}
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {/* RAM Chips */}
      {filterState.ram.map((r) => (
        <span
          key={r}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]"
        >
          <span>رام: {r}</span>
          <button
            onClick={() =>
              onFilterChange({
                ...filterState,
                ram: filterState.ram.filter((item) => item !== r)
              })
            }
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Storage Chips */}
      {filterState.storage.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]"
        >
          <span>تخزين: {s}</span>
          <button
            onClick={() =>
              onFilterChange({
                ...filterState,
                storage: filterState.storage.filter((item) => item !== s)
              })
            }
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* 5G Chip */}
      {filterState.is5G === true && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]">
          <span>يدعم 5G</span>
          <button
            onClick={() => onFilterChange({ ...filterState, is5G: null })}
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {/* Smart TV Chip */}
      {filterState.isSmartTv === true && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]">
          <span>شاشة سمارت</span>
          <button
            onClick={() => onFilterChange({ ...filterState, isSmartTv: null })}
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {/* Screen Size Chips */}
      {filterState.screenSize.map((sz) => (
        <span
          key={sz}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]"
        >
          <span>حجم: {sz}</span>
          <button
            onClick={() =>
              onFilterChange({
                ...filterState,
                screenSize: filterState.screenSize.filter((item) => item !== sz)
              })
            }
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Bag Type Chips */}
      {filterState.bagType.map((bt) => (
        <span
          key={bt}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]"
        >
          <span>نوع: {bt}</span>
          <button
            onClick={() =>
              onFilterChange({
                ...filterState,
                bagType: filterState.bagType.filter((item) => item !== bt)
              })
            }
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Color Chips */}
      {filterState.colors.map((c) => (
        <span
          key={c}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] border border-white/[0.1] text-[#F8FAFC]"
        >
          <span>لون: {c}</span>
          <button
            onClick={() =>
              onFilterChange({
                ...filterState,
                colors: filterState.colors.filter((item) => item !== c)
              })
            }
            className="text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Clear All Button */}
      <button
        onClick={onResetFilters}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#E0B84A] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
        <span>مسح الفلاتر</span>
      </button>
    </div>
  );
}
