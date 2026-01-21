/**
 * Agentics Global Agent Constitution - Decision Event Contract
 *
 * ALL agents MUST emit exactly ONE DecisionEvent per invocation.
 * This is the canonical schema for agent outputs.
 */

import { z } from 'zod';
import { createHash } from 'crypto';

/**
 * Decision Event Schema - Required fields per constitution
 */
export const DecisionEventSchema = z.object({
  /** Unique identifier for the agent */
  agent_id: z.string().min(1),

  /** Semantic version of the agent */
  agent_version: z.string().regex(/^\d+\.\d+\.\d+$/),

  /** Type of decision made by this agent */
  decision_type: z.string().min(1),

  /** SHA-256 hash of inputs for determinism verification */
  inputs_hash: z.string().length(64),

  /** Agent outputs - structure varies by decision_type */
  outputs: z.unknown(),

  /** Confidence score (0.0 - 1.0) */
  confidence: z.number().min(0).max(1),

  /** Constraints applied during decision-making */
  constraints_applied: z.array(z.string()),

  /** Reference ID for execution tracing */
  execution_ref: z.string().uuid(),

  /** UTC timestamp of decision */
  timestamp: z.string().datetime(),
});

export type DecisionEvent = z.infer<typeof DecisionEventSchema>;

/**
 * Create a deterministic hash of inputs for reproducibility verification
 */
export function hashInputs(inputs: unknown): string {
  const normalized = JSON.stringify(inputs, Object.keys(inputs as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Validate and create a DecisionEvent
 */
export function createDecisionEvent(
  agentId: string,
  agentVersion: string,
  decisionType: string,
  inputs: unknown,
  outputs: unknown,
  confidence: number,
  constraintsApplied: string[],
  executionRef: string
): DecisionEvent {
  const event: DecisionEvent = {
    agent_id: agentId,
    agent_version: agentVersion,
    decision_type: decisionType,
    inputs_hash: hashInputs(inputs),
    outputs,
    confidence,
    constraints_applied: constraintsApplied,
    execution_ref: executionRef,
    timestamp: new Date().toISOString(),
  };

  // Validate against schema
  return DecisionEventSchema.parse(event);
}
