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
import { AgentResult } from '../../services/agents/contracts';
/**
 * Route a request to the appropriate agent
 *
 * @param slug - The agent slug from the URL path
 * @param body - The parsed JSON request body
 * @returns The agent result (success or error)
 * @throws If the slug is unknown
 */
export declare function routeRequest(slug: string, body: unknown): Promise<AgentResult>;
