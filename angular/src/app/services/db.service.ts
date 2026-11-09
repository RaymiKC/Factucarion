/*
  Owned database client for the Angular app.
  Talks to the self-hosted API in /server, which talks to PostgreSQL or SQL Server.

  Usage mirrors the previous client shape:
    this.db.client.from('clients').select('*').eq('company_id', id).order('name')
*/

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export const API_BASE = (environment.apiBase ?? 'http://localhost:3001').replace(/\/+$/, '');

const TOKEN_KEY = 'facturapro_token';

export interface DbErrorInfo {
  message: string;
  code?: string;
  status?: number;
}

export interface DbResponse<T = any> {
  data: T | null;
  error: DbErrorInfo | null;
}

export type FilterOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike' | 'is' | 'in' | 'contains';

export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface OrderTerm {
  column: string;
  ascending: boolean;
}

export type Row = Record<string, any>;

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── token handling ──────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function authHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toErrorInfo(error: unknown): DbErrorInfo {
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

export async function apiFetch<T = any>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<{ data: T | null; error: DbErrorInfo | null }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token !== undefined) {
      if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
    } else {
      Object.assign(headers, authHeader());
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'POST',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as Record<string, any>) : null;

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: String(payload?.['error'] ?? response.statusText ?? 'Request failed'),
          code: payload?.['code'] as string | undefined,
          status: response.status,
        },
      };
    }

    return { data: (payload?.['data'] ?? payload) as T, error: null };
  } catch (error) {
    return { data: null, error: toErrorInfo(error) };
  }
}

// ── embedded relation support (`*, client:clients(*)`) ──────────────────────

interface RelationSpec {
  alias: string;
  table: string;
  spec: string;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts.map(part => part.trim()).filter(Boolean);
}

function parseSelectSpec(spec: string): { columns: '*' | string[]; relations: RelationSpec[] } {
  const columns: string[] = [];
  const relations: RelationSpec[] = [];

  for (const part of splitTopLevel(spec)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*):([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)$/.exec(part);
    if (match) relations.push({ alias: match[1], table: match[2], spec: match[3] });
    else columns.push(part);
  }

  if (!columns.length || columns.includes('*')) return { columns: '*', relations };
  return { columns, relations };
}

function singular(name: string): string {
  if (name.endsWith('ies')) return `${name.slice(0, -3)}y`;
  if (name.endsWith('ses')) return name.slice(0, -2);
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
}

function project(child: Row, columns: '*' | string[], nestedAliases: string[]): Row {
  if (columns === '*') return child;
  const picked: Row = {};
  for (const column of columns) if (column in child) picked[column] = child[column];
  for (const alias of nestedAliases) if (alias in child) picked[alias] = child[alias];
  return picked;
}

async function attachRelations(rows: Row[], baseTable: string, relations: RelationSpec[]): Promise<void> {
  if (!rows.length) return;
  const parentKeys = new Set(Object.keys(rows[0]));

  for (const relation of relations) {
    const parsed = parseSelectSpec(relation.spec);
    const nestedAliases = parsed.relations.map(nested => nested.alias);
    const parentFk = `${relation.alias}_id`;

    if (parentKeys.has(parentFk)) {
      const ids = [...new Set(
        rows.map(row => row[parentFk]).filter((value): value is string => typeof value === 'string' && !!value),
      )];

      if (!ids.length) {
        rows.forEach(row => { row[relation.alias] = null; });
        continue;
      }

      const { data: children } = await apiFetch<Row[]>(`/api/db/${relation.table}/select`, {
        body: { columns: ['*'], filters: [{ column: 'id', op: 'in', value: ids }] },
      });
      const childRows = children ?? [];
      if (parsed.relations.length && childRows.length) {
        await attachRelations(childRows, relation.table, parsed.relations);
      }

      const byId = new Map(childRows.map(child => [String(child['id']), child]));
      rows.forEach(row => {
        const child = byId.get(String(row[parentFk]));
        row[relation.alias] = child ? project(child, parsed.columns, nestedAliases) : null;
      });
      continue;
    }

    const parentIds = [...new Set(
      rows.map(row => row['id']).filter((value): value is string => typeof value === 'string'),
    )];

    if (!parentIds.length) {
      rows.forEach(row => { row[relation.alias] = []; });
      continue;
    }

    const candidates = [...new Set([`${singular(baseTable)}_id`, `${baseTable}_id`])];
    let childRows: Row[] = [];
    let childFk = candidates[0];

    for (const candidate of candidates) {
      const { data, error } = await apiFetch<Row[]>(`/api/db/${relation.table}/select`, {
        body: { columns: ['*'], filters: [{ column: candidate, op: 'in', value: parentIds }] },
      });
      if (!error) {
        childRows = data ?? [];
        childFk = candidate;
        break;
      }
    }

    if (parsed.relations.length && childRows.length) {
      await attachRelations(childRows, relation.table, parsed.relations);
    }

    const grouped = new Map<string, Row[]>();
    for (const child of childRows) {
      const key = String(child[childFk]);
      const list = grouped.get(key) ?? [];
      list.push(project(child, parsed.columns, nestedAliases));
      grouped.set(key, list);
    }

    rows.forEach(row => { row[relation.alias] = grouped.get(String(row['id'])) ?? []; });
  }
}

// ── query builder ───────────────────────────────────────────────────────────

type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type ResultMode = 'many' | 'single' | 'maybeSingle';

