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
import { z } from 'zod';
/**
 * Performance budget constants for Phase 7
 */
export declare const PHASE7_PERFORMANCE_BUDGETS: {
    readonly MAX_TOKENS: 2500;
    readonly MAX_LATENCY_MS: 5000;
};
/**
 * Hypothesis Signal Schema
 *
 * Emitted when the agent forms a hypothesis during reasoning.
 * Hypotheses are exploratory - they NEVER constitute final decisions.
 */
export declare const HypothesisSignalSchema: z.ZodObject<{
    signal_type: z.ZodLiteral<"hypothesis_signal">;
    hypothesis_id: z.ZodString;
    /** The hypothesis statement */
    statement: z.ZodString;
    /** Domain/area the hypothesis relates to */
    domain: z.ZodString;
    /** Supporting evidence or reasoning */
    supporting_evidence: z.ZodArray<z.ZodObject<{
        evidence_id: z.ZodString;
        description: z.ZodString;
        weight: z.ZodNumber;
        source: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }, {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }>, "many">;
    /** Counter-evidence or alternative explanations */
    counter_evidence: z.ZodArray<z.ZodObject<{
        evidence_id: z.ZodString;
        description: z.ZodString;
        weight: z.ZodNumber;
        source: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }, {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }>, "many">;
    /** Initial confidence before simulation */
    initial_confidence: z.ZodNumber;
    /** Conditions that would strengthen the hypothesis */
    strengthening_conditions: z.ZodArray<z.ZodString, "many">;
    /** Conditions that would weaken the hypothesis */
    weakening_conditions: z.ZodArray<z.ZodString, "many">;
    /** Related hypotheses (if exploring multiple paths) */
    related_hypothesis_ids: z.ZodArray<z.ZodString, "many">;
    /** Timestamp of hypothesis formation */
    formed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    domain: string;
    statement: string;
    signal_type: "hypothesis_signal";
    hypothesis_id: string;
    supporting_evidence: {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }[];
    counter_evidence: {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }[];
    initial_confidence: number;
    strengthening_conditions: string[];
    weakening_conditions: string[];
    related_hypothesis_ids: string[];
    formed_at: string;
}, {
    domain: string;
    statement: string;
    signal_type: "hypothesis_signal";
    hypothesis_id: string;
    supporting_evidence: {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }[];
    counter_evidence: {
        description: string;
        weight: number;
        evidence_id: string;
        source?: string | undefined;
    }[];
    initial_confidence: number;
    strengthening_conditions: string[];
    weakening_conditions: string[];
    related_hypothesis_ids: string[];
    formed_at: string;
}>;
export type HypothesisSignal = z.infer<typeof HypothesisSignalSchema>;
/**
 * Simulation Outcome Signal Schema
 *
 * Emitted after simulating a scenario or testing a hypothesis.
 * Simulations explore possibilities - they NEVER trigger actions.
 */
