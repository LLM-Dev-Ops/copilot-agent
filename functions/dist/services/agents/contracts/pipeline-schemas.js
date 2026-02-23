"use strict";
/**
 * Pipeline Orchestration Schemas
 *
 * Types for multi-agent pipeline orchestration.
 * Used by the decomposer to produce execution plans and by all agents
 * to accept/echo pipeline context for traceability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineContextSchema = exports.PipelineStepRefSchema = exports.PipelineSpecSchema = exports.PipelineStepSchema = exports.DOMAIN_NAMES = exports.DOMAIN_REGISTRY = void 0;
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// 27-Domain Registry
// ---------------------------------------------------------------------------
/**
 * The full Agentics domain registry. The decomposer uses this to route
 * pipeline steps to the correct domain + agent.
 */
exports.DOMAIN_REGISTRY = {
    copilot: { agents: ['planner', 'config', 'decomposer', 'clarifier', 'intent', 'reflection', 'meta-reasoner'] },
    forge: { agents: ['sdk', 'scaffold', 'template'] },
    runtime: { agents: ['executor', 'sandbox', 'wasm'] },
    data: { agents: ['ingest', 'transform', 'query'] },
    auth: { agents: ['identity', 'rbac', 'token'] },
    observability: { agents: ['metrics', 'trace', 'log'] },
    deploy: { agents: ['ci', 'cd', 'rollback'] },
    test: { agents: ['unit', 'integration', 'e2e'] },
    docs: { agents: ['generate', 'index', 'search'] },
    security: { agents: ['scan', 'audit', 'compliance'] },
    ml: { agents: ['train', 'inference', 'evaluate'] },
    search: { agents: ['index', 'query', 'rank'] },
    storage: { agents: ['blob', 'cache', 'archive'] },
    messaging: { agents: ['pubsub', 'queue', 'stream'] },
    gateway: { agents: ['route', 'ratelimit', 'transform'] },
    workflow: { agents: ['orchestrate', 'schedule', 'retry'] },
    ui: { agents: ['component', 'layout', 'theme'] },
    analytics: { agents: ['collect', 'aggregate', 'report'] },
    billing: { agents: ['meter', 'invoice', 'plan'] },
    notification: { agents: ['email', 'push', 'webhook'] },
    migration: { agents: ['schema', 'data', 'rollback'] },
    config: { agents: ['validate', 'distribute', 'version'] },
    secret: { agents: ['vault', 'rotate', 'inject'] },
    edge: { agents: ['cdn', 'function', 'cache'] },
    compliance: { agents: ['gdpr', 'hipaa', 'soc2'] },
    i18n: { agents: ['translate', 'locale', 'format'] },
    devtools: { agents: ['lint', 'format', 'debug'] },
};
exports.DOMAIN_NAMES = Object.keys(exports.DOMAIN_REGISTRY);
// ---------------------------------------------------------------------------
// Pipeline Step (produced by decomposer)
// ---------------------------------------------------------------------------
exports.PipelineStepSchema = zod_1.z.object({
    /** Step identifier within the pipeline */
    step_id: zod_1.z.string().min(1),
    /** Target domain from the 27-domain registry */
    domain: zod_1.z.string().min(1),
    /** Target agent within the domain */
    agent: zod_1.z.string().min(1),
    /** Human-readable description of what this step does */
    description: zod_1.z.string().min(1),
    /** step_id of the step whose output feeds into this step (null if no dependency) */
    input_from: zod_1.z.string().nullable(),
    /** Label for the expected output artifact type */
    output_schema: zod_1.z.string().min(1),
});
// ---------------------------------------------------------------------------
// Pipeline Spec (decomposer output)
// ---------------------------------------------------------------------------
exports.PipelineSpecSchema = zod_1.z.object({
    /** Unique plan identifier */
    plan_id: zod_1.z.string().uuid(),
    /** Ordered list of execution steps */
    steps: zod_1.z.array(exports.PipelineStepSchema).min(1),
    /** Pipeline metadata */
    metadata: zod_1.z.object({
        /** Original NL query that triggered decomposition */
        source_query: zod_1.z.string(),
        /** ISO timestamp of pipeline creation */
        created_at: zod_1.z.string().datetime(),
        /** Number of steps in the pipeline */
        estimated_steps: zod_1.z.number().int().nonnegative(),
    }),
});
// ---------------------------------------------------------------------------
// Pipeline Context (sent with requests in a pipeline)
// ---------------------------------------------------------------------------
exports.PipelineStepRefSchema = zod_1.z.object({
    step_id: zod_1.z.string(),
    domain: zod_1.z.string(),
    agent: zod_1.z.string(),
    output: zod_1.z.unknown().optional(),
});
exports.PipelineContextSchema = zod_1.z.object({
    /** Pipeline plan ID */
    plan_id: zod_1.z.string(),
    /** Current step being executed */
    step_id: zod_1.z.string(),
    /** Outputs from previously completed steps */
    previous_steps: zod_1.z.array(exports.PipelineStepRefSchema).default([]),
    /** Execution-level metadata */
    execution_metadata: zod_1.z.object({
        trace_id: zod_1.z.string(),
        initiated_by: zod_1.z.string(),
    }).optional(),
});
//# sourceMappingURL=pipeline-schemas.js.map