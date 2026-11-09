/*
================================================================================
  FacturaPro - SQL Server Schema v2026-05-14
  Compatibility: SQL Server 2016+ / Azure SQL Database
  No RLS, no policies. Plain tables, indexes, and seed data.
================================================================================
*/

USE [FacturaPro];
GO

-- ============================================================
-- TABLE: companies
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'companies')
BEGIN
    CREATE TABLE companies (
        id                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()          CONSTRAINT PK_companies PRIMARY KEY,
        name                  NVARCHAR(255)    NOT NULL DEFAULT '',
        legal_name            NVARCHAR(255)    NOT NULL DEFAULT '',
        rnc                   NVARCHAR(50)     NOT NULL DEFAULT '',
        address               NVARCHAR(MAX)    NOT NULL DEFAULT '',
        city                  NVARCHAR(100)    NOT NULL DEFAULT '',
        country               NVARCHAR(100)    NOT NULL DEFAULT 'Dominican Republic',
        phone                 NVARCHAR(50)     NOT NULL DEFAULT '',
        email                 NVARCHAR(255)    NOT NULL DEFAULT '',
        website               NVARCHAR(255)    NOT NULL DEFAULT '',
        logo_url              NVARCHAR(MAX)    NOT NULL DEFAULT '',
        currency              NVARCHAR(10)     NOT NULL DEFAULT 'DOP',
        invoice_prefix        NVARCHAR(20)     NOT NULL DEFAULT 'FAC',
        next_invoice_number   INT              NOT NULL DEFAULT 1,
        payment_terms         INT              NOT NULL DEFAULT 30,
        bank_beneficiary      NVARCHAR(255)    NOT NULL DEFAULT '',
        bank_name             NVARCHAR(255)    NOT NULL DEFAULT '',
        bank_account          NVARCHAR(100)    NOT NULL DEFAULT '',
        bank_iban             NVARCHAR(100)    NOT NULL DEFAULT '',
        bank_contact          NVARCHAR(255)    NOT NULL DEFAULT '',
        bank_contact_tel      NVARCHAR(50)     NOT NULL DEFAULT '',
        bank_contact_email    NVARCHAR(255)    NOT NULL DEFAULT '',
        dgii_auth_number      NVARCHAR(100)    NOT NULL DEFAULT '',
        electronic_enabled    BIT              NOT NULL DEFAULT 0,
        electronic_provider   NVARCHAR(255)    NOT NULL DEFAULT '',
        electronic_api_key    NVARCHAR(MAX)    NOT NULL DEFAULT '',
        smtp_host             NVARCHAR(255)    NOT NULL DEFAULT '',
        smtp_port             INT              NOT NULL DEFAULT 587,
        smtp_user             NVARCHAR(255)    NOT NULL DEFAULT '',
        smtp_password         NVARCHAR(MAX)    NOT NULL DEFAULT '',
        smtp_from             NVARCHAR(255)    NOT NULL DEFAULT '',
        smtp_name             NVARCHAR(255)    NOT NULL DEFAULT '',
        is_active             BIT              NOT NULL DEFAULT 1,
        created_at            DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at            DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ============================================================
-- TABLE: tax_rates
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'tax_rates')
BEGIN
    CREATE TABLE tax_rates (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_tax_rates PRIMARY KEY,
        company_id  UNIQUEIDENTIFIER NOT NULL,
        name        NVARCHAR(255)    NOT NULL,
        rate        NUMERIC(18,4)    NOT NULL DEFAULT 0,
        description NVARCHAR(MAX)    NOT NULL DEFAULT '',
        is_active   BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_tax_rates_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_tax_rates_company_id ON tax_rates(company_id);
    CREATE INDEX IX_tax_rates_is_active  ON tax_rates(is_active);
END
GO

-- ============================================================
-- TABLE: clients
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'clients')
BEGIN
    CREATE TABLE clients (
        id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_clients PRIMARY KEY,
        company_id          UNIQUEIDENTIFIER NOT NULL,
        name                NVARCHAR(255)    NOT NULL,
        email               NVARCHAR(255)    NOT NULL DEFAULT '',
        phone               NVARCHAR(50)     NOT NULL DEFAULT '',
        rnc                 NVARCHAR(50)     NOT NULL DEFAULT '',
        cedula              NVARCHAR(50)     NOT NULL DEFAULT '',
        address             NVARCHAR(MAX)    NOT NULL DEFAULT '',
        city                NVARCHAR(100)    NOT NULL DEFAULT '',
        country             NVARCHAR(100)    NOT NULL DEFAULT 'Dominican Republic',
        client_type         NVARCHAR(50)     NOT NULL DEFAULT 'person',
        payment_terms       INT              NOT NULL DEFAULT 30,
        credit_limit        NUMERIC(18,4)    NOT NULL DEFAULT 0,
        notes               NVARCHAR(MAX)    NOT NULL DEFAULT '',
        email_list          NVARCHAR(MAX)    NOT NULL DEFAULT '',
        email_body_template NVARCHAR(MAX)    NOT NULL DEFAULT '',
        is_active           BIT              NOT NULL DEFAULT 1,
        created_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_clients_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_clients_company_id ON clients(company_id);
    CREATE INDEX IX_clients_email      ON clients(email);
    CREATE INDEX IX_clients_is_active  ON clients(is_active);
END
GO

-- ============================================================
-- TABLE: products_services
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'products_services')
BEGIN
    CREATE TABLE products_services (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_products_services PRIMARY KEY,
        company_id  UNIQUEIDENTIFIER NOT NULL,
        code        NVARCHAR(100)    NOT NULL DEFAULT '',
        name        NVARCHAR(255)    NOT NULL,
        description NVARCHAR(MAX)    NOT NULL DEFAULT '',
        type        NVARCHAR(50)     NOT NULL DEFAULT 'service',
        unit_price  NUMERIC(18,4)    NOT NULL DEFAULT 0,
        tax_rate_id UNIQUEIDENTIFIER NULL,
        unit        NVARCHAR(50)     NOT NULL DEFAULT 'unit',
        is_active   BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_products_services_company  FOREIGN KEY (company_id)  REFERENCES companies(id)  ON DELETE NO ACTION,
        CONSTRAINT FK_products_services_tax_rate FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id)  ON DELETE NO ACTION
    );
    CREATE INDEX IX_products_services_company_id  ON products_services(company_id);
    CREATE INDEX IX_products_services_tax_rate_id ON products_services(tax_rate_id);
    CREATE INDEX IX_products_services_is_active   ON products_services(is_active);
    CREATE INDEX IX_products_services_code        ON products_services(code);
