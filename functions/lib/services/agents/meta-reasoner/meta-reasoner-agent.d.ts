/**
 * Meta-Reasoner Agent
 *
 * Purpose: Evaluate reasoning quality and consistency across agents
 * Classification: META_ANALYSIS, REASONING_QUALITY_ASSESSMENT
 * decision_type: meta_reasoning_analysis
 *
 * Scope:
 * - Detect contradictions
 * - Assess confidence calibration
 * - Identify systemic reasoning issues
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
 * - Override outputs
 * - Enforce corrections
 * - Execute logic
 */
import { BaseAgent, AgentMetadata, AgentResult, MetaReasonerInput, MetaReasonerOutput } from '../contracts';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
/**
 * Meta-Reasoner Agent Implementation
 *
 * This agent analyzes reasoning traces from other agents to detect
 * contradictions, assess confidence calibration, and identify systemic issues.
 * It is purely analytical - it NEVER overrides outputs or enforces corrections.
 */
export declare class MetaReasonerAgent implements BaseAgent<MetaReasonerInput, MetaReasonerOutput> {
    readonly metadata: AgentMetadata;
    private readonly persistence;
    private readonly telemetry;
    constructor(persistence: RuvectorPersistence, telemetry: Telemetry);
    /**
     * Validate input against MetaReasonerInputSchema
     */
    validateInput(input: unknown): MetaReasonerInput;
    /**
     * Invoke the meta-reasoner agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    invoke(input: MetaReasonerInput, executionRef: string): Promise<AgentResult>;
    /**
     * Perform meta-reasoning analysis on the provided traces
     *
     * This is the core analysis logic - purely analytical.
     * NEVER overrides outputs or enforces corrections.
     */
    private analyzeReasoning;
    /**
     * Detect contradictions between reasoning traces
     */
    private detectContradictions;
    /**
     * Find conflicting constraints between two sets
     */
    private findConflictingConstraints;
    /**
     * Assess confidence calibration for each agent
     */
    private assessConfidenceCalibration;
    /**
     * Calculate variance of an array of numbers
     */
    private calculateVariance;
    /**
     * Identify systemic reasoning issues across traces
     */
    private identifySystemicIssues;
    /**
     * Calculate overall reasoning quality metrics
     */
    private calculateQualityMetrics;
    /**
     * Generate prioritized key findings
     */
    private generateKeyFindings;
    /**
     * Generate summary of the analysis
     */
    private generateSummary;
    /**
     * Extract assumptions made during analysis
     */
    private extractAssumptions;
    /**
     * Calculate confidence score based on analysis quality
     */
    private calculateConfidence;
    /**
     * Get constraints applied during analysis
     */
    private getAppliedConstraints;
    /**
     * Classify error for proper error code
     */
    private classifyError;
}
