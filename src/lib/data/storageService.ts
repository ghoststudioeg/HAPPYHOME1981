import { auth } from '../firebase';
import { getSupabaseBrowserClient } from './supabaseClient';
const MAX_FILE_SIZE_MB = 8;
const MAX_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.85;

export interface StorageStatus {
  configured: boolean;
  supabaseUrl?: string;
  buckets?: Array<{ name: string; id: string; public: boolean }>;
  usable: boolean;
  error?: string;
}

export const storageService = {
  async getStatus(): Promise<StorageStatus> {
    try {
      try {
        const host = window.location.hostname;
        document.cookie = `__SECURE-aistudio_auth_flow_may_set_cookies=true; Path=/; Secure; SameSite=None; Domain=${host}; Partitioned; Max-Age=604800;`;
      } catch {}

      const res = await fetch('/api/storage/status', {
        credentials: 'include'
      });
      if (!res.ok) {
        return { configured: true, usable: true, error: `HTTP ${res.status}` };
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Sandboxed iframe environment fallback
        return { configured: true, usable: true };
      }
      return await res.json();
    } catch (err: any) {
      return { configured: true, usable: true, error: err?.message };
    }
  },

  async optimizeImage(file: File): Promise<Blob> {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error('حجم الصورة كبير جدًا. يُفضل استخدام صورة بحجم أقل من 8 ميجابايت.');
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          COMPRESSION_QUALITY
        );
      };
      img.onerror = () => {
        reject(new Error('تعذر قراءة ملف الصورة.'));
      };
      reader.readAsDataURL(file);
    });
  },

  async uploadFile(blob: Blob, fileName: string, folder: string): Promise<string> {
    const blobToDataUrl = (b: Blob): Promise<string> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(b);
      });

    // Ensure we obtain a valid ID token from Firebase Auth
    let idToken = '';
    if (auth?.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken(false);
      } catch (e) {
        console.warn('Failed to get fresh idToken from currentUser:', e);
      }
    } else if (auth) {
      // If auth is still loading during page mount, wait briefly for auth state
      await new Promise<void>((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(() => {
          unsubscribe();
          resolve();
        });
        setTimeout(resolve, 800);
      });
      if (auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken(false);
        } catch {}
      }
    }

    const uploadHeaders: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (idToken) {
      uploadHeaders['Authorization'] = `Bearer ${idToken}`;
    }

    console.log('[Storage Upload Request]', {
      endpoint: '/api/storage/upload',
      method: 'POST',
      folder,
      fileName,
      size: blob.size,
      hasToken: !!idToken,
      timestamp: new Date().toISOString()
    });

    let lastErrorMessage = '';

    // Attempt 1: Standard multipart upload to Supabase via /api/storage/upload
    const start1 = Date.now();
    try {
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('folder', folder);
      formData.append('fileName', fileName);

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
        credentials: 'include'
      });

      console.log('[Storage Upload Response 1]', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers.get('content-type')
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (response.ok && data.success && data.url) {
          return data.url;
        }
        if (data?.error) {
          lastErrorMessage = data.error;
        }
      } else if (!response.ok) {
        lastErrorMessage = `خطأ في الخادم (${response.status} ${response.statusText})`;
      }
    } catch (err: any) {
      console.error('[API FETCH ERROR]', {
        url: '/api/storage/upload',
        method: 'POST',
        error: err?.message || String(err),
        duration: `${Date.now() - start1}ms`
      });
      lastErrorMessage = err?.message || 'تعذر الاتصال بالخادم';
    }

    // Attempt 2: JSON payload upload to /api/storage/upload (bypasses multipart stream issues)
    const start2 = Date.now();
    try {
      const dataUrl = await blobToDataUrl(blob);
      const jsonResponse = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...uploadHeaders
        },
        body: JSON.stringify({ dataUrl, fileName, folder }),
        credentials: 'include'
      });

      console.log('[Storage Upload Response 2]', {
        status: jsonResponse.status,
        statusText: jsonResponse.statusText,
        ok: jsonResponse.ok,
        contentType: jsonResponse.headers.get('content-type')
      });

      const jsonContentType = jsonResponse.headers.get('content-type') || '';
      if (jsonContentType.includes('application/json')) {
        const data = await jsonResponse.json();
        if (jsonResponse.ok && data.success && data.url) {
          return data.url;
        }
        if (data?.error) {
          lastErrorMessage = data.error;
        }
      } else if (!jsonResponse.ok) {
        lastErrorMessage = `خطأ في الخادم (${jsonResponse.status} ${jsonResponse.statusText})`;
      }
    } catch (err: any) {
      console.error('[API FETCH ERROR]', {
        url: '/api/storage/upload',
        method: 'POST',
        error: err?.message || String(err),
        duration: `${Date.now() - start2}ms`
      });
      lastErrorMessage = err?.message || 'تعذر الاتصال بالخادم';
    }

    // Attempt 3: Direct Supabase client upload fallback if API proxy failed due to network/iframe proxy issues
    try {
      const browserClient = getSupabaseBrowserClient();
      if (browserClient) {
        const filePath = `${folder}/${fileName}`;
        const { data: uploadData, error: directErr } = await browserClient.storage
          .from('product-images')
          .upload(filePath, blob, {
            contentType: blob.type || 'image/webp',
            upsert: true
          });

        if (!directErr && uploadData) {
          const { data: pubData } = browserClient.storage
            .from('product-images')
            .getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            console.log('[Storage Upload Success Attempt 3 (Direct Client)]', pubData.publicUrl);
            return pubData.publicUrl;
          }
        }
      }
    } catch (directUploadErr: any) {
      console.warn('[Storage Upload Direct Attempt Warning]', directUploadErr?.message || directUploadErr);
    }

    // Format specific error message for customer/admin
    if (lastErrorMessage) {
      if (lastErrorMessage.includes('NetworkError') || lastErrorMessage.includes('Failed to fetch') || lastErrorMessage.includes('Network request failed')) {
        throw new Error('تعذر الاتصال بخادم رفع الصور. يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.');
      }
      throw new Error(lastErrorMessage);
    }

    throw new Error('تعذر رفع الملف إلى خادم التخزين Supabase. يرجى التأكد من اتصال الإنترنت وصلاحيات الحساب.');
  },

  async uploadProductImage(productId: string, file: File): Promise<string> {
    const optimizedBlob = await this.optimizeImage(file);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}_${sanitizedFileName}`;
    return this.uploadFile(optimizedBlob, fileName, `products/${productId}`);
  },

  async uploadBundleImage(bundleIdOrTemp: string, file: File): Promise<string> {
    // 1. Validate supported image formats: PNG, JPG/JPEG, WEBP
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
    
    if ((file.type && !allowedTypes.includes(file.type.toLowerCase())) && !allowedExts.includes(ext)) {
      throw new Error('نوع الملف غير مدعوم. يُرجى اختيار صورة بصيغة PNG أو JPG أو WebP.');
    }

    // 2. Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('حجم الصورة أكبر من الحد المسموح به (10 ميجابايت).');
    }

    // 3. Image optimization to WebP
    const optimizedBlob = await this.optimizeImage(file);
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fileName = `design-${uniqueId}.webp`;
    const folderId = bundleIdOrTemp ? bundleIdOrTemp.replace(/[^a-zA-Z0-9_-]/g, '_') : `temp_${Date.now()}`;
    return this.uploadFile(optimizedBlob, fileName, `bundle-offers/${folderId}`);
  },

  async uploadCategoryImage(categoryId: string, file: File): Promise<string> {
    const optimizedBlob = await this.optimizeImage(file);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}_${sanitizedFileName}`;
    return this.uploadFile(optimizedBlob, fileName, `categories/${categoryId}`);
  },

  async uploadLogo(file: File): Promise<string> {
    const optimizedBlob = await this.optimizeImage(file);
    const fileName = `${Date.now()}_logo.webp`;
    return this.uploadFile(optimizedBlob, fileName, 'brand');
  },

  async uploadProviderLogo(providerId: string, file: File): Promise<string> {
    const optimizedBlob = await this.optimizeImage(file);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}_${sanitizedFileName}.webp`;
    return this.uploadFile(optimizedBlob, fileName, `installments/${providerId}`);
  },

  
  async isFileReferenced(fileUrl: string, _ignoreRecordId?: string): Promise<boolean> {
    if (!fileUrl || typeof fileUrl !== 'string') return false;
    
    // Skip checking for local/temp URLs
    if (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) return false;

    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/storage/check-references', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ fileUrl }),
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      return !!data.isReferenced;
    } catch (err) {
      console.warn('Reference check notice (using safe fallback):', err);
      // Fail safe: assume it is referenced to prevent accidental deletion if server is down or unreachable
      return true; 
    }
  },

  async safeDeleteFile(fileUrl: string, ignoreRecordId?: string): Promise<void> {
    if (!fileUrl || typeof fileUrl !== 'string') return;
    if (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) return;
    
    const isReferenced = await this.isFileReferenced(fileUrl, ignoreRecordId);
    if (!isReferenced) {
      console.log('File is unreferenced, deleting from storage:', fileUrl);
      await this._forceDeleteFile(fileUrl);
    } else {
      console.log('File is still referenced, keeping in storage:', fileUrl);
    }
  },

  async safeDeleteFiles(fileUrls: (string | undefined | null)[], ignoreRecordId?: string): Promise<void> {
    const validUrls = Array.from(new Set(fileUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)));
    if (validUrls.length === 0) return;
    await Promise.allSettled(validUrls.map((url) => this.safeDeleteFile(url, ignoreRecordId)));
  },

  async _forceDeleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl || typeof fileUrl !== 'string') return;
    // Skip placeholder or data URLs
    if (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) return;
    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/storage/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ fileUrl }),
        credentials: 'include'
      });
      const contentType = res.headers.get('content-type');
      if (!res.ok) {
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('Storage delete returned non-JSON HTML error, status:', res.status);
        } else {
          const data = await res.json();
          console.warn('Storage delete error:', data.error);
        }
      }
    } catch (err) {
      console.warn('File delete notice:', err);
    }
  },

  async deleteFiles(fileUrls: (string | undefined | null)[], ignoreRecordId?: string): Promise<void> {
    const validUrls = Array.from(new Set(fileUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)));
    if (validUrls.length === 0) return;
    await Promise.allSettled(validUrls.map((url) => this.safeDeleteFile(url, ignoreRecordId)));
  }
};
