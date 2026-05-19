import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Client, Invoice, ProductService, TaxRate, Notification, Setting, FeatureFlag, UserConfig, EmailSchedule, EmailLog, PaymentRecord, EcfProviderConfig, NcfSequence, NcfVoidLog, CompanyUser } from './supabase';

// All hooks accept a companyId. When provided they filter to that company.
// Callers typically pass useCompany().currentCompany?.id.

export function useClients(companyId?: string) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('clients').select('*').order('name');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setClients(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { clients, loading, refetch: fetch };
}

export function useInvoices(companyId?: string) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('invoices')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setInvoices(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { invoices, loading, refetch: fetch };
}

export function useProducts(companyId?: string) {
  const [products, setProducts] = useState<ProductService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('products_services').select('*, tax_rate:tax_rates(*)').order('name');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setProducts(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { products, loading, refetch: fetch };
}

export function useTaxRates(companyId?: string) {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const fetch = useCallback(async () => {
    let q = supabase.from('tax_rates').select('*').eq('is_active', true).order('name');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setTaxRates(data ?? []);
  }, [companyId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { taxRates, refetch: fetch };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetch = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    const list = data ?? [];
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.is_read).length);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    fetch();
  }, [fetch]);

  const markAllRead = useCallback(async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    fetch();
  }, [fetch]);

  return { notifications, unreadCount, refetch: fetch, markRead, markAllRead };
}

export function useSettings(companyId?: string) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('settings').select('*').order('category');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setSettings(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  const getSetting = (key: string) => settings.find(s => s.key === key)?.value ?? '';

  const updateSetting = async (key: string, value: string) => {
    if (companyId) {
      await supabase.from('settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('key', key);
    } else {
      await supabase.from('settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
    }
    fetch();
  };

  return { settings, loading, getSetting, updateSetting, refetch: fetch };
}

export function useFeatureFlags(companyId?: string) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);

  const fetch = useCallback(async () => {
    let q = supabase.from('feature_flags').select('*').order('name');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setFlags(data ?? []);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from('feature_flags').update({ is_enabled: enabled, updated_at: new Date().toISOString() }).eq('id', id);
    fetch();
  };

  const isEnabled = (name: string) => flags.find(f => f.name === name)?.is_enabled ?? false;

  return { flags, toggle, isEnabled, refetch: fetch };
}

export function useUsersConfig(companyId?: string) {
  const [users, setUsers] = useState<UserConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('users_config').select('*').order('name');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setUsers(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { users, loading, refetch: fetch };
}

export function useEmailSchedules(companyId?: string) {
  const [schedules, setSchedules] = useState<EmailSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('email_schedules').select('*').order('name');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setSchedules(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { schedules, loading, refetch: fetch };
}

export function useEmailLog() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('email_log').select('*').order('sent_at', { ascending: false }).limit(100);
    setLogs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { logs, loading, refetch: fetch };
}

export function usePaymentRecords(invoiceId?: string) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const fetch = useCallback(async () => {
    let q = supabase.from('payment_records').select('*').order('payment_date', { ascending: false });
    if (invoiceId) q = q.eq('invoice_id', invoiceId);
    const { data } = await q;
    setPayments(data ?? []);
  }, [invoiceId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { payments, refetch: fetch };
}

export function useEcfProviderConfig(companyId?: string) {
  const [config, setConfig] = useState<EcfProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('ecf_provider_config').select('*');
    if (companyId) {
      q = q.eq('company_id', companyId);
    } else {
      q = q.eq('id', '00000000-0000-0000-0000-000000000001');
    }
    const { data } = await q.maybeSingle();
    setConfig(data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(async (updates: Partial<Omit<EcfProviderConfig, 'id'>>) => {
    if (config?.id) {
      await supabase
        .from('ecf_provider_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', config.id);
    }
    fetch();
  }, [config, fetch]);

  return { config, loading, save, refetch: fetch };
}

export function useDashboardMetrics(companyId?: string) {
  const [metrics, setMetrics] = useState({
    totalInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    totalClients: 0,
    paidThisMonth: 0,
    invoicesThisMonth: 0,
    overdueCount: 0,
    recentInvoices: [] as Invoice[],
    monthlyRevenue: [] as { month: string; amount: number }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let invQ = supabase.from('invoices').select('*, client:clients(name)');
      let cliQ = supabase.from('clients').select('id').eq('is_active', true);
      if (companyId) {
        invQ = invQ.eq('company_id', companyId);
        cliQ = cliQ.eq('company_id', companyId);
      }
      const [invoicesRes, clientsRes] = await Promise.all([invQ, cliQ]);

      const invoices = (invoicesRes.data ?? []) as Invoice[];
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
      const pendingAmount = invoices.filter(i => ['sent', 'partial'].includes(i.status)).reduce((s, i) => s + (i.total - i.amount_paid), 0);
      const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total - i.amount_paid), 0);
      const paidThisMonth = invoices.filter(i => i.status === 'paid' && i.issue_date?.startsWith(thisMonth)).reduce((s, i) => s + i.total, 0);
      const invoicesThisMonth = invoices.filter(i => i.issue_date?.startsWith(thisMonth)).length;
      const overdueCount = invoices.filter(i => i.status === 'overdue').length;

      const monthlyMap: Record<string, number> = {};
      invoices.filter(i => i.status === 'paid').forEach(i => {
        const m = i.issue_date?.substring(0, 7) ?? '';
        monthlyMap[m] = (monthlyMap[m] ?? 0) + i.total;
      });
      const monthlyRevenue = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, amount]) => ({ month, amount }));

      setMetrics({
        totalInvoices: invoices.length,
        totalRevenue,
        pendingAmount,
        overdueAmount,
        totalClients: (clientsRes.data ?? []).length,
        paidThisMonth,
        invoicesThisMonth,
        overdueCount,
        recentInvoices: invoices.slice(0, 5),
        monthlyRevenue,
      });
      setLoading(false);
    }
    load();
  }, [companyId]);

  return { metrics, loading };
}

