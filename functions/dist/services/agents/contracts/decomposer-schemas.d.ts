/**
 * Decomposer Agent Schemas
 *
 * Purpose: Decompose complex objectives into manageable sub-objectives
 * Classification: DECOMPOSITION, STRUCTURAL_SYNTHESIS
 * decision_type: objective_decomposition
 *
 * Scope:
 * - Break complex objectives into sub-objectives
 * - Identify sub-objective relationships
 * - Assess decomposition completeness
 *
 * Must Never:
 * - Execute sub-objectives
 * - Assign agents
 * - Allocate resources
 * - Schedule execution
 */
import { z } from 'zod';
/**
 * A single sub-objective produced by decomposition
 */
export declare const SubObjectiveSchema: z.ZodObject<{
    /** Unique identifier for this sub-objective */
    sub_objective_id: z.ZodString;
    /** Human-readable title */
    title: z.ZodString;
    /** Detailed description of the sub-objective */
    description: z.ZodString;
    /** Parent sub-objective ID (null for top-level) */
    parent_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    /** Depth level in the decomposition tree (0 = top-level) */
    depth: z.ZodNumber;
    /** Dependencies on other sub-objectives */
    dependencies: z.ZodDefault<z.ZodArray<z.ZodObject<{
        depends_on: z.ZodString;
        type: z.ZodEnum<["blocking", "data", "sequential"]>;
    }, "strip", z.ZodTypeAny, {
        type: "data" | "blocking" | "sequential";
        depends_on: string;
    }, {
        type: "data" | "blocking" | "sequential";
        depends_on: string;
    }>, "many">>;
    /** Classification tags */
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Estimated complexity */
    complexity: z.ZodDefault<z.ZodEnum<["trivial", "simple", "moderate", "complex", "very_complex"]>>;
    /** Whether this sub-objective can be further decomposed */
    is_atomic: z.ZodDefault<z.ZodBoolean>;
    /** Acceptance criteria for this sub-objective */
    acceptance_criteria: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    dependencies: {
        type: "data" | "blocking" | "sequential";
        depends_on: string;
    }[];
    tags: string[];
    title: string;
    complexity: "simple" | "moderate" | "complex" | "very_complex" | "trivial";
    sub_objective_id: string;
    parent_id: string | null;
    depth: number;
    is_atomic: boolean;
    acceptance_criteria: string[];
}, {
    description: string;
    title: string;
    sub_objective_id: string;
    depth: number;
    dependencies?: {
        type: "data" | "blocking" | "sequential";
        depends_on: string;
    }[] | undefined;
    tags?: string[] | undefined;
    complexity?: "simple" | "moderate" | "complex" | "very_complex" | "trivial" | undefined;
    parent_id?: string | null | undefined;
    is_atomic?: boolean | undefined;
    acceptance_criteria?: string[] | undefined;
}>;
export type SubObjective = z.infer<typeof SubObjectiveSchema>;
/**
 * Decomposer Agent Input Schema
 */
