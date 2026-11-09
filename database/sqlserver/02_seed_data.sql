/*
================================================================================
  FacturaPro - SQL Server Seed Data
  Run AFTER 01_create_schema.sql
  Schema version: 2026-05-14
================================================================================
*/

USE [FacturaPro];
GO

DECLARE @CompanyId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000010';

-- Default company
IF NOT EXISTS (SELECT 1 FROM companies WHERE id = @CompanyId)
BEGIN
  INSERT INTO companies (id, name, rnc, address, phone, email, country, is_active)
  VALUES (@CompanyId, 'Mi Empresa S.R.L.', '000000000',
          'Santo Domingo, República Dominicana',
          '809-000-0000', 'facturacion@miempresa.com', 'DO', 1);
END

-- Tax rates
IF NOT EXISTS (SELECT 1 FROM tax_rates WHERE company_id = @CompanyId)
BEGIN
  INSERT INTO tax_rates (company_id, name, rate, description) VALUES
    (@CompanyId, 'ITBIS 18%', 18.00, 'Impuesto sobre Transferencias de Bienes Industrializados y Servicios'),
    (@CompanyId, 'ITBIS 16%', 16.00, 'ITBIS reducido'),
    (@CompanyId, 'Exento',     0.00, 'Exento de impuestos');
END

-- Settings
INSERT INTO settings (company_id, [key], value, description, category)
SELECT @CompanyId, [key], value, description, category FROM (VALUES
  ('company_name',        'Mi Empresa S.R.L.',                  'Nombre de la empresa',                        'company'),
  ('company_rnc',         '000000000',                           'RNC de la empresa',                           'company'),
  ('company_address',     'Santo Domingo, República Dominicana', 'Dirección de la empresa',                     'company'),
  ('company_phone',       '809-000-0000',                        'Teléfono de la empresa',                      'company'),
  ('company_email',       'facturacion@miempresa.com',           'Email de facturación',                        'company'),
  ('company_logo_url',    '',                                    'URL o base64 del logo',                       'company'),
  ('invoice_prefix',      'FAC',                                 'Prefijo para números de factura',             'invoices'),
  ('next_invoice_number', '1',                                   'Próximo número de factura',                   'invoices'),
  ('currency',            'DOP',                                 'Moneda por defecto',                          'invoices'),
  ('payment_terms',       '30',                                  'Términos de pago por defecto (días)',         'invoices'),
  ('invoice_theme',       'classic',                             'Tema de factura: classic|modern|minimal|bold','invoices'),
  ('electronic_enabled',  'false',                               'Facturación electrónica habilitada',          'electronic'),
  ('electronic_provider', '',                                    'Proveedor de facturación electrónica',        'electronic'),
  ('smtp_host',           '',                                    'Servidor SMTP',                               'email'),
  ('smtp_port',           '587',                                 'Puerto SMTP',                                 'email'),
  ('smtp_user',           '',                                    'Usuario SMTP',                                'email'),
  ('smtp_password',       '',                                    'Contraseña SMTP / App Password',              'email'),
  ('smtp_from',           '',                                    'Email remitente',                             'email'),
  ('smtp_name',           '',                                    'Nombre remitente',                            'email'),
  ('bank_name',           '',                                    'Nombre del beneficiario',                     'banking'),
  ('bank_bank_name',      '',                                    'Nombre del banco',                            'banking'),
  ('bank_account',        '',                                    'Número de cuenta corriente',                  'banking'),
  ('bank_iban',           '',                                    'Cuenta regional / IBAN',                      'banking'),
  ('bank_contact',        '',                                    'Nombre del contacto de cobros',               'banking'),
  ('bank_contact_tel',    '',                                    'Teléfono del contacto',                       'banking'),
  ('bank_contact_email',  '',                                    'Email del contacto',                          'banking'),
  ('dgii_auth_number',    '',                                    'Número de autorización DGII',                 'company')
) AS v([key], value, description, category)
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.company_id = @CompanyId AND s.[key] = v.[key]);
GO

DECLARE @CompanyId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000010';

-- Feature flags
INSERT INTO feature_flags (company_id, name, description, is_enabled)
SELECT @CompanyId, name, description, is_enabled FROM (VALUES
  ('electronic_invoicing', 'Facturación Electrónica (e-CF)',  1),
  ('email_notifications',  'Notificaciones por email',        1),
  ('timed_emails',         'Emails programados automáticos',  1),
  ('payment_tracking',     'Seguimiento de pagos',            1),
  ('multi_currency',       'Soporte multi-moneda',            0),
  ('credit_notes',         'Notas de crédito',                1),
  ('recurring_invoices',   'Facturas recurrentes',            0),
  ('client_portal',        'Portal del cliente',              0)
) AS v(name, description, is_enabled)
WHERE NOT EXISTS (SELECT 1 FROM feature_flags f WHERE f.company_id = @CompanyId AND f.name = v.name);

-- ECF config default row
IF NOT EXISTS (SELECT 1 FROM ecf_provider_config WHERE id = '00000000-0000-0000-0000-000000000001')
BEGIN
  INSERT INTO ecf_provider_config (id, company_id)
  VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010');
