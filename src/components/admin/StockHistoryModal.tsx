import React, { useEffect, useState } from 'react';
import { Product, InventoryLog } from '../../types';
import { inventoryService } from '../../lib/data/inventoryService';
import { X, History, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, ShoppingBag, ShieldCheck } from 'lucide-react';

interface StockHistoryModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  order_placed: { label: 'طلب شراء عميل', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  order_cancelled: { label: 'إلغاء واسترجاع طلب', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  restock: { label: 'توريد واستلام بضاعة', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  return_restock: { label: 'استرجاع من مرتجع', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  damage: { label: 'تالف وهالك', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  loss: { label: 'عجز وفقدان', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  correction: { label: 'تصحيح بعد الجرد', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  manual_adjustment: { label: 'تعديل يدوي إداري', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' }
};

export function StockHistoryModal({ product, isOpen, onClose }: StockHistoryModalProps) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await inventoryService.getProductLogs(product.id, 50);
        if (isMounted) {
          setLogs(data);
        }
      } catch (err) {
        console.error('Failed to load logs:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLogs();
    return () => {
      isMounted = false;
    };
  }, [isOpen, product.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-[#101B2B] border border-[#1a2d47] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-[#0B1422] border-b border-[#132235] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#F5F5F3]">سجل حركات المخزون (Audit Trail)</h3>
              <p className="text-xs text-[#AAB4C3] truncate max-w-xs">{product.name} (SKU: {product.sku})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#AAB4C3] hover:text-[#F5F5F3] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {/* Top Summary Bar */}
          <div className="flex items-center justify-between p-3.5 bg-[#070D16] rounded-xl border border-[#1a2d47]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-[#F5F5F3]">المخزون الحالي المعتمد:</span>
            </div>
            <span className="text-sm font-black font-mono text-[#D6A83A]">
              {(typeof product.stockQuantity === 'number' ? product.stockQuantity : (product.isAvailable ? 10 : 0)).toLocaleString('ar-EG')} قطعة
            </span>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-[#D6A83A]" />
              <p className="text-xs text-[#AAB4C3]">جاري جلب سجل الحركات من السيرفر...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-center">
              <History className="w-8 h-8 text-[#AAB4C3]/40" />
              <p className="text-xs text-[#AAB4C3]">لا توجد حركات مخزون مسجلة بعد لهذا المنتج.</p>
              <span className="text-[10px] text-[#64748B]">يتم تسجيل الحركات تلقائياً عند تأكيد الطلبات، الإلغاء، أو التعديل اليدوي.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => {
                const reasonMeta = REASON_LABELS[log.reason] || {
                  label: log.reason,
                  color: 'text-zinc-400 bg-zinc-800/40 border-zinc-700'
                };
                const isPositive = log.change > 0;
                const isZero = log.change === 0;

                const formattedDate = new Date(log.timestamp).toLocaleString('ar-EG', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={log.id}
                    className="p-3.5 bg-[#070D16] hover:bg-[#070D16]/80 rounded-xl border border-[#1a2d47] transition-all flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${reasonMeta.color}`}>
                          {reasonMeta.label}
                        </span>

                        {log.referenceId && (
                          <span className="text-[10px] font-mono text-[#AAB4C3] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                            مرجع: {log.referenceId}
                          </span>
                        )}
                      </div>

                      {log.note && (
                        <p className="text-xs text-[#F5F5F3] font-medium leading-relaxed">
                          {log.note}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-[#AAB4C3]">
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span>بواسطة: {log.adjustedBy || 'النظام'}</span>
                      </div>
                    </div>

                    {/* Change Indicator */}
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <div className={`flex items-center gap-1 font-mono font-black text-xs px-2 py-1 rounded-lg border ${
                        isPositive
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : isZero
                          ? 'bg-zinc-800/50 border-zinc-700 text-zinc-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}>
                        {isPositive ? (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>+{log.change}</span>
                          </>
                        ) : isZero ? (
                          <span>0</span>
                        ) : (
                          <>
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            <span>{log.change}</span>
                          </>
                        )}
                      </div>

                      <span className="text-[10px] text-[#AAB4C3] font-mono">
                        {log.previousStock} ➔ {log.newStock}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0B1422] border-t border-[#132235] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#101B2B] hover:bg-[#1a2d47] text-[#F5F5F3] text-xs font-bold rounded-xl transition-all cursor-pointer border border-[#1a2d47]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
