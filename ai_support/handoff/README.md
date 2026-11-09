# handoff/

A handoff is the shortest document that lets the next person (or agent) continue **without re-reading
the repo**.

| File | Purpose |
|---|---|
| [HANDOFF_TEMPLATE.md](./HANDOFF_TEMPLATE.md) | Copy per task, rename `handoff/YYYY-MM-DD-<slug>.md` |
| [CURRENT_HANDOFF.md](./CURRENT_HANDOFF.md) | The live state. Overwrite it at the end of every work session |

Rules:

1. **State, not narrative.** What is done, what is half-done, what is not started.
2. **Always include the verification you ran** and the one you did not.
3. **Name the next action concretely** (file + function), not "continue working on invoices".
4. **Record assumptions** you made because the user was not available — the next person must be able
   to challenge them.
5. **No secrets**, no giant logs. Link paths and commit hashes instead.
6. If the session changed behavior or structure, update `CONTEXT.md` / `PROJECT_STRUCTURE.md` **before**
   writing the handoff.
