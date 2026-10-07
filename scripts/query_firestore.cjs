const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

async function queryFirestore() {
  console.log('=== READING FIRESTORE COUNTS ===');
  
  const firebaseConfigPath = 'firebase-applet-config.json';
  const config = fs.existsSync(firebaseConfigPath) ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) : {};
  const projectId = config.projectId || process.env.FIREBASE_PROJECT_ID || 'mercurial-memento-27dg';
  const dbId = config.firestoreDatabaseId || 'ai-studio-872f096d-52c3-4385-922e-bb0113f94d78';

  console.log('Project ID:', projectId);
  console.log('Database ID:', dbId);

  let firestoreDb;
  try {
    const adminApp = initializeApp({
      projectId,
      credential: applicationDefault()
    });
    firestoreDb = getFirestore(adminApp, dbId);
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
    process.exit(1);
  }

  const collections = ['products', 'categories', 'companies', 'bundleOffers', 'orders', 'coupons'];
  for (const col of collections) {
    try {
      const snap = await firestoreDb.collection(col).get();
      console.log(`Firestore collection "${col}" count = ${snap.size}`);
      if (col === 'products' && snap.size > 0) {
        const first = snap.docs[0];
        console.log('First Firestore Product sample:', {
          id: first.id,
          data: first.data()
        });
      }
    } catch (err) {
      console.error(`Error querying Firestore collection "${col}":`, err.message);
    }
  }
}

queryFirestore();
