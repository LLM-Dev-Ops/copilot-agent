/**
 * Decomposer Agent
 *
 * Purpose: Decompose complex objectives into manageable sub-objectives
 * Classification: DECOMPOSITION, STRUCTURAL_SYNTHESIS
 * decision_type: objective_decomposition
 *
 * Scope:
 * - Break complex objectives into sub-objectives
 * - Identify sub-objective relationships
 * - Assess decomposition completeness
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
 * - Execute sub-objectives
 * - Assign agents
 * - Allocate resources
 * - Schedule execution
 */
import { BaseAgent, AgentMetadata, AgentResult, DecomposerInput, DecomposerOutput } from '../contracts';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
/**
 * Decomposer Agent Implementation
 *
 * This agent analyzes complex objectives and produces structured sub-objectives.
 * It is purely analytical - it NEVER executes, assigns, or schedules anything.
 */
export declare class DecomposerAgent implements BaseAgent<DecomposerInput, DecomposerOutput> {
    readonly metadata: AgentMetadata;
    private readonly persistence;
    private readonly telemetry;
    constructor(persistence: RuvectorPersistence, telemetry: Telemetry);
    /**
     * Validate input against DecomposerInputSchema
     */
    validateInput(input: unknown): DecomposerInput;
    /**
     * Invoke the decomposer agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    invoke(input: DecomposerInput, executionRef: string): Promise<AgentResult>;
    /**
     * Decompose objective into sub-objectives
     *
     * This is the core decomposition logic - purely analytical.
     * NEVER executes, assigns agents, or schedules anything.
     */
    private decompose;
    /**
     * Extract sub-objectives from the objective using pattern-based analysis
     */
    private extractSubObjectives;
    /**
     * Build tree structure (parent -> children) from sub-objectives
     */
    private buildTreeStructure;
    /**
     * Build dependency graph as adjacency list
     */
    private buildDependencyGraph;
    /**
     * Calculate complexity distribution
     */
    private calculateComplexityDistribution;
    /**
     * Assess how well the sub-objectives cover the original objective
     */
    private assessCoverage;
    /**
     * Summarize objective for output
     */
    private summarize;
    /**
     * Extract assumptions made during decomposition
     */
    private extractAssumptions;
    /**
     * Calculate confidence score based on decomposition quality
     */
    private calculateConfidence;
    /**
     * Get constraints applied during decomposition
     */
    private getAppliedConstraints;
    /**
     * Classify error for proper error code
     */
    private classifyError;
    /**
     * Helper: Check if text contains any of the keywords
     */
    private containsAny;
}
