/**
 * Intent Classifier Agent
 *
 * Purpose: Classify user or system intent to guide downstream reasoning
 * Classification: INTENT_ANALYSIS
 * decision_type: intent_classification
 *
 * Scope:
 * - Classify intent type
 * - Detect multi-intent states
 * - Assign confidence scores
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
 * - Trigger workflows
 * - Route execution
 * - Enforce policy
 */
import { BaseAgent, AgentMetadata, AgentResult } from '../contracts';
import { IntentClassifierInput, IntentClassifierOutput } from '../contracts/intent-classifier-schemas';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
/**
 * Intent Classifier Agent Implementation
 *
 * This agent analyzes text and classifies user/system intent.
 * It is purely analytical - it NEVER executes, routes, or enforces anything.
 */
export declare class IntentClassifierAgent implements BaseAgent<IntentClassifierInput, IntentClassifierOutput> {
    readonly metadata: AgentMetadata;
    private readonly persistence;
    private readonly telemetry;
    constructor(persistence: RuvectorPersistence, telemetry: Telemetry);
    /**
     * Validate input against IntentClassifierInputSchema
     */
    validateInput(input: unknown): IntentClassifierInput;
    /**
     * Invoke the intent classifier agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    invoke(input: IntentClassifierInput, executionRef: string): Promise<AgentResult>;
    /**
     * Classify intent from input text
     *
     * This is the core classification logic - purely analytical.
     * NEVER triggers workflows, routes execution, or enforces policy.
     */
    private classifyIntent;
    /**
     * Normalize text for analysis
     */
    private normalizeText;
    /**
     * Detect all potential intents from normalized text
     */
    private detectIntents;
    /**
     * Extract target from text based on intent
     */
    private extractTarget;
    /**
     * Extract action from text based on intent
     */
    private extractAction;
    /**
     * Extract scope from input context
     */
    private extractScope;
    /**
     * Apply hints to filter intents
     */
    private applyHints;
    /**
     * Create unknown intent fallback
     */
    private createUnknownIntent;
    /**
     * Analyze multi-intent state
     */
    private analyzeMultiIntentState;
    /**
     * Detect relationship between intents
     */
    private detectIntentRelationship;
    /**
     * Detect ambiguity in classification
     */
    private detectAmbiguity;
    /**
     * Detect language of input
     */
    private detectLanguage;
    /**
     * Generate analysis notes
     */
    private generateNotes;
    /**
     * Calculate overall confidence
     */
    private calculateOverallConfidence;
    /**
     * Get constraints applied during classification
     */
    private getAppliedConstraints;
    /**
     * Classify error for proper error code
     */
    private classifyError;
}
