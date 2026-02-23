"use strict";
/**
 * Planner Agent
 *
 * Purpose: Translate clarified objectives into structured execution plans
 * Classification: PLANNING, STRUCTURAL_SYNTHESIS
 * decision_type: plan_generation
 *
 * Scope:
 * - Generate ordered plan steps
 * - Identify dependencies
 * - Define sequencing
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
 * - Execute steps
 * - Assign agents
 * - Allocate resources
 * - Schedule execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerAgent = void 0;
const uuid_1 = require("uuid");
const contracts_1 = require("../contracts");
const AGENT_ID = 'planner-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'plan_generation';
/**
 * Planner Agent Implementation
 *
 * This agent analyzes objectives and produces structured execution plans.
 * It is purely analytical - it NEVER executes, assigns, or schedules anything.
 */
class PlannerAgent {
    metadata = {
        id: AGENT_ID,
        name: 'Planner Agent',
        version: AGENT_VERSION,
        classifications: [
            contracts_1.AgentClassification.PLANNING,
            contracts_1.AgentClassification.STRUCTURAL_SYNTHESIS,
        ],
        decision_type: DECISION_TYPE,
        description: 'Translates clarified objectives into structured execution plans with dependencies and sequencing.',
    };
    persistence;
    telemetry;
    constructor(persistence, telemetry) {
        this.persistence = persistence;
        this.telemetry = telemetry;
    }
    /**
     * Validate input against PlannerInputSchema
     */
    validateInput(input) {
        return contracts_1.PlannerInputSchema.parse(input);
    }
    /**
     * Invoke the planner agent
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
            // Generate the plan (pure analysis, no side effects)
            const output = this.generatePlan(input);
            // Validate output
            const validatedOutput = contracts_1.PlannerOutputSchema.parse(output);
            // Calculate confidence based on plan quality metrics
            const confidence = this.calculateConfidence(validatedOutput);
            // Constraints applied during planning
            const constraintsApplied = this.getAppliedConstraints(input);
            // Create the DecisionEvent
            const event = (0, contracts_1.createDecisionEvent)(AGENT_ID, AGENT_VERSION, DECISION_TYPE, input, validatedOutput, confidence, constraintsApplied, executionRef);
            // Persist via ruvector-service (best-effort, non-blocking)
            let persistence_status;
            try {
                await this.persistence.store(event);
                persistence_status = { status: 'persisted' };
            }
            catch (persistError) {
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
     * Generate structured execution plan from objective
     *
     * This is the core planning logic - purely analytical.
     * NEVER executes, assigns agents, or schedules anything.
     *
     * When pipeline_context is present, previous_steps outputs are used
     * as additional grounding context to improve plan quality.
     */
    generatePlan(input) {
        const planId = (0, uuid_1.v4)();
        // If pipeline_context is present, enrich the input context with
        // previous step outputs so planning is grounded in upstream results.
        const enrichedInput = this.enrichWithPipelineContext(input);
        const steps = this.decomposeObjective(enrichedInput);
        const dependencyGraph = this.buildDependencyGraph(steps);
        const criticalPath = this.findCriticalPath(steps, dependencyGraph);
        const parallelGroups = this.identifyParallelGroups(steps, dependencyGraph);
        const assumptions = this.extractAssumptions(enrichedInput);
        if (input.pipeline_context) {
            assumptions.push(`Grounded on ${input.pipeline_context.previous_steps.length} previous pipeline step(s)`);
        }
        return {
            plan_id: planId,
            objective_summary: this.summarizeObjective(enrichedInput.objective),
            steps,
            dependency_graph: dependencyGraph,
            critical_path: criticalPath,
            parallel_groups: parallelGroups,
            analysis: {
                total_steps: steps.length,
                max_depth: this.calculateMaxDepth(dependencyGraph),
                parallel_opportunities: parallelGroups.filter(g => g.length > 1).length,
                risks: this.identifyRisks(steps, enrichedInput),
                assumptions,
            },
            version: '1.0.0',
        };
    }
    /**
     * Enrich planner input with context extracted from pipeline previous_steps.
     * When no pipeline_context exists, returns the input unchanged.
     */
    enrichWithPipelineContext(input) {
        if (!input.pipeline_context || input.pipeline_context.previous_steps.length === 0) {
            return input;
        }
        // Extract useful context from previous step outputs
        const existingConstraints = input.context?.constraints || [];
        const existingComponents = input.context?.existing_components || [];
        const existingPreferences = input.context?.preferences || {};
        const additionalConstraints = [];
        const additionalComponents = [];
        for (const step of input.pipeline_context.previous_steps) {
            // Each previous step may provide structured output we can use
            if (step.output && typeof step.output === 'object') {
                const out = step.output;
                // From decomposer: extract sub-objective titles as additional context
                if (step.agent === 'decomposer' && Array.isArray(out.sub_objectives)) {
                    for (const sub of out.sub_objectives) {
                        if (sub.title) {
                            additionalComponents.push(`decomposed:${sub.title}`);
                        }
                    }
                }
                // From clarifier: use clarified_objective as context
                if (step.agent === 'clarifier' && out.clarified_objective) {
                    const clarified = out.clarified_objective;
                    if (clarified.assumptions) {
                        additionalConstraints.push(...clarified.assumptions);
                    }
                }
                // From intent: add detected intents as context
                if (step.agent === 'intent' && out.primary_intent) {
                    const intent = out.primary_intent;
                    if (intent.intent_type) {
                        additionalConstraints.push(`detected_intent:${intent.intent_type}`);
                    }
                }
            }
        }
        return {
            ...input,
            context: {
                domain: input.context?.domain,
                existing_components: [...existingComponents, ...additionalComponents],
                constraints: [...existingConstraints, ...additionalConstraints],
                preferences: existingPreferences,
            },
        };
    }
    /**
     * Decompose objective into ordered steps
     */
    decomposeObjective(input) {
        const objective = input.objective.toLowerCase();
        const steps = [];
        // Pattern-based decomposition
        // This is a deterministic analysis based on objective structure
        // Always start with analysis/understanding phase
        steps.push(this.createStep('analyze-requirements', 'Analyze Requirements', 'Analyze and validate the requirements from the objective', 0, [], ['requirements', 'analysis'], 'high'));
        // Design phase
        steps.push(this.createStep('design-solution', 'Design Solution', 'Design the solution architecture and approach', 1, [{ depends_on: 'analyze-requirements', type: 'blocking' }], ['design', 'architecture'], 'high'));
        // Implementation planning based on objective keywords
        if (this.containsAny(objective, ['build', 'create', 'implement', 'develop'])) {
            steps.push(this.createStep('plan-implementation', 'Plan Implementation', 'Define implementation steps and technical approach', 2, [{ depends_on: 'design-solution', type: 'blocking' }], ['implementation', 'planning'], 'high'));
        }
        // Validation phase
        if (this.containsAny(objective, ['test', 'validate', 'verify', 'check'])) {
            steps.push(this.createStep('plan-validation', 'Plan Validation', 'Define validation criteria and test approach', steps.length, [{ depends_on: steps[steps.length - 1]?.step_id || 'design-solution', type: 'data' }], ['validation', 'testing'], 'medium'));
        }
        // Integration consideration
        if (this.containsAny(objective, ['integrate', 'connect', 'api', 'service'])) {
            steps.push(this.createStep('plan-integration', 'Plan Integration', 'Define integration points and interface contracts', steps.length, [{ depends_on: 'design-solution', type: 'data' }], ['integration', 'interfaces'], 'medium', true // parallelizable
            ));
        }
        // Documentation
        steps.push(this.createStep('plan-documentation', 'Plan Documentation', 'Define documentation requirements and structure', steps.length, [{ depends_on: 'design-solution', type: 'data' }], ['documentation'], 'low', true));
        // Completion/Review phase
        steps.push(this.createStep('define-completion-criteria', 'Define Completion Criteria', 'Establish clear criteria for plan completion', steps.length, steps.slice(0, -1).map(s => ({ depends_on: s.step_id, type: 'data' })), ['completion', 'criteria'], 'high'));
        // Re-sequence based on dependencies
        return this.resequenceSteps(steps);
    }
    /**
     * Create a plan step
     */
    createStep(stepId, name, description, sequenceOrder, dependencies, tags, criticality, parallelizable = false) {
        return {
            step_id: stepId,
            name,
            description,
            sequence_order: sequenceOrder,
            dependencies,
            expected_inputs: [],
            expected_outputs: [{
                    name: `${stepId}-output`,
                    type: 'artifact',
                    description: `Output from ${name}`,
                }],
            tags,
            constraints: [],
            parallelizable,
            criticality,
        };
    }
    /**
     * Build dependency graph as adjacency list
     */
    buildDependencyGraph(steps) {
        const graph = {};
        for (const step of steps) {
            graph[step.step_id] = step.dependencies.map(d => d.depends_on);
        }
        return graph;
    }
    /**
     * Find critical path (longest dependency chain)
     */
    findCriticalPath(steps, graph) {
        const memo = new Map();
        const findLongestPath = (stepId) => {
            if (memo.has(stepId)) {
                return memo.get(stepId);
            }
            const dependencies = graph[stepId] || [];
            if (dependencies.length === 0) {
                memo.set(stepId, [stepId]);
                return [stepId];
            }
            let longestDep = [];
            for (const dep of dependencies) {
                const path = findLongestPath(dep);
                if (path.length > longestDep.length) {
                    longestDep = path;
                }
            }
            const result = [...longestDep, stepId];
            memo.set(stepId, result);
            return result;
        };
        let criticalPath = [];
        for (const step of steps) {
            const path = findLongestPath(step.step_id);
            if (path.length > criticalPath.length) {
                criticalPath = path;
            }
        }
        return criticalPath;
    }
    /**
     * Identify groups of steps that can run in parallel
     */
    identifyParallelGroups(steps, graph) {
        const groups = [];
        const completed = new Set();
        while (completed.size < steps.length) {
            const currentGroup = [];
            for (const step of steps) {
                if (completed.has(step.step_id))
                    continue;
                const deps = graph[step.step_id] || [];
                const allDepsComplete = deps.every(d => completed.has(d));
                if (allDepsComplete) {
                    currentGroup.push(step.step_id);
                }
            }
            if (currentGroup.length === 0)
                break; // Circular dependency protection
            groups.push(currentGroup);
            currentGroup.forEach(id => completed.add(id));
        }
        return groups;
    }
    /**
     * Resequence steps based on dependency order
     */
    resequenceSteps(steps) {
        const graph = this.buildDependencyGraph(steps);
        const groups = this.identifyParallelGroups(steps, graph);
        let order = 0;
        const stepMap = new Map(steps.map(s => [s.step_id, s]));
        for (const group of groups) {
            for (const stepId of group) {
                const step = stepMap.get(stepId);
                if (step) {
                    step.sequence_order = order;
                }
            }
            order++;
        }
        return steps.sort((a, b) => a.sequence_order - b.sequence_order);
    }
    /**
     * Calculate maximum dependency depth
     */
    calculateMaxDepth(graph) {
        const memo = new Map();
        const getDepth = (stepId, visited) => {
            if (visited.has(stepId))
                return 0; // Cycle protection
            if (memo.has(stepId))
                return memo.get(stepId);
            visited.add(stepId);
            const deps = graph[stepId] || [];
            if (deps.length === 0) {
                memo.set(stepId, 0);
                return 0;
            }
            const maxDepDep = Math.max(...deps.map(d => getDepth(d, new Set(visited))));
            const depth = maxDepDep + 1;
            memo.set(stepId, depth);
            return depth;
        };
        return Math.max(0, ...Object.keys(graph).map(id => getDepth(id, new Set())));
    }
    /**
     * Identify potential risks based on plan structure
     */
    identifyRisks(steps, input) {
        const risks = [];
        // Check for critical path bottlenecks
        const criticalSteps = steps.filter(s => s.criticality === 'critical' || s.criticality === 'high');
        if (criticalSteps.length > steps.length * 0.5) {
            risks.push({
                description: 'High concentration of critical steps may indicate plan complexity risk',
                severity: 'medium',
                affected_steps: criticalSteps.map(s => s.step_id),
            });
        }
        // Check for steps with many dependencies
        const highDependencySteps = steps.filter(s => s.dependencies.length > 3);
        if (highDependencySteps.length > 0) {
            risks.push({
                description: 'Steps with many dependencies may create coordination complexity',
                severity: 'low',
                affected_steps: highDependencySteps.map(s => s.step_id),
            });
        }
        return risks;
    }
    /**
     * Extract assumptions made during planning
     */
    extractAssumptions(input) {
        const assumptions = [
            'Objective has been clarified and validated',
            'All implicit requirements have been captured',
        ];
        if (!input.context?.constraints?.length) {
            assumptions.push('No explicit constraints provided - using default planning constraints');
        }
        if (!input.context?.existing_components?.length) {
            assumptions.push('No existing components specified - planning as greenfield');
        }
        return assumptions;
    }
    /**
     * Summarize objective for output
     */
    summarizeObjective(objective) {
        // Truncate and clean for summary
        const cleaned = objective.trim().replace(/\s+/g, ' ');
        return cleaned.length > 200 ? cleaned.substring(0, 197) + '...' : cleaned;
    }
    /**
     * Calculate confidence score based on plan quality
     */
    calculateConfidence(output) {
        let confidence = 0.7; // Base confidence
        // Boost for well-structured plans
        if (output.steps.length >= 3 && output.steps.length <= 15) {
            confidence += 0.1;
        }
        // Boost for clear critical path
        if (output.critical_path.length > 0) {
            confidence += 0.05;
        }
        // Boost for parallel opportunities
        if (output.analysis.parallel_opportunities > 0) {
            confidence += 0.05;
        }
        // Reduce for many risks
        if (output.analysis.risks.length > 3) {
            confidence -= 0.1;
        }
        return Math.min(1.0, Math.max(0.0, confidence));
    }
    /**
     * Get constraints applied during planning
     */
    getAppliedConstraints(input) {
        const constraints = [
            'read_only_analysis',
            'no_execution',
            'no_agent_assignment',
            'no_resource_allocation',
            'no_scheduling',
            'deterministic_output',
        ];
        if (input.context?.constraints) {
            constraints.push(...input.context.constraints.map(c => `user_constraint:${c}`));
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
    /**
     * Helper: Check if text contains any of the keywords
     */
    containsAny(text, keywords) {
        return keywords.some(kw => text.includes(kw));
    }
}
exports.PlannerAgent = PlannerAgent;
//# sourceMappingURL=planner-agent.js.map