"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapResponse = wrapResponse;
exports.wrapAgentResult = wrapAgentResult;
/**
 * Wrap any response payload with execution_metadata and layers_executed
 */
function wrapResponse(data, executionMetadata, layersExecuted) {
    return {
        data,
        execution_metadata: executionMetadata,
        layers_executed: layersExecuted,
    };
}
/**
 * Wrap an agent result with per-agent execution_metadata.
 *
 * Produces:
 * {
 *   result: <agentResult>,
 *   execution_metadata: { trace_id, agent, domain, timestamp, pipeline_context? }
 * }
 */
function wrapAgentResult(agentResult, agentMeta) {
    return {
        result: agentResult,
        execution_metadata: agentMeta,
    };
}
//# sourceMappingURL=envelope.js.map