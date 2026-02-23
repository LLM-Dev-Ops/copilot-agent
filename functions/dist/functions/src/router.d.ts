/**
 * Agent Router
 *
 * Maps URL slugs to agent invocations.
 * Does NOT create new agents or modify business logic.
 * Instantiates existing agents with persistence/telemetry from env
 * and routes HTTP bodies to agent.invoke().
 *
 * Routes:
 *   planner       → PlannerAgent
 *   config        → ConfigValidationAgent
 *   decomposer    → DecomposerAgent
 *   clarifier     → ObjectiveClarifierAgent
 *   intent        → IntentClassifierAgent
 *   reflection    → ReflectionAgent
 *   meta-reasoner → MetaReasonerAgent
 */
import { AgentResult, PipelineContext } from '../../services/agents/contracts';
/**
 * Result of routing a request to an agent.
 * Includes the AgentResult plus metadata needed for the response envelope.
 */
export interface RouteResult {
    agentResult: AgentResult;
    agentSlug: string;
    pipelineContext?: PipelineContext;
}
/**
 * Route a request to the appropriate agent
 *
 * @param slug - The agent slug from the URL path
 * @param body - The parsed JSON request body
 * @returns RouteResult with agent result and metadata
 * @throws If the slug is unknown
 */
export declare function routeRequest(slug: string, body: unknown): Promise<RouteResult>;
