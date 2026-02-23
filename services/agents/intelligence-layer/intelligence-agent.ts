/**
 * Intelligence Layer Agent - Phase 7 (Layer 2)
 *
 * Purpose: Perform reasoning, simulation, and exploration with signal emission
 * Classification: META_ANALYSIS, REASONING_QUALITY_ASSESSMENT
 * decision_type: intelligence_layer_analysis
 *
 * Role Clarity:
 * - MAY: reason, simulate, explore
 * - MUST: emit signals, avoid final decisions
 *
 * DecisionEvent Rules - MUST emit:
 * - hypothesis_signal
 * - simulation_outcome_signal
 * - confidence_delta_signal
 *
 * Performance Budgets:
 * - MAX_TOKENS=2500
 * - MAX_LATENCY_MS=5000
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
 * ✓ NEVER makes final decisions
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BaseAgent,
  AgentMetadata,
  AgentResult,
  AgentClassification,
  AgentErrorCodes,
  createErrorResult,
  createDecisionEvent,
  PHASE7_PERFORMANCE_BUDGETS,
  IntelligenceLayerInputSchema,
  IntelligenceLayerOutputSchema,
  IntelligenceLayerInput,
  IntelligenceLayerOutput,
  HypothesisSignal,
  SimulationOutcomeSignal,
  ConfidenceDeltaSignal,
} from '../contracts';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from './telemetry';

const AGENT_ID = 'intelligence-layer-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'intelligence_layer_analysis';

/**
 * Intelligence Layer Agent Implementation
 *
 * This agent performs reasoning, simulation, and exploration operations
 * while emitting required signals. It NEVER makes final decisions.
 */
export class IntelligenceLayerAgent implements BaseAgent<IntelligenceLayerInput, IntelligenceLayerOutput> {
  readonly metadata: AgentMetadata = {
    id: AGENT_ID,
    name: 'Intelligence Layer Agent',
    version: AGENT_VERSION,
    classifications: [
      AgentClassification.META_ANALYSIS,
      AgentClassification.REASONING_QUALITY_ASSESSMENT,
    ],
    decision_type: DECISION_TYPE,
    description: 'Performs reasoning, simulation, and exploration with signal emission. NEVER makes final decisions - only emits hypothesis, simulation outcome, and confidence delta signals for human decision-makers.',
  };

  private readonly persistence: RuvectorPersistence;
  private readonly telemetry: Telemetry;

  constructor(persistence: RuvectorPersistence, telemetry: Telemetry) {
    this.persistence = persistence;
    this.telemetry = telemetry;
  }

  /**
   * Validate input against IntelligenceLayerInputSchema
   */
  validateInput(input: unknown): IntelligenceLayerInput {
    return IntelligenceLayerInputSchema.parse(input);
  }

