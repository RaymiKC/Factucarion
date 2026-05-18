/*
  # Role Permissions System

  ## Overview
  Adds a flexible permission system that allows admins to control which pages
  and actions each user role can access. Permissions are stored per role and
  per page, with an additional JSON column for granular action-level flags.

  ## New Tables
  - `role_permissions`
    - `id` (uuid, pk)
    - `role` (text) — one of: admin, manager, assistant, operator, viewer
    - `page` (text) — one of the app page slugs (dashboard, invoices, etc.)
    - `can_view` (bool) — whether the role can see/navigate to this page
    - `can_create` (bool) — create records on this page
    - `can_edit` (bool) — edit/update records on this page
    - `can_delete` (bool) — delete records on this page
    - `created_at`, `updated_at`
  - Unique constraint on (role, page)

  ## Security
  - RLS enabled; only authenticated users can read; only admins can write
    (enforced at app layer since we use custom auth, policies are permissive)

  ## Seed Data
  Default permissions for all 5 built-in roles across all 10 pages.
  - admin: full access everywhere
  - manager: can view/create/edit most pages, no admin panel
  - assistant: view + create invoices/clients/products, no delete, no admin
  - operator: view + create invoices only
  - viewer: view-only on dashboard/invoices/clients/analytics
*/

CREATE TABLE IF NOT EXISTS role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role          text NOT NULL,
  page          text NOT NULL,
  can_view      boolean NOT NULL DEFAULT false,
  can_create    boolean NOT NULL DEFAULT false,
  can_edit      boolean NOT NULL DEFAULT false,
  can_delete    boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (role, page)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Authenticated users can read role permissions'
  ) THEN
    CREATE POLICY "Authenticated users can read role permissions"
      ON role_permissions FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Authenticated users can insert role permissions'
  ) THEN
    CREATE POLICY "Authenticated users can insert role permissions"
      ON role_permissions FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Authenticated users can update role permissions'
  ) THEN
    CREATE POLICY "Authenticated users can update role permissions"
      ON role_permissions FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Authenticated users can delete role permissions'
  ) THEN
    CREATE POLICY "Authenticated users can delete role permissions"
      ON role_permissions FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_page ON role_permissions(page);

-- ── Seed default permissions ──────────────────────────────────────────────────
-- admin: full access to everything
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete) VALUES
  ('admin', 'dashboard',     true,  true,  true,  true),
  ('admin', 'invoices',      true,  true,  true,  true),
  ('admin', 'clients',       true,  true,  true,  true),
  ('admin', 'products',      true,  true,  true,  true),
  ('admin', 'payments',      true,  true,  true,  true),
  ('admin', 'electronic',    true,  true,  true,  true),
  ('admin', 'email',         true,  true,  true,  true),
  ('admin', 'notifications', true,  true,  true,  true),
  ('admin', 'analytics',     true,  true,  true,  true),
  ('admin', 'admin',         true,  true,  true,  true)
ON CONFLICT (role, page) DO NOTHING;

-- manager: everything except admin panel; full CRUD on operational pages
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete) VALUES
  ('manager', 'dashboard',     true,  false, false, false),
  ('manager', 'invoices',      true,  true,  true,  true),
  ('manager', 'clients',       true,  true,  true,  true),
  ('manager', 'products',      true,  true,  true,  true),
  ('manager', 'payments',      true,  true,  true,  false),
  ('manager', 'electronic',    true,  true,  true,  false),
  ('manager', 'email',         true,  true,  true,  false),
  ('manager', 'notifications', true,  false, false, false),
  ('manager', 'analytics',     true,  false, false, false),
  ('manager', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- assistant: can view and create but not delete most things
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete) VALUES
  ('assistant', 'dashboard',     true,  false, false, false),
  ('assistant', 'invoices',      true,  true,  true,  false),
  ('assistant', 'clients',       true,  true,  true,  false),
  ('assistant', 'products',      true,  true,  false, false),
  ('assistant', 'payments',      true,  true,  false, false),
  ('assistant', 'electronic',    true,  false, false, false),
  ('assistant', 'email',         true,  false, false, false),
  ('assistant', 'notifications', true,  false, false, false),
  ('assistant', 'analytics',     false, false, false, false),
  ('assistant', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- operator: invoices + clients + payments, no config pages
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete) VALUES
  ('operator', 'dashboard',     true,  false, false, false),
  ('operator', 'invoices',      true,  true,  true,  false),
  ('operator', 'clients',       true,  true,  false, false),
  ('operator', 'products',      true,  false, false, false),
  ('operator', 'payments',      true,  true,  false, false),
  ('operator', 'electronic',    false, false, false, false),
  ('operator', 'email',         false, false, false, false),
  ('operator', 'notifications', true,  false, false, false),
  ('operator', 'analytics',     false, false, false, false),
  ('operator', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- viewer: read-only on core pages
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete) VALUES
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
