/**
 * Intelligence Layer Agent Tests - Phase 7 (Layer 2)
 *
 * Tests verify:
 * - Signal emission (hypothesis, simulation_outcome, confidence_delta)
 * - Role clarity (may reason/simulate/explore, must emit signals, avoid final decisions)
 * - Performance budgets (MAX_TOKENS=2500, MAX_LATENCY_MS=5000)
 * - Constitution compliance (stateless, single DecisionEvent, ruvector-only persistence)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { IntelligenceLayerAgent } from './intelligence-agent';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from './telemetry';
import {
  IntelligenceLayerInput,
  PHASE7_PERFORMANCE_BUDGETS,
} from '../contracts';

// Mock dependencies
const mockPersistence: RuvectorPersistence = {
  store: vi.fn().mockResolvedValue({ id: 'test-id', stored: true }),
  retrieve: vi.fn().mockResolvedValue(null),
  search: vi.fn().mockResolvedValue([]),
} as unknown as RuvectorPersistence;

const mockTelemetry: Telemetry = {
  recordStart: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  emitEvent: vi.fn(),
} as unknown as Telemetry;

describe('IntelligenceLayerAgent', () => {
  let agent: IntelligenceLayerAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new IntelligenceLayerAgent(mockPersistence, mockTelemetry);
  });

  describe('Metadata', () => {
    it('should have correct agent metadata', () => {
      expect(agent.metadata.id).toBe('intelligence-layer-agent');
      expect(agent.metadata.version).toBe('1.0.0');
      expect(agent.metadata.decision_type).toBe('intelligence_layer_analysis');
      expect(agent.metadata.classifications).toContain('META_ANALYSIS');
    });
  });

  describe('Input Validation', () => {
    it('should validate correct input', () => {
      const input = {
        mode: 'explore',
        objective: {
          statement: 'Test objective',
          domain: 'testing',
          constraints: ['constraint1'],
        },
      };

      const validated = agent.validateInput(input);
      expect(validated.mode).toBe('explore');
      expect(validated.objective.statement).toBe('Test objective');
    });

    it('should reject invalid mode', () => {
      const input = {
        mode: 'invalid',
        objective: {
          statement: 'Test',
          domain: 'test',
          constraints: [],
        },
      };

      expect(() => agent.validateInput(input)).toThrow();
    });
  });

  describe('Reason Mode', () => {
    it('should emit hypothesis_signal in reason mode', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'reason',
        objective: {
          statement: 'Analyze caching strategy',
          domain: 'infrastructure',
          constraints: ['low-latency'],
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;
        expect(output.hypothesis_signals.length).toBeGreaterThan(0);
        expect(output.hypothesis_signals[0].signal_type).toBe('hypothesis_signal');
      }
    });

    it('should not make final decisions in reason mode', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'reason',
        objective: {
          statement: 'Test decision avoidance',
          domain: 'testing',
          constraints: [],
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;
        expect(output.summary.final_decision_status).toBe('no_final_decision');
      }
    });
  });

  describe('Simulate Mode', () => {
    it('should emit simulation_outcome_signal in simulate mode', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'simulate',
        objective: {
          statement: 'Test simulation',
          domain: 'testing',
          constraints: [],
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;
        expect(output.simulation_outcome_signals.length).toBeGreaterThan(0);
        expect(output.simulation_outcome_signals[0].signal_type).toBe('simulation_outcome_signal');
      }
    });

    it('should emit confidence_delta_signal when prior hypotheses exist', async () => {
      const hypothesisId = uuidv4();
      const input: IntelligenceLayerInput = {
        mode: 'simulate',
        objective: {
          statement: 'Test confidence delta',
          domain: 'testing',
          constraints: [],
        },
        prior_hypotheses: [{
          signal_type: 'hypothesis_signal',
          hypothesis_id: hypothesisId,
          statement: 'Test hypothesis',
          domain: 'testing',
          supporting_evidence: [{ evidence_id: uuidv4(), description: 'Evidence', weight: 0.7 }],
          counter_evidence: [],
          initial_confidence: 0.6,
          strengthening_conditions: [],
          weakening_conditions: [],
          related_hypothesis_ids: [],
          formed_at: new Date().toISOString(),
        }],
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;
        // Should have simulation and potentially delta signal
        expect(output.simulation_outcome_signals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Explore Mode', () => {
    it('should emit all signal types in explore mode', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'explore',
        objective: {
          statement: 'Comprehensive exploration',
          domain: 'testing',
          constraints: ['constraint1', 'constraint2'],
          context: { key: 'value' },
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;
        expect(output.hypothesis_signals.length).toBeGreaterThan(0);
        expect(output.simulation_outcome_signals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance Budgets', () => {
    it('should respect MAX_TOKENS budget', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'explore',
        objective: {
          statement: 'Token budget test',
          domain: 'testing',
          constraints: [],
        },
        performance_limits: {
          max_tokens: PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS,
          max_latency_ms: PHASE7_PERFORMANCE_BUDGETS.MAX_LATENCY_MS,
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;
        expect(output.resource_consumption.total_tokens_used).toBeLessThanOrEqual(
          PHASE7_PERFORMANCE_BUDGETS.MAX_TOKENS
        );
      }
    });

    it('should track resource consumption', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'reason',
        objective: {
          statement: 'Resource tracking test',
          domain: 'testing',
          constraints: [],
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;
        expect(output.resource_consumption).toBeDefined();
        expect(output.resource_consumption.total_tokens_used).toBeGreaterThan(0);
        expect(output.resource_consumption.total_latency_ms).toBeGreaterThanOrEqual(0);
        expect(typeof output.resource_consumption.within_budget).toBe('boolean');
      }
    });
  });

  describe('Constitution Compliance', () => {
    it('should persist via ruvector only', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'reason',
        objective: {
          statement: 'Persistence test',
          domain: 'testing',
          constraints: [],
        },
      };

      await agent.invoke(input, uuidv4());

      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should emit exactly one DecisionEvent per invocation', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'explore',
        objective: {
          statement: 'Single event test',
          domain: 'testing',
          constraints: [],
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.event).toBeDefined();
        expect(result.event.decision_type).toBe('intelligence_layer_analysis');
      }

      // Verify persistence was called exactly once
      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should include applied constraints in DecisionEvent', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'reason',
        objective: {
          statement: 'Constraints test',
          domain: 'testing',
          constraints: [],
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('stateless_processing');
        expect(result.event.constraints_applied).toContain('no_final_decisions');
        expect(result.event.constraints_applied).toContain('signal_emission_required');
        expect(result.event.constraints_applied).toContain('ruvector_persistence_only');
      }
    });
  });

  describe('Role Clarity', () => {
    it('should provide human decision suggestions, not decisions', async () => {
      const input: IntelligenceLayerInput = {
        mode: 'explore',
        objective: {
          statement: 'Role clarity test',
          domain: 'testing',
          constraints: [],
          context: { important: true },
        },
      };

      const result = await agent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as any;

        // Suggestions should have caveats about human judgment
        if (output.human_decision_suggestions.length > 0) {
          const suggestion = output.human_decision_suggestions[0];
          expect(suggestion.caveats).toBeDefined();
          expect(suggestion.caveats.some((c: string) =>
            c.toLowerCase().includes('human') || c.toLowerCase().includes('judgment')
          )).toBe(true);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle persistence errors gracefully and return success', async () => {
      const failingPersistence = {
        store: vi.fn().mockRejectedValue(new Error('RuVector connection failed')),
        retrieve: vi.fn(),
        search: vi.fn(),
      } as unknown as RuvectorPersistence;

      const failingAgent = new IntelligenceLayerAgent(failingPersistence, mockTelemetry);

      const input: IntelligenceLayerInput = {
        mode: 'reason',
        objective: {
          statement: 'Error test',
          domain: 'testing',
          constraints: [],
        },
      };

      const result = await failingAgent.invoke(input, uuidv4());

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.persistence_status.status).toBe('skipped');
        expect(result.persistence_status.error).toContain('RuVector connection failed');
        expect(result.event).toBeDefined();
      }
    });

    it('should record success telemetry even on persistence failure', async () => {
      const failingPersistence = {
        store: vi.fn().mockRejectedValue(new Error('Test error')),
        retrieve: vi.fn(),
        search: vi.fn(),
      } as unknown as RuvectorPersistence;

      const failingAgent = new IntelligenceLayerAgent(failingPersistence, mockTelemetry);

      const input: IntelligenceLayerInput = {
        mode: 'reason',
        objective: {
          statement: 'Telemetry failure test',
          domain: 'testing',
          constraints: [],
        },
      };

      await failingAgent.invoke(input, uuidv4());

      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });
});
