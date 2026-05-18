-- ============================================================
-- FacturaPro - Supabase Seed Data v2026-05-14
-- Run in Supabase SQL Editor AFTER 01_schema.sql
-- No RLS. Access controlled at the application layer.
-- ============================================================
-- This file is idempotent: all inserts use ON CONFLICT DO NOTHING.
-- Safe to re-run at any time without duplicating data.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Default company
-- ────────────────────────────────────────────────────────────
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
    website,
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
    'https://facturapro.do',
    'DOP',
    'FAC',
    1,
    30,
    true
) ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. Tax rates: ITBIS 18%, 16%, Exento 0%
-- ────────────────────────────────────────────────────────────
INSERT INTO tax_rates (id, company_id, name, rate, description, is_active)
VALUES
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000010',
     'ITBIS 18%', 18,
     'Impuesto sobre Transferencias de Bienes y Servicios - tasa general 18%',
     true),
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000010',
     'ITBIS 16%', 16,
     'Impuesto sobre Transferencias de Bienes y Servicios - tasa reducida 16%',
     true),
    (gen_random_uuid(),
     '00000000-0000-0000-0000-000000000010',
     'Exento (0%)', 0,
     'Exento de ITBIS',
     true)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. Custom roles (5 system roles)
-- ────────────────────────────────────────────────────────────
INSERT INTO custom_roles (id, name, label, description, color, is_system)
VALUES
    (gen_random_uuid(), 'admin',     'Administrador',
     'Acceso total al sistema',
     'sky',     true),
    (gen_random_uuid(), 'manager',   'Gerente',
     'Gestion operacional sin configuracion avanzada',
     'teal',    true),
    (gen_random_uuid(), 'assistant', 'Asistente',
     'Creacion y edicion de documentos basicos',
     'emerald', true),
    (gen_random_uuid(), 'operator',  'Operador',
     'Operaciones de facturacion basica',
     'amber',   true),
    (gen_random_uuid(), 'viewer',    'Visor',
     'Solo lectura sobre modulos permitidos',
     'slate',   true)
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. Role permissions (5 roles x 10 pages)
--    Pages: dashboard, invoices, clients, products, payments,
--           electronic, email, notifications, analytics, admin
-- ────────────────────────────────────────────────────────────

-- admin: full access on all pages
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

-- manager: no admin; no delete on electronic/email; view-only on analytics/notifications
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

-- assistant: create+edit on core; no delete; no electronic/analytics/admin
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

-- operator: invoices/clients/payments only; no edit or delete
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

-- viewer: read-only on all permitted pages
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

-- ────────────────────────────────────────────────────────────
-- 5. Default settings for the default company
-- ────────────────────────────────────────────────────────────
INSERT INTO settings (id, company_id, key, value, description, category, is_active)
VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'invoice_prefix',         'FAC',
     'Prefijo para numeracion de facturas',           'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'next_invoice_number',    '1',
     'Proximo numero de factura',                     'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'default_payment_terms',  '30',
     'Dias de plazo de pago por defecto',             'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'default_currency',       'DOP',
     'Moneda por defecto',                            'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'default_ncf_type',       'B01',
     'Tipo de NCF por defecto',                       'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'invoice_footer_text',    'Gracias por su preferencia.',
     'Texto del pie de pagina en facturas',           'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'invoice_logo_visible',   'true',
     'Mostrar logo en facturas',                      'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'invoice_theme',          'classic',
     'Tema de factura: classic|modern|minimal|bold',  'invoicing',  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'smtp_host',              'smtp.example.com',
     'Host del servidor SMTP',                        'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'smtp_port',              '587',
     'Puerto SMTP',                                   'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'smtp_user',              'noreply@example.com',
     'Usuario SMTP',                                  'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'smtp_password',          '',
     'Contrasena SMTP',                               'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'smtp_from',              'noreply@example.com',
     'Direccion de remitente SMTP',                   'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'smtp_name',              'FacturaPro Demo',
     'Nombre del remitente SMTP',                     'email',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'electronic_enabled',     'false',
     'Habilitar facturacion electronica',             'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'electronic_provider',    '',
     'Proveedor de facturacion electronica',          'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'electronic_environment', 'sandbox',
     'Ambiente de facturacion electronica',           'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'dgii_auth_number',       '',
     'Numero de autorizacion DGII',                   'ecf',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'auto_send_invoice',      'false',
     'Enviar factura automaticamente al crear',       'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'auto_send_reminder',     'true',
     'Enviar recordatorio de pago automaticamente',   'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'reminder_days_before',   '3',
     'Dias antes del vencimiento para recordatorio',  'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'overdue_notification',   'true',
     'Notificar facturas vencidas',                   'automation', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'timezone',               'America/Santo_Domingo',
     'Zona horaria de la empresa',                    'general',    true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'date_format',            'DD/MM/YYYY',
     'Formato de fecha',                              'general',    true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'language',               'es',
     'Idioma del sistema',                            'general',    true)
ON CONFLICT (company_id, key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. Default feature flags for the default company
-- ────────────────────────────────────────────────────────────
INSERT INTO feature_flags (id, company_id, name, description, is_enabled)
VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'electronic_invoicing', 'Modulo de facturacion electronica (eCF)',       false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'recurring_invoices',   'Facturas recurrentes automaticas',              true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'multi_currency',       'Soporte de multiples monedas',                  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'email_automation',     'Automatizacion de correos electronicos',        true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'analytics_dashboard',  'Panel de analiticas e informes avanzados',      true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'expense_tracking',     'Modulo de registro de gastos',                  true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'credit_notes',         'Notas de credito',                              true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'product_inventory',    'Control basico de inventario de productos',     false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'client_portal',        'Portal de acceso para clientes',                false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'api_access',           'Acceso API externo para integraciones',         false),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'audit_trail',          'Registro de auditoria detallado',               true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010',
     'dark_mode',            'Modo oscuro en la interfaz',                    true)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. Sample demo user in users_config
--    name: 'Demo', email: 'demo', role: 'admin'
--    password_hash: 'demo'  (NOT a real hash — for local dev only)
-- ────────────────────────────────────────────────────────────
INSERT INTO users_config (
    id,
    company_id,
    name,
    email,
    role,
    permissions,
    password_hash,
    auth_provider,
    preferred_theme,
    preferred_language,
    preferred_region,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000010',
    'Demo',
    'demo',
    'admin',
    '{}',
    'demo',
    'local',
    'light',
    'es',
    'DO',
    true
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- END OF SEED DATA
-- ============================================================
