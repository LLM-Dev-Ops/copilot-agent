/**
 * Intelligence Layer Agent Module Exports - Phase 7 (Layer 2)
 *
 * Purpose: Perform reasoning, simulation, and exploration with signal emission
 * Classification: META_ANALYSIS, REASONING_QUALITY_ASSESSMENT
 * decision_type: intelligence_layer_analysis
 *
 * Role Clarity:
 * - Agents MAY: reason, simulate, explore
 * - Agents MUST: emit signals, avoid final decisions
 *
 * DecisionEvent Rules - MUST emit:
 * - hypothesis_signal
 * - simulation_outcome_signal
 * - confidence_delta_signal
 *
 * Performance Budgets:
 * - MAX_TOKENS=2500
 * - MAX_LATENCY_MS=5000
 */

export { IntelligenceLayerAgent } from './intelligence-agent';
export { createTelemetryFromEnv, Telemetry } from './telemetry';

// Re-export schemas from contracts
export {
  PHASE7_PERFORMANCE_BUDGETS,
  HypothesisSignalSchema,
  HypothesisSignal,
  SimulationOutcomeSignalSchema,
  SimulationOutcomeSignal,
  ConfidenceDeltaSignalSchema,
  ConfidenceDeltaSignal,
  IntelligenceLayerInputSchema,
  IntelligenceLayerInput,
  IntelligenceLayerOutputSchema,
  IntelligenceLayerOutput,
} from '../contracts';
