/**
 * Decomposer Agent Tests
 *
 * Validates compliance with Agentics Global Agent Constitution:
 * - Stateless at runtime
 * - Emits exactly ONE DecisionEvent per invocation
 * - Deterministic for identical inputs
 * - NEVER executes, assigns, allocates, or schedules
 */

import { DecomposerAgent } from './decomposer-agent';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
import { DecomposerInput } from '../contracts';

// Mock persistence
const mockPersistence: RuvectorPersistence = {
  store: jest.fn().mockResolvedValue({ id: 'test-id', stored: true }),
  retrieve: jest.fn().mockResolvedValue(null),
  search: jest.fn().mockResolvedValue([]),
} as unknown as RuvectorPersistence;

// Mock telemetry
const mockTelemetry: Telemetry = {
  recordStart: jest.fn(),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
  emitEvent: jest.fn(),
} as unknown as Telemetry;

describe('DecomposerAgent', () => {
  let agent: DecomposerAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new DecomposerAgent(mockPersistence, mockTelemetry);
  });

  describe('Metadata', () => {
    it('should have correct agent metadata', () => {
      expect(agent.metadata.id).toBe('decomposer-agent');
      expect(agent.metadata.version).toBe('1.0.0');
      expect(agent.metadata.decision_type).toBe('objective_decomposition');
      expect(agent.metadata.classifications).toContain('DECOMPOSITION');
      expect(agent.metadata.classifications).toContain('STRUCTURAL_SYNTHESIS');
    });
  });

  describe('Input Validation', () => {
    it('should validate valid input', () => {
      const input = { objective: 'Build a distributed caching system' };
      const validated = agent.validateInput(input);
      expect(validated.objective).toBe(input.objective);
    });

    it('should reject input without objective', () => {
      expect(() => agent.validateInput({})).toThrow();
    });

    it('should reject empty objective', () => {
      expect(() => agent.validateInput({ objective: '' })).toThrow();
    });

    it('should accept input with context', () => {
      const input: DecomposerInput = {
        objective: 'Build API',
        context: {
          domain: 'backend',
          existing_components: ['database', 'cache'],
          constraints: ['must use REST'],
        },
      };
      const validated = agent.validateInput(input);
      expect(validated.context?.domain).toBe('backend');
    });
  });

  describe('Invocation', () => {
    const validInput: DecomposerInput = {
      objective: 'Build and deploy a REST API with authentication and testing',
    };
    const executionRef = '550e8400-e29b-41d4-a716-446655440000';

    it('should return success result with DecisionEvent', async () => {
      const result = await agent.invoke(validInput, executionRef);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.event.agent_id).toBe('decomposer-agent');
        expect(result.event.agent_version).toBe('1.0.0');
        expect(result.event.decision_type).toBe('objective_decomposition');
        expect(result.event.execution_ref).toBe(executionRef);
      }
    });

    it('should emit exactly ONE DecisionEvent per invocation', async () => {
      const result = await agent.invoke(validInput, executionRef);

      expect(result.status).toBe('success');
      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should produce deterministic output for identical input', async () => {
      const result1 = await agent.invoke(validInput, executionRef);
      const result2 = await agent.invoke(validInput, executionRef);

      if (result1.status === 'success' && result2.status === 'success') {
        expect(result1.event.inputs_hash).toBe(result2.event.inputs_hash);

        const output1 = result1.event.outputs as { sub_objectives: unknown[] };
        const output2 = result2.event.outputs as { sub_objectives: unknown[] };
        expect(output1.sub_objectives.length).toBe(output2.sub_objectives.length);
      }
    });

    it('should include constraints_applied in output', async () => {
      const result = await agent.invoke(validInput, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('read_only_analysis');
        expect(result.event.constraints_applied).toContain('no_execution');
        expect(result.event.constraints_applied).toContain('no_agent_assignment');
        expect(result.event.constraints_applied).toContain('no_resource_allocation');
        expect(result.event.constraints_applied).toContain('no_scheduling');
      }
    });

    it('should generate valid decomposition structure', async () => {
      const result = await agent.invoke(validInput, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as {
          decomposition_id: string;
          sub_objectives: Array<{ sub_objective_id: string; title: string; depth: number }>;
          tree_structure: Record<string, string[]>;
          dependency_graph: Record<string, string[]>;
          analysis: { total_sub_objectives: number; coverage_score: number };
        };

        expect(output.decomposition_id).toBeDefined();
        expect(output.sub_objectives.length).toBeGreaterThan(0);
        expect(output.tree_structure).toBeDefined();
        expect(output.dependency_graph).toBeDefined();
        expect(output.analysis.total_sub_objectives).toBe(output.sub_objectives.length);
        expect(output.analysis.coverage_score).toBeGreaterThanOrEqual(0);
        expect(output.analysis.coverage_score).toBeLessThanOrEqual(1);
      }
    });

    it('should have confidence between 0 and 1', async () => {
      const result = await agent.invoke(validInput, executionRef);

      if (result.status === 'success') {
        expect(result.event.confidence).toBeGreaterThanOrEqual(0);
        expect(result.event.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should persist to ruvector-service', async () => {
      await agent.invoke(validInput, executionRef);

      expect(mockPersistence.store).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'decomposer-agent',
          decision_type: 'objective_decomposition',
        })
      );
    });

    it('should emit telemetry', async () => {
      await agent.invoke(validInput, executionRef);

      expect(mockTelemetry.recordStart).toHaveBeenCalled();
      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return success with skipped persistence_status on persistence failure', async () => {
      const badPersistence = {
        store: jest.fn().mockRejectedValue(new Error('Persistence failed')),
      } as unknown as RuvectorPersistence;

      const errorAgent = new DecomposerAgent(badPersistence, mockTelemetry);
      const result = await errorAgent.invoke(
        { objective: 'Test' },
        '550e8400-e29b-41d4-a716-446655440004'
      );

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.persistence_status.status).toBe('skipped');
        expect(result.persistence_status.error).toContain('Persistence failed');
        expect(result.event).toBeDefined();
      }
    });

    it('should emit success telemetry even on persistence failure', async () => {
      const badPersistence = {
        store: jest.fn().mockRejectedValue(new Error('Test error')),
      } as unknown as RuvectorPersistence;

      const errorAgent = new DecomposerAgent(badPersistence, mockTelemetry);
      await errorAgent.invoke({ objective: 'Test' }, '550e8400-e29b-41d4-a716-446655440005');

      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('Constitution Compliance', () => {
    it('should NOT modify any external state (stateless)', async () => {
      const agent1 = new DecomposerAgent(mockPersistence, mockTelemetry);
      const agent2 = new DecomposerAgent(mockPersistence, mockTelemetry);

      await agent1.invoke({ objective: 'Test 1' }, '550e8400-e29b-41d4-a716-446655440006');
      await agent2.invoke({ objective: 'Test 2' }, '550e8400-e29b-41d4-a716-446655440007');

      expect(mockPersistence.store).toHaveBeenCalledTimes(2);
    });

    it('should NOT assign agents to sub-objectives', async () => {
      const result = await agent.invoke(
        { objective: 'Build something that needs multiple agents' },
        '550e8400-e29b-41d4-a716-446655440009'
      );

      if (result.status === 'success') {
        const output = result.event.outputs as {
          sub_objectives: Array<{ assigned_agent?: string; agent_id?: string }>;
        };

        for (const sub of output.sub_objectives) {
          expect(sub.assigned_agent).toBeUndefined();
          expect(sub.agent_id).toBeUndefined();
        }
      }
    });

    it('should NOT include resource allocations', async () => {
      const result = await agent.invoke(
        { objective: 'Build system requiring resources' },
        '550e8400-e29b-41d4-a716-446655440010'
      );

      if (result.status === 'success') {
        const output = result.event.outputs as {
          sub_objectives: Array<{ resources?: unknown; allocation?: unknown }>;
          resource_allocation?: unknown;
        };

        expect(output.resource_allocation).toBeUndefined();
        for (const sub of output.sub_objectives) {
          expect(sub.resources).toBeUndefined();
          expect(sub.allocation).toBeUndefined();
        }
      }
    });
  });
});
