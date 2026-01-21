/**
 * Reflection Agent
 *
 * Purpose: Analyze DecisionEvents to extract learning and quality signals
 * Classification: POST_EXECUTION_ANALYSIS, QUALITY_ASSESSMENT
 * decision_type: reflection_analysis
 *
 * Scope:
 * - Evaluate outcomes
 * - Identify gaps and inefficiencies
 * - Produce improvement insights
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
 * - Modify behavior
 * - Trigger retries
 * - Apply optimizations
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
  DecisionEvent,
  ReflectionInputSchema,
  ReflectionOutputSchema,
  ReflectionInput,
  ReflectionOutput,
  QualitySignal,
  LearningSignal,
  GapAnalysis,
  OutcomeEvaluation,
} from '../contracts';
import { RuvectorPersistence } from './ruvector-persistence';
import { Telemetry } from './telemetry';

const AGENT_ID = 'reflection-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'reflection_analysis';

/**
 * Reflection Agent Implementation
 *
 * This agent analyzes DecisionEvents and produces quality/learning signals.
 * It is purely analytical - it NEVER modifies behavior, triggers retries, or applies optimizations.
 */
export class ReflectionAgent implements BaseAgent<ReflectionInput, ReflectionOutput> {
  readonly metadata: AgentMetadata = {
    id: AGENT_ID,
    name: 'Reflection Agent',
    version: AGENT_VERSION,
    classifications: [
      AgentClassification.POST_EXECUTION_ANALYSIS,
      AgentClassification.QUALITY_ASSESSMENT,
    ],
    decision_type: DECISION_TYPE,
    description: 'Analyzes DecisionEvents to extract learning and quality signals for continuous improvement insights.',
  };

  private readonly persistence: RuvectorPersistence;
  private readonly telemetry: Telemetry;

  constructor(persistence: RuvectorPersistence, telemetry: Telemetry) {
    this.persistence = persistence;
    this.telemetry = telemetry;
  }

  /**
   * Validate input against ReflectionInputSchema
   */
  validateInput(input: unknown): ReflectionInput {
    return ReflectionInputSchema.parse(input);
  }

  /**
   * Invoke the reflection agent
   *
   * DETERMINISTIC: Same input always produces same output structure
   * STATELESS: No internal state modified
   * NON-BLOCKING: Fully async
   */
  async invoke(input: ReflectionInput, executionRef: string): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Emit telemetry start
      this.telemetry.recordStart(AGENT_ID, executionRef, input);

      // Perform reflection analysis (pure analysis, no side effects)
      const output = this.analyzeDecisionEvents(input);

      // Validate output
      const validatedOutput = ReflectionOutputSchema.parse(output);

      // Calculate confidence based on analysis quality
      const confidence = this.calculateConfidence(validatedOutput, input);

      // Constraints applied during reflection
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

      // Persist via ruvector-service ONLY
      await this.persistence.store(event);

      // Emit telemetry success
      this.telemetry.recordSuccess(AGENT_ID, executionRef, Date.now() - startTime);

