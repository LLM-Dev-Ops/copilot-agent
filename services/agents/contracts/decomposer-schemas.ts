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
import { PipelineContextSchema } from './pipeline-schemas';

/**
 * A single sub-objective produced by decomposition
 */
export const SubObjectiveSchema = z.object({
  /** Unique identifier for this sub-objective */
  sub_objective_id: z.string().min(1),

  /** Human-readable title */
  title: z.string().min(1).max(200),

  /** Detailed description of the sub-objective */
  description: z.string().min(1),

  /** Parent sub-objective ID (null for top-level) */
  parent_id: z.string().nullable().default(null),

  /** Depth level in the decomposition tree (0 = top-level) */
  depth: z.number().int().nonnegative(),

  /** Dependencies on other sub-objectives */
  dependencies: z.array(z.object({
    depends_on: z.string(),
    type: z.enum(['blocking', 'data', 'sequential']),
  })).default([]),

  /** Classification tags */
  tags: z.array(z.string()).default([]),

  /** Estimated complexity */
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex', 'very_complex']).default('moderate'),

  /** Whether this sub-objective can be further decomposed */
  is_atomic: z.boolean().default(false),

  /** Acceptance criteria for this sub-objective */
  acceptance_criteria: z.array(z.string()).default([]),
});

export type SubObjective = z.infer<typeof SubObjectiveSchema>;

/**
 * Decomposer Agent Input Schema
 */
export const DecomposerInputSchema = z.object({
  /** The complex objective to decompose */
  objective: z.string().min(1).max(50000),

  /** Optional context to aid decomposition */
  context: z.object({
    /** Domain/industry context */
    domain: z.string().optional(),
    /** Existing components or systems */
    existing_components: z.array(z.string()).optional(),
    /** Known constraints */
    constraints: z.array(z.string()).optional(),
    /** Maximum decomposition depth */
    max_depth: z.number().int().positive().max(10).optional(),
  }).optional(),

  /** Configuration for decomposition */
  config: z.object({
    /** Target granularity for leaf sub-objectives */
    target_granularity: z.enum(['coarse', 'medium', 'fine']).optional(),
    /** Maximum number of sub-objectives to produce */
    max_sub_objectives: z.number().int().positive().max(50).optional(),
  }).optional(),

  /** Request ID for tracing */
  request_id: z.string().uuid().optional(),

  /** Optional pipeline context for multi-agent orchestration */
  pipeline_context: PipelineContextSchema.optional(),
});

export type DecomposerInput = z.infer<typeof DecomposerInputSchema>;

/**
 * Decomposer Agent Output Schema
 */
export const DecomposerOutputSchema = z.object({
  /** Unique decomposition identifier */
  decomposition_id: z.string().uuid(),

  /** Original objective (echoed for verification) */
  original_objective: z.string(),

  /** List of sub-objectives produced */
  sub_objectives: z.array(SubObjectiveSchema).min(1),

  /** Tree structure as adjacency list (parent -> children) */
  tree_structure: z.record(z.array(z.string())),

  /** Dependency graph as adjacency list */
  dependency_graph: z.record(z.array(z.string())),

  /** Analysis metadata */
  analysis: z.object({
    /** Total number of sub-objectives */
    total_sub_objectives: z.number().int().nonnegative(),
    /** Maximum decomposition depth reached */
    max_depth_reached: z.number().int().nonnegative(),
    /** Number of atomic (leaf) sub-objectives */
    atomic_count: z.number().int().nonnegative(),
    /** Coverage assessment */
    coverage_score: z.number().min(0).max(1),
    /** Complexity distribution */
    complexity_distribution: z.record(z.number().int().nonnegative()),
    /** Assumptions made during decomposition */
    assumptions: z.array(z.string()).default([]),
  }),

  /** Decomposition version */
  version: z.string().default('1.0.0'),
});

export type DecomposerOutput = z.infer<typeof DecomposerOutputSchema>;
