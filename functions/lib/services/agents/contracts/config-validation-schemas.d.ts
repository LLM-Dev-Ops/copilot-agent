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
export declare const ValidationSeverity: {
    readonly INFO: "info";
    readonly WARNING: "warning";
    readonly ERROR: "error";
    readonly CRITICAL: "critical";
};
export type ValidationSeverityType = typeof ValidationSeverity[keyof typeof ValidationSeverity];
/**
 * Categories of validation issues
 */
export declare const ValidationCategory: {
    readonly SCHEMA: "schema";
    readonly SEMANTIC: "semantic";
    readonly MISSING: "missing";
    readonly CONFLICT: "conflict";
    readonly DEPRECATED: "deprecated";
    readonly UNSAFE: "unsafe";
    readonly TYPE_MISMATCH: "type_mismatch";
    readonly CONSTRAINT: "constraint";
    readonly COMPATIBILITY: "compatibility";
};
export type ValidationCategoryType = typeof ValidationCategory[keyof typeof ValidationCategory];
/**
 * Single validation finding
 */
export declare const ValidationFindingSchema: z.ZodObject<{
    /** Unique finding identifier */
    finding_id: z.ZodString;
    /** Category of the issue */
    category: z.ZodEnum<["schema", "semantic", "missing", "conflict", "deprecated", "unsafe", "type_mismatch", "constraint", "compatibility"]>;
    /** Severity level */
    severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
    /** JSON path to the problematic value */
    path: z.ZodString;
    /** Human-readable description of the issue */
    message: z.ZodString;
    /** The actual value found (if applicable) */
    actual_value: z.ZodOptional<z.ZodUnknown>;
    /** Expected value or type (if applicable) */
    expected: z.ZodOptional<z.ZodString>;
    /** Related paths that contribute to this finding */
    related_paths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Documentation reference for this issue */
    doc_reference: z.ZodOptional<z.ZodString>;
    /** Tags for categorization */
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    path: string;
    message: string;
    tags: string[];
    severity: "error" | "critical" | "info" | "warning";
    category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
    finding_id: string;
    related_paths: string[];
    expected?: string | undefined;
    actual_value?: unknown;
    doc_reference?: string | undefined;
}, {
    path: string;
    message: string;
    severity: "error" | "critical" | "info" | "warning";
    category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
    finding_id: string;
    expected?: string | undefined;
    tags?: string[] | undefined;
    actual_value?: unknown;
    related_paths?: string[] | undefined;
    doc_reference?: string | undefined;
}>;
export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;
/**
 * Schema validation result
 */
