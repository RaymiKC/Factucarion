# Decisions (ADR-lite)

Backfilled from the code on 2026-11-08 — these decisions were already made, not newly proposed.
Add a new entry (next free number) whenever you make a choice that future work must respect.

Format: **Context → Decision → Consequences → Evidence**. Status: `Active`, `Superseded by D-xxx`,
or `Open question`.

---

## D-001 — Two independent front-ends, React is the reference implementation

**Status:** Active

**Context.** The repo contains `react/` (Vite, complete) and `angular/` (Angular 20, added later as a
"replica project"). Both target the same Supabase project.

**Decision.** Ship features in `react/` first; mirror to `angular/` only where parity is required.
There is no shared package, codegen or monorepo tooling.

**Consequences.** Every behavior change is potentially a two-file-family change; drift is expected and
must be declared in the PR. Schema changes affect both apps whether or not Angular code changes.

**Evidence.** Root layout; `angular/README.md`; commit `e73f629`.

---

## D-002 — No client-side router in React

**Status:** Active

**Context.** The app has ~12 screens and needs gated navigation.

**Decision.** `App.tsx` owns `currentPage` state and renders one page at a time; `Layout` receives
`onNavigate`. Angular, by contrast, uses `@angular/router` with `authGuard`.

**Consequences.** No deep links, no back/forward, refresh returns to `dashboard`. Adding a route
requires touching `Page`, `App.tsx`, `Layout`, and `permissions.tsx` together. Introducing
`react-router` later is a whole-app refactor.

**Evidence.** `react/src/App.tsx`, `react/src/components/Layout.tsx`, `angular/src/app/app.routes.ts`.

---

## D-003 — Authentication is a custom state machine over `users_config`

**Status:** Active

**Context.** The app needs temp passwords, forced password change, lockout and emailed OTP — beyond
what Supabase Auth offers out of the box in this UI.

**Decision.** `users_config` is both the credential store and the profile table. Login checks, in
order: hard-coded demo user → `temp_password` → `supabase.auth.signInWithPassword` → SHA-256 hash
comparison against `users_config.password_hash`. OTP tokens live in `otp_tokens` and are delivered by
the `send-email` Edge Function. Session continuity uses `users_config.supabase_uid`.

**Consequences.** Verification happens in the browser; password hashing is unsalted SHA-256; Supabase
Auth is optional. Rotating credentials or enforcing policies requires app changes, not dashboard
settings. See `known-issues.md` K-003.

**Evidence.** `react/src/lib/auth.tsx` (`login`, `verifyPasswordHash`, `createOtpToken`),
`20260514023003_add_auth_security_features.sql`.

---

## D-004 — Tenancy via `company_id` column + `company_users` membership

**Status:** Active

**Context.** One deployment serves multiple companies ("multi-company support" migration).

**Decision.** Tenant tables carry `company_id NOT NULL` (cascade delete): `clients, invoices,
products_services, tax_rates, ncf_sequences, expenses, email_schedules, feature_flags, settings,
users_config, ecf_provider_config`. Child tables (`invoice_items`, `payment_records`, `notifications`,
`email_log`) inherit tenancy through their parent. Membership is
`company_users(company_id, user_config_id, role_override)`. Admins see all companies; others see only
their assignments. The selected company is cached in `localStorage['facturapro_company']` and drilled
into pages as a `companyId` prop.

**Consequences.** Filtering is a per-query responsibility in the UI — there is no server-side tenant
guard and RLS is off, so a missed `.eq('company_id', ...)` silently crosses tenants.

**Evidence.** `20260512195225_add_multi_company_support.sql`, `react/src/lib/company.tsx`,
`react/src/lib/hooks.ts`.

---

## D-005 — Table-driven permissions (role defaults + per-user overrides)

**Status:** Active

**Context.** Customers need custom roles and exceptions without redeploying.

**Decision.** Permissions are data: `role_permissions(role, page, can_view/create/edit/delete)` and
`user_permissions(user_config_id, page, ...)`, with `custom_roles` defining non-system roles. The page
list is code (`ALL_PAGES` / `PAGE_REGISTRY`). Resolution: admin → user override → role default → none.

**Consequences.** Adding a page requires a code change *and* seeded permission rows (the custom-role
creation path seeds blank rows automatically). Some screens (`report`, `swagger`) are outside the
registry and are gated directly in `App.tsx`.

**Evidence.** `react/src/lib/permissions.tsx`, `20260512212646_add_role_permissions.sql`,
`20260513144908_add_custom_roles.sql`.

---

## D-006 — Region config drives invoicing rules, not just labels

**Status:** Active

**Context.** The same product must issue DGII-compliant invoices in the Dominican Republic and generic
invoices in the US and Canada.

**Decision.** `REGIONS` in `lib/i18n.tsx` carries currency, locale, tax label and default rate,
invoice-number label, tax-id labels, `hasNcfSequences`, and the allowed invoice types. `region` is a
user preference persisted in `users_config`.

**Consequences.** `ncf_type` means B01/B02/B14/B15 in DO and standard/proforma/credit elsewhere. Code
must never hard-code `B01`, `ITBIS`, `18` or `DOP`. NCF sequence management is only meaningful when
`hasNcfSequences` is true.

**Evidence.** `react/src/lib/i18n.tsx` (`REGIONS`), `react/src/pages/Invoices.tsx` (`assignNcf`),
`react/src/pages/Electronic.tsx`.

---

## D-007 — The UI talks to Supabase directly

**Status:** Superseded by D-011

**Context.** A database-agnostic layer was sketched so deployments could use Postgres or SQL Server.

