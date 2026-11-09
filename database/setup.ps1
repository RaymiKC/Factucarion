<#
.SYNOPSIS
    First-time database setup for FacturPro (PostgreSQL or SQL Server).

.DESCRIPTION
    Creates the database when it does not exist and applies the scripts in the order they require:
    schema -> seed data -> functions or stored procedures -> views.

    The scripts are idempotent (IF NOT EXISTS / ON CONFLICT guards), so re-running this command on a
    database that already exists is safe and will only apply what is missing.

    Use -Upgrade on a database that already holds data from an older schema; it runs only
    05_upgrade_existing.sql.

    The API connects with the credentials you pass here, so pass the same values to -WriteEnv to
    generate server/.env as well.

.PARAMETER Provider
    Database engine to install into: postgres (default) or sqlserver.

.PARAMETER Database
    Target database name. Defaults to facturpro (PostgreSQL) or FacturaPro (SQL Server).

.PARAMETER PgHost
    PostgreSQL host, default 127.0.0.1.

.PARAMETER PgPort
    PostgreSQL port, default 5432.

.PARAMETER PgUser
    PostgreSQL user, default postgres. It needs CREATE DATABASE permission.

.PARAMETER PgPassword
    PostgreSQL password. Defaults to $env:PGPASSWORD.

.PARAMETER MssqlServer
    SQL Server host, default localhost.

.PARAMETER MssqlPort
    SQL Server port, default 1433.

.PARAMETER MssqlUser
    SQL login used when -TrustedConnection is not set, default sa.

.PARAMETER MssqlPassword
    SQL login password. Defaults to $env:SQLCMDPASSWORD.

.PARAMETER TrustedConnection
    Connect to SQL Server with Windows authentication (-E) instead of a SQL login.

.PARAMETER PsqlPath
    Explicit path to psql.exe. Defaults to PATH, then the newest C:\Program Files\PostgreSQL\*\bin.

.PARAMETER SqlcmdPath
    Explicit path to sqlcmd.exe. Defaults to PATH, then the usual Client SDK / Tools\Binn locations.

.PARAMETER Upgrade
    Run only 05_upgrade_existing.sql. Use this against a database that already has data.

.PARAMETER WriteEnv
    Write server/.env from server/.env.example using the connection values passed to this script.

.PARAMETER Force
    Overwrite an existing server/.env when -WriteEnv is used.

.EXAMPLE
    .\setup.ps1 -PgPassword 'postgres'

.EXAMPLE
    .\setup.ps1 -PgPassword 'postgres' -PgPort 5434 -WriteEnv

.EXAMPLE
    .\setup.ps1 -Provider sqlserver -TrustedConnection

.EXAMPLE
    .\setup.ps1 -Provider sqlserver -TrustedConnection -Database FacturaPro -Upgrade

.NOTES
    The SQL Server scripts contain "USE [FacturaPro];". This script removes that line and targets the
    -Database you specify, so a different database name works without editing the .sql files.
