/**
 * Cloud Function Entry Point: copilot-agents
 *
 * Unified HTTP handler for all 7 copilot agents.
 * Deploy: gcloud functions deploy copilot-agents --runtime nodejs20 --trigger-http
 *         --region us-central1 --project agentics-dev --entry-point handler
 *         --memory 512MB --timeout 120s --no-allow-unauthenticated
 *
 * Routes:
 *   POST /v1/copilot/planner       → Planner Agent
 *   POST /v1/copilot/config        → Config Validation Agent
 *   POST /v1/copilot/decomposer    → Decomposer Agent
 *   POST /v1/copilot/clarifier     → Objective Clarifier Agent
 *   POST /v1/copilot/intent        → Intent Classifier Agent
 *   POST /v1/copilot/reflection    → Reflection Agent
 *   POST /v1/copilot/meta-reasoner → Meta-Reasoner Agent
 *   GET  /health                    → Health check
 */

import { IncomingMessage, ServerResponse } from 'http';
import * as crypto from 'crypto';
import { routeRequest } from './router';
import { handleHealth } from './health';
import { setCorsHeaders, handlePreflight } from './cors';
import { ExecutionMetadata, LayerExecuted, wrapResponse } from './envelope';

export interface CfRequest extends IncomingMessage {
  body?: unknown;
  rawBody?: Buffer;
}

export interface CfResponse extends ServerResponse {
  status?: (code: number) => CfResponse;
  json?: (data: unknown) => void;
  send?: (data: string | Buffer) => void;
}

/**
 * Parse JSON body from request
 */
function parseBody(req: CfRequest): unknown {
  // Cloud Functions automatically parse JSON bodies into req.body
  if (req.body !== undefined) {
    return req.body;
  }
  return undefined;
}

/**
 * Send JSON response
 */
function sendJson(res: CfResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Main Cloud Function handler
 *
 * Entry point name: handler
 */
export async function handler(req: CfRequest, res: CfResponse): Promise<void> {
  const startTime = Date.now();

  // CORS headers on every response
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    handlePreflight(res);
    return;
  }

  const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Build execution metadata
  const traceId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  const executionId = crypto.randomUUID();

  const executionMetadata: ExecutionMetadata = {
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    service: 'copilot-agents',
    execution_id: executionId,
  };

  // Health endpoint
  if (pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    const healthResult = handleHealth();
    const layers: LayerExecuted[] = [
      { layer: 'AGENT_ROUTING', status: 'completed' },
      { layer: 'HEALTH_CHECK', status: 'completed', duration_ms: Date.now() - startTime },
    ];
    sendJson(res, 200, wrapResponse(healthResult, executionMetadata, layers));
    return;
  }

  // Agent routes: POST /v1/copilot/{agent}
  if (req.method === 'POST' && pathname.startsWith('/v1/copilot/')) {
    const agentSlug = pathname.replace('/v1/copilot/', '').replace(/\/$/, '');
    const body = parseBody(req);

    if (!body || typeof body !== 'object') {
      const layers: LayerExecuted[] = [
        { layer: 'AGENT_ROUTING', status: 'completed' },
      ];
      sendJson(res, 400, wrapResponse(
        { error: 'Request body must be a JSON object' },
        executionMetadata,
        layers
      ));
      return;
    }

    try {
      const routingLayerStart = Date.now();
      const agentResult = await routeRequest(agentSlug, body);
      const routingDuration = Date.now() - routingLayerStart;

      const agentName = agentSlug.toUpperCase().replace(/-/g, '_');
      const layers: LayerExecuted[] = [
        { layer: 'AGENT_ROUTING', status: 'completed' },
        { layer: `COPILOT_${agentName}`, status: 'completed', duration_ms: routingDuration },
      ];

      const statusCode = agentResult.status === 'success' ? 200 : 422;
      sendJson(res, statusCode, wrapResponse(agentResult, executionMetadata, layers));
      return;
    } catch (err) {
      const agentName = agentSlug.toUpperCase().replace(/-/g, '_');
      const layers: LayerExecuted[] = [
        { layer: 'AGENT_ROUTING', status: 'completed' },
        { layer: `COPILOT_${agentName}`, status: 'error', duration_ms: Date.now() - startTime },
      ];
      const errorMessage = err instanceof Error ? err.message : 'Internal server error';
      sendJson(res, 500, wrapResponse(
        { error: errorMessage },
        executionMetadata,
        layers
      ));
      return;
    }
  }

  // 404 for unmatched routes
  const layers: LayerExecuted[] = [
    { layer: 'AGENT_ROUTING', status: 'error' },
  ];
  sendJson(res, 404, wrapResponse(
    {
      error: 'Not found',
      available_routes: [
        'POST /v1/copilot/planner',
        'POST /v1/copilot/config',
        'POST /v1/copilot/decomposer',
        'POST /v1/copilot/clarifier',
        'POST /v1/copilot/intent',
        'POST /v1/copilot/reflection',
        'POST /v1/copilot/meta-reasoner',
        'GET /health',
      ],
    },
    executionMetadata,
    layers
  ));
}
