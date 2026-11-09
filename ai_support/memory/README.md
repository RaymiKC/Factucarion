# memory/

Durable knowledge that outlives a single task. Three files, three jobs:

| File | Contains | Write when |
|---|---|---|
| [conventions.md](./conventions.md) | How code in this repo is written (patterns, naming, styling, feedback) | You establish or discover a convention |
| [decisions.md](./decisions.md) | Why the architecture looks the way it does (ADR-lite, `D-xxx`) | A design choice with trade-offs is made |
| [known-issues.md](./known-issues.md) | Verified defects, dead code, risks, and parity gaps | You confirm a problem (with evidence) |

Rules:

- **Evidence or it did not happen.** Every entry links a path (and line where it matters).
- **Date it.** `YYYY-MM-DD` prefix or a `— verified YYYY-MM-DD` suffix.
- **Supersede, do not contradict.** If an entry becomes wrong, update it or mark it `Superseded by D-xxx`.
- **No secrets.** Never paste keys, tokens, connection strings or passwords here.

This folder is the AI equivalent of onboarding notes. Keep it short enough to actually be read.
