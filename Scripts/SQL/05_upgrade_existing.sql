/*
================================================================================
  FacturaPro - SQL Server Upgrade to v2026-05-14
  Run this ONLY on databases already running a previous version.
  Safe to run multiple times (idempotent IF NOT EXISTS guards).
  No RLS - access is controlled at the application layer.
================================================================================
*/

USE [FacturaPro];
GO

-- ────────────────────────────────────────────────────────────
-- companies: logo_url
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('companies') AND name = 'logo_url'
)
BEGIN
  ALTER TABLE companies ADD logo_url NVARCHAR(MAX) NOT NULL DEFAULT '';
END
GO

-- ────────────────────────────────────────────────────────────
-- companies: legal_name
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('companies') AND name = 'legal_name'
)
BEGIN
  ALTER TABLE companies ADD legal_name NVARCHAR(200) NOT NULL DEFAULT '';
END
GO

-- ────────────────────────────────────────────────────────────
-- companies: city
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('companies') AND name = 'city'
)
BEGIN
  ALTER TABLE companies ADD city NVARCHAR(100) NOT NULL DEFAULT '';
END
GO

-- ────────────────────────────────────────────────────────────
-- companies: bank fields
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('companies') AND name = 'bank_beneficiary'
)
BEGIN
  ALTER TABLE companies
    ADD bank_beneficiary   NVARCHAR(200) NOT NULL DEFAULT '',
        bank_name          NVARCHAR(200) NOT NULL DEFAULT '',
        bank_account       NVARCHAR(100) NOT NULL DEFAULT '',
        bank_iban          NVARCHAR(100) NOT NULL DEFAULT '',
        bank_contact       NVARCHAR(200) NOT NULL DEFAULT '',
        bank_contact_tel   NVARCHAR(50)  NOT NULL DEFAULT '',
        bank_contact_email NVARCHAR(200) NOT NULL DEFAULT '';
END
GO

-- ────────────────────────────────────────────────────────────
-- companies: DGII / electronic invoicing fields
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('companies') AND name = 'dgii_auth_number'
)
BEGIN
  ALTER TABLE companies
    ADD dgii_auth_number   NVARCHAR(100) NOT NULL DEFAULT '',
        electronic_enabled BIT           NOT NULL DEFAULT 0,
        electronic_provider NVARCHAR(100) NOT NULL DEFAULT '',
        electronic_api_key  NVARCHAR(MAX) NOT NULL DEFAULT '';
END
GO

-- ────────────────────────────────────────────────────────────
-- companies: SMTP fields
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('companies') AND name = 'smtp_host'
)
BEGIN
  ALTER TABLE companies
    ADD smtp_host     NVARCHAR(200) NOT NULL DEFAULT '',
        smtp_port     INT           NOT NULL DEFAULT 587,
        smtp_user     NVARCHAR(200) NOT NULL DEFAULT '',
        smtp_password NVARCHAR(MAX) NOT NULL DEFAULT '',
        smtp_from     NVARCHAR(200) NOT NULL DEFAULT '',
        smtp_name     NVARCHAR(200) NOT NULL DEFAULT '';
END
GO

-- ────────────────────────────────────────────────────────────
-- clients: email_list, email_body_template
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('clients') AND name = 'email_list'
)
BEGIN
  ALTER TABLE clients
    ADD email_list          NVARCHAR(MAX) NOT NULL DEFAULT '',
        email_body_template NVARCHAR(MAX) NOT NULL DEFAULT '';
END
GO

-- ────────────────────────────────────────────────────────────
-- users_config: preferred_theme / preferred_language / preferred_region
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('users_config') AND name = 'preferred_theme'
)
BEGIN
  ALTER TABLE users_config
    ADD preferred_theme    NVARCHAR(20) NOT NULL DEFAULT 'light',
        preferred_language NVARCHAR(10) NOT NULL DEFAULT 'es',
        preferred_region   NVARCHAR(10) NOT NULL DEFAULT 'DO';
END
GO

-- ────────────────────────────────────────────────────────────
-- users_config: password_hash / auth_provider / supabase_uid
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('users_config') AND name = 'password_hash'
)
BEGIN
  ALTER TABLE users_config
    ADD password_hash NVARCHAR(MAX)   NOT NULL DEFAULT '',
        auth_provider NVARCHAR(20)    NOT NULL DEFAULT 'local',
        supabase_uid  UNIQUEIDENTIFIER NULL;

  CREATE INDEX idx_users_config_supabase_uid
    ON users_config (supabase_uid);
