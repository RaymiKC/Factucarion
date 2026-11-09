import { Router } from 'express';
import { getAdapter } from '../db';
import type { Row } from '../db/types';
import { asyncHandler, ApiError } from '../http/errors';
import { parseFilters, parseLimit, parseOrder, parseQueryStringOptions } from '../http/query-params';
import { prepareRow } from './row-hooks';

export const dbRouter = Router();

async function prepareRows(table: string, rows: Row[]): Promise<Row[]> {
  return Promise.all(rows.map(row => prepareRow(table, row)));
}

function asRows(raw: unknown, field = 'rows'): Row[] {
  if (Array.isArray(raw)) return raw as Row[];
  if (raw && typeof raw === 'object') return [raw as Row];
  throw ApiError.badRequest(`"${field}" must be an object or an array of objects`);
}

function asValues(raw: unknown): Row {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw ApiError.badRequest('"values" must be an object');
  }
  return raw as Row;
}

// ── structured endpoints used by the bundled client SDK ─────────────────────

dbRouter.post(
  '/:table/select',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const data = await db.select(req.params.table, {
      columns: Array.isArray(req.body?.columns) ? req.body.columns : undefined,
      filters: parseFilters(req.body?.filters),
      order: parseOrder(req.body?.order),
      limit: parseLimit(req.body?.limit),
      offset: parseLimit(req.body?.offset),
    });
    res.json({ data });
  }),
);

dbRouter.post(
  '/:table/insert',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const rows = await prepareRows(
      req.params.table,
      asRows(req.body?.rows ?? req.body?.values ?? req.body?.data),
    );
    const data = await db.insert(req.params.table, rows);
    res.status(201).json({ data });
  }),
);

dbRouter.post(
  '/:table/update',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const values = await prepareRow(
      req.params.table,
      asValues(req.body?.values ?? req.body?.data),
    );
    const filters = parseFilters(req.body?.filters);
    if (!filters.length) throw ApiError.badRequest('Update requires at least one filter');
    const data = await db.update(req.params.table, values, filters);
    res.json({ data });
  }),
);

dbRouter.post(
  '/:table/delete',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const filters = parseFilters(req.body?.filters);
    if (!filters.length) throw ApiError.badRequest('Delete requires at least one filter');
    const data = await db.delete(req.params.table, filters);
    res.json({ data });
  }),
);

dbRouter.post(
  '/:table/upsert',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const rows = asRows(req.body?.rows ?? req.body?.data);
    const onConflict = req.body?.onConflict;
    const conflictColumns = Array.isArray(onConflict)
      ? (onConflict as string[])
      : typeof onConflict === 'string'
        ? onConflict.split(',').map((part: string) => part.trim()).filter(Boolean)
        : [];
    if (!conflictColumns.length) {
      throw ApiError.badRequest('"onConflict" must list the conflict columns');
    }
    const data = await db.upsert(req.params.table, rows, conflictColumns);
    res.json({ data });
  }),
);

// ── PostgREST style read endpoint, handy for curl / external integrations ───

dbRouter.get(
  '/:table',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const options = parseQueryStringOptions(req.query as Record<string, unknown>);
    const data = await db.select(req.params.table, options);
    res.json({ data });
  }),
);

dbRouter.get(
  '/:table/:id',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const rows = await db.select(req.params.table, {
      filters: [{ column: 'id', op: 'eq', value: req.params.id }],
      limit: 1,
    });
    if (!rows.length) throw ApiError.notFound(`${req.params.table} ${req.params.id} not found`);
    res.json({ data: rows[0] });
  }),
);

dbRouter.post(
  '/:table',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const rows = await prepareRows(req.params.table, asRows(req.body?.rows ?? req.body));
    const data = await db.insert(req.params.table, rows);
    res.status(201).json({ data });
  }),
);

dbRouter.put(
  '/:table/:id',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const values = await prepareRow(
      req.params.table,
      asValues(req.body?.values ?? req.body),
    );
    const data = await db.update(req.params.table, values, [
      { column: 'id', op: 'eq', value: req.params.id },
    ]);
    if (!data.length) throw ApiError.notFound(`${req.params.table} ${req.params.id} not found`);
    res.json({ data: data[0] });
  }),
);

dbRouter.patch(
  '/:table/:id',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const values = await prepareRow(
      req.params.table,
      asValues(req.body?.values ?? req.body),
    );
    const data = await db.update(req.params.table, values, [
      { column: 'id', op: 'eq', value: req.params.id },
    ]);
    if (!data.length) throw ApiError.notFound(`${req.params.table} ${req.params.id} not found`);
    res.json({ data: data[0] });
  }),
);

dbRouter.delete(
  '/:table/:id',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const data = await db.delete(req.params.table, [
      { column: 'id', op: 'eq', value: req.params.id },
    ]);
    if (!data.length) throw ApiError.notFound(`${req.params.table} ${req.params.id} not found`);
    res.json({ data: data[0] });
  }),
);
