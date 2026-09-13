import React, { useState } from 'react';
import { Product, InventoryAdjustmentReason } from '../../types';
import { inventoryService } from '../../lib/data/inventoryService';
import { X, Layers, AlertCircle, Loader2, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

interface StockAdjustModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_OPTIONS: { value: InventoryAdjustmentReason; label: string; type: 'add' | 'deduct' | 'both' }[] = [
  { value: 'restock', label: 'توريد واستلام بضاعة جديدة (+)', type: 'add' },
  { value: 'return_restock', label: 'استرجاع بضاعة من عميل (+)', type: 'add' },
  { value: 'inventory_audit', label: 'تصحيح بعد الجرد الفعلي', type: 'both' },
  { value: 'damage_loss', label: 'تالف أو عجز أو فقدان (-)', type: 'deduct' },
  { value: 'manual_adjustment', label: 'تعديل يدوي إداري', type: 'both' }
];

export function StockAdjustModal({ product, isOpen, onClose, onSuccess }: StockAdjustModalProps) {
  const currentStock = typeof product.stockQuantity === 'number' ? product.stockQuantity : (product.isAvailable ? 10 : 0);
  const [mode, setMode] = useState<'adjust' | 'set'>('adjust');
  const [changeAmount, setChangeAmount] = useState<number>(1);
  const [isPositive, setIsPositive] = useState<boolean>(true);
  const [absoluteStock, setAbsoluteStock] = useState<number>(currentStock);
  const [reason, setReason] = useState<InventoryAdjustmentReason>('restock');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const calculatedNewStock = mode === 'adjust'
    ? Math.max(0, currentStock + (isPositive ? changeAmount : -changeAmount))
    : Math.max(0, absoluteStock);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (mode === 'adjust') {
        const delta = isPositive ? changeAmount : -changeAmount;
        if (delta === 0) {
          setError('يرجى تحديد كمية تغيير أكبر من صفر.');
          setIsSaving(false);
          return;
        }

        await inventoryService.adjustStock({
          productId: product.id,
          change: delta,
          reason,
          note: note.trim() || undefined,
          adjustedBy: 'admin'
        });
      } else {
        await inventoryService.setProductStock({
          productId: product.id,
          newQuantity: absoluteStock,
          reason,
          note: note.trim() || undefined,
          adjustedBy: 'admin'
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to adjust stock:', err);
      setError(err?.message || 'تعذر تعديل المخزون، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-[var(--surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D6A83A]/10 border border-[#D6A83A]/30 flex items-center justify-center text-[#D6A83A]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--text-primary)]">تعديل المخزون</h3>
              <p className="text-xs text-[var(--text-secondary)] truncate max-w-xs">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-500">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs Target Stock Visual */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] text-center">
            <div>
              <span className="text-[11px] text-[var(--text-muted)] block mb-1">المخزون الحالي:</span>
              <span className="text-xl font-black font-mono text-[var(--text-primary)]">
                {currentStock.toLocaleString('ar-EG')}
              </span>
            </div>
            <div className="border-r border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] block mb-1">المخزون بعد التعديل:</span>
              <span className={`text-xl font-black font-mono ${calculatedNewStock === 0 ? 'text-rose-500' : calculatedNewStock <= (product.lowStockThreshold || 3) ? 'text-amber-500' : 'text-emerald-500'}`}>
                {calculatedNewStock.toLocaleString('ar-EG')}
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex rounded-xl bg-[var(--surface-secondary)] p-1 border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setMode('adjust')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'adjust' ? 'bg-[#D6A83A] text-[#070D16] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              إضافة أو سحب كمية (Adjustment)
            </button>
            <button
              type="button"
              onClick={() => setMode('set')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'set' ? 'bg-[#D6A83A] text-[#070D16] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              تعيين رقم المخزون المباشر (Set)
            </button>
          </div>

          {mode === 'adjust' ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[var(--text-primary)]">كمية التغيير *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPositive(true)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isPositive
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>إضافة (+زيادة)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPositive(false)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    !isPositive
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-500'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>خصم (-نقصان)</span>
                </button>
                <input
                  type="number"
                  min="1"
                  value={changeAmount}
                  onChange={(e) => setChangeAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-sm font-mono font-bold rounded-xl py-2 px-3 outline-none text-center"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--text-primary)]">إجمالي الكمية المتاحة في المخزن *</label>
              <input
                type="number"
                min="0"
                value={absoluteStock}
                onChange={(e) => setAbsoluteStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-sm font-mono font-bold rounded-xl py-2.5 px-3.5 outline-none text-center"
              />
            </div>
          )}

          {/* Reason Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--text-primary)]">سبب الحركة / التعديل *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as InventoryAdjustmentReason)}
              className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Admin Note */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--text-primary)]">ملاحظة توثيقية (اختياري)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: فاتورة استلام رقم 402 أو إذن جرد سنوي"
              className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] focus:border-[#D6A83A] text-[var(--text-primary)] text-xs rounded-xl py-2.5 px-3.5 outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#D6A83A] hover:bg-[#E0B64B] text-[#070D16] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#D6A83A]/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحديث الآمن...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>حفظ حركة المخزون</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
