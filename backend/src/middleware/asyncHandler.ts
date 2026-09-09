import { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wrap async route handlers so that rejected promises (including Zod parse
 * errors and Stellar service errors) are forwarded to the error handling
 * middleware instead of being swallowed or handled inconsistently inline.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
