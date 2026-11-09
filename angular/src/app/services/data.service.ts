import { Injectable, signal } from '@angular/core';
import { DbService } from './db.service';
import {
  Client, Invoice, ProductService, TaxRate, Notification, Setting,
  FeatureFlag, UserConfig, EmailSchedule, EmailLog, PaymentRecord, NcfSequence,
} from './models';

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

  constructor(private dbSvc: DbService) {}

  get db() { return this.dbSvc.client; }

  async loadAll(companyId?: string) {
    await Promise.all([
      this.loadClients(companyId), this.loadInvoices(companyId), this.loadProducts(),
      this.loadTaxRates(), this.loadNotifications(), this.loadSettings(companyId),
      this.loadFeatureFlags(), this.loadUsersConfig(), this.loadEmailSchedules(),
      this.loadPaymentRecords(companyId), this.loadNcfSequences(companyId),
    ]);
  }

  async loadClients(companyId?: string) {
    const q: any = this.db.from('clients').select('*').order('name');
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.clients.set(data ?? []);
  }

  async loadInvoices(companyId?: string) {
    const q: any = this.db
      .from('invoices')
      .select('*, client:clients(name,email,rnc,cedula,client_type)')
      .order('created_at', { ascending: false });
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.invoices.set(data ?? []);
  }

  async loadProducts() {
    const { data } = await this.db.from('products_services').select('*, tax_rate:tax_rates(*)').order('name');
    this.products.set(data ?? []);
  }

  async loadTaxRates() {
    const { data } = await this.db.from('tax_rates').select('*').order('name');
    this.taxRates.set(data ?? []);
  }

  async loadNotifications() {
    const { data } = await this.db.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    this.notifications.set(data ?? []);
  }

  async loadSettings(companyId?: string) {
    const q: any = this.db.from('settings').select('*').eq('is_active', true).order('key');
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.settings.set(data ?? []);
  }

  async loadFeatureFlags(companyId?: string) {
    const q: any = this.db.from('feature_flags').select('*').order('name');
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.featureFlags.set(data ?? []);
  }

  async loadUsersConfig(companyId?: string) {
    const q: any = this.db.from('users_config').select('*').order('name');
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.usersConfig.set(data ?? []);
  }

  async loadEmailSchedules(companyId?: string) {
    const q: any = this.db.from('email_schedules').select('*').order('name');
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.emailSchedules.set(data ?? []);
  }

  async loadEmailLog() {
    const { data } = await this.db.from('email_log').select('*').order('sent_at', { ascending: false }).limit(100);
    this.emailLog.set(data ?? []);
  }

  async loadPaymentRecords(companyId?: string) {
    const q: any = this.db.from('payment_records').select('*').order('payment_date', { ascending: false });
    const { data } = companyId ? await q.eq('company_id', companyId) : await q;
    this.paymentRecords.set(data ?? []);
  }

  async loadNcfSequences(companyId?: string) {
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
