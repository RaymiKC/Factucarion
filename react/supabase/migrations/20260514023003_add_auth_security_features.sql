/*
  # Auth Security Features

  ## Overview
  Adds OTP-based password reset, account lockout, and first-time login enforcement.

  ## New Tables
  - `otp_tokens`
    - Stores 6-digit OTP codes for password reset
    - Expires after 10 minutes
    - Max 3 failed attempts before token is invalidated

  ## New Columns on users_config
  - `failed_login_attempts` (int) — consecutive failed logins; resets on success
  - `locked_until` (timestamptz) — if set and in future, login is blocked
  - `must_change_password` (bool) — true for new users; forces password-change flow on first login
  - `otp_enabled` (bool) — whether this user requires OTP on login
  - `temp_password` (text) — one-time password for new users (cleared after first login)
*/

-- ── OTP tokens table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users_config(id) ON DELETE CASCADE,
  email        text NOT NULL,
  token        text NOT NULL,
  attempts     int  NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  used         boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_tokens_email      ON otp_tokens(email);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id    ON otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires_at ON otp_tokens(expires_at);

-- ── New columns on users_config ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='failed_login_attempts') THEN
    ALTER TABLE users_config ADD COLUMN failed_login_attempts int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='locked_until') THEN
    ALTER TABLE users_config ADD COLUMN locked_until timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='must_change_password') THEN
    ALTER TABLE users_config ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='otp_enabled') THEN
    ALTER TABLE users_config ADD COLUMN otp_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_config' AND column_name='temp_password') THEN
    ALTER TABLE users_config ADD COLUMN temp_password text;
  END IF;
END $$;

-- ── Global OTP setting in feature_flags ───────────────────────────────────────
INSERT INTO feature_flags (name, description, is_enabled, company_id)
SELECT 'otp_required_for_all', 'Require OTP verification for all users on login', false,
       '00000000-0000-0000-0000-000000000010'
WHERE NOT EXISTS (
  SELECT 1 FROM feature_flags WHERE name = 'otp_required_for_all'
);