export declare const SimulationOutcomeSignalSchema: z.ZodObject<{
    signal_type: z.ZodLiteral<"simulation_outcome_signal">;
    simulation_id: z.ZodString;
    /** The hypothesis being tested (if applicable) */
    hypothesis_id: z.ZodOptional<z.ZodString>;
    /** What scenario was simulated */
    scenario: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        initial_conditions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        initial_conditions: Record<string, unknown>;
        parameters: Record<string, unknown>;
    }, {
        name: string;
        description: string;
        initial_conditions: Record<string, unknown>;
        parameters: Record<string, unknown>;
    }>;
    /** Simulation outcome classification */
    outcome: z.ZodEnum<["hypothesis_supported", "hypothesis_weakened", "hypothesis_refuted", "inconclusive", "unexpected_result", "simulation_error"]>;
    /** Detailed results from the simulation */
    results: z.ZodObject<{
        primary_finding: z.ZodString;
        secondary_findings: z.ZodArray<z.ZodString, "many">;
        metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        artifacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            artifact_id: z.ZodString;
            type: z.ZodString;
            description: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            description: string;
            artifact_id: string;
        }, {
            type: string;
            description: string;
            artifact_id: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        primary_finding: string;
        secondary_findings: string[];
        metrics?: Record<string, number> | undefined;
        artifacts?: {
            type: string;
            description: string;
            artifact_id: string;
        }[] | undefined;
    }, {
        primary_finding: string;
        secondary_findings: string[];
        metrics?: Record<string, number> | undefined;
        artifacts?: {
            type: string;
            description: string;
            artifact_id: string;
        }[] | undefined;
    }>;
    /** Confidence in the simulation outcome */
    outcome_confidence: z.ZodNumber;
    /** Resource usage during simulation */
    resource_usage: z.ZodObject<{
        tokens_used: z.ZodNumber;
        latency_ms: z.ZodNumber;
        within_budget: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        tokens_used: number;
        latency_ms: number;
        within_budget: boolean;
    }, {
        tokens_used: number;
        latency_ms: number;
        within_budget: boolean;
    }>;
    /** Recommendations for further exploration (NOT actions) */
    exploration_recommendations: z.ZodArray<z.ZodObject<{
        recommendation_id: z.ZodString;
        type: z.ZodEnum<["additional_simulation", "hypothesis_refinement", "data_collection", "domain_expansion"]>;
        description: z.ZodString;
        priority: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
        description: string;
        priority: number;
        recommendation_id: string;
    }, {
        type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
        description: string;
        priority: number;
        recommendation_id: string;
    }>, "many">;
    /** Simulation completed timestamp */
    completed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    signal_type: "simulation_outcome_signal";
    simulation_id: string;
    scenario: {
        name: string;
        description: string;
        initial_conditions: Record<string, unknown>;
        parameters: Record<string, unknown>;
    };
    outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
    results: {
        primary_finding: string;
        secondary_findings: string[];
        metrics?: Record<string, number> | undefined;
        artifacts?: {
            type: string;
            description: string;
            artifact_id: string;
        }[] | undefined;
    };
    outcome_confidence: number;
    resource_usage: {
        tokens_used: number;
        latency_ms: number;
        within_budget: boolean;
    };
    exploration_recommendations: {
        type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
        description: string;
        priority: number;
        recommendation_id: string;
    }[];
    completed_at: string;
    hypothesis_id?: string | undefined;
}, {
    signal_type: "simulation_outcome_signal";
    simulation_id: string;
    scenario: {
        name: string;
        description: string;
        initial_conditions: Record<string, unknown>;
        parameters: Record<string, unknown>;
    };
    outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
    results: {
        primary_finding: string;
        secondary_findings: string[];
        metrics?: Record<string, number> | undefined;
        artifacts?: {
            type: string;
            description: string;
            artifact_id: string;
        }[] | undefined;
    };
    outcome_confidence: number;
    resource_usage: {
        tokens_used: number;
        latency_ms: number;
        within_budget: boolean;
    };
    exploration_recommendations: {
        type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
        description: string;
        priority: number;
        recommendation_id: string;
    }[];
    completed_at: string;
    hypothesis_id?: string | undefined;
}>;
export type SimulationOutcomeSignal = z.infer<typeof SimulationOutcomeSignalSchema>;
/**
 * Confidence Delta Signal Schema
 *
 * Emitted when confidence in a hypothesis changes.
 * Tracks reasoning progression - NEVER triggers final decisions.
 */