END
GO

-- ============================================================
-- TABLE: invoices
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'invoices')
BEGIN
    CREATE TABLE invoices (
        id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_invoices PRIMARY KEY,
        company_id          UNIQUEIDENTIFIER NOT NULL,
        invoice_number      NVARCHAR(100)    NOT NULL,
        ncf                 NVARCHAR(50)     NOT NULL DEFAULT '',
        ncf_type            NVARCHAR(10)     NOT NULL DEFAULT 'B01',
        client_id           UNIQUEIDENTIFIER NOT NULL,
        status              NVARCHAR(50)     NOT NULL DEFAULT 'draft',
        invoice_type        NVARCHAR(50)     NOT NULL DEFAULT 'one_time',
        issue_date          DATE             NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
        due_date            DATE             NULL,
        payment_date        DATE             NULL,
        subtotal            NUMERIC(18,4)    NOT NULL DEFAULT 0,
        tax_amount          NUMERIC(18,4)    NOT NULL DEFAULT 0,
        discount_amount     NUMERIC(18,4)    NOT NULL DEFAULT 0,
        total               NUMERIC(18,4)    NOT NULL DEFAULT 0,
        amount_paid         NUMERIC(18,4)    NOT NULL DEFAULT 0,
        currency            NVARCHAR(10)     NOT NULL DEFAULT 'DOP',
        exchange_rate       NUMERIC(18,4)    NOT NULL DEFAULT 1,
        notes               NVARCHAR(MAX)    NOT NULL DEFAULT '',
        terms               NVARCHAR(MAX)    NOT NULL DEFAULT '',
        is_electronic       BIT              NOT NULL DEFAULT 0,
        electronic_status   NVARCHAR(50)     NOT NULL DEFAULT 'pending',
        electronic_id       NVARCHAR(255)    NOT NULL DEFAULT '',
        electronic_response NVARCHAR(MAX)    NULL,
        recurrence_rule     NVARCHAR(255)    DEFAULT '',
        recurrence_end      DATE             NULL,
        parent_invoice_id   UNIQUEIDENTIFIER NULL,
        sent_at             DATETIME2        NULL,
        created_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_invoices_company        FOREIGN KEY (company_id)        REFERENCES companies(id) ON DELETE NO ACTION,
        CONSTRAINT FK_invoices_client         FOREIGN KEY (client_id)         REFERENCES clients(id)   ON DELETE NO ACTION,
        CONSTRAINT FK_invoices_parent_invoice FOREIGN KEY (parent_invoice_id) REFERENCES invoices(id)  ON DELETE NO ACTION
    );
    CREATE INDEX IX_invoices_company_id        ON invoices(company_id);
    CREATE INDEX IX_invoices_client_id         ON invoices(client_id);
    CREATE INDEX IX_invoices_status            ON invoices(status);
    CREATE INDEX IX_invoices_invoice_number    ON invoices(invoice_number);
    CREATE INDEX IX_invoices_issue_date        ON invoices(issue_date);
    CREATE INDEX IX_invoices_due_date          ON invoices(due_date);
    CREATE INDEX IX_invoices_parent_invoice_id ON invoices(parent_invoice_id);
    CREATE INDEX IX_invoices_ncf               ON invoices(ncf);
END
GO

