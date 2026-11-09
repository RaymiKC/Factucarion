import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { db } from './db';

export interface Company {
  id: string;
  name: string;
  rnc: string;
  address: string;
  phone: string;
  email: string;
  country: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CompanyContextValue {
  companies: Company[];           // companies the current user can access
  allCompanies: Company[];        // all companies (admin-only use)
  currentCompany: Company | null;
  setCurrentCompany: (c: Company) => void;
  loading: boolean;
  refetch: () => void;
  createCompany: (data: Partial<Company>) => Promise<Company | null>;
}

const COMPANY_KEY = 'facturapro_company';
const CompanyContext = createContext<CompanyContextValue | null>(null);

interface CompanyProviderProps {
  children: ReactNode;
  // Pass in the auth user's role + assigned IDs so we can filter
  userRole?: string;
  assignedCompanyIds?: string[];
}

export function CompanyProvider({ children, userRole, assignedCompanyIds = [] }: CompanyProviderProps) {
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await db
      .from('companies')
      .select('*')
      .eq('is_active', true)
      .order('name');
    const all = (data ?? []) as Company[];
    setAllCompanies(all);

    // Filter based on role
    const accessible = userRole === 'admin'
      ? all
      : all.filter(c => assignedCompanyIds.includes(c.id));
    setCompanies(accessible);

    // Restore previously selected company
    const savedId = localStorage.getItem(COMPANY_KEY);
    const saved = accessible.find(c => c.id === savedId);
    if (saved) {
      setCurrentCompanyState(saved);
    } else if (accessible.length > 0) {
      setCurrentCompanyState(accessible[0]);
      localStorage.setItem(COMPANY_KEY, accessible[0].id);
    }
    setLoading(false);
  }, [userRole, assignedCompanyIds.join(',')]);

  useEffect(() => { fetch(); }, [fetch]);

  const setCurrentCompany = useCallback((c: Company) => {
    setCurrentCompanyState(c);
    localStorage.setItem(COMPANY_KEY, c.id);
  }, []);

  const createCompany = useCallback(async (data: Partial<Company>): Promise<Company | null> => {
    const { data: created } = await db
      .from('companies')
      .insert({
        name: data.name ?? '',
        rnc: data.rnc ?? '',
        address: data.address ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        country: data.country ?? 'DO',
        is_active: true,
      })
      .select()
      .maybeSingle();
    if (created) {
      await fetch();
      return created as Company;
    }
    return null;
  }, [fetch]);

  return (
    <CompanyContext.Provider value={{ companies, allCompanies, currentCompany, setCurrentCompany, loading, refetch: fetch, createCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used inside CompanyProvider');
  return ctx;
}
