/**
 * Decomposer Agent Module Exports
 *
 * Purpose: Decompose complex objectives into manageable sub-objectives
 * Classification: DECOMPOSITION, STRUCTURAL_SYNTHESIS
 * decision_type: objective_decomposition
 */

export { DecomposerAgent } from './decomposer-agent';

// Re-export schemas from contracts
export {
  SubObjectiveSchema,
  DecomposerInputSchema,
  DecomposerOutputSchema,
  type SubObjective,
  type DecomposerInput,
  type DecomposerOutput,
} from '../contracts';
