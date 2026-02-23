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
import { PipelineContextSchema } from './pipeline-schemas';

/**
 * Ambiguity detection result
 */
export const AmbiguitySchema = z.object({
  /** Unique identifier for this ambiguity */
  id: z.string().min(1),

  /** Type of ambiguity detected */
  type: z.enum([
    'lexical',        // Word meaning unclear
    'syntactic',      // Sentence structure unclear
    'semantic',       // Meaning/intent unclear
    'referential',    // Reference unclear (what does "it" refer to)
    'scope',          // Extent/boundaries unclear
    'temporal',       // Timing/sequencing unclear
    'quantitative',   // Amount/scale unclear
    'conditional',    // Conditions/constraints unclear
  ]),

  /** The ambiguous portion of the objective */
  source_text: z.string(),

  /** Description of why this is ambiguous */
  description: z.string(),

  /** Possible interpretations of the ambiguous element */
  interpretations: z.array(z.object({
    interpretation: z.string(),
    likelihood: z.number().min(0).max(1),
    assumptions: z.array(z.string()).default([]),
  })).min(1),

  /** Severity of the ambiguity (how much it blocks understanding) */
  severity: z.enum(['low', 'medium', 'high', 'critical']),

  /** Suggested clarification question */
  clarification_prompt: z.string(),
});

export type Ambiguity = z.infer<typeof AmbiguitySchema>;

/**
 * Missing constraint identification
 */
export const MissingConstraintSchema = z.object({
  /** Unique identifier */
  id: z.string().min(1),

  /** Category of the missing constraint */
  category: z.enum([
    'temporal',       // Timeline, deadlines, duration
    'resource',       // Budget, tools, people, systems
    'quality',        // Standards, acceptance criteria
    'scope',          // Boundaries, inclusions/exclusions
    'dependency',     // Prerequisites, blockers
    'compliance',     // Regulations, policies
    'technical',      // Technology choices, compatibility
    'performance',    // Speed, scalability, limits
  ]),

  /** What constraint information is missing */
  description: z.string(),

  /** Why this constraint matters */
  impact: z.string(),

  /** Severity if left unspecified */
  severity: z.enum(['low', 'medium', 'high', 'critical']),

  /** Suggested question to elicit this constraint */
  clarification_prompt: z.string(),

  /** Default assumption if not clarified */
  default_assumption: z.string().optional(),
});

export type MissingConstraint = z.infer<typeof MissingConstraintSchema>;

/**
 * Normalized goal representation
 */
export const NormalizedGoalSchema = z.object({
  /** Unique identifier for the goal */
  goal_id: z.string().min(1),

  /** Normalized statement of the goal */
  statement: z.string().min(1),

  /** Goal type classification */
  type: z.enum([
    'functional',     // What the system should do
    'non_functional', // How well it should do it
    'constraint',     // Limitations or boundaries
    'assumption',     // Implicit requirements
  ]),

  /** Extracted action verb (normalized) */
  action: z.string(),

  /** Subject/target of the action */
  subject: z.string(),

  /** Optional object/output of the action */
  object: z.string().optional(),

  /** Qualifiers and conditions */
  qualifiers: z.array(z.string()).default([]),

  /** Confidence in this normalization */
  confidence: z.number().min(0).max(1),

  /** Original text this was derived from */
  source_text: z.string(),
});

export type NormalizedGoal = z.infer<typeof NormalizedGoalSchema>;

/**
 * Objective Clarifier Agent Input Schema
 */
export const ObjectiveClarifierInputSchema = z.object({
  /** The raw objective to clarify */
  objective: z.string().min(1).max(50000),

  /** Optional context to aid clarification */
  context: z.object({
    /** Domain/industry context */
    domain: z.string().optional(),

    /** Known stakeholders */
    stakeholders: z.array(z.string()).optional(),

    /** Existing system/project information */
    existing_context: z.string().optional(),

    /** Previously established constraints */
    known_constraints: z.array(z.string()).optional(),

    /** Priority hints */
    priorities: z.array(z.string()).optional(),
  }).optional(),

  /** Configuration for clarification */
  config: z.object({
    /** Minimum ambiguity severity to report */
    min_severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),

    /** Maximum number of clarification questions to generate */
    max_questions: z.number().int().positive().max(20).optional(),

    /** Whether to attempt automatic resolution of low-severity ambiguities */
    auto_resolve_low_severity: z.boolean().optional(),

    /** Preferred interpretation style */
    interpretation_style: z.enum(['conservative', 'balanced', 'liberal']).optional(),
  }).optional(),

  /** Request ID for tracing */
  request_id: z.string().uuid().optional(),

  /** Optional pipeline context for multi-agent orchestration */
  pipeline_context: PipelineContextSchema.optional(),
});

export type ObjectiveClarifierInput = z.infer<typeof ObjectiveClarifierInputSchema>;

/**
 * Objective Clarifier Agent Output Schema
 */
export const ObjectiveClarifierOutputSchema = z.object({
  /** Unique clarification session identifier */
  clarification_id: z.string().uuid(),

  /** Original objective (echoed for verification) */
  original_objective: z.string(),

  /** Clarification status */
  status: z.enum([
    'clear',              // Objective is clear, no issues found
    'needs_clarification', // Ambiguities or missing constraints found
    'requires_decomposition', // Too complex, needs breaking down
    'insufficient',       // Not enough information to analyze
  ]),

  /** List of detected ambiguities */
  ambiguities: z.array(AmbiguitySchema).default([]),

  /** List of missing constraints */
  missing_constraints: z.array(MissingConstraintSchema).default([]),

  /** Normalized goals extracted from the objective */
  normalized_goals: z.array(NormalizedGoalSchema).default([]),

  /** Clarified/normalized version of the objective */
  clarified_objective: z.object({
    /** The clarified objective statement */
    statement: z.string(),

    /** Assumptions made during clarification */
    assumptions: z.array(z.string()).default([]),

    /** Unresolved items that need human input */
    unresolved: z.array(z.string()).default([]),

    /** Confidence in the clarification */
    confidence: z.number().min(0).max(1),
  }),

  /** Prioritized clarification questions */
  clarification_questions: z.array(z.object({
    question: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    related_ambiguity_id: z.string().optional(),
    related_constraint_id: z.string().optional(),
  })).default([]),

  /** Analysis metadata */
  analysis: z.object({
    /** Total ambiguities detected */
    total_ambiguities: z.number().int().nonnegative(),

    /** Total missing constraints */
    total_missing_constraints: z.number().int().nonnegative(),

    /** Total goals extracted */
    total_goals: z.number().int().nonnegative(),

    /** Overall clarity score (0-1) */
    clarity_score: z.number().min(0).max(1),

    /** Completeness score (0-1) */
    completeness_score: z.number().min(0).max(1),

    /** Word count of original objective */
    word_count: z.number().int().nonnegative(),

    /** Complexity assessment */
    complexity: z.enum(['simple', 'moderate', 'complex', 'very_complex']),
  }),

  /** Clarification version */
  version: z.string().default('1.0.0'),
});

export type ObjectiveClarifierOutput = z.infer<typeof ObjectiveClarifierOutputSchema>;
