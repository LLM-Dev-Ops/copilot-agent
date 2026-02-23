"use strict";
/**
 * Decomposer Agent
 *
 * Purpose: Decompose complex objectives into manageable sub-objectives
 *          and produce structured pipeline execution plans.
 * Classification: DECOMPOSITION, STRUCTURAL_SYNTHESIS
 * decision_type: objective_decomposition
 *
 * Scope:
 * - Break complex objectives into sub-objectives
 * - Identify sub-objective relationships
 * - Assess decomposition completeness
 * - Produce a pipeline spec (DAG) routing to agents across the 27-domain registry
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
const DOMAIN_ROUTES = [
    // copilot domain
    { keywords: ['plan', 'strategy', 'roadmap', 'approach'], domain: 'copilot', agent: 'planner', description: 'Generate implementation plan', output_schema: 'plan_artifact' },
    { keywords: ['clarify', 'ambiguous', 'unclear', 'requirements'], domain: 'copilot', agent: 'clarifier', description: 'Clarify objective requirements', output_schema: 'clarification_artifact' },
    { keywords: ['intent', 'classify', 'categorize'], domain: 'copilot', agent: 'intent', description: 'Classify user intent', output_schema: 'intent_artifact' },
    { keywords: ['reflect', 'evaluate', 'review', 'quality'], domain: 'copilot', agent: 'reflection', description: 'Evaluate decision quality', output_schema: 'reflection_artifact' },
    { keywords: ['validate', 'config', 'configuration'], domain: 'copilot', agent: 'config', description: 'Validate configuration', output_schema: 'config_artifact' },
    // forge domain
    { keywords: ['scaffold', 'mvp', 'prototype', 'boilerplate'], domain: 'forge', agent: 'scaffold', description: 'Scaffold project structure', output_schema: 'forge_artifact' },
    { keywords: ['sdk', 'library', 'package'], domain: 'forge', agent: 'sdk', description: 'Generate SDK / library scaffold', output_schema: 'forge_artifact' },
    { keywords: ['template', 'starter'], domain: 'forge', agent: 'template', description: 'Apply project template', output_schema: 'forge_artifact' },
    // runtime domain
    { keywords: ['execute', 'run', 'sandbox'], domain: 'runtime', agent: 'executor', description: 'Execute code in sandbox', output_schema: 'runtime_artifact' },
    // data domain
    { keywords: ['ingest', 'etl', 'import', 'data pipeline'], domain: 'data', agent: 'ingest', description: 'Ingest data from sources', output_schema: 'data_artifact' },
    { keywords: ['transform', 'clean', 'normalize data'], domain: 'data', agent: 'transform', description: 'Transform and clean data', output_schema: 'data_artifact' },
    { keywords: ['query', 'sql', 'database', 'db'], domain: 'data', agent: 'query', description: 'Query data sources', output_schema: 'data_artifact' },
    // auth domain
    { keywords: ['auth', 'login', 'identity', 'sso', 'oauth'], domain: 'auth', agent: 'identity', description: 'Set up authentication / identity', output_schema: 'auth_artifact' },
    { keywords: ['rbac', 'permission', 'role', 'access control'], domain: 'auth', agent: 'rbac', description: 'Configure role-based access', output_schema: 'auth_artifact' },
    // deploy domain
    { keywords: ['deploy', 'release', 'ship', 'production', 'ci/cd'], domain: 'deploy', agent: 'cd', description: 'Plan deployment pipeline', output_schema: 'deploy_artifact' },
    { keywords: ['rollback', 'revert'], domain: 'deploy', agent: 'rollback', description: 'Plan rollback strategy', output_schema: 'deploy_artifact' },
    // test domain
    { keywords: ['test', 'unit test', 'spec'], domain: 'test', agent: 'unit', description: 'Generate unit tests', output_schema: 'test_artifact' },
    { keywords: ['integration test', 'contract test'], domain: 'test', agent: 'integration', description: 'Generate integration tests', output_schema: 'test_artifact' },
    { keywords: ['e2e', 'end-to-end', 'acceptance test'], domain: 'test', agent: 'e2e', description: 'Generate end-to-end tests', output_schema: 'test_artifact' },
    // docs domain
    { keywords: ['document', 'docs', 'readme', 'api doc'], domain: 'docs', agent: 'generate', description: 'Generate documentation', output_schema: 'docs_artifact' },
    // security domain
    { keywords: ['security', 'scan', 'vulnerability'], domain: 'security', agent: 'scan', description: 'Run security scan', output_schema: 'security_artifact' },
    { keywords: ['audit', 'compliance', 'gdpr', 'hipaa', 'soc2'], domain: 'security', agent: 'audit', description: 'Perform security audit', output_schema: 'security_artifact' },
    // ml domain
    { keywords: ['train', 'model', 'machine learning', 'ml'], domain: 'ml', agent: 'train', description: 'Train ML model', output_schema: 'ml_artifact' },
    { keywords: ['inference', 'predict'], domain: 'ml', agent: 'inference', description: 'Run ML inference', output_schema: 'ml_artifact' },
    // ui domain
    { keywords: ['ui', 'component', 'frontend', 'react', 'vue'], domain: 'ui', agent: 'component', description: 'Build UI components', output_schema: 'ui_artifact' },
    // messaging domain
    { keywords: ['event', 'pubsub', 'queue', 'message', 'kafka'], domain: 'messaging', agent: 'pubsub', description: 'Configure messaging / events', output_schema: 'messaging_artifact' },
    // storage domain
    { keywords: ['storage', 'upload', 'blob', 'file', 's3'], domain: 'storage', agent: 'blob', description: 'Configure storage', output_schema: 'storage_artifact' },
    { keywords: ['cache', 'redis', 'memcache'], domain: 'storage', agent: 'cache', description: 'Configure caching layer', output_schema: 'storage_artifact' },
    // gateway domain
    { keywords: ['api gateway', 'route', 'proxy', 'rate limit'], domain: 'gateway', agent: 'route', description: 'Configure API gateway', output_schema: 'gateway_artifact' },
    // analytics domain
    { keywords: ['analytics', 'metrics', 'dashboard', 'report'], domain: 'analytics', agent: 'report', description: 'Set up analytics / reporting', output_schema: 'analytics_artifact' },
    // notification domain
    { keywords: ['notify', 'email', 'push', 'webhook', 'alert'], domain: 'notification', agent: 'webhook', description: 'Configure notifications', output_schema: 'notification_artifact' },
    // migration domain
    { keywords: ['migrate', 'migration', 'upgrade'], domain: 'migration', agent: 'schema', description: 'Plan migration', output_schema: 'migration_artifact' },
    // i18n domain
    { keywords: ['translate', 'i18n', 'locale', 'internationali'], domain: 'i18n', agent: 'translate', description: 'Set up internationalisation', output_schema: 'i18n_artifact' },
    // devtools domain
    { keywords: ['lint', 'format', 'prettier', 'eslint'], domain: 'devtools', agent: 'lint', description: 'Configure linting / formatting', output_schema: 'devtools_artifact' },
    // observability domain
    { keywords: ['monitor', 'trace', 'observability', 'log'], domain: 'observability', agent: 'trace', description: 'Set up observability', output_schema: 'observability_artifact' },
    // edge domain
    { keywords: ['cdn', 'edge', 'serverless function'], domain: 'edge', agent: 'cdn', description: 'Configure edge / CDN', output_schema: 'edge_artifact' },
    // secret domain
    { keywords: ['secret', 'vault', 'credential', 'env var'], domain: 'secret', agent: 'vault', description: 'Manage secrets / credentials', output_schema: 'secret_artifact' },
    // workflow domain
    { keywords: ['workflow', 'pipeline', 'orchestrat'], domain: 'workflow', agent: 'orchestrate', description: 'Design workflow orchestration', output_schema: 'workflow_artifact' },
    // billing domain
    { keywords: ['billing', 'payment', 'invoice', 'subscription'], domain: 'billing', agent: 'meter', description: 'Configure billing / metering', output_schema: 'billing_artifact' },
    // config (as a domain, distinct from copilot/config agent)
    { keywords: ['feature flag', 'remote config', 'distribute config'], domain: 'config', agent: 'distribute', description: 'Distribute configuration', output_schema: 'config_dist_artifact' },
    // search domain
    { keywords: ['search', 'elasticsearch', 'full-text', 'index'], domain: 'search', agent: 'index', description: 'Set up search indexing', output_schema: 'search_artifact' },
];
/**
 * Decomposer Agent Implementation
 *
 * This agent analyzes complex objectives and produces:
 * 1. Structured sub-objectives (legacy output, always produced)
 * 2. A pipeline_spec — a DAG of steps routed across the 27-domain registry
 *
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
        description: 'Decomposes complex objectives into manageable sub-objectives and produces structured pipeline execution plans routed across the 27-domain registry.',
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
            // Build the pipeline spec from the sub-objectives + objective text
            const pipelineSpec = this.buildPipelineSpec(input, validatedOutput);
            // Combined output: legacy decomposer output + pipeline_spec
            const combinedOutput = {
                ...validatedOutput,
                pipeline_spec: pipelineSpec,
            };
            // Calculate confidence based on decomposition quality
            const confidence = this.calculateConfidence(validatedOutput);
            // Constraints applied during decomposition
            const constraintsApplied = this.getAppliedConstraints(input);
            // Create the DecisionEvent
            const event = (0, contracts_1.createDecisionEvent)(AGENT_ID, AGENT_VERSION, DECISION_TYPE, input, combinedOutput, confidence, constraintsApplied, executionRef);
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
    // -------------------------------------------------------------------------
    // Pipeline Spec Builder
    // -------------------------------------------------------------------------
    /**
     * Build a structured pipeline spec (DAG) from the objective.
     *
     * Analyses the query text to select domains and agents from the
     * 27-domain registry. Produces an ordered list of steps where
     * `input_from` expresses data-flow dependencies.
     */
    buildPipelineSpec(input, decomposition) {
        const planId = (0, uuid_1.v4)();
        const objectiveLower = input.objective.toLowerCase();
        // --- Step 1: always start with a planner step ---
        const steps = [
            {
                step_id: '1',
                domain: 'copilot',
                agent: 'planner',
                description: 'Generate implementation plan',
                input_from: null,
                output_schema: 'plan_artifact',
            },
        ];
        let stepCounter = 1;
        const usedDomainAgents = new Set(['copilot/planner']);
        // --- Step 2: match objective keywords to domain routes ---
        for (const route of DOMAIN_ROUTES) {
            const key = `${route.domain}/${route.agent}`;
            if (usedDomainAgents.has(key))
                continue;
            const matched = route.keywords.some(kw => objectiveLower.includes(kw));
            if (!matched)
                continue;
            usedDomainAgents.add(key);
            stepCounter++;
            // Determine dependency: most steps depend on the planner output.
            // Build/scaffold steps depend on planner; test steps depend on build; deploy depends on test.
            let inputFrom = '1'; // default: depends on planner
            if (route.domain === 'test') {
                // test depends on the latest forge/runtime step, or planner
                const buildStep = steps.find(s => s.domain === 'forge' || s.domain === 'runtime');
                inputFrom = buildStep ? buildStep.step_id : '1';
            }
            else if (route.domain === 'deploy') {
                // deploy depends on latest test step, or build, or planner
                const testStep = steps.find(s => s.domain === 'test');
                const buildStep = steps.find(s => s.domain === 'forge' || s.domain === 'runtime');
                inputFrom = testStep ? testStep.step_id : (buildStep ? buildStep.step_id : '1');
            }
            else if (route.domain === 'docs') {
                // docs depend on planner + any build step
                const buildStep = steps.find(s => s.domain === 'forge' || s.domain === 'runtime');
                inputFrom = buildStep ? buildStep.step_id : '1';
            }
            steps.push({
                step_id: String(stepCounter),
                domain: route.domain,
                agent: route.agent,
                description: route.description,
                input_from: inputFrom,
                output_schema: route.output_schema,
            });
        }
        // --- Step 3: if nothing beyond planner was matched, add a forge/scaffold step ---
        if (steps.length === 1) {
            steps.push({
                step_id: '2',
                domain: 'forge',
                agent: 'sdk',
                description: 'Scaffold MVP from plan',
                input_from: '1',
                output_schema: 'forge_artifact',
            });
        }
        // Validate (will throw on schema violation, caught in invoke)
        const spec = contracts_1.PipelineSpecSchema.parse({
            plan_id: planId,
            steps,
            metadata: {
                source_query: input.objective,
                created_at: new Date().toISOString(),
                estimated_steps: steps.length,
            },
        });
        return spec;
    }
    // -------------------------------------------------------------------------
    // Legacy Decomposition Logic (unchanged)
    // -------------------------------------------------------------------------
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
            'pipeline_spec_generation',
        ];
        if (input.context?.constraints) {
            constraints.push(...input.context.constraints.map(c => `user_constraint:${c}`));
        }
        if (input.pipeline_context) {
            constraints.push('pipeline_context_present');
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