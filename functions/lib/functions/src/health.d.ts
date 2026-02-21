/**
 * Health Check Handler
 *
 * Returns the status of all 7 copilot agents.
 * Agents: planner, config, decomposer, clarifier, intent, reflection, meta-reasoner
 */
export interface AgentHealthStatus {
    agent: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
}
export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    service: string;
    version: string;
    agents: AgentHealthStatus[];
    uptime_seconds: number;
}
/**
 * Build health check response for all agents
 */
export declare function handleHealth(): HealthResponse;
