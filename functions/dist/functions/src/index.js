"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const crypto = __importStar(require("crypto"));
const router_1 = require("./router");
const health_1 = require("./health");
const cors_1 = require("./cors");
const envelope_1 = require("./envelope");
/**
 * Parse JSON body from request
 */
function parseBody(req) {
    // Cloud Functions automatically parse JSON bodies into req.body
    if (req.body !== undefined) {
        return req.body;
    }
    return undefined;
}
/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
/**
 * Main Cloud Function handler
 *
 * Entry point name: handler
 */
async function handler(req, res) {
    const startTime = Date.now();
    // CORS headers on every response
    (0, cors_1.setCorsHeaders)(res);
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        (0, cors_1.handlePreflight)(res);
        return;
    }
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    // Build execution metadata
    const traceId = req.headers['x-correlation-id'] || crypto.randomUUID();
    const executionId = crypto.randomUUID();
    const executionMetadata = {
        trace_id: traceId,
        timestamp: new Date().toISOString(),
        service: 'copilot-agents',
        execution_id: executionId,
    };
    // Health endpoint
    if (pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        const healthResult = (0, health_1.handleHealth)();
        const layers = [
            { layer: 'AGENT_ROUTING', status: 'completed' },
            { layer: 'HEALTH_CHECK', status: 'completed', duration_ms: Date.now() - startTime },
        ];
        sendJson(res, 200, (0, envelope_1.wrapResponse)(healthResult, executionMetadata, layers));
        return;
    }
    // Agent routes: POST /v1/copilot/{agent}
    if (req.method === 'POST' && pathname.startsWith('/v1/copilot/')) {
        const agentSlug = pathname.replace('/v1/copilot/', '').replace(/\/$/, '');
        const body = parseBody(req);
        if (!body || typeof body !== 'object') {
            const layers = [
                { layer: 'AGENT_ROUTING', status: 'completed' },
            ];
            sendJson(res, 400, (0, envelope_1.wrapResponse)({ error: 'Request body must be a JSON object' }, executionMetadata, layers));
            return;
        }
        try {
            const routingLayerStart = Date.now();
            const routeResult = await (0, router_1.routeRequest)(agentSlug, body);
            const routingDuration = Date.now() - routingLayerStart;
            const agentName = agentSlug.toUpperCase().replace(/-/g, '_');
            const layers = [
                { layer: 'AGENT_ROUTING', status: 'completed' },
                { layer: `COPILOT_${agentName}`, status: 'completed', duration_ms: routingDuration },
            ];
            // Build per-agent execution_metadata
            const agentMeta = {
                trace_id: traceId,
                agent: agentSlug,
                domain: 'copilot',
                timestamp: new Date().toISOString(),
            };
            if (routeResult.pipelineContext) {
                agentMeta.pipeline_context = routeResult.pipelineContext;
            }
            // Wrap the agent result with per-agent execution_metadata
            const wrappedResult = (0, envelope_1.wrapAgentResult)(routeResult.agentResult, agentMeta);
            const statusCode = routeResult.agentResult.status === 'success' ? 200 : 422;
            sendJson(res, statusCode, (0, envelope_1.wrapResponse)(wrappedResult, executionMetadata, layers));
            return;
        }
        catch (err) {
            const agentName = agentSlug.toUpperCase().replace(/-/g, '_');
            const layers = [
                { layer: 'AGENT_ROUTING', status: 'completed' },
                { layer: `COPILOT_${agentName}`, status: 'error', duration_ms: Date.now() - startTime },
            ];
            const errorMessage = err instanceof Error ? err.message : 'Internal server error';
            sendJson(res, 500, (0, envelope_1.wrapResponse)({ error: errorMessage }, executionMetadata, layers));
            return;
        }
    }
    // 404 for unmatched routes
    const layers = [
        { layer: 'AGENT_ROUTING', status: 'error' },
    ];
    sendJson(res, 404, (0, envelope_1.wrapResponse)({
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
    }, executionMetadata, layers));
}
//# sourceMappingURL=index.js.map