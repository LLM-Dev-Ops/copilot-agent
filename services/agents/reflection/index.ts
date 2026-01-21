/**
 * Reflection Agent Module Exports
 *
 * Purpose: Analyze DecisionEvents to extract learning and quality signals
 * Classification: POST_EXECUTION_ANALYSIS, QUALITY_ASSESSMENT
 * decision_type: reflection_analysis
 */

export { ReflectionAgent } from './reflection-agent';
export { RuvectorPersistence, createRuvectorFromEnv } from './ruvector-persistence';
export { Telemetry, createTelemetryFromEnv } from './telemetry';

// Re-export schemas from contracts
export {
  ReflectionInputSchema,
  ReflectionOutputSchema,
  QualitySignalSchema,
  LearningSignalSchema,
  GapAnalysisSchema,
  OutcomeEvaluationSchema,
  type ReflectionInput,
  type ReflectionOutput,
  type QualitySignal,
  type LearningSignal,
  type GapAnalysis,
  type OutcomeEvaluation,
} from '../contracts';
