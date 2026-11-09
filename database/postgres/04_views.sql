-- ============================================================
-- FacturaPro - PostgreSQL Views v2026-05-14
-- Run AFTER 01_create_schema.sql
-- No RLS. Access controlled at application layer.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- vw_invoice_detail
-- Full invoice record joined with client details.
-- Includes computed balance_due (total - amount_paid).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_invoice_detail AS
SELECT
  i.id,
  i.company_id,
  i.invoice_number,
  i.ncf,
  i.ncf_type,
  i.status,
  i.invoice_type,
  i.issue_date,
  i.due_date,
  i.payment_date,
  i.subtotal,
  i.tax_amount,
  i.discount_amount,
  i.total,
  i.amount_paid,
  i.total - i.amount_paid             AS balance_due,
  i.currency,
  i.exchange_rate,
  i.is_electronic,
  i.electronic_status,
  i.notes,
  i.terms,
  i.sent_at,
  c.id                                AS client_id,
  c.name                              AS client_name,
  c.email                             AS client_email,
  c.rnc                               AS client_rnc,
  c.cedula                            AS client_cedula,
  c.phone                             AS client_phone,
  c.address                           AS client_address,
  c.city                              AS client_city,
  c.country                           AS client_country,
  c.client_type,
  i.created_at,
  i.updated_at
FROM invoices i
LEFT JOIN clients c ON c.id = i.client_id;

-- ────────────────────────────────────────────────────────────
-- vw_overdue_invoices
-- All invoices with status = 'overdue', enriched with
-- days_overdue (CURRENT_DATE - due_date) and balance_due.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_overdue_invoices AS
SELECT
  i.id,
  i.company_id,
  i.invoice_number,
  i.ncf,
  i.ncf_type,
  c.id                                AS client_id,
  c.name                              AS client_name,
  c.email                             AS client_email,
  c.phone                             AS client_phone,
  i.issue_date,
  i.due_date,
  CURRENT_DATE - i.due_date           AS days_overdue,
  i.total,
  i.amount_paid,
  i.total - i.amount_paid             AS balance_due,
  i.currency
FROM invoices i
LEFT JOIN clients c ON c.id = i.client_id
WHERE i.status    = 'overdue'
  AND i.due_date IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- vw_payment_summary
-- Payments aggregated by company, calendar month, and method.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_payment_summary AS
SELECT
  i.company_id,
  to_char(p.payment_date, 'YYYY-MM')  AS month,
  p.payment_method,
  COUNT(*)                             AS payment_count,
  SUM(p.amount)                        AS total_amount
FROM payment_records p
JOIN invoices i ON i.id = p.invoice_id
GROUP BY i.company_id,
         to_char(p.payment_date, 'YYYY-MM'),
         p.payment_method;

-- ────────────────────────────────────────────────────────────
-- vw_client_balance
-- Per-client outstanding balance, total invoiced, total paid,
-- and overdue amount.  Only active clients are included.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_client_balance AS
SELECT
  c.company_id,
  c.id,
  c.name,
  c.email,
  c.rnc,
  c.cedula,
  c.phone,
  c.city,
  c.client_type,
  COUNT(i.id)                                                                               AS invoice_count,
  COALESCE(SUM(i.total), 0)                                                                 AS total_invoiced,
  COALESCE(SUM(i.amount_paid), 0)                                                           AS total_paid,
  COALESCE(SUM(i.total - i.amount_paid), 0)                                                AS total_outstanding,
  COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.total - i.amount_paid ELSE 0 END), 0) AS overdue_amount
FROM clients c
LEFT JOIN invoices i
       ON i.client_id = c.id
      AND i.status NOT IN ('cancelled', 'void', 'draft')
WHERE c.is_active = true
GROUP BY c.company_id, c.id, c.name, c.email, c.rnc, c.cedula,
         c.phone, c.city, c.client_type;

-- ────────────────────────────────────────────────────────────
-- vw_monthly_revenue
-- Monthly revenue (paid invoices) broken down by company,
-- including invoice count, total tax collected, and discounts.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_monthly_revenue AS
SELECT
  company_id,
  to_char(issue_date, 'YYYY-MM')      AS month,
  COUNT(*)                             AS invoice_count,
  SUM(total)                           AS revenue,
  SUM(tax_amount)                      AS tax_collected,
  SUM(discount_amount)                 AS discounts_given
FROM invoices
WHERE status = 'paid'
GROUP BY company_id, to_char(issue_date, 'YYYY-MM')
ORDER BY company_id, month;

-- ────────────────────────────────────────────────────────────
-- vw_ncf_status
-- NCF sequence usage and remaining capacity per company/type.
-- Useful for alerts when a sequence is running low.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_ncf_status AS
SELECT
  company_id,
  ncf_type,
  prefix,
  from_seq,
  to_seq,
  current_seq,
  to_seq - current_seq + 1            AS remaining,
  ROUND(
    (current_seq - from_seq)::NUMERIC
    / NULLIF(to_seq - from_seq + 1, 0) * 100,
    1
  )                                    AS pct_used,
  dgii_auth,
  expires_at,
  is_active,
  CASE
    WHEN is_active = false                    THEN 'inactive'
    WHEN expires_at IS NOT NULL
     AND expires_at < CURRENT_DATE            THEN 'expired'
    WHEN to_seq - current_seq + 1 <= 10       THEN 'critical'
    WHEN to_seq - current_seq + 1 <= 50       THEN 'low'
    ELSE 'ok'
  END                                  AS health
FROM ncf_sequences
ORDER BY company_id, ncf_type;

-- ============================================================
-- END OF VIEWS
-- ============================================================
