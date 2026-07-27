/**
 * Zod request validation (ADR-0002 step 6).
 *
 * `zod` was already a declared dependency of services/compliance and entirely unused
 * in src/. Routes previously passed `req.body` wholesale into service methods.
 */

import { Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AuthenticatedRequest } from './auth';
import { ValidationError } from '../utils/errors';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError('Invalid request body', { issues: result.error.issues }));
    }
    // Replace the body with the parsed value so handlers cannot reach unvalidated
    // fields -- this is what stops a forged `userId` from travelling any further.
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ValidationError('Invalid query parameters', { issues: result.error.issues }));
    }
    Object.defineProperty(req, 'validatedQuery', { value: result.data, writable: true, configurable: true });
    next();
  };
}

export function validatedQuery<T>(req: AuthenticatedRequest): T {
  return (req as unknown as { validatedQuery: T }).validatedQuery;
}
