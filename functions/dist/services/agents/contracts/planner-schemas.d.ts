/**
 * Planner Agent Schemas
 *
 * Purpose: Translate clarified objectives into structured execution plans
 * Classification: PLANNING, STRUCTURAL_SYNTHESIS
 * decision_type: plan_generation
 *
 * Scope:
 * - Generate ordered plan steps
 * - Identify dependencies
 * - Define sequencing
 *
 * Must Never:
 * - Execute steps
 * - Assign agents
 * - Allocate resources
 * - Schedule execution
 */
import { z } from 'zod';
/**
 * Dependency between plan steps
 */
export declare const DependencySchema: z.ZodObject<{
    /** ID of the step this depends on */
    depends_on: z.ZodString;
    /** Type of dependency */
    type: z.ZodEnum<["blocking", "data", "resource", "sequential"]>;
    /** Optional: specific output field required from dependency */
    required_output: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "blocking" | "data" | "resource" | "sequential";
    depends_on: string;
    required_output?: string | undefined;
}, {
    type: "blocking" | "data" | "resource" | "sequential";
    depends_on: string;
    required_output?: string | undefined;
}>;
export type Dependency = z.infer<typeof DependencySchema>;
/**
 * Single step in an execution plan
 */
export declare const PlanStepSchema: z.ZodObject<{
    /** Unique step identifier within the plan */
    step_id: z.ZodString;
    /** Human-readable step name */
    name: z.ZodString;
    /** Detailed description of what this step accomplishes */
    description: z.ZodString;
    /** Order in sequence (0-indexed) */
    sequence_order: z.ZodNumber;
    /** Dependencies on other steps */
    dependencies: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** ID of the step this depends on */
        depends_on: z.ZodString;
        /** Type of dependency */
        type: z.ZodEnum<["blocking", "data", "resource", "sequential"]>;
        /** Optional: specific output field required from dependency */
        required_output: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "blocking" | "data" | "resource" | "sequential";
        depends_on: string;
        required_output?: string | undefined;
    }, {
        type: "blocking" | "data" | "resource" | "sequential";
        depends_on: string;
        required_output?: string | undefined;
    }>, "many">>;
    /** Expected inputs for this step */
    expected_inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodString;
        required: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        name: string;
        description: string;
        required: boolean;
    }, {
        type: string;
        name: string;
        description: string;
        required?: boolean | undefined;
    }>, "many">>;
    /** Expected outputs from this step */
    expected_outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        name: string;
        description: string;
    }, {
        type: string;
        name: string;
        description: string;
    }>, "many">>;
    /** Classification tags for the step */
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Constraints that apply to this step (informational only) */
    constraints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Whether this step can be parallelized with siblings */
    parallelizable: z.ZodDefault<z.ZodBoolean>;
    /** Criticality level */
    criticality: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    step_id: string;
    sequence_order: number;
    dependencies: {
        type: "blocking" | "data" | "resource" | "sequential";
        depends_on: string;
        required_output?: string | undefined;
    }[];
    expected_inputs: {
        type: string;
        name: string;
        description: string;
        required: boolean;
    }[];
    expected_outputs: {
        type: string;
        name: string;
        description: string;
    }[];
    tags: string[];
    constraints: string[];
    parallelizable: boolean;
    criticality: "low" | "medium" | "high" | "critical";
}, {
    name: string;
    description: string;
    step_id: string;
    sequence_order: number;
    dependencies?: {
        type: "blocking" | "data" | "resource" | "sequential";
        depends_on: string;
        required_output?: string | undefined;
    }[] | undefined;
    expected_inputs?: {
        type: string;
        name: string;
        description: string;
        required?: boolean | undefined;
    }[] | undefined;
    expected_outputs?: {
        type: string;
        name: string;
        description: string;
    }[] | undefined;
    tags?: string[] | undefined;
    constraints?: string[] | undefined;
    parallelizable?: boolean | undefined;
    criticality?: "low" | "medium" | "high" | "critical" | undefined;
}>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
/**
 * Planner Agent Input Schema
 */
