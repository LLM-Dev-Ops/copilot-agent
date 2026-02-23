/**
 * Reflection Agent Schemas
 *
 * Purpose: Analyze DecisionEvents to extract learning and quality signals
 * Classification: POST_EXECUTION_ANALYSIS, QUALITY_ASSESSMENT
 * decision_type: reflection_analysis
 *
 * Scope:
 * - Evaluate outcomes
 * - Identify gaps and inefficiencies
 * - Produce improvement insights
 *
 * Must Never:
 * - Modify behavior
 * - Trigger retries
 * - Apply optimizations
 */

import { z } from 'zod';
import { PipelineContextSchema } from './pipeline-schemas';
import { DecisionEventSchema } from './decision-event';

/**
 * Quality Signal - extracted quality indicators
 */
export const QualitySignalSchema = z.object({
  /** Unique identifier for this signal */
  signal_id: z.string().min(1),

  /** Type of quality signal */
  type: z.enum([
    'performance',     // Execution performance signal
    'accuracy',        // Accuracy/correctness signal
    'completeness',    // Completeness of output signal
    'consistency',     // Consistency with prior decisions
    'efficiency',      // Resource efficiency signal
    'reliability',     // Reliability/stability signal
  ]),

  /** Signal value (0.0 - 1.0 normalized score) */
  value: z.number().min(0).max(1),

  /** Human-readable description of the signal */
  description: z.string().min(1),

  /** Evidence supporting this signal */
  evidence: z.array(z.string()).default([]),

  /** Severity level for negative signals */
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
});

export type QualitySignal = z.infer<typeof QualitySignalSchema>;

/**
 * Learning Signal - extracted learning opportunities
 */
export const LearningSignalSchema = z.object({
  /** Unique identifier for this learning */
  learning_id: z.string().min(1),

  /** Category of learning */
  category: z.enum([
    'pattern',         // Identified pattern to replicate
    'anti_pattern',    // Pattern to avoid
    'optimization',    // Optimization opportunity
    'edge_case',       // Edge case discovered
    'dependency',      // Dependency relationship learned
    'constraint',      // Constraint discovered
  ]),

  /** Brief title for the learning */
  title: z.string().min(1).max(200),

  /** Detailed description of the learning */
  description: z.string().min(1),

  /** Confidence in this learning (0.0 - 1.0) */
  confidence: z.number().min(0).max(1),

  /** Affected agents or components */
  affected_agents: z.array(z.string()).default([]),

  /** Recommendations for applying this learning (informational only) */
  recommendations: z.array(z.string()).default([]),
});

export type LearningSignal = z.infer<typeof LearningSignalSchema>;

/**
 * Gap Analysis - identified gaps or inefficiencies
 */
export const GapAnalysisSchema = z.object({
  /** Unique identifier for this gap */
  gap_id: z.string().min(1),

  /** Type of gap */
  type: z.enum([
    'coverage',        // Missing coverage
    'capability',      // Missing capability
    'data',            // Data quality or availability gap
    'process',         // Process gap
    'integration',     // Integration gap
    'documentation',   // Documentation gap
  ]),

  /** Brief title for the gap */
  title: z.string().min(1).max(200),

  /** Detailed description of the gap */
  description: z.string().min(1),

  /** Impact assessment */
  impact: z.enum(['low', 'medium', 'high', 'critical']),

  /** Steps involved where gap was identified */
  affected_steps: z.array(z.string()).default([]),

  /** Evidence supporting gap identification */
  evidence: z.array(z.string()).default([]),
});

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;

/**
 * Outcome Evaluation - assessment of decision outcomes
 */
export const OutcomeEvaluationSchema = z.object({
  /** Original decision event being evaluated */
  decision_ref: z.string().uuid(),

  /** Agent that produced the decision */
  agent_id: z.string().min(1),

  /** Decision type being evaluated */
  decision_type: z.string().min(1),

  /** Overall outcome score (0.0 - 1.0) */
  outcome_score: z.number().min(0).max(1),

  /** Assessment summary */
  summary: z.string().min(1),

  /** Breakdown of outcome by dimension */
  dimensions: z.array(z.object({
    name: z.string(),
    score: z.number().min(0).max(1),
    notes: z.string().optional(),
  })).default([]),

  /** Was the outcome as expected? */
  met_expectations: z.boolean(),

  /** Deviation from expected outcome if any */
  deviation_notes: z.string().optional(),
});

