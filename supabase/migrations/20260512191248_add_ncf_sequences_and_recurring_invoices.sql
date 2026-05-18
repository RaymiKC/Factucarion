/*
  # NCF Sequences, Void Log, and Recurring Invoices

  ## Overview
  Three additions to support proper DGII NCF management and recurring billing:

  ## 1. ncf_sequences
  Manages the authorized NCF ranges issued by DGII. Each row represents
  one authorized sequence block (e.g. B01 from 1325 to 1900).
  - `ncf_type`     : B01, B02, B14, B15
  - `prefix`       : full prefix including zeros, e.g. "B0100001"
  - `current_seq`  : next number to assign
  - `from_seq`     : start of authorized range
  - `to_seq`       : end of authorized range
  - `dgii_auth`    : DGII authorization number (e.g. 2003173285)
  - `expires_at`   : optional expiry date
  - `is_active`    : only one active per ncf_type at a time

  ## 2. ncf_void_log
  Every cancelled invoice records its NCF here.
  - `invoice_id`     : which invoice was cancelled
  - `invoice_number` : for readability
  - `ncf`            : the NCF number that was voided
  - `ncf_type`       : B01, B02, etc.
  - `issue_month`    : YYYY-MM of the original invoice
  - `cancelled_at`   : when it was cancelled
  - `reuse_allowed`  : true if same month (can be requeued), false if month passed
  - `reused_by_invoice_id` : if it was reassigned, which invoice got it
  - `notes`          : free text

  ## 3. invoices additions
  - `invoice_type`     : 'one_time' | 'recurring'
  - `recurrence_rule`  : 'monthly' | 'bimonthly' | 'quarterly' | 'yearly'
  - `recurrence_end`   : date after which no more copies are generated
  - `parent_invoice_id`: for generated recurring copies, references original

  ## Security
  RLS enabled on new tables, open policies (matching existing schema pattern).
*/

-- NCF authorized sequences from DGII
CREATE TABLE IF NOT EXISTS ncf_sequences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ncf_type      text NOT NULL CHECK (ncf_type IN ('B01','B02','B14','B15')),
  prefix        text NOT NULL DEFAULT '',
  from_seq      integer NOT NULL DEFAULT 1,
  to_seq        integer NOT NULL DEFAULT 1,
  current_seq   integer NOT NULL DEFAULT 1,
  dgii_auth     text NOT NULL DEFAULT '',
  expires_at    date,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ncf_sequences_type_active ON ncf_sequences(ncf_type, is_active);

ALTER TABLE ncf_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on ncf_sequences"  ON ncf_sequences FOR SELECT  USING (true);
CREATE POLICY "Allow insert on ncf_sequences"  ON ncf_sequences FOR INSERT  WITH CHECK (true);
CREATE POLICY "Allow update on ncf_sequences"  ON ncf_sequences FOR UPDATE  USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on ncf_sequences"  ON ncf_sequences FOR DELETE  USING (true);

-- Log of voided / cancelled NCFs
CREATE TABLE IF NOT EXISTS ncf_void_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_number          text NOT NULL DEFAULT '',
  ncf                     text NOT NULL DEFAULT '',
  ncf_type                text NOT NULL DEFAULT '',
  issue_month             text NOT NULL DEFAULT '',
  cancelled_at            timestamptz DEFAULT now(),
  reuse_allowed           boolean NOT NULL DEFAULT false,
  reused_by_invoice_id    uuid REFERENCES invoices(id) ON DELETE SET NULL,
  notes                   text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ncf_void_log_ncf ON ncf_void_log(ncf);

ALTER TABLE ncf_void_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select on ncf_void_log"  ON ncf_void_log FOR SELECT  USING (true);
CREATE POLICY "Allow insert on ncf_void_log"  ON ncf_void_log FOR INSERT  WITH CHECK (true);
CREATE POLICY "Allow update on ncf_void_log"  ON ncf_void_log FOR UPDATE  USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete on ncf_void_log"  ON ncf_void_log FOR DELETE  USING (true);

-- Add recurring and invoice_type columns to invoices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_type') THEN
    ALTER TABLE invoices ADD COLUMN invoice_type text NOT NULL DEFAULT 'one_time'
      CONSTRAINT chk_invoice_type CHECK (invoice_type IN ('one_time','recurring'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='recurrence_rule') THEN
    ALTER TABLE invoices ADD COLUMN recurrence_rule text DEFAULT NULL
      CONSTRAINT chk_recurrence_rule CHECK (recurrence_rule IN ('monthly','bimonthly','quarterly','yearly'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='recurrence_end') THEN
    ALTER TABLE invoices ADD COLUMN recurrence_end date DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='parent_invoice_id') THEN
    ALTER TABLE invoices ADD COLUMN parent_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;
