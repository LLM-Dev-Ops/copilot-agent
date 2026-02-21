/**
 * Cloud Function Handler Tests
 *
 * Tests for the copilot-agents Cloud Function entry point.
 * Validates routing, CORS, health, execution_metadata, and layers_executed.
 */

import { handler, CfRequest, CfResponse } from './index';
import { IncomingMessage, ServerResponse } from 'http';

// Helper to create mock request
function mockRequest(method: string, url: string, body?: unknown, headers?: Record<string, string>): CfRequest {
  const req = {
    method,
    url,
    headers: { host: 'localhost', ...headers },
    body,
  } as CfRequest;
  return req;
}

// Helper to create mock response and capture output
function mockResponse(): { res: CfResponse; getResult: () => { statusCode: number; headers: Record<string, string>; body: unknown } } {
  const result = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    ended: false,
  };

  const res = {
    writeHead(code: number, headers?: Record<string, string>) {
      result.statusCode = code;
      if (headers) {
        Object.assign(result.headers, headers);
      }
      return this;
    },
    setHeader(key: string, value: string) {
      result.headers[key] = value;
      return this;
    },
    end(data?: string) {
      result.ended = true;
      if (data) {
        try {
          result.body = JSON.parse(data);
        } catch {
          result.body = data;
        }
      }
    },
  } as unknown as CfResponse;

  return {
    res,
    getResult: () => ({ statusCode: result.statusCode, headers: result.headers, body: result.body }),
  };
}

describe('Cloud Function Handler', () => {
  describe('CORS', () => {
    it('should set CORS headers on all responses', async () => {
      const req = mockRequest('GET', '/health');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(result.headers['Access-Control-Allow-Headers']).toContain('X-Correlation-Id');
    });

    it('should handle OPTIONS preflight with 204', async () => {
      const req = mockRequest('OPTIONS', '/v1/copilot/planner');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect(result.statusCode).toBe(204);
    });
  });

  describe('Health Endpoint', () => {
    it('should return health status with all 7 agents', async () => {
      const req = mockRequest('GET', '/health');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect(result.statusCode).toBe(200);
      const body = result.body as {
        data: { status: string; agents: Array<{ agent: string }> };
        execution_metadata: { service: string; trace_id: string };
        layers_executed: Array<{ layer: string }>;
      };

      expect(body.data.status).toBe('healthy');
      expect(body.data.agents).toHaveLength(7);

      const agentNames = body.data.agents.map(a => a.agent);
      expect(agentNames).toContain('planner');
      expect(agentNames).toContain('config');
      expect(agentNames).toContain('decomposer');
      expect(agentNames).toContain('clarifier');
      expect(agentNames).toContain('intent');
      expect(agentNames).toContain('reflection');
      expect(agentNames).toContain('meta-reasoner');
    });

    it('should include execution_metadata in health response', async () => {
      const req = mockRequest('GET', '/health');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const body = getResult().body as {
        execution_metadata: { service: string; trace_id: string; execution_id: string; timestamp: string };
      };

      expect(body.execution_metadata.service).toBe('copilot-agents');
      expect(body.execution_metadata.trace_id).toBeDefined();
      expect(body.execution_metadata.execution_id).toBeDefined();
      expect(body.execution_metadata.timestamp).toBeDefined();
    });

    it('should include layers_executed in health response', async () => {
      const req = mockRequest('GET', '/health');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const body = getResult().body as {
        layers_executed: Array<{ layer: string; status: string }>;
      };

      expect(body.layers_executed).toHaveLength(2);
      expect(body.layers_executed[0].layer).toBe('AGENT_ROUTING');
      expect(body.layers_executed[1].layer).toBe('HEALTH_CHECK');
    });
  });

  describe('Execution Metadata', () => {
    it('should use x-correlation-id header as trace_id', async () => {
      const traceId = '12345-abcde-67890';
      const req = mockRequest('GET', '/health', undefined, { 'x-correlation-id': traceId });
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const body = getResult().body as {
        execution_metadata: { trace_id: string };
      };

      expect(body.execution_metadata.trace_id).toBe(traceId);
    });

    it('should generate trace_id if x-correlation-id not provided', async () => {
      const req = mockRequest('GET', '/health');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const body = getResult().body as {
        execution_metadata: { trace_id: string };
      };

      expect(body.execution_metadata.trace_id).toBeDefined();
      expect(body.execution_metadata.trace_id.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Routing', () => {
    it('should return 400 for POST without body', async () => {
      const req = mockRequest('POST', '/v1/copilot/planner');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect(result.statusCode).toBe(400);
    });

    it('should return 404 for unknown routes', async () => {
      const req = mockRequest('GET', '/unknown');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect(result.statusCode).toBe(404);
      const body = result.body as { data: { available_routes: string[] } };
      expect(body.data.available_routes).toHaveLength(8);
    });

    it('should include layers_executed on error responses', async () => {
      const req = mockRequest('GET', '/not-found');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const body = getResult().body as {
        layers_executed: Array<{ layer: string; status: string }>;
        execution_metadata: { service: string };
      };

      expect(body.layers_executed).toBeDefined();
      expect(body.execution_metadata.service).toBe('copilot-agents');
    });

    it('should route POST /v1/copilot/planner to PlannerAgent', async () => {
      const req = mockRequest('POST', '/v1/copilot/planner', {
        objective: 'Build a test system',
      });
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      // Should succeed (200) or validation error (422) but NOT 404
      expect([200, 422, 500]).toContain(result.statusCode);
      const body = result.body as {
        execution_metadata: { service: string };
        layers_executed: Array<{ layer: string }>;
      };
      expect(body.execution_metadata.service).toBe('copilot-agents');
      expect(body.layers_executed.some(l => l.layer === 'COPILOT_PLANNER')).toBe(true);
    });

    it('should route POST /v1/copilot/intent to IntentClassifierAgent', async () => {
      const req = mockRequest('POST', '/v1/copilot/intent', {
        text: 'Create a new user',
      });
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect([200, 422, 500]).toContain(result.statusCode);
      const body = result.body as {
        layers_executed: Array<{ layer: string }>;
      };
      expect(body.layers_executed.some(l => l.layer === 'COPILOT_INTENT')).toBe(true);
    });

    it('should route POST /v1/copilot/decomposer to DecomposerAgent', async () => {
      const req = mockRequest('POST', '/v1/copilot/decomposer', {
        objective: 'Build and deploy a microservice',
      });
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect([200, 422, 500]).toContain(result.statusCode);
      const body = result.body as {
        layers_executed: Array<{ layer: string }>;
      };
      expect(body.layers_executed.some(l => l.layer === 'COPILOT_DECOMPOSER')).toBe(true);
    });
  });
});
