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
/**
 * Agent Classification enum
 */
export declare const AgentClassification: {
    readonly CONFIGURATION_VALIDATION: "CONFIGURATION_VALIDATION";
    readonly STATIC_ANALYSIS: "STATIC_ANALYSIS";
    readonly PLANNING: "PLANNING";
    readonly STRUCTURAL_SYNTHESIS: "STRUCTURAL_SYNTHESIS";
    readonly INTENT_ANALYSIS: "INTENT_ANALYSIS";
    readonly DECOMPOSITION: "DECOMPOSITION";
    readonly POST_EXECUTION_ANALYSIS: "POST_EXECUTION_ANALYSIS";
    readonly QUALITY_ASSESSMENT: "QUALITY_ASSESSMENT";
    readonly META_ANALYSIS: "META_ANALYSIS";
    readonly REASONING_QUALITY_ASSESSMENT: "REASONING_QUALITY_ASSESSMENT";
};
export type AgentClassificationType = typeof AgentClassification[keyof typeof AgentClassification];
/**
 * Base Agent Metadata Schema
 */
export declare const AgentMetadataSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    classifications: z.ZodArray<z.ZodString, "many">;
    decision_type: z.ZodString;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    decision_type: string;
    id: string;
    name: string;
    version: string;
    classifications: string[];
    description: string;
}, {
    decision_type: string;
    id: string;
    name: string;
    version: string;
    classifications: string[];
    description: string;
}>;
export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;
/**
 * Agent Invocation Result - wraps DecisionEvent with status
 */
export declare const AgentResultSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"success">;
    event: z.ZodObject<{
        agent_id: z.ZodString;
        agent_version: z.ZodString;
        decision_type: z.ZodString;
        inputs_hash: z.ZodString;
        outputs: z.ZodUnknown;
        confidence: z.ZodNumber;
        constraints_applied: z.ZodArray<z.ZodString, "many">;
        execution_ref: z.ZodString;
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
}, "strip", z.ZodTypeAny, {
    status: "success";
    event: {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        inputs_hash: string;
        confidence: number;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        outputs?: unknown;
    };
}, {
    status: "success";
    event: {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        inputs_hash: string;
        confidence: number;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        outputs?: unknown;
    };
}>, z.ZodObject<{
    status: z.ZodLiteral<"error">;
    error_code: z.ZodString;
    error_message: z.ZodString;
    execution_ref: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "error";
    execution_ref: string;
    timestamp: string;
    error_code: string;
    error_message: string;
}, {
    status: "error";
    execution_ref: string;
    timestamp: string;
    error_code: string;
    error_message: string;
}>]>;
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
export declare const AgentErrorCodes: {
    readonly INVALID_INPUT: "AGENT_INVALID_INPUT";
    readonly VALIDATION_FAILED: "AGENT_VALIDATION_FAILED";
    readonly PROCESSING_ERROR: "AGENT_PROCESSING_ERROR";
    readonly PERSISTENCE_ERROR: "AGENT_PERSISTENCE_ERROR";
    readonly TIMEOUT: "AGENT_TIMEOUT";
    readonly UNKNOWN: "AGENT_UNKNOWN_ERROR";
};
export type AgentErrorCode = typeof AgentErrorCodes[keyof typeof AgentErrorCodes];
/**
 * Create an error result
 */
export declare function createErrorResult(errorCode: AgentErrorCode, message: string, executionRef: string): AgentResult;
