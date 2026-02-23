/**
 * Agentics Execution Graph - Foundational Execution Unit instrumentation.
 *
 * Defines the hierarchical execution span model that integrates this
 * repository into the Agentics ExecutionGraph system.
 *
 * Invariant: Core → Repo (copilot-agent) → Agent (one or more)
 */
import { z } from 'zod';
/** The name of this repository in the Agentics execution graph. */
export declare const REPO_NAME = "copilot-agent";
export declare const SpanTypeSchema: z.ZodEnum<["core", "repo", "agent"]>;
export type SpanType = z.infer<typeof SpanTypeSchema>;
export declare const ExecutionStatusSchema: z.ZodEnum<["running", "completed", "failed"]>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export declare const ArtifactSchema: z.ZodObject<{
    name: z.ZodString;
    artifact_type: z.ZodString;
    reference: z.ZodString;
    data: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    name: string;
    artifact_type: string;
    reference: string;
    data?: unknown;
}, {
    name: string;
    artifact_type: string;
    reference: string;
    data?: unknown;
}>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export declare const ExecutionSpanSchema: z.ZodObject<{
    span_id: z.ZodString;
    parent_span_id: z.ZodString;
    trace_id: z.ZodString;
    span_type: z.ZodEnum<["core", "repo", "agent"]>;
    repo_name: z.ZodOptional<z.ZodString>;
    agent_name: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["running", "completed", "failed"]>;
    start_time: z.ZodString;
    end_time: z.ZodOptional<z.ZodString>;
    failure_reason: z.ZodOptional<z.ZodString>;
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        artifact_type: z.ZodString;
        reference: z.ZodString;
        data: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        name: string;
        artifact_type: string;
        reference: string;
        data?: unknown;
    }, {
        name: string;
        artifact_type: string;
        reference: string;
        data?: unknown;
    }>, "many">>;
    attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "running" | "failed";
    trace_id: string;
    artifacts: {
        name: string;
        artifact_type: string;
        reference: string;
        data?: unknown;
    }[];
    span_id: string;
    parent_span_id: string;
    span_type: "agent" | "core" | "repo";
    start_time: string;
    attributes: Record<string, string>;
    repo_name?: string | undefined;
    agent_name?: string | undefined;
    end_time?: string | undefined;
    failure_reason?: string | undefined;
}, {
    status: "completed" | "running" | "failed";
    trace_id: string;
    span_id: string;
    parent_span_id: string;
    span_type: "agent" | "core" | "repo";
    start_time: string;
    artifacts?: {
        name: string;
        artifact_type: string;
        reference: string;
        data?: unknown;
    }[] | undefined;
    repo_name?: string | undefined;
    agent_name?: string | undefined;
    end_time?: string | undefined;
    failure_reason?: string | undefined;
    attributes?: Record<string, string> | undefined;
}>;
export type ExecutionSpan = z.infer<typeof ExecutionSpanSchema>;
export declare const ExecutionGraphSchema: z.ZodObject<{
    execution_id: z.ZodString;
    repo_span_id: z.ZodString;
    spans: z.ZodArray<z.ZodObject<{
        span_id: z.ZodString;
        parent_span_id: z.ZodString;
        trace_id: z.ZodString;
        span_type: z.ZodEnum<["core", "repo", "agent"]>;
        repo_name: z.ZodOptional<z.ZodString>;
        agent_name: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<["running", "completed", "failed"]>;
        start_time: z.ZodString;
        end_time: z.ZodOptional<z.ZodString>;
        failure_reason: z.ZodOptional<z.ZodString>;
        artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            artifact_type: z.ZodString;
            reference: z.ZodString;
            data: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            name: string;
            artifact_type: string;
            reference: string;
            data?: unknown;
        }, {
            name: string;
            artifact_type: string;
            reference: string;
            data?: unknown;
        }>, "many">>;
        attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "completed" | "running" | "failed";
        trace_id: string;
        artifacts: {
            name: string;
            artifact_type: string;
            reference: string;
            data?: unknown;
        }[];
        span_id: string;
        parent_span_id: string;
        span_type: "agent" | "core" | "repo";
        start_time: string;
        attributes: Record<string, string>;
        repo_name?: string | undefined;
        agent_name?: string | undefined;
        end_time?: string | undefined;
        failure_reason?: string | undefined;
    }, {
        status: "completed" | "running" | "failed";
        trace_id: string;
        span_id: string;
        parent_span_id: string;
        span_type: "agent" | "core" | "repo";
        start_time: string;
        artifacts?: {
            name: string;
            artifact_type: string;
            reference: string;
            data?: unknown;
        }[] | undefined;
        repo_name?: string | undefined;
        agent_name?: string | undefined;
        end_time?: string | undefined;
        failure_reason?: string | undefined;
        attributes?: Record<string, string> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    spans: {
        status: "completed" | "running" | "failed";
        trace_id: string;
        artifacts: {
            name: string;
            artifact_type: string;
            reference: string;
            data?: unknown;
        }[];
        span_id: string;
        parent_span_id: string;
        span_type: "agent" | "core" | "repo";
        start_time: string;
        attributes: Record<string, string>;
        repo_name?: string | undefined;
        agent_name?: string | undefined;
        end_time?: string | undefined;
        failure_reason?: string | undefined;
    }[];
    execution_id: string;
    repo_span_id: string;
}, {
    spans: {
        status: "completed" | "running" | "failed";
        trace_id: string;
        span_id: string;
        parent_span_id: string;
        span_type: "agent" | "core" | "repo";
        start_time: string;
        artifacts?: {
            name: string;
            artifact_type: string;
            reference: string;
            data?: unknown;
        }[] | undefined;
        repo_name?: string | undefined;
        agent_name?: string | undefined;
        end_time?: string | undefined;
        failure_reason?: string | undefined;
        attributes?: Record<string, string> | undefined;
    }[];
    execution_id: string;
    repo_span_id: string;
}>;
export type ExecutionGraphData = z.infer<typeof ExecutionGraphSchema>;
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
export declare class ExecutionGraphBuilder {
    private readonly executionId;
    private readonly repoSpanId;
    private readonly spans;
    constructor(executionId: string, parentSpanId: string, traceId: string);
    /** Start a new agent-level span as a child of the repo span. */
    startAgentSpan(agentName: string): string;
    /** Complete an agent-level span with optional artifacts. */
    completeAgentSpan(spanId: string, artifacts?: Artifact[]): void;
    /** Mark an agent-level span as failed. */
    failAgentSpan(spanId: string, reason: string): void;
    /**
     * Complete the repo-level span.
     * Throws if no agent-level spans were emitted.
     */
    completeRepo(): void;
    /** Mark the repo-level span as failed, preserving all emitted spans. */
    failRepo(reason: string): void;
    /** Validate that at least one agent span exists. */
    validate(): void;
    /** Check if any agent spans exist. */
    hasAgentSpans(): boolean;
    /** Add an attribute to the repo-level span. */
    setRepoAttribute(key: string, value: string): void;
    /** Serialize the graph to a plain JSON-serializable object. */
    toJSON(): ExecutionGraphData;
    private findSpan;
}
