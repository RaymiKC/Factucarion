# agents/

Role definitions for AI assistants working on FacturPro. Each file is a VS Code custom agent
(`*.agent.md`): YAML front matter plus a system prompt.

| Agent | Use when | Produces |
|---|---|---|
| [repo-onboarder.agent.md](./repo-onboarder.agent.md) | Start of a task in an unfamiliar area; "how does X work?" | A traced data path with `path:line` citations, parity notes, risks |
| [feature-implementer.agent.md](./feature-implementer.agent.md) | The area is understood and code must change | A minimal, verified diff (React, plus Angular when required) |
| [schema-guardian.agent.md](./schema-guardian.agent.md) | Any table/column/index/constraint change | Guarded DDL in both `database/` engines + type sync in both apps |
| [pr-reviewer.agent.md](./pr-reviewer.agent.md) | Before opening or merging a PR | Severity-ordered findings with evidence, or a clean report |

Suggested chain: **Repo Onboarder → (Schema Guardian ∥ Feature Implementer) → PR Reviewer**.

## Activating

VS Code discovers agents in `.github/agents/`. This folder is the source of truth:

```powershell
New-Item -ItemType Directory -Force -Path .\.github\agents | Out-Null
Copy-Item .\ai_support\agents\*.agent.md .\.github\agents\ -Force
```

Re-run after editing any agent here. Alternatives: point the workspace at this folder via the
`chat.agentFilesLocations` setting, or paste the body into a prompt file.

## Writing a new agent

1. One responsibility, one stop condition. If it both researches and edits, split it.
2. Front matter: `name`, `description` (the description is what the router matches on — write it as
   "Use when…").
3. Give it the repo facts it cannot infer (`react/` vs `angular/`, `company_id` scoping, UI-only
   authorization, no router).
4. Require evidence: `path:line`, or an explicit "unverified" label.
5. Tell it what **not** to do (install packages, edit applied migrations, add `react-router`, commit
   secrets).
6. Update the table above and `ai_support/README.md` when you add or rename an agent.