export declare const ConfidenceDeltaSignalSchema: z.ZodObject<{
    signal_type: z.ZodLiteral<"confidence_delta_signal">;
    delta_id: z.ZodString;
    /** The hypothesis whose confidence changed */
    hypothesis_id: z.ZodString;
    /** Simulation that caused the change (if applicable) */
    simulation_id: z.ZodOptional<z.ZodString>;
    /** Previous confidence value */
    previous_confidence: z.ZodNumber;
    /** New confidence value */
    new_confidence: z.ZodNumber;
    /** The actual delta (can be positive or negative) */
    delta: z.ZodNumber;
    /** Reason for the confidence change */
    reason: z.ZodObject<{
        category: z.ZodEnum<["new_evidence", "contradicting_evidence", "simulation_result", "reasoning_refinement", "assumption_invalidated", "scope_change", "uncertainty_quantification"]>;
        description: z.ZodString;
        contributing_factors: z.ZodArray<z.ZodObject<{
            factor: z.ZodString;
            impact: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            impact: number;
            factor: string;
        }, {
            impact: number;
            factor: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        description: string;
        category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
        contributing_factors: {
            impact: number;
            factor: string;
        }[];
    }, {
        description: string;
        category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
        contributing_factors: {
            impact: number;
            factor: string;
        }[];
    }>;
    /** Whether confidence is still within actionable thresholds */
    thresholds: z.ZodObject<{
        /** Confidence required for recommendation */
        recommendation_threshold: z.ZodNumber;
        /** Current distance from threshold */
        distance_from_threshold: z.ZodNumber;
        /** Trend direction over recent deltas */
        trend: z.ZodEnum<["increasing", "decreasing", "stable", "oscillating"]>;
    }, "strip", z.ZodTypeAny, {
        recommendation_threshold: number;
        distance_from_threshold: number;
        trend: "increasing" | "decreasing" | "stable" | "oscillating";
    }, {
        recommendation_threshold: number;
        distance_from_threshold: number;
        trend: "increasing" | "decreasing" | "stable" | "oscillating";
    }>;
    /** Timestamp of confidence change */
    changed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    signal_type: "confidence_delta_signal";
    hypothesis_id: string;
    delta_id: string;
    previous_confidence: number;
    new_confidence: number;
    delta: number;
    reason: {
        description: string;
        category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
        contributing_factors: {
            impact: number;
            factor: string;
        }[];
    };
    thresholds: {
        recommendation_threshold: number;
        distance_from_threshold: number;
        trend: "increasing" | "decreasing" | "stable" | "oscillating";
    };
    changed_at: string;
    simulation_id?: string | undefined;
}, {
    signal_type: "confidence_delta_signal";
    hypothesis_id: string;
    delta_id: string;
    previous_confidence: number;
    new_confidence: number;
    delta: number;
    reason: {
        description: string;
        category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
        contributing_factors: {
            impact: number;
            factor: string;
        }[];
    };
    thresholds: {
        recommendation_threshold: number;
        distance_from_threshold: number;
        trend: "increasing" | "decreasing" | "stable" | "oscillating";
    };
    changed_at: string;
    simulation_id?: string | undefined;
}>;
export type ConfidenceDeltaSignal = z.infer<typeof ConfidenceDeltaSignalSchema>;
/**
 * Intelligence Layer Input Schema
 *
 * Input for the intelligence layer agent to perform reasoning,
 * simulation, and exploration tasks.
 */
export declare const IntelligenceLayerInputSchema: z.ZodObject<{
    /** Execution mode */
    mode: z.ZodEnum<["reason", "simulate", "explore"]>;
    /** The objective or question to investigate */
    objective: z.ZodObject<{
        statement: z.ZodString;
        domain: z.ZodString;
        constraints: z.ZodArray<z.ZodString, "many">;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        domain: string;
        constraints: string[];
        statement: string;
        context?: Record<string, unknown> | undefined;
    }, {
        domain: string;
        constraints: string[];
        statement: string;
        context?: Record<string, unknown> | undefined;
    }>;
    /** Previous hypotheses to build upon (if any) */
    prior_hypotheses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        signal_type: z.ZodLiteral<"hypothesis_signal">;
        hypothesis_id: z.ZodString;
        /** The hypothesis statement */
        statement: z.ZodString;
        /** Domain/area the hypothesis relates to */
        domain: z.ZodString;
        /** Supporting evidence or reasoning */
        supporting_evidence: z.ZodArray<z.ZodObject<{
            evidence_id: z.ZodString;
            description: z.ZodString;
            weight: z.ZodNumber;
            source: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }>, "many">;
        /** Counter-evidence or alternative explanations */
        counter_evidence: z.ZodArray<z.ZodObject<{
            evidence_id: z.ZodString;
            description: z.ZodString;
            weight: z.ZodNumber;
            source: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }>, "many">;
        /** Initial confidence before simulation */
        initial_confidence: z.ZodNumber;
        /** Conditions that would strengthen the hypothesis */
        strengthening_conditions: z.ZodArray<z.ZodString, "many">;
        /** Conditions that would weaken the hypothesis */
        weakening_conditions: z.ZodArray<z.ZodString, "many">;
        /** Related hypotheses (if exploring multiple paths) */
        related_hypothesis_ids: z.ZodArray<z.ZodString, "many">;
        /** Timestamp of hypothesis formation */
        formed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }, {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }>, "many">>;
    /** Previous simulation outcomes (if any) */
    prior_simulations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        signal_type: z.ZodLiteral<"simulation_outcome_signal">;
        simulation_id: z.ZodString;
        /** The hypothesis being tested (if applicable) */
        hypothesis_id: z.ZodOptional<z.ZodString>;
        /** What scenario was simulated */
        scenario: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            initial_conditions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        }, {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        }>;
        /** Simulation outcome classification */
        outcome: z.ZodEnum<["hypothesis_supported", "hypothesis_weakened", "hypothesis_refuted", "inconclusive", "unexpected_result", "simulation_error"]>;
        /** Detailed results from the simulation */
        results: z.ZodObject<{
            primary_finding: z.ZodString;
            secondary_findings: z.ZodArray<z.ZodString, "many">;
            metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            artifacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
                artifact_id: z.ZodString;
                type: z.ZodString;
                description: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: string;
                description: string;
                artifact_id: string;
            }, {
                type: string;
                description: string;
                artifact_id: string;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        }, {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        }>;
        /** Confidence in the simulation outcome */
        outcome_confidence: z.ZodNumber;
        /** Resource usage during simulation */
        resource_usage: z.ZodObject<{
            tokens_used: z.ZodNumber;
            latency_ms: z.ZodNumber;
            within_budget: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        }, {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        }>;
        /** Recommendations for further exploration (NOT actions) */
        exploration_recommendations: z.ZodArray<z.ZodObject<{
            recommendation_id: z.ZodString;
            type: z.ZodEnum<["additional_simulation", "hypothesis_refinement", "data_collection", "domain_expansion"]>;
            description: z.ZodString;
            priority: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }, {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }>, "many">;
        /** Simulation completed timestamp */
        completed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }, {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }>, "many">>;
    /** Confidence history for tracking deltas */
    confidence_history: z.ZodOptional<z.ZodArray<z.ZodObject<{
        signal_type: z.ZodLiteral<"confidence_delta_signal">;
        delta_id: z.ZodString;
        /** The hypothesis whose confidence changed */
        hypothesis_id: z.ZodString;
        /** Simulation that caused the change (if applicable) */
        simulation_id: z.ZodOptional<z.ZodString>;
        /** Previous confidence value */
        previous_confidence: z.ZodNumber;
        /** New confidence value */
        new_confidence: z.ZodNumber;
        /** The actual delta (can be positive or negative) */
        delta: z.ZodNumber;
        /** Reason for the confidence change */
        reason: z.ZodObject<{
            category: z.ZodEnum<["new_evidence", "contradicting_evidence", "simulation_result", "reasoning_refinement", "assumption_invalidated", "scope_change", "uncertainty_quantification"]>;
            description: z.ZodString;
            contributing_factors: z.ZodArray<z.ZodObject<{
                factor: z.ZodString;
                impact: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                impact: number;
                factor: string;
            }, {
                impact: number;
                factor: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        }, {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        }>;
        /** Whether confidence is still within actionable thresholds */
        thresholds: z.ZodObject<{
            /** Confidence required for recommendation */
            recommendation_threshold: z.ZodNumber;
            /** Current distance from threshold */
            distance_from_threshold: z.ZodNumber;
            /** Trend direction over recent deltas */
            trend: z.ZodEnum<["increasing", "decreasing", "stable", "oscillating"]>;
        }, "strip", z.ZodTypeAny, {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        }, {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        }>;
        /** Timestamp of confidence change */
        changed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }, {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }>, "many">>;
    /** Performance constraints */
    performance_limits: z.ZodOptional<z.ZodObject<{
        max_tokens: z.ZodDefault<z.ZodNumber>;
        max_latency_ms: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_tokens: number;
        max_latency_ms: number;
    }, {
        max_tokens?: number | undefined;
        max_latency_ms?: number | undefined;
    }>>;
    /** Optional correlation ID for multi-step reasoning chains */
    reasoning_chain_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    objective: {
        domain: string;
        constraints: string[];
        statement: string;
        context?: Record<string, unknown> | undefined;
    };
    mode: "reason" | "simulate" | "explore";
    prior_hypotheses?: {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }[] | undefined;
    prior_simulations?: {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }[] | undefined;
    confidence_history?: {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }[] | undefined;
    performance_limits?: {
        max_tokens: number;
        max_latency_ms: number;
    } | undefined;
    reasoning_chain_id?: string | undefined;
}, {
    objective: {
        domain: string;
        constraints: string[];
        statement: string;
        context?: Record<string, unknown> | undefined;
    };
    mode: "reason" | "simulate" | "explore";
    prior_hypotheses?: {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }[] | undefined;
    prior_simulations?: {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }[] | undefined;
    confidence_history?: {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }[] | undefined;
    performance_limits?: {
        max_tokens?: number | undefined;
        max_latency_ms?: number | undefined;
    } | undefined;
    reasoning_chain_id?: string | undefined;
}>;
export type IntelligenceLayerInput = z.infer<typeof IntelligenceLayerInputSchema>;
/**
 * Intelligence Layer Output Schema
 *
 * Output containing all signals emitted during intelligence operations.
 * Contains signals ONLY - no final decisions or actions.
 */
