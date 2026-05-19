/*
  # Custom Roles

  ## Overview
  Allows admins to create, edit, rename, and delete custom user role types beyond
  the five built-in roles. Custom roles get their own rows in role_permissions.

  ## New Tables
  - `custom_roles`
    - `id` (uuid, pk)
    - `name` (text, unique) — slug used as the role key in role_permissions
    - `label` (text) — display name shown in the UI
    - `description` (text) — optional description of the role's purpose
    - `color` (text) — tailwind color token for visual badge (e.g. 'rose', 'violet')
    - `is_system` (bool) — true for the five built-in roles; prevents deletion
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled; authenticated users can read; write guarded at app layer (admin only)

  ## Seed Data
  The five built-in roles are inserted as system rows so they appear in the role
  management panel but cannot be deleted.
*/

CREATE TABLE IF NOT EXISTS custom_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  label       text NOT NULL,
  description text NOT NULL DEFAULT '',
  color       text NOT NULL DEFAULT 'slate',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'Authenticated users can read custom roles'
  ) THEN
    CREATE POLICY "Authenticated users can read custom roles"
      ON custom_roles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'Authenticated users can insert custom roles'
  ) THEN
    CREATE POLICY "Authenticated users can insert custom roles"
      ON custom_roles FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'Authenticated users can update custom roles'
  ) THEN
    CREATE POLICY "Authenticated users can update custom roles"
      ON custom_roles FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'Authenticated users can delete custom roles'
  ) THEN
    CREATE POLICY "Authenticated users can delete custom roles"
      ON custom_roles FOR DELETE
      TO authenticated
      USING (is_system = false);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);

-- Seed built-in system roles
INSERT INTO custom_roles (name, label, description, color, is_system) VALUES
  ('admin',     'Administrador', 'Acceso total al sistema. No puede modificarse.',                              'sky',     true),
  ('manager',   'Gerente',       'Gestiona empresas asignadas con acceso operacional completo.',                 'teal',    true),
  ('assistant', 'Asistente',     'Soporte en empresas asignadas. Puede crear pero no eliminar.',                'emerald', true),
  ('operator',  'Operador',      'Operaciones del día a día: facturas, clientes y pagos.',                      'amber',   true),
  ('viewer',    'Visor',         'Solo lectura. No puede crear ni modificar nada.',                             'slate',   true)
ON CONFLICT (name) DO NOTHING;
