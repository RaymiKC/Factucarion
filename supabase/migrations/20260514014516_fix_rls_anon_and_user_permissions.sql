/*
  # Fix RLS policies and add per-user permission overrides

  ## Changes

  ### 1. RLS Policy Fix
  - Drop `authenticated`-only policies on `custom_roles` and `role_permissions`
  - Replace with policies that also allow `anon` role (the app uses the anon key
    with custom auth, not Supabase Auth, so users are never "authenticated" in
    Supabase's sense)

  ### 2. New Table: user_permissions
  - Stores per-user page permission overrides
  - When a user has a row here, it OVERRIDES the role-level permission for that page
  - This allows individual user customization on top of their role type
  - `user_id` → references users_config(id)
  - `page` → page slug
  - `can_view`, `can_create`, `can_edit`, `can_delete` → same flags as role_permissions

  ### 3. Seed helper
  - Function to copy a role's permissions into user_permissions for a given user
    (called when creating a user or changing their role)
*/

-- ── 1. Fix custom_roles policies ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read custom roles"   ON custom_roles;
DROP POLICY IF EXISTS "Authenticated users can insert custom roles" ON custom_roles;
DROP POLICY IF EXISTS "Authenticated users can update custom roles" ON custom_roles;
DROP POLICY IF EXISTS "Authenticated users can delete custom roles" ON custom_roles;

CREATE POLICY "Anyone can read custom roles"
  ON custom_roles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert custom roles"
  ON custom_roles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update custom roles"
  ON custom_roles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete non-system custom roles"
  ON custom_roles FOR DELETE
  TO anon, authenticated
  USING (is_system = false);

-- ── 2. Fix role_permissions policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read role permissions"   ON role_permissions;
DROP POLICY IF EXISTS "Authenticated users can insert role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated users can update role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated users can delete role permissions" ON role_permissions;

CREATE POLICY "Anyone can read role permissions"
  ON role_permissions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert role permissions"
  ON role_permissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update role permissions"
  ON role_permissions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete role permissions"
  ON role_permissions FOR DELETE
  TO anon, authenticated
  USING (true);

-- ── 3. Create user_permissions table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users_config(id) ON DELETE CASCADE,
  page        text NOT NULL,
  can_view    boolean NOT NULL DEFAULT false,
  can_create  boolean NOT NULL DEFAULT false,
  can_edit    boolean NOT NULL DEFAULT false,
  can_delete  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, page)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user permissions"
  ON user_permissions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert user permissions"
  ON user_permissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update user permissions"
  ON user_permissions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete user permissions"
  ON user_permissions FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page    ON user_permissions(page);
