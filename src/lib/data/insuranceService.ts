import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { sanitizeForFirestore } from '../firestoreUtils';
import { InsurancePolicy } from '../../types/insurance';
import { DEFAULT_INSURANCE_POLICIES } from '../insurance/insuranceEngine';
import { auditService } from './auditService';
import { checkIsAdminEmail } from '../authUtils';

const COLLECTION_NAME = 'insurancePolicies';

// In-memory cache for client side to prevent repeated reads
let insuranceCache: { data: InsurancePolicy[]; timestamp: number } | null = null;
let lastKnownGood: InsurancePolicy[] | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const pendingRequests = new Map<string, Promise<InsurancePolicy[]>>();

/**
 * Helper to determine if current user has admin privileges.
 */
function isCurrentAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  const user = auth?.currentUser;
  if (!user) return false;
  if (user.uid === 'EJUkv883PFgWzQI4qn4itmTeWl22') return true;
  if (checkIsAdminEmail(user.email)) return true;
  return false;
}

/**
 * Diagnostic logger for development mode only.
 * Strictly avoids logging sensitive credentials, keys, or secrets.
 */
function logDiagnostic(operation: string, error?: any) {
  if (import.meta.env?.DEV) {
    const user = auth?.currentUser;
    const admin = isCurrentAdmin();
    console.log('[insuranceService Diagnostic]', {
      collection: COLLECTION_NAME,
      accessLayer: 'Firebase Client SDK',
      userAuthState: user ? `authenticated (uid: ${user.uid})` : 'guest / unauthenticated',
      isAdmin: admin,
      operation,
      errorCode: error?.code || (error ? (error.message || 'error') : null)
    });
  }
}

