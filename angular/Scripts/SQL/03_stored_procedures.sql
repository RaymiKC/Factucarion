/*
================================================================================
  FacturaPro - SQL Server Stored Procedures v2026-05-14
  Run AFTER 01_create_schema.sql and 02_seed_data.sql
  No RLS. Access controlled at the application layer.
================================================================================
*/

USE [FacturaPro];
GO

-- ────────────────────────────────────────────────────────────
-- sp_GetNextInvoiceNumber
-- Atomically reads invoice_prefix + next_invoice_number from
-- the settings table, increments the counter, and returns the
-- formatted invoice number (e.g. "FAC-000042").
-- ────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_GetNextInvoiceNumber
  @company_id UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @prefix  NVARCHAR(20);
  DECLARE @nextNum INT;

  SELECT @prefix  = value
  FROM   settings
  WHERE  company_id = @company_id AND [key] = 'invoice_prefix';

  SELECT @nextNum = CAST(value AS INT)
  FROM   settings
  WHERE  company_id = @company_id AND [key] = 'next_invoice_number';

  UPDATE settings
  SET    value      = CAST(@nextNum + 1 AS NVARCHAR(20)),
         updated_at = SYSUTCDATETIME()
  WHERE  company_id = @company_id AND [key] = 'next_invoice_number';

  SELECT ISNULL(@prefix, 'FAC') + '-'
       + RIGHT('000000' + CAST(@nextNum AS NVARCHAR(10)), 6) AS invoice_number;
END
GO

-- ────────────────────────────────────────────────────────────
-- sp_RecordPayment
-- Inserts a payment_record row and updates the invoice
-- amount_paid and status inside a transaction.
-- Status becomes 'paid' when amount_paid >= total, else 'partial'.
-- ────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_RecordPayment
  @invoice_id     UNIQUEIDENTIFIER,
  @amount         DECIMAL(18,2),
  @payment_method NVARCHAR(50),
  @payment_date   DATE,
  @reference      NVARCHAR(200) = '',
  @notes          NVARCHAR(MAX) = ''
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;

  BEGIN TRY
    DECLARE @company_id  UNIQUEIDENTIFIER;
    DECLARE @total       DECIMAL(18,2);
    DECLARE @paid        DECIMAL(18,2);
    DECLARE @new_paid    DECIMAL(18,2);
    DECLARE @new_status  NVARCHAR(20);

    SELECT @company_id = company_id,
           @total      = total,
           @paid       = amount_paid
    FROM   invoices
    WHERE  id = @invoice_id;

    INSERT INTO payment_records
      (company_id, invoice_id, amount, payment_method, payment_date, reference, notes)
    VALUES
      (@company_id, @invoice_id, @amount, @payment_method, @payment_date, @reference, @notes);

    SET @new_paid   = @paid + @amount;
    SET @new_status = CASE WHEN @new_paid >= @total THEN 'paid' ELSE 'partial' END;

    UPDATE invoices
    SET    amount_paid  = @new_paid,
           status       = @new_status,
           payment_date = CASE WHEN @new_status = 'paid' THEN @payment_date ELSE payment_date END,
           updated_at   = SYSUTCDATETIME()
    WHERE  id = @invoice_id;

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
  END CATCH
END
GO

-- ────────────────────────────────────────────────────────────
-- sp_MarkOverdueInvoices
-- Sets status = 'overdue' for all invoices whose status is
-- 'sent' or 'partial' and whose due_date is before today.
-- Pass NULL @company_id to run across all companies.
-- Returns the number of rows updated.
-- ────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_MarkOverdueInvoices
  @company_id UNIQUEIDENTIFIER = NULL
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE invoices
  SET    status     = 'overdue',
         updated_at = SYSUTCDATETIME()
  WHERE  status  IN ('sent', 'partial')
    AND  due_date IS NOT NULL
    AND  due_date <  CAST(SYSUTCDATETIME() AS DATE)
    AND  (@company_id IS NULL OR company_id = @company_id);

  SELECT @@ROWCOUNT AS rows_updated;
END
GO

