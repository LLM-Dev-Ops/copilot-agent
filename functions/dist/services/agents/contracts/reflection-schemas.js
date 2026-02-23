"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionOutputSchema = exports.ReflectionInputSchema = exports.OutcomeEvaluationSchema = exports.GapAnalysisSchema = exports.LearningSignalSchema = exports.QualitySignalSchema = void 0;
const zod_1 = require("zod");
const pipeline_schemas_1 = require("./pipeline-schemas");
const decision_event_1 = require("./decision-event");
/**
 * Quality Signal - extracted quality indicators
 */
exports.QualitySignalSchema = zod_1.z.object({
    /** Unique identifier for this signal */
    signal_id: zod_1.z.string().min(1),
    /** Type of quality signal */
    type: zod_1.z.enum([
        'performance', // Execution performance signal
        'accuracy', // Accuracy/correctness signal
        'completeness', // Completeness of output signal
        'consistency', // Consistency with prior decisions
        'efficiency', // Resource efficiency signal
        'reliability', // Reliability/stability signal
    ]),
    /** Signal value (0.0 - 1.0 normalized score) */
    value: zod_1.z.number().min(0).max(1),
    /** Human-readable description of the signal */
    description: zod_1.z.string().min(1),
    /** Evidence supporting this signal */
    evidence: zod_1.z.array(zod_1.z.string()).default([]),
    /** Severity level for negative signals */
    severity: zod_1.z.enum(['info', 'warning', 'error', 'critical']).optional(),
});
/**
 * Learning Signal - extracted learning opportunities
 */
