/**
 * Planner Agent Tests
 *
 * Validates compliance with Agentics Global Agent Constitution:
 * - Stateless at runtime
 * - Emits exactly ONE DecisionEvent per invocation
 * - Deterministic for identical inputs
 * - NEVER executes, assigns, allocates, or schedules
 */

import { PlannerAgent } from './planner-agent';
import { RuvectorPersistence } from './ruvector-persistence';
import { Telemetry } from './telemetry';
import { PlannerInput, DecisionEvent } from '../contracts';

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

describe('PlannerAgent', () => {
  let agent: PlannerAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new PlannerAgent(mockPersistence, mockTelemetry);
  });

  describe('Metadata', () => {
    it('should have correct agent metadata', () => {
      expect(agent.metadata.id).toBe('planner-agent');
      expect(agent.metadata.version).toBe('1.0.0');
      expect(agent.metadata.decision_type).toBe('plan_generation');
      expect(agent.metadata.classifications).toContain('PLANNING');
      expect(agent.metadata.classifications).toContain('STRUCTURAL_SYNTHESIS');
    });
  });

  describe('Input Validation', () => {
    it('should validate valid input', () => {
      const input = { objective: 'Build a user authentication system' };
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
      const input: PlannerInput = {
        objective: 'Build API',
        context: {
          domain: 'security',
          existing_components: ['database', 'cache'],
          constraints: ['must use JWT'],
        },
      };
      const validated = agent.validateInput(input);
      expect(validated.context?.domain).toBe('security');
    });
  });

  describe('Invocation', () => {
    const validInput: PlannerInput = {
      objective: 'Create a REST API for user management with authentication',
    };
    const executionRef = '550e8400-e29b-41d4-a716-446655440000';

    it('should return success result with DecisionEvent', async () => {
      const result = await agent.invoke(validInput, executionRef);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.event.agent_id).toBe('planner-agent');
        expect(result.event.agent_version).toBe('1.0.0');
        expect(result.event.decision_type).toBe('plan_generation');
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
        // Same inputs_hash
        expect(result1.event.inputs_hash).toBe(result2.event.inputs_hash);

        // Same output structure (plan_id will differ as it's a UUID)
        const output1 = result1.event.outputs as { steps: unknown[] };
        const output2 = result2.event.outputs as { steps: unknown[] };
        expect(output1.steps.length).toBe(output2.steps.length);
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

    it('should generate valid plan structure', async () => {
      const result = await agent.invoke(validInput, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as {
          plan_id: string;
          steps: Array<{ step_id: string; name: string; sequence_order: number }>;
          dependency_graph: Record<string, string[]>;
          critical_path: string[];
          parallel_groups: string[][];
          analysis: { total_steps: number };
        };

        expect(output.plan_id).toBeDefined();
        expect(output.steps.length).toBeGreaterThan(0);
        expect(output.dependency_graph).toBeDefined();
        expect(output.critical_path).toBeDefined();
        expect(output.parallel_groups).toBeDefined();
        expect(output.analysis.total_steps).toBe(output.steps.length);
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
          agent_id: 'planner-agent',
          decision_type: 'plan_generation',
        })
      );
    });

    it('should emit telemetry', async () => {
      await agent.invoke(validInput, executionRef);

      expect(mockTelemetry.recordStart).toHaveBeenCalled();
      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('Plan Generation', () => {
    it('should generate steps with dependencies', async () => {
      const input: PlannerInput = {
        objective: 'Build and test a feature with integration',
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440001');

      if (result.status === 'success') {
        const output = result.event.outputs as {
          steps: Array<{ step_id: string; dependencies: Array<{ depends_on: string }> }>;
        };

        // Should have steps with dependencies
        const stepsWithDeps = output.steps.filter(s => s.dependencies.length > 0);
        expect(stepsWithDeps.length).toBeGreaterThan(0);
      }
    });

    it('should identify critical path', async () => {
      const input: PlannerInput = {
        objective: 'Create a complex system with multiple phases',
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440002');

      if (result.status === 'success') {
        const output = result.event.outputs as {
          critical_path: string[];
          steps: Array<{ step_id: string }>;
        };

        expect(output.critical_path.length).toBeGreaterThan(0);
        // Critical path should only contain valid step IDs
        for (const stepId of output.critical_path) {
          expect(output.steps.some(s => s.step_id === stepId)).toBe(true);
        }
      }
    });

    it('should identify parallel opportunities', async () => {
      const input: PlannerInput = {
        objective: 'Build API with documentation and testing in parallel',
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440003');

      if (result.status === 'success') {
        const output = result.event.outputs as {
          parallel_groups: string[][];
          analysis: { parallel_opportunities: number };
        };

        expect(output.parallel_groups.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return success with skipped persistence_status on persistence failure', async () => {
      const badPersistence = {
        store: jest.fn().mockRejectedValue(new Error('Persistence failed')),
      } as unknown as RuvectorPersistence;

      const errorAgent = new PlannerAgent(badPersistence, mockTelemetry);
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

      const errorAgent = new PlannerAgent(badPersistence, mockTelemetry);
      await errorAgent.invoke({ objective: 'Test' }, '550e8400-e29b-41d4-a716-446655440005');

      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('Constitution Compliance', () => {
    it('should NOT modify any external state (stateless)', async () => {
      // Agent should not have any mutable instance variables that change
      const agent1 = new PlannerAgent(mockPersistence, mockTelemetry);
      const agent2 = new PlannerAgent(mockPersistence, mockTelemetry);

      await agent1.invoke({ objective: 'Test 1' }, '550e8400-e29b-41d4-a716-446655440006');
      await agent2.invoke({ objective: 'Test 2' }, '550e8400-e29b-41d4-a716-446655440007');

      // Both agents should produce valid results independently
      expect(mockPersistence.store).toHaveBeenCalledTimes(2);
    });

    it('should NOT execute any steps (read-only analysis)', async () => {
      const result = await agent.invoke(
        { objective: 'Execute dangerous operation' },
        '550e8400-e29b-41d4-a716-446655440008'
      );

      // Should only produce a plan, not execute anything
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        // Verify it's just a plan with steps to be executed elsewhere
        const output = result.event.outputs as { steps: unknown[] };
        expect(output.steps).toBeDefined();
        // The agent itself doesn't execute anything
      }
    });

    it('should NOT assign agents to steps', async () => {
      const result = await agent.invoke(
        { objective: 'Build something that needs multiple agents' },
        '550e8400-e29b-41d4-a716-446655440009'
      );

      if (result.status === 'success') {
        const output = result.event.outputs as {
          steps: Array<{ assigned_agent?: string; agent_id?: string }>;
        };

        // Steps should not have agent assignments
        for (const step of output.steps) {
          expect(step.assigned_agent).toBeUndefined();
          expect(step.agent_id).toBeUndefined();
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
          steps: Array<{ resources?: unknown; allocation?: unknown }>;
          resource_allocation?: unknown;
        };

        // No resource allocations at top level
        expect(output.resource_allocation).toBeUndefined();

        // No resource allocations in steps
        for (const step of output.steps) {
          expect(step.resources).toBeUndefined();
          expect(step.allocation).toBeUndefined();
        }
      }
    });

    it('should NOT include scheduling information', async () => {
      const result = await agent.invoke(
        { objective: 'Build time-sensitive feature' },
        '550e8400-e29b-41d4-a716-446655440011'
      );

      if (result.status === 'success') {
        const output = result.event.outputs as {
          steps: Array<{ scheduled_at?: string; start_time?: string; end_time?: string }>;
          schedule?: unknown;
        };

        // No scheduling at top level
        expect(output.schedule).toBeUndefined();

        // No scheduling in steps
        for (const step of output.steps) {
          expect(step.scheduled_at).toBeUndefined();
          expect(step.start_time).toBeUndefined();
          expect(step.end_time).toBeUndefined();
        }
      }
    });
  });
});
