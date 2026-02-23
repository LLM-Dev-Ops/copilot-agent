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
/**
 * Reasoning trace from an agent to analyze
 */
export declare const ReasoningTraceSchema: z.ZodObject<{
    /** Source agent ID */
    agent_id: z.ZodString;
    /** Source agent version */
    agent_version: z.ZodString;
    /** Decision type made by the agent */
    decision_type: z.ZodString;
    /** Execution reference for tracing */
    execution_ref: z.ZodString;
    /** Timestamp of the decision */
    timestamp: z.ZodString;
    /** Confidence reported by the agent */
    reported_confidence: z.ZodNumber;
    /** The reasoning steps or outputs to analyze */
    reasoning_content: z.ZodUnknown;
    /** Constraints that were applied */
    constraints_applied: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Optional tags for categorization */
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    agent_id: string;
    agent_version: string;
    decision_type: string;
    constraints_applied: string[];
    execution_ref: string;
    timestamp: string;
    tags: string[];
    reported_confidence: number;
    reasoning_content?: unknown;
}, {
    agent_id: string;
    agent_version: string;
    decision_type: string;
    execution_ref: string;
    timestamp: string;
    reported_confidence: number;
    constraints_applied?: string[] | undefined;
    tags?: string[] | undefined;
    reasoning_content?: unknown;
}>;
export type ReasoningTrace = z.infer<typeof ReasoningTraceSchema>;
/**
 * Meta-Reasoner Input Schema
 */