export function useNcfSequences(companyId?: string) {
  const [sequences, setSequences] = useState<NcfSequence[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('ncf_sequences').select('*').order('created_at', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setSequences(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { sequences, loading, refetch: fetch };
}

export function useNcfVoidLog(companyId?: string) {
  const [logs, setLogs] = useState<NcfVoidLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    // ncf_void_log doesn't have company_id directly; filter via invoice join if needed
    const { data } = await supabase.from('ncf_void_log').select('*').order('cancelled_at', { ascending: false });
    setLogs(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { logs, loading, refetch: fetch };
}

export function useActiveNcfSequence(ncfType: string, companyId?: string) {
  const [sequence, setSequence] = useState<NcfSequence | null>(null);

  const fetch = useCallback(async () => {
    let q = supabase
      .from('ncf_sequences')
      .select('*')
      .eq('ncf_type', ncfType)
      .eq('is_active', true);
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q.maybeSingle();
    setSequence(data);
  }, [ncfType, companyId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { sequence, refetch: fetch };
}

// Company-User assignments (for admin user management)
export function useCompanyUsers(companyId?: string, userId?: string) {
  const [assignments, setAssignments] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('company_users').select('*');
    if (companyId) q = q.eq('company_id', companyId);
    if (userId)    q = q.eq('user_id', userId);
    const { data } = await q;
    setAssignments(data ?? []);
    setLoading(false);
  }, [companyId, userId]);

  useEffect(() => { fetch(); }, [fetch]);

  const assign = useCallback(async (uid: string, cid: string, roleOverride?: string) => {
    await supabase.from('company_users').upsert({
      user_id: uid,
      company_id: cid,
      role_override: roleOverride ?? null,
    }, { onConflict: 'user_id,company_id' });
    fetch();
  }, [fetch]);

  const unassign = useCallback(async (uid: string, cid: string) => {
    await supabase.from('company_users').delete().eq('user_id', uid).eq('company_id', cid);
    fetch();
  }, [fetch]);

  return { assignments, loading, refetch: fetch, assign, unassign };
}
