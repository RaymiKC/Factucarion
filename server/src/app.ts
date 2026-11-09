import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { promises as fs } from 'node:fs';
import { config } from './config';
import { DbError } from './db/types';
import { ApiError } from './http/errors';
import { optionalAuth, requireAuth } from './http/auth-middleware';
import { authRouter } from './routes/auth';
import { dbRouter } from './routes/db';
import { healthRouter, tablesRouter } from './routes/health';
import { mailRouter } from './routes/mail';
import { openApiRouter } from './routes/openapi';
import { storageRouter } from './routes/storage';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  const allowed = config.corsOrigin
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowed.includes('*') ? true : allowed,
      credentials: false,
      allowedHeaders: ['Content-Type', 'Authorization', 'apikey'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(
    express.json({
      limit: '12mb',
      // Raw binary uploads are handled by the storage route.
      type: ['application/json'],
    }),
  );
  app.use(express.raw({ type: 'application/octet-stream', limit: '12mb' }));

  app.use((req, _res, next) => {
    if (process.env.API_REQUEST_LOG === 'true') {
      console.log(`${req.method} ${req.originalUrl}`);
    }
    next();
  });

  // Public
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use(openApiRouter);

  // Protected
  app.use('/api/tables', requireAuth, tablesRouter);
  app.use('/api/db', requireAuth, dbRouter);
  app.use('/api/storage', requireAuth, storageRouter);
  app.use('/api/mail', requireAuth, mailRouter);

  app.get('/', (_req, res) => {
    res.json({
      service: 'FacturaPro API',
      docs: `${config.publicUrl}/openapi.json`,
      health: `${config.publicUrl}/health`,
      provider: config.provider,
    });
  });

  app.use(async (req: Request, _res: Response, next: NextFunction) => {
    // Serve uploaded files
    if (!req.path.startsWith('/files/')) {
      next();
      return;
    }
    const relative = req.path.slice('/files/'.length);
    if (relative.includes('..')) {
      next(ApiError.badRequest('Invalid path'));
      return;
    }
    const absolute = `${config.uploadDir}/${relative}`.replace(/\\/g, '/');
    try {
      await fs.access(absolute);
      _res.sendFile(absolute);
    } catch {
      next(ApiError.notFound('File not found'));
    }
  });

  app.use((req, _res, next) => {
    next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }

    if (error instanceof DbError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error('[api] unhandled error:', message);
    res.status(500).json({ error: message, code: 'internal_error' });
  });

  void optionalAuth;
  return app;
}
