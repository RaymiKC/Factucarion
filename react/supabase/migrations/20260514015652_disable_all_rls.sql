/*
  # Disable RLS on all application tables

  ## Overview
  Remove Row Level Security from all tables. The application uses its own
  auth layer and the Supabase anon key; RLS adds no security benefit here
  and complicates development and debugging.

  ## Tables affected
  All application tables have RLS disabled and all policies dropped.
*/

-- ── Disable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE companies           DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients             DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items       DISABLE ROW LEVEL SECURITY;
ALTER TABLE products_services   DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates           DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records     DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings            DISABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags       DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_schedules     DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_log           DISABLE ROW LEVEL SECURITY;
ALTER TABLE users_config        DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_users       DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles        DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ncf_sequences') THEN
    ALTER TABLE ncf_sequences DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ncf_void_log') THEN
    ALTER TABLE ncf_void_log DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ecf_provider_config') THEN
    ALTER TABLE ecf_provider_config DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recurring_invoices') THEN
    ALTER TABLE recurring_invoices DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ── Drop all policies ─────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;
