-- ============================================================
-- FacturaPro - Supabase Upgrade Script v2026-05-14
-- Run this on existing databases to add new columns.
-- Safe to run multiple times (uses IF NOT EXISTS checks).
-- ============================================================

-- Add security columns to users_config (added in v2026-05)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='failed_login_attempts') THEN
    ALTER TABLE users_config ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='locked_until') THEN
    ALTER TABLE users_config ADD COLUMN locked_until TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='must_change_password') THEN
    ALTER TABLE users_config ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='otp_enabled') THEN
    ALTER TABLE users_config ADD COLUMN otp_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='temp_password') THEN
    ALTER TABLE users_config ADD COLUMN temp_password TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='email_language') THEN
    ALTER TABLE users_config ADD COLUMN email_language TEXT NOT NULL DEFAULT 'es';
  END IF;
END $$;

-- Create otp_tokens table if not exists
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

-- Add otp_required_for_all feature flag if not present
INSERT INTO feature_flags (name, description, is_enabled)
VALUES ('otp_required_for_all', 'Require OTP verification for all users on every login', false)
ON CONFLICT (name) DO NOTHING;
