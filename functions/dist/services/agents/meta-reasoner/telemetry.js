"use strict";
/**
 * Telemetry for LLM-Observatory - Meta-Reasoner Agent
 *
 * Per Constitution: All agents MUST emit telemetry compatible with LLM-Observatory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetry = void 0;
exports.createTelemetryFromEnv = createTelemetryFromEnv;
const telemetry_1 = require("../planner/telemetry");
/**
 * Create telemetry configured for Meta-Reasoner Agent
 */
function createTelemetryFromEnv() {
    return new telemetry_1.Telemetry({
        endpoint: process.env.LLM_OBSERVATORY_ENDPOINT,
        serviceName: 'meta-reasoner-agent',
        serviceVersion: '1.0.0',
        enabled: process.env.TELEMETRY_ENABLED !== 'false',
    });
}
// Re-export Telemetry class for typing
var telemetry_2 = require("../planner/telemetry");
Object.defineProperty(exports, "Telemetry", { enumerable: true, get: function () { return telemetry_2.Telemetry; } });
//# sourceMappingURL=telemetry.js.map