END
GO

-- ────────────────────────────────────────────────────────────
-- payment_records: company_id (backfill from invoices)
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('payment_records') AND name = 'company_id'
)
BEGIN
  ALTER TABLE payment_records
    ADD company_id UNIQUEIDENTIFIER NULL
        CONSTRAINT fk_payment_records_company FOREIGN KEY REFERENCES companies(id);

  UPDATE pr
  SET    pr.company_id = i.company_id
  FROM   payment_records pr
  INNER JOIN invoices i ON i.id = pr.invoice_id
  WHERE  pr.company_id IS NULL;

  CREATE INDEX idx_payment_records_company_id
    ON payment_records (company_id);
END
GO

-- ────────────────────────────────────────────────────────────
-- user_permissions: create if not exists
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_permissions')
BEGIN
  CREATE TABLE user_permissions (
    id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id     UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT fk_up_user FOREIGN KEY REFERENCES users_config(id) ON DELETE CASCADE,
    page        NVARCHAR(100)    NOT NULL,
    can_view    BIT              NOT NULL DEFAULT 0,
    can_create  BIT              NOT NULL DEFAULT 0,
    can_edit    BIT              NOT NULL DEFAULT 0,
    can_delete  BIT              NOT NULL DEFAULT 0,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_user_permissions UNIQUE (user_id, page)
  );
  CREATE INDEX idx_user_permissions_user_id ON user_permissions (user_id);
  CREATE INDEX idx_user_permissions_page    ON user_permissions (page);
END
GO

-- ────────────────────────────────────────────────────────────
-- custom_roles: create if not exists + seed 5 system roles
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'custom_roles')
BEGIN
  CREATE TABLE custom_roles (
    id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name        NVARCHAR(50)     NOT NULL CONSTRAINT uq_custom_roles_name UNIQUE,
    label       NVARCHAR(100)    NOT NULL,
    description NVARCHAR(500)    NOT NULL DEFAULT '',
    color       NVARCHAR(50)     NOT NULL DEFAULT 'slate',
    is_system   BIT              NOT NULL DEFAULT 0,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX idx_custom_roles_name      ON custom_roles (name);
  CREATE INDEX idx_custom_roles_is_system ON custom_roles (is_system);
END
GO

INSERT INTO custom_roles (name, label, description, color, is_system)
SELECT name, label, description, color, is_system FROM (VALUES
  ('admin',     'Administrador', 'Acceso total al sistema',                         'sky',     1),
  ('manager',   'Gerente',       'Gestion operacional sin configuracion avanzada',   'teal',    1),
  ('assistant', 'Asistente',     'Creacion y edicion de documentos basicos',         'emerald', 1),
  ('operator',  'Operador',      'Operaciones de facturacion basica',                'amber',   1),
  ('viewer',    'Visor',         'Solo lectura sobre modulos permitidos',            'slate',   1)
) AS v(name, label, description, color, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM custom_roles cr WHERE cr.name = v.name
);
GO

-- ────────────────────────────────────────────────────────────
-- role_permissions: create if not exists + seed defaults
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions')
BEGIN
  CREATE TABLE role_permissions (
    id          UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    role        NVARCHAR(50)     NOT NULL,
    page        NVARCHAR(100)    NOT NULL,
    can_view    BIT              NOT NULL DEFAULT 0,
    can_create  BIT              NOT NULL DEFAULT 0,
    can_edit    BIT              NOT NULL DEFAULT 0,
    can_delete  BIT              NOT NULL DEFAULT 0,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_role_permissions UNIQUE (role, page)
  );
  CREATE INDEX idx_role_permissions_role ON role_permissions (role);
  CREATE INDEX idx_role_permissions_page ON role_permissions (page);
END
GO

-- Seed role_permissions (admin)
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
SELECT role, page, can_view, can_create, can_edit, can_delete FROM (VALUES
  ('admin','dashboard',    1,1,1,1), ('admin','invoices',   1,1,1,1),
  ('admin','clients',      1,1,1,1), ('admin','products',   1,1,1,1),
  ('admin','payments',     1,1,1,1), ('admin','electronic', 1,1,1,1),
  ('admin','email',        1,1,1,1), ('admin','notifications',1,1,1,1),
  ('admin','analytics',    1,1,1,1), ('admin','admin',      1,1,1,1)
) AS v(role, page, can_view, can_create, can_edit, can_delete)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = v.role AND rp.page = v.page
);
GO

