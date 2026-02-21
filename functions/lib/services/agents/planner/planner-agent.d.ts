/**
 * Planner Agent
 *
 * Purpose: Translate clarified objectives into structured execution plans
 * Classification: PLANNING, STRUCTURAL_SYNTHESIS
 * decision_type: plan_generation
 *
 * Scope:
 * - Generate ordered plan steps
 * - Identify dependencies
 * - Define sequencing
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
 * - Execute steps
 * - Assign agents
 * - Allocate resources
 * - Schedule execution
 */
import { BaseAgent, AgentMetadata, AgentResult, PlannerInput, PlannerOutput } from '../contracts';
import { RuvectorPersistence } from './ruvector-persistence';
import { Telemetry } from './telemetry';
/**
 * Planner Agent Implementation
 *
 * This agent analyzes objectives and produces structured execution plans.
 * It is purely analytical - it NEVER executes, assigns, or schedules anything.
 */
export declare class PlannerAgent implements BaseAgent<PlannerInput, PlannerOutput> {
    readonly metadata: AgentMetadata;
    private readonly persistence;
    private readonly telemetry;
    constructor(persistence: RuvectorPersistence, telemetry: Telemetry);
    /**
     * Validate input against PlannerInputSchema
     */
    validateInput(input: unknown): PlannerInput;
    /**
     * Invoke the planner agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    invoke(input: PlannerInput, executionRef: string): Promise<AgentResult>;
    /**
     * Generate structured execution plan from objective
     *
     * This is the core planning logic - purely analytical.
     * NEVER executes, assigns agents, or schedules anything.
     */
    private generatePlan;
    /**
     * Decompose objective into ordered steps
     */
    private decomposeObjective;
    /**
     * Create a plan step
     */
    private createStep;
    /**
     * Build dependency graph as adjacency list
     */
    private buildDependencyGraph;
    /**
     * Find critical path (longest dependency chain)
     */
    private findCriticalPath;
    /**
     * Identify groups of steps that can run in parallel
     */
    private identifyParallelGroups;
    /**
     * Resequence steps based on dependency order
     */
    private resequenceSteps;
    /**
     * Calculate maximum dependency depth
     */
    private calculateMaxDepth;
    /**
     * Identify potential risks based on plan structure
     */
    private identifyRisks;
    /**
     * Extract assumptions made during planning
     */
    private extractAssumptions;
    /**
     * Summarize objective for output
     */
    private summarizeObjective;
    /**
     * Calculate confidence score based on plan quality
     */
    private calculateConfidence;
    /**
     * Get constraints applied during planning
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
