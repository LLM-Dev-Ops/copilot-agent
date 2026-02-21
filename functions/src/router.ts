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

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from '../../services/agents/contracts';

// Agent imports
import { PlannerAgent } from '../../services/agents/planner';
import { ConfigValidationAgent } from '../../services/agents/config-validation';
import { DecomposerAgent } from '../../services/agents/decomposer';
import { ObjectiveClarifierAgent } from '../../services/agents/objective-clarifier';
import { IntentClassifierAgent } from '../../services/agents/intent-classifier';
import { ReflectionAgent } from '../../services/agents/reflection';
import { MetaReasonerAgent } from '../../services/agents/meta-reasoner';

// Each agent uses its own persistence/telemetry module (they have identical APIs
// but TypeScript treats separate class declarations as distinct types)
import { createRuvectorFromEnv as createPlannerPersistence } from '../../services/agents/planner/ruvector-persistence';
import { createTelemetryFromEnv as createPlannerTelemetry } from '../../services/agents/planner/telemetry';
import { createRuvectorFromEnv as createClarifierPersistence } from '../../services/agents/objective-clarifier/ruvector-persistence';
import { createTelemetryFromEnv as createClarifierTelemetry } from '../../services/agents/objective-clarifier/telemetry';
import { createRuvectorFromEnv as createReflectionPersistence } from '../../services/agents/reflection/ruvector-persistence';
import { createTelemetryFromEnv as createReflectionTelemetry } from '../../services/agents/reflection/telemetry';

/**
 * Generic agent interface for routing purposes
 */
interface RoutableAgent {
  validateInput(input: unknown): unknown;
  invoke(input: any, executionRef: string): Promise<AgentResult>;
}

/**
 * Agent factory: instantiate the correct agent for the given slug
 */
function createAgent(slug: string): RoutableAgent | null {
  switch (slug) {
    case 'planner': {
      const p = createPlannerPersistence();
      const t = createPlannerTelemetry();
      return new PlannerAgent(p, t);
    }
    case 'config': {
      const p = createPlannerPersistence();
      const t = createPlannerTelemetry();
      return new ConfigValidationAgent(p, t);
    }
    case 'decomposer': {
      const p = createPlannerPersistence();
      const t = createPlannerTelemetry();
      return new DecomposerAgent(p, t);
    }
    case 'clarifier': {
      const p = createClarifierPersistence();
      const t = createClarifierTelemetry();
      return new ObjectiveClarifierAgent(p, t);
    }
    case 'intent': {
      // IntentClassifier imports from planner persistence/telemetry
      const p = createPlannerPersistence();
      const t = createPlannerTelemetry();
      return new IntentClassifierAgent(p, t);
    }
    case 'reflection': {
      const p = createReflectionPersistence();
      const t = createReflectionTelemetry();
      return new ReflectionAgent(p, t);
    }
    case 'meta-reasoner': {
      // MetaReasoner imports from planner persistence/telemetry
      const p = createPlannerPersistence();
      const t = createPlannerTelemetry();
      return new MetaReasonerAgent(p, t);
    }
    default:
      return null;
  }
}

/**
 * Route a request to the appropriate agent
 *
 * @param slug - The agent slug from the URL path
 * @param body - The parsed JSON request body
 * @returns The agent result (success or error)
 * @throws If the slug is unknown
 */
export async function routeRequest(slug: string, body: unknown): Promise<AgentResult> {
  const agent = createAgent(slug);

  if (!agent) {
    throw new Error(
      `Unknown agent: "${slug}". Valid agents: planner, config, decomposer, clarifier, intent, reflection, meta-reasoner`
    );
  }

  // Extract execution_ref from body or generate one
  const bodyObj = body as Record<string, unknown>;
  const executionRef = (typeof bodyObj.execution_ref === 'string' && bodyObj.execution_ref)
    ? bodyObj.execution_ref
    : uuidv4();

  // Validate input through the agent's schema
  const validatedInput = agent.validateInput(body);

  // Invoke the agent
  return agent.invoke(validatedInput, executionRef);
}
