# FacturPro

Multi-company **invoicing and billing system** with a Spanish-first UI (es / en / fr), built for the
Dominican Republic (DGII NCF / e-CF invoicing) with region switches for the US and Canada.

Core flow: `companies → users → clients → products/services → invoices (+ line items) → payments`,
plus e-invoicing, scheduled reminder emails, in-app notifications, expense tracking, analytics and an
admin console.

---

## Architecture at a glance

```
┌───────────────────┐  ┌───────────────────┐
│ react/  (Vite)    │  │ angular/ (ng)     │   two independent front-ends
│ primary app :5173 │  │ replica app :4200 │   (no shared code, no router in React)
└─────────┬─────────┘  └─────────┬─────────┘
          │  fetch + JWT         │
          └──────────┬───────────┘
                     ▼
        ┌────────────────────────────────┐
        │ server/  Express + TypeScript  │  :3001
        │ /api/auth  /api/db  /api/mail  │
        │ /api/storage  /openapi.json    │
        └───────┬────────────────┬───────┘
                │ pg             │ mssql
                ▼                ▼
     ┌──────────────────┐  ┌──────────────────────┐
     │ PostgreSQL       │  │ Microsoft SQL Server │
     │ database/postgres│  │ database/sqlserver   │
     └──────────────────┘  └──────────────────────┘
```

**The browser never talks to the database.** Both front-ends call the API with a JWT issued by
`POST /api/auth/login`; the API picks the backend from `DB_PROVIDER` and generates parameterised SQL
after validating every table/column name against the live schema.

There is no root `package.json`, no workspace tooling and no CI. Install and run inside each folder.

---

## Folder map

| Folder | What it is |
|---|---|
| [`react/`](./react) | **Primary application** — Vite + React 18 + TypeScript + Tailwind |
| [`angular/`](./angular) | Angular 20 port of the same app — partial parity (most screens, printable invoice) |
| [`server/`](./server) | Express + TypeScript API; one SQL builder, two database dialects |
| [`database/`](./database) | SQL for both engines (identical 23-table model): `postgres/` and `sqlserver/` |
| [`ai_support/`](./ai_support) | Deep-dive documentation for AI assistants and new developers |

Start with [`ai_support/CONTEXT.md`](./ai_support/CONTEXT.md) for the authoritative big picture and
[`ai_support/PROJECT_STRUCTURE.md`](./ai_support/PROJECT_STRUCTURE.md) for an annotated file map.

---

## Quick start

Prerequisites: Node.js 20+, and either PostgreSQL or SQL Server.

### 1. Create the database

From the repository root:

```powershell
cd database
.\setup.ps1 -PgPassword '<postgres-password>' -WriteEnv      # PostgreSQL
.\setup.ps1 -Provider sqlserver -TrustedConnection -WriteEnv  # SQL Server
cd ..                                                         # back to the repository root
```

`-WriteEnv` also generates `server/.env` with a random `JWT_SECRET`. Without it, copy
`server/.env.example` to `server/.env` yourself.

If PowerShell blocks the script (`... running scripts is disabled on this system`), run it with
`powershell -ExecutionPolicy Bypass -File .\setup.ps1 <same arguments>`.

Prefer the manual route? Run the SQL files by hand (also from the repository root):

```powershell
# PostgreSQL — fresh install
$env:PGPASSWORD='<password>'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
& $psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE facturpro;"
Get-ChildItem database\postgres\0[1-4]_*.sql | ForEach-Object {
  & $psql -U postgres -h 127.0.0.1 -d facturpro -v ON_ERROR_STOP=1 -f $_.FullName
}
```

SQL Server commands and connection options are in [`database/README.md`](./database/README.md).
Already have data? Add `-Upgrade` to run only the idempotent `05_upgrade_existing.sql`.

### 2. Start the API

From the repository root (first terminal):

```powershell
cd server
npm install
Copy-Item .env.example .env    # skip if setup.ps1 -WriteEnv already created server/.env
npm run dev                    # http://localhost:3001
```

`npm run smoke` runs an end-to-end health + login + CRUD check against the configured database.

### 3. Start a front-end

Leave the API running and open a second terminal at the repository root:

```powershell
cd react                      # or: cd angular
npm install
Copy-Item .env.example .env   # react only; VITE_API_BASE=http://localhost:3001
npm run dev                   # react → http://localhost:5173
```

For Angular use `npm start` instead of `npm run dev` (→ `http://localhost:4200`); it reads the API URL
from `angular/src/environments/environment.ts`.

### 4. Sign in

| | |
|---|---|
| Seeded admin | `admin@miempresa.com` / `Admin123!` — **change it after the first login** |
| Demo shortcut | `demo` / `demo` — client-side only, no database row, injected admin user |

---

## How the app works

### Authentication

`server/src/routes/auth.ts` is the only credential authority (no external identity provider).
`users_config` doubles as the auth and profile table.

1. **Demo shortcut** — `demo` / `demo` bypasses the API entirely and injects an admin user.
2. Email/password check against bcrypt `password_hash` (or a temporary password); legacy SHA-256
   hashes are accepted once and upgraded to bcrypt.
3. 3 failed attempts → 24-hour lock (`locked_until`).
4. **OTP** is required when `feature_flags.otp_required_for_all` or `users_config.otp_enabled` is
   set; a 6-digit code is stored in `otp_tokens` (10-minute expiry, 3 attempts) and emailed. With
   `OTP_DEBUG=true` the code is returned in the response so no SMTP is needed.
