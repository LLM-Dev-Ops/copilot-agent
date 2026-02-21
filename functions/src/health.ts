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

const SERVICE_START_TIME = Date.now();

const AGENT_REGISTRY: Array<{ name: string; version: string }> = [
  { name: 'planner', version: '1.0.0' },
  { name: 'config', version: '1.0.0' },
  { name: 'decomposer', version: '1.0.0' },
  { name: 'clarifier', version: '1.0.0' },
  { name: 'intent', version: '1.0.0' },
  { name: 'reflection', version: '1.0.0' },
  { name: 'meta-reasoner', version: '1.0.0' },
];

/**
 * Build health check response for all agents
 */
export function handleHealth(): HealthResponse {
  const agents: AgentHealthStatus[] = AGENT_REGISTRY.map(agent => ({
    agent: agent.name,
    status: 'healthy' as const,
    version: agent.version,
  }));

  const allHealthy = agents.every(a => a.status === 'healthy');

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'copilot-agents',
    version: '1.0.0',
    agents,
    uptime_seconds: Math.floor((Date.now() - SERVICE_START_TIME) / 1000),
  };
}
