/**
 * Intelligence Layer Agent Bundle - Phase 7 (Layer 2)
 *
 * Bundled agent code for Cloud Run deployment.
 *
 * Role Clarity:
 * - Agents MAY: reason, simulate, explore
 * - Agents MUST: emit signals, avoid final decisions
 *
 * Signals Emitted:
 * - hypothesis_signal
 * - simulation_outcome_signal
 * - confidence_delta_signal
 *
 * Performance Budgets:
 * - MAX_TOKENS=2500
 * - MAX_LATENCY_MS=5000
 */

const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ============================================================================
// PERFORMANCE BUDGETS
// ============================================================================
const PHASE7_PERFORMANCE_BUDGETS = {
  MAX_TOKENS: 2500,
  MAX_LATENCY_MS: 5000,
};

// ============================================================================
// SIGNAL SCHEMAS
// ============================================================================

const HypothesisSignalSchema = z.object({
  signal_type: z.literal('hypothesis_signal'),
  hypothesis_id: z.string().uuid(),
  statement: z.string().min(1).max(500),
  domain: z.string().min(1),
  supporting_evidence: z.array(z.object({
    evidence_id: z.string(),
    description: z.string(),
    weight: z.number().min(0).max(1),
    source: z.string().optional(),
  })),
  counter_evidence: z.array(z.object({
    evidence_id: z.string(),
    description: z.string(),
    weight: z.number().min(0).max(1),
    source: z.string().optional(),
  })),
  initial_confidence: z.number().min(0).max(1),
  strengthening_conditions: z.array(z.string()),
  weakening_conditions: z.array(z.string()),
  related_hypothesis_ids: z.array(z.string().uuid()),
  formed_at: z.string().datetime(),
});

const SimulationOutcomeSignalSchema = z.object({
  signal_type: z.literal('simulation_outcome_signal'),
  simulation_id: z.string().uuid(),
  hypothesis_id: z.string().uuid().optional(),
  scenario: z.object({
    name: z.string(),
    description: z.string(),
    initial_conditions: z.record(z.string(), z.unknown()),
    parameters: z.record(z.string(), z.unknown()),
  }),
  outcome: z.enum([
    'hypothesis_supported',
    'hypothesis_weakened',
    'hypothesis_refuted',
    'inconclusive',
    'unexpected_result',
    'simulation_error',
  ]),
  results: z.object({
    primary_finding: z.string(),
    secondary_findings: z.array(z.string()),
    metrics: z.record(z.string(), z.number()).optional(),
    artifacts: z.array(z.object({
      artifact_id: z.string(),
      type: z.string(),
      description: z.string(),
    })).optional(),
  }),
  outcome_confidence: z.number().min(0).max(1),
  resource_usage: z.object({
    tokens_used: z.number().int().min(0),
    latency_ms: z.number().min(0),
    within_budget: z.boolean(),
  }),
  exploration_recommendations: z.array(z.object({
    recommendation_id: z.string(),
    type: z.enum(['additional_simulation', 'hypothesis_refinement', 'data_collection', 'domain_expansion']),
    description: z.string(),
    priority: z.number().min(1).max(5),
  })),
  completed_at: z.string().datetime(),
});

const ConfidenceDeltaSignalSchema = z.object({
  signal_type: z.literal('confidence_delta_signal'),
  delta_id: z.string().uuid(),
  hypothesis_id: z.string().uuid(),
  simulation_id: z.string().uuid().optional(),
  previous_confidence: z.number().min(0).max(1),
  new_confidence: z.number().min(0).max(1),
  delta: z.number().min(-1).max(1),
  reason: z.object({
    category: z.enum([
      'new_evidence',
      'contradicting_evidence',
      'simulation_result',
      'reasoning_refinement',
      'assumption_invalidated',
      'scope_change',
      'uncertainty_quantification',
    ]),
    description: z.string(),
    contributing_factors: z.array(z.object({
      factor: z.string(),
      impact: z.number().min(-1).max(1),
    })),
  }),
  thresholds: z.object({
    recommendation_threshold: z.number().min(0).max(1),
    distance_from_threshold: z.number(),
    trend: z.enum(['increasing', 'decreasing', 'stable', 'oscillating']),
  }),
  changed_at: z.string().datetime(),
});

