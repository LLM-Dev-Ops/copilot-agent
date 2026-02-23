"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecomposerOutputSchema = exports.DecomposerInputSchema = exports.SubObjectiveSchema = void 0;
const zod_1 = require("zod");
const pipeline_schemas_1 = require("./pipeline-schemas");
/**
 * A single sub-objective produced by decomposition
 */
exports.SubObjectiveSchema = zod_1.z.object({
    /** Unique identifier for this sub-objective */
    sub_objective_id: zod_1.z.string().min(1),
    /** Human-readable title */
    title: zod_1.z.string().min(1).max(200),
    /** Detailed description of the sub-objective */
    description: zod_1.z.string().min(1),
    /** Parent sub-objective ID (null for top-level) */
    parent_id: zod_1.z.string().nullable().default(null),
    /** Depth level in the decomposition tree (0 = top-level) */
    depth: zod_1.z.number().int().nonnegative(),
    /** Dependencies on other sub-objectives */
    dependencies: zod_1.z.array(zod_1.z.object({
        depends_on: zod_1.z.string(),
        type: zod_1.z.enum(['blocking', 'data', 'sequential']),
    })).default([]),
    /** Classification tags */
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    /** Estimated complexity */
    complexity: zod_1.z.enum(['trivial', 'simple', 'moderate', 'complex', 'very_complex']).default('moderate'),
    /** Whether this sub-objective can be further decomposed */
    is_atomic: zod_1.z.boolean().default(false),
    /** Acceptance criteria for this sub-objective */
    acceptance_criteria: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * Decomposer Agent Input Schema
 */
exports.DecomposerInputSchema = zod_1.z.object({
    /** The complex objective to decompose */
    objective: zod_1.z.string().min(1).max(50000),
    /** Optional context to aid decomposition */
    context: zod_1.z.object({
        /** Domain/industry context */
        domain: zod_1.z.string().optional(),
        /** Existing components or systems */
        existing_components: zod_1.z.array(zod_1.z.string()).optional(),
        /** Known constraints */
        constraints: zod_1.z.array(zod_1.z.string()).optional(),
        /** Maximum decomposition depth */
        max_depth: zod_1.z.number().int().positive().max(10).optional(),
    }).optional(),
    /** Configuration for decomposition */
    config: zod_1.z.object({
        /** Target granularity for leaf sub-objectives */
        target_granularity: zod_1.z.enum(['coarse', 'medium', 'fine']).optional(),
        /** Maximum number of sub-objectives to produce */
        max_sub_objectives: zod_1.z.number().int().positive().max(50).optional(),
    }).optional(),
    /** Request ID for tracing */
    request_id: zod_1.z.string().uuid().optional(),
    /** Optional pipeline context for multi-agent orchestration */
    pipeline_context: pipeline_schemas_1.PipelineContextSchema.optional(),
});
/**
 * Decomposer Agent Output Schema
 */
exports.DecomposerOutputSchema = zod_1.z.object({
    /** Unique decomposition identifier */
    decomposition_id: zod_1.z.string().uuid(),
    /** Original objective (echoed for verification) */
    original_objective: zod_1.z.string(),
    /** List of sub-objectives produced */
    sub_objectives: zod_1.z.array(exports.SubObjectiveSchema).min(1),
    /** Tree structure as adjacency list (parent -> children) */
    tree_structure: zod_1.z.record(zod_1.z.array(zod_1.z.string())),
    /** Dependency graph as adjacency list */
    dependency_graph: zod_1.z.record(zod_1.z.array(zod_1.z.string())),
    /** Analysis metadata */
    analysis: zod_1.z.object({
        /** Total number of sub-objectives */
        total_sub_objectives: zod_1.z.number().int().nonnegative(),
        /** Maximum decomposition depth reached */
        max_depth_reached: zod_1.z.number().int().nonnegative(),
        /** Number of atomic (leaf) sub-objectives */
        atomic_count: zod_1.z.number().int().nonnegative(),
        /** Coverage assessment */
        coverage_score: zod_1.z.number().min(0).max(1),
        /** Complexity distribution */
        complexity_distribution: zod_1.z.record(zod_1.z.number().int().nonnegative()),
        /** Assumptions made during decomposition */
        assumptions: zod_1.z.array(zod_1.z.string()).default([]),
    }),
    /** Decomposition version */
    version: zod_1.z.string().default('1.0.0'),
});
//# sourceMappingURL=decomposer-schemas.js.map