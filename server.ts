import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin, verifyFirebaseUser, sanitizeForFirestoreServer } from './src/lib/firebaseAdmin';

dotenv.config();

/**
 * Guarantees a Firestore instance from the canonical Admin SDK.
 * Used for server-side operations that require higher privileges or
 * complex queries not suitable for the browser.
 */
const getFirestoreInstance = () => {
  return getFirebaseAdmin().db;
};

// Authentication Middleware - Verifies Firebase ID Token
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await verifyFirebaseUser(idToken);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    // verifyFirebaseUser already logs details
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Optional Authentication Middleware
const authenticateOptional = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    req.user = { uid: 'guest', role: 'guest' };
    return next();
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await verifyFirebaseUser(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    req.user = { uid: 'guest', role: 'guest' };
    next();
  }
};

// Admin-only Middleware
const authorizeAdmin = (req: any, res: any, next: any) => {
  const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
  const userEmail = req.user?.email?.toLowerCase();
  
  if (userEmail && adminEmails.includes(userEmail)) {
    next();
  } else {
    // Also check for the specific root UID if needed
    if (req.user?.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22') {
      return next();
    }
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Middleware to configure CORS and partitioned auth cookies for AI Studio iframe compatibility
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Provide partitioned cookie expected by AI Studio proxy flow
  try {
    res.cookie('__SECURE-aistudio_auth_flow_may_set_cookies', 'true', {
      sameSite: 'none',
      secure: true,
      partitioned: true,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  } catch {}

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

let supabaseAdminClient: SupabaseClient | null = null;

function getSupabase(): { client: SupabaseClient | null; url: string; error?: string } {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return {
      client: null,
      url: supabaseUrl,
      error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are not set in environment variables.'
    };
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return { client: supabaseAdminClient, url: supabaseUrl };
}

// 1. Audit / Status Endpoint
app.get('/api/storage/status', async (req: any, res: any) => {
  const { client, url, error } = getSupabase();

  if (!client) {
    return res.json({
      configured: false,
      supabaseUrl: url || 'NOT_SET',
      error: error || 'Supabase credentials missing',
      buckets: [],
      tables: [],
      usable: false
    });
  }

  try {
    // List existing Storage buckets without modifying anything
    const { data: buckets, error: bucketError } = await client.storage.listBuckets();
    
    // Check accessible tables without altering or modifying any data
    let tables: string[] = [];
    try {
      const { data: tableData } = await client
        .from('information_schema.tables' as any)
        .select('table_name')
        .limit(20);
      if (tableData) {
        tables = tableData.map((t: any) => t.table_name);
      }
    } catch {
      // Ignore if schema query is restricted
    }

    return res.json({
      configured: true,
      supabaseUrl: url,
      bucketError: bucketError ? bucketError.message : null,
      buckets: buckets || [],
      tables: tables,
      usable: !bucketError && !!buckets
    });
  } catch (err: any) {
    return res.status(500).json({
      configured: true,
      supabaseUrl: url,
      error: err?.message || 'Failed to inspect Supabase project',
      usable: false
    });
  }
});

// 2. Upload Endpoint (Admin or Own Avatar Only)
app.post('/api/storage/upload', authenticate, upload.single('file'), async (req: any, res: any) => {
  const { client, url, error: configError } = getSupabase();

  if (!client) {
    return res.status(400).json({
      error: configError || 'Supabase storage is not configured. Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment settings.'
    });
  }

  const file = req.file;
  const folder = (req.body.folder as string) || 'products';
  const customFileName = req.body.fileName as string;

  let fileBuffer: Buffer | null = null;
  let fileMimeType = 'image/webp';
  let ext = 'webp';

  if (file) {
    fileBuffer = file.buffer;
    fileMimeType = file.mimetype || 'image/webp';
    ext = file.originalname.split('.').pop() || 'webp';
  } else if (req.body.dataUrl && typeof req.body.dataUrl === 'string') {
    const match = req.body.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      fileMimeType = match[1];
      ext = fileMimeType.split('/')[1] || 'webp';
      fileBuffer = Buffer.from(match[2], 'base64');
    }
  }

  // Authorization Check
  const checkIsAdmin = (user: any) => {
    if (!user) return false;
    const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
    const userEmail = user.email?.toLowerCase();
    if (userEmail && adminEmails.includes(userEmail)) return true;
    if (user.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22') return true;
    return false;
  };

  const isAdmin = checkIsAdmin(req.user);
  if (!isAdmin) {
    // Normal customers can only upload to avatars/{customerUid}
    const expectedPrefix = `avatars/${req.user.uid}`;
    if (folder !== expectedPrefix) {
      return res.status(403).json({ error: 'Forbidden: Customers are only permitted to upload to their own avatars folder.' });
    }
    // Validate MIME types: JPG, PNG, WEBP
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(fileMimeType)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPG, PNG, and WEBP images are allowed.' });
    }
    // Validate file size (max 8MB)
    if (fileBuffer && fileBuffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size too large. Maximum size is 8MB.' });
    }
  }

  if (!fileBuffer) {
    return res.status(400).json({ error: 'No file or dataUrl provided.' });
  }

  try {
    // Determine bucket: use SUPABASE_STORAGE_BUCKET or find suitable existing bucket
    const targetBucketName = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

    // Check if bucket exists
    const { data: buckets } = await client.storage.listBuckets();
    let bucket = buckets?.find((b) => b.name === targetBucketName || b.name === 'products' || b.name === 'images');

    // If no existing bucket matches and targetBucketName doesn't exist, create public bucket if permitted
    let bucketName = bucket ? bucket.name : targetBucketName;
    if (!bucket) {
      const { error: createError } = await client.storage.createBucket(targetBucketName, {
        public: true,
        fileSizeLimit: 10485760
      });
      if (!createError) {
        bucketName = targetBucketName;
      }
    }

    const cleanFileName = (customFileName || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${folder}/${cleanFileName}`;

    const { data: uploadData, error: uploadError } = await client.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: fileMimeType,
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: `Supabase Storage upload failed: ${uploadError.message}` });
    }

    // Get Public URL
    const { data: publicUrlData } = client.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return res.json({
      success: true,
      bucket: bucketName,
      path: filePath,
      url: publicUrlData.publicUrl
    });
  } catch (err: any) {
    console.error('Server upload handler error:', err);
    return res.status(500).json({ error: err?.message || 'Server upload error' });
  }
});

// 3. Delete Endpoint (Admin or Own Avatar Only)
app.post('/api/storage/delete', authenticate, async (req: any, res: any) => {
  const { client } = getSupabase();
  if (!client) {
    return res.status(400).json({ error: 'Supabase storage is not configured.' });
  }

  const { fileUrl, path: storagePath, bucket: reqBucket } = req.body;
  if (!fileUrl && !storagePath) {
    return res.status(400).json({ error: 'fileUrl or path is required.' });
  }

  try {
    let bucketName = reqBucket || process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
    let targetPath = storagePath;

    if (fileUrl && !targetPath) {
      // Extract path and bucket from Supabase public URL
      // Format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const matches = fileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (matches) {
        bucketName = matches[1];
        targetPath = matches[2];
      }
    }

    if (!targetPath) {
      return res.json({ success: true, message: 'Non-Supabase file URL, skipped deletion.' });
    }

    // Authorization Check
    const checkIsAdmin = (user: any) => {
      if (!user) return false;
      const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
      const userEmail = user.email?.toLowerCase();
      if (userEmail && adminEmails.includes(userEmail)) return true;
      if (user.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22') return true;
      return false;
    };

    const isAdmin = checkIsAdmin(req.user);
    if (!isAdmin) {
      const expectedPrefix = `avatars/${req.user.uid}/`;
      if (!targetPath.startsWith(expectedPrefix)) {
        return res.status(403).json({ error: 'Forbidden: Customers are only permitted to delete their own avatar files.' });
      }
    }

    const { error: deleteError } = await client.storage
      .from(bucketName)
      .remove([targetPath]);

    if (deleteError) {
      console.warn('Supabase file delete warning:', deleteError);
    }

    return res.json({ success: true, deletedPath: targetPath, bucket: bucketName });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server delete error' });
  }
});

// 4. Check File References Endpoint (Securely check if a file is used in Firestore)
app.post('/api/storage/check-references', authenticate, async (req: any, res: any) => {
  const { fileUrl } = req.body;
  if (!fileUrl) {
    return res.status(400).json({ error: 'fileUrl is required.' });
  }

  const db = getFirebaseAdmin().db;
  if (!db) {
    return res.status(500).json({ error: 'Admin database not available.' });
  }

  try {
    // Only allow checking if it's your own avatar or you are an admin
    const checkIsAdmin = (user: any) => {
      if (!user) return false;
      const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
      const userEmail = user.email?.toLowerCase();
      if (userEmail && adminEmails.includes(userEmail)) return true;
      if (user.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22') return true;
      return false;
    };

    const isAdmin = checkIsAdmin(req.user);
    const isOwnAvatar = fileUrl.includes(`/avatars/${req.user.uid}/`);

    if (!isAdmin && !isOwnAvatar) {
      return res.status(403).json({ error: 'Forbidden: You can only check references for your own avatar files.' });
    }

    // Reference check logic (best-effort across main collections)
    const collectionsToCheck = [
      'products',
      'categories',
      'settings',
      'homepage_banners',
      'limited_offers',
      'coming_soon',
      'news_ticker',
      'users'
    ];

    let isReferenced = false;

    // We check sequentially to avoid overloading, but limit the search
    for (const colName of collectionsToCheck) {
      if (isReferenced) break;

      if (colName === 'settings') {
        const docRef = db.collection('settings').doc('main');
        const snap = await docRef.get();
        if (snap.exists) {
          const data = snap.data();
          if (data?.logoUrl === fileUrl) isReferenced = true;
        }
        continue;
      }

      if (colName === 'users') {
        // Special case: check if any OTHER user is using this as photoURL (unlikely but possible if shared)
        // or just check if it is NOT the current user's profile photo (actually we want to know if it's referenced AT ALL)
        const q = db.collection('users').where('photoURL', '==', fileUrl).limit(1);
        const snap = await q.get();
        if (!snap.empty) isReferenced = true;
        continue;
      }

      // Check main fields in other collections
      // Note: This is an expensive scan. In a real production app, you'd use a dedicated file-registry.
      // For this app, we'll check the primary image fields.
      const fieldsToCheck = colName === 'products' ? ['mainImageUrl'] : 
                            colName === 'categories' ? ['image'] : 
                            colName === 'homepage_banners' ? ['desktopImageUrl', 'mobileImageUrl'] :
                            colName === 'limited_offers' ? ['productImage'] :
                            colName === 'coming_soon' ? ['image'] :
                            colName === 'news_ticker' ? ['icon'] : [];

      for (const field of fieldsToCheck) {
        if (isReferenced) break;
        const q = db.collection(colName).where(field, '==', fileUrl).limit(1);
        const snap = await q.get();
        if (!snap.empty) isReferenced = true;
      }
    }

    return res.json({ success: true, isReferenced });
  } catch (err: any) {
    console.error('[Server] Reference check error:', err);
    // Safe fallback: report as referenced if check fails
    return res.json({ success: true, isReferenced: true, error: err.message });
  }
});

// 4. WhatsApp Notification Endpoints
app.get('/api/notifications/whatsapp/status', authenticate, authorizeAdmin, (req, res) => {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const isConfigured = !!(token && token.trim().length > 0 && phoneNumberId && phoneNumberId.trim().length > 0);

  return res.json({
    configured: isConfigured,
    providerStatus: isConfigured ? 'configured' : 'not_configured',
    message: isConfigured 
      ? 'WhatsApp API مُكوّن وجاهز للإرسال' 
      : 'WhatsApp API غير مُكوّن (ينقص المفتاح في البيئة)'
  });
});

app.post('/api/notifications/whatsapp', authenticate, async (req: any, res: any) => {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const customUrl = process.env.WHATSAPP_API_URL;

  const { event, recipientPhone } = req.body;
  const user = (req as any).user;

  if (!event || !event.title) {
    return res.status(400).json({
      success: false,
      whatsappStatus: 'failed',
      error: 'تفاصيل الإشعار غير مكتملة (event is required).'
    });
  }

  // Security: Only allow specific events to be triggered by customers
  // Others (like LOW_STOCK) are implicitly allowed if we trust the fireStoreEvent caller, 
  // but let's be strict: Customers can only trigger events related to THEIR OWN actions (Orders).
  const adminEmails = ['atito4031@gmail.com', 'musicusabest@gmail.com'];
  const isAdmin = user?.email && adminEmails.includes(user.email.toLowerCase());
  
  const allowedCustomerEvents = ['NEW_ORDER', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'COUPON_USED', 'NEW_CUSTOMER'];
  
  if (!isAdmin && !allowedCustomerEvents.includes(event.eventType)) {
    return res.status(403).json({ error: 'Forbidden: You are not authorized to trigger this event type.' });
  }
  
  // For customer events, verify they are only triggering for themselves
  if (!isAdmin && event.payload?.customerUid && event.payload.customerUid !== user.uid) {
     return res.status(403).json({ error: 'Forbidden: You can only trigger notifications for your own account.' });
  }

  if (!event || !event.title) {
    return res.status(400).json({
      success: false,
      whatsappStatus: 'failed',
      error: 'تفاصيل الإشعار غير مكتملة (event is required).'
    });
  }

  // Check if WhatsApp API is configured in server environment variables
  if (!token || !token.trim() || (!phoneNumberId && !customUrl)) {
    console.warn('WhatsApp notification skipped: WHATSAPP_API_TOKEN is not configured in server environment.');
    return res.json({
      success: false,
      whatsappStatus: 'not_configured',
      message: 'WhatsApp API غير مُكوّن. لإرسال الرسائل يرجى إضافة WHATSAPP_API_TOKEN و WHATSAPP_PHONE_NUMBER_ID في متغيرات البيئة.'
    });
  }

  const targetPhone = recipientPhone || event.recipientPhone;
  if (!targetPhone) {
    return res.json({
      success: false,
      whatsappStatus: 'failed',
      error: 'لم يتم تحديد رقم واتساب المستلم.'
    });
  }

  try {
    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
    const textBody = `*[متجر ${event.storeName || 'المتجر'}] ${event.title}*\n\n${event.message}\n\n📌 التاريخ: ${new Date(event.createdAt || Date.now()).toLocaleString('ar-EG')}`;

    const endpointUrl = customUrl || `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const payload = customUrl ? {
      phone: cleanPhone,
      message: textBody,
      event: event.eventType,
      relatedId: event.relatedId
    } : {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { preview_url: false, body: textBody }
    };

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json().catch(() => ({}));

    if (response.ok && !responseData.error) {
      return res.json({
        success: true,
        whatsappStatus: 'sent',
        messageId: responseData.messages?.[0]?.id || responseData.id || 'sent_ok'
      });
    } else {
      const errorMsg = responseData.error?.message || responseData.message || `HTTP ${response.status} Error`;
      console.error('WhatsApp Provider Error:', errorMsg);
      return res.json({
        success: false,
        whatsappStatus: 'failed',
        error: errorMsg
      });
    }
  } catch (err: any) {
    console.error('WhatsApp API execution failure:', err);
    return res.json({
      success: false,
      whatsappStatus: 'failed',
      error: err?.message || 'تعذر الاتصال بمزود خدمة واتساب'
    });
  }
});


// 5. Checkout Endpoint (Secure Server-Side Order Processing)
app.post('/api/orders/checkout', authenticateOptional, async (req: any, res: any) => {
  const { items, couponCode, shippingAddress, customerName, customerPhone, customerEmail, customerNotes, paymentMethod } = req.body;
  const user = (req as any).user;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'السلة فارغة' });
  }

  if (!customerName || !customerPhone || !shippingAddress) {
     return res.status(400).json({ error: 'يرجى إكمال بيانات الشحن (الاسم، الهاتف، العنوان)' });
  }

  try {
    const clientDb = getFirestoreInstance();
    const timestamp = FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();

    // 1. Authoritative Recalculation & Validation
    const validatedItems: any[] = [];
    let subtotal = 0;

    for (const item of items) {
      const prodRef = clientDb.collection('products').doc(item.productId);
      const prodSnap = await prodRef.get();
      if (!prodSnap.exists) throw new Error(`المنتج ${item.productId} غير موجود`);
      
      const prodData = prodSnap.data()!;
      const price = Number(prodData.price) || 0;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      
      validatedItems.push({
        productId: item.productId,
        productName: prodData.name,
        productImage: prodData.mainImageUrl || '',
        priceAtPurchase: price,
        quantity: qty,
        lineTotal: price * qty
      });
      subtotal += price * qty;
    }

    // 2. Coupon Validation (Authoritative)
    let discount = 0;
    let validatedCouponCode = '';
    if (couponCode) {
      const cleanCode = couponCode.trim().toUpperCase();
      const couponRef = clientDb.collection('coupons').doc(cleanCode);
      const couponSnap = await couponRef.get();
      
      if (couponSnap.exists) {
        const c = couponSnap.data()!;
        const now = new Date();
        const startAt = c.startAt ? new Date(c.startAt) : null;
        const expiresAt = c.expiresAt ? new Date(c.expiresAt) : null;
        
        const isValid = c.active && 
          (!startAt || now >= startAt) && 
          (!expiresAt || now <= expiresAt) &&
          (c.usageLimit === undefined || (c.usedCount || 0) < c.usageLimit) &&
          (c.minimumOrder === undefined || subtotal >= c.minimumOrder);

        if (isValid) {
          if (c.type === 'percentage') {
            discount = (subtotal * c.value) / 100;
            if (c.maximumDiscount !== undefined && discount > c.maximumDiscount) discount = c.maximumDiscount;
          } else {
            discount = Math.min(subtotal, c.value);
          }
          validatedCouponCode = cleanCode;
          
          // Increment coupon usedCount
          await couponRef.update({
             usedCount: FieldValue.increment(1),
             updatedAt: nowIso
          });
        }
      }
    }

    const shippingCost = subtotal >= 3000 ? 0 : 50;
    const total = Math.max(0, subtotal - discount + shippingCost);

    // 3. Transactional Stock Deduction & Order Creation
    const orderId = clientDb.collection('orders').doc().id;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    await clientDb.runTransaction(async (transaction) => {
      // Re-verify stock in transaction
      for (const item of validatedItems) {
        const prodRef = clientDb.collection('products').doc(item.productId);
        const pSnap = await transaction.get(prodRef);
        const pData = pSnap.data();
        if (!pData) throw new Error(`المنتج ${item.productId} غير موجود`);
        const currentStock = pData.stockQuantity || 0;
        
        if (currentStock < item.quantity) {
          throw new Error(`الكمية المطلوبة من ${pData.name} غير متوفرة. المتاح: ${currentStock}`);
        }
        
        transaction.update(prodRef, {
          stockQuantity: currentStock - item.quantity,
          updatedAt: timestamp
        });

        // Log inventory
        const logRef = clientDb.collection('inventory_logs').doc();
        transaction.set(logRef, {
          productId: item.productId,
          productName: item.productName,
          change: -item.quantity,
          previousStock: currentStock,
          newStock: currentStock - item.quantity,
          reason: 'order_created',
          referenceId: orderId,
          adjustedBy: `customer:${user?.uid || 'guest'}`,
          timestamp: nowIso
        });
      }

      // Create Order
      const orderRef = clientDb.collection('orders').doc(orderId);
      transaction.set(orderRef, {
        id: orderId,
        invoiceId: `inv_${orderId}`,
        invoiceNumber,
        invoiceStatus: 'issued',
        invoiceCreatedAt: nowIso,
        customerUid: user?.uid || 'guest',
        customerName: (customerName || user?.name || 'عميل').slice(0, 100),
        customerEmail: customerEmail || user?.email || '',
        customerPhone: (customerPhone || '').slice(0, 30),
        shippingAddress: (shippingAddress || '').slice(0, 500),
        customerNotes: (customerNotes || '').slice(0, 500),
        items: validatedItems,
        subtotal,
        discount,
        shippingCost,
        total,
        couponCode: validatedCouponCode,
        orderStatus: 'new',
        paymentMethod: paymentMethod || 'cash_on_delivery',
        paymentStatus: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso
      });
    });

    res.json({ success: true, orderId, invoiceNumber });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message || 'فشل إتمام الطلب' });
  }
});

