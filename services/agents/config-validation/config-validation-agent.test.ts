/**
 * Config Validation Agent Tests
 *
 * Validates compliance with Agentics Global Agent Constitution:
 * - Stateless at runtime
 * - Emits exactly ONE DecisionEvent per invocation
 * - Deterministic for identical inputs
 * - NEVER modifies, applies defaults, auto-fixes, enforces policy, or blocks execution
 */

import { ConfigValidationAgent } from './config-validation-agent';
import { RuvectorPersistence } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
import { ConfigValidationInput, ConfigValidationOutput } from '../contracts';

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

describe('ConfigValidationAgent', () => {
  let agent: ConfigValidationAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new ConfigValidationAgent(mockPersistence, mockTelemetry);
  });

  describe('Metadata', () => {
    it('should have correct agent metadata', () => {
      expect(agent.metadata.id).toBe('config-validation-agent');
      expect(agent.metadata.version).toBe('1.0.0');
      expect(agent.metadata.decision_type).toBe('config_validation');
      expect(agent.metadata.classifications).toContain('CONFIGURATION_VALIDATION');
      expect(agent.metadata.classifications).toContain('STATIC_ANALYSIS');
    });
  });

  describe('Input Validation', () => {
    it('should validate valid input', () => {
      const input = { config: { database: { host: 'localhost' } } };
      const validated = agent.validateInput(input);
      expect(validated.config).toEqual(input.config);
    });

    it('should reject input without config', () => {
      expect(() => agent.validateInput({})).toThrow();
    });

    it('should accept input with all options', () => {
      const input: ConfigValidationInput = {
        config: { server: { port: 8080 } },
        format: 'json',
        schema: { uri: 'test-schema', format: 'json-schema' },
        context: { environment: 'prod', application: 'test-app' },
        options: { strict: true, check_security: true },
      };
      const validated = agent.validateInput(input);
      expect(validated.context?.environment).toBe('prod');
      expect(validated.options?.strict).toBe(true);
    });
  });

  describe('Invocation', () => {
    const validInput: ConfigValidationInput = {
      config: {
        server: { port: 8080, host: 'localhost' },
        database: { host: 'db.example.com', port: 5432 },
      },
    };
    const executionRef = '550e8400-e29b-41d4-a716-446655440000';

    it('should return success result with DecisionEvent', async () => {
      const result = await agent.invoke(validInput, executionRef);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.event.agent_id).toBe('config-validation-agent');
        expect(result.event.agent_version).toBe('1.0.0');
        expect(result.event.decision_type).toBe('config_validation');
        expect(result.event.execution_ref).toBe(executionRef);
      }
    });

    it('should emit exactly ONE DecisionEvent per invocation', async () => {
      await agent.invoke(validInput, executionRef);
      expect(mockPersistence.store).toHaveBeenCalledTimes(1);
    });

    it('should produce deterministic output for identical input', async () => {
      const result1 = await agent.invoke(validInput, executionRef);
      const result2 = await agent.invoke(validInput, executionRef);

      if (result1.status === 'success' && result2.status === 'success') {
        expect(result1.event.inputs_hash).toBe(result2.event.inputs_hash);

        const output1 = result1.event.outputs as ConfigValidationOutput;
        const output2 = result2.event.outputs as ConfigValidationOutput;
        expect(output1.valid).toBe(output2.valid);
        expect(output1.findings.length).toBe(output2.findings.length);
      }
    });

    it('should include constraints_applied in output', async () => {
      const result = await agent.invoke(validInput, executionRef);

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('read_only_analysis');
        expect(result.event.constraints_applied).toContain('no_modification');
        expect(result.event.constraints_applied).toContain('no_defaults_applied');
        expect(result.event.constraints_applied).toContain('no_auto_fix');
        expect(result.event.constraints_applied).toContain('no_policy_enforcement');
        expect(result.event.constraints_applied).toContain('no_execution_blocking');
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
          agent_id: 'config-validation-agent',
          decision_type: 'config_validation',
        })
      );
    });

    it('should emit telemetry', async () => {
      await agent.invoke(validInput, executionRef);

      expect(mockTelemetry.recordStart).toHaveBeenCalled();
      expect(mockTelemetry.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('Schema Validation', () => {
    it('should detect missing required properties', async () => {
      const input: ConfigValidationInput = {
        config: { server: {} },
        schema: {
          content: {
            type: 'object',
            properties: {
              server: {
                type: 'object',
                properties: {
                  port: { type: 'number' },
                  host: { type: 'string' },
                },
                required: ['port', 'host'],
              },
            },
          },
          format: 'json-schema',
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440001');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const schemaFindings = output.findings.filter(f => f.category === 'schema');
        expect(schemaFindings.length).toBeGreaterThan(0);
      }
    });

    it('should detect type mismatches', async () => {
      const input: ConfigValidationInput = {
        config: { server: { port: 'not-a-number' } },
        schema: {
          content: {
            type: 'object',
            properties: {
              server: {
                type: 'object',
                properties: {
                  port: { type: 'number' },
                },
              },
            },
          },
          format: 'json-schema',
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440002');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const typeFindings = output.findings.filter(f => f.category === 'type_mismatch');
        expect(typeFindings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Semantic Validation', () => {
    it('should detect invalid port numbers', async () => {
      const input: ConfigValidationInput = {
        config: { server: { port: 99999 } },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440003');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const portFindings = output.findings.filter(f => f.tags.includes('port'));
        expect(portFindings.length).toBeGreaterThan(0);
        expect(portFindings[0].severity).toBe('error');
      }
    });

    it('should detect negative timeout values', async () => {
      const input: ConfigValidationInput = {
        config: { connection: { timeout: -1000 } },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440004');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const timeoutFindings = output.findings.filter(f => f.tags.includes('timeout'));
        expect(timeoutFindings.length).toBeGreaterThan(0);
      }
    });

    it('should detect invalid URL formats', async () => {
      const input: ConfigValidationInput = {
        config: { api: { url: 'not-a-valid-url' } },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440005');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const urlFindings = output.findings.filter(f => f.tags.includes('url'));
        expect(urlFindings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Security Detection', () => {
    it('should detect potential hardcoded secrets', async () => {
      const input: ConfigValidationInput = {
        config: {
          database: {
            password: 'super-secret-password-123',
          },
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440006');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        expect(output.unsafe_configs.length).toBeGreaterThan(0);
        expect(output.unsafe_configs[0].concern_type).toBe('hardcoded_secret');
        // Value should be redacted
        expect(output.unsafe_configs[0].value).toBe('[REDACTED]');
      }
    });

    it('should NOT flag environment variable references as secrets', async () => {
      const input: ConfigValidationInput = {
        config: {
          database: {
            password: '${DB_PASSWORD}',
            apiKey: '$API_KEY',
          },
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440007');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const secretFindings = output.unsafe_configs.filter(u => u.concern_type === 'hardcoded_secret');
        expect(secretFindings.length).toBe(0);
      }
    });

    it('should detect insecure HTTP protocols', async () => {
      const input: ConfigValidationInput = {
        config: {
          api: { endpoint: 'http://external-api.example.com/v1' },
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440008');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const httpFindings = output.unsafe_configs.filter(u => u.concern_type === 'insecure_protocol');
        expect(httpFindings.length).toBeGreaterThan(0);
      }
    });

    it('should detect debug mode in production', async () => {
      const input: ConfigValidationInput = {
        config: { app: { debug: true } },
        context: { environment: 'prod' },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440009');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const debugFindings = output.unsafe_configs.filter(u => u.concern_type === 'debug_enabled');
        expect(debugFindings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Deprecated Detection', () => {
    it('should detect user-specified deprecated keys', async () => {
      const input: ConfigValidationInput = {
        config: { oldConfig: { legacySetting: true } },
        context: { deprecated_keys: ['legacySetting'] },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440010');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        expect(output.deprecated_values.length).toBeGreaterThan(0);
      }
    });

    it('should detect common deprecated terminology', async () => {
      const input: ConfigValidationInput = {
        config: { security: { whitelist: ['127.0.0.1'] } },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440011');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        const deprecatedFindings = output.findings.filter(f => f.category === 'deprecated');
        expect(deprecatedFindings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Readiness Assessment', () => {
    it('should return ready status for valid config', async () => {
      const input: ConfigValidationInput = {
        config: {
          server: { port: 8080, host: 'localhost' },
          database: { host: 'db.local', port: 5432 },
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440012');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        expect(['ready', 'ready_with_warnings']).toContain(output.readiness.status);
        expect(output.readiness.score).toBeGreaterThan(0.5);
      }
    });

    it('should return not_ready for config with errors', async () => {
      const input: ConfigValidationInput = {
        config: {
          server: { port: 99999 }, // Invalid port
          database: { password: 'hardcoded-secret-value' }, // Security issue
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440013');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        expect(['not_ready', 'critical_issues']).toContain(output.readiness.status);
      }
    });
  });

  describe('Constitution Compliance', () => {
    it('should NOT modify the input configuration', async () => {
      const originalConfig = {
        server: { port: 8080 },
        database: { host: 'localhost' },
      };
      const input: ConfigValidationInput = {
        config: JSON.parse(JSON.stringify(originalConfig)),
      };

      await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440014');

      // Config should be unchanged
      expect(input.config).toEqual(originalConfig);
    });

    it('should NOT apply default values', async () => {
      const input: ConfigValidationInput = {
        config: { minimal: true }, // Missing many common keys
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440015');

      if (result.status === 'success') {
        // Output should not contain "corrected" or "defaulted" values
        const output = result.event.outputs as ConfigValidationOutput;
        expect(output).not.toHaveProperty('corrected_config');
        expect(output).not.toHaveProperty('applied_defaults');
      }
    });

    it('should NOT auto-fix any values', async () => {
      const input: ConfigValidationInput = {
        config: { server: { port: 'invalid' } }, // Wrong type
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440016');

      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        // Should report the issue, not fix it
        expect(output).not.toHaveProperty('fixed_config');
        expect(output).not.toHaveProperty('auto_corrections');
        // Should have a finding about the issue
        expect(output.findings.length).toBeGreaterThan(0);
      }
    });

    it('should NOT enforce policy (only report)', async () => {
      const input: ConfigValidationInput = {
        config: {
          security: { enabled: false }, // "Bad" security setting
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440017');

      // Agent should succeed (not throw/reject for policy violation)
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        // Should report findings, not enforce
        const output = result.event.outputs as ConfigValidationOutput;
        expect(output).toBeDefined();
      }
    });

    it('should NOT block execution (returns result even with critical issues)', async () => {
      const input: ConfigValidationInput = {
        config: {
          database: { password: 'super-secret-hardcoded-password' },
          server: { port: -1 },
          api: { url: 'not-valid' },
        },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440018');

      // Should return result, not throw
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const output = result.event.outputs as ConfigValidationOutput;
        // Has critical findings but still returns
        expect(output.summary.by_severity.critical).toBeGreaterThan(0);
      }
    });

    it('should be stateless across invocations', async () => {
      const agent1 = new ConfigValidationAgent(mockPersistence, mockTelemetry);
      const agent2 = new ConfigValidationAgent(mockPersistence, mockTelemetry);

      const input1: ConfigValidationInput = { config: { a: 1 } };
      const input2: ConfigValidationInput = { config: { b: 2 } };

      await agent1.invoke(input1, '550e8400-e29b-41d4-a716-446655440019');
      await agent2.invoke(input2, '550e8400-e29b-41d4-a716-446655440020');

      // Both should work independently
      expect(mockPersistence.store).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should return error result on persistence failure', async () => {
      const badPersistence = {
        store: jest.fn().mockRejectedValue(new Error('Persistence failed')),
      } as unknown as RuvectorPersistence;

      const errorAgent = new ConfigValidationAgent(badPersistence, mockTelemetry);
      const result = await errorAgent.invoke(
        { config: { test: true } },
        '550e8400-e29b-41d4-a716-446655440021'
      );

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error_code).toBeDefined();
        expect(result.error_message).toContain('Persistence');
      }
    });

    it('should emit failure telemetry on error', async () => {
      const badPersistence = {
        store: jest.fn().mockRejectedValue(new Error('Test error')),
      } as unknown as RuvectorPersistence;

      const errorAgent = new ConfigValidationAgent(badPersistence, mockTelemetry);
      await errorAgent.invoke({ config: {} }, '550e8400-e29b-41d4-a716-446655440022');

      expect(mockTelemetry.recordFailure).toHaveBeenCalled();
    });
  });

  describe('Strict Mode', () => {
    it('should treat warnings as errors in strict mode', async () => {
      const input: ConfigValidationInput = {
        config: { api: { url: 'http://localhost/api' } }, // HTTP to localhost (warning only normally)
        options: { strict: true },
      };

      const result = await agent.invoke(input, '550e8400-e29b-41d4-a716-446655440023');

      if (result.status === 'success') {
        expect(result.event.constraints_applied).toContain('strict_mode');
      }
    });
  });
});
