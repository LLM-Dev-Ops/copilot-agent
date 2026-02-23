"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidationOutputSchema = exports.ConfigValidationInputSchema = exports.ReadinessAssessmentSchema = exports.MissingConfigSchema = exports.ConfigConflictSchema = exports.UnsafeConfigSchema = exports.DeprecatedValueSchema = exports.SemanticConstraintSchema = exports.SchemaValidationResultSchema = exports.ValidationFindingSchema = exports.ValidationCategory = exports.ValidationSeverity = void 0;
const zod_1 = require("zod");
const pipeline_schemas_1 = require("./pipeline-schemas");
/**
 * Severity levels for validation findings
 */
exports.ValidationSeverity = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
};
/**
 * Categories of validation issues
 */
exports.ValidationCategory = {
    SCHEMA: 'schema',
    SEMANTIC: 'semantic',
    MISSING: 'missing',
    CONFLICT: 'conflict',
    DEPRECATED: 'deprecated',
    UNSAFE: 'unsafe',
    TYPE_MISMATCH: 'type_mismatch',
    CONSTRAINT: 'constraint',
    COMPATIBILITY: 'compatibility',
};
/**
 * Single validation finding
 */
exports.ValidationFindingSchema = zod_1.z.object({
    /** Unique finding identifier */
    finding_id: zod_1.z.string().min(1),
    /** Category of the issue */
    category: zod_1.z.enum([
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
    severity: zod_1.z.enum(['info', 'warning', 'error', 'critical']),
    /** JSON path to the problematic value */
    path: zod_1.z.string(),
    /** Human-readable description of the issue */
    message: zod_1.z.string().min(1),
    /** The actual value found (if applicable) */
    actual_value: zod_1.z.unknown().optional(),
    /** Expected value or type (if applicable) */
    expected: zod_1.z.string().optional(),
    /** Related paths that contribute to this finding */
    related_paths: zod_1.z.array(zod_1.z.string()).default([]),
    /** Documentation reference for this issue */
    doc_reference: zod_1.z.string().optional(),
    /** Tags for categorization */
    tags: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * Schema validation result
 */
exports.SchemaValidationResultSchema = zod_1.z.object({
    /** Whether schema validation passed */
    valid: zod_1.z.boolean(),
    /** Schema that was validated against */
    schema_id: zod_1.z.string().optional(),
    /** Schema version */
    schema_version: zod_1.z.string().optional(),
    /** Findings from schema validation */
    findings: zod_1.z.array(exports.ValidationFindingSchema),
});
/**
 * Semantic constraint check
 */
exports.SemanticConstraintSchema = zod_1.z.object({
    /** Constraint identifier */
    constraint_id: zod_1.z.string().min(1),
    /** Human-readable constraint name */
    name: zod_1.z.string().min(1),
    /** Description of what this constraint checks */
    description: zod_1.z.string(),
    /** Whether the constraint passed */
    passed: zod_1.z.boolean(),
    /** Paths involved in this constraint */
    paths: zod_1.z.array(zod_1.z.string()),
    /** Details if constraint failed */
    failure_detail: zod_1.z.string().optional(),
});
/**
 * Deprecated value detection
 */
exports.DeprecatedValueSchema = zod_1.z.object({
    /** Path to deprecated value */
    path: zod_1.z.string(),
    /** The deprecated value */
    value: zod_1.z.unknown(),
    /** When it was deprecated */
    deprecated_since: zod_1.z.string().optional(),
    /** When it will be removed */
    removal_version: zod_1.z.string().optional(),
    /** Suggested replacement (informational only, NOT applied) */
    suggested_replacement: zod_1.z.string().optional(),
    /** Migration documentation */
    migration_guide: zod_1.z.string().optional(),
});
/**
 * Unsafe configuration detection
 */
exports.UnsafeConfigSchema = zod_1.z.object({
    /** Path to unsafe configuration */
    path: zod_1.z.string(),
    /** The unsafe value */
    value: zod_1.z.unknown(),
    /** Type of security concern */
    concern_type: zod_1.z.enum([
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
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Description of the risk */
    risk_description: zod_1.z.string(),
    /** CWE reference if applicable */
    cwe_reference: zod_1.z.string().optional(),
});
/**
 * Configuration conflict
 */
exports.ConfigConflictSchema = zod_1.z.object({
    /** Conflict identifier */
    conflict_id: zod_1.z.string().min(1),
    /** Type of conflict */
    conflict_type: zod_1.z.enum([
        'mutually_exclusive',
        'dependency_missing',
        'circular_reference',
        'value_incompatibility',
        'version_mismatch',
    ]),
    /** Paths involved in the conflict */
    conflicting_paths: zod_1.z.array(zod_1.z.string()).min(2),
    /** Description of the conflict */
    description: zod_1.z.string(),
    /** Severity */
    severity: zod_1.z.enum(['warning', 'error', 'critical']),
});
/**
 * Missing required configuration
 */
exports.MissingConfigSchema = zod_1.z.object({
    /** Path where value is missing */
    path: zod_1.z.string(),
    /** Expected type */
    expected_type: zod_1.z.string(),
    /** Whether this is required or recommended */
    requirement_level: zod_1.z.enum(['required', 'recommended', 'optional_but_advised']),
    /** Description of what this config does */
    description: zod_1.z.string(),
    /** Default that would be used if not specified (informational) */
    implicit_default: zod_1.z.unknown().optional(),
});
/**
 * Readiness assessment
 */
exports.ReadinessAssessmentSchema = zod_1.z.object({
    /** Overall readiness status */
    status: zod_1.z.enum(['ready', 'ready_with_warnings', 'not_ready', 'critical_issues']),
    /** Readiness score (0.0 - 1.0) */
    score: zod_1.z.number().min(0).max(1),
    /** Breakdown by category */
    category_scores: zod_1.z.record(zod_1.z.number()),
    /** Blocking issues that prevent readiness */
    blocking_issues: zod_1.z.array(zod_1.z.string()),
    /** Non-blocking warnings */
    warnings: zod_1.z.array(zod_1.z.string()),
    /** Recommendations (informational only) */
    recommendations: zod_1.z.array(zod_1.z.string()),
});
/**
 * Config Validation Agent Input Schema
 */
exports.ConfigValidationInputSchema = zod_1.z.object({
    /** The configuration to validate (JSON/YAML parsed to object) */
    config: zod_1.z.record(zod_1.z.unknown()),
    /** Configuration format */
    format: zod_1.z.enum(['json', 'yaml', 'toml', 'env', 'unknown']).default('unknown'),
    /** Optional schema to validate against */
    schema: zod_1.z.object({
        /** Schema content or reference */
        content: zod_1.z.unknown().optional(),
        /** Schema URI/ID */
        uri: zod_1.z.string().optional(),
        /** Schema format */
        format: zod_1.z.enum(['json-schema', 'zod', 'yup', 'joi', 'custom']).optional(),
    }).optional(),
    /** Configuration context */
    context: zod_1.z.object({
        /** Environment (dev, staging, prod) */
        environment: zod_1.z.string().optional(),
        /** Application name */
        application: zod_1.z.string().optional(),
        /** Version being validated */
        version: zod_1.z.string().optional(),
        /** Known deprecated keys to check */
        deprecated_keys: zod_1.z.array(zod_1.z.string()).optional(),
        /** Custom semantic constraints */
        constraints: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            description: zod_1.z.string(),
            check: zod_1.z.string(), // JSONPath or simple expression
        })).optional(),
    }).optional(),
    /** Validation options */
    options: zod_1.z.object({
        /** Check for deprecated values */
        check_deprecated: zod_1.z.boolean().default(true),
        /** Check for security issues */
        check_security: zod_1.z.boolean().default(true),
        /** Check for conflicts */
        check_conflicts: zod_1.z.boolean().default(true),
        /** Check for missing required values */
        check_missing: zod_1.z.boolean().default(true),
        /** Strict mode (treat warnings as errors) */
        strict: zod_1.z.boolean().default(false),
    }).optional(),
    /** Request ID for tracing */
    request_id: zod_1.z.string().uuid().optional(),
    /** Optional pipeline context for multi-agent orchestration */
    pipeline_context: pipeline_schemas_1.PipelineContextSchema.optional(),
});
/**
 * Config Validation Agent Output Schema
 */
exports.ConfigValidationOutputSchema = zod_1.z.object({
    /** Validation result ID */
    validation_id: zod_1.z.string().uuid(),
    /** Overall validation passed/failed */
    valid: zod_1.z.boolean(),
    /** Schema validation results */
    schema_validation: exports.SchemaValidationResultSchema,
    /** Semantic constraint results */
    semantic_constraints: zod_1.z.array(exports.SemanticConstraintSchema),
    /** All validation findings */
    findings: zod_1.z.array(exports.ValidationFindingSchema),
    /** Detected deprecated values */
    deprecated_values: zod_1.z.array(exports.DeprecatedValueSchema),
    /** Detected unsafe configurations */
    unsafe_configs: zod_1.z.array(exports.UnsafeConfigSchema),
    /** Detected conflicts */
    conflicts: zod_1.z.array(exports.ConfigConflictSchema),
    /** Missing configurations */
    missing_configs: zod_1.z.array(exports.MissingConfigSchema),
    /** Readiness assessment */
    readiness: exports.ReadinessAssessmentSchema,
    /** Summary statistics */
    summary: zod_1.z.object({
        total_findings: zod_1.z.number().int().nonnegative(),
        by_severity: zod_1.z.object({
            critical: zod_1.z.number().int().nonnegative(),
            error: zod_1.z.number().int().nonnegative(),
            warning: zod_1.z.number().int().nonnegative(),
            info: zod_1.z.number().int().nonnegative(),
        }),
        by_category: zod_1.z.record(zod_1.z.number()),
        paths_checked: zod_1.z.number().int().nonnegative(),
        constraints_checked: zod_1.z.number().int().nonnegative(),
    }),
    /** Validation metadata */
    metadata: zod_1.z.object({
        config_hash: zod_1.z.string(),
        validated_at: zod_1.z.string().datetime(),
        validation_duration_ms: zod_1.z.number(),
        schema_used: zod_1.z.string().optional(),
    }),
});
//# sourceMappingURL=config-validation-schemas.js.map