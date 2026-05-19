/*
  # Add email language preference to users_config

  1. Changes
    - Adds `email_language` column to `users_config` (es | en | fr, default 'es')
      This controls the language used for system emails (OTP codes, welcome, notifications).
      It is separate from `preferred_language` which controls the UI language.

  2. Notes
    - Defaults to 'es' (Spanish) to match existing behavior
    - No data migration needed — existing rows inherit the default
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_config' AND column_name = 'email_language'
  ) THEN
    ALTER TABLE users_config ADD COLUMN email_language TEXT NOT NULL DEFAULT 'es';
  END IF;
END $$;
