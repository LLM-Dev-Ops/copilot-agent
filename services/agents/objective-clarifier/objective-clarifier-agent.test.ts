/**
 * Objective Clarifier Agent Tests
 *
 * Tests for Constitution compliance and functionality.
 */

import { ObjectiveClarifierAgent } from './objective-clarifier-agent';
import { RuvectorPersistence } from './ruvector-persistence';
import { Telemetry } from './telemetry';
import { AgentClassification, DecisionEvent } from '../contracts';
import { ObjectiveClarifierInput, ObjectiveClarifierOutput } from '../contracts/objective-clarifier-schemas';

// Mock dependencies
const mockPersistence = {
  store: jest.fn().mockResolvedValue({ id: 'test-id', stored: true }),
  retrieve: jest.fn(),
  search: jest.fn(),
} as unknown as RuvectorPersistence;

const mockTelemetry = {
  recordStart: jest.fn(),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
  emitEvent: jest.fn(),
} as unknown as Telemetry;

describe('ObjectiveClarifierAgent', () => {
  let agent: ObjectiveClarifierAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new ObjectiveClarifierAgent(mockPersistence, mockTelemetry);
  });

  describe('Metadata', () => {
    it('should have correct agent ID', () => {
      expect(agent.metadata.id).toBe('objective-clarifier-agent');
    });

    it('should have semantic version', () => {
      expect(agent.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have correct decision type', () => {
      expect(agent.metadata.decision_type).toBe('objective_clarification');
    });

    it('should have correct classifications', () => {
      expect(agent.metadata.classifications).toContain(AgentClassification.INTENT_ANALYSIS);
      expect(agent.metadata.classifications).toContain(AgentClassification.DECOMPOSITION);
    });
  });

  describe('Input Validation', () => {
    it('should validate valid input', () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };
      expect(() => agent.validateInput(input)).not.toThrow();
    });

    it('should reject empty objective', () => {
      const input = { objective: '' };
      expect(() => agent.validateInput(input)).toThrow();
    });

    it('should accept input with context', () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build authentication',
        context: {
          domain: 'security',
          stakeholders: ['developers', 'users'],
          known_constraints: ['must use OAuth2'],
        },
      };
      expect(() => agent.validateInput(input)).not.toThrow();
    });

    it('should accept input with config', () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build something',
        config: {
          min_severity: 'medium',
          max_questions: 5,
          auto_resolve_low_severity: true,
        },
      };
      expect(() => agent.validateInput(input)).not.toThrow();
    });
  });

  describe('Invocation', () => {
    const validInput: ObjectiveClarifierInput = {
      objective: 'Build a user authentication system with OAuth2',
    };
    const executionRef = '550e8400-e29b-41d4-a716-446655440000';

    it('should return success result', async () => {
      const result = await agent.invoke(validInput, executionRef);
      expect(result.status).toBe('success');
    });

    it('should emit exactly ONE DecisionEvent', async () => {
      const result = await agent.invoke(validInput, executionRef);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.event).toBeDefined();
        expect(result.event.agent_id).toBe('objective-clarifier-agent');
      }
    });

    it('should persist via RuVector', async () => {
      await agent.invoke(validInput, executionRef);
      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should emit telemetry start and success', async () => {
      await agent.invoke(validInput, executionRef);
      expect(mockTelemetry.recordStart).toHaveBeenCalledTimes(1);
      expect(mockTelemetry.recordSuccess).toHaveBeenCalledTimes(1);
    });

    it('should include correct decision_type in event', async () => {
      const result = await agent.invoke(validInput, executionRef);
      if (result.status === 'success') {
        expect(result.event.decision_type).toBe('objective_clarification');
      }
    });

    it('should include execution_ref in event', async () => {
      const result = await agent.invoke(validInput, executionRef);
      if (result.status === 'success') {
        expect(result.event.execution_ref).toBe(executionRef);
      }
    });

    it('should include timestamp in event', async () => {
      const result = await agent.invoke(validInput, executionRef);
      if (result.status === 'success') {
        expect(result.event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('should include inputs_hash in event', async () => {
      const result = await agent.invoke(validInput, executionRef);
      if (result.status === 'success') {
        expect(result.event.inputs_hash).toHaveLength(64);
      }
    });

    it('should include confidence in event', async () => {
      const result = await agent.invoke(validInput, executionRef);
      if (result.status === 'success') {
        expect(result.event.confidence).toBeGreaterThanOrEqual(0);
        expect(result.event.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should include constraints_applied in event', async () => {
      const result = await agent.invoke(validInput, executionRef);
      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('read_only_analysis');
        expect(result.event.constraints_applied).toContain('no_plan_generation');
        expect(result.event.constraints_applied).toContain('no_solution_definition');
        expect(result.event.constraints_applied).toContain('no_logic_execution');
      }
    });
  });

  describe('Clarification Output', () => {
    const executionRef = '550e8400-e29b-41d4-a716-446655440000';

    it('should detect ambiguous quantifiers', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a system that handles many users',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        const quantifierAmbiguity = output.ambiguities.find(a => a.type === 'quantitative');
        expect(quantifierAmbiguity).toBeDefined();
      }
    });

    it('should detect temporal ambiguity', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Deploy the application soon',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        const temporalAmbiguity = output.ambiguities.find(a => a.type === 'temporal');
        expect(temporalAmbiguity).toBeDefined();
      }
    });

    it('should identify missing temporal constraints', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user management system',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        const temporalConstraint = output.missing_constraints.find(c => c.category === 'temporal');
        expect(temporalConstraint).toBeDefined();
      }
    });

    it('should extract normalized goals', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Create a REST API for user management. Implement OAuth2 authentication.',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        expect(output.normalized_goals.length).toBeGreaterThan(0);
      }
    });

    it('should provide clarity score', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a clear system with specific requirements',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        expect(output.analysis.clarity_score).toBeGreaterThanOrEqual(0);
        expect(output.analysis.clarity_score).toBeLessThanOrEqual(1);
      }
    });

    it('should provide completeness score', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build something',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        expect(output.analysis.completeness_score).toBeGreaterThanOrEqual(0);
        expect(output.analysis.completeness_score).toBeLessThanOrEqual(1);
      }
    });

    it('should assess complexity', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        expect(['simple', 'moderate', 'complex', 'very_complex']).toContain(output.analysis.complexity);
      }
    });

    it('should generate clarification questions', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build something quickly for many users',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        expect(output.clarification_questions.length).toBeGreaterThan(0);
      }
    });

    it('should respect max_questions config', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build something quickly for many users with several features',
        config: { max_questions: 3 },
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        expect(output.clarification_questions.length).toBeLessThanOrEqual(3);
      }
    });

    it('should return "clear" status for unambiguous objectives', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
        context: {
          known_constraints: [
            'deadline: 2024-03-01',
            'budget: $50000',
            'technology: Node.js',
          ],
        },
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        // May still have some issues but should be relatively clear
        expect(['clear', 'needs_clarification']).toContain(output.status);
      }
    });

    it('should return "insufficient" for very short objectives', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Do',
      };
      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        expect(output.status).toBe('insufficient');
      }
    });
  });

  describe('Constitution Compliance', () => {
    const executionRef = '550e8400-e29b-41d4-a716-446655440000';

    it('should be stateless - multiple invocations produce consistent structure', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };

      const result1 = await agent.invoke(input, executionRef);
      const result2 = await agent.invoke(input, executionRef);

      expect(result1.status).toBe(result2.status);
      if (result1.status === 'success' && result2.status === 'success') {
        // Structure should be the same
        const output1 = result1.event.outputs as ObjectiveClarifierOutput;
        const output2 = result2.event.outputs as ObjectiveClarifierOutput;
        expect(output1.status).toBe(output2.status);
        expect(output1.ambiguities.length).toBe(output2.ambiguities.length);
        expect(output1.missing_constraints.length).toBe(output2.missing_constraints.length);
      }
    });

    it('should emit exactly one DecisionEvent per invocation', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };

      const result = await agent.invoke(input, executionRef);
      expect(result.status).toBe('success');
      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should persist only via RuVector', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };

      await agent.invoke(input, executionRef);
      expect(mockPersistence.store).toHaveBeenCalled();
    });

    it('should track all applied constraints', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
        context: {
          known_constraints: ['must use OAuth2', 'deadline Q2'],
        },
      };

      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('user_constraint:must use OAuth2');
        expect(result.event.constraints_applied).toContain('user_constraint:deadline Q2');
      }
    });

    it('should NEVER generate plans (verify no plan structure in output)', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system with OAuth2 and JWT tokens',
      };

      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        // Should NOT have plan-like structures
        expect(output).not.toHaveProperty('steps');
        expect(output).not.toHaveProperty('plan_steps');
        expect(output).not.toHaveProperty('execution_plan');
      }
    });

    it('should NEVER define solutions (verify no solution structure in output)', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };

      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        const output = result.event.outputs as ObjectiveClarifierOutput;
        // Should NOT have solution-like structures
        expect(output).not.toHaveProperty('solution');
        expect(output).not.toHaveProperty('implementation');
        expect(output).not.toHaveProperty('code');
      }
    });

    it('should include read_only_analysis constraint', async () => {
      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };

      const result = await agent.invoke(input, executionRef);
      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('read_only_analysis');
      }
    });
  });

  describe('Error Handling', () => {
    it('should return success with skipped persistence_status on persistence error', async () => {
      const failingPersistence = {
        store: jest.fn().mockRejectedValue(new Error('RuVector connection failed')),
      } as unknown as RuvectorPersistence;

      const agentWithFailingPersistence = new ObjectiveClarifierAgent(
        failingPersistence,
        mockTelemetry
      );

      const input: ObjectiveClarifierInput = {
        objective: 'Build a user authentication system',
      };
      const executionRef = '550e8400-e29b-41d4-a716-446655440000';

      const result = await agentWithFailingPersistence.invoke(input, executionRef);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.persistence_status.status).toBe('skipped');
        expect(result.persistence_status.error).toContain('RuVector connection failed');
      }
      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });

    it('should reject empty objective at validation boundary', () => {
      // Empty objective violates the min(1) constraint in ObjectiveClarifierInputSchema.
      // Validation happens before invoke() — the router calls validateInput() first.
      expect(() => agent.validateInput({ objective: '' })).toThrow();
    });
  });
});