-- ────────────────────────────────────────────────────────────
-- sp_GetDashboardMetrics
-- Returns a single-row summary of KPIs for the dashboard.
-- Columns:
--   total_invoices      - all invoices for the company
--   total_revenue       - sum of totals for paid invoices
--   pending_amount      - balance due on sent/partial invoices
--   overdue_amount      - balance due on overdue invoices
--   overdue_count       - count of overdue invoices
--   paid_this_month     - revenue from invoices paid this calendar month
--   invoices_this_month - count of invoices issued this calendar month
-- ────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_GetDashboardMetrics
  @company_id UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    COUNT(*)                                                                AS total_invoices,
    ISNULL(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0)        AS total_revenue,
    ISNULL(SUM(CASE WHEN status IN ('sent','partial')
                    THEN total - amount_paid ELSE 0 END), 0)               AS pending_amount,
    ISNULL(SUM(CASE WHEN status = 'overdue'
                    THEN total - amount_paid ELSE 0 END), 0)               AS overdue_amount,
    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END)                    AS overdue_count,
    ISNULL(SUM(CASE
        WHEN status = 'paid'
         AND YEAR(issue_date)  = YEAR(SYSUTCDATETIME())
         AND MONTH(issue_date) = MONTH(SYSUTCDATETIME())
        THEN total ELSE 0
      END), 0)                                                              AS paid_this_month,
    SUM(CASE
        WHEN YEAR(issue_date)  = YEAR(SYSUTCDATETIME())
         AND MONTH(issue_date) = MONTH(SYSUTCDATETIME())
        THEN 1 ELSE 0
      END)                                                                  AS invoices_this_month
  FROM invoices
  WHERE company_id = @company_id;
END
GO

-- ────────────────────────────────────────────────────────────
-- sp_GetMonthlyRevenue
-- Returns one row per calendar month for the last @months
-- months (default 6), with the sum of paid invoice totals.
-- ────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_GetMonthlyRevenue
  @company_id UNIQUEIDENTIFIER,
  @months     INT = 6
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    FORMAT(issue_date, 'yyyy-MM') AS month,
    SUM(total)                    AS amount
  FROM   invoices
  WHERE  company_id = @company_id
    AND  status     = 'paid'
    AND  issue_date >= DATEFROMPARTS(
                         YEAR(DATEADD(MONTH, -(@months - 1), SYSUTCDATETIME())),
                         MONTH(DATEADD(MONTH, -(@months - 1), SYSUTCDATETIME())),
                         1)
  GROUP BY FORMAT(issue_date, 'yyyy-MM')
  ORDER BY month;
END
GO

-- ────────────────────────────────────────────────────────────
-- sp_GetNextNcf
-- Atomically returns the current NCF sequence number formatted
-- as prefix + 8-digit zero-padded integer, then increments the
-- counter using an explicit row-level lock (UPDLOCK, ROWLOCK).
-- Raises an error if no active sequence is found or exhausted.
-- ────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_GetNextNcf
  @company_id UNIQUEIDENTIFIER,
  @ncf_type   NVARCHAR(5)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;

  BEGIN TRY
    DECLARE @seq_id  UNIQUEIDENTIFIER;
    DECLARE @prefix  NVARCHAR(20);
    DECLARE @current INT;
    DECLARE @to_seq  INT;

    SELECT TOP 1
      @seq_id  = id,
      @prefix  = prefix,
      @current = current_seq,
      @to_seq  = to_seq
    FROM ncf_sequences WITH (UPDLOCK, ROWLOCK)
    WHERE company_id = @company_id
      AND ncf_type   = @ncf_type
      AND is_active  = 1
      AND (expires_at IS NULL OR expires_at >= CAST(SYSUTCDATETIME() AS DATE))
    ORDER BY created_at DESC;

    IF @seq_id IS NULL
    BEGIN
      ROLLBACK TRANSACTION;
      RAISERROR('No active NCF sequence found for type %s', 16, 1, @ncf_type);
      RETURN;
    END

    IF @current > @to_seq
    BEGIN
      ROLLBACK TRANSACTION;
      RAISERROR('NCF sequence exhausted for type %s', 16, 1, @ncf_type);
      RETURN;
    END

    UPDATE ncf_sequences
    SET    current_seq = @current + 1,
           updated_at  = SYSUTCDATETIME()
    WHERE  id = @seq_id;

    COMMIT TRANSACTION;

    SELECT @prefix + RIGHT('00000000' + CAST(@current AS NVARCHAR(8)), 8) AS ncf;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH
END
GO

/*
================================================================================
  END OF STORED PROCEDURES
================================================================================
*/
