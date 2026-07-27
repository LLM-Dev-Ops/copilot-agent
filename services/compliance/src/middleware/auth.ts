/**
 * Authentication Middleware
 *
 * Promoted from services/billing/src/middleware/auth.ts per ADR-0002 step 5.
 * The compliance routers previously had NO authentication at all: index.ts mounted
 * them behind executionContextMiddleware, which is span plumbing.
 *
 * NOTE ON THE FIELD NAME (ADR-0002 Finding 4, "one trap"):
 * AuthenticatedUser carries `userId`, NOT `id`. The compliance routes used to read
 * `(req as any).user?.id || 'system'`, so mounting this middleware unchanged would
 * still have yielded undefined and attributed every record to 'system' -- the fix
 * would have appeared to work while changing nothing. Callers must read
 * `req.user.userId`. There is a test asserting exactly this
 * (auth.test.ts, "no 'system' attribution leaks").
 *
 * This file is kept byte-compatible with billing's implementation for the shared
 * functions; auth-drift.test.ts fails if the two diverge.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { loadSecrets, ComplianceSecrets } from '../config/env';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  tenantId?: string;
}

let secrets: ComplianceSecrets | undefined;

/** Injected at startup so tests and the server share one resolved config. */
export function configureAuth(resolved: ComplianceSecrets): void {
  secrets = resolved;
}

function getSecrets(): ComplianceSecrets {
  if (!secrets) secrets = loadSecrets();
  return secrets;
}

/**
 * JWT Authentication middleware
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, getSecrets().jwtSecret) as AuthenticatedUser;

    if (!decoded.userId) {
      // A token without a subject cannot attribute a PHI audit record.
      throw new AuthenticationError('Token does not identify a principal');
    }

    req.user = { ...decoded, roles: decoded.roles || [] };
    req.tenantId = decoded.tenantId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else {
      next(error);
    }
  }
}

/**
 * Role-based authorization middleware
 */
export function authorize(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));

    if (!hasRole) {
      logger.warn('Authorization failed', {
        userId: req.user.userId,
        requiredRoles: allowedRoles,
        userRoles: req.user.roles,
      });
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Requires a human/user principal (a verified JWT), not just any authenticated caller.
 *
 * The internal service key authenticates a *service*, which has no `req.user`. Routes
 * that must attribute to a person, or that expose vendor/BAA data, use this.
 */
export function requireUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.userId) {
    return next(new AuthenticationError('This endpoint requires an authenticated user'));
  }
  next();
}

/**
 * Admin-only middleware
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new AuthenticationError('User not authenticated'));
  }

  if (!req.user.roles.includes('admin')) {
    return next(new AuthorizationError('Admin access required'));
  }

  next();
}

/**
 * Internal service authentication (for service-to-service PHI ingestion).
 *
 * Unlike billing's version, this does NOT synthesise a `userId: 'system'` principal.
 * phi_access_logs.user_id is `UUID NOT NULL REFERENCES users(id)`, so an audit record
 * must name a real person. An internal caller reporting PHI access on someone's behalf
 * supplies that principal explicitly in the validated body (`onBehalfOf`).
 */
export function authenticateInternal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const internalKey = req.headers['x-internal-key'] as string;
  const expected = getSecrets().internalServiceKey;

  if (!expected) {
    return next(new AuthenticationError('Internal service authentication is not configured'));
  }

  if (!internalKey || internalKey !== expected) {
    return next(new AuthenticationError('Invalid internal service key'));
  }

  req.tenantId = (req.headers['x-tenant-id'] as string) || '';
  next();
}

/**
 * Accept either a user JWT or the internal service key.
 *
 * Used only by POST /hipaa/phi-access, which serves both interactive callers and
 * out-of-process ingestion. The route -- not this middleware -- decides attribution:
 * a JWT principal always wins over anything in the body.
 */
export function authenticateUserOrInternal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }

  if (req.headers['x-internal-key']) {
    return authenticateInternal(req, res, next);
  }

  next(new AuthenticationError('No authentication credentials provided'));
}
