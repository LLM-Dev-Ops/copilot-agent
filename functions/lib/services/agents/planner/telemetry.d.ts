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
export declare class Telemetry {
    private readonly config;
    private spans;
    constructor(config: TelemetryConfig);
    /**
     * Record agent invocation start
     */
    recordStart(agentId: string, executionRef: string, input: unknown): void;
    /**
     * Record successful completion
     */
    recordSuccess(agentId: string, executionRef: string, durationMs: number): void;
    /**
     * Record failure
     */
    recordFailure(agentId: string, executionRef: string, errorCode: string, errorMessage: string): void;
    /**
     * Emit a custom event
     */
    emitEvent(eventType: string, data: Record<string, unknown>): void;
    /**
     * Find span by execution ref
     */
    private findSpan;
    /**
     * Generate span ID
     */
    private generateSpanId;
    /**
     * Hash input for telemetry (no sensitive data)
     */
    private hashInput;
    /**
     * Emit span to observatory
     */
    private emitSpan;
    /**
     * Emit metric to observatory
     */
    private emitMetric;
    /**
     * Send data to LLM-Observatory endpoint
     */
    private sendToObservatory;
}
/**
 * Create telemetry from environment
 */
export declare function createTelemetryFromEnv(): Telemetry;