**Decision.** In practice, hooks and pages call `supabase-js` directly. `lib/db.ts` exposes
`proxyQuery`/`proxyMutate` against an Express proxy (`VITE_DB_API_BASE`), and `Scripts/*/05_api_proxy.js`
implements `/query` and `/mutate`, but **no page or hook uses them**.

**Consequences.** Swapping providers is not a config flip. Any refactor toward a repository layer must
rewrite `lib/hooks.ts` and the inline mutations in pages. Do not describe the app as
"database-agnostic".

**Evidence.** `react/src/lib/db.ts` (no importers), `react/Scripts/Postgres/05_api_proxy.js`,
`react/src/lib/hooks.ts`.

---

## D-008 — RLS is disabled; authorization is a UI concern

**Status:** Superseded by D-011 — **known risk**

**Context.** Early migrations used permissive `USING (true)` policies; later work needed the anon client
to read/write many tables during rapid iteration.

**Decision.** `20260514015652_disable_all_rls.sql` turns RLS off for all tables. The anon key is
shipped to the browser.

**Consequences.** Anyone with the key can read/write the database; the UI guards (`useAuth`,
`usePermissions`) are advisory only. Re-enabling RLS is a project, not a patch: it needs auth claims
mapped to `users_config` and policies per table/company.

**Evidence.** `react/supabase/migrations/20260514015652_disable_all_rls.sql`,
`react/src/lib/supabase.ts` (client created with anon key).

---

## D-009 — Migrations are the schema source of truth; `Scripts/` are portable copies

**Status:** Superseded by D-011

**Context.** The product is also deployed on self-hosted Postgres and SQL Server.

**Decision.** `react/supabase/migrations/*.sql` (timestamped, append-only) is authoritative. The
`Scripts/{Postgres,SQL,Supabase}` bundles reproduce the schema for other hosts and include their own
functions, views, seed data and an Express proxy; `angular/Scripts` is a byte-identical copy.

**Consequences.** A schema change may need three edits (migration + Postgres/SQL scripts) and the
copies must not diverge. Postgres-side functions (`fn_get_next_invoice_number`, `fn_get_next_ncf`,
`fn_record_payment`, …) exist but are unused by the UI.

**Evidence.** `react/supabase/migrations/`, `react/Scripts/Postgres/03_functions.sql`,
`react/Scripts/Supabase/`.

---

## D-010 — REST API and transactional email are Supabase Edge Functions

**Status:** Superseded by D-011

**Context.** External integrations need a documented API; the app needs to send OTP and reminder mail.

**Decision.** `functions/api` is a Deno router with an inline OpenAPI 3.0.3 spec served at `/spec`
(surfaced by the in-app Swagger page). `functions/send-email` does SMTP delivery with `{{var}}`
interpolation and logs to `email_log`, reading SMTP settings from `settings` per company.

**Consequences.** The spec is duplicated by hand next to the router — add a resource in both places.
The REST semantics deliberately differ from the UI (e.g. `DELETE` deactivates clients/products).

**Evidence.** `react/supabase/functions/api/index.ts`, `react/supabase/functions/send-email/index.ts`,
`react/src/pages/Swagger.tsx`.

---

## D-011 — Supabase removed; self-hosted API over PostgreSQL or SQL Server

**Status:** Active (supersedes D-005 partially, D-007, D-008, D-009, D-010)

**Context.** The product must run without any third-party backend ("we are not using anything from
Bold or Supabase"), on either PostgreSQL or Windows SQL Server, with credentials that never reach the
browser.

**Decision.**

- `server/` — Express + TypeScript API. `DatabaseAdapter` (`src/db/base-adapter.ts`) generates all
  SQL; `postgres.ts` and `sqlserver.ts` provide the dialect. Backend chosen by `DB_PROVIDER`.
- `database/` — one folder per engine (`postgres/`, `sqlserver/`), same 23-table object model,
  including `otp_tokens` and a `UNIQUE` constraint on `users_config.email`.
- Auth is owned by the API: bcrypt password hashes, HS256 JWT (12 h), lockout after 3 attempts,
  OTP tokens in `otp_tokens`, short-lived `changeToken` for password changes. Legacy SHA-256 hashes
  are accepted once and rehashed.
- The frontends keep the same call shape (`db.from(table).select()…`) but the client is now
  `react/src/lib/db.ts` / `angular/src/app/services/db.service.ts`, which POST to `/api/db/:table/*`
  and resolve embedded selects (`*, client:clients(*)`) with follow-up requests.
- Email goes through `/api/mail/send` (SMTP from `server/.env`); without SMTP the endpoint returns a
  preview so flows stay testable.
- `users_config.supabase_uid` is dropped; `auth_provider` and `password_hash` remain.

**Consequences.** Two engines must be maintained in lockstep for every schema change. The API
authenticates but does not enforce per-tenant filtering — the clients still filter `company_id`
(unchanged risk, tracked as K-001 successor). SQL Server returns upper-case UUIDs, so the adapter
lower-cases them to match Postgres.

**Evidence.** `server/src/db/*`, `server/src/routes/auth.ts`, `database/README.md`,
`react/src/lib/db.ts`, `angular/src/app/services/db.service.ts`.

---

## Open questions (do not guess — verify or ask)

| # | Question | Why it matters |
|---|---|---|
| Q-1 | Is `angular/` meant to replace `react/`, or stay a reference port? | Determines whether parity work is required or optional |
| Q-2 | Who generates recurring invoices (`invoice_type = 'recurring'`)? No scheduler exists in this repo | Feature may be silently non-functional |
| Q-3 | Which e-CF provider is live in production (`third_party` vs `own_service`)? | `Invoices.submitInvoice` branches on `ecf_provider_config.mode` |
| Q-4 | Should per-company enforcement move into the API (JWT claim → `company_id` guard)? | Today tenancy is a client-side convention only |
