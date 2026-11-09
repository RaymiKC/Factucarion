import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../http/errors';
import { verifyToken } from '../security/jwt';
import type { AuthTokenPayload } from '../security/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim();
}

/** Rejects the request when no valid token is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (!token) {
    next(ApiError.unauthorized());
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    next(ApiError.unauthorized('Invalid or expired token'));
    return;
  }
  req.auth = payload;
  next();
}

/** Attaches the token payload when present, but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.auth = payload;
  }
  next();
}
