import { getValidImageSrc, isValidImageSrc } from '../../utils/imageUtils';
import React, { useState, useRef, useEffect } from 'react';
import { storageService } from '../../lib/data/storageService';
import {
  Upload,
  X,
  Star,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ImagePlus,
  AlertCircle,
  Link,
  Plus,
  Trash2,
  AlertTriangle,
  Palette,
  RotateCcw
} from 'lucide-react';
import { ProductColor, ProductColorVariant } from '../../types';


interface UploadingImage {
  id: string; // unique ID
  file?: File;
  previewUrl: string; // can be blob: or http(s)
  url?: string; // Supabase URL once finished
  status: 'uploading' | 'uploaded' | 'failed';
  error?: string;
}

interface ImageUploaderProps {
  productId: string;
  mainImageUrl: string;
  additionalImages: string[];
  onChange: (mainImage: string, additionalImages: string[]) => void;
  availableColors?: (ProductColor | ProductColorVariant)[];
  imageColorMap?: Record<string, string>; // url -> colorName
  onImageColorMapChange?: (newMap: Record<string, string>) => void;
  onSetColorMainImage?: (colorName: string, url: string) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
}

export function ImageUploader({
  productId,
  mainImageUrl,
  additionalImages,
  onChange,
  availableColors = [],
  imageColorMap = {},
  onImageColorMapChange,
  onSetColorMainImage,
  onUploadStateChange
}: ImageUploaderProps) {
  const [images, setImages] = useState<UploadingImage[]>([]);
  const imagesRef = useRef<UploadingImage[]>([]);
  imagesRef.current = images;

  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [selectedColorForNewImages, setSelectedColorForNewImages] = useState<string>('');
  const [deleteModalState, setDeleteModalState] = useState<{ url: string | null; id: string | null; warning: string | null }>({ url: null, id: null, warning: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getColorName = (c: any) => c?.colorName || c?.name || '';
  const getColorHex = (c: any) => c?.colorCode || c?.hex || '';

  // 1. Reconcile images from parent props (mainImageUrl & additionalImages)
  useEffect(() => {
    const propUrls = [
      ...(mainImageUrl ? [mainImageUrl] : []),
      ...(additionalImages || [])
    ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

    const prev = imagesRef.current;
    const activeUploads = prev.filter((img) => img.status === 'uploading' || img.status === 'failed');

    const uploadedImages: UploadingImage[] = propUrls.map((url) => {
      const found = prev.find((img) => img.url === url || img.previewUrl === url);
      if (found) return found;
      return {
        id: url,
        previewUrl: url,
        url,
        status: 'uploaded' as const
      };
    });

    const combined = [...uploadedImages];
    activeUploads.forEach((img) => {
      if (!combined.some((c) => c.id === img.id)) {
        combined.push(img);
      }
    });

    // Check if combined is actually different from current images to avoid unnecessary re-renders
    const currentIds = prev.map(i => i.id).join(',');
    const newIds = combined.map(i => i.id).join(',');
    if (currentIds !== newIds) {
      setImages(combined);
      imagesRef.current = combined;
    }
  }, [mainImageUrl, additionalImages]);

  // 2. Notify parent of upload state change safely
  useEffect(() => {
    const isCurrentlyUploading = images.some((img) => img.status === 'uploading');
    if (onUploadStateChange) {
      onUploadStateChange(isCurrentlyUploading);
    }
  }, [images, onUploadStateChange]);

  // 3. Clean up blob object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => {
        if (img.previewUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(img.previewUrl);
          } catch (e) {
            console.warn(e);
          }
        }
      });
    };
  }, []);

  const propagateChangesToParent = (currentImages: UploadingImage[], forcedMainUrl?: string) => {
    const uploadedList = currentImages.filter((img) => img.status === 'uploaded' && img.url);
    const uploadedUrls = uploadedList.map((img) => img.url as string);

    if (uploadedUrls.length === 0) {
      if (mainImageUrl !== '' || (additionalImages && additionalImages.length > 0)) {
        onChange('', []);
      }
      return;
    }

    let newMain = forcedMainUrl || mainImageUrl;
    if (!uploadedUrls.includes(newMain) || !newMain) {
      newMain = uploadedUrls[0];
    }

    const newAdditional = uploadedUrls.filter((url) => url !== newMain);

    const isSame = newMain === mainImageUrl &&
      newAdditional.length === (additionalImages || []).length &&
      newAdditional.every((val, idx) => val === additionalImages[idx]);

    if (!isSame) {
      console.log('[ImageUploader] Propagating uploaded URLs to parent:', {
        newMain,
        newAdditionalCount: newAdditional.length
      });
      onChange(newMain, newAdditional);
    }

    // Assign color automatically to newly uploaded images if a preset color is selected
    if (selectedColorForNewImages && onImageColorMapChange) {
      const updatedMap = { ...imageColorMap };
      let mapChanged = false;
      uploadedUrls.forEach((url) => {
        if (!updatedMap[url]) {
          updatedMap[url] = selectedColorForNewImages;
          mapChanged = true;
        }
      });
      if (mapChanged) {
        onImageColorMapChange(updatedMap);
      }
    }
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) return;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('/')) {
      setError('يرجى إدخال رابط صالح يبدأ بـ https:// أو /');
      return;
    }
    setError(null);

    const newImage: UploadingImage = {
      id: `url_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      previewUrl: cleanUrl,
      url: cleanUrl,
      status: 'uploaded' as const
    };

    const updated = [...imagesRef.current, newImage];
    imagesRef.current = updated;
    setImages(updated);
    propagateChangesToParent(updated);

    setUrlInput('');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const fileArr = Array.from(files);
    const newUploads = fileArr.map((file) => {
      const id = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file), // immediate local blob URL
        status: 'uploading' as const
      };
    });

    const updated = [...imagesRef.current, ...newUploads];
    imagesRef.current = updated;
    setImages(updated);

    // Start uploads in parallel
    newUploads.forEach((img) => {
      uploadSingleImage(img);
    });
  };

  const uploadSingleImage = async (img: UploadingImage) => {
    if (!img.file) return;
    try {
      const uploadedUrl = await storageService.uploadProductImage(
        productId || 'temp-product',
        img.file
      );

      // Defend against Base64 or empty leaks
      if (!uploadedUrl || uploadedUrl.startsWith('data:') || uploadedUrl.includes(';base64,')) {
        throw new Error('فشل الرفع: تعذر تخزين الملف كـ URL صالح.');
      }

      console.log('[ImageUploader] Upload completed for file:', {
        file: img.file.name,
        uploadedUrl
      });

      const updated = imagesRef.current.map((item) => {
        if (item.id === img.id) {
          return {
            ...item,
            status: 'uploaded' as const,
            url: uploadedUrl
          };
        }
        return item;
      });

      imagesRef.current = updated;
      setImages(updated);
      propagateChangesToParent(updated, uploadedUrl);

    } catch (err: any) {
      console.error('[ImageUploader] File upload failed:', err);
      const updated = imagesRef.current.map((item) => {
        if (item.id === img.id) {
          return {
            ...item,
            status: 'failed' as const,
            error: err?.message || 'فشل رفع الصورة'
          };
        }
        return item;
      });
      imagesRef.current = updated;
      setImages(updated);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const setAsMain = (url: string) => {
    if (url === mainImageUrl) return;
    const filteredAdditional = additionalImages.filter((img) => img !== url);
    const newAdditional = mainImageUrl ? [mainImageUrl, ...filteredAdditional] : filteredAdditional;
    onChange(url, newAdditional);
  };

  const confirmDelete = (item: UploadingImage) => {
    // If it hasn't finished uploading, just remove it from state
    if (item.status !== 'uploaded') {
      deleteImageById(item.id);
      return;
    }

    const url = item.url || item.previewUrl;

    // Check if it is the main image of any color variant
    const activeColorMain = availableColors.find((c: any) => {
      const colMain = c.mainImage || c.imageUrl;
      return colMain === url;
    });

    if (activeColorMain) {
      const colName = (activeColorMain as any).colorName || activeColorMain.name || '';
      setDeleteModalState({
        url: null,
        id: null,
        warning: `هذه الصورة هي الصورة الرئيسية للون "${colName}". يرجى تعيين صورة أخرى كصورة رئيسية لهذا اللون أولاً قبل محاولة الحذف.`
      });
      return;
    }

    const uploadedCount = images.filter((img) => img.status === 'uploaded').length;
    if (uploadedCount === 1) {
      setDeleteModalState({ url: null, id: null, warning: 'يجب إضافة صورة أخرى قبل حذف الصورة الوحيدة للمنتج.' });
      return;
    }

    if (url === mainImageUrl && additionalImages.length > 0) {
      setDeleteModalState({
        url,
        id: item.id,
        warning: 'هذه الصورة هي الصورة الرئيسية للمنتج. سيتم تعيين الصورة التالية كرئيسية تلقائياً عند الحذف. هل توافق؟'
      });
      return;
    }

    setDeleteModalState({
      url,
      id: item.id,
      warning: 'هل أنت متأكد من إزالة هذه الصورة من المنتج؟ (يتم الحذف الفعلي بعد حفظ المنتج)'
    });
  };

  const executeDelete = () => {
    if (deleteModalState.id) {
      deleteImageById(deleteModalState.id);
    }
    setDeleteModalState({ url: null, id: null, warning: null });
  };

  const deleteImageById = (id: string) => {
    const target = imagesRef.current.find((img) => img.id === id);
    if (target?.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(target.previewUrl);
      } catch (e) {}
    }

    const updated = imagesRef.current.filter((img) => img.id !== id);
    imagesRef.current = updated;
    setImages(updated);
    propagateChangesToParent(updated);

    // Clean up from color map if the image had a final URL
    if (target?.url && onImageColorMapChange && imageColorMap[target.url]) {
      const newMap = { ...imageColorMap };
      delete newMap[target.url];
      onImageColorMapChange(newMap);
    }
  };

  const handleSetImageColor = (url: string, colorName: string) => {
    if (!onImageColorMapChange) return;
    const updatedMap = { ...imageColorMap };
    if (colorName) {
      updatedMap[url] = colorName;
    } else {
      delete updatedMap[url];
    }
    onImageColorMapChange(updatedMap);
  };

  const moveAdditionalImage = (indexInAdditional: number, direction: 'up' | 'down') => {
    const list = [...additionalImages];
    const targetIdx = direction === 'up' ? indexInAdditional - 1 : indexInAdditional + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[indexInAdditional];
    list[indexInAdditional] = list[targetIdx];
    list[targetIdx] = temp;

    onChange(mainImageUrl, list);
  };

  const isUploading = images.some((img) => img.status === 'uploading');

  return (
    <div className="space-y-4" dir="rtl">
      {/* Preset Color for new uploads */}
      {availableColors.length > 0 && (
        <div className="p-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Palette className="w-4 h-4 text-[#D6A83A]" />
            <span className="font-bold">تحديد لون الصور الجديدة تلقائياً:</span>
          </div>
          <select
            value={selectedColorForNewImages}
            onChange={(e) => setSelectedColorForNewImages(e.target.value)}
            className="bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] rounded-lg py-1.5 px-3 outline-none focus:border-[#D6A83A] cursor-pointer"
          >
            <option value="">جميع الألوان (بدون تخصيص)</option>
            {availableColors.map((c) => {
              const name = getColorName(c);
              return (
                <option key={name} value={name}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-[#D6A83A] bg-[#D4AF37]/5'
            : 'border-[var(--border)] hover:border-[#D6A83A]/60 bg-[var(--surface-secondary)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-[#D6A83A] animate-spin" />
              <span className="text-xs font-bold text-[var(--text-primary)]">جاري ضغط ورفع الصور...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-[var(--surface-elevated)] text-[#D6A83A] flex items-center justify-center border border-[var(--border)]">
                <ImagePlus className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                اسحب وأفلت الصور هنا، أو <span className="text-[#D6A83A]">استعرض من جهازك</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                تلميح: يتم الرفع الفوري ومراقبة المعرض بنشاط
              </p>
            </>
          )}
        </div>
      </div>

      {/* Direct URL input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="أو أدخل رابط صورة مباشر (https://...)"
            className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl pr-9 pl-3 py-2 text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[#D6A83A]"
          />
        </div>
        <button
          type="button"
          onClick={handleAddUrl}
          disabled={!urlInput.trim()}
          className="px-3 py-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] disabled:opacity-40 text-[#D6A83A] text-xs font-bold rounded-xl border border-[var(--border)] flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة رابط</span>
        </button>
      </div>

      {/* Error block */}
      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-lg flex items-center gap-2 text-xs text-rose-300 animate-in fade-in slide-in-from-top-1 duration-150">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Image Gallery Grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[var(--text-secondary)]">
            معرض الصور ({images.length}) — لمحات وتعيينات صور المتغيرات الألوان
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((item) => {
              const imageUrl = item.url || item.previewUrl;
              const isMain = imageUrl === mainImageUrl;
              const assignedColorName = imageColorMap[imageUrl] || '';
              const matchedColor = availableColors.find((c) => getColorName(c) === assignedColorName);
              const colorHex = matchedColor ? getColorHex(matchedColor) : undefined;

              return (
                <div
                  key={item.id}
                  className={`flex flex-col rounded-xl overflow-hidden border-2 transition-all relative ${
                    isMain
                      ? 'border-[#D6A83A] shadow-md shadow-[#D4AF37]/10 bg-[var(--surface-secondary)]'
                      : item.status === 'failed'
                      ? 'border-rose-600/40 bg-rose-950/10'
                      : assignedColorName
                      ? 'border-[#D6A83A]/30 bg-[var(--surface-secondary)]'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <div className="relative aspect-square bg-[var(--surface-elevated)]">
                    <img
                      src={getValidImageSrc(imageUrl)}
                      alt="معاينة"
                      className={`w-full h-full object-cover ${item.status === 'uploading' ? 'opacity-40 scale-95 blur-xs' : ''}`}
                      referrerPolicy="no-referrer"
                    />

                    {/* Pending upload / spinner */}
                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-[#D6A83A] z-10 p-2 text-center gap-1.5">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-[10px] font-bold text-white">جاري الرفع...</span>
                      </div>
                    )}

                    {/* Failed state overlay */}
                    {item.status === 'failed' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/80 text-rose-400 z-10 p-2 text-center gap-1">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-[10px] font-black">فشل رفع الصورة</span>
                        {item.error && <span className="text-[9px] opacity-80 truncate max-w-full">{item.error}</span>}
                      </div>
                    )}

                    {/* Image Role & Color Badges */}
                    {item.status === 'uploaded' && (
                      <div className="absolute top-2 right-2 left-2 flex items-center justify-between gap-1 z-10 pointer-events-none">
                        {isMain ? (
                          <div className="bg-[#D6A83A] text-[#070D16] text-[10px] font-black px-2 py-0.5 rounded shadow-md flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            <span>رئيسية المنتج</span>
                          </div>
                        ) : (
                          <div className="bg-[var(--surface-elevated)]/80 backdrop-blur-xs text-[var(--text-secondary)] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[var(--border)]">
                            معرض فرعي
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assigned Color Badge */}
                    {item.status === 'uploaded' && assignedColorName && (
                      <div className="absolute bottom-2 right-2 left-2 bg-[var(--overlay)]/85 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/20 flex items-center gap-1.5 truncate">
                        {colorHex ? (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40 shadow-sm"
                            style={{ backgroundColor: colorHex }}
                          />
                        ) : (
                          <Palette className="w-3 h-3 text-[#D6A83A] shrink-0" />
                        )}
                        <span className="truncate">{assignedColorName}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-[var(--surface-secondary)] p-2 flex flex-col gap-2 flex-1 justify-between">
                    {item.status === 'uploaded' ? (
                      <>
                        {/* Color Assignment Dropdown */}
                        {availableColors.length > 0 && onImageColorMapChange && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-[var(--text-muted)] block font-semibold">
                              <span>اللون المخصص:</span>
                            </label>
                            <select
                              value={assignedColorName}
                              onChange={(e) => handleSetImageColor(imageUrl, e.target.value)}
                              className="w-full bg-[var(--surface-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] rounded-lg py-1 px-1.5 outline-none focus:border-[#D6A83A] cursor-pointer"
                            >
                              <option value="">جميع الألوان (عامة)</option>
                              {availableColors.map((c) => {
                                const name = getColorName(c);
                                return (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                );
                              })}
                            </select>

                            {assignedColorName && onSetColorMainImage && (
                              <button
                                type="button"
                                onClick={() => onSetColorMainImage(assignedColorName, imageUrl)}
                                className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-[#D6A83A] hover:text-[#070D16] bg-[#D4AF37]/10 hover:bg-[#D6A83A] border border-[#D6A83A]/40 transition-all py-1 rounded-md cursor-pointer mt-1"
                              >
                                <Star className="w-3 h-3 fill-current text-[#D6A83A]" />
                                <span>رئيسية للون: {assignedColorName}</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Set as Product Main Image Button */}
                        {!isMain ? (
                          <button
                            type="button"
                            onClick={() => setAsMain(imageUrl)}
                            className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[#070D16] hover:bg-[#D6A83A] transition-colors py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] cursor-pointer"
                          >
                            <Star className="w-3 h-3" />
                            تعيين كصورة رئيسية للمنتج
                          </button>
                        ) : (
                          <div className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-[#D6A83A] py-1 bg-[var(--surface-elevated)]/60 rounded-lg border border-[#D6A83A]/30">
                            <Star className="w-3 h-3 fill-current" />
                            الصورة الرئيسية للمنتج
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t border-[var(--border)] pt-1.5 mt-auto">
                          <button
                            type="button"
                            onClick={() => confirmDelete(item)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {!isMain && (
                            <div className="flex items-center gap-1">
                              {/* Re-ordering arrows inside additionalImages list */}
                              {additionalImages.includes(imageUrl) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => moveAdditionalImage(additionalImages.indexOf(imageUrl), 'up')}
                                    disabled={additionalImages.indexOf(imageUrl) === 0}
                                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] rounded-md border border-[var(--border)] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveAdditionalImage(additionalImages.indexOf(imageUrl), 'down')}
                                    disabled={additionalImages.indexOf(imageUrl) === additionalImages.length - 1}
                                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] rounded-md border border-[var(--border)] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col gap-1.5 justify-center flex-1">
                        {item.status === 'failed' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                // Mark back to uploading & retry
                                setImages(prev => prev.map(x => x.id === item.id ? { ...x, status: 'uploading' as const, error: undefined } : x));
                                uploadSingleImage(item);
                              }}
                              className="w-full flex items-center justify-center gap-1 bg-[#D6A83A]/10 hover:bg-[#D6A83A] text-[#D6A83A] hover:text-[#070D16] border border-[#D6A83A]/30 transition-all py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 animate-spin-reverse" />
                              <span>إعادة المحاولة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDelete(item)}
                              className="w-full flex items-center justify-center gap-1 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-600/20 transition-all py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </>
                        ) : (
                          // Uploading state actions (disabled)
                          <div className="text-center text-[11px] text-[var(--text-muted)] py-4 font-bold">
                            العمليات معطلة أثناء الرفع
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalState.warning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <div className="p-2 bg-rose-500/10 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">تأكيد الحذف</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              {deleteModalState.warning}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalState({ url: null, id: null, warning: null })}
                className="px-4 py-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface)] text-[var(--text-secondary)] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {deleteModalState.id ? 'إلغاء' : 'موافق'}
              </button>
              {deleteModalState.id && (
                <button
                  type="button"
                  onClick={executeDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-rose-900/20 cursor-pointer"
                >
                  تأكيد الحذف
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
