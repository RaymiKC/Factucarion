-- FacturaPro - Complete PostgreSQL Schema v2026-05-14
-- ============================================================
-- No RLS, no policies. Plain tables, indexes, and seed data.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
    id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT            NOT NULL DEFAULT '',
    legal_name            TEXT            NOT NULL DEFAULT '',
    rnc                   TEXT            NOT NULL DEFAULT '',
    address               TEXT            NOT NULL DEFAULT '',
    city                  TEXT            NOT NULL DEFAULT '',
    country               TEXT            NOT NULL DEFAULT 'Dominican Republic',
    phone                 TEXT            NOT NULL DEFAULT '',
    email                 TEXT            NOT NULL DEFAULT '',
    website               TEXT            NOT NULL DEFAULT '',
    logo_url              TEXT            NOT NULL DEFAULT '',
    currency              TEXT            NOT NULL DEFAULT 'DOP',
    invoice_prefix        TEXT            NOT NULL DEFAULT 'FAC',
    next_invoice_number   INT             NOT NULL DEFAULT 1,
    payment_terms         INT             NOT NULL DEFAULT 30,
    bank_beneficiary      TEXT            NOT NULL DEFAULT '',
    bank_name             TEXT            NOT NULL DEFAULT '',
    bank_account          TEXT            NOT NULL DEFAULT '',
    bank_iban             TEXT            NOT NULL DEFAULT '',
    bank_contact          TEXT            NOT NULL DEFAULT '',
    bank_contact_tel      TEXT            NOT NULL DEFAULT '',
    bank_contact_email    TEXT            NOT NULL DEFAULT '',
    dgii_auth_number      TEXT            NOT NULL DEFAULT '',
    electronic_enabled    BOOLEAN         NOT NULL DEFAULT false,
    electronic_provider   TEXT            NOT NULL DEFAULT '',
    electronic_api_key    TEXT            NOT NULL DEFAULT '',
    smtp_host             TEXT            NOT NULL DEFAULT '',
    smtp_port             INT             NOT NULL DEFAULT 587,
    smtp_user             TEXT            NOT NULL DEFAULT '',
    smtp_password         TEXT            NOT NULL DEFAULT '',
    smtp_from             TEXT            NOT NULL DEFAULT '',
    smtp_name             TEXT            NOT NULL DEFAULT '',
    is_active             BOOLEAN         NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: tax_rates
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_rates (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    rate          NUMERIC     NOT NULL DEFAULT 0,
    description   TEXT        NOT NULL DEFAULT '',
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_company_id ON tax_rates(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_is_active   ON tax_rates(is_active);

-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                  TEXT        NOT NULL,
    email                 TEXT        NOT NULL DEFAULT '',
    phone                 TEXT        NOT NULL DEFAULT '',
    rnc                   TEXT        NOT NULL DEFAULT '',
    cedula                TEXT        NOT NULL DEFAULT '',
    address               TEXT        NOT NULL DEFAULT '',
    city                  TEXT        NOT NULL DEFAULT '',
    country               TEXT        NOT NULL DEFAULT 'Dominican Republic',
    client_type           TEXT        NOT NULL DEFAULT 'person',
    payment_terms         INT         NOT NULL DEFAULT 30,
    credit_limit          NUMERIC     NOT NULL DEFAULT 0,
    notes                 TEXT        NOT NULL DEFAULT '',
    email_list            TEXT        NOT NULL DEFAULT '',
    email_body_template   TEXT        NOT NULL DEFAULT '',
    is_active             BOOLEAN     NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_email      ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_is_active  ON clients(is_active);

-- ============================================================
-- TABLE: products_services
-- ============================================================
CREATE TABLE IF NOT EXISTS products_services (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code          TEXT        NOT NULL DEFAULT '',
    name          TEXT        NOT NULL,
    description   TEXT        NOT NULL DEFAULT '',
    type          TEXT        NOT NULL DEFAULT 'service',
    unit_price    NUMERIC     NOT NULL DEFAULT 0,
    tax_rate_id   UUID        REFERENCES tax_rates(id) ON DELETE SET NULL,
    unit          TEXT        NOT NULL DEFAULT 'unit',
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_services_company_id  ON products_services(company_id);
CREATE INDEX IF NOT EXISTS idx_products_services_tax_rate_id ON products_services(tax_rate_id);
CREATE INDEX IF NOT EXISTS idx_products_services_is_active   ON products_services(is_active);
CREATE INDEX IF NOT EXISTS idx_products_services_code        ON products_services(code);

-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_number        TEXT        NOT NULL,
    ncf                   TEXT        NOT NULL DEFAULT '',
    ncf_type              TEXT        NOT NULL DEFAULT 'B01',
    client_id             UUID        NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    status                TEXT        NOT NULL DEFAULT 'draft',
    invoice_type          TEXT        NOT NULL DEFAULT 'one_time',
    issue_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
    due_date              DATE,
    payment_date          DATE,
    subtotal              NUMERIC     NOT NULL DEFAULT 0,
    tax_amount            NUMERIC     NOT NULL DEFAULT 0,
    discount_amount       NUMERIC     NOT NULL DEFAULT 0,
    total                 NUMERIC     NOT NULL DEFAULT 0,
    amount_paid           NUMERIC     NOT NULL DEFAULT 0,
    currency              TEXT        NOT NULL DEFAULT 'DOP',
    exchange_rate         NUMERIC     NOT NULL DEFAULT 1,
    notes                 TEXT        NOT NULL DEFAULT '',
    terms                 TEXT        NOT NULL DEFAULT '',
    is_electronic         BOOLEAN     NOT NULL DEFAULT false,
    electronic_status     TEXT        NOT NULL DEFAULT 'pending',
    electronic_id         TEXT        NOT NULL DEFAULT '',
    electronic_response   JSONB,
    recurrence_rule       TEXT        DEFAULT '',
    recurrence_end        DATE,
    parent_invoice_id     UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    sent_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id        ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id         ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status            ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number    ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date        ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date          ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice_id ON invoices(parent_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_ncf               ON invoices(ncf);

-- ============================================================
-- TABLE: invoice_items
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id       UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id       UUID        REFERENCES products_services(id) ON DELETE SET NULL,
    description      TEXT        NOT NULL,
    quantity         NUMERIC     NOT NULL DEFAULT 1,
    unit_price       NUMERIC     NOT NULL DEFAULT 0,
    tax_rate         NUMERIC     NOT NULL DEFAULT 0,
    tax_amount       NUMERIC     NOT NULL DEFAULT 0,
    discount_percent NUMERIC     NOT NULL DEFAULT 0,
    discount_amount  NUMERIC     NOT NULL DEFAULT 0,
    line_total       NUMERIC     NOT NULL DEFAULT 0,
    sort_order       INT         NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);

-- ============================================================
-- TABLE: payment_records
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_records (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id     UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount         NUMERIC     NOT NULL,
    payment_method TEXT        NOT NULL DEFAULT 'cash',
    payment_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    reference      TEXT        NOT NULL DEFAULT '',
    notes          TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_company_id   ON payment_records(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_id   ON payment_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_date ON payment_records(payment_date);

-- ============================================================
-- TABLE: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    key         TEXT        NOT NULL,
    value       TEXT        NOT NULL DEFAULT '',
    description TEXT        NOT NULL DEFAULT '',
    category    TEXT        NOT NULL DEFAULT 'general',
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_company_id ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_key        ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category   ON settings(category);

-- ============================================================
-- TABLE: feature_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    is_enabled  BOOLEAN     NOT NULL DEFAULT true,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_company_id ON feature_flags(company_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_name       ON feature_flags(name);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    message     TEXT        NOT NULL,
    invoice_id  UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    client_id   UUID        REFERENCES clients(id) ON DELETE SET NULL,
    is_read     BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_invoice_id ON notifications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_notifications_client_id  ON notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type       ON notifications(type);

-- ============================================================
-- TABLE: ncf_sequences
-- ============================================================
CREATE TABLE IF NOT EXISTS ncf_sequences (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ncf_type    TEXT        NOT NULL,
    prefix      TEXT        NOT NULL DEFAULT '',
    from_seq    INT         NOT NULL DEFAULT 1,
    to_seq      INT         NOT NULL DEFAULT 1,
    current_seq INT         NOT NULL DEFAULT 1,
    dgii_auth   TEXT        NOT NULL DEFAULT '',
    expires_at  DATE,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ncf_sequences_company_id ON ncf_sequences(company_id);
CREATE INDEX IF NOT EXISTS idx_ncf_sequences_ncf_type   ON ncf_sequences(ncf_type);
CREATE INDEX IF NOT EXISTS idx_ncf_sequences_is_active  ON ncf_sequences(is_active);

-- ============================================================
-- TABLE: ncf_void_log
-- ============================================================
CREATE TABLE IF NOT EXISTS ncf_void_log (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id            UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    invoice_number        TEXT        NOT NULL DEFAULT '',
    ncf                   TEXT        NOT NULL DEFAULT '',
    ncf_type              TEXT        NOT NULL DEFAULT '',
    issue_month           TEXT        NOT NULL DEFAULT '',
    cancelled_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    reuse_allowed         BOOLEAN     NOT NULL DEFAULT false,
    reused_by_invoice_id  UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    notes                 TEXT        NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ncf_void_log_company_id ON ncf_void_log(company_id);
CREATE INDEX IF NOT EXISTS idx_ncf_void_log_invoice_id ON ncf_void_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ncf_void_log_ncf        ON ncf_void_log(ncf);

-- ============================================================
-- TABLE: email_schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS email_schedules (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name           TEXT        NOT NULL,
    trigger_event  TEXT        NOT NULL,
    days_offset    INT         NOT NULL DEFAULT 0,
    subject        TEXT        NOT NULL,
    body_template  TEXT        NOT NULL,
    is_active      BOOLEAN     NOT NULL DEFAULT true,
    last_run       TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_schedules_company_id    ON email_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_email_schedules_trigger_event ON email_schedules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_email_schedules_is_active     ON email_schedules(is_active);

-- ============================================================
-- TABLE: email_log
-- ============================================================
CREATE TABLE IF NOT EXISTS email_log (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    schedule_id   UUID        REFERENCES email_schedules(id) ON DELETE SET NULL,
    invoice_id    UUID        REFERENCES invoices(id) ON DELETE SET NULL,
    client_id     UUID        REFERENCES clients(id) ON DELETE SET NULL,
    to_email      TEXT        NOT NULL,
    subject       TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'sent',
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    error_message TEXT        NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_email_log_company_id  ON email_log(company_id);
CREATE INDEX IF NOT EXISTS idx_email_log_schedule_id ON email_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_email_log_invoice_id  ON email_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_email_log_client_id   ON email_log(client_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status      ON email_log(status);

-- ============================================================
-- TABLE: ecf_provider_config
-- ============================================================
CREATE TABLE IF NOT EXISTS ecf_provider_config (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    mode                      TEXT        NOT NULL DEFAULT 'third_party',
    own_service_url           TEXT        NOT NULL DEFAULT '',
    own_service_token         TEXT        NOT NULL DEFAULT '',
    own_service_environment   TEXT        NOT NULL DEFAULT 'sandbox',
    third_party_provider      TEXT        NOT NULL DEFAULT '',
    third_party_api_key       TEXT        NOT NULL DEFAULT '',
    ncf_b01_prefix            TEXT        NOT NULL DEFAULT 'B01',
    ncf_b01_next              INT         NOT NULL DEFAULT 1,
    ncf_b01_limit             INT         NOT NULL DEFAULT 1000,
    ncf_b02_prefix            TEXT        NOT NULL DEFAULT 'B02',
    ncf_b02_next              INT         NOT NULL DEFAULT 1,
    ncf_b02_limit             INT         NOT NULL DEFAULT 1000,
    ncf_b14_prefix            TEXT        NOT NULL DEFAULT 'B14',
    ncf_b14_next              INT         NOT NULL DEFAULT 1,
    ncf_b14_limit             INT         NOT NULL DEFAULT 1000,
    webhook_url               TEXT        NOT NULL DEFAULT '',
    webhook_secret            TEXT        NOT NULL DEFAULT '',
    auto_submit               BOOLEAN     NOT NULL DEFAULT false,
    retry_on_failure          BOOLEAN     NOT NULL DEFAULT false,
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecf_provider_config_company_id ON ecf_provider_config(company_id);

-- ============================================================
-- TABLE: expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id          UUID,
    users_config_id  UUID,
    date             DATE        NOT NULL DEFAULT CURRENT_DATE,
    category         TEXT        NOT NULL DEFAULT '',
    description      TEXT        NOT NULL DEFAULT '',
    amount           NUMERIC     NOT NULL DEFAULT 0,
    vendor           TEXT        NOT NULL DEFAULT '',
    receipt_url      TEXT        NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company_id      ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id         ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_users_config_id ON expenses(users_config_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date            ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category        ON expenses(category);

-- ============================================================
-- TABLE: users_config
-- ============================================================
CREATE TABLE IF NOT EXISTS users_config (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    email               TEXT        NOT NULL UNIQUE,
    role                TEXT        NOT NULL DEFAULT 'operator',
    permissions         JSONB       NOT NULL DEFAULT '{}',
    password_hash       TEXT        NOT NULL DEFAULT '',
    auth_provider       TEXT        NOT NULL DEFAULT 'local',
    preferred_theme     TEXT        NOT NULL DEFAULT 'light',
    preferred_language  TEXT        NOT NULL DEFAULT 'es',
    preferred_region    TEXT        NOT NULL DEFAULT 'DO',
    email_language      TEXT        NOT NULL DEFAULT 'es',
    failed_login_attempts INT        NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    must_change_password  BOOLEAN     NOT NULL DEFAULT false,
    otp_enabled           BOOLEAN     NOT NULL DEFAULT false,
    temp_password         TEXT,
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    last_login          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_config_company_id   ON users_config(company_id);
CREATE INDEX IF NOT EXISTS idx_users_config_role         ON users_config(role);
CREATE INDEX IF NOT EXISTS idx_users_config_is_active    ON users_config(is_active);

-- ============================================================
-- TABLE: otp_tokens
-- ============================================================
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

-- ============================================================
-- TABLE: company_users
-- ============================================================
CREATE TABLE IF NOT EXISTS company_users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id         UUID,
    user_config_id  UUID,
    role            TEXT        NOT NULL DEFAULT 'operator',
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_users_company_id     ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user_id        ON company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user_config_id ON company_users(user_config_id);

-- ============================================================
-- TABLE: custom_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        UNIQUE NOT NULL,
    label       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    color       TEXT        NOT NULL DEFAULT 'slate',
    is_system   BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_name      ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_is_system ON custom_roles(is_system);

-- ============================================================
-- TABLE: role_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role        TEXT        NOT NULL,
    page        TEXT        NOT NULL,
    can_view    BOOLEAN     NOT NULL DEFAULT false,
    can_create  BOOLEAN     NOT NULL DEFAULT false,
    can_edit    BOOLEAN     NOT NULL DEFAULT false,
    can_delete  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(role, page)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_page ON role_permissions(page);

-- ============================================================
-- TABLE: user_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_permissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users_config(id) ON DELETE CASCADE,
    page        TEXT        NOT NULL,
    can_view    BOOLEAN     NOT NULL DEFAULT false,
    can_create  BOOLEAN     NOT NULL DEFAULT false,
    can_edit    BOOLEAN     NOT NULL DEFAULT false,
    can_delete  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page    ON user_permissions(page);

-- ============================================================
-- TABLE: audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID,
    user_id     UUID,
    action      TEXT        NOT NULL,
    table_name  TEXT        NOT NULL DEFAULT '',
    record_id   TEXT        NOT NULL DEFAULT '',
    old_data    JSONB,
    new_data    JSONB,
    ip_address  TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id  ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================
-- SEED DATA
-- ============================================================

-- ------------------------------------------------------------
-- 1. Default company
-- ------------------------------------------------------------
INSERT INTO companies (
    id,
    name,
    legal_name,
    rnc,
    address,
    city,
    country,
    phone,
    email,
    currency,
    invoice_prefix,
    next_invoice_number,
    payment_terms,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000010',
    'FacturaPro Demo',
    'FacturaPro Demo S.R.L.',
    '101-12345-6',
    'Av. Winston Churchill 1099',
    'Santo Domingo',
    'Dominican Republic',
    '809-555-0100',
    'demo@facturapro.do',
    'DOP',
    'FAC',
    1,
    30,
    true
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Standard ITBIS tax rates for the default company
-- ------------------------------------------------------------
INSERT INTO tax_rates (id, company_id, name, rate, description, is_active)
VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'ITBIS 18%',   18, 'Impuesto sobre Transferencias de Bienes y Servicios - tasa general 18%',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'ITBIS 16%',   16, 'Impuesto sobre Transferencias de Bienes y Servicios - tasa reducida 16%', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'Exento (0%)',   0, 'Exento de ITBIS',                                                         true)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 3. Five custom_roles
-- ------------------------------------------------------------
INSERT INTO custom_roles (id, name, label, description, color, is_system)
VALUES
    (gen_random_uuid(), 'admin',     'Administrador', 'Acceso total al sistema',                        'sky',     true),
    (gen_random_uuid(), 'manager',   'Gerente',       'Gestion operacional sin configuracion avanzada', 'teal',    true),
    (gen_random_uuid(), 'assistant', 'Asistente',     'Creacion y edicion de documentos basicos',       'emerald', true),
    (gen_random_uuid(), 'operator',  'Operador',      'Operaciones de facturacion basica',               'amber',   true),
    (gen_random_uuid(), 'viewer',    'Visor',         'Solo lectura sobre modulos permitidos',           'slate',   true)
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- 4. role_permissions for 5 roles x 10 pages
--    Pages: dashboard, invoices, clients, products, payments,
--           electronic, email, notifications, analytics, admin
-- ------------------------------------------------------------

-- ADMIN: all true on all pages
INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete)
VALUES
    (gen_random_uuid(), 'admin', 'dashboard',     true, true, true, true),
    (gen_random_uuid(), 'admin', 'invoices',      true, true, true, true),
    (gen_random_uuid(), 'admin', 'clients',       true, true, true, true),
    (gen_random_uuid(), 'admin', 'products',      true, true, true, true),
    (gen_random_uuid(), 'admin', 'payments',      true, true, true, true),
    (gen_random_uuid(), 'admin', 'electronic',    true, true, true, true),
    (gen_random_uuid(), 'admin', 'email',         true, true, true, true),
    (gen_random_uuid(), 'admin', 'notifications', true, true, true, true),
    (gen_random_uuid(), 'admin', 'analytics',     true, true, true, true),
    (gen_random_uuid(), 'admin', 'admin',         true, true, true, true)
ON CONFLICT (role, page) DO NOTHING;

-- MANAGER: no admin page; analytics/notifications view-only; rest mostly true
INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete)
VALUES
    (gen_random_uuid(), 'manager', 'dashboard',     true,  true,  true,  true),
    (gen_random_uuid(), 'manager', 'invoices',      true,  true,  true,  true),
    (gen_random_uuid(), 'manager', 'clients',       true,  true,  true,  true),
    (gen_random_uuid(), 'manager', 'products',      true,  true,  true,  true),
    (gen_random_uuid(), 'manager', 'payments',      true,  true,  true,  true),
    (gen_random_uuid(), 'manager', 'electronic',    true,  true,  true,  false),
    (gen_random_uuid(), 'manager', 'email',         true,  true,  true,  false),
    (gen_random_uuid(), 'manager', 'notifications', true,  false, false, false),
    (gen_random_uuid(), 'manager', 'analytics',     true,  false, false, false),
    (gen_random_uuid(), 'manager', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- ASSISTANT: view+create on invoices/clients/products/payments; no delete; no admin/analytics
INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete)
VALUES
    (gen_random_uuid(), 'assistant', 'dashboard',     true,  false, false, false),
    (gen_random_uuid(), 'assistant', 'invoices',      true,  true,  true,  false),
    (gen_random_uuid(), 'assistant', 'clients',       true,  true,  true,  false),
    (gen_random_uuid(), 'assistant', 'products',      true,  true,  true,  false),
    (gen_random_uuid(), 'assistant', 'payments',      true,  true,  true,  false),
    (gen_random_uuid(), 'assistant', 'electronic',    false, false, false, false),
    (gen_random_uuid(), 'assistant', 'email',         true,  false, false, false),
    (gen_random_uuid(), 'assistant', 'notifications', true,  false, false, false),
    (gen_random_uuid(), 'assistant', 'analytics',     false, false, false, false),
    (gen_random_uuid(), 'assistant', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- OPERATOR: view+create on invoices/clients/payments only
INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete)
VALUES
    (gen_random_uuid(), 'operator', 'dashboard',     true,  false, false, false),
    (gen_random_uuid(), 'operator', 'invoices',      true,  true,  false, false),
    (gen_random_uuid(), 'operator', 'clients',       true,  true,  false, false),
    (gen_random_uuid(), 'operator', 'products',      false, false, false, false),
    (gen_random_uuid(), 'operator', 'payments',      true,  true,  false, false),
    (gen_random_uuid(), 'operator', 'electronic',    false, false, false, false),
    (gen_random_uuid(), 'operator', 'email',         false, false, false, false),
    (gen_random_uuid(), 'operator', 'notifications', true,  false, false, false),
    (gen_random_uuid(), 'operator', 'analytics',     false, false, false, false),
    (gen_random_uuid(), 'operator', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- VIEWER: view-only on dashboard/invoices/clients/products/payments/notifications/analytics
INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete)
VALUES
    (gen_random_uuid(), 'viewer', 'dashboard',     true,  false, false, false),
    (gen_random_uuid(), 'viewer', 'invoices',      true,  false, false, false),
    (gen_random_uuid(), 'viewer', 'clients',       true,  false, false, false),
    (gen_random_uuid(), 'viewer', 'products',      true,  false, false, false),
    (gen_random_uuid(), 'viewer', 'payments',      true,  false, false, false),
    (gen_random_uuid(), 'viewer', 'electronic',    false, false, false, false),
    (gen_random_uuid(), 'viewer', 'email',         false, false, false, false),
    (gen_random_uuid(), 'viewer', 'notifications', true,  false, false, false),
    (gen_random_uuid(), 'viewer', 'analytics',     true,  false, false, false),
    (gen_random_uuid(), 'viewer', 'admin',         false, false, false, false)
ON CONFLICT (role, page) DO NOTHING;

-- ------------------------------------------------------------
-- 5. Default settings for the default company
-- ------------------------------------------------------------
INSERT INTO settings (id, company_id, key, value, description, category, is_active)
VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'invoice_prefix',         'FAC',                   'Prefijo para numeracion de facturas',          'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'invoice_next_number',    '1',                     'Proximo numero de factura',                    'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'default_payment_terms',  '30',                    'Dias de plazo de pago por defecto',            'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'default_currency',       'DOP',                   'Moneda por defecto',                           'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'default_ncf_type',       'B01',                   'Tipo de NCF por defecto',                      'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'invoice_footer_text',    'Gracias por su preferencia.', 'Texto del pie de pagina en facturas',    'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'invoice_logo_visible',   'true',                  'Mostrar logo en facturas',                     'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'smtp_host',              'smtp.example.com',      'Host del servidor SMTP',                       'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'smtp_port',              '587',                   'Puerto SMTP',                                  'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'smtp_user',              'noreply@example.com',   'Usuario SMTP',                                 'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'smtp_password',          '',                      'Contrasena SMTP',                              'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'smtp_from',              'noreply@example.com',   'Direccion de remitente SMTP',                  'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'smtp_name',              'FacturaPro Demo',       'Nombre del remitente SMTP',                    'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'electronic_enabled',     'false',                 'Habilitar facturacion electronica',             'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'electronic_provider',    '',                      'Proveedor de facturacion electronica',          'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'electronic_environment', 'sandbox',               'Ambiente de facturacion electronica',           'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'dgii_auth_number',       '',                      'Numero de autorizacion DGII',                  'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'auto_send_invoice',      'false',                 'Enviar factura automaticamente al crear',       'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'auto_send_reminder',     'true',                  'Enviar recordatorio de pago automaticamente',  'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'reminder_days_before',   '3',                     'Dias antes del vencimiento para recordatorio', 'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'overdue_notification',   'true',                  'Notificar facturas vencidas',                  'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'timezone',               'America/Santo_Domingo', 'Zona horaria de la empresa',                   'general',    true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'date_format',            'DD/MM/YYYY',            'Formato de fecha',                             'general',    true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'language',               'es',                    'Idioma del sistema',                           'general',    true)
ON CONFLICT (company_id, key) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Default feature flags for the default company
-- ------------------------------------------------------------
INSERT INTO feature_flags (id, company_id, name, description, is_enabled)
VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'electronic_invoicing', 'Modulo de facturacion electronica (eCF)',       false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'recurring_invoices',   'Facturas recurrentes automaticas',              true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'multi_currency',       'Soporte de multiples monedas',                  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'email_automation',     'Automatizacion de correos electronicos',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'analytics_dashboard',  'Panel de analiticas e informes avanzados',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'expense_tracking',     'Modulo de registro de gastos',                  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'credit_notes',         'Notas de credito',                              true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'product_inventory',    'Control basico de inventario de productos',     false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'client_portal',        'Portal de acceso para clientes',                false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'api_access',           'Acceso API externo para integraciones',         false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'audit_trail',          'Registro de auditoria detallado',               true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'dark_mode',            'Modo oscuro en la interfaz',                    true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
