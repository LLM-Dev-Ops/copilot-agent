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
export const PHASE7_PERFORMANCE_BUDGETS = {
  MAX_TOKENS: 2500,
  MAX_LATENCY_MS: 5000,
} as const;

/**
 * Hypothesis Signal Schema
 *
 * Emitted when the agent forms a hypothesis during reasoning.
 * Hypotheses are exploratory - they NEVER constitute final decisions.
 */
export const HypothesisSignalSchema = z.object({
  signal_type: z.literal('hypothesis_signal'),
  hypothesis_id: z.string().uuid(),
  /** The hypothesis statement */
  statement: z.string().min(1).max(500),
  /** Domain/area the hypothesis relates to */
  domain: z.string().min(1),
  /** Supporting evidence or reasoning */
  supporting_evidence: z.array(z.object({
    evidence_id: z.string(),
    description: z.string(),
    weight: z.number().min(0).max(1),
    source: z.string().optional(),
  })),
  /** Counter-evidence or alternative explanations */
  counter_evidence: z.array(z.object({
    evidence_id: z.string(),
    description: z.string(),
    weight: z.number().min(0).max(1),
    source: z.string().optional(),
  })),
  /** Initial confidence before simulation */
  initial_confidence: z.number().min(0).max(1),
  /** Conditions that would strengthen the hypothesis */
  strengthening_conditions: z.array(z.string()),
  /** Conditions that would weaken the hypothesis */
  weakening_conditions: z.array(z.string()),
  /** Related hypotheses (if exploring multiple paths) */
  related_hypothesis_ids: z.array(z.string().uuid()),
  /** Timestamp of hypothesis formation */
  formed_at: z.string().datetime(),
});

export type HypothesisSignal = z.infer<typeof HypothesisSignalSchema>;

/**
 * Simulation Outcome Signal Schema
 *
 * Emitted after simulating a scenario or testing a hypothesis.
 * Simulations explore possibilities - they NEVER trigger actions.
 */
export const SimulationOutcomeSignalSchema = z.object({
  signal_type: z.literal('simulation_outcome_signal'),
  simulation_id: z.string().uuid(),
  /** The hypothesis being tested (if applicable) */
  hypothesis_id: z.string().uuid().optional(),
  /** What scenario was simulated */
  scenario: z.object({
    name: z.string(),
    description: z.string(),
    initial_conditions: z.record(z.string(), z.unknown()),
    parameters: z.record(z.string(), z.unknown()),
  }),
  /** Simulation outcome classification */
  outcome: z.enum([
    'hypothesis_supported',
    'hypothesis_weakened',
    'hypothesis_refuted',
    'inconclusive',
    'unexpected_result',
    'simulation_error',
  ]),
  /** Detailed results from the simulation */
  results: z.object({
    primary_finding: z.string(),
    secondary_findings: z.array(z.string()),
    metrics: z.record(z.string(), z.number()).optional(),
    artifacts: z.array(z.object({
      artifact_id: z.string(),
      type: z.string(),
      description: z.string(),
    })).optional(),
  }),
  /** Confidence in the simulation outcome */
  outcome_confidence: z.number().min(0).max(1),
  /** Resource usage during simulation */
  resource_usage: z.object({
    tokens_used: z.number().int().min(0),
    latency_ms: z.number().min(0),
    within_budget: z.boolean(),
  }),
  /** Recommendations for further exploration (NOT actions) */
  exploration_recommendations: z.array(z.object({
    recommendation_id: z.string(),
    type: z.enum(['additional_simulation', 'hypothesis_refinement', 'data_collection', 'domain_expansion']),
    description: z.string(),
    priority: z.number().min(1).max(5),
  })),
  /** Simulation completed timestamp */
  completed_at: z.string().datetime(),
});

export type SimulationOutcomeSignal = z.infer<typeof SimulationOutcomeSignalSchema>;

/**
 * Confidence Delta Signal Schema
 *
 * Emitted when confidence in a hypothesis changes.
 * Tracks reasoning progression - NEVER triggers final decisions.
 */
