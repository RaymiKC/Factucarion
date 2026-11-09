# PROJECT_STRUCTURE — annotated map

> Companion to [CONTEXT.md](./CONTEXT.md). Every path below exists as of 2026-11-09 (Supabase removed).
> Sizes are approximate and are included only to flag hotspots (large files are risky to edit blind).

---

## 1. Top level

```
FacturPro/
├─ .git/
├─ angular/                     # Angular 20 replica app (partial parity with react/)
├─ react/                       # PRIMARY app: Vite + React 18 + TypeScript + Tailwind
├─ server/                      # Express + TypeScript API (PostgreSQL / SQL Server)
├─ database/                    # SQL for both engines: postgres/ and sqlserver/
└─ ai_support/                  # this documentation
```

There is **no** root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows`, or
shared library. Install and run inside `react/`, `angular/` or `server/`.

`server/` layout:

```
server/
├─ .env.example                 # committed template (DB_PROVIDER, connection strings, JWT, SMTP)
├─ package.json                 # scripts: dev | build | start | typecheck | smoke
├─ src/
│  ├─ index.ts                  # bootstrap + graceful shutdown
│  ├─ app.ts                    # express wiring, CORS, /files static, error handler
│  ├─ config.ts                 # env parsing → provider + connection settings
│  ├─ db/{types,base-adapter,postgres,sqlserver,index}.ts
│  ├─ http/{errors,auth-middleware,query-params}.ts
│  ├─ routes/{auth,db,storage,mail,health,openapi,row-hooks}.ts
│  ├─ security/{jwt,password}.ts
│  └─ services/mailer.ts
└─ scripts/smoke.ts             # health + login + CRUD end-to-end check
```

---

## 2. `react/` — primary application

```
react/
├─ .env                         # VITE_API_BASE only (git-ignored, local only)
├─ .env.example                 # committed template
├─ .gitignore
├─ eslint.config.js             # flat config: js + typescript-eslint + react-hooks + react-refresh
├─ index.html                   # Vite entry, mounts #root
├─ package.json                 # scripts: dev | build | lint | preview | typecheck  (no test)
├─ postcss.config.js
├─ tailwind.config.js           # darkMode: 'class', scans ./src/**/*.{js,ts,jsx,tsx}
├─ tsconfig.json                # project refs
├─ tsconfig.app.json            # strict, noUnusedLocals, noUnusedParameters, jsx: react-jsx
├─ tsconfig.node.json
├─ vite.config.ts               # react plugin, optimizeDeps.exclude: ['lucide-react']
│
├─ src/
│  ├─ main.tsx                  # createRoot + StrictMode
│  ├─ App.tsx                   # provider graph + page state machine + route guards   (~4.8 KB)
│  ├─ index.css                 # Tailwind directives + base styles
│  ├─ vite-env.d.ts
│  │
│  ├─ components/               # shared, presentational
│  │  ├─ Layout.tsx             # sidebar, company switcher, theme + language menus      (~15.5 KB)
│  │  ├─ InvoiceTemplate.tsx    # printable invoice, driven by settings.invoice_theme    (~16 KB)
│  │  ├─ Modal.tsx              # generic dialog wrapper
│  │  └─ StatusBadge.tsx        # invoice status pill
│  │
│  ├─ lib/                      # cross-cutting providers + data access
│  │  ├─ auth.tsx               # AuthProvider, login/OTP/reset UI flow                   (~8 KB)
│  │  ├─ auth-api.ts            # typed calls to /api/auth                                 (~6 KB)
│  │  ├─ permissions.tsx        # PAGE_REGISTRY, role/user permission resolution          (~15 KB)
│  │  ├─ company.tsx            # CompanyProvider: accessible companies + selection
│  │  ├─ hooks.ts               # one data hook per table, companyId-scoped               (~13.8 KB)
│  │  ├─ i18n.tsx               # es/en/fr translations + REGIONS business config         (~53 KB)
│  │  ├─ db.ts                  # owned DB client (query builder + storage) over the API
│  │  ├─ types.ts               # every row type (Client, Invoice, …)
│  │  ├─ theme.tsx              # light/dark provider + preference persistence
│  │  └─ utils.ts               # currency/date formatters, status maps, invoice numbering
│  │
│  └─ pages/                    # one component per screen
│     ├─ Login.tsx              # credentials → OTP → set password → reset              (~25.5 KB)
│     ├─ Dashboard.tsx          # KPIs + recent invoices                                (~9.6 KB)
│     ├─ Clients.tsx            # client CRUD                                           (~21.7 KB)
│     ├─ Invoices.tsx           # invoice CRUD, NCF, payments, e-CF, recurring          (~86 KB) ⚠
│     ├─ Products.tsx           # product/service catalog                               (~13.8 KB)
│     ├─ Payments.tsx           # read-only payment listing (recording is in Invoices)  (~8.1 KB)
│     ├─ Electronic.tsx         # e-CF provider config (real submit only in own_service)  (~19.7 KB)
│     ├─ EmailSchedules.tsx     # reminder templates + email log                        (~19.7 KB)
│     ├─ Notifications.tsx      # in-app notifications                                  (~3.7 KB)
│     ├─ Analytics.tsx          # revenue/expense charts, expenses, company summary     (~40 KB)
│     ├─ MonthlyReport.tsx      # month report + CSV export                             (~20.3 KB)
│     ├─ Admin.tsx              # all admin tabs                                        (~108 KB) ⚠
│     └─ Swagger.tsx            # Swagger UI from CDN against /openapi.json               (~3.5 KB)