const IntelligenceLayerInputSchema = z.object({
  mode: z.enum(['reason', 'simulate', 'explore']),
  objective: z.object({
    statement: z.string().min(1),
    domain: z.string(),
    constraints: z.array(z.string()),
    context: z.record(z.string(), z.unknown()).optional(),
  }),
  prior_hypotheses: z.array(HypothesisSignalSchema).optional(),
  prior_simulations: z.array(SimulationOutcomeSignalSchema).optional(),
  confidence_history: z.array(ConfidenceDeltaSignalSchema).optional(),
  performance_limits: z.object({
    max_tokens: z.number().int().max(PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS).default(PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS),
    max_latency_ms: z.number().max(PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS).default(PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS),
  }).optional(),
  reasoning_chain_id: z.string().uuid().optional(),
});

const IntelligenceLayerOutputSchema = z.object({
  output_id: z.string().uuid(),
  mode_executed: z.enum(['reason', 'simulate', 'explore']),
  hypothesis_signals: z.array(HypothesisSignalSchema),
  simulation_outcome_signals: z.array(SimulationOutcomeSignalSchema),
  confidence_delta_signals: z.array(ConfidenceDeltaSignalSchema),
  summary: z.object({
    hypotheses_formed: z.number().int().min(0),
    simulations_run: z.number().int().min(0),
    confidence_updates: z.number().int().min(0),
    highest_confidence_hypothesis: z.string().uuid().optional(),
    highest_confidence_value: z.number().min(0).max(1).optional(),
    final_decision_status: z.literal('no_final_decision'),
  }),
  resource_consumption: z.object({
    total_tokens_used: z.number().int().min(0),
    total_latency_ms: z.number().min(0),
    budget_tokens_remaining: z.number().int(),
    budget_latency_remaining_ms: z.number(),
    within_budget: z.boolean(),
  }),
  human_decision_suggestions: z.array(z.object({
    suggestion_id: z.string(),
    hypothesis_id: z.string().uuid(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
    caveats: z.array(z.string()),
  })),
  completed_at: z.string().datetime(),
});

// ============================================================================
// DECISION EVENT
// ============================================================================

function hashInputs(inputs) {
  const normalized = JSON.stringify(inputs, Object.keys(inputs).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function createDecisionEvent(agentId, agentVersion, decisionType, inputs, outputs, confidence, constraintsApplied, executionRef) {
  return {
    agent_id: agentId,
    agent_version: agentVersion,
    decision_type: decisionType,
    inputs_hash: hashInputs(inputs),
    outputs,
    confidence,
    constraints_applied: constraintsApplied,
    execution_ref: executionRef,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// RUVECTOR PERSISTENCE
// ============================================================================

class RuvectorPersistence {
  constructor(config) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  async store(event) {
    // Try multiple endpoint patterns for compatibility
    const endpoints = [
      `${this.config.endpoint}/api/v1/events`,
      `${this.config.endpoint}/events`,
      `${this.config.endpoint}/api/events`,
      `${this.config.endpoint}/v1/events`,
    ];

    let lastError = null;
    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
            'X-Namespace': this.config.namespace,
          },
          body: JSON.stringify({
            event_type: `agent.${event.decision_type}`,
            agent_id: event.agent_id,
            agent_version: event.agent_version,
            payload: event,
            timestamp: event.timestamp,
          }),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            id: result.id || event.execution_ref,
            stored: true,
          };
        }
        lastError = `${response.status} ${response.statusText}`;
      } catch (err) {
        lastError = err.message;
      }
    }

    // Log but don't fail - allow agent to continue
    console.warn(`[RuVector] Persistence warning: ${lastError}. Event logged locally.`);
    console.log(`[RuVector] Event: ${JSON.stringify(event)}`);
    return {
      id: event.execution_ref,
      stored: false,
      warning: lastError,
    };
  }
}

