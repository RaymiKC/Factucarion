# Conventions — how code is actually written here

Observed from the code at commit `e73f629`. These are descriptive, not aspirational: match them
unless you have a reason not to.

---

## 1. Structure

- **React** (`react/src`): `components/` (shared presentational), `lib/` (providers, hooks, types,
  helpers), `pages/` (one component per screen, default export).
- **Angular** (`angular/src/app`): `components/`, `pages/<feature>/<feature>.component.ts`,
  `services/`, `guards/`. Standalone components, `providedIn: 'root'` services.
- No barrel files. No path aliases. Imports are relative (`../lib/hooks`).
- Import order used in practice: `react` → `lucide-react` → `../lib/*` → `../components/*` → local
  types/helpers. Not enforced by ESLint.

## 2. React component style

- Function components, `export default function Name({ ... }: Props)`.
- Props interface declared directly above the component: `interface InvoicesProps { companyId?: string }`.
- Data comes from hooks at the top of the component; local UI state with `useState`.
- Derived values are computed in the render body (often verbose `useMemo`-free expressions).
- Large components keep private sub-components in the same file (`function InvoiceDetail(...)` at the
  bottom of `Invoices.tsx`). Follow that when extending an existing page.

## 3. Providers and context

The pattern is identical everywhere (`auth`, `company`, `permissions`, `theme`, `i18n`):

```tsx
const XContext = createContext<XContextValue | null>(null);
export function XProvider({ children }: { children: ReactNode }) { /* state + callbacks */ }
export function useX() {
  const ctx = useContext(XContext);
  if (!ctx) throw new Error('useX must be used inside XProvider');
  return ctx;
}
```

- Values exposed to context are wrapped in `useCallback` (and the provider memoizes nothing else).
- Providers are composed in `App.tsx`; props are bridged in through small wrapper components
  (`CompanyBridge`, `PermissionsBridge`) instead of reading auth inside the provider.

## 4. Data hooks

```ts
export function useThings(companyId?: string) {
  const [things, setThings] = useState<Thing[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    let q = db.from('things').select('*').order('name');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q;
    setThings(data ?? []);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { things, loading, refetch: fetch };
}
```

- `companyId` is optional, and the filter is applied only when it is provided.
- The query builder is reassigned (`let q = ...; if (x) q = q.eq(...)`) — do not chain conditionally
  in a way that loses the type.
- Mutations live in the page, not in the hook, and call `refetch()` afterwards.

## 5. Mutations and feedback

- Writes are direct: `const { data } = await db.from('x').insert({...}).select().maybeSingle()`.
- Errors are usually not surfaced: `const { data } = await ...` discards `error`; network paths use
  `.catch(() => {})`. Do not add a global error system as a drive-by change.
- **User feedback = a row in `notifications`**, not a toast:

  ```ts
  await db.from('notifications').insert({
    type: 'system', title: 'Factura creada',
    message: `Factura ${n} creada por ${formatCurrency(total)}`,
    invoice_id: inv.id,
  });
  ```

  Valid `type` values: `invoice_sent, payment_received, overdue, reminder, system, electronic`.
- `updated_at` is always set manually: `updated_at: new Date().toISOString()`.

## 6. UI / Tailwind

- Tailwind utilities only; no CSS modules, no styled-components.
- Palette: `slate` for neutrals, `sky` for primary, `emerald` (paid), `amber` (partial),
  `red` (overdue/rejected), `blue` (sent), `gray` (cancelled).
- Every color that matters has a `dark:` twin:
  `text-slate-700 dark:text-slate-200`, `bg-white dark:bg-slate-900`.
- Common shapes: `rounded-lg` / `rounded-xl`, `px-4 py-3` table cells, `text-xs font-semibold`
  header labels, `border border-slate-200 dark:border-slate-700`.
- Icons: `lucide-react` only, sized inline (`className="w-4 h-4"`).
- Dialogs: `<Modal isOpen title size>` from `components/Modal.tsx`. Confirmation flows use a second
  state object (`cancelConfirm`, `payModal`) rather than `window.confirm`.

## 7. i18n

- Every user-visible string goes through `t('snake_case_key')` from `useI18n()`.
- Keys are grouped by area and duplicated in all three objects (`es`, `en`, `fr`) inside
  `lib/i18n.tsx`. Adding a key to one language only produces a raw key in the UI.
- Region-dependent copy/values come from `const { region, regionConfig } = useI18n()`:
  currency, locale, tax label, `invoiceNumberLabel`, `hasNcfSequences`, invoice types.
- Legacy helpers in `lib/utils.ts` (`formatCurrency`, `formatDate`) are still used widely; new code
  should prefer the i18n formatters, but do not mass-migrate.

## 8. TypeScript

- `strict: true`; React also sets `noUnusedLocals` + `noUnusedParameters` → **an unused import breaks
  `npm run typecheck`**.
- Domain types are hand-written in `react/src/lib/types.ts` (mirrored in
  `angular/src/app/services/models.ts`). There is no generated `Database` type.
- `unknown` is preferred over `any` in catch blocks: `catch (e: unknown)`.
- Angular uses `signal()` for state in `DataService`, and `strictTemplates` is on.

## 9. SQL / migrations

- Plural `snake_case` table names, `uuid` PKs with `gen_random_uuid()`.
- `numeric(12,2)` for money, `numeric(5,2)` for rates, `date` for business dates,
  `timestamptz DEFAULT now()` for audit columns.
- Enumerations via `CHECK (col IN (...))` — no Postgres `ENUM` types.
- Columns default to `''` (not `NULL`) for optional text; booleans default `true`/`false`.
- Idempotent DDL with `IF NOT EXISTS` and `DO $$` guards (Postgres) or
  `IF NOT EXISTS (SELECT 1 FROM sys.tables ...)` (SQL Server).
- Every change goes into **both** `database/postgres/` and `database/sqlserver/`.
- Comments: a header block explaining each table and column, matching
  `database/postgres/01_create_schema.sql`.

## 10. Git / docs

- Commit messages are short and sometimes terse (`whole thing`, `angular replica project added`).
  Prefer `area: summary` for new work (e.g. `react/invoices: scope invoice counter per company`).
- Do not commit `react/.env`.
- Update `ai_support/` in the same change when you alter structure or behavior documented there.
