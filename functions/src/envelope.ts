/**
 * Response Envelope
 *
 * Every response from copilot-agents MUST include:
 * - execution_metadata (trace_id, timestamp, service, execution_id)
 * - layers_executed (routing + agent layer with status and duration)
 */

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

export interface EnvelopedResponse {
  data: unknown;
  execution_metadata: ExecutionMetadata;
  layers_executed: LayerExecuted[];
}

/**
 * Wrap any response payload with execution_metadata and layers_executed
 */
export function wrapResponse(
  data: unknown,
  executionMetadata: ExecutionMetadata,
  layersExecuted: LayerExecuted[]
): EnvelopedResponse {
  return {
    data,
    execution_metadata: executionMetadata,
    layers_executed: layersExecuted,
  };
}
