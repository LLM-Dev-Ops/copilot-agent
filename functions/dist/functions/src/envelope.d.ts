/**
 * Response Envelope
 *
 * Every response from copilot-agents MUST include:
 * - execution_metadata (trace_id, timestamp, service, execution_id)
 * - layers_executed (routing + agent layer with status and duration)
 *
 * Agent responses additionally include per-agent execution_metadata inside
 * the `result` wrapper (trace_id, agent, domain, timestamp, pipeline_context).
 */
import { PipelineContext } from '../../services/agents/contracts';
export interface ExecutionMetadata {
    trace_id: string;
    timestamp: string;
    service: 'copilot-agents';
    execution_id: string;
}
export interface LayerExecuted {
    layer: string;
    status: 'completed' | 'error';
    duration_ms?: number;
}
/**
 * Per-agent execution metadata included in the result wrapper
 * when routing to an agent.
 */
export interface AgentExecutionMetadata {
    trace_id: string;
    agent: string;
    domain: string;
    timestamp: string;
    pipeline_context?: PipelineContext;
}
export interface EnvelopedResponse {
    data: unknown;
    execution_metadata: ExecutionMetadata;
    layers_executed: LayerExecuted[];
}
/**
 * Wrap any response payload with execution_metadata and layers_executed
 */
export declare function wrapResponse(data: unknown, executionMetadata: ExecutionMetadata, layersExecuted: LayerExecuted[]): EnvelopedResponse;
/**
 * Wrap an agent result with per-agent execution_metadata.
 *
 * Produces:
 * {
 *   result: <agentResult>,
 *   execution_metadata: { trace_id, agent, domain, timestamp, pipeline_context? }
 * }
 */
export declare function wrapAgentResult(agentResult: unknown, agentMeta: AgentExecutionMetadata): {
    result: unknown;
    execution_metadata: AgentExecutionMetadata;
};
