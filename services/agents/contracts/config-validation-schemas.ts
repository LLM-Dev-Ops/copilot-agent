/**
 * Config Validation Agent Schemas
 *
 * Purpose: Validate configuration artifacts for structural and semantic correctness
 * Classification: CONFIGURATION_VALIDATION, STATIC_ANALYSIS
 * decision_type: config_validation
 *
 * Scope:
 * - Validate schemas
 * - Validate semantic constraints
 * - Detect missing, conflicting, deprecated, or unsafe values
 * - Assess configuration readiness
 *
 * Must Never:
 * - Modify configuration
 * - Apply defaults
 * - Auto-fix values
 * - Enforce policy
 * - Block execution
 */

import { z } from 'zod';

/**
 * Severity levels for validation findings
 */
export const ValidationSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type ValidationSeverityType = typeof ValidationSeverity[keyof typeof ValidationSeverity];

/**
 * Categories of validation issues
 */
export const ValidationCategory = {
  SCHEMA: 'schema',
  SEMANTIC: 'semantic',
  MISSING: 'missing',
  CONFLICT: 'conflict',
  DEPRECATED: 'deprecated',
  UNSAFE: 'unsafe',
  TYPE_MISMATCH: 'type_mismatch',
  CONSTRAINT: 'constraint',
  COMPATIBILITY: 'compatibility',
} as const;

export type ValidationCategoryType = typeof ValidationCategory[keyof typeof ValidationCategory];

/**
 * Single validation finding
 */
export const ValidationFindingSchema = z.object({
  /** Unique finding identifier */
  finding_id: z.string().min(1),

  /** Category of the issue */
  category: z.enum([
    'schema',
    'semantic',
    'missing',
    'conflict',
    'deprecated',
    'unsafe',
    'type_mismatch',
    'constraint',
    'compatibility',
  ]),

  /** Severity level */
  severity: z.enum(['info', 'warning', 'error', 'critical']),

  /** JSON path to the problematic value */
  path: z.string(),

  /** Human-readable description of the issue */
  message: z.string().min(1),

  /** The actual value found (if applicable) */
  actual_value: z.unknown().optional(),

  /** Expected value or type (if applicable) */
  expected: z.string().optional(),

  /** Related paths that contribute to this finding */
  related_paths: z.array(z.string()).default([]),

  /** Documentation reference for this issue */
  doc_reference: z.string().optional(),

  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
});

export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

/**
 * Schema validation result
 */
export const SchemaValidationResultSchema = z.object({
  /** Whether schema validation passed */
  valid: z.boolean(),

  /** Schema that was validated against */
  schema_id: z.string().optional(),

  /** Schema version */
  schema_version: z.string().optional(),

  /** Findings from schema validation */
  findings: z.array(ValidationFindingSchema),
});

export type SchemaValidationResult = z.infer<typeof SchemaValidationResultSchema>;

/**
 * Semantic constraint check
 */
export const SemanticConstraintSchema = z.object({
  /** Constraint identifier */
  constraint_id: z.string().min(1),

  /** Human-readable constraint name */
  name: z.string().min(1),

  /** Description of what this constraint checks */
  description: z.string(),

  /** Whether the constraint passed */
  passed: z.boolean(),

  /** Paths involved in this constraint */
  paths: z.array(z.string()),

  /** Details if constraint failed */
  failure_detail: z.string().optional(),
});

export type SemanticConstraint = z.infer<typeof SemanticConstraintSchema>;

/**
 * Deprecated value detection
 */
export const DeprecatedValueSchema = z.object({
  /** Path to deprecated value */
  path: z.string(),

  /** The deprecated value */
  value: z.unknown(),

  /** When it was deprecated */
  deprecated_since: z.string().optional(),

  /** When it will be removed */
  removal_version: z.string().optional(),

  /** Suggested replacement (informational only, NOT applied) */
  suggested_replacement: z.string().optional(),

  /** Migration documentation */
  migration_guide: z.string().optional(),
});

export type DeprecatedValue = z.infer<typeof DeprecatedValueSchema>;

/**
 * Unsafe configuration detection
 */
export const UnsafeConfigSchema = z.object({
  /** Path to unsafe configuration */
  path: z.string(),

  /** The unsafe value */
  value: z.unknown(),

  /** Type of security concern */
  concern_type: z.enum([
    'hardcoded_secret',
    'weak_encryption',
    'insecure_protocol',
    'overly_permissive',
    'missing_authentication',
    'exposed_endpoint',
    'debug_enabled',
    'verbose_logging',
    'other',
  ]),

  /** Severity of the security concern */
  severity: z.enum(['low', 'medium', 'high', 'critical']),

  /** Description of the risk */
  risk_description: z.string(),

  /** CWE reference if applicable */
  cwe_reference: z.string().optional(),
});

export type UnsafeConfig = z.infer<typeof UnsafeConfigSchema>;

/**
 * Configuration conflict
 */
