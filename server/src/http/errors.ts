import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'bad_request',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(message, 401, 'unauthorized');
  }

  static forbidden(message = 'You do not have access to this resource'): ApiError {
    return new ApiError(message, 403, 'forbidden');
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(message, 404, 'not_found');
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(message, 400, 'bad_request', details);
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
