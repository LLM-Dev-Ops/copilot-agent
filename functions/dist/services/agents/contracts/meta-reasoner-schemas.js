"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaReasonerOutputSchema = exports.ReasoningQualityMetricsSchema = exports.SystemicIssueSchema = exports.ConfidenceCalibrationSchema = exports.ContradictionSchema = exports.MetaReasonerInputSchema = exports.ReasoningTraceSchema = void 0;
const zod_1 = require("zod");
/**
 * Reasoning trace from an agent to analyze
 */
exports.ReasoningTraceSchema = zod_1.z.object({
    /** Source agent ID */
    agent_id: zod_1.z.string().min(1),
    /** Source agent version */
    agent_version: zod_1.z.string().regex(/^\d+\.\d+\.\d+$/),
    /** Decision type made by the agent */
    decision_type: zod_1.z.string().min(1),
    /** Execution reference for tracing */
    execution_ref: zod_1.z.string().uuid(),
    /** Timestamp of the decision */
    timestamp: zod_1.z.string().datetime(),
    /** Confidence reported by the agent */
    reported_confidence: zod_1.z.number().min(0).max(1),
    /** The reasoning steps or outputs to analyze */
    reasoning_content: zod_1.z.unknown(),
    /** Constraints that were applied */
    constraints_applied: zod_1.z.array(zod_1.z.string()).default([]),
    /** Optional tags for categorization */
    tags: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * Meta-Reasoner Input Schema
 */
exports.MetaReasonerInputSchema = zod_1.z.object({
    /** Reasoning traces to analyze (1 or more) */
    traces: zod_1.z.array(exports.ReasoningTraceSchema).min(1).max(100),
    /** Analysis scope configuration */
    scope: zod_1.z.object({
        /** Check for contradictions between traces */
        detect_contradictions: zod_1.z.boolean().default(true),
        /** Assess if confidence scores are well-calibrated */
        assess_confidence_calibration: zod_1.z.boolean().default(true),
        /** Identify systemic reasoning patterns/issues */
        identify_systemic_issues: zod_1.z.boolean().default(true),
        /** Check for logical fallacies */
        detect_fallacies: zod_1.z.boolean().default(false),
        /** Analyze reasoning chain completeness */
        check_completeness: zod_1.z.boolean().default(false),
    }).default({}),
    /** Analysis context */
    context: zod_1.z.object({
        /** Domain context for analysis */
        domain: zod_1.z.string().optional(),
        /** Reference standards or baselines */
        reference_standards: zod_1.z.array(zod_1.z.string()).default([]),
        /** Historical accuracy data for agents (for calibration) */
        historical_accuracy: zod_1.z.record(zod_1.z.string(), zod_1.z.number().min(0).max(1)).optional(),
        /** Correlation groups (traces that should be consistent) */
        correlation_groups: zod_1.z.array(zod_1.z.array(zod_1.z.string())).default([]),
    }).optional(),
    /** Request identifier for tracing */
    request_id: zod_1.z.string().uuid().optional(),
});
/**
 * Contradiction finding
 */
exports.ContradictionSchema = zod_1.z.object({
    /** Unique ID for this contradiction */
    contradiction_id: zod_1.z.string().min(1),
    /** Type of contradiction */
    type: zod_1.z.enum([
        'direct', // Explicit logical contradiction
        'implicit', // Implied contradiction through inference
        'temporal', // Contradicts previous state/decision
        'contextual', // Contradiction given specific context
        'statistical', // Statistical inconsistency
    ]),
    /** Severity of the contradiction */
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Execution refs of the traces involved */
    involved_traces: zod_1.z.array(zod_1.z.string().uuid()).min(2),
    /** Agent IDs involved */
    involved_agents: zod_1.z.array(zod_1.z.string()).min(1),
    /** Description of the contradiction */
    description: zod_1.z.string().min(1),
    /** Evidence supporting this finding */
    evidence: zod_1.z.array(zod_1.z.object({
        trace_ref: zod_1.z.string().uuid(),
        excerpt: zod_1.z.string(),
        relevance: zod_1.z.string(),
    })).min(1),
    /** Confidence in this finding */
    finding_confidence: zod_1.z.number().min(0).max(1),
});
/**
 * Confidence calibration assessment
 */
exports.ConfidenceCalibrationSchema = zod_1.z.object({
    /** Agent ID being assessed */
    agent_id: zod_1.z.string().min(1),
    /** Calibration score (1.0 = perfectly calibrated) */
    calibration_score: zod_1.z.number().min(0).max(1),
    /** Assessment category */
    assessment: zod_1.z.enum([
        'well_calibrated', // Confidence matches accuracy
        'overconfident', // Claims higher confidence than warranted
        'underconfident', // Claims lower confidence than warranted
        'inconsistent', // Confidence varies unpredictably
        'insufficient_data', // Not enough data to assess
    ]),
    /** Mean reported confidence */
    mean_reported_confidence: zod_1.z.number().min(0).max(1),
    /** Expected accuracy based on historical data */
    expected_accuracy: zod_1.z.number().min(0).max(1).optional(),
    /** Calibration gap (positive = overconfident, negative = underconfident) */
    calibration_gap: zod_1.z.number().min(-1).max(1).optional(),
    /** Number of traces analyzed */
    traces_analyzed: zod_1.z.number().int().nonnegative(),
    /** Recommendations for calibration improvement */
    recommendations: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * Systemic reasoning issue
 */
exports.SystemicIssueSchema = zod_1.z.object({
    /** Unique ID for this issue */
    issue_id: zod_1.z.string().min(1),
    /** Type of systemic issue */
    type: zod_1.z.enum([
        'reasoning_gap', // Missing step in reasoning chain
        'circular_reasoning', // Conclusion used as premise
        'anchoring_bias', // Over-reliance on initial information
        'confirmation_bias', // Favoring confirming evidence
        'availability_bias', // Over-weighting easily recalled info
        'pattern_overfitting', // Seeing patterns that don't exist
        'scope_creep', // Analysis exceeds defined boundaries
        'premature_conclusion', // Concluding before sufficient analysis
        'inconsistent_criteria', // Applying different standards
        'missing_uncertainty', // Not acknowledging unknowns
    ]),
    /** Severity of the issue */
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Agent IDs exhibiting this issue */
    affected_agents: zod_1.z.array(zod_1.z.string()).min(1),
    /** Execution refs where issue was observed */
    occurrences: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    /** Frequency of occurrence */
    frequency: zod_1.z.enum(['isolated', 'occasional', 'frequent', 'pervasive']),
    /** Description of the issue */
    description: zod_1.z.string().min(1),
    /** Evidence supporting this finding */
    evidence: zod_1.z.array(zod_1.z.object({
        trace_ref: zod_1.z.string().uuid(),
        observation: zod_1.z.string(),
    })).min(1),
    /** Impact assessment */
    impact: zod_1.z.string().min(1),
    /** Confidence in this finding */
    finding_confidence: zod_1.z.number().min(0).max(1),
});
/**
 * Reasoning quality metrics
 */
exports.ReasoningQualityMetricsSchema = zod_1.z.object({
    /** Overall quality score */
    overall_score: zod_1.z.number().min(0).max(1),
    /** Logical consistency score */
    consistency_score: zod_1.z.number().min(0).max(1),
    /** Completeness of reasoning */
    completeness_score: zod_1.z.number().min(0).max(1),
    /** Clarity of reasoning */
    clarity_score: zod_1.z.number().min(0).max(1),
    /** Accuracy of stated constraints adherence */
    constraint_adherence_score: zod_1.z.number().min(0).max(1),
    /** Number of traces analyzed */
    traces_analyzed: zod_1.z.number().int().nonnegative(),
    /** Number of unique agents analyzed */
    agents_analyzed: zod_1.z.number().int().nonnegative(),
    /** Analysis coverage percentage */
    coverage_percentage: zod_1.z.number().min(0).max(100),
});
/**
 * Meta-Reasoner Output Schema
 */
exports.MetaReasonerOutputSchema = zod_1.z.object({
    /** Unique analysis ID */
    analysis_id: zod_1.z.string().uuid(),
    /** Summary of the analysis */
    summary: zod_1.z.string().min(1),
    /** Overall reasoning quality metrics */
    quality_metrics: exports.ReasoningQualityMetricsSchema,
    /** Detected contradictions */
    contradictions: zod_1.z.array(exports.ContradictionSchema).default([]),
    /** Confidence calibration assessments (per agent) */
    confidence_calibrations: zod_1.z.array(exports.ConfidenceCalibrationSchema).default([]),
    /** Identified systemic issues */
    systemic_issues: zod_1.z.array(exports.SystemicIssueSchema).default([]),
    /** Analysis metadata */
    analysis_metadata: zod_1.z.object({
        /** Total traces provided */
        total_traces: zod_1.z.number().int().nonnegative(),
        /** Traces successfully analyzed */
        traces_analyzed: zod_1.z.number().int().nonnegative(),
        /** Unique agents in input */
        unique_agents: zod_1.z.number().int().nonnegative(),
        /** Unique decision types */
        unique_decision_types: zod_1.z.number().int().nonnegative(),
        /** Time span of traces analyzed */
        time_span: zod_1.z.object({
            earliest: zod_1.z.string().datetime(),
            latest: zod_1.z.string().datetime(),
        }).optional(),
        /** Scope of analysis performed */
        scope_executed: zod_1.z.object({
            contradictions_checked: zod_1.z.boolean(),
            calibration_assessed: zod_1.z.boolean(),
            systemic_issues_checked: zod_1.z.boolean(),
            fallacies_checked: zod_1.z.boolean(),
            completeness_checked: zod_1.z.boolean(),
        }),
    }),
    /** Key findings (prioritized list) */
    key_findings: zod_1.z.array(zod_1.z.object({
        priority: zod_1.z.number().int().min(1).max(10),
        category: zod_1.z.enum(['contradiction', 'calibration', 'systemic', 'quality']),
        finding: zod_1.z.string().min(1),
        affected_entities: zod_1.z.array(zod_1.z.string()),
    })).default([]),
    /** Assumptions made during analysis */
    assumptions: zod_1.z.array(zod_1.z.string()).default([]),
    /** Output version */
    version: zod_1.z.string().default('1.0.0'),
});
//# sourceMappingURL=meta-reasoner-schemas.js.map