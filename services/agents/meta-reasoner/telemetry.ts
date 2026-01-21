/**
 * Telemetry for LLM-Observatory - Meta-Reasoner Agent
 *
 * Per Constitution: All agents MUST emit telemetry compatible with LLM-Observatory.
 */

import { Telemetry as BaseTelemetry } from '../planner/telemetry';

/**
 * Create telemetry configured for Meta-Reasoner Agent
 */
export function createTelemetryFromEnv(): BaseTelemetry {
  return new BaseTelemetry({
    endpoint: process.env.LLM_OBSERVATORY_ENDPOINT,
    serviceName: 'meta-reasoner-agent',
    serviceVersion: '1.0.0',
    enabled: process.env.TELEMETRY_ENABLED !== 'false',
  });
}

// Re-export Telemetry class for typing
export { Telemetry } from '../planner/telemetry';
