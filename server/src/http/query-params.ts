import { ApiError } from './errors';
import type { Filter, FilterOp, OrderTerm, SelectOptions } from '../db/types';

const OPS: FilterOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains'];

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset']);

function coerce(value: string): unknown {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export function parseFilters(raw: unknown): Filter[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw ApiError.badRequest('"filters" must be an array');
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw ApiError.badRequest(`Invalid filter at index ${index}`);
    }
    const { column, op = 'eq', value } = item as Record<string, unknown>;
    if (typeof column !== 'string' || !column) {
      throw ApiError.badRequest(`Filter ${index} is missing "column"`);
    }
    if (typeof op !== 'string' || !OPS.includes(op as FilterOp)) {
      throw ApiError.badRequest(`Filter ${index} has an unsupported operator "${String(op)}"`);
    }
    return { column, op: op as FilterOp, value: value as unknown };
  });
}

export function parseOrder(raw: unknown): OrderTerm[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) {
    const terms: OrderTerm[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const { column, ascending } = item as Record<string, unknown>;
      if (typeof column !== 'string' || !column) continue;
      terms.push({ column, ascending: ascending !== false });
    }
    return terms;
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [column, direction] = part.split('.');
        return { column, ascending: (direction ?? 'asc').toLowerCase() !== 'desc' };
      });
  }
  throw ApiError.badRequest('"order" must be a string or an array');
}

export function parseLimit(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw ApiError.badRequest(`Invalid limit "${String(value)}"`);
  }
  return Math.trunc(parsed);
}

function parseFilterValue(column: string, expression: string): Filter {
  const dot = expression.indexOf('.');
  if (dot === -1) return { column, op: 'eq', value: expression };

  const op = expression.slice(0, dot) as FilterOp;
  const raw = expression.slice(dot + 1);
  if (!OPS.includes(op)) {
    throw ApiError.badRequest(`Unsupported operator "${op}" for column "${column}"`);
  }

  if (op === 'in') {
    const trimmed = raw.replace(/^\(/, '').replace(/\)$/, '');
    return {
      column,
      op,
      value: trimmed
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(coerce),
    };
  }

  return { column, op, value: coerce(raw) };
}

/** PostgREST style filters from the query string: `?company_id=eq.<uuid>&name=ilike.%25acme%25` */
export function parseQueryStringOptions(query: Record<string, unknown>): SelectOptions {
  const filters: Filter[] = [];
  let order: OrderTerm[] = [];
  let limit: number | undefined;
  let offset: number | undefined;
  let columns: string[] | undefined;

  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    const value = Array.isArray(raw) ? String(raw[0]) : String(raw);

    if (key === 'select') {
      columns = value
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
      continue;
    }
    if (key === 'order') {
      order = parseOrder(value);
      continue;
    }
    if (key === 'limit') {
      limit = parseLimit(value);
      continue;
    }
    if (key === 'offset') {
      offset = parseLimit(value);
      continue;
    }
    if (RESERVED_PARAMS.has(key)) continue;

    if (value.includes('.')) {
      filters.push(parseFilterValue(key, value));
    } else {
      filters.push({ column: key, op: 'eq', value: coerce(value) });
    }
  }

  return { filters, order, limit, offset, columns };
}
