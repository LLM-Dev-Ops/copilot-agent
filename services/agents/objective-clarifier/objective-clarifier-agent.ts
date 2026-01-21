/**
 * Objective Clarifier Agent
 *
 * Purpose: Clarify ambiguous or incomplete objectives
 * Classification: INTENT_ANALYSIS, DECOMPOSITION
 * decision_type: objective_clarification
 *
 * Scope:
 * - Resolve ambiguity
 * - Normalize goals
 * - Identify missing constraints
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
 * - Generate plans
 * - Define solutions
 * - Execute logic
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
} from '../contracts';
import {
  ObjectiveClarifierInputSchema,
  ObjectiveClarifierOutputSchema,
  ObjectiveClarifierInput,
  ObjectiveClarifierOutput,
  Ambiguity,
  MissingConstraint,
  NormalizedGoal,
} from '../contracts/objective-clarifier-schemas';
import { RuvectorPersistence } from './ruvector-persistence';
import { Telemetry } from './telemetry';

const AGENT_ID = 'objective-clarifier-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'objective_clarification';

/**
 * Objective Clarifier Agent Implementation
 *
 * This agent analyzes objectives and identifies ambiguities, missing constraints,
 * and normalizes goals. It is purely analytical - it NEVER generates plans,
 * defines solutions, or executes any logic.
 */
export class ObjectiveClarifierAgent implements BaseAgent<ObjectiveClarifierInput, ObjectiveClarifierOutput> {
  readonly metadata: AgentMetadata = {
    id: AGENT_ID,
    name: 'Objective Clarifier Agent',
    version: AGENT_VERSION,
    classifications: [
      AgentClassification.INTENT_ANALYSIS,
      AgentClassification.DECOMPOSITION,
    ],
    decision_type: DECISION_TYPE,
    description: 'Clarifies ambiguous or incomplete objectives by identifying ambiguities, missing constraints, and normalizing goals.',
  };

  private readonly persistence: RuvectorPersistence;
  private readonly telemetry: Telemetry;

  constructor(persistence: RuvectorPersistence, telemetry: Telemetry) {
    this.persistence = persistence;
    this.telemetry = telemetry;
  }

  /**
   * Validate input against ObjectiveClarifierInputSchema
   */
  validateInput(input: unknown): ObjectiveClarifierInput {
    return ObjectiveClarifierInputSchema.parse(input);
  }

  /**
   * Invoke the objective clarifier agent
   *
   * DETERMINISTIC: Same input always produces same output structure
   * STATELESS: No internal state modified
   * NON-BLOCKING: Fully async
   */
  async invoke(input: ObjectiveClarifierInput, executionRef: string): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Emit telemetry start
      this.telemetry.recordStart(AGENT_ID, executionRef, input);

      // Perform clarification analysis (pure analysis, no side effects)
      const output = this.clarifyObjective(input);

      // Validate output
      const validatedOutput = ObjectiveClarifierOutputSchema.parse(output);

      // Calculate confidence based on analysis quality
      const confidence = this.calculateConfidence(validatedOutput);

      // Constraints applied during clarification
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
   * Clarify the objective - Core analysis logic
   *
   * This is purely analytical. It NEVER:
   * - Generates plans
   * - Defines solutions
   * - Executes logic
   */
  private clarifyObjective(input: ObjectiveClarifierInput): ObjectiveClarifierOutput {
    const clarificationId = uuidv4();
    const objective = input.objective;

    // Detect ambiguities
    const ambiguities = this.detectAmbiguities(objective, input.context);

    // Identify missing constraints
    const missingConstraints = this.identifyMissingConstraints(objective, input.context);

    // Normalize goals
    const normalizedGoals = this.normalizeGoals(objective);

    // Determine status
    const status = this.determineStatus(ambiguities, missingConstraints, normalizedGoals, objective);

    // Generate clarified objective
    const clarifiedObjective = this.generateClarifiedObjective(
      objective,
      ambiguities,
      missingConstraints,
      normalizedGoals,
      input.config?.auto_resolve_low_severity
    );

    // Generate prioritized clarification questions
    const clarificationQuestions = this.generateClarificationQuestions(
      ambiguities,
      missingConstraints,
      input.config?.max_questions ?? 10
    );

    // Compute analysis metrics
    const analysis = this.computeAnalysisMetrics(
      objective,
      ambiguities,
      missingConstraints,
      normalizedGoals
    );

    return {
      clarification_id: clarificationId,
      original_objective: objective,
      status,
      ambiguities,
      missing_constraints: missingConstraints,
      normalized_goals: normalizedGoals,
      clarified_objective: clarifiedObjective,
      clarification_questions: clarificationQuestions,
      analysis,
      version: '1.0.0',
    };
  }