-- ============================================================
-- TABLE: invoice_items
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'invoice_items')
BEGIN
    CREATE TABLE invoice_items (
        id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_invoice_items PRIMARY KEY,
        invoice_id       UNIQUEIDENTIFIER NOT NULL,
        product_id       UNIQUEIDENTIFIER NULL,
        description      NVARCHAR(MAX)    NOT NULL,
        quantity         NUMERIC(18,4)    NOT NULL DEFAULT 1,
        unit_price       NUMERIC(18,4)    NOT NULL DEFAULT 0,
        tax_rate         NUMERIC(18,4)    NOT NULL DEFAULT 0,
        tax_amount       NUMERIC(18,4)    NOT NULL DEFAULT 0,
        discount_percent NUMERIC(18,4)    NOT NULL DEFAULT 0,
        discount_amount  NUMERIC(18,4)    NOT NULL DEFAULT 0,
        line_total       NUMERIC(18,4)    NOT NULL DEFAULT 0,
        sort_order       INT              NOT NULL DEFAULT 0,
        created_at       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_invoice_items_invoice FOREIGN KEY (invoice_id)  REFERENCES invoices(id)          ON DELETE NO ACTION,
        CONSTRAINT FK_invoice_items_product FOREIGN KEY (product_id)  REFERENCES products_services(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_invoice_items_invoice_id ON invoice_items(invoice_id);
    CREATE INDEX IX_invoice_items_product_id ON invoice_items(product_id);
END
GO

-- ============================================================
-- TABLE: payment_records
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'payment_records')
BEGIN
    CREATE TABLE payment_records (
        id             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_payment_records PRIMARY KEY,
        company_id     UNIQUEIDENTIFIER NOT NULL,
        invoice_id     UNIQUEIDENTIFIER NOT NULL,
        amount         NUMERIC(18,4)    NOT NULL,
        payment_method NVARCHAR(50)     NOT NULL DEFAULT 'cash',
        payment_date   DATE             NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
        reference      NVARCHAR(255)    NOT NULL DEFAULT '',
        notes          NVARCHAR(MAX)    NOT NULL DEFAULT '',
        created_at     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_payment_records_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION,
        CONSTRAINT FK_payment_records_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)  ON DELETE NO ACTION
    );
    CREATE INDEX IX_payment_records_company_id   ON payment_records(company_id);
    CREATE INDEX IX_payment_records_invoice_id   ON payment_records(invoice_id);
    CREATE INDEX IX_payment_records_payment_date ON payment_records(payment_date);
END
GO

-- ============================================================
-- TABLE: settings
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'settings')
BEGIN
    CREATE TABLE settings (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_settings PRIMARY KEY,
        company_id  UNIQUEIDENTIFIER NOT NULL,
        [key]       NVARCHAR(255)    NOT NULL,
        value       NVARCHAR(MAX)    NOT NULL DEFAULT '',
        description NVARCHAR(MAX)    NOT NULL DEFAULT '',
        category    NVARCHAR(100)    NOT NULL DEFAULT 'general',
        is_active   BIT              NOT NULL DEFAULT 1,
        updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_settings_company_key UNIQUE (company_id, [key])
    );
    CREATE INDEX IX_settings_company_id ON settings(company_id);
    CREATE INDEX IX_settings_key        ON settings([key]);
    CREATE INDEX IX_settings_category   ON settings(category);
END
GO

-- ============================================================
-- TABLE: feature_flags
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'feature_flags')
BEGIN
    CREATE TABLE feature_flags (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_feature_flags PRIMARY KEY,
        company_id  UNIQUEIDENTIFIER NOT NULL,
        name        NVARCHAR(255)    NOT NULL,
        description NVARCHAR(MAX)    NOT NULL DEFAULT '',
        is_enabled  BIT              NOT NULL DEFAULT 1,
        updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_feature_flags_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_feature_flags_company_id ON feature_flags(company_id);
    CREATE INDEX IX_feature_flags_name       ON feature_flags(name);
END
GO

-- ============================================================
-- TABLE: notifications
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'notifications')
BEGIN
    CREATE TABLE notifications (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_notifications PRIMARY KEY,
        company_id  UNIQUEIDENTIFIER NOT NULL,
        type        NVARCHAR(100)    NOT NULL,
        title       NVARCHAR(255)    NOT NULL,
        message     NVARCHAR(MAX)    NOT NULL,
        invoice_id  UNIQUEIDENTIFIER NULL,
        client_id   UNIQUEIDENTIFIER NULL,
        is_read     BIT              NOT NULL DEFAULT 0,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_notifications_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION,
        CONSTRAINT FK_notifications_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)  ON DELETE NO ACTION,
        CONSTRAINT FK_notifications_client  FOREIGN KEY (client_id)  REFERENCES clients(id)   ON DELETE NO ACTION
    );
    CREATE INDEX IX_notifications_company_id ON notifications(company_id);
    CREATE INDEX IX_notifications_invoice_id ON notifications(invoice_id);
    CREATE INDEX IX_notifications_client_id  ON notifications(client_id);
    CREATE INDEX IX_notifications_is_read    ON notifications(is_read);
    CREATE INDEX IX_notifications_type       ON notifications(type);
END
GO