export type OutcomeEvaluation = z.infer<typeof OutcomeEvaluationSchema>;

/**
 * Reflection Agent Input Schema
 */
export const ReflectionInputSchema = z.object({
  /** DecisionEvents to analyze (1-100 events) */
  decision_events: z.array(DecisionEventSchema).min(1).max(100),

  /** Optional context about the analysis scope */
  context: z.object({
    /** Focus areas for analysis */
    focus_areas: z.array(z.enum([
      'quality',
      'learning',
      'gaps',
      'outcomes',
      'all',
    ])).default(['all']),

    /** Time range context */
    time_range: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),

    /** Specific agents to focus on */
    target_agents: z.array(z.string()).optional(),

    /** Prior reflections to build upon */
    prior_reflection_refs: z.array(z.string().uuid()).optional(),

    /** Domain-specific context */
    domain_context: z.record(z.string(), z.string()).optional(),
  }).optional(),

  /** Analysis preferences */
  preferences: z.object({
    /** Minimum confidence threshold for signals (0.0 - 1.0) */
    min_confidence: z.number().min(0).max(1).default(0.5),

    /** Maximum number of signals to return per category */
    max_signals_per_category: z.number().int().positive().max(50).default(10),

    /** Include detailed evidence */
    include_evidence: z.boolean().default(true),

    /** Generate cross-event correlations */
    correlate_events: z.boolean().default(true),
  }).optional(),

  /** Request ID for tracing */
  request_id: z.string().uuid().optional(),

  /** Optional pipeline context for multi-agent orchestration */
  pipeline_context: PipelineContextSchema.optional(),
});

export type ReflectionInput = z.infer<typeof ReflectionInputSchema>;

/**
 * Reflection Agent Output Schema
 */
export const ReflectionOutputSchema = z.object({
  /** Unique reflection identifier */
  reflection_id: z.string().uuid(),

  /** Number of events analyzed */
  events_analyzed: z.number().int().nonnegative(),

  /** Agents covered in analysis */
  agents_analyzed: z.array(z.string()),

  /** Time range of analyzed events */
  analysis_time_range: z.object({
    earliest: z.string().datetime(),
    latest: z.string().datetime(),
  }),

  /** Outcome evaluations for each analyzed event */
  outcome_evaluations: z.array(OutcomeEvaluationSchema),

  /** Extracted quality signals */
  quality_signals: z.array(QualitySignalSchema),

  /** Extracted learning signals */
  learning_signals: z.array(LearningSignalSchema),

  /** Identified gaps */
  gap_analysis: z.array(GapAnalysisSchema),

  /** Cross-event correlations found */
  correlations: z.array(z.object({
    /** Correlation identifier */
    correlation_id: z.string(),
    /** Type of correlation */
    type: z.enum(['causal', 'temporal', 'similarity', 'dependency']),
    /** Events involved */
    event_refs: z.array(z.string().uuid()),
    /** Description of the correlation */
    description: z.string(),
    /** Correlation strength (0.0 - 1.0) */
    strength: z.number().min(0).max(1),
  })).default([]),

  /** Summary statistics */
  summary: z.object({
    /** Overall quality score across all events (0.0 - 1.0) */
    overall_quality_score: z.number().min(0).max(1),

    /** Total quality signals extracted */
    total_quality_signals: z.number().int().nonnegative(),

    /** Total learning signals extracted */
    total_learning_signals: z.number().int().nonnegative(),

    /** Total gaps identified */
    total_gaps: z.number().int().nonnegative(),

    /** Events meeting expectations percentage */
    expectations_met_rate: z.number().min(0).max(1),

    /** Key findings (informational summaries) */
    key_findings: z.array(z.string()),

    /** Improvement suggestions (informational only - NOT actionable by this agent) */
    improvement_suggestions: z.array(z.string()),
  }),

  /** Reflection metadata */
  version: z.string().default('1.0.0'),
});

export type ReflectionOutput = z.infer<typeof ReflectionOutputSchema>;