export class QueryBuilder<T = any> implements PromiseLike<DbResponse<T>> {
  private operation: Operation = 'select';
  private payload: Row | Row[] | null = null;
  private conflictColumns: string[] = [];
  private filters: Filter[] = [];
  private orders: OrderTerm[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectSpec = '*';
  private resultMode: ResultMode = 'many';

  constructor(private readonly table: string) {}

  select(spec = '*'): this { this.selectSpec = spec; return this; }

  insert(values: Row | Row[]): this { this.operation = 'insert'; this.payload = values; return this; }

  update(values: Row): this { this.operation = 'update'; this.payload = values; return this; }

  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this.operation = 'upsert';
    this.payload = values;
    this.conflictColumns = (options?.onConflict ?? 'id').split(',').map(column => column.trim()).filter(Boolean);
    return this;
  }

  delete(): this { this.operation = 'delete'; return this; }

  eq(column: string, value: unknown): this { return this.addFilter(column, 'eq', value); }
  neq(column: string, value: unknown): this { return this.addFilter(column, 'neq', value); }
  gt(column: string, value: unknown): this { return this.addFilter(column, 'gt', value); }
  gte(column: string, value: unknown): this { return this.addFilter(column, 'gte', value); }
  lt(column: string, value: unknown): this { return this.addFilter(column, 'lt', value); }
  lte(column: string, value: unknown): this { return this.addFilter(column, 'lte', value); }
  like(column: string, value: unknown): this { return this.addFilter(column, 'like', value); }
  ilike(column: string, value: unknown): this { return this.addFilter(column, 'ilike', value); }
  is(column: string, value: unknown): this { return this.addFilter(column, 'is', value); }
  in(column: string, values: unknown[]): this { return this.addFilter(column, 'in', values); }
  contains(column: string, value: unknown): this { return this.addFilter(column, 'contains', value); }
  filter(column: string, op: FilterOp, value: unknown): this { return this.addFilter(column, op, value); }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this { this.limitValue = count; return this; }

  range(from: number, to: number): this { this.offsetValue = from; this.limitValue = to - from + 1; return this; }

  single(): this { this.resultMode = 'single'; return this; }

  maybeSingle(): this { this.resultMode = 'maybeSingle'; return this; }

  then<R1 = DbResponse<T>, R2 = never>(
    onFulfilled?: ((value: DbResponse<T>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }

  private addFilter(column: string, op: FilterOp, value: unknown): this {
    this.filters.push({ column, op, value });
    return this;
  }

  private shape(rows: Row[]): DbResponse<T> {
    if (this.resultMode === 'single') {
      if (!rows.length) return { data: null, error: { message: 'No rows returned', code: 'no_rows' } };
      return { data: rows[0] as T, error: null };
    }
    if (this.resultMode === 'maybeSingle') return { data: (rows[0] as T) ?? null, error: null };
    return { data: rows as unknown as T, error: null };
  }

  private async execute(): Promise<DbResponse<T>> {
    const parsed = parseSelectSpec(this.selectSpec);
    const columns = parsed.columns === '*' ? ['*'] : parsed.columns;
    const path = `/api/db/${this.table}`;

    if (this.operation === 'select') {
      const { data, error } = await apiFetch<Row[]>(`${path}/select`, {
        body: { columns, filters: this.filters, order: this.orders, limit: this.limitValue, offset: this.offsetValue },
      });
      if (error) return { data: null, error };
      const rows = (data ?? []) as Row[];
      if (parsed.relations.length) await attachRelations(rows, this.table, parsed.relations);
      return this.shape(rows);
    }

    if (this.operation === 'insert') {
      const { data, error } = await apiFetch<Row[]>(`${path}/insert`, { body: { rows: this.payload } });
      if (error) return { data: null, error };
      const rows = (data ?? []) as Row[];
      if (parsed.relations.length) await attachRelations(rows, this.table, parsed.relations);
      return this.shape(rows);
    }

    if (this.operation === 'update') {
      const { data, error } = await apiFetch<Row[]>(`${path}/update`, {
        body: { values: this.payload, filters: this.filters },
      });
      if (error) return { data: null, error };
      const rows = (data ?? []) as Row[];
      if (parsed.relations.length) await attachRelations(rows, this.table, parsed.relations);
      return this.shape(rows);
    }

    if (this.operation === 'upsert') {
      const { data, error } = await apiFetch<Row[]>(`${path}/upsert`, {
        body: { rows: this.payload, onConflict: this.conflictColumns },
      });
      if (error) return { data: null, error };
      return this.shape((data ?? []) as Row[]);
    }

    const { data, error } = await apiFetch<Row[]>(`${path}/delete`, { body: { filters: this.filters } });
    if (error) return { data: null, error };
    return this.shape((data ?? []) as Row[]);
  }
}

// ── storage (company logos) ─────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

@Injectable({ providedIn: 'root' })
export class DbService {
  readonly apiBase = API_BASE;

  readonly client = {
    from: <T = any>(table: string) => new QueryBuilder<T>(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (filePath: string, file: File) => {
          try {
            const dataBase64 = await fileToBase64(file);
            const response = await fetch(
              `${API_BASE}/api/storage/${encodeURIComponent(bucket)}?path=${encodeURIComponent(filePath)}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({ path: filePath, contentType: file.type, dataBase64 }),
              },
            );
            const payload = await response.json().catch(() => null);
            if (!response.ok) return { data: null, error: { message: String(payload?.['error'] ?? 'Upload failed') } };
            return { data: payload, error: null };
          } catch (error) {
            return { data: null, error: toErrorInfo(error) };
          }
        },
        getPublicUrl: (filePath: string) => ({
          data: { publicUrl: `${API_BASE}/files/${bucket}/${filePath}` },
        }),
      }),
    },
  };

  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  }

  request<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<DbResponse<T>> {
    return apiFetch<T>(path, options);
  }
}