-- ============================================================
-- TABLE: ncf_sequences
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ncf_sequences')
BEGIN
    CREATE TABLE ncf_sequences (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_ncf_sequences PRIMARY KEY,
        company_id  UNIQUEIDENTIFIER NOT NULL,
        ncf_type    NVARCHAR(10)     NOT NULL,
        prefix      NVARCHAR(20)     NOT NULL DEFAULT '',
        from_seq    INT              NOT NULL DEFAULT 1,
        to_seq      INT              NOT NULL DEFAULT 1,
        current_seq INT              NOT NULL DEFAULT 1,
        dgii_auth   NVARCHAR(100)    NOT NULL DEFAULT '',
        expires_at  DATE             NULL,
        is_active   BIT              NOT NULL DEFAULT 1,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ncf_sequences_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_ncf_sequences_company_id ON ncf_sequences(company_id);
    CREATE INDEX IX_ncf_sequences_ncf_type   ON ncf_sequences(ncf_type);
    CREATE INDEX IX_ncf_sequences_is_active  ON ncf_sequences(is_active);
END
GO

-- ============================================================
-- TABLE: ncf_void_log
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ncf_void_log')
BEGIN
    CREATE TABLE ncf_void_log (
        id                   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_ncf_void_log PRIMARY KEY,
        company_id           UNIQUEIDENTIFIER NOT NULL,
        invoice_id           UNIQUEIDENTIFIER NULL,
        invoice_number       NVARCHAR(100)    NOT NULL DEFAULT '',
        ncf                  NVARCHAR(50)     NOT NULL DEFAULT '',
        ncf_type             NVARCHAR(10)     NOT NULL DEFAULT '',
        issue_month          NVARCHAR(20)     NOT NULL DEFAULT '',
        cancelled_at         DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        reuse_allowed        BIT              NOT NULL DEFAULT 0,
        reused_by_invoice_id UNIQUEIDENTIFIER NULL,
        notes                NVARCHAR(MAX)    NOT NULL DEFAULT '',
        CONSTRAINT FK_ncf_void_log_company          FOREIGN KEY (company_id)           REFERENCES companies(id) ON DELETE NO ACTION,
        CONSTRAINT FK_ncf_void_log_invoice          FOREIGN KEY (invoice_id)           REFERENCES invoices(id)  ON DELETE NO ACTION,
        CONSTRAINT FK_ncf_void_log_reused_by_invoice FOREIGN KEY (reused_by_invoice_id) REFERENCES invoices(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_ncf_void_log_company_id ON ncf_void_log(company_id);
    CREATE INDEX IX_ncf_void_log_invoice_id ON ncf_void_log(invoice_id);
    CREATE INDEX IX_ncf_void_log_ncf        ON ncf_void_log(ncf);
END
GO

-- ============================================================
-- TABLE: email_schedules
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'email_schedules')
BEGIN
    CREATE TABLE email_schedules (
        id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_email_schedules PRIMARY KEY,
        company_id    UNIQUEIDENTIFIER NOT NULL,
        name          NVARCHAR(255)    NOT NULL,
        trigger_event NVARCHAR(100)    NOT NULL,
        days_offset   INT              NOT NULL DEFAULT 0,
        subject       NVARCHAR(255)    NOT NULL,
        body_template NVARCHAR(MAX)    NOT NULL,
        is_active     BIT              NOT NULL DEFAULT 1,
        last_run      DATETIME2        NULL,
        created_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_email_schedules_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_email_schedules_company_id    ON email_schedules(company_id);
    CREATE INDEX IX_email_schedules_trigger_event ON email_schedules(trigger_event);
    CREATE INDEX IX_email_schedules_is_active     ON email_schedules(is_active);
END
GO

-- ============================================================
-- TABLE: email_log
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'email_log')
BEGIN
    CREATE TABLE email_log (
        id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_email_log PRIMARY KEY,
        company_id    UNIQUEIDENTIFIER NOT NULL,
        schedule_id   UNIQUEIDENTIFIER NULL,
        invoice_id    UNIQUEIDENTIFIER NULL,
        client_id     UNIQUEIDENTIFIER NULL,
        to_email      NVARCHAR(255)    NOT NULL,
        subject       NVARCHAR(255)    NOT NULL,
        status        NVARCHAR(50)     NOT NULL DEFAULT 'sent',
        sent_at       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        error_message NVARCHAR(MAX)    NOT NULL DEFAULT '',
        CONSTRAINT FK_email_log_company  FOREIGN KEY (company_id)  REFERENCES companies(id)      ON DELETE NO ACTION,
        CONSTRAINT FK_email_log_schedule FOREIGN KEY (schedule_id) REFERENCES email_schedules(id) ON DELETE NO ACTION,
        CONSTRAINT FK_email_log_invoice  FOREIGN KEY (invoice_id)  REFERENCES invoices(id)        ON DELETE NO ACTION,
        CONSTRAINT FK_email_log_client   FOREIGN KEY (client_id)   REFERENCES clients(id)         ON DELETE NO ACTION
    );
    CREATE INDEX IX_email_log_company_id  ON email_log(company_id);
    CREATE INDEX IX_email_log_schedule_id ON email_log(schedule_id);
    CREATE INDEX IX_email_log_invoice_id  ON email_log(invoice_id);
    CREATE INDEX IX_email_log_client_id   ON email_log(client_id);
    CREATE INDEX IX_email_log_status      ON email_log(status);
END
GO

-- ============================================================
-- TABLE: ecf_provider_config
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ecf_provider_config')
BEGIN
    CREATE TABLE ecf_provider_config (
        id                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_ecf_provider_config PRIMARY KEY,
        company_id              UNIQUEIDENTIFIER NOT NULL,
        mode                    NVARCHAR(50)     NOT NULL DEFAULT 'third_party',
        own_service_url         NVARCHAR(MAX)    NOT NULL DEFAULT '',
        own_service_token       NVARCHAR(MAX)    NOT NULL DEFAULT '',
        own_service_environment NVARCHAR(50)     NOT NULL DEFAULT 'sandbox',
        third_party_provider    NVARCHAR(255)    NOT NULL DEFAULT '',
        third_party_api_key     NVARCHAR(MAX)    NOT NULL DEFAULT '',
        ncf_b01_prefix          NVARCHAR(10)     NOT NULL DEFAULT 'B01',
        ncf_b01_next            INT              NOT NULL DEFAULT 1,
        ncf_b01_limit           INT              NOT NULL DEFAULT 1000,
        ncf_b02_prefix          NVARCHAR(10)     NOT NULL DEFAULT 'B02',
        ncf_b02_next            INT              NOT NULL DEFAULT 1,
        ncf_b02_limit           INT              NOT NULL DEFAULT 1000,
        ncf_b14_prefix          NVARCHAR(10)     NOT NULL DEFAULT 'B14',
        ncf_b14_next            INT              NOT NULL DEFAULT 1,
        ncf_b14_limit           INT              NOT NULL DEFAULT 1000,
        webhook_url             NVARCHAR(MAX)    NOT NULL DEFAULT '',
        webhook_secret          NVARCHAR(MAX)    NOT NULL DEFAULT '',
        auto_submit             BIT              NOT NULL DEFAULT 0,
        retry_on_failure        BIT              NOT NULL DEFAULT 0,
        updated_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ecf_provider_config_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_ecf_provider_config_company UNIQUE (company_id)
    );
    CREATE UNIQUE INDEX IX_ecf_provider_config_company_id ON ecf_provider_config(company_id);
END
GO

-- ============================================================
-- TABLE: expenses
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'expenses')
BEGIN
    CREATE TABLE expenses (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_expenses PRIMARY KEY,
        company_id      UNIQUEIDENTIFIER NOT NULL,
        user_id         UNIQUEIDENTIFIER NULL,
        users_config_id UNIQUEIDENTIFIER NULL,
        date            DATE             NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
        category        NVARCHAR(100)    NOT NULL DEFAULT '',
        description     NVARCHAR(MAX)    NOT NULL DEFAULT '',
        amount          NUMERIC(18,4)    NOT NULL DEFAULT 0,
        vendor          NVARCHAR(255)    NOT NULL DEFAULT '',
        receipt_url     NVARCHAR(MAX)    NOT NULL DEFAULT '',
        created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_expenses_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_expenses_company_id      ON expenses(company_id);
    CREATE INDEX IX_expenses_user_id         ON expenses(user_id);
    CREATE INDEX IX_expenses_users_config_id ON expenses(users_config_id);
    CREATE INDEX IX_expenses_date            ON expenses(date);
    CREATE INDEX IX_expenses_category        ON expenses(category);
END
GO

-- ============================================================
-- TABLE: users_config
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'users_config')
BEGIN
    CREATE TABLE users_config (
        id                 UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_users_config PRIMARY KEY,
        company_id         UNIQUEIDENTIFIER NOT NULL,
        name               NVARCHAR(255)    NOT NULL,
        email              NVARCHAR(255)    NOT NULL,
        role               NVARCHAR(50)     NOT NULL DEFAULT 'operator',
        permissions        NVARCHAR(MAX)    NOT NULL DEFAULT '{}',
        password_hash      NVARCHAR(MAX)    NOT NULL DEFAULT '',
        auth_provider      NVARCHAR(50)     NOT NULL DEFAULT 'local',
        preferred_theme    NVARCHAR(50)     NOT NULL DEFAULT 'light',
        preferred_language NVARCHAR(10)     NOT NULL DEFAULT 'es',
        preferred_region   NVARCHAR(10)     NOT NULL DEFAULT 'DO',
        email_language     NVARCHAR(10)     NOT NULL DEFAULT 'es',
        failed_login_attempts INT           NOT NULL DEFAULT 0,
        locked_until       DATETIME2        NULL,
        must_change_password BIT            NOT NULL DEFAULT 0,
        otp_enabled        BIT              NOT NULL DEFAULT 0,
        temp_password      NVARCHAR(MAX)    NULL,
        is_active          BIT              NOT NULL DEFAULT 1,
        last_login         DATETIME2        NULL,
        created_at         DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at         DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_users_config_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_users_config_company_id   ON users_config(company_id);
    CREATE INDEX IX_users_config_role         ON users_config(role);
    CREATE INDEX IX_users_config_is_active    ON users_config(is_active);
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'UQ_users_config_email')
  ALTER TABLE users_config ADD CONSTRAINT UQ_users_config_email UNIQUE (email);
GO

-- ============================================================
-- TABLE: otp_tokens
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'otp_tokens')
BEGIN
    CREATE TABLE otp_tokens (
        id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() CONSTRAINT PK_otp_tokens PRIMARY KEY,
        user_id    UNIQUEIDENTIFIER NOT NULL,
        email      NVARCHAR(255)    NOT NULL,
        token      NVARCHAR(10)     NOT NULL,
        attempts   INT              NOT NULL DEFAULT 0,
        expires_at DATETIME2        NOT NULL,
        used       BIT              NOT NULL DEFAULT 0,
        created_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_otp_tokens_user FOREIGN KEY (user_id) REFERENCES users_config(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_otp_tokens_user_id    ON otp_tokens(user_id);
    CREATE INDEX IX_otp_tokens_expires_at ON otp_tokens(expires_at);
END
GO

-- ============================================================
-- TABLE: company_users
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'company_users')
BEGIN
    CREATE TABLE company_users (
        id             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_company_users PRIMARY KEY,
        company_id     UNIQUEIDENTIFIER NOT NULL,
        user_id        UNIQUEIDENTIFIER NULL,
        user_config_id UNIQUEIDENTIFIER NULL,
        role           NVARCHAR(50)     NOT NULL DEFAULT 'operator',
        is_active      BIT              NOT NULL DEFAULT 1,
        created_at     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_company_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_company_users_company_id     ON company_users(company_id);
    CREATE INDEX IX_company_users_user_id        ON company_users(user_id);
    CREATE INDEX IX_company_users_user_config_id ON company_users(user_config_id);
END
GO

-- ============================================================
-- TABLE: custom_roles
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'custom_roles')
BEGIN
    CREATE TABLE custom_roles (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_custom_roles PRIMARY KEY,
        name        NVARCHAR(100)    NOT NULL,
        label       NVARCHAR(255)    NOT NULL,
        description NVARCHAR(MAX)    NOT NULL DEFAULT '',
        color       NVARCHAR(50)     NOT NULL DEFAULT 'slate',
        is_system   BIT              NOT NULL DEFAULT 0,
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_custom_roles_name UNIQUE (name)
    );
    CREATE UNIQUE INDEX IX_custom_roles_name ON custom_roles(name);
    CREATE INDEX        IX_custom_roles_is_system ON custom_roles(is_system);
END
GO

-- ============================================================
-- TABLE: role_permissions
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions')
BEGIN
    CREATE TABLE role_permissions (
        id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_role_permissions PRIMARY KEY,
        role       NVARCHAR(100)    NOT NULL,
        page       NVARCHAR(100)    NOT NULL,
        can_view   BIT              NOT NULL DEFAULT 0,
        can_create BIT              NOT NULL DEFAULT 0,
        can_edit   BIT              NOT NULL DEFAULT 0,
        can_delete BIT              NOT NULL DEFAULT 0,
        created_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_role_permissions_role_page UNIQUE (role, page)
    );
    CREATE INDEX IX_role_permissions_role ON role_permissions(role);
    CREATE INDEX IX_role_permissions_page ON role_permissions(page);
END
GO

-- ============================================================
-- TABLE: user_permissions
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_permissions')
BEGIN
    CREATE TABLE user_permissions (
        id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_user_permissions PRIMARY KEY,
        user_id    UNIQUEIDENTIFIER NOT NULL,
        page       NVARCHAR(100)    NOT NULL,
        can_view   BIT              NOT NULL DEFAULT 0,
        can_create BIT              NOT NULL DEFAULT 0,
        can_edit   BIT              NOT NULL DEFAULT 0,
        can_delete BIT              NOT NULL DEFAULT 0,
        created_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_user_permissions_user FOREIGN KEY (user_id) REFERENCES users_config(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_user_permissions_user_page UNIQUE (user_id, page)
    );
    CREATE INDEX IX_user_permissions_user_id ON user_permissions(user_id);
    CREATE INDEX IX_user_permissions_page    ON user_permissions(page);
END
GO

-- ============================================================
-- TABLE: audit_log
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_log')
BEGIN
    CREATE TABLE audit_log (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()  CONSTRAINT PK_audit_log PRIMARY KEY,
        company_id  UNIQUEIDENTIFIER NULL,
        user_id     UNIQUEIDENTIFIER NULL,
        action      NVARCHAR(100)    NOT NULL,
        table_name  NVARCHAR(100)    NOT NULL DEFAULT '',
        record_id   NVARCHAR(255)    NOT NULL DEFAULT '',
        old_data    NVARCHAR(MAX)    NULL,
        new_data    NVARCHAR(MAX)    NULL,
        ip_address  NVARCHAR(50)     NOT NULL DEFAULT '',
        created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_audit_log_company_id ON audit_log(company_id);
    CREATE INDEX IX_audit_log_user_id    ON audit_log(user_id);
    CREATE INDEX IX_audit_log_action     ON audit_log(action);
    CREATE INDEX IX_audit_log_table_name ON audit_log(table_name);
    CREATE INDEX IX_audit_log_record_id  ON audit_log(record_id);
    CREATE INDEX IX_audit_log_created_at ON audit_log(created_at);
END
GO

-- ============================================================
-- SEED DATA
-- ============================================================

-- ------------------------------------------------------------
-- 1. Default company
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM companies WHERE id = '00000000-0000-0000-0000-000000000010')
BEGIN
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
        1
    );
END
GO

-- ------------------------------------------------------------
-- 2. Standard ITBIS tax rates for the default company
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM tax_rates WHERE company_id = '00000000-0000-0000-0000-000000000010')
BEGIN
    INSERT INTO tax_rates (id, company_id, name, rate, description, is_active)
    VALUES
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'ITBIS 18%',   18, 'Impuesto sobre Transferencias de Bienes y Servicios - tasa general 18%',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'ITBIS 16%',   16, 'Impuesto sobre Transferencias de Bienes y Servicios - tasa reducida 16%', 1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'Exento (0%)',   0, 'Exento de ITBIS',                                                         1);
END
GO

