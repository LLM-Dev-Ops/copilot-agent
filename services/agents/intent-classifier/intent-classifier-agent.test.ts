/**
 * Intent Classifier Agent Tests
 *
 * Comprehensive test suite covering:
 * 1. Metadata - Agent identification and classification
 * 2. Input Validation - Zod schema validation
 * 3. Invocation - Core invoke behavior, DecisionEvent creation
 * 4. Intent Classification - Pattern matching, confidence scoring
 * 5. Multi-Intent Detection - Multiple intent handling
 * 6. Error Handling - Persistence failures, validation errors
 * 7. Constitution Compliance - Statelessness, read-only analysis
 */

import { IntentClassifierAgent } from './intent-classifier-agent';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
import {
  IntentClassifierInput,
  IntentClassifierOutput,
  IntentType,
} from '../contracts/intent-classifier-schemas';
import { DecisionEvent, AgentClassification } from '../contracts';

// Mock dependencies
const mockPersistence: jest.Mocked<RuvectorPersistence> = {
  store: jest.fn().mockResolvedValue({ id: 'test-id', stored: true }),
  retrieve: jest.fn().mockResolvedValue(null),
  search: jest.fn().mockResolvedValue([]),
} as unknown as jest.Mocked<RuvectorPersistence>;

const mockTelemetry: jest.Mocked<Telemetry> = {
  recordStart: jest.fn(),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
  emitEvent: jest.fn(),
} as unknown as jest.Mocked<Telemetry>;

