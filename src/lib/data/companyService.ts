import { supabaseDb, supabaseAdmin } from './supabaseDb';
import { Company } from '../../types';
import { auditService } from './auditService';

const COLLECTION_NAME = 'companies';
let companiesCache: { data: Company[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export const companyService = {
  clearCache() {
    companiesCache = null;
  },

  async getCompanies(includeInactive = false): Promise<Company[]> {
    const now = Date.now();
    if (!includeInactive && companiesCache && now - companiesCache.timestamp < CACHE_TTL) {
      return [...companiesCache.data];
    }

    try {
      let list = await supabaseDb.getCollection<Company>(COLLECTION_NAME);
      if (!includeInactive) {
        list = list.filter((c) => c.isActive);
      }

      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || '').localeCompare(b.name || '', 'ar'));

      if (!includeInactive) {
        companiesCache = { data: [...list], timestamp: now };
      }

      return list;
    } catch (err) {
      console.error('Error fetching companies from Supabase:', err);
      return companiesCache?.data || [];
    }
  },

  async getCompanyById(id: string): Promise<Company | null> {
    const companies = await this.getCompanies(true);
    return companies.find((c) => c.id === id || c.slug === id) || null;
  },

  async getCompanyBySlug(slug: string): Promise<Company | null> {
    const companies = await this.getCompanies(true);
    return companies.find((c) => c.slug === slug || c.id === slug) || null;
  },

  async createCompany(companyData: Omit<Company, 'id'>): Promise<string> {
    this.clearCache();
    const id = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newCompany: Company = {
      ...companyData,
      id,
      isActive: companyData.isActive ?? true
    };

    await supabaseDb.setDoc(COLLECTION_NAME, id, newCompany);
    await auditService.logAction('CREATE', 'company', id, { name: newCompany.name });
    return id;
  },

  async updateCompany(id: string, companyData: Partial<Company>): Promise<void> {
    this.clearCache();
    await supabaseDb.updateDoc(COLLECTION_NAME, id, companyData);
    await auditService.logAction('UPDATE', 'company', id, companyData);
  },

  async deleteCompany(id: string, reason?: any): Promise<void> {
    this.clearCache();
    await supabaseDb.deleteDoc(COLLECTION_NAME, id);
    const reasonStr = typeof reason === 'boolean' 
      ? (reason ? 'Unlinked products and deleted' : 'Deleted without unlinking') 
      : (reason || 'Deleted by admin');
    await auditService.logAction('DELETE', 'company', id, { reason: reasonStr });
  },

  async getProductsForCompany(companyId: string): Promise<any[]> {
    const products = await supabaseDb.getCollection<any>('products');
    return products.filter((p) => p.companyId === companyId || p.company_id === companyId);
  }
};
