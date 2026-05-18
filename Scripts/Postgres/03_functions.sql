-- ============================================================
-- FacturaPro - PostgreSQL Functions v2026-05-14
-- Run AFTER 01_create_schema.sql and 02_seed_data.sql
-- No RLS. Access controlled at application layer.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- fn_get_next_invoice_number(p_company_id)
-- Atomically reads invoice_prefix + next_invoice_number from
-- the settings table, increments the counter, and returns the
-- formatted invoice number (e.g. "FAC-000042").
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_next_invoice_number(p_company_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT;
  v_next   INTEGER;
BEGIN
  SELECT value INTO v_prefix
  FROM settings
  WHERE company_id = p_company_id AND key = 'invoice_prefix';

  SELECT value::INTEGER INTO v_next
  FROM settings
  WHERE company_id = p_company_id AND key = 'next_invoice_number';

  UPDATE settings
  SET value      = (v_next + 1)::TEXT,
      updated_at = now()
  WHERE company_id = p_company_id AND key = 'next_invoice_number';

  RETURN COALESCE(v_prefix, 'FAC') || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

-- ────────────────────────────────────────────────────────────
-- fn_record_payment(...)
-- Inserts a payment_record row and updates the invoice
-- amount_paid and status atomically.
-- Status becomes 'paid' when amount_paid >= total, else 'partial'.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_record_payment(
  p_invoice_id UUID,
  p_amount     NUMERIC,
  p_method     TEXT,
  p_date       DATE,
  p_reference  TEXT DEFAULT '',
  p_notes      TEXT DEFAULT ''
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_company_id UUID;
  v_total      NUMERIC;
  v_paid       NUMERIC;
  v_new_paid   NUMERIC;
  v_new_status TEXT;
BEGIN
  SELECT company_id, total, amount_paid
  INTO   v_company_id, v_total, v_paid
  FROM   invoices
  WHERE  id = p_invoice_id;

  INSERT INTO payment_records
    (company_id, invoice_id, amount, payment_method, payment_date, reference, notes)
  VALUES
    (v_company_id, p_invoice_id, p_amount, p_method, p_date, p_reference, p_notes);

  v_new_paid   := v_paid + p_amount;
  v_new_status := CASE WHEN v_new_paid >= v_total THEN 'paid' ELSE 'partial' END;

  UPDATE invoices
  SET amount_paid  = v_new_paid,
      status       = v_new_status,
      payment_date = CASE WHEN v_new_status = 'paid' THEN p_date ELSE payment_date END,
      updated_at   = now()
  WHERE id = p_invoice_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- fn_mark_overdue_invoices(p_company_id)
-- Sets status = 'overdue' for all invoices whose status is
-- 'sent' or 'partial' and whose due_date is before today.
-- Pass NULL to run across all companies (e.g. via pg_cron).
-- Returns the number of rows updated.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_mark_overdue_invoices(p_company_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE invoices
  SET status     = 'overdue',
      updated_at = now()
  WHERE status  IN ('sent', 'partial')
    AND due_date IS NOT NULL
    AND due_date <  CURRENT_DATE
    AND (p_company_id IS NULL OR company_id = p_company_id);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- fn_get_dashboard_metrics(p_company_id)
-- Returns a single-row summary of KPIs for the dashboard.
-- Columns:
--   total_invoices      - all invoices for the company
--   total_revenue       - sum of totals for paid invoices
--   pending_amount      - balance due on sent/partial invoices
--   overdue_amount      - balance due on overdue invoices
--   overdue_count       - count of overdue invoices
--   paid_this_month     - revenue from invoices paid this month
--   invoices_this_month - count of invoices issued this month
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_dashboard_metrics(p_company_id UUID)
RETURNS TABLE (
  total_invoices      BIGINT,
  total_revenue       NUMERIC,
  pending_amount      NUMERIC,
  overdue_amount      NUMERIC,
  overdue_count       BIGINT,
  paid_this_month     NUMERIC,
  invoices_this_month BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)                                                                                        AS total_invoices,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0)                              AS total_revenue,
    COALESCE(SUM(CASE WHEN status IN ('sent', 'partial') THEN total - amount_paid ELSE 0 END), 0)  AS pending_amount,
    COALESCE(SUM(CASE WHEN status = 'overdue' THEN total - amount_paid ELSE 0 END), 0)             AS overdue_amount,
    COUNT(CASE WHEN status = 'overdue' THEN 1 END)                                                 AS overdue_count,
    COALESCE(SUM(CASE
        WHEN status = 'paid'
         AND date_trunc('month', issue_date) = date_trunc('month', CURRENT_DATE)
        THEN total ELSE 0
      END), 0)                                                                                      AS paid_this_month,
    COUNT(CASE
        WHEN date_trunc('month', issue_date) = date_trunc('month', CURRENT_DATE)
        THEN 1
      END)                                                                                          AS invoices_this_month
  FROM invoices
  WHERE company_id = p_company_id;
$$;

-- ────────────────────────────────────────────────────────────
-- fn_get_monthly_revenue(p_company_id, p_months)
-- Returns one row per calendar month for the last p_months
-- months (default 6), with the sum of paid invoice totals.
-- Result columns: month (TEXT 'YYYY-MM'), amount (NUMERIC).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_monthly_revenue(
  p_company_id UUID,
  p_months     INTEGER DEFAULT 6
)
RETURNS TABLE (month TEXT, amount NUMERIC) LANGUAGE sql STABLE AS $$
  SELECT
    to_char(issue_date, 'YYYY-MM')  AS month,
    SUM(total)                      AS amount
  FROM invoices
  WHERE company_id = p_company_id
    AND status     = 'paid'
    AND issue_date >= date_trunc('month', CURRENT_DATE)
                      - ((p_months - 1) || ' months')::INTERVAL
  GROUP BY to_char(issue_date, 'YYYY-MM')
  ORDER BY month;
$$;

-- ────────────────────────────────────────────────────────────
-- fn_get_next_ncf(p_company_id, p_ncf_type)
-- Atomically returns the current NCF sequence number formatted
-- as prefix + 8-digit zero-padded integer, then increments the
-- counter.  Uses FOR UPDATE to prevent concurrent duplicates.
-- Raises an exception if no active sequence is found or if the
-- sequence is exhausted.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_next_ncf(p_company_id UUID, p_ncf_type TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_seq_id   UUID;
  v_prefix   TEXT;
  v_current  INTEGER;
  v_to       INTEGER;
  v_ncf      TEXT;
BEGIN
  SELECT id, prefix, current_seq, to_seq
  INTO   v_seq_id, v_prefix, v_current, v_to
  FROM   ncf_sequences
  WHERE  company_id = p_company_id
    AND  ncf_type   = p_ncf_type
    AND  is_active  = true
    AND  (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active NCF sequence found for type %', p_ncf_type;
  END IF;

  IF v_current > v_to THEN
    RAISE EXCEPTION 'NCF sequence exhausted for type %', p_ncf_type;
  END IF;

  v_ncf := v_prefix || LPAD(v_current::TEXT, 8, '0');

  UPDATE ncf_sequences
  SET current_seq = v_current + 1,
      updated_at  = now()
  WHERE id = v_seq_id;

  RETURN v_ncf;
END;
$$;

-- ============================================================
-- END OF FUNCTIONS
-- ============================================================