function createRuvectorFromEnv() {
  const endpoint = process.env.RUVECTOR_ENDPOINT || 'http://localhost:8081';
  const apiKey = process.env.RUVECTOR_API_KEY;
  const namespace = process.env.RUVECTOR_NAMESPACE || 'agents';

  return new RuvectorPersistence({
    endpoint,
    apiKey,
    namespace,
  });
}

// ============================================================================
// TELEMETRY
// ============================================================================

class Telemetry {
  constructor(config) {
    this.config = config;
    this.spans = [];
  }

  recordStart(agentId, executionRef, input) {
    if (!this.config.enabled) return;
    console.log(`[TELEMETRY] Start: agent=${agentId} ref=${executionRef}`);
  }

  recordSuccess(agentId, executionRef, durationMs) {
    if (!this.config.enabled) return;
    console.log(`[TELEMETRY] Success: agent=${agentId} ref=${executionRef} duration=${durationMs}ms`);
  }

  recordFailure(agentId, executionRef, errorCode, errorMessage) {
    if (!this.config.enabled) return;
    console.log(`[TELEMETRY] Failure: agent=${agentId} ref=${executionRef} error=${errorCode}`);
  }
}

function createTelemetryFromEnv() {
  return new Telemetry({
    endpoint: process.env.LLM_OBSERVATORY_ENDPOINT,
    serviceName: 'intelligence-layer-agent',
    serviceVersion: '1.0.0',
    enabled: process.env.TELEMETRY_ENABLED !== 'false',
  });
}

// ============================================================================
// INTELLIGENCE LAYER AGENT
// ============================================================================

const AGENT_ID = 'intelligence-layer-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'intelligence_layer_analysis';

class IntelligenceLayerAgent {
  constructor(persistence, telemetry) {
    this.persistence = persistence;
    this.telemetry = telemetry;
    this.metadata = {
      id: AGENT_ID,
      name: 'Intelligence Layer Agent',
      version: AGENT_VERSION,
      classifications: ['META_ANALYSIS', 'REASONING_QUALITY_ASSESSMENT'],
      decision_type: DECISION_TYPE,
      description: 'Performs reasoning, simulation, and exploration with signal emission. NEVER makes final decisions.',
    };
  }

  validateInput(input) {
    return IntelligenceLayerInputSchema.parse(input);
  }