-- ------------------------------------------------------------
-- 3. Five custom_roles
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM custom_roles WHERE name = 'admin')
    INSERT INTO custom_roles (id, name, label, description, color, is_system)
    VALUES (NEWID(), 'admin', 'Administrador', 'Acceso total al sistema', 'sky', 1);

IF NOT EXISTS (SELECT 1 FROM custom_roles WHERE name = 'manager')
    INSERT INTO custom_roles (id, name, label, description, color, is_system)
    VALUES (NEWID(), 'manager', 'Gerente', 'Gestion operacional sin configuracion avanzada', 'teal', 1);

IF NOT EXISTS (SELECT 1 FROM custom_roles WHERE name = 'assistant')
    INSERT INTO custom_roles (id, name, label, description, color, is_system)
    VALUES (NEWID(), 'assistant', 'Asistente', 'Creacion y edicion de documentos basicos', 'emerald', 1);

IF NOT EXISTS (SELECT 1 FROM custom_roles WHERE name = 'operator')
    INSERT INTO custom_roles (id, name, label, description, color, is_system)
    VALUES (NEWID(), 'operator', 'Operador', 'Operaciones de facturacion basica', 'amber', 1);

IF NOT EXISTS (SELECT 1 FROM custom_roles WHERE name = 'viewer')
    INSERT INTO custom_roles (id, name, label, description, color, is_system)
    VALUES (NEWID(), 'viewer', 'Visor', 'Solo lectura sobre modulos permitidos', 'slate', 1);
