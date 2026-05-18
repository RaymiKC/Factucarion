/*
  # Add e-CF Provider Configuration Tables

  ## Purpose
  Allows the application owner to configure and operate their own
  electronic invoice (e-CF / DGII) service, rather than relying on
  a third-party provider.

  ## New Tables

  ### ecf_provider_config
  Stores a single row of configuration for the operator's own
  e-CF service endpoint, credentials, and behavior flags.

  Columns:
  - id (uuid, pk)
  - mode: 'third_party' | 'own_service' — which submission path to use
  - own_service_url: base URL of the operator's own API endpoint
  - own_service_token: bearer token for authentication
  - own_service_environment: 'sandbox' | 'production'
  - third_party_provider: name of third-party provider (legacy)
  - third_party_api_key: API key for third-party provider (legacy)
  - ncf_b01_prefix / ncf_b02_prefix / ncf_b14_prefix: NCF series prefixes
  - ncf_b01_next / ncf_b02_next / ncf_b14_next: next sequence numbers
  - ncf_b01_limit / ncf_b02_limit / ncf_b14_limit: max sequences authorised
  - webhook_url: URL to call after DGII responds
  - webhook_secret: shared secret for webhook signature
  - auto_submit: automatically submit pending e-CFs on invoice creation
  - retry_on_failure: re-attempt rejected submissions automatically
  - updated_at

  ## Security
  - RLS enabled; only authenticated users may read or modify.
*/

CREATE TABLE IF NOT EXISTS ecf_provider_config (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode                      text NOT NULL DEFAULT 'third_party'
                            CONSTRAINT chk_ecf_mode CHECK (mode IN ('third_party', 'own_service')),
  own_service_url           text NOT NULL DEFAULT '',
  own_service_token         text NOT NULL DEFAULT '',
  own_service_environment   text NOT NULL DEFAULT 'sandbox'
                            CONSTRAINT chk_ecf_env CHECK (own_service_environment IN ('sandbox', 'production')),
  third_party_provider      text NOT NULL DEFAULT '',
  third_party_api_key       text NOT NULL DEFAULT '',
  ncf_b01_prefix            text NOT NULL DEFAULT 'B01',
  ncf_b01_next              integer NOT NULL DEFAULT 1,
  ncf_b01_limit             integer NOT NULL DEFAULT 1000,
  ncf_b02_prefix            text NOT NULL DEFAULT 'B02',
  ncf_b02_next              integer NOT NULL DEFAULT 1,
  ncf_b02_limit             integer NOT NULL DEFAULT 1000,
  ncf_b14_prefix            text NOT NULL DEFAULT 'B14',
  ncf_b14_next              integer NOT NULL DEFAULT 1,
  ncf_b14_limit             integer NOT NULL DEFAULT 1000,
  webhook_url               text NOT NULL DEFAULT '',
  webhook_secret            text NOT NULL DEFAULT '',
  auto_submit               boolean NOT NULL DEFAULT false,
  retry_on_failure          boolean NOT NULL DEFAULT false,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ecf_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ecf provider config"
  ON ecf_provider_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ecf provider config"
  ON ecf_provider_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update ecf provider config"
  ON ecf_provider_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default row so the UI always has something to load
INSERT INTO ecf_provider_config (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