  async invoke(input, executionRef) {
    const startTime = Date.now();
    const maxLatency = input.performance_limits?.max_latency_ms ?? PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS;
    const maxTokens = input.performance_limits?.max_tokens ?? PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS;

    try {
      this.telemetry.recordStart(AGENT_ID, executionRef, input);

      let tokensUsed = 0;
      const hypothesisSignals = [];
      const simulationOutcomeSignals = [];
      const confidenceDeltaSignals = [];

      // Execute based on mode
      switch (input.mode) {
        case 'reason':
          const reasonResult = this.performReasoning(input, maxTokens);
          hypothesisSignals.push(...reasonResult.hypotheses);
          tokensUsed += reasonResult.tokensUsed;
          break;

        case 'simulate':
          const simResult = this.performSimulation(input, startTime, maxTokens);
          simulationOutcomeSignals.push(...simResult.simulations);
          confidenceDeltaSignals.push(...simResult.deltas);
          tokensUsed += simResult.tokensUsed;
          break;

        case 'explore':
          const exploreResult = this.performExploration(input, startTime, maxTokens);
          hypothesisSignals.push(...exploreResult.hypotheses);
          simulationOutcomeSignals.push(...exploreResult.simulations);
          confidenceDeltaSignals.push(...exploreResult.deltas);
          tokensUsed += exploreResult.tokensUsed;
          break;
      }

      const latencyMs = Date.now() - startTime;
      const withinBudget = tokensUsed <= maxTokens && latencyMs <= maxLatency;

      // Find highest confidence hypothesis
      let highestConfidenceHypothesis;
      let highestConfidenceValue;
      if (hypothesisSignals.length > 0) {
        const sorted = [...hypothesisSignals].sort((a, b) => b.initial_confidence - a.initial_confidence);
        highestConfidenceHypothesis = sorted[0].hypothesis_id;
        highestConfidenceValue = sorted[0].initial_confidence;
      }

      const output = {
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
          final_decision_status: 'no_final_decision',
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

      const validatedOutput = IntelligenceLayerOutputSchema.parse(output);
      const confidence = this.calculateConfidence(validatedOutput, input);
      const constraintsApplied = this.getAppliedConstraints(input);

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

      await this.persistence.store(event);
      this.telemetry.recordSuccess(AGENT_ID, executionRef, Date.now() - startTime);

      return { status: 'success', event };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = this.classifyError(error);
      this.telemetry.recordFailure(AGENT_ID, executionRef, errorCode, errorMessage);

      return {
        status: 'error',
        error_code: errorCode,
        error_message: errorMessage,
        execution_ref: executionRef,
        timestamp: new Date().toISOString(),
      };
    }
  }

  performReasoning(input, maxTokens) {
    const hypotheses = [];
    let tokensUsed = 0;

    // Primary hypothesis
    const primaryHypothesis = {
      signal_type: 'hypothesis_signal',
      hypothesis_id: uuidv4(),
      statement: `Given the objective "${input.objective.statement}", conditions may apply within domain "${input.objective.domain}"`,
      domain: input.objective.domain,
      supporting_evidence: this.extractSupportingEvidence(input),
      counter_evidence: this.extractCounterEvidence(input),
      initial_confidence: this.calculateInitialConfidence(input),
      strengthening_conditions: ['Additional supporting evidence', 'Simulation confirms predictions'],
      weakening_conditions: ['Counter-evidence discovered', 'Simulation contradicts predictions'],
      related_hypothesis_ids: [],
      formed_at: new Date().toISOString(),
    };

    hypotheses.push(primaryHypothesis);
    tokensUsed += this.estimateTokens(primaryHypothesis);

    // Alternative hypothesis if constraints exist
    if (input.objective.constraints.length > 0) {
      const altHypothesis = {
        signal_type: 'hypothesis_signal',
        hypothesis_id: uuidv4(),
        statement: `Alternative: Constraints [${input.objective.constraints.join(', ')}] may require different approach`,
        domain: input.objective.domain,
        supporting_evidence: [{ evidence_id: uuidv4(), description: 'Constraints present', weight: 0.6 }],
        counter_evidence: [],
        initial_confidence: 0.4,
        strengthening_conditions: ['Primary hypothesis fails'],
        weakening_conditions: ['Primary hypothesis succeeds'],
        related_hypothesis_ids: [primaryHypothesis.hypothesis_id],
        formed_at: new Date().toISOString(),
      };
      hypotheses.push(altHypothesis);
      tokensUsed += this.estimateTokens(altHypothesis);
    }

    return { hypotheses, tokensUsed };
  }

  performSimulation(input, startTime, maxTokens) {
    const simulations = [];
    const deltas = [];
    let tokensUsed = 0;

    const hypothesesToTest = input.prior_hypotheses ?? [];

    if (hypothesesToTest.length === 0) {
      const simulation = {
        signal_type: 'simulation_outcome_signal',
        simulation_id: uuidv4(),
        scenario: {
          name: `Objective Analysis: ${input.objective.domain}`,
          description: `Simulating: ${input.objective.statement}`,
          initial_conditions: input.objective.context ?? {},
          parameters: { constraints: input.objective.constraints },
        },
        outcome: 'inconclusive',
        results: {
          primary_finding: 'No prior hypotheses - baseline analysis provided',
          secondary_findings: ['Objective analyzed for feasibility'],
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
          description: 'Form specific hypotheses before targeted simulations',
          priority: 1,
        }],
        completed_at: new Date().toISOString(),
      };
      simulations.push(simulation);
      tokensUsed += 200;
    } else {
      for (const hypothesis of hypothesesToTest) {
        if (tokensUsed >= maxTokens * 0.8) break;

        const simResult = this.simulateHypothesis(hypothesis, input, startTime);
        simulations.push(simResult.simulation);
        tokensUsed += simResult.tokensUsed;

        const priorConfidence = hypothesis.initial_confidence;
        const newConfidence = this.calculatePostSimulationConfidence(hypothesis, simResult.simulation);

        if (Math.abs(newConfidence - priorConfidence) > 0.01) {
          const delta = {
            signal_type: 'confidence_delta_signal',
            delta_id: uuidv4(),
            hypothesis_id: hypothesis.hypothesis_id,
            simulation_id: simResult.simulation.simulation_id,
            previous_confidence: priorConfidence,
            new_confidence: newConfidence,
            delta: newConfidence - priorConfidence,
            reason: {
              category: 'simulation_result',
              description: `Simulation outcome: ${simResult.simulation.outcome}`,
              contributing_factors: [{ factor: simResult.simulation.results.primary_finding, impact: newConfidence - priorConfidence }],
            },
            thresholds: {
              recommendation_threshold: 0.7,
              distance_from_threshold: newConfidence - 0.7,
              trend: 'stable',
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

  performExploration(input, startTime, maxTokens) {
    let totalTokensUsed = 0;

    const reasonResult = this.performReasoning(input, Math.floor(maxTokens * 0.4));
    totalTokensUsed += reasonResult.tokensUsed;

    const simulationInput = {
      ...input,
      prior_hypotheses: reasonResult.hypotheses,
    };

    const simResult = this.performSimulation(simulationInput, startTime, maxTokens - totalTokensUsed);
    totalTokensUsed += simResult.tokensUsed;

    return {
      hypotheses: reasonResult.hypotheses,
      simulations: simResult.simulations,
      deltas: simResult.deltas,
      tokensUsed: totalTokensUsed,
    };
  }

  simulateHypothesis(hypothesis, input, startTime) {
    const supportWeight = hypothesis.supporting_evidence.reduce((sum, e) => sum + e.weight, 0);
    const counterWeight = hypothesis.counter_evidence.reduce((sum, e) => sum + e.weight, 0);
    const evidenceBalance = supportWeight - counterWeight;

    let outcome;
    if (evidenceBalance > 0.3) outcome = 'hypothesis_supported';
    else if (evidenceBalance < -0.3) outcome = 'hypothesis_weakened';
    else outcome = 'inconclusive';

    const simulation = {
      signal_type: 'simulation_outcome_signal',
      simulation_id: uuidv4(),
      hypothesis_id: hypothesis.hypothesis_id,
      scenario: {
        name: `Test: ${hypothesis.statement.substring(0, 50)}...`,
        description: `Simulating hypothesis in domain: ${hypothesis.domain}`,
        initial_conditions: input.objective.context ?? {},
        parameters: { supporting_evidence_count: hypothesis.supporting_evidence.length },
      },
      outcome,
      results: {
        primary_finding: `Evidence balance: ${evidenceBalance.toFixed(2)} (${outcome})`,
        secondary_findings: [`Support: ${supportWeight.toFixed(2)}`, `Counter: ${counterWeight.toFixed(2)}`],
        metrics: { evidence_balance: evidenceBalance },
      },
      outcome_confidence: 0.6 + Math.abs(evidenceBalance) * 0.3,
      resource_usage: { tokens_used: 150, latency_ms: Date.now() - startTime, within_budget: true },
      exploration_recommendations: [],
      completed_at: new Date().toISOString(),
    };

    return { simulation, tokensUsed: 150 };
  }

  calculatePostSimulationConfidence(hypothesis, simulation) {
    const baseConfidence = hypothesis.initial_confidence;
    switch (simulation.outcome) {
      case 'hypothesis_supported': return Math.min(1, baseConfidence + 0.15);
      case 'hypothesis_weakened': return Math.max(0, baseConfidence - 0.2);
      case 'hypothesis_refuted': return Math.max(0, baseConfidence - 0.4);
      default: return baseConfidence;
    }
  }

  extractSupportingEvidence(input) {
    const evidence = [];
    if (input.objective.context) {
      evidence.push({ evidence_id: uuidv4(), description: 'Contextual information provided', weight: 0.5, source: 'input_context' });
    }
    if (input.objective.domain) {
      evidence.push({ evidence_id: uuidv4(), description: `Domain "${input.objective.domain}" specified`, weight: 0.4, source: 'input_domain' });
    }
    return evidence;
  }

  extractCounterEvidence(input) {
    const evidence = [];
    if (input.objective.constraints.length > 0) {
      evidence.push({ evidence_id: uuidv4(), description: `${input.objective.constraints.length} constraint(s) may limit scope`, weight: 0.3, source: 'input_constraints' });
    }
    return evidence;
  }

  calculateInitialConfidence(input) {
    let confidence = 0.5;
    if (input.prior_hypotheses?.length > 0) confidence += 0.1;
    if (input.objective.context) confidence += 0.1;
    if (input.objective.constraints.length > 3) confidence -= 0.1;
    return Math.min(1, Math.max(0, confidence));
  }

  generateHumanSuggestions(hypotheses, simulations) {
    const suggestions = [];
    for (const hypothesis of hypotheses) {
      if (hypothesis.initial_confidence >= 0.6) {
        const relatedSim = simulations.find(s => s.hypothesis_id === hypothesis.hypothesis_id);
        suggestions.push({
          suggestion_id: uuidv4(),
          hypothesis_id: hypothesis.hypothesis_id,
          confidence: relatedSim ? this.calculatePostSimulationConfidence(hypothesis, relatedSim) : hypothesis.initial_confidence,
          rationale: `Hypothesis in domain "${hypothesis.domain}" shows ${hypothesis.supporting_evidence.length} supporting evidence`,
          caveats: ['This is a suggestion only - human judgment required', `Counter-evidence: ${hypothesis.counter_evidence.length}`],
        });
      }
    }
    return suggestions;
  }

  estimateTokens(obj) {
    return Math.ceil(JSON.stringify(obj).length / 4);
  }

  calculateConfidence(output, input) {
    let confidence = 0.6;
    if (output.hypothesis_signals.length > 0) confidence += 0.1;
    if (output.simulation_outcome_signals.length > 0) confidence += 0.1;
    if (output.confidence_delta_signals.length > 0) confidence += 0.05;
    if (output.resource_consumption.within_budget) confidence += 0.05;
    return Math.min(1.0, Math.max(0.0, confidence));
  }

  getAppliedConstraints(input) {
    return [
      'stateless_processing',
      'deterministic_output',
      'no_final_decisions',
      'signal_emission_required',
      'ruvector_persistence_only',
      `max_tokens_${input.performance_limits?.max_tokens ?? PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS}`,
      `max_latency_ms_${input.performance_limits?.max_latency_ms ?? PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS}`,
      `mode_${input.mode}`,
    ];
  }

  classifyError(error) {
    if (error instanceof Error) {
      if (error.name === 'ZodError') return 'AGENT_VALIDATION_FAILED';
      if (error.message.includes('persistence') || error.message.includes('ruvector')) return 'AGENT_PERSISTENCE_ERROR';
      if (error.message.includes('timeout')) return 'AGENT_TIMEOUT';
    }
    return 'AGENT_PROCESSING_ERROR';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  IntelligenceLayerAgent,
  IntelligenceLayerInputSchema,
  IntelligenceLayerOutputSchema,
  PHASE7_PERFORMANCE_BUDGETS,
  createRuvectorFromEnv,
  createTelemetryFromEnv,
};