GO

-- ------------------------------------------------------------
-- 4. role_permissions for 5 roles x 10 pages
-- ------------------------------------------------------------

-- ADMIN: all true on all pages
IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'admin')
BEGIN
    INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete) VALUES
        (NEWID(), 'admin', 'dashboard',     1, 1, 1, 1),
        (NEWID(), 'admin', 'invoices',      1, 1, 1, 1),
        (NEWID(), 'admin', 'clients',       1, 1, 1, 1),
        (NEWID(), 'admin', 'products',      1, 1, 1, 1),
        (NEWID(), 'admin', 'payments',      1, 1, 1, 1),
        (NEWID(), 'admin', 'electronic',    1, 1, 1, 1),
        (NEWID(), 'admin', 'email',         1, 1, 1, 1),
        (NEWID(), 'admin', 'notifications', 1, 1, 1, 1),
        (NEWID(), 'admin', 'analytics',     1, 1, 1, 1),
        (NEWID(), 'admin', 'admin',         1, 1, 1, 1);
END
GO

-- MANAGER: no admin page; analytics/notifications view-only; rest mostly true
IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'manager')
BEGIN
    INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete) VALUES
        (NEWID(), 'manager', 'dashboard',     1, 1, 1, 1),
        (NEWID(), 'manager', 'invoices',      1, 1, 1, 1),
        (NEWID(), 'manager', 'clients',       1, 1, 1, 1),
        (NEWID(), 'manager', 'products',      1, 1, 1, 1),
        (NEWID(), 'manager', 'payments',      1, 1, 1, 1),
        (NEWID(), 'manager', 'electronic',    1, 1, 1, 0),
        (NEWID(), 'manager', 'email',         1, 1, 1, 0),
        (NEWID(), 'manager', 'notifications', 1, 0, 0, 0),
        (NEWID(), 'manager', 'analytics',     1, 0, 0, 0),
        (NEWID(), 'manager', 'admin',         0, 0, 0, 0);
