"use strict";
/**
 * Agent Span Wrapper - Guarantees span emission for every agent invocation.
 *
 * This higher-order function wraps any BaseAgent.invoke() call to ensure
 * an agent-level execution span is always emitted, satisfying the Agentics
 * requirement that agents MUST NOT execute without emitting a span.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAgentSpan = withAgentSpan;
/**
 * Execute an agent with automatic execution span tracking.
 *
 * Creates an agent-level span before invocation, and completes/fails it
 * after the agent finishes. Attaches the DecisionEvent as an artifact
 * on success.
 *
 * @param agent - The agent to invoke
 * @param input - Validated input for the agent
 * @param executionRef - Execution reference UUID for tracing
 * @param graph - The ExecutionGraphBuilder to record spans in
 * @returns The agent result (unchanged from direct invocation)
 */
async function withAgentSpan(agent, input, executionRef, graph) {
    const spanId = graph.startAgentSpan(agent.metadata.id);
    try {
        const result = await agent.invoke(input, executionRef);
        if (result.status === 'success') {
            const artifacts = [
                {
                    name: 'decision_event',
                    artifact_type: 'decision_event',
                    reference: result.event.execution_ref,
                    data: result.event,
                },
            ];
            graph.completeAgentSpan(spanId, artifacts);
        }
        else {
            graph.failAgentSpan(spanId, result.error_message);
        }
        return result;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        graph.failAgentSpan(spanId, message);
        throw error;
    }
}
//# sourceMappingURL=agent-span-wrapper.js.map