export const insuranceService = {
  clearCache() {
    insuranceCache = null;
    pendingRequests.clear();
    if (typeof window !== 'undefined') {
      fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'insurance' })
      }).catch(() => {});
    }
  },

  async getPolicies(includeInactive = false): Promise<InsurancePolicy[]> {
    const isAdminUser = isCurrentAdmin() || (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));

    // 1. Fast in-memory cache return for public views
    if (!isAdminUser && !includeInactive && insuranceCache && (Date.now() - insuranceCache.timestamp < CACHE_TTL)) {
      return [...insuranceCache.data];
    }

    const reqKey = includeInactive ? 'policies_admin' : 'policies_public';
    if (pendingRequests.has(reqKey)) {
      return pendingRequests.get(reqKey)!;
    }

    const fetchPromise = (async () => {
      try {
        // 2. Try server cache endpoint for non-admin public requests
        if (!isAdminUser && !includeInactive) {
          try {
            const res = await fetch('/api/cache/insurancePolicies');
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
              const list = await res.json();
              if (Array.isArray(list) && list.length > 0) {
                list.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                insuranceCache = { data: [...list], timestamp: Date.now() };
                lastKnownGood = [...list];
                return list as InsurancePolicy[];
              }
            }
          } catch (e) {
            console.warn('[insuranceService] Server cache fetch skipped, falling back:', e);
          }
        }

        // 3. Fallback to client Firestore SDK
        if (db) {
          logDiagnostic(includeInactive ? 'READ admin all policies' : 'READ public active policies');
          
          let snapshot;
          if (includeInactive) {
            // Admin query: load all documents
            snapshot = await getDocs(collection(db, COLLECTION_NAME));
          } else {
            // Public query: MUST use where("active", "==", true) to align with security rules
            const q = query(collection(db, COLLECTION_NAME), where('active', '==', true));
            snapshot = await getDocs(q);
          }

          if (!snapshot.empty) {
            const list: InsurancePolicy[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                ...data
              } as InsurancePolicy);
            });

            list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

            const filtered = includeInactive ? list : list.filter(p => p.active !== false);
            insuranceCache = { data: [...filtered], timestamp: Date.now() };
            lastKnownGood = [...filtered];
            return filtered;
          } else {
            // Collection is completely empty
            if (includeInactive) {
              // Admin seeding during initial setup
              logDiagnostic('SEED initial default policies by Admin');
              const seeded: InsurancePolicy[] = [];
              for (const defaultPolicy of DEFAULT_INSURANCE_POLICIES) {
                const docRef = doc(db, COLLECTION_NAME, defaultPolicy.id);
                const payload = sanitizeForFirestore({
                  ...defaultPolicy,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
                await setDoc(docRef, payload);
                seeded.push(payload as InsurancePolicy);
              }
              insuranceCache = { data: [...seeded], timestamp: Date.now() };
              lastKnownGood = [...seeded];
              return seeded;
            } else {
              // Public view when collection empty
              const defaults = DEFAULT_INSURANCE_POLICIES.filter(p => p.active !== false);
              return defaults;
            }
          }
        }

        // 4. Offline / no-db fallback
        const defaults = includeInactive
          ? DEFAULT_INSURANCE_POLICIES
          : DEFAULT_INSURANCE_POLICIES.filter(p => p.active !== false);
        insuranceCache = { data: [...defaults], timestamp: Date.now() };
        lastKnownGood = [...defaults];
        return defaults;
      } catch (err: any) {
        logDiagnostic('READ ERROR: ' + (includeInactive ? 'admin' : 'public'), err);

        // For ADMIN: DO NOT silently mask the failure or pretend default data is saved!
        if (includeInactive) {
          throw err;
        }

        // For PUBLIC: Use cached / last-known-good insurance data if available
        if (lastKnownGood && lastKnownGood.length > 0) {
          console.warn('[insuranceService] Serving last-known-good insurance policies after read failure:', err?.message);
          return [...lastKnownGood];
        }

        // If no last-known-good exists, return initial defaults during initial setup only
        console.warn('[insuranceService] No LKG available, returning initial defaults during initial setup:', err?.message);
        return DEFAULT_INSURANCE_POLICIES.filter(p => p.active !== false);
      } finally {
        pendingRequests.delete(reqKey);
      }
    })();

    pendingRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  async getPolicyById(id: string): Promise<InsurancePolicy | null> {
    if (!db) {
      return DEFAULT_INSURANCE_POLICIES.find(p => p.id === id) || null;
    }
    try {
      logDiagnostic(`READ getPolicyById: ${id}`);
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as InsurancePolicy;
      }
      return DEFAULT_INSURANCE_POLICIES.find(p => p.id === id) || null;
    } catch (err) {
      logDiagnostic(`READ ERROR getPolicyById: ${id}`, err);
      if (insuranceCache) {
        const found = insuranceCache.data.find(p => p.id === id);
        if (found) return found;
      }
      return DEFAULT_INSURANCE_POLICIES.find(p => p.id === id) || null;
    }
  },

  async savePolicy(policy: InsurancePolicy): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    logDiagnostic(`WRITE (savePolicy): ${policy.id}`);
    try {
      const docRef = doc(db, COLLECTION_NAME, policy.id);
      const existingSnap = await getDoc(docRef).catch(() => null);
      const beforeData = existingSnap?.exists() ? existingSnap.data() : null;

      const payload = sanitizeForFirestore({
        ...policy,
        updatedAt: new Date().toISOString()
      });

      await setDoc(docRef, payload, { merge: true });
      this.clearCache();

      // Log audit event
      auditService.recordAuditLog({
        action: 'SETTINGS_CHANGED',
        entityType: 'settings',
        entityId: policy.id,
        entityName: `وثيقة تأمين: ${policy.name}`,
        before: beforeData,
        after: payload,
        customSummary: beforeData ? `تحديث وثيقة تأمين: ${policy.name}` : `إنشاء وثيقة تأمين جديدة: ${policy.name}`
      }).catch(() => {});
    } catch (err: any) {
      logDiagnostic(`WRITE ERROR (savePolicy): ${policy.id}`, err);
      throw err;
    }
  },

  async createPolicy(policyData: Omit<InsurancePolicy, 'id'> & { id?: string }): Promise<InsurancePolicy> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    const id = policyData.id || `fawry-policy-${Date.now()}`;
    const newPolicy: InsurancePolicy = {
      ...policyData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.savePolicy(newPolicy);
    return newPolicy;
  },

  async updatePolicy(id: string, updates: Partial<InsurancePolicy>): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    logDiagnostic(`WRITE (updatePolicy): ${id}`);
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const payload = sanitizeForFirestore({
        ...updates,
        updatedAt: new Date().toISOString()
      });

      await updateDoc(docRef, payload);
      this.clearCache();
    } catch (err: any) {
      logDiagnostic(`WRITE ERROR (updatePolicy): ${id}`, err);
      throw err;
    }
  },

  async togglePolicyActive(id: string, active: boolean): Promise<void> {
    await this.updatePolicy(id, { active });
  },

  async deletePolicy(id: string): Promise<void> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    logDiagnostic(`WRITE (deletePolicy): ${id}`);
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const existingSnap = await getDoc(docRef).catch(() => null);
      const beforeData = existingSnap?.exists() ? existingSnap.data() : null;

      await deleteDoc(docRef);
      this.clearCache();

      if (beforeData) {
        auditService.recordAuditLog({
          action: 'SETTINGS_CHANGED',
          entityType: 'settings',
          entityId: id,
          entityName: `وثيقة تأمين: ${beforeData.name || id}`,
          before: beforeData,
          after: null,
          customSummary: `حذف وثيقة تأمين: ${beforeData.name || id}`
        }).catch(() => {});
      }
    } catch (err: any) {
      logDiagnostic(`WRITE ERROR (deletePolicy): ${id}`, err);
      throw err;
    }
  },

  async resetToDefaults(): Promise<InsurancePolicy[]> {
    if (!db) throw new Error('تعذر الاتصال بقاعدة البيانات Firebase.');

    logDiagnostic('WRITE (resetToDefaults)');
    try {
      for (const policy of DEFAULT_INSURANCE_POLICIES) {
        await this.savePolicy(policy);
      }

      this.clearCache();
      return DEFAULT_INSURANCE_POLICIES;
    } catch (err: any) {
      logDiagnostic('WRITE ERROR (resetToDefaults)', err);
      throw err;
    }
  }
};
