/*
  # Add Expenses Table

  ## Overview
  Creates a table for tracking company expenses, enabling the analytics/performance page
  to calculate net profit, burn rate, and efficiency metrics.

  ## New Tables
  - `expenses`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users)
    - `date` (date) - when the expense occurred
    - `category` (text) - e.g. "Nómina", "Marketing", "Operaciones", etc.
    - `description` (text) - free-text description
    - `amount` (numeric) - amount in DOP
    - `vendor` (text, nullable) - supplier/vendor name
    - `receipt_url` (text, nullable) - link to receipt
    - `created_at`, `updated_at` (timestamptz)

  ## Security
  - RLS enabled; users can only access their own expenses
*/

CREATE TABLE IF NOT EXISTS expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  category     text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  amount       numeric(14, 2) NOT NULL DEFAULT 0,
  vendor       text,
  receipt_url  text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_user_id_idx  ON expenses(user_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx      ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx  ON expenses(category);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
