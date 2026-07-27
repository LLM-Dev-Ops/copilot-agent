/**
 * HIPAA Routes
 *
 * API endpoints for HIPAA compliance features.
 *
 * ATTRIBUTION (ADR-0002 Finding 3): every identity used here comes from the verified
 * token via `req.user.userId`. The previous code read `(req as any).user?.id || 'system'`
 * -- note `.id`, which AuthenticatedUser does not have -- so every BAA and breach report
 * was permanently attributed to the literal 'system', and POST /phi-access passed
 * `req.body` straight through, letting any caller forge the audit record's userId.
 *
 * There is no `|| 'system'` fallback anywhere below. With `authenticate` mounted in
 * front, an absent principal is an invariant violation, not a case to paper over.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HIPAAService } from '../services/hipaaService';
import { AuthenticatedRequest, authorize, authenticateUserOrInternal, requireUser } from '../middleware/auth';
import { validateBody, validateQuery, validatedQuery } from '../middleware/validate';
import { PHIAccessContext } from '../data/phiRepository';
import { AuthenticationError } from '../utils/errors';

const ROLES_AUDITOR = ['compliance-auditor', 'admin'] as const;
const ROLES_OFFICER = ['compliance-officer', 'admin'] as const;

/**
 * Builds the PHI access context from the verified principal and transport metadata.
 * Throws rather than defaulting: an unattributable PHI record is worse than an error.
 */
function accessContext(req: AuthenticatedRequest, purpose?: string): PHIAccessContext {
  if (!req.user?.userId) {
    throw new AuthenticationError('Cannot attribute PHI access: no authenticated principal');
  }
  return {
    userId: req.user.userId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    purpose,
  };
}

const accessTypeEnum = z.enum(['view', 'create', 'update', 'delete', 'export', 'print']);

// Deliberately omits userId. There is no field here for a caller to forge; attribution
// is taken from the token. `onBehalfOf` is honoured only for internal service ingestion.
const logPHIAccessSchema = z.object({
  patientId: z.string().min(1).max(255).optional(),
  accessType: accessTypeEnum,
  resourceType: z.string().min(1).max(100),
  resourceId: z.string().min(1).max(255),
  purpose: z.string().max(2000).optional(),
  accessGranted: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  onBehalfOf: z.string().uuid().optional(),
}).strict();

const phiAccessQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  patientId: z.string().min(1).max(255).optional(),
  accessType: accessTypeEnum.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
});

const accessReportSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  patientId: z.string().min(1).max(255).optional(),
  userId: z.string().uuid().optional(),
}).strict();

const baaSchema = z.object({
  vendorId: z.string().min(1).max(255),
  vendorName: z.string().min(1).max(255),
  agreementType: z.enum(['baa', 'dpa', 'both']),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  autoRenew: z.boolean(),
  terms: z.object({
    permittedUses: z.array(z.string()),
    subcontractorAllowed: z.boolean(),
    breachNotificationHours: z.number().int().min(0),
    terminationConditions: z.array(z.string()).optional(),
  }),
  contacts: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.string().min(1),
    isPrimary: z.boolean(),
  })),
}).strict();

const breachSchema = z.object({
  discoveryDate: z.coerce.date(),
  affectedIndividuals: z.number().int().min(0),
  phiTypes: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  containmentActions: z.array(z.string().min(1)).min(1),
}).strict();

