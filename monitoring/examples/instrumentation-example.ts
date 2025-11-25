/**
 * LLM-CoPilot-Agent Instrumentation Example
 *
 * This file demonstrates how to implement comprehensive monitoring
 * using OpenTelemetry for metrics, logging, and tracing.
 *
 * Version: 1.0.0
 * Last Updated: 2025-11-25
 */

import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api-metrics';
import { AsyncLocalStorage } from 'async_hooks';

// ============================================================================
// LOGGER SETUP WITH STRUCTURED LOGGING
// ============================================================================

interface LogContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
}

class StructuredLogger {
  private contextStorage = new AsyncLocalStorage<LogContext>();

  private formatLog(
    level: string,
    message: string,
    metadata?: Record<string, any>
  ): string {
    const ctx = this.contextStorage.getStore();
    const span = trace.getActiveSpan();

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'llm-copilot-agent',
      version: process.env.APP_VERSION,
      environment: process.env.NODE_ENV,

      // Correlation tracking
      correlation_id: ctx?.correlationId,
      trace_id: span?.spanContext().traceId || ctx?.traceId,
      span_id: span?.spanContext().spanId || ctx?.spanId,

      // User context
      user_id: ctx?.userId,
      session_id: ctx?.sessionId,

      // Infrastructure context
      pod_name: process.env.POD_NAME,
      node_name: process.env.NODE_NAME,
      region: process.env.AWS_REGION,

      // Additional metadata
      ...metadata,
    };

    return JSON.stringify(logEntry);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    console.debug(this.formatLog('DEBUG', message, metadata));
  }

  info(message: string, metadata?: Record<string, any>): void {
    console.info(this.formatLog('INFO', message, metadata));
  }

  warn(message: string, metadata?: Record<string, any>): void {
    console.warn(this.formatLog('WARN', message, metadata));
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorMetadata = error ? {
      'error.type': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
      ...metadata,
    } : metadata;

    console.error(this.formatLog('ERROR', message, errorMetadata));
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorMetadata = error ? {
      'error.type': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
      ...metadata,
    } : metadata;

    console.error(this.formatLog('FATAL', message, errorMetadata));

    // Optionally trigger immediate alert
    process.exit(1);
  }

  setContext(context: Partial<LogContext>): void {
    const currentContext = this.contextStorage.getStore() || {} as LogContext;
    this.contextStorage.enterWith({ ...currentContext, ...context });
  }

  withContext<T>(context: Partial<LogContext>, fn: () => T): T {
    const currentContext = this.contextStorage.getStore() || {} as LogContext;
    return this.contextStorage.run({ ...currentContext, ...context }, fn);
  }
}

export const logger = new StructuredLogger();

// ============================================================================
// METRICS SETUP
// ============================================================================

const meter = metrics.getMeter('llm-copilot-agent', '1.0.0');

// Request metrics
export const httpRequestsTotal = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

export const httpRequestDuration = meter.createHistogram(
  'http_request_duration_seconds',
  {
    description: 'HTTP request latency in seconds',
    unit: 'seconds',
  }
);

// Business metrics
export const sessionsActive = meter.createUpDownCounter('sessions_active', {
  description: 'Current number of active user sessions',
});

export const conversationsTotal = meter.createCounter('conversations_total', {
  description: 'Total number of conversations',
});

export const messagesTotal = meter.createCounter('messages_total', {
  description: 'Total number of messages processed',
});

// LLM metrics
export const llmRequestsTotal = meter.createCounter('llm_requests_total', {
  description: 'Total number of LLM API requests',
});

export const llmRequestDuration = meter.createHistogram(
  'llm_request_duration_seconds',
  {
    description: 'LLM API request duration in seconds',
    unit: 'seconds',
  }
);

export const llmTokensTotal = meter.createCounter('llm_tokens_total', {
  description: 'Total number of tokens consumed',
});

export const llmCostUsd = meter.createCounter('llm_cost_usd', {
  description: 'Total LLM API cost in USD',
});

// Module integration metrics
export const moduleRequestsTotal = meter.createCounter('module_requests_total', {
  description: 'Total requests to integrated modules',
});

export const moduleRequestDuration = meter.createHistogram(
  'module_request_duration_seconds',
  {
    description: 'Module request duration in seconds',
    unit: 'seconds',
  }
);

// Infrastructure metrics
export const dbQueryDuration = meter.createHistogram(
  'db_query_duration_seconds',
  {
    description: 'Database query execution time',
    unit: 'seconds',
  }
);

export const dbConnectionsActive = meter.createUpDownCounter(
  'db_connections_active',
  {
    description: 'Number of active database connections',
  }
);

