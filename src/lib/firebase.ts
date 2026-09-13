import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { sanitizeForFirestore } from './firestoreUtils';

// Detect whether a legitimate Firebase project and valid API key are configured
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig &&
  typeof firebaseConfig.apiKey === 'string' &&
  !firebaseConfig.apiKey.includes('Dummy') &&
  !firebaseConfig.apiKey.includes('placeholder') &&
  !firebaseConfig.apiKey.includes('InitialSetup') &&
  firebaseConfig.apiKey.startsWith('AIzaSy') &&
  firebaseConfig.apiKey.length >= 35 &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes('dummy') &&
  firebaseConfig.projectId !== 'albayt-alsaeed-retail'
);

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    // 1. Initialize Firebase App (Singleton)
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    // 2. Initialize Firestore (Singleton)
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    
    // We use initializeFirestore to ensure settings are applied
    dbInstance = initializeFirestore(appInstance, {
      ignoreUndefinedProperties: true,
      experimentalForceLongPolling: true,
    }, dbId);

    // 3. Initialize Auth (Singleton)
    authInstance = getAuth(appInstance);
  } catch (err) {
    console.warn('Firebase initialization error:', err);
  }
}

export const app = appInstance;
export const db = dbInstance;
export const auth = authInstance;
export { sanitizeForFirestore };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth ? auth.currentUser : null;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