export declare const DecomposerInputSchema: z.ZodObject<{
    /** The complex objective to decompose */
    objective: z.ZodString;
    /** Optional context to aid decomposition */
    context: z.ZodOptional<z.ZodObject<{
        /** Domain/industry context */
        domain: z.ZodOptional<z.ZodString>;
        /** Existing components or systems */
        existing_components: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Known constraints */
        constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Maximum decomposition depth */
        max_depth: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        domain?: string | undefined;
        constraints?: string[] | undefined;
        existing_components?: string[] | undefined;
        max_depth?: number | undefined;
    }, {
        domain?: string | undefined;
        constraints?: string[] | undefined;
        existing_components?: string[] | undefined;
        max_depth?: number | undefined;
    }>>;
    /** Configuration for decomposition */
    config: z.ZodOptional<z.ZodObject<{
        /** Target granularity for leaf sub-objectives */
        target_granularity: z.ZodOptional<z.ZodEnum<["coarse", "medium", "fine"]>>;
        /** Maximum number of sub-objectives to produce */
        max_sub_objectives: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        target_granularity?: "medium" | "coarse" | "fine" | undefined;
        max_sub_objectives?: number | undefined;
    }, {
        target_granularity?: "medium" | "coarse" | "fine" | undefined;
        max_sub_objectives?: number | undefined;
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
        target_granularity?: "medium" | "coarse" | "fine" | undefined;
        max_sub_objectives?: number | undefined;
    } | undefined;
    context?: {
        domain?: string | undefined;
        constraints?: string[] | undefined;
        existing_components?: string[] | undefined;
        max_depth?: number | undefined;
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
        target_granularity?: "medium" | "coarse" | "fine" | undefined;
        max_sub_objectives?: number | undefined;
    } | undefined;
    context?: {
        domain?: string | undefined;
        constraints?: string[] | undefined;
        existing_components?: string[] | undefined;
        max_depth?: number | undefined;
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
export type DecomposerInput = z.infer<typeof DecomposerInputSchema>;
/**
 * Decomposer Agent Output Schema
 */
export declare const DecomposerOutputSchema: z.ZodObject<{
    /** Unique decomposition identifier */
    decomposition_id: z.ZodString;
    /** Original objective (echoed for verification) */
    original_objective: z.ZodString;
    /** List of sub-objectives produced */
    sub_objectives: z.ZodArray<z.ZodObject<{
        /** Unique identifier for this sub-objective */
        sub_objective_id: z.ZodString;
        /** Human-readable title */
        title: z.ZodString;
        /** Detailed description of the sub-objective */
        description: z.ZodString;
        /** Parent sub-objective ID (null for top-level) */
        parent_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        /** Depth level in the decomposition tree (0 = top-level) */
        depth: z.ZodNumber;
        /** Dependencies on other sub-objectives */
        dependencies: z.ZodDefault<z.ZodArray<z.ZodObject<{
            depends_on: z.ZodString;
            type: z.ZodEnum<["blocking", "data", "sequential"]>;
        }, "strip", z.ZodTypeAny, {
            type: "data" | "blocking" | "sequential";
            depends_on: string;
        }, {
            type: "data" | "blocking" | "sequential";
            depends_on: string;
        }>, "many">>;
        /** Classification tags */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Estimated complexity */
        complexity: z.ZodDefault<z.ZodEnum<["trivial", "simple", "moderate", "complex", "very_complex"]>>;
        /** Whether this sub-objective can be further decomposed */
        is_atomic: z.ZodDefault<z.ZodBoolean>;
        /** Acceptance criteria for this sub-objective */
        acceptance_criteria: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        dependencies: {
            type: "data" | "blocking" | "sequential";
            depends_on: string;
        }[];
        tags: string[];
        title: string;
        complexity: "simple" | "moderate" | "complex" | "very_complex" | "trivial";
        sub_objective_id: string;
        parent_id: string | null;
        depth: number;
        is_atomic: boolean;
        acceptance_criteria: string[];
    }, {
        description: string;
        title: string;
        sub_objective_id: string;
        depth: number;
        dependencies?: {
            type: "data" | "blocking" | "sequential";
            depends_on: string;
        }[] | undefined;
        tags?: string[] | undefined;
        complexity?: "simple" | "moderate" | "complex" | "very_complex" | "trivial" | undefined;
        parent_id?: string | null | undefined;
        is_atomic?: boolean | undefined;
        acceptance_criteria?: string[] | undefined;
    }>, "many">;
    /** Tree structure as adjacency list (parent -> children) */
    tree_structure: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
    /** Dependency graph as adjacency list */
    dependency_graph: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
    /** Analysis metadata */
    analysis: z.ZodObject<{
        /** Total number of sub-objectives */
        total_sub_objectives: z.ZodNumber;
        /** Maximum decomposition depth reached */
        max_depth_reached: z.ZodNumber;
        /** Number of atomic (leaf) sub-objectives */
        atomic_count: z.ZodNumber;
        /** Coverage assessment */
        coverage_score: z.ZodNumber;
        /** Complexity distribution */
        complexity_distribution: z.ZodRecord<z.ZodString, z.ZodNumber>;
        /** Assumptions made during decomposition */
        assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        assumptions: string[];
        total_sub_objectives: number;
        max_depth_reached: number;
        atomic_count: number;
        coverage_score: number;
        complexity_distribution: Record<string, number>;
    }, {
        total_sub_objectives: number;
        max_depth_reached: number;
        atomic_count: number;
        coverage_score: number;
        complexity_distribution: Record<string, number>;
        assumptions?: string[] | undefined;
    }>;
    /** Decomposition version */
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: string;
    dependency_graph: Record<string, string[]>;
    analysis: {
        assumptions: string[];
        total_sub_objectives: number;
        max_depth_reached: number;
        atomic_count: number;
        coverage_score: number;
        complexity_distribution: Record<string, number>;
    };
    original_objective: string;
    decomposition_id: string;
    sub_objectives: {
        description: string;
        dependencies: {
            type: "data" | "blocking" | "sequential";
            depends_on: string;
        }[];
        tags: string[];
        title: string;
        complexity: "simple" | "moderate" | "complex" | "very_complex" | "trivial";
        sub_objective_id: string;
        parent_id: string | null;
        depth: number;
        is_atomic: boolean;
        acceptance_criteria: string[];
    }[];
    tree_structure: Record<string, string[]>;
}, {
    dependency_graph: Record<string, string[]>;
    analysis: {
        total_sub_objectives: number;
        max_depth_reached: number;
        atomic_count: number;
        coverage_score: number;
        complexity_distribution: Record<string, number>;
        assumptions?: string[] | undefined;
    };
    original_objective: string;
    decomposition_id: string;
    sub_objectives: {
        description: string;
        title: string;
        sub_objective_id: string;
        depth: number;
        dependencies?: {
            type: "data" | "blocking" | "sequential";
            depends_on: string;
        }[] | undefined;
        tags?: string[] | undefined;
        complexity?: "simple" | "moderate" | "complex" | "very_complex" | "trivial" | undefined;
        parent_id?: string | null | undefined;
        is_atomic?: boolean | undefined;
        acceptance_criteria?: string[] | undefined;
    }[];
    tree_structure: Record<string, string[]>;
    version?: string | undefined;
}>;
export type DecomposerOutput = z.infer<typeof DecomposerOutputSchema>;
