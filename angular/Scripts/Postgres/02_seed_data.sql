-- ============================================================
-- FacturaPro - PostgreSQL Seed Data
-- Run AFTER 01_create_schema.sql
-- Schema version: 2026-05-14
-- ============================================================

-- Default company (required — all tenant data references this)
INSERT INTO companies (id, name, rnc, address, phone, email, country, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Mi Empresa S.R.L.', '000000000',
  'Santo Domingo, República Dominicana',
  '809-000-0000', 'facturacion@miempresa.com', 'DO', true
) ON CONFLICT (id) DO NOTHING;

-- Tax rates
INSERT INTO tax_rates (company_id, name, rate, description) VALUES
  ('00000000-0000-0000-0000-000000000010', 'ITBIS 18%', 18.00, 'Impuesto sobre Transferencias de Bienes Industrializados y Servicios'),
  ('00000000-0000-0000-0000-000000000010', 'ITBIS 16%', 16.00, 'ITBIS reducido'),
  ('00000000-0000-0000-0000-000000000010', 'Exento',     0.00, 'Exento de impuestos')
ON CONFLICT DO NOTHING;

-- Application settings
INSERT INTO settings (company_id, key, value, description, category) VALUES
  ('00000000-0000-0000-0000-000000000010', 'company_name',        'Mi Empresa S.R.L.',                  'Nombre de la empresa',                   'company'),
  ('00000000-0000-0000-0000-000000000010', 'company_rnc',         '000000000',                           'RNC de la empresa',                      'company'),
  ('00000000-0000-0000-0000-000000000010', 'company_address',     'Santo Domingo, República Dominicana', 'Dirección de la empresa',                'company'),
  ('00000000-0000-0000-0000-000000000010', 'company_phone',       '809-000-0000',                        'Teléfono de la empresa',                 'company'),
  ('00000000-0000-0000-0000-000000000010', 'company_email',       'facturacion@miempresa.com',           'Email de facturación',                   'company'),
  ('00000000-0000-0000-0000-000000000010', 'company_logo_url',    '',                                    'URL o base64 del logo de la empresa',    'company'),
  ('00000000-0000-0000-0000-000000000010', 'invoice_prefix',      'FAC',                                 'Prefijo para números de factura',        'invoices'),
  ('00000000-0000-0000-0000-000000000010', 'next_invoice_number', '1',                                   'Próximo número de factura',              'invoices'),
  ('00000000-0000-0000-0000-000000000010', 'currency',            'DOP',                                 'Moneda por defecto',                     'invoices'),
  ('00000000-0000-0000-0000-000000000010', 'payment_terms',       '30',                                  'Términos de pago por defecto (días)',    'invoices'),
  ('00000000-0000-0000-0000-000000000010', 'invoice_theme',       'classic',                             'Tema de factura: classic|modern|minimal|bold', 'invoices'),
  ('00000000-0000-0000-0000-000000000010', 'electronic_enabled',  'false',                               'Facturación electrónica habilitada',     'electronic'),
  ('00000000-0000-0000-0000-000000000010', 'electronic_provider', '',                                    'Proveedor de facturación electrónica',   'electronic'),
  ('00000000-0000-0000-0000-000000000010', 'smtp_host',           '',                                    'Servidor SMTP',                          'email'),
  ('00000000-0000-0000-0000-000000000010', 'smtp_port',           '587',                                 'Puerto SMTP',                            'email'),
  ('00000000-0000-0000-0000-000000000010', 'smtp_user',           '',                                    'Usuario SMTP',                           'email'),
  ('00000000-0000-0000-0000-000000000010', 'smtp_password',       '',                                    'Contraseña SMTP / App Password',         'email'),
  ('00000000-0000-0000-0000-000000000010', 'smtp_from',           '',                                    'Email remitente',                        'email'),
  ('00000000-0000-0000-0000-000000000010', 'smtp_name',           '',                                    'Nombre remitente',                       'email'),
  ('00000000-0000-0000-0000-000000000010', 'bank_name',           '',                                    'Nombre del beneficiario para pagos',     'banking'),
  ('00000000-0000-0000-0000-000000000010', 'bank_bank_name',      '',                                    'Nombre del banco',                       'banking'),
  ('00000000-0000-0000-0000-000000000010', 'bank_account',        '',                                    'Número de cuenta corriente',             'banking'),
  ('00000000-0000-0000-0000-000000000010', 'bank_iban',           '',                                    'Cuenta regional / IBAN',                 'banking'),
  ('00000000-0000-0000-0000-000000000010', 'bank_contact',        '',                                    'Nombre del contacto de cobros',          'banking'),
  ('00000000-0000-0000-0000-000000000010', 'bank_contact_tel',    '',                                    'Teléfono del contacto',                  'banking'),
  ('00000000-0000-0000-0000-000000000010', 'bank_contact_email',  '',                                    'Email del contacto',                     'banking'),
  ('00000000-0000-0000-0000-000000000010', 'dgii_auth_number',    '',                                    'Número de autorización DGII',            'company')
ON CONFLICT (company_id, key) DO NOTHING;