// Error handler for API routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api/')) {
    console.error('API Error:', err);
    return res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      success: false
    });
  }
  next(err);
});

async function startServer() {
  console.log('[Server] Starting server...');
  console.log('[Server] NODE_ENV:', process.env.NODE_ENV);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Initializing Vite in middleware mode...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa'
    });
    console.log('[Server] Vite initialized.');
    
    // Inject OG tags even in dev mode if possible (though scrapers won't hit dev)
    app.use(async (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }
      if (
        req.path.startsWith('/api/') || 
        req.path.includes('.') || 
        req.path.startsWith('/@vite') || 
        req.path.startsWith('/@react-refresh') || 
        req.path.startsWith('/node_modules/') || 
        req.path.startsWith('/src/')
      ) {
        return next();
      }
      if (!req.headers.accept?.includes('text/html')) {
        return next();
      }
      
      try {
        let template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.url, template);
        
        const metadata = await getMetadataForPath(req.path, req);
        const html = injectMetadata(template, metadata, req);
        const statusCode = metadata.is404 ? 404 : 200;
        res.status(statusCode).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { 
      index: false,
      maxAge: '7d', // Cache assets for 7 days
      immutable: true,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      }
    }));
    
    app.get('*', async (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }
      if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
      }
      if (!req.headers.accept?.includes('text/html')) {
        return next();
      }

      try {
        const template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const metadata = await getMetadataForPath(req.path, req);
        const html = injectMetadata(template, metadata, req);
        const statusCode = metadata.is404 ? 404 : 200;
        res.status(statusCode).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        res.status(500).end('Internal Server Error');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

interface ServerProduct {
  id: string;
  name: string;
  slug?: string;
  price: number;
  oldPrice?: number | null;
  description?: string;
  mainImageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  isAvailable?: boolean;
  stockQuantity?: number;
  stockStatus?: string;
}

let serverProductsCache: ServerProduct[] = [];
let serverProductsCacheTime = 0;
let serverPromosCache: any[] = [];
let serverPromosCacheTime = 0;
let serverCategoriesCache: any[] = [];
let serverCategoriesCacheTime = 0;
let serverSettingsCache: any = null;
let serverSettingsCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function normalizeSlugServer(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProductCanonicalSlugServer(product: { name: string; slug?: string; id?: string }): string {
  if (!product) return '';
  if (product.slug) {
    const trimmed = product.slug.trim();
    const stripped = trimmed.replace(/-\d{3,6}$/, '');
    if (stripped && stripped.length > 2) {
      return normalizeSlugServer(stripped);
    }
    return normalizeSlugServer(trimmed);
  }
  if (product.name) {
    const fromName = normalizeSlugServer(product.name);
    if (fromName) return fromName;
  }
  return product.id || '';
}

function getCategoryCanonicalSlugServer(category: { name: string; slug?: string; id?: string }): string {
  if (!category) return '';
  if (category.slug) return normalizeSlugServer(category.slug);
  if (category.name) return normalizeSlugServer(category.name);
  return category.id || '';
}

async function getServerStoreSettings(): Promise<any> {
  const now = Date.now();
  if (serverSettingsCache && now - serverSettingsCacheTime < CACHE_TTL_MS) {
    return serverSettingsCache;
  }
  try {
    const firestore = getFirestoreInstance();
    const docSnap = await firestore.collection('settings').doc('store').get();
    if (docSnap.exists) {
      serverSettingsCache = docSnap.data();
      serverSettingsCacheTime = now;
      return serverSettingsCache;
    }
  } catch {
    // ignore
  }
  return null;
}

async function getServerProducts(): Promise<ServerProduct[]> {
  const now = Date.now();
  if (serverProductsCache.length > 0 && now - serverProductsCacheTime < CACHE_TTL_MS) {
    return serverProductsCache;
  }
  try {
    const firestore = getFirestoreInstance();
    const snap = await firestore.collection('products').where('isPublished', '==', true).get();
    const list: ServerProduct[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        name: data.name || '',
        slug: data.slug || '',
        price: Number(data.price) || 0,
        oldPrice: data.oldPrice ? Number(data.oldPrice) : null,
        description: data.description || '',
        mainImageUrl: data.mainImageUrl || '',
        categoryId: data.categoryId || '',
        categoryName: data.categoryName || '',
        isAvailable: data.isAvailable !== false,
        stockQuantity: typeof data.stockQuantity === 'number' ? data.stockQuantity : 10,
        stockStatus: data.stockStatus || 'in_stock'
      });
    });
    serverProductsCache = list;
    serverProductsCacheTime = now;
    return list;
  } catch (err) {
    console.error('[Server SEO] Error fetching products:', err);
    return serverProductsCache;
  }
}

