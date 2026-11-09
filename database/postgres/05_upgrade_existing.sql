-- ============================================================
-- FacturaPro - PostgreSQL Upgrade to v2026-05-14
-- Run this ONLY on databases already running a previous version.
-- Safe to run multiple times (idempotent IF NOT EXISTS guards).
-- No RLS is added or enabled anywhere in this script.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- companies: logo_url
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN logo_url text DEFAULT '';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- companies: legal_name
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'legal_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN legal_name text DEFAULT '';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- companies: city
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'city'
  ) THEN
    ALTER TABLE companies ADD COLUMN city text DEFAULT '';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- companies: bank fields
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'bank_beneficiary'
  ) THEN
    ALTER TABLE companies
      ADD COLUMN bank_beneficiary   text DEFAULT '',
      ADD COLUMN bank_name          text DEFAULT '',
      ADD COLUMN bank_account       text DEFAULT '',
      ADD COLUMN bank_iban          text DEFAULT '',
      ADD COLUMN bank_contact       text DEFAULT '',
      ADD COLUMN bank_contact_tel   text DEFAULT '',
      ADD COLUMN bank_contact_email text DEFAULT '';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- companies: DGII / electronic invoicing fields
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'dgii_auth_number'
  ) THEN
    ALTER TABLE companies
      ADD COLUMN dgii_auth_number   text    DEFAULT '',
      ADD COLUMN electronic_enabled boolean DEFAULT false,
      ADD COLUMN electronic_provider text   DEFAULT '',
      ADD COLUMN electronic_api_key  text   DEFAULT '';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- companies: SMTP fields
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'smtp_host'
  ) THEN
    ALTER TABLE companies
      ADD COLUMN smtp_host     text    DEFAULT '',
      ADD COLUMN smtp_port     integer DEFAULT 587,
      ADD COLUMN smtp_user     text    DEFAULT '',
      ADD COLUMN smtp_password text    DEFAULT '',
      ADD COLUMN smtp_from     text    DEFAULT '',
      ADD COLUMN smtp_name     text    DEFAULT '';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- clients: email_list, email_body_template
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'email_list'
  ) THEN
    ALTER TABLE clients
      ADD COLUMN email_list          text DEFAULT '',
      ADD COLUMN email_body_template text DEFAULT '';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- users_config: preferred_theme / preferred_language / preferred_region
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_config' AND column_name = 'preferred_theme'
  ) THEN
    ALTER TABLE users_config
      ADD COLUMN preferred_theme    text DEFAULT 'light',
      ADD COLUMN preferred_language text DEFAULT 'es',
      ADD COLUMN preferred_region   text DEFAULT 'DO';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- users_config: password_hash / auth_provider
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_config' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users_config
      ADD COLUMN password_hash text DEFAULT '',
      ADD COLUMN auth_provider text DEFAULT 'local';
  END IF;
END $$;

-- Drop the Supabase auth linkage column (auth is now handled by the API)
ALTER TABLE users_config DROP COLUMN IF EXISTS supabase_uid;

-- ────────────────────────────────────────────────────────────
-- payment_records: company_id (backfill from invoices)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_records' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE payment_records
      ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

    UPDATE payment_records pr
    SET    company_id = i.company_id
    FROM   invoices i
    WHERE  i.id = pr.invoice_id
      AND  pr.company_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_payment_records_company_id
      ON payment_records(company_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- user_permissions: create if not exists
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users_config(id) ON DELETE CASCADE,
  page       text        NOT NULL,
  can_view   boolean     NOT NULL DEFAULT false,
  can_create boolean     NOT NULL DEFAULT false,
  can_edit   boolean     NOT NULL DEFAULT false,
  can_delete boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, page)
);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page    ON user_permissions(page);

-- ────────────────────────────────────────────────────────────
-- custom_roles: create if not exists + seed 5 system roles
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        UNIQUE NOT NULL,
  label       text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  color       text        NOT NULL DEFAULT 'slate',
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name      ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_is_system ON custom_roles(is_system);

INSERT INTO custom_roles (name, label, description, color, is_system)
VALUES
  ('admin',     'Administrador', 'Acceso total al sistema',                          'sky',     true),
  ('manager',   'Gerente',       'Gestion operacional sin configuracion avanzada',    'teal',    true),
  ('assistant', 'Asistente',     'Creacion y edicion de documentos basicos',          'emerald', true),
  ('operator',  'Operador',      'Operaciones de facturacion basica',                 'amber',   true),
  ('viewer',    'Visor',         'Solo lectura sobre modulos permitidos',             'slate',   true)
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- role_permissions: create if not exists + seed defaults
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role        text        NOT NULL,
  page        text        NOT NULL,
  can_view    boolean     NOT NULL DEFAULT false,
  can_create  boolean     NOT NULL DEFAULT false,
  can_edit    boolean     NOT NULL DEFAULT false,
  can_delete  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, page)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_page ON role_permissions(page);