exports.LearningSignalSchema = zod_1.z.object({
    /** Unique identifier for this learning */
    learning_id: zod_1.z.string().min(1),
    /** Category of learning */
    category: zod_1.z.enum([
        'pattern', // Identified pattern to replicate
        'anti_pattern', // Pattern to avoid
        'optimization', // Optimization opportunity
        'edge_case', // Edge case discovered
        'dependency', // Dependency relationship learned
        'constraint', // Constraint discovered
    ]),
    /** Brief title for the learning */
    title: zod_1.z.string().min(1).max(200),
    /** Detailed description of the learning */
    description: zod_1.z.string().min(1),
    /** Confidence in this learning (0.0 - 1.0) */
    confidence: zod_1.z.number().min(0).max(1),
    /** Affected agents or components */
    affected_agents: zod_1.z.array(zod_1.z.string()).default([]),
    /** Recommendations for applying this learning (informational only) */
    recommendations: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * Gap Analysis - identified gaps or inefficiencies
 */
exports.GapAnalysisSchema = zod_1.z.object({
    /** Unique identifier for this gap */
    gap_id: zod_1.z.string().min(1),
    /** Type of gap */
    type: zod_1.z.enum([
        'coverage', // Missing coverage
        'capability', // Missing capability
        'data', // Data quality or availability gap
        'process', // Process gap
        'integration', // Integration gap
        'documentation', // Documentation gap
    ]),
    /** Brief title for the gap */
    title: zod_1.z.string().min(1).max(200),
    /** Detailed description of the gap */
    description: zod_1.z.string().min(1),
    /** Impact assessment */
    impact: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Steps involved where gap was identified */
    affected_steps: zod_1.z.array(zod_1.z.string()).default([]),
    /** Evidence supporting gap identification */
    evidence: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * Outcome Evaluation - assessment of decision outcomes
 */
exports.OutcomeEvaluationSchema = zod_1.z.object({
    /** Original decision event being evaluated */
    decision_ref: zod_1.z.string().uuid(),
    /** Agent that produced the decision */
    agent_id: zod_1.z.string().min(1),
    /** Decision type being evaluated */
    decision_type: zod_1.z.string().min(1),
    /** Overall outcome score (0.0 - 1.0) */
    outcome_score: zod_1.z.number().min(0).max(1),
    /** Assessment summary */
    summary: zod_1.z.string().min(1),
    /** Breakdown of outcome by dimension */
    dimensions: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        score: zod_1.z.number().min(0).max(1),
        notes: zod_1.z.string().optional(),
    })).default([]),
    /** Was the outcome as expected? */
    met_expectations: zod_1.z.boolean(),
    /** Deviation from expected outcome if any */
    deviation_notes: zod_1.z.string().optional(),
});
/**
 * Reflection Agent Input Schema
 */
exports.ReflectionInputSchema = zod_1.z.object({
    /** DecisionEvents to analyze (1-100 events) */
    decision_events: zod_1.z.array(decision_event_1.DecisionEventSchema).min(1).max(100),
    /** Optional context about the analysis scope */
    context: zod_1.z.object({
        /** Focus areas for analysis */
        focus_areas: zod_1.z.array(zod_1.z.enum([
            'quality',
            'learning',
            'gaps',
            'outcomes',
            'all',
        ])).default(['all']),
        /** Time range context */
        time_range: zod_1.z.object({
            from: zod_1.z.string().datetime().optional(),
            to: zod_1.z.string().datetime().optional(),
        }).optional(),
        /** Specific agents to focus on */
        target_agents: zod_1.z.array(zod_1.z.string()).optional(),
        /** Prior reflections to build upon */
        prior_reflection_refs: zod_1.z.array(zod_1.z.string().uuid()).optional(),
        /** Domain-specific context */
        domain_context: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    }).optional(),
    /** Analysis preferences */
    preferences: zod_1.z.object({
        /** Minimum confidence threshold for signals (0.0 - 1.0) */
        min_confidence: zod_1.z.number().min(0).max(1).default(0.5),
        /** Maximum number of signals to return per category */
        max_signals_per_category: zod_1.z.number().int().positive().max(50).default(10),
        /** Include detailed evidence */
        include_evidence: zod_1.z.boolean().default(true),
        /** Generate cross-event correlations */
        correlate_events: zod_1.z.boolean().default(true),
    }).optional(),
    /** Request ID for tracing */
    request_id: zod_1.z.string().uuid().optional(),
    /** Optional pipeline context for multi-agent orchestration */
    pipeline_context: pipeline_schemas_1.PipelineContextSchema.optional(),
});
/**
 * Reflection Agent Output Schema
 */
exports.ReflectionOutputSchema = zod_1.z.object({
    /** Unique reflection identifier */
    reflection_id: zod_1.z.string().uuid(),
    /** Number of events analyzed */
    events_analyzed: zod_1.z.number().int().nonnegative(),
    /** Agents covered in analysis */
    agents_analyzed: zod_1.z.array(zod_1.z.string()),
    /** Time range of analyzed events */
    analysis_time_range: zod_1.z.object({
        earliest: zod_1.z.string().datetime(),
        latest: zod_1.z.string().datetime(),
    }),
    /** Outcome evaluations for each analyzed event */
    outcome_evaluations: zod_1.z.array(exports.OutcomeEvaluationSchema),
    /** Extracted quality signals */
    quality_signals: zod_1.z.array(exports.QualitySignalSchema),
    /** Extracted learning signals */
    learning_signals: zod_1.z.array(exports.LearningSignalSchema),
    /** Identified gaps */
    gap_analysis: zod_1.z.array(exports.GapAnalysisSchema),
    /** Cross-event correlations found */
    correlations: zod_1.z.array(zod_1.z.object({
        /** Correlation identifier */
        correlation_id: zod_1.z.string(),
        /** Type of correlation */
        type: zod_1.z.enum(['causal', 'temporal', 'similarity', 'dependency']),
        /** Events involved */
        event_refs: zod_1.z.array(zod_1.z.string().uuid()),
        /** Description of the correlation */
        description: zod_1.z.string(),
        /** Correlation strength (0.0 - 1.0) */
        strength: zod_1.z.number().min(0).max(1),
    })).default([]),
    /** Summary statistics */
    summary: zod_1.z.object({
        /** Overall quality score across all events (0.0 - 1.0) */
        overall_quality_score: zod_1.z.number().min(0).max(1),
        /** Total quality signals extracted */
        total_quality_signals: zod_1.z.number().int().nonnegative(),
        /** Total learning signals extracted */
        total_learning_signals: zod_1.z.number().int().nonnegative(),
        /** Total gaps identified */
        total_gaps: zod_1.z.number().int().nonnegative(),
        /** Events meeting expectations percentage */
        expectations_met_rate: zod_1.z.number().min(0).max(1),
        /** Key findings (informational summaries) */
        key_findings: zod_1.z.array(zod_1.z.string()),
        /** Improvement suggestions (informational only - NOT actionable by this agent) */
        improvement_suggestions: zod_1.z.array(zod_1.z.string()),
    }),
    /** Reflection metadata */
    version: zod_1.z.string().default('1.0.0'),
});
//# sourceMappingURL=reflection-schemas.js.map