/**
 * ADR-0002 Verification 4, 5, 6, 7 -- authentication, authorization, and attribution.
 *
 * All four fail against the pre-ADR code: the routers were mounted behind
 * executionContextMiddleware only, so every route was reachable anonymously, and
 * attribution came from `req.body` / `(req as any).user?.id || 'system'`.
 */

import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createHIPAARoutes } from '../src/routes/hipaa';
import { createComplianceRoutes } from '../src/routes/compliance';
import { createDataResidencyRoutes } from '../src/routes/dataResidency';
import {
  authenticate,
  authenticateUserOrInternal,
  configureAuth,
  AuthenticatedRequest,
} from '../src/middleware/auth';
import { loadSecrets } from '../src/config/env';
import { HIPAAService } from '../src/services/hipaaService';

const TEST_ENV = {
  NODE_ENV: 'test',
  HIPAA_ENCRYPTION_KEY: 'test-key',
  HIPAA_PSEUDONYM_SALT: 'test-salt',
  JWT_SECRET: 'test-jwt-secret',
  INTERNAL_SERVICE_KEY: 'internal-test-key',
};

const secrets = loadSecrets(TEST_ENV as unknown as NodeJS.ProcessEnv);
configureAuth(secrets);

const ALICE = '11111111-1111-1111-1111-111111111111';
const ATTACKER = '99999999-9999-9999-9999-999999999999';

function tokenFor(userId: string, roles: string[]): string {
  return jwt.sign(
    { userId, tenantId: 't1', email: 'u@test.io', roles },
    TEST_ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/** Captures what actually reached the service layer. */
interface Captured {
  logPHIAccess?: Record<string, unknown>;
  createBAA?: { input: unknown; userId: string };
  reportBreach?: Record<string, unknown>;
}

function buildApp(captured: Captured): Express {
  const hipaaService = {
    logPHIAccess: async (input: Record<string, unknown>) => {
      captured.logPHIAccess = input;
      return { ...input, id: 'log-1', timestamp: new Date() };
    },
    getPHIAccessLogs: async () => [],
    generateAccessReport: async () => ({ summary: {}, details: [] }),
    createBAA: async (input: unknown, userId: string) => {
      captured.createBAA = { input, userId };
      return { id: 'baa-1', createdBy: userId };
    },
    getBAA: async () => null,
    listBAAs: async () => [],
    updateBAAStatus: async () => ({}),
    addBAADocument: async () => ({}),
    getHIPAAControlRequirements: () => [],
    assessHIPAACompliance: async () => ({}),
    reportBreach: async (input: Record<string, unknown>) => {
      captured.reportBreach = input;
      return { id: 'breach-1' };
    },
  } as unknown as HIPAAService;

  const stub = new Proxy({}, { get: () => async () => ({}) });

  const app = express();
  app.use(express.json());
  // Same mount order as src/index.ts createApp(), minus executionContextMiddleware
  // (span plumbing that requires an X-Parent-Span-Id header and is not under test here).
  app.use('/api/v1/hipaa', authenticateUserOrInternal, createHIPAARoutes(hipaaService));
  app.use('/api/v1/compliance', authenticate, createComplianceRoutes(stub as never));
  app.use('/api/v1/data-residency', authenticate, createDataResidencyRoutes(stub as never));
  app.get('/health', (_req, res) => { res.json({ status: 'healthy' }); });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: AuthenticatedRequest, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode || 500).json({ error: { message: err.message, code: err.code } });
  });
  return app;
}

let captured: Captured;
let app: Express;

beforeEach(() => {
  captured = {};
  app = buildApp(captured);
});

const VALID_PHI_BODY = {
  patientId: 'PT-12345',
  accessType: 'view',
  resourceType: 'Patient',
  resourceId: 'r-1',
  accessGranted: true,
};

// ---------------------------------------------------------------------------
// Verification 4 -- unauthenticated rejection, by enumerating the router stack
// ---------------------------------------------------------------------------

/**
 * Walks the Express router stack rather than listing paths by hand, so a route added
 * later cannot quietly ship unguarded (ADR-0002 Verification 4 requires exactly this).
 */
function enumerateRoutes(expressApp: Express): Array<{ method: string; path: string }> {
  const found: Array<{ method: string; path: string }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (stack: any[], prefix: string): void => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          found.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const match = layer.regexp?.source
          ?.replace('^\\/', '/')
          .replace('\\/?(?=\\/|$)', '')
          .replace(/\\\//g, '/');
        walk(layer.handle.stack, prefix + (match && match !== '/^\\/?$/i' ? match : ''));
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walk((expressApp as any)._router.stack, '');
  return found;
}

describe('Verification 4: unauthenticated rejection', () => {
  it('discovers every mounted API route by walking the stack', () => {
    const routes = enumerateRoutes(app).filter(r => r.path.startsWith('/api/v1'));
    // Guards against the enumeration silently finding nothing and vacuously passing.
    expect(routes.length).toBeGreaterThan(15);
  });

  it('returns 401 for EVERY /api/v1 route with no Authorization header', async () => {
    const routes = enumerateRoutes(app).filter(r => r.path.startsWith('/api/v1'));
    const failures: string[] = [];

    for (const route of routes) {
      const path = route.path.replace(/:(\w+)/g, 'test-id');
      const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[
        route.method.toLowerCase()
      ](path).send({});
      if (res.status !== 401) failures.push(`${route.method} ${path} -> ${res.status}`);
    }

    expect(failures).toEqual([]);
  });

  it('leaves /health reachable without auth', async () => {
    await request(app).get('/health').expect(200);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: ALICE, roles: ['admin'] }, 'wrong-secret');
    await request(app)
      .get('/api/v1/hipaa/phi-access')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });
});

