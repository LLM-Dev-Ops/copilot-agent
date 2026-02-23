"use strict";
/**
 * Decomposer Agent
 *
 * Purpose: Decompose complex objectives into manageable sub-objectives
 * Classification: DECOMPOSITION, STRUCTURAL_SYNTHESIS
 * decision_type: objective_decomposition
 *
 * Scope:
 * - Break complex objectives into sub-objectives
 * - Identify sub-objective relationships
 * - Assess decomposition completeness
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
 * - Execute sub-objectives
 * - Assign agents
 * - Allocate resources
 * - Schedule execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecomposerAgent = void 0;
const uuid_1 = require("uuid");
const contracts_1 = require("../contracts");
const AGENT_ID = 'decomposer-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'objective_decomposition';
/**
 * Decomposer Agent Implementation
 *
 * This agent analyzes complex objectives and produces structured sub-objectives.
 * It is purely analytical - it NEVER executes, assigns, or schedules anything.
 */
class DecomposerAgent {
    metadata = {
        id: AGENT_ID,
        name: 'Decomposer Agent',
        version: AGENT_VERSION,
        classifications: [
            contracts_1.AgentClassification.DECOMPOSITION,
            contracts_1.AgentClassification.STRUCTURAL_SYNTHESIS,
        ],
        decision_type: DECISION_TYPE,
        description: 'Decomposes complex objectives into manageable sub-objectives with relationships and completeness assessment.',
    };
    persistence;
    telemetry;
    constructor(persistence, telemetry) {
        this.persistence = persistence;
        this.telemetry = telemetry;
    }
    /**
     * Validate input against DecomposerInputSchema
     */
    validateInput(input) {
        return contracts_1.DecomposerInputSchema.parse(input);
    }
    /**
     * Invoke the decomposer agent
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
            // Decompose the objective (pure analysis, no side effects)
            const output = this.decompose(input);
            // Validate output
            const validatedOutput = contracts_1.DecomposerOutputSchema.parse(output);
            // Calculate confidence based on decomposition quality
            const confidence = this.calculateConfidence(validatedOutput);
            // Constraints applied during decomposition
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
     * Decompose objective into sub-objectives
     *
     * This is the core decomposition logic - purely analytical.
     * NEVER executes, assigns agents, or schedules anything.
     */
    decompose(input) {
        const decompositionId = (0, uuid_1.v4)();
        const maxDepth = input.context?.max_depth ?? 3;
        const maxSubObjectives = input.config?.max_sub_objectives ?? 20;
        const subObjectives = this.extractSubObjectives(input, maxDepth, maxSubObjectives);
        const treeStructure = this.buildTreeStructure(subObjectives);
        const dependencyGraph = this.buildDependencyGraph(subObjectives);
        const atomicCount = subObjectives.filter(s => s.is_atomic).length;
        const complexityDist = this.calculateComplexityDistribution(subObjectives);
        const coverageScore = this.assessCoverage(subObjectives, input);
        const maxDepthReached = Math.max(0, ...subObjectives.map(s => s.depth));
        return {
            decomposition_id: decompositionId,
            original_objective: this.summarize(input.objective),
            sub_objectives: subObjectives,
            tree_structure: treeStructure,
            dependency_graph: dependencyGraph,
            analysis: {
                total_sub_objectives: subObjectives.length,
                max_depth_reached: maxDepthReached,
                atomic_count: atomicCount,
                coverage_score: coverageScore,
                complexity_distribution: complexityDist,
                assumptions: this.extractAssumptions(input),
            },
            version: '1.0.0',
        };
    }
    /**
     * Extract sub-objectives from the objective using pattern-based analysis
     */
    extractSubObjectives(input, maxDepth, maxCount) {
        const objective = input.objective.toLowerCase();
        const subs = [];
        let counter = 0;
        const addSub = (title, description, parentId, depth, tags, complexity, isAtomic, deps = [], criteria = []) => {
            if (subs.length >= maxCount || depth > maxDepth)
                return '';
            const id = `sub-${++counter}`;
            subs.push({
                sub_objective_id: id,
                title,
                description,
                parent_id: parentId,
                depth,
                dependencies: deps,
                tags,
                complexity,
                is_atomic: isAtomic,
                acceptance_criteria: criteria,
            });
            return id;
        };
        // Top-level: understand requirements
        const understandId = addSub('Understand Requirements', 'Analyze and capture all requirements from the objective', null, 0, ['requirements', 'analysis'], 'simple', true, [], ['All requirements identified', 'Ambiguities documented']);
        // Top-level: design approach
        const designId = addSub('Design Approach', 'Design the solution approach and architecture', null, 0, ['design', 'architecture'], 'moderate', false, understandId ? [{ depends_on: understandId, type: 'data' }] : [], ['Architecture decisions documented', 'Approach validated']);
        // Conditional sub-objectives based on objective content
        if (this.containsAny(objective, ['build', 'create', 'implement', 'develop'])) {
            const implId = addSub('Implement Core Logic', 'Implement the core functionality described in the objective', null, 0, ['implementation', 'core'], 'complex', false, designId ? [{ depends_on: designId, type: 'blocking' }] : [], ['Core functionality working', 'Unit tests passing']);
            if (implId && maxDepth >= 1) {
                addSub('Set Up Project Structure', 'Create the project scaffolding and configuration', implId, 1, ['setup', 'scaffolding'], 'simple', true, [], ['Project structure created', 'Dependencies installed']);
                addSub('Implement Business Logic', 'Build the primary business logic components', implId, 1, ['business-logic', 'core'], 'complex', true, [], ['Business rules implemented', 'Edge cases handled']);
            }
        }
        if (this.containsAny(objective, ['api', 'service', 'endpoint', 'interface'])) {
            addSub('Define Interface Contracts', 'Specify API contracts, schemas, and interface boundaries', designId, 1, ['interfaces', 'contracts', 'api'], 'moderate', true, [], ['API contracts defined', 'Schemas validated']);
        }
        if (this.containsAny(objective, ['test', 'validate', 'verify', 'quality'])) {
            addSub('Establish Validation Strategy', 'Define the testing and validation approach', null, 0, ['testing', 'validation'], 'moderate', true, designId ? [{ depends_on: designId, type: 'data' }] : [], ['Test strategy defined', 'Coverage targets set']);
        }
        if (this.containsAny(objective, ['deploy', 'release', 'production', 'launch'])) {
            addSub('Plan Deployment', 'Define the deployment and release strategy', null, 0, ['deployment', 'release'], 'moderate', true, designId ? [{ depends_on: designId, type: 'data' }] : [], ['Deployment pipeline defined', 'Rollback plan documented']);
        }
        if (this.containsAny(objective, ['integrate', 'connect', 'migrate'])) {
            addSub('Plan Integration', 'Define integration points and data flow between systems', null, 0, ['integration', 'connectivity'], 'complex', false, designId ? [{ depends_on: designId, type: 'data' }] : [], ['Integration points mapped', 'Data flow documented']);
        }
        // Always add a completion/review sub-objective
        const allTopLevel = subs.filter(s => s.parent_id === null).map(s => s.sub_objective_id);
        addSub('Review and Validate Completeness', 'Ensure all sub-objectives adequately cover the original objective', null, 0, ['review', 'completeness'], 'simple', true, allTopLevel.map(id => ({ depends_on: id, type: 'data' })), ['All sub-objectives addressed', 'Coverage verified']);
        return subs;
    }
    /**
     * Build tree structure (parent -> children) from sub-objectives
     */
    buildTreeStructure(subs) {
        const tree = { root: [] };
        for (const sub of subs) {
            if (sub.parent_id === null) {
                tree.root.push(sub.sub_objective_id);
            }
            else {
                if (!tree[sub.parent_id]) {
                    tree[sub.parent_id] = [];
                }
                tree[sub.parent_id].push(sub.sub_objective_id);
            }
        }
        return tree;
    }
    /**
     * Build dependency graph as adjacency list
     */
    buildDependencyGraph(subs) {
        const graph = {};
        for (const sub of subs) {
            graph[sub.sub_objective_id] = sub.dependencies.map(d => d.depends_on);
        }
        return graph;
    }
    /**
     * Calculate complexity distribution
     */
    calculateComplexityDistribution(subs) {
        const dist = {
            trivial: 0, simple: 0, moderate: 0, complex: 0, very_complex: 0,
        };
        for (const sub of subs) {
            dist[sub.complexity]++;
        }
        return dist;
    }
    /**
     * Assess how well the sub-objectives cover the original objective
     */
    assessCoverage(subs, input) {
        let score = 0.5; // Base coverage
        // More sub-objectives generally means better coverage (up to a point)
        if (subs.length >= 3 && subs.length <= 15)
            score += 0.15;
        if (subs.length > 15)
            score += 0.1;
        // Atomic sub-objectives are actionable
        const atomicRatio = subs.filter(s => s.is_atomic).length / subs.length;
        if (atomicRatio > 0.4)
            score += 0.1;
        // Sub-objectives with acceptance criteria
        const criteriaRatio = subs.filter(s => s.acceptance_criteria.length > 0).length / subs.length;
        score += criteriaRatio * 0.15;
        // Multi-depth decomposition
        const maxDepth = Math.max(0, ...subs.map(s => s.depth));
        if (maxDepth >= 1)
            score += 0.1;
        return Math.min(1.0, Math.max(0.0, score));
    }
    /**
     * Summarize objective for output
     */
    summarize(objective) {
        const cleaned = objective.trim().replace(/\s+/g, ' ');
        return cleaned.length > 200 ? cleaned.substring(0, 197) + '...' : cleaned;
    }
    /**
     * Extract assumptions made during decomposition
     */
    extractAssumptions(input) {
        const assumptions = [
            'Objective has been validated for clarity',
            'Decomposition is based on structural analysis of the objective text',
        ];
        if (!input.context?.constraints?.length) {
            assumptions.push('No explicit constraints provided - using default decomposition strategy');
        }
        if (!input.context?.existing_components?.length) {
            assumptions.push('No existing components specified - decomposing as new work');
        }
        if (!input.config?.target_granularity) {
            assumptions.push('Using medium granularity as default');
        }
        return assumptions;
    }
    /**
     * Calculate confidence score based on decomposition quality
     */
    calculateConfidence(output) {
        let confidence = 0.65; // Base confidence
        // Boost for well-structured decompositions
        if (output.sub_objectives.length >= 3 && output.sub_objectives.length <= 20) {
            confidence += 0.1;
        }
        // Boost for good coverage
        if (output.analysis.coverage_score >= 0.7) {
            confidence += 0.1;
        }
        // Boost for multi-depth decomposition
        if (output.analysis.max_depth_reached >= 1) {
            confidence += 0.05;
        }
        // Boost for atomic sub-objectives
        if (output.analysis.atomic_count > 0) {
            confidence += 0.05;
        }
        // Reduce for too many sub-objectives (potential over-decomposition)
        if (output.sub_objectives.length > 25) {
            confidence -= 0.1;
        }
        return Math.min(1.0, Math.max(0.0, confidence));
    }
    /**
     * Get constraints applied during decomposition
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
exports.DecomposerAgent = DecomposerAgent;
//# sourceMappingURL=decomposer-agent.js.map