async function getServerPromotions(): Promise<any[]> {
  const now = Date.now();
  if (serverPromosCache.length > 0 && now - serverPromosCacheTime < CACHE_TTL_MS) {
    return serverPromosCache;
  }
  try {
    const firestore = getFirestoreInstance();
    const snap = await firestore.collection('promotions').get();
    const list: any[] = [];
    const nowDate = new Date();
    snap.forEach((d) => {
      const data = d.data();
      if (data.isActive) {
        const s = new Date(data.startDate);
        const e = new Date(data.endDate);
        if (nowDate >= s && nowDate <= e) {
          list.push({ id: d.id, ...data });
        }
      }
    });
    serverPromosCache = list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    serverPromosCacheTime = now;
    return serverPromosCache;
  } catch {
    return serverPromosCache;
  }
}

async function getServerCategories(): Promise<any[]> {
  const now = Date.now();
  if (serverCategoriesCache.length > 0 && now - serverCategoriesCacheTime < CACHE_TTL_MS) {
    return serverCategoriesCache;
  }
  try {
    const firestore = getFirestoreInstance();
    const snap = await firestore.collection('categories').get();
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    serverCategoriesCache = list;
    serverCategoriesCacheTime = now;
    return list;
  } catch {
    return serverCategoriesCache;
  }
}