      return {
        status: 'success',
        event,
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
   * Analyze DecisionEvents and produce reflection output
   *
   * This is the core reflection logic - purely analytical.
   * NEVER modifies behavior, triggers retries, or applies optimizations.
   */
  private analyzeDecisionEvents(input: ReflectionInput): ReflectionOutput {
    const reflectionId = uuidv4();
    const events = input.decision_events;
    const focusAreas = input.context?.focus_areas || ['all'];
    const preferences = input.preferences;
    const minConfidence = preferences?.min_confidence ?? 0.5;
    const maxSignalsPerCategory = preferences?.max_signals_per_category ?? 10;

    // Extract unique agents analyzed
    const agentsAnalyzed = [...new Set(events.map(e => e.agent_id))];

    // Determine time range
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    const analysisTimeRange = {
      earliest: new Date(Math.min(...timestamps)).toISOString(),
      latest: new Date(Math.max(...timestamps)).toISOString(),
    };

    // Perform analysis based on focus areas
    const includeAll = focusAreas.includes('all');

    const outcomeEvaluations = (includeAll || focusAreas.includes('outcomes'))
      ? this.evaluateOutcomes(events)
      : [];

    const qualitySignals = (includeAll || focusAreas.includes('quality'))
      ? this.extractQualitySignals(events, minConfidence).slice(0, maxSignalsPerCategory)
      : [];

    const learningSignals = (includeAll || focusAreas.includes('learning'))
      ? this.extractLearningSignals(events, minConfidence).slice(0, maxSignalsPerCategory)
      : [];

    const gapAnalysis = (includeAll || focusAreas.includes('gaps'))
      ? this.identifyGaps(events, outcomeEvaluations).slice(0, maxSignalsPerCategory)
      : [];

    // Find correlations if enabled
    const correlations = (preferences?.correlate_events ?? true)
      ? this.findCorrelations(events)
      : [];

    // Generate summary
    const summary = this.generateSummary(
      outcomeEvaluations,
      qualitySignals,
      learningSignals,
      gapAnalysis
    );

    return {
      reflection_id: reflectionId,
      events_analyzed: events.length,
      agents_analyzed: agentsAnalyzed,
      analysis_time_range: analysisTimeRange,
      outcome_evaluations: outcomeEvaluations,
      quality_signals: qualitySignals,
      learning_signals: learningSignals,
      gap_analysis: gapAnalysis,
      correlations,
      summary,
      version: '1.0.0',
    };
  }

  /**
   * Evaluate outcomes for each decision event
   */
  private evaluateOutcomes(events: DecisionEvent[]): OutcomeEvaluation[] {
    return events.map(event => {
      const dimensions = this.assessDimensions(event);
      const outcomeScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
      const metExpectations = outcomeScore >= 0.7 && event.confidence >= 0.6;

      return {
        decision_ref: event.execution_ref,
        agent_id: event.agent_id,
        decision_type: event.decision_type,
        outcome_score: Math.round(outcomeScore * 100) / 100,
        summary: this.generateOutcomeSummary(event, outcomeScore),
        dimensions,
        met_expectations: metExpectations,
        deviation_notes: metExpectations
          ? undefined
          : this.generateDeviationNotes(event, outcomeScore),
      };
    });
  }

  /**
   * Assess quality dimensions for a decision event
   */
  private assessDimensions(event: DecisionEvent): Array<{ name: string; score: number; notes?: string }> {
    const dimensions: Array<{ name: string; score: number; notes?: string }> = [];

    // Confidence dimension
    dimensions.push({
      name: 'confidence',
      score: event.confidence,
      notes: event.confidence < 0.5 ? 'Low confidence indicates uncertainty' : undefined,
    });

    // Completeness dimension (based on constraints applied)
    const completenessScore = Math.min(1, event.constraints_applied.length / 5);
    dimensions.push({
      name: 'completeness',
      score: completenessScore,
      notes: completenessScore < 0.5 ? 'Few constraints applied' : undefined,
    });

    // Determinism dimension (based on inputs_hash presence and validity)
    const determinismScore = event.inputs_hash.length === 64 ? 1.0 : 0.5;
    dimensions.push({
      name: 'determinism',
      score: determinismScore,
      notes: determinismScore < 1 ? 'Input hashing may be incomplete' : undefined,
    });

    // Output quality dimension (analyze output structure)
    const outputScore = this.assessOutputQuality(event.outputs);
    dimensions.push({
      name: 'output_quality',
      score: outputScore,
      notes: outputScore < 0.6 ? 'Output structure may be incomplete' : undefined,
    });

    return dimensions;
  }

  /**
   * Assess quality of event outputs
   */
  private assessOutputQuality(outputs: unknown): number {
    if (!outputs) return 0.3;
    if (typeof outputs !== 'object') return 0.5;

    const obj = outputs as Record<string, unknown>;
    const keys = Object.keys(obj);

    // More structured outputs get higher scores
    if (keys.length === 0) return 0.4;
    if (keys.length < 3) return 0.6;
    if (keys.length < 6) return 0.8;
    return 0.9;
  }

  /**
   * Generate outcome summary
   */
  private generateOutcomeSummary(event: DecisionEvent, score: number): string {
    const quality = score >= 0.8 ? 'high' : score >= 0.6 ? 'acceptable' : 'needs improvement';
    return `${event.decision_type} from ${event.agent_id} produced ${quality} quality output with ${(event.confidence * 100).toFixed(0)}% confidence`;
  }

  /**
   * Generate deviation notes
   */
  private generateDeviationNotes(event: DecisionEvent, score: number): string {
    const issues: string[] = [];
    if (event.confidence < 0.6) issues.push('low confidence');
    if (score < 0.7) issues.push('suboptimal outcome score');
    return `Decision deviated from expectations due to: ${issues.join(', ')}`;
  }

  /**
   * Extract quality signals from events
   */
  private extractQualitySignals(events: DecisionEvent[], minConfidence: number): QualitySignal[] {
    const signals: QualitySignal[] = [];
    let signalCounter = 0;

    // Aggregate confidence analysis
    const avgConfidence = events.reduce((sum, e) => sum + e.confidence, 0) / events.length;
    if (avgConfidence >= minConfidence) {
      signals.push({
        signal_id: `qs-${++signalCounter}`,
        type: 'accuracy',
        value: avgConfidence,
        description: `Average decision confidence across ${events.length} events`,
        evidence: [`Calculated from ${events.length} DecisionEvents`],
        severity: avgConfidence < 0.5 ? 'warning' : undefined,
      });
    }

    // Performance signal based on constraint coverage
    const avgConstraints = events.reduce((sum, e) => sum + e.constraints_applied.length, 0) / events.length;
    const constraintScore = Math.min(1, avgConstraints / 6);
    if (constraintScore >= minConfidence) {
      signals.push({
        signal_id: `qs-${++signalCounter}`,
        type: 'completeness',
        value: constraintScore,
        description: `Average constraint coverage across decisions`,
        evidence: [`Average ${avgConstraints.toFixed(1)} constraints per decision`],
      });
    }

    // Consistency signal - check for similar decision types
    const decisionTypeCounts = new Map<string, number>();
    events.forEach(e => {
      decisionTypeCounts.set(e.decision_type, (decisionTypeCounts.get(e.decision_type) || 0) + 1);
    });
    const consistencyScore = Math.min(1, 1 / decisionTypeCounts.size);
    signals.push({
      signal_id: `qs-${++signalCounter}`,
      type: 'consistency',
      value: consistencyScore,
      description: `Decision type consistency across analyzed events`,
      evidence: [`${decisionTypeCounts.size} unique decision types found`],
    });

    // Reliability signal based on agent version consistency
    const agentVersions = new Set(events.map(e => `${e.agent_id}@${e.agent_version}`));
    const reliabilityScore = events.length / agentVersions.size / events.length;
    signals.push({
      signal_id: `qs-${++signalCounter}`,
      type: 'reliability',
      value: Math.min(1, reliabilityScore),
      description: `Agent version stability across decisions`,
      evidence: [`${agentVersions.size} unique agent versions`],
    });

    return signals;
  }

  /**
   * Extract learning signals from events
   */
  private extractLearningSignals(events: DecisionEvent[], minConfidence: number): LearningSignal[] {
    const signals: LearningSignal[] = [];
    let learningCounter = 0;

    // Pattern: High-confidence decisions
    const highConfidenceEvents = events.filter(e => e.confidence >= 0.8);
    if (highConfidenceEvents.length > 0) {
      signals.push({
        learning_id: `ls-${++learningCounter}`,
        category: 'pattern',
        title: 'High-Confidence Decision Pattern',
        description: `${highConfidenceEvents.length} decisions achieved high confidence (>=0.8)`,
        confidence: highConfidenceEvents.length / events.length,
        affected_agents: [...new Set(highConfidenceEvents.map(e => e.agent_id))],
        recommendations: [
          'Study common characteristics of high-confidence decisions',
          'Identify input patterns that lead to confident outputs',
        ],
      });
    }

    // Anti-pattern: Low-confidence decisions
    const lowConfidenceEvents = events.filter(e => e.confidence < 0.5);
    if (lowConfidenceEvents.length > 0 && lowConfidenceEvents.length / events.length >= minConfidence * 0.5) {
      signals.push({
        learning_id: `ls-${++learningCounter}`,
        category: 'anti_pattern',
        title: 'Low-Confidence Decision Pattern',
        description: `${lowConfidenceEvents.length} decisions had low confidence (<0.5)`,
        confidence: Math.min(1, lowConfidenceEvents.length / events.length + 0.3),
        affected_agents: [...new Set(lowConfidenceEvents.map(e => e.agent_id))],
        recommendations: [
          'Investigate causes of low confidence',
          'Review input quality for affected decisions',
        ],
      });
    }

    // Optimization: Constraint utilization
    const constraintPatterns = this.analyzeConstraintPatterns(events);
    if (constraintPatterns.underutilized.length > 0) {
      signals.push({
        learning_id: `ls-${++learningCounter}`,
        category: 'optimization',
        title: 'Constraint Utilization Opportunity',
        description: `Some decisions apply fewer constraints than optimal`,
        confidence: 0.7,
        affected_agents: constraintPatterns.underutilized,
        recommendations: [
          'Review constraint application consistency',
          'Ensure all relevant constraints are considered',
        ],
      });
    }

    // Edge case detection
    const outlierEvents = this.detectOutliers(events);
    if (outlierEvents.length > 0) {
      signals.push({
        learning_id: `ls-${++learningCounter}`,
        category: 'edge_case',
        title: 'Outlier Decision Detection',
        description: `${outlierEvents.length} decisions exhibited unusual characteristics`,
        confidence: 0.65,
        affected_agents: [...new Set(outlierEvents.map(e => e.agent_id))],
        recommendations: [
          'Review outlier decisions for edge cases',
          'Consider adding handling for unusual input patterns',
        ],
      });
    }

    return signals;
  }

  /**
   * Analyze constraint usage patterns
   */
  private analyzeConstraintPatterns(events: DecisionEvent[]): { underutilized: string[] } {
    const agentConstraintCounts = new Map<string, number[]>();

    events.forEach(e => {
      const counts = agentConstraintCounts.get(e.agent_id) || [];
      counts.push(e.constraints_applied.length);
      agentConstraintCounts.set(e.agent_id, counts);
    });

    const underutilized: string[] = [];
    agentConstraintCounts.forEach((counts, agentId) => {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      if (avg < 3) underutilized.push(agentId);
    });

    return { underutilized };
  }

  /**
   * Detect outlier events
   */
  private detectOutliers(events: DecisionEvent[]): DecisionEvent[] {
    if (events.length < 3) return [];

    const confidences = events.map(e => e.confidence);
    const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const stdDev = Math.sqrt(
      confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length
    );

    // Outliers are more than 2 standard deviations from mean
    return events.filter(e => Math.abs(e.confidence - mean) > 2 * stdDev);
  }

  /**
   * Identify gaps in the analyzed events
   */
  private identifyGaps(events: DecisionEvent[], outcomes: OutcomeEvaluation[]): GapAnalysis[] {
    const gaps: GapAnalysis[] = [];
    let gapCounter = 0;

    // Check for coverage gaps - decision types that should exist
    const decisionTypes = new Set(events.map(e => e.decision_type));
    if (decisionTypes.size === 1 && events.length > 5) {
      gaps.push({
        gap_id: `gap-${++gapCounter}`,
        type: 'coverage',
        title: 'Limited Decision Type Coverage',
        description: 'Only one decision type analyzed, limiting cross-functional insights',
        impact: 'medium',
        affected_steps: [],
        evidence: [`Single decision type: ${[...decisionTypes][0]}`],
      });
    }

    // Check for process gaps - low outcome scores
    const lowOutcomes = outcomes.filter(o => o.outcome_score < 0.6);
    if (lowOutcomes.length > outcomes.length * 0.3) {
      gaps.push({
        gap_id: `gap-${++gapCounter}`,
        type: 'process',
        title: 'High Rate of Suboptimal Outcomes',
        description: `${lowOutcomes.length} of ${outcomes.length} decisions had low outcome scores`,
        impact: 'high',
        affected_steps: lowOutcomes.map(o => o.decision_ref),
        evidence: [`${((lowOutcomes.length / outcomes.length) * 100).toFixed(0)}% suboptimal rate`],
      });
    }

    // Check for data gaps - missing or incomplete outputs
    const incompleteEvents = events.filter(e => !e.outputs || Object.keys(e.outputs as object).length < 2);
    if (incompleteEvents.length > 0) {
      gaps.push({
        gap_id: `gap-${++gapCounter}`,
        type: 'data',
        title: 'Incomplete Decision Outputs',
        description: `${incompleteEvents.length} decisions have minimal or missing outputs`,
        impact: incompleteEvents.length > events.length * 0.5 ? 'high' : 'medium',
        affected_steps: incompleteEvents.map(e => e.execution_ref),
        evidence: [`${incompleteEvents.length} events with sparse outputs`],
      });
    }

    // Check for expectations gap
    const unmetExpectations = outcomes.filter(o => !o.met_expectations);
    if (unmetExpectations.length > outcomes.length * 0.2) {
      gaps.push({
        gap_id: `gap-${++gapCounter}`,
        type: 'capability',
        title: 'Expectations Gap',
        description: 'Significant portion of decisions did not meet expectations',
        impact: 'high',
        affected_steps: unmetExpectations.map(o => o.decision_ref),
        evidence: [`${unmetExpectations.length} decisions below expectations`],
      });
    }

    return gaps;
  }

  /**
   * Find correlations between events
   */
  private findCorrelations(events: DecisionEvent[]): ReflectionOutput['correlations'] {
    const correlations: ReflectionOutput['correlations'] = [];
    let corrCounter = 0;

    if (events.length < 2) return correlations;

    // Temporal correlation - events close in time
    const sortedByTime = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < sortedByTime.length - 1; i++) {
      const timeDiff = new Date(sortedByTime[i + 1].timestamp).getTime() -
                       new Date(sortedByTime[i].timestamp).getTime();

      // If events are within 1 minute, they may be related
      if (timeDiff < 60000 && sortedByTime[i].agent_id !== sortedByTime[i + 1].agent_id) {
        correlations.push({
          correlation_id: `corr-${++corrCounter}`,
          type: 'temporal',
          event_refs: [sortedByTime[i].execution_ref, sortedByTime[i + 1].execution_ref],
          description: `Sequential decisions by different agents within ${(timeDiff / 1000).toFixed(0)}s`,
          strength: Math.min(1, 1 - (timeDiff / 60000)),
        });
      }
    }

    // Similarity correlation - same decision type, similar confidence
    const byDecisionType = new Map<string, DecisionEvent[]>();
    events.forEach(e => {
      const existing = byDecisionType.get(e.decision_type) || [];
      existing.push(e);
      byDecisionType.set(e.decision_type, existing);
    });

    byDecisionType.forEach((typeEvents, decisionType) => {
      if (typeEvents.length >= 2) {
        const confidences = typeEvents.map(e => e.confidence);
        const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;

        // Low variance indicates similarity
        if (variance < 0.05) {
          correlations.push({
            correlation_id: `corr-${++corrCounter}`,
            type: 'similarity',
            event_refs: typeEvents.map(e => e.execution_ref),
            description: `${typeEvents.length} ${decisionType} decisions with consistent confidence patterns`,
            strength: 1 - Math.sqrt(variance),
          });
        }
      }
    });

    return correlations.slice(0, 10); // Limit to top 10 correlations
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(
    outcomes: OutcomeEvaluation[],
    qualitySignals: QualitySignal[],
    learningSignals: LearningSignal[],
    gaps: GapAnalysis[]
  ): ReflectionOutput['summary'] {
    const outcomeScores = outcomes.map(o => o.outcome_score);
    const overallQuality = outcomeScores.length > 0
      ? outcomeScores.reduce((a, b) => a + b, 0) / outcomeScores.length
      : 0.5;

    const expectationsMetCount = outcomes.filter(o => o.met_expectations).length;
    const expectationsMetRate = outcomes.length > 0
      ? expectationsMetCount / outcomes.length
      : 0;

    const keyFindings: string[] = [];
    const improvementSuggestions: string[] = [];

    // Generate key findings
    if (overallQuality >= 0.8) {
      keyFindings.push('Overall decision quality is high');
    } else if (overallQuality < 0.6) {
      keyFindings.push('Decision quality needs attention');
      improvementSuggestions.push('Review low-scoring decisions for common issues');
    }

    if (expectationsMetRate >= 0.9) {
      keyFindings.push('Decisions consistently meet expectations');
    } else if (expectationsMetRate < 0.7) {
      keyFindings.push('Expectations gap detected in decision outcomes');
      improvementSuggestions.push('Calibrate expectation thresholds or improve decision confidence');
    }

    // Add findings from signals
    const highValuePatterns = learningSignals.filter(s => s.category === 'pattern' && s.confidence >= 0.7);
    if (highValuePatterns.length > 0) {
      keyFindings.push(`${highValuePatterns.length} high-value patterns identified for replication`);
    }

    const criticalGaps = gaps.filter(g => g.impact === 'critical' || g.impact === 'high');
    if (criticalGaps.length > 0) {
      keyFindings.push(`${criticalGaps.length} high-impact gaps require attention`);
      criticalGaps.forEach(g => {
        improvementSuggestions.push(`Address ${g.type} gap: ${g.title}`);
      });
    }

    return {
      overall_quality_score: Math.round(overallQuality * 100) / 100,
      total_quality_signals: qualitySignals.length,
      total_learning_signals: learningSignals.length,
      total_gaps: gaps.length,
      expectations_met_rate: Math.round(expectationsMetRate * 100) / 100,
      key_findings: keyFindings,
      improvement_suggestions: improvementSuggestions,
    };
  }

  /**
   * Calculate confidence score for reflection analysis
   */
  private calculateConfidence(output: ReflectionOutput, input: ReflectionInput): number {
    let confidence = 0.6; // Base confidence

    // More events analyzed = more confident in patterns
    if (output.events_analyzed >= 10) confidence += 0.1;
    if (output.events_analyzed >= 50) confidence += 0.05;

    // Multiple agents analyzed = broader perspective
    if (output.agents_analyzed.length > 1) confidence += 0.05;

    // Found signals = meaningful analysis
    if (output.quality_signals.length > 0) confidence += 0.05;
    if (output.learning_signals.length > 0) confidence += 0.05;

    // Found correlations = deeper insights
    if (output.correlations.length > 0) confidence += 0.05;

    // Reduce for too few events
    if (output.events_analyzed < 3) confidence -= 0.1;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Get constraints applied during reflection
   */
  private getAppliedConstraints(input: ReflectionInput): string[] {
    const constraints = [
      'read_only_analysis',
      'no_behavior_modification',
      'no_retry_triggering',
      'no_optimization_application',
      'informational_output_only',
      'deterministic_analysis',
    ];

    // Add context-specific constraints
    if (input.context?.focus_areas) {
      constraints.push(`focus_areas:${input.context.focus_areas.join(',')}`);
    }

    if (input.preferences?.min_confidence) {
      constraints.push(`min_confidence:${input.preferences.min_confidence}`);
    }

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
    }
    return AgentErrorCodes.PROCESSING_ERROR;
  }
}
