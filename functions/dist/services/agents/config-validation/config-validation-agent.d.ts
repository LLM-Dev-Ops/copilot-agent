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
import { BaseAgent, AgentMetadata, AgentResult, ConfigValidationInput, ConfigValidationOutput } from '../contracts';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
/**
 * Config Validation Agent Implementation
 *
 * This agent analyzes configuration artifacts and produces validation reports.
 * It is purely analytical - it NEVER modifies, applies defaults, or auto-fixes.
 */
export declare class ConfigValidationAgent implements BaseAgent<ConfigValidationInput, ConfigValidationOutput> {
    readonly metadata: AgentMetadata;
    private readonly persistence;
    private readonly telemetry;
    constructor(persistence: RuvectorPersistence, telemetry: Telemetry);
    /**
     * Validate input against ConfigValidationInputSchema
     */
    validateInput(input: unknown): ConfigValidationInput;
    /**
     * Invoke the config validation agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    invoke(input: ConfigValidationInput, executionRef: string): Promise<AgentResult>;
    /**
     * Perform configuration validation
     *
     * This is the core validation logic - purely analytical.
     * NEVER modifies, applies defaults, or auto-fixes anything.
     */
    private validateConfig;
    /**
     * Validate against schema if provided
     */
    private validateSchema;
    /**
     * Recursive schema validation
     */
    private validateAgainstSchema;
    /**
     * Check semantic constraints
     */
    private checkSemanticConstraints;
    /**
     * Check port ranges are valid
     */
    private checkPortRanges;
    /**
     * Check URL formats are valid
     */
    private checkUrlFormats;
    /**
     * Check timeout values are reasonable
     */
    private checkTimeoutValues;
    /**
     * Check memory values are reasonable
     */
    private checkMemoryValues;
    /**
     * Evaluate a custom constraint
     */
    private evaluateCustomConstraint;
    /**
     * Detect deprecated values
     */
    private detectDeprecatedValues;
    /**
     * Detect unsafe configurations
     */
    private detectUnsafeConfigs;
    /**
     * Check if a key/value pair looks like a secret
     */
    private looksLikeSecret;
    /**
     * Detect configuration conflicts
     */
    private detectConflicts;
    /**
     * Detect missing required configurations
     */
    private detectMissingConfigs;
    /**
     * Get value at a JSONPath-like path
     */
    private getValueAtPath;
    /**
     * Assess overall readiness
     */
    private assessReadiness;
    /**
     * Generate recommendations (informational only)
     */
    private generateRecommendations;
    /**
     * Calculate summary statistics
     */
    private calculateSummary;
    /**
     * Count total paths in config
     */
    private countPaths;
    /**
     * Determine overall validity
     */
    private determineValidity;
    /**
     * Hash configuration for tracking
     */
    private hashConfig;
    /**
     * Calculate confidence based on validation completeness
     */
    private calculateConfidence;
    /**
     * Get constraints applied during validation
     */
    private getAppliedConstraints;
    /**
     * Classify error for proper error code
     */
    private classifyError;
}
