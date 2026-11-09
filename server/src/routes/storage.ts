import { Router } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { ApiError, asyncHandler } from '../http/errors';
import { requireAuth } from '../http/auth-middleware';

export const storageRouter = Router();

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function resolveTarget(bucket: string, requestedPath: string): { absolute: string; relative: string } {
  if (!SAFE_SEGMENT.test(bucket)) throw ApiError.badRequest('Invalid bucket name');

  const segments = requestedPath.split('/').filter(Boolean);
  if (!segments.length || !segments.every(segment => SAFE_SEGMENT.test(segment))) {
    throw ApiError.badRequest('Invalid file path');
  }

  const relative = path.posix.join(bucket, ...segments);
  const absolute = path.join(config.uploadDir, relative);
  const root = path.resolve(config.uploadDir);
  if (!path.resolve(absolute).startsWith(root)) {
    throw ApiError.badRequest('Invalid file path');
  }

  return { absolute, relative };
}

/** Uploads a file. Accepts JSON with base64 payload or a raw binary body. */
storageRouter.put(
  '/:bucket',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requestedPath =
      (typeof req.query.path === 'string' && req.query.path) ||
      (typeof req.body?.path === 'string' && req.body.path) ||
      '';

    const { absolute, relative } = resolveTarget(req.params.bucket, requestedPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });

    let payload: Buffer;
    if (typeof req.body?.dataBase64 === 'string') {
      payload = Buffer.from(req.body.dataBase64, 'base64');
    } else if (Buffer.isBuffer(req.body)) {
      payload = req.body;
    } else {
      throw ApiError.badRequest('Send either { dataBase64 } or a raw binary body');
    }

    await fs.writeFile(absolute, payload);

    res.status(201).json({
      path: relative,
      publicUrl: `${config.publicUrl}/files/${relative}`,
      size: payload.length,
    });
  }),
);

storageRouter.delete(
  '/:bucket',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requestedPath = typeof req.query.path === 'string' ? req.query.path : '';
    const { absolute, relative } = resolveTarget(req.params.bucket, requestedPath);
    await fs.rm(absolute, { force: true });
    res.json({ path: relative, deleted: true });
  }),
);
