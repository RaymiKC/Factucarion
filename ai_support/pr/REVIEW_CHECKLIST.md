# Review checklist — FacturPro

Run top to bottom. Stop and request changes at the first ❌ that is not explicitly justified in the PR
description. Each line references the reason it exists.

## 0. Scope

- [ ] Diff is one concern; no drive-by reformatting of `Admin.tsx`, `Invoices.tsx` or `i18n.tsx`.
- [ ] App scope declared: `react/`, `angular/`, `server/`, `database/`, or several. A behavior present
      in both apps changed in one and the omission is explained.

## 1. Secrets

- [ ] No keys, tokens, SMTP passwords or connection strings in the diff.
- [ ] `server/.env` and `react/.env` not committed (only their `.env.example` templates).
- [ ] `angular/src/environments/environment.ts` contains `apiBase` only.

## 2. Authorization

- [ ] New `/api` data route is mounted behind `requireAuth` in `server/src/app.ts`.
- [ ] New screen is reachable only through the `App.tsx` guard **and** the `Layout` nav filter.
- [ ] New page added to `ALL_PAGES` + `PAGE_REGISTRY` (or the PR explains why it is outside them, like
      `report` / `swagger` — see K-010).
- [ ] `isAdmin` shortcuts were not widened to non-admin paths.

## 3. Tenancy

- [ ] Every new `select`/`update`/`delete` on a tenant table filters `company_id`.
- [ ] Every new `insert` sets `company_id`.
- [ ] No new code repeats the unscoped `settings` update pattern from K-004.

## 4. Data integrity

- [ ] New `CHECK` enum values mirrored in `react/src/lib/types.ts` **and**
      `angular/src/app/services/models.ts`.
- [ ] Invoice totals recomputed consistently with `calcLine` (subtotal, tax, discount, total).
- [ ] `amount_paid` / `status` transitions cannot drift (`paid` ⟺ fully paid, `partial` ⟺ 0 < paid < total).
- [ ] `updated_at` set on manual updates.
- [ ] Dates: `date` for business dates, `timestamptz` for audit fields; no timezone-shifted comparisons.

## 5. Schema

- [ ] DDL added to **both** `database/postgres/` and `database/sqlserver/`.
- [ ] Upgrades idempotent (`IF NOT EXISTS`, `DO $$` guards / `sys.tables` guards).
- [ ] Backfill provided for `NOT NULL` additions on populated tables.
- [ ] New tenant table has `company_id` + FK cascade + index.
- [ ] No destructive change without a stated upgrade plan.
- [ ] Authorization consequence stated (no RLS; see K-001b).

## 6. Business rules

- [ ] NCF: correct active sequence, `current_seq` incremented once, void log written on cancel,
      `reuse_allowed` decided by month.
- [ ] Region: no hard-coded `B01`, `ITBIS`, `18`, `DOP`; values come from `REGIONS[region]`.
- [ ] e-CF: `ecf_provider_config.mode` respected; response stored in `electronic_response`.
- [ ] Money formatted via `formatCurrency` / i18n formatter, not `toFixed(2)` string concatenation.

## 7. i18n & UI

- [ ] No new hard-coded user-facing strings.
- [ ] Keys added to `es`, `en` **and** `fr`.
- [ ] Dark-mode variants present for new colors.
- [ ] Uses `Modal` / `StatusBadge` rather than ad-hoc replacements.

## 8. Build health (must be executed, not assumed)

```powershell
cd react
npm run typecheck   # fails on unused locals/params
npm run lint
npm run build

cd ..\angular
npm run build       # only if angular/ changed
```

- [ ] Output pasted into the PR.
- [ ] No `any` introduced without a comment explaining why.
- [ ] No `console.log` left behind.

## 9. Documentation

- [ ] `ai_support/CONTEXT.md` updated if architecture/auth/tenancy/permissions/backend changed.
- [ ] `ai_support/PROJECT_STRUCTURE.md` updated if files/pages/tables were added.
- [ ] `memory/decisions.md` entry added for a new architectural choice.
- [ ] `memory/known-issues.md` updated if a defect was fixed (mark it) or found (add it).
- [ ] `handoff/CURRENT_HANDOFF.md` refreshed when the session ends.

## 10. Merge hygiene

- [ ] Commit messages say what changed and why; no `wip`, no `fix`.
- [ ] Branch is up to date with `main`.
- [ ] No generated artifacts (`dist/`, `node_modules/`) committed.
