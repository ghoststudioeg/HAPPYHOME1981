/**
 * Recursively cleans and sanitizes objects before writing to Firestore,
 * ensuring no `undefined` fields or functions are present (which causes Firestore to throw).
 */
export function sanitizeForFirestore<T>(data: T): T {
  // Handle primitives
  if (data === null) return data as T;
  if (data === undefined) return undefined as any;
  
  const type = typeof data;
  
  if (type === 'function') return undefined as any;
  if (type === 'string' || type === 'number' || type === 'boolean') return data;

  // Handle arrays
  if (Array.isArray(data)) {
    const cleanedArray = data
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
    return cleanedArray as unknown as T;
  }

  // Handle objects
  if (type === 'object') {
    // Keep Dates
    if (data instanceof Date) return data as unknown as T;

    const obj = data as any;

    // Preserve Firestore internal objects (FieldValue, Timestamp, DocumentReference)
    // We check for common properties that identify these types across different SDK versions/minification
    const isFirestoreObject = 
      (obj.constructor && (
        obj.constructor.name === 'FieldValueImpl' || 
        obj.constructor.name === 'Timestamp' || 
        obj.constructor.name === 'DocumentReference' ||
        obj.constructor.name === 'Query'
      )) ||
      (obj._methodName !== undefined) || // FieldValue
      (obj.seconds !== undefined && obj.nanoseconds !== undefined && typeof obj.toDate === 'function') || // Timestamp
      (obj.id !== undefined && obj.path !== undefined && obj.firestore !== undefined); // DocumentReference

    if (isFirestoreObject) {
      return data;
    }

    const cleanObj: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedValue = sanitizeForFirestore(value);
      if (sanitizedValue !== undefined) {
        cleanObj[key] = sanitizedValue;
      }
    }
    
    return cleanObj as T;
  }

  return data;
}

/**
 * Calculates the approximate UTF-8 byte size of an object when serialized to JSON.
 */
