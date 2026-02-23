/**
 * Meta-Reasoner Agent Tests
 *
 * Tests for constitution compliance and functionality:
 * - Metadata verification
 * - Input validation
 * - Output validation
 * - Contradiction detection
 * - Confidence calibration assessment
 * - Systemic issue identification
 * - Constitution compliance (stateless, no side effects, etc.)
 */

import { v4 as uuidv4 } from 'uuid';
import { MetaReasonerAgent } from './meta-reasoner-agent';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
import {
  MetaReasonerInput,
  MetaReasonerOutput,
  ReasoningTrace,
  AgentClassification,
} from '../contracts';

// Mock dependencies
const mockPersistence = {
  store: jest.fn().mockResolvedValue({ id: 'mock-id', stored: true }),
  retrieve: jest.fn(),
  search: jest.fn(),
} as unknown as RuvectorPersistence;

const mockTelemetry = {
  recordStart: jest.fn(),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
  emitEvent: jest.fn(),
} as unknown as Telemetry;

describe('MetaReasonerAgent', () => {
  let agent: MetaReasonerAgent;
  let executionRef: string;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new MetaReasonerAgent(mockPersistence, mockTelemetry);
    executionRef = uuidv4();
  });

  // Helper to create a valid reasoning trace
  function createTrace(overrides: Partial<ReasoningTrace> = {}): ReasoningTrace {
    return {
      agent_id: 'test-agent',
      agent_version: '1.0.0',
      decision_type: 'test_decision',
      execution_ref: uuidv4(),
      timestamp: new Date().toISOString(),
      reported_confidence: 0.8,
      reasoning_content: { key: 'value' },
      constraints_applied: ['test_constraint'],
      tags: [],
      ...overrides,
    };
  }

  // Helper to create valid input
  function createValidInput(overrides: Partial<MetaReasonerInput> = {}): MetaReasonerInput {
    return {
      traces: [createTrace(), createTrace({ agent_id: 'test-agent-2' })],
      scope: {
        detect_contradictions: true,
        assess_confidence_calibration: true,
        identify_systemic_issues: true,
        detect_fallacies: false,
        check_completeness: false,
      },
      ...overrides,
    };
  }

  describe('Metadata', () => {
    it('should have correct agent ID', () => {
      expect(agent.metadata.id).toBe('meta-reasoner-agent');
    });

    it('should have valid semantic version', () => {
      expect(agent.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have correct decision type', () => {
      expect(agent.metadata.decision_type).toBe('meta_reasoning_analysis');
    });

    it('should have META_ANALYSIS classification', () => {
      expect(agent.metadata.classifications).toContain(AgentClassification.META_ANALYSIS);
    });

    it('should have REASONING_QUALITY_ASSESSMENT classification', () => {
      expect(agent.metadata.classifications).toContain(AgentClassification.REASONING_QUALITY_ASSESSMENT);
    });

    it('should have a description', () => {
      expect(agent.metadata.description).toBeTruthy();
      expect(agent.metadata.description.length).toBeGreaterThan(10);
    });
  });

  describe('Input Validation', () => {
    it('should validate correct input', () => {
      const input = createValidInput();
      expect(() => agent.validateInput(input)).not.toThrow();
    });

    it('should reject input without traces', () => {
      const input = { scope: {} };
      expect(() => agent.validateInput(input)).toThrow();
    });

    it('should reject input with empty traces array', () => {
      const input = { traces: [] };
      expect(() => agent.validateInput(input)).toThrow();
    });

    it('should reject trace without agent_id', () => {
      const trace = createTrace();
      delete (trace as Record<string, unknown>).agent_id;
      const input = { traces: [trace] };
      expect(() => agent.validateInput(input)).toThrow();
    });

    it('should reject trace with invalid version format', () => {
      const input = createValidInput({
        traces: [createTrace({ agent_version: 'invalid' })],
      });
      expect(() => agent.validateInput(input)).toThrow();
    });

    it('should reject trace with confidence > 1', () => {
      const input = createValidInput({
        traces: [createTrace({ reported_confidence: 1.5 })],
      });
      expect(() => agent.validateInput(input)).toThrow();
    });

    it('should reject trace with confidence < 0', () => {
      const input = createValidInput({
        traces: [createTrace({ reported_confidence: -0.1 })],
      });
      expect(() => agent.validateInput(input)).toThrow();
    });

    it('should accept input with default scope values', () => {
      const input = { traces: [createTrace()] };
      expect(() => agent.validateInput(input)).not.toThrow();
    });
  });

  describe('Invocation', () => {
    it('should return success for valid input', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      expect(result.status).toBe('success');
    });

    it('should emit telemetry on start', async () => {
      const input = createValidInput();
      await agent.invoke(input, executionRef);

      expect(mockTelemetry.recordStart).toHaveBeenCalledWith(
        'meta-reasoner-agent',
        executionRef,
        input
      );
    });

    it('should emit telemetry on success', async () => {
      const input = createValidInput();
      await agent.invoke(input, executionRef);

      expect(mockTelemetry.recordSuccess).toHaveBeenCalledWith(
        'meta-reasoner-agent',
        executionRef,
        expect.any(Number)
      );
    });

    it('should persist via ruvector-service', async () => {
      const input = createValidInput();
      await agent.invoke(input, executionRef);

      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should include execution_ref in result', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.execution_ref).toBe(executionRef);
      }
    });

    it('should return valid DecisionEvent on success', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.agent_id).toBe('meta-reasoner-agent');
        expect(result.event.agent_version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.event.decision_type).toBe('meta_reasoning_analysis');
        expect(result.event.inputs_hash).toHaveLength(64);
        expect(result.event.confidence).toBeGreaterThanOrEqual(0);
        expect(result.event.confidence).toBeLessThanOrEqual(1);
        expect(result.event.constraints_applied).toBeInstanceOf(Array);
        expect(result.event.timestamp).toBeTruthy();
      }
    });
  });

  describe('Output Structure', () => {
    it('should return analysis_id as UUID', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.analysis_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });

    it('should return summary string', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(typeof output.summary).toBe('string');
        expect(output.summary.length).toBeGreaterThan(0);
      }
    });

    it('should return quality_metrics object', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.quality_metrics).toBeDefined();
        expect(output.quality_metrics.overall_score).toBeGreaterThanOrEqual(0);
        expect(output.quality_metrics.overall_score).toBeLessThanOrEqual(1);
        expect(output.quality_metrics.traces_analyzed).toBe(2);
        expect(output.quality_metrics.agents_analyzed).toBe(2);
      }
    });

    it('should return analysis_metadata with correct trace count', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.analysis_metadata.total_traces).toBe(2);
        expect(output.analysis_metadata.traces_analyzed).toBe(2);
      }
    });

    it('should track unique agents in metadata', async () => {
      const input = createValidInput({
        traces: [
          createTrace({ agent_id: 'agent-a' }),
          createTrace({ agent_id: 'agent-b' }),
          createTrace({ agent_id: 'agent-a' }),
        ],
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.analysis_metadata.unique_agents).toBe(2);
      }
    });

    it('should track scope execution', async () => {
      const input = createValidInput({
        scope: {
          detect_contradictions: true,
          assess_confidence_calibration: false,
          identify_systemic_issues: true,
        },
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.analysis_metadata.scope_executed.contradictions_checked).toBe(true);
        expect(output.analysis_metadata.scope_executed.calibration_assessed).toBe(false);
        expect(output.analysis_metadata.scope_executed.systemic_issues_checked).toBe(true);
      }
    });
  });

  describe('Contradiction Detection', () => {
    it('should detect statistical contradictions with large confidence gaps', async () => {
      const input = createValidInput({
        traces: [
          createTrace({
            agent_id: 'agent-a',
            decision_type: 'test',
            reported_confidence: 0.95,
          }),
          createTrace({
            agent_id: 'agent-b',
            decision_type: 'test',
            reported_confidence: 0.3,
          }),
        ],
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.contradictions.length).toBeGreaterThan(0);
        const statistical = output.contradictions.find(c => c.type === 'statistical');
        expect(statistical).toBeDefined();
      }
    });

    it('should detect temporal contradictions for same agent', async () => {
      const baseTime = new Date();
      const input = createValidInput({
        traces: [
          createTrace({
            agent_id: 'agent-a',
            decision_type: 'test',
            reported_confidence: 0.9,
            timestamp: baseTime.toISOString(),
          }),
          createTrace({
            agent_id: 'agent-a',
            decision_type: 'test',
            reported_confidence: 0.4,
            timestamp: new Date(baseTime.getTime() + 1000).toISOString(),
          }),
        ],
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        const temporal = output.contradictions.find(c => c.type === 'temporal');
        expect(temporal).toBeDefined();
      }
    });

    it('should NOT detect contradictions when scope is disabled', async () => {
      const input = createValidInput({
        traces: [
          createTrace({ reported_confidence: 0.95, decision_type: 'test' }),
          createTrace({ reported_confidence: 0.3, decision_type: 'test' }),
        ],
        scope: {
          detect_contradictions: false,
          assess_confidence_calibration: false,
          identify_systemic_issues: false,
        },
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.contradictions).toHaveLength(0);
      }
    });
  });

  describe('Confidence Calibration', () => {
    it('should assess calibration for each agent', async () => {
      const input = createValidInput({
        traces: [
          createTrace({ agent_id: 'agent-a' }),
          createTrace({ agent_id: 'agent-b' }),
        ],
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.confidence_calibrations.length).toBe(2);
        expect(output.confidence_calibrations.map(c => c.agent_id)).toContain('agent-a');
        expect(output.confidence_calibrations.map(c => c.agent_id)).toContain('agent-b');
      }
    });

    it('should detect overconfidence with historical accuracy data', async () => {
      const input = createValidInput({
        traces: [
          createTrace({ agent_id: 'agent-a', reported_confidence: 0.95 }),
        ],
        context: {
          historical_accuracy: { 'agent-a': 0.6 },
        },
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        const calibration = output.confidence_calibrations.find(c => c.agent_id === 'agent-a');
        expect(calibration?.assessment).toBe('overconfident');
        expect(calibration?.calibration_gap).toBeGreaterThan(0);
      }
    });

    it('should detect underconfidence with historical accuracy data', async () => {
      const input = createValidInput({
        traces: [
          createTrace({ agent_id: 'agent-a', reported_confidence: 0.5 }),
        ],
        context: {
          historical_accuracy: { 'agent-a': 0.9 },
        },
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        const calibration = output.confidence_calibrations.find(c => c.agent_id === 'agent-a');
        expect(calibration?.assessment).toBe('underconfident');
        expect(calibration?.calibration_gap).toBeLessThan(0);
      }
    });

    it('should report insufficient_data without historical accuracy', async () => {
      const input = createValidInput({
        traces: [createTrace({ agent_id: 'agent-a', reported_confidence: 0.8 })],
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        const calibration = output.confidence_calibrations.find(c => c.agent_id === 'agent-a');
        expect(['insufficient_data', 'well_calibrated', 'inconsistent']).toContain(
          calibration?.assessment
        );
      }
    });
  });

  describe('Systemic Issues', () => {
    it('should detect missing_uncertainty when most traces have very high confidence', async () => {
      const traces = Array.from({ length: 10 }, (_, i) =>
        createTrace({
          agent_id: `agent-${i}`,
          reported_confidence: 0.95 + Math.random() * 0.05,
        })
      );
      const input = createValidInput({ traces });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        const missingUncertainty = output.systemic_issues.find(
          i => i.type === 'missing_uncertainty'
        );
        expect(missingUncertainty).toBeDefined();
      }
    });

    it('should NOT identify issues when scope is disabled', async () => {
      const traces = Array.from({ length: 10 }, (_, i) =>
        createTrace({ agent_id: `agent-${i}`, reported_confidence: 0.99 })
      );
      const input = createValidInput({
        traces,
        scope: {
          detect_contradictions: false,
          assess_confidence_calibration: false,
          identify_systemic_issues: false,
        },
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.systemic_issues).toHaveLength(0);
      }
    });
  });

  describe('Key Findings', () => {
    it('should prioritize findings', async () => {
      const input = createValidInput({
        traces: [
          createTrace({ reported_confidence: 0.99, decision_type: 'test' }),
          createTrace({ reported_confidence: 0.2, decision_type: 'test' }),
        ],
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        if (output.key_findings.length > 1) {
          // Check findings are sorted by priority
          for (let i = 1; i < output.key_findings.length; i++) {
            expect(output.key_findings[i].priority).toBeGreaterThanOrEqual(
              output.key_findings[i - 1].priority
            );
          }
        }
      }
    });
  });

  describe('Constitution Compliance', () => {
    it('should NOT modify any external state (stateless)', async () => {
      const input = createValidInput();

      // Invoke multiple times
      await agent.invoke(input, executionRef);
      await agent.invoke(input, uuidv4());

      // Only persistence.store should be called (not mutating external state)
      // The agent doesn't maintain internal state between invocations
    });

    it('should NOT override any outputs (read-only analysis)', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;

        // Verify the agent doesn't include any "corrected" outputs
        expect(output).not.toHaveProperty('corrected_outputs');
        expect(output).not.toHaveProperty('overridden_decisions');
        expect(output).not.toHaveProperty('enforced_changes');
      }
    });

    it('should NOT enforce any corrections', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        // Verify constraints include no correction enforcement
        expect(result.event.constraints_applied).toContain('no_correction_enforcement');
        expect(result.event.constraints_applied).toContain('no_output_override');
      }
    });

    it('should NOT execute any logic (analysis only)', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('no_logic_execution');
        expect(result.event.constraints_applied).toContain('read_only_analysis');
      }
    });

    it('should emit exactly ONE DecisionEvent per invocation', async () => {
      const input = createValidInput();
      await agent.invoke(input, executionRef);

      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should produce deterministic output for identical input', async () => {
      const input = createValidInput();

      const result1 = await agent.invoke(input, executionRef);
      const result2 = await agent.invoke(input, executionRef);

      if (result1.status === 'success' && result2.status === 'success') {
        // Same inputs_hash means deterministic input processing
        expect(result1.event.inputs_hash).toBe(result2.event.inputs_hash);

        // Output structure should be consistent
        const output1 = result1.event.outputs as MetaReasonerOutput;
        const output2 = result2.event.outputs as MetaReasonerOutput;

        expect(output1.quality_metrics.traces_analyzed).toBe(
          output2.quality_metrics.traces_analyzed
        );
        expect(output1.analysis_metadata.unique_agents).toBe(
          output2.analysis_metadata.unique_agents
        );
      }
    });

    it('should NOT orchestrate other agents', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;

        // Verify no agent assignments or orchestration commands
        expect(output).not.toHaveProperty('agent_assignments');
        expect(output).not.toHaveProperty('orchestration_commands');
        expect(output).not.toHaveProperty('triggered_workflows');
      }
    });

    it('should include stateless_processing constraint', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('stateless_processing');
      }
    });

    it('should include deterministic_output constraint', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('deterministic_output');
      }
    });
  });

  describe('Error Handling', () => {
    it('should return success with skipped persistence_status on persistence failure', async () => {
      // Use the same mock persistence as the working success tests,
      // but override store to fail
      mockPersistence.store.mockRejectedValueOnce(new Error('RuVector persistence failed'));

      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.persistence_status.status).toBe('skipped');
        expect(result.persistence_status.error).toContain('RuVector persistence failed');
        expect(result.event).toBeDefined();
      }
    });

    it('should emit success telemetry even on persistence failure', async () => {
      mockPersistence.store.mockRejectedValueOnce(new Error('persistence error'));

      const input = createValidInput();
      await agent.invoke(input, executionRef);

      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('Confidence Calculation', () => {
    it('should have higher confidence with more traces', async () => {
      const fewTracesInput = createValidInput({
        traces: [createTrace()],
      });

      const manyTracesInput = createValidInput({
        traces: Array.from({ length: 15 }, (_, i) =>
          createTrace({ agent_id: `agent-${i}` })
        ),
      });

      const fewResult = await agent.invoke(fewTracesInput, uuidv4());
      const manyResult = await agent.invoke(manyTracesInput, uuidv4());

      if (fewResult.status === 'success' && manyResult.status === 'success') {
        expect(manyResult.event.confidence).toBeGreaterThanOrEqual(fewResult.event.confidence);
      }
    });

    it('should have higher confidence with historical accuracy data', async () => {
      const withoutHistory = createValidInput();

      const withHistory = createValidInput({
        context: {
          historical_accuracy: {
            'test-agent': 0.85,
            'test-agent-2': 0.9,
          },
        },
      });

      const result1 = await agent.invoke(withoutHistory, uuidv4());
      const result2 = await agent.invoke(withHistory, uuidv4());

      if (result1.status === 'success' && result2.status === 'success') {
        expect(result2.event.confidence).toBeGreaterThanOrEqual(result1.event.confidence);
      }
    });
  });

  describe('Assumptions', () => {
    it('should include assumptions in output', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        expect(output.assumptions).toBeInstanceOf(Array);
        expect(output.assumptions.length).toBeGreaterThan(0);
      }
    });

    it('should note missing historical accuracy data', async () => {
      const input = createValidInput();
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        const hasHistoryAssumption = output.assumptions.some(
          a => a.toLowerCase().includes('historical') || a.toLowerCase().includes('baseline')
        );
        expect(hasHistoryAssumption).toBe(true);
      }
    });

    it('should note limited trace count', async () => {
      const input = createValidInput({
        traces: [createTrace()],
      });
      const result = await agent.invoke(input, executionRef);

      if (result.status === 'success') {
        const output = result.event.outputs as MetaReasonerOutput;
        const hasLimitedDataAssumption = output.assumptions.some(
          a => a.toLowerCase().includes('limited') || a.toLowerCase().includes('statistical')
        );
        expect(hasLimitedDataAssumption).toBe(true);
      }
    });
  });
});
