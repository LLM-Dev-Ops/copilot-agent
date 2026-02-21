"use strict";
/**
 * Telemetry for LLM-Observatory
 *
 * Per Constitution: All agents MUST emit telemetry compatible with LLM-Observatory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetry = void 0;
exports.createTelemetryFromEnv = createTelemetryFromEnv;
/**
 * Telemetry Service for LLM-Observatory compatibility
 */
class Telemetry {
    config;
    spans = [];
    constructor(config) {
        this.config = config;
    }
    /**
     * Record agent invocation start
     */
    recordStart(agentId, executionRef, input) {
        if (!this.config.enabled)
            return;
        const span = {
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
    recordSuccess(agentId, executionRef, durationMs) {
        if (!this.config.enabled)
            return;
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
    recordFailure(agentId, executionRef, errorCode, errorMessage) {
        if (!this.config.enabled)
            return;
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
    emitEvent(eventType, data) {
        if (!this.config.enabled)
            return;
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
    findSpan(executionRef) {
        return this.spans.find(s => s.traceId === executionRef);
    }
    /**
     * Generate span ID
     */
    generateSpanId() {
        return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    /**
     * Hash input for telemetry (no sensitive data)
     */
    hashInput(input) {
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
    emitSpan(span, phase) {
        this.sendToObservatory('spans', { ...span, phase });
    }
    /**
     * Emit metric to observatory
     */
    emitMetric(metric) {
        this.sendToObservatory('metrics', {
            ...metric,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Send data to LLM-Observatory endpoint
     */
    async sendToObservatory(type, data) {
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
        }
        catch {
            // Telemetry failures should not break agent operation
            console.error(`Telemetry send failed for ${type}`);
        }
    }
}
exports.Telemetry = Telemetry;
/**
 * Create telemetry from environment
 */
function createTelemetryFromEnv() {
    return new Telemetry({
        endpoint: process.env.LLM_OBSERVATORY_ENDPOINT,
        serviceName: 'planner-agent',
        serviceVersion: '1.0.0',
        enabled: process.env.TELEMETRY_ENABLED !== 'false',
    });
}
//# sourceMappingURL=telemetry.js.map