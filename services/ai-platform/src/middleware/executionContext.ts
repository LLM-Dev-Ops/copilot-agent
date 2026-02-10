/**
 * Execution Context Middleware for Agentics ExecutionGraph integration.
 *
 * Enforces the Foundational Execution Unit contract:
 * - Extracts execution_id and parent_span_id from request headers
 * - Rejects requests without X-Parent-Span-Id (Rule 1)
 * - Creates a repo-level execution span on entry (Rule 2)
 * - Makes the ExecutionGraphBuilder available to handlers via req.executionGraph
 * - Intercepts res.json() to attach the execution graph to responses
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ExecutionGraphBuilder } from '../../../agents/contracts/execution-graph';

/** Header names for execution context propagation. */
export const HEADER_EXECUTION_ID = 'x-execution-id';
export const HEADER_PARENT_SPAN_ID = 'x-parent-span-id';
export const HEADER_TRACE_ID = 'x-trace-id';

/** Extend Express Request to include the execution graph. */
declare global {
  namespace Express {
    interface Request {
      executionGraph?: ExecutionGraphBuilder;
    }
  }
}

/**
 * Express middleware that enforces execution context tracking.
 *
 * Rejects with 400 if X-Parent-Span-Id header is missing.
 * Attaches an ExecutionGraphBuilder to req.executionGraph.
 * Intercepts res.json() to include the execution_graph in the response body.
 */
export function executionContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const parentSpanId = req.headers[HEADER_PARENT_SPAN_ID] as string | undefined;

  if (!parentSpanId) {
    res.status(400).json({
      error: {
        code: 'MISSING_PARENT_SPAN_ID',
        message: 'X-Parent-Span-Id header is required for execution tracking',
      },
    });
    return;
  }

  const executionId = (req.headers[HEADER_EXECUTION_ID] as string) || randomUUID();

  // Extract trace_id from traceparent or x-trace-id header
  let traceId = req.headers[HEADER_TRACE_ID] as string | undefined;
  if (!traceId) {
    const traceparent = req.headers['traceparent'] as string | undefined;
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 4) {
        traceId = parts[1];
      }
    }
  }
  traceId = traceId || randomUUID().replace(/-/g, '');

  const graph = new ExecutionGraphBuilder(executionId, parentSpanId, traceId);
  req.executionGraph = graph;

  // Intercept res.json to attach execution graph to the response
  const originalJson = res.json.bind(res);
  res.json = function (body: any): Response {
    try {
      graph.completeRepo();
    } catch {
      // No agent spans or other validation failure — mark as failed
      graph.failRepo('Execution validation failed: no agent spans emitted');
    }

    const responseBody = {
      ...body,
      execution_graph: graph.toJSON(),
    };

    return originalJson(responseBody);
  };

  next();
}