export declare const SchemaValidationResultSchema: z.ZodObject<{
    /** Whether schema validation passed */
    valid: z.ZodBoolean;
    /** Schema that was validated against */
    schema_id: z.ZodOptional<z.ZodString>;
    /** Schema version */
    schema_version: z.ZodOptional<z.ZodString>;
    /** Findings from schema validation */
    findings: z.ZodArray<z.ZodObject<{
        /** Unique finding identifier */
        finding_id: z.ZodString;
        /** Category of the issue */
        category: z.ZodEnum<["schema", "semantic", "missing", "conflict", "deprecated", "unsafe", "type_mismatch", "constraint", "compatibility"]>;
        /** Severity level */
        severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
        /** JSON path to the problematic value */
        path: z.ZodString;
        /** Human-readable description of the issue */
        message: z.ZodString;
        /** The actual value found (if applicable) */
        actual_value: z.ZodOptional<z.ZodUnknown>;
        /** Expected value or type (if applicable) */
        expected: z.ZodOptional<z.ZodString>;
        /** Related paths that contribute to this finding */
        related_paths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Documentation reference for this issue */
        doc_reference: z.ZodOptional<z.ZodString>;
        /** Tags for categorization */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        message: string;
        tags: string[];
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        related_paths: string[];
        expected?: string | undefined;
        actual_value?: unknown;
        doc_reference?: string | undefined;
    }, {
        path: string;
        message: string;
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        expected?: string | undefined;
        tags?: string[] | undefined;
        actual_value?: unknown;
        related_paths?: string[] | undefined;
        doc_reference?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    valid: boolean;
    findings: {
        path: string;
        message: string;
        tags: string[];
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        related_paths: string[];
        expected?: string | undefined;
        actual_value?: unknown;
        doc_reference?: string | undefined;
    }[];
    schema_id?: string | undefined;
    schema_version?: string | undefined;
}, {
    valid: boolean;
    findings: {
        path: string;
        message: string;
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        expected?: string | undefined;
        tags?: string[] | undefined;
        actual_value?: unknown;
        related_paths?: string[] | undefined;
        doc_reference?: string | undefined;
    }[];
    schema_id?: string | undefined;
    schema_version?: string | undefined;
}>;
export type SchemaValidationResult = z.infer<typeof SchemaValidationResultSchema>;
/**
 * Semantic constraint check
 */
export declare const SemanticConstraintSchema: z.ZodObject<{
    /** Constraint identifier */
    constraint_id: z.ZodString;
    /** Human-readable constraint name */
    name: z.ZodString;
    /** Description of what this constraint checks */
    description: z.ZodString;
    /** Whether the constraint passed */
    passed: z.ZodBoolean;
    /** Paths involved in this constraint */
    paths: z.ZodArray<z.ZodString, "many">;
    /** Details if constraint failed */
    failure_detail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    constraint_id: string;
    passed: boolean;
    paths: string[];
    failure_detail?: string | undefined;
}, {
    name: string;
    description: string;
    constraint_id: string;
    passed: boolean;
    paths: string[];
    failure_detail?: string | undefined;
}>;
export type SemanticConstraint = z.infer<typeof SemanticConstraintSchema>;
/**
 * Deprecated value detection
 */
export declare const DeprecatedValueSchema: z.ZodObject<{
    /** Path to deprecated value */
    path: z.ZodString;
    /** The deprecated value */
    value: z.ZodUnknown;
    /** When it was deprecated */
    deprecated_since: z.ZodOptional<z.ZodString>;
    /** When it will be removed */
    removal_version: z.ZodOptional<z.ZodString>;
    /** Suggested replacement (informational only, NOT applied) */
    suggested_replacement: z.ZodOptional<z.ZodString>;
    /** Migration documentation */
    migration_guide: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    value?: unknown;
    deprecated_since?: string | undefined;
    removal_version?: string | undefined;
    suggested_replacement?: string | undefined;
    migration_guide?: string | undefined;
}, {
    path: string;
    value?: unknown;
    deprecated_since?: string | undefined;
    removal_version?: string | undefined;
    suggested_replacement?: string | undefined;
    migration_guide?: string | undefined;
}>;
export type DeprecatedValue = z.infer<typeof DeprecatedValueSchema>;
/**
 * Unsafe configuration detection
 */
export declare const UnsafeConfigSchema: z.ZodObject<{
    /** Path to unsafe configuration */
    path: z.ZodString;
    /** The unsafe value */
    value: z.ZodUnknown;
    /** Type of security concern */
    concern_type: z.ZodEnum<["hardcoded_secret", "weak_encryption", "insecure_protocol", "overly_permissive", "missing_authentication", "exposed_endpoint", "debug_enabled", "verbose_logging", "other"]>;
    /** Severity of the security concern */
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    /** Description of the risk */
    risk_description: z.ZodString;
    /** CWE reference if applicable */
    cwe_reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    severity: "low" | "medium" | "high" | "critical";
    concern_type: "hardcoded_secret" | "weak_encryption" | "insecure_protocol" | "overly_permissive" | "missing_authentication" | "exposed_endpoint" | "debug_enabled" | "verbose_logging" | "other";
    risk_description: string;
    value?: unknown;
    cwe_reference?: string | undefined;
}, {
    path: string;
    severity: "low" | "medium" | "high" | "critical";
    concern_type: "hardcoded_secret" | "weak_encryption" | "insecure_protocol" | "overly_permissive" | "missing_authentication" | "exposed_endpoint" | "debug_enabled" | "verbose_logging" | "other";
    risk_description: string;
    value?: unknown;
    cwe_reference?: string | undefined;
}>;
export type UnsafeConfig = z.infer<typeof UnsafeConfigSchema>;
/**
 * Configuration conflict
 */
export declare const ConfigConflictSchema: z.ZodObject<{
    /** Conflict identifier */
    conflict_id: z.ZodString;
    /** Type of conflict */
    conflict_type: z.ZodEnum<["mutually_exclusive", "dependency_missing", "circular_reference", "value_incompatibility", "version_mismatch"]>;
    /** Paths involved in the conflict */
    conflicting_paths: z.ZodArray<z.ZodString, "many">;
    /** Description of the conflict */
    description: z.ZodString;
    /** Severity */
    severity: z.ZodEnum<["warning", "error", "critical"]>;
}, "strip", z.ZodTypeAny, {
    description: string;
    severity: "error" | "critical" | "warning";
    conflict_id: string;
    conflict_type: "mutually_exclusive" | "dependency_missing" | "circular_reference" | "value_incompatibility" | "version_mismatch";
    conflicting_paths: string[];
}, {
    description: string;
    severity: "error" | "critical" | "warning";
    conflict_id: string;
    conflict_type: "mutually_exclusive" | "dependency_missing" | "circular_reference" | "value_incompatibility" | "version_mismatch";
    conflicting_paths: string[];
}>;
export type ConfigConflict = z.infer<typeof ConfigConflictSchema>;
/**
 * Missing required configuration
 */
export declare const MissingConfigSchema: z.ZodObject<{
    /** Path where value is missing */
    path: z.ZodString;
    /** Expected type */
    expected_type: z.ZodString;
    /** Whether this is required or recommended */
    requirement_level: z.ZodEnum<["required", "recommended", "optional_but_advised"]>;
    /** Description of what this config does */
    description: z.ZodString;
    /** Default that would be used if not specified (informational) */
    implicit_default: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    path: string;
    description: string;
    expected_type: string;
    requirement_level: "required" | "recommended" | "optional_but_advised";
    implicit_default?: unknown;
}, {
    path: string;
    description: string;
    expected_type: string;
    requirement_level: "required" | "recommended" | "optional_but_advised";
    implicit_default?: unknown;
}>;
export type MissingConfig = z.infer<typeof MissingConfigSchema>;
/**
 * Readiness assessment
 */
export declare const ReadinessAssessmentSchema: z.ZodObject<{
    /** Overall readiness status */
    status: z.ZodEnum<["ready", "ready_with_warnings", "not_ready", "critical_issues"]>;
    /** Readiness score (0.0 - 1.0) */
    score: z.ZodNumber;
    /** Breakdown by category */
    category_scores: z.ZodRecord<z.ZodString, z.ZodNumber>;
    /** Blocking issues that prevent readiness */
    blocking_issues: z.ZodArray<z.ZodString, "many">;
    /** Non-blocking warnings */
    warnings: z.ZodArray<z.ZodString, "many">;
    /** Recommendations (informational only) */
    recommendations: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    status: "ready" | "ready_with_warnings" | "not_ready" | "critical_issues";
    recommendations: string[];
    score: number;
    category_scores: Record<string, number>;
    blocking_issues: string[];
    warnings: string[];
}, {
    status: "ready" | "ready_with_warnings" | "not_ready" | "critical_issues";
    recommendations: string[];
    score: number;
    category_scores: Record<string, number>;
    blocking_issues: string[];
    warnings: string[];
}>;
export type ReadinessAssessment = z.infer<typeof ReadinessAssessmentSchema>;
/**
 * Config Validation Agent Input Schema
 */
export declare const ConfigValidationInputSchema: z.ZodObject<{
    /** The configuration to validate (JSON/YAML parsed to object) */
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    /** Configuration format */
    format: z.ZodDefault<z.ZodEnum<["json", "yaml", "toml", "env", "unknown"]>>;
    /** Optional schema to validate against */
    schema: z.ZodOptional<z.ZodObject<{
        /** Schema content or reference */
        content: z.ZodOptional<z.ZodUnknown>;
        /** Schema URI/ID */
        uri: z.ZodOptional<z.ZodString>;
        /** Schema format */
        format: z.ZodOptional<z.ZodEnum<["json-schema", "zod", "yup", "joi", "custom"]>>;
    }, "strip", z.ZodTypeAny, {
        format?: "custom" | "json-schema" | "zod" | "yup" | "joi" | undefined;
        content?: unknown;
        uri?: string | undefined;
    }, {
        format?: "custom" | "json-schema" | "zod" | "yup" | "joi" | undefined;
        content?: unknown;
        uri?: string | undefined;
    }>>;
    /** Configuration context */
    context: z.ZodOptional<z.ZodObject<{
        /** Environment (dev, staging, prod) */
        environment: z.ZodOptional<z.ZodString>;
        /** Application name */
        application: z.ZodOptional<z.ZodString>;
        /** Version being validated */
        version: z.ZodOptional<z.ZodString>;
        /** Known deprecated keys to check */
        deprecated_keys: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Custom semantic constraints */
        constraints: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            check: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            description: string;
            check: string;
        }, {
            name: string;
            description: string;
            check: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        version?: string | undefined;
        constraints?: {
            name: string;
            description: string;
            check: string;
        }[] | undefined;
        environment?: string | undefined;
        application?: string | undefined;
        deprecated_keys?: string[] | undefined;
    }, {
        version?: string | undefined;
        constraints?: {
            name: string;
            description: string;
            check: string;
        }[] | undefined;
        environment?: string | undefined;
        application?: string | undefined;
        deprecated_keys?: string[] | undefined;
    }>>;
    /** Validation options */
    options: z.ZodOptional<z.ZodObject<{
        /** Check for deprecated values */
        check_deprecated: z.ZodDefault<z.ZodBoolean>;
        /** Check for security issues */
        check_security: z.ZodDefault<z.ZodBoolean>;
        /** Check for conflicts */
        check_conflicts: z.ZodDefault<z.ZodBoolean>;
        /** Check for missing required values */
        check_missing: z.ZodDefault<z.ZodBoolean>;
        /** Strict mode (treat warnings as errors) */
        strict: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        strict: boolean;
        check_deprecated: boolean;
        check_security: boolean;
        check_conflicts: boolean;
        check_missing: boolean;
    }, {
        strict?: boolean | undefined;
        check_deprecated?: boolean | undefined;
        check_security?: boolean | undefined;
        check_conflicts?: boolean | undefined;
        check_missing?: boolean | undefined;
    }>>;
    /** Request ID for tracing */
    request_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    config: Record<string, unknown>;
    format: "unknown" | "json" | "yaml" | "toml" | "env";
    options?: {
        strict: boolean;
        check_deprecated: boolean;
        check_security: boolean;
        check_conflicts: boolean;
        check_missing: boolean;
    } | undefined;
    context?: {
        version?: string | undefined;
        constraints?: {
            name: string;
            description: string;
            check: string;
        }[] | undefined;
        environment?: string | undefined;
        application?: string | undefined;
        deprecated_keys?: string[] | undefined;
    } | undefined;
    request_id?: string | undefined;
    schema?: {
        format?: "custom" | "json-schema" | "zod" | "yup" | "joi" | undefined;
        content?: unknown;
        uri?: string | undefined;
    } | undefined;
}, {
    config: Record<string, unknown>;
    options?: {
        strict?: boolean | undefined;
        check_deprecated?: boolean | undefined;
        check_security?: boolean | undefined;
        check_conflicts?: boolean | undefined;
        check_missing?: boolean | undefined;
    } | undefined;
    context?: {
        version?: string | undefined;
        constraints?: {
            name: string;
            description: string;
            check: string;
        }[] | undefined;
        environment?: string | undefined;
        application?: string | undefined;
        deprecated_keys?: string[] | undefined;
    } | undefined;
    request_id?: string | undefined;
    schema?: {
        format?: "custom" | "json-schema" | "zod" | "yup" | "joi" | undefined;
        content?: unknown;
        uri?: string | undefined;
    } | undefined;
    format?: "unknown" | "json" | "yaml" | "toml" | "env" | undefined;
}>;
export type ConfigValidationInput = z.infer<typeof ConfigValidationInputSchema>;
/**
 * Config Validation Agent Output Schema
 */
export declare const ConfigValidationOutputSchema: z.ZodObject<{
    /** Validation result ID */
    validation_id: z.ZodString;
    /** Overall validation passed/failed */
    valid: z.ZodBoolean;
    /** Schema validation results */
    schema_validation: z.ZodObject<{
        /** Whether schema validation passed */
        valid: z.ZodBoolean;
        /** Schema that was validated against */
        schema_id: z.ZodOptional<z.ZodString>;
        /** Schema version */
        schema_version: z.ZodOptional<z.ZodString>;
        /** Findings from schema validation */
        findings: z.ZodArray<z.ZodObject<{
            /** Unique finding identifier */
            finding_id: z.ZodString;
            /** Category of the issue */
            category: z.ZodEnum<["schema", "semantic", "missing", "conflict", "deprecated", "unsafe", "type_mismatch", "constraint", "compatibility"]>;
            /** Severity level */
            severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
            /** JSON path to the problematic value */
            path: z.ZodString;
            /** Human-readable description of the issue */
            message: z.ZodString;
            /** The actual value found (if applicable) */
            actual_value: z.ZodOptional<z.ZodUnknown>;
            /** Expected value or type (if applicable) */
            expected: z.ZodOptional<z.ZodString>;
            /** Related paths that contribute to this finding */
            related_paths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            /** Documentation reference for this issue */
            doc_reference: z.ZodOptional<z.ZodString>;
            /** Tags for categorization */
            tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            message: string;
            tags: string[];
            severity: "error" | "critical" | "info" | "warning";
            category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
            finding_id: string;
            related_paths: string[];
            expected?: string | undefined;
            actual_value?: unknown;
            doc_reference?: string | undefined;
        }, {
            path: string;
            message: string;
            severity: "error" | "critical" | "info" | "warning";
            category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
            finding_id: string;
            expected?: string | undefined;
            tags?: string[] | undefined;
            actual_value?: unknown;
            related_paths?: string[] | undefined;
            doc_reference?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        valid: boolean;
        findings: {
            path: string;
            message: string;
            tags: string[];
            severity: "error" | "critical" | "info" | "warning";
            category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
            finding_id: string;
            related_paths: string[];
            expected?: string | undefined;
            actual_value?: unknown;
            doc_reference?: string | undefined;
        }[];
        schema_id?: string | undefined;
        schema_version?: string | undefined;
    }, {
        valid: boolean;
        findings: {
            path: string;
            message: string;
            severity: "error" | "critical" | "info" | "warning";
            category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
            finding_id: string;
            expected?: string | undefined;
            tags?: string[] | undefined;
            actual_value?: unknown;
            related_paths?: string[] | undefined;
            doc_reference?: string | undefined;
        }[];
        schema_id?: string | undefined;
        schema_version?: string | undefined;
    }>;
    /** Semantic constraint results */
    semantic_constraints: z.ZodArray<z.ZodObject<{
        /** Constraint identifier */
        constraint_id: z.ZodString;
        /** Human-readable constraint name */
        name: z.ZodString;
        /** Description of what this constraint checks */
        description: z.ZodString;
        /** Whether the constraint passed */
        passed: z.ZodBoolean;
        /** Paths involved in this constraint */
        paths: z.ZodArray<z.ZodString, "many">;
        /** Details if constraint failed */
        failure_detail: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        constraint_id: string;
        passed: boolean;
        paths: string[];
        failure_detail?: string | undefined;
    }, {
        name: string;
        description: string;
        constraint_id: string;
        passed: boolean;
        paths: string[];
        failure_detail?: string | undefined;
    }>, "many">;
    /** All validation findings */
    findings: z.ZodArray<z.ZodObject<{
        /** Unique finding identifier */
        finding_id: z.ZodString;
        /** Category of the issue */
        category: z.ZodEnum<["schema", "semantic", "missing", "conflict", "deprecated", "unsafe", "type_mismatch", "constraint", "compatibility"]>;
        /** Severity level */
        severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
        /** JSON path to the problematic value */
        path: z.ZodString;
        /** Human-readable description of the issue */
        message: z.ZodString;
        /** The actual value found (if applicable) */
        actual_value: z.ZodOptional<z.ZodUnknown>;
        /** Expected value or type (if applicable) */
        expected: z.ZodOptional<z.ZodString>;
        /** Related paths that contribute to this finding */
        related_paths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Documentation reference for this issue */
        doc_reference: z.ZodOptional<z.ZodString>;
        /** Tags for categorization */
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        message: string;
        tags: string[];
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        related_paths: string[];
        expected?: string | undefined;
        actual_value?: unknown;
        doc_reference?: string | undefined;
    }, {
        path: string;
        message: string;
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        expected?: string | undefined;
        tags?: string[] | undefined;
        actual_value?: unknown;
        related_paths?: string[] | undefined;
        doc_reference?: string | undefined;
    }>, "many">;
    /** Detected deprecated values */
    deprecated_values: z.ZodArray<z.ZodObject<{
        /** Path to deprecated value */
        path: z.ZodString;
        /** The deprecated value */
        value: z.ZodUnknown;
        /** When it was deprecated */
        deprecated_since: z.ZodOptional<z.ZodString>;
        /** When it will be removed */
        removal_version: z.ZodOptional<z.ZodString>;
        /** Suggested replacement (informational only, NOT applied) */
        suggested_replacement: z.ZodOptional<z.ZodString>;
        /** Migration documentation */
        migration_guide: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        value?: unknown;
        deprecated_since?: string | undefined;
        removal_version?: string | undefined;
        suggested_replacement?: string | undefined;
        migration_guide?: string | undefined;
    }, {
        path: string;
        value?: unknown;
        deprecated_since?: string | undefined;
        removal_version?: string | undefined;
        suggested_replacement?: string | undefined;
        migration_guide?: string | undefined;
    }>, "many">;
    /** Detected unsafe configurations */
    unsafe_configs: z.ZodArray<z.ZodObject<{
        /** Path to unsafe configuration */
        path: z.ZodString;
        /** The unsafe value */
        value: z.ZodUnknown;
        /** Type of security concern */
        concern_type: z.ZodEnum<["hardcoded_secret", "weak_encryption", "insecure_protocol", "overly_permissive", "missing_authentication", "exposed_endpoint", "debug_enabled", "verbose_logging", "other"]>;
        /** Severity of the security concern */
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        /** Description of the risk */
        risk_description: z.ZodString;
        /** CWE reference if applicable */
        cwe_reference: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        severity: "low" | "medium" | "high" | "critical";
        concern_type: "hardcoded_secret" | "weak_encryption" | "insecure_protocol" | "overly_permissive" | "missing_authentication" | "exposed_endpoint" | "debug_enabled" | "verbose_logging" | "other";
        risk_description: string;
        value?: unknown;
        cwe_reference?: string | undefined;
    }, {
        path: string;
        severity: "low" | "medium" | "high" | "critical";
        concern_type: "hardcoded_secret" | "weak_encryption" | "insecure_protocol" | "overly_permissive" | "missing_authentication" | "exposed_endpoint" | "debug_enabled" | "verbose_logging" | "other";
        risk_description: string;
        value?: unknown;
        cwe_reference?: string | undefined;
    }>, "many">;
    /** Detected conflicts */
    conflicts: z.ZodArray<z.ZodObject<{
        /** Conflict identifier */
        conflict_id: z.ZodString;
        /** Type of conflict */
        conflict_type: z.ZodEnum<["mutually_exclusive", "dependency_missing", "circular_reference", "value_incompatibility", "version_mismatch"]>;
        /** Paths involved in the conflict */
        conflicting_paths: z.ZodArray<z.ZodString, "many">;
        /** Description of the conflict */
        description: z.ZodString;
        /** Severity */
        severity: z.ZodEnum<["warning", "error", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        severity: "error" | "critical" | "warning";
        conflict_id: string;
        conflict_type: "mutually_exclusive" | "dependency_missing" | "circular_reference" | "value_incompatibility" | "version_mismatch";
        conflicting_paths: string[];
    }, {
        description: string;
        severity: "error" | "critical" | "warning";
        conflict_id: string;
        conflict_type: "mutually_exclusive" | "dependency_missing" | "circular_reference" | "value_incompatibility" | "version_mismatch";
        conflicting_paths: string[];
    }>, "many">;
    /** Missing configurations */
    missing_configs: z.ZodArray<z.ZodObject<{
        /** Path where value is missing */
        path: z.ZodString;
        /** Expected type */
        expected_type: z.ZodString;
        /** Whether this is required or recommended */
        requirement_level: z.ZodEnum<["required", "recommended", "optional_but_advised"]>;
        /** Description of what this config does */
        description: z.ZodString;
        /** Default that would be used if not specified (informational) */
        implicit_default: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        description: string;
        expected_type: string;
        requirement_level: "required" | "recommended" | "optional_but_advised";
        implicit_default?: unknown;
    }, {
        path: string;
        description: string;
        expected_type: string;
        requirement_level: "required" | "recommended" | "optional_but_advised";
        implicit_default?: unknown;
    }>, "many">;
    /** Readiness assessment */
    readiness: z.ZodObject<{
        /** Overall readiness status */
        status: z.ZodEnum<["ready", "ready_with_warnings", "not_ready", "critical_issues"]>;
        /** Readiness score (0.0 - 1.0) */
        score: z.ZodNumber;
        /** Breakdown by category */
        category_scores: z.ZodRecord<z.ZodString, z.ZodNumber>;
        /** Blocking issues that prevent readiness */
        blocking_issues: z.ZodArray<z.ZodString, "many">;
        /** Non-blocking warnings */
        warnings: z.ZodArray<z.ZodString, "many">;
        /** Recommendations (informational only) */
        recommendations: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "ready" | "ready_with_warnings" | "not_ready" | "critical_issues";
        recommendations: string[];
        score: number;
        category_scores: Record<string, number>;
        blocking_issues: string[];
        warnings: string[];
    }, {
        status: "ready" | "ready_with_warnings" | "not_ready" | "critical_issues";
        recommendations: string[];
        score: number;
        category_scores: Record<string, number>;
        blocking_issues: string[];
        warnings: string[];
    }>;
    /** Summary statistics */
    summary: z.ZodObject<{
        total_findings: z.ZodNumber;
        by_severity: z.ZodObject<{
            critical: z.ZodNumber;
            error: z.ZodNumber;
            warning: z.ZodNumber;
            info: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            error: number;
            critical: number;
            info: number;
            warning: number;
        }, {
            error: number;
            critical: number;
            info: number;
            warning: number;
        }>;
        by_category: z.ZodRecord<z.ZodString, z.ZodNumber>;
        paths_checked: z.ZodNumber;
        constraints_checked: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total_findings: number;
        by_severity: {
            error: number;
            critical: number;
            info: number;
            warning: number;
        };
        by_category: Record<string, number>;
        paths_checked: number;
        constraints_checked: number;
    }, {
        total_findings: number;
        by_severity: {
            error: number;
            critical: number;
            info: number;
            warning: number;
        };
        by_category: Record<string, number>;
        paths_checked: number;
        constraints_checked: number;
    }>;
    /** Validation metadata */
    metadata: z.ZodObject<{
        config_hash: z.ZodString;
        validated_at: z.ZodString;
        validation_duration_ms: z.ZodNumber;
        schema_used: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        config_hash: string;
        validated_at: string;
        validation_duration_ms: number;
        schema_used?: string | undefined;
    }, {
        config_hash: string;
        validated_at: string;
        validation_duration_ms: number;
        schema_used?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    valid: boolean;
    summary: {
        total_findings: number;
        by_severity: {
            error: number;
            critical: number;
            info: number;
            warning: number;
        };
        by_category: Record<string, number>;
        paths_checked: number;
        constraints_checked: number;
    };
    metadata: {
        config_hash: string;
        validated_at: string;
        validation_duration_ms: number;
        schema_used?: string | undefined;
    };
    findings: {
        path: string;
        message: string;
        tags: string[];
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        related_paths: string[];
        expected?: string | undefined;
        actual_value?: unknown;
        doc_reference?: string | undefined;
    }[];
    validation_id: string;
    schema_validation: {
        valid: boolean;
        findings: {
            path: string;
            message: string;
            tags: string[];
            severity: "error" | "critical" | "info" | "warning";
            category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
            finding_id: string;
            related_paths: string[];
            expected?: string | undefined;
            actual_value?: unknown;
            doc_reference?: string | undefined;
        }[];
        schema_id?: string | undefined;
        schema_version?: string | undefined;
    };
    semantic_constraints: {
        name: string;
        description: string;
        constraint_id: string;
        passed: boolean;
        paths: string[];
        failure_detail?: string | undefined;
    }[];
    deprecated_values: {
        path: string;
        value?: unknown;
        deprecated_since?: string | undefined;
        removal_version?: string | undefined;
        suggested_replacement?: string | undefined;
        migration_guide?: string | undefined;
    }[];
    unsafe_configs: {
        path: string;
        severity: "low" | "medium" | "high" | "critical";
        concern_type: "hardcoded_secret" | "weak_encryption" | "insecure_protocol" | "overly_permissive" | "missing_authentication" | "exposed_endpoint" | "debug_enabled" | "verbose_logging" | "other";
        risk_description: string;
        value?: unknown;
        cwe_reference?: string | undefined;
    }[];
    conflicts: {
        description: string;
        severity: "error" | "critical" | "warning";
        conflict_id: string;
        conflict_type: "mutually_exclusive" | "dependency_missing" | "circular_reference" | "value_incompatibility" | "version_mismatch";
        conflicting_paths: string[];
    }[];
    missing_configs: {
        path: string;
        description: string;
        expected_type: string;
        requirement_level: "required" | "recommended" | "optional_but_advised";
        implicit_default?: unknown;
    }[];
    readiness: {
        status: "ready" | "ready_with_warnings" | "not_ready" | "critical_issues";
        recommendations: string[];
        score: number;
        category_scores: Record<string, number>;
        blocking_issues: string[];
        warnings: string[];
    };
}, {
    valid: boolean;
    summary: {
        total_findings: number;
        by_severity: {
            error: number;
            critical: number;
            info: number;
            warning: number;
        };
        by_category: Record<string, number>;
        paths_checked: number;
        constraints_checked: number;
    };
    metadata: {
        config_hash: string;
        validated_at: string;
        validation_duration_ms: number;
        schema_used?: string | undefined;
    };
    findings: {
        path: string;
        message: string;
        severity: "error" | "critical" | "info" | "warning";
        category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
        finding_id: string;
        expected?: string | undefined;
        tags?: string[] | undefined;
        actual_value?: unknown;
        related_paths?: string[] | undefined;
        doc_reference?: string | undefined;
    }[];
    validation_id: string;
    schema_validation: {
        valid: boolean;
        findings: {
            path: string;
            message: string;
            severity: "error" | "critical" | "info" | "warning";
            category: "constraint" | "semantic" | "schema" | "missing" | "conflict" | "deprecated" | "unsafe" | "type_mismatch" | "compatibility";
            finding_id: string;
            expected?: string | undefined;
            tags?: string[] | undefined;
            actual_value?: unknown;
            related_paths?: string[] | undefined;
            doc_reference?: string | undefined;
        }[];
        schema_id?: string | undefined;
        schema_version?: string | undefined;
    };
    semantic_constraints: {
        name: string;
        description: string;
        constraint_id: string;
        passed: boolean;
        paths: string[];
        failure_detail?: string | undefined;
    }[];
    deprecated_values: {
        path: string;
        value?: unknown;
        deprecated_since?: string | undefined;
        removal_version?: string | undefined;
        suggested_replacement?: string | undefined;
        migration_guide?: string | undefined;
    }[];
    unsafe_configs: {
        path: string;
        severity: "low" | "medium" | "high" | "critical";
        concern_type: "hardcoded_secret" | "weak_encryption" | "insecure_protocol" | "overly_permissive" | "missing_authentication" | "exposed_endpoint" | "debug_enabled" | "verbose_logging" | "other";
        risk_description: string;
        value?: unknown;
        cwe_reference?: string | undefined;
    }[];
    conflicts: {
        description: string;
        severity: "error" | "critical" | "warning";
        conflict_id: string;
        conflict_type: "mutually_exclusive" | "dependency_missing" | "circular_reference" | "value_incompatibility" | "version_mismatch";
        conflicting_paths: string[];
    }[];
    missing_configs: {
        path: string;
        description: string;
        expected_type: string;
        requirement_level: "required" | "recommended" | "optional_but_advised";
        implicit_default?: unknown;
    }[];
    readiness: {
        status: "ready" | "ready_with_warnings" | "not_ready" | "critical_issues";
        recommendations: string[];
        score: number;
        category_scores: Record<string, number>;
        blocking_issues: string[];
        warnings: string[];
    };
}>;
export type ConfigValidationOutput = z.infer<typeof ConfigValidationOutputSchema>;
