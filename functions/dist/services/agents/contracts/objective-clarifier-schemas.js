"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectiveClarifierOutputSchema = exports.ObjectiveClarifierInputSchema = exports.NormalizedGoalSchema = exports.MissingConstraintSchema = exports.AmbiguitySchema = void 0;
const zod_1 = require("zod");
const pipeline_schemas_1 = require("./pipeline-schemas");
/**
 * Ambiguity detection result
 */
exports.AmbiguitySchema = zod_1.z.object({
    /** Unique identifier for this ambiguity */
    id: zod_1.z.string().min(1),
    /** Type of ambiguity detected */
    type: zod_1.z.enum([
        'lexical', // Word meaning unclear
        'syntactic', // Sentence structure unclear
        'semantic', // Meaning/intent unclear
        'referential', // Reference unclear (what does "it" refer to)
        'scope', // Extent/boundaries unclear
        'temporal', // Timing/sequencing unclear
        'quantitative', // Amount/scale unclear
        'conditional', // Conditions/constraints unclear
    ]),
    /** The ambiguous portion of the objective */
    source_text: zod_1.z.string(),
    /** Description of why this is ambiguous */
    description: zod_1.z.string(),
    /** Possible interpretations of the ambiguous element */
    interpretations: zod_1.z.array(zod_1.z.object({
        interpretation: zod_1.z.string(),
        likelihood: zod_1.z.number().min(0).max(1),
        assumptions: zod_1.z.array(zod_1.z.string()).default([]),
    })).min(1),
    /** Severity of the ambiguity (how much it blocks understanding) */
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Suggested clarification question */
    clarification_prompt: zod_1.z.string(),
});
/**
 * Missing constraint identification
 */
exports.MissingConstraintSchema = zod_1.z.object({
    /** Unique identifier */
    id: zod_1.z.string().min(1),
    /** Category of the missing constraint */
    category: zod_1.z.enum([
        'temporal', // Timeline, deadlines, duration
        'resource', // Budget, tools, people, systems
        'quality', // Standards, acceptance criteria
        'scope', // Boundaries, inclusions/exclusions
        'dependency', // Prerequisites, blockers
        'compliance', // Regulations, policies
        'technical', // Technology choices, compatibility
        'performance', // Speed, scalability, limits
    ]),
    /** What constraint information is missing */
    description: zod_1.z.string(),
    /** Why this constraint matters */
    impact: zod_1.z.string(),
    /** Severity if left unspecified */
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Suggested question to elicit this constraint */
    clarification_prompt: zod_1.z.string(),
    /** Default assumption if not clarified */
    default_assumption: zod_1.z.string().optional(),
});
/**
 * Normalized goal representation
 */
exports.NormalizedGoalSchema = zod_1.z.object({
    /** Unique identifier for the goal */
    goal_id: zod_1.z.string().min(1),
    /** Normalized statement of the goal */
    statement: zod_1.z.string().min(1),
    /** Goal type classification */
    type: zod_1.z.enum([
        'functional', // What the system should do
        'non_functional', // How well it should do it
        'constraint', // Limitations or boundaries
        'assumption', // Implicit requirements
    ]),
    /** Extracted action verb (normalized) */
    action: zod_1.z.string(),
    /** Subject/target of the action */
    subject: zod_1.z.string(),
    /** Optional object/output of the action */
    object: zod_1.z.string().optional(),
    /** Qualifiers and conditions */
    qualifiers: zod_1.z.array(zod_1.z.string()).default([]),
    /** Confidence in this normalization */
    confidence: zod_1.z.number().min(0).max(1),
    /** Original text this was derived from */
    source_text: zod_1.z.string(),
});
/**
 * Objective Clarifier Agent Input Schema
 */
