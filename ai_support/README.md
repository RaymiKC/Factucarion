# ai_support — AI working context for FacturPro (MVP)

Everything an AI assistant (or a new developer) needs to work on this repo **without guessing**:
a verified architecture snapshot, an annotated file map, agent roles, a project memory, a PR process
and a handoff format.

**Read in this order:**

1. [CONTEXT.md](./CONTEXT.md) — how the system actually works (auth, tenancy, permissions, data, backends, business rules).
2. [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) — where every file lives and where to make a given change.
3. [memory/conventions.md](./memory/conventions.md) — the house style.
4. [memory/known-issues.md](./memory/known-issues.md) — traps that will bite you.
5. [handoff/CURRENT_HANDOFF.md](./handoff/CURRENT_HANDOFF.md) — state of the repo right now.

---

## Contents

```
ai_support/
├─ README.md                     # this file: purpose, usage, maintenance rules
├─ CONTEXT.md                    # big picture, verified from code
├─ PROJECT_STRUCTURE.md          # annotated tree + "where do I change X"
├─ agents/
│  ├─ README.md                  # how to activate the agents
│  ├─ repo-onboarder.agent.md    # verify-before-you-edit scout
│  ├─ feature-implementer.agent.md # end-to-end feature work in this codebase
│  ├─ schema-guardian.agent.md   # migrations + type sync + tenancy integrity
│  └─ pr-reviewer.agent.md       # repo-specific review pass
├─ memory/
│  ├─ README.md
│  ├─ conventions.md             # observed coding conventions
│  ├─ decisions.md               # ADR-lite log of architectural decisions
│  └─ known-issues.md            # verified gaps, risks, dead code
├─ pr/
│  ├─ README.md
│  ├─ PULL_REQUEST_TEMPLATE.md   # copy to .github/ to activate
│  └─ REVIEW_CHECKLIST.md        # repo-specific review gates
└─ handoff/
   ├─ README.md
   ├─ HANDOFF_TEMPLATE.md        # copy per task
   └─ CURRENT_HANDOFF.md         # the live handoff, updated at end of work
```

---

## Activate the agent / PR template (one-time, optional)

VS Code discovers custom agents in `.github/agents/` and GitHub reads
`.github/PULL_REQUEST_TEMPLATE.md`. This folder keeps the sources; copy them when you want them live:

```powershell
New-Item -ItemType Directory -Force -Path .\.github\agents | Out-Null
Copy-Item .\ai_support\agents\*.agent.md .\.github\agents\ -Force
Copy-Item .\ai_support\pr\PULL_REQUEST_TEMPLATE.md .\.github\ -Force
```

Re-run the copy after editing an agent here, or point your editor at `ai_support/agents/` directly.

---

## Ground rules for any AI working here

1. **Read before writing.** State which files you read to reach a conclusion. If you cannot cite a
   file and line, you are speculating.
2. **The code wins.** If `CONTEXT.md` and the code disagree, trust the code and then correct the doc.
3. **Never assume "React only".** `angular/` is a live replica sharing the same database. Decide
   explicitly whether a change must be mirrored, and say so.
4. **Tenant safety.** Any query on a tenant table filters `company_id`; any insert sets it.
5. **Authorization is partly in the UI.** The API requires a valid JWT for every `/api/db` call but
   does not enforce per-row tenancy; every query on a tenant table must still filter `company_id`
   and every insert must set it. Check the page guard and permission check when you touch a data path.
6. **Database changes go in `database/`.** Schema, seed, functions and views live in
   `database/postgres/` and `database/sqlserver/`. Never edit an applied `05_upgrade_existing.sql`
   section in place for a live database — append new guarded statements.
7. **Keep types in sync** between `react/src/lib/types.ts` and
   `angular/src/app/services/models.ts`, and keep `server/src/db` provider-agnostic.
8. **Verify with a command**, not with confidence: `npm run smoke` in `server/`, `npm run build` in
   `react/` and `npx ng build` in `angular/`.
9. **Never copy secrets into these docs.** Connection strings and `JWT_SECRET` live in
   `server/.env` (git-ignored); refer to them by path only.

---

## Maintenance contract

| Trigger | Update |
|---|---|
| Architecture, auth, tenancy, permissions or backend changes | `CONTEXT.md` |
| New file/folder, new page, new table | `PROJECT_STRUCTURE.md` |
| A convention is established or broken | `memory/conventions.md` |
| A design choice is made with trade-offs | `memory/decisions.md` (new `D-xxx` entry) |
| A bug, risk or dead-code path is confirmed | `memory/known-issues.md` (with evidence) |
| End of any work session | `handoff/CURRENT_HANDOFF.md` |

Keep entries short, dated, and evidence-linked. Delete or supersede stale entries instead of
accumulating contradictions.

---

## Snapshot

| | |
|---|---|
| Branch | `main` |
| Apps | `react/` (primary), `angular/` (replica) |
| Backend | Self-hosted API (`server/`) → PostgreSQL **or** SQL Server |
| Database scripts | `database/postgres/`, `database/sqlserver/` |
| Auth | Own JWT + bcrypt in the API (`server/src/routes/auth.ts`) |
| Verified | 2026-11-09 |
