import { getApps, initializeApp as initializeAdminApp, applicationDefault } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Canonical Firebase Admin service provider
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedApp: any = null;

/**
 * Guarantees that Firebase Admin is initialized and returns the core services.
 */
export function getFirebaseAdmin() {
  if (cachedAuth && cachedDb && cachedApp) {
    return { auth: cachedAuth, db: cachedDb, app: cachedApp };
  }

  const apps = getApps();
  if (apps.length > 0) {
    cachedApp = apps[0];
  } else {
    try {
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const config = fs.existsSync(firebaseConfigPath) ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) : {};
      
      const pId = config.projectId || 'mercurial-memento-27dg';
      
      cachedApp = initializeAdminApp({
        projectId: pId,
        credential: applicationDefault()
      });
    } catch (err) {
      console.error('[Firebase Admin] FATAL: Initialization failed:', err);
      throw new Error(`Firebase Admin failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (cachedApp) {
    try {
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const config = fs.existsSync(firebaseConfigPath) ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) : {};
      const dbId = config.firestoreDatabaseId || 'ai-studio-872f096d-52c3-4385-922e-bb0113f94d78';

      cachedAuth = getAuth(cachedApp);
      
      if (dbId && dbId !== '(default)') {
        cachedDb = getFirestore(cachedApp, dbId);
      } else {
        cachedDb = getFirestore(cachedApp);
      }

      // Enforce ignoreUndefinedProperties at the database level
      if (cachedDb && typeof cachedDb.settings === 'function') {
        cachedDb.settings({ ignoreUndefinedProperties: true });
      }

      return { auth: cachedAuth, db: cachedDb, app: cachedApp };
    } catch (err) {
      console.error('[Firebase Admin] Service retrieval failed:', err);
      throw new Error(`Firebase Admin services failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error('Firebase Admin initialization failed: No app instance available');
}

/**
 * Verifies a Firebase ID token using the canonical Admin Auth service.
 */
export async function verifyFirebaseUser(idToken: string) {
  try {
    const { auth } = getFirebaseAdmin();
    console.log('[Firebase Auth] verifyIdToken started');
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log(`[Firebase Auth] verifyIdToken success uid = ${decodedToken.uid}`);
    return decodedToken;
  } catch (error: any) {
    console.error(`[Firebase Auth] verifyIdToken failed: ${error.message}`);
    throw error;
  }
}

/**
 * Robustly removes undefined properties from an object recursively for server-side use.
 */
export function sanitizeForFirestoreServer(data: any): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(v => sanitizeForFirestoreServer(v));
  if (typeof data === 'object') {
    if (data instanceof Date) return data;
    const res: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const val = data[key];
        if (val !== undefined) {
          res[key] = sanitizeForFirestoreServer(val);
        }
      }
    }
    return res;
  }
  return data;
}
