import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
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
    // 1. Ensure partitioned cookie is configured for sandboxed environments
    try {
      const host = window.location.hostname;
      document.cookie = `__SECURE-aistudio_auth_flow_may_set_cookies=true; Path=/; Secure; SameSite=None; Domain=${host}; Partitioned; Max-Age=604800;`;
    } catch {}

    const blobToDataUrl = (b: Blob): Promise<string> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(b);
      });

    // Attempt 1: Standard multipart upload to Supabase via /api/storage/upload with credentials: 'include'
    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('folder', folder);
      formData.append('fileName', fileName);

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: formData,
        credentials: 'include'
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (response.ok && data.success && data.url) {
          return data.url;
        }
      }
    } catch {
      // Ignore and proceed to Attempt 2
    }

    // Attempt 2: JSON payload upload to /api/storage/upload (often bypasses multipart boundary checks)
    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const dataUrl = await blobToDataUrl(blob);
      const jsonResponse = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ dataUrl, fileName, folder }),
        credentials: 'include'
      });

      const jsonContentType = jsonResponse.headers.get('content-type') || '';
      if (jsonContentType.includes('application/json')) {
        const data = await jsonResponse.json();
        if (jsonResponse.ok && data.success && data.url) {
          return data.url;
        }
      }
    } catch {
      // Ignore and proceed to fallback
    }

    throw new Error('تعذر رفع الملف إلى خادم التخزين Supabase. يرجى التأكد من تكوين إعدادات التخزين بشكل صحيح.');
  },

  async uploadProductImage(productId: string, file: File): Promise<string> {
    const optimizedBlob = await this.optimizeImage(file);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}_${sanitizedFileName}`;
    return this.uploadFile(optimizedBlob, fileName, `products/${productId}`);
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
