import { Injectable, signal } from '@angular/core';
import { SupabaseService, Company } from './supabase.service';
export type { Company };

const COMPANY_KEY = 'facturapro_company';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  companies = signal<Company[]>([]);
  currentCompany = signal<Company | null>(this.loadStored());

  constructor(private supabase: SupabaseService) { this.loadCompanies(); }

  private loadStored(): Company | null {
    try { const s = localStorage.getItem(COMPANY_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  }

  async loadCompanies() {
    const { data } = await this.supabase.client.from('companies').select('*').eq('is_active', true).order('name');
    const list = data ?? [];
    this.companies.set(list);
    if (!this.currentCompany() && list.length > 0) this.setCompany(list[0]);
    else if (this.currentCompany()) {
      const fresh = list.find(c => c.id === this.currentCompany()!.id);
      if (fresh) this.currentCompany.set(fresh);
    }
  }

  setCompany(c: Company) {
    this.currentCompany.set(c);
    localStorage.setItem(COMPANY_KEY, JSON.stringify(c));
  }
}