exports.ObjectiveClarifierInputSchema = zod_1.z.object({
    /** The raw objective to clarify */
    objective: zod_1.z.string().min(1).max(50000),
    /** Optional context to aid clarification */
    context: zod_1.z.object({
        /** Domain/industry context */
        domain: zod_1.z.string().optional(),
        /** Known stakeholders */
        stakeholders: zod_1.z.array(zod_1.z.string()).optional(),
        /** Existing system/project information */
        existing_context: zod_1.z.string().optional(),
        /** Previously established constraints */
        known_constraints: zod_1.z.array(zod_1.z.string()).optional(),
        /** Priority hints */
        priorities: zod_1.z.array(zod_1.z.string()).optional(),
    }).optional(),
    /** Configuration for clarification */
    config: zod_1.z.object({
        /** Minimum ambiguity severity to report */
        min_severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']).optional(),
        /** Maximum number of clarification questions to generate */
        max_questions: zod_1.z.number().int().positive().max(20).optional(),
        /** Whether to attempt automatic resolution of low-severity ambiguities */
        auto_resolve_low_severity: zod_1.z.boolean().optional(),
        /** Preferred interpretation style */
        interpretation_style: zod_1.z.enum(['conservative', 'balanced', 'liberal']).optional(),
    }).optional(),
    /** Request ID for tracing */
    request_id: zod_1.z.string().uuid().optional(),
    /** Optional pipeline context for multi-agent orchestration */
    pipeline_context: pipeline_schemas_1.PipelineContextSchema.optional(),
});
/**
 * Objective Clarifier Agent Output Schema
 */
exports.ObjectiveClarifierOutputSchema = zod_1.z.object({
    /** Unique clarification session identifier */
    clarification_id: zod_1.z.string().uuid(),
    /** Original objective (echoed for verification) */
    original_objective: zod_1.z.string(),
    /** Clarification status */
    status: zod_1.z.enum([
        'clear', // Objective is clear, no issues found
        'needs_clarification', // Ambiguities or missing constraints found
        'requires_decomposition', // Too complex, needs breaking down
        'insufficient', // Not enough information to analyze
    ]),
    /** List of detected ambiguities */
    ambiguities: zod_1.z.array(exports.AmbiguitySchema).default([]),
    /** List of missing constraints */
    missing_constraints: zod_1.z.array(exports.MissingConstraintSchema).default([]),
    /** Normalized goals extracted from the objective */
    normalized_goals: zod_1.z.array(exports.NormalizedGoalSchema).default([]),
    /** Clarified/normalized version of the objective */
    clarified_objective: zod_1.z.object({
        /** The clarified objective statement */
        statement: zod_1.z.string(),
        /** Assumptions made during clarification */
        assumptions: zod_1.z.array(zod_1.z.string()).default([]),
        /** Unresolved items that need human input */
        unresolved: zod_1.z.array(zod_1.z.string()).default([]),
        /** Confidence in the clarification */
        confidence: zod_1.z.number().min(0).max(1),
    }),
    /** Prioritized clarification questions */
    clarification_questions: zod_1.z.array(zod_1.z.object({
        question: zod_1.z.string(),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        related_ambiguity_id: zod_1.z.string().optional(),
        related_constraint_id: zod_1.z.string().optional(),
    })).default([]),
    /** Analysis metadata */
    analysis: zod_1.z.object({
        /** Total ambiguities detected */
        total_ambiguities: zod_1.z.number().int().nonnegative(),
        /** Total missing constraints */
        total_missing_constraints: zod_1.z.number().int().nonnegative(),
        /** Total goals extracted */
        total_goals: zod_1.z.number().int().nonnegative(),
        /** Overall clarity score (0-1) */
        clarity_score: zod_1.z.number().min(0).max(1),
        /** Completeness score (0-1) */
        completeness_score: zod_1.z.number().min(0).max(1),
        /** Word count of original objective */
        word_count: zod_1.z.number().int().nonnegative(),
        /** Complexity assessment */
        complexity: zod_1.z.enum(['simple', 'moderate', 'complex', 'very_complex']),
    }),
    /** Clarification version */
    version: zod_1.z.string().default('1.0.0'),
});
//# sourceMappingURL=objective-clarifier-schemas.js.map