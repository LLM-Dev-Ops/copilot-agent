/**
 * Telemetry for LLM-Observatory
 *
 * Per Constitution: All agents MUST emit telemetry compatible with LLM-Observatory.
 */

export interface TelemetryConfig {
  endpoint?: string;
  serviceName: string;
  serviceVersion: string;
  enabled: boolean;
}

export interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
}

/**
 * Telemetry Service for LLM-Observatory compatibility
 */
export class Telemetry {
  private readonly config: TelemetryConfig;
  private spans: TelemetrySpan[] = [];

  constructor(config: TelemetryConfig) {
    this.config = config;
  }

  /**
   * Record agent invocation start
   */
  recordStart(agentId: string, executionRef: string, input: unknown): void {
    if (!this.config.enabled) return;

    const span: TelemetrySpan = {
      traceId: executionRef,
      spanId: this.generateSpanId(),
      name: `agent.${agentId}.invoke`,
      startTime: Date.now(),
      status: 'ok',
      attributes: {
        'agent.id': agentId,
        'agent.version': this.config.serviceVersion,
        'service.name': this.config.serviceName,
        'execution.ref': executionRef,
        'input.hash': this.hashInput(input),
      },
    };

    this.spans.push(span);
    this.emitSpan(span, 'start');
  }

  /**
   * Record successful completion
   */
  recordSuccess(agentId: string, executionRef: string, durationMs: number): void {
    if (!this.config.enabled) return;

    const span = this.findSpan(executionRef);
    if (span) {
      span.endTime = Date.now();
      span.status = 'ok';
      span.attributes['duration.ms'] = durationMs;
      this.emitSpan(span, 'end');
    }

    this.emitMetric({
      name: 'agent.invocation.duration',
      value: durationMs,
      unit: 'ms',
      tags: {
        agent_id: agentId,
        status: 'success',
      },
    });

    this.emitMetric({
      name: 'agent.invocation.count',
      value: 1,
      unit: 'count',
      tags: {
        agent_id: agentId,
        status: 'success',
      },
    });
  }

  /**
   * Record failure
   */
  recordFailure(
    agentId: string,
    executionRef: string,
    errorCode: string,
    errorMessage: string
  ): void {
    if (!this.config.enabled) return;

    const span = this.findSpan(executionRef);
    if (span) {
      span.endTime = Date.now();
      span.status = 'error';
      span.attributes['error.code'] = errorCode;
      span.attributes['error.message'] = errorMessage.substring(0, 256);
      this.emitSpan(span, 'end');
    }

    this.emitMetric({
      name: 'agent.invocation.count',
      value: 1,
      unit: 'count',
      tags: {
        agent_id: agentId,
        status: 'error',
        error_code: errorCode,
      },
    });
  }

  /**
   * Emit a custom event
   */
  emitEvent(eventType: string, data: Record<string, unknown>): void {
    if (!this.config.enabled) return;

    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      version: this.config.serviceVersion,
      data,
    };

    this.sendToObservatory('events', event);
  }

  /**
   * Find span by execution ref
   */
  private findSpan(executionRef: string): TelemetrySpan | undefined {
    return this.spans.find(s => s.traceId === executionRef);
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Hash input for telemetry (no sensitive data)
   */
  private hashInput(input: unknown): string {
    const str = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Emit span to observatory
   */
  private emitSpan(span: TelemetrySpan, phase: 'start' | 'end'): void {
    this.sendToObservatory('spans', { ...span, phase });
  }

  /**
   * Emit metric to observatory
   */
  private emitMetric(metric: {
    name: string;
    value: number;
    unit: string;
    tags: Record<string, string>;
  }): void {
    this.sendToObservatory('metrics', {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send data to LLM-Observatory endpoint
   */
  private async sendToObservatory(
    type: 'spans' | 'metrics' | 'events',
    data: unknown
  ): Promise<void> {
    if (!this.config.endpoint) {
      // Log to console if no endpoint configured
      console.log(`[TELEMETRY:${type}]`, JSON.stringify(data));
      return;
    }

    try {
      await fetch(`${this.config.endpoint}/api/v1/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': this.config.serviceName,
          'X-Service-Version': this.config.serviceVersion,
        },
        body: JSON.stringify(data),
      });
    } catch {
      // Telemetry failures should not break agent operation
      console.error(`Telemetry send failed for ${type}`);
    }
  }
}

/**
 * Create telemetry from environment
 */
export function createTelemetryFromEnv(): Telemetry {
  return new Telemetry({
    endpoint: process.env.LLM_OBSERVATORY_ENDPOINT,
    serviceName: 'objective-clarifier-agent',
    serviceVersion: '1.0.0',
    enabled: process.env.TELEMETRY_ENABLED !== 'false',
  });
}