export declare const PlannerInputSchema: z.ZodObject<{
    /** The clarified objective to plan for */
    objective: z.ZodString;
    /** Optional context about the domain/system */
    context: z.ZodOptional<z.ZodObject<{
        domain: z.ZodOptional<z.ZodString>;
        existing_components: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        preferences: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        constraints?: string[] | undefined;
        domain?: string | undefined;
        existing_components?: string[] | undefined;
        preferences?: Record<string, string> | undefined;
    }, {
        constraints?: string[] | undefined;
        domain?: string | undefined;
        existing_components?: string[] | undefined;
        preferences?: Record<string, string> | undefined;
    }>>;
    /** Optional hints about expected complexity */
    hints: z.ZodOptional<z.ZodObject<{
        expected_step_count: z.ZodOptional<z.ZodNumber>;
        max_depth: z.ZodOptional<z.ZodNumber>;
        focus_areas: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        expected_step_count?: number | undefined;
        max_depth?: number | undefined;
        focus_areas?: string[] | undefined;
    }, {
        expected_step_count?: number | undefined;
        max_depth?: number | undefined;
        focus_areas?: string[] | undefined;
    }>>;
    /** Request ID for tracing */
    request_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    objective: string;
    context?: {
        constraints?: string[] | undefined;
        domain?: string | undefined;
        existing_components?: string[] | undefined;
        preferences?: Record<string, string> | undefined;
    } | undefined;
    hints?: {
        expected_step_count?: number | undefined;
        max_depth?: number | undefined;
        focus_areas?: string[] | undefined;
    } | undefined;
    request_id?: string | undefined;
}, {
    objective: string;
    context?: {
        constraints?: string[] | undefined;
        domain?: string | undefined;
        existing_components?: string[] | undefined;
        preferences?: Record<string, string> | undefined;
    } | undefined;
    hints?: {
        expected_step_count?: number | undefined;
        max_depth?: number | undefined;
        focus_areas?: string[] | undefined;
    } | undefined;
    request_id?: string | undefined;
}>;
export type PlannerInput = z.infer<typeof PlannerInputSchema>;
/**
 * Planner Agent Output Schema
 */
