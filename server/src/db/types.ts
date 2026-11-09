export type DbProvider = 'postgres' | 'sqlserver';

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'in'
  | 'contains';

export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface OrderTerm {
  column: string;
  ascending?: boolean;
}

export interface SelectOptions {
  columns?: string[];
  filters?: Filter[];
  order?: OrderTerm[];
  limit?: number;
  offset?: number;
}

export type Row = Record<string, unknown>;

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
}

export interface DatabaseAdapter {
  readonly provider: DbProvider;
  readonly tables: string[];

  init(): Promise<void>;
  close(): Promise<void>;

  refreshSchema(): Promise<void>;
  hasTable(table: string): Promise<boolean>;
  describeTable(table: string): Promise<Map<string, ColumnInfo>>;

  select(table: string, options?: SelectOptions): Promise<Row[]>;
  insert(table: string, rows: Row[]): Promise<Row[]>;
  update(table: string, values: Row, filters: Filter[]): Promise<Row[]>;
  delete(table: string, filters: Filter[]): Promise<Row[]>;
  upsert(table: string, rows: Row[], conflictColumns: string[]): Promise<Row[]>;
  raw<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export class DbError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code = 'db_error',
  ) {
    super(message);
    this.name = 'DbError';
  }
}
