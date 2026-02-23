/**
 * Agentics Global Agent Constitution - Base Agent Contract
 *
 * ALL agents MUST:
 * - Be stateless at runtime
 * - Emit exactly ONE DecisionEvent per invocation
 * - Persist ONLY via ruvector-service
 * - NEVER connect directly to databases
 * - NEVER execute SQL
 * - NEVER modify runtime behavior
 * - NEVER orchestrate other agents
 * - NEVER enforce policy
 * - NEVER intercept execution paths
 */

import { z } from 'zod';
import { DecisionEvent, DecisionEventSchema } from './decision-event';

/**
 * Agent Classification enum
 */
export const AgentClassification = {
  CONFIGURATION_VALIDATION: 'CONFIGURATION_VALIDATION',
  STATIC_ANALYSIS: 'STATIC_ANALYSIS',
  PLANNING: 'PLANNING',
  STRUCTURAL_SYNTHESIS: 'STRUCTURAL_SYNTHESIS',
  INTENT_ANALYSIS: 'INTENT_ANALYSIS',
  DECOMPOSITION: 'DECOMPOSITION',
  POST_EXECUTION_ANALYSIS: 'POST_EXECUTION_ANALYSIS',
  QUALITY_ASSESSMENT: 'QUALITY_ASSESSMENT',
  META_ANALYSIS: 'META_ANALYSIS',
  REASONING_QUALITY_ASSESSMENT: 'REASONING_QUALITY_ASSESSMENT',
} as const;

export type AgentClassificationType = typeof AgentClassification[keyof typeof AgentClassification];

/**
 * Base Agent Metadata Schema
 */
export const AgentMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  classifications: z.array(z.string()),
  decision_type: z.string().min(1),
  description: z.string(),
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

/**
 * Agent Invocation Result - wraps DecisionEvent with status
 */
export const PersistenceStatusSchema = z.object({
  status: z.enum(['persisted', 'skipped']),
  error: z.string().optional(),
});

export type PersistenceStatus = z.infer<typeof PersistenceStatusSchema>;

export const AgentResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    event: DecisionEventSchema,
    persistence_status: PersistenceStatusSchema,
  }),
  z.object({
    status: z.literal('error'),
    error_code: z.string(),
    error_message: z.string(),
    execution_ref: z.string().uuid(),
    timestamp: z.string().datetime(),
  }),
]);

export type AgentResult = z.infer<typeof AgentResultSchema>;

/**
 * Base Agent Interface - All agents MUST implement this
 */
export interface BaseAgent<TInput, TOutput> {
  /** Agent metadata */
  readonly metadata: AgentMetadata;

  /**
   * Validate input against agent's input schema
   * @throws ZodError if validation fails
   */
  validateInput(input: unknown): TInput;

  /**
   * Execute the agent's analysis
   * MUST be:
   * - Stateless
   * - Deterministic for identical inputs
   * - Non-blocking (async)
   *
   * MUST NOT:
   * - Execute workflows
   * - Trigger retries
   * - Apply optimizations
   * - Enforce constraints
   * - Block execution
   * - Modify configs
   * - Assign agents
   * - Perform orchestration
   */
  invoke(input: TInput, executionRef: string): Promise<AgentResult>;
}

/**
 * Error codes for agent failures
 */
export const AgentErrorCodes = {
  INVALID_INPUT: 'AGENT_INVALID_INPUT',
  VALIDATION_FAILED: 'AGENT_VALIDATION_FAILED',
  PROCESSING_ERROR: 'AGENT_PROCESSING_ERROR',
  PERSISTENCE_ERROR: 'AGENT_PERSISTENCE_ERROR',
  TIMEOUT: 'AGENT_TIMEOUT',
  UNKNOWN: 'AGENT_UNKNOWN_ERROR',
} as const;

export type AgentErrorCode = typeof AgentErrorCodes[keyof typeof AgentErrorCodes];

/**
 * Create an error result
 */
export function createErrorResult(
  errorCode: AgentErrorCode,
  message: string,
  executionRef: string
): AgentResult {
  return {
    status: 'error',
    error_code: errorCode,
    error_message: message,
    execution_ref: executionRef,
    timestamp: new Date().toISOString(),
  };
}
