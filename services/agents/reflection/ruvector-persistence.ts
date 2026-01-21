/**
 * RuVector Persistence Layer for Reflection Agent
 *
 * Per Constitution: Agents persist ONLY via ruvector-service.
 * NEVER connect directly to Google SQL.
 * NEVER execute SQL.
 */

import { DecisionEvent } from '../contracts';

export interface RuvectorConfig {
  endpoint: string;
  apiKey?: string;
  namespace: string;
  timeout?: number;
}

/**
 * RuVector Persistence Service
 *
 * Handles all persistence operations through the ruvector-service.
 * This is the ONLY allowed persistence mechanism per constitution.
 */
export class RuvectorPersistence {
  private readonly config: RuvectorConfig;

  constructor(config: RuvectorConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Store a DecisionEvent in ruvector
   */
  async store(event: DecisionEvent): Promise<{ id: string; stored: boolean }> {
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
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw new Error(`RuVector persistence failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { id?: string };
    return {
      id: result.id || event.execution_ref,
      stored: true,
    };
  }

  /**
   * Retrieve a DecisionEvent by execution reference
   */
  async retrieve(executionRef: string): Promise<DecisionEvent | null> {
    const url = `${this.config.endpoint}/api/v1/events/${executionRef}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        'X-Namespace': this.config.namespace,
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`RuVector retrieval failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { payload: DecisionEvent };
    return result.payload;
  }

  /**
   * Search for DecisionEvents by agent and decision type
   */
  async search(params: {
    agentId?: string;
    decisionType?: string;
    fromTimestamp?: string;
    toTimestamp?: string;
    limit?: number;
  }): Promise<DecisionEvent[]> {
    const queryParams = new URLSearchParams();
    if (params.agentId) queryParams.set('agent_id', params.agentId);
    if (params.decisionType) queryParams.set('decision_type', params.decisionType);
    if (params.fromTimestamp) queryParams.set('from', params.fromTimestamp);
    if (params.toTimestamp) queryParams.set('to', params.toTimestamp);
    if (params.limit) queryParams.set('limit', params.limit.toString());

    const url = `${this.config.endpoint}/api/v1/events?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        'X-Namespace': this.config.namespace,
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw new Error(`RuVector search failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { events?: Array<{ payload: DecisionEvent }> };
    return (result.events || []).map((e) => e.payload);
  }

  /**
   * Retrieve multiple DecisionEvents for reflection analysis
   */
  async retrieveForReflection(params: {
    agentIds?: string[];
    decisionTypes?: string[];
    fromTimestamp?: string;
    toTimestamp?: string;
    limit?: number;
  }): Promise<DecisionEvent[]> {
    // Build search params - if multiple agent IDs, search each
    const allEvents: DecisionEvent[] = [];

    if (params.agentIds && params.agentIds.length > 0) {
      for (const agentId of params.agentIds) {
        const events = await this.search({
          agentId,
          fromTimestamp: params.fromTimestamp,
          toTimestamp: params.toTimestamp,
          limit: params.limit,
        });
        allEvents.push(...events);
      }
    } else {
      const events = await this.search({
        fromTimestamp: params.fromTimestamp,
        toTimestamp: params.toTimestamp,
        limit: params.limit,
      });
      allEvents.push(...events);
    }

    // Filter by decision types if specified
    if (params.decisionTypes && params.decisionTypes.length > 0) {
      return allEvents.filter(e => params.decisionTypes!.includes(e.decision_type));
    }

    return allEvents;
  }
}

/**
 * Create RuVector persistence from environment
 */
export function createRuvectorFromEnv(): RuvectorPersistence {
  const endpoint = process.env.RUVECTOR_ENDPOINT || 'http://localhost:8081';
  const apiKey = process.env.RUVECTOR_API_KEY;
  const namespace = process.env.RUVECTOR_NAMESPACE || 'agents';

  return new RuvectorPersistence({
    endpoint,
    apiKey,
    namespace,
  });
}
