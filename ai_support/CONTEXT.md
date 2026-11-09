# CONTEXT — FacturPro (verified snapshot)

> **Purpose.** This is the authoritative "big picture" file for AI assistants and new developers.
> It exists so you do **not** infer architecture from a single page or file. Every claim below was
> read from the code, not guessed. If something here disagrees with the code, **the code wins** —
> then fix this file.
>
> **Snapshot:** branch `main`, commit `e73f629` ("angular replica project added"), verified 2026-11-08.
> Re-verify with the commands in [Verifying this document](#verifying-this-document) before trusting it.

---

## 1. What this product is

FacturPro is a multi-company **invoicing / billing system** in Spanish-first UI (es/en/fr), built for
the Dominican Republic (DGII NCF e-CF invoicing) with region switches for the US and Canada.

Core domain: companies → users → clients → products/services → invoices (+ line items) → payments,
plus e-invoicing (e-CF), scheduled emails, notifications, analytics, expenses, and an admin console.

---

## 2. Repo shape — two independent front-ends, one backend project

```
FacturPro/
├─ react/      ← PRIMARY application (Vite + React 18 + TS + Tailwind), most complete
├─ angular/    ← PORT of the same app to Angular 20 (standalone components), PARTIAL parity
└─ (no root package.json, no workspace tooling, no CI workflows, no tests in react/)
```

They are **not** packages of a monorepo and share **no code**. Both are clients of the **same
self-hosted API** (`server/`) and therefore the same tables. A schema change therefore affects both
apps.

`angular/` is explicitly a replica (commit message "angular replica project added"). When you change
`react/`, ask whether the change must be mirrored in `angular/` — see
[parity rules](#8-angular-parity--what-to-mirror).

---

## 3. Runtime topology

```
┌──────────────────────┐        ┌──────────────────────────┐
│ react/ (Vite, :5173) │        │ angular/ (ng serve,:4200)│
│  no router; page     │        │  @angular/router + guard │
│  state in App.tsx    │        │  signals in DataService  │
└──────────┬───────────┘        └────────────┬─────────────┘
           │  fetch + JWT                     │
           ▼                                  ▼
   ┌────────────────────────────────────────────────────┐
   │ server/  — Express + TypeScript API (:3001)         │
   │  • /api/auth   login, OTP, password, preferences    │
   │  • /api/db     structured + PostgREST-style CRUD    │
   │  • /api/storage, /api/mail, /openapi.json, /health  │
   └───────────────┬────────────────────┬───────────────┘
                   │ pg                 │ mssql
                   ▼                    ▼
        ┌───────────────────┐  ┌────────────────────────┐
        │ PostgreSQL        │  │ Microsoft SQL Server   │
        │ database/postgres │  │ database/sqlserver     │
        └───────────────────┘  └────────────────────────┘
```

Key consequence: **the UI never talks to the database directly**. It calls the API with a JWT issued
by `/api/auth/login`; the API picks the backend from `DB_PROVIDER` and generates parameterised SQL.

---

## 4. React application

### 4.1 Boot sequence

`react/index.html` → `react/src/main.tsx` → `react/src/App.tsx`

Provider nesting in `App()` (order matters — inner providers consume outer ones):

```tsx
ThemeProvider → I18nProvider → AuthProvider → CompanyProvider → PermissionsProvider → AppInner
```

`CompanyBridge` and `PermissionsBridge` exist only to feed `user.role`, `user.id` and
`user.assignedCompanyIds` into those providers, because they are nested *below* `AuthProvider`.

### 4.2 Navigation model — there is **no router**

- `App.tsx` holds `const [currentPage, setCurrentPage] = useState<Page>('dashboard')`.
- `Page` is a local union: `dashboard | clients | invoices | products | notifications | email |
  electronic | admin | payments | analytics | swagger | report`.
- `Layout` renders the sidebar and calls `onNavigate(page)`.
- Each page is mounted by a conditional expression, guarded by `isAdmin || canView(page)`.
- **Consequence:** deep links, browser back/forward, and page refresh reset to `dashboard`.
  Do not add `react-router` piecemeal — it would require changing every `onNavigate`.

### 4.3 Auth — JWT issued by the API

`react/src/lib/auth.tsx` is a thin context over `react/src/lib/auth-api.ts`; the real credential
checks live in `server/src/routes/auth.ts`.

Login order inside `POST /api/auth/login`:

1. **Hard-coded demo shortcut (client side):** email `demo` or `demo@demo.com` with password `demo`
   → admin user with `id: 'demo'` (no DB row, no API call).
2. Load `users_config` row by lowercased/trimmed email.
3. Reject if `locked_until` is in the future (24 h lock after 3 failed attempts), or `!is_active`.
4. Password check, in this order:
   - bcrypt compare against `users_config.temp_password` (temporary password),
   - bcrypt compare against `users_config.password_hash`,
   - legacy 64-char SHA-256 hex hashes are accepted once and rehashed to bcrypt.
5. `must_change_password` or temp login → returns `{ status: 'password_change_required', changeToken }`.
6. OTP required when global flag `feature_flags.otp_required_for_all` **or** `users_config.otp_enabled`
   → creates a 6-digit `otp_tokens` row (10 min expiry, 3 attempts), emails it, returns
   `{ status: 'otp_required', otpId }` (`devToken` when `OTP_DEBUG=true`).
7. Success → JWT (`HS256`, 12 h) + `buildAuthUser()` (adds `assignedCompanyIds` from `company_users`
   for non-admins). The client stores the token in `localStorage['facturapro_token']`.

Session continuity: on mount, `authApi.me()` calls `GET /api/auth/me` with the stored token and
restores the profile; there are no Supabase auth listeners any more. The `AuthUser` shape is:

```ts
{ id, name, email, role, assignedCompanyIds, preferredTheme, preferredLanguage,
  preferredRegion, mustChangePassword?, otpEnabled? }
```

`isAdmin === user.role === 'admin'`. `canAccessCompany(id)` is true for admins, otherwise checks
`assignedCompanyIds`.

Passwords are **never** checked by a server function; verification is client-side. See
`memory/known-issues.md`.

### 4.4 Multi-tenancy (company scoping)

`react/src/lib/company.tsx`:

- Loads **all** active `companies` (ordered by name) into `allCompanies`.
- `companies` = all of them for `role === 'admin'`, otherwise filtered by `assignedCompanyIds`
  (which come from `company_users.company_id`).
- The selected company is cached in `localStorage['facturapro_company']`; falls back to the first
  accessible company.
- `App.tsx` passes `currentCompany?.id` down as a `companyId` **prop** to every page.
  Pages/hooks therefore take an optional `companyId?: string` and add `.eq('company_id', companyId)`
  when present. `Analytics` and `MonthlyReport` deliberately receive `undefined` for admins so they
  can aggregate across all companies.
- `company_id` was added to these 11 tables by the multi-company upgrade
  (`database/postgres/05_upgrade_existing.sql`, `database/sqlserver/05_upgrade_existing.sql`):
  `clients, invoices, products_services, tax_rates, ncf_sequences, expenses, email_schedules,
  feature_flags, settings, users_config, ecf_provider_config`.
  Child tables (`invoice_items`, `payment_records`, `notifications`, `email_log`) have **no**
  `company_id`; their tenancy is inherited through `invoice_id` / `client_id`, so a query on them is
  only tenant-safe when joined to a scoped parent.

**Rule:** any new query against a tenant table must filter `company_id`. Any insert must set it. For
child tables, filter by the parent's ids that you already scoped — **never** add
`.eq('company_id', ...)` to a child-table query (three existing call sites get this wrong and silently
return nothing: see `memory/known-issues.md` K-016).

### 4.5 Permissions

`react/src/lib/permissions.tsx`:

- `ALL_PAGES` (10): `dashboard, invoices, clients, products, payments, electronic, email,
  notifications, analytics, admin`.
- `PAGE_REGISTRY` adds Spanish labels and the actions offered per page
  (`can_create | can_edit | can_delete`).
- Resolution for the current user, per page:
  **admin → FULL** ▸ else **`user_permissions` row for this user** ▸ else **`role_permissions` row
  for this role** ▸ else **NONE**.
- Exposes `canView/canCreate/canEdit/canDelete`, `visiblePages`, plus admin-side mutation helpers
  for both tables and custom-role management (`custom_roles`).

**Trap:** `report` (Monthly Report) and `swagger` are **not** in `ALL_PAGES`. In `App.tsx` they are
gated as `isAdmin || canView('analytics')` and `isAdmin` respectively. Do not assume a permission row
exists for them.

### 4.6 Theme, i18n and regions

- `theme.tsx`: `dark` class on `<html>`, persisted in `localStorage['facturapro_theme']`.
- `i18n.tsx` (~53 KB): `Language = 'es' | 'en' | 'fr'`, `Region = 'DO' | 'US' | 'CA'`.
  `TRANSLATIONS` is one large `Record<Language, Translations>` object; `t(key)` looks up a flat key.
- `REGIONS` (in `i18n.tsx`) drives **business behavior**, not just labels:

  | | DO | US | CA |
  |---|---|---|---|
  | currency / locale | DOP / es-DO | USD / en-US | CAD / en-CA |
  | tax label / default rate | ITBIS 18 % | Sales Tax 0 % | GST/HST 5 % |
  | invoice number label | NCF | Invoice # | Invoice # |
  | `hasNcfSequences` | **true** | false | false |
  | invoice types | B01, B02, B14, B15 | standard, proforma, credit | standard, proforma, credit |

- `App.tsx` syncs `user.preferredTheme / preferredLanguage / preferredRegion` into the theme and
  i18n providers on login; `updatePreferences()` writes them back to `users_config`.

### 4.7 Data access layer

- `react/src/lib/hooks.ts` — one hook per collection, all following the same shape:
  `useX(companyId?)` → `{ data, loading, refetch }`, implemented with `db.from(...)` calls inside a
  `useCallback` + `useEffect`.
  Hooks: `useClients, useInvoices, useProducts, useTaxRates, useNotifications, useSettings,
  useFeatureFlags, useUsersConfig, useEmailSchedules, useEmailLog, usePaymentRecords,
  useEcfProviderConfig, useDashboardMetrics, useNcfSequences, useNcfVoidLog,
  useActiveNcfSequence, useCompanyUsers`.
- `react/src/lib/types.ts` — **all** row types (`Client`, `Invoice`, `InvoiceItem`,
  `ProductService`, `NcfSequence`, `EcfProviderConfig`, …). This is the type source of truth for the
  front-end; mirror changes in `angular/src/app/services/models.ts`.
- `react/src/lib/db.ts` — the owned client. `db.from(table)` returns a query builder
  (`select/insert/update/upsert/delete`, `eq/neq/in/is/gte/lte/like/ilike`, `order/limit/range`,
  `single/maybeSingle`) that POSTs to `/api/db/:table/*` and returns `{ data, error }`. Embedded
  selects such as `*, client:clients(*)` are resolved by the client with follow-up requests.
  `db.storage.from(bucket)` handles logo uploads.
- Pages frequently call `db` directly for one-off mutations (creating invoices, assigning NCF,
  recording payments). That is the established pattern, not an oversight.

### 4.8 Page responsibilities (React)

| Page | File | Responsibility |
|---|---|---|
| Login | `pages/Login.tsx` | credentials → OTP → set-password → reset flow |
| Dashboard | `pages/Dashboard.tsx` | KPI cards + recent activity (`useDashboardMetrics`) |
| Clients | `pages/Clients.tsx` | client CRUD, email list/body templates |
| Invoices | `pages/Invoices.tsx` | invoice CRUD, line items, NCF assignment/void, recurring config, payments, e-CF submit |
| Products | `pages/Products.tsx` | product/service catalog + tax rate per line |
| Payments | `pages/Payments.tsx` | read-only payment listing + totals by method (recording happens in Invoices; see K-016) |
| Electronic | `pages/Electronic.tsx` | e-CF provider config (`third_party` vs `own_service`), test-connection/auto-submit toggles |
| EmailSchedules | `pages/EmailSchedules.tsx` | scheduled reminder templates + email log |
| Notifications | `pages/Notifications.tsx` | in-app notification list, mark read |
| Analytics | `pages/Analytics.tsx` | revenue vs expenses charts, expense CRUD, per-company summary (admin) |
| MonthlyReport | `pages/MonthlyReport.tsx` | month-scoped invoice report + CSV export (admin / analytics permission) |
| Admin | `pages/Admin.tsx` | companies, company settings, invoice theme, taxes, SMTP, banking/DGII, feature flags, users, permissions, region, database scripts |
| Swagger | `pages/Swagger.tsx` | loads Swagger UI from CDN against the `api` function `/spec` |

Shared components: `Layout` (sidebar, company switcher, theme/language toggles, user menu),
`Modal`, `StatusBadge`, `InvoiceTemplate` (printable invoice, theme-aware).

---

## 5. Data model

The schema lives in `database/postgres/` and `database/sqlserver/` — two folders with the same object
model (23 tables). `01_create_schema.sql` is the full definition for a fresh install, and
`05_upgrade_existing.sql` holds idempotent upgrades for databases that already have data.

**Billing core** (`20260511185443_create_billing_system_schema.sql`):
`tax_rates, clients, products_services, invoices, invoice_items, payment_records, notifications,
email_schedules, email_log, settings, users_config, feature_flags`

**Later additions:**
`ecf_provider_config` (e-CF credentials/mode), `expenses`, `ncf_sequences`, `ncf_void_log`
(+ recurring invoice columns), `companies`, `company_users`, `role_permissions`, `custom_roles`,
`audit_log`, `user_permissions`, `otp_tokens`.

### Conventions that matter

| Concern | Convention |
|---|---|
| Tenant key | `company_id NOT NULL` on the 11 tenant tables (see §4.4); child tables inherit via `invoice_id` / `client_id` |
| Settings | `settings` is key/value per company, `UNIQUE (company_id, key)`; read with `useSettings().getSetting('key')` |
| Money/numeric | `numeric(12,2)` in DB, plain `number` in TS |
| Dates | `date` for business dates (`issue_date`, `due_date`), `timestamptz` for audit fields |
| Timestamps | updated manually with `updated_at: new Date().toISOString()` in app code |
| Status enums | DB `CHECK` constraints + TS string unions — keep them in sync |
| ID type | `uuid DEFAULT gen_random_uuid()` |
| Seed company | migration default `'00000000-0000-0000-0000-000000000010'` |

### Settings keys in active use (grep before assuming)

`invoice_prefix`, `next_invoice_number`, `company_name`, `company_rnc`, `company_phone`,
`company_email`, `invoice_theme`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from`,
`smtp_name`, `bank_name`, `bank_bank_name`, `bank_account`, `bank_iban`, `bank_contact`,
`bank_contact_tel`, `bank_contact_email`, `dgii_auth_number`.
(`send-email` reads `smtp_password`, but the Admin UI has no field for it — see
`memory/known-issues.md` K-014.)

### Security posture (important)

There is no row-level security in the database. The API requires a valid JWT for every data endpoint,
but it does **not** enforce per-company tenancy — the clients filter `company_id` and the UI hides
pages via `useAuth` / `usePermissions`. Treat this as a known architectural risk, not as a bug to
silently "fix" in passing — see `memory/known-issues.md`. Passwords are bcrypt hashed in the API
(`server/src/routes/row-hooks.ts`); legacy SHA-256 hashes are upgraded on the next successful login.

---

## 6. API surface (`server/`)

Express + TypeScript, one adapter per database engine (`server/src/db/base-adapter.ts` builds the
SQL, `postgres.ts` / `sqlserver.ts` supply the dialect).

### 6.1 `/api/db` — data access

- Structured form used by both frontends: `POST /api/db/:table/{select|insert|update|delete|upsert}`.
- PostgREST-style form for integrations and Swagger:
  `GET /api/db/:table?company_id=eq.<uuid>&order=name.asc&limit=50`, plus `/:table/:id` for
  GET/PUT/PATCH/DELETE.
- `GET /api/tables` returns live table/column metadata; `GET /openapi.json` serves the spec rendered
  by the Swagger pages.
- Every table and column name is validated against the live schema; values are bound parameters.

### 6.2 `/api/auth` — authentication

- `POST /login` verifies the bcrypt hash (or the temporary password), applies lockout after 3 failed
  attempts (24 h), and returns `status: authenticated | otp_required | password_change_required`.
- OTP flow: `/otp/request` → `/otp/verify` (purpose `login` or `reset`). Codes live in `otp_tokens`
  and expire after 10 minutes.
- `/password` finishes a change using a short-lived `changeToken`; this is the only way to set a new
  password without being logged in.

### 6.3 `/api/mail` — email

Replaces the old `send-email` edge function: `POST /api/mail/send` interpolates `{{var}}` placeholders
and sends through SMTP when `SMTP_HOST` is configured. Without SMTP the call still succeeds and
returns `sent: false` with a preview, so the UI flow can be tested locally.

---

## 7. Database scripts (`database/`)

| Folder | Purpose |
|---|---|
| `database/postgres/` | `01_create_schema.sql`, `02_seed_data.sql`, `03_functions.sql`, `04_views.sql`, `05_upgrade_existing.sql` |
| `database/sqlserver/` | same for SQL Server (`03_stored_procedures.sql`) |

See `database/README.md` for the exact commands and connection strings. Postgres helper functions
(`fn_get_next_invoice_number`, `fn_record_payment`, `fn_mark_overdue_invoices`,
`fn_get_dashboard_metrics`, `fn_get_monthly_revenue`, `fn_get_next_ncf`) exist server-side — but the
**UI does not call them**; it reimplements the logic in TypeScript.

---

## 8. Angular parity — what to mirror

`angular/` is Angular 20 with standalone components, `provideRouter`, `authGuard`, and services
injected via `providedIn: 'root'`.

```
src/
├─ environments/environment.ts   # apiBase only (no credentials)
└─ app/
   ├─ app.ts, app.config.ts, app.routes.ts
   ├─ components/{layout, modal, status-badge, invoice-template}.component.ts
   ├─ guards/auth.guard.ts
   ├─ pages/<feature>/<feature>.component.ts   (mirrors react pages/)
   └─ services/{auth, company, data, db, i18n, permissions, theme}.service.ts + models.ts
```

Mapping to React: `lib/auth.tsx → AuthService`, `lib/company.tsx → CompanyService`,
`lib/hooks.ts → DataService` (signal-based, `loadAll(companyId)`), `lib/permissions.tsx →
PermissionsService`, `lib/i18n.tsx → I18nService`, `lib/theme.tsx → ThemeService`,
`lib/db.ts → DbService` (the query builder lives here), `lib/types.ts → models.ts`.

Differences you must not paper over:

| Area | React | Angular |
|---|---|---|
| Navigation | state machine in `App.tsx` | `@angular/router` with URL paths (`/email_schedules`, `/monthly_report`) |
| Page permission list | 10 pages (`ALL_PAGES`) | 12 pages (`PAGE_LIST`, includes `email_schedules`, `monthly_report`, `swagger`) |
| Data loading | per-collection hooks | one `DataService` with signals |
| Config | `import.meta.env` / `react/.env` (git-ignored) | `environments/environment.ts` (tracked, `apiBase` only) |
| Completeness | full | partial (see below) |

Known parity gaps at this commit: `components/invoice-template.component.ts` is **0 bytes** (no
invoice template), and `Admin` is ~29 KB vs ~108 KB in React, so several admin tabs are missing or
simplified. Verify before claiming a feature works in Angular.

---

## 9. Commands

Run from inside the app folder.

```powershell
# React (primary)
cd react
npm install
npm run dev        # Vite dev server
npm run build
npm run lint       # eslint flat config
npm run typecheck  # tsc --noEmit -p tsconfig.app.json
# NOTE: there is no test script in react/

# Angular (replica)
cd angular
npm install
npm start          # ng serve → http://localhost:4200
npm run build
npm test           # Karma + Chrome launcher
```

TypeScript is `strict` in both apps; React also enables `noUnusedLocals` / `noUnusedParameters`
(unused imports fail `npm run typecheck`). Tailwind is configured with `darkMode: 'class'` and
`content` scanning `./src/**/*.{js,ts,jsx,tsx}` in React.

---

## 10. Non-obvious behaviors worth remembering

1. **Demo login** (`demo` / `demo`) bypasses the database entirely and injects an admin user.
2. **NCF assignment** happens client-side in `Invoices.tsx`: pick the active `ncf_sequences` row for
   the `ncf_type`, use `current_seq`, then increment it (and the invoice counter in `settings`;
   the counter update is currently **not** company-scoped — see `memory/known-issues.md` K-004).
   Cancelling an invoice writes an `ncf_void_log` row and decides `reuse_allowed` by month.
3. **Region switch changes the meaning of `ncf_type`** (B01/B02/B14/B15 vs standard/proforma/credit).
   Never hard-code `B01`.
4. **Recurring invoices** are modeled with `invoice_type`, `recurrence_rule`, `recurrence_end`,
   `parent_invoice_id` on `invoices`; there is no scheduler job in this repo that generates them.
5. **E-invoicing** never talks to DGII directly. `Invoices.submitInvoice()` makes a real HTTP `POST`
   to `${own_service_url}/ecf/submit` **only** when `ecf_provider_config.mode === 'own_service'` and a
   URL is set. In every other case (including `third_party`) it waits 1.5 s and returns a **random**
   approval with a generated `eCF-…` id — the third-party provider and its API key are stored but never
   called. See `memory/known-issues.md` K-015.
6. **`users_config` is both the auth table and the user profile table** (name, role, preferences,
   lockout counters, bcrypt hashes). The API authenticates against it directly — there is no external
   identity provider.
7. **`audit_log`** exists in the schema but the React app never writes to it
   (zero references under `react/src`) — do not assume an audit trail exists. See K-005.
8. **`Layout` filters nav items twice**: admins see everything, others see `canView(id)` for the
   registry pages (so `report`/`swagger` stay admin-only regardless of permissions).

---

## 11. Verifying this document

Prefer these checks over memory:

```powershell
# React provider graph and page guards
Select-String -Path .\react\src\App.tsx -Pattern "Provider|currentPage ==="

# Page registry and permission resolution
Select-String -Path .\react\src\lib\permissions.tsx -Pattern "ALL_PAGES|userPermissions\[page\]|role_permissions|user_permissions"

# Which tables exist (both engines)
Select-String -Path .\database\postgres\01_create_schema.sql -Pattern "CREATE TABLE"

# API surface
Select-String -Path .\server\src\routes\*.ts -Pattern "router\.(get|post|put|patch|delete)"

# Every company_id filter currently applied in the UI
Select-String -Path .\react\src\lib\hooks.ts, .\react\src\pages\*.tsx -Pattern "company_id"

# Which backend is running right now
Invoke-RestMethod http://localhost:3001/health | ConvertTo-Json -Depth 4

# Is audit_log written anywhere?
Get-ChildItem -Recurse -File .\react\src | Select-String -Pattern "audit_log"
```

## 12. Maintenance contract

| When this changes | Update |
|---|---|
| New page / nav item | §4.2, §4.8, `PROJECT_STRUCTURE.md` |
| New table / column | §5, `PROJECT_STRUCTURE.md`, `react/src/lib/types.ts`, `angular/src/app/services/models.ts`, both `database/` folders |
| Auth, permission, or tenancy logic | §4.3–4.5 and §6.2 |
| New API route | §6, `server/README.md` |
| Angular feature reaches parity (or breaks) | §8 |
| A workaround or risk is discovered | `memory/known-issues.md` |
| An architectural choice is made | `memory/decisions.md` (new ADR entry) |
