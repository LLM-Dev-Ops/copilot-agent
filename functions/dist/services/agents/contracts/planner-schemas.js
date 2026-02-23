"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerOutputSchema = exports.PlannerInputSchema = exports.PlanStepSchema = exports.DependencySchema = void 0;
const zod_1 = require("zod");
const pipeline_schemas_1 = require("./pipeline-schemas");
/**
 * Dependency between plan steps
 */
exports.DependencySchema = zod_1.z.object({
    /** ID of the step this depends on */
    depends_on: zod_1.z.string(),
    /** Type of dependency */
    type: zod_1.z.enum([
        'blocking', // Must complete before this step starts
        'data', // Requires output data from dependency
        'resource', // Shares resource that can't be concurrent
        'sequential', // Must follow in sequence (order matters)
    ]),
    /** Optional: specific output field required from dependency */
    required_output: zod_1.z.string().optional(),
});
/**
 * Single step in an execution plan
 */
exports.PlanStepSchema = zod_1.z.object({
    /** Unique step identifier within the plan */
    step_id: zod_1.z.string().min(1),
    /** Human-readable step name */
    name: zod_1.z.string().min(1).max(200),
    /** Detailed description of what this step accomplishes */
    description: zod_1.z.string().min(1),
    /** Order in sequence (0-indexed) */
    sequence_order: zod_1.z.number().int().nonnegative(),
    /** Dependencies on other steps */
    dependencies: zod_1.z.array(exports.DependencySchema).default([]),
    /** Expected inputs for this step */
    expected_inputs: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        description: zod_1.z.string(),
        required: zod_1.z.boolean().default(true),
    })).default([]),
    /** Expected outputs from this step */
    expected_outputs: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        description: zod_1.z.string(),
    })).default([]),
    /** Classification tags for the step */
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    /** Constraints that apply to this step (informational only) */
    constraints: zod_1.z.array(zod_1.z.string()).default([]),
    /** Whether this step can be parallelized with siblings */
    parallelizable: zod_1.z.boolean().default(false),
    /** Criticality level */
    criticality: zod_1.z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});
/**
 * Planner Agent Input Schema
 */
exports.PlannerInputSchema = zod_1.z.object({
    /** The clarified objective to plan for */
    objective: zod_1.z.string().min(1).max(10000),
    /** Optional context about the domain/system */
    context: zod_1.z.object({
        domain: zod_1.z.string().optional(),
        existing_components: zod_1.z.array(zod_1.z.string()).optional(),
        constraints: zod_1.z.array(zod_1.z.string()).optional(),
        preferences: zod_1.z.record(zod_1.z.string()).optional(),
    }).optional(),
    /** Optional hints about expected complexity */
    hints: zod_1.z.object({
        expected_step_count: zod_1.z.number().int().positive().optional(),
        max_depth: zod_1.z.number().int().positive().optional(),
        focus_areas: zod_1.z.array(zod_1.z.string()).optional(),
    }).optional(),
    /** Request ID for tracing */
    request_id: zod_1.z.string().uuid().optional(),
    /** Optional pipeline context for multi-agent orchestration */
    pipeline_context: pipeline_schemas_1.PipelineContextSchema.optional(),
});
/**
 * Planner Agent Output Schema
 */
exports.PlannerOutputSchema = zod_1.z.object({
    /** Generated plan identifier */
    plan_id: zod_1.z.string().uuid(),
    /** The original objective (echoed for verification) */
    objective_summary: zod_1.z.string(),
    /** Ordered list of plan steps */
    steps: zod_1.z.array(exports.PlanStepSchema).min(1),
    /** Dependency graph as adjacency list */
    dependency_graph: zod_1.z.record(zod_1.z.array(zod_1.z.string())),
    /** Critical path through the plan (longest dependency chain) */
    critical_path: zod_1.z.array(zod_1.z.string()),
    /** Steps that can execute in parallel at each phase */
    parallel_groups: zod_1.z.array(zod_1.z.array(zod_1.z.string())),
    /** Analysis metadata */
    analysis: zod_1.z.object({
        /** Total number of steps */
        total_steps: zod_1.z.number().int().nonnegative(),
        /** Maximum dependency depth */
        max_depth: zod_1.z.number().int().nonnegative(),
        /** Number of parallelizable groups */
        parallel_opportunities: zod_1.z.number().int().nonnegative(),
        /** Identified risks or concerns (informational) */
        risks: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string(),
            severity: zod_1.z.enum(['low', 'medium', 'high']),
            affected_steps: zod_1.z.array(zod_1.z.string()),
        })).default([]),
        /** Assumptions made during planning */
        assumptions: zod_1.z.array(zod_1.z.string()).default([]),
    }),
    /** Plan version for tracking iterations */
    version: zod_1.z.string().default('1.0.0'),
});
//# sourceMappingURL=planner-schemas.js.map