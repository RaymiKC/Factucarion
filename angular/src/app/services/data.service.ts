import { Injectable, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService, Client, Invoice, ProductService, TaxRate, Notification, Setting, FeatureFlag, UserConfig, EmailSchedule, EmailLog, PaymentRecord, NcfSequence } from './supabase.service';
import { DbService } from './db.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable({ providedIn: 'root' })
export class DataService {
  clients = signal<Client[]>([]);
  invoices = signal<Invoice[]>([]);
  products = signal<ProductService[]>([]);
  taxRates = signal<TaxRate[]>([]);
  notifications = signal<Notification[]>([]);
  settings = signal<Setting[]>([]);
  featureFlags = signal<FeatureFlag[]>([]);
  usersConfig = signal<UserConfig[]>([]);
  emailSchedules = signal<EmailSchedule[]>([]);
  emailLog = signal<EmailLog[]>([]);
  paymentRecords = signal<PaymentRecord[]>([]);
  ncfSequences = signal<NcfSequence[]>([]);

  constructor(private supabase: SupabaseService, private dbSvc: DbService) {}

  get db(): SupabaseClient { return this.supabase.client; }

  async loadAll(companyId?: string) {
    await Promise.all([
      this.loadClients(companyId), this.loadInvoices(companyId), this.loadProducts(),
      this.loadTaxRates(), this.loadNotifications(), this.loadSettings(companyId),
      this.loadFeatureFlags(), this.loadUsersConfig(), this.loadEmailSchedules(),
      this.loadPaymentRecords(companyId), this.loadNcfSequences(companyId),
    ]);
  }

  async loadClients(companyId?: string) {
    if (!this.dbSvc.isSupabase()) {
      const filters: Record<string, unknown> = {};
      if (companyId) filters['company_id'] = companyId;
      const { data } = await this.dbSvc.proxyQuery<Client>('clients', { order: 'name', filters });
      this.clients.set(data ?? []);
      return;
    }
    const q: any = this.db.from('clients').select('*').order('name');
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.clients.set(data ?? []);
  }

  async loadInvoices(companyId?: string) {
    if (!this.dbSvc.isSupabase()) {
      const filters: Record<string, unknown> = {};
      if (companyId) filters['company_id'] = companyId;
      const { data } = await this.dbSvc.proxyQuery<Invoice>('invoices', {
        select: '*, client:clients(name,email,rnc,cedula,client_type)',
        order: 'created_at desc',
        filters,
      });
      this.invoices.set(data ?? []);
      return;
    }
    const q: any = this.db.from('invoices').select('*, client:clients(name,email,rnc,cedula,client_type)').order('created_at', { ascending: false });
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.invoices.set(data ?? []);
  }

  async loadProducts() {
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<ProductService>('products_services', {
        select: '*, tax_rate:tax_rates(*)',
        order: 'name',
      });
      this.products.set(data ?? []);
      return;
    }
    const { data } = await this.db.from('products_services').select('*, tax_rate:tax_rates(*)').order('name');
    this.products.set(data ?? []);
  }

  async loadTaxRates() {
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<TaxRate>('tax_rates', {
        filters: { is_active: true },
        order: 'name',
      });
      this.taxRates.set(data ?? []);
      return;
    }
    const { data } = await this.db.from('tax_rates').select('*').eq('is_active', true).order('name');
    this.taxRates.set(data ?? []);
  }

  async loadNotifications() {
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<Notification>('notifications', {
        order: 'created_at desc',
        limit: 50,
      });
      this.notifications.set(data ?? []);
      return;
    }
    const { data } = await this.db.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    this.notifications.set(data ?? []);
  }

  async loadSettings(companyId?: string) {
    if (!this.dbSvc.isSupabase()) {
      const filters: Record<string, unknown> = { is_active: true };
      if (companyId) filters['company_id'] = companyId;
      const { data } = await this.dbSvc.proxyQuery<Setting>('settings', { filters });
      this.settings.set(data ?? []);
      return;
    }
    const q: any = this.db.from('settings').select('*').eq('is_active', true);
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.settings.set(data ?? []);
  }

  async loadFeatureFlags() {
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<FeatureFlag>('feature_flags', { order: 'name' });
      this.featureFlags.set(data ?? []);
      return;
    }
    const { data } = await this.db.from('feature_flags').select('*').order('name');
    this.featureFlags.set(data ?? []);
  }

  async loadUsersConfig() {
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<UserConfig>('users_config', { order: 'name' });
      this.usersConfig.set(data ?? []);
      return;
    }
    const { data } = await this.db.from('users_config').select('*').order('name');
    this.usersConfig.set(data ?? []);
  }

  async loadEmailSchedules() {
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<EmailSchedule>('email_schedules', { order: 'name' });
      this.emailSchedules.set(data ?? []);
      return;
    }
    const { data } = await this.db.from('email_schedules').select('*').order('name');
    this.emailSchedules.set(data ?? []);
  }

  async loadEmailLog() {
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<EmailLog>('email_log', {
        order: 'sent_at desc',
        limit: 100,
      });
      this.emailLog.set(data ?? []);
      return;
    }
    const { data } = await this.db.from('email_log').select('*').order('sent_at', { ascending: false }).limit(100);
    this.emailLog.set(data ?? []);
  }

  async loadPaymentRecords(companyId?: string) {
    if (!this.dbSvc.isSupabase()) {
      const filters: Record<string, unknown> = {};
      if (companyId) filters['company_id'] = companyId;
      const { data } = await this.dbSvc.proxyQuery<PaymentRecord>('payment_records', {
        order: 'payment_date desc',
        filters,
      });
      this.paymentRecords.set(data ?? []);
      return;
    }
    const q: any = this.db.from('payment_records').select('*').order('payment_date', { ascending: false });
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.paymentRecords.set(data ?? []);
  }

  async loadNcfSequences(companyId?: string) {
    if (!this.dbSvc.isSupabase()) {
      const filters: Record<string, unknown> = {};
      if (companyId) filters['company_id'] = companyId;
      const { data } = await this.dbSvc.proxyQuery<NcfSequence>('ncf_sequences', {
        order: 'ncf_type',
        filters,
      });
      this.ncfSequences.set(data ?? []);
      return;
    }
    const q: any = this.db.from('ncf_sequences').select('*').order('ncf_type');
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.ncfSequences.set(data ?? []);
  }

  getSetting(key: string): string {
    return this.settings().find(s => s.key === key)?.value ?? '';
  }

  getFlag(name: string): boolean {
    return this.featureFlags().find(f => f.name === name)?.is_enabled ?? false;
  }

  formatCurrency(amount: number, currency = 'DOP'): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try { return new Date(dateStr + 'T00:00:00').toLocaleDateString(); } catch { return dateStr; }
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      partial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      sent: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      void: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    };
    return map[status] ?? 'bg-gray-100 text-gray-800';
  }
}