function computeServerEffectivePrice(product: ServerProduct, promotions: any[]): { price: number; isCampaignActive: boolean } {
  const basePrice = product.price || 0;
  for (const promo of promotions) {
    const matchProd = Array.isArray(promo.productIds) && promo.productIds.includes(product.id);
    const matchCat = Array.isArray(promo.categoryIds) && promo.categoryIds.includes(product.categoryId);
    if (matchProd || matchCat) {
      if (promo.discountType === 'fixed_price' && typeof promo.promotionPrice === 'number') {
        return { price: Math.min(basePrice, promo.promotionPrice), isCampaignActive: true };
      } else if (promo.discountType === 'percentage' && typeof promo.discountPercent === 'number') {
        return { price: Math.max(0, Math.round(basePrice * (1 - promo.discountPercent / 100))), isCampaignActive: true };
      } else if (promo.discountType === 'fixed_discount' && typeof promo.discountAmount === 'number') {
        return { price: Math.max(0, basePrice - promo.discountAmount), isCampaignActive: true };
      }
    }
  }
  return { price: basePrice, isCampaignActive: false };
}

function findProductBySlug(products: ServerProduct[], target: string): ServerProduct | null {
  const raw = target.trim();
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  const targetNormalized = normalizeSlugServer(decoded);

  // 1. Exact slug or id match
  let found = products.find(p => p.slug === raw || p.slug === decoded || p.id === raw || p.id === decoded);
  if (found) return found;

  // 2. Canonical slug match or name match
  found = products.find(p => {
    const pCanonical = getProductCanonicalSlugServer(p);
    return pCanonical === targetNormalized || normalizeSlugServer(p.name) === targetNormalized;
  });
  if (found) return found;

  // 3. Prefix stripped match (without -1234 suffix)
  found = products.find(p => {
    if (!p.slug) return false;
    const base = normalizeSlugServer(p.slug.replace(/-\d{3,6}$/, ''));
    return base === targetNormalized;
  });
  return found || null;
}

