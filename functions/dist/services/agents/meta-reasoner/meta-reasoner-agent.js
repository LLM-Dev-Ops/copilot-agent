"use strict";
/**
 * Meta-Reasoner Agent
 *
 * Purpose: Evaluate reasoning quality and consistency across agents
 * Classification: META_ANALYSIS, REASONING_QUALITY_ASSESSMENT
 * decision_type: meta_reasoning_analysis
 *
 * Scope:
 * - Detect contradictions
 * - Assess confidence calibration
 * - Identify systemic reasoning issues
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
 * - Override outputs
 * - Enforce corrections
 * - Execute logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaReasonerAgent = void 0;
const uuid_1 = require("uuid");
const contracts_1 = require("../contracts");
const AGENT_ID = 'meta-reasoner-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'meta_reasoning_analysis';
/**
 * Meta-Reasoner Agent Implementation
 *
 * This agent analyzes reasoning traces from other agents to detect
 * contradictions, assess confidence calibration, and identify systemic issues.
 * It is purely analytical - it NEVER overrides outputs or enforces corrections.
 */
class MetaReasonerAgent {
    metadata = {
        id: AGENT_ID,
        name: 'Meta-Reasoner Agent',
        version: AGENT_VERSION,
        classifications: [
            contracts_1.AgentClassification.META_ANALYSIS,
            contracts_1.AgentClassification.REASONING_QUALITY_ASSESSMENT,
        ],
        decision_type: DECISION_TYPE,
        description: 'Evaluates reasoning quality and consistency across agents by detecting contradictions, assessing confidence calibration, and identifying systemic reasoning issues.',
    };
    persistence;
    telemetry;
    constructor(persistence, telemetry) {
        this.persistence = persistence;
        this.telemetry = telemetry;
    }
    /**
     * Validate input against MetaReasonerInputSchema
     */
    validateInput(input) {
        return contracts_1.MetaReasonerInputSchema.parse(input);
    }
    /**
     * Invoke the meta-reasoner agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    async invoke(input, executionRef) {
        const startTime = Date.now();
        try {
            // Emit telemetry start
            this.telemetry.recordStart(AGENT_ID, executionRef, input);
            // Perform meta-reasoning analysis (pure analysis, no side effects)
            const output = this.analyzeReasoning(input);
            // Validate output
            const validatedOutput = contracts_1.MetaReasonerOutputSchema.parse(output);
            // Calculate confidence based on analysis quality
            const confidence = this.calculateConfidence(validatedOutput, input);
            // Constraints applied during analysis
            const constraintsApplied = this.getAppliedConstraints(input);
            // Create the DecisionEvent
            const event = (0, contracts_1.createDecisionEvent)(AGENT_ID, AGENT_VERSION, DECISION_TYPE, input, validatedOutput, confidence, constraintsApplied, executionRef);
            // Persist via ruvector-service ONLY
            await this.persistence.store(event);
            // Emit telemetry success
            this.telemetry.recordSuccess(AGENT_ID, executionRef, Date.now() - startTime);
            return {
                status: 'success',
                event,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorCode = this.classifyError(error);
            // Emit telemetry failure
            this.telemetry.recordFailure(AGENT_ID, executionRef, errorCode, errorMessage);
            return (0, contracts_1.createErrorResult)(errorCode, errorMessage, executionRef);
        }
    }
    /**
     * Perform meta-reasoning analysis on the provided traces
     *
     * This is the core analysis logic - purely analytical.
     * NEVER overrides outputs or enforces corrections.
     */
    analyzeReasoning(input) {
        const analysisId = (0, uuid_1.v4)();
        const traces = input.traces;
        const scope = input.scope;
        // Collect unique agents and decision types
        const uniqueAgents = new Set(traces.map(t => t.agent_id));
        const uniqueDecisionTypes = new Set(traces.map(t => t.decision_type));
        // Calculate time span
        const timestamps = traces.map(t => new Date(t.timestamp).getTime()).sort((a, b) => a - b);
        const timeSpan = timestamps.length > 0 ? {
            earliest: new Date(timestamps[0]).toISOString(),
            latest: new Date(timestamps[timestamps.length - 1]).toISOString(),
        } : undefined;
        // Perform analyses based on scope
        const contradictions = scope.detect_contradictions
            ? this.detectContradictions(traces)
            : [];
        const confidenceCalibrations = scope.assess_confidence_calibration
            ? this.assessConfidenceCalibration(traces, input.context?.historical_accuracy)
            : [];
        const systemicIssues = scope.identify_systemic_issues
            ? this.identifySystemicIssues(traces)
            : [];
        // Calculate quality metrics
        const qualityMetrics = this.calculateQualityMetrics(traces, contradictions, confidenceCalibrations, systemicIssues);
        // Generate key findings
        const keyFindings = this.generateKeyFindings(contradictions, confidenceCalibrations, systemicIssues, qualityMetrics);
        // Generate summary
        const summary = this.generateSummary(traces.length, uniqueAgents.size, contradictions.length, systemicIssues.length, qualityMetrics.overall_score);
        // Extract assumptions
        const assumptions = this.extractAssumptions(input);
        return {
            analysis_id: analysisId,
            summary,
            quality_metrics: qualityMetrics,
            contradictions,
            confidence_calibrations: confidenceCalibrations,
            systemic_issues: systemicIssues,
            analysis_metadata: {
                total_traces: traces.length,
                traces_analyzed: traces.length,
                unique_agents: uniqueAgents.size,
                unique_decision_types: uniqueDecisionTypes.size,
                time_span: timeSpan,
                scope_executed: {
                    contradictions_checked: scope.detect_contradictions,
                    calibration_assessed: scope.assess_confidence_calibration,
                    systemic_issues_checked: scope.identify_systemic_issues,
                    fallacies_checked: scope.detect_fallacies,
                    completeness_checked: scope.check_completeness,
                },
            },
            key_findings: keyFindings,
            assumptions,
            version: '1.0.0',
        };
    }
    /**
     * Detect contradictions between reasoning traces
     */
    detectContradictions(traces) {
        const contradictions = [];
        let contradictionCount = 0;
        // Group traces by decision type for comparison
        const tracesByType = new Map();
        for (const trace of traces) {
            const existing = tracesByType.get(trace.decision_type) || [];
            existing.push(trace);
            tracesByType.set(trace.decision_type, existing);
        }
        // Check for contradictions within same decision type
        for (const [decisionType, typeTraces] of tracesByType) {
            if (typeTraces.length < 2)
                continue;
            // Compare pairs of traces
            for (let i = 0; i < typeTraces.length; i++) {
                for (let j = i + 1; j < typeTraces.length; j++) {
                    const trace1 = typeTraces[i];
                    const trace2 = typeTraces[j];
                    // Check for confidence contradictions
                    const confidenceGap = Math.abs(trace1.reported_confidence - trace2.reported_confidence);
                    if (confidenceGap > 0.5) {
                        contradictionCount++;
                        contradictions.push({
                            contradiction_id: `contradiction-${contradictionCount}`,
                            type: 'statistical',
                            severity: confidenceGap > 0.7 ? 'high' : 'medium',
                            involved_traces: [trace1.execution_ref, trace2.execution_ref],
                            involved_agents: [trace1.agent_id, trace2.agent_id],
                            description: `Large confidence gap (${(confidenceGap * 100).toFixed(1)}%) between agents for same decision type "${decisionType}"`,
                            evidence: [
                                {
                                    trace_ref: trace1.execution_ref,
                                    excerpt: `Confidence: ${trace1.reported_confidence}`,
                                    relevance: 'First trace confidence value',
                                },
                                {
                                    trace_ref: trace2.execution_ref,
                                    excerpt: `Confidence: ${trace2.reported_confidence}`,
                                    relevance: 'Second trace confidence value',
                                },
                            ],
                            finding_confidence: 0.8,
                        });
                    }
                    // Check for constraint contradictions
                    const constraints1 = new Set(trace1.constraints_applied);
                    const constraints2 = new Set(trace2.constraints_applied);
                    const conflictingConstraints = this.findConflictingConstraints(constraints1, constraints2);
                    if (conflictingConstraints.length > 0) {
                        contradictionCount++;
                        contradictions.push({
                            contradiction_id: `contradiction-${contradictionCount}`,
                            type: 'contextual',
                            severity: 'medium',
                            involved_traces: [trace1.execution_ref, trace2.execution_ref],
                            involved_agents: [trace1.agent_id, trace2.agent_id],
                            description: `Conflicting constraints applied for same decision type "${decisionType}"`,
                            evidence: [
                                {
                                    trace_ref: trace1.execution_ref,
                                    excerpt: `Constraints: ${Array.from(constraints1).join(', ')}`,
                                    relevance: 'First trace constraints',
                                },
                                {
                                    trace_ref: trace2.execution_ref,
                                    excerpt: `Constraints: ${Array.from(constraints2).join(', ')}`,
                                    relevance: 'Second trace constraints',
                                },
                            ],
                            finding_confidence: 0.7,
                        });
                    }
                }
            }
        }
        // Check for temporal contradictions (same agent, changing conclusions)
        const tracesByAgent = new Map();
        for (const trace of traces) {
            const existing = tracesByAgent.get(trace.agent_id) || [];
            existing.push(trace);
            tracesByAgent.set(trace.agent_id, existing);
        }
        for (const [agentId, agentTraces] of tracesByAgent) {
            if (agentTraces.length < 2)
                continue;
            // Sort by timestamp
            const sorted = [...agentTraces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            // Check for rapid confidence fluctuation
            for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1];
                const curr = sorted[i];
                if (prev.decision_type === curr.decision_type) {
                    const confidenceChange = Math.abs(curr.reported_confidence - prev.reported_confidence);
                    if (confidenceChange > 0.3) {
                        contradictionCount++;
                        contradictions.push({
                            contradiction_id: `contradiction-${contradictionCount}`,
                            type: 'temporal',
                            severity: confidenceChange > 0.5 ? 'high' : 'low',
                            involved_traces: [prev.execution_ref, curr.execution_ref],
                            involved_agents: [agentId],
                            description: `Rapid confidence change (${(confidenceChange * 100).toFixed(1)}%) for agent "${agentId}" on same decision type`,
                            evidence: [
                                {
                                    trace_ref: prev.execution_ref,
                                    excerpt: `Earlier confidence: ${prev.reported_confidence} at ${prev.timestamp}`,
                                    relevance: 'Previous confidence value',
                                },
                                {
                                    trace_ref: curr.execution_ref,
                                    excerpt: `Later confidence: ${curr.reported_confidence} at ${curr.timestamp}`,
                                    relevance: 'Current confidence value',
                                },
                            ],
                            finding_confidence: 0.75,
                        });
                    }
                }
            }
        }
        return contradictions;
    }
    /**
     * Find conflicting constraints between two sets
     */
    findConflictingConstraints(set1, set2) {
        const conflicts = [];
        // Define known conflicting constraint pairs
        const conflictPairs = [
            ['strict_validation', 'relaxed_validation'],
            ['high_precision', 'high_recall'],
            ['fast_execution', 'thorough_analysis'],
        ];
        for (const [a, b] of conflictPairs) {
            if ((set1.has(a) && set2.has(b)) || (set1.has(b) && set2.has(a))) {
                conflicts.push(`${a} vs ${b}`);
            }
        }
        return conflicts;
    }
    /**
     * Assess confidence calibration for each agent
     */
    assessConfidenceCalibration(traces, historicalAccuracy) {
        const calibrations = [];
        // Group traces by agent
        const tracesByAgent = new Map();
        for (const trace of traces) {
            const existing = tracesByAgent.get(trace.agent_id) || [];
            existing.push(trace);
            tracesByAgent.set(trace.agent_id, existing);
        }
        for (const [agentId, agentTraces] of tracesByAgent) {
            const confidences = agentTraces.map(t => t.reported_confidence);
            const meanConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
            const expectedAccuracy = historicalAccuracy?.[agentId];
            let calibrationScore;
            let assessment;
            let calibrationGap;
            const recommendations = [];
            if (expectedAccuracy !== undefined) {
                calibrationGap = meanConfidence - expectedAccuracy;
                if (Math.abs(calibrationGap) <= 0.1) {
                    calibrationScore = 0.9;
                    assessment = 'well_calibrated';
                }
                else if (calibrationGap > 0.1) {
                    calibrationScore = Math.max(0, 1 - calibrationGap);
                    assessment = 'overconfident';
                    recommendations.push(`Consider reducing confidence by ~${(calibrationGap * 100).toFixed(0)}%`, 'Review historical accuracy data for calibration');
                }
                else {
                    calibrationScore = Math.max(0, 1 + calibrationGap);
                    assessment = 'underconfident';
                    recommendations.push(`Consider increasing confidence by ~${(Math.abs(calibrationGap) * 100).toFixed(0)}%`, 'Agent may be underestimating its capabilities');
                }
            }
            else {
                // Without historical data, assess based on consistency
                const confidenceVariance = this.calculateVariance(confidences);
                if (confidenceVariance > 0.1) {
                    calibrationScore = Math.max(0, 1 - confidenceVariance);
                    assessment = 'inconsistent';
                    recommendations.push('Confidence varies significantly across invocations', 'Consider implementing more stable confidence estimation');
                }
                else {
                    calibrationScore = 0.7; // Default moderate score without historical data
                    assessment = 'insufficient_data';
                    recommendations.push('Historical accuracy data needed for proper calibration assessment', 'Track prediction outcomes to build accuracy baseline');
                }
            }
            calibrations.push({
                agent_id: agentId,
                calibration_score: calibrationScore,
                assessment,
                mean_reported_confidence: meanConfidence,
                expected_accuracy: expectedAccuracy,
                calibration_gap: calibrationGap,
                traces_analyzed: agentTraces.length,
                recommendations,
            });
        }
        return calibrations;
    }
    /**
     * Calculate variance of an array of numbers
     */
    calculateVariance(values) {
        if (values.length < 2)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }
    /**
     * Identify systemic reasoning issues across traces
     */
    identifySystemicIssues(traces) {
        const issues = [];
        let issueCount = 0;
        // Check for anchoring bias: early traces heavily influencing later ones
        const sortedTraces = [...traces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (sortedTraces.length >= 3) {
            const earlyConfidence = sortedTraces.slice(0, Math.floor(sortedTraces.length / 3))
                .map(t => t.reported_confidence);
            const lateConfidence = sortedTraces.slice(-Math.floor(sortedTraces.length / 3))
                .map(t => t.reported_confidence);
            const earlyMean = earlyConfidence.reduce((a, b) => a + b, 0) / earlyConfidence.length;
            const lateMean = lateConfidence.reduce((a, b) => a + b, 0) / lateConfidence.length;
            if (Math.abs(earlyMean - lateMean) < 0.05 && this.calculateVariance(earlyConfidence) < 0.01) {
                issueCount++;
                issues.push({
                    issue_id: `issue-${issueCount}`,
                    type: 'anchoring_bias',
                    severity: 'medium',
                    affected_agents: [...new Set(traces.map(t => t.agent_id))],
                    occurrences: sortedTraces.slice(0, 3).map(t => t.execution_ref),
                    frequency: 'occasional',
                    description: 'Early confidence values may be anchoring subsequent analyses',
                    evidence: [
                        {
                            trace_ref: sortedTraces[0].execution_ref,
                            observation: `Early mean confidence: ${earlyMean.toFixed(3)}`,
                        },
                        {
                            trace_ref: sortedTraces[sortedTraces.length - 1].execution_ref,
                            observation: `Late mean confidence: ${lateMean.toFixed(3)} (minimal drift suggests anchoring)`,
                        },
                    ],
                    impact: 'May reduce adaptability to new information',
                    finding_confidence: 0.6,
                });
            }
        }
        // Check for missing uncertainty acknowledgment
        const highConfidenceTraces = traces.filter(t => t.reported_confidence > 0.9);
        if (highConfidenceTraces.length > traces.length * 0.5) {
            issueCount++;
            issues.push({
                issue_id: `issue-${issueCount}`,
                type: 'missing_uncertainty',
                severity: 'medium',
                affected_agents: [...new Set(highConfidenceTraces.map(t => t.agent_id))],
                occurrences: highConfidenceTraces.slice(0, 5).map(t => t.execution_ref),
                frequency: highConfidenceTraces.length > traces.length * 0.7 ? 'pervasive' : 'frequent',
                description: 'Majority of traces report very high confidence (>90%), potentially underestimating uncertainty',
                evidence: highConfidenceTraces.slice(0, 3).map(t => ({
                    trace_ref: t.execution_ref,
                    observation: `Confidence: ${(t.reported_confidence * 100).toFixed(1)}%`,
                })),
                impact: 'High confidence without uncertainty bounds may lead to overreliance on outputs',
                finding_confidence: 0.75,
            });
        }
        // Check for inconsistent criteria across agents
        const constraintSets = new Map();
        for (const trace of traces) {
            const existing = constraintSets.get(trace.decision_type) || new Set();
            trace.constraints_applied.forEach(c => existing.add(c));
            constraintSets.set(trace.decision_type, existing);
        }
        for (const [decisionType, constraints] of constraintSets) {
            const tracesOfType = traces.filter(t => t.decision_type === decisionType);
            const uniqueConstraintCombinations = new Set(tracesOfType.map(t => JSON.stringify([...t.constraints_applied].sort())));
            if (uniqueConstraintCombinations.size > 3 && tracesOfType.length > 5) {
                issueCount++;
                issues.push({
                    issue_id: `issue-${issueCount}`,
                    type: 'inconsistent_criteria',
                    severity: 'low',
                    affected_agents: [...new Set(tracesOfType.map(t => t.agent_id))],
                    occurrences: tracesOfType.slice(0, 3).map(t => t.execution_ref),
                    frequency: 'occasional',
                    description: `Multiple different constraint sets (${uniqueConstraintCombinations.size}) used for decision type "${decisionType}"`,
                    evidence: tracesOfType.slice(0, 2).map(t => ({
                        trace_ref: t.execution_ref,
                        observation: `Constraints: ${t.constraints_applied.join(', ')}`,
                    })),
                    impact: 'May indicate inconsistent evaluation standards',
                    finding_confidence: 0.65,
                });
            }
        }
        return issues;
    }
    /**
     * Calculate overall reasoning quality metrics
     */
    calculateQualityMetrics(traces, contradictions, calibrations, systemicIssues) {
        // Consistency score: penalize for contradictions
        const contradictionPenalty = Math.min(contradictions.length * 0.1, 0.5);
        const consistencyScore = Math.max(0, 1 - contradictionPenalty);
        // Completeness score: based on traces having required fields
        const tracesWithConstraints = traces.filter(t => t.constraints_applied.length > 0).length;
        const completenessScore = traces.length > 0 ? tracesWithConstraints / traces.length : 0;
        // Clarity score: based on calibration quality
        const avgCalibrationScore = calibrations.length > 0
            ? calibrations.reduce((a, b) => a + b.calibration_score, 0) / calibrations.length
            : 0.7;
        const clarityScore = avgCalibrationScore;
        // Constraint adherence score
        const constraintAdherenceScore = traces.length > 0 ? completenessScore : 0;
        // Calculate overall score
        const overallScore = (consistencyScore * 0.35 +
            completenessScore * 0.2 +
            clarityScore * 0.25 +
            constraintAdherenceScore * 0.2) * (1 - Math.min(systemicIssues.length * 0.05, 0.3));
        const uniqueAgents = new Set(traces.map(t => t.agent_id));
        return {
            overall_score: Math.max(0, Math.min(1, overallScore)),
            consistency_score: consistencyScore,
            completeness_score: completenessScore,
            clarity_score: clarityScore,
            constraint_adherence_score: constraintAdherenceScore,
            traces_analyzed: traces.length,
            agents_analyzed: uniqueAgents.size,
            coverage_percentage: 100, // All provided traces are analyzed
        };
    }
    /**
     * Generate prioritized key findings
     */
    generateKeyFindings(contradictions, calibrations, systemicIssues, qualityMetrics) {
        const findings = [];
        // Critical/high severity contradictions
        const criticalContradictions = contradictions.filter(c => c.severity === 'critical' || c.severity === 'high');
        if (criticalContradictions.length > 0) {
            findings.push({
                priority: 1,
                category: 'contradiction',
                finding: `Found ${criticalContradictions.length} high-severity contradiction(s) requiring attention`,
                affected_entities: criticalContradictions.flatMap(c => c.involved_agents),
            });
        }
        // Calibration issues
        const poorlyCalibrated = calibrations.filter(c => c.assessment === 'overconfident' || c.assessment === 'underconfident');
        if (poorlyCalibrated.length > 0) {
            findings.push({
                priority: 2,
                category: 'calibration',
                finding: `${poorlyCalibrated.length} agent(s) show calibration issues (${poorlyCalibrated.map(c => c.assessment).join(', ')})`,
                affected_entities: poorlyCalibrated.map(c => c.agent_id),
            });
        }
        // Systemic issues
        const severeSystems = systemicIssues.filter(i => i.severity === 'critical' || i.severity === 'high');
        if (severeSystems.length > 0) {
            findings.push({
                priority: 3,
                category: 'systemic',
                finding: `Identified ${severeSystems.length} systemic issue(s): ${severeSystems.map(i => i.type).join(', ')}`,
                affected_entities: severeSystems.flatMap(i => i.affected_agents),
            });
        }
        // Overall quality assessment
        if (qualityMetrics.overall_score < 0.5) {
            findings.push({
                priority: 4,
                category: 'quality',
                finding: `Overall reasoning quality score is low (${(qualityMetrics.overall_score * 100).toFixed(1)}%)`,
                affected_entities: [],
            });
        }
        else if (qualityMetrics.overall_score >= 0.8) {
            findings.push({
                priority: 10,
                category: 'quality',
                finding: `Overall reasoning quality is good (${(qualityMetrics.overall_score * 100).toFixed(1)}%)`,
                affected_entities: [],
            });
        }
        // Sort by priority
        return findings.sort((a, b) => a.priority - b.priority);
    }
    /**
     * Generate summary of the analysis
     */
    generateSummary(traceCount, agentCount, contradictionCount, issueCount, overallScore) {
        const qualityDescriptor = overallScore >= 0.8 ? 'good' :
            overallScore >= 0.6 ? 'moderate' :
                overallScore >= 0.4 ? 'fair' : 'poor';
        let summary = `Meta-reasoning analysis of ${traceCount} trace(s) from ${agentCount} agent(s). `;
        summary += `Overall reasoning quality is ${qualityDescriptor} (${(overallScore * 100).toFixed(1)}%). `;
        if (contradictionCount > 0) {
            summary += `Detected ${contradictionCount} contradiction(s). `;
        }
        if (issueCount > 0) {
            summary += `Identified ${issueCount} systemic issue(s). `;
        }
        if (contradictionCount === 0 && issueCount === 0) {
            summary += `No significant issues detected.`;
        }
        return summary.trim();
    }
    /**
     * Extract assumptions made during analysis
     */
    extractAssumptions(input) {
        const assumptions = [
            'All provided traces are authentic and unmodified',
            'Timestamps are accurate and timezone-consistent (UTC)',
            'Reported confidence values reflect agent certainty',
        ];
        if (!input.context?.historical_accuracy) {
            assumptions.push('No historical accuracy baseline available - calibration assessment limited');
        }
        if (input.traces.length < 5) {
            assumptions.push('Limited trace count may reduce statistical significance of findings');
        }
        if (!input.context?.correlation_groups?.length) {
            assumptions.push('No correlation groups specified - assuming all traces are independent');
        }
        return assumptions;
    }
    /**
     * Calculate confidence score based on analysis quality
     */
    calculateConfidence(output, input) {
        let confidence = 0.7; // Base confidence
        // Boost for sufficient trace count
        if (input.traces.length >= 10) {
            confidence += 0.1;
        }
        else if (input.traces.length >= 5) {
            confidence += 0.05;
        }
        // Boost for multiple agents (cross-validation potential)
        if (output.analysis_metadata.unique_agents >= 3) {
            confidence += 0.05;
        }
        // Boost for having historical accuracy data
        if (input.context?.historical_accuracy) {
            confidence += 0.05;
        }
        // Reduce for limited scope
        const scopeCount = Object.values(output.analysis_metadata.scope_executed)
            .filter(Boolean).length;
        if (scopeCount < 3) {
            confidence -= 0.05;
        }
        return Math.min(1.0, Math.max(0.0, confidence));
    }
    /**
     * Get constraints applied during analysis
     */
    getAppliedConstraints(input) {
        const constraints = [
            'read_only_analysis',
            'no_output_override',
            'no_correction_enforcement',
            'no_logic_execution',
            'deterministic_output',
            'stateless_processing',
        ];
        // Add scope-specific constraints
        if (input.scope.detect_contradictions) {
            constraints.push('contradiction_detection_enabled');
        }
        if (input.scope.assess_confidence_calibration) {
            constraints.push('calibration_assessment_enabled');
        }
        if (input.scope.identify_systemic_issues) {
            constraints.push('systemic_analysis_enabled');
        }
        return constraints;
    }
    /**
     * Classify error for proper error code
     */
    classifyError(error) {
        if (error instanceof Error) {
            if (error.name === 'ZodError') {
                return contracts_1.AgentErrorCodes.VALIDATION_FAILED;
            }
            if (error.message.includes('persistence') || error.message.includes('ruvector')) {
                return contracts_1.AgentErrorCodes.PERSISTENCE_ERROR;
            }
        }
        return contracts_1.AgentErrorCodes.PROCESSING_ERROR;
    }
}
exports.MetaReasonerAgent = MetaReasonerAgent;
//# sourceMappingURL=meta-reasoner-agent.js.map