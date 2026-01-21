/**
 * Agentics Contracts - Canonical Schema Exports
 *
 * ALL schemas MUST be imported from this module.
 * No inline schemas. No inferred schemas. No dynamic schema mutation.
 */

// Decision Event
export {
  DecisionEventSchema,
  type DecisionEvent,
  hashInputs,
  createDecisionEvent,
} from './decision-event';

// Base Agent
export {
  AgentClassification,
  type AgentClassificationType,
  AgentMetadataSchema,
  type AgentMetadata,
  AgentResultSchema,
  type AgentResult,
  type BaseAgent,
  AgentErrorCodes,
  type AgentErrorCode,
  createErrorResult,
} from './base-agent';

// Planner Agent
export {
  PlannerInputSchema,
  type PlannerInput,
  PlannerOutputSchema,
  type PlannerOutput,
  PlanStepSchema,
  type PlanStep,
  DependencySchema,
  type Dependency,
} from './planner-schemas';

// Reflection Agent
export {
  ReflectionInputSchema,
  type ReflectionInput,
  ReflectionOutputSchema,
  type ReflectionOutput,
  QualitySignalSchema,
  type QualitySignal,
  LearningSignalSchema,
  type LearningSignal,
  GapAnalysisSchema,
  type GapAnalysis,
  OutcomeEvaluationSchema,
  type OutcomeEvaluation,
} from './reflection-schemas';

// Meta-Reasoner Agent
export {
  ReasoningTraceSchema,
  type ReasoningTrace,
  MetaReasonerInputSchema,
  type MetaReasonerInput,
  MetaReasonerOutputSchema,
  type MetaReasonerOutput,
  ContradictionSchema,
  type Contradiction,
  ConfidenceCalibrationSchema,
  type ConfidenceCalibration,
  SystemicIssueSchema,
  type SystemicIssue,
  ReasoningQualityMetricsSchema,
  type ReasoningQualityMetrics,
} from './meta-reasoner-schemas';

// Objective Clarifier Agent
export {
  ObjectiveClarifierInputSchema,
  type ObjectiveClarifierInput,
  ObjectiveClarifierOutputSchema,
  type ObjectiveClarifierOutput,
  AmbiguitySchema,
  type Ambiguity,
  MissingConstraintSchema,
  type MissingConstraint,
  NormalizedGoalSchema,
  type NormalizedGoal,
} from './objective-clarifier-schemas';

// Intent Classifier Agent
export {
  IntentType,
  type IntentTypeValue,
  IntentSignalSchema,
  type IntentSignal,
  ClassifiedIntentSchema,
  type ClassifiedIntent,
  MultiIntentStateSchema,
  type MultiIntentState,
  IntentClassifierInputSchema,
  type IntentClassifierInput,
  IntentClassifierOutputSchema,
  type IntentClassifierOutput,
} from './intent-classifier-schemas';

// Config Validation Agent
export {
  ValidationSeverity,
  type ValidationSeverityType,
  ValidationCategory,
  type ValidationCategoryType,
  ValidationFindingSchema,
  type ValidationFinding,
  SchemaValidationResultSchema,
  type SchemaValidationResult,
  SemanticConstraintSchema,
  type SemanticConstraint,
  DeprecatedValueSchema,
  type DeprecatedValue,
  UnsafeConfigSchema,
  type UnsafeConfig,
  ConfigConflictSchema,
  type ConfigConflict,
  MissingConfigSchema,
  type MissingConfig,
  ReadinessAssessmentSchema,
  type ReadinessAssessment,
  ConfigValidationInputSchema,
  type ConfigValidationInput,
  ConfigValidationOutputSchema,
  type ConfigValidationOutput,
} from './config-validation-schemas';