-- Feature flags
INSERT INTO feature_flags (company_id, name, description, is_enabled) VALUES
  ('00000000-0000-0000-0000-000000000010', 'electronic_invoicing', 'Facturación Electrónica (e-CF)',  true),
  ('00000000-0000-0000-0000-000000000010', 'email_notifications',  'Notificaciones por email',        true),
  ('00000000-0000-0000-0000-000000000010', 'timed_emails',         'Emails programados automáticos',  true),
  ('00000000-0000-0000-0000-000000000010', 'payment_tracking',     'Seguimiento de pagos',            true),
  ('00000000-0000-0000-0000-000000000010', 'multi_currency',       'Soporte multi-moneda',            false),
  ('00000000-0000-0000-0000-000000000010', 'credit_notes',         'Notas de crédito',                true),
  ('00000000-0000-0000-0000-000000000010', 'recurring_invoices',   'Facturas recurrentes',            false),
  ('00000000-0000-0000-0000-000000000010', 'client_portal',        'Portal del cliente',              false)
ON CONFLICT DO NOTHING;

-- ECF provider config default row
INSERT INTO ecf_provider_config (id, company_id)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
ON CONFLICT (id) DO NOTHING;

-- Default email schedules
INSERT INTO email_schedules (company_id, name, trigger_event, days_offset, subject, body_template) VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    'Recordatorio 7 días antes', 'invoice_due', -7,
    'Recordatorio: Factura {{invoice_number}} vence en 7 días',
    E'Estimado {{client_name}},\n\nLe recordamos que la factura {{invoice_number}} por {{total}} vence el {{due_date}}.\n\nGracias por su preferencia.'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'Recordatorio día de vencimiento', 'invoice_due', 0,
    'Factura {{invoice_number}} vence hoy',
    E'Estimado {{client_name}},\n\nLe informamos que la factura {{invoice_number}} por {{total}} vence el día de hoy.\n\nPor favor realice su pago a la brevedad.'
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'Aviso de mora 3 días', 'overdue', 3,
    'Factura {{invoice_number}} - Pago pendiente',
    E'Estimado {{client_name}},\n\nLa factura {{invoice_number}} por {{total}} se encuentra vencida hace 3 días.\n\nPor favor comuníquese con nosotros.'
  )
ON CONFLICT DO NOTHING;

-- Default admin user
INSERT INTO users_config (company_id, name, email, role, auth_provider, is_active)
VALUES ('00000000-0000-0000-0000-000000000010', 'Administrador', 'admin@miempresa.com', 'admin', 'local', true)
ON CONFLICT (email) DO NOTHING;

-- Built-in custom roles
INSERT INTO custom_roles (name, label, description, color, is_system) VALUES
  ('admin',     'Administrador', 'Acceso total al sistema. No puede modificarse.',                    'sky',     true),
  ('manager',   'Gerente',       'Gestiona empresas asignadas con acceso operacional completo.',       'teal',    true),
  ('assistant', 'Asistente',     'Soporte en empresas asignadas. Puede crear pero no eliminar.',      'emerald', true),
  ('operator',  'Operador',      'Operaciones del día a día: facturas, clientes y pagos.',             'amber',   true),
  ('viewer',    'Visor',         'Solo lectura. No puede crear ni modificar nada.',                    'slate',   true)
ON CONFLICT (name) DO NOTHING;

-- Default role permissions
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
  ('admin', 'admin',         true,  true,  true,  true),
  ('manager', 'dashboard',     true,  false, false, false),
  ('manager', 'invoices',      true,  true,  true,  true),
  ('manager', 'clients',       true,  true,  true,  true),
  ('manager', 'products',      true,  true,  true,  true),
  ('manager', 'payments',      true,  true,  true,  false),
  ('manager', 'electronic',    true,  true,  true,  false),
  ('manager', 'email',         true,  true,  true,  false),
  ('manager', 'notifications', true,  false, false, false),
  ('manager', 'analytics',     true,  false, false, false),
  ('manager', 'admin',         false, false, false, false),
  ('assistant', 'dashboard',     true,  false, false, false),
  ('assistant', 'invoices',      true,  true,  true,  false),
  ('assistant', 'clients',       true,  true,  true,  false),
  ('assistant', 'products',      true,  true,  false, false),
  ('assistant', 'payments',      true,  true,  false, false),
  ('assistant', 'electronic',    true,  false, false, false),
  ('assistant', 'email',         true,  false, false, false),
  ('assistant', 'notifications', true,  false, false, false),
  ('assistant', 'analytics',     false, false, false, false),
  ('assistant', 'admin',         false, false, false, false),
  ('operator', 'dashboard',     true,  false, false, false),
  ('operator', 'invoices',      true,  true,  true,  false),
  ('operator', 'clients',       true,  true,  false, false),
  ('operator', 'products',      true,  false, false, false),
  ('operator', 'payments',      true,  true,  false, false),
  ('operator', 'electronic',    false, false, false, false),
  ('operator', 'email',         false, false, false, false),
  ('operator', 'notifications', true,  false, false, false),
  ('operator', 'analytics',     false, false, false, false),
  ('operator', 'admin',         false, false, false, false),
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
