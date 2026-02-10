/**
 * Agentics Execution Graph - Foundational Execution Unit instrumentation.
 *
 * Defines the hierarchical execution span model that integrates this
 * repository into the Agentics ExecutionGraph system.
 *
 * Invariant: Core → Repo (copilot-agent) → Agent (one or more)
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

/** The name of this repository in the Agentics execution graph. */
export const REPO_NAME = 'copilot-agent';

// ─── Schemas ────────────────────────────────────────────────────────

export const SpanTypeSchema = z.enum(['core', 'repo', 'agent']);
export type SpanType = z.infer<typeof SpanTypeSchema>;

export const ExecutionStatusSchema = z.enum(['running', 'completed', 'failed']);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const ArtifactSchema = z.object({
  name: z.string().min(1),
  artifact_type: z.string().min(1),
  reference: z.string().min(1),
  data: z.unknown(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const ExecutionSpanSchema = z.object({
  span_id: z.string().min(1),
  parent_span_id: z.string().min(1),
  trace_id: z.string().min(1),
  span_type: SpanTypeSchema,
  repo_name: z.string().optional(),
  agent_name: z.string().optional(),
  status: ExecutionStatusSchema,
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  failure_reason: z.string().optional(),
  artifacts: z.array(ArtifactSchema).default([]),
  attributes: z.record(z.string()).default({}),
});
export type ExecutionSpan = z.infer<typeof ExecutionSpanSchema>;

export const ExecutionGraphSchema = z.object({
  execution_id: z.string().min(1),
  repo_span_id: z.string().min(1),
  spans: z.array(ExecutionSpanSchema),
});
export type ExecutionGraphData = z.infer<typeof ExecutionGraphSchema>;

// ─── Builder ────────────────────────────────────────────────────────

function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
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
export class ExecutionGraphBuilder {
  private readonly executionId: string;
  private readonly repoSpanId: string;
  private readonly spans: ExecutionSpan[];

  constructor(executionId: string, parentSpanId: string, traceId: string) {
    if (!parentSpanId) {
      throw new Error('Missing parent_span_id: execution context requires a parent span from the Core');
    }

    this.executionId = executionId || randomUUID();
    this.repoSpanId = generateSpanId();

    const repoSpan: ExecutionSpan = {
      span_id: this.repoSpanId,
      parent_span_id: parentSpanId,
      trace_id: traceId || randomUUID(),
      span_type: 'repo',
      repo_name: REPO_NAME,
      status: 'running',
      start_time: new Date().toISOString(),
      artifacts: [],
      attributes: {},
    };

    this.spans = [repoSpan];
  }

  /** Start a new agent-level span as a child of the repo span. */
  startAgentSpan(agentName: string): string {
    const spanId = generateSpanId();
    const span: ExecutionSpan = {
      span_id: spanId,
      parent_span_id: this.repoSpanId,
      trace_id: this.spans[0].trace_id,
      span_type: 'agent',
      repo_name: REPO_NAME,
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
  completeAgentSpan(spanId: string, artifacts: Artifact[] = []): void {
    const span = this.findSpan(spanId);
    if (span.status !== 'running') {
      throw new Error(`Span already completed: ${spanId}`);
    }
    span.status = 'completed';
    span.end_time = new Date().toISOString();
    span.artifacts = artifacts;
  }

  /** Mark an agent-level span as failed. */
  failAgentSpan(spanId: string, reason: string): void {
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
  completeRepo(): void {
    this.validate();
    const repo = this.findSpan(this.repoSpanId);
    repo.status = 'completed';
    repo.end_time = new Date().toISOString();
  }

  /** Mark the repo-level span as failed, preserving all emitted spans. */
  failRepo(reason: string): void {
    const repo = this.findSpan(this.repoSpanId);
    repo.status = 'failed';
    repo.end_time = new Date().toISOString();
    repo.failure_reason = reason;
  }

  /** Validate that at least one agent span exists. */
  validate(): void {
    const agentCount = this.spans.filter((s) => s.span_type === 'agent').length;
    if (agentCount === 0) {
      throw new Error('No agent-level spans emitted: execution is INVALID without agent spans');
    }
  }

  /** Check if any agent spans exist. */
  hasAgentSpans(): boolean {
    return this.spans.some((s) => s.span_type === 'agent');
  }

  /** Add an attribute to the repo-level span. */
  setRepoAttribute(key: string, value: string): void {
    const repo = this.findSpan(this.repoSpanId);
    repo.attributes[key] = value;
  }

  /** Serialize the graph to a plain JSON-serializable object. */
  toJSON(): ExecutionGraphData {
    return {
      execution_id: this.executionId,
      repo_span_id: this.repoSpanId,
      spans: [...this.spans],
    };
  }

  private findSpan(spanId: string): ExecutionSpan {
    const span = this.spans.find((s) => s.span_id === spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }
    return span;
  }
}
