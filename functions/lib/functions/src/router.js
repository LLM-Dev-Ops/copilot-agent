"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeRequest = routeRequest;
const uuid_1 = require("uuid");
// Agent imports
const planner_1 = require("../../services/agents/planner");
const config_validation_1 = require("../../services/agents/config-validation");
const decomposer_1 = require("../../services/agents/decomposer");
const objective_clarifier_1 = require("../../services/agents/objective-clarifier");
const intent_classifier_1 = require("../../services/agents/intent-classifier");
const reflection_1 = require("../../services/agents/reflection");
const meta_reasoner_1 = require("../../services/agents/meta-reasoner");
// Each agent uses its own persistence/telemetry module (they have identical APIs
// but TypeScript treats separate class declarations as distinct types)
const ruvector_persistence_1 = require("../../services/agents/planner/ruvector-persistence");
const telemetry_1 = require("../../services/agents/planner/telemetry");
const ruvector_persistence_2 = require("../../services/agents/objective-clarifier/ruvector-persistence");
const telemetry_2 = require("../../services/agents/objective-clarifier/telemetry");
const ruvector_persistence_3 = require("../../services/agents/reflection/ruvector-persistence");
const telemetry_3 = require("../../services/agents/reflection/telemetry");
/**
 * Agent factory: instantiate the correct agent for the given slug
 */
function createAgent(slug) {
    switch (slug) {
        case 'planner': {
            const p = (0, ruvector_persistence_1.createRuvectorFromEnv)();
            const t = (0, telemetry_1.createTelemetryFromEnv)();
            return new planner_1.PlannerAgent(p, t);
        }
        case 'config': {
            const p = (0, ruvector_persistence_1.createRuvectorFromEnv)();
            const t = (0, telemetry_1.createTelemetryFromEnv)();
            return new config_validation_1.ConfigValidationAgent(p, t);
        }
        case 'decomposer': {
            const p = (0, ruvector_persistence_1.createRuvectorFromEnv)();
            const t = (0, telemetry_1.createTelemetryFromEnv)();
            return new decomposer_1.DecomposerAgent(p, t);
        }
        case 'clarifier': {
            const p = (0, ruvector_persistence_2.createRuvectorFromEnv)();
            const t = (0, telemetry_2.createTelemetryFromEnv)();
            return new objective_clarifier_1.ObjectiveClarifierAgent(p, t);
        }
        case 'intent': {
            // IntentClassifier imports from planner persistence/telemetry
            const p = (0, ruvector_persistence_1.createRuvectorFromEnv)();
            const t = (0, telemetry_1.createTelemetryFromEnv)();
            return new intent_classifier_1.IntentClassifierAgent(p, t);
        }
        case 'reflection': {
            const p = (0, ruvector_persistence_3.createRuvectorFromEnv)();
            const t = (0, telemetry_3.createTelemetryFromEnv)();
            return new reflection_1.ReflectionAgent(p, t);
        }
        case 'meta-reasoner': {
            // MetaReasoner imports from planner persistence/telemetry
            const p = (0, ruvector_persistence_1.createRuvectorFromEnv)();
            const t = (0, telemetry_1.createTelemetryFromEnv)();
            return new meta_reasoner_1.MetaReasonerAgent(p, t);
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
async function routeRequest(slug, body) {
    const agent = createAgent(slug);
    if (!agent) {
        throw new Error(`Unknown agent: "${slug}". Valid agents: planner, config, decomposer, clarifier, intent, reflection, meta-reasoner`);
    }
    // Extract execution_ref from body or generate one
    const bodyObj = body;
    const executionRef = (typeof bodyObj.execution_ref === 'string' && bodyObj.execution_ref)
        ? bodyObj.execution_ref
        : (0, uuid_1.v4)();
    // Validate input through the agent's schema
    const validatedInput = agent.validateInput(body);
    // Invoke the agent
    return agent.invoke(validatedInput, executionRef);
}
//# sourceMappingURL=router.js.map