/**
 * Telemetry for LLM-Observatory - Meta-Reasoner Agent
 *
 * Per Constitution: All agents MUST emit telemetry compatible with LLM-Observatory.
 */
import { Telemetry as BaseTelemetry } from '../planner/telemetry';
/**
 * Create telemetry configured for Meta-Reasoner Agent
 */
export declare function createTelemetryFromEnv(): BaseTelemetry;
export { Telemetry } from '../planner/telemetry';
