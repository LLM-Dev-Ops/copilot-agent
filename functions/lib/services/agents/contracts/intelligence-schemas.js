"use strict";
/**
 * Phase 7: Intelligence & Expansion (Layer 2) - Signal Schemas
 *
 * DecisionEvent rules - Agents MUST emit:
 * - hypothesis_signal
 * - simulation_outcome_signal
 * - confidence_delta_signal
 *
 * Role clarity:
 * - Agents MAY: reason, simulate, explore
 * - Agents MUST: emit signals, avoid final decisions
 *
 * Performance budgets:
 * - MAX_TOKENS=2500
 * - MAX_LATENCY_MS=5000
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligenceLayerOutputSchema = exports.IntelligenceLayerInputSchema = exports.ConfidenceDeltaSignalSchema = exports.SimulationOutcomeSignalSchema = exports.HypothesisSignalSchema = exports.PHASE7_PERFORMANCE_BUDGETS = void 0;
const zod_1 = require("zod");
/**
 * Performance budget constants for Phase 7
 */
exports.PHASE7_PERFORMANCE_BUDGETS = {
    MAX_TOKENS: 2500,
    MAX_LATENCY_MS: 5000,
};
/**
 * Hypothesis Signal Schema
 *
 * Emitted when the agent forms a hypothesis during reasoning.
 * Hypotheses are exploratory - they NEVER constitute final decisions.
 */
exports.HypothesisSignalSchema = zod_1.z.object({
    signal_type: zod_1.z.literal('hypothesis_signal'),
    hypothesis_id: zod_1.z.string().uuid(),
    /** The hypothesis statement */
    statement: zod_1.z.string().min(1).max(500),
    /** Domain/area the hypothesis relates to */
    domain: zod_1.z.string().min(1),
    /** Supporting evidence or reasoning */
    supporting_evidence: zod_1.z.array(zod_1.z.object({
        evidence_id: zod_1.z.string(),
        description: zod_1.z.string(),
        weight: zod_1.z.number().min(0).max(1),
        source: zod_1.z.string().optional(),
    })),
    /** Counter-evidence or alternative explanations */
    counter_evidence: zod_1.z.array(zod_1.z.object({
        evidence_id: zod_1.z.string(),
        description: zod_1.z.string(),
        weight: zod_1.z.number().min(0).max(1),
        source: zod_1.z.string().optional(),
    })),
    /** Initial confidence before simulation */
    initial_confidence: zod_1.z.number().min(0).max(1),
    /** Conditions that would strengthen the hypothesis */
    strengthening_conditions: zod_1.z.array(zod_1.z.string()),
    /** Conditions that would weaken the hypothesis */
    weakening_conditions: zod_1.z.array(zod_1.z.string()),
    /** Related hypotheses (if exploring multiple paths) */
    related_hypothesis_ids: zod_1.z.array(zod_1.z.string().uuid()),
    /** Timestamp of hypothesis formation */
    formed_at: zod_1.z.string().datetime(),
});
/**
 * Simulation Outcome Signal Schema
 *
 * Emitted after simulating a scenario or testing a hypothesis.
 * Simulations explore possibilities - they NEVER trigger actions.
 */
exports.SimulationOutcomeSignalSchema = zod_1.z.object({
    signal_type: zod_1.z.literal('simulation_outcome_signal'),
    simulation_id: zod_1.z.string().uuid(),
    /** The hypothesis being tested (if applicable) */
    hypothesis_id: zod_1.z.string().uuid().optional(),
    /** What scenario was simulated */
    scenario: zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string(),
        initial_conditions: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
        parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    }),
    /** Simulation outcome classification */
    outcome: zod_1.z.enum([
        'hypothesis_supported',
        'hypothesis_weakened',
        'hypothesis_refuted',
        'inconclusive',
        'unexpected_result',
        'simulation_error',
    ]),
    /** Detailed results from the simulation */
    results: zod_1.z.object({
        primary_finding: zod_1.z.string(),
        secondary_findings: zod_1.z.array(zod_1.z.string()),
        metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
        artifacts: zod_1.z.array(zod_1.z.object({
            artifact_id: zod_1.z.string(),
            type: zod_1.z.string(),
            description: zod_1.z.string(),
        })).optional(),
    }),
    /** Confidence in the simulation outcome */
    outcome_confidence: zod_1.z.number().min(0).max(1),
    /** Resource usage during simulation */
    resource_usage: zod_1.z.object({
        tokens_used: zod_1.z.number().int().min(0),
        latency_ms: zod_1.z.number().min(0),
        within_budget: zod_1.z.boolean(),
    }),
    /** Recommendations for further exploration (NOT actions) */
    exploration_recommendations: zod_1.z.array(zod_1.z.object({
        recommendation_id: zod_1.z.string(),
        type: zod_1.z.enum(['additional_simulation', 'hypothesis_refinement', 'data_collection', 'domain_expansion']),
        description: zod_1.z.string(),
        priority: zod_1.z.number().min(1).max(5),
    })),
    /** Simulation completed timestamp */
    completed_at: zod_1.z.string().datetime(),
});
/**
 * Confidence Delta Signal Schema
 *
 * Emitted when confidence in a hypothesis changes.
 * Tracks reasoning progression - NEVER triggers final decisions.
 */
