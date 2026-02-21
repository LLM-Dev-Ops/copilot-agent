/**
 * Cloud Function Entry Point: copilot-agents
 *
 * Unified HTTP handler for all 7 copilot agents.
 * Deploy: gcloud functions deploy copilot-agents --runtime nodejs20 --trigger-http
 *         --region us-central1 --project agentics-dev --entry-point handler
 *         --memory 512MB --timeout 120s --no-allow-unauthenticated
 *
 * Routes:
 *   POST /v1/copilot/planner       → Planner Agent
 *   POST /v1/copilot/config        → Config Validation Agent
 *   POST /v1/copilot/decomposer    → Decomposer Agent
 *   POST /v1/copilot/clarifier     → Objective Clarifier Agent
 *   POST /v1/copilot/intent        → Intent Classifier Agent
 *   POST /v1/copilot/reflection    → Reflection Agent
 *   POST /v1/copilot/meta-reasoner → Meta-Reasoner Agent
 *   GET  /health                    → Health check
 */
import { IncomingMessage, ServerResponse } from 'http';
export interface CfRequest extends IncomingMessage {
    body?: unknown;
    rawBody?: Buffer;
}
export interface CfResponse extends ServerResponse {
    status?: (code: number) => CfResponse;
    json?: (data: unknown) => void;
    send?: (data: string | Buffer) => void;
}
/**
 * Main Cloud Function handler
 *
 * Entry point name: handler
 */
export declare function handler(req: CfRequest, res: CfResponse): Promise<void>;
