/**
 * Agent Span Wrapper - Guarantees span emission for every agent invocation.
 *
 * This higher-order function wraps any BaseAgent.invoke() call to ensure
 * an agent-level execution span is always emitted, satisfying the Agentics
 * requirement that agents MUST NOT execute without emitting a span.
 */
import { BaseAgent, AgentResult } from './base-agent';
import { ExecutionGraphBuilder } from './execution-graph';
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
export declare function withAgentSpan<TInput, TOutput>(agent: BaseAgent<TInput, TOutput>, input: TInput, executionRef: string, graph: ExecutionGraphBuilder): Promise<AgentResult>;
