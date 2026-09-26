import React, { useState } from 'react';
import { FolderPlus, Folder, Edit3, Trash2, X, Check, Sparkles } from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<boolean>;
  existingGroups: string[];
}

const PRESET_SUGGESTIONS = [
  'أدوات المطبخ',
  'هدايا للمستقبل',
  'تجهيز المنزل',
  'أجهزة الصيف',
  'إلكترونيات وموبايل',
  'قائمة التخفيضات',
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  existingGroups,
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const success = await onCreate(name.trim());
    setLoading(false);
    if (success) {
      setName('');
      onClose();
    }
  };

  const selectSuggestion = (s: string) => {
    setName(s);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir="rtl"
        className="w-full max-w-md bg-[#0D1520] border border-[var(--border)] rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--text-primary)]">إنشاء مجموعة مخصصة</h3>
              <p className="text-[11px] text-[var(--text-muted)]">نظّم رغباتك ومشترياتك في مجموعات خاصة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">اسم المجموعة</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أدوات المطبخ، هدايا للمستقبل..."
              autoFocus
              className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#D4AF37] outline-none"
            />
          </div>

          {/* Quick Suggestions */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              اقتراحات سريعة:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUGGESTIONS.map((preset) => {
                const isSelected = name === preset;
                const isAlreadyExists = existingGroups.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => selectSuggestion(preset)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                        : isAlreadyExists
                        ? 'opacity-40 cursor-not-allowed border-[var(--border)] text-[var(--text-muted)]'
                        : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[#D4AF37] hover:border-[#D4AF37]/40'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 bg-gradient-to-r from-[#D4AF37] to-[#E0B84A] text-black font-black text-xs rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{loading ? 'جاري الإنشاء...' : 'إنشاء المجموعة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RenameGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onRename: (oldName: string, newName: string) => Promise<boolean>;
}

export const RenameGroupModal: React.FC<RenameGroupModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onRename,
}) => {
  const [newName, setNewName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setNewName(currentName);
  }, [currentName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim() === currentName) {
      onClose();
      return;
    }
    setLoading(true);
    const success = await onRename(currentName, newName.trim());
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir="rtl"
        className="w-full max-w-sm bg-[#0D1520] border border-[var(--border)] rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-black text-[var(--text-primary)]">تعديل اسم المجموعة</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--text-secondary)]">الاسم الجديد للمجموعة:</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || !newName.trim()}
              className="px-4 py-1.5 bg-[#D4AF37] text-black font-black text-xs rounded-xl shadow hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التعديل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface MoveToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  currentGroup?: string;
  groups: string[];
  onMove: (productId: string, targetGroup: string) => Promise<void>;
  onCreateGroup: (name: string) => Promise<boolean>;
}

export const MoveToGroupModal: React.FC<MoveToGroupModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  currentGroup = 'المفضلة العامة',
  groups,
  onMove,
  onCreateGroup,
}) => {
  const [selectedGroup, setSelectedGroup] = useState(currentGroup);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setSelectedGroup(currentGroup || 'المفضلة العامة');
  }, [currentGroup]);

  if (!isOpen) return null;

  const handleSelectGroup = async (group: string) => {
    setSelectedGroup(group);
    setLoading(true);
    await onMove(productId, group);
    setLoading(false);
    onClose();
  };

  const handleCreateAndMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setLoading(true);
    const created = await onCreateGroup(newGroupName.trim());
    if (created) {
      await onMove(productId, newGroupName.trim());
      setNewGroupName('');
      setIsCreatingNew(false);
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir="rtl"
        className="w-full max-w-sm bg-[#0D1520] border border-[var(--border)] rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-[#D4AF37]" />
            <div>
              <h3 className="text-sm font-black text-[var(--text-primary)]">نقل إلى مجموعة</h3>
              <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[220px]">{productName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isCreatingNew ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-secondary)]">اختر المجموعة التي تريد نقل هذا المنتج إليها:</p>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {groups.map((group) => {
                const isCurrent = group === currentGroup;
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => handleSelectGroup(group)}
                    disabled={loading}
                    className={`w-full text-right px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isCurrent
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                        : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-primary)] hover:border-[#D4AF37]/40 hover:bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5 opacity-70" />
                      <span>{group}</span>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className="w-full py-2.5 border border-dashed border-[#D4AF37]/50 rounded-xl text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ إنشاء مجموعة جديدة ونقل المنتج لها</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateAndMove} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">اسم المجموعة الجديدة:</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="مثال: أدوات المطبخ..."
                autoFocus
                className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[#D4AF37] outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                رجوع
              </button>
              <button
                type="submit"
                disabled={loading || !newGroupName.trim()}
                className="px-4 py-1.5 bg-[#D4AF37] text-black font-black text-xs rounded-xl shadow hover:brightness-110 disabled:opacity-50"
              >
                {loading ? 'جاري النقل...' : 'إنشاء ونقل'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