export const redisCommandsTotal = meter.createCounter('redis_commands_total', {
  description: 'Total number of Redis commands executed',
});

// ============================================================================
// TRACING SETUP
// ============================================================================

const tracer = trace.getTracer('llm-copilot-agent', '1.0.0');

/**
 * Create a traced function wrapper
 */
export function traced<T extends (...args: any[]) => any>(
  spanName: string,
  options?: {
    attributes?: Record<string, any>;
    kind?: any;
  }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return tracer.startActiveSpan(
        spanName,
        {
          kind: options?.kind,
          attributes: options?.attributes,
        },
        async (span: Span) => {
          try {
            const result = await originalMethod.apply(this, args);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            span.recordException(error);
            throw error;
          } finally {
            span.end();
          }
        }
      );
    };

    return descriptor;
  };
}

// ============================================================================
// HTTP REQUEST HANDLER WITH FULL INSTRUMENTATION
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export class InstrumentedRequestHandler {
  /**
   * Middleware to instrument HTTP requests
   */
  static instrumentRequest(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

    // Set correlation context
    logger.setContext({
      correlationId,
      userId: req.user?.id,
      sessionId: req.session?.id,
    });

    // Start tracing span
    const span = tracer.startSpan(`HTTP ${req.method} ${req.route?.path || req.path}`, {
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.headers['user-agent'],
        'http.route': req.route?.path,
        'correlation.id': correlationId,
      },
    });

    // Log request
    logger.info('HTTP request received', {
      http: {
        method: req.method,
        path: req.path,
        user_agent: req.headers['user-agent'],
      },
    });

    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
      const duration = (Date.now() - startTime) / 1000;
      const statusCode = res.statusCode;

      // Record metrics
      httpRequestsTotal.add(1, {
        method: req.method,
        endpoint: req.route?.path || 'unknown',
        status_code: statusCode.toString(),
        environment: process.env.NODE_ENV,
      });

      httpRequestDuration.record(duration, {
        method: req.method,
        endpoint: req.route?.path || 'unknown',
        status_code: statusCode.toString(),
      });

      // Update span
      span.setAttribute('http.status_code', statusCode);
      span.setAttribute('http.response_content_length', body?.length || 0);

      if (statusCode >= 500) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${statusCode}`,
        });
      }

      // Log response
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      logger[logLevel]('HTTP request completed', {
        http: {
          method: req.method,
          path: req.path,
          status: statusCode,
        },
        duration_ms: duration * 1000,
      });

      span.end();
      return originalSend.call(this, body);
    };

    // Set correlation ID in response header
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }

  /**
   * Example: Process user query with full instrumentation
   */
  @traced('processUserQuery', {
    attributes: { 'component': 'query-processor' },
  })
  async processUserQuery(userId: string, query: string): Promise<any> {
    const span = trace.getActiveSpan();
    span?.setAttributes({
      'user.id': userId,
      'query.length': query.length,
    });

    logger.info('Processing user query', {
      component: 'query-processor',
      function: 'processUserQuery',
      user_id: userId,
      query_length: query.length,
    });

    try {
      // Step 1: Classify intent
      const intent = await this.classifyIntent(query);
      span?.addEvent('intent.classified', {
        'intent.type': intent.type,
        'intent.confidence': intent.confidence,
      });

      // Step 2: Call LLM
      const response = await this.callLLM(query, intent);

      // Step 3: Format response
      const formattedResponse = await this.formatResponse(response);

      logger.info('User query processed successfully', {
        component: 'query-processor',
        intent_type: intent.type,
        response_length: formattedResponse.length,
      });

      return formattedResponse;
    } catch (error) {
      logger.error('Failed to process user query', error, {
        component: 'query-processor',
        user_id: userId,
      });
      throw error;
    }
  }

  /**
   * Example: Classify intent with instrumentation
   */
  @traced('classifyIntent', {
    attributes: { 'component': 'intent-classifier' },
  })
  private async classifyIntent(query: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Simulate intent classification
      const intent = {
        type: 'test_generation',
        confidence: 0.95,
        entities: {},
      };

      logger.debug('Intent classified', {
        component: 'intent-classifier',
        intent_type: intent.type,
        confidence: intent.confidence,
      });

      return intent;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      // Record custom metric if needed
    }
  }

  /**
   * Example: Call LLM with comprehensive instrumentation
   */
  @traced('callLLM', {
    attributes: { 'component': 'llm-client' },
  })
  private async callLLM(query: string, intent: any): Promise<any> {
    const startTime = Date.now();
    const span = trace.getActiveSpan();

    const provider = 'anthropic';
    const model = 'claude-3-sonnet';

    span?.setAttributes({
      'llm.provider': provider,
      'llm.model': model,
      'llm.operation': 'completion',
      'llm.request.temperature': 0.7,
      'llm.request.max_tokens': 1000,
    });

    logger.info('Calling LLM API', {
      component: 'llm-client',
      provider,
      model,
    });

    try {
      // Simulate LLM API call
      const response = {
        content: 'Generated response',
        inputTokens: 150,
        outputTokens: 250,
        finishReason: 'complete',
      };

      const duration = (Date.now() - startTime) / 1000;

      // Record metrics
      llmRequestsTotal.add(1, {
        provider,
        model,
        intent: intent.type,
        status: 'success',
      });

      llmRequestDuration.record(duration, {
        provider,
        model,
        intent: intent.type,
      });

      llmTokensTotal.add(response.inputTokens, {
        provider,
        model,
        token_type: 'input',
        intent: intent.type,
      });

      llmTokensTotal.add(response.outputTokens, {
        provider,
        model,
        token_type: 'output',
        intent: intent.type,
      });

      // Calculate cost (example: $0.003 per 1K input tokens, $0.015 per 1K output tokens)
      const cost = (response.inputTokens / 1000) * 0.003 +
                   (response.outputTokens / 1000) * 0.015;

      llmCostUsd.add(cost, {
        provider,
        model,
        environment: process.env.NODE_ENV,
      });

      span?.setAttributes({
        'llm.request.input_tokens': response.inputTokens,
        'llm.response.output_tokens': response.outputTokens,
        'llm.response.finish_reason': response.finishReason,
        'llm.cost_usd': cost,
      });

      logger.info('LLM API call completed', {
        component: 'llm-client',
        provider,
        model,
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
        cost_usd: cost,
        duration_ms: duration * 1000,
      });

      return response;
    } catch (error) {
      llmRequestsTotal.add(1, {
        provider,
        model,
        intent: intent.type,
        status: 'error',
      });

      logger.error('LLM API call failed', error, {
        component: 'llm-client',
        provider,
        model,
      });

      throw error;
    }
  }

  /**
   * Example: Database query with instrumentation
   */
  @traced('dbQuery', {
    attributes: { 'component': 'database' },
  })
  private async queryDatabase(query: string): Promise<any> {
    const startTime = Date.now();
    const span = trace.getActiveSpan();

    span?.setAttributes({
      'db.system': 'postgresql',
      'db.name': process.env.DB_NAME,
      'db.operation': 'SELECT',
      'db.statement': query,  // Ensure this is parameterized
    });

    dbConnectionsActive.add(1, {
      pool_name: 'primary',
      state: 'active',
    });

    try {
      // Simulate database query
      const result = { rows: [] };

      const duration = (Date.now() - startTime) / 1000;

      dbQueryDuration.record(duration, {
        operation: 'SELECT',
        table: 'conversations',
      });

      span?.setAttribute('db.rows_affected', result.rows.length);

      if (duration > 1.0) {
        logger.warn('Slow database query detected', {
          component: 'database',
          operation: 'SELECT',
          duration_ms: duration * 1000,
          query: query.substring(0, 100),  // Truncate for logging
        });
      }

      return result;
    } finally {
      dbConnectionsActive.add(-1, {
        pool_name: 'primary',
        state: 'active',
      });
    }
  }

  /**
   * Example: Redis operation with instrumentation
   */
  @traced('redisOperation', {
    attributes: { 'component': 'cache' },
  })
  private async getFromCache(key: string): Promise<any> {
    const span = trace.getActiveSpan();

    span?.setAttributes({
      'db.system': 'redis',
      'db.operation': 'GET',
      'cache.key': key,
    });

    redisCommandsTotal.add(1, {
      command: 'GET',
      status: 'success',
    });

    // Simulate cache get
    const value = null;  // Cache miss
    const hit = value !== null;

    span?.setAttribute('cache.hit', hit);

    if (!hit) {
      span?.addEvent('cache.miss', { 'cache.key': key });
      logger.debug('Cache miss', {
        component: 'cache',
        operation: 'GET',
        key,
      });
    }

    return value;
  }

  private async formatResponse(response: any): Promise<any> {
    return response;
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

export async function exampleUsage() {
  const handler = new InstrumentedRequestHandler();

  // This will create a full trace with spans for:
  // - processUserQuery
  // - classifyIntent
  // - callLLM
  // - formatResponse
  //
  // And will emit metrics for:
  // - Request count and duration
  // - LLM tokens and cost
  // - Database queries
  // - Cache operations
  //
  // And will log structured JSON logs at each step
  const result = await handler.processUserQuery('user-123', 'Generate tests for my API');

  return result;
}
