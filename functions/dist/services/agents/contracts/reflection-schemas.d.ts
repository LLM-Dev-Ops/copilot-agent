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
/**
 * Quality Signal - extracted quality indicators
 */
export declare const QualitySignalSchema: z.ZodObject<{
    /** Unique identifier for this signal */
    signal_id: z.ZodString;
    /** Type of quality signal */
    type: z.ZodEnum<["performance", "accuracy", "completeness", "consistency", "efficiency", "reliability"]>;
    /** Signal value (0.0 - 1.0 normalized score) */
    value: z.ZodNumber;
    /** Human-readable description of the signal */
    description: z.ZodString;
    /** Evidence supporting this signal */
    evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Severity level for negative signals */
    severity: z.ZodOptional<z.ZodEnum<["info", "warning", "error", "critical"]>>;
}, "strip", z.ZodTypeAny, {
    value: number;
    type: "performance" | "accuracy" | "completeness" | "consistency" | "efficiency" | "reliability";
    description: string;
    signal_id: string;
    evidence: string[];
    severity?: "error" | "critical" | "info" | "warning" | undefined;
}, {
    value: number;
    type: "performance" | "accuracy" | "completeness" | "consistency" | "efficiency" | "reliability";
    description: string;
    signal_id: string;
    severity?: "error" | "critical" | "info" | "warning" | undefined;
    evidence?: string[] | undefined;
}>;
export type QualitySignal = z.infer<typeof QualitySignalSchema>;
/**
 * Learning Signal - extracted learning opportunities
 */
export declare const LearningSignalSchema: z.ZodObject<{
    /** Unique identifier for this learning */
    learning_id: z.ZodString;
    /** Category of learning */
    category: z.ZodEnum<["pattern", "anti_pattern", "optimization", "edge_case", "dependency", "constraint"]>;
    /** Brief title for the learning */
    title: z.ZodString;
    /** Detailed description of the learning */
    description: z.ZodString;
    /** Confidence in this learning (0.0 - 1.0) */
    confidence: z.ZodNumber;
    /** Affected agents or components */
    affected_agents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Recommendations for applying this learning (informational only) */
    recommendations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    description: string;
    learning_id: string;
    category: "pattern" | "anti_pattern" | "optimization" | "edge_case" | "dependency" | "constraint";
    title: string;
    affected_agents: string[];
    recommendations: string[];
}, {
    confidence: number;
    description: string;
    learning_id: string;
    category: "pattern" | "anti_pattern" | "optimization" | "edge_case" | "dependency" | "constraint";
    title: string;
    affected_agents?: string[] | undefined;
    recommendations?: string[] | undefined;
}>;
export type LearningSignal = z.infer<typeof LearningSignalSchema>;
/**
 * Gap Analysis - identified gaps or inefficiencies
 */
export declare const GapAnalysisSchema: z.ZodObject<{
    /** Unique identifier for this gap */
    gap_id: z.ZodString;
    /** Type of gap */
    type: z.ZodEnum<["coverage", "capability", "data", "process", "integration", "documentation"]>;
    /** Brief title for the gap */
    title: z.ZodString;
    /** Detailed description of the gap */
    description: z.ZodString;
    /** Impact assessment */
    impact: z.ZodEnum<["low", "medium", "high", "critical"]>;
    /** Steps involved where gap was identified */
    affected_steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Evidence supporting gap identification */
    evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "integration" | "data" | "coverage" | "capability" | "process" | "documentation";
    description: string;
    affected_steps: string[];
    evidence: string[];
    title: string;
    gap_id: string;
    impact: "low" | "medium" | "high" | "critical";
}, {
    type: "integration" | "data" | "coverage" | "capability" | "process" | "documentation";
    description: string;
    title: string;
    gap_id: string;
    impact: "low" | "medium" | "high" | "critical";
    affected_steps?: string[] | undefined;
    evidence?: string[] | undefined;
}>;
export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;
/**
 * Outcome Evaluation - assessment of decision outcomes
 */
