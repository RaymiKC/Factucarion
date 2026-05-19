/*
  # Company-User Assignments & Role Expansion

  ## Summary
  Introduces a many-to-many relationship between users and companies so that
  non-admin users can be assigned to one or more companies. Admins retain
  access to all companies automatically; manager and assistant roles see only
  their assigned companies.

  ## New Role Names
  - New canonical values: 'admin' | 'manager' | 'assistant'
  - Existing 'operator' and 'viewer' remain valid (backwards compat)

  ## New Tables
  - `company_users` — junction table linking users to companies with optional role_override.

  ## Notes
  1. Existing users get migrated: each non-admin user gets a company_users entry.
  2. Admins access all companies via app-layer role check (no rows needed).
*/

-- ── 1. Update role check constraint ───────────────────────────────────────────

ALTER TABLE users_config
  DROP CONSTRAINT IF EXISTS users_config_role_check;

ALTER TABLE users_config
  ADD CONSTRAINT users_config_role_check
    CHECK (role IN ('admin', 'manager', 'assistant', 'operator', 'viewer'));

-- ── 2. Create company_users junction table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users_config(id) ON DELETE CASCADE,
  role_override  text CHECK (role_override IN ('manager', 'assistant', 'operator', 'viewer')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS company_users_company_user_unique
  ON company_users (company_id, user_id);

ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow select on company_users') THEN
    CREATE POLICY "Allow select on company_users" ON company_users FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow insert on company_users') THEN
    CREATE POLICY "Allow insert on company_users" ON company_users FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow update on company_users') THEN
    CREATE POLICY "Allow update on company_users" ON company_users FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_users' AND policyname = 'Allow delete on company_users') THEN
    CREATE POLICY "Allow delete on company_users" ON company_users FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users(user_id);

-- ── 3. Migrate existing non-admin users into company_users ────────────────────

INSERT INTO company_users (company_id, user_id)
SELECT uc.company_id, uc.id
FROM users_config uc
WHERE uc.role != 'admin'
  AND uc.company_id IS NOT NULL
ON CONFLICT DO NOTHING;
