import { getApps, initializeApp as initializeAdminApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Canonical Firebase Admin service provider
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedApp: any = null;

interface CredentialResolution {
  credential: any;
  source: string;
}

function resolveAdminCredential(projectId: string): CredentialResolution {
  // 1. Google Application Default Credentials via GOOGLE_APPLICATION_CREDENTIALS
  // Automatically used by Render (/etc/secrets/firebase-service-account.json) and standard GCP environments
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const fileExists = fs.existsSync(credPath);
    return {
      credential: applicationDefault(),
      source: `GOOGLE_APPLICATION_CREDENTIALS (path: ${credPath}, fileExists: ${fileExists})`
    };
  }

  // 2. Explicit Service Account Key JSON (raw or base64) via environment variable
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_CREDENTIALS_JSON;
  if (rawKey && rawKey.trim().length > 0) {
    try {
      const trimmed = rawKey.trim();
      const jsonStr = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr);
      const saEmail = parsed.client_email ? ` (${parsed.client_email})` : '';
      return {
        credential: cert(parsed),
        source: `FIREBASE_SERVICE_ACCOUNT_KEY${saEmail}`
      };
    } catch (err: any) {
      console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', err?.message || err);
    }
  }

  // 3. Individual credentials from environment variables
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      return {
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        source: `FIREBASE_CLIENT_EMAIL (${process.env.FIREBASE_CLIENT_EMAIL})`
      };
    } catch (err: any) {
      console.error('[Firebase Admin] Failed to initialize credentials from FIREBASE_CLIENT_EMAIL:', err?.message || err);
    }
  }

  // 4. Default Application Default Credentials (ADC) fallback (e.g. metadata server or gcloud CLI)
  return {
    credential: applicationDefault(),
    source: 'Application Default Credentials (ADC - metadata server / environment)'
  };
}

/**
 * Guarantees that Firebase Admin is initialized and returns the core services.
 */
export function getFirebaseAdmin() {
  if (cachedAuth && cachedDb && cachedApp) {
    return { auth: cachedAuth, db: cachedDb, app: cachedApp };
  }

  const apps = getApps();
  let credSource = 'existing-app';

  if (apps.length > 0) {
    cachedApp = apps[0];
  } else {
    try {
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const config = fs.existsSync(firebaseConfigPath) ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) : {};
      
      const pId = config.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'mercurial-memento-27dg';
      const resolved = resolveAdminCredential(pId);
      credSource = resolved.source;

      cachedApp = initializeAdminApp({
        projectId: pId,
        credential: resolved.credential
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
      const pId = config.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'mercurial-memento-27dg';
      const dbId = config.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID || 'ai-studio-872f096d-52c3-4385-922e-bb0113f94d78';

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

      // Development-safe diagnostic logging (no private keys or tokens logged)
      console.log('[Firebase Admin Diagnostics]', {
        credentialSource: credSource,
        projectId: pId,
        databaseId: dbId,
        timestamp: new Date().toISOString()
      });

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