  /**
   * Detect ambiguities in the objective
   */
  private detectAmbiguities(
    objective: string,
    context?: ObjectiveClarifierInput['context']
  ): Ambiguity[] {
    const ambiguities: Ambiguity[] = [];
    const words = objective.toLowerCase().split(/\s+/);

    // Pattern-based ambiguity detection (deterministic)

    // 1. Vague quantifiers
    const vagueQuantifiers = ['some', 'many', 'few', 'several', 'various', 'multiple', 'numerous'];
    for (const quantifier of vagueQuantifiers) {
      if (objective.toLowerCase().includes(quantifier)) {
        ambiguities.push({
          id: `amb-quant-${quantifier}`,
          type: 'quantitative',
          source_text: this.findContextForWord(objective, quantifier),
          description: `The quantifier "${quantifier}" is vague and does not specify an exact amount.`,
          interpretations: [
            { interpretation: '2-5 items', likelihood: 0.4, assumptions: ['Small scale'] },
            { interpretation: '5-10 items', likelihood: 0.3, assumptions: ['Medium scale'] },
            { interpretation: '10+ items', likelihood: 0.3, assumptions: ['Larger scale'] },
          ],
          severity: 'medium',
          clarification_prompt: `How many specifically is meant by "${quantifier}"?`,
        });
      }
    }

    // 2. Temporal ambiguity
    const vagueTemporals = ['soon', 'quickly', 'fast', 'later', 'eventually', 'asap'];
    for (const temporal of vagueTemporals) {
      if (objective.toLowerCase().includes(temporal)) {
        ambiguities.push({
          id: `amb-temp-${temporal}`,
          type: 'temporal',
          source_text: this.findContextForWord(objective, temporal),
          description: `The temporal term "${temporal}" does not specify a concrete timeframe.`,
          interpretations: [
            { interpretation: 'Within hours', likelihood: 0.2, assumptions: ['Urgent'] },
            { interpretation: 'Within days', likelihood: 0.4, assumptions: ['Standard priority'] },
            { interpretation: 'Within weeks', likelihood: 0.4, assumptions: ['Lower priority'] },
          ],
          severity: 'medium',
          clarification_prompt: `What is the specific timeframe for "${temporal}"?`,
        });
      }
    }

    // 3. Scope ambiguity
    const scopeIndicators = ['all', 'everything', 'entire', 'whole', 'complete'];
    for (const indicator of scopeIndicators) {
      if (objective.toLowerCase().includes(indicator)) {
        ambiguities.push({
          id: `amb-scope-${indicator}`,
          type: 'scope',
          source_text: this.findContextForWord(objective, indicator),
          description: `The scope indicator "${indicator}" may have different interpretations of boundaries.`,
          interpretations: [
            { interpretation: 'Full system scope', likelihood: 0.5, assumptions: ['No exclusions'] },
            { interpretation: 'Primary components only', likelihood: 0.3, assumptions: ['Standard interpretation'] },
            { interpretation: 'Core functionality', likelihood: 0.2, assumptions: ['Minimal scope'] },
          ],
          severity: 'low',
          clarification_prompt: `What specifically is included in "${indicator}"? Are there any exclusions?`,
        });
      }
    }

    // 4. Referential ambiguity (pronouns without clear antecedents)
    const pronouns = ['it', 'they', 'them', 'this', 'that', 'these', 'those'];
    for (const pronoun of pronouns) {
      const regex = new RegExp(`\\b${pronoun}\\b`, 'gi');
      if (regex.test(objective) && !context?.existing_context) {
        ambiguities.push({
          id: `amb-ref-${pronoun}`,
          type: 'referential',
          source_text: this.findContextForWord(objective, pronoun),
          description: `The pronoun "${pronoun}" has no clear antecedent in the provided context.`,
          interpretations: [
            { interpretation: 'Refers to the main subject', likelihood: 0.6, assumptions: ['Most recent noun'] },
            { interpretation: 'Refers to the system/project', likelihood: 0.4, assumptions: ['Contextual inference'] },
          ],
          severity: 'high',
          clarification_prompt: `What does "${pronoun}" refer to specifically?`,
        });
        break; // Only flag once
      }
    }

    // 5. Conditional ambiguity
    const conditionalIndicators = ['if', 'when', 'unless', 'depending'];
    for (const indicator of conditionalIndicators) {
      if (objective.toLowerCase().includes(indicator)) {
        // Check if condition is fully specified
        const conditionalContext = this.findContextForWord(objective, indicator);
        if (!conditionalContext.includes('then') && !conditionalContext.includes(',')) {
          ambiguities.push({
            id: `amb-cond-${indicator}`,
            type: 'conditional',
            source_text: conditionalContext,
            description: `The conditional "${indicator}" may have an incomplete or ambiguous outcome.`,
            interpretations: [
              { interpretation: 'Proceed with action', likelihood: 0.5, assumptions: ['Positive case'] },
              { interpretation: 'Skip/alternative action', likelihood: 0.5, assumptions: ['Negative case'] },
            ],
            severity: 'medium',
            clarification_prompt: `What should happen ${indicator.toLowerCase()} the condition is not met?`,
          });
        }
      }
    }

    // 6. Semantic ambiguity (words with multiple meanings)
    const polysemousWords: Record<string, string[]> = {
      'run': ['execute', 'manage', 'operate'],
      'handle': ['process', 'manage', 'grip'],
      'service': ['API service', 'customer service', 'maintenance'],
      'table': ['database table', 'UI table', 'data structure'],
      'model': ['data model', 'ML model', 'business model'],
    };

    for (const [word, meanings] of Object.entries(polysemousWords)) {
      if (words.includes(word)) {
        ambiguities.push({
          id: `amb-sem-${word}`,
          type: 'semantic',
          source_text: this.findContextForWord(objective, word),
          description: `The word "${word}" has multiple possible meanings in this context.`,
          interpretations: meanings.map((meaning, i) => ({
            interpretation: meaning,
            likelihood: 1 / meanings.length,
            assumptions: [`Interpretation ${i + 1}`],
          })),
          severity: 'medium',
          clarification_prompt: `Which meaning of "${word}" is intended: ${meanings.join(', ')}?`,
        });
      }
    }

    return ambiguities;
  }

