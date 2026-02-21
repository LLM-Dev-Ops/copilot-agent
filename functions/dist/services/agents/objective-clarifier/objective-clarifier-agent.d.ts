/**
 * Objective Clarifier Agent
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
 * - Generate plans
 * - Define solutions
 * - Execute logic
 */
import { BaseAgent, AgentMetadata, AgentResult } from '../contracts';
import { ObjectiveClarifierInput, ObjectiveClarifierOutput } from '../contracts/objective-clarifier-schemas';
import { RuvectorPersistence } from './ruvector-persistence';
import { Telemetry } from './telemetry';
/**
 * Objective Clarifier Agent Implementation
 *
 * This agent analyzes objectives and identifies ambiguities, missing constraints,
 * and normalizes goals. It is purely analytical - it NEVER generates plans,
 * defines solutions, or executes any logic.
 */
export declare class ObjectiveClarifierAgent implements BaseAgent<ObjectiveClarifierInput, ObjectiveClarifierOutput> {
    readonly metadata: AgentMetadata;
    private readonly persistence;
    private readonly telemetry;
    constructor(persistence: RuvectorPersistence, telemetry: Telemetry);
    /**
     * Validate input against ObjectiveClarifierInputSchema
     */
    validateInput(input: unknown): ObjectiveClarifierInput;
    /**
     * Invoke the objective clarifier agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    invoke(input: ObjectiveClarifierInput, executionRef: string): Promise<AgentResult>;
    /**
     * Clarify the objective - Core analysis logic
     *
     * This is purely analytical. It NEVER:
     * - Generates plans
     * - Defines solutions
     * - Executes logic
     */
    private clarifyObjective;
    /**
     * Detect ambiguities in the objective
     */
    private detectAmbiguities;
    /**
     * Identify missing constraints
     */
    private identifyMissingConstraints;
    /**
     * Normalize goals from the objective
     */
    private normalizeGoals;
    /**
     * Split objective into individual statements
     */
    private splitIntoStatements;
    /**
     * Analyze a statement to extract components
     */
    private analyzeStatement;
    /**
     * Classify goal type
     */
    private classifyGoalType;
    /**
     * Normalize a statement to standard form
     */
    private normalizeStatement;
    /**
     * Determine the overall status
     */
    private determineStatus;
    /**
     * Generate clarified objective
     */
    private generateClarifiedObjective;
    /**
     * Generate prioritized clarification questions
     */
    private generateClarificationQuestions;
    /**
     * Compute analysis metrics
     */
    private computeAnalysisMetrics;
    /**
     * Find context around a word in the objective
     */
    private findContextForWord;
    /**
     * Calculate overall confidence
     */
    private calculateConfidence;
    /**
     * Get constraints applied during clarification
     */
    private getAppliedConstraints;
    /**
     * Classify error for proper error code
     */
    private classifyError;
}
