/*
  # Add banking details and DGII authorization settings

  Adds new settings rows for:
  - Banking details shown on invoice footer (bank name, account, IBAN, contact)
  - DGII authorization number shown on invoice header
*/

INSERT INTO settings (key, value, description, category) VALUES
  ('bank_name',          '',  'Nombre del beneficiario para pagos',           'banking'),
  ('bank_bank_name',     '',  'Nombre del banco',                             'banking'),
  ('bank_account',       '',  'Número de cuenta corriente',                   'banking'),
  ('bank_iban',          '',  'Cuenta regional / IBAN',                       'banking'),
  ('bank_contact',       '',  'Nombre del contacto de cobros',                'banking'),
  ('bank_contact_tel',   '',  'Teléfono del contacto',                        'banking'),
  ('bank_contact_email', '',  'Email del contacto',                           'banking'),
  ('dgii_auth_number',   '',  'Número de autorización DGII',                  'company')
ON CONFLICT (key) DO NOTHING;
