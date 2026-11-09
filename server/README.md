# FacturaPro API (`server/`)

Self-hosted REST API for FacturaPro. One codebase, two database backends — PostgreSQL or Microsoft
SQL Server — selected with a single environment variable. The React and Angular apps talk only to
this API; no database credentials ever reach the browser.

```
Browser (react/ or angular/)
        │  fetch + JWT
        ▼
server/  Express + TypeScript
        │  provider-agnostic SQL builder
        ├──► PostgreSQL  (pg)
        └──► SQL Server  (mssql / msnodesqlv8)
```

## Quick start

```powershell
cd server
npm install
Copy-Item .env.example .env      # then edit the connection string
npm run dev                      # http://localhost:3001
```

Verify:

```powershell
curl http://localhost:3001/health
npm run smoke                    # health + login + insert/select/update/delete
```

## Configuration

| Variable | Purpose |
|---|---|
| `DB_PROVIDER` | `postgres` (default) or `sqlserver` |
| `API_PORT` | HTTP port, default `3001` |
| `CORS_ORIGIN` | Comma separated allow-list, `*` for local dev |
| `PUBLIC_URL` | Base URL used to build file URLs |
| `UPLOAD_DIR` | Where uploaded files (company logos) are stored |
| `JWT_SECRET` | HS256 signing secret — **change it** |
| `JWT_EXPIRES_IN` | Session lifetime, default `12h` |
| `OTP_DEBUG` | `true` returns OTP tokens in the API response (no SMTP needed) |
| `PG_CONNECTION_STRING` | `postgres://user:pass@host:5432/database` |
| `PG_HOST/PG_PORT/PG_DATABASE/PG_USER/PG_PASSWORD` | Used when the connection string is empty |
| `MSSQL_CONNECTION_STRING` | Full ADO style connection string (optional) |
| `MSSQL_SERVER/PORT/DATABASE/USER/PASSWORD` | SQL authentication |
| `MSSQL_TRUSTED_CONNECTION` | `true` for Windows authentication (needs `msnodesqlv8`) |
| `MSSQL_TRUST_CERT` | Accept self-signed certificates (default `true`) |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | Optional SMTP for OTP and client emails |

## Endpoints

Everything under `/api/db`, `/api/storage`, `/api/mail` and `/api/auth/me` requires
`Authorization: Bearer <token>`.

### Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `status: authenticated \| otp_required \| password_change_required` |
| POST | `/api/auth/otp/request` | `{ email, purpose }` → `{ otpId, devToken? }` |
| POST | `/api/auth/otp/verify` | `{ otpId, token, purpose }` → session or `changeToken` |
| POST | `/api/auth/password` | Bearer `changeToken`; `{ password, confirmPassword }` → session |
| GET | `/api/auth/me` | Current profile |
| PATCH | `/api/auth/preferences` | `{ theme, language, region }` |
| POST | `/api/auth/logout` | Stateless; the client drops the token |

Login protects against brute force (3 attempts → 24 h lock) and upgrades legacy SHA-256 password
hashes to bcrypt on the first successful login.

### Data

The bundled client SDK (`react/src/lib/db.ts`, `angular/src/app/services/db.service.ts`) uses the
structured form:

| Method | Path | Body |
|---|---|---|
| POST | `/api/db/:table/select` | `{ columns, filters, order, limit, offset }` |
| POST | `/api/db/:table/insert` | `{ rows }` |
| POST | `/api/db/:table/update` | `{ values, filters }` |
| POST | `/api/db/:table/delete` | `{ filters }` |
| POST | `/api/db/:table/upsert` | `{ rows, onConflict }` |

Filters are `{ column, op, value }` with `op` in
`eq | neq | gt | gte | lt | lte | like | ilike | is | in | contains`.
Writes without a filter are rejected.

There is also a PostgREST-style REST surface for external integrations and the Swagger page:

```
GET    /api/db/clients?company_id=eq.<uuid>&order=name.asc&limit=50
GET    /api/db/clients/<id>
POST   /api/db/clients
PUT    /api/db/clients/<id>
DELETE /api/db/clients/<id>
```

`GET /api/tables` returns every table with its columns (introspected from the live database).
`GET /openapi.json` returns the generated OpenAPI document.

### Files and mail

| Method | Path | Notes |
|---|---|---|
| PUT | `/api/storage/:bucket?path=…` | `{ dataBase64 }` or raw binary; returns `{ publicUrl }` |
| GET | `/files/:bucket/:path` | Public read of uploaded files |
| POST | `/api/mail/send` | `{ to, subject, body, variables?, html? }` |
| GET | `/api/mail/status` | Whether SMTP is configured |

## Safety model

- Every identifier (table, column) is validated against the live schema before SQL is generated;
  values are always bound parameters.
- `users_config` writes go through `src/routes/row-hooks.ts`, which hashes `password` and
  `temp_password` with bcrypt so clear text secrets never reach the database.
- The API authenticates requests but does not enforce per-company tenancy; the clients filter by
  `company_id` (same behaviour as the previous backend).

## Layout

```
server/
├─ src/
│  ├─ index.ts               # bootstrap + graceful shutdown
│  ├─ app.ts                 # express wiring, CORS, static files, error handling
│  ├─ config.ts              # env parsing, connection strings
│  ├─ db/
│  │  ├─ types.ts            # DatabaseAdapter contract
│  │  ├─ base-adapter.ts     # provider-agnostic SQL builder
│  │  ├─ postgres.ts         # pg dialect
│  │  ├─ sqlserver.ts        # mssql dialect (tedious + msnodesqlv8)
│  │  └─ index.ts            # adapter factory/singleton
│  ├─ http/                  # errors, auth middleware, query parsing
│  ├─ routes/                # auth, db, storage, mail, health, openapi
│  ├─ security/              # jwt, password hashing
│  └─ services/mailer.ts     # SMTP transport
└─ scripts/smoke.ts          # end-to-end check
```

## Adding a new database feature

1. Add the table/column in **both** `database/postgres/` and `database/sqlserver/` (fresh schema +
   guarded upgrade).
2. Add the row type to `react/src/lib/types.ts` and `angular/src/app/services/models.ts`.
3. If the write needs normalisation, extend `src/routes/row-hooks.ts`.
4. `npm run smoke` to confirm both providers still work.