export declare const MetaReasonerInputSchema: z.ZodObject<{
    /** Reasoning traces to analyze (1 or more) */
    traces: z.ZodArray<z.ZodObject<{
        /** Source agent ID */
        agent_id: z.ZodString;
        /** Source agent version */
        agent_version: z.ZodString;
        /** Decision type made by the agent */
        decision_type: z.ZodString;
        /** Execution reference for tracing */
        execution_ref: z.ZodString;
        /** Timestamp of the decision */
        timestamp: z.ZodString;
        /** Confidence reported by the agent */
        reported_confidence: z.ZodNumber;
        /** The reasoning steps or outputs to analyze */
        reasoning_content: z.ZodUnknown;
        /** Constraints that were applied */
        constraints_applied: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Optional tags for categorization */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        tags: string[];
        reported_confidence: number;
        reasoning_content?: unknown;
    }, {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        execution_ref: string;
        timestamp: string;
        reported_confidence: number;
        constraints_applied?: string[] | undefined;
        tags?: string[] | undefined;
        reasoning_content?: unknown;
    }>, "many">;
    /** Analysis scope configuration */
    scope: z.ZodDefault<z.ZodObject<{
        /** Check for contradictions between traces */
        detect_contradictions: z.ZodDefault<z.ZodBoolean>;
        /** Assess if confidence scores are well-calibrated */
        assess_confidence_calibration: z.ZodDefault<z.ZodBoolean>;
        /** Identify systemic reasoning patterns/issues */
        identify_systemic_issues: z.ZodDefault<z.ZodBoolean>;
        /** Check for logical fallacies */
        detect_fallacies: z.ZodDefault<z.ZodBoolean>;
        /** Analyze reasoning chain completeness */
        check_completeness: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        detect_contradictions: boolean;
        assess_confidence_calibration: boolean;
        identify_systemic_issues: boolean;
        detect_fallacies: boolean;
        check_completeness: boolean;
    }, {
        detect_contradictions?: boolean | undefined;
        assess_confidence_calibration?: boolean | undefined;
        identify_systemic_issues?: boolean | undefined;
        detect_fallacies?: boolean | undefined;
        check_completeness?: boolean | undefined;
    }>>;
    /** Analysis context */
    context: z.ZodOptional<z.ZodObject<{
        /** Domain context for analysis */
        domain: z.ZodOptional<z.ZodString>;
        /** Reference standards or baselines */
        reference_standards: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Historical accuracy data for agents (for calibration) */
        historical_accuracy: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        /** Correlation groups (traces that should be consistent) */
        correlation_groups: z.ZodDefault<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">>;
    }, "strip", z.ZodTypeAny, {
        reference_standards: string[];
        correlation_groups: string[][];
        domain?: string | undefined;
        historical_accuracy?: Record<string, number> | undefined;
    }, {
        domain?: string | undefined;
        reference_standards?: string[] | undefined;
        historical_accuracy?: Record<string, number> | undefined;
        correlation_groups?: string[][] | undefined;
    }>>;
    /** Request identifier for tracing */
    request_id: z.ZodOptional<z.ZodString>;
    /** Optional pipeline context for multi-agent orchestration */
    pipeline_context: z.ZodOptional<z.ZodObject<{
        plan_id: z.ZodString;
        step_id: z.ZodString;
        previous_steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
            step_id: z.ZodString;
            domain: z.ZodString;
            agent: z.ZodString;
            output: z.ZodOptional<z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            step_id: string;
            domain: string;
            agent: string;
            output?: unknown;
        }, {
            step_id: string;
            domain: string;
            agent: string;
            output?: unknown;
        }>, "many">>;
        execution_metadata: z.ZodOptional<z.ZodObject<{
            trace_id: z.ZodString;
            initiated_by: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            trace_id: string;
            initiated_by: string;
        }, {
            trace_id: string;
            initiated_by: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        step_id: string;
        plan_id: string;
        previous_steps: {
            step_id: string;
            domain: string;
            agent: string;
            output?: unknown;
        }[];
        execution_metadata?: {
            trace_id: string;
            initiated_by: string;
        } | undefined;
    }, {
        step_id: string;
        plan_id: string;
        previous_steps?: {
            step_id: string;
            domain: string;
            agent: string;
            output?: unknown;
        }[] | undefined;
        execution_metadata?: {
            trace_id: string;
            initiated_by: string;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    traces: {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        tags: string[];
        reported_confidence: number;
        reasoning_content?: unknown;
    }[];
    scope: {
        detect_contradictions: boolean;
        assess_confidence_calibration: boolean;
        identify_systemic_issues: boolean;
        detect_fallacies: boolean;
        check_completeness: boolean;
    };
    context?: {
        reference_standards: string[];
        correlation_groups: string[][];
        domain?: string | undefined;
        historical_accuracy?: Record<string, number> | undefined;
    } | undefined;
    request_id?: string | undefined;
    pipeline_context?: {
        step_id: string;
        plan_id: string;
        previous_steps: {
            step_id: string;
            domain: string;
            agent: string;
            output?: unknown;
        }[];
        execution_metadata?: {
            trace_id: string;
            initiated_by: string;
        } | undefined;
    } | undefined;
}, {
    traces: {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        execution_ref: string;
        timestamp: string;
        reported_confidence: number;
        constraints_applied?: string[] | undefined;
        tags?: string[] | undefined;
        reasoning_content?: unknown;
    }[];
    context?: {
        domain?: string | undefined;
        reference_standards?: string[] | undefined;
        historical_accuracy?: Record<string, number> | undefined;
        correlation_groups?: string[][] | undefined;
    } | undefined;
    request_id?: string | undefined;
    pipeline_context?: {
        step_id: string;
        plan_id: string;
        previous_steps?: {
            step_id: string;
            domain: string;
            agent: string;
            output?: unknown;
        }[] | undefined;
        execution_metadata?: {
            trace_id: string;
            initiated_by: string;
        } | undefined;
    } | undefined;
    scope?: {
        detect_contradictions?: boolean | undefined;
        assess_confidence_calibration?: boolean | undefined;
        identify_systemic_issues?: boolean | undefined;
        detect_fallacies?: boolean | undefined;
        check_completeness?: boolean | undefined;
    } | undefined;
}>;
export type MetaReasonerInput = z.infer<typeof MetaReasonerInputSchema>;
/**
 * Contradiction finding
 */
export declare const ContradictionSchema: z.ZodObject<{
    /** Unique ID for this contradiction */
    contradiction_id: z.ZodString;
    /** Type of contradiction */
    type: z.ZodEnum<["direct", "implicit", "temporal", "contextual", "statistical"]>;
    /** Severity of the contradiction */
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    /** Execution refs of the traces involved */
    involved_traces: z.ZodArray<z.ZodString, "many">;
    /** Agent IDs involved */
    involved_agents: z.ZodArray<z.ZodString, "many">;
    /** Description of the contradiction */
    description: z.ZodString;
    /** Evidence supporting this finding */
    evidence: z.ZodArray<z.ZodObject<{
        trace_ref: z.ZodString;
        excerpt: z.ZodString;
        relevance: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        trace_ref: string;
        excerpt: string;
        relevance: string;
    }, {
        trace_ref: string;
        excerpt: string;
        relevance: string;
    }>, "many">;
    /** Confidence in this finding */
    finding_confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "temporal" | "direct" | "implicit" | "contextual" | "statistical";
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    evidence: {
        trace_ref: string;
        excerpt: string;
        relevance: string;
    }[];
    contradiction_id: string;
    involved_traces: string[];
    involved_agents: string[];
    finding_confidence: number;
}, {
    type: "temporal" | "direct" | "implicit" | "contextual" | "statistical";
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    evidence: {
        trace_ref: string;
        excerpt: string;
        relevance: string;
    }[];
    contradiction_id: string;
    involved_traces: string[];
    involved_agents: string[];
    finding_confidence: number;
}>;
export type Contradiction = z.infer<typeof ContradictionSchema>;
/**
 * Confidence calibration assessment
 */
export declare const ConfidenceCalibrationSchema: z.ZodObject<{
    /** Agent ID being assessed */
    agent_id: z.ZodString;
    /** Calibration score (1.0 = perfectly calibrated) */
    calibration_score: z.ZodNumber;
    /** Assessment category */
    assessment: z.ZodEnum<["well_calibrated", "overconfident", "underconfident", "inconsistent", "insufficient_data"]>;
    /** Mean reported confidence */
    mean_reported_confidence: z.ZodNumber;
    /** Expected accuracy based on historical data */
    expected_accuracy: z.ZodOptional<z.ZodNumber>;
    /** Calibration gap (positive = overconfident, negative = underconfident) */
    calibration_gap: z.ZodOptional<z.ZodNumber>;
    /** Number of traces analyzed */
    traces_analyzed: z.ZodNumber;
    /** Recommendations for calibration improvement */
    recommendations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    agent_id: string;
    recommendations: string[];
    calibration_score: number;
    assessment: "well_calibrated" | "overconfident" | "underconfident" | "inconsistent" | "insufficient_data";
    mean_reported_confidence: number;
    traces_analyzed: number;
    expected_accuracy?: number | undefined;
    calibration_gap?: number | undefined;
}, {
    agent_id: string;
    calibration_score: number;
    assessment: "well_calibrated" | "overconfident" | "underconfident" | "inconsistent" | "insufficient_data";
    mean_reported_confidence: number;
    traces_analyzed: number;
    recommendations?: string[] | undefined;
    expected_accuracy?: number | undefined;
    calibration_gap?: number | undefined;
}>;
export type ConfidenceCalibration = z.infer<typeof ConfidenceCalibrationSchema>;
/**
 * Systemic reasoning issue
 */
export declare const SystemicIssueSchema: z.ZodObject<{
    /** Unique ID for this issue */
    issue_id: z.ZodString;
    /** Type of systemic issue */
    type: z.ZodEnum<["reasoning_gap", "circular_reasoning", "anchoring_bias", "confirmation_bias", "availability_bias", "pattern_overfitting", "scope_creep", "premature_conclusion", "inconsistent_criteria", "missing_uncertainty"]>;
    /** Severity of the issue */
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    /** Agent IDs exhibiting this issue */
    affected_agents: z.ZodArray<z.ZodString, "many">;
    /** Execution refs where issue was observed */
    occurrences: z.ZodArray<z.ZodString, "many">;
    /** Frequency of occurrence */
    frequency: z.ZodEnum<["isolated", "occasional", "frequent", "pervasive"]>;
    /** Description of the issue */
    description: z.ZodString;
    /** Evidence supporting this finding */
    evidence: z.ZodArray<z.ZodObject<{
        trace_ref: z.ZodString;
        observation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        trace_ref: string;
        observation: string;
    }, {
        trace_ref: string;
        observation: string;
    }>, "many">;
    /** Impact assessment */
    impact: z.ZodString;
    /** Confidence in this finding */
    finding_confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "reasoning_gap" | "circular_reasoning" | "anchoring_bias" | "confirmation_bias" | "availability_bias" | "pattern_overfitting" | "scope_creep" | "premature_conclusion" | "inconsistent_criteria" | "missing_uncertainty";
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    evidence: {
        trace_ref: string;
        observation: string;
    }[];
    affected_agents: string[];
    impact: string;
    finding_confidence: number;
    issue_id: string;
    occurrences: string[];
    frequency: "isolated" | "occasional" | "frequent" | "pervasive";
}, {
    type: "reasoning_gap" | "circular_reasoning" | "anchoring_bias" | "confirmation_bias" | "availability_bias" | "pattern_overfitting" | "scope_creep" | "premature_conclusion" | "inconsistent_criteria" | "missing_uncertainty";
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    evidence: {
        trace_ref: string;
        observation: string;
    }[];
    affected_agents: string[];
    impact: string;
    finding_confidence: number;
    issue_id: string;
    occurrences: string[];
    frequency: "isolated" | "occasional" | "frequent" | "pervasive";
}>;
export type SystemicIssue = z.infer<typeof SystemicIssueSchema>;
/**
 * Reasoning quality metrics
 */
export declare const ReasoningQualityMetricsSchema: z.ZodObject<{
    /** Overall quality score */
    overall_score: z.ZodNumber;
    /** Logical consistency score */
    consistency_score: z.ZodNumber;
    /** Completeness of reasoning */
    completeness_score: z.ZodNumber;
    /** Clarity of reasoning */
    clarity_score: z.ZodNumber;
    /** Accuracy of stated constraints adherence */
    constraint_adherence_score: z.ZodNumber;
    /** Number of traces analyzed */
    traces_analyzed: z.ZodNumber;
    /** Number of unique agents analyzed */
    agents_analyzed: z.ZodNumber;
    /** Analysis coverage percentage */
    coverage_percentage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    agents_analyzed: number;
    traces_analyzed: number;
    overall_score: number;
    consistency_score: number;
    completeness_score: number;
    clarity_score: number;
    constraint_adherence_score: number;
    coverage_percentage: number;
}, {
    agents_analyzed: number;
    traces_analyzed: number;
    overall_score: number;
    consistency_score: number;
    completeness_score: number;
    clarity_score: number;
    constraint_adherence_score: number;
    coverage_percentage: number;
}>;
export type ReasoningQualityMetrics = z.infer<typeof ReasoningQualityMetricsSchema>;
/**
 * Meta-Reasoner Output Schema
 */
export declare const MetaReasonerOutputSchema: z.ZodObject<{
    /** Unique analysis ID */
    analysis_id: z.ZodString;
    /** Summary of the analysis */
    summary: z.ZodString;
    /** Overall reasoning quality metrics */
    quality_metrics: z.ZodObject<{
        /** Overall quality score */
        overall_score: z.ZodNumber;
        /** Logical consistency score */
        consistency_score: z.ZodNumber;
        /** Completeness of reasoning */
        completeness_score: z.ZodNumber;
        /** Clarity of reasoning */
        clarity_score: z.ZodNumber;
        /** Accuracy of stated constraints adherence */
        constraint_adherence_score: z.ZodNumber;
        /** Number of traces analyzed */
        traces_analyzed: z.ZodNumber;
        /** Number of unique agents analyzed */
        agents_analyzed: z.ZodNumber;
        /** Analysis coverage percentage */
        coverage_percentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        agents_analyzed: number;
        traces_analyzed: number;
        overall_score: number;
        consistency_score: number;
        completeness_score: number;
        clarity_score: number;
        constraint_adherence_score: number;
        coverage_percentage: number;
    }, {
        agents_analyzed: number;
        traces_analyzed: number;
        overall_score: number;
        consistency_score: number;
        completeness_score: number;
        clarity_score: number;
        constraint_adherence_score: number;
        coverage_percentage: number;
    }>;
    /** Detected contradictions */
    contradictions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Unique ID for this contradiction */
        contradiction_id: z.ZodString;
        /** Type of contradiction */
        type: z.ZodEnum<["direct", "implicit", "temporal", "contextual", "statistical"]>;
        /** Severity of the contradiction */
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        /** Execution refs of the traces involved */
        involved_traces: z.ZodArray<z.ZodString, "many">;
        /** Agent IDs involved */
        involved_agents: z.ZodArray<z.ZodString, "many">;
        /** Description of the contradiction */
        description: z.ZodString;
        /** Evidence supporting this finding */
        evidence: z.ZodArray<z.ZodObject<{
            trace_ref: z.ZodString;
            excerpt: z.ZodString;
            relevance: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            trace_ref: string;
            excerpt: string;
            relevance: string;
        }, {
            trace_ref: string;
            excerpt: string;
            relevance: string;
        }>, "many">;
        /** Confidence in this finding */
        finding_confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "temporal" | "direct" | "implicit" | "contextual" | "statistical";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            excerpt: string;
            relevance: string;
        }[];
        contradiction_id: string;
        involved_traces: string[];
        involved_agents: string[];
        finding_confidence: number;
    }, {
        type: "temporal" | "direct" | "implicit" | "contextual" | "statistical";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            excerpt: string;
            relevance: string;
        }[];
        contradiction_id: string;
        involved_traces: string[];
        involved_agents: string[];
        finding_confidence: number;
    }>, "many">>;
    /** Confidence calibration assessments (per agent) */
    confidence_calibrations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Agent ID being assessed */
        agent_id: z.ZodString;
        /** Calibration score (1.0 = perfectly calibrated) */
        calibration_score: z.ZodNumber;
        /** Assessment category */
        assessment: z.ZodEnum<["well_calibrated", "overconfident", "underconfident", "inconsistent", "insufficient_data"]>;
        /** Mean reported confidence */
        mean_reported_confidence: z.ZodNumber;
        /** Expected accuracy based on historical data */
        expected_accuracy: z.ZodOptional<z.ZodNumber>;
        /** Calibration gap (positive = overconfident, negative = underconfident) */
        calibration_gap: z.ZodOptional<z.ZodNumber>;
        /** Number of traces analyzed */
        traces_analyzed: z.ZodNumber;
        /** Recommendations for calibration improvement */
        recommendations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        agent_id: string;
        recommendations: string[];
        calibration_score: number;
        assessment: "well_calibrated" | "overconfident" | "underconfident" | "inconsistent" | "insufficient_data";
        mean_reported_confidence: number;
        traces_analyzed: number;
        expected_accuracy?: number | undefined;
        calibration_gap?: number | undefined;
    }, {
        agent_id: string;
        calibration_score: number;
        assessment: "well_calibrated" | "overconfident" | "underconfident" | "inconsistent" | "insufficient_data";
        mean_reported_confidence: number;
        traces_analyzed: number;
        recommendations?: string[] | undefined;
        expected_accuracy?: number | undefined;
        calibration_gap?: number | undefined;
    }>, "many">>;
    /** Identified systemic issues */
    systemic_issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Unique ID for this issue */
        issue_id: z.ZodString;
        /** Type of systemic issue */
        type: z.ZodEnum<["reasoning_gap", "circular_reasoning", "anchoring_bias", "confirmation_bias", "availability_bias", "pattern_overfitting", "scope_creep", "premature_conclusion", "inconsistent_criteria", "missing_uncertainty"]>;
        /** Severity of the issue */
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        /** Agent IDs exhibiting this issue */
        affected_agents: z.ZodArray<z.ZodString, "many">;
        /** Execution refs where issue was observed */
        occurrences: z.ZodArray<z.ZodString, "many">;
        /** Frequency of occurrence */
        frequency: z.ZodEnum<["isolated", "occasional", "frequent", "pervasive"]>;
        /** Description of the issue */
        description: z.ZodString;
        /** Evidence supporting this finding */
        evidence: z.ZodArray<z.ZodObject<{
            trace_ref: z.ZodString;
            observation: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            trace_ref: string;
            observation: string;
        }, {
            trace_ref: string;
            observation: string;
        }>, "many">;
        /** Impact assessment */
        impact: z.ZodString;
        /** Confidence in this finding */
        finding_confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "reasoning_gap" | "circular_reasoning" | "anchoring_bias" | "confirmation_bias" | "availability_bias" | "pattern_overfitting" | "scope_creep" | "premature_conclusion" | "inconsistent_criteria" | "missing_uncertainty";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            observation: string;
        }[];
        affected_agents: string[];
        impact: string;
        finding_confidence: number;
        issue_id: string;
        occurrences: string[];
        frequency: "isolated" | "occasional" | "frequent" | "pervasive";
    }, {
        type: "reasoning_gap" | "circular_reasoning" | "anchoring_bias" | "confirmation_bias" | "availability_bias" | "pattern_overfitting" | "scope_creep" | "premature_conclusion" | "inconsistent_criteria" | "missing_uncertainty";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            observation: string;
        }[];
        affected_agents: string[];
        impact: string;
        finding_confidence: number;
        issue_id: string;
        occurrences: string[];
        frequency: "isolated" | "occasional" | "frequent" | "pervasive";
    }>, "many">>;
    /** Analysis metadata */
    analysis_metadata: z.ZodObject<{
        /** Total traces provided */
        total_traces: z.ZodNumber;
        /** Traces successfully analyzed */
        traces_analyzed: z.ZodNumber;
        /** Unique agents in input */
        unique_agents: z.ZodNumber;
        /** Unique decision types */
        unique_decision_types: z.ZodNumber;
        /** Time span of traces analyzed */
        time_span: z.ZodOptional<z.ZodObject<{
            earliest: z.ZodString;
            latest: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            earliest: string;
            latest: string;
        }, {
            earliest: string;
            latest: string;
        }>>;
        /** Scope of analysis performed */
        scope_executed: z.ZodObject<{
            contradictions_checked: z.ZodBoolean;
            calibration_assessed: z.ZodBoolean;
            systemic_issues_checked: z.ZodBoolean;
            fallacies_checked: z.ZodBoolean;
            completeness_checked: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            contradictions_checked: boolean;
            calibration_assessed: boolean;
            systemic_issues_checked: boolean;
            fallacies_checked: boolean;
            completeness_checked: boolean;
        }, {
            contradictions_checked: boolean;
            calibration_assessed: boolean;
            systemic_issues_checked: boolean;
            fallacies_checked: boolean;
            completeness_checked: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        traces_analyzed: number;
        total_traces: number;
        unique_agents: number;
        unique_decision_types: number;
        scope_executed: {
            contradictions_checked: boolean;
            calibration_assessed: boolean;
            systemic_issues_checked: boolean;
            fallacies_checked: boolean;
            completeness_checked: boolean;
        };
        time_span?: {
            earliest: string;
            latest: string;
        } | undefined;
    }, {
        traces_analyzed: number;
        total_traces: number;
        unique_agents: number;
        unique_decision_types: number;
        scope_executed: {
            contradictions_checked: boolean;
            calibration_assessed: boolean;
            systemic_issues_checked: boolean;
            fallacies_checked: boolean;
            completeness_checked: boolean;
        };
        time_span?: {
            earliest: string;
            latest: string;
        } | undefined;
    }>;
    /** Key findings (prioritized list) */
    key_findings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        priority: z.ZodNumber;
        category: z.ZodEnum<["contradiction", "calibration", "systemic", "quality"]>;
        finding: z.ZodString;
        affected_entities: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        category: "quality" | "contradiction" | "calibration" | "systemic";
        priority: number;
        finding: string;
        affected_entities: string[];
    }, {
        category: "quality" | "contradiction" | "calibration" | "systemic";
        priority: number;
        finding: string;
        affected_entities: string[];
    }>, "many">>;
    /** Assumptions made during analysis */
    assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Output version */
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: string;
    assumptions: string[];
    summary: string;
    key_findings: {
        category: "quality" | "contradiction" | "calibration" | "systemic";
        priority: number;
        finding: string;
        affected_entities: string[];
    }[];
    analysis_id: string;
    quality_metrics: {
        agents_analyzed: number;
        traces_analyzed: number;
        overall_score: number;
        consistency_score: number;
        completeness_score: number;
        clarity_score: number;
        constraint_adherence_score: number;
        coverage_percentage: number;
    };
    contradictions: {
        type: "temporal" | "direct" | "implicit" | "contextual" | "statistical";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            excerpt: string;
            relevance: string;
        }[];
        contradiction_id: string;
        involved_traces: string[];
        involved_agents: string[];
        finding_confidence: number;
    }[];
    confidence_calibrations: {
        agent_id: string;
        recommendations: string[];
        calibration_score: number;
        assessment: "well_calibrated" | "overconfident" | "underconfident" | "inconsistent" | "insufficient_data";
        mean_reported_confidence: number;
        traces_analyzed: number;
        expected_accuracy?: number | undefined;
        calibration_gap?: number | undefined;
    }[];
    systemic_issues: {
        type: "reasoning_gap" | "circular_reasoning" | "anchoring_bias" | "confirmation_bias" | "availability_bias" | "pattern_overfitting" | "scope_creep" | "premature_conclusion" | "inconsistent_criteria" | "missing_uncertainty";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            observation: string;
        }[];
        affected_agents: string[];
        impact: string;
        finding_confidence: number;
        issue_id: string;
        occurrences: string[];
        frequency: "isolated" | "occasional" | "frequent" | "pervasive";
    }[];
    analysis_metadata: {
        traces_analyzed: number;
        total_traces: number;
        unique_agents: number;
        unique_decision_types: number;
        scope_executed: {
            contradictions_checked: boolean;
            calibration_assessed: boolean;
            systemic_issues_checked: boolean;
            fallacies_checked: boolean;
            completeness_checked: boolean;
        };
        time_span?: {
            earliest: string;
            latest: string;
        } | undefined;
    };
}, {
    summary: string;
    analysis_id: string;
    quality_metrics: {
        agents_analyzed: number;
        traces_analyzed: number;
        overall_score: number;
        consistency_score: number;
        completeness_score: number;
        clarity_score: number;
        constraint_adherence_score: number;
        coverage_percentage: number;
    };
    analysis_metadata: {
        traces_analyzed: number;
        total_traces: number;
        unique_agents: number;
        unique_decision_types: number;
        scope_executed: {
            contradictions_checked: boolean;
            calibration_assessed: boolean;
            systemic_issues_checked: boolean;
            fallacies_checked: boolean;
            completeness_checked: boolean;
        };
        time_span?: {
            earliest: string;
            latest: string;
        } | undefined;
    };
    version?: string | undefined;
    assumptions?: string[] | undefined;
    key_findings?: {
        category: "quality" | "contradiction" | "calibration" | "systemic";
        priority: number;
        finding: string;
        affected_entities: string[];
    }[] | undefined;
    contradictions?: {
        type: "temporal" | "direct" | "implicit" | "contextual" | "statistical";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            excerpt: string;
            relevance: string;
        }[];
        contradiction_id: string;
        involved_traces: string[];
        involved_agents: string[];
        finding_confidence: number;
    }[] | undefined;
    confidence_calibrations?: {
        agent_id: string;
        calibration_score: number;
        assessment: "well_calibrated" | "overconfident" | "underconfident" | "inconsistent" | "insufficient_data";
        mean_reported_confidence: number;
        traces_analyzed: number;
        recommendations?: string[] | undefined;
        expected_accuracy?: number | undefined;
        calibration_gap?: number | undefined;
    }[] | undefined;
    systemic_issues?: {
        type: "reasoning_gap" | "circular_reasoning" | "anchoring_bias" | "confirmation_bias" | "availability_bias" | "pattern_overfitting" | "scope_creep" | "premature_conclusion" | "inconsistent_criteria" | "missing_uncertainty";
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        evidence: {
            trace_ref: string;
            observation: string;
        }[];
        affected_agents: string[];
        impact: string;
        finding_confidence: number;
        issue_id: string;
        occurrences: string[];
        frequency: "isolated" | "occasional" | "frequent" | "pervasive";
    }[] | undefined;
}>;
export type MetaReasonerOutput = z.infer<typeof MetaReasonerOutputSchema>;