  /**
   * Invoke the intelligence layer agent
   *
   * DETERMINISTIC: Same input always produces same output structure
   * STATELESS: No internal state modified
   * NON-BLOCKING: Fully async
   * NO FINAL DECISIONS: Emits signals only
   */
  async invoke(input: IntelligenceLayerInput, executionRef: string): Promise<AgentResult> {
    const startTime = Date.now();
    const maxLatency = input.performance_limits?.max_latency_ms ?? PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS;
    const maxTokens = input.performance_limits?.max_tokens ?? PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS;

    try {
      // Emit telemetry start
      this.telemetry.recordStart(AGENT_ID, executionRef, input);

      // Track resource usage
      let tokensUsed = 0;

      // Perform intelligence operations based on mode (pure analysis, no side effects)
      const hypothesisSignals: HypothesisSignal[] = [];
      const simulationOutcomeSignals: SimulationOutcomeSignal[] = [];
      const confidenceDeltaSignals: ConfidenceDeltaSignal[] = [];

      // Execute based on mode
      switch (input.mode) {
        case 'reason':
          const reasonResult = this.performReasoning(input, startTime, maxLatency, maxTokens);
          hypothesisSignals.push(...reasonResult.hypotheses);
          tokensUsed += reasonResult.tokensUsed;
          break;

        case 'simulate':
          const simResult = this.performSimulation(input, startTime, maxLatency, maxTokens);
          simulationOutcomeSignals.push(...simResult.simulations);
          confidenceDeltaSignals.push(...simResult.deltas);
          tokensUsed += simResult.tokensUsed;
          break;

        case 'explore':
          const exploreResult = this.performExploration(input, startTime, maxLatency, maxTokens);
          hypothesisSignals.push(...exploreResult.hypotheses);
          simulationOutcomeSignals.push(...exploreResult.simulations);
          confidenceDeltaSignals.push(...exploreResult.deltas);
          tokensUsed += exploreResult.tokensUsed;
          break;
      }

      const latencyMs = Date.now() - startTime;
      const withinBudget = tokensUsed <= maxTokens && latencyMs <= maxLatency;

      // Find highest confidence hypothesis
      let highestConfidenceHypothesis: string | undefined;
      let highestConfidenceValue: number | undefined;
      if (hypothesisSignals.length > 0) {
        const sorted = [...hypothesisSignals].sort((a, b) => b.initial_confidence - a.initial_confidence);
        highestConfidenceHypothesis = sorted[0].hypothesis_id;
        highestConfidenceValue = sorted[0].initial_confidence;
      }

      // Build output
      const output: IntelligenceLayerOutput = {
        output_id: uuidv4(),
        mode_executed: input.mode,
        hypothesis_signals: hypothesisSignals,
        simulation_outcome_signals: simulationOutcomeSignals,
        confidence_delta_signals: confidenceDeltaSignals,
        summary: {
          hypotheses_formed: hypothesisSignals.length,
          simulations_run: simulationOutcomeSignals.length,
          confidence_updates: confidenceDeltaSignals.length,
          highest_confidence_hypothesis: highestConfidenceHypothesis,
          highest_confidence_value: highestConfidenceValue,
          final_decision_status: 'no_final_decision', // CRITICAL: We NEVER make final decisions
        },
        resource_consumption: {
          total_tokens_used: tokensUsed,
          total_latency_ms: latencyMs,
          budget_tokens_remaining: maxTokens - tokensUsed,
          budget_latency_remaining_ms: maxLatency - latencyMs,
          within_budget: withinBudget,
        },
        human_decision_suggestions: this.generateHumanSuggestions(hypothesisSignals, simulationOutcomeSignals),
        completed_at: new Date().toISOString(),
      };

      // Validate output
      const validatedOutput = IntelligenceLayerOutputSchema.parse(output);

      // Calculate confidence based on operation quality
      const confidence = this.calculateConfidence(validatedOutput, input);

      // Constraints applied during analysis
      const constraintsApplied = this.getAppliedConstraints(input);

      // Create the DecisionEvent
      const event = createDecisionEvent(
        AGENT_ID,
        AGENT_VERSION,
        DECISION_TYPE,
        input,
        validatedOutput,
        confidence,
        constraintsApplied,
        executionRef
      );

      // Persist via ruvector-service (best-effort, non-blocking)
      let persistence_status: { status: 'persisted' | 'skipped'; error?: string };
      try {
        await this.persistence.store(event);
        persistence_status = { status: 'persisted' };
      } catch (persistError) {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = this.classifyError(error);

      // Emit telemetry failure
      this.telemetry.recordFailure(AGENT_ID, executionRef, errorCode, errorMessage);

      return createErrorResult(errorCode, errorMessage, executionRef);
    }
  }

  /**
   * Perform reasoning to form hypotheses
   *
   * MAY reason - but MUST emit hypothesis_signal
   * MUST NOT make final decisions
   */
  private performReasoning(
    input: IntelligenceLayerInput,
    _startTime: number,
    _maxLatency: number,
    _maxTokens: number
  ): { hypotheses: HypothesisSignal[]; tokensUsed: number } {
    const hypotheses: HypothesisSignal[] = [];
    let tokensUsed = 0;

    // Form primary hypothesis from objective
    const primaryHypothesis: HypothesisSignal = {
      signal_type: 'hypothesis_signal',
      hypothesis_id: uuidv4(),
      statement: `Given the objective "${input.objective.statement}", the following conditions may apply within domain "${input.objective.domain}"`,
      domain: input.objective.domain,
      supporting_evidence: this.extractSupportingEvidence(input),
      counter_evidence: this.extractCounterEvidence(input),
      initial_confidence: this.calculateInitialConfidence(input),
      strengthening_conditions: this.identifyStrengtheningConditions(input),
      weakening_conditions: this.identifyWeakeningConditions(input),
      related_hypothesis_ids: [],
      formed_at: new Date().toISOString(),
    };

    hypotheses.push(primaryHypothesis);
    tokensUsed += this.estimateTokens(primaryHypothesis);

    // Form alternative hypotheses if constraints allow
    if (input.objective.constraints.length > 0) {
      const alternativeHypothesis: HypothesisSignal = {
        signal_type: 'hypothesis_signal',
        hypothesis_id: uuidv4(),
        statement: `Alternative: Constraints [${input.objective.constraints.join(', ')}] may require different approach for "${input.objective.statement}"`,
        domain: input.objective.domain,
        supporting_evidence: [{
          evidence_id: uuidv4(),
          description: 'Constraints present that may limit primary hypothesis',
          weight: 0.6,
        }],
        counter_evidence: [],
        initial_confidence: 0.4,
        strengthening_conditions: ['Primary hypothesis fails validation', 'Constraints become blocking'],
        weakening_conditions: ['Primary hypothesis succeeds', 'Constraints relaxed'],
        related_hypothesis_ids: [primaryHypothesis.hypothesis_id],
        formed_at: new Date().toISOString(),
      };

      hypotheses.push(alternativeHypothesis);
      tokensUsed += this.estimateTokens(alternativeHypothesis);
    }

    return { hypotheses, tokensUsed };
  }

  /**
   * Perform simulation to test hypotheses
   *
   * MAY simulate - but MUST emit simulation_outcome_signal and confidence_delta_signal
   * MUST NOT trigger actions or make final decisions
   */
  private performSimulation(
    input: IntelligenceLayerInput,
    startTime: number,
    maxLatency: number,
    maxTokens: number
  ): { simulations: SimulationOutcomeSignal[]; deltas: ConfidenceDeltaSignal[]; tokensUsed: number } {
    const simulations: SimulationOutcomeSignal[] = [];
    const deltas: ConfidenceDeltaSignal[] = [];
    let tokensUsed = 0;

    // Get hypotheses to test (from prior or create temporary)
    const hypothesesToTest = input.prior_hypotheses ?? [];

    if (hypothesesToTest.length === 0) {
      // Create a simulation for the objective itself
      const simulation: SimulationOutcomeSignal = {
        signal_type: 'simulation_outcome_signal',
        simulation_id: uuidv4(),
        scenario: {
          name: `Objective Analysis: ${input.objective.domain}`,
          description: `Simulating conditions for: ${input.objective.statement}`,
          initial_conditions: input.objective.context ?? {},
          parameters: { constraints: input.objective.constraints },
        },
        outcome: 'inconclusive',
        results: {
          primary_finding: 'No prior hypotheses to test - simulation provides baseline analysis',
          secondary_findings: [
            'Objective statement analyzed for feasibility',
            'Domain constraints identified',
          ],
        },
        outcome_confidence: 0.5,
        resource_usage: {
          tokens_used: 200,
          latency_ms: Date.now() - startTime,
          within_budget: true,
        },
        exploration_recommendations: [{
          recommendation_id: uuidv4(),
          type: 'hypothesis_refinement',
          description: 'Form specific hypotheses before running targeted simulations',
          priority: 1,
        }],
        completed_at: new Date().toISOString(),
      };

      simulations.push(simulation);
      tokensUsed += 200;
    } else {
      // Test each hypothesis
      for (const hypothesis of hypothesesToTest) {
        if (tokensUsed >= maxTokens * 0.8) break; // Leave budget headroom

        const simulationResult = this.simulateHypothesis(hypothesis, input, startTime);
        simulations.push(simulationResult.simulation);
        tokensUsed += simulationResult.tokensUsed;

        // Generate confidence delta if prior confidence exists
        const priorConfidence = hypothesis.initial_confidence;
        const newConfidence = this.calculatePostSimulationConfidence(hypothesis, simulationResult.simulation);

        if (Math.abs(newConfidence - priorConfidence) > 0.01) {
          const delta: ConfidenceDeltaSignal = {
            signal_type: 'confidence_delta_signal',
            delta_id: uuidv4(),
            hypothesis_id: hypothesis.hypothesis_id,
            simulation_id: simulationResult.simulation.simulation_id,
            previous_confidence: priorConfidence,
            new_confidence: newConfidence,
            delta: newConfidence - priorConfidence,
            reason: {
              category: 'simulation_result',
              description: `Simulation outcome: ${simulationResult.simulation.outcome}`,
              contributing_factors: [{
                factor: simulationResult.simulation.results.primary_finding,
                impact: newConfidence - priorConfidence,
              }],
            },
            thresholds: {
              recommendation_threshold: 0.7,
              distance_from_threshold: newConfidence - 0.7,
              trend: this.calculateConfidenceTrend(input.confidence_history ?? [], newConfidence),
            },
            changed_at: new Date().toISOString(),
          };

          deltas.push(delta);
          tokensUsed += this.estimateTokens(delta);
        }
      }
    }

    return { simulations, deltas, tokensUsed };
  }

  /**
   * Perform exploration combining reasoning and simulation
   *
   * MAY explore - but MUST emit all signal types
   * MUST NOT make final decisions or trigger actions
   */
  private performExploration(
    input: IntelligenceLayerInput,
    startTime: number,
    maxLatency: number,
    maxTokens: number
  ): { hypotheses: HypothesisSignal[]; simulations: SimulationOutcomeSignal[]; deltas: ConfidenceDeltaSignal[]; tokensUsed: number } {
    let totalTokensUsed = 0;

    // Phase 1: Reasoning (40% budget)
    const reasoningBudget = Math.floor(maxTokens * 0.4);
    const reasonResult = this.performReasoning(input, startTime, maxLatency, reasoningBudget);
    totalTokensUsed += reasonResult.tokensUsed;

    // Phase 2: Simulation with formed hypotheses (60% budget)
    const simulationBudget = maxTokens - totalTokensUsed;
    const simulationInput: IntelligenceLayerInput = {
      ...input,
      prior_hypotheses: reasonResult.hypotheses,
      performance_limits: {
        max_tokens: simulationBudget,
        max_latency_ms: maxLatency - (Date.now() - startTime),
      },
    };

    const simResult = this.performSimulation(simulationInput, startTime, maxLatency, simulationBudget);
    totalTokensUsed += simResult.tokensUsed;

    return {
      hypotheses: reasonResult.hypotheses,
      simulations: simResult.simulations,
      deltas: simResult.deltas,
      tokensUsed: totalTokensUsed,
    };
  }

  /**
   * Simulate a specific hypothesis
   */
  private simulateHypothesis(
    hypothesis: HypothesisSignal,
    input: IntelligenceLayerInput,
    startTime: number
  ): { simulation: SimulationOutcomeSignal; tokensUsed: number } {
    // Determine outcome based on evidence balance
    const supportWeight = hypothesis.supporting_evidence.reduce((sum, e) => sum + e.weight, 0);
    const counterWeight = hypothesis.counter_evidence.reduce((sum, e) => sum + e.weight, 0);
    const evidenceBalance = supportWeight - counterWeight;

    let outcome: SimulationOutcomeSignal['outcome'];
    if (evidenceBalance > 0.3) {
      outcome = 'hypothesis_supported';
    } else if (evidenceBalance < -0.3) {
      outcome = 'hypothesis_weakened';
    } else {
      outcome = 'inconclusive';
    }

    const simulation: SimulationOutcomeSignal = {
      signal_type: 'simulation_outcome_signal',
      simulation_id: uuidv4(),
      hypothesis_id: hypothesis.hypothesis_id,
      scenario: {
        name: `Test: ${hypothesis.statement.substring(0, 50)}...`,
        description: `Simulating hypothesis in domain: ${hypothesis.domain}`,
        initial_conditions: input.objective.context ?? {},
        parameters: {
          supporting_evidence_count: hypothesis.supporting_evidence.length,
          counter_evidence_count: hypothesis.counter_evidence.length,
        },
      },
      outcome,
      results: {
        primary_finding: `Evidence balance: ${evidenceBalance.toFixed(2)} (${outcome})`,
        secondary_findings: [
          `Supporting evidence weight: ${supportWeight.toFixed(2)}`,
          `Counter evidence weight: ${counterWeight.toFixed(2)}`,
        ],
        metrics: {
          evidence_balance: evidenceBalance,
          support_weight: supportWeight,
          counter_weight: counterWeight,
        },
      },
      outcome_confidence: 0.6 + Math.abs(evidenceBalance) * 0.3,
      resource_usage: {
        tokens_used: 150,
        latency_ms: Date.now() - startTime,
        within_budget: true,
      },
      exploration_recommendations: this.generateExplorationRecommendations(hypothesis, outcome),
      completed_at: new Date().toISOString(),
    };

    return { simulation, tokensUsed: 150 };
  }

  /**
   * Generate exploration recommendations based on simulation outcome
   */
  private generateExplorationRecommendations(
    hypothesis: HypothesisSignal,
    outcome: SimulationOutcomeSignal['outcome']
  ): SimulationOutcomeSignal['exploration_recommendations'] {
    const recommendations: SimulationOutcomeSignal['exploration_recommendations'] = [];

    if (outcome === 'inconclusive') {
      recommendations.push({
        recommendation_id: uuidv4(),
        type: 'data_collection',
        description: 'Gather more evidence to resolve inconclusive simulation',
        priority: 1,
      });
    }

    if (outcome === 'hypothesis_weakened') {
      recommendations.push({
        recommendation_id: uuidv4(),
        type: 'hypothesis_refinement',
        description: 'Consider refining hypothesis based on counter-evidence',
        priority: 2,
      });
    }

    if (hypothesis.related_hypothesis_ids.length > 0) {
      recommendations.push({
        recommendation_id: uuidv4(),
        type: 'additional_simulation',
        description: 'Test related hypotheses for comprehensive analysis',
        priority: 3,
      });
    }

    return recommendations;
  }

  /**
   * Calculate post-simulation confidence
   */
  private calculatePostSimulationConfidence(
    hypothesis: HypothesisSignal,
    simulation: SimulationOutcomeSignal
  ): number {
    const baseConfidence = hypothesis.initial_confidence;

    switch (simulation.outcome) {
      case 'hypothesis_supported':
        return Math.min(1, baseConfidence + 0.15);
      case 'hypothesis_weakened':
        return Math.max(0, baseConfidence - 0.2);
      case 'hypothesis_refuted':
        return Math.max(0, baseConfidence - 0.4);
      case 'inconclusive':
        return baseConfidence;
      case 'unexpected_result':
        return Math.max(0, baseConfidence - 0.1);
      case 'simulation_error':
        return baseConfidence;
      default:
        return baseConfidence;
    }
  }

  /**
   * Calculate confidence trend from history
   */
  private calculateConfidenceTrend(
    history: ConfidenceDeltaSignal[],
    currentConfidence: number
  ): ConfidenceDeltaSignal['thresholds']['trend'] {
    if (history.length < 2) return 'stable';

    const recentDeltas = history.slice(-3).map(h => h.delta);
    const avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;

    if (avgDelta > 0.05) return 'increasing';
    if (avgDelta < -0.05) return 'decreasing';

    const variance = recentDeltas.reduce((sum, d) => sum + Math.pow(d - avgDelta, 2), 0) / recentDeltas.length;
    if (variance > 0.01) return 'oscillating';

    return 'stable';
  }

  /**
   * Extract supporting evidence from input
   */
  private extractSupportingEvidence(input: IntelligenceLayerInput): HypothesisSignal['supporting_evidence'] {
    const evidence: HypothesisSignal['supporting_evidence'] = [];

    // Add context-based evidence
    if (input.objective.context) {
      evidence.push({
        evidence_id: uuidv4(),
        description: 'Objective includes contextual information',
        weight: 0.5,
        source: 'input_context',
      });
    }

    // Add domain specificity as evidence
    if (input.objective.domain) {
      evidence.push({
        evidence_id: uuidv4(),
        description: `Domain "${input.objective.domain}" is specified`,
        weight: 0.4,
        source: 'input_domain',
      });
    }

    // Add prior hypothesis support
    if (input.prior_hypotheses && input.prior_hypotheses.length > 0) {
      evidence.push({
        evidence_id: uuidv4(),
        description: `${input.prior_hypotheses.length} prior hypothesis(es) available for building`,
        weight: 0.6,
        source: 'prior_hypotheses',
      });
    }

    return evidence;
  }

  /**
   * Extract counter evidence from input
   */
  private extractCounterEvidence(input: IntelligenceLayerInput): HypothesisSignal['counter_evidence'] {
    const evidence: HypothesisSignal['counter_evidence'] = [];

    // Add constraint-based counter evidence
    if (input.objective.constraints.length > 0) {
      evidence.push({
        evidence_id: uuidv4(),
        description: `${input.objective.constraints.length} constraint(s) may limit hypothesis scope`,
        weight: 0.3,
        source: 'input_constraints',
      });
    }

    return evidence;
  }

  /**
   * Calculate initial confidence for a hypothesis
   */
  private calculateInitialConfidence(input: IntelligenceLayerInput): number {
    let confidence = 0.5; // Base confidence

    // Boost for prior hypotheses
    if (input.prior_hypotheses && input.prior_hypotheses.length > 0) {
      confidence += 0.1;
    }

    // Boost for context
    if (input.objective.context) {
      confidence += 0.1;
    }

    // Reduce for many constraints
    if (input.objective.constraints.length > 3) {
      confidence -= 0.1;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Identify conditions that would strengthen the hypothesis
   */
  private identifyStrengtheningConditions(input: IntelligenceLayerInput): string[] {
    return [
      'Additional supporting evidence discovered',
      'Simulation results confirm predictions',
      'Related hypotheses validated',
      'Constraints relaxed or satisfied',
    ];
  }

  /**
   * Identify conditions that would weaken the hypothesis
   */
  private identifyWeakeningConditions(input: IntelligenceLayerInput): string[] {
    return [
      'Counter-evidence discovered',
      'Simulation results contradict predictions',
      'Related hypotheses refuted',
      'New constraints introduced',
    ];
  }

  /**
   * Generate suggestions for human decision-makers
   *
   * CRITICAL: These are suggestions only, NOT decisions
   */
  private generateHumanSuggestions(
    hypotheses: HypothesisSignal[],
    simulations: SimulationOutcomeSignal[]
  ): IntelligenceLayerOutput['human_decision_suggestions'] {
    const suggestions: IntelligenceLayerOutput['human_decision_suggestions'] = [];

    // Generate suggestions for high-confidence hypotheses
    for (const hypothesis of hypotheses) {
      if (hypothesis.initial_confidence >= 0.6) {
        const relatedSimulation = simulations.find(s => s.hypothesis_id === hypothesis.hypothesis_id);

        suggestions.push({
          suggestion_id: uuidv4(),
          hypothesis_id: hypothesis.hypothesis_id,
          confidence: relatedSimulation
            ? this.calculatePostSimulationConfidence(hypothesis, relatedSimulation)
            : hypothesis.initial_confidence,
          rationale: `Hypothesis in domain "${hypothesis.domain}" shows ${hypothesis.supporting_evidence.length} supporting evidence items`,
          caveats: [
            'This is a suggestion only - human judgment required',
            `Counter-evidence count: ${hypothesis.counter_evidence.length}`,
            'Confidence may change with additional simulations',
          ],
        });
      }
    }

    return suggestions;
  }

  /**
   * Estimate token usage for an object
   */
  private estimateTokens(obj: unknown): number {
    const jsonLength = JSON.stringify(obj).length;
    return Math.ceil(jsonLength / 4); // Rough token estimate
  }

  /**
   * Calculate overall confidence for the intelligence operation
   */
  private calculateConfidence(output: IntelligenceLayerOutput, input: IntelligenceLayerInput): number {
    let confidence = 0.6; // Base confidence

    // Boost for signal generation
    if (output.hypothesis_signals.length > 0) confidence += 0.1;
    if (output.simulation_outcome_signals.length > 0) confidence += 0.1;
    if (output.confidence_delta_signals.length > 0) confidence += 0.05;

    // Boost for staying within budget
    if (output.resource_consumption.within_budget) confidence += 0.05;

    // Reduce for errors or empty results
    if (output.hypothesis_signals.length === 0 && output.simulation_outcome_signals.length === 0) {
      confidence -= 0.2;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Get constraints applied during analysis
   */
  private getAppliedConstraints(input: IntelligenceLayerInput): string[] {
    const constraints = [
      'stateless_processing',
      'deterministic_output',
      'no_final_decisions',
      'signal_emission_required',
      'ruvector_persistence_only',
      `max_tokens_${input.performance_limits?.max_tokens ?? PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS}`,
      `max_latency_ms_${input.performance_limits?.max_latency_ms ?? PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS}`,
    ];

    // Add mode-specific constraints
    constraints.push(`mode_${input.mode}`);

    return constraints;
  }

  /**
   * Classify error for proper error code
   */
  private classifyError(error: unknown): typeof AgentErrorCodes[keyof typeof AgentErrorCodes] {
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return AgentErrorCodes.VALIDATION_FAILED;
      }
      if (error.message.includes('persistence') || error.message.includes('ruvector')) {
        return AgentErrorCodes.PERSISTENCE_ERROR;
      }
      if (error.message.includes('timeout') || error.message.includes('latency')) {
        return AgentErrorCodes.TIMEOUT;
      }
    }
    return AgentErrorCodes.PROCESSING_ERROR;
  }
}