  /**
   * Identify missing constraints
   */
  private identifyMissingConstraints(
    objective: string,
    context?: ObjectiveClarifierInput['context']
  ): MissingConstraint[] {
    const constraints: MissingConstraint[] = [];
    const objectiveLower = objective.toLowerCase();
    const knownConstraints = context?.known_constraints || [];

    // 1. Temporal constraints
    const hasTemporalConstraint = knownConstraints.some(c =>
      c.toLowerCase().includes('deadline') ||
      c.toLowerCase().includes('by ') ||
      c.toLowerCase().includes('within')
    ) || /\b(by|within|before|after|deadline|due)\b/i.test(objective);

    if (!hasTemporalConstraint) {
      constraints.push({
        id: 'missing-temporal',
        category: 'temporal',
        description: 'No timeline or deadline specified for completion.',
        impact: 'Cannot prioritize or schedule work without knowing time constraints.',
        severity: 'high',
        clarification_prompt: 'What is the expected timeline or deadline for this objective?',
        default_assumption: 'Standard project timeline will be applied.',
      });
    }

    // 2. Resource constraints (budget, team, tools)
    if (!objectiveLower.includes('budget') && !objectiveLower.includes('cost') &&
        !knownConstraints.some(c => c.toLowerCase().includes('budget'))) {
      constraints.push({
        id: 'missing-budget',
        category: 'resource',
        description: 'No budget or cost constraints specified.',
        impact: 'Cannot determine feasibility or scope without budget information.',
        severity: 'medium',
        clarification_prompt: 'Are there any budget or cost constraints for this objective?',
        default_assumption: 'Standard budget allocation will be assumed.',
      });
    }

    // 3. Quality constraints
    if (!objectiveLower.includes('quality') && !objectiveLower.includes('standard') &&
        !objectiveLower.includes('requirement') && !objectiveLower.includes('criteria')) {
      constraints.push({
        id: 'missing-quality',
        category: 'quality',
        description: 'No quality standards or acceptance criteria specified.',
        impact: 'Cannot determine when the objective is satisfactorily achieved.',
        severity: 'high',
        clarification_prompt: 'What are the quality standards or acceptance criteria for this objective?',
        default_assumption: 'Industry-standard quality practices will be followed.',
      });
    }

    // 4. Scope boundaries
    if (!objectiveLower.includes('scope') && !objectiveLower.includes('exclude') &&
        !objectiveLower.includes('only') && !objectiveLower.includes('limit')) {
      constraints.push({
        id: 'missing-scope',
        category: 'scope',
        description: 'No explicit scope boundaries or exclusions defined.',
        impact: 'Risk of scope creep without clear boundaries.',
        severity: 'medium',
        clarification_prompt: 'What is explicitly out of scope for this objective?',
        default_assumption: 'Scope will be interpreted conservatively.',
      });
    }

    // 5. Dependencies
    if (!objectiveLower.includes('depend') && !objectiveLower.includes('prerequisite') &&
        !objectiveLower.includes('require') && !objectiveLower.includes('after')) {
      constraints.push({
        id: 'missing-dependency',
        category: 'dependency',
        description: 'No dependencies or prerequisites mentioned.',
        impact: 'Unknown blockers may delay or prevent completion.',
        severity: 'low',
        clarification_prompt: 'Are there any dependencies or prerequisites for this objective?',
        default_assumption: 'No external dependencies assumed.',
      });
    }

    // 6. Technical constraints
    const technicalKeywords = ['api', 'database', 'system', 'application', 'service', 'platform'];
    const hasTechnicalContext = technicalKeywords.some(kw => objectiveLower.includes(kw));

    if (hasTechnicalContext && !objectiveLower.includes('technology') &&
        !objectiveLower.includes('stack') && !objectiveLower.includes('language') &&
        !knownConstraints.some(c => c.toLowerCase().includes('tech'))) {
      constraints.push({
        id: 'missing-technical',
        category: 'technical',
        description: 'Technical objective without specified technology constraints.',
        impact: 'Technology choices may conflict with existing systems or preferences.',
        severity: 'medium',
        clarification_prompt: 'Are there any technology preferences or constraints (languages, frameworks, platforms)?',
        default_assumption: 'Appropriate technologies will be selected based on requirements.',
      });
    }

    // 7. Performance constraints
    if (hasTechnicalContext && !objectiveLower.includes('performance') &&
        !objectiveLower.includes('latency') && !objectiveLower.includes('throughput') &&
        !objectiveLower.includes('scale')) {
      constraints.push({
        id: 'missing-performance',
        category: 'performance',
        description: 'No performance requirements specified.',
        impact: 'Cannot optimize or test for specific performance targets.',
        severity: 'low',
        clarification_prompt: 'Are there any performance requirements (response time, throughput, scale)?',
        default_assumption: 'Standard performance levels will be targeted.',
      });
    }

    // 8. Compliance constraints
    const complianceKeywords = ['user', 'data', 'personal', 'customer', 'financial', 'health'];
    const mayNeedCompliance = complianceKeywords.some(kw => objectiveLower.includes(kw));

    if (mayNeedCompliance && !objectiveLower.includes('compliance') &&
        !objectiveLower.includes('regulation') && !objectiveLower.includes('gdpr') &&
        !objectiveLower.includes('hipaa')) {
      constraints.push({
        id: 'missing-compliance',
        category: 'compliance',
        description: 'Potential compliance requirements not addressed.',
        impact: 'May face legal or regulatory issues if compliance requirements exist.',
        severity: 'high',
        clarification_prompt: 'Are there any compliance or regulatory requirements (GDPR, HIPAA, SOC2, etc.)?',
        default_assumption: 'Standard data protection practices will be followed.',
      });
    }

    return constraints;
  }

