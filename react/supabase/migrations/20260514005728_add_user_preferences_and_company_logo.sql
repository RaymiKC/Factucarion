/*
  # User Preferences and Company Logo

  ## Overview
  Adds per-user theme and language preferences, and ensures companies have a
  proper logo_url column so each company can have its own uploaded logo.

  ## Changes

  ### users_config (modified)
  - `preferred_theme` (text, default 'light') — 'light' or 'dark'
  - `preferred_language` (text, default 'es') — 'es', 'en', or 'fr'
  - `preferred_region` (text, default 'DO') — region code

  ### companies (modified)
  - `logo_url` already exists from multi-company migration; ensure it's present

  ## Notes
  - Theme and language are stored per user so they persist across devices
  - The app reads these on login and applies them immediately
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_config' AND column_name = 'preferred_theme'
  ) THEN
    ALTER TABLE users_config ADD COLUMN preferred_theme text DEFAULT 'light'
      CHECK (preferred_theme IN ('light', 'dark'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_config' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE users_config ADD COLUMN preferred_language text DEFAULT 'es';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_config' AND column_name = 'preferred_region'
  ) THEN
    ALTER TABLE users_config ADD COLUMN preferred_region text DEFAULT 'DO';
  END IF;
END $$;

-- companies.logo_url was added in the multi-company migration; guard it anyway
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN logo_url text;
  END IF;
END $$;
