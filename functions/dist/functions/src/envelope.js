"use strict";
/**
 * Response Envelope
 *
 * Every response from copilot-agents MUST include:
 * - execution_metadata (trace_id, timestamp, service, execution_id)
 * - layers_executed (routing + agent layer with status and duration)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapResponse = wrapResponse;
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
//# sourceMappingURL=envelope.js.map