/**
 * Meta-Reasoner Agent Schemas
 *
 * Input/Output contracts for the Meta-Reasoner Agent.
 * This agent evaluates reasoning quality and consistency across agents.
 *
 * Classification: META_ANALYSIS, REASONING_QUALITY_ASSESSMENT
 * decision_type: meta_reasoning_analysis
 *
 * Scope:
 * - Detect contradictions
 * - Assess confidence calibration
 * - Identify systemic reasoning issues
 *
 * Must Never:
 * - Override outputs
 * - Enforce corrections
 * - Execute logic
 */

import { z } from 'zod';
import { PipelineContextSchema } from './pipeline-schemas';

/**
 * Reasoning trace from an agent to analyze
 */
export const ReasoningTraceSchema = z.object({
  /** Source agent ID */
  agent_id: z.string().min(1),

  /** Source agent version */
  agent_version: z.string().regex(/^\d+\.\d+\.\d+$/),

  /** Decision type made by the agent */
  decision_type: z.string().min(1),

  /** Execution reference for tracing */
  execution_ref: z.string().uuid(),

  /** Timestamp of the decision */
  timestamp: z.string().datetime(),

  /** Confidence reported by the agent */
  reported_confidence: z.number().min(0).max(1),

  /** The reasoning steps or outputs to analyze */
  reasoning_content: z.unknown(),

  /** Constraints that were applied */
  constraints_applied: z.array(z.string()).default([]),

  /** Optional tags for categorization */
  tags: z.array(z.string()).default([]),
});

export type ReasoningTrace = z.infer<typeof ReasoningTraceSchema>;

/**
 * Meta-Reasoner Input Schema
 */
export const MetaReasonerInputSchema = z.object({
  /** Reasoning traces to analyze (1 or more) */
  traces: z.array(ReasoningTraceSchema).min(1).max(100),

  /** Analysis scope configuration */
  scope: z.object({
    /** Check for contradictions between traces */
    detect_contradictions: z.boolean().default(true),

    /** Assess if confidence scores are well-calibrated */
    assess_confidence_calibration: z.boolean().default(true),

    /** Identify systemic reasoning patterns/issues */
    identify_systemic_issues: z.boolean().default(true),

    /** Check for logical fallacies */
    detect_fallacies: z.boolean().default(false),

    /** Analyze reasoning chain completeness */
    check_completeness: z.boolean().default(false),
  }).default({}),

  /** Analysis context */
  context: z.object({
    /** Domain context for analysis */
    domain: z.string().optional(),

    /** Reference standards or baselines */
    reference_standards: z.array(z.string()).default([]),

    /** Historical accuracy data for agents (for calibration) */
    historical_accuracy: z.record(z.string(), z.number().min(0).max(1)).optional(),

    /** Correlation groups (traces that should be consistent) */
    correlation_groups: z.array(z.array(z.string())).default([]),
  }).optional(),

  /** Request identifier for tracing */
  request_id: z.string().uuid().optional(),

  /** Optional pipeline context for multi-agent orchestration */
  pipeline_context: PipelineContextSchema.optional(),
});

export type MetaReasonerInput = z.infer<typeof MetaReasonerInputSchema>;

/**
 * Contradiction finding
 */
export const ContradictionSchema = z.object({
  /** Unique ID for this contradiction */
  contradiction_id: z.string().min(1),

  /** Type of contradiction */
  type: z.enum([
    'direct',           // Explicit logical contradiction
    'implicit',         // Implied contradiction through inference
    'temporal',         // Contradicts previous state/decision
    'contextual',       // Contradiction given specific context
    'statistical',      // Statistical inconsistency
  ]),

  /** Severity of the contradiction */
  severity: z.enum(['low', 'medium', 'high', 'critical']),

  /** Execution refs of the traces involved */
  involved_traces: z.array(z.string().uuid()).min(2),

  /** Agent IDs involved */
  involved_agents: z.array(z.string()).min(1),

  /** Description of the contradiction */
  description: z.string().min(1),

  /** Evidence supporting this finding */
  evidence: z.array(z.object({
    trace_ref: z.string().uuid(),
    excerpt: z.string(),
    relevance: z.string(),
  })).min(1),

  /** Confidence in this finding */
  finding_confidence: z.number().min(0).max(1),
});

export type Contradiction = z.infer<typeof ContradictionSchema>;

/**
 * Confidence calibration assessment
 */
export const ConfidenceCalibrationSchema = z.object({
  /** Agent ID being assessed */
  agent_id: z.string().min(1),

  /** Calibration score (1.0 = perfectly calibrated) */
  calibration_score: z.number().min(0).max(1),

  /** Assessment category */
  assessment: z.enum([
    'well_calibrated',      // Confidence matches accuracy
    'overconfident',        // Claims higher confidence than warranted
    'underconfident',       // Claims lower confidence than warranted
    'inconsistent',         // Confidence varies unpredictably
    'insufficient_data',    // Not enough data to assess
  ]),

  /** Mean reported confidence */
  mean_reported_confidence: z.number().min(0).max(1),

  /** Expected accuracy based on historical data */
  expected_accuracy: z.number().min(0).max(1).optional(),

  /** Calibration gap (positive = overconfident, negative = underconfident) */
  calibration_gap: z.number().min(-1).max(1).optional(),

  /** Number of traces analyzed */
  traces_analyzed: z.number().int().nonnegative(),

  /** Recommendations for calibration improvement */
  recommendations: z.array(z.string()).default([]),
});