// ---------------------------------------------------------------------------
// Verification 5 -- authorization enforcement
// ---------------------------------------------------------------------------

describe('Verification 5: authorization enforcement', () => {
  it('returns 403 from GET /hipaa/phi-access for a valid token lacking compliance-auditor', async () => {
    await request(app)
      .get('/api/v1/hipaa/phi-access')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['developer'])}`)
      .expect(403);
  });

  it('allows compliance-auditor through', async () => {
    await request(app)
      .get('/api/v1/hipaa/phi-access')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['compliance-auditor'])}`)
      .expect(200);
  });

  it('returns 403 from POST /hipaa/breaches without compliance-officer', async () => {
    await request(app)
      .post('/api/v1/hipaa/breaches')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['developer'])}`)
      .send({
        discoveryDate: new Date().toISOString(),
        affectedIndividuals: 1,
        phiTypes: ['name'],
        description: 'x',
        containmentActions: ['y'],
      })
      .expect(403);
  });
});

// ---------------------------------------------------------------------------
// Verification 6 -- attribution is not forgeable
// ---------------------------------------------------------------------------

describe('Verification 6: attribution is not forgeable', () => {
  it('ignores a userId in the request body and attributes to the token subject', async () => {
    await request(app)
      .post('/api/v1/hipaa/phi-access')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['developer'])}`)
      .send({ ...VALID_PHI_BODY, userId: ATTACKER })
      // `.strict()` on the Zod schema means an unknown `userId` key is a 400 --
      // the forged field cannot even be submitted, let alone honoured.
      .expect(400);

    expect(captured.logPHIAccess).toBeUndefined();
  });

  it('attributes to the token subject when onBehalfOf names someone else', async () => {
    await request(app)
      .post('/api/v1/hipaa/phi-access')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['developer'])}`)
      .send({ ...VALID_PHI_BODY, onBehalfOf: ATTACKER })
      .expect(201);

    // A verified user token always wins over anything in the body.
    expect(captured.logPHIAccess!.userId).toBe(ALICE);
    expect(captured.logPHIAccess!.userId).not.toBe(ATTACKER);
  });

  it('records the token subject on a normal PHI access log', async () => {
    await request(app)
      .post('/api/v1/hipaa/phi-access')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['developer'])}`)
      .send(VALID_PHI_BODY)
      .expect(201);

    expect(captured.logPHIAccess!.userId).toBe(ALICE);
  });

  it('rejects internal-key ingestion that does not name an acting principal', async () => {
    await request(app)
      .post('/api/v1/hipaa/phi-access')
      .set('x-internal-key', TEST_ENV.INTERNAL_SERVICE_KEY)
      .send(VALID_PHI_BODY)
      .expect(401);
  });

  it('rejects a wrong internal key', async () => {
    await request(app)
      .post('/api/v1/hipaa/phi-access')
      .set('x-internal-key', 'not-the-key')
      .send({ ...VALID_PHI_BODY, onBehalfOf: ALICE })
      .expect(401);
  });

  it('does not let the internal key reach any route other than PHI ingestion', async () => {
    await request(app)
      .get('/api/v1/hipaa/phi-access')
      .set('x-internal-key', TEST_ENV.INTERNAL_SERVICE_KEY)
      .expect(401);

    await request(app)
      .get('/api/v1/hipaa/baa')
      .set('x-internal-key', TEST_ENV.INTERNAL_SERVICE_KEY)
      .expect(401);
  });
});

// ---------------------------------------------------------------------------
// Verification 7 -- no 'system' attribution leaks (the req.user.id/userId trap)
// ---------------------------------------------------------------------------

describe("Verification 7: no 'system' attribution leaks", () => {
  it('persists createdBy equal to the token subject on POST /hipaa/baa', async () => {
    await request(app)
      .post('/api/v1/hipaa/baa')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['compliance-officer'])}`)
      .send({
        vendorId: 'v-1',
        vendorName: 'Vendor',
        agreementType: 'baa',
        effectiveDate: new Date().toISOString(),
        autoRenew: false,
        terms: { permittedUses: ['treatment'], subcontractorAllowed: false, breachNotificationHours: 24 },
        contacts: [{ name: 'C', email: 'c@v.io', role: 'privacy', isPrimary: true }],
      })
      .expect(201);

    // This is the assertion that catches reading `req.user.id` (undefined) instead of
    // `req.user.userId`: with the bug, userId here is the string 'system'.
    expect(captured.createBAA!.userId).toBe(ALICE);
    expect(captured.createBAA!.userId).not.toBe('system');
  });

  it('persists reportedBy equal to the token subject on POST /hipaa/breaches', async () => {
    await request(app)
      .post('/api/v1/hipaa/breaches')
      .set('Authorization', `Bearer ${tokenFor(ALICE, ['compliance-officer'])}`)
      .send({
        discoveryDate: new Date().toISOString(),
        affectedIndividuals: 600,
        phiTypes: ['name', 'ssn'],
        description: 'Incident',
        containmentActions: ['isolated'],
      })
      .expect(201);

    expect(captured.reportBreach!.reportedBy).toBe(ALICE);
    expect(captured.reportBreach!.reportedBy).not.toBe('system');
  });

  it("has no `|| 'system'` attribution fallback left in any compliance route", () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../src/routes');
    for (const file of fs.readdirSync(dir)) {
      const src: string = fs.readFileSync(path.join(dir, file), 'utf8');
      const code = src
        .split('\n')
        .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .join('\n');
      expect(code).not.toContain("user?.id");
      expect(code).not.toContain("|| 'system'");
    }
  });
});
