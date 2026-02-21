"use strict";
/**
 * Agentics Execution Graph - Foundational Execution Unit instrumentation.
 *
 * Defines the hierarchical execution span model that integrates this
 * repository into the Agentics ExecutionGraph system.
 *
 * Invariant: Core → Repo (copilot-agent) → Agent (one or more)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionGraphBuilder = exports.ExecutionGraphSchema = exports.ExecutionSpanSchema = exports.ArtifactSchema = exports.ExecutionStatusSchema = exports.SpanTypeSchema = exports.REPO_NAME = void 0;
const zod_1 = require("zod");
const crypto_1 = require("crypto");
/** The name of this repository in the Agentics execution graph. */
exports.REPO_NAME = 'copilot-agent';
// ─── Schemas ────────────────────────────────────────────────────────
exports.SpanTypeSchema = zod_1.z.enum(['core', 'repo', 'agent']);
exports.ExecutionStatusSchema = zod_1.z.enum(['running', 'completed', 'failed']);
exports.ArtifactSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    artifact_type: zod_1.z.string().min(1),
    reference: zod_1.z.string().min(1),
    data: zod_1.z.unknown(),
});
exports.ExecutionSpanSchema = zod_1.z.object({
    span_id: zod_1.z.string().min(1),
    parent_span_id: zod_1.z.string().min(1),
    trace_id: zod_1.z.string().min(1),
    span_type: exports.SpanTypeSchema,
    repo_name: zod_1.z.string().optional(),
    agent_name: zod_1.z.string().optional(),
    status: exports.ExecutionStatusSchema,
    start_time: zod_1.z.string().datetime(),
    end_time: zod_1.z.string().datetime().optional(),
    failure_reason: zod_1.z.string().optional(),
    artifacts: zod_1.z.array(exports.ArtifactSchema).default([]),
    attributes: zod_1.z.record(zod_1.z.string()).default({}),
});
exports.ExecutionGraphSchema = zod_1.z.object({
    execution_id: zod_1.z.string().min(1),
    repo_span_id: zod_1.z.string().min(1),
    spans: zod_1.z.array(exports.ExecutionSpanSchema),
});
// ─── Builder ────────────────────────────────────────────────────────
function generateSpanId() {
    return (0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 16);
}
/**
 * Builds an ExecutionGraph for a single invocation of this repository.
 *
 * Usage:
 * 1. Create via constructor (auto-creates repo span)
 * 2. Call startAgentSpan() before each agent runs
 * 3. Call completeAgentSpan() or failAgentSpan() when done
 * 4. Call completeRepo() or failRepo() at the end
 * 5. Call toJSON() to get the serialized graph
 */
class ExecutionGraphBuilder {
    executionId;
    repoSpanId;
    spans;
    constructor(executionId, parentSpanId, traceId) {
        if (!parentSpanId) {
            throw new Error('Missing parent_span_id: execution context requires a parent span from the Core');
        }
        this.executionId = executionId || (0, crypto_1.randomUUID)();
        this.repoSpanId = generateSpanId();
        const repoSpan = {
            span_id: this.repoSpanId,
            parent_span_id: parentSpanId,
            trace_id: traceId || (0, crypto_1.randomUUID)(),
            span_type: 'repo',
            repo_name: exports.REPO_NAME,
            status: 'running',
            start_time: new Date().toISOString(),
            artifacts: [],
            attributes: {},
        };
        this.spans = [repoSpan];
    }
    /** Start a new agent-level span as a child of the repo span. */
    startAgentSpan(agentName) {
        const spanId = generateSpanId();
        const span = {
            span_id: spanId,
            parent_span_id: this.repoSpanId,
            trace_id: this.spans[0].trace_id,
            span_type: 'agent',
            repo_name: exports.REPO_NAME,
            agent_name: agentName,
            status: 'running',
            start_time: new Date().toISOString(),
            artifacts: [],
            attributes: {},
        };
        this.spans.push(span);
        return spanId;
    }
    /** Complete an agent-level span with optional artifacts. */
    completeAgentSpan(spanId, artifacts = []) {
        const span = this.findSpan(spanId);
        if (span.status !== 'running') {
            throw new Error(`Span already completed: ${spanId}`);
        }
        span.status = 'completed';
        span.end_time = new Date().toISOString();
        span.artifacts = artifacts;
    }
    /** Mark an agent-level span as failed. */
    failAgentSpan(spanId, reason) {
        const span = this.findSpan(spanId);
        if (span.status !== 'running') {
            throw new Error(`Span already completed: ${spanId}`);
        }
        span.status = 'failed';
        span.end_time = new Date().toISOString();
        span.failure_reason = reason;
    }
    /**
     * Complete the repo-level span.
     * Throws if no agent-level spans were emitted.
     */
    completeRepo() {
        this.validate();
        const repo = this.findSpan(this.repoSpanId);
        repo.status = 'completed';
        repo.end_time = new Date().toISOString();
    }
    /** Mark the repo-level span as failed, preserving all emitted spans. */
    failRepo(reason) {
        const repo = this.findSpan(this.repoSpanId);
        repo.status = 'failed';
        repo.end_time = new Date().toISOString();
        repo.failure_reason = reason;
    }
    /** Validate that at least one agent span exists. */
    validate() {
        const agentCount = this.spans.filter((s) => s.span_type === 'agent').length;
        if (agentCount === 0) {
            throw new Error('No agent-level spans emitted: execution is INVALID without agent spans');
        }
    }
    /** Check if any agent spans exist. */
    hasAgentSpans() {
        return this.spans.some((s) => s.span_type === 'agent');
    }
    /** Add an attribute to the repo-level span. */
    setRepoAttribute(key, value) {
        const repo = this.findSpan(this.repoSpanId);
        repo.attributes[key] = value;
    }
    /** Serialize the graph to a plain JSON-serializable object. */
    toJSON() {
        return {
            execution_id: this.executionId,
            repo_span_id: this.repoSpanId,
            spans: [...this.spans],
        };
    }
    findSpan(spanId) {
        const span = this.spans.find((s) => s.span_id === spanId);
        if (!span) {
            throw new Error(`Span not found: ${spanId}`);
        }
        return span;
    }
}
exports.ExecutionGraphBuilder = ExecutionGraphBuilder;
//# sourceMappingURL=execution-graph.js.map