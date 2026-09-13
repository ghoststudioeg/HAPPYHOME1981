import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { FinancingProvider, InstallmentPlan } from '../../types/installment';

export const DEFAULT_PROVIDERS: FinancingProvider[] = [
  {
    id: 'taqseeti',
    name: 'تقسيطي',
    slug: 'taqseeti',
    logoUrl: '',
    enabled: true,
    calculationMode: 'manual',
    integrationMode: 'manual',
    description: 'تقسيط مباشر من المحل بدون تعقيدات بنكية، تخضع الموافقة والشروط لإجراءات المحل.',
    displayOrder: 1,
    isDirectStore: true,
    directStoreDisclaimer: 'التقسيط المباشر يتم من خلال المحل، وتخضع الموافقة والشروط النهائية لإجراءات المحل.',
    integrationStatus: 'unconfigured',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mylo',
    name: 'مايلو',
    slug: 'mylo',
    logoUrl: '',
    enabled: true,
    calculationMode: 'manual',
    integrationMode: 'manual',
    description: 'تقسيط استهلاكي مرن وميسر عبر خدمات مايلو.',
    displayOrder: 2,
    isDirectStore: false,
    integrationStatus: 'unconfigured',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mojo',
    name: 'موجو',
    slug: 'mojo',
    logoUrl: '',
    enabled: true,
    calculationMode: 'manual',
    integrationMode: 'manual',
    description: 'حلول تقسيط سريعة وسهلة عبر منصة موجو.',
    displayOrder: 3,
    isDirectStore: false,
    integrationStatus: 'unconfigured',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_PLANS: InstallmentPlan[] = [
  // تقسيطي (Direct Store)
  {
    id: 'taqseeti-6m',
    providerId: 'taqseeti',
    months: 6,
    calculationType: 'no_extra_cost',
    percentage: 0,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 1000,
    enabled: true,
    displayOrder: 1,
    disclaimer: 'تقسيط مباشر بدون فوائد إضافية لمدة 6 أشهر.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'taqseeti-12m',
    providerId: 'taqseeti',
    months: 12,
    calculationType: 'percentage_fee',
    percentage: 8,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 2000,
    enabled: true,
    displayOrder: 2,
    disclaimer: 'فائدة مبسطة 8% على المبلغ المتبقي.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'taqseeti-18m',
    providerId: 'taqseeti',
    months: 18,
    calculationType: 'percentage_fee',
    percentage: 14,
    fixedFee: 0,
    downPaymentType: 'percentage',
    downPaymentValue: 10,
    minProductPrice: 3000,
    enabled: true,
    displayOrder: 3,
    disclaimer: 'مقدم 10% وفائدة 14% على المبلغ الممول.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // مايلو
  {
    id: 'mylo-6m',
    providerId: 'mylo',
    months: 6,
    calculationType: 'no_extra_cost',
    percentage: 0,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 1000,
    enabled: true,
    displayOrder: 1,
    disclaimer: 'عرض بدون مصاريف إضافية لمدة 6 شهور.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mylo-12m',
    providerId: 'mylo',
    months: 12,
    calculationType: 'percentage_fee',
    percentage: 10,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 1500,
    enabled: true,
    displayOrder: 2,
    disclaimer: 'تقسيط 12 شهر مع نسبة 10%.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mylo-24m',
    providerId: 'mylo',
    months: 24,
    calculationType: 'percentage_fee',
    percentage: 18,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 3000,
    enabled: true,
    displayOrder: 3,
    disclaimer: 'تقسيط ممتد حتى 24 شهر مع نسبة 18%.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // موجو
  {
    id: 'mojo-3m',
    providerId: 'mojo',
    months: 3,
    calculationType: 'no_extra_cost',
    percentage: 0,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 500,
    enabled: true,
    displayOrder: 1,
    disclaimer: 'تقسيط سريع 3 أشهر بدون مصاريف إضافية.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mojo-6m',
    providerId: 'mojo',
    months: 6,
    calculationType: 'percentage_fee',
    percentage: 5,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 1000,
    enabled: true,
    displayOrder: 2,
    disclaimer: 'تقسيط 6 أشهر بنسبة 5%.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mojo-12m',
    providerId: 'mojo',
    months: 12,
    calculationType: 'percentage_fee',
    percentage: 12,
    fixedFee: 0,
    downPaymentType: 'none',
    downPaymentValue: 0,
    minProductPrice: 2000,
    enabled: true,
    displayOrder: 3,
    disclaimer: 'تقسيط 12 شهر بنسبة 12%.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

class InstallmentService {
  private memoryProviders: FinancingProvider[] | null = null;
  private memoryPlans: InstallmentPlan[] | null = null;

  /**
   * One-time fetch of all financing providers.
   * Does NOT hold an active snapshot stream to protect WebChannel transport.
   */
  async getProviders(): Promise<FinancingProvider[]> {
    if (this.memoryProviders && this.memoryProviders.length > 0) {
      return [...this.memoryProviders];
    }

    if (!db) {
      return [...DEFAULT_PROVIDERS];
    }

    try {
      const colRef = collection(db, 'installmentProviders');
      const snap = await getDocs(colRef);

      if (snap.empty) {
        // Automatically seed default providers
        await this.seedDefaultData();
        return [...DEFAULT_PROVIDERS];
      }

      const list: FinancingProvider[] = [];
      snap.forEach((d) => {
        const data = d.data() as FinancingProvider;
        list.push({
          ...data,
          id: d.id,
          name: data.name || 'جهة تقسيط',
          slug: data.slug || d.id,
          enabled: data.enabled !== false,
          calculationMode: data.calculationMode || 'manual',
          integrationMode: data.integrationMode || 'manual',
          description: data.description || '',
          displayOrder: Number(data.displayOrder) || 0,
          isDirectStore: Boolean(data.isDirectStore),
          directStoreDisclaimer: data.directStoreDisclaimer
        });
      });

      list.sort((a, b) => a.displayOrder - b.displayOrder);
      this.memoryProviders = list;
      return list;
    } catch (err) {
      console.warn('[Installment Service] Error fetching providers from Firestore, falling back to defaults:', err);
      return [...DEFAULT_PROVIDERS];
    }
  }

  /**
   * One-time fetch of all installment plans (optionally filtered by providerId).
   * Does NOT hold an active snapshot stream.
   */
  async getPlans(providerId?: string): Promise<InstallmentPlan[]> {
    if (this.memoryPlans && this.memoryPlans.length > 0) {
      const filtered = providerId 
        ? this.memoryPlans.filter((p) => p.providerId === providerId) 
        : this.memoryPlans;
      return [...filtered];
    }

    if (!db) {
      const filtered = providerId 
        ? DEFAULT_PLANS.filter((p) => p.providerId === providerId) 
        : DEFAULT_PLANS;
      return [...filtered];
    }

    try {
      const colRef = collection(db, 'installmentPlans');
      const snap = await getDocs(colRef);

      if (snap.empty) {
        await this.seedDefaultData();
        const filtered = providerId 
          ? DEFAULT_PLANS.filter((p) => p.providerId === providerId) 
          : DEFAULT_PLANS;
        return [...filtered];
      }

      const list: InstallmentPlan[] = [];
      snap.forEach((d) => {
        const data = d.data() as InstallmentPlan;
        list.push({
          ...data,
          id: d.id,
          providerId: data.providerId || '',
          months: Number(data.months) || 6,
          calculationType: data.calculationType || 'no_extra_cost',
          percentage: Number(data.percentage) || 0,
          fixedFee: Number(data.fixedFee) || 0,
          downPaymentType: data.downPaymentType || 'none',
          downPaymentValue: Number(data.downPaymentValue) || 0,
          minProductPrice: data.minProductPrice !== undefined ? Number(data.minProductPrice) : undefined,
          maxProductPrice: data.maxProductPrice !== undefined ? Number(data.maxProductPrice) : undefined,
          enabled: data.enabled !== false,
          displayOrder: Number(data.displayOrder) || 0,
          disclaimer: data.disclaimer || ''
        });
      });

      list.sort((a, b) => a.displayOrder - b.displayOrder || a.months - b.months);
      this.memoryPlans = list;

      return providerId ? list.filter((p) => p.providerId === providerId) : list;
    } catch (err) {
      console.warn('[Installment Service] Error fetching plans, falling back to defaults:', err);
      const filtered = providerId 
        ? DEFAULT_PLANS.filter((p) => p.providerId === providerId) 
        : DEFAULT_PLANS;
      return [...filtered];
    }
  }

  /**
   * Saves or updates a financing provider
   */
  async saveProvider(provider: Partial<FinancingProvider> & { id: string }): Promise<void> {
    const now = new Date().toISOString();
    const payload: FinancingProvider = {
      id: provider.id,
      name: provider.name || 'جهة جديدة',
      slug: provider.slug || provider.id,
      logoUrl: provider.logoUrl || '',
      enabled: provider.enabled !== false,
      calculationMode: 'manual', // Live system operates entirely in manual mode
      integrationMode: provider.integrationMode || 'manual',
      description: provider.description || '',
      displayOrder: Number(provider.displayOrder) || 0,
      isDirectStore: Boolean(provider.isDirectStore),
      directStoreDisclaimer: provider.directStoreDisclaimer || (provider.isDirectStore ? 'التقسيط المباشر يتم من خلال المحل، وتخضع الموافقة والشروط النهائية لإجراءات المحل.' : undefined),
      integrationStatus: provider.integrationStatus || 'unconfigured',
      createdAt: provider.createdAt || now,
      updatedAt: now
    };

    if (db) {
      const docRef = doc(db, 'installmentProviders', provider.id);
      await setDoc(docRef, payload, { merge: true });
    }

    // Invalidate memory cache
    this.memoryProviders = null;
  }

  /**
   * Deletes a financing provider and its associated plans
   */
  async deleteProvider(providerId: string): Promise<void> {
    if (db) {
      const docRef = doc(db, 'installmentProviders', providerId);
      await deleteDoc(docRef);

      // Also clean up plans for this provider
      const plans = await this.getPlans(providerId);
      for (const p of plans) {
        await deleteDoc(doc(db, 'installmentPlans', p.id));
      }
    }

    this.memoryProviders = null;
    this.memoryPlans = null;
  }

  /**
   * Saves or updates an installment plan
   */
  async savePlan(plan: Partial<InstallmentPlan> & { id: string }): Promise<void> {
    const now = new Date().toISOString();
    const payload: InstallmentPlan = {
      id: plan.id,
      providerId: plan.providerId || '',
      months: Number(plan.months) || 6,
      calculationType: plan.calculationType || 'no_extra_cost',
      percentage: Math.max(0, Number(plan.percentage) || 0),
      fixedFee: Math.max(0, Number(plan.fixedFee) || 0),
      downPaymentType: plan.downPaymentType || 'none',
      downPaymentValue: Math.max(0, Number(plan.downPaymentValue) || 0),
      minProductPrice: plan.minProductPrice !== undefined ? Number(plan.minProductPrice) : undefined,
      maxProductPrice: plan.maxProductPrice !== undefined ? Number(plan.maxProductPrice) : undefined,
      enabled: plan.enabled !== false,
      displayOrder: Number(plan.displayOrder) || 0,
      disclaimer: plan.disclaimer || '',
      createdAt: plan.createdAt || now,
      updatedAt: now
    };

    if (db) {
      const docRef = doc(db, 'installmentPlans', plan.id);
      await setDoc(docRef, payload, { merge: true });
    }

    this.memoryPlans = null;
  }

  /**
   * Deletes an installment plan
   */
  async deletePlan(planId: string): Promise<void> {
    if (db) {
      const docRef = doc(db, 'installmentPlans', planId);
      await deleteDoc(docRef);
    }
    this.memoryPlans = null;
  }

  /**
   * Seeds default providers and plans into Firestore if empty
   */
  async seedDefaultData(): Promise<void> {
    if (!db) return;
    try {
      for (const p of DEFAULT_PROVIDERS) {
        const docRef = doc(db, 'installmentProviders', p.id);
        await setDoc(docRef, p, { merge: true });
      }

      for (const pl of DEFAULT_PLANS) {
        const docRef = doc(db, 'installmentPlans', pl.id);
        await setDoc(docRef, pl, { merge: true });
      }
      this.memoryProviders = [...DEFAULT_PROVIDERS];
      this.memoryPlans = [...DEFAULT_PLANS];
    } catch (e) {
      console.warn('[Installment Service] Seeding error:', e);
    }
  }

  /**
   * Resets in-memory cache to force a fresh read
   */
  invalidateCache() {
    this.memoryProviders = null;
    this.memoryPlans = null;
  }
}

export const installmentService = new InstallmentService();
