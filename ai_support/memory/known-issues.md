# Known issues, dead code and parity gaps

Verified against the repository on 2026-11-09 (after the Supabase removal). Each entry: **what** →
**why it matters** → **evidence** → **candidate fix**. Do not "fix" these as drive-by changes; they
need a scoped task.

Severity is about user/business impact here, not a formal rating.

---

## Resolved on 2026-11-09 (kept for history)

The move to a self-hosted API (`server/`) plus PostgreSQL/SQL Server (`database/`) closed these:

| Was | Status now |
|---|---|
| K-001 — RLS disabled + anon key in the browser | **Resolved.** No public DB key exists any more; the API requires a JWT. Per-tenant enforcement is still client-side (see K-001b below). |
| K-002 — `db.ts` provider abstraction was dead code | **Resolved.** `react/src/lib/db.ts` and `angular/src/app/services/db.service.ts` are now the only data path. |
| K-003 — passwords verified in the browser (unsalted SHA-256) | **Resolved.** bcrypt in `server/src/routes/auth.ts`; legacy hashes upgraded on next login. |
| Edge-function mail + `environment.ts` holding a Supabase URL/key | **Resolved.** SMTP lives in `server/.env`; the tracked `environment.ts` now only holds `apiBase`. |
| Notification, payment, NCF-void and tax-rate inserts omitted `company_id`; `invoices.recurrence_rule` was `NOT NULL` although both clients insert `null` for one-time invoices | **Resolved.** The inserts set `company_id`; `recurrence_rule` is nullable in both engines (fresh schema + `05_upgrade_existing.sql`). |

---

## K-001b — Tenancy is still enforced only by the clients 🔴 high

**What.** The API authenticates every request but does not verify that the JWT's user may touch the
`company_id` in the query/body. `useAuth().canAccessCompany` and the `company_id` filters are the only
guard.

**Why.** A valid user from company A can still request company B's rows if they craft the request
directly (the UI never does this, but the API allows it).

**Evidence.** `server/src/routes/db.ts` (no company check), `react/src/lib/company.tsx`,
`angular/src/app/services/company.service.ts`.

**Fix path.** Add a middleware that derives the allowed company set from the JWT
(`companyIds` / `role`) and force `company_id` into every filter on tenant tables.

---

## K-002 — `users_config` is the auth table too 🟡 medium

**What.** Credentials, lockout counters and profile preferences share one table. Any query that reads
`users_config` returns `password_hash` and `temp_password` unless the caller selects columns.

**Why.** It is easy to leak hashes into the UI or logs by selecting `*`.

**Evidence.** `react/src/lib/hooks.ts` (`useUsersConfig` selects `*`),
`database/postgres/01_create_schema.sql` (`users_config`).

**Fix path.** Project a safe column list on reads (the API already does this for `/api/auth/*`), or
move credentials to a separate `user_credentials` table.

`react/src` — the only other mention of `VITE_DB_API_BASE` is help text in the Admin "database" tab
(`react/src/pages/Admin.tsx:1401`).

**Fix path.** Either delete (and drop `VITE_DB_PROVIDER` from `.env` docs) or commit to a repository
layer refactor of `lib/hooks.ts` + page mutations.

---

## K-003 — Demo login is an unauthenticated admin entry point 🟠 high

**What.** `login('demo', 'demo')` returns an admin user with `id: 'demo'` client-side, with no API
call and no database row.

**Why.** It is an unauthenticated admin entry point that ships in production builds. (Password
verification itself now happens server-side with bcrypt, so the old SHA-256 concern is gone.)

**Evidence.** `react/src/lib/auth.tsx` (`DEMO_USER`), `angular/src/app/services/auth.service.ts`.

**Fix path.** Gate the demo login behind `import.meta.env.DEV` / Angular's `environment.production`,
or remove it.

---

## K-004 — Invoice counter update is not company-scoped 🟠 high

**What.** After creating an invoice, `Invoices.handleCreate` increments the counter with
`db.from('settings').update({ value }).eq('key', 'next_invoice_number')` — no `company_id`
filter. `useSettings(companyId)` *reads* per company, so the read and the write disagree.

**Why.** With more than one company, the update hits every company's `next_invoice_number` row,
corrupting numbering for all tenants and potentially producing duplicate invoice numbers.

**Evidence.** `react/src/pages/Invoices.tsx:226` vs `react/src/lib/hooks.ts:100-130`
(`updateSetting` correctly scopes by `company_id`).

