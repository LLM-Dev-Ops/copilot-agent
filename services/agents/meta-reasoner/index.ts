/**
 * Meta-Reasoner Agent Module Exports
 *
 * Purpose: Evaluate reasoning quality and consistency across agents
 * Classification: META_ANALYSIS, REASONING_QUALITY_ASSESSMENT
 * decision_type: meta_reasoning_analysis
 */

export { MetaReasonerAgent } from './meta-reasoner-agent';
export { createTelemetryFromEnv, Telemetry } from './telemetry';

// Re-export schemas from contracts
export {
  MetaReasonerInputSchema,
  MetaReasonerInput,
  MetaReasonerOutputSchema,
  MetaReasonerOutput,
  ReasoningTraceSchema,
  ReasoningTrace,
  ContradictionSchema,
  Contradiction,
  ConfidenceCalibrationSchema,
  ConfidenceCalibration,
  SystemicIssueSchema,
  SystemicIssue,
  ReasoningQualityMetricsSchema,
  ReasoningQualityMetrics,
} from '../contracts';