export const ConfigConflictSchema = z.object({
  /** Conflict identifier */
  conflict_id: z.string().min(1),

  /** Type of conflict */
  conflict_type: z.enum([
    'mutually_exclusive',
    'dependency_missing',
    'circular_reference',
    'value_incompatibility',
    'version_mismatch',
  ]),

  /** Paths involved in the conflict */
  conflicting_paths: z.array(z.string()).min(2),

  /** Description of the conflict */
  description: z.string(),

  /** Severity */
  severity: z.enum(['warning', 'error', 'critical']),
});

export type ConfigConflict = z.infer<typeof ConfigConflictSchema>;

/**
 * Missing required configuration
 */
export const MissingConfigSchema = z.object({
  /** Path where value is missing */
  path: z.string(),

  /** Expected type */
  expected_type: z.string(),

  /** Whether this is required or recommended */
  requirement_level: z.enum(['required', 'recommended', 'optional_but_advised']),

  /** Description of what this config does */
  description: z.string(),

  /** Default that would be used if not specified (informational) */
  implicit_default: z.unknown().optional(),
});

export type MissingConfig = z.infer<typeof MissingConfigSchema>;

/**
 * Readiness assessment
 */
export const ReadinessAssessmentSchema = z.object({
  /** Overall readiness status */
  status: z.enum(['ready', 'ready_with_warnings', 'not_ready', 'critical_issues']),

  /** Readiness score (0.0 - 1.0) */
  score: z.number().min(0).max(1),

  /** Breakdown by category */
  category_scores: z.record(z.number()),

  /** Blocking issues that prevent readiness */
  blocking_issues: z.array(z.string()),

  /** Non-blocking warnings */
  warnings: z.array(z.string()),

  /** Recommendations (informational only) */
  recommendations: z.array(z.string()),
});

export type ReadinessAssessment = z.infer<typeof ReadinessAssessmentSchema>;

/**
 * Config Validation Agent Input Schema
 */
export const ConfigValidationInputSchema = z.object({
  /** The configuration to validate (JSON/YAML parsed to object) */
  config: z.record(z.unknown()),

  /** Configuration format */
  format: z.enum(['json', 'yaml', 'toml', 'env', 'unknown']).default('unknown'),

  /** Optional schema to validate against */
  schema: z.object({
    /** Schema content or reference */
    content: z.unknown().optional(),
    /** Schema URI/ID */
    uri: z.string().optional(),
    /** Schema format */
    format: z.enum(['json-schema', 'zod', 'yup', 'joi', 'custom']).optional(),
  }).optional(),

  /** Configuration context */
  context: z.object({
    /** Environment (dev, staging, prod) */
    environment: z.string().optional(),
    /** Application name */
    application: z.string().optional(),
    /** Version being validated */
    version: z.string().optional(),
    /** Known deprecated keys to check */
    deprecated_keys: z.array(z.string()).optional(),
    /** Custom semantic constraints */
    constraints: z.array(z.object({
      name: z.string(),
      description: z.string(),
      check: z.string(), // JSONPath or simple expression
    })).optional(),
  }).optional(),

  /** Validation options */
  options: z.object({
    /** Check for deprecated values */
    check_deprecated: z.boolean().default(true),
    /** Check for security issues */
    check_security: z.boolean().default(true),
    /** Check for conflicts */
    check_conflicts: z.boolean().default(true),
    /** Check for missing required values */
    check_missing: z.boolean().default(true),
    /** Strict mode (treat warnings as errors) */
    strict: z.boolean().default(false),
  }).optional(),

  /** Request ID for tracing */
  request_id: z.string().uuid().optional(),
});

export type ConfigValidationInput = z.infer<typeof ConfigValidationInputSchema>;

/**
 * Config Validation Agent Output Schema
 */
export const ConfigValidationOutputSchema = z.object({
  /** Validation result ID */
  validation_id: z.string().uuid(),

  /** Overall validation passed/failed */
  valid: z.boolean(),

  /** Schema validation results */
  schema_validation: SchemaValidationResultSchema,

  /** Semantic constraint results */
  semantic_constraints: z.array(SemanticConstraintSchema),

  /** All validation findings */
  findings: z.array(ValidationFindingSchema),

  /** Detected deprecated values */
  deprecated_values: z.array(DeprecatedValueSchema),

  /** Detected unsafe configurations */
  unsafe_configs: z.array(UnsafeConfigSchema),

  /** Detected conflicts */
  conflicts: z.array(ConfigConflictSchema),

  /** Missing configurations */
  missing_configs: z.array(MissingConfigSchema),

  /** Readiness assessment */
  readiness: ReadinessAssessmentSchema,

  /** Summary statistics */
  summary: z.object({
    total_findings: z.number().int().nonnegative(),
    by_severity: z.object({
      critical: z.number().int().nonnegative(),
      error: z.number().int().nonnegative(),
      warning: z.number().int().nonnegative(),
      info: z.number().int().nonnegative(),
    }),
    by_category: z.record(z.number()),
    paths_checked: z.number().int().nonnegative(),
    constraints_checked: z.number().int().nonnegative(),
  }),

  /** Validation metadata */
  metadata: z.object({
    config_hash: z.string(),
    validated_at: z.string().datetime(),
    validation_duration_ms: z.number(),
    schema_used: z.string().optional(),
  }),
});

export type ConfigValidationOutput = z.infer<typeof ConfigValidationOutputSchema>;
