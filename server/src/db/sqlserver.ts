import type * as MssqlTypes from 'mssql';
import { config } from '../config';
import { BaseAdapter } from './base-adapter';
import { DbError } from './types';
import type { ColumnInfo, DbProvider, Row } from './types';

type Mssql = typeof MssqlTypes;

const tediousDriver = require('mssql') as Mssql;

const UUID_PATTERN = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

/** Columns declared as DATE (not DATETIME) that must stay date-only in the API payload. */
const DATE_ONLY_COLUMNS = new Set([
  'date',
  'issue_date',
  'due_date',
  'payment_date',
  'recurrence_end',
]);

function toDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * SQL Server returns UNIQUEIDENTIFIER values in upper case and DATE columns as
 * JS Dates. Normalise both so the payload matches PostgreSQL byte for byte.
 */
function normalizeValue(key: string, value: unknown): unknown {
  if (typeof value === 'string' && UUID_PATTERN.test(value)) return value.toLowerCase();
  if (value instanceof Date) {
    return DATE_ONLY_COLUMNS.has(key) ? toDateOnly(value) : value;
  }
  if (Array.isArray(value)) return value.map(entry => normalizeValue(key, entry));
  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [childKey, entry] of Object.entries(value)) {
      normalized[childKey] = normalizeValue(childKey, entry);
    }
    return normalized;
  }
  return value;
}

function normalizeRow(row: Record<string, unknown>): Row {
  const normalized: Row = {};
  for (const [key, value] of Object.entries(row)) normalized[key] = normalizeValue(key, value);
  return normalized;
}

export class SqlServerAdapter extends BaseAdapter {
  readonly provider: DbProvider = 'sqlserver';

  private driver: Mssql = tediousDriver;
  private pool: MssqlTypes.ConnectionPool | null = null;
  private readonly schema = 'dbo';

  async init(): Promise<void> {
    this.driver = this.resolveDriver();
    this.pool = new this.driver.ConnectionPool(this.buildConfig());

    this.pool.on('error', error => {
      console.error('[db:sqlserver] pool error', error.message);
    });

    await this.pool.connect();
    await this.refreshSchema();
  }

  async close(): Promise<void> {
    await this.pool?.close();
    this.pool = null;
  }

  /** Windows auth is only supported by the ODBC based driver (`mssql/msnodesqlv8`). */
  private resolveDriver(): Mssql {
    if (!config.sqlserver.trustedConnection) return tediousDriver;
    try {
      return require('mssql/msnodesqlv8') as Mssql;
    } catch {
      throw new DbError(
        'Windows authentication requires the "msnodesqlv8" package. Run "npm install msnodesqlv8" in server/, or set MSSQL_USER/MSSQL_PASSWORD to use SQL authentication.',
        500,
        'driver_missing',
      );
    }
  }

  private buildConfig(): MssqlTypes.config {
    const settings = config.sqlserver;

    if (settings.trustedConnection) {
      return {
        server: settings.server,
        port: settings.port,
        database: settings.database,
        options: {
          trustedConnection: true,
          trustServerCertificate: true,
          encrypt: settings.encrypt,
          enableArithAbort: true,
          useUTC: true,
        },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
      } as unknown as MssqlTypes.config;
    }

    const base = settings.connectionString
      ? (
          tediousDriver as unknown as { parseConnectionString: (value: string) => MssqlTypes.config }
        ).parseConnectionString(settings.connectionString)
      : (() => {
          const parsed: MssqlTypes.config = {
            server: settings.server,
            port: settings.port,
            database: settings.database,
            options: {
              encrypt: settings.encrypt,
              trustServerCertificate: settings.trustServerCertificate,
              enableArithAbort: true,
            },
          };
          parsed.user = settings.user || undefined;
          parsed.password = settings.password || undefined;
          if (settings.domain) parsed.domain = settings.domain;
          return parsed;
        })();

    base.pool = { max: 10, min: 0, idleTimeoutMillis: 30_000, ...base.pool };
    base.options = { ...base.options, enableArithAbort: true, useUTC: true, appName: 'FacturaPro API' };

    return base;
  }

  private get connection(): MssqlTypes.ConnectionPool {
    if (!this.pool) throw new DbError('SQL Server pool is not initialised', 503);
    return this.pool;
  }

  protected async execute<R = Row>(sqlText: string, params: unknown[]): Promise<R[]> {
    if (process.env.API_DEBUG_SQL === 'true') {
      console.log('[sqlserver]', sqlText, JSON.stringify(params));
    }
    const request = this.connection.request();
    params.forEach((value, index) => {
      const name = `fp${index}`;
      if (value === null || value === undefined) {
        request.input(name, this.driver.NVarChar, null);
      } else {
        request.input(name, value as never);
      }
    });
    const result = await request.query(sqlText);
    return (result.recordset ?? []).map(row => normalizeRow(row)) as R[];
  }

  async raw<T = Row>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    return this.execute<T>(sqlText, params);
  }

  protected quoteIdent(identifier: string): string {
    return `[${identifier}]`;
  }

  protected quoteTable(name: string): string {
    return `${this.quoteIdent(this.schema)}.${super.quoteTable(name)}`;
  }

  protected paramRef(index: number): string {
    return `@fp${index}`;
  }

  protected async loadTables(): Promise<string[]> {
    const rows = await this.raw<{ name: string }>('SELECT name FROM sys.tables ORDER BY name');
    return rows.map(row => row.name);
  }

  protected async loadColumns(table: string): Promise<Map<string, ColumnInfo>> {
    const rows = await this.raw<{
      name: string;
      data_type: string;
      is_nullable: boolean;
    }>(
      `SELECT c.name AS name, t.name AS data_type, c.is_nullable AS is_nullable
         FROM sys.columns c
         JOIN sys.types t ON c.user_type_id = t.user_type_id
        WHERE c.object_id = OBJECT_ID(@fp0)
        ORDER BY c.column_id`,
      [`${this.schema}.${table}`],
    );
    return new Map(
      rows.map(row => [
        row.name,
        { name: row.name, dataType: row.data_type, nullable: Boolean(row.is_nullable) },
      ]),
    );
  }

  protected buildInsertSql(target: string, columns: string[], valuesSql: string): string {
    return `INSERT INTO ${target} (${columns.join(', ')}) OUTPUT INSERTED.* VALUES ${valuesSql}`;
  }

  protected buildUpdateSql(target: string, setSql: string, whereSql: string): string {
    return `UPDATE ${target} SET ${setSql} OUTPUT INSERTED.*${whereSql}`;
  }

  protected buildDeleteSql(target: string, whereSql: string): string {
    return `DELETE FROM ${target} OUTPUT DELETED.*${whereSql}`;
  }

  protected pagination(limit?: number, offset?: number, hasOrder?: boolean): string {
    if (limit === undefined && offset === undefined) return '';
    let sqlText = hasOrder ? '' : ' ORDER BY (SELECT NULL)';
    sqlText += ` OFFSET ${Math.max(0, Math.trunc(offset ?? 0))} ROWS`;
    if (limit !== undefined && Number.isFinite(limit)) {
      sqlText += ` FETCH NEXT ${Math.max(0, Math.trunc(limit))} ROWS ONLY`;
    }
    return sqlText;
  }

  protected booleanLiteral(value: boolean): string {
    return value ? '1' : '0';
  }

  protected ilikeExpr(columnSql: string, ref: string): string {
    return `LOWER(${columnSql}) LIKE LOWER(${ref})`;
  }

  protected containsExpr(columnSql: string, ref: string, _value: unknown): string {
    return `${columnSql} LIKE '%' + ${ref} + '%'`;
  }
}
