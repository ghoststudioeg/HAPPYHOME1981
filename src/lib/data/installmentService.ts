import { supabaseDb } from './supabaseDb';
import { InstallmentProvider, InstallmentPlan } from '../../types';

export const installmentService = {
  async getProviders(): Promise<InstallmentProvider[]> {
    try {
      const providers = await supabaseDb.getCollection<InstallmentProvider>('installmentProviders');
      return providers.filter((p) => p.enabled !== false);
    } catch {
      return [];
    }
  },

  async getPlans(): Promise<InstallmentPlan[]> {
    try {
      return await supabaseDb.getCollection<InstallmentPlan>('installmentPlans');
    } catch {
      return [];
    }
  },

  async createProvider(provider: any): Promise<string> {
    const id = `prov_${Date.now()}`;
    const newProv = { calculationMode: 'manual', ...provider, id, enabled: true };
    await supabaseDb.setDoc('installmentProviders', id, newProv);
    return id;
  },

  async updateProvider(id: string, updates: any): Promise<void> {
    await supabaseDb.updateDoc('installmentProviders', id, updates);
  },

  async deleteProvider(id: string): Promise<void> {
    await supabaseDb.deleteDoc('installmentProviders', id);
  },

  async savePlan(plan: any): Promise<void> {
    await supabaseDb.setDoc('installmentPlans', plan.id || `plan_${Date.now()}`, plan);
  },

  async deletePlan(id: string): Promise<void> {
    await supabaseDb.deleteDoc('installmentPlans', id);
  },

  async saveProvider(provider: any): Promise<void> {
    if (provider.id) {
      await this.updateProvider(provider.id, provider);
    } else {
      await this.createProvider(provider);
    }
  }
};