export declare const PlannerOutputSchema: z.ZodObject<{
    /** Generated plan identifier */
    plan_id: z.ZodString;
    /** The original objective (echoed for verification) */
    objective_summary: z.ZodString;
    /** Ordered list of plan steps */
    steps: z.ZodArray<z.ZodObject<{
        /** Unique step identifier within the plan */
        step_id: z.ZodString;
        /** Human-readable step name */
        name: z.ZodString;
        /** Detailed description of what this step accomplishes */
        description: z.ZodString;
        /** Order in sequence (0-indexed) */
        sequence_order: z.ZodNumber;
        /** Dependencies on other steps */
        dependencies: z.ZodDefault<z.ZodArray<z.ZodObject<{
            /** ID of the step this depends on */
            depends_on: z.ZodString;
            /** Type of dependency */
            type: z.ZodEnum<["blocking", "data", "resource", "sequential"]>;
            /** Optional: specific output field required from dependency */
            required_output: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "blocking" | "data" | "resource" | "sequential";
            depends_on: string;
            required_output?: string | undefined;
        }, {
            type: "blocking" | "data" | "resource" | "sequential";
            depends_on: string;
            required_output?: string | undefined;
        }>, "many">>;
        /** Expected inputs for this step */
        expected_inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodString;
            required: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            name: string;
            description: string;
            required: boolean;
        }, {
            type: string;
            name: string;
            description: string;
            required?: boolean | undefined;
        }>, "many">>;
        /** Expected outputs from this step */
        expected_outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            name: string;
            description: string;
        }, {
            type: string;
            name: string;
            description: string;
        }>, "many">>;
        /** Classification tags for the step */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Constraints that apply to this step (informational only) */
        constraints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Whether this step can be parallelized with siblings */
        parallelizable: z.ZodDefault<z.ZodBoolean>;
        /** Criticality level */
        criticality: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        step_id: string;
        sequence_order: number;
        dependencies: {
            type: "blocking" | "data" | "resource" | "sequential";
            depends_on: string;
            required_output?: string | undefined;
        }[];
        expected_inputs: {
            type: string;
            name: string;
            description: string;
            required: boolean;
        }[];
        expected_outputs: {
            type: string;
            name: string;
            description: string;
        }[];
        tags: string[];
        constraints: string[];
        parallelizable: boolean;
        criticality: "low" | "medium" | "high" | "critical";
    }, {
        name: string;
        description: string;
        step_id: string;
        sequence_order: number;
        dependencies?: {
            type: "blocking" | "data" | "resource" | "sequential";
            depends_on: string;
            required_output?: string | undefined;
        }[] | undefined;
        expected_inputs?: {
            type: string;
            name: string;
            description: string;
            required?: boolean | undefined;
        }[] | undefined;
        expected_outputs?: {
            type: string;
            name: string;
            description: string;
        }[] | undefined;
        tags?: string[] | undefined;
        constraints?: string[] | undefined;
        parallelizable?: boolean | undefined;
        criticality?: "low" | "medium" | "high" | "critical" | undefined;
    }>, "many">;
    /** Dependency graph as adjacency list */
    dependency_graph: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
    /** Critical path through the plan (longest dependency chain) */
    critical_path: z.ZodArray<z.ZodString, "many">;
    /** Steps that can execute in parallel at each phase */
    parallel_groups: z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">;
    /** Analysis metadata */
    analysis: z.ZodObject<{
        /** Total number of steps */
        total_steps: z.ZodNumber;
        /** Maximum dependency depth */
        max_depth: z.ZodNumber;
        /** Number of parallelizable groups */
        parallel_opportunities: z.ZodNumber;
        /** Identified risks or concerns (informational) */
        risks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            description: z.ZodString;
            severity: z.ZodEnum<["low", "medium", "high"]>;
            affected_steps: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            description: string;
            severity: "low" | "medium" | "high";
            affected_steps: string[];
        }, {
            description: string;
            severity: "low" | "medium" | "high";
            affected_steps: string[];
        }>, "many">>;
        /** Assumptions made during planning */
        assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        max_depth: number;
        total_steps: number;
        parallel_opportunities: number;
        risks: {
            description: string;
            severity: "low" | "medium" | "high";
            affected_steps: string[];
        }[];
        assumptions: string[];
    }, {
        max_depth: number;
        total_steps: number;
        parallel_opportunities: number;
        risks?: {
            description: string;
            severity: "low" | "medium" | "high";
            affected_steps: string[];
        }[] | undefined;
        assumptions?: string[] | undefined;
    }>;
    /** Plan version for tracking iterations */
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: string;
    plan_id: string;
    objective_summary: string;
    steps: {
        name: string;
        description: string;
        step_id: string;
        sequence_order: number;
        dependencies: {
            type: "blocking" | "data" | "resource" | "sequential";
            depends_on: string;
            required_output?: string | undefined;
        }[];
        expected_inputs: {
            type: string;
            name: string;
            description: string;
            required: boolean;
        }[];
        expected_outputs: {
            type: string;
            name: string;
            description: string;
        }[];
        tags: string[];
        constraints: string[];
        parallelizable: boolean;
        criticality: "low" | "medium" | "high" | "critical";
    }[];
    dependency_graph: Record<string, string[]>;
    critical_path: string[];
    parallel_groups: string[][];
    analysis: {
        max_depth: number;
        total_steps: number;
        parallel_opportunities: number;
        risks: {
            description: string;
            severity: "low" | "medium" | "high";
            affected_steps: string[];
        }[];
        assumptions: string[];
    };
}, {
    plan_id: string;
    objective_summary: string;
    steps: {
        name: string;
        description: string;
        step_id: string;
        sequence_order: number;
        dependencies?: {
            type: "blocking" | "data" | "resource" | "sequential";
            depends_on: string;
            required_output?: string | undefined;
        }[] | undefined;
        expected_inputs?: {
            type: string;
            name: string;
            description: string;
            required?: boolean | undefined;
        }[] | undefined;
        expected_outputs?: {
            type: string;
            name: string;
            description: string;
        }[] | undefined;
        tags?: string[] | undefined;
        constraints?: string[] | undefined;
        parallelizable?: boolean | undefined;
        criticality?: "low" | "medium" | "high" | "critical" | undefined;
    }[];
    dependency_graph: Record<string, string[]>;
    critical_path: string[];
    parallel_groups: string[][];
    analysis: {
        max_depth: number;
        total_steps: number;
        parallel_opportunities: number;
        risks?: {
            description: string;
            severity: "low" | "medium" | "high";
            affected_steps: string[];
        }[] | undefined;
        assumptions?: string[] | undefined;
    };
    version?: string | undefined;
}>;
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;
