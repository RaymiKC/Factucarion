/*
  # Multi-Company (Multi-Empresa) Support

  ## Summary
  Converts the application from single-tenant to multi-tenant by introducing a
  `companies` table and adding a `company_id` foreign key to every data table
  that holds per-company records.

  ## New Tables
  - `companies` — Master list of empresas

  ## Modified Tables (company_id added)
  - clients, invoices, products_services, tax_rates, ncf_sequences,
    expenses, email_schedules, feature_flags, settings, users_config,
    ecf_provider_config

  ## Notes
  - A default "Demo Company" row is inserted so existing data is adopted.
  - All ADD COLUMN statements are guarded with IF NOT EXISTS.
  - settings gets a composite unique constraint (company_id, key).
*/

-- ── 1. Create companies table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT '',
  rnc         text NOT NULL DEFAULT '',
  address     text NOT NULL DEFAULT '',
  phone       text NOT NULL DEFAULT '',
  email       text NOT NULL DEFAULT '',
  country     text NOT NULL DEFAULT 'DO',
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow all on companies') THEN
    CREATE POLICY "Allow all on companies" ON companies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow insert on companies') THEN
    CREATE POLICY "Allow insert on companies" ON companies FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow update on companies') THEN
    CREATE POLICY "Allow update on companies" ON companies FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow delete on companies') THEN
    CREATE POLICY "Allow delete on companies" ON companies FOR DELETE USING (true);
  END IF;
END $$;

-- ── 2. Insert default company ─────────────────────────────────────────────────

INSERT INTO companies (id, name, rnc, is_active)
VALUES ('00000000-0000-0000-0000-000000000010', 'Demo Company', '000000000', true)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Add company_id to every data table ────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'company_id') THEN
    ALTER TABLE clients ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE clients SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE clients ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'company_id') THEN
    ALTER TABLE invoices ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE invoices SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE invoices ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products_services' AND column_name = 'company_id') THEN
    ALTER TABLE products_services ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE products_services SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE products_services ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tax_rates' AND column_name = 'company_id') THEN
    ALTER TABLE tax_rates ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE tax_rates SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE tax_rates ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ncf_sequences' AND column_name = 'company_id') THEN
    ALTER TABLE ncf_sequences ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE ncf_sequences SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE ncf_sequences ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'company_id') THEN
    ALTER TABLE expenses ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE expenses SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE expenses ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_schedules' AND column_name = 'company_id') THEN
    ALTER TABLE email_schedules ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE email_schedules SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE email_schedules ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feature_flags' AND column_name = 'company_id') THEN
    ALTER TABLE feature_flags ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE feature_flags SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE feature_flags ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'company_id') THEN
    ALTER TABLE settings ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE settings SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE settings ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- Drop old unique constraint on settings(key), add composite one
DO $$
BEGIN
  ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
  ALTER TABLE settings DROP CONSTRAINT IF EXISTS unique_settings_key;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'settings' AND constraint_name = 'settings_company_key_unique'
  ) THEN
    ALTER TABLE settings ADD CONSTRAINT settings_company_key_unique UNIQUE (company_id, key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users_config' AND column_name = 'company_id') THEN
    ALTER TABLE users_config ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE users_config SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE users_config ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ecf_provider_config' AND column_name = 'company_id') THEN
    ALTER TABLE ecf_provider_config ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000010';
    UPDATE ecf_provider_config SET company_id = '00000000-0000-0000-0000-000000000010' WHERE company_id IS NULL;
    ALTER TABLE ecf_provider_config ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON products_services(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_company ON tax_rates(company_id);
CREATE INDEX IF NOT EXISTS idx_ncf_sequences_company ON ncf_sequences(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_email_schedules_company ON email_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_company ON feature_flags(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_users_config_company ON users_config(company_id);
