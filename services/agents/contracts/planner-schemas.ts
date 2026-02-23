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
import { PipelineContextSchema } from './pipeline-schemas';

/**
 * Dependency between plan steps
 */
export const DependencySchema = z.object({
  /** ID of the step this depends on */
  depends_on: z.string(),

  /** Type of dependency */
  type: z.enum([
    'blocking',      // Must complete before this step starts
    'data',          // Requires output data from dependency
    'resource',      // Shares resource that can't be concurrent
    'sequential',    // Must follow in sequence (order matters)
  ]),

  /** Optional: specific output field required from dependency */
  required_output: z.string().optional(),
});

export type Dependency = z.infer<typeof DependencySchema>;

/**
 * Single step in an execution plan
 */
export const PlanStepSchema = z.object({
  /** Unique step identifier within the plan */
  step_id: z.string().min(1),

  /** Human-readable step name */
  name: z.string().min(1).max(200),

  /** Detailed description of what this step accomplishes */
  description: z.string().min(1),

  /** Order in sequence (0-indexed) */
  sequence_order: z.number().int().nonnegative(),

  /** Dependencies on other steps */
  dependencies: z.array(DependencySchema).default([]),

  /** Expected inputs for this step */
  expected_inputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    required: z.boolean().default(true),
  })).default([]),

  /** Expected outputs from this step */
  expected_outputs: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
  })).default([]),

  /** Classification tags for the step */
  tags: z.array(z.string()).default([]),

  /** Constraints that apply to this step (informational only) */
  constraints: z.array(z.string()).default([]),

  /** Whether this step can be parallelized with siblings */
  parallelizable: z.boolean().default(false),

  /** Criticality level */
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

/**
 * Planner Agent Input Schema
 */
export const PlannerInputSchema = z.object({
  /** The clarified objective to plan for */
  objective: z.string().min(1).max(10000),

  /** Optional context about the domain/system */
  context: z.object({
    domain: z.string().optional(),
    existing_components: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
    preferences: z.record(z.string()).optional(),
  }).optional(),

  /** Optional hints about expected complexity */
  hints: z.object({
    expected_step_count: z.number().int().positive().optional(),
    max_depth: z.number().int().positive().optional(),
    focus_areas: z.array(z.string()).optional(),
  }).optional(),

  /** Request ID for tracing */
  request_id: z.string().uuid().optional(),

  /** Optional pipeline context for multi-agent orchestration */
  pipeline_context: PipelineContextSchema.optional(),
});

export type PlannerInput = z.infer<typeof PlannerInputSchema>;

/**
 * Planner Agent Output Schema
 */
export const PlannerOutputSchema = z.object({
  /** Generated plan identifier */
  plan_id: z.string().uuid(),

  /** The original objective (echoed for verification) */
  objective_summary: z.string(),

  /** Ordered list of plan steps */
  steps: z.array(PlanStepSchema).min(1),

  /** Dependency graph as adjacency list */
  dependency_graph: z.record(z.array(z.string())),

  /** Critical path through the plan (longest dependency chain) */
  critical_path: z.array(z.string()),

  /** Steps that can execute in parallel at each phase */
  parallel_groups: z.array(z.array(z.string())),

  /** Analysis metadata */
  analysis: z.object({
    /** Total number of steps */
    total_steps: z.number().int().nonnegative(),

    /** Maximum dependency depth */
    max_depth: z.number().int().nonnegative(),

    /** Number of parallelizable groups */
    parallel_opportunities: z.number().int().nonnegative(),

    /** Identified risks or concerns (informational) */
    risks: z.array(z.object({
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      affected_steps: z.array(z.string()),
    })).default([]),

    /** Assumptions made during planning */
    assumptions: z.array(z.string()).default([]),
  }),

  /** Plan version for tracking iterations */
  version: z.string().default('1.0.0'),
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;