(no `supabase/` folder: the schema lives in `database/` and the API in `server/`)
```

### Where do I change…?

| Goal | Start here |
|---|---|
| Add/rename a screen | `react/src/pages/` + `App.tsx` (`Page` union, conditional render) + `Layout.tsx` (nav item) + `permissions.tsx` (`ALL_PAGES`/`PAGE_REGISTRY`) |
| Change what a role can do | `react/src/lib/permissions.tsx` (resolution) and the `role_permissions` / `user_permissions` tables (Admin → Permissions tab) |
| Add a data query | `react/src/lib/hooks.ts` (new `useX(companyId?)`) — follow the existing shape |
| Add a DB field | both `database/postgres/` and `database/sqlserver/`, then the row type in `react/src/lib/types.ts` **and** `angular/src/app/services/models.ts` |
| Change tax rate / currency / invoice types | `react/src/lib/i18n.tsx` → `REGIONS` |
| Change UI text | `react/src/lib/i18n.tsx` → `TRANSLATIONS`, then use `t('key')` |
| Change invoice numbering / NCF | `react/src/pages/Invoices.tsx` (`assignNcf`, `handleCreate`, `saveSeq`) + `ncf_sequences` |
| Change printable invoice layout | `react/src/components/InvoiceTemplate.tsx` + `settings.invoice_theme` |
| Add a REST endpoint | `server/src/routes/` (+ `openapi.ts` for the spec) |
| Change outbound email | `server/src/routes/mail.ts` + `server/src/services/mailer.ts`; SMTP values come from `server/.env` |
| Change auth/OTP policy | `server/src/routes/auth.ts` (lockout, attempts, OTP expiry live in `server/src/config.ts`) |

---

## 3. `angular/` — replica application

```
angular/
├─ angular.json                 # builder config, dev server :4200
├─ package.json                 # scripts: ng | start | build | watch | test  (no lint)
├─ tsconfig.json                # strict + noImplicitOverride + strictTemplates
├─ tsconfig.app.json / tsconfig.spec.json
├─ tailwind.config.js / postcss.config.js
├─ .vscode/                     # extensions.json, launch.json, tasks.json
├─ public/favicon.ico
│
├─ src/
│  ├─ index.html, main.ts, styles.css
│  ├─ environments/environment.ts   # apiBase only (no credentials)
│  └─ app/
│     ├─ app.ts                     # root component (shell)
│     ├─ app.config.ts              # provideRouter(routes, withComponentInputBinding())
│     ├─ app.routes.ts              # lazy loadComponent per page + authGuard
│     ├─ guards/auth.guard.ts
│     ├─ components/
│     │  ├─ layout.component.ts     # sidebar/shell                                  (~12.1 KB)
│     │  ├─ modal.component.ts
│     │  ├─ status-badge.component.ts
│     │  └─ invoice-template.component.ts   # printable invoice overlay (~17 KB)
│     ├─ pages/
│     │  ├─ admin/admin.component.ts        (~29 KB, subset of React Admin)
│     │  ├─ invoices/invoices.component.ts  (~21 KB)
│     │  ├─ clients/clients.component.ts
│     │  ├─ products/products.component.ts
│     │  ├─ dashboard/dashboard.component.ts
│     │  ├─ payments/payments.component.ts
│     │  ├─ electronic/electronic.component.ts
│     │  ├─ email-schedules/email-schedules.component.ts
│     │  ├─ notifications/notifications.component.ts
│     │  ├─ analytics/analytics.component.ts
│     │  ├─ monthly-report/monthly-report.component.ts
│     │  ├─ swagger/swagger.component.ts
│     │  └─ login/login.component.ts
│     └─ services/
│        ├─ auth.service.ts          # mirrors lib/auth.tsx + auth-api.ts
│        ├─ i18n.service.ts          # mirrors lib/i18n.tsx (es/en/fr)     (~20.5 KB)
│        ├─ permissions.service.ts   # PAGE_LIST has 12 entries, not 10
│        ├─ data.service.ts          # signal-based collection loader       (~8 KB)
│        ├─ db.service.ts            # owned DB client (query builder + storage)
│        ├─ models.ts                # every row type (mirrors lib/types.ts)
│        ├─ company.service.ts
│        └─ theme.service.ts
```

Angular route paths: `login, dashboard, invoices, clients, products, payments, electronic,
email_schedules, notifications, analytics, monthly_report, swagger, admin`, `'' → dashboard`,
`'**' → login`.

---

## 4. Hotspots — read before editing

| File | Why it is risky |
|---|---|
| `react/src/pages/Admin.tsx` (108 KB) | 11 tabs in one component; local state per tab; easy to break unrelated tabs |
| `react/src/pages/Invoices.tsx` (86 KB) | invoice form + NCF + payments + e-CF + recurring in one file; NCF side effects are order-dependent |
| `react/src/lib/i18n.tsx` (53 KB) | three complete translation objects; a missing key silently falls back to the key string |
| `server/src/db/base-adapter.ts` | generates all SQL for both engines — every new filter/pagination feature goes here |
| `react/src/lib/auth.tsx` + `server/src/routes/auth.ts` | login/OTP/reset state machine with lockout side effects (deactivating accounts after OTP failures) |
| `database/*/05_upgrade_existing.sql` | must stay idempotent — it runs against databases that already hold data |

---

## 5. Files that do not exist (do not invent them)

- No `react/src/router.tsx`, no `react-router` dependency.
- No shared `types/` folder in React — types live in `react/src/lib/types.ts`.
- No `tests/`, no `*.test.ts(x)`, no Jest/Vitest config (`server/scripts/smoke.ts` is the closest
  thing to an integration test).
- No root-level scripts, Makefile, Dockerfile, or deployment config.
- No `supabase/` folder, no edge functions, no migrations folder — the schema is in `database/`.
- No scheduler/cron worker for recurring invoices or scheduled emails inside this repo.
