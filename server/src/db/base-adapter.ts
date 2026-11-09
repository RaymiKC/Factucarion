import { DbError } from './types';
import type {
  ColumnInfo,
  DatabaseAdapter,
  DbProvider,
  Filter,
  OrderTerm,
  Row,
  SelectOptions,
} from './types';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Provider agnostic SQL builder. Subclasses only supply dialect details
 * (identifier quoting, placeholders, RETURNING/OUTPUT syntax, LIMIT syntax).
 */
export abstract class BaseAdapter implements DatabaseAdapter {
  abstract readonly provider: DbProvider;

  protected tableCache: string[] = [];
  private columnCache = new Map<string, Map<string, ColumnInfo>>();

  get tables(): string[] {
    return this.tableCache;
  }

  abstract init(): Promise<void>;
  abstract close(): Promise<void>;
  abstract raw<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;

  protected abstract execute<R = Row>(sql: string, params: unknown[]): Promise<R[]>;
  protected abstract quoteIdent(identifier: string): string;
  protected abstract paramRef(index: number): string;
  protected abstract loadTables(): Promise<string[]>;
  protected abstract loadColumns(table: string): Promise<Map<string, ColumnInfo>>;

  protected abstract buildInsertSql(
    target: string,
    columns: string[],
    valuesSql: string,
  ): string;
  protected abstract buildUpdateSql(target: string, setSql: string, whereSql: string): string;
  protected abstract buildDeleteSql(target: string, whereSql: string): string;
  protected abstract pagination(limit?: number, offset?: number, hasOrder?: boolean): string;

  protected abstract booleanLiteral(value: boolean): string;
  protected abstract ilikeExpr(columnSql: string, ref: string): string;
  protected abstract containsExpr(columnSql: string, ref: string, value: unknown): string;

  /** IN (...) is expanded for every provider so parameter types stay implicit. */
  protected inExpr(columnSql: string, value: unknown, params: unknown[]): string {
    const values = Array.isArray(value) ? value : [value];
    if (!values.length) return '1 = 0';
    const refs = values.map(item => {
      params.push(this.normalizeRowValue(item));
      return this.paramRef(params.length - 1);
    });
    return `${columnSql} IN (${refs.join(', ')})`;
  }

  protected normalizeRowValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value;
    if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  // ── schema ────────────────────────────────────────────────────────────────

  async refreshSchema(): Promise<void> {
    this.tableCache = await this.loadTables();
    this.columnCache.clear();
  }

  async hasTable(table: string): Promise<boolean> {
    if (!this.tableCache.length) await this.refreshSchema();
    return this.tableCache.includes(table);
  }

  async describeTable(table: string): Promise<Map<string, ColumnInfo>> {
    const cached = this.columnCache.get(table);
    if (cached) return cached;
    const columns = await this.loadColumns(table);
    if (!columns.size && !(await this.hasTable(table))) {
      throw new DbError(`Unknown table: ${table}`, 404, 'unknown_table');
    }
    this.columnCache.set(table, columns);
    return columns;
  }

  protected quoteTable(name: string): string {
    if (!IDENTIFIER.test(name)) {
      throw new DbError(`Invalid table name: ${name}`, 400, 'invalid_identifier');
    }
    if (this.tableCache.length && !this.tableCache.includes(name)) {
      throw new DbError(`Unknown table: ${name}`, 404, 'unknown_table');
    }
    return this.quoteIdent(name);
  }

  protected quoteColumn(name: string): string {
    if (!IDENTIFIER.test(name)) {
      throw new DbError(`Invalid column name: ${name}`, 400, 'invalid_identifier');
    }
    return this.quoteIdent(name);
  }

  protected async assertColumns(table: string, rows: Row[]): Promise<void> {
    const known = await this.describeTable(table);
    if (!known.size) return;
    for (const row of rows) {
      for (const column of Object.keys(row)) {
        if (!known.has(column)) {
          throw new DbError(`Unknown column "${column}" on table "${table}"`, 400, 'unknown_column');
        }
      }
    }
  }

  // ── queries ───────────────────────────────────────────────────────────────

  async select(table: string, options: SelectOptions = {}): Promise<Row[]> {
    const target = this.quoteTable(table);
    const columns = await this.resolveColumns(table, options.columns);
    const params: unknown[] = [];

    let sql = `SELECT ${columns} FROM ${target}`;
    sql += this.buildWhere(options.filters, params);

    const hasOrder = Boolean(options.order && options.order.length);
    if (hasOrder) sql += this.buildOrder(options.order as OrderTerm[]);
    sql += this.pagination(options.limit, options.offset, hasOrder);

    return this.execute(sql, params);
  }

