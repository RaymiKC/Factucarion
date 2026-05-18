/*
  # Billing System Schema - Full Facturacion System

  ## Overview
  Creates the complete database schema for a billing/invoicing system similar to Alegra Plus.

  ## New Tables

  ### clients
  - Customer/client records with full contact info, tax ID, address

  ### products_services
  - Products and services catalog with pricing and tax configuration

  ### invoices (facturas)
  - Main invoice records with status, dates, totals, and electronic invoicing fields

  ### invoice_items
  - Line items for each invoice (products/services)

  ### notifications
  - System and scheduled email notifications

  ### email_schedules
  - Timed email reminders and automated sends

  ### settings
  - Application configuration and feature flags

  ### users_config
  - User management and enable/disable controls

  ### tax_rates
  - Configurable tax rates (ITBIS, etc.)

  ### payment_records
  - Track payments received against invoices

  ## Security
  - RLS enabled on all tables
  - Policies allow full access (no auth required per user requirement - admin-only dashboard)
*/

-- Tax rates table
CREATE TABLE IF NOT EXISTS tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rate numeric(5,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on tax_rates" ON tax_rates FOR SELECT USING (true);
CREATE POLICY "Allow insert on tax_rates" ON tax_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on tax_rates" ON tax_rates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on tax_rates" ON tax_rates FOR DELETE USING (true);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  rnc text DEFAULT '',
  cedula text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT 'Dominican Republic',
  client_type text DEFAULT 'person' CHECK (client_type IN ('person', 'business')),
  payment_terms integer DEFAULT 30,
  credit_limit numeric(12,2) DEFAULT 0,
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on clients" ON clients FOR SELECT USING (true);
CREATE POLICY "Allow insert on clients" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on clients" ON clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on clients" ON clients FOR DELETE USING (true);

-- Products/Services catalog
CREATE TABLE IF NOT EXISTS products_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text DEFAULT '',
  name text NOT NULL,
  description text DEFAULT '',
  type text DEFAULT 'service' CHECK (type IN ('product', 'service')),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  unit text DEFAULT 'unit',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on products_services" ON products_services FOR SELECT USING (true);
CREATE POLICY "Allow insert on products_services" ON products_services FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on products_services" ON products_services FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on products_services" ON products_services FOR DELETE USING (true);

-- Invoices (Facturas)
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  ncf text DEFAULT '',
  ncf_type text DEFAULT 'B01',
  client_id uuid REFERENCES clients(id),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  payment_date date,
  subtotal numeric(12,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  amount_paid numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'DOP',
  exchange_rate numeric(10,4) DEFAULT 1,
  notes text DEFAULT '',
  terms text DEFAULT '',
  is_electronic boolean DEFAULT false,
  electronic_status text DEFAULT 'pending' CHECK (electronic_status IN ('pending', 'submitted', 'approved', 'rejected')),
  electronic_id text DEFAULT '',
  electronic_response jsonb,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Allow insert on invoices" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on invoices" ON invoices FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on invoices" ON invoices FOR DELETE USING (true);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products_services(id),
  description text NOT NULL,
  quantity numeric(10,3) DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  line_total numeric(12,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on invoice_items" ON invoice_items FOR SELECT USING (true);
CREATE POLICY "Allow insert on invoice_items" ON invoice_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on invoice_items" ON invoice_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on invoice_items" ON invoice_items FOR DELETE USING (true);

-- Payment records
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'check', 'card', 'other')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on payment_records" ON payment_records FOR SELECT USING (true);
CREATE POLICY "Allow insert on payment_records" ON payment_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on payment_records" ON payment_records FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on payment_records" ON payment_records FOR DELETE USING (true);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('invoice_sent', 'payment_received', 'overdue', 'reminder', 'system', 'electronic')),
  title text NOT NULL,
  message text NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Allow insert on notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on notifications" ON notifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on notifications" ON notifications FOR DELETE USING (true);

-- Email schedules (timed emails)
CREATE TABLE IF NOT EXISTS email_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event text NOT NULL CHECK (trigger_event IN ('invoice_due', 'overdue', 'payment_reminder', 'custom')),
  days_offset integer DEFAULT 0,
  subject text NOT NULL,
  body_template text NOT NULL,
  is_active boolean DEFAULT true,
  last_run timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on email_schedules" ON email_schedules FOR SELECT USING (true);
CREATE POLICY "Allow insert on email_schedules" ON email_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on email_schedules" ON email_schedules FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on email_schedules" ON email_schedules FOR DELETE USING (true);

-- Email send log
CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES email_schedules(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at timestamptz DEFAULT now(),
  error_message text DEFAULT ''
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on email_log" ON email_log FOR SELECT USING (true);
CREATE POLICY "Allow insert on email_log" ON email_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on email_log" ON email_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on email_log" ON email_log FOR DELETE USING (true);

-- Application settings
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text DEFAULT '',
  description text DEFAULT '',
  category text DEFAULT 'general',
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Allow insert on settings" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on settings" ON settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on settings" ON settings FOR DELETE USING (true);

-- Users / operators config
CREATE TABLE IF NOT EXISTS users_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
  permissions jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on users_config" ON users_config FOR SELECT USING (true);
CREATE POLICY "Allow insert on users_config" ON users_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on users_config" ON users_config FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on users_config" ON users_config FOR DELETE USING (true);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  is_enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on feature_flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "Allow insert on feature_flags" ON feature_flags FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on feature_flags" ON feature_flags FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on feature_flags" ON feature_flags FOR DELETE USING (true);

-- Seed default data
INSERT INTO tax_rates (name, rate, description) VALUES
  ('ITBIS 18%', 18.00, 'Impuesto sobre Transferencias de Bienes Industrializados y Servicios'),
  ('ITBIS 16%', 16.00, 'ITBIS reducido'),
  ('Exento', 0.00, 'Exento de impuestos')
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value, description, category) VALUES
  ('company_name', 'Mi Empresa S.R.L.', 'Nombre de la empresa', 'company'),
  ('company_rnc', '000000000', 'RNC de la empresa', 'company'),
  ('company_address', 'Santo Domingo, República Dominicana', 'Dirección de la empresa', 'company'),
  ('company_phone', '809-000-0000', 'Teléfono de la empresa', 'company'),
  ('company_email', 'facturacion@miempresa.com', 'Email de facturación', 'company'),
  ('invoice_prefix', 'FAC', 'Prefijo para números de factura', 'invoices'),
  ('next_invoice_number', '1', 'Próximo número de factura', 'invoices'),
  ('currency', 'DOP', 'Moneda por defecto', 'invoices'),
  ('payment_terms', '30', 'Términos de pago por defecto (días)', 'invoices'),
  ('electronic_enabled', 'false', 'Facturación electrónica habilitada', 'electronic'),
  ('electronic_provider', '', 'Proveedor de facturación electrónica', 'electronic'),
  ('electronic_api_key', '', 'API Key del proveedor', 'electronic'),
  ('smtp_host', '', 'Servidor SMTP', 'email'),
  ('smtp_port', '587', 'Puerto SMTP', 'email'),
  ('smtp_user', '', 'Usuario SMTP', 'email'),
  ('smtp_from', '', 'Email remitente', 'email'),
  ('smtp_name', '', 'Nombre remitente', 'email')
ON CONFLICT (key) DO NOTHING;

INSERT INTO feature_flags (name, description, is_enabled) VALUES
  ('electronic_invoicing', 'Facturación Electrónica (e-CF)', true),
  ('email_notifications', 'Notificaciones por email', true),
  ('timed_emails', 'Emails programados automáticos', true),
  ('payment_tracking', 'Seguimiento de pagos', true),
  ('multi_currency', 'Soporte multi-moneda', false),
  ('credit_notes', 'Notas de crédito', true),
  ('recurring_invoices', 'Facturas recurrentes', false),
  ('client_portal', 'Portal del cliente', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO email_schedules (name, trigger_event, days_offset, subject, body_template) VALUES
  ('Recordatorio 7 días antes', 'invoice_due', -7, 'Recordatorio: Factura {{invoice_number}} vence en 7 días', 'Estimado {{client_name}},\n\nLe recordamos que la factura {{invoice_number}} por {{total}} vence el {{due_date}}.\n\nGracias por su preferencia.'),
  ('Recordatorio día de vencimiento', 'invoice_due', 0, 'Factura {{invoice_number}} vence hoy', 'Estimado {{client_name}},\n\nLe informamos que la factura {{invoice_number}} por {{total}} vence el día de hoy.\n\nPor favor realice su pago a la brevedad.'),
  ('Aviso de mora 3 días', 'overdue', 3, 'Factura {{invoice_number}} - Pago pendiente', 'Estimado {{client_name}},\n\nLa factura {{invoice_number}} por {{total}} se encuentra vencida hace 3 días.\n\nPor favor comuníquese con nosotros.')
ON CONFLICT DO NOTHING;

INSERT INTO users_config (name, email, role, is_active) VALUES
  ('Administrador', 'admin@miempresa.com', 'admin', true)
ON CONFLICT (email) DO NOTHING;