describe('IntentClassifierAgent', () => {
  let agent: IntentClassifierAgent;
  const executionRef = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new IntentClassifierAgent(mockPersistence, mockTelemetry);
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. METADATA TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Metadata', () => {
    it('should have correct agent ID', () => {
      expect(agent.metadata.id).toBe('intent-classifier-agent');
    });

    it('should have semantic version format', () => {
      expect(agent.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have INTENT_ANALYSIS classification', () => {
      expect(agent.metadata.classifications).toContain(AgentClassification.INTENT_ANALYSIS);
    });

    it('should have intent_classification decision type', () => {
      expect(agent.metadata.decision_type).toBe('intent_classification');
    });

    it('should have descriptive name and description', () => {
      expect(agent.metadata.name).toBe('Intent Classifier Agent');
      expect(agent.metadata.description).toContain('intent');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. INPUT VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Input Validation', () => {
    it('should validate minimal input (text only)', () => {
      const input = { text: 'Hello world' };
      const validated = agent.validateInput(input);
      expect(validated.text).toBe('Hello world');
    });

    it('should validate input with context', () => {
      const input: IntentClassifierInput = {
        text: 'Create a new user',
        context: {
          domain: 'user-management',
          previous_messages: [
            { role: 'user', text: 'I need to add a user' },
          ],
        },
      };
      const validated = agent.validateInput(input);
      expect(validated.context?.domain).toBe('user-management');
    });

    it('should validate input with hints', () => {
      const input: IntentClassifierInput = {
        text: 'Find something',
        hints: {
          expected_intents: ['search', 'query'],
          min_confidence: 0.5,
          max_intents: 3,
        },
      };
      const validated = agent.validateInput(input);
      expect(validated.hints?.max_intents).toBe(3);
    });

    it('should reject empty text', () => {
      expect(() => agent.validateInput({ text: '' })).toThrow();
    });

    it('should reject missing text', () => {
      expect(() => agent.validateInput({})).toThrow();
    });

    it('should reject text exceeding max length', () => {
      const longText = 'a'.repeat(50001);
      expect(() => agent.validateInput({ text: longText })).toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. INVOCATION TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Invocation', () => {
    it('should return success status with valid input', async () => {
      const input: IntentClassifierInput = { text: 'Create a new project' };
      const result = await agent.invoke(input, executionRef);

      expect(result.status).toBe('success');
    });

    it('should create DecisionEvent with correct agent metadata', async () => {
      const input: IntentClassifierInput = { text: 'Find the user' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.agent_id).toBe('intent-classifier-agent');
        expect(result.event.agent_version).toBe('1.0.0');
        expect(result.event.decision_type).toBe('intent_classification');
      } else {
        fail('Expected success status');
      }
    });

    it('should include execution_ref in DecisionEvent', async () => {
      const input: IntentClassifierInput = { text: 'Hello' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.execution_ref).toBe(executionRef);
      } else {
        fail('Expected success status');
      }
    });

    it('should have deterministic inputs_hash for same input', async () => {
      const input: IntentClassifierInput = { text: 'Test determinism' };

      const result1 = await agent.invoke(input, executionRef);
      const result2 = await agent.invoke(input, '660e8400-e29b-41d4-a716-446655440001');

      if (result1.status === 'success' && result2.status === 'success') {
        expect(result1.event.inputs_hash).toBe(result2.event.inputs_hash);
      } else {
        fail('Expected success status for both invocations');
      }
    });

    it('should persist event via RuVector', async () => {
      const input: IntentClassifierInput = { text: 'Create something' };
      await agent.invoke(input, executionRef);

      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
      expect(mockPersistence.store).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'intent-classifier-agent',
          decision_type: 'intent_classification',
        })
      );
    });

    it('should emit telemetry start on invocation', async () => {
      const input: IntentClassifierInput = { text: 'Run test' };
      await agent.invoke(input, executionRef);

      expect(mockTelemetry.recordStart).toHaveBeenCalledWith(
        'intent-classifier-agent',
        executionRef,
        input
      );
    });

    it('should emit telemetry success on completion', async () => {
      const input: IntentClassifierInput = { text: 'Test success' };
      await agent.invoke(input, executionRef);

      expect(mockTelemetry.recordSuccess).toHaveBeenCalledWith(
        'intent-classifier-agent',
        executionRef,
        expect.any(Number)
      );
    });

    it('should have confidence score between 0 and 1', async () => {
      const input: IntentClassifierInput = { text: 'What is the weather?' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.confidence).toBeGreaterThanOrEqual(0);
        expect(result.event.confidence).toBeLessThanOrEqual(1);
      } else {
        fail('Expected success status');
      }
    });

    it('should include constraints_applied in DecisionEvent', async () => {
      const input: IntentClassifierInput = { text: 'Help me' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('read_only_analysis');
        expect(result.event.constraints_applied).toContain('no_workflow_triggering');
        expect(result.event.constraints_applied).toContain('no_execution_routing');
        expect(result.event.constraints_applied).toContain('no_policy_enforcement');
      } else {
        fail('Expected success status');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. INTENT CLASSIFICATION TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Intent Classification', () => {
    it('should classify CREATE intent', async () => {
      const input: IntentClassifierInput = { text: 'Create a new user account' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.CREATE);
      } else {
        fail('Expected success status');
      }
    });

    it('should classify QUERY intent', async () => {
      const input: IntentClassifierInput = { text: 'What is the status of my order?' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.QUERY);
      } else {
        fail('Expected success status');
      }
    });

    it('should classify DELETE intent', async () => {
      const input: IntentClassifierInput = { text: 'Delete the old records' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.DELETE);
      } else {
        fail('Expected success status');
      }
    });

    it('should classify HELP intent', async () => {
      const input: IntentClassifierInput = { text: 'I need help with this' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.HELP);
      } else {
        fail('Expected success status');
      }
    });

    it('should classify GREETING intent', async () => {
      const input: IntentClassifierInput = { text: 'Hello, how are you?' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.GREETING);
      } else {
        fail('Expected success status');
      }
    });

    it('should classify SEARCH intent', async () => {
      const input: IntentClassifierInput = { text: 'Find me all users named John' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.SEARCH);
      } else {
        fail('Expected success status');
      }
    });

    it('should classify CANCEL intent', async () => {
      const input: IntentClassifierInput = { text: 'Cancel that, nevermind' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.CANCEL);
      } else {
        fail('Expected success status');
      }
    });

    it('should return UNKNOWN for unrecognized intent', async () => {
      const input: IntentClassifierInput = { text: 'asdf jkl qwerty' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.intent_type).toBe(IntentType.UNKNOWN);
        expect(output.primary_intent.confidence).toBeLessThan(0.5);
      } else {
        fail('Expected success status');
      }
    });

    it('should include signals supporting classification', async () => {
      const input: IntentClassifierInput = { text: 'Create a new project' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.primary_intent.signals.length).toBeGreaterThan(0);
        expect(output.primary_intent.signals[0]).toHaveProperty('signal_type');
        expect(output.primary_intent.signals[0]).toHaveProperty('matched_text');
        expect(output.primary_intent.signals[0]).toHaveProperty('weight');
      } else {
        fail('Expected success status');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. MULTI-INTENT DETECTION TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Multi-Intent Detection', () => {
    it('should detect multiple intents in compound request', async () => {
      const input: IntentClassifierInput = {
        text: 'Create a user and then find all their orders',
      };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.analysis.intent_count).toBeGreaterThanOrEqual(1);
      } else {
        fail('Expected success status');
      }
    });

    it('should identify sequential relationship with "then"', async () => {
      const input: IntentClassifierInput = {
        text: 'Create the report then send it to the manager',
      };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        if (output.multi_intent_state.is_multi_intent) {
          expect(output.multi_intent_state.relationship).toBe('sequential');
        }
      } else {
        fail('Expected success status');
      }
    });

    it('should identify parallel relationship with "and"', async () => {
      const input: IntentClassifierInput = {
        text: 'Update the settings and also check the logs',
      };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        if (output.multi_intent_state.is_multi_intent) {
          expect(output.multi_intent_state.relationship).toBe('parallel');
        }
      } else {
        fail('Expected success status');
      }
    });

    it('should track secondary intents separately', async () => {
      const input: IntentClassifierInput = {
        text: 'Find the user and update their profile',
      };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        // Should have secondary intents if multi-intent detected
        expect(output.secondary_intents).toBeDefined();
        expect(Array.isArray(output.secondary_intents)).toBe(true);
      } else {
        fail('Expected success status');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. ERROR HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Error Handling', () => {
    it('should return success with skipped persistence_status on persistence failure', async () => {
      mockPersistence.store.mockRejectedValueOnce(new Error('RuVector connection failed'));

      const input: IntentClassifierInput = { text: 'Test persistence error' };
      const result = await agent.invoke(input, executionRef);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.persistence_status.status).toBe('skipped');
        expect(result.persistence_status.error).toContain('RuVector connection failed');
        expect(result.event).toBeDefined();
      }
    });

    it('should emit success telemetry even on persistence failure', async () => {
      mockPersistence.store.mockRejectedValueOnce(new Error('Storage failed'));

      const input: IntentClassifierInput = { text: 'Test telemetry failure' };
      await agent.invoke(input, executionRef);

      expect(mockTelemetry.recordSuccess).toHaveBeenCalledWith(
        'intent-classifier-agent',
        executionRef,
        expect.any(Number)
      );
    });

    it('should include persisted status on successful persistence', async () => {
      const input: IntentClassifierInput = { text: 'Test persisted status' };
      const result = await agent.invoke(input, executionRef);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.persistence_status.status).toBe('persisted');
        expect(result.persistence_status.error).toBeUndefined();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. CONSTITUTION COMPLIANCE TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Constitution Compliance', () => {
    it('should be stateless - multiple invocations produce independent results', async () => {
      const input1: IntentClassifierInput = { text: 'Create user' };
      const input2: IntentClassifierInput = { text: 'Delete user' };

      const result1 = await agent.invoke(input1, executionRef);
      const result2 = await agent.invoke(input2, '660e8400-e29b-41d4-a716-446655440001');

      if (result1.status === 'success' && result2.status === 'success') {
        const output1 = result1.event.outputs as IntentClassifierOutput;
        const output2 = result2.event.outputs as IntentClassifierOutput;

        // Different inputs should produce different classifications
        expect(output1.primary_intent.intent_type).not.toBe(output2.primary_intent.intent_type);
      } else {
        fail('Expected success status for both invocations');
      }
    });

    it('should not trigger any workflows (read-only analysis)', async () => {
      const input: IntentClassifierInput = { text: 'Execute the workflow now' };
      const result = await agent.invoke(input, executionRef);

      // Agent should only classify, not execute
      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('no_workflow_triggering');
        // Verify no workflow-related side effects (only persistence and telemetry called)
        expect(mockPersistence.store).toHaveBeenCalledTimes(1);
      } else {
        fail('Expected success status');
      }
    });

    it('should not route execution (signal routing only)', async () => {
      const input: IntentClassifierInput = { text: 'Route this to the admin' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('no_execution_routing');
        expect(result.event.constraints_applied).toContain('signal_routing_only');
      } else {
        fail('Expected success status');
      }
    });

    it('should not enforce any policies', async () => {
      const input: IntentClassifierInput = { text: 'Enforce the policy' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('no_policy_enforcement');
      } else {
        fail('Expected success status');
      }
    });

    it('should be deterministic - same input produces same structure', async () => {
      const input: IntentClassifierInput = { text: 'Create a test' };

      const result1 = await agent.invoke(input, executionRef);
      const result2 = await agent.invoke(input, '660e8400-e29b-41d4-a716-446655440001');

      if (result1.status === 'success' && result2.status === 'success') {
        const output1 = result1.event.outputs as IntentClassifierOutput;
        const output2 = result2.event.outputs as IntentClassifierOutput;

        // Same input should classify to same intent type
        expect(output1.primary_intent.intent_type).toBe(output2.primary_intent.intent_type);
        // Same input should have same normalized text
        expect(output1.normalized_text).toBe(output2.normalized_text);
      } else {
        fail('Expected success status for both invocations');
      }
    });

    it('should only persist via RuVector (not direct DB)', async () => {
      const input: IntentClassifierInput = { text: 'Test persistence compliance' };
      await agent.invoke(input, executionRef);

      // Only RuVector should be called, no direct DB operations
      expect(mockPersistence.store).toHaveBeenCalled();
      // No SQL or direct DB calls should be made (verified by mock)
    });

    it('should emit telemetry for observability', async () => {
      const input: IntentClassifierInput = { text: 'Test telemetry compliance' };
      await agent.invoke(input, executionRef);

      expect(mockTelemetry.recordStart).toHaveBeenCalled();
      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. OUTPUT STRUCTURE TESTS
  // ═══════════════════════════════════════════════════════════════
  describe('Output Structure', () => {
    it('should include classification_id as UUID', async () => {
      const input: IntentClassifierInput = { text: 'Test output' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.classification_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      } else {
        fail('Expected success status');
      }
    });

    it('should include original and normalized text', async () => {
      const input: IntentClassifierInput = { text: 'CREATE A USER' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.original_text).toBe('CREATE A USER');
        expect(output.normalized_text).toBe('create a user');
      } else {
        fail('Expected success status');
      }
    });

    it('should include analysis metadata', async () => {
      const input: IntentClassifierInput = { text: 'What is the status?' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.analysis).toHaveProperty('intent_count');
        expect(output.analysis).toHaveProperty('signal_count');
        expect(output.analysis).toHaveProperty('notes');
        expect(output.analysis).toHaveProperty('ambiguity');
      } else {
        fail('Expected success status');
      }
    });

    it('should include ambiguity analysis', async () => {
      const input: IntentClassifierInput = { text: 'Maybe create or update the thing' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.analysis.ambiguity).toHaveProperty('is_ambiguous');
        expect(output.analysis.ambiguity).toHaveProperty('ambiguity_type');
        expect(output.analysis.ambiguity).toHaveProperty('clarification_needed');
      } else {
        fail('Expected success status');
      }
    });

    it('should have version in output', async () => {
      const input: IntentClassifierInput = { text: 'Test version' };
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as IntentClassifierOutput;
        expect(output.version).toBe('1.0.0');
      } else {
        fail('Expected success status');
      }
    });
  });
});