END
GO

-- ASSISTANT: view+create on invoices/clients/products/payments; no delete; no admin/analytics
IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'assistant')
BEGIN
    INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete) VALUES
        (NEWID(), 'assistant', 'dashboard',     1, 0, 0, 0),
        (NEWID(), 'assistant', 'invoices',      1, 1, 1, 0),
        (NEWID(), 'assistant', 'clients',       1, 1, 1, 0),
        (NEWID(), 'assistant', 'products',      1, 1, 1, 0),
        (NEWID(), 'assistant', 'payments',      1, 1, 1, 0),
        (NEWID(), 'assistant', 'electronic',    0, 0, 0, 0),
        (NEWID(), 'assistant', 'email',         1, 0, 0, 0),
        (NEWID(), 'assistant', 'notifications', 1, 0, 0, 0),
        (NEWID(), 'assistant', 'analytics',     0, 0, 0, 0),
        (NEWID(), 'assistant', 'admin',         0, 0, 0, 0);
END
GO

-- OPERATOR: view+create on invoices/clients/payments only
IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'operator')
BEGIN
    INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete) VALUES
        (NEWID(), 'operator', 'dashboard',     1, 0, 0, 0),
        (NEWID(), 'operator', 'invoices',      1, 1, 0, 0),
        (NEWID(), 'operator', 'clients',       1, 1, 0, 0),
        (NEWID(), 'operator', 'products',      0, 0, 0, 0),
        (NEWID(), 'operator', 'payments',      1, 1, 0, 0),
        (NEWID(), 'operator', 'electronic',    0, 0, 0, 0),
        (NEWID(), 'operator', 'email',         0, 0, 0, 0),
        (NEWID(), 'operator', 'notifications', 1, 0, 0, 0),
        (NEWID(), 'operator', 'analytics',     0, 0, 0, 0),
        (NEWID(), 'operator', 'admin',         0, 0, 0, 0);
