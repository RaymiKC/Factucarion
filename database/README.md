# Database scripts

SQL for both supported backends lives here — one folder per engine, identical object model.

```
database/
├─ postgres/
│  ├─ 01_create_schema.sql     # tables, indexes, constraints (incl. otp_tokens)
│  ├─ 02_seed_data.sql         # default company, tax rates, settings, roles, admin user
│  ├─ 03_functions.sql         # helper functions
│  ├─ 04_views.sql             # reporting views
│  └─ 05_upgrade_existing.sql  # idempotent upgrades for an existing database
└─ sqlserver/
   ├─ 01_create_schema.sql
   ├─ 02_seed_data.sql
   ├─ 03_stored_procedures.sql
   ├─ 04_views.sql
   └─ 05_upgrade_existing.sql
```

Both schemas expose the same 23 tables, so the API (`server/`) and both frontends work unchanged.

## Default admin

| Field | Value |
|---|---|
| Email | `admin@miempresa.com` |
| Password | `Admin123!` |

Change it right after the first login. The hash is bcrypt; the API also accepts and upgrades the
legacy SHA-256 hashes produced by older builds.

## PostgreSQL

```powershell
$env:PGPASSWORD='<password>'
$psql  = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$conn  = @('-U','postgres','-h','127.0.0.1','-p','5432','-d','facturpro','-v','ON_ERROR_STOP=1')

# one-time: create the database
& $psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE facturpro;"

# fresh install
Get-ChildItem database\postgres\0[1-4]_*.sql | ForEach-Object { & $psql @conn -f $_.FullName }

# existing install
& $psql @conn -f database\postgres\05_upgrade_existing.sql
```

Connection string used by the API:

```
postgres://<user>:<password>@127.0.0.1:5432/facturpro
```

## Microsoft SQL Server

```powershell
# one-time: create the database
sqlcmd -S localhost -E -Q "IF DB_ID('FacturaPro') IS NULL CREATE DATABASE FacturaPro;"

# fresh install
foreach ($f in '01_create_schema','02_seed_data','03_stored_procedures','04_views') {
  sqlcmd -S localhost -E -b -i "database\sqlserver\$f.sql"
}

# existing install
sqlcmd -S localhost -E -b -i "database\sqlserver\05_upgrade_existing.sql"
```

Connection options used by the API (see `server/.env.example`):

```
# SQL authentication
MSSQL_SERVER=localhost
MSSQL_PORT=1433
MSSQL_DATABASE=FacturaPro
MSSQL_USER=sa
MSSQL_PASSWORD=<password>
MSSQL_TRUST_CERT=true

# or Windows authentication (no SQL login; needs the msnodesqlv8 driver)
MSSQL_TRUSTED_CONNECTION=true
```

## Notes

- Identifiers are validated against the live schema by the API before any SQL is generated, so
  `SELECT *`-style access cannot reach tables that do not exist.
- SQL Server `UNIQUEIDENTIFIER` values are lower-cased by the API so ids behave identically on both
  engines.
- `05_upgrade_existing.sql` is idempotent; run it after pulling changes against a database that
  already has data. It also drops the obsolete `users_config.supabase_uid` column.