export declare const OutcomeEvaluationSchema: z.ZodObject<{
    /** Original decision event being evaluated */
    decision_ref: z.ZodString;
    /** Agent that produced the decision */
    agent_id: z.ZodString;
    /** Decision type being evaluated */
    decision_type: z.ZodString;
    /** Overall outcome score (0.0 - 1.0) */
    outcome_score: z.ZodNumber;
    /** Assessment summary */
    summary: z.ZodString;
    /** Breakdown of outcome by dimension */
    dimensions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        score: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        score: number;
        notes?: string | undefined;
    }, {
        name: string;
        score: number;
        notes?: string | undefined;
    }>, "many">>;
    /** Was the outcome as expected? */
    met_expectations: z.ZodBoolean;
    /** Deviation from expected outcome if any */
    deviation_notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agent_id: string;
    decision_type: string;
    decision_ref: string;
    outcome_score: number;
    summary: string;
    dimensions: {
        name: string;
        score: number;
        notes?: string | undefined;
    }[];
    met_expectations: boolean;
    deviation_notes?: string | undefined;
}, {
    agent_id: string;
    decision_type: string;
    decision_ref: string;
    outcome_score: number;
    summary: string;
    met_expectations: boolean;
    dimensions?: {
        name: string;
        score: number;
        notes?: string | undefined;
    }[] | undefined;
    deviation_notes?: string | undefined;
}>;
export type OutcomeEvaluation = z.infer<typeof OutcomeEvaluationSchema>;
/**
 * Reflection Agent Input Schema
 */
