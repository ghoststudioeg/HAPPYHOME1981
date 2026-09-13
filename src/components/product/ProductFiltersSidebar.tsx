import React, { useState } from 'react';
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  Tag,
  DollarSign,
  PackageCheck,
  Sparkles,
  Layers
} from 'lucide-react';
import {
  FilterState,
  CategoryArchetype,
  extractAvailableFilters,
  DynamicFilterGroup,
  countActiveFilters,
  AvailabilityFilter,
  SortOption
} from '../../lib/filterEngine';
import { Product, Category } from '../../types';

interface ProductFiltersSidebarProps {
  products: Product[];
  categories: Category[];
  filterState: FilterState;
  onFilterChange: (newState: FilterState) => void;
  onResetFilters: () => void;
  archetype: CategoryArchetype;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  totalFilteredCount: number;
  showCategoryPicker?: boolean;
}

export function ProductFiltersSidebar({
  products,
  categories,
  filterState,
  onFilterChange,
  onResetFilters,
  archetype,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  totalFilteredCount,
  showCategoryPicker = true
}: ProductFiltersSidebarProps) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [brandSearch, setBrandSearch] = useState('');

  // Extract available filters from dataset
  const available = extractAvailableFilters(products, archetype);
  const activeCount = countActiveFilters(filterState);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBrandToggle = (brand: string) => {
    const current = filterState.brands || [];
    const exists = current.includes(brand);
    const updated = exists ? current.filter((b) => b !== brand) : [...current, brand];
    onFilterChange({ ...filterState, brands: updated });
  };

  const handleAvailabilityChange = (avail: AvailabilityFilter) => {
    onFilterChange({ ...filterState, availability: avail });
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? '' : Number(e.target.value);
    onFilterChange({ ...filterState, minPrice: val });
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? '' : Number(e.target.value);
    onFilterChange({ ...filterState, maxPrice: val });
  };

  const handlePriceReset = () => {
    onFilterChange({ ...filterState, minPrice: '', maxPrice: '' });
  };

  const handleDynamicToggle = (key: string, value: string) => {
    // Check if key is a top-level spec or inside dynamicSpecs
    if (key === 'ram') {
      const exists = filterState.ram.includes(value);
      const updated = exists ? filterState.ram.filter((v) => v !== value) : [...filterState.ram, value];
      onFilterChange({ ...filterState, ram: updated });
    } else if (key === 'storage') {
      const exists = filterState.storage.includes(value);
      const updated = exists ? filterState.storage.filter((v) => v !== value) : [...filterState.storage, value];
      onFilterChange({ ...filterState, storage: updated });
    } else if (key === 'processor') {
      const exists = filterState.processor.includes(value);
      const updated = exists ? filterState.processor.filter((v) => v !== value) : [...filterState.processor, value];
      onFilterChange({ ...filterState, processor: updated });
    } else if (key === 'battery') {
      const exists = filterState.battery.includes(value);
      const updated = exists ? filterState.battery.filter((v) => v !== value) : [...filterState.battery, value];
      onFilterChange({ ...filterState, battery: updated });
    } else if (key === 'camera') {
      const exists = filterState.camera.includes(value);
      const updated = exists ? filterState.camera.filter((v) => v !== value) : [...filterState.camera, value];
      onFilterChange({ ...filterState, camera: updated });
    } else if (key === 'screenSize') {
      const exists = filterState.screenSize.includes(value);
      const updated = exists ? filterState.screenSize.filter((v) => v !== value) : [...filterState.screenSize, value];
      onFilterChange({ ...filterState, screenSize: updated });
    } else if (key === 'resolution') {
      const exists = filterState.resolution.includes(value);
      const updated = exists ? filterState.resolution.filter((v) => v !== value) : [...filterState.resolution, value];
      onFilterChange({ ...filterState, resolution: updated });
    } else if (key === 'bagType') {
      const exists = filterState.bagType.includes(value);
      const updated = exists ? filterState.bagType.filter((v) => v !== value) : [...filterState.bagType, value];
      onFilterChange({ ...filterState, bagType: updated });
    } else if (key === 'bagSize') {
      const exists = filterState.bagSize.includes(value);
      const updated = exists ? filterState.bagSize.filter((v) => v !== value) : [...filterState.bagSize, value];
      onFilterChange({ ...filterState, bagSize: updated });
    } else {
      // Dynamic generic spec
      const current = filterState.dynamicSpecs[key] || [];
      const exists = current.includes(value);
      const updated = exists ? current.filter((v) => v !== value) : [...current, value];
      onFilterChange({
        ...filterState,
        dynamicSpecs: { ...filterState.dynamicSpecs, [key]: updated }
      });
    }
  };

  const handleColorToggle = (colorName: string) => {
    const current = filterState.colors || [];
    const exists = current.includes(colorName);
    const updated = exists ? current.filter((c) => c !== colorName) : [...current, colorName];
    onFilterChange({ ...filterState, colors: updated });
  };

  const filteredBrands = available.brands.filter((b) =>
    b.label.toLowerCase().includes(brandSearch.toLowerCase().trim())
  );

  const renderFilterContent = () => (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Active Filters Summary Bar */}
      {activeCount > 0 && (
        <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl p-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E0B84A] animate-pulse" />
            <span className="text-xs font-black text-[#F8FAFC]">
              الفلاتر النشطة ({activeCount})
            </span>
          </div>
          <button
            onClick={onResetFilters}
            className="text-[11px] font-bold text-[#E0B84A] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>مسح الكل</span>
          </button>
        </div>
      )}

      {/* Category Selector (if enabled and on products page) */}
      {showCategoryPicker && categories.length > 0 && (
        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D4AF37]" />
              <label className="text-xs font-bold text-[#F8FAFC]">الأقسام</label>
            </div>
            {filterState.category !== 'all' && (
              <button
                onClick={() => onFilterChange({ ...filterState, category: 'all' })}
                className="text-[10px] text-[#E0B84A] hover:underline font-bold"
              >
                الكل
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
            <button
              onClick={() => onFilterChange({ ...filterState, category: 'all' })}
              className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                filterState.category === 'all'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] shadow-xs'
                  : 'text-[#94A3B8] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span>جميع الأقسام</span>
              <span className="text-[10px] opacity-80">({products.length})</span>
            </button>
            {categories.map((cat) => {
              const count = products.filter(
                (p) => p.categoryId === cat.id || p.categoryId === cat.slug || p.categoryName === cat.name
              ).length;
              const isSelected =
                filterState.category === cat.id ||
                filterState.category === cat.slug ||
                filterState.category === cat.name;

              return (
                <button
                  key={cat.id}
                  onClick={() => onFilterChange({ ...filterState, category: cat.slug || cat.id })}
                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] shadow-xs'
                      : 'text-[#94A3B8] hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className="text-[10px] opacity-80 shrink-0">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. PRICE FILTER (Requirement 5) */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#D4AF37]" />
            <label className="text-xs font-bold text-[#F8FAFC]">السعر (ج.م)</label>
          </div>
          {(filterState.minPrice !== '' || filterState.maxPrice !== '') && (
            <button
              onClick={handlePriceReset}
              className="text-[10px] text-[#E0B84A] hover:underline font-bold cursor-pointer"
            >
              إعادة تعيين
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <span className="text-[10px] text-[#94A3B8] block">من:</span>
            <input
              type="number"
              min={0}
              placeholder={available.priceRange.min ? String(available.priceRange.min) : '0'}
              value={filterState.minPrice === '' ? '' : filterState.minPrice ?? ''}
              onChange={handleMinPriceChange}
              className="w-full glass-input text-xs text-[#F8FAFC] rounded-xl py-2 px-3 focus:border-[#D4AF37] outline-none"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-[#94A3B8] block">إلى:</span>
            <input
              type="number"
              min={0}
              placeholder={available.priceRange.max ? String(available.priceRange.max) : '50000'}
              value={filterState.maxPrice === '' ? '' : filterState.maxPrice ?? ''}
              onChange={handleMaxPriceChange}
              className="w-full glass-input text-xs text-[#F8FAFC] rounded-xl py-2 px-3 focus:border-[#D4AF37] outline-none"
            />
          </div>
        </div>

        {/* Quick price presets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            onClick={() => onFilterChange({ ...filterState, minPrice: '', maxPrice: 1000 })}
            className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] border border-white/[0.06] cursor-pointer"
          >
            أقل من 1,000 ج.م
          </button>
          <button
            onClick={() => onFilterChange({ ...filterState, minPrice: 1000, maxPrice: 5000 })}
            className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] border border-white/[0.06] cursor-pointer"
          >
            1,000 - 5,000 ج.م
          </button>
          <button
            onClick={() => onFilterChange({ ...filterState, minPrice: 5000, maxPrice: 15000 })}
            className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#94A3B8] hover:text-[#F8FAFC] border border-white/[0.06] cursor-pointer"
          >
            5,000 - 15,000 ج.م
          </button>
        </div>
      </div>

      {/* 6. AVAILABILITY (Requirement 6) */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-[#D4AF37]" />
          <label className="text-xs font-bold text-[#F8FAFC]">حالة التوفر</label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer text-xs text-[#F8FAFC]">
            <div className="flex items-center gap-2.5">
              <input
                type="radio"
                name="availability"
                checked={filterState.availability === 'all'}
                onChange={() => handleAvailabilityChange('all')}
                className="text-[#D4AF37] focus:ring-0 bg-[#05080D] border-white/20 w-4 h-4 cursor-pointer"
              />
              <span className="font-medium">كل المنتجات</span>
            </div>
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer text-xs text-[#F8FAFC]">
            <div className="flex items-center gap-2.5">
              <input
                type="radio"
                name="availability"
                checked={filterState.availability === 'in_stock'}
                onChange={() => handleAvailabilityChange('in_stock')}
                className="text-[#D4AF37] focus:ring-0 bg-[#05080D] border-white/20 w-4 h-4 cursor-pointer"
              />
              <span className="font-medium">متوفر فقط</span>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
              جاهز للشحن
            </span>
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer text-xs text-[#F8FAFC]">
            <div className="flex items-center gap-2.5">
              <input
                type="radio"
                name="availability"
                checked={filterState.availability === 'low_stock'}
                onChange={() => handleAvailabilityChange('low_stock')}
                className="text-[#D4AF37] focus:ring-0 bg-[#05080D] border-white/20 w-4 h-4 cursor-pointer"
              />
              <span className="font-medium">قليل المخزون</span>
            </div>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
              كميات محدودة
            </span>
          </label>
        </div>
      </div>

      {/* Featured Only Toggle */}
      <div className="glass-panel p-4 rounded-2xl">
        <label className="flex items-center justify-between cursor-pointer text-xs text-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="font-bold">المنتجات المميزة فقط</span>
          </div>
          <input
            type="checkbox"
            checked={filterState.featuredOnly}
            onChange={(e) => onFilterChange({ ...filterState, featuredOnly: e.target.checked })}
            className="rounded bg-[#05080D] border-white/20 text-[#D4AF37] focus:ring-0 w-4 h-4 cursor-pointer"
          />
        </label>
      </div>

      {/* BRANDS FILTER (Category Aware) */}
      {available.brands.length > 0 && (
        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#D4AF37]" />
              <label className="text-xs font-bold text-[#F8FAFC]">الماركة / البراند</label>
            </div>
            {filterState.brands.length > 0 && (
              <button
                onClick={() => onFilterChange({ ...filterState, brands: [] })}
                className="text-[10px] text-[#E0B84A] hover:underline font-bold"
              >
                مسح ({filterState.brands.length})
              </button>
            )}
          </div>

          {available.brands.length > 6 && (
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن ماركة..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full glass-input text-xs text-[#F8FAFC] rounded-xl py-1.5 pr-8 pl-2 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          )}

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {filteredBrands.map((b) => {
              const isChecked = filterState.brands.includes(b.value);
              return (
                <label
                  key={b.value}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    isChecked
                      ? 'bg-[#D4AF37]/15 text-[#E0B84A] font-bold border border-[#D4AF37]/30'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleBrandToggle(b.value)}
                      className="rounded bg-[#05080D] border-white/20 text-[#D4AF37] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>{b.label}</span>
                  </div>
                  <span className="text-[10px] opacity-75">({b.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. DYNAMIC CATEGORY-AWARE SPECIFICATION FILTERS (Requirement 4) */}
      {available.dynamicGroups.map((group) => {
        const isCollapsed = collapsedSections[group.id] || false;
        const currentSelected =
          group.key === 'ram'
            ? filterState.ram
            : group.key === 'storage'
            ? filterState.storage
            : group.key === 'processor'
            ? filterState.processor
            : group.key === 'battery'
            ? filterState.battery
            : group.key === 'camera'
            ? filterState.camera
            : group.key === 'screenSize'
            ? filterState.screenSize
            : group.key === 'resolution'
            ? filterState.resolution
            : group.key === 'bagType'
            ? filterState.bagType
            : group.key === 'bagSize'
            ? filterState.bagSize
            : filterState.dynamicSpecs[group.key] || [];

        const selectedCount = currentSelected.length;

        return (
          <div key={group.id} className="glass-panel p-4 rounded-2xl space-y-3">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection(group.id)}
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                <label className="text-xs font-bold text-[#F8FAFC] cursor-pointer">
                  {group.label}
                </label>
                {selectedCount > 0 && (
                  <span className="text-[9px] bg-[#D4AF37]/20 text-[#E0B84A] px-1.5 py-0.2 rounded-full font-bold">
                    {selectedCount}
                  </span>
                )}
              </div>
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
              )}
            </div>

            {!isCollapsed && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar pt-1">
                {group.type === 'boolean' ? (
                  <label className="flex items-center justify-between p-2 rounded-xl text-xs text-[#F8FAFC] hover:bg-white/[0.04] cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={
                          group.key === 'is5G'
                            ? filterState.is5G === true
                            : group.key === 'isSmartTv'
                            ? filterState.isSmartTv === true
                            : false
                        }
                        onChange={(e) => {
                          if (group.key === 'is5G') {
                            onFilterChange({ ...filterState, is5G: e.target.checked ? true : null });
                          } else if (group.key === 'isSmartTv') {
                            onFilterChange({ ...filterState, isSmartTv: e.target.checked ? true : null });
                          }
                        }}
                        className="rounded bg-[#05080D] border-white/20 text-[#D4AF37] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{group.options[0]?.label || group.label}</span>
                    </div>
                    <span className="text-[10px] opacity-75">({group.options[0]?.count || 0})</span>
                  </label>
                ) : (
                  group.options.map((opt) => {
                    const isChecked = currentSelected.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-[#D4AF37]/15 text-[#E0B84A] font-bold border border-[#D4AF37]/30'
                            : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleDynamicToggle(group.key, opt.value)}
                            className="rounded bg-[#05080D] border-white/20 text-[#D4AF37] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span>{opt.label}</span>
                        </div>
                        <span className="text-[10px] opacity-75">({opt.count})</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Available Colors Filter */}
      {available.colors.length > 0 && (
        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <label className="text-xs font-bold text-[#F8FAFC]">اللون</label>
            </div>
            {filterState.colors.length > 0 && (
              <button
                onClick={() => onFilterChange({ ...filterState, colors: [] })}
                className="text-[10px] text-[#E0B84A] hover:underline font-bold"
              >
                مسح ({filterState.colors.length})
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {available.colors.map((c) => {
              const isSelected = filterState.colors.includes(c.value);
              return (
                <button
                  key={c.value}
                  onClick={() => handleColorToggle(c.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] shadow-xs'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] text-[#94A3B8] hover:text-[#F8FAFC] border border-white/[0.08]'
                  }`}
                >
                  {c.colorHex && (
                    <span
                      className="w-3 h-3 rounded-full border border-black/30 shrink-0"
                      style={{ backgroundColor: c.colorHex }}
                    />
                  )}
                  <span>{c.label}</span>
                  <span className="text-[10px] opacity-75">({c.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset All Filters Button (Requirement 8) */}
      <button
        onClick={onResetFilters}
        className="w-full py-3 px-4 glass-pill hover:border-[#D4AF37]/40 text-[#94A3B8] hover:text-[#E0B84A] text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>مسح جميع الفلاتر</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar Layout */}
      <aside className="hidden lg:block w-full">{renderFilterContent()}</aside>

      {/* 11. MOBILE BOTTOM SHEET / MODAL (Requirement 11) */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          dir="rtl"
        >
          {/* Backdrop click dismiss */}
          <div className="absolute inset-0" onClick={onCloseMobileDrawer} />

          {/* Bottom Sheet Drawer */}
          <div className="relative z-10 w-full max-h-[85vh] bg-[#070E18] border-t border-white/[0.15] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1" />

            {/* Header */}
            <div className="px-5 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-black text-[#F8FAFC]">تصفية وفرز المنتجات</h3>
                {activeCount > 0 && (
                  <span className="text-[10px] bg-[#D4AF37] text-[#05080D] font-black px-2 py-0.5 rounded-full">
                    {activeCount}
                  </span>
                )}
              </div>
              <button
                onClick={onCloseMobileDrawer}
                className="p-1.5 rounded-full bg-white/[0.06] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Filter Content */}
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              {renderFilterContent()}
            </div>

            {/* Sticky Mobile Actions Bar */}
            <div className="p-4 border-t border-white/[0.08] bg-[#050B14] flex items-center gap-3">
              <button
                onClick={onCloseMobileDrawer}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-[#05080D] font-black text-xs rounded-xl shadow-lg cursor-pointer"
              >
                عرض {totalFilteredCount} منتج
              </button>
              {activeCount > 0 && (
                <button
                  onClick={onResetFilters}
                  className="py-3 px-4 glass-pill text-[#CBD5E1] text-xs font-bold rounded-xl hover:text-white cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