export function createHIPAARoutes(hipaaService: HIPAAService): Router {
  const router = Router();

  // ===========================================
  // PHI Access Logging Routes
  // ===========================================

  /**
   * Log PHI access.
   *
   * Demoted from the primary path to an ingestion endpoint for out-of-process callers
   * (ADR-0002 Decision 2). In-process ePHI access is logged automatically by
   * PHIRepository; this exists for services that cannot call it directly.
   *
   * Accepts a user JWT or the internal service key. With a JWT the principal is the
   * token's subject and `onBehalfOf` is ignored entirely.
   */
  router.post(
    '/phi-access',
    authenticateUserOrInternal,
    validateBody(logPHIAccessSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const body = req.body as z.infer<typeof logPHIAccessSchema>;

        let userId: string;
        if (req.user?.userId) {
          // Verified user token wins. A userId/onBehalfOf in the body cannot override it.
          userId = req.user.userId;
        } else if (body.onBehalfOf) {
          // Internal service ingestion: the acting principal must be named explicitly
          // and must be a real user, since phi_access_logs.user_id is a FK to users(id).
          userId = body.onBehalfOf;
        } else {
          throw new AuthenticationError(
            'Internal PHI ingestion must supply onBehalfOf identifying the acting principal'
          );
        }

        const log = await hipaaService.logPHIAccess({
          userId,
          patientId: body.patientId,
          accessType: body.accessType,
          resourceType: body.resourceType,
          resourceId: body.resourceId,
          purpose: body.purpose,
          accessGranted: body.accessGranted,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: body.metadata,
        });

        res.status(201).json({ log });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Get PHI access logs. Restricted to compliance auditors: these records contain
   * patient identifiers, IP addresses, and user agents.
   */
  router.get(
    '/phi-access',
    authorize(...ROLES_AUDITOR),
    validateQuery(phiAccessQuerySchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const filters = validatedQuery<z.infer<typeof phiAccessQuerySchema>>(req);
        const logs = await hipaaService.getPHIAccessLogs(
          accessContext(req, 'compliance audit: PHI access log review'),
          filters
        );
        res.json({ logs, count: logs.length });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Generate PHI access report
   */
  router.post(
    '/phi-access/report',
    authorize(...ROLES_AUDITOR),
    validateBody(accessReportSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const body = req.body as z.infer<typeof accessReportSchema>;
        const report = await hipaaService.generateAccessReport(
          accessContext(req, 'compliance audit: PHI access report'),
          body
        );
        res.json(report);
      } catch (error) {
        next(error);
      }
    }
  );

  // ===========================================
  // Business Associate Agreement Routes
  // ===========================================

  /**
   * List BAAs
   */
  router.get('/baa', requireUser, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status, vendorId, expiringWithinDays } = req.query;
      const baas = await hipaaService.listBAAs({
        status: status as any,
        vendorId: vendorId as string,
        expiringWithinDays: expiringWithinDays ? parseInt(expiringWithinDays as string, 10) : undefined,
      });
      res.json({ baas, count: baas.length });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get BAA by ID
   */
  router.get('/baa/:baaId', requireUser, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const baa = await hipaaService.getBAA(req.params.baaId);
      if (!baa) {
        return res.status(404).json({ error: 'BAA not found' });
      }
      res.json({ baa });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Create BAA
   */
  router.post(
    '/baa',
    authorize(...ROLES_OFFICER),
    validateBody(baaSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Was `(req as any).user?.id || 'system'`, which always evaluated to 'system'.
        const baa = await hipaaService.createBAA(req.body, req.user!.userId);
        res.status(201).json({ baa });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Update BAA status
   */
  router.patch(
    '/baa/:baaId/status',
    authorize(...ROLES_OFFICER),
    validateBody(z.object({ status: z.enum(['pending', 'active', 'expired', 'terminated']) }).strict()),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const baa = await hipaaService.updateBAAStatus(req.params.baaId, req.body.status);
        res.json({ baa });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Add document to BAA
   */
  router.post(
    '/baa/:baaId/documents',
    authorize(...ROLES_OFFICER),
    validateBody(z.object({ name: z.string().min(1), url: z.string().min(1) }).strict()),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { name, url } = req.body;
        const baa = await hipaaService.addBAADocument(req.params.baaId, { name, url });
        res.json({ baa });
      } catch (error) {
        next(error);
      }
    }
  );

  // ===========================================
  // HIPAA Assessment Routes
  // ===========================================

  /**
   * Get HIPAA control requirements. Any authenticated principal.
   */
  router.get('/requirements', requireUser, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const requirements = hipaaService.getHIPAAControlRequirements();
      res.json({
        requirements,
        count: requirements.length,
        bySafeguard: {
          administrative: requirements.filter(r => r.safeguard === 'administrative').length,
          physical: requirements.filter(r => r.safeguard === 'physical').length,
          technical: requirements.filter(r => r.safeguard === 'technical').length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Assess HIPAA compliance. Any authenticated principal.
   */
  router.get('/assessment', requireUser, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const assessment = await hipaaService.assessHIPAACompliance();
      res.json(assessment);
    } catch (error) {
      next(error);
    }
  });

  // ===========================================
  // Breach Reporting Routes
  // ===========================================

  /**
   * Report a breach
   */
  router.post(
    '/breaches',
    authorize(...ROLES_OFFICER),
    validateBody(breachSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const body = req.body as z.infer<typeof breachSchema>;

        const breach = await hipaaService.reportBreach({
          discoveryDate: body.discoveryDate,
          affectedIndividuals: body.affectedIndividuals,
          phiTypes: body.phiTypes,
          description: body.description,
          containmentActions: body.containmentActions,
          // Was `(req as any).user?.id || 'system'`.
          reportedBy: req.user!.userId,
        });

        res.status(201).json({ breach });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