**Fix path.** Scope the update with `.eq('company_id', companyId)` (or route through
`useSettings().updateSetting`). Add a regression test/manual check with two companies.

---

## K-005 — `audit_log` exists but is never written 🟡 medium

**What.** Migration `20260513215053_add_auth_logo_and_audit.sql` creates `audit_log`. The React app
contains no reference to it.

**Why.** Auditing/traceability is assumed to exist but does not. Security-relevant actions (user
creation, permission changes, invoice void, e-CF submission) leave no audit trail.

**Evidence.** `react/supabase/migrations/20260513215053_add_auth_logo_and_audit.sql`; zero matches for
`audit_log` under `react/src`.

**Fix path.** Decide first: DB triggers or app-level writes. Then log the listed actions with actor,
company, entity and before/after payload.

---

## K-006 — Invoice line items are insert-only 🟡 medium

**What.** `invoice_items` are inserted when an invoice is created and read for display; there is no
update or delete path in the UI.

**Why.** Editing an existing invoice's lines is impossible through the app even though the invoice
form implies editing. Users must cancel and recreate, which burns an NCF.

**Evidence.** `react/src/pages/Invoices.tsx:225` (only write), `:1200` (read).

**Fix path.** Add an edit flow that replaces items transactionally and recomputes invoice totals; keep
NCF unchanged unless the invoice type changes.

---

## K-007 — Recurring invoices have no generator 🟡 medium

**What.** `invoices` supports `invoice_type`, `recurrence_rule`, `recurrence_end`,
`parent_invoice_id`, and the create form sets them. Nothing in the repo creates the follow-up invoices.

**Why.** The UI offers a recurring feature that never produces copies; users will believe it works.

**Evidence.** `20260512191248_add_ncf_sequences_and_recurring_invoices.sql`;
no scheduler/cron/Edge Function referencing `parent_invoice_id`.

**Fix path.** A scheduled Edge Function (or `pg_cron`) that materializes due copies, allocates a new
NCF per copy and links `parent_invoice_id`.

---

## K-008 — Angular parity gaps 🟠 high for anything shipped in React

**What.**
1. Angular `Admin` is ~29 KB vs ~108 KB in React (several tabs missing/simplified).
2. Page permission keys differ: Angular `PAGE_LIST` has 12 entries including `email_schedules`,
   `monthly_report`, `swagger`; React `ALL_PAGES` has 10 and uses `email`, with `report`/`swagger`
   outside the registry. The same role rows therefore cannot satisfy both apps identically.

**Why.** Anything "done" in React is not automatically done in Angular, and permission data seeded for
one app may not match the other.

**Evidence.** `angular/src/app/services/permissions.service.ts:10`, `react/src/lib/permissions.tsx:10-24`,
`angular/src/app/pages/admin/admin.component.ts` vs `react/src/pages/Admin.tsx`.

**Fix path.** Decide Q-1 in `decisions.md`; then either delete `angular/` or freeze a parity list and
align the permission key registry between the two apps.

---

## K-009 — No tests and no CI ⚪ low

**What.** `react/package.json` has no test script and there are no spec files. `angular/` ships default
Karma/Jasmine but no meaningful specs. No `.github/workflows`.

**Why.** Regressions in NCF numbering, payment reconciliation or permissions are caught only manually;
nothing blocks a broken merge.

**Evidence.** `react/package.json`, `angular/package.json`, absence of `.github/`.

**Fix path.** Start with pure functions that carry the business rules (`assignNcf` logic,
`calcLine`, permission resolution) extracted into testable modules; add typecheck + build as a CI gate.

---

## K-010 — Permission registry and page gating disagree 🟡 medium

**What.** `report` and `swagger` are rendered by `App.tsx` but are not in `ALL_PAGES`, so no
`role_permissions`/`user_permissions` row can ever target them. `report` is gated by the `analytics`
permission and `swagger` by `isAdmin` only.

**Why.** A non-admin cannot be granted the monthly report without also granting full analytics, and
`visiblePages` never contains those screens (the sidebar derives labels from the nav list, not
permissions, so they appear for admins only).

**Evidence.** `react/src/App.tsx:71-72`, `react/src/lib/permissions.tsx:8-40`,
`react/src/components/Layout.tsx:61,76`.

**Fix path.** Add them to `ALL_PAGES`/`PAGE_REGISTRY` with their own keys and seed rows, or document
the coupling as intentional.

---

## K-011 — Errors are swallowed throughout the UI 🟡 medium

**What.** Most mutations destructure only `{ data }` and ignore `error`; several network calls end in
`.catch(() => {})`.

