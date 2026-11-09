# Handoff — <task title>

**Date:** YYYY-MM-DD
**Author:** <name / agent>
**Branch / commit:** `<branch>` @ `<sha>`
**Status:** ✅ complete · 🟡 partial · 🔴 blocked

---

## 1. Objective

<One or two sentences. What was the user asking for, in their terms.>

## 2. What changed

| File | Change | Verified? |
|---|---|---|
| `path` | what and why | ✅ typecheck / 👁 reviewed only / ❌ untested |

## 3. Verification performed

```text
<paste actual command output or the decisive lines>
```

- [ ] `cd react; npm run typecheck`
- [ ] `cd react; npm run lint`
- [ ] `cd react; npm run build`
- [ ] `cd angular; npm run build` (only if `angular/` changed)
- [ ] manual check: <scenario>

**Not verified:** <be explicit — e.g. "no browser run, dev server not started">

## 4. Decisions and assumptions

| # | Assumption / decision | Why | How to challenge it |
|---|---|---|---|
| 1 | | | |

## 5. Open threads

- [ ] <concrete next action — file + function>
- [ ] <blocked item + who/what unblocks it>

## 6. Related knowledge

- Decisions: `ai_support/memory/decisions.md` → <D-xxx>
- Known issues touched: `ai_support/memory/known-issues.md` → <K-xxx>
- Context sections updated: <CONTEXT.md §…>

## 7. Environment notes

- Database target used: <provider + host/db name, no credentials>
- Backend mode: `VITE_DB_PROVIDER=<value>`
- Anything a fresh machine needs (`npm install` per app; no root install)
