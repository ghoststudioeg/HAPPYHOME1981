import { supabaseDb } from './supabaseDb';
import { InsurancePolicy } from '../../types/insurance';
import { DEFAULT_INSURANCE_POLICIES } from '../insurance/insuranceEngine';

export const insuranceService = {
  async getInsurancePolicies(): Promise<InsurancePolicy[]> {
    try {
      const list = await supabaseDb.getCollection<InsurancePolicy>('insurancePolicies');
      if (list.length === 0) return DEFAULT_INSURANCE_POLICIES;
      return list.filter((p) => p.active !== false);
    } catch {
      return DEFAULT_INSURANCE_POLICIES;
    }
  },

  async getPolicies(includeInactive?: boolean): Promise<InsurancePolicy[]> {
    try {
      const list = await supabaseDb.getCollection<InsurancePolicy>('insurancePolicies');
      if (list.length === 0) return DEFAULT_INSURANCE_POLICIES;
      if (includeInactive) return list;
      return list.filter((p) => p.active !== false);
    } catch {
      return DEFAULT_INSURANCE_POLICIES;
    }
  },

  async savePolicy(policy: InsurancePolicy): Promise<void> {
    await supabaseDb.setDoc('insurancePolicies', policy.id || `ins_${Date.now()}`, policy);
  },

  async togglePolicyActive(id: string, newActiveState?: boolean): Promise<void> {
    const list = await this.getInsurancePolicies();
    const item = list.find((p) => p.id === id);
    const active = newActiveState !== undefined ? newActiveState : !(item?.active);
    await supabaseDb.updateDoc('insurancePolicies', id, { active });
  },

  async deletePolicy(id: string): Promise<void> {
    await supabaseDb.deleteDoc('insurancePolicies', id);
  },

  async resetToDefaults(): Promise<void> {
    for (const p of DEFAULT_INSURANCE_POLICIES) {
      await supabaseDb.setDoc('insurancePolicies', p.id, p);
    }
  },

  clearCache(): void {}
};
