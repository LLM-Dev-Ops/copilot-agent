/**
 * Objective Clarifier Agent Schemas
 *
 * Purpose: Clarify ambiguous or incomplete objectives
 * Classification: INTENT_ANALYSIS, DECOMPOSITION
 * decision_type: objective_clarification
 *
 * Scope:
 * - Resolve ambiguity
 * - Normalize goals
 * - Identify missing constraints
 *
 * Must Never:
 * - Generate plans
 * - Define solutions
 * - Execute logic
 */
import { z } from 'zod';
/**
 * Ambiguity detection result
 */
export declare const AmbiguitySchema: z.ZodObject<{
    /** Unique identifier for this ambiguity */
    id: z.ZodString;
    /** Type of ambiguity detected */
    type: z.ZodEnum<["lexical", "syntactic", "semantic", "referential", "scope", "temporal", "quantitative", "conditional"]>;
    /** The ambiguous portion of the objective */
    source_text: z.ZodString;
    /** Description of why this is ambiguous */
    description: z.ZodString;
    /** Possible interpretations of the ambiguous element */
    interpretations: z.ZodArray<z.ZodObject<{
        interpretation: z.ZodString;
        likelihood: z.ZodNumber;
        assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        assumptions: string[];
        interpretation: string;
        likelihood: number;
    }, {
        interpretation: string;
        likelihood: number;
        assumptions?: string[] | undefined;
    }>, "many">;
    /** Severity of the ambiguity (how much it blocks understanding) */
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    /** Suggested clarification question */
    clarification_prompt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "temporal" | "scope" | "lexical" | "syntactic" | "semantic" | "referential" | "quantitative" | "conditional";
    id: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    source_text: string;
    interpretations: {
        assumptions: string[];
        interpretation: string;
        likelihood: number;
    }[];
    clarification_prompt: string;
}, {
    type: "temporal" | "scope" | "lexical" | "syntactic" | "semantic" | "referential" | "quantitative" | "conditional";
    id: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    source_text: string;
    interpretations: {
        interpretation: string;
        likelihood: number;
        assumptions?: string[] | undefined;
    }[];
    clarification_prompt: string;
}>;
export type Ambiguity = z.infer<typeof AmbiguitySchema>;
/**
 * Missing constraint identification
 */
export declare const MissingConstraintSchema: z.ZodObject<{
    /** Unique identifier */
    id: z.ZodString;
    /** Category of the missing constraint */
    category: z.ZodEnum<["temporal", "resource", "quality", "scope", "dependency", "compliance", "technical", "performance"]>;
    /** What constraint information is missing */
    description: z.ZodString;
    /** Why this constraint matters */
    impact: z.ZodString;
    /** Severity if left unspecified */
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    /** Suggested question to elicit this constraint */
    clarification_prompt: z.ZodString;
    /** Default assumption if not clarified */
    default_assumption: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    category: "compliance" | "resource" | "performance" | "dependency" | "quality" | "temporal" | "scope" | "technical";
    impact: string;
    clarification_prompt: string;
    default_assumption?: string | undefined;
}, {
    id: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    category: "compliance" | "resource" | "performance" | "dependency" | "quality" | "temporal" | "scope" | "technical";
    impact: string;
    clarification_prompt: string;
    default_assumption?: string | undefined;
}>;
export type MissingConstraint = z.infer<typeof MissingConstraintSchema>;
/**
 * Normalized goal representation
 */
export declare const NormalizedGoalSchema: z.ZodObject<{
    /** Unique identifier for the goal */
    goal_id: z.ZodString;
    /** Normalized statement of the goal */
    statement: z.ZodString;
    /** Goal type classification */
    type: z.ZodEnum<["functional", "non_functional", "constraint", "assumption"]>;
    /** Extracted action verb (normalized) */
    action: z.ZodString;
    /** Subject/target of the action */
    subject: z.ZodString;
    /** Optional object/output of the action */
    object: z.ZodOptional<z.ZodString>;
    /** Qualifiers and conditions */
    qualifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Confidence in this normalization */
    confidence: z.ZodNumber;
    /** Original text this was derived from */
    source_text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    type: "constraint" | "functional" | "non_functional" | "assumption";
    source_text: string;
    goal_id: string;
    statement: string;
    action: string;
    subject: string;
    qualifiers: string[];
    object?: string | undefined;
}, {
    confidence: number;
    type: "constraint" | "functional" | "non_functional" | "assumption";
    source_text: string;
    goal_id: string;
    statement: string;
    action: string;
    subject: string;
    object?: string | undefined;
    qualifiers?: string[] | undefined;
}>;
export type NormalizedGoal = z.infer<typeof NormalizedGoalSchema>;
/**
 * Objective Clarifier Agent Input Schema
 */
