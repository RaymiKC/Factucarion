<!--
  FacturPro pull request template.
  Source of truth: ai_support/pr/PULL_REQUEST_TEMPLATE.md
  Activate with: Copy-Item .\ai_support\pr\PULL_REQUEST_TEMPLATE.md .\.github\ -Force
-->

## What changed

<!-- One paragraph. What the user can do now that they could not before. -->

## Why

<!-- Link the issue/ticket, or explain the bug with a reproducible scenario. -->

Closes #

## Scope

<!-- Tick what actually changed. Do not tick what you did not verify. -->

- [ ] `react/` (primary app)
- [ ] `angular/` (replica) — mirrors the same behavior
- [ ] `server/` (API: routes, adapters, auth)
- [ ] `database/postgres/` and `database/sqlserver/` (both engines; guarded upgrades)
- [ ] `ai_support/` docs only (no runtime change)

## Data & tenancy

- Tables/columns touched:
- Tenant scoping: every new read filters `company_id` / every new write sets `company_id` — [ ] yes, [ ] N/A
- Permission keys affected (`ALL_PAGES` / `PAGE_REGISTRY` / role rows): 
- DDL present in **both** `database/postgres/` and `database/sqlserver/`, idempotent and append-only: [ ] yes, [ ] N/A

## Security

- New API routes are behind `requireAuth` (see `server/src/app.ts`): [ ] yes, [ ] N/A
- Tenancy is still client-enforced (see `ai_support/memory/known-issues.md` K-001b). Does this change
  let a user reach another company's rows? [ ] no, [ ] yes → explain:
- No secrets added to tracked files (`server/.env`, connection strings, SMTP/DGII credentials): [ ]

## Verification

```text
# paste command output, not a summary
cd server; npm run typecheck
cd server; npm run smoke          # with the API running
cd react; npm run build
cd angular; npx ng build          # if touched
```

Manual checks performed (two-company scoping, NCF sequence, payment reconciliation, OTP login, …):

## Docs updated

- [ ] `ai_support/CONTEXT.md`
- [ ] `ai_support/PROJECT_STRUCTURE.md`
- [ ] `ai_support/memory/*` (`conventions` / `decisions` / `known-issues`)
- [ ] N/A — no structural or behavioral change

## Reviewer notes

<!-- Where should the reviewer look first? What are you unsure about? -->
