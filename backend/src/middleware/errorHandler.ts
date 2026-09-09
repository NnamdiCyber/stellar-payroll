import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from './asyncHandler.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: true,
      message: err.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; '),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: true,
      message: err.message,
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: true,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
