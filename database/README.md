# Database scripts

SQL for both supported backends lives here — one folder per engine, identical object model.

```
database/
├─ setup.ps1                   # one-command first-time setup (either engine)
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

## Quick setup (one command)

`setup.ps1` creates the database when it is missing and applies the scripts in order
(schema → seed → functions/stored procedures → views). Every script is idempotent, so re-running the
command is safe.

```powershell
cd database

# PostgreSQL (default port 5432, database facturpro)
.\setup.ps1 -PgPassword '<postgres-password>'

# PostgreSQL on a different port, and generate server\.env at the same time
.\setup.ps1 -PgPassword '<postgres-password>' -PgPort 5434 -WriteEnv

# SQL Server with Windows authentication
.\setup.ps1 -Provider sqlserver -TrustedConnection

# SQL Server with a SQL login
.\setup.ps1 -Provider sqlserver -MssqlUser sa -MssqlPassword '<sa-password>' -WriteEnv

# Database that already has data from an older schema
.\setup.ps1 -Provider sqlserver -TrustedConnection -Upgrade
```

| Parameter | Default | Notes |
|---|---|---|
| `-Provider` | `postgres` | `postgres` or `sqlserver` |
| `-Database` | `facturpro` / `FacturaPro` | Created if it does not exist |
| `-PgHost`, `-PgPort`, `-PgUser` | `127.0.0.1`, `5432`, `postgres` | User needs `CREATE DATABASE` |
| `-PgPassword` | `$env:PGPASSWORD` | Never written to the command line log |
| `-MssqlServer`, `-MssqlPort` | `localhost`, `1433` | Instance plus port |
| `-MssqlUser`, `-MssqlPassword` | `sa`, `$env:SQLCMDPASSWORD` | Ignored with `-TrustedConnection` |
| `-TrustedConnection` | off | Windows authentication (`-E`) |
| `-Upgrade` | off | Runs only `05_upgrade_existing.sql` |
| `-WriteEnv` | off | Writes `server\.env` from `.env.example` with a generated `JWT_SECRET` |
| `-Force` | off | Overwrites an existing `server\.env` |
| `-PsqlPath`, `-SqlcmdPath` | auto-detected | Override when the client tools are not on `PATH` |

The SQL Server `.sql` files contain `USE [FacturaPro];`; the script drops that line and targets the
`-Database` you pass, so a different name works without editing anything.

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
- `setup.ps1` runs the scripts as UTF-8 (`sqlcmd -f 65001`, `PGCLIENTENCODING=UTF8`) so accented seed
  text such as `República Dominicana` is stored correctly. Plain `sqlcmd -i` without `-f 65001` mangles
  it.
- `05_upgrade_existing.sql` is idempotent; run it after pulling changes against a database that
  already has data. It also drops the obsolete `users_config.supabase_uid` column.