export const ConfidenceDeltaSignalSchema = z.object({
  signal_type: z.literal('confidence_delta_signal'),
  delta_id: z.string().uuid(),
  /** The hypothesis whose confidence changed */
  hypothesis_id: z.string().uuid(),
  /** Simulation that caused the change (if applicable) */
  simulation_id: z.string().uuid().optional(),
  /** Previous confidence value */
  previous_confidence: z.number().min(0).max(1),
  /** New confidence value */
  new_confidence: z.number().min(0).max(1),
  /** The actual delta (can be positive or negative) */
  delta: z.number().min(-1).max(1),
  /** Reason for the confidence change */
  reason: z.object({
    category: z.enum([
      'new_evidence',
      'contradicting_evidence',
      'simulation_result',
      'reasoning_refinement',
      'assumption_invalidated',
      'scope_change',
      'uncertainty_quantification',
    ]),
    description: z.string(),
    contributing_factors: z.array(z.object({
      factor: z.string(),
      impact: z.number().min(-1).max(1),
    })),
  }),
  /** Whether confidence is still within actionable thresholds */
  thresholds: z.object({
    /** Confidence required for recommendation */
    recommendation_threshold: z.number().min(0).max(1),
    /** Current distance from threshold */
    distance_from_threshold: z.number(),
    /** Trend direction over recent deltas */
    trend: z.enum(['increasing', 'decreasing', 'stable', 'oscillating']),
  }),
  /** Timestamp of confidence change */
  changed_at: z.string().datetime(),
});

export type ConfidenceDeltaSignal = z.infer<typeof ConfidenceDeltaSignalSchema>;

/**
 * Intelligence Layer Input Schema
 *
 * Input for the intelligence layer agent to perform reasoning,
 * simulation, and exploration tasks.
 */
export const IntelligenceLayerInputSchema = z.object({
  /** Execution mode */
  mode: z.enum(['reason', 'simulate', 'explore']),
  /** The objective or question to investigate */
  objective: z.object({
    statement: z.string().min(1),
    domain: z.string(),
    constraints: z.array(z.string()),
    context: z.record(z.string(), z.unknown()).optional(),
  }),
  /** Previous hypotheses to build upon (if any) */
  prior_hypotheses: z.array(HypothesisSignalSchema).optional(),
  /** Previous simulation outcomes (if any) */
  prior_simulations: z.array(SimulationOutcomeSignalSchema).optional(),
  /** Confidence history for tracking deltas */
  confidence_history: z.array(ConfidenceDeltaSignalSchema).optional(),
  /** Performance constraints */
  performance_limits: z.object({
    max_tokens: z.number().int().max(PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS).default(PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS),
    max_latency_ms: z.number().max(PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS).default(PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS),
  }).optional(),
  /** Optional correlation ID for multi-step reasoning chains */
  reasoning_chain_id: z.string().uuid().optional(),
});

export type IntelligenceLayerInput = z.infer<typeof IntelligenceLayerInputSchema>;

/**
 * Intelligence Layer Output Schema
 *
 * Output containing all signals emitted during intelligence operations.
 * Contains signals ONLY - no final decisions or actions.
 */
export const IntelligenceLayerOutputSchema = z.object({
  /** Unique output identifier */
  output_id: z.string().uuid(),
  /** Mode that was executed */
  mode_executed: z.enum(['reason', 'simulate', 'explore']),
  /** All hypothesis signals generated */
  hypothesis_signals: z.array(HypothesisSignalSchema),
  /** All simulation outcome signals generated */
  simulation_outcome_signals: z.array(SimulationOutcomeSignalSchema),
  /** All confidence delta signals generated */
  confidence_delta_signals: z.array(ConfidenceDeltaSignalSchema),
  /** Summary of intelligence operations */
  summary: z.object({
    hypotheses_formed: z.number().int().min(0),
    simulations_run: z.number().int().min(0),
    confidence_updates: z.number().int().min(0),
    highest_confidence_hypothesis: z.string().uuid().optional(),
    highest_confidence_value: z.number().min(0).max(1).optional(),
    /** Explicit statement that no final decisions were made */
    final_decision_status: z.literal('no_final_decision'),
  }),
  /** Resource consumption tracking */
  resource_consumption: z.object({
    total_tokens_used: z.number().int().min(0),
    total_latency_ms: z.number().min(0),
    budget_tokens_remaining: z.number().int(),
    budget_latency_remaining_ms: z.number(),
    within_budget: z.boolean(),
  }),
  /** Suggestions for human decision-makers (NOT agent decisions) */
  human_decision_suggestions: z.array(z.object({
    suggestion_id: z.string(),
    hypothesis_id: z.string().uuid(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
    caveats: z.array(z.string()),
  })),
  /** Completion timestamp */
  completed_at: z.string().datetime(),
});

export type IntelligenceLayerOutput = z.infer<typeof IntelligenceLayerOutputSchema>;