-- Seed role_permissions (manager)
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
SELECT role, page, can_view, can_create, can_edit, can_delete FROM (VALUES
  ('manager','dashboard',    1,1,1,1), ('manager','invoices',   1,1,1,1),
  ('manager','clients',      1,1,1,1), ('manager','products',   1,1,1,1),
  ('manager','payments',     1,1,1,1), ('manager','electronic', 1,1,1,0),
  ('manager','email',        1,1,1,0), ('manager','notifications',1,0,0,0),
  ('manager','analytics',    1,0,0,0), ('manager','admin',      0,0,0,0)
) AS v(role, page, can_view, can_create, can_edit, can_delete)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = v.role AND rp.page = v.page
);
GO

-- Seed role_permissions (assistant)
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
SELECT role, page, can_view, can_create, can_edit, can_delete FROM (VALUES
  ('assistant','dashboard',    1,0,0,0), ('assistant','invoices',   1,1,1,0),
  ('assistant','clients',      1,1,1,0), ('assistant','products',   1,1,1,0),
  ('assistant','payments',     1,1,1,0), ('assistant','electronic', 0,0,0,0),
  ('assistant','email',        1,0,0,0), ('assistant','notifications',1,0,0,0),
  ('assistant','analytics',    0,0,0,0), ('assistant','admin',      0,0,0,0)
) AS v(role, page, can_view, can_create, can_edit, can_delete)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = v.role AND rp.page = v.page
);
GO

-- Seed role_permissions (operator)
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
SELECT role, page, can_view, can_create, can_edit, can_delete FROM (VALUES
  ('operator','dashboard',    1,0,0,0), ('operator','invoices',   1,1,0,0),
  ('operator','clients',      1,1,0,0), ('operator','products',   0,0,0,0),
  ('operator','payments',     1,1,0,0), ('operator','electronic', 0,0,0,0),
  ('operator','email',        0,0,0,0), ('operator','notifications',1,0,0,0),
  ('operator','analytics',    0,0,0,0), ('operator','admin',      0,0,0,0)
) AS v(role, page, can_view, can_create, can_edit, can_delete)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = v.role AND rp.page = v.page
);
GO

-- Seed role_permissions (viewer)
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
SELECT role, page, can_view, can_create, can_edit, can_delete FROM (VALUES
  ('viewer','dashboard',    1,0,0,0), ('viewer','invoices',   1,0,0,0),
  ('viewer','clients',      1,0,0,0), ('viewer','products',   1,0,0,0),
  ('viewer','payments',     1,0,0,0), ('viewer','electronic', 0,0,0,0),
  ('viewer','email',        0,0,0,0), ('viewer','notifications',1,0,0,0),
  ('viewer','analytics',    1,0,0,0), ('viewer','admin',      0,0,0,0)
) AS v(role, page, can_view, can_create, can_edit, can_delete)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role = v.role AND rp.page = v.page
);
GO

-- ────────────────────────────────────────────────────────────
-- users_config: security columns + email_language (v2026-05)
-- ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users_config') AND name='failed_login_attempts')
  ALTER TABLE users_config ADD failed_login_attempts INT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users_config') AND name='locked_until')
  ALTER TABLE users_config ADD locked_until DATETIME2 NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users_config') AND name='must_change_password')
  ALTER TABLE users_config ADD must_change_password BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users_config') AND name='otp_enabled')
  ALTER TABLE users_config ADD otp_enabled BIT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users_config') AND name='temp_password')
  ALTER TABLE users_config ADD temp_password NVARCHAR(MAX) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users_config') AND name='email_language')
  ALTER TABLE users_config ADD email_language NVARCHAR(10) NOT NULL DEFAULT 'es';
GO

-- otp_tokens table
IF OBJECT_ID('otp_tokens', 'U') IS NULL
CREATE TABLE otp_tokens (
    id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() CONSTRAINT PK_otp_tokens PRIMARY KEY,
    user_id     UNIQUEIDENTIFIER NOT NULL,
    email       NVARCHAR(255)    NOT NULL,
    token       NVARCHAR(10)     NOT NULL,
    attempts    INT              NOT NULL DEFAULT 0,
    expires_at  DATETIME2        NOT NULL,
    used        BIT              NOT NULL DEFAULT 0,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_otp_tokens_user FOREIGN KEY (user_id) REFERENCES users_config(id) ON DELETE CASCADE
);
GO

/*
================================================================================
  END OF UPGRADE SCRIPT
================================================================================
*/
