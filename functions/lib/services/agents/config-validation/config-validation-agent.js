"use strict";
/**
 * Config Validation Agent
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
 * CONSTITUTION COMPLIANCE:
 * ✓ Stateless at runtime
 * ✓ Emits exactly ONE DecisionEvent per invocation
 * ✓ Persists ONLY via ruvector-service
 * ✓ NEVER connects directly to databases
 * ✓ NEVER executes SQL
 * ✓ NEVER modifies runtime behavior
 * ✓ NEVER orchestrates other agents
 * ✓ NEVER enforces policy
 * ✓ NEVER intercepts execution paths
 *
 * Must Never:
 * - Modify configuration
 * - Apply defaults
 * - Auto-fix values
 * - Enforce policy
 * - Block execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidationAgent = void 0;
const crypto_1 = require("crypto");
const uuid_1 = require("uuid");
const contracts_1 = require("../contracts");
const AGENT_ID = 'config-validation-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'config_validation';
/**
 * Config Validation Agent Implementation
 *
 * This agent analyzes configuration artifacts and produces validation reports.
 * It is purely analytical - it NEVER modifies, applies defaults, or auto-fixes.
 */
class ConfigValidationAgent {
    metadata = {
        id: AGENT_ID,
        name: 'Config Validation Agent',
        version: AGENT_VERSION,
        classifications: [
            contracts_1.AgentClassification.CONFIGURATION_VALIDATION,
            contracts_1.AgentClassification.STATIC_ANALYSIS,
        ],
        decision_type: DECISION_TYPE,
        description: 'Validates configuration artifacts for structural and semantic correctness without modification.',
    };
    persistence;
    telemetry;
    constructor(persistence, telemetry) {
        this.persistence = persistence;
        this.telemetry = telemetry;
    }
    /**
     * Validate input against ConfigValidationInputSchema
     */
    validateInput(input) {
        return contracts_1.ConfigValidationInputSchema.parse(input);
    }
    /**
     * Invoke the config validation agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    async invoke(input, executionRef) {
        const startTime = Date.now();
        try {
            // Emit telemetry start
            this.telemetry.recordStart(AGENT_ID, executionRef, input);
            // Perform validation (pure analysis, no side effects)
            const output = this.validateConfig(input, startTime);
            // Validate output
            const validatedOutput = contracts_1.ConfigValidationOutputSchema.parse(output);
            // Calculate confidence based on validation completeness
            const confidence = this.calculateConfidence(validatedOutput);
            // Constraints applied during validation
            const constraintsApplied = this.getAppliedConstraints(input);
            // Create the DecisionEvent
            const event = (0, contracts_1.createDecisionEvent)(AGENT_ID, AGENT_VERSION, DECISION_TYPE, input, validatedOutput, confidence, constraintsApplied, executionRef);
            // Persist via ruvector-service (best-effort, non-blocking)
            let persistence_status;
            try {
                await this.persistence.store(event);
                persistence_status = { status: 'persisted' };
            }
            catch (persistError) {
                const persistMessage = persistError instanceof Error ? persistError.message : 'Unknown persistence error';
                console.error(`[${AGENT_ID}] RuVector persistence failed (non-blocking): ${persistMessage}`);
                persistence_status = { status: 'skipped', error: persistMessage };
            }
            // Emit telemetry success
            this.telemetry.recordSuccess(AGENT_ID, executionRef, Date.now() - startTime);
            return {
                status: 'success',
                event,
                persistence_status,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorCode = this.classifyError(error);
            // Emit telemetry failure
            this.telemetry.recordFailure(AGENT_ID, executionRef, errorCode, errorMessage);
            return (0, contracts_1.createErrorResult)(errorCode, errorMessage, executionRef);
        }
    }
    /**
     * Perform configuration validation
     *
     * This is the core validation logic - purely analytical.
     * NEVER modifies, applies defaults, or auto-fixes anything.
     */
    validateConfig(input, startTime) {
        const validationId = (0, uuid_1.v4)();
        const options = input.options || {};
        // Collect all findings
        const findings = [];
        // Schema validation
        const schemaValidation = this.validateSchema(input, findings);
        // Semantic constraint validation
        const semanticConstraints = this.checkSemanticConstraints(input, findings);
        // Check for deprecated values
        const deprecatedValues = options.check_deprecated !== false
            ? this.detectDeprecatedValues(input, findings)
            : [];
        // Check for unsafe configurations
        const unsafeConfigs = options.check_security !== false
            ? this.detectUnsafeConfigs(input, findings)
            : [];
        // Check for conflicts
        const conflicts = options.check_conflicts !== false
            ? this.detectConflicts(input, findings)
            : [];
        // Check for missing required values
        const missingConfigs = options.check_missing !== false
            ? this.detectMissingConfigs(input, findings)
            : [];
        // Assess readiness
        const readiness = this.assessReadiness(findings, input);
        // Calculate summary
        const summary = this.calculateSummary(findings, input);
        // Determine overall validity
        const valid = this.determineValidity(findings, options.strict || false);
        return {
            validation_id: validationId,
            valid,
            schema_validation: schemaValidation,
            semantic_constraints: semanticConstraints,
            findings,
            deprecated_values: deprecatedValues,
            unsafe_configs: unsafeConfigs,
            conflicts,
            missing_configs: missingConfigs,
            readiness,
            summary,
            metadata: {
                config_hash: this.hashConfig(input.config),
                validated_at: new Date().toISOString(),
                validation_duration_ms: Date.now() - startTime,
                schema_used: input.schema?.uri,
            },
        };
    }
    /**
     * Validate against schema if provided
     */
    validateSchema(input, findings) {
        const result = {
            valid: true,
            findings: [],
        };
        if (!input.schema) {
            // No schema provided - cannot validate schema compliance
            findings.push({
                finding_id: `schema-001`,
                category: 'schema',
                severity: 'info',
                path: '$',
                message: 'No schema provided for validation',
                tags: ['schema', 'skipped'],
            });
            return result;
        }
        result.schema_id = input.schema.uri;
        result.schema_version = input.schema.format;
        // Basic type validation based on schema
        if (input.schema.content && typeof input.schema.content === 'object') {
            const schemaContent = input.schema.content;
            this.validateAgainstSchema(input.config, schemaContent, '$', result.findings);
        }
        result.valid = !result.findings.some(f => f.severity === 'error' || f.severity === 'critical');
        findings.push(...result.findings);
        return result;
    }
    /**
     * Recursive schema validation
     */
    validateAgainstSchema(config, schema, path, findings) {
        const properties = schema.properties;
        const required = schema.required;
        // Check required properties
        if (required) {
            for (const requiredProp of required) {
                if (!(requiredProp in config)) {
                    findings.push({
                        finding_id: `schema-req-${path}-${requiredProp}`,
                        category: 'schema',
                        severity: 'error',
                        path: `${path}.${requiredProp}`,
                        message: `Required property '${requiredProp}' is missing`,
                        expected: 'property to exist',
                        tags: ['schema', 'required'],
                    });
                }
            }
        }
        // Check property types
        if (properties) {
            for (const [propName, propSchema] of Object.entries(properties)) {
                const value = config[propName];
                if (value !== undefined && propSchema.type) {
                    const actualType = Array.isArray(value) ? 'array' : typeof value;
                    if (actualType !== propSchema.type && propSchema.type !== 'any') {
                        findings.push({
                            finding_id: `schema-type-${path}-${propName}`,
                            category: 'type_mismatch',
                            severity: 'error',
                            path: `${path}.${propName}`,
                            message: `Type mismatch: expected '${propSchema.type}', got '${actualType}'`,
                            actual_value: value,
                            expected: propSchema.type,
                            tags: ['schema', 'type'],
                        });
                    }
                }
            }
        }
    }
    /**
     * Check semantic constraints
     */
    checkSemanticConstraints(input, findings) {
        const constraints = [];
        // Built-in semantic checks
        constraints.push(this.checkPortRanges(input.config, findings));
        constraints.push(this.checkUrlFormats(input.config, findings));
        constraints.push(this.checkTimeoutValues(input.config, findings));
        constraints.push(this.checkMemoryValues(input.config, findings));
        // Custom constraints from input
        if (input.context?.constraints) {
            for (const customConstraint of input.context.constraints) {
                constraints.push(this.evaluateCustomConstraint(customConstraint, input.config, findings));
            }
        }
        return constraints.filter(c => c !== null);
    }
    /**
     * Check port ranges are valid
     */
    checkPortRanges(config, findings) {
        const paths = [];
        let passed = true;
        const checkValue = (obj, path) => {
            if (typeof obj !== 'object' || obj === null)
                return;
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = `${path}.${key}`;
                if (key.toLowerCase().includes('port')) {
                    paths.push(currentPath);
                    if (typeof value === 'number' && (value < 0 || value > 65535)) {
                        passed = false;
                        findings.push({
                            finding_id: `semantic-port-${currentPath}`,
                            category: 'semantic',
                            severity: 'error',
                            path: currentPath,
                            message: `Port value ${value} is out of valid range (0-65535)`,
                            actual_value: value,
                            expected: '0-65535',
                            tags: ['semantic', 'port'],
                        });
                    }
                }
                if (typeof value === 'object') {
                    checkValue(value, currentPath);
                }
            }
        };
        checkValue(config, '$');
        return {
            constraint_id: 'port-range-valid',
            name: 'Valid Port Ranges',
            description: 'All port values must be between 0 and 65535',
            passed,
            paths,
        };
    }
    /**
     * Check URL formats are valid
     */
    checkUrlFormats(config, findings) {
        const paths = [];
        let passed = true;
        const urlPattern = /^(https?|wss?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
        const checkValue = (obj, path) => {
            if (typeof obj !== 'object' || obj === null)
                return;
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = `${path}.${key}`;
                if (key.toLowerCase().includes('url') || key.toLowerCase().includes('endpoint')) {
                    paths.push(currentPath);
                    if (typeof value === 'string' && value.length > 0 && !urlPattern.test(value)) {
                        passed = false;
                        findings.push({
                            finding_id: `semantic-url-${currentPath}`,
                            category: 'semantic',
                            severity: 'warning',
                            path: currentPath,
                            message: `Value '${value}' does not appear to be a valid URL`,
                            actual_value: value,
                            expected: 'valid URL format',
                            tags: ['semantic', 'url'],
                        });
                    }
                }
                if (typeof value === 'object') {
                    checkValue(value, currentPath);
                }
            }
        };
        checkValue(config, '$');
        return {
            constraint_id: 'url-format-valid',
            name: 'Valid URL Formats',
            description: 'URL values should be properly formatted',
            passed,
            paths,
        };
    }
    /**
     * Check timeout values are reasonable
     */
    checkTimeoutValues(config, findings) {
        const paths = [];
        let passed = true;
        const checkValue = (obj, path) => {
            if (typeof obj !== 'object' || obj === null)
                return;
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = `${path}.${key}`;
                if (key.toLowerCase().includes('timeout')) {
                    paths.push(currentPath);
                    if (typeof value === 'number') {
                        if (value < 0) {
                            passed = false;
                            findings.push({
                                finding_id: `semantic-timeout-neg-${currentPath}`,
                                category: 'semantic',
                                severity: 'error',
                                path: currentPath,
                                message: `Timeout value ${value} is negative`,
                                actual_value: value,
                                expected: 'positive number',
                                tags: ['semantic', 'timeout'],
                            });
                        }
                        else if (value > 3600000) { // More than 1 hour in ms
                            findings.push({
                                finding_id: `semantic-timeout-high-${currentPath}`,
                                category: 'semantic',
                                severity: 'warning',
                                path: currentPath,
                                message: `Timeout value ${value}ms is unusually high (>1 hour)`,
                                actual_value: value,
                                tags: ['semantic', 'timeout', 'suspicious'],
                            });
                        }
                    }
                }
                if (typeof value === 'object') {
                    checkValue(value, currentPath);
                }
            }
        };
        checkValue(config, '$');
        return {
            constraint_id: 'timeout-values-valid',
            name: 'Valid Timeout Values',
            description: 'Timeout values should be positive and reasonable',
            passed,
            paths,
        };
    }
    /**
     * Check memory values are reasonable
     */
    checkMemoryValues(config, findings) {
        const paths = [];
        let passed = true;
        const checkValue = (obj, path) => {
            if (typeof obj !== 'object' || obj === null)
                return;
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = `${path}.${key}`;
                if (key.toLowerCase().includes('memory') || key.toLowerCase().includes('heap')) {
                    paths.push(currentPath);
                    if (typeof value === 'number' && value < 0) {
                        passed = false;
                        findings.push({
                            finding_id: `semantic-memory-${currentPath}`,
                            category: 'semantic',
                            severity: 'error',
                            path: currentPath,
                            message: `Memory value ${value} is negative`,
                            actual_value: value,
                            expected: 'positive number',
                            tags: ['semantic', 'memory'],
                        });
                    }
                }
                if (typeof value === 'object') {
                    checkValue(value, currentPath);
                }
            }
        };
        checkValue(config, '$');
        return {
            constraint_id: 'memory-values-valid',
            name: 'Valid Memory Values',
            description: 'Memory values should be positive',
            passed,
            paths,
        };
    }
    /**
     * Evaluate a custom constraint
     */
    evaluateCustomConstraint(constraint, config, findings) {
        // Simple path-based check (e.g., "$.database.host exists")
        const match = constraint.check.match(/^\$\.([a-zA-Z0-9_.]+)\s+(exists|equals|contains)\s*(.*)$/);
        if (!match) {
            return {
                constraint_id: `custom-${constraint.name.replace(/\s+/g, '-').toLowerCase()}`,
                name: constraint.name,
                description: constraint.description,
                passed: true, // Cannot evaluate, assume passed
                paths: [],
                failure_detail: 'Could not parse constraint expression',
            };
        }
        const [, pathStr, operator, expectedValue] = match;
        const path = pathStr.split('.');
        let value = config;
        for (const segment of path) {
            if (typeof value === 'object' && value !== null && segment in value) {
                value = value[segment];
            }
            else {
                value = undefined;
                break;
            }
        }
        let passed = false;
        const fullPath = `$.${pathStr}`;
        switch (operator) {
            case 'exists':
                passed = value !== undefined;
                break;
            case 'equals':
                passed = String(value) === expectedValue.trim();
                break;
            case 'contains':
                passed = typeof value === 'string' && value.includes(expectedValue.trim());
                break;
        }
        if (!passed) {
            findings.push({
                finding_id: `custom-${constraint.name.replace(/\s+/g, '-').toLowerCase()}`,
                category: 'constraint',
                severity: 'warning',
                path: fullPath,
                message: `Custom constraint '${constraint.name}' failed: ${constraint.description}`,
                actual_value: value,
                expected: constraint.check,
                tags: ['custom', 'constraint'],
            });
        }
        return {
            constraint_id: `custom-${constraint.name.replace(/\s+/g, '-').toLowerCase()}`,
            name: constraint.name,
            description: constraint.description,
            passed,
            paths: [fullPath],
            failure_detail: passed ? undefined : `Expected: ${constraint.check}`,
        };
    }
    /**
     * Detect deprecated values
     */
    detectDeprecatedValues(input, findings) {
        const deprecated = [];
        const deprecatedKeys = input.context?.deprecated_keys || [];
        // Common deprecated patterns
        const commonDeprecated = [
            { key: 'ssl', replacement: 'tls', since: '2.0.0' },
            { key: 'callback', replacement: 'async/await', since: '3.0.0' },
            { key: 'masterKey', replacement: 'primaryKey', since: '2.5.0' },
            { key: 'whitelist', replacement: 'allowlist', since: '3.0.0' },
            { key: 'blacklist', replacement: 'blocklist', since: '3.0.0' },
        ];
        const checkValue = (obj, path) => {
            if (typeof obj !== 'object' || obj === null)
                return;
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = `${path}.${key}`;
                const keyLower = key.toLowerCase();
                // Check against user-specified deprecated keys
                if (deprecatedKeys.includes(key)) {
                    deprecated.push({
                        path: currentPath,
                        value,
                    });
                    findings.push({
                        finding_id: `deprecated-user-${currentPath}`,
                        category: 'deprecated',
                        severity: 'warning',
                        path: currentPath,
                        message: `Key '${key}' is marked as deprecated`,
                        actual_value: value,
                        tags: ['deprecated', 'user-defined'],
                    });
                }
                // Check against common deprecated patterns
                for (const dep of commonDeprecated) {
                    if (keyLower.includes(dep.key)) {
                        deprecated.push({
                            path: currentPath,
                            value,
                            deprecated_since: dep.since,
                            suggested_replacement: dep.replacement,
                        });
                        findings.push({
                            finding_id: `deprecated-common-${currentPath}`,
                            category: 'deprecated',
                            severity: 'info',
                            path: currentPath,
                            message: `Key '${key}' may use deprecated terminology. Consider using '${dep.replacement}' instead.`,
                            actual_value: value,
                            tags: ['deprecated', 'common-pattern'],
                        });
                    }
                }
                if (typeof value === 'object') {
                    checkValue(value, currentPath);
                }
            }
        };
        checkValue(input.config, '$');
        return deprecated;
    }
    /**
     * Detect unsafe configurations
     */
    detectUnsafeConfigs(input, findings) {
        const unsafe = [];
        const checkValue = (obj, path) => {
            if (typeof obj !== 'object' || obj === null)
                return;
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = `${path}.${key}`;
                const keyLower = key.toLowerCase();
                // Check for hardcoded secrets
                if (this.looksLikeSecret(keyLower, value)) {
                    unsafe.push({
                        path: currentPath,
                        value: '[REDACTED]',
                        concern_type: 'hardcoded_secret',
                        severity: 'critical',
                        risk_description: 'Potential hardcoded secret detected in configuration',
                        cwe_reference: 'CWE-798',
                    });
                    findings.push({
                        finding_id: `unsafe-secret-${currentPath}`,
                        category: 'unsafe',
                        severity: 'critical',
                        path: currentPath,
                        message: 'Potential hardcoded secret detected',
                        actual_value: '[REDACTED]',
                        doc_reference: 'https://cwe.mitre.org/data/definitions/798.html',
                        tags: ['security', 'secret', 'hardcoded'],
                    });
                }
                // Check for debug mode in production
                if (keyLower.includes('debug') && value === true && input.context?.environment === 'prod') {
                    unsafe.push({
                        path: currentPath,
                        value,
                        concern_type: 'debug_enabled',
                        severity: 'high',
                        risk_description: 'Debug mode enabled in production environment',
                    });
                    findings.push({
                        finding_id: `unsafe-debug-${currentPath}`,
                        category: 'unsafe',
                        severity: 'error',
                        path: currentPath,
                        message: 'Debug mode enabled in production environment',
                        actual_value: value,
                        tags: ['security', 'debug', 'production'],
                    });
                }
                // Check for insecure protocols
                if (typeof value === 'string' && value.startsWith('http://') && !value.includes('localhost')) {
                    unsafe.push({
                        path: currentPath,
                        value,
                        concern_type: 'insecure_protocol',
                        severity: 'medium',
                        risk_description: 'Insecure HTTP protocol used instead of HTTPS',
                    });
                    findings.push({
                        finding_id: `unsafe-http-${currentPath}`,
                        category: 'unsafe',
                        severity: 'warning',
                        path: currentPath,
                        message: 'Insecure HTTP protocol used',
                        actual_value: value,
                        tags: ['security', 'protocol', 'http'],
                    });
                }
                // Check for overly permissive settings
                if (keyLower.includes('cors') && (value === '*' || value === true)) {
                    unsafe.push({
                        path: currentPath,
                        value,
                        concern_type: 'overly_permissive',
                        severity: 'medium',
                        risk_description: 'CORS configuration is overly permissive',
                    });
                    findings.push({
                        finding_id: `unsafe-cors-${currentPath}`,
                        category: 'unsafe',
                        severity: 'warning',
                        path: currentPath,
                        message: 'CORS configuration is overly permissive',
                        actual_value: value,
                        tags: ['security', 'cors', 'permissive'],
                    });
                }
                if (typeof value === 'object') {
                    checkValue(value, currentPath);
                }
            }
        };
        checkValue(input.config, '$');
        return unsafe;
    }
    /**
     * Check if a key/value pair looks like a secret
     */
    looksLikeSecret(key, value) {
        const secretPatterns = ['password', 'secret', 'apikey', 'api_key', 'token', 'credential', 'private'];
        if (!secretPatterns.some(p => key.includes(p))) {
            return false;
        }
        if (typeof value !== 'string') {
            return false;
        }
        // Skip environment variable references
        if (value.startsWith('${') || value.startsWith('$') || value.includes('env.')) {
            return false;
        }
        // Skip placeholders
        if (value.includes('<') || value.includes('>') || value === '' || value === 'null') {
            return false;
        }
        // If it looks like an actual value, flag it
        return value.length > 5;
    }
    /**
     * Detect configuration conflicts
     */
    detectConflicts(input, findings) {
        const conflicts = [];
        // Check for mutually exclusive settings
        const mutuallyExclusive = [
            ['$.ssl.enabled', '$.tls.enabled'],
            ['$.database.replica', '$.database.single'],
            ['$.cache.redis', '$.cache.memcached'],
        ];
        for (const [path1, path2] of mutuallyExclusive) {
            const value1 = this.getValueAtPath(input.config, path1);
            const value2 = this.getValueAtPath(input.config, path2);
            if (value1 === true && value2 === true) {
                conflicts.push({
                    conflict_id: `mutual-${path1}-${path2}`,
                    conflict_type: 'mutually_exclusive',
                    conflicting_paths: [path1, path2],
                    description: `${path1} and ${path2} are mutually exclusive but both enabled`,
                    severity: 'error',
                });
                findings.push({
                    finding_id: `conflict-mutual-${path1}`,
                    category: 'conflict',
                    severity: 'error',
                    path: path1,
                    message: `Mutually exclusive with ${path2}`,
                    related_paths: [path2],
                    tags: ['conflict', 'mutually-exclusive'],
                });
            }
        }
        return conflicts;
    }
    /**
     * Detect missing required configurations
     */
    detectMissingConfigs(input, findings) {
        const missing = [];
        // Common required configurations
        const commonRequired = [
            { path: '$.database.host', type: 'string', level: 'required', desc: 'Database host address' },
            { path: '$.server.port', type: 'number', level: 'recommended', desc: 'Server port number' },
        ];
        for (const req of commonRequired) {
            const value = this.getValueAtPath(input.config, req.path);
            if (value === undefined) {
                missing.push({
                    path: req.path,
                    expected_type: req.type,
                    requirement_level: req.level,
                    description: req.desc,
                });
                findings.push({
                    finding_id: `missing-${req.path}`,
                    category: 'missing',
                    severity: req.level === 'required' ? 'error' : 'warning',
                    path: req.path,
                    message: `${req.level === 'required' ? 'Required' : 'Recommended'} configuration missing: ${req.desc}`,
                    expected: req.type,
                    tags: ['missing', req.level],
                });
            }
        }
        return missing;
    }
    /**
     * Get value at a JSONPath-like path
     */
    getValueAtPath(obj, path) {
        const segments = path.replace('$.', '').split('.');
        let value = obj;
        for (const segment of segments) {
            if (typeof value === 'object' && value !== null && segment in value) {
                value = value[segment];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    /**
     * Assess overall readiness
     */
    assessReadiness(findings, input) {
        const critical = findings.filter(f => f.severity === 'critical').length;
        const errors = findings.filter(f => f.severity === 'error').length;
        const warnings = findings.filter(f => f.severity === 'warning').length;
        let status;
        let score;
        if (critical > 0) {
            status = 'critical_issues';
            score = 0.1;
        }
        else if (errors > 0) {
            status = 'not_ready';
            score = 0.3;
        }
        else if (warnings > 0) {
            status = 'ready_with_warnings';
            score = 0.7;
        }
        else {
            status = 'ready';
            score = 1.0;
        }
        // Calculate category scores
        const categoryScores = {};
        const categories = ['schema', 'semantic', 'security', 'compatibility'];
        for (const category of categories) {
            const categoryFindings = findings.filter(f => f.category === category || f.tags.includes(category));
            const categoryErrors = categoryFindings.filter(f => f.severity === 'error' || f.severity === 'critical').length;
            categoryScores[category] = categoryErrors === 0 ? 1.0 : Math.max(0, 1 - (categoryErrors * 0.2));
        }
        return {
            status,
            score,
            category_scores: categoryScores,
            blocking_issues: findings
                .filter(f => f.severity === 'critical' || f.severity === 'error')
                .map(f => f.message),
            warnings: findings
                .filter(f => f.severity === 'warning')
                .map(f => f.message),
            recommendations: this.generateRecommendations(findings),
        };
    }
    /**
     * Generate recommendations (informational only)
     */
    generateRecommendations(findings) {
        const recommendations = [];
        if (findings.some(f => f.category === 'deprecated')) {
            recommendations.push('Review and update deprecated configuration keys');
        }
        if (findings.some(f => f.category === 'unsafe')) {
            recommendations.push('Review security-related findings before deployment');
        }
        if (findings.some(f => f.category === 'missing')) {
            recommendations.push('Consider providing values for missing recommended configurations');
        }
        return recommendations;
    }
    /**
     * Calculate summary statistics
     */
    calculateSummary(findings, input) {
        const byCategory = {};
        for (const finding of findings) {
            byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
        }
        return {
            total_findings: findings.length,
            by_severity: {
                critical: findings.filter(f => f.severity === 'critical').length,
                error: findings.filter(f => f.severity === 'error').length,
                warning: findings.filter(f => f.severity === 'warning').length,
                info: findings.filter(f => f.severity === 'info').length,
            },
            by_category: byCategory,
            paths_checked: this.countPaths(input.config),
            constraints_checked: 4 + (input.context?.constraints?.length || 0),
        };
    }
    /**
     * Count total paths in config
     */
    countPaths(obj, count = 0) {
        if (typeof obj !== 'object' || obj === null)
            return count;
        for (const value of Object.values(obj)) {
            count++;
            if (typeof value === 'object' && value !== null) {
                count = this.countPaths(value, count);
            }
        }
        return count;
    }
    /**
     * Determine overall validity
     */
    determineValidity(findings, strict) {
        if (strict) {
            return !findings.some(f => f.severity !== 'info');
        }
        return !findings.some(f => f.severity === 'critical' || f.severity === 'error');
    }
    /**
     * Hash configuration for tracking
     */
    hashConfig(config) {
        const normalized = JSON.stringify(config, Object.keys(config).sort());
        return (0, crypto_1.createHash)('sha256').update(normalized).digest('hex').substring(0, 16);
    }
    /**
     * Calculate confidence based on validation completeness
     */
    calculateConfidence(output) {
        let confidence = 0.8; // Base confidence
        // Boost if schema was validated
        if (output.schema_validation.schema_id) {
            confidence += 0.1;
        }
        // Reduce for many findings
        if (output.summary.total_findings > 10) {
            confidence -= 0.1;
        }
        // Reduce for critical issues
        if (output.summary.by_severity.critical > 0) {
            confidence -= 0.2;
        }
        return Math.min(1.0, Math.max(0.0, confidence));
    }
    /**
     * Get constraints applied during validation
     */
    getAppliedConstraints(input) {
        const constraints = [
            'read_only_analysis',
            'no_modification',
            'no_defaults_applied',
            'no_auto_fix',
            'no_policy_enforcement',
            'no_execution_blocking',
        ];
        if (input.options?.strict) {
            constraints.push('strict_mode');
        }
        return constraints;
    }
    /**
     * Classify error for proper error code
     */
    classifyError(error) {
        if (error instanceof Error) {
            if (error.name === 'ZodError') {
                return contracts_1.AgentErrorCodes.VALIDATION_FAILED;
            }
            if (error.message.includes('persistence') || error.message.includes('ruvector')) {
                return contracts_1.AgentErrorCodes.PERSISTENCE_ERROR;
            }
        }
        return contracts_1.AgentErrorCodes.PROCESSING_ERROR;
    }
}
exports.ConfigValidationAgent = ConfigValidationAgent;
//# sourceMappingURL=config-validation-agent.js.map