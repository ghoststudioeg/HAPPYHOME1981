import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  itemName?: string;
  warningNote?: string;
  loading?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  warningNote,
  loading = false
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      dir="rtl"
      onClick={() => !loading && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[var(--surface)] border border-rose-500/30 rounded-2xl shadow-2xl p-6 text-[var(--text-primary)] space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)]">{title}</h3>
              {itemName && (
                <p className="text-xs text-[#D6A83A] font-bold mt-0.5 truncate max-w-[240px]">
                  «{itemName}»
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50 border border-[var(--border)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          <p>{message}</p>
          {warningNote && (
            <div className="p-3 bg-rose-500/5 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{warningNote}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 border border-[var(--border)]"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-900/40 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحذف النهائي...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>حذف نهائي</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
