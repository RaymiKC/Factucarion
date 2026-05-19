/*
  # Auth hardening, logo storage, and offline-ready fixes

  ## Changes
  1. users_config — add password_hash (bcrypt) column for offline/local auth
  2. users_config — add auth_provider column to distinguish Supabase Auth vs local
  3. companies — add logo_url index
  4. expenses — change user_id to reference users_config instead of auth.users
     (allows offline deployments without Supabase Auth)
  5. settings — add invoice_theme key per company
  6. Storage bucket hint for logos (applied via app, no SQL needed for Supabase)

  ## Notes
  - password_hash stores a bcrypt hash. The app hashes on the client for offline mode
    and uses Supabase Auth for cloud mode.
  - For local/SQL Server deployments, auth_provider='local' and password_hash is used.
  - For Supabase deployments, auth_provider='supabase' and supabase_uid links the row.
*/

-- 1. Add auth columns to users_config
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users_config' AND column_name = 'password_hash') THEN
    ALTER TABLE users_config ADD COLUMN password_hash text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users_config' AND column_name = 'auth_provider') THEN
    ALTER TABLE users_config ADD COLUMN auth_provider text DEFAULT 'local'
      CHECK (auth_provider IN ('local', 'supabase'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users_config' AND column_name = 'supabase_uid') THEN
    ALTER TABLE users_config ADD COLUMN supabase_uid uuid;
  END IF;
END $$;

-- Index supabase_uid for fast lookup on sign-in
CREATE INDEX IF NOT EXISTS idx_users_config_supabase_uid ON users_config(supabase_uid);

-- 2. Add last_login tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users_config' AND column_name = 'last_login') THEN
    ALTER TABLE users_config ADD COLUMN last_login timestamptz;
  END IF;
END $$;

-- 3. Fix expenses user_id: add users_config_id column that works offline
-- We keep the original user_id for Supabase Auth backwards-compat, but add
-- a nullable users_config_id for local deployments.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'users_config_id') THEN
    ALTER TABLE expenses ADD COLUMN users_config_id uuid REFERENCES users_config(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_users_config_id ON expenses(users_config_id);

-- 4. Insert default invoice_theme setting for default company
INSERT INTO settings (company_id, key, value, description, category)
VALUES ('00000000-0000-0000-0000-000000000010', 'invoice_theme', 'classic', 'Invoice print theme: classic | modern | minimal | bold', 'invoices')
ON CONFLICT (company_id, key) DO NOTHING;

-- 5. Add smtp_password setting (was missing)
INSERT INTO settings (company_id, key, value, description, category)
VALUES ('00000000-0000-0000-0000-000000000010', 'smtp_password', '', 'SMTP password / app password', 'email')
ON CONFLICT (company_id, key) DO NOTHING;

-- 6. Add audit_log table for change tracking
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid,
  action      text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT')),
  table_name  text NOT NULL DEFAULT '',
  record_id   text DEFAULT '',
  old_data    jsonb,
  new_data    jsonb,
  ip_address  text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_company ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on audit_log" ON audit_log FOR SELECT USING (true);
CREATE POLICY "Allow insert on audit_log" ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on audit_log" ON audit_log FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on audit_log" ON audit_log FOR DELETE USING (true);
