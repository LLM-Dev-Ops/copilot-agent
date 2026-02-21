/**
 * RuVector Persistence Layer
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
export declare class RuvectorPersistence {
    private readonly config;
    constructor(config: RuvectorConfig);
    /**
     * Store a DecisionEvent in ruvector
     */
    store(event: DecisionEvent): Promise<{
        id: string;
        stored: boolean;
    }>;
    /**
     * Retrieve a DecisionEvent by execution reference
     */
    retrieve(executionRef: string): Promise<DecisionEvent | null>;
    /**
     * Search for DecisionEvents by agent and decision type
     */
    search(params: {
        agentId?: string;
        decisionType?: string;
        fromTimestamp?: string;
        toTimestamp?: string;
        limit?: number;
    }): Promise<DecisionEvent[]>;
}
/**
 * Create RuVector persistence from environment
 */
export declare function createRuvectorFromEnv(): RuvectorPersistence;
