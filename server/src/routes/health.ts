import { Router } from 'express';
import { config, describeConfig } from '../config';
import { getAdapter } from '../db';
import { asyncHandler } from '../http/errors';
import { isMailConfigured } from '../services/mailer';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(async (_req, res) => {
  const startedAt = Date.now();
  let database: Record<string, unknown>;
  try {
    const db = await getAdapter();
    await db.raw('SELECT 1');
    database = {
      ok: true,
      provider: db.provider,
      target: describeConfig(),
      tables: db.tables.length,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    database = {
      ok: false,
      provider: config.provider,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const ok = Boolean(database.ok);
  res.status(ok ? 200 : 503).json({
    ok,
    service: 'facturpro-api',
    version: '1.0.0',
    uptimeSeconds: Math.round(process.uptime()),
    database,
    mail: { configured: isMailConfigured() },
  });
}));

/** Mounted at /api/tables behind requireAuth. */
export const tablesRouter = Router();

tablesRouter.get('/', asyncHandler(async (_req, res) => {
  const db = await getAdapter();
  const tables = await Promise.all(
    db.tables.map(async table => {
      const columns = await db.describeTable(table);
      return {
        table,
        columns: [...columns.values()].map(column => ({
          name: column.name,
          type: column.dataType,
          nullable: column.nullable,
        })),
      };
    }),
  );
  res.json({ provider: db.provider, tables });
}));
