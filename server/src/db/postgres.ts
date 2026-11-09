import { Pool, types } from 'pg';
import type { PoolClient } from 'pg';
import { config } from '../config';
import { BaseAdapter } from './base-adapter';
import { DbError } from './types';
import type { ColumnInfo, DbProvider, Row } from './types';

// DATE columns are returned as plain `YYYY-MM-DD` strings (not JS Dates) and NUMERIC
// columns as JS numbers, so the API payload matches what the UI expects.
types.setTypeParser(1082, value => value);
types.setTypeParser(1700, value => (value === null ? null : Number(value)));

export class PostgresAdapter extends BaseAdapter {
  readonly provider: DbProvider = 'postgres';

  private pool: Pool | null = null;

  async init(): Promise<void> {
    this.pool = new Pool({
      connectionString: config.postgres.connectionString,
      ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
    this.pool.on('error', error => {
      console.error('[db:postgres] idle client error', error.message);
    });
    await this.refreshSchema();
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private get client(): Pool | PoolClient {
    if (!this.pool) throw new DbError('PostgreSQL pool is not initialised', 503);
    return this.pool;
  }

  protected async execute<R = Row>(sql: string, params: unknown[]): Promise<R[]> {
    const result = await this.client.query(sql, params);
    return result.rows as R[];
  }

  async raw<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.client.query(sql, params);
    return result.rows as T[];
  }

  protected quoteIdent(identifier: string): string {
    return `"${identifier}"`;
  }

  protected paramRef(index: number): string {
    return `$${index + 1}`;
  }

  protected async loadTables(): Promise<string[]> {
    const rows = await this.raw<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    );
    return rows.map(row => row.table_name);
  }

  protected async loadColumns(table: string): Promise<Map<string, ColumnInfo>> {
    const rows = await this.raw<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
      [table],
    );
    return new Map(
      rows.map(row => [
        row.column_name,
        { name: row.column_name, dataType: row.data_type, nullable: row.is_nullable === 'YES' },
      ]),
    );
  }

  protected buildInsertSql(target: string, columns: string[], valuesSql: string): string {
    return `INSERT INTO ${target} (${columns.join(', ')}) VALUES ${valuesSql} RETURNING *`;
  }

  protected buildUpdateSql(target: string, setSql: string, whereSql: string): string {
    return `UPDATE ${target} SET ${setSql}${whereSql} RETURNING *`;
  }

  protected buildDeleteSql(target: string, whereSql: string): string {
    return `DELETE FROM ${target}${whereSql} RETURNING *`;
  }

  protected pagination(limit?: number, offset?: number, _hasOrder?: boolean): string {
    let sql = '';
    if (typeof limit === 'number' && Number.isFinite(limit)) sql += ` LIMIT ${Math.max(0, Math.trunc(limit))}`;
    if (typeof offset === 'number' && Number.isFinite(offset)) sql += ` OFFSET ${Math.max(0, Math.trunc(offset))}`;
    return sql;
  }

  protected booleanLiteral(value: boolean): string {
    return value ? 'TRUE' : 'FALSE';
  }

  protected ilikeExpr(columnSql: string, ref: string): string {
    return `${columnSql} ILIKE ${ref}`;
  }

  protected containsExpr(columnSql: string, ref: string, value: unknown): string {
    const isJson = value !== null && typeof value === 'object';
    return isJson ? `${columnSql} @> ${ref}::jsonb` : `${columnSql} @> ${ref}`;
  }

  /** Native ON CONFLICT keeps the conflict handling atomic. */
  override async upsert(table: string, rows: Row[], conflictColumns: string[]): Promise<Row[]> {
    if (!rows.length) return [];
    await this.assertColumns(table, rows);

    const target = this.quoteTable(table);
    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const params: unknown[] = [];

    const valuesSql = rows
      .map(row => {
        const refs = columns.map(column => {
          params.push(this.normalizeRowValue(row[column]));
          return this.paramRef(params.length - 1);
        });
        return `(${refs.join(', ')})`;
      })
      .join(', ');

    const conflictTarget = conflictColumns.map(column => this.quoteColumn(column)).join(', ');
    const updates = columns
      .filter(column => !conflictColumns.includes(column))
      .map(column => `${this.quoteColumn(column)} = EXCLUDED.${this.quoteColumn(column)}`);

    const conflictAction = updates.length ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';
    const sql =
      `INSERT INTO ${target} (${columns.map(column => this.quoteColumn(column)).join(', ')}) ` +
      `VALUES ${valuesSql} ON CONFLICT (${conflictTarget}) ${conflictAction} RETURNING *`;

    return this.execute(sql, params);
  }
}