#>
[CmdletBinding()]
param(
    [ValidateSet('postgres', 'sqlserver')]
    [string] $Provider = 'postgres',

    [string] $Database,

    [string] $PgHost = '127.0.0.1',
    [int]    $PgPort = 5432,
    [string] $PgUser = 'postgres',
    [string] $PgPassword = $env:PGPASSWORD,

    [string] $MssqlServer = 'localhost',
    [int]    $MssqlPort = 1433,
    [string] $MssqlUser = 'sa',
    [string] $MssqlPassword = $env:SQLCMDPASSWORD,
    [switch] $TrustedConnection,

    [string] $PsqlPath,
    [string] $SqlcmdPath,

    [switch] $Upgrade,
    [switch] $WriteEnv,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
$repoRoot     = Split-Path -Parent $PSScriptRoot
$scriptsRoot  = Join-Path $PSScriptRoot $Provider

if (-not $Database) {
    $Database = if ($Provider -eq 'postgres') { 'facturpro' } else { 'FacturaPro' }
}

function Assert-TargetDatabase {
    param([string] $Actual)
    if ("$Actual".Trim() -ne $Database) {
        throw "Client connected to '$("$Actual".Trim())' instead of '$Database'. Aborting so the wrong database is never modified."
    }
}

function Write-Step {
    param([string] $Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Done {
    param([string] $Message)
    Write-Host "    $Message" -ForegroundColor DarkGray
}

function Resolve-PsqlPath {
    if ($PsqlPath) {
        if (-not (Test-Path -LiteralPath $PsqlPath)) { throw "psql.exe not found at '$PsqlPath'." }
        return (Resolve-Path -LiteralPath $PsqlPath).Path
    }

    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $candidates = Get-ChildItem -Path 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue
    if ($candidates) {
        return ($candidates |
            Sort-Object { try { [version]$_.Directory.Parent.Name } catch { [version]'0.0' } } -Descending |
            Select-Object -First 1).FullName
    }

    throw 'psql.exe was not found. Install the PostgreSQL client tools or pass -PsqlPath.'
}

function Resolve-SqlcmdPath {
    if ($SqlcmdPath) {
        if (-not (Test-Path -LiteralPath $SqlcmdPath)) { throw "sqlcmd.exe not found at '$SqlcmdPath'." }
        return (Resolve-Path -LiteralPath $SqlcmdPath).Path
    }

    $command = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $patterns = @(
        'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\*\Tools\Binn\sqlcmd.exe',
        'C:\Program Files\Microsoft SQL Server\*\Tools\Binn\sqlcmd.exe',
        'C:\Program Files (x86)\Microsoft SQL Server\Client SDK\ODBC\*\Tools\Binn\sqlcmd.exe',
        'C:\Program Files (x86)\Microsoft SQL Server\*\Tools\Binn\sqlcmd.exe',
        'C:\Program Files\mssql-tools*\bin\sqlcmd.exe',
        'C:\Program Files (x86)\mssql-tools*\bin\sqlcmd.exe'
    )

    $candidates = foreach ($pattern in $patterns) {
        Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
    }

    if ($candidates) {
        return ($candidates |
            Sort-Object { try { [version](Split-Path -Leaf (Split-Path -Parent (Split-Path -Parent $_.FullName))) } catch { [version]'0.0' } } -Descending |
            Select-Object -First 1).FullName
    }

    throw 'sqlcmd.exe was not found. Install the SQL Server command line tools or pass -SqlcmdPath.'
}

function Get-ScriptFiles {
    if ($Upgrade) {
        $files = @('05_upgrade_existing.sql')
    }
    else {
        $procedureScript = if ($Provider -eq 'postgres') { '03_functions.sql' } else { '03_stored_procedures.sql' }
        $files = @('01_create_schema.sql', '02_seed_data.sql', $procedureScript, '04_views.sql')
    }

    $resolved = foreach ($file in $files) {
        $path = Join-Path $scriptsRoot $file
        if (-not (Test-Path -LiteralPath $path)) { throw "Missing script: $path" }
        $path
    }

    return @($resolved)
}

function Invoke-PostgresSetup {
    param([string] $Psql)

    if (-not $PgPassword) {
        throw 'No PostgreSQL password. Pass -PgPassword or set $env:PGPASSWORD.'
    }

    $previousPassword = $env:PGPASSWORD
    $previousEncoding = $env:PGCLIENTENCODING
    $env:PGPASSWORD = $PgPassword
    $env:PGCLIENTENCODING = 'UTF8'
    $safeDatabase = $Database.Replace("'", "''")

    try {
        $connection = @('-U', $PgUser, '-h', $PgHost, '-p', "$PgPort", '-v', 'ON_ERROR_STOP=1')

        Write-Step "Checking connection to $PgHost`:$PgPort as $PgUser"
        $exists = & $Psql @connection -d 'postgres' -tAc "SELECT 1 FROM pg_database WHERE datname = '$safeDatabase'"
        if ($LASTEXITCODE -ne 0) {
            throw "Cannot connect to PostgreSQL at $PgHost`:$PgPort. Check the host, port and password."
        }

        if ("$exists".Trim() -eq '1') {
            Write-Done "Database '$Database' already exists."
        }
        else {
            Write-Step "Creating database '$Database'"
            & $Psql @connection -d 'postgres' -c "CREATE DATABASE ""$Database"""
            if ($LASTEXITCODE -ne 0) { throw "Could not create database '$Database'." }
            Write-Done "Database '$Database' created."
        }

        foreach ($file in Get-ScriptFiles) {
            Write-Step "Running $(Split-Path -Leaf $file)"
            $current = & $Psql @connection -d $Database -tAc 'SELECT current_database()'
            if ($LASTEXITCODE -ne 0) { throw "Cannot open database '$Database'." }
            Assert-TargetDatabase $current
            & $Psql @connection -d $Database -f $file
            if ($LASTEXITCODE -ne 0) { throw "Failed while running $(Split-Path -Leaf $file)." }
            Write-Done 'OK'
        }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
        $env:PGCLIENTENCODING = $previousEncoding
    }
}

function Invoke-SqlServerSetup {
    param([string] $Sqlcmd)

    $previousPassword = $env:SQLCMDPASSWORD

    $connection = @('-S', "$MssqlServer,$MssqlPort", '-b', '-I', '-l', '60', '-f', '65001')
    if ($TrustedConnection) {
        $connection += '-E'
    }
    else {
        if (-not $MssqlPassword) {
            throw 'No SQL Server password. Pass -MssqlPassword, set $env:SQLCMDPASSWORD, or use -TrustedConnection.'
        }
        $connection += @('-U', $MssqlUser)
        $env:SQLCMDPASSWORD = $MssqlPassword
    }

    $tempFiles = New-Object System.Collections.Generic.List[string]

    try {
        Write-Step "Checking connection to $MssqlServer`:$MssqlPort"
        $safeDatabase = $Database.Replace("]", "]]")
        $query = "SET NOCOUNT ON; IF DB_ID(N'$($Database.Replace("'", "''"))') IS NULL BEGIN CREATE DATABASE [$safeDatabase]; PRINT 'created'; END ELSE PRINT 'exists';"
        $result = & $Sqlcmd @connection -h -1 -W -Q $query
        if ($LASTEXITCODE -ne 0) {
            throw "Cannot connect to SQL Server at $MssqlServer`:$MssqlPort. Check the instance, port and credentials."
        }

        if ("$result".Trim() -eq 'created') {
            Write-Done "Database '$Database' created."
        }
        else {
            Write-Done "Database '$Database' already exists."
        }

        $current = & $Sqlcmd @connection -d $Database -h -1 -W -Q 'SET NOCOUNT ON; SELECT DB_NAME();'
        if ($LASTEXITCODE -ne 0) { throw "Cannot open database '$Database'." }
        Assert-TargetDatabase $current

        foreach ($file in Get-ScriptFiles) {
            Write-Step "Running $(Split-Path -Leaf $file)"

            # Each script starts with "USE [FacturaPro];" - drop it so -Database decides the target.
            $sql = Get-Content -LiteralPath $file -Raw
            $sql = [regex]::Replace($sql, '(?im)^[ \t]*USE[ \t]+\[[^\]]+\][ \t]*;?[ \t]*\r?\n', '')

            $tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "facturpro-$([guid]::NewGuid().ToString('N')).sql")
            [System.IO.File]::WriteAllText($tempFile, $sql)
            $tempFiles.Add($tempFile)

            & $Sqlcmd @connection -d $Database -i $tempFile
            if ($LASTEXITCODE -ne 0) { throw "Failed while running $(Split-Path -Leaf $file)." }
            Write-Done 'OK'
        }
    }
    finally {
        $env:SQLCMDPASSWORD = $previousPassword
        foreach ($tempFile in $tempFiles) {
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Write-ServerEnvFile {
    $template = Join-Path $repoRoot 'server\.env.example'
    $target   = Join-Path $repoRoot 'server\.env'

    if (-not (Test-Path -LiteralPath $template)) { throw "Missing template: $template" }
    if ((Test-Path -LiteralPath $target) -and -not $Force) {
        throw "server\.env already exists. Re-run with -Force to overwrite it, or skip -WriteEnv."
    }

    $content = Get-Content -LiteralPath $template -Raw

    $bytes = New-Object byte[] 48
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    $jwtSecret = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

    $content = [regex]::Replace($content, '(?m)^DB_PROVIDER=.*$', "DB_PROVIDER=$Provider")
    $content = [regex]::Replace($content, '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$jwtSecret")

    if ($Provider -eq 'postgres') {
        $user = [uri]::EscapeDataString($PgUser)
        $password = [uri]::EscapeDataString($PgPassword)
        $url = "postgres://$user`:$password@${PgHost}:$PgPort/$Database"
        $content = [regex]::Replace($content, '(?m)^PG_CONNECTION_STRING=.*$', "PG_CONNECTION_STRING=$url")
    }
    else {
        $content = [regex]::Replace($content, '(?m)^# MSSQL_SERVER=.*$', "MSSQL_SERVER=$MssqlServer")
        $content = [regex]::Replace($content, '(?m)^# MSSQL_PORT=.*$', "MSSQL_PORT=$MssqlPort")
        $content = [regex]::Replace($content, '(?m)^# MSSQL_DATABASE=.*$', "MSSQL_DATABASE=$Database")

        if ($TrustedConnection) {
            $content = [regex]::Replace($content, '(?m)^# MSSQL_TRUSTED_CONNECTION=.*$', 'MSSQL_TRUSTED_CONNECTION=true')
        }
        else {
            $content = [regex]::Replace($content, '(?m)^# MSSQL_USER=.*$', "MSSQL_USER=$MssqlUser")
            $content = [regex]::Replace($content, '(?m)^# MSSQL_PASSWORD=.*$', "MSSQL_PASSWORD=$MssqlPassword")
        }
    }

    [System.IO.File]::WriteAllText($target, $content)
    Write-Step "Wrote server\.env (provider: $Provider, database: $Database)"
}

try {
    if (-not (Test-Path -LiteralPath $scriptsRoot)) {
        throw "Unknown provider '$Provider': $scriptsRoot does not exist."
    }

    Write-Host ''
    Write-Host "FacturPro database setup - $Provider / $Database" -ForegroundColor White
    Write-Host ('-' * 52) -ForegroundColor DarkGray

    if ($WriteEnv -and (Test-Path -LiteralPath (Join-Path $repoRoot 'server\.env')) -and -not $Force) {
        throw 'server\.env already exists. Re-run with -Force to overwrite it, or skip -WriteEnv.'
    }

    if ($Provider -eq 'postgres') {
        $psql = Resolve-PsqlPath
        Write-Done "psql: $psql"
        Invoke-PostgresSetup -Psql $psql
    }
    else {
        $sqlcmd = Resolve-SqlcmdPath
        Write-Done "sqlcmd: $sqlcmd"
        Invoke-SqlServerSetup -Sqlcmd $sqlcmd
    }

    if ($WriteEnv) {
        Write-ServerEnvFile
    }

    Write-Host ''
    Write-Host 'Database is ready.' -ForegroundColor Green
    Write-Host 'Seeded admin: admin@miempresa.com / Admin123! (change it on first login)' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Next steps:'
    Write-Host '  cd server; npm install; npm run dev      # http://localhost:3001'
    Write-Host '  cd react;  npm install; npm run dev      # http://localhost:5173'
    if (-not $WriteEnv) {
        Write-Host ''
        Write-Host 'Remember to copy server\.env.example to server\.env and set the connection string,' -ForegroundColor Yellow
        Write-Host 'or re-run this script with -WriteEnv to generate it.' -ForegroundColor Yellow
    }
    Write-Host ''
}
catch {
    Write-Host ''
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