  async insert(table: string, rows: Row[]): Promise<Row[]> {
    if (!rows.length) return [];
    await this.assertColumns(table, rows);

    const target = this.quoteTable(table);
    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    if (!columns.length) throw new DbError('Insert requires at least one column', 400);

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

    const sql = this.buildInsertSql(target, columns.map(c => this.quoteColumn(c)), valuesSql);
    return this.execute(sql, params);
  }

  async update(table: string, values: Row, filters: Filter[]): Promise<Row[]> {
    if (!filters.length) {
      throw new DbError('Update requires at least one filter', 400, 'unfiltered_write');
    }
    const entries = Object.entries(values);
    if (!entries.length) return [];

    await this.assertColumns(table, [values]);
    const target = this.quoteTable(table);
    const params: unknown[] = [];

    const setSql = entries
      .map(([column, value]) => {
        params.push(this.normalizeRowValue(value));
        return `${this.quoteColumn(column)} = ${this.paramRef(params.length - 1)}`;
      })
      .join(', ');

    const whereSql = this.buildWhere(filters, params);
    return this.execute(this.buildUpdateSql(target, setSql, whereSql), params);
  }

  async delete(table: string, filters: Filter[]): Promise<Row[]> {
    if (!filters.length) {
      throw new DbError('Delete requires at least one filter', 400, 'unfiltered_write');
    }
    const target = this.quoteTable(table);
    const params: unknown[] = [];
    const whereSql = this.buildWhere(filters, params);
    return this.execute(this.buildDeleteSql(target, whereSql), params);
  }

  /** Provider-neutral upsert: update by conflict columns, insert when nothing matched. */
  async upsert(table: string, rows: Row[], conflictColumns: string[]): Promise<Row[]> {
    const results: Row[] = [];
    for (const row of rows) {
      const filters: Filter[] = conflictColumns.map(column => ({
        column,
        op: 'eq',
        value: row[column],
      }));
      const existing = await this.select(table, { columns: ['*'], filters, limit: 1 });
      if (existing.length) {
        results.push(...(await this.update(table, row, filters)));
      } else {
        results.push(...(await this.insert(table, [row])));
      }
    }
    return results;
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async resolveColumns(table: string, columns?: string[]): Promise<string> {
    if (!columns || !columns.length || columns.includes('*')) return '*';
    return [...new Set(columns)].map(column => this.quoteColumn(column)).join(', ');
  }

  private buildOrder(order: OrderTerm[]): string {
    const terms = order.map(term => {
      const direction = term.ascending === false ? 'DESC' : 'ASC';
      return `${this.quoteColumn(term.column)} ${direction}`;
    });
    return ` ORDER BY ${terms.join(', ')}`;
  }

  protected buildWhere(filters: Filter[] | undefined, params: unknown[]): string {
    if (!filters || !filters.length) return '';
    const conditions = filters.map(filter => this.buildFilter(filter, params));
    return ` WHERE ${conditions.join(' AND ')}`;
  }

  private buildFilter(filter: Filter, params: unknown[]): string {
    const columnSql = this.quoteColumn(filter.column);
    const push = (value: unknown): string => {
      params.push(value instanceof Date ? value : this.normalizeRowValue(value));
      return this.paramRef(params.length - 1);
    };

    switch (filter.op) {
      case 'eq':
        return `${columnSql} = ${push(filter.value)}`;
      case 'neq':
        return `${columnSql} <> ${push(filter.value)}`;
      case 'gt':
        return `${columnSql} > ${push(filter.value)}`;
      case 'gte':
        return `${columnSql} >= ${push(filter.value)}`;
      case 'lt':
        return `${columnSql} < ${push(filter.value)}`;
      case 'lte':
        return `${columnSql} <= ${push(filter.value)}`;
      case 'like':
        return `${columnSql} LIKE ${push(filter.value)}`;
      case 'ilike':
        return this.ilikeExpr(columnSql, push(filter.value));
      case 'in':
        return this.inExpr(columnSql, filter.value, params);
      case 'is': {
        if (filter.value === null || filter.value === undefined) return `${columnSql} IS NULL`;
        if (typeof filter.value === 'boolean') {
          return `${columnSql} = ${this.booleanLiteral(filter.value)}`;
        }
        return `${columnSql} = ${push(filter.value)}`;
      }
      case 'contains': {
        if (filter.value === null || filter.value === undefined) {
          return `${columnSql} IS NULL`;
        }
        return this.containsExpr(columnSql, push(filter.value), filter.value);
      }
      default:
        throw new DbError(`Unsupported filter operator: ${String(filter.op)}`, 400);
    }
  }
}