END

-- Default admin user (password: Admin123! - change it after the first login)
IF NOT EXISTS (SELECT 1 FROM users_config WHERE email = 'admin@miempresa.com')
BEGIN
  INSERT INTO users_config (company_id, name, email, role, auth_provider, password_hash, is_active)
  VALUES (
    @CompanyId, 'Administrador', 'admin@miempresa.com', 'admin', 'local',
    '$2a$10$31hT7ecDIFCMzaJzkcVXl.hQ0XF7iLv83kAizUAovrm8wJugp2i4S', 1
  );
END

-- Default email schedules
IF NOT EXISTS (SELECT 1 FROM email_schedules WHERE company_id = @CompanyId)
BEGIN
  INSERT INTO email_schedules (company_id, name, trigger_event, days_offset, subject, body_template) VALUES
    (@CompanyId, 'Recordatorio 7 días antes', 'invoice_due', -7,
     'Recordatorio: Factura {{invoice_number}} vence en 7 días',
     N'Estimado {{client_name}},

Le recordamos que la factura {{invoice_number}} por {{total}} vence el {{due_date}}.

Gracias por su preferencia.'),
    (@CompanyId, 'Recordatorio día de vencimiento', 'invoice_due', 0,
     'Factura {{invoice_number}} vence hoy',
     N'Estimado {{client_name}},

Le informamos que la factura {{invoice_number}} por {{total}} vence el día de hoy.

Por favor realice su pago a la brevedad.'),
    (@CompanyId, 'Aviso de mora 3 días', 'overdue', 3,
     'Factura {{invoice_number}} - Pago pendiente',
     N'Estimado {{client_name}},

La factura {{invoice_number}} por {{total}} se encuentra vencida hace 3 días.

Por favor comuníquese con nosotros.');
END
GO

-- Built-in custom roles
INSERT INTO custom_roles (name, label, description, color, is_system)
SELECT name, label, description, color, is_system FROM (VALUES
  ('admin',     'Administrador', 'Acceso total al sistema. No puede modificarse.',               'sky',     1),
  ('manager',   'Gerente',       'Gestiona empresas asignadas con acceso operacional completo.',  'teal',    1),
  ('assistant', 'Asistente',     'Soporte en empresas asignadas. Puede crear pero no eliminar.', 'emerald', 1),
  ('operator',  'Operador',      'Operaciones del día a día: facturas, clientes y pagos.',        'amber',   1),
  ('viewer',    'Visor',         'Solo lectura. No puede crear ni modificar nada.',               'slate',   1)
) AS v(name, label, description, color, is_system)
WHERE NOT EXISTS (SELECT 1 FROM custom_roles cr WHERE cr.name = v.name);

-- Role permissions
INSERT INTO role_permissions (role, page, can_view, can_create, can_edit, can_delete)
SELECT role, page, can_view, can_create, can_edit, can_delete FROM (VALUES
  ('admin','dashboard',1,1,1,1),('admin','invoices',1,1,1,1),('admin','clients',1,1,1,1),
  ('admin','products',1,1,1,1),('admin','payments',1,1,1,1),('admin','electronic',1,1,1,1),
  ('admin','email',1,1,1,1),('admin','notifications',1,1,1,1),('admin','analytics',1,1,1,1),
  ('admin','admin',1,1,1,1),
  ('manager','dashboard',1,0,0,0),('manager','invoices',1,1,1,1),('manager','clients',1,1,1,1),
  ('manager','products',1,1,1,1),('manager','payments',1,1,1,0),('manager','electronic',1,1,1,0),
  ('manager','email',1,1,1,0),('manager','notifications',1,0,0,0),('manager','analytics',1,0,0,0),
  ('manager','admin',0,0,0,0),
  ('assistant','dashboard',1,0,0,0),('assistant','invoices',1,1,1,0),('assistant','clients',1,1,1,0),
  ('assistant','products',1,1,0,0),('assistant','payments',1,1,0,0),('assistant','electronic',1,0,0,0),
  ('assistant','email',1,0,0,0),('assistant','notifications',1,0,0,0),('assistant','analytics',0,0,0,0),
  ('assistant','admin',0,0,0,0),
  ('operator','dashboard',1,0,0,0),('operator','invoices',1,1,1,0),('operator','clients',1,1,0,0),
  ('operator','products',1,0,0,0),('operator','payments',1,1,0,0),('operator','electronic',0,0,0,0),
  ('operator','email',0,0,0,0),('operator','notifications',1,0,0,0),('operator','analytics',0,0,0,0),
  ('operator','admin',0,0,0,0),
  ('viewer','dashboard',1,0,0,0),('viewer','invoices',1,0,0,0),('viewer','clients',1,0,0,0),
  ('viewer','products',1,0,0,0),('viewer','payments',1,0,0,0),('viewer','electronic',0,0,0,0),
  ('viewer','email',0,0,0,0),('viewer','notifications',1,0,0,0),('viewer','analytics',1,0,0,0),
  ('viewer','admin',0,0,0,0)
) AS v(role, page, can_view, can_create, can_edit, can_delete)
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role = v.role AND rp.page = v.page);
GO
