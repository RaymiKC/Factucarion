import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Client, 'id' | 'created_at'>>;
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Invoice, 'id' | 'created_at'>>;
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: Omit<InvoiceItem, 'id' | 'created_at'>;
        Update: Partial<Omit<InvoiceItem, 'id' | 'created_at'>>;
      };
      products_services: {
        Row: ProductService;
        Insert: Omit<ProductService, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductService, 'id' | 'created_at'>>;
      };
      tax_rates: {
        Row: TaxRate;
        Insert: Omit<TaxRate, 'id' | 'created_at'>;
        Update: Partial<Omit<TaxRate, 'id' | 'created_at'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>;
      };
      settings: {
        Row: Setting;
        Insert: Omit<Setting, 'id'>;
        Update: Partial<Omit<Setting, 'id'>>;
      };
      feature_flags: {
        Row: FeatureFlag;
        Insert: Omit<FeatureFlag, 'id'>;
        Update: Partial<Omit<FeatureFlag, 'id'>>;
      };
      users_config: {
        Row: UserConfig;
        Insert: Omit<UserConfig, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserConfig, 'id' | 'created_at'>>;
      };
      email_schedules: {
        Row: EmailSchedule;
        Insert: Omit<EmailSchedule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<EmailSchedule, 'id' | 'created_at'>>;
      };
      email_log: {
        Row: EmailLog;
        Insert: Omit<EmailLog, 'id' | 'sent_at'>;
        Update: Partial<Omit<EmailLog, 'id'>>;
      };
      payment_records: {
        Row: PaymentRecord;
        Insert: Omit<PaymentRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<PaymentRecord, 'id' | 'created_at'>>;
      };
    };
  };
};

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

export interface Client {
  id: string;
  name: string;
  email: string;
  email_list: string;
  email_body_template: string;
  phone: string;
  rnc: string;
  cedula: string;
  address: string;
  city: string;
  country: string;
  client_type: 'person' | 'business';
  payment_terms: number;
  credit_limit: number;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  ncf: string;
  ncf_type: string;
  client_id: string | null;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'void';
  invoice_type: 'one_time' | 'recurring';
  recurrence_rule: 'monthly' | 'bimonthly' | 'quarterly' | 'yearly' | null;
  recurrence_end: string | null;
  parent_invoice_id: string | null;
  issue_date: string;
  due_date: string | null;
  payment_date: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  currency: string;
  exchange_rate: number;
  notes: string;
  terms: string;
  is_electronic: boolean;
  electronic_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  electronic_id: string;
  electronic_response: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  items?: InvoiceItem[];
}

export interface NcfSequence {
  id: string;
  ncf_type: 'B01' | 'B02' | 'B14' | 'B15';
  prefix: string;
  from_seq: number;
  to_seq: number;
  current_seq: number;
  dgii_auth: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NcfVoidLog {
  id: string;
  invoice_id: string | null;
  invoice_number: string;
  ncf: string;
  ncf_type: string;
  issue_month: string;
  cancelled_at: string;
  reuse_allowed: boolean;
  reused_by_invoice_id: string | null;
  notes: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_percent: number;
  discount_amount: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

export interface ProductService {
  id: string;
  code: string;
  name: string;
  description: string;
  type: 'product' | 'service';
  unit_price: number;
  tax_rate_id: string | null;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tax_rate?: TaxRate;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'invoice_sent' | 'payment_received' | 'overdue' | 'reminder' | 'system' | 'electronic';
  title: string;
  message: string;
  invoice_id: string | null;
  client_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
  is_active: boolean;
  updated_at: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  role_override: 'manager' | 'assistant' | 'operator' | 'viewer' | null;
  created_at: string;
}

export interface UserConfig {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'assistant' | 'operator' | 'viewer';
  company_id: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailSchedule {
  id: string;
  name: string;
  trigger_event: 'invoice_due' | 'overdue' | 'payment_reminder' | 'custom';
  days_offset: number;
  subject: string;
  body_template: string;
  is_active: boolean;
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  schedule_id: string | null;
  invoice_id: string | null;
  client_id: string | null;
  to_email: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string;
  error_message: string;
}

export interface PaymentRecord {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: 'cash' | 'transfer' | 'check' | 'card' | 'other';
  payment_date: string;
  reference: string;
  notes: string;
  created_at: string;
}

export interface EcfProviderConfig {
  id: string;
  mode: 'third_party' | 'own_service';
  own_service_url: string;
  own_service_token: string;
  own_service_environment: 'sandbox' | 'production';
  third_party_provider: string;
  third_party_api_key: string;
  ncf_b01_prefix: string;
  ncf_b01_next: number;
  ncf_b01_limit: number;
  ncf_b02_prefix: string;
  ncf_b02_next: number;
  ncf_b02_limit: number;
  ncf_b14_prefix: string;
  ncf_b14_next: number;
  ncf_b14_limit: number;
  webhook_url: string;
  webhook_secret: string;
  auto_submit: boolean;
  retry_on_failure: boolean;
  updated_at: string;
}