function findCategoryBySlug(categories: any[], target: string): any | null {
  const raw = target.trim();
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  const targetNormalized = normalizeSlugServer(decoded);

  let found = categories.find(c => c.slug === raw || c.slug === decoded || c.id === raw || c.id === decoded);
  if (found) return found;

  found = categories.find(c => {
    const cCanonical = getCategoryCanonicalSlugServer(c);
    return cCanonical === targetNormalized || normalizeSlugServer(c.name) === targetNormalized;
  });
  return found || null;
}

async function getMetadataForPath(pathname: string, req?: any) {
  const host = req?.get('host') || 'localhost:3000';
  const protocol = req?.protocol || 'https';
  const storeSettings = await getServerStoreSettings();
  const storeName = storeSettings?.storeName || 'متجر البيت السعيد 1981';

  const defaultMeta = {
    title: storeName,
    description: 'قسط كل اللي نفسك فيه مع متجر البيت السعيد 1981 - منتجات الهواتف والإلكترونيات بأفضل الأسعار وبأعلى جودة.',
    image: '/logo-square.svg',
    canonical: `${protocol}://${host}/`,
    url: `${protocol}://${host}${pathname}`,
    type: 'website',
    is404: false
  };

  try {
    // 1. Product Detail Page: /product/:slug
    if (pathname.startsWith('/product/')) {
      const slug = pathname.replace('/product/', '');
      const products = await getServerProducts();
      const prod = findProductBySlug(products, slug);

      if (prod) {
        const promotions = await getServerPromotions();
        const { price: effectivePrice } = computeServerEffectivePrice(prod, promotions);
        const canonicalSlug = getProductCanonicalSlugServer(prod);
        const canonicalUrl = `${protocol}://${host}/product/${canonicalSlug}`;
        const availability = prod.isAvailable && prod.stockStatus !== 'out_of_stock' && prod.stockStatus !== 'coming_soon'
          ? 'in stock'
          : 'out of stock';

        const rawDesc = prod.description ? prod.description.replace(/\s+/g, ' ').trim() : '';
        const description = rawDesc ? rawDesc.slice(0, 160) : `${prod.name} متوفر الآن لدى ${storeName}. احصل على أفضل العروض والتقسيط المريح.`;

        return {
          title: `${prod.name} | ${storeName}`,
          description,
          image: prod.mainImageUrl || defaultMeta.image,
          canonical: canonicalUrl,
          url: canonicalUrl,
          type: 'product',
          price: effectivePrice,
          currency: 'EGP',
          availability,
          is404: false
        };
      } else {
        // Missing / Non-existent product
        return {
          title: `المنتج غير موجود | ${storeName}`,
          description: 'عذراً، المنتج الذي تبحث عنه غير متوفر حالياً أو تم حذفه من المعرض.',
          image: defaultMeta.image,
          canonical: `${protocol}://${host}${pathname}`,
          url: `${protocol}://${host}${pathname}`,
          type: 'website',
          is404: true
        };
      }
    }

    // 2. Category Detail Page: /category/:slug or /categories/:id
    if (pathname.startsWith('/category/') || pathname.startsWith('/categories/')) {
      const isSub = pathname.startsWith('/category/') ? '/category/' : '/categories/';
      const slug = pathname.replace(isSub, '');
      
      if (slug && slug !== 'all') {
        const categories = await getServerCategories();
        const cat = findCategoryBySlug(categories, slug);

        if (cat) {
          const canonicalSlug = getCategoryCanonicalSlugServer(cat);
          const canonicalUrl = `${protocol}://${host}/category/${canonicalSlug}`;
          const rawDesc = cat.description ? cat.description.replace(/\s+/g, ' ').trim() : '';
          const description = rawDesc ? rawDesc.slice(0, 160) : `تصفح قسم ${cat.name} لدى ${storeName} بأفضل الأسعار وأحدث الموديلات.`;

          return {
            title: `${cat.name} | ${storeName}`,
            description,
            image: cat.image || defaultMeta.image,
            canonical: canonicalUrl,
            url: canonicalUrl,
            type: 'website',
            is404: false
          };
        } else {
          return {
            title: `القسم غير موجود | ${storeName}`,
            description: 'عذراً، القسم الذي تحاول الوصول إليه غير متوفر أو تم نقله.',
            image: defaultMeta.image,
            canonical: `${protocol}://${host}${pathname}`,
            url: `${protocol}://${host}${pathname}`,
            type: 'website',
            is404: true
          };
        }
      }
    }

    // 3. Products Catalog Page: /products
    if (pathname === '/products') {
      return {
        title: `معرض المنتجات | ${storeName}`,
        description: `تصفح كامل تشكيلة المنتجات والأجهزة المتاحة لدى ${storeName}. عروض خاصة وخطط تقسيط ميسرة.`,
        image: defaultMeta.image,
        canonical: `${protocol}://${host}/products`,
        url: `${protocol}://${host}/products`,
        type: 'website',
        is404: false
      };
    }

    // 4. Categories Overview Page: /categories
    if (pathname === '/categories') {
      return {
        title: `أقسام المتجر | ${storeName}`,
        description: `استكشف جميع أقسام وتصنيفات ${storeName}: هواتف، أجهزة منزلية، حقائب، هدايا وإلكترونيات.`,
        image: defaultMeta.image,
        canonical: `${protocol}://${host}/categories`,
        url: `${protocol}://${host}/categories`,
        type: 'website',
        is404: false
      };
    }
  } catch (e) {
    console.error('[Server SEO] Path Metadata Fetch Error:', e);
  }

  return defaultMeta;
}

