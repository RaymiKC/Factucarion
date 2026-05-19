import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type DbProvider = 'supabase' | 'postgres' | 'sqlserver';

export interface QueryResult<T = Record<string, unknown>> {
  data: T[] | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class DbService {
  readonly provider: DbProvider = environment.dbProvider as DbProvider;

  isSupabase(): boolean { return this.provider === 'supabase'; }
  isPostgres(): boolean { return this.provider === 'postgres'; }
  isSqlServer(): boolean { return this.provider === 'sqlserver'; }

  async proxyQuery<T = Record<string, unknown>>(
    table: string,
    params: {
      select?: string;
      filters?: Record<string, unknown>;
      order?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<QueryResult<T>> {
    const base = environment.dbApiBase;
    if (!base) {
      console.warn('[FacturaPro] dbApiBase is not set. Cannot query via proxy.');
      return { data: null, error: 'dbApiBase not configured' };
    }

    try {
      const res = await fetch(`${base}/query`, {
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

  async proxyMutate<T = Record<string, unknown>>(opts: {
    operation: 'insert' | 'update' | 'delete';
    table: string;
    data?: Record<string, unknown>;
    filters?: Record<string, unknown>;
  }): Promise<QueryResult<T>> {
    const base = environment.dbApiBase;
    if (!base) {
      return { data: null, error: 'dbApiBase not configured' };
    }

    try {
      const res = await fetch(`${base}/mutate`, {
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
}
