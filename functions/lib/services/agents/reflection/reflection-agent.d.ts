/**
 * Reflection Agent
 *
 * Purpose: Analyze DecisionEvents to extract learning and quality signals
 * Classification: POST_EXECUTION_ANALYSIS, QUALITY_ASSESSMENT
 * decision_type: reflection_analysis
 *
 * Scope:
 * - Evaluate outcomes
 * - Identify gaps and inefficiencies
 * - Produce improvement insights
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
 * - Modify behavior
 * - Trigger retries
 * - Apply optimizations
 */
import { BaseAgent, AgentMetadata, AgentResult, ReflectionInput, ReflectionOutput } from '../contracts';
import { RuvectorPersistence } from './ruvector-persistence';
import { Telemetry } from './telemetry';
/**
 * Reflection Agent Implementation
 *
 * This agent analyzes DecisionEvents and produces quality/learning signals.
 * It is purely analytical - it NEVER modifies behavior, triggers retries, or applies optimizations.
 */
export declare class ReflectionAgent implements BaseAgent<ReflectionInput, ReflectionOutput> {
    readonly metadata: AgentMetadata;
    private readonly persistence;
    private readonly telemetry;
    constructor(persistence: RuvectorPersistence, telemetry: Telemetry);
    /**
     * Validate input against ReflectionInputSchema
     */
    validateInput(input: unknown): ReflectionInput;
    /**
     * Invoke the reflection agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    invoke(input: ReflectionInput, executionRef: string): Promise<AgentResult>;
    /**
     * Analyze DecisionEvents and produce reflection output
     *
     * This is the core reflection logic - purely analytical.
     * NEVER modifies behavior, triggers retries, or applies optimizations.
     */
    private analyzeDecisionEvents;
    /**
     * Evaluate outcomes for each decision event
     */
    private evaluateOutcomes;
    /**
     * Assess quality dimensions for a decision event
     */
    private assessDimensions;
    /**
     * Assess quality of event outputs
     */
    private assessOutputQuality;
    /**
     * Generate outcome summary
     */
    private generateOutcomeSummary;
    /**
     * Generate deviation notes
     */
    private generateDeviationNotes;
    /**
     * Extract quality signals from events
     */
    private extractQualitySignals;
    /**
     * Extract learning signals from events
     */
    private extractLearningSignals;
    /**
     * Analyze constraint usage patterns
     */
    private analyzeConstraintPatterns;
    /**
     * Detect outlier events
     */
    private detectOutliers;
    /**
     * Identify gaps in the analyzed events
     */
    private identifyGaps;
    /**
     * Find correlations between events
     */
    private findCorrelations;
    /**
     * Generate summary statistics
     */
    private generateSummary;
    /**
     * Calculate confidence score for reflection analysis
     */
    private calculateConfidence;
    /**
     * Get constraints applied during reflection
     */
    private getAppliedConstraints;
    /**
     * Classify error for proper error code
     */
    private classifyError;
}
