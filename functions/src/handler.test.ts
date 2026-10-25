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
    headers: { host: 'localhost', 'x-anthropic-api-key': 'test-key', ...headers },
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
    it('should grant an approved origin and permit the required API-key header', async () => {
      const req = mockRequest('GET', '/health', undefined, { origin: 'https://console.agentics.dev' });
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

      expect(result.headers['Access-Control-Allow-Origin']).toBe('https://console.agentics.dev');
      expect(result.headers['Vary']).toBe('Origin');
      expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(result.headers['Access-Control-Allow-Headers']).toContain('X-Correlation-Id');
      expect(result.headers['Access-Control-Allow-Headers']).toContain('X-Anthropic-Api-Key');
    });

    it('should not grant an unapproved origin', async () => {
      const req = mockRequest('GET', '/health', undefined, { origin: 'https://attacker.example' });
      const { res, getResult } = mockResponse();
      await handler(req, res);
      expect(getResult().headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should handle OPTIONS preflight with 204', async () => {
      const req = mockRequest('OPTIONS', '/v1/copilot/planner');
      const { res, getResult } = mockResponse();

      await handler(req, res);
      const result = getResult();

     