/**
 * Agentics Global Agent Constitution - Decision Event Contract
 *
 * ALL agents MUST emit exactly ONE DecisionEvent per invocation.
 * This is the canonical schema for agent outputs.
 */
import { z } from 'zod';
/**
 * Decision Event Schema - Required fields per constitution
 */
export declare const DecisionEventSchema: z.ZodObject<{
    /** Unique identifier for the agent */
    agent_id: z.ZodString;
    /** Semantic version of the agent */
    agent_version: z.ZodString;
    /** Type of decision made by this agent */
    decision_type: z.ZodString;
    /** SHA-256 hash of inputs for determinism verification */
    inputs_hash: z.ZodString;
    /** Agent outputs - structure varies by decision_type */
    outputs: z.ZodUnknown;
    /** Confidence score (0.0 - 1.0) */
    confidence: z.ZodNumber;
    /** Constraints applied during decision-making */
    constraints_applied: z.ZodArray<z.ZodString, "many">;
    /** Reference ID for execution tracing */
    execution_ref: z.ZodString;
    /** UTC timestamp of decision */
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agent_id: string;
    agent_version: string;
    decision_type: string;
    inputs_hash: string;
    confidence: number;
    constraints_applied: string[];
    execution_ref: string;
    timestamp: string;
    outputs?: unknown;
}, {
    agent_id: string;
    agent_version: string;
    decision_type: string;
    inputs_hash: string;
    confidence: number;
    constraints_applied: string[];
    execution_ref: string;
    timestamp: string;
    outputs?: unknown;
}>;
export type DecisionEvent = z.infer<typeof DecisionEventSchema>;
/**
 * Create a deterministic hash of inputs for reproducibility verification
 */
export declare function hashInputs(inputs: unknown): string;
/**
 * Validate and create a DecisionEvent
 */
export declare function createDecisionEvent(agentId: string, agentVersion: string, decisionType: string, inputs: unknown, outputs: unknown, confidence: number, constraintsApplied: string[], executionRef: string): DecisionEvent;
