import { config } from '../config';
import { PostgresAdapter } from './postgres';
import { SqlServerAdapter } from './sqlserver';
import type { DatabaseAdapter } from './types';

let adapter: DatabaseAdapter | null = null;

export function createAdapter(): DatabaseAdapter {
  return config.provider === 'sqlserver' ? new SqlServerAdapter() : new PostgresAdapter();
}

export async function getAdapter(): Promise<DatabaseAdapter> {
  if (!adapter) {
    adapter = createAdapter();
    await adapter.init();
  }
  return adapter;
}

export async function closeAdapter(): Promise<void> {
  if (!adapter) return;
  await adapter.close();
  adapter = null;
}

export type { DatabaseAdapter } from './types';
export * from './types';