export declare const ObjectiveClarifierInputSchema: z.ZodObject<{
    /** The raw objective to clarify */
    objective: z.ZodString;
    /** Optional context to aid clarification */
    context: z.ZodOptional<z.ZodObject<{
        /** Domain/industry context */
        domain: z.ZodOptional<z.ZodString>;
        /** Known stakeholders */
        stakeholders: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Existing system/project information */
        existing_context: z.ZodOptional<z.ZodString>;
        /** Previously established constraints */
        known_constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Priority hints */
        priorities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        domain?: string | undefined;
        stakeholders?: string[] | undefined;
        existing_context?: string | undefined;
        known_constraints?: string[] | undefined;
        priorities?: string[] | undefined;
    }, {
        domain?: string | undefined;
        stakeholders?: string[] | undefined;
        existing_context?: string | undefined;
        known_constraints?: string[] | undefined;
        priorities?: string[] | undefined;
    }>>;
    /** Configuration for clarification */
    config: z.ZodOptional<z.ZodObject<{
        /** Minimum ambiguity severity to report */
        min_severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
        /** Maximum number of clarification questions to generate */
        max_questions: z.ZodOptional<z.ZodNumber>;
        /** Whether to attempt automatic resolution of low-severity ambiguities */
        auto_resolve_low_severity: z.ZodOptional<z.ZodBoolean>;
        /** Preferred interpretation style */
        interpretation_style: z.ZodOptional<z.ZodEnum<["conservative", "balanced", "liberal"]>>;
    }, "strip", z.ZodTypeAny, {
        min_severity?: "low" | "medium" | "high" | "critical" | undefined;
        max_questions?: number | undefined;
        auto_resolve_low_severity?: boolean | undefined;
        interpretation_style?: "conservative" | "balanced" | "liberal" | undefined;
    }, {
        min_severity?: "low" | "medium" | "high" | "critical" | undefined;
        max_questions?: number | undefined;
        auto_resolve_low_severity?: boolean | undefined;
        interpretation_style?: "conservative" | "balanced" | "liberal" | undefined;
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
    objective: string;
    config?: {
        min_severity?: "low" | "medium" | "high" | "critical" | undefined;
        max_questions?: number | undefined;
        auto_resolve_low_severity?: boolean | undefined;
        interpretation_style?: "conservative" | "balanced" | "liberal" | undefined;
    } | undefined;
    context?: {
        domain?: string | undefined;
        stakeholders?: string[] | undefined;
        existing_context?: string | undefined;
        known_constraints?: string[] | undefined;
        priorities?: string[] | undefined;
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
    objective: string;
    config?: {
        min_severity?: "low" | "medium" | "high" | "critical" | undefined;
        max_questions?: number | undefined;
        auto_resolve_low_severity?: boolean | undefined;
        interpretation_style?: "conservative" | "balanced" | "liberal" | undefined;
    } | undefined;
    context?: {
        domain?: string | undefined;
        stakeholders?: string[] | undefined;
        existing_context?: string | undefined;
        known_constraints?: string[] | undefined;
        priorities?: string[] | undefined;
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
export type ObjectiveClarifierInput = z.infer<typeof ObjectiveClarifierInputSchema>;
/**
 * Objective Clarifier Agent Output Schema
 */
export declare const ObjectiveClarifierOutputSchema: z.ZodObject<{
    /** Unique clarification session identifier */
    clarification_id: z.ZodString;
    /** Original objective (echoed for verification) */
    original_objective: z.ZodString;
    /** Clarification status */
    status: z.ZodEnum<["clear", "needs_clarification", "requires_decomposition", "insufficient"]>;
    /** List of detected ambiguities */
    ambiguities: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Unique identifier for this ambiguity */
        id: z.ZodString;
        /** Type of ambiguity detected */
        type: z.ZodEnum<["lexical", "syntactic", "semantic", "referential", "scope", "temporal", "quantitative", "conditional"]>;
        /** The ambiguous portion of the objective */
        source_text: z.ZodString;
        /** Description of why this is ambiguous */
        description: z.ZodString;
        /** Possible interpretations of the ambiguous element */
        interpretations: z.ZodArray<z.ZodObject<{
            interpretation: z.ZodString;
            likelihood: z.ZodNumber;
            assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            assumptions: string[];
            interpretation: string;
            likelihood: number;
        }, {
            interpretation: string;
            likelihood: number;
            assumptions?: string[] | undefined;
        }>, "many">;
        /** Severity of the ambiguity (how much it blocks understanding) */
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        /** Suggested clarification question */
        clarification_prompt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "temporal" | "scope" | "lexical" | "syntactic" | "semantic" | "referential" | "quantitative" | "conditional";
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        source_text: string;
        interpretations: {
            assumptions: string[];
            interpretation: string;
            likelihood: number;
        }[];
        clarification_prompt: string;
    }, {
        type: "temporal" | "scope" | "lexical" | "syntactic" | "semantic" | "referential" | "quantitative" | "conditional";
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        source_text: string;
        interpretations: {
            interpretation: string;
            likelihood: number;
            assumptions?: string[] | undefined;
        }[];
        clarification_prompt: string;
    }>, "many">>;
    /** List of missing constraints */
    missing_constraints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Unique identifier */
        id: z.ZodString;
        /** Category of the missing constraint */
        category: z.ZodEnum<["temporal", "resource", "quality", "scope", "dependency", "compliance", "technical", "performance"]>;
        /** What constraint information is missing */
        description: z.ZodString;
        /** Why this constraint matters */
        impact: z.ZodString;
        /** Severity if left unspecified */
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        /** Suggested question to elicit this constraint */
        clarification_prompt: z.ZodString;
        /** Default assumption if not clarified */
        default_assumption: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        category: "compliance" | "resource" | "performance" | "dependency" | "quality" | "temporal" | "scope" | "technical";
        impact: string;
        clarification_prompt: string;
        default_assumption?: string | undefined;
    }, {
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        category: "compliance" | "resource" | "performance" | "dependency" | "quality" | "temporal" | "scope" | "technical";
        impact: string;
        clarification_prompt: string;
        default_assumption?: string | undefined;
    }>, "many">>;
    /** Normalized goals extracted from the objective */
    normalized_goals: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Unique identifier for the goal */
        goal_id: z.ZodString;
        /** Normalized statement of the goal */
        statement: z.ZodString;
        /** Goal type classification */
        type: z.ZodEnum<["functional", "non_functional", "constraint", "assumption"]>;
        /** Extracted action verb (normalized) */
        action: z.ZodString;
        /** Subject/target of the action */
        subject: z.ZodString;
        /** Optional object/output of the action */
        object: z.ZodOptional<z.ZodString>;
        /** Qualifiers and conditions */
        qualifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Confidence in this normalization */
        confidence: z.ZodNumber;
        /** Original text this was derived from */
        source_text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        type: "constraint" | "functional" | "non_functional" | "assumption";
        source_text: string;
        goal_id: string;
        statement: string;
        action: string;
        subject: string;
        qualifiers: string[];
        object?: string | undefined;
    }, {
        confidence: number;
        type: "constraint" | "functional" | "non_functional" | "assumption";
        source_text: string;
        goal_id: string;
        statement: string;
        action: string;
        subject: string;
        object?: string | undefined;
        qualifiers?: string[] | undefined;
    }>, "many">>;
    /** Clarified/normalized version of the objective */
    clarified_objective: z.ZodObject<{
        /** The clarified objective statement */
        statement: z.ZodString;
        /** Assumptions made during clarification */
        assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Unresolved items that need human input */
        unresolved: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Confidence in the clarification */
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        assumptions: string[];
        statement: string;
        unresolved: string[];
    }, {
        confidence: number;
        statement: string;
        assumptions?: string[] | undefined;
        unresolved?: string[] | undefined;
    }>;
    /** Prioritized clarification questions */
    clarification_questions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        priority: z.ZodEnum<["low", "medium", "high", "critical"]>;
        related_ambiguity_id: z.ZodOptional<z.ZodString>;
        related_constraint_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        priority: "low" | "medium" | "high" | "critical";
        question: string;
        related_ambiguity_id?: string | undefined;
        related_constraint_id?: string | undefined;
    }, {
        priority: "low" | "medium" | "high" | "critical";
        question: string;
        related_ambiguity_id?: string | undefined;
        related_constraint_id?: string | undefined;
    }>, "many">>;
    /** Analysis metadata */
    analysis: z.ZodObject<{
        /** Total ambiguities detected */
        total_ambiguities: z.ZodNumber;
        /** Total missing constraints */
        total_missing_constraints: z.ZodNumber;
        /** Total goals extracted */
        total_goals: z.ZodNumber;
        /** Overall clarity score (0-1) */
        clarity_score: z.ZodNumber;
        /** Completeness score (0-1) */
        completeness_score: z.ZodNumber;
        /** Word count of original objective */
        word_count: z.ZodNumber;
        /** Complexity assessment */
        complexity: z.ZodEnum<["simple", "moderate", "complex", "very_complex"]>;
    }, "strip", z.ZodTypeAny, {
        completeness_score: number;
        clarity_score: number;
        total_ambiguities: number;
        total_missing_constraints: number;
        total_goals: number;
        word_count: number;
        complexity: "simple" | "moderate" | "complex" | "very_complex";
    }, {
        completeness_score: number;
        clarity_score: number;
        total_ambiguities: number;
        total_missing_constraints: number;
        total_goals: number;
        word_count: number;
        complexity: "simple" | "moderate" | "complex" | "very_complex";
    }>;
    /** Clarification version */
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "clear" | "needs_clarification" | "requires_decomposition" | "insufficient";
    version: string;
    analysis: {
        completeness_score: number;
        clarity_score: number;
        total_ambiguities: number;
        total_missing_constraints: number;
        total_goals: number;
        word_count: number;
        complexity: "simple" | "moderate" | "complex" | "very_complex";
    };
    clarification_id: string;
    original_objective: string;
    ambiguities: {
        type: "temporal" | "scope" | "lexical" | "syntactic" | "semantic" | "referential" | "quantitative" | "conditional";
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        source_text: string;
        interpretations: {
            assumptions: string[];
            interpretation: string;
            likelihood: number;
        }[];
        clarification_prompt: string;
    }[];
    missing_constraints: {
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        category: "compliance" | "resource" | "performance" | "dependency" | "quality" | "temporal" | "scope" | "technical";
        impact: string;
        clarification_prompt: string;
        default_assumption?: string | undefined;
    }[];
    normalized_goals: {
        confidence: number;
        type: "constraint" | "functional" | "non_functional" | "assumption";
        source_text: string;
        goal_id: string;
        statement: string;
        action: string;
        subject: string;
        qualifiers: string[];
        object?: string | undefined;
    }[];
    clarified_objective: {
        confidence: number;
        assumptions: string[];
        statement: string;
        unresolved: string[];
    };
    clarification_questions: {
        priority: "low" | "medium" | "high" | "critical";
        question: string;
        related_ambiguity_id?: string | undefined;
        related_constraint_id?: string | undefined;
    }[];
}, {
    status: "clear" | "needs_clarification" | "requires_decomposition" | "insufficient";
    analysis: {
        completeness_score: number;
        clarity_score: number;
        total_ambiguities: number;
        total_missing_constraints: number;
        total_goals: number;
        word_count: number;
        complexity: "simple" | "moderate" | "complex" | "very_complex";
    };
    clarification_id: string;
    original_objective: string;
    clarified_objective: {
        confidence: number;
        statement: string;
        assumptions?: string[] | undefined;
        unresolved?: string[] | undefined;
    };
    version?: string | undefined;
    ambiguities?: {
        type: "temporal" | "scope" | "lexical" | "syntactic" | "semantic" | "referential" | "quantitative" | "conditional";
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        source_text: string;
        interpretations: {
            interpretation: string;
            likelihood: number;
            assumptions?: string[] | undefined;
        }[];
        clarification_prompt: string;
    }[] | undefined;
    missing_constraints?: {
        id: string;
        description: string;
        severity: "low" | "medium" | "high" | "critical";
        category: "compliance" | "resource" | "performance" | "dependency" | "quality" | "temporal" | "scope" | "technical";
        impact: string;
        clarification_prompt: string;
        default_assumption?: string | undefined;
    }[] | undefined;
    normalized_goals?: {
        confidence: number;
        type: "constraint" | "functional" | "non_functional" | "assumption";
        source_text: string;
        goal_id: string;
        statement: string;
        action: string;
        subject: string;
        object?: string | undefined;
        qualifiers?: string[] | undefined;
    }[] | undefined;
    clarification_questions?: {
        priority: "low" | "medium" | "high" | "critical";
        question: string;
        related_ambiguity_id?: string | undefined;
        related_constraint_id?: string | undefined;
    }[] | undefined;
}>;
export type ObjectiveClarifierOutput = z.infer<typeof ObjectiveClarifierOutputSchema>;