export declare const IntelligenceLayerOutputSchema: z.ZodObject<{
    /** Unique output identifier */
    output_id: z.ZodString;
    /** Mode that was executed */
    mode_executed: z.ZodEnum<["reason", "simulate", "explore"]>;
    /** All hypothesis signals generated */
    hypothesis_signals: z.ZodArray<z.ZodObject<{
        signal_type: z.ZodLiteral<"hypothesis_signal">;
        hypothesis_id: z.ZodString;
        /** The hypothesis statement */
        statement: z.ZodString;
        /** Domain/area the hypothesis relates to */
        domain: z.ZodString;
        /** Supporting evidence or reasoning */
        supporting_evidence: z.ZodArray<z.ZodObject<{
            evidence_id: z.ZodString;
            description: z.ZodString;
            weight: z.ZodNumber;
            source: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }>, "many">;
        /** Counter-evidence or alternative explanations */
        counter_evidence: z.ZodArray<z.ZodObject<{
            evidence_id: z.ZodString;
            description: z.ZodString;
            weight: z.ZodNumber;
            source: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }, {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }>, "many">;
        /** Initial confidence before simulation */
        initial_confidence: z.ZodNumber;
        /** Conditions that would strengthen the hypothesis */
        strengthening_conditions: z.ZodArray<z.ZodString, "many">;
        /** Conditions that would weaken the hypothesis */
        weakening_conditions: z.ZodArray<z.ZodString, "many">;
        /** Related hypotheses (if exploring multiple paths) */
        related_hypothesis_ids: z.ZodArray<z.ZodString, "many">;
        /** Timestamp of hypothesis formation */
        formed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }, {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }>, "many">;
    /** All simulation outcome signals generated */
    simulation_outcome_signals: z.ZodArray<z.ZodObject<{
        signal_type: z.ZodLiteral<"simulation_outcome_signal">;
        simulation_id: z.ZodString;
        /** The hypothesis being tested (if applicable) */
        hypothesis_id: z.ZodOptional<z.ZodString>;
        /** What scenario was simulated */
        scenario: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            initial_conditions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        }, {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        }>;
        /** Simulation outcome classification */
        outcome: z.ZodEnum<["hypothesis_supported", "hypothesis_weakened", "hypothesis_refuted", "inconclusive", "unexpected_result", "simulation_error"]>;
        /** Detailed results from the simulation */
        results: z.ZodObject<{
            primary_finding: z.ZodString;
            secondary_findings: z.ZodArray<z.ZodString, "many">;
            metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            artifacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
                artifact_id: z.ZodString;
                type: z.ZodString;
                description: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: string;
                description: string;
                artifact_id: string;
            }, {
                type: string;
                description: string;
                artifact_id: string;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        }, {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        }>;
        /** Confidence in the simulation outcome */
        outcome_confidence: z.ZodNumber;
        /** Resource usage during simulation */
        resource_usage: z.ZodObject<{
            tokens_used: z.ZodNumber;
            latency_ms: z.ZodNumber;
            within_budget: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        }, {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        }>;
        /** Recommendations for further exploration (NOT actions) */
        exploration_recommendations: z.ZodArray<z.ZodObject<{
            recommendation_id: z.ZodString;
            type: z.ZodEnum<["additional_simulation", "hypothesis_refinement", "data_collection", "domain_expansion"]>;
            description: z.ZodString;
            priority: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }, {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }>, "many">;
        /** Simulation completed timestamp */
        completed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }, {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }>, "many">;
    /** All confidence delta signals generated */
    confidence_delta_signals: z.ZodArray<z.ZodObject<{
        signal_type: z.ZodLiteral<"confidence_delta_signal">;
        delta_id: z.ZodString;
        /** The hypothesis whose confidence changed */
        hypothesis_id: z.ZodString;
        /** Simulation that caused the change (if applicable) */
        simulation_id: z.ZodOptional<z.ZodString>;
        /** Previous confidence value */
        previous_confidence: z.ZodNumber;
        /** New confidence value */
        new_confidence: z.ZodNumber;
        /** The actual delta (can be positive or negative) */
        delta: z.ZodNumber;
        /** Reason for the confidence change */
        reason: z.ZodObject<{
            category: z.ZodEnum<["new_evidence", "contradicting_evidence", "simulation_result", "reasoning_refinement", "assumption_invalidated", "scope_change", "uncertainty_quantification"]>;
            description: z.ZodString;
            contributing_factors: z.ZodArray<z.ZodObject<{
                factor: z.ZodString;
                impact: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                impact: number;
                factor: string;
            }, {
                impact: number;
                factor: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        }, {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        }>;
        /** Whether confidence is still within actionable thresholds */
        thresholds: z.ZodObject<{
            /** Confidence required for recommendation */
            recommendation_threshold: z.ZodNumber;
            /** Current distance from threshold */
            distance_from_threshold: z.ZodNumber;
            /** Trend direction over recent deltas */
            trend: z.ZodEnum<["increasing", "decreasing", "stable", "oscillating"]>;
        }, "strip", z.ZodTypeAny, {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        }, {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        }>;
        /** Timestamp of confidence change */
        changed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }, {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }>, "many">;
    /** Summary of intelligence operations */
    summary: z.ZodObject<{
        hypotheses_formed: z.ZodNumber;
        simulations_run: z.ZodNumber;
        confidence_updates: z.ZodNumber;
        highest_confidence_hypothesis: z.ZodOptional<z.ZodString>;
        highest_confidence_value: z.ZodOptional<z.ZodNumber>;
        /** Explicit statement that no final decisions were made */
        final_decision_status: z.ZodLiteral<"no_final_decision">;
    }, "strip", z.ZodTypeAny, {
        hypotheses_formed: number;
        simulations_run: number;
        confidence_updates: number;
        final_decision_status: "no_final_decision";
        highest_confidence_hypothesis?: string | undefined;
        highest_confidence_value?: number | undefined;
    }, {
        hypotheses_formed: number;
        simulations_run: number;
        confidence_updates: number;
        final_decision_status: "no_final_decision";
        highest_confidence_hypothesis?: string | undefined;
        highest_confidence_value?: number | undefined;
    }>;
    /** Resource consumption tracking */
    resource_consumption: z.ZodObject<{
        total_tokens_used: z.ZodNumber;
        total_latency_ms: z.ZodNumber;
        budget_tokens_remaining: z.ZodNumber;
        budget_latency_remaining_ms: z.ZodNumber;
        within_budget: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        within_budget: boolean;
        total_tokens_used: number;
        total_latency_ms: number;
        budget_tokens_remaining: number;
        budget_latency_remaining_ms: number;
    }, {
        within_budget: boolean;
        total_tokens_used: number;
        total_latency_ms: number;
        budget_tokens_remaining: number;
        budget_latency_remaining_ms: number;
    }>;
    /** Suggestions for human decision-makers (NOT agent decisions) */
    human_decision_suggestions: z.ZodArray<z.ZodObject<{
        suggestion_id: z.ZodString;
        hypothesis_id: z.ZodString;
        confidence: z.ZodNumber;
        rationale: z.ZodString;
        caveats: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        hypothesis_id: string;
        suggestion_id: string;
        rationale: string;
        caveats: string[];
    }, {
        confidence: number;
        hypothesis_id: string;
        suggestion_id: string;
        rationale: string;
        caveats: string[];
    }>, "many">;
    /** Completion timestamp */
    completed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    summary: {
        hypotheses_formed: number;
        simulations_run: number;
        confidence_updates: number;
        final_decision_status: "no_final_decision";
        highest_confidence_hypothesis?: string | undefined;
        highest_confidence_value?: number | undefined;
    };
    completed_at: string;
    output_id: string;
    mode_executed: "reason" | "simulate" | "explore";
    hypothesis_signals: {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }[];
    simulation_outcome_signals: {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }[];
    confidence_delta_signals: {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }[];
    resource_consumption: {
        within_budget: boolean;
        total_tokens_used: number;
        total_latency_ms: number;
        budget_tokens_remaining: number;
        budget_latency_remaining_ms: number;
    };
    human_decision_suggestions: {
        confidence: number;
        hypothesis_id: string;
        suggestion_id: string;
        rationale: string;
        caveats: string[];
    }[];
}, {
    summary: {
        hypotheses_formed: number;
        simulations_run: number;
        confidence_updates: number;
        final_decision_status: "no_final_decision";
        highest_confidence_hypothesis?: string | undefined;
        highest_confidence_value?: number | undefined;
    };
    completed_at: string;
    output_id: string;
    mode_executed: "reason" | "simulate" | "explore";
    hypothesis_signals: {
        domain: string;
        statement: string;
        signal_type: "hypothesis_signal";
        hypothesis_id: string;
        supporting_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        counter_evidence: {
            description: string;
            weight: number;
            evidence_id: string;
            source?: string | undefined;
        }[];
        initial_confidence: number;
        strengthening_conditions: string[];
        weakening_conditions: string[];
        related_hypothesis_ids: string[];
        formed_at: string;
    }[];
    simulation_outcome_signals: {
        signal_type: "simulation_outcome_signal";
        simulation_id: string;
        scenario: {
            name: string;
            description: string;
            initial_conditions: Record<string, unknown>;
            parameters: Record<string, unknown>;
        };
        outcome: "hypothesis_supported" | "hypothesis_weakened" | "hypothesis_refuted" | "inconclusive" | "unexpected_result" | "simulation_error";
        results: {
            primary_finding: string;
            secondary_findings: string[];
            metrics?: Record<string, number> | undefined;
            artifacts?: {
                type: string;
                description: string;
                artifact_id: string;
            }[] | undefined;
        };
        outcome_confidence: number;
        resource_usage: {
            tokens_used: number;
            latency_ms: number;
            within_budget: boolean;
        };
        exploration_recommendations: {
            type: "additional_simulation" | "hypothesis_refinement" | "data_collection" | "domain_expansion";
            description: string;
            priority: number;
            recommendation_id: string;
        }[];
        completed_at: string;
        hypothesis_id?: string | undefined;
    }[];
    confidence_delta_signals: {
        signal_type: "confidence_delta_signal";
        hypothesis_id: string;
        delta_id: string;
        previous_confidence: number;
        new_confidence: number;
        delta: number;
        reason: {
            description: string;
            category: "new_evidence" | "contradicting_evidence" | "simulation_result" | "reasoning_refinement" | "assumption_invalidated" | "scope_change" | "uncertainty_quantification";
            contributing_factors: {
                impact: number;
                factor: string;
            }[];
        };
        thresholds: {
            recommendation_threshold: number;
            distance_from_threshold: number;
            trend: "increasing" | "decreasing" | "stable" | "oscillating";
        };
        changed_at: string;
        simulation_id?: string | undefined;
    }[];
    resource_consumption: {
        within_budget: boolean;
        total_tokens_used: number;
        total_latency_ms: number;
        budget_tokens_remaining: number;
        budget_latency_remaining_ms: number;
    };
    human_decision_suggestions: {
        confidence: number;
        hypothesis_id: string;
        suggestion_id: string;
        rationale: string;
        caveats: string[];
    }[];
}>;
export type IntelligenceLayerOutput = z.infer<typeof IntelligenceLayerOutputSchema>;
