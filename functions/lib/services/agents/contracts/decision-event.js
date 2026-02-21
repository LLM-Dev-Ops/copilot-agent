"use strict";
/**
 * Agentics Global Agent Constitution - Decision Event Contract
 *
 * ALL agents MUST emit exactly ONE DecisionEvent per invocation.
 * This is the canonical schema for agent outputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionEventSchema = void 0;
exports.hashInputs = hashInputs;
exports.createDecisionEvent = createDecisionEvent;
const zod_1 = require("zod");
const crypto_1 = require("crypto");
/**
 * Decision Event Schema - Required fields per constitution
 */
exports.DecisionEventSchema = zod_1.z.object({
    /** Unique identifier for the agent */
    agent_id: zod_1.z.string().min(1),
    /** Semantic version of the agent */
    agent_version: zod_1.z.string().regex(/^\d+\.\d+\.\d+$/),
    /** Type of decision made by this agent */
    decision_type: zod_1.z.string().min(1),
    /** SHA-256 hash of inputs for determinism verification */
    inputs_hash: zod_1.z.string().length(64),
    /** Agent outputs - structure varies by decision_type */
    outputs: zod_1.z.unknown(),
    /** Confidence score (0.0 - 1.0) */
    confidence: zod_1.z.number().min(0).max(1),
    /** Constraints applied during decision-making */
    constraints_applied: zod_1.z.array(zod_1.z.string()),
    /** Reference ID for execution tracing */
    execution_ref: zod_1.z.string().uuid(),
    /** UTC timestamp of decision */
    timestamp: zod_1.z.string().datetime(),
});
/**
 * Create a deterministic hash of inputs for reproducibility verification
 */
function hashInputs(inputs) {
    const normalized = JSON.stringify(inputs, Object.keys(inputs).sort());
    return (0, crypto_1.createHash)('sha256').update(normalized).digest('hex');
}
/**
 * Validate and create a DecisionEvent
 */
function createDecisionEvent(agentId, agentVersion, decisionType, inputs, outputs, confidence, constraintsApplied, executionRef) {
    const event = {
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
    return exports.DecisionEventSchema.parse(event);
}
//# sourceMappingURL=decision-event.js.map