function injectMetadata(html: string, meta: any, req: any) {
  const protocol = req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  const fullUrl = meta.url || `${protocol}://${host}${req.originalUrl}`;
  const canonicalUrl = meta.canonical || fullUrl.split('?')[0];
  const imageUrl = (meta.image?.startsWith('http') || meta.image?.startsWith('data:'))
    ? meta.image
    : `${protocol}://${host}${meta.image?.startsWith('/') ? '' : '/'}${meta.image || 'logo-square.svg'}`;
  const robots = meta.is404 ? 'noindex, nofollow' : 'index, follow';

  let extraMeta = '';
  if (meta.type === 'product' && typeof meta.price === 'number') {
    extraMeta += `<meta property="product:price:amount" content="${meta.price}" />\n`;
    extraMeta += `<meta property="product:price:currency" content="${meta.currency || 'EGP'}" />\n`;
    extraMeta += `<meta property="og:price:amount" content="${meta.price}" />\n`;
    extraMeta += `<meta property="og:price:currency" content="${meta.currency || 'EGP'}" />\n`;
    extraMeta += `<meta property="product:availability" content="${meta.availability || 'in stock'}" />\n`;
    
    // Server-side JSON-LD structured data
    const schemaObj = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: meta.title.replace(/ \| .*$/, ''),
      image: [imageUrl],
      description: meta.description,
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        priceCurrency: meta.currency || 'EGP',
        price: meta.price,
        availability: meta.availability === 'out of stock' 
          ? 'https://schema.org/OutOfStock' 
          : 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition'
      }
    };
    extraMeta += `<script type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>\n`;
  }

  return html
    .replace(/__TITLE__/g, meta.title)
    .replace(/__DESCRIPTION__/g, meta.description)
    .replace(/__IMAGE__/g, imageUrl)
    .replace(/__CANONICAL__/g, canonicalUrl)
    .replace(/__URL__/g, fullUrl)
    .replace(/__TYPE__/g, meta.type || 'website')
    .replace(/__ROBOTS__/g, robots)
    .replace(/<!-- __EXTRA_META__ -->|__EXTRA_META__/g, extraMeta);
}

startServer();
