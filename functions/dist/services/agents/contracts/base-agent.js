"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentErrorCodes = exports.AgentResultSchema = exports.PersistenceStatusSchema = exports.AgentMetadataSchema = exports.AgentClassification = void 0;
exports.createErrorResult = createErrorResult;
const zod_1 = require("zod");
const decision_event_1 = require("./decision-event");
/**
 * Agent Classification enum
 */
exports.AgentClassification = {
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
};
/**
 * Base Agent Metadata Schema
 */
exports.AgentMetadataSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    version: zod_1.z.string().regex(/^\d+\.\d+\.\d+$/),
    classifications: zod_1.z.array(zod_1.z.string()),
    decision_type: zod_1.z.string().min(1),
    description: zod_1.z.string(),
});
/**
 * Agent Invocation Result - wraps DecisionEvent with status
 */
exports.PersistenceStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['persisted', 'skipped']),
    error: zod_1.z.string().optional(),
});
exports.AgentResultSchema = zod_1.z.discriminatedUnion('status', [
    zod_1.z.object({
        status: zod_1.z.literal('success'),
        event: decision_event_1.DecisionEventSchema,
        persistence_status: exports.PersistenceStatusSchema,
    }),
    zod_1.z.object({
        status: zod_1.z.literal('error'),
        error_code: zod_1.z.string(),
        error_message: zod_1.z.string(),
        execution_ref: zod_1.z.string().uuid(),
        timestamp: zod_1.z.string().datetime(),
    }),
]);
/**
 * Error codes for agent failures
 */
exports.AgentErrorCodes = {
    INVALID_INPUT: 'AGENT_INVALID_INPUT',
    VALIDATION_FAILED: 'AGENT_VALIDATION_FAILED',
    PROCESSING_ERROR: 'AGENT_PROCESSING_ERROR',
    PERSISTENCE_ERROR: 'AGENT_PERSISTENCE_ERROR',
    TIMEOUT: 'AGENT_TIMEOUT',
    UNKNOWN: 'AGENT_UNKNOWN_ERROR',
};
/**
 * Create an error result
 */
function createErrorResult(errorCode, message, executionRef) {
    return {
        status: 'error',
        error_code: errorCode,
        error_message: message,
        execution_ref: executionRef,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=base-agent.js.map