5. First login / temporary password → `password_change_required` with a short-lived `changeToken`.
6. Success → HS256 JWT (12 h) stored in `localStorage['facturapro_token']`; `GET /api/auth/me`
   restores the profile on reload.

### Multi-company scoping

A user sees the companies in `company_users`; `role === 'admin'` sees all. The selected company is
cached in `localStorage['facturapro_company']` and passed down as a `companyId` prop.

- 11 tenant tables carry `company_id`: `clients, invoices, products_services, tax_rates,
  ncf_sequences, expenses, email_schedules, feature_flags, settings, users_config,
  ecf_provider_config`.
- Child tables (`invoice_items, payment_records, notifications, email_log`) have **no** `company_id`;
  their tenancy is inherited through `invoice_id` / `client_id`.

### Permissions

Resolution per page, in order: **admin → full** ▸ **`user_permissions` row** ▸
**`role_permissions` row** ▸ **none**. `react/src/lib/permissions.tsx` holds `ALL_PAGES` and
`PAGE_REGISTRY` (Spanish labels plus `can_create | can_edit | can_delete` per page). Admin can
manage both tables and define custom roles.

### Regions change business behaviour

`REGIONS` in `react/src/lib/i18n.tsx` drives currency, tax and invoice numbering, not just labels:

| | DO | US | CA |
|---|---|---|---|
| Currency / locale | DOP / es-DO | USD / en-US | CAD / en-CA |
| Tax | ITBIS 18 % | Sales Tax 0 % | GST/HST 5 % |
| Invoice label | NCF | Invoice # | Invoice # |
| Invoice types | B01, B02, B14, B15 | standard, proforma, credit | standard, proforma, credit |

Never hard-code `B01` — the meaning of `ncf_type` depends on the selected region.

### Screens (React)

| Page | Responsibility |
|---|---|
| Dashboard | KPIs and recent invoices |
| Invoices | Invoice CRUD, line items, NCF assignment/void, recurring config, payments, e-CF submit |
| Clients | Client CRUD and email templates |
| Products | Product/service catalog with tax rate per line |
| Payments | Read-only payment listing and totals by method |
| Electronic | e-CF provider configuration (`third_party` vs `own_service`) |
| Email schedules | Reminder templates and email log |
| Notifications | In-app notifications |
| Analytics | Revenue vs expenses charts, expense CRUD, per-company summary |
| Monthly report | Month-scoped report with CSV export |
| Admin | Companies, settings, invoice theme, taxes, SMTP, banking/DGII, users, permissions, DB scripts |
| Swagger | Swagger UI rendered from `/openapi.json` |

The React app has **no router**: `App.tsx` holds a `currentPage` state machine, so deep links and
browser back/forward reset to the dashboard. Angular uses `@angular/router` with real URLs.

### Mobile layout

Both front-ends switch to a phone layout below 768px:

- A bottom tab bar shows Panel / Facturas / Clientes / Productos, and **Más** opens the full drawer.
- Dense tables become cards with the same actions; the invoice line-item editor becomes stacked cards.
- Modals become bottom sheets with a drag handle and safe-area padding.
- Inputs render at 16px so iOS never zooms when a field gets focus.
- The printable invoice preview stacks its header and uses the full width; the print window copies the
  app stylesheet, so the printed page looks like the preview.

Desktop keeps the collapsible sidebar and tables.

### API surface

- `POST /api/db/:table/{select|insert|update|delete|upsert}` — structured form used by both clients.
  Filters are `{ column, op, value }` with `op` in `eq | neq | gt | gte | lt | lte | like | ilike |
  is | in | contains`; writes without a filter are rejected.
- `GET /api/db/:table?company_id=eq.<uuid>&order=name.asc&limit=50` — PostgREST-style surface for
  integrations and Swagger.
- `POST /api/auth/*` — login, OTP, password change, preferences.
- `POST /api/mail/send` — `{{variable}}` interpolation; without SMTP it returns `sent: false` with a
  preview so the flow still works locally.
- `PUT /api/storage/:bucket` and `GET /files/:bucket/:path` — logo uploads.
- `GET /api/tables`, `GET /openapi.json`, `GET /health`.

`/api/db`, `/api/tables`, `/api/storage` and `/api/mail` require `Authorization: Bearer <jwt>`;
`/health`, `/openapi.json` and `/files/**` are public, and `/api/auth` is public except `/me`.

---

## Commands

```powershell
# React (primary)
cd react
npm run dev | build | lint | typecheck      # no test script

# Angular (replica)
cd angular
npm start | build | test                    # ng serve :4200

# API
cd server
npm run dev | build | start | typecheck | smoke
```

---

## Known limitations

These are documented behaviours, not surprises:

- **No row-level security and no server-side tenancy enforcement.** The API authenticates but does
  not scope queries per company; the clients filter `company_id`. Treat this as an architectural
  risk before exposing the API publicly.
- **E-invoicing does not call DGII.** A real HTTP `POST /ecf/submit` happens only when
  `ecf_provider_config.mode === 'own_service'` and a URL is set; `third_party` mode is a simulated
  approval with a random `eCF-…` id.
- **Recurring invoices are modelled, not scheduled** — the columns exist but nothing generates them.
- **`audit_log` is never written** by either front-end.
- **`angular/` is incomplete** — several admin tabs are missing compared with React.
- OTP delivery needs SMTP configured, or `OTP_DEBUG=true` for local development.

See [`ai_support/memory/known-issues.md`](./ai_support/memory/known-issues.md) for the current list
with file references.