  /**
   * Normalize goals from the objective
   */
  private normalizeGoals(objective: string): NormalizedGoal[] {
    const goals: NormalizedGoal[] = [];

    // Split objective into potential goal statements
    const statements = this.splitIntoStatements(objective);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length < 5) continue;

      const analysis = this.analyzeStatement(statement);

      if (analysis.action) {
        goals.push({
          goal_id: `goal-${i + 1}`,
          statement: this.normalizeStatement(statement),
          type: this.classifyGoalType(statement, analysis),
          action: analysis.action,
          subject: analysis.subject || 'system',
          object: analysis.object,
          qualifiers: analysis.qualifiers,
          confidence: analysis.confidence,
          source_text: statement,
        });
      }
    }

    return goals;
  }

  /**
   * Split objective into individual statements
   */
  private splitIntoStatements(objective: string): string[] {
    // Split by common delimiters
    return objective
      .split(/[.;]\s*/)
      .flatMap(s => s.split(/\s*(?:and|,)\s+(?=[A-Z])/))
      .filter(s => s.length > 0);
  }

  /**
   * Analyze a statement to extract components
   */
  private analyzeStatement(statement: string): {
    action: string | null;
    subject: string | null;
    object: string | null;
    qualifiers: string[];
    confidence: number;
  } {
    const words = statement.toLowerCase().split(/\s+/);

    // Action verbs to look for
    const actionVerbs = [
      'create', 'build', 'develop', 'implement', 'design', 'deploy',
      'update', 'modify', 'change', 'improve', 'enhance', 'optimize',
      'remove', 'delete', 'deprecate', 'migrate', 'refactor',
      'integrate', 'connect', 'link', 'sync',
      'test', 'validate', 'verify', 'check', 'audit',
      'document', 'describe', 'explain', 'define',
      'configure', 'setup', 'initialize', 'enable', 'disable',
      'monitor', 'track', 'log', 'measure', 'analyze',
    ];

    let action: string | null = null;
    let actionIndex = -1;

    for (let i = 0; i < words.length; i++) {
      if (actionVerbs.includes(words[i])) {
        action = words[i];
        actionIndex = i;
        break;
      }
    }

    if (!action) {
      // Try to find verb-like words at start
      if (words.length > 0 && words[0].endsWith('e')) {
        action = words[0];
        actionIndex = 0;
      }
    }

    // Extract subject (usually before action or after "for")
    let subject: string | null = null;
    const forIndex = words.indexOf('for');
    if (forIndex !== -1 && forIndex < words.length - 1) {
      subject = words.slice(forIndex + 1, Math.min(forIndex + 4, words.length)).join(' ');
    } else if (actionIndex > 0) {
      subject = words.slice(0, actionIndex).join(' ');
    }

    // Extract object (usually after action)
    let object: string | null = null;
    if (actionIndex !== -1 && actionIndex < words.length - 1) {
      const afterAction = words.slice(actionIndex + 1);
      const stopWords = ['for', 'to', 'with', 'using', 'by', 'that', 'which'];
      const stopIndex = afterAction.findIndex(w => stopWords.includes(w));
      if (stopIndex !== -1) {
        object = afterAction.slice(0, stopIndex).join(' ');
      } else {
        object = afterAction.slice(0, 4).join(' ');
      }
    }

    // Extract qualifiers
    const qualifiers: string[] = [];
    const qualifierPatterns = [
      /\bwith\s+(.+?)(?:\s+and|\s+for|$)/i,
      /\busing\s+(.+?)(?:\s+and|\s+for|$)/i,
      /\bthat\s+(.+?)(?:\s+and|\s+for|$)/i,
    ];
    for (const pattern of qualifierPatterns) {
      const match = statement.match(pattern);
      if (match) {
        qualifiers.push(match[1].trim());
      }
    }

    // Calculate confidence
    let confidence = 0.5;
    if (action) confidence += 0.2;
    if (subject || object) confidence += 0.15;
    if (qualifiers.length > 0) confidence += 0.1;
    confidence = Math.min(1.0, confidence);

    return { action, subject, object, qualifiers, confidence };
  }

  /**
   * Classify goal type
   */
  private classifyGoalType(
    statement: string,
    analysis: { action: string | null; qualifiers: string[] }
  ): 'functional' | 'non_functional' | 'constraint' | 'assumption' {
    const lower = statement.toLowerCase();

    // Non-functional indicators
    const nfIndicators = [
      'performance', 'scalab', 'secur', 'reliab', 'availab', 'maintain',
      'usab', 'access', 'portab', 'fast', 'quick', 'efficient',
    ];
    if (nfIndicators.some(ind => lower.includes(ind))) {
      return 'non_functional';
    }

    // Constraint indicators
    const constraintIndicators = ['must', 'shall', 'require', 'limit', 'restrict', 'only', 'cannot', 'never'];
    if (constraintIndicators.some(ind => lower.includes(ind))) {
      return 'constraint';
    }

    // Assumption indicators
    const assumptionIndicators = ['assume', 'expect', 'given', 'provided that', 'if '];
    if (assumptionIndicators.some(ind => lower.includes(ind))) {
      return 'assumption';
    }

    // Default to functional
    return 'functional';
  }

  /**
   * Normalize a statement to standard form
   */
  private normalizeStatement(statement: string): string {
    return statement
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/[.;,]$/, '');
  }

  /**
   * Determine the overall status
   */
  private determineStatus(
    ambiguities: Ambiguity[],
    missingConstraints: MissingConstraint[],
    normalizedGoals: NormalizedGoal[],
    objective: string
  ): 'clear' | 'needs_clarification' | 'requires_decomposition' | 'insufficient' {
    // Check for insufficient input
    if (objective.split(/\s+/).length < 3) {
      return 'insufficient';
    }

    // Check if too complex (needs decomposition)
    if (normalizedGoals.length > 7 || objective.length > 2000) {
      return 'requires_decomposition';
    }

    // Check for critical issues
    const hasCriticalAmbiguity = ambiguities.some(a => a.severity === 'critical');
    const hasCriticalConstraint = missingConstraints.some(c => c.severity === 'critical');
    const hasHighSeverityIssues = ambiguities.filter(a => a.severity === 'high').length > 2 ||
                                   missingConstraints.filter(c => c.severity === 'high').length > 2;

    if (hasCriticalAmbiguity || hasCriticalConstraint || hasHighSeverityIssues) {
      return 'needs_clarification';
    }

    // Check for moderate issues
    const totalIssues = ambiguities.length + missingConstraints.length;
    if (totalIssues > 5) {
      return 'needs_clarification';
    }

    // Seems clear
    return 'clear';
  }

  /**
   * Generate clarified objective
   */
  private generateClarifiedObjective(
    originalObjective: string,
    ambiguities: Ambiguity[],
    missingConstraints: MissingConstraint[],
    normalizedGoals: NormalizedGoal[],
    autoResolveLowSeverity?: boolean
  ): ObjectiveClarifierOutput['clarified_objective'] {
    const assumptions: string[] = [];
    const unresolved: string[] = [];

    // Process ambiguities
    for (const ambiguity of ambiguities) {
      if (autoResolveLowSeverity && ambiguity.severity === 'low') {
        // Auto-resolve with highest likelihood interpretation
        const bestInterpretation = ambiguity.interpretations.reduce((a, b) =>
          a.likelihood > b.likelihood ? a : b
        );
        assumptions.push(`Assumed "${ambiguity.source_text}" means: ${bestInterpretation.interpretation}`);
      } else if (ambiguity.severity === 'high' || ambiguity.severity === 'critical') {
        unresolved.push(`Ambiguous: ${ambiguity.description}`);
      }
    }

    // Process missing constraints
    for (const constraint of missingConstraints) {
      if (constraint.default_assumption) {
        assumptions.push(constraint.default_assumption);
      }
      if (constraint.severity === 'high' || constraint.severity === 'critical') {
        unresolved.push(`Missing: ${constraint.description}`);
      }
    }

    // Build clarified statement from normalized goals
    let statement = originalObjective;
    if (normalizedGoals.length > 0 && normalizedGoals.length <= 5) {
      const goalStatements = normalizedGoals.map(g => g.statement);
      statement = goalStatements.join('; ');
    }

    // Calculate confidence
    let confidence = 1.0;
    confidence -= ambiguities.filter(a => a.severity === 'critical').length * 0.2;
    confidence -= ambiguities.filter(a => a.severity === 'high').length * 0.1;
    confidence -= missingConstraints.filter(c => c.severity === 'critical').length * 0.15;
    confidence -= missingConstraints.filter(c => c.severity === 'high').length * 0.08;
    confidence = Math.max(0.1, confidence);

    return {
      statement,
      assumptions,
      unresolved,
      confidence,
    };
  }

  /**
   * Generate prioritized clarification questions
   */
  private generateClarificationQuestions(
    ambiguities: Ambiguity[],
    missingConstraints: MissingConstraint[],
    maxQuestions: number
  ): ObjectiveClarifierOutput['clarification_questions'] {
    const questions: ObjectiveClarifierOutput['clarification_questions'] = [];

    // Add questions from ambiguities
    for (const ambiguity of ambiguities) {
      questions.push({
        question: ambiguity.clarification_prompt,
        priority: ambiguity.severity,
        related_ambiguity_id: ambiguity.id,
      });
    }

    // Add questions from missing constraints
    for (const constraint of missingConstraints) {
      questions.push({
        question: constraint.clarification_prompt,
        priority: constraint.severity,
        related_constraint_id: constraint.id,
      });
    }

    // Sort by priority and limit
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return questions
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, maxQuestions);
  }

  /**
   * Compute analysis metrics
   */
  private computeAnalysisMetrics(
    objective: string,
    ambiguities: Ambiguity[],
    missingConstraints: MissingConstraint[],
    normalizedGoals: NormalizedGoal[]
  ): ObjectiveClarifierOutput['analysis'] {
    const wordCount = objective.split(/\s+/).length;

    // Clarity score (inverse of ambiguity severity)
    let clarityScore = 1.0;
    clarityScore -= ambiguities.filter(a => a.severity === 'critical').length * 0.25;
    clarityScore -= ambiguities.filter(a => a.severity === 'high').length * 0.15;
    clarityScore -= ambiguities.filter(a => a.severity === 'medium').length * 0.08;
    clarityScore -= ambiguities.filter(a => a.severity === 'low').length * 0.03;
    clarityScore = Math.max(0, clarityScore);

    // Completeness score (inverse of missing constraints severity)
    let completenessScore = 1.0;
    completenessScore -= missingConstraints.filter(c => c.severity === 'critical').length * 0.2;
    completenessScore -= missingConstraints.filter(c => c.severity === 'high').length * 0.12;
    completenessScore -= missingConstraints.filter(c => c.severity === 'medium').length * 0.06;
    completenessScore -= missingConstraints.filter(c => c.severity === 'low').length * 0.02;
    completenessScore = Math.max(0, completenessScore);

    // Complexity assessment
    let complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    if (normalizedGoals.length <= 2 && wordCount < 50) {
      complexity = 'simple';
    } else if (normalizedGoals.length <= 4 && wordCount < 150) {
      complexity = 'moderate';
    } else if (normalizedGoals.length <= 7 && wordCount < 500) {
      complexity = 'complex';
    } else {
      complexity = 'very_complex';
    }

    return {
      total_ambiguities: ambiguities.length,
      total_missing_constraints: missingConstraints.length,
      total_goals: normalizedGoals.length,
      clarity_score: clarityScore,
      completeness_score: completenessScore,
      word_count: wordCount,
      complexity,
    };
  }

  /**
   * Find context around a word in the objective
   */
  private findContextForWord(objective: string, word: string): string {
    const regex = new RegExp(`(?:\\S+\\s+){0,3}\\b${word}\\b(?:\\s+\\S+){0,3}`, 'i');
    const match = objective.match(regex);
    return match ? match[0] : word;
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(output: ObjectiveClarifierOutput): number {
    let confidence = 0.6; // Base confidence

    // Boost for clear status
    if (output.status === 'clear') {
      confidence += 0.2;
    }

    // Boost for normalized goals extracted
    if (output.normalized_goals.length > 0 && output.normalized_goals.length <= 5) {
      confidence += 0.1;
    }

    // Reduce for many ambiguities
    if (output.ambiguities.length > 5) {
      confidence -= 0.15;
    }

    // Reduce for critical issues
    if (output.ambiguities.some(a => a.severity === 'critical')) {
      confidence -= 0.1;
    }

    // Adjust based on clarity score
    confidence = confidence * 0.7 + output.analysis.clarity_score * 0.3;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Get constraints applied during clarification
   */
  private getAppliedConstraints(input: ObjectiveClarifierInput): string[] {
    const constraints = [
      'read_only_analysis',
      'no_plan_generation',
      'no_solution_definition',
      'no_logic_execution',
      'deterministic_output',
      'semantic_normalization',
      'intent_clarification',
    ];

    if (input.context?.known_constraints) {
      constraints.push(...input.context.known_constraints.map(c => `user_constraint:${c}`));
    }

    if (input.config?.min_severity) {
      constraints.push(`min_severity:${input.config.min_severity}`);
    }

    if (input.config?.auto_resolve_low_severity) {
      constraints.push('auto_resolve_low_severity');
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
