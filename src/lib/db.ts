/*
  Database connection abstraction layer.

  Supports three backends selected via VITE_DB_PROVIDER env var:
    "supabase"   – Supabase REST/realtime (default, zero-config)
    "postgres"   – Direct PostgreSQL via connection string
    "sqlserver"  – SQL Server via connection string

  For "postgres" and "sqlserver" backends the app proxies all queries
  through a /api/db Edge Function or a local Express proxy so that
  credentials never reach the browser.

  Set in .env:
    VITE_DB_PROVIDER=supabase | postgres | sqlserver
    VITE_DB_CONNECTION_STRING=<connection string>   (postgres / sqlserver)
    VITE_DB_API_BASE=http://localhost:3001           (proxy base URL)
*/

export type DbProvider = 'supabase' | 'postgres' | 'sqlserver';

export const DB_PROVIDER: DbProvider =
  (import.meta.env.VITE_DB_PROVIDER as DbProvider) ?? 'supabase';

export const DB_CONNECTION_STRING: string =
  import.meta.env.VITE_DB_CONNECTION_STRING ?? '';

export const DB_API_BASE: string =
  import.meta.env.VITE_DB_API_BASE ?? '';

export function isSupabase() { return DB_PROVIDER === 'supabase'; }
export function isPostgres() { return DB_PROVIDER === 'postgres'; }
export function isSqlServer() { return DB_PROVIDER === 'sqlserver'; }

// ---------------------------------------------------------------------------
// Generic query helper for Postgres / SQL Server backends.
// Sends queries to the server-side proxy; never exposes credentials to client.
// ---------------------------------------------------------------------------
export interface QueryResult<T = Record<string, unknown>> {
  data: T[] | null;
  error: string | null;
}

export async function proxyQuery<T = Record<string, unknown>>(
  table: string,
  params: {
    select?: string;
    filters?: Record<string, unknown>;
    order?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<QueryResult<T>> {
  if (!DB_API_BASE) {
    console.warn('[FacturaPro] VITE_DB_API_BASE is not set. Cannot query via proxy.');
    return { data: null, error: 'DB_API_BASE not configured' };
  }

  try {
    const res = await fetch(`${DB_API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ...params }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: text };
    }

    const json = await res.json();
    return { data: json.data ?? json, error: null };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}

export async function proxyMutate<T = Record<string, unknown>>(opts: {
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data?: Record<string, unknown>;
  filters?: Record<string, unknown>;
}): Promise<QueryResult<T>> {
  if (!DB_API_BASE) {
    return { data: null, error: 'DB_API_BASE not configured' };
  }

  try {
    const res = await fetch(`${DB_API_BASE}/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });

    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: text };
    }

    const json = await res.json();
    return { data: json.data ?? json, error: null };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}