-- admin: full access
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
VALUES
  ('admin', 'dashboard',     true, true, true, true),
  ('admin', 'invoices',      true, true, true, true),
  ('admin', 'clients',       true, true, true, true),
  ('admin', 'products',      true, true, true, true),
  ('admin', 'payments',      true, true, true, true),
  ('admin', 'electronic',    true, true, true, true),
  ('admin', 'email',         true, true, true, true),
  ('admin', 'notifications', true, true, true, true),
  ('admin', 'analytics',     true, true, true, true),
  ('admin', 'admin',         true, true, true, true)
ON CONFLICT (role, page) DO NOTHING;

-- manager: no admin page; no delete on some modules
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
VALUES
  ('manager', 'dashboard',     true,  true,  true,  true),
  ('manager', 'invoices',      true,  true,  true,  true),
  ('manager', 'clients',       true,  true,  true,  true),
  ('manager', 'products',      true,  true,  true,  true),
  ('manager', 'payments',      true,  true,  true,  true),
  ('manager', 'electronic',    true,  true,  true,  false),
  ('manager', 'email',         true,  true,  true,  false),
  ('manager', 'notifications', true,  false, false, false),
  ('manager', 'analytics',     true,  false, false, false),
  ('manager', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- assistant: create+edit, no delete, no admin/electronic/analytics
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
VALUES
  ('assistant', 'dashboard',     true,  false, false, false),
  ('assistant', 'invoices',      true,  true,  true,  false),
  ('assistant', 'clients',       true,  true,  true,  false),
  ('assistant', 'products',      true,  true,  true,  false),
  ('assistant', 'payments',      true,  true,  true,  false),
  ('assistant', 'electronic',    false, false, false, false),
  ('assistant', 'email',         true,  false, false, false),
  ('assistant', 'notifications', true,  false, false, false),
  ('assistant', 'analytics',     false, false, false, false),
  ('assistant', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- operator: invoices/clients/payments only
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
VALUES
  ('operator', 'dashboard',     true,  false, false, false),
  ('operator', 'invoices',      true,  true,  false, false),
  ('operator', 'clients',       true,  true,  false, false),
  ('operator', 'products',      false, false, false, false),
  ('operator', 'payments',      true,  true,  false, false),
  ('operator', 'electronic',    false, false, false, false),
  ('operator', 'email',         false, false, false, false),
  ('operator', 'notifications', true,  false, false, false),
  ('operator', 'analytics',     false, false, false, false),
  ('operator', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- viewer: read-only
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
VALUES
  ('viewer', 'dashboard',     true,  false, false, false),
  ('viewer', 'invoices',      true,  false, false, false),
  ('viewer', 'clients',       true,  false, false, false),
  ('viewer', 'products',      true,  false, false, false),
  ('viewer', 'payments',      true,  false, false, false),
  ('viewer', 'electronic',    false, false, false, false),
  ('viewer', 'email',         false, false, false, false),
  ('viewer', 'notifications', true,  false, false, false),
  ('viewer', 'analytics',     true,  false, false, false),
  ('viewer', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- DISABLE RLS on every table in the public schema.
-- This script intentionally does NOT use RLS; access is
-- controlled at the application/API layer.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM   pg_tables
    WHERE  schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- users_config: security columns + email_language (v2026-05)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='failed_login_attempts') THEN
    ALTER TABLE users_config ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='locked_until') THEN
    ALTER TABLE users_config ADD COLUMN locked_until TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='must_change_password') THEN
    ALTER TABLE users_config ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='otp_enabled') THEN
    ALTER TABLE users_config ADD COLUMN otp_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='temp_password') THEN
    ALTER TABLE users_config ADD COLUMN temp_password TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='email_language') THEN
    ALTER TABLE users_config ADD COLUMN email_language TEXT NOT NULL DEFAULT 'es';
  END IF;
END $$;

-- otp_tokens table
CREATE TABLE IF NOT EXISTS otp_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users_config(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL,
    token       TEXT        NOT NULL,
    attempts    INT         NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id    ON otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires_at ON otp_tokens(expires_at);

-- Add otp_required_for_all feature flag if not present
INSERT INTO feature_flags (name, description, is_enabled)
VALUES ('otp_required_for_all', 'Require OTP verification for all users on every login', false)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- END OF UPGRADE SCRIPT
-- ============================================================
