/*
  # Add email_list and email_body_template to clients

  ## Changes
  - `email_list` (text, default ''): comma-separated list of additional email recipients for invoice sends
  - `email_body_template` (text, default ''): custom email body template for this client

  These let each client have multiple notification addresses and a personalized email message.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'email_list'
  ) THEN
    ALTER TABLE clients ADD COLUMN email_list text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'email_body_template'
  ) THEN
    ALTER TABLE clients ADD COLUMN email_body_template text DEFAULT '';
  END IF;
END $$;