END
GO

-- VIEWER: view-only on dashboard/invoices/clients/products/payments/notifications/analytics
IF NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'viewer')
BEGIN
    INSERT INTO role_permissions (id, role, page, can_view, can_create, can_edit, can_delete) VALUES
        (NEWID(), 'viewer', 'dashboard',     1, 0, 0, 0),
        (NEWID(), 'viewer', 'invoices',      1, 0, 0, 0),
        (NEWID(), 'viewer', 'clients',       1, 0, 0, 0),
        (NEWID(), 'viewer', 'products',      1, 0, 0, 0),
        (NEWID(), 'viewer', 'payments',      1, 0, 0, 0),
        (NEWID(), 'viewer', 'electronic',    0, 0, 0, 0),
        (NEWID(), 'viewer', 'email',         0, 0, 0, 0),
        (NEWID(), 'viewer', 'notifications', 1, 0, 0, 0),
        (NEWID(), 'viewer', 'analytics',     1, 0, 0, 0),
        (NEWID(), 'viewer', 'admin',         0, 0, 0, 0);
END
GO

-- ------------------------------------------------------------
-- 5. Default settings for the default company
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM settings WHERE company_id = '00000000-0000-0000-0000-000000000010')
BEGIN
    INSERT INTO settings (id, company_id, [key], value, description, category, is_active) VALUES
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'invoice_prefix',         'FAC',                   'Prefijo para numeracion de facturas',          'invoicing',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'invoice_next_number',    '1',                     'Proximo numero de factura',                    'invoicing',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'default_payment_terms',  '30',                    'Dias de plazo de pago por defecto',            'invoicing',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'default_currency',       'DOP',                   'Moneda por defecto',                           'invoicing',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'default_ncf_type',       'B01',                   'Tipo de NCF por defecto',                      'invoicing',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'invoice_footer_text',    'Gracias por su preferencia.', 'Texto del pie de pagina en facturas',    'invoicing',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'invoice_logo_visible',   'true',                  'Mostrar logo en facturas',                     'invoicing',  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'smtp_host',              'smtp.example.com',      'Host del servidor SMTP',                       'email',      1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'smtp_port',              '587',                   'Puerto SMTP',                                  'email',      1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'smtp_user',              'noreply@example.com',   'Usuario SMTP',                                 'email',      1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'smtp_password',          '',                      'Contrasena SMTP',                              'email',      1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'smtp_from',              'noreply@example.com',   'Direccion de remitente SMTP',                  'email',      1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'smtp_name',              'FacturaPro Demo',       'Nombre del remitente SMTP',                    'email',      1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'electronic_enabled',     'false',                 'Habilitar facturacion electronica',             'ecf',        1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'electronic_provider',    '',                      'Proveedor de facturacion electronica',          'ecf',        1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'electronic_environment', 'sandbox',               'Ambiente de facturacion electronica',           'ecf',        1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'dgii_auth_number',       '',                      'Numero de autorizacion DGII',                  'ecf',        1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'auto_send_invoice',      'false',                 'Enviar factura automaticamente al crear',       'automation', 1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'auto_send_reminder',     'true',                  'Enviar recordatorio de pago automaticamente',  'automation', 1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'reminder_days_before',   '3',                     'Dias antes del vencimiento para recordatorio', 'automation', 1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'overdue_notification',   'true',                  'Notificar facturas vencidas',                  'automation', 1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'timezone',               'America/Santo_Domingo', 'Zona horaria de la empresa',                   'general',    1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'date_format',            'DD/MM/YYYY',            'Formato de fecha',                             'general',    1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'language',               'es',                    'Idioma del sistema',                           'general',    1);
END
GO

-- ------------------------------------------------------------
-- 6. Default feature flags for the default company
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM feature_flags WHERE company_id = '00000000-0000-0000-0000-000000000010')
BEGIN
    INSERT INTO feature_flags (id, company_id, name, description, is_enabled) VALUES
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'electronic_invoicing', 'Modulo de facturacion electronica (eCF)',       0),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'recurring_invoices',   'Facturas recurrentes automaticas',              1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'multi_currency',       'Soporte de multiples monedas',                  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'email_automation',     'Automatizacion de correos electronicos',        1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'analytics_dashboard',  'Panel de analiticas e informes avanzados',      1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'expense_tracking',     'Modulo de registro de gastos',                  1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'credit_notes',         'Notas de credito',                              1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'product_inventory',    'Control basico de inventario de productos',     0),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'client_portal',        'Portal de acceso para clientes',                0),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'api_access',           'Acceso API externo para integraciones',         0),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'audit_trail',          'Registro de auditoria detallado',               1),
        (NEWID(), '00000000-0000-0000-0000-000000000010', 'dark_mode',            'Modo oscuro en la interfaz',                    1);
END
GO

-- ============================================================
-- END OF SCHEMA
-- ============================================================
