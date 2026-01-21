/**
 * LLM-CONNECTOR-HUB UNIFIED SERVICE
 *
 * External Integration & Platform Boundary Layer
 *
 * RESPONSIBILITIES:
 * - Interface with external systems (ERP, databases, webhooks, identity providers)
 * - Authenticate and validate inbound external requests
 * - Ingest external payloads in controlled, schema-validated form
 * - Normalize heterogeneous external events into canonical internal schemas
 * - Emit read-only connector DecisionEvents for downstream consumption
 *
 * CONSTRAINTS:
 * - Operates AT THE PLATFORM BOUNDARY
 * - Operates OUTSIDE the critical execution path
 * - DOES NOT intercept internal runtime execution
 * - DOES NOT execute workflows
 * - DOES NOT enforce governance or business policies
 * - DOES NOT optimize behavior
 * - DOES NOT generate analytics
 *
 * PERSISTENCE:
 * - ALL persistence via ruvector-service ONLY
 * - NO direct database connections
 * - NO SQL execution
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';

// Agent imports
import { ERPSurfaceAgent } from './agents/erp-surface-agent';
import { DatabaseQueryAgent } from './agents/database-query-agent';
import { WebhookListenerAgent } from './agents/webhook-listener-agent';
import { EventNormalizationAgent } from './agents/event-normalization-agent';
import { AuthIdentityAgent } from './agents/auth-identity-agent';

// Infrastructure imports
import { RuvectorClient } from './infrastructure/ruvector-client';
import { TelemetryService } from './infrastructure/telemetry-service';
import { HealthChecker } from './infrastructure/health-checker';

// Configuration
const PORT = process.env.PORT || 8080;
const SERVICE_NAME = process.env.SERVICE_NAME || 'llm-connector-hub';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const PLATFORM_ENV = process.env.PLATFORM_ENV || 'dev';

// Initialize infrastructure
const ruvectorClient = new RuvectorClient({
  endpoint: process.env.RUVECTOR_SERVICE_URL!,
  apiKey: process.env.RUVECTOR_API_KEY!,
  namespace: 'connector-hub',
});

const telemetry = new TelemetryService({
  endpoint: process.env.TELEMETRY_ENDPOINT!,
  serviceName: SERVICE_NAME,
  serviceVersion: SERVICE_VERSION,
  enabled: process.env.TELEMETRY_ENABLED !== 'false',
});

// Initialize agents (ALL agents share runtime, configuration, and telemetry)
const erpAgent = new ERPSurfaceAgent(ruvectorClient, telemetry);
const databaseAgent = new DatabaseQueryAgent(ruvectorClient, telemetry);
const webhookAgent = new WebhookListenerAgent(ruvectorClient, telemetry);
const normalizationAgent = new EventNormalizationAgent(ruvectorClient, telemetry);
const authAgent = new AuthIdentityAgent(ruvectorClient, telemetry);

const healthChecker = new HealthChecker([
  { name: 'ruvector', check: () => ruvectorClient.healthCheck() },
  { name: 'erp-agent', check: () => erpAgent.healthCheck() },
  { name: 'database-agent', check: () => databaseAgent.healthCheck() },
  { name: 'webhook-agent', check: () => webhookAgent.healthCheck() },
  { name: 'normalization-agent', check: () => normalizationAgent.healthCheck() },
  { name: 'auth-agent', check: () => authAgent.healthCheck() },
]);

// Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.headers['x-request-id']);
  next();
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    telemetry.recordRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      requestId: req.headers['x-request-id'] as string,
    });
  });
  next();
});

// =============================================================================
// HEALTH & READINESS ENDPOINTS
// =============================================================================

app.get('/health', async (_req: Request, res: Response) => {
  const health = await healthChecker.checkHealth();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.get('/ready', async (_req: Request, res: Response) => {
  const ready = await healthChecker.checkReadiness();
  res.status(ready.ready ? 200 : 503).json(ready);
});

app.get('/metrics', (_req: Request, res: Response) => {
  res.type('text/plain').send(telemetry.getPrometheusMetrics());
});

// =============================================================================
// ERP SURFACE AGENT ENDPOINTS
// /api/v1/connectors/erp
// =============================================================================

app.get('/api/v1/connectors/erp/health', async (_req: Request, res: Response) => {
  const health = await erpAgent.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.post('/api/v1/connectors/erp/connect', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await erpAgent.invoke({
    action: 'connect',
    system: req.body.system,
    credentials: req.body.credentials,
    config: req.body.config,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

app.post('/api/v1/connectors/erp/query', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await erpAgent.invoke({
    action: 'query',
    system: req.body.system,
    query: req.body.query,
    parameters: req.body.parameters,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

app.post('/api/v1/connectors/erp/sync', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await erpAgent.invoke({
    action: 'sync',
    system: req.body.system,
    entities: req.body.entities,
    since: req.body.since,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

// =============================================================================
// DATABASE QUERY AGENT ENDPOINTS
// /api/v1/connectors/database
// =============================================================================

app.get('/api/v1/connectors/database/health', async (_req: Request, res: Response) => {
  const health = await databaseAgent.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.post('/api/v1/connectors/database/query', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await databaseAgent.invoke({
    action: 'query',
    connection: req.body.connection,
    query: req.body.query,
    parameters: req.body.parameters,
    readOnly: true, // ALWAYS read-only
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

app.post('/api/v1/connectors/database/schema', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await databaseAgent.invoke({
    action: 'schema',
    connection: req.body.connection,
    tables: req.body.tables,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

// =============================================================================
// WEBHOOK LISTENER AGENT ENDPOINTS
// /api/v1/connectors/webhook
// =============================================================================

app.get('/api/v1/connectors/webhook/health', async (_req: Request, res: Response) => {
  const health = await webhookAgent.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.post('/api/v1/connectors/webhook/ingest', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await webhookAgent.invoke({
    action: 'ingest',
    source: req.body.source || req.headers['x-webhook-source'],
    eventType: req.body.eventType || req.headers['x-event-type'],
    payload: req.body.payload || req.body,
    headers: req.headers,
    signature: req.headers['x-webhook-signature'] as string,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

app.post('/api/v1/connectors/webhook/register', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await webhookAgent.invoke({
    action: 'register',
    source: req.body.source,
    config: req.body.config,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

// =============================================================================
// EVENT NORMALIZATION AGENT ENDPOINTS
// /api/v1/connectors/normalize
// =============================================================================

app.get('/api/v1/connectors/normalize/health', async (_req: Request, res: Response) => {
  const health = await normalizationAgent.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.post('/api/v1/connectors/normalize', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await normalizationAgent.invoke({
    action: 'normalize',
    sourceType: req.body.sourceType,
    sourceSchema: req.body.sourceSchema,
    payload: req.body.payload,
    targetSchema: req.body.targetSchema,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

app.post('/api/v1/connectors/normalize/batch', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await normalizationAgent.invoke({
    action: 'batch_normalize',
    sourceType: req.body.sourceType,
    payloads: req.body.payloads,
    targetSchema: req.body.targetSchema,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

// =============================================================================
// AUTH IDENTITY AGENT ENDPOINTS
// /api/v1/connectors/auth
// =============================================================================

app.get('/api/v1/connectors/auth/health', async (_req: Request, res: Response) => {
  const health = await authAgent.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

app.post('/api/v1/connectors/auth/authenticate', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await authAgent.invoke({
    action: 'authenticate',
    provider: req.body.provider,
    credentials: req.body.credentials,
    scopes: req.body.scopes,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

app.post('/api/v1/connectors/auth/validate', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await authAgent.invoke({
    action: 'validate',
    token: req.body.token || req.headers['authorization']?.replace('Bearer ', ''),
    requiredScopes: req.body.requiredScopes,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

app.post('/api/v1/connectors/auth/refresh', async (req: Request, res: Response) => {
  const executionRef = req.headers['x-request-id'] as string;
  const result = await authAgent.invoke({
    action: 'refresh',
    refreshToken: req.body.refreshToken,
    provider: req.body.provider,
  }, executionRef);
  res.status(result.status === 'success' ? 200 : 400).json(result);
});

// =============================================================================
// SERVICE INFO ENDPOINT
// =============================================================================

app.get('/api/v1/info', (_req: Request, res: Response) => {
  res.json({
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: PLATFORM_ENV,
    agents: [
      { name: 'erp-surface-agent', path: '/api/v1/connectors/erp' },
      { name: 'database-query-agent', path: '/api/v1/connectors/database' },
      { name: 'webhook-listener-agent', path: '/api/v1/connectors/webhook' },
      { name: 'event-normalization-agent', path: '/api/v1/connectors/normalize' },
      { name: 'auth-identity-agent', path: '/api/v1/connectors/auth' },
    ],
    constraints: [
      'read_only_analysis',
      'no_workflow_execution',
      'no_policy_enforcement',
      'no_optimization',
      'persistence_via_ruvector_only',
    ],
  });
});

// =============================================================================
// ERROR HANDLER
// =============================================================================

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`Error [${req.headers['x-request-id']}]:`, err);
  telemetry.recordError({
    error: err.message,
    stack: err.stack,
    requestId: req.headers['x-request-id'] as string,
    path: req.path,
  });
  res.status(500).json({
    status: 'error',
    error_code: 'INTERNAL_ERROR',
    error_message: 'An internal error occurred',
    execution_ref: req.headers['x-request-id'],
  });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║           LLM-CONNECTOR-HUB SERVICE STARTED                       ║
╠═══════════════════════════════════════════════════════════════════╣
║  Service:     ${SERVICE_NAME.padEnd(48)}║
║  Version:     ${SERVICE_VERSION.padEnd(48)}║
║  Environment: ${PLATFORM_ENV.padEnd(48)}║
║  Port:        ${String(PORT).padEnd(48)}║
╠═══════════════════════════════════════════════════════════════════╣
║  AGENT ENDPOINTS:                                                 ║
║  • /api/v1/connectors/erp        - ERP Surface Agent              ║
║  • /api/v1/connectors/database   - Database Query Agent           ║
║  • /api/v1/connectors/webhook    - Webhook Listener Agent         ║
║  • /api/v1/connectors/normalize  - Event Normalization Agent      ║
║  • /api/v1/connectors/auth       - Auth / Identity Agent          ║
╠═══════════════════════════════════════════════════════════════════╣
║  HEALTH: /health | READY: /ready | METRICS: /metrics              ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  telemetry.recordEvent('service_started', {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: PLATFORM_ENV,
  });
});

export default app;