exports.ConfidenceDeltaSignalSchema = zod_1.z.object({
    signal_type: zod_1.z.literal('confidence_delta_signal'),
    delta_id: zod_1.z.string().uuid(),
    /** The hypothesis whose confidence changed */
    hypothesis_id: zod_1.z.string().uuid(),
    /** Simulation that caused the change (if applicable) */
    simulation_id: zod_1.z.string().uuid().optional(),
    /** Previous confidence value */
    previous_confidence: zod_1.z.number().min(0).max(1),
    /** New confidence value */
    new_confidence: zod_1.z.number().min(0).max(1),
    /** The actual delta (can be positive or negative) */
    delta: zod_1.z.number().min(-1).max(1),
    /** Reason for the confidence change */
    reason: zod_1.z.object({
        category: zod_1.z.enum([
            'new_evidence',
            'contradicting_evidence',
            'simulation_result',
            'reasoning_refinement',
            'assumption_invalidated',
            'scope_change',
            'uncertainty_quantification',
        ]),
        description: zod_1.z.string(),
        contributing_factors: zod_1.z.array(zod_1.z.object({
            factor: zod_1.z.string(),
            impact: zod_1.z.number().min(-1).max(1),
        })),
    }),
    /** Whether confidence is still within actionable thresholds */
    thresholds: zod_1.z.object({
        /** Confidence required for recommendation */
        recommendation_threshold: zod_1.z.number().min(0).max(1),
        /** Current distance from threshold */
        distance_from_threshold: zod_1.z.number(),
        /** Trend direction over recent deltas */
        trend: zod_1.z.enum(['increasing', 'decreasing', 'stable', 'oscillating']),
    }),
    /** Timestamp of confidence change */
    changed_at: zod_1.z.string().datetime(),
});
/**
 * Intelligence Layer Input Schema
 *
 * Input for the intelligence layer agent to perform reasoning,
 * simulation, and exploration tasks.
 */
exports.IntelligenceLayerInputSchema = zod_1.z.object({
    /** Execution mode */
    mode: zod_1.z.enum(['reason', 'simulate', 'explore']),
    /** The objective or question to investigate */
    objective: zod_1.z.object({
        statement: zod_1.z.string().min(1),
        domain: zod_1.z.string(),
        constraints: zod_1.z.array(zod_1.z.string()),
        context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    }),
    /** Previous hypotheses to build upon (if any) */
    prior_hypotheses: zod_1.z.array(exports.HypothesisSignalSchema).optional(),
    /** Previous simulation outcomes (if any) */
    prior_simulations: zod_1.z.array(exports.SimulationOutcomeSignalSchema).optional(),
    /** Confidence history for tracking deltas */
    confidence_history: zod_1.z.array(exports.ConfidenceDeltaSignalSchema).optional(),
    /** Performance constraints */
    performance_limits: zod_1.z.object({
        max_tokens: zod_1.z.number().int().max(exports.PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS).default(exports.PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS),
        max_latency_ms: zod_1.z.number().max(exports.PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS).default(exports.PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS),
    }).optional(),
    /** Optional correlation ID for multi-step reasoning chains */
    reasoning_chain_id: zod_1.z.string().uuid().optional(),
});
/**
 * Intelligence Layer Output Schema
 *
 * Output containing all signals emitted during intelligence operations.
 * Contains signals ONLY - no final decisions or actions.
 */
exports.IntelligenceLayerOutputSchema = zod_1.z.object({
    /** Unique output identifier */
    output_id: zod_1.z.string().uuid(),
    /** Mode that was executed */
    mode_executed: zod_1.z.enum(['reason', 'simulate', 'explore']),
    /** All hypothesis signals generated */
    hypothesis_signals: zod_1.z.array(exports.HypothesisSignalSchema),
    /** All simulation outcome signals generated */
    simulation_outcome_signals: zod_1.z.array(exports.SimulationOutcomeSignalSchema),
    /** All confidence delta signals generated */
    confidence_delta_signals: zod_1.z.array(exports.ConfidenceDeltaSignalSchema),
    /** Summary of intelligence operations */
    summary: zod_1.z.object({
        hypotheses_formed: zod_1.z.number().int().min(0),
        simulations_run: zod_1.z.number().int().min(0),
        confidence_updates: zod_1.z.number().int().min(0),
        highest_confidence_hypothesis: zod_1.z.string().uuid().optional(),
        highest_confidence_value: zod_1.z.number().min(0).max(1).optional(),
        /** Explicit statement that no final decisions were made */
        final_decision_status: zod_1.z.literal('no_final_decision'),
    }),
    /** Resource consumption tracking */
    resource_consumption: zod_1.z.object({
        total_tokens_used: zod_1.z.number().int().min(0),
        total_latency_ms: zod_1.z.number().min(0),
        budget_tokens_remaining: zod_1.z.number().int(),
        budget_latency_remaining_ms: zod_1.z.number(),
        within_budget: zod_1.z.boolean(),
    }),
    /** Suggestions for human decision-makers (NOT agent decisions) */
    human_decision_suggestions: zod_1.z.array(zod_1.z.object({
        suggestion_id: zod_1.z.string(),
        hypothesis_id: zod_1.z.string().uuid(),
        confidence: zod_1.z.number().min(0).max(1),
        rationale: zod_1.z.string(),
        caveats: zod_1.z.array(zod_1.z.string()),
    })),
    /** Completion timestamp */
    completed_at: zod_1.z.string().datetime(),
});
//# sourceMappingURL=intelligence-schemas.js.map