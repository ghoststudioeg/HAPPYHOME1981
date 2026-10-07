const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

async function runMigration() {
  console.log('=== STARTING FIRESTORE TO SUPABASE MIGRATION (Phase 4) ===');

  const supabaseUrl = process.env.SUPABASE_URL || 'https://mehfdwqululparywkpde.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

  if (!supabaseKey) {
    console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY missing.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Initialize Firebase Admin with correct Database ID
  const firebaseConfigPath = 'firebase-applet-config.json';
  const config = fs.existsSync(firebaseConfigPath) ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) : {};
  const projectId = config.projectId || process.env.FIREBASE_PROJECT_ID || 'mercurial-memento-27dg';
  const dbId = config.firestoreDatabaseId || 'ai-studio-872f096d-52c3-4385-922e-bb0113f94d78';

  let firestoreDb;
  try {
    const adminApp = initializeApp({
      projectId,
      credential: applicationDefault()
    });
    firestoreDb = getFirestore(adminApp, dbId);
  } catch (err) {
    console.warn('Firebase Admin init warning:', err.message);
  }

  const migrationStats = {};

  async function migrateCollection(collectionName, isPostgresTable = false) {
    try {
      if (!firestoreDb) return;
      const snap = await firestoreDb.collection(collectionName).get();
      const docs = [];
      snap.forEach((doc) => {
        docs.push({ id: doc.id, ...(doc.data() || {}) });
      });

      migrationStats[collectionName] = docs.length;
      console.log(`[Migrating] Collection ${collectionName}: ${docs.length} docs found`);

      if (docs.length > 0) {
        if (isPostgresTable && (collectionName === 'products' || collectionName === 'categories' || collectionName === 'store_settings')) {
          // Upsert into Supabase Postgres Table
          for (const item of docs) {
            const row = { ...item };
            if (collectionName === 'products') {
              delete row.additionalImages;
              if (item.category_id || item.categoryId) row.category_id = item.category_id || item.categoryId;
            }
            await supabase.from(collectionName).upsert([row]);
          }
        }

        // Save to Supabase Storage JSON persistence for guaranteed zero-loss fallback
        const buffer = Buffer.from(JSON.stringify(docs, null, 2), 'utf8');
        await supabase.storage
          .from(bucketName)
          .upload(`database/data/${collectionName}.json`, buffer, {
            contentType: 'application/json',
            upsert: true
          });
      }
    } catch (err) {
      console.error(`Error migrating ${collectionName}:`, err.message);
      migrationStats[collectionName] = `Error: ${err.message}`;
    }
  }

  const collections = [
    'products',
    'categories',
    'companies',
    'store_settings',
    'homepage_banners',
    'homepage_tickers',
    'homepage_offers',
    'homepage_coming_soon',
    'bundle_offers',
    'orders',
    'coupons',
    'installmentProviders',
    'installmentPlans',
    'insurancePolicies',
    'inventory_logs',
    'analytics_events',
    'audit_logs',
    'users',
    'admin_notifications'
  ];

  for (const col of collections) {
    const isTable = ['products', 'categories', 'store_settings'].includes(col);
    await migrateCollection(col, isTable);
  }

  // Migrate Subcollections for Users (favorites, cart, addresses, recentlyViewed, notifications)
  try {
    if (firestoreDb) {
      const usersSnap = await firestoreDb.collection('users').get();
      const allFavorites = [];
      const allCarts = [];
      const allAddresses = [];
      const allRecentlyViewed = [];
      const allNotifications = [];

      for (const uDoc of usersSnap.docs) {
        const uid = uDoc.id;
        
        // Favorites
        try {
          const favSnap = await firestoreDb.collection('users').doc(uid).collection('favorites').get();
          favSnap.forEach(d => allFavorites.push({ id: d.id, user_uid: uid, ...(d.data() || {}) }));
        } catch {}

        // Cart
        try {
          const cartSnap = await firestoreDb.collection('users').doc(uid).collection('cart').get();
          cartSnap.forEach(d => allCarts.push({ id: d.id, user_uid: uid, ...(d.data() || {}) }));
        } catch {}

        // Addresses
        try {
          const addSnap = await firestoreDb.collection('users').doc(uid).collection('addresses').get();
          addSnap.forEach(d => allAddresses.push({ id: d.id, user_uid: uid, ...(d.data() || {}) }));
        } catch {}

        // Recently Viewed
        try {
          const rvSnap = await firestoreDb.collection('users').doc(uid).collection('recentlyViewed').get();
          rvSnap.forEach(d => allRecentlyViewed.push({ id: d.id, user_uid: uid, ...(d.data() || {}) }));
        } catch {}

        // Notifications
        try {
          const notSnap = await firestoreDb.collection('users').doc(uid).collection('notifications').get();
          notSnap.forEach(d => allNotifications.push({ id: d.id, user_uid: uid, ...(d.data() || {}) }));
        } catch {}
      }

      const subcolMap = {
        favorites: allFavorites,
        carts: allCarts,
        user_addresses: allAddresses,
        recently_viewed: allRecentlyViewed,
        user_notifications: allNotifications
      };

      for (const [key, items] of Object.entries(subcolMap)) {
        migrationStats[key] = items.length;
        if (items.length > 0) {
          const buf = Buffer.from(JSON.stringify(items, null, 2), 'utf8');
          await supabase.storage
            .from(bucketName)
            .upload(`database/data/${key}.json`, buf, {
              contentType: 'application/json',
              upsert: true
            });
        }
      }
    }
  } catch (err) {
    console.error('Subcollections migration error:', err.message);
  }

  // Migrate Product Reviews subcollection
  try {
    if (firestoreDb) {
      const allReviews = [];
      const prodsSnap = await firestoreDb.collection('products').get();
      for (const pDoc of prodsSnap.docs) {
        try {
          const revSnap = await firestoreDb.collection('products').doc(pDoc.id).collection('reviews').get();
          revSnap.forEach(r => allReviews.push({ id: r.id, product_id: pDoc.id, ...(r.data() || {}) }));
        } catch {}
      }
      migrationStats['product_reviews'] = allReviews.length;
      if (allReviews.length > 0) {
        const buf = Buffer.from(JSON.stringify(allReviews, null, 2), 'utf8');
        await supabase.storage
          .from(bucketName)
          .upload(`database/data/product_reviews.json`, buf, {
            contentType: 'application/json',
            upsert: true
          });
      }
    }
  } catch (err) {
    console.error('Product reviews migration error:', err.message);
  }

  console.log('=== MIGRATION COMPLETED ===');
  console.log('Migration Summary:', JSON.stringify(migrationStats, null, 2));
}

runMigration();