export function getObjectByteSize(obj: any): number {
  try {
    const jsonString = JSON.stringify(obj);
    return new TextEncoder().encode(jsonString).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Serializes and cleans a product payload before writing to Firestore,
 * ensuring no File, Blob, base64 strings, or temporary UI states are stored.
 * Enforces single canonical image architecture and a 700 KB hard size limit guard.
 */
export function serializeProductForFirestore(data: any, productId?: string): any {
  // 1. Scan for any Base64 strings in the incoming payload
  const rawBase64Detections = findBase64Paths(data);
  if (rawBase64Detections.length > 0) {
    console.error(`[PRODUCT SAVE DEBUG] Base64 detected in payload:`);
    rawBase64Detections.forEach((det) => {
      console.error(`- Path: ${det.path} (Length: ${det.length} chars, Type: ${det.type})`);
    });
    throw new Error(
      `خطأ في تخزين الصور: تم كشف بيانات صورة بصيغة Base64 في "${rawBase64Detections[0].path}". يرجى التأكد من رفع جميع الصور بنجاح إلى Supabase وعدم استخدام روابط Base64 مؤقتة لحفظ المنتج.`
    );
  }

  // 2. Scan for File or Blob instances
  const rawFileOrBlobCount = countFileOrBlob(data);
  if (rawFileOrBlobCount.files > 0 || rawFileOrBlobCount.blobs > 0) {
    throw new Error('خطأ في حفظ المنتج: تم العثور على كائنات ملفات غير مرفوعة (File/Blob). يرجى الانتظار حتى اكتمال الرفع.');
  }

  // 3. Scan for temporary preview URLs (e.g. blob:...)
  const tempPreviewPaths = findTempPreviewPaths(data);
  if (tempPreviewPaths.length > 0) {
    throw new Error(`خطأ في تخزين الصور: تم كشف رابط معاينة مؤقت (${tempPreviewPaths[0].path}). يرجى التأكد من اكتمال الرفع.`);
  }

  // 4. Construct the clean canonical product payload
  const cleanPayload: Record<string, any> = {};

  // Standard fields
  if (data.name !== undefined) cleanPayload.name = sanitizeForFirestore(data.name);
  if (data.slug !== undefined) cleanPayload.slug = sanitizeForFirestore(data.slug);
  if (data.categoryId !== undefined) cleanPayload.categoryId = sanitizeForFirestore(data.categoryId);
  if (data.categoryName !== undefined) cleanPayload.categoryName = sanitizeForFirestore(data.categoryName);
  if (data.sku !== undefined) cleanPayload.sku = sanitizeForFirestore(data.sku);
  if (data.price !== undefined) cleanPayload.price = Number(data.price) || 0;
  if (data.oldPrice !== undefined) cleanPayload.oldPrice = data.oldPrice ? Number(data.oldPrice) : null;
  if (data.description !== undefined) cleanPayload.description = sanitizeForFirestore(data.description);
  if (data.features !== undefined) cleanPayload.features = sanitizeForFirestore(data.features);
  if (data.specifications !== undefined) cleanPayload.specifications = sanitizeForFirestore(data.specifications);
  if (data.gallerySettings !== undefined) cleanPayload.gallerySettings = sanitizeForFirestore(data.gallerySettings);
  if (data.installmentConfig !== undefined) cleanPayload.installmentConfig = sanitizeForFirestore(data.installmentConfig);
  if (data.isAvailable !== undefined) cleanPayload.isAvailable = Boolean(data.isAvailable);
  if (data.isFeatured !== undefined) cleanPayload.isFeatured = Boolean(data.isFeatured);
  if (data.isPublished !== undefined) cleanPayload.isPublished = Boolean(data.isPublished);
  if (data.stockQuantity !== undefined) cleanPayload.stockQuantity = Number(data.stockQuantity) || 0;
  if (data.lowStockThreshold !== undefined) cleanPayload.lowStockThreshold = Number(data.lowStockThreshold) || 3;
  if (data.stockStatus !== undefined) cleanPayload.stockStatus = sanitizeForFirestore(data.stockStatus);
  if (data.trackInventory !== undefined) cleanPayload.trackInventory = Boolean(data.trackInventory);
  if (data.showExactStockToCustomer !== undefined) cleanPayload.showExactStockToCustomer = Boolean(data.showExactStockToCustomer);
  if (data.sortOrder !== undefined) cleanPayload.sortOrder = Number(data.sortOrder) || 0;
  if (data.whatsappClicks !== undefined) cleanPayload.whatsappClicks = Number(data.whatsappClicks) || 0;
  if (data.createdAt !== undefined) cleanPayload.createdAt = data.createdAt;
  if (data.updatedAt !== undefined) cleanPayload.updatedAt = data.updatedAt;

  // 5. Canonical Color & Image Model
  // Single source of truth: colorVariants
  const rawVariants = data.colorVariants || data.variants || data.colors || [];
  let canonicalVariants: any[] = [];
  let imageReferencesCount = 0;

  if (Array.isArray(rawVariants) && rawVariants.length > 0) {
    canonicalVariants = rawVariants.map((v: any, idx: number) => {
      const colorName = (v.colorName || v.name || '').trim();
      const colorCode = (v.colorCode || v.hex || '').trim();
      
      // Clean and validate mainImage
      const rawMain = (v.mainImage || v.imageUrl || '').trim();
      if (rawMain.startsWith('data:') || rawMain.startsWith('blob:')) {
        throw new Error(`خطأ في اللون (${colorName}): رابط الصورة الرئيسية غير صالح أو بصيغة Base64.`);
      }
      const mainImage = rawMain;

      // Clean and validate images array
      const rawImages: any[] = Array.isArray(v.images) ? v.images : [];
      const cleanImages: string[] = [];
      rawImages.forEach((img) => {
        if (typeof img === 'string' && img.trim().length > 0) {
          const trimmed = img.trim();
          if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
            throw new Error(`خطأ في صور اللون (${colorName}): تم كشف رابط بصيغة Base64.`);
          }
          if (!cleanImages.includes(trimmed)) {
            cleanImages.push(trimmed);
          }
        }
      });

      // Ensure mainImage is part of images array
      if (mainImage && !cleanImages.includes(mainImage)) {
        cleanImages.unshift(mainImage);
      }

      imageReferencesCount += cleanImages.length;

      return {
        id: v.id || `var_${idx}_${Date.now()}`,
        colorName,
        colorCode,
        mainImage: mainImage || (cleanImages.length > 0 ? cleanImages[0] : null),
        images: cleanImages,
        sku: v.sku?.trim() || undefined,
        stockQuantity: typeof v.stockQuantity === 'number' ? v.stockQuantity : undefined,
        price: typeof v.price === 'number' ? v.price : undefined,
        oldPrice: typeof v.oldPrice === 'number' ? v.oldPrice : undefined,
        active: v.active !== false
      };
    });

    cleanPayload.colorVariants = canonicalVariants;
  }

  // 6. Global mainImageUrl for storefront cards and quick display
  const primaryMain = (canonicalVariants.length > 0 ? canonicalVariants[0].mainImage : '') || 
    (typeof data.mainImageUrl === 'string' && !data.mainImageUrl.startsWith('data:') && !data.mainImageUrl.startsWith('blob:') ? data.mainImageUrl.trim() : '');
  cleanPayload.mainImageUrl = primaryMain;

  // 7. Global additionalImages only if product has NO color variants
  if (canonicalVariants.length === 0) {
    const rawAdditional: any[] = Array.isArray(data.additionalImages) ? data.additionalImages : [];
    cleanPayload.additionalImages = rawAdditional
      .filter((img) => typeof img === 'string' && img.trim().length > 0 && !img.startsWith('data:') && !img.startsWith('blob:'))
      .map((img) => img.trim());
    imageReferencesCount += (primaryMain ? 1 : 0) + cleanPayload.additionalImages.length;
  }

  // 8. Enforce ZERO duplicate legacy image structures in persisted payload:
  // cleanPayload does NOT contain `colors`, `variants`, `colorImageMap`, or `imageColorMap`.
  // If variants exist, it does NOT contain `additionalImages` either.
  const duplicateLegacyImageStructures = 
    ('colors' in cleanPayload ? 1 : 0) + 
    ('variants' in cleanPayload ? 1 : 0) + 
    ('colorImageMap' in cleanPayload ? 1 : 0) + 
    ('imageColorMap' in cleanPayload ? 1 : 0);

  // 9. Final recursive sanitization (removes undefined, strips accidental temporary fields)
  const finalPayload = sanitizeForFirestore(cleanPayload);
  const size = getObjectByteSize(finalPayload);
  const sizeKB = (size / 1024).toFixed(1);

  // 10. EXACT required development debug output
  console.log(
`[PRODUCT SAVE DEBUG]
image references:
${imageReferencesCount}
base64 fields:
0
File objects:
0
Blob objects:
0
temporary preview fields:
0
duplicate legacy image structures:
${duplicateLegacyImageStructures}
payload size:
${sizeKB} KB`
  );

  // 11. Hard size limit guard at 700 KB (716,800 bytes)
  const MAX_SAFE_SIZE = 700 * 1024;
  if (size > MAX_SAFE_SIZE) {
    throw new Error(
      `حجم بيانات المنتج كبير جداً (${sizeKB} كيلوبايت) ويتجاوز الحد الأقصى المسموح به (700 كيلوبايت). يرجى إزالة بعض الصور لحفظ المنتج بنجاح.`
    );
  }

  return finalPayload;
}

function countFileOrBlob(data: any): { files: number; blobs: number } {
  let files = 0;
  let blobs = 0;
  if (!data || typeof data !== 'object') return { files, blobs };

  const checkItem = (item: any) => {
    if (typeof File !== 'undefined' && item instanceof File) files++;
    else if (typeof Blob !== 'undefined' && item instanceof Blob) blobs++;
    else if (typeof item === 'object' && item !== null) {
      const sub = countFileOrBlob(item);
      files += sub.files;
      blobs += sub.blobs;
    }
  };

  if (Array.isArray(data)) {
    data.forEach(checkItem);
  } else {
    Object.values(data).forEach(checkItem);
  }
  return { files, blobs };
}

function findTempPreviewPaths(data: any, path: string = 'root'): Array<{ path: string; value: string }> {
  const found: Array<{ path: string; value: string }> = [];
  if (!data || typeof data !== 'object') return found;

  for (const [key, value] of Object.entries(data)) {
    const currentPath = path === 'root' ? key : `${path}.${key}`;
    if (['localPreviewUrl', 'previewUrl', 'tempUrl'].includes(key) && typeof value === 'string' && value.length > 0) {
      found.push({ path: currentPath, value });
    } else if (typeof value === 'string' && value.startsWith('blob:')) {
      found.push({ path: currentPath, value });
    } else if (typeof value === 'object' && value !== null) {
      found.push(...findTempPreviewPaths(value, currentPath));
    }
  }
  return found;
}

function findBase64Paths(data: any, path: string = 'root'): Array<{ path: string; type: string; length: number }> {
  const found: Array<{ path: string; type: string; length: number }> = [];
  if (data === null || data === undefined) return found;

  const type = typeof data;
  if (type === 'string') {
    if (data.startsWith('data:') || data.includes(';base64,')) {
      found.push({
        path,
        type: 'string',
        length: data.length
      });
    }
  } else if (Array.isArray(data)) {
    data.forEach((item, index) => {
      found.push(...findBase64Paths(item, `${path}[${index}]`));
    });
  } else if (type === 'object') {
    if (data instanceof Date) return found;
    const constructorName = data.constructor?.name;
    if (
      ['FieldValueImpl', 'Timestamp', 'DocumentReference', 'Query'].includes(constructorName) ||
      data._methodName !== undefined
    ) {
      return found;
    }
    for (const [key, value] of Object.entries(data)) {
      found.push(...findBase64Paths(value, path === 'root' ? key : `${path}.${key}`));
    }
  }
  return found;
}