export type ConfidenceCalibration = z.infer<typeof ConfidenceCalibrationSchema>;

/**
 * Systemic reasoning issue
 */
export const SystemicIssueSchema = z.object({
  /** Unique ID for this issue */
  issue_id: z.string().min(1),

  /** Type of systemic issue */
  type: z.enum([
    'reasoning_gap',        // Missing step in reasoning chain
    'circular_reasoning',   // Conclusion used as premise
    'anchoring_bias',       // Over-reliance on initial information
    'confirmation_bias',    // Favoring confirming evidence
    'availability_bias',    // Over-weighting easily recalled info
    'pattern_overfitting',  // Seeing patterns that don't exist
    'scope_creep',          // Analysis exceeds defined boundaries
    'premature_conclusion', // Concluding before sufficient analysis
    'inconsistent_criteria',// Applying different standards
    'missing_uncertainty',  // Not acknowledging unknowns
  ]),

  /** Severity of the issue */
  severity: z.enum(['low', 'medium', 'high', 'critical']),

  /** Agent IDs exhibiting this issue */
  affected_agents: z.array(z.string()).min(1),

  /** Execution refs where issue was observed */
  occurrences: z.array(z.string().uuid()).min(1),

  /** Frequency of occurrence */
  frequency: z.enum(['isolated', 'occasional', 'frequent', 'pervasive']),

  /** Description of the issue */
  description: z.string().min(1),

  /** Evidence supporting this finding */
  evidence: z.array(z.object({
    trace_ref: z.string().uuid(),
    observation: z.string(),
  })).min(1),

  /** Impact assessment */
  impact: z.string().min(1),

  /** Confidence in this finding */
  finding_confidence: z.number().min(0).max(1),
});

export type SystemicIssue = z.infer<typeof SystemicIssueSchema>;

/**
 * Reasoning quality metrics
 */
export const ReasoningQualityMetricsSchema = z.object({
  /** Overall quality score */
  overall_score: z.number().min(0).max(1),

  /** Logical consistency score */
  consistency_score: z.number().min(0).max(1),

  /** Completeness of reasoning */
  completeness_score: z.number().min(0).max(1),

  /** Clarity of reasoning */
  clarity_score: z.number().min(0).max(1),

  /** Accuracy of stated constraints adherence */
  constraint_adherence_score: z.number().min(0).max(1),

  /** Number of traces analyzed */
  traces_analyzed: z.number().int().nonnegative(),

  /** Number of unique agents analyzed */
  agents_analyzed: z.number().int().nonnegative(),

  /** Analysis coverage percentage */
  coverage_percentage: z.number().min(0).max(100),
});

export type ReasoningQualityMetrics = z.infer<typeof ReasoningQualityMetricsSchema>;

/**
 * Meta-Reasoner Output Schema
 */
export const MetaReasonerOutputSchema = z.object({
  /** Unique analysis ID */
  analysis_id: z.string().uuid(),

  /** Summary of the analysis */
  summary: z.string().min(1),

  /** Overall reasoning quality metrics */
  quality_metrics: ReasoningQualityMetricsSchema,

  /** Detected contradictions */
  contradictions: z.array(ContradictionSchema).default([]),

  /** Confidence calibration assessments (per agent) */
  confidence_calibrations: z.array(ConfidenceCalibrationSchema).default([]),

  /** Identified systemic issues */
  systemic_issues: z.array(SystemicIssueSchema).default([]),

  /** Analysis metadata */
  analysis_metadata: z.object({
    /** Total traces provided */
    total_traces: z.number().int().nonnegative(),

    /** Traces successfully analyzed */
    traces_analyzed: z.number().int().nonnegative(),

    /** Unique agents in input */
    unique_agents: z.number().int().nonnegative(),

    /** Unique decision types */
    unique_decision_types: z.number().int().nonnegative(),

    /** Time span of traces analyzed */
    time_span: z.object({
      earliest: z.string().datetime(),
      latest: z.string().datetime(),
    }).optional(),

    /** Scope of analysis performed */
    scope_executed: z.object({
      contradictions_checked: z.boolean(),
      calibration_assessed: z.boolean(),
      systemic_issues_checked: z.boolean(),
      fallacies_checked: z.boolean(),
      completeness_checked: z.boolean(),
    }),
  }),

  /** Key findings (prioritized list) */
  key_findings: z.array(z.object({
    priority: z.number().int().min(1).max(10),
    category: z.enum(['contradiction', 'calibration', 'systemic', 'quality']),
    finding: z.string().min(1),
    affected_entities: z.array(z.string()),
  })).default([]),

  /** Assumptions made during analysis */
  assumptions: z.array(z.string()).default([]),

  /** Output version */
  version: z.string().default('1.0.0'),
});

export type MetaReasonerOutput = z.infer<typeof MetaReasonerOutputSchema>;