**Why.** Failed writes look successful: the modal closes, `refetch()` returns unchanged data, and no
message is shown (feedback is a `notifications` row that is only inserted on the success path).

**Evidence.** `react/src/pages/Invoices.tsx:195-243`, `react/src/lib/auth.tsx` (`sendOtpEmail`
`.catch(() => {})`).

**Fix path.** Standardize on checking `error` in new code and surface it via a notification row; do not
mass-rewrite existing call sites without a testing strategy.

---

## K-012 — Settings keys are stringly typed and easy to desync 🟡 medium

**What.** Configuration is a `(company_id, key)` key/value table consumed as free strings
(`getSetting('smtp_port')`, `getSetting('bank_iban')`, …). Missing keys silently return `''`.

**Why.** Typo in a key name = silently absent configuration (e.g. SMTP silently unconfigured, invoice
prefix falling back to `FAC`). There is no central key registry.

**Evidence.** `react/src/lib/hooks.ts:100-132`, `react/src/pages/Admin.tsx:955-1160`,
`react/src/pages/Invoices.tsx:198-199`.

**Fix path.** Introduce a `SETTINGS_KEYS` const map used by Admin, hooks and Edge Functions; validate on
save.

---

## K-013 — Large single-file screens ⚪ low (maintainability)

**What.** `Admin.tsx` ~108 KB, `Invoices.tsx` ~86 KB, `i18n.tsx` ~53 KB, `Api/index.ts` ~29 KB.

**Why.** Any mechanical edit risks unintended changes; merge conflicts are frequent; the components
cannot be unit tested in isolation.

**Evidence.** File sizes under `react/src`.

**Fix path.** Extract tab components (`Admin`), an invoice form/model module (`Invoices`), and split
translations per language file. Do it as dedicated refactors, not inside feature PRs.

---

## K-014 — SMTP credentials live only in `server/.env` 🟡 medium for email features

**What.** Outbound email reads `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` from
`server/.env`. The Admin → Email tab still stores `smtp_*` values in `settings`, where nothing reads
them any more.

**Why.** A fresh install shows an SMTP form that has no effect: OTP login, welcome mail and scheduled
reminders silently do nothing until the server env is configured. `OTP_DEBUG=true` masks this locally
because the API returns the code in the response.

**Evidence.** `server/src/services/mailer.ts`, `server/src/routes/mail.ts`,
`react/src/pages/Admin.tsx` (email tab), `server/.env.example`.

**Fix path.** Either make `/api/mail/send` prefer per-company `settings` when present (falling back to
env), or replace the Admin form with a read-only status panel fed by `/api/mail/status`.

---

## K-015 — e-CF "third party" submission is a simulation 🔴 high

**What.** `Invoices.submitInvoice()` only performs a network call in `own_service` mode. Otherwise it
does `await new Promise(r => setTimeout(r, 1500))`, approves with `Math.random() > 0.2`, and invents an
id (`eCF-<timestamp>-<random>`), then writes `electronic_status = 'approved'` and
`electronic_response.provider = 'demo'`.

**Why.** The UI reports DGII acceptance for invoices that were never submitted. `third_party_provider`
and `third_party_api_key` are collected in the Electronic page but no code path uses them, and the
`auto_submit` / `retry_on_failure` toggles are persisted with no consumer. Any decision about tax
compliance based on `electronic_status` is unsafe.

**Evidence.** `react/src/pages/Invoices.tsx:310-355` (the `else` branch),
`react/src/pages/Electronic.tsx:278-279,329-355`.

**Fix path.** Implement the provider adapter behind `ecf_provider_config`, or hide/disable the feature
until it is real. Never leave a random approval path reachable in a production build.

---

## K-016 — `invoice_items` has no `company_id` (tenancy is inherited) 🟡 medium

**What.** Of the child tables, only `invoice_items` still lacks `company_id`
(`payment_records`, `notifications`, `email_log` and `ncf_void_log` all have it). Its tenancy is
inherited through `invoice_id`.

**Why.** It is easy to "add tenancy" to a query that filters `invoice_items.company_id` — the API
rejects the unknown column and the caller discards the error, so the UI silently shows nothing.

**Evidence.** `database/postgres/01_create_schema.sql` (`invoice_items`),
`database/sqlserver/01_create_schema.sql`, `react/src/pages/Invoices.tsx` (line-item writes).

**Fix path.** Keep filtering `invoice_items` only through `invoice_id`, or add the column plus a
backfill from `invoices.company_id` in both engines (a real migration).



