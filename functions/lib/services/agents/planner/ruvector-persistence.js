"use strict";
/**
 * RuVector Persistence Layer
 *
 * Per Constitution: Agents persist ONLY via ruvector-service.
 * NEVER connect directly to Google SQL.
 * NEVER execute SQL.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuvectorPersistence = void 0;
exports.createRuvectorFromEnv = createRuvectorFromEnv;
/**
 * RuVector Persistence Service
 *
 * Handles all persistence operations through the ruvector-service.
 * This is the ONLY allowed persistence mechanism per constitution.
 */
class RuvectorPersistence {
    config;
    constructor(config) {
        this.config = {
            timeout: 30000,
            ...config,
        };
    }
    /**
     * Store a DecisionEvent in ruvector
     */
    async store(event) {
        const url = `${this.config.endpoint}/api/v1/events`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
                'X-Namespace': this.config.namespace,
            },
            body: JSON.stringify({
                event_type: `agent.${event.decision_type}`,
                agent_id: event.agent_id,
                agent_version: event.agent_version,
                payload: event,
                timestamp: event.timestamp,
            }),
            signal: AbortSignal.timeout(this.config.timeout),
        });
        if (!response.ok) {
            throw new Error(`RuVector persistence failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        return {
            id: result.id || event.execution_ref,
            stored: true,
        };
    }
    /**
     * Retrieve a DecisionEvent by execution reference
     */
    async retrieve(executionRef) {
        const url = `${this.config.endpoint}/api/v1/events/${executionRef}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
                'X-Namespace': this.config.namespace,
            },
            signal: AbortSignal.timeout(this.config.timeout),
        });
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw new Error(`RuVector retrieval failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        return result.payload;
    }
    /**
     * Search for DecisionEvents by agent and decision type
     */
    async search(params) {
        const queryParams = new URLSearchParams();
        if (params.agentId)
            queryParams.set('agent_id', params.agentId);
        if (params.decisionType)
            queryParams.set('decision_type', params.decisionType);
        if (params.fromTimestamp)
            queryParams.set('from', params.fromTimestamp);
        if (params.toTimestamp)
            queryParams.set('to', params.toTimestamp);
        if (params.limit)
            queryParams.set('limit', params.limit.toString());
        const url = `${this.config.endpoint}/api/v1/events?${queryParams.toString()}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
                'X-Namespace': this.config.namespace,
            },
            signal: AbortSignal.timeout(this.config.timeout),
        });
        if (!response.ok) {
            throw new Error(`RuVector search failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        return (result.events || []).map((e) => e.payload);
    }
}
exports.RuvectorPersistence = RuvectorPersistence;
/**
 * Create RuVector persistence from environment
 */
function createRuvectorFromEnv() {
    const endpoint = process.env.RUVECTOR_ENDPOINT || 'http://localhost:8081';
    const apiKey = process.env.RUVECTOR_API_KEY;
    const namespace = process.env.RUVECTOR_NAMESPACE || 'agents';
    return new RuvectorPersistence({
        endpoint,
        apiKey,
        namespace,
    });
}
//# sourceMappingURL=ruvector-persistence.js.map