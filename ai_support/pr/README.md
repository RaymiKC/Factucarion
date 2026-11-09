# pr/

The review process for FacturPro, kept next to the code it describes.

| File | Purpose | Activated by |
|---|---|---|
| [PULL_REQUEST_TEMPLATE.md](./PULL_REQUEST_TEMPLATE.md) | The PR body contributors must fill in | Copying to `.github/PULL_REQUEST_TEMPLATE.md` |
| [REVIEW_CHECKLIST.md](./REVIEW_CHECKLIST.md) | Repo-specific gates a reviewer must run through | Nothing — used by humans and the PR Reviewer agent |

```powershell
Copy-Item .\ai_support\pr\PULL_REQUEST_TEMPLATE.md .\.github\ -Force
```

Rules of thumb:

- One concern per PR. A migration plus three UI features in one diff cannot be reviewed here.
- State React/Angular scope explicitly — "not mirrored to Angular" is acceptable only when declared.
- Paste the verification output (typecheck / lint / build), not a claim that it passed.
- Link the known issue (`memory/known-issues.md` K-xxx) or decision (`memory/decisions.md` D-xxx) the
  PR touches.
