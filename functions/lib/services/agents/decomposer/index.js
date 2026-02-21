"use strict";
/**
 * Decomposer Agent Module Exports
 *
 * Purpose: Decompose complex objectives into manageable sub-objectives
 * Classification: DECOMPOSITION, STRUCTURAL_SYNTHESIS
 * decision_type: objective_decomposition
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecomposerOutputSchema = exports.DecomposerInputSchema = exports.SubObjectiveSchema = exports.DecomposerAgent = void 0;
var decomposer_agent_1 = require("./decomposer-agent");
Object.defineProperty(exports, "DecomposerAgent", { enumerable: true, get: function () { return decomposer_agent_1.DecomposerAgent; } });
// Re-export schemas from contracts
var contracts_1 = require("../contracts");
Object.defineProperty(exports, "SubObjectiveSchema", { enumerable: true, get: function () { return contracts_1.SubObjectiveSchema; } });
Object.defineProperty(exports, "DecomposerInputSchema", { enumerable: true, get: function () { return contracts_1.DecomposerInputSchema; } });
Object.defineProperty(exports, "DecomposerOutputSchema", { enumerable: true, get: function () { return contracts_1.DecomposerOutputSchema; } });
//# sourceMappingURL=index.js.map