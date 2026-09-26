import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin, verifyFirebaseUser, sanitizeForFirestoreServer } from './src/lib/firebaseAdmin';
import { DEFAULT_INSURANCE_POLICIES } from './src/lib/insurance/insuranceEngine';

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
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ============================================================================
// CONSTANTS & LAST-KNOWN-GOOD CACHES FOR STATIC SEO / HEALTH ENDPOINTS
// Completely independent of Firebase, Firestore, Supabase, cache warmup or SSR
// ============================================================================
const STATIC_ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /invoice/*
Disallow: /profile
Disallow: /favorites
Disallow: /checkout
Disallow: /order-confirmation

Sitemap: https://happyhome1981.onrender.com/sitemap.xml`;

const FALLBACK_MINIMAL_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://happyhome1981.onrender.com/</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>https://happyhome1981.onrender.com/products</loc>
    <priority>0.9</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>https://happyhome1981.onrender.com/categories</loc>
    <priority>0.8</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>https://happyhome1981.onrender.com/about</loc>
    <priority>0.5</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>https://happyhome1981.onrender.com/contact</loc>
    <priority>0.5</priority>
    <changefreq>daily</changefreq>
  </url>
</urlset>`;

let lastKnownGoodSitemapXml: string = FALLBACK_MINIMAL_SITEMAP;
let lastKnownGoodSitemapTime = 0;
const SITEMAP_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let isSitemapGenerating = false;

// ============================================================================
// 2. HEALTH ENDPOINT (Ultra-fast, completely independent from Firebase)
// ============================================================================
app.get('/health', (req, res) => {
  res.status(200)
     .setHeader('Content-Type', 'application/json; charset=utf-8')
     .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
     .json({ ok: true });
});

// ============================================================================
// 3. ROBOTS.TXT (Static, deterministic, instant response for Googlebot)
// ============================================================================
app.get('/robots.txt', (req, res) => {
  res.status(200)
     .setHeader('Content-Type', 'text/plain; charset=utf-8')
     .setHeader('Cache-Control', 'public, max-age=86400')
     .setHeader('X-Content-Type-Options', 'nosniff')
     .send(STATIC_ROBOTS_TXT);
});

// ============================================================================
// 4. SITEMAP.XML (Always returns valid XML 200, never blocks or fails on cold start)
// ============================================================================
app.get('/sitemap.xml', async (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const now = Date.now();
  // Return cached sitemap if still fresh
  if (lastKnownGoodSitemapTime > 0 && (now - lastKnownGoodSitemapTime < SITEMAP_CACHE_TTL_MS)) {
    return res.status(200).send(lastKnownGoodSitemapXml);
  }

  // If already generating concurrently, return last known good immediately to prevent cold-start bottlenecks
  if (isSitemapGenerating) {
    return res.status(200).send(lastKnownGoodSitemapXml);
  }

  const host = req.get('host') || '';
  const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1');
  const baseUrl = isLocal 
    ? 'https://happyhome1981.onrender.com'
    : `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${host}`;

  try {
    isSitemapGenerating = true;
    
    // Strict 2.5 second timeout so sitemap NEVER stalls or hangs on Firestore cold start
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Sitemap database fetch timeout')), 2500)
    );

    const fetchPromise = Promise.all([
      getServerProducts().catch(() => []),
      getServerCategories().catch(() => [])
    ]);

    const [products, categories] = await Promise.race([fetchPromise, timeoutPromise]);

    const urls = [
      { loc: `${baseUrl}/`, priority: '1.0' },
      { loc: `${baseUrl}/products`, priority: '0.9' },
      { loc: `${baseUrl}/categories`, priority: '0.8' },
      { loc: `${baseUrl}/about`, priority: '0.5' },
      { loc: `${baseUrl}/contact`, priority: '0.5' }
    ];

    if (Array.isArray(products)) {
      products.forEach(p => {
        const slug = getProductCanonicalSlugServer(p);
        if (slug) urls.push({ loc: `${baseUrl}/product/${slug}`, priority: '0.7' });
      });
    }

    if (Array.isArray(categories)) {
      categories.forEach(c => {
        const slug = getCategoryCanonicalSlugServer(c);
        if (slug) urls.push({ loc: `${baseUrl}/category/${slug}`, priority: '0.6' });
      });
    }

    const generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>daily</changefreq>
  </url>`).join('\n')}
</urlset>`;

    if (generatedXml.includes('<urlset')) {
      lastKnownGoodSitemapXml = generatedXml;
      lastKnownGoodSitemapTime = now;
      return res.status(200).send(generatedXml);
    }
  } catch (err) {
    console.warn('[Sitemap] Database fetch unavailable or timed out. Serving last-known-good sitemap:', err);
  } finally {
    isSitemapGenerating = false;
  }

  // Always return 200 with last-known-good sitemap (or minimal valid sitemap)
  return res.status(200).send(lastKnownGoodSitemapXml);
});

// ============================================================================
// 5. GOOGLE VERIFICATION FILES (Zero external dependencies, always returns 200)
// ============================================================================
app.get('/googlec2b5e575b2168828.html', (req, res) => {
  res.status(200)
     .setHeader('Content-Type', 'text/html; charset=utf-8')
     .send('google-site-verification: googlec2b5e575b2168828.html');
});

app.get('/google:id([a-zA-Z0-9]+).html', (req, res) => {
  res.status(200)
     .setHeader('Content-Type', 'text/html; charset=utf-8')
     .send(`google-site-verification: google${req.params.id}.html`);
});

// ============================================================================
// 6. BODY PARSING & API / APPLICATION MIDDLEWARE
// ============================================================================

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
      'storeSettings',
      'homepageBanners',
      'limitedOffers',
      'comingSoon',
      'newsTicker',
      'users'
    ];

    let isReferenced = false;

    // We check sequentially to avoid overloading, but limit the search
    for (const colName of collectionsToCheck) {
      if (isReferenced) break;

      if (colName === 'storeSettings') {
        const docRef = db.collection('storeSettings').doc('main');
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
                            colName === 'homepageBanners' ? ['desktopImageUrl', 'mobileImageUrl'] :
                            colName === 'limitedOffers' ? ['productImage'] :
                            colName === 'comingSoon' ? ['image'] :
                            colName === 'newsTicker' ? ['icon'] : [];

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
  const { items, couponCode, shippingAddress, customerName, customerPhone, customerEmail, customerNotes, paymentMethod, selectedInsurance } = req.body;
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
    const insuranceAmount = (selectedInsurance && !selectedInsurance.isFree && typeof selectedInsurance.insurancePrice === 'number')
      ? Math.max(0, selectedInsurance.insurancePrice)
      : 0;
    const total = Math.max(0, subtotal - discount + shippingCost + insuranceAmount);

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
        ...(selectedInsurance ? { selectedInsurance } : {}),
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


// ==========================================
// CACHE & BACKGROUND SYNC
// ==========================================

// ==========================================
const CACHE_TTL_GENERAL = 10 * 60 * 1000; // 10 minutes
const CACHE_TTL_PRODUCTS = 15 * 60 * 1000; // 15 minutes
const CACHE_TTL_SETTINGS = 30 * 60 * 1000; // 30 minutes

// Global Firestore Cooldown state
let firebaseCooldownUntil = 0;
const COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: any;
  timestamp: number;
  lastKnownGood: any;
  hasValidLkg: boolean;
}

const memoryCache: Record<string, CacheEntry> = {
  products: { data: null, timestamp: 0, lastKnownGood: null, hasValidLkg: false },
  categories: { data: null, timestamp: 0, lastKnownGood: null, hasValidLkg: false },
  settings: { data: null, timestamp: 0, lastKnownGood: null, hasValidLkg: false },
  banners: { data: null, timestamp: 0, lastKnownGood: null, hasValidLkg: false },
  offers: { data: null, timestamp: 0, lastKnownGood: null, hasValidLkg: false },
  comingSoon: { data: null, timestamp: 0, lastKnownGood: null, hasValidLkg: false },
  insurancePolicies: { data: null, timestamp: 0, lastKnownGood: null, hasValidLkg: false }
};

// Request Deduplication
const pendingRequests = new Map<string, Promise<any>>();

interface CacheResult {
  success: boolean;
  data: any;
  fromCache?: boolean;
  fromLkg?: boolean;
  error?: string;
}

async function fetchWithCache(key: string, ttl: number, collectionName: string): Promise<CacheResult> {
  const now = Date.now();
  const entry = memoryCache[key];
  const inCooldown = now < firebaseCooldownUntil;

  // 1. Return fresh in-memory cache if valid
  if (entry.data && (now - entry.timestamp < ttl)) {
    return { success: true, data: entry.data, fromCache: true };
  }

  // 2. Return Last-Known-Good if in cooldown and LKG is genuinely populated
  if (inCooldown && entry.hasValidLkg && entry.lastKnownGood !== null) {
    console.warn(`[Cache] Firestore in cooldown. Serving genuine LKG for ${key}`);
    return { success: true, data: entry.lastKnownGood, fromLkg: true };
  }

  // 3. Deduplicate concurrent requests
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const fetchPromise = (async (): Promise<CacheResult> => {
    try {
      console.log(`[Cache] Refreshing ${collectionName} from Firestore (Admin SDK)...`);
      const { db: adminDb } = getFirebaseAdmin();
      let queryRef: any = adminDb.collection(collectionName);
      if (collectionName === 'products') {
        queryRef = queryRef.where('isPublished', '==', true);
      } else if (collectionName === 'categories') {
        queryRef = queryRef.where('visibility', '==', true);
      } else if (collectionName === 'insurancePolicies') {
        queryRef = queryRef.where('active', '==', true);
      }
      
      const snap = await queryRef.get();
      const list: any[] = [];
      snap.forEach((d: any) => {
        list.push({ id: d.id, ...(d.data() || {}) });
      });

      // If insurancePolicies is completely empty in Firestore, seed initial default policies safely
      if (collectionName === 'insurancePolicies' && list.length === 0) {
        const anySnap = await adminDb.collection('insurancePolicies').limit(1).get();
        if (anySnap.empty) {
          console.log('[Cache] Seeding initial default insurance policies into Firestore...');
          const batch = adminDb.batch();
          for (const defaultPolicy of DEFAULT_INSURANCE_POLICIES) {
            const docRef = adminDb.collection('insurancePolicies').doc(defaultPolicy.id);
            batch.set(docRef, sanitizeForFirestoreServer({
              ...defaultPolicy,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }));
          }
          await batch.commit();

          const seededSnap = await adminDb.collection('insurancePolicies').where('active', '==', true).get();
          seededSnap.forEach((d: any) => {
            list.push({ id: d.id, ...(d.data() || {}) });
          });
        }
      }
      
      // Cache ONLY populated from successful Firestore read!
      entry.data = list;
      entry.lastKnownGood = list;
      entry.hasValidLkg = true;
      entry.timestamp = Date.now();
      return { success: true, data: list, fromCache: false };
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`[Cache] Error fetching ${collectionName}:`, msg);
      
      // Quota Protection
      if (msg.includes('usage limits') || msg.includes('Quota exceeded') || msg.includes('Resource exhausted')) {
        console.error('!!! FIRESTORE QUOTA EXCEEDED !!! Entering cooldown.');
        firebaseCooldownUntil = Date.now() + COOLDOWN_DURATION;
      }

      // If we have a previously confirmed Last Known Good dataset from a successful read:
      if (entry.hasValidLkg && entry.lastKnownGood !== null) {
        console.warn(`[Cache] Serving previously confirmed Last Known Good dataset for ${key}`);
        return { success: true, data: entry.lastKnownGood, fromLkg: true };
      }

      // DO NOT overwrite LKG with [] or pretend empty dataset
      // DO NOT fabricate fallback data
      return { success: false, data: null, error: msg };
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, fetchPromise);
  return fetchPromise;
}

// 1. Settings (Single document with LKG)
app.get('/api/cache/settings', async (req, res) => {
  res.set('Content-Type', 'application/json');
  const now = Date.now();
  const entry = memoryCache.settings;
  const inCooldown = now < firebaseCooldownUntil;

  if (entry.data && (now - entry.timestamp < CACHE_TTL_SETTINGS)) {
    return res.json(entry.data);
  }

  if (inCooldown && entry.hasValidLkg && entry.lastKnownGood !== null) {
    return res.json(entry.lastKnownGood);
  }

  if (pendingRequests.has('settings')) {
    const result = await pendingRequests.get('settings');
    if (result.success && result.data !== null) {
      return res.json(result.data);
    }
    return res.status(503).json({
      ok: false,
      fallbackToClient: true,
      error: result.error || 'Settings cache unavailable'
    });
  }

  const fetchPromise = (async () => {
    try {
      const { db: adminDb } = getFirebaseAdmin();
      const snap = await adminDb.collection('storeSettings').doc('main').get();
      const data = snap.exists ? snap.data() : null;
      if (data) {
        entry.data = data;
        entry.lastKnownGood = data;
        entry.hasValidLkg = true;
        entry.timestamp = Date.now();
        return { success: true, data };
      }
      return { success: false, data: null, error: 'Settings document not found' };
    } catch (e: any) {
      console.error('[Cache] Settings fetch error:', e.message);
      if (e.message.includes('usage limits') || e.message.includes('Quota exceeded')) {
        firebaseCooldownUntil = Date.now() + COOLDOWN_DURATION;
      }
      if (entry.hasValidLkg && entry.lastKnownGood !== null) {
        return { success: true, data: entry.lastKnownGood, fromLkg: true };
      }
      return { success: false, data: null, error: e.message };
    } finally {
      pendingRequests.delete('settings');
    }
  })();

  pendingRequests.set('settings', fetchPromise);
  const result = await fetchPromise;
  if (result.success && result.data !== null) {
    return res.json(result.data);
  }
  return res.status(503).json({
    ok: false,
    fallbackToClient: true,
    error: result.error || 'Settings cache unavailable'
  });
});

// 2. Categories
app.get('/api/cache/categories', async (req, res) => {
  res.set('Content-Type', 'application/json');
  const result = await fetchWithCache('categories', CACHE_TTL_GENERAL, 'categories');
  if (result.success && result.data !== null) {
    return res.json(result.data);
  }
  return res.status(503).json({
    ok: false,
    fallbackToClient: true,
    error: result.error || 'Categories cache unavailable'
  });
});

// 3. Products
app.get('/api/cache/products', async (req, res) => {
  res.set('Content-Type', 'application/json');
  const result = await fetchWithCache('products', CACHE_TTL_PRODUCTS, 'products');
  if (result.success && result.data !== null) {
    return res.json(result.data);
  }
  return res.status(503).json({
    ok: false,
    fallbackToClient: true,
    error: result.error || 'Products cache unavailable'
  });
});

// 4. Banners (Supports both /api/cache/homepageBanners and /api/cache/banners)
const handleBannersCache = async (req: express.Request, res: express.Response) => {
  res.set('Content-Type', 'application/json');
  const result = await fetchWithCache('banners', CACHE_TTL_GENERAL, 'homepageBanners');
  if (result.success && result.data !== null) {
    return res.json(result.data);
  }
  return res.status(503).json({
    ok: false,
    fallbackToClient: true,
    error: result.error || 'Banners cache unavailable'
  });
};
app.get('/api/cache/homepageBanners', handleBannersCache);
app.get('/api/cache/banners', handleBannersCache);

// 5. Offers (Supports both /api/cache/limitedOffers and /api/cache/offers)
const handleOffersCache = async (req: express.Request, res: express.Response) => {
  res.set('Content-Type', 'application/json');
  const result = await fetchWithCache('offers', CACHE_TTL_GENERAL, 'limitedOffers');
  if (result.success && result.data !== null) {
    return res.json(result.data);
  }
  return res.status(503).json({
    ok: false,
    fallbackToClient: true,
    error: result.error || 'Offers cache unavailable'
  });
};
app.get('/api/cache/limitedOffers', handleOffersCache);
app.get('/api/cache/offers', handleOffersCache);

// 6. Coming Soon
app.get('/api/cache/comingSoon', async (req, res) => {
  res.set('Content-Type', 'application/json');
  const result = await fetchWithCache('comingSoon', CACHE_TTL_GENERAL, 'comingSoon');
  if (result.success && result.data !== null) {
    return res.json(result.data);
  }
  return res.status(503).json({
    ok: false,
    fallbackToClient: true,
    error: result.error || 'Coming soon cache unavailable'
  });
});

// 7. Insurance Policies (Supports both /api/cache/insurancePolicies and /api/cache/insurance)
const handleInsuranceCache = async (req: any, res: any) => {
  res.set('Content-Type', 'application/json');
  const result = await fetchWithCache('insurancePolicies', CACHE_TTL_GENERAL, 'insurancePolicies');
  if (result.success && result.data !== null) {
    return res.json(result.data);
  }
  return res.status(503).json({
    ok: false,
    fallbackToClient: true,
    error: result.error || 'Insurance policies cache unavailable'
  });
};
app.get('/api/cache/insurancePolicies', handleInsuranceCache);
app.get('/api/cache/insurance', handleInsuranceCache);

// 8. Clear Cache (Invalidate)
app.post('/api/cache/clear', async (req, res) => {
  res.set('Content-Type', 'application/json');
  const { type } = req.body || {};
  let target = type;
  if (type === 'homepageBanners') target = 'banners';
  if (type === 'limitedOffers') target = 'offers';
  if (type === 'insurance' || type === 'insurancePolicies') target = 'insurancePolicies';
  if (target && memoryCache[target]) {
    memoryCache[target].data = null;
    memoryCache[target].timestamp = 0;
  } else if (!type || type === 'all') {
    Object.keys(memoryCache).forEach(k => {
      memoryCache[k].data = null;
      memoryCache[k].timestamp = 0;
    });
  }
  res.json({ ok: true, success: true, cleared: type || 'all' });
});

// ==========================================
// STRICT API ROUTING GUARDS
// Absolute guarantee that NO /api/* route ever falls through to Vite SPA or returns HTML
app.all('/api/*', (req, res) => {
  res.status(404).set('Content-Type', 'application/json').json({
    ok: false,
    fallbackToClient: true,
    error: `API endpoint not found: ${req.method} ${req.path}`
  });
});

// Error handling middleware for API routes - ensures errors return JSON, never HTML
app.use('/api', (err: any, req: any, res: any, next: any) => {
  console.error('[API Error]', req.path, err);
  if (!res.headersSent) {
    res.status(500).set('Content-Type', 'application/json').json({
      ok: false,
      fallbackToClient: true,
      error: err?.message || 'Internal API Error'
    });
  }
});
// ==========================================

async function startServer() {
  console.log('[Server] Starting server...');
  console.log('[Server] Initial NODE_ENV:', process.env.NODE_ENV);

  // Automatically detect production if running from bundled cjs or dist directory
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    __filename.endsWith('.cjs') ||
    process.argv[1]?.includes('dist') ||
    !fs.existsSync(path.join(process.cwd(), 'vite.config.ts'));

  if (isProduction && process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV = 'production';
  }
  console.log('[Server] Operating Mode:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');

  // Vite middleware for development
  if (!isProduction) {
    console.log('[Server] Initializing Vite in middleware mode...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa'
    });
    console.log('[Server] Vite initialized.');
    
    // Inject OG tags even in dev mode if possible
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }
      if (
        req.path.startsWith('/api/') || 
        /\.[a-zA-Z0-9]{2,5}$/.test(req.path) ||
        req.path.startsWith('/@vite') || 
        req.path.startsWith('/@react-refresh') || 
        req.path.startsWith('/node_modules/') || 
        req.path.startsWith('/src/')
      ) {
        return next();
      }
      
      try {
        let template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.url, template);
        
        const metadata = await getMetadataForPath(req.path, req);
        const html = injectMetadata(template, metadata, req);
        const statusCode = (metadata?.is404 && (req.path.startsWith('/product/') || req.path.startsWith('/category/'))) ? 404 : 200;
        
        res.status(statusCode).setHeader('Content-Type', 'text/html; charset=utf-8');
        if (req.method === 'HEAD') {
          return res.end();
        }
        res.end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

    // Safeguard: Ensure no API request reaches Vite middleware or receives HTML fallback
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).set('Content-Type', 'application/json').json({
          ok: false,
          fallbackToClient: true,
          error: `API route not found: ${req.method} ${req.path}`
        });
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    // Locate the actual directory containing built frontend assets and index.html
    const candidateDistDirs = [
      path.join(process.cwd(), 'dist'),
      __dirname,
      path.join(__dirname, '..', 'dist'),
      path.resolve('.'),
      path.resolve('dist'),
    ];

    let distPath = path.join(process.cwd(), 'dist');
    for (const cand of candidateDistDirs) {
      if (fs.existsSync(path.join(cand, 'index.html'))) {
        distPath = cand;
        break;
      }
    }
    const indexHtmlPath = path.join(distPath, 'index.html');
    console.log(`[Server] Production distPath resolved to: ${distPath}`);
    console.log(`[Server] index.html exists: ${fs.existsSync(indexHtmlPath)} (${indexHtmlPath})`);

    // 1. Serve static assets (JS, CSS, images, SVGs, favicon, etc.)
    app.use(express.static(distPath, { 
      index: false, // SPA fallback handles all HTML document routes
      maxAge: '7d', // Cache immutable static assets for 7 days
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      }
    }));
    
    // 2. SPA Fallback: Serve index.html for all page routes:
    //    /, /products, /categories, /category/:slug, /product/:slug, /about, /contact, /admin, etc.
    app.get('*', async (req, res, next) => {
      // Only handle GET and HEAD requests
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      // Ignore API endpoints or missing asset requests with file extensions (e.g. .js, .css, .png)
      if (req.path.startsWith('/api/') || /\.[a-zA-Z0-9]{2,5}$/.test(req.path)) {
        return next();
      }

      let template = '';
      try {
        template = fs.readFileSync(indexHtmlPath, 'utf-8');
      } catch (readErr) {
        console.error('[Server] Failed to read dist/index.html:', readErr);
        try {
          template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        } catch {
          return res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send('<h1>500 - Frontend template not found</h1>');
        }
      }

      try {
        // Fast 1.5s timeout for metadata generation so page response is never blocked if DB is slow
        const metaPromise = getMetadataForPath(req.path, req);
        const timeoutPromise = new Promise<any>((resolve) => setTimeout(() => resolve(null), 1500));
        const metadata = await Promise.race([metaPromise, timeoutPromise]);

        let html = template;
        let statusCode = 200;

        if (metadata) {
          html = injectMetadata(template, metadata, req);
          // Only return 404 status if specifically requested for a confirmed missing single item
          if (metadata.is404 && (req.path.startsWith('/product/') || req.path.startsWith('/category/'))) {
            statusCode = 404;
          }
        }

        res.status(statusCode)
           .setHeader('Content-Type', 'text/html; charset=utf-8')
           .setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

        if (req.method === 'HEAD') {
          return res.end();
        }
        return res.send(html);
      } catch (err) {
        console.warn('[Server] Error during metadata injection, serving raw index.html:', err);
        res.status(200)
           .setHeader('Content-Type', 'text/html; charset=utf-8')
           .setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

        if (req.method === 'HEAD') {
          return res.end();
        }
        return res.send(template);
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
  if (memoryCache.settings.data && (now - memoryCache.settings.timestamp < CACHE_TTL_SETTINGS)) {
    return memoryCache.settings.data;
  }
  if (memoryCache.settings.hasValidLkg && memoryCache.settings.lastKnownGood !== null) {
    return memoryCache.settings.lastKnownGood;
  }
  try {
    const adminDb = getFirebaseAdmin().db;
    const snap = await adminDb.collection('storeSettings').doc('main').get();
    const data = snap.exists ? snap.data() : null;
    if (data) {
      memoryCache.settings.data = data;
      memoryCache.settings.lastKnownGood = data;
      memoryCache.settings.hasValidLkg = true;
      memoryCache.settings.timestamp = now;
    }
    return data;
  } catch (err: any) {
    console.error('[Server SEO] Error fetching storeSettings for SSR:', err?.message || err);
    return memoryCache.settings.lastKnownGood || null;
  }
}

async function getServerProducts(): Promise<ServerProduct[]> {
  const result = await fetchWithCache('products', CACHE_TTL_PRODUCTS, 'products');
  const products: any[] = (result.success && Array.isArray(result.data)) ? result.data : [];
  return products.map(data => ({
    id: data.id,
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
  }));
}

async function getServerPromotions(): Promise<any[]> {
  const result = await fetchWithCache('offers', CACHE_TTL_GENERAL, 'limitedOffers');
  const promotions: any[] = (result.success && Array.isArray(result.data)) ? result.data : [];
  const nowDate = new Date();
  const list: any[] = [];
  promotions.forEach(data => {
    if (data.isActive) {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      if (nowDate >= s && nowDate <= e) {
        list.push(data);
      }
    }
  });
  return list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

async function getServerCategories(): Promise<any[]> {
  const result = await fetchWithCache('categories', CACHE_TTL_GENERAL, 'categories');
  return (result.success && Array.isArray(result.data)) ? result.data : [];
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
        // If products list was completely empty due to backend connectivity/permission issue, DO NOT mark 404!
        if (products.length === 0) {
          console.warn(`[Server SEO] Products list is empty when resolving /product/${slug}. Serving 200 with fallback metadata.`);
          return {
            title: storeName,
            description: defaultMeta.description,
            image: defaultMeta.image,
            canonical: `${protocol}://${host}${pathname}`,
            url: `${protocol}://${host}${pathname}`,
            type: 'website',
            is404: false
          };
        }
        // Missing / Non-existent product only when catalog was confirmed loaded
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
          // If categories list was completely empty due to backend connectivity/permission issue, DO NOT mark 404!
          if (categories.length === 0) {
            console.warn(`[Server SEO] Categories list is empty when resolving /category/${slug}. Serving 200 with fallback metadata.`);
            return {
              title: storeName,
              description: defaultMeta.description,
              image: defaultMeta.image,
              canonical: `${protocol}://${host}${pathname}`,
              url: `${protocol}://${host}${pathname}`,
              type: 'website',
              is404: false
            };
          }
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