export declare const ReflectionInputSchema: z.ZodObject<{
    /** DecisionEvents to analyze (1-100 events) */
    decision_events: z.ZodArray<z.ZodObject<{
        agent_id: z.ZodString;
        agent_version: z.ZodString;
        decision_type: z.ZodString;
        inputs_hash: z.ZodString;
        outputs: z.ZodUnknown;
        confidence: z.ZodNumber;
        constraints_applied: z.ZodArray<z.ZodString, "many">;
        execution_ref: z.ZodString;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        inputs_hash: string;
        confidence: number;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        outputs?: unknown;
    }, {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        inputs_hash: string;
        confidence: number;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        outputs?: unknown;
    }>, "many">;
    /** Optional context about the analysis scope */
    context: z.ZodOptional<z.ZodObject<{
        /** Focus areas for analysis */
        focus_areas: z.ZodDefault<z.ZodArray<z.ZodEnum<["quality", "learning", "gaps", "outcomes", "all"]>, "many">>;
        /** Time range context */
        time_range: z.ZodOptional<z.ZodObject<{
            from: z.ZodOptional<z.ZodString>;
            to: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            from?: string | undefined;
            to?: string | undefined;
        }, {
            from?: string | undefined;
            to?: string | undefined;
        }>>;
        /** Specific agents to focus on */
        target_agents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Prior reflections to build upon */
        prior_reflection_refs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Domain-specific context */
        domain_context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        focus_areas: ("quality" | "learning" | "gaps" | "outcomes" | "all")[];
        time_range?: {
            from?: string | undefined;
            to?: string | undefined;
        } | undefined;
        target_agents?: string[] | undefined;
        prior_reflection_refs?: string[] | undefined;
        domain_context?: Record<string, string> | undefined;
    }, {
        focus_areas?: ("quality" | "learning" | "gaps" | "outcomes" | "all")[] | undefined;
        time_range?: {
            from?: string | undefined;
            to?: string | undefined;
        } | undefined;
        target_agents?: string[] | undefined;
        prior_reflection_refs?: string[] | undefined;
        domain_context?: Record<string, string> | undefined;
    }>>;
    /** Analysis preferences */
    preferences: z.ZodOptional<z.ZodObject<{
        /** Minimum confidence threshold for signals (0.0 - 1.0) */
        min_confidence: z.ZodDefault<z.ZodNumber>;
        /** Maximum number of signals to return per category */
        max_signals_per_category: z.ZodDefault<z.ZodNumber>;
        /** Include detailed evidence */
        include_evidence: z.ZodDefault<z.ZodBoolean>;
        /** Generate cross-event correlations */
        correlate_events: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        min_confidence: number;
        max_signals_per_category: number;
        include_evidence: boolean;
        correlate_events: boolean;
    }, {
        min_confidence?: number | undefined;
        max_signals_per_category?: number | undefined;
        include_evidence?: boolean | undefined;
        correlate_events?: boolean | undefined;
    }>>;
    /** Request ID for tracing */
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
    decision_events: {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        inputs_hash: string;
        confidence: number;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        outputs?: unknown;
    }[];
    preferences?: {
        min_confidence: number;
        max_signals_per_category: number;
        include_evidence: boolean;
        correlate_events: boolean;
    } | undefined;
    context?: {
        focus_areas: ("quality" | "learning" | "gaps" | "outcomes" | "all")[];
        time_range?: {
            from?: string | undefined;
            to?: string | undefined;
        } | undefined;
        target_agents?: string[] | undefined;
        prior_reflection_refs?: string[] | undefined;
        domain_context?: Record<string, string> | undefined;
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
    decision_events: {
        agent_id: string;
        agent_version: string;
        decision_type: string;
        inputs_hash: string;
        confidence: number;
        constraints_applied: string[];
        execution_ref: string;
        timestamp: string;
        outputs?: unknown;
    }[];
    preferences?: {
        min_confidence?: number | undefined;
        max_signals_per_category?: number | undefined;
        include_evidence?: boolean | undefined;
        correlate_events?: boolean | undefined;
    } | undefined;
    context?: {
        focus_areas?: ("quality" | "learning" | "gaps" | "outcomes" | "all")[] | undefined;
        time_range?: {
            from?: string | undefined;
            to?: string | undefined;
        } | undefined;
        target_agents?: string[] | undefined;
        prior_reflection_refs?: string[] | undefined;
        domain_context?: Record<string, string> | undefined;
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
}>;
export type ReflectionInput = z.infer<typeof ReflectionInputSchema>;
/**
 * Reflection Agent Output Schema
 */
export declare const ReflectionOutputSchema: z.ZodObject<{
    /** Unique reflection identifier */
    reflection_id: z.ZodString;
    /** Number of events analyzed */
    events_analyzed: z.ZodNumber;
    /** Agents covered in analysis */
    agents_analyzed: z.ZodArray<z.ZodString, "many">;
    /** Time range of analyzed events */
    analysis_time_range: z.ZodObject<{
        earliest: z.ZodString;
        latest: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        earliest: string;
        latest: string;
    }, {
        earliest: string;
        latest: string;
    }>;
    /** Outcome evaluations for each analyzed event */
    outcome_evaluations: z.ZodArray<z.ZodObject<{
        /** Original decision event being evaluated */
        decision_ref: z.ZodString;
        /** Agent that produced the decision */
        agent_id: z.ZodString;
        /** Decision type being evaluated */
        decision_type: z.ZodString;
        /** Overall outcome score (0.0 - 1.0) */
        outcome_score: z.ZodNumber;
        /** Assessment summary */
        summary: z.ZodString;
        /** Breakdown of outcome by dimension */
        dimensions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            score: z.ZodNumber;
            notes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            score: number;
            notes?: string | undefined;
        }, {
            name: string;
            score: number;
            notes?: string | undefined;
        }>, "many">>;
        /** Was the outcome as expected? */
        met_expectations: z.ZodBoolean;
        /** Deviation from expected outcome if any */
        deviation_notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        agent_id: string;
        decision_type: string;
        decision_ref: string;
        outcome_score: number;
        summary: string;
        dimensions: {
            name: string;
            score: number;
            notes?: string | undefined;
        }[];
        met_expectations: boolean;
        deviation_notes?: string | undefined;
    }, {
        agent_id: string;
        decision_type: string;
        decision_ref: string;
        outcome_score: number;
        summary: string;
        met_expectations: boolean;
        dimensions?: {
            name: string;
            score: number;
            notes?: string | undefined;
        }[] | undefined;
        deviation_notes?: string | undefined;
    }>, "many">;
    /** Extracted quality signals */
    quality_signals: z.ZodArray<z.ZodObject<{
        /** Unique identifier for this signal */
        signal_id: z.ZodString;
        /** Type of quality signal */
        type: z.ZodEnum<["performance", "accuracy", "completeness", "consistency", "efficiency", "reliability"]>;
        /** Signal value (0.0 - 1.0 normalized score) */
        value: z.ZodNumber;
        /** Human-readable description of the signal */
        description: z.ZodString;
        /** Evidence supporting this signal */
        evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Severity level for negative signals */
        severity: z.ZodOptional<z.ZodEnum<["info", "warning", "error", "critical"]>>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        type: "performance" | "accuracy" | "completeness" | "consistency" | "efficiency" | "reliability";
        description: string;
        signal_id: string;
        evidence: string[];
        severity?: "error" | "critical" | "info" | "warning" | undefined;
    }, {
        value: number;
        type: "performance" | "accuracy" | "completeness" | "consistency" | "efficiency" | "reliability";
        description: string;
        signal_id: string;
        severity?: "error" | "critical" | "info" | "warning" | undefined;
        evidence?: string[] | undefined;
    }>, "many">;
    /** Extracted learning signals */
    learning_signals: z.ZodArray<z.ZodObject<{
        /** Unique identifier for this learning */
        learning_id: z.ZodString;
        /** Category of learning */
        category: z.ZodEnum<["pattern", "anti_pattern", "optimization", "edge_case", "dependency", "constraint"]>;
        /** Brief title for the learning */
        title: z.ZodString;
        /** Detailed description of the learning */
        description: z.ZodString;
        /** Confidence in this learning (0.0 - 1.0) */
        confidence: z.ZodNumber;
        /** Affected agents or components */
        affected_agents: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Recommendations for applying this learning (informational only) */
        recommendations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        description: string;
        learning_id: string;
        category: "pattern" | "anti_pattern" | "optimization" | "edge_case" | "dependency" | "constraint";
        title: string;
        affected_agents: string[];
        recommendations: string[];
    }, {
        confidence: number;
        description: string;
        learning_id: string;
        category: "pattern" | "anti_pattern" | "optimization" | "edge_case" | "dependency" | "constraint";
        title: string;
        affected_agents?: string[] | undefined;
        recommendations?: string[] | undefined;
    }>, "many">;
    /** Identified gaps */
    gap_analysis: z.ZodArray<z.ZodObject<{
        /** Unique identifier for this gap */
        gap_id: z.ZodString;
        /** Type of gap */
        type: z.ZodEnum<["coverage", "capability", "data", "process", "integration", "documentation"]>;
        /** Brief title for the gap */
        title: z.ZodString;
        /** Detailed description of the gap */
        description: z.ZodString;
        /** Impact assessment */
        impact: z.ZodEnum<["low", "medium", "high", "critical"]>;
        /** Steps involved where gap was identified */
        affected_steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Evidence supporting gap identification */
        evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "integration" | "data" | "coverage" | "capability" | "process" | "documentation";
        description: string;
        affected_steps: string[];
        evidence: string[];
        title: string;
        gap_id: string;
        impact: "low" | "medium" | "high" | "critical";
    }, {
        type: "integration" | "data" | "coverage" | "capability" | "process" | "documentation";
        description: string;
        title: string;
        gap_id: string;
        impact: "low" | "medium" | "high" | "critical";
        affected_steps?: string[] | undefined;
        evidence?: string[] | undefined;
    }>, "many">;
    /** Cross-event correlations found */
    correlations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Correlation identifier */
        correlation_id: z.ZodString;
        /** Type of correlation */
        type: z.ZodEnum<["causal", "temporal", "similarity", "dependency"]>;
        /** Events involved */
        event_refs: z.ZodArray<z.ZodString, "many">;
        /** Description of the correlation */
        description: z.ZodString;
        /** Correlation strength (0.0 - 1.0) */
        strength: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "dependency" | "causal" | "temporal" | "similarity";
        description: string;
        correlation_id: string;
        event_refs: string[];
        strength: number;
    }, {
        type: "dependency" | "causal" | "temporal" | "similarity";
        description: string;
        correlation_id: string;
        event_refs: string[];
        strength: number;
    }>, "many">>;
    /** Summary statistics */
    summary: z.ZodObject<{
        /** Overall quality score across all events (0.0 - 1.0) */
        overall_quality_score: z.ZodNumber;
        /** Total quality signals extracted */
        total_quality_signals: z.ZodNumber;
        /** Total learning signals extracted */
        total_learning_signals: z.ZodNumber;
        /** Total gaps identified */
        total_gaps: z.ZodNumber;
        /** Events meeting expectations percentage */
        expectations_met_rate: z.ZodNumber;
        /** Key findings (informational summaries) */
        key_findings: z.ZodArray<z.ZodString, "many">;
        /** Improvement suggestions (informational only - NOT actionable by this agent) */
        improvement_suggestions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        overall_quality_score: number;
        total_quality_signals: number;
        total_learning_signals: number;
        total_gaps: number;
        expectations_met_rate: number;
        key_findings: string[];
        improvement_suggestions: string[];
    }, {
        overall_quality_score: number;
        total_quality_signals: number;
        total_learning_signals: number;
        total_gaps: number;
        expectations_met_rate: number;
        key_findings: string[];
        improvement_suggestions: string[];
    }>;
    /** Reflection metadata */
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: string;
    summary: {
        overall_quality_score: number;
        total_quality_signals: number;
        total_learning_signals: number;
        total_gaps: number;
        expectations_met_rate: number;
        key_findings: string[];
        improvement_suggestions: string[];
    };
    reflection_id: string;
    events_analyzed: number;
    agents_analyzed: string[];
    analysis_time_range: {
        earliest: string;
        latest: string;
    };
    outcome_evaluations: {
        agent_id: string;
        decision_type: string;
        decision_ref: string;
        outcome_score: number;
        summary: string;
        dimensions: {
            name: string;
            score: number;
            notes?: string | undefined;
        }[];
        met_expectations: boolean;
        deviation_notes?: string | undefined;
    }[];
    quality_signals: {
        value: number;
        type: "performance" | "accuracy" | "completeness" | "consistency" | "efficiency" | "reliability";
        description: string;
        signal_id: string;
        evidence: string[];
        severity?: "error" | "critical" | "info" | "warning" | undefined;
    }[];
    learning_signals: {
        confidence: number;
        description: string;
        learning_id: string;
        category: "pattern" | "anti_pattern" | "optimization" | "edge_case" | "dependency" | "constraint";
        title: string;
        affected_agents: string[];
        recommendations: string[];
    }[];
    gap_analysis: {
        type: "integration" | "data" | "coverage" | "capability" | "process" | "documentation";
        description: string;
        affected_steps: string[];
        evidence: string[];
        title: string;
        gap_id: string;
        impact: "low" | "medium" | "high" | "critical";
    }[];
    correlations: {
        type: "dependency" | "causal" | "temporal" | "similarity";
        description: string;
        correlation_id: string;
        event_refs: string[];
        strength: number;
    }[];
}, {
    summary: {
        overall_quality_score: number;
        total_quality_signals: number;
        total_learning_signals: number;
        total_gaps: number;
        expectations_met_rate: number;
        key_findings: string[];
        improvement_suggestions: string[];
    };
    reflection_id: string;
    events_analyzed: number;
    agents_analyzed: string[];
    analysis_time_range: {
        earliest: string;
        latest: string;
    };
    outcome_evaluations: {
        agent_id: string;
        decision_type: string;
        decision_ref: string;
        outcome_score: number;
        summary: string;
        met_expectations: boolean;
        dimensions?: {
            name: string;
            score: number;
            notes?: string | undefined;
        }[] | undefined;
        deviation_notes?: string | undefined;
    }[];
    quality_signals: {
        value: number;
        type: "performance" | "accuracy" | "completeness" | "consistency" | "efficiency" | "reliability";
        description: string;
        signal_id: string;
        severity?: "error" | "critical" | "info" | "warning" | undefined;
        evidence?: string[] | undefined;
    }[];
    learning_signals: {
        confidence: number;
        description: string;
        learning_id: string;
        category: "pattern" | "anti_pattern" | "optimization" | "edge_case" | "dependency" | "constraint";
        title: string;
        affected_agents?: string[] | undefined;
        recommendations?: string[] | undefined;
    }[];
    gap_analysis: {
        type: "integration" | "data" | "coverage" | "capability" | "process" | "documentation";
        description: string;
        title: string;
        gap_id: string;
        impact: "low" | "medium" | "high" | "critical";
        affected_steps?: string[] | undefined;
        evidence?: string[] | undefined;
    }[];
    version?: string | undefined;
    correlations?: {
        type: "dependency" | "causal" | "temporal" | "similarity";
        description: string;
        correlation_id: string;
        event_refs: string[];
        strength: number;
    }[] | undefined;
}>;
export type ReflectionOutput = z.infer<typeof ReflectionOutputSchema>;
