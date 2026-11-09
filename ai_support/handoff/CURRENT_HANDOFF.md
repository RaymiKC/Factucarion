# Handoff — current state

**Date:** 2026-11-09
**Branch / commit:** `main` (uncommitted working tree)
**Status:** ✅ Supabase removed — self-hosted API over PostgreSQL / SQL Server, verified on both

---

## 1. Objective

Remove every Supabase integration and give FacturPro its own backend:

1. A database layer that works with **PostgreSQL or Microsoft SQL Server**.
2. A folder holding the SQL scripts for both engines.
3. Connection strings / environment configuration.
4. An API the React and Angular apps actually use, so the product can be tested end to end.

## 2. What changed

| Area | Change |
|---|---|
| `server/` (new) | Express + TypeScript API: `DatabaseAdapter` with `postgres.ts` / `sqlserver.ts` dialects, generic CRUD (`/api/db`), auth (`/api/auth`), file upload (`/api/storage`), mail (`/api/mail`), health + OpenAPI |
| `database/` (new) | `postgres/` and `sqlserver/` scripts (schema, seed, functions/views, idempotent upgrades) + `README.md`; `otp_tokens` added, `supabase_uid` dropped, `users_config.email` made UNIQUE |
| `react/` | `lib/supabase.ts` deleted; `lib/db.ts` is now the owned client (query builder + storage); `lib/types.ts` holds the row types; `lib/auth-api.ts` + rewritten `lib/auth.tsx`; all pages/hooks migrated; Swagger points at `/openapi.json` |
| `angular/` | `supabase.service.ts` deleted; `db.service.ts` is the owned client; `models.ts` holds the row types; `auth.service.ts` rewritten against the API; `environment.ts` now only has `apiBase`; all services/pages migrated |
| Removed | `react/supabase/` (migrations, edge functions), both `Scripts/` folders, `@supabase/supabase-js` dependencies, `VITE_SUPABASE_*` env vars |
| Docs | `ai_support/*` updated; new `server/README.md` and `database/README.md` |

## 3. Verification performed

| Check | Result |
|---|---|
| `server`: `npx tsc --noEmit` | ✅ clean |
| PostgreSQL 17 (`facturpro`) — schema + seed + functions + views applied | ✅ |
| `npm run smoke` against **PostgreSQL** | ✅ health, login, insert, select, update, delete |
| SQL Server 2022 (`FacturaPro`, Windows auth) — schema + seed + procs + views applied | ✅ |
| `npm run smoke` against **SQL Server** | ✅ same 7 checks |
| `react`: `npm run build` | ✅ built (typecheck still reports the pre-existing `i18n.tsx`/`App.tsx` errors) |
| React UI in a browser against the API | ✅ login as `admin@miempresa.com`, session restore on reload, dashboard KPIs, Clients list + create, Payments list with nested `invoice:invoices(*, client:clients(name))` |
| `angular`: `npx ng build` | ✅ bundle generated |
| Data-shape parity (`date` → `YYYY-MM-DD`, `numeric` → number, UUID lower-case) | ✅ verified on both engines |

**Not verified:** Angular in a browser (build only), real SMTP delivery (no SMTP configured), e-CF,
and `05_upgrade_existing.sql` against an already-populated legacy database.

## 4. Decisions and assumptions

| # | Decision | Why |
|---|---|---|
| 1 | One API, two dialects behind `DatabaseAdapter` | The product must run on either engine without touching the UI |
| 2 | Auth moved into the API (bcrypt + HS256 JWT) | Supabase Auth was the last vendor dependency; `users_config` already held the profile |
| 3 | Legacy SHA-256 hashes are upgraded on first successful login | Avoids forcing every existing user through a reset |
| 4 | Embedded selects (`*, client:clients(*)`) resolve client-side | Keeps the API simple and provider-agnostic |
| 5 | SQL Server UUIDs lower-cased in the adapter | Otherwise ids compare differently from PostgreSQL and break client-side matching |

## 5. Open threads

- [ ] Per-company enforcement in the API (K-001b) — tenancy is still filtered by the clients only.
- [ ] K-014: the Admin email tab still edits `settings.smtp_*`, which nothing reads.
- [ ] K-004: `next_invoice_number` counter update is not company-scoped.
- [ ] K-015: e-CF third-party path is still a random simulation.
- [ ] K-008: `angular/.../invoice-template.component.ts` is still 0 bytes.
- [ ] K-007: recurring invoices still have no generator.
- [ ] Decide Q-1 (`angular/` fate).

## 6. Related knowledge

- `ai_support/memory/decisions.md` — D-011 documents this migration; D-007…D-010 are superseded.
- `ai_support/memory/known-issues.md` — resolved entries listed at the top; K-001b is the current risk.
- `server/README.md` — configuration and endpoint reference.
- `database/README.md` — how to apply the scripts to each engine.

## 7. Environment notes

- Install per folder: `server/`, `react/`, `angular/`. There is no root install.
- `server/.env` (not tracked) drives the backend: `DB_PROVIDER`, `PG_CONNECTION_STRING`, `MSSQL_*`,
  `JWT_SECRET`, optional `SMTP_*`. Start with `npm run dev` inside `server/`.
- React needs `react/.env` with `VITE_API_BASE`; Angular reads `apiBase` from `environment.ts`.
- SQL Server **Windows authentication** requires `npm install msnodesqlv8` in `server/` (already
  installed locally) and `MSSQL_TRUSTED_CONNECTION=true`.
- Default seeded login: `admin@miempresa.com` / `Admin123!` — change it after the first sign-in.
