#!/usr/bin/env node
/**
 * Config Validation Agent CLI Endpoint
 *
 * Per Constitution: Must expose a CLI-invokable endpoint.
 *
 * Usage:
 *   npx ts-node cli.ts --config '{"database": {"host": "localhost"}}'
 *   npx ts-node cli.ts --file config.json
 *   cat config.json | npx ts-node cli.ts --stdin
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { ConfigValidationAgent } from './config-validation-agent';
import { createRuvectorFromEnv } from '../planner/ruvector-persistence';
import { createTelemetryFromEnv } from '../planner/telemetry';
import { ConfigValidationInput, AgentResult } from '../contracts';

interface CliArgs {
  config?: string;
  file?: string;
  stdin?: boolean;
  schema?: string;
  schemaFile?: string;
  environment?: string;
  strict?: boolean;
  executionRef?: string;
  format?: 'json' | 'pretty' | 'summary';
  help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = { format: 'json' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--config':
      case '-c':
        result.config = nextArg;
        i++;
        break;
      case '--file':
      case '-f':
        result.file = nextArg;
        i++;
        break;
      case '--stdin':
        result.stdin = true;
        break;
      case '--schema':
      case '-s':
        result.schema = nextArg;
        i++;
        break;
      case '--schema-file':
        result.schemaFile = nextArg;
        i++;
        break;
      case '--environment':
      case '-e':
        result.environment = nextArg;
        i++;
        break;
      case '--strict':
        result.strict = true;
        break;
      case '--execution-ref':
        result.executionRef = nextArg;
        i++;
        break;
      case '--format':
        result.format = nextArg as 'json' | 'pretty' | 'summary';
        i++;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Config Validation Agent CLI

Validate configuration artifacts for structural and semantic correctness.

USAGE:
  config-validation --config '{"database": {"host": "localhost"}}'
  config-validation --file config.json
  cat config.json | config-validation --stdin

OPTIONS:
  -c, --config <json>       Configuration JSON to validate
  -f, --file <path>         Path to configuration file (JSON/YAML)
  --stdin                   Read configuration from stdin
  -s, --schema <json>       Schema to validate against (JSON)
  --schema-file <path>      Path to schema file
  -e, --environment <env>   Environment context (dev, staging, prod)
  --strict                  Strict mode (treat warnings as errors)
  --execution-ref <id>      Execution reference UUID
  --format <type>           Output format: json (default), pretty, or summary
  -h, --help                Show this help message

ENVIRONMENT:
  RUVECTOR_ENDPOINT         RuVector service endpoint (default: http://localhost:8081)
  RUVECTOR_API_KEY          RuVector API key
  RUVECTOR_NAMESPACE        RuVector namespace (default: agents)
  LLM_OBSERVATORY_ENDPOINT  Telemetry endpoint
  TELEMETRY_ENABLED         Enable telemetry (default: true)

EXAMPLES:
  # Validate inline config
  config-validation -c '{"server": {"port": 8080}}'

  # Validate file with environment context
  config-validation -f ./config/production.json -e prod

  # Validate with schema
  config-validation -f config.json --schema-file schema.json --strict

  # Pipe from another command
  cat config.yaml | yq -o json | config-validation --stdin

OUTPUT:
  Returns a DecisionEvent with:
  - agent_id: config-validation-agent
  - decision_type: config_validation
  - outputs: ConfigValidationOutput with findings, readiness assessment
  - confidence: 0.0-1.0
  - constraints_applied: [read_only_analysis, no_modification, ...]

VALIDATION CHECKS:
  - Schema validation (if schema provided)
  - Semantic constraints (ports, URLs, timeouts, memory)
  - Deprecated value detection
  - Security issue detection (secrets, insecure protocols)
  - Configuration conflicts
  - Missing required values
  - Readiness assessment
`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);

    setTimeout(() => {
      if (!data) {
        reject(new Error('No input received on stdin'));
      }
    }, 5000);
  });
}

function formatOutput(result: AgentResult, format: 'json' | 'pretty' | 'summary'): string {
  if (format === 'summary') {
    if (result.status === 'success') {
      const output = result.event.outputs as {
        valid: boolean;
        readiness: { status: string; score: number };
        summary: {
          total_findings: number;
          by_severity: { critical: number; error: number; warning: number; info: number };
        };
      };

      const icon = output.valid ? '✓' : '✗';
      const status = output.readiness.status.toUpperCase();

      let str = `\n${icon} Configuration Validation: ${output.valid ? 'PASSED' : 'FAILED'}\n`;
      str += `  Status: ${status} (score: ${(output.readiness.score * 100).toFixed(0)}%)\n`;
      str += `  Findings: ${output.summary.total_findings} total\n`;
      str += `    Critical: ${output.summary.by_severity.critical}\n`;
      str += `    Error: ${output.summary.by_severity.error}\n`;
      str += `    Warning: ${output.summary.by_severity.warning}\n`;
      str += `    Info: ${output.summary.by_severity.info}\n`;

      return str;
    } else {
      return `✗ Validation Error: ${result.error_message}`;
    }
  }

  if (format === 'pretty') {
    if (result.status === 'success') {
      const output = result.event.outputs as {
        validation_id: string;
        valid: boolean;
        findings: Array<{ path: string; severity: string; message: string; category: string }>;
        readiness: { status: string; score: number; blocking_issues: string[]; warnings: string[] };
        summary: {
          total_findings: number;
          by_severity: { critical: number; error: number; warning: number; info: number };
        };
        metadata: { config_hash: string; validation_duration_ms: number };
      };

      let str = `\n═══════════════════════════════════════════════════════════════\n`;
      str += `  CONFIG VALIDATION AGENT - VALIDATION REPORT\n`;
      str += `═══════════════════════════════════════════════════════════════\n\n`;
      str += `Validation ID: ${output.validation_id}\n`;
      str += `Config Hash: ${output.metadata.config_hash}\n`;
      str += `Duration: ${output.metadata.validation_duration_ms}ms\n`;
      str += `Confidence: ${(result.event.confidence * 100).toFixed(1)}%\n\n`;

      const statusIcon = output.valid ? '✓' : '✗';
      str += `RESULT: ${statusIcon} ${output.valid ? 'VALID' : 'INVALID'}\n`;
      str += `Readiness: ${output.readiness.status.toUpperCase()} (${(output.readiness.score * 100).toFixed(0)}%)\n\n`;

      if (output.findings.length > 0) {
        str += `FINDINGS (${output.summary.total_findings}):\n`;
        str += `───────────────────────────────────────────────────────────────\n`;

        const severityIcon: Record<string, string> = {
          critical: '🔴',
          error: '🟠',
          warning: '🟡',
          info: '🔵',
        };

        for (const finding of output.findings.slice(0, 20)) {
          const icon = severityIcon[finding.severity] || '⚪';
          str += `  ${icon} [${finding.severity.toUpperCase()}] ${finding.path}\n`;
          str += `     ${finding.message}\n`;
          str += `     Category: ${finding.category}\n\n`;
        }

        if (output.findings.length > 20) {
          str += `  ... and ${output.findings.length - 20} more findings\n\n`;
        }
      }

      str += `SUMMARY:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Critical: ${output.summary.by_severity.critical}\n`;
      str += `  Error: ${output.summary.by_severity.error}\n`;
      str += `  Warning: ${output.summary.by_severity.warning}\n`;
      str += `  Info: ${output.summary.by_severity.info}\n\n`;

      if (output.readiness.blocking_issues.length > 0) {
        str += `BLOCKING ISSUES:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const issue of output.readiness.blocking_issues.slice(0, 5)) {
          str += `  • ${issue}\n`;
        }
        str += `\n`;
      }

      str += `CONSTRAINTS APPLIED:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      for (const c of result.event.constraints_applied) {
        str += `  • ${c}\n`;
      }

      str += `\n═══════════════════════════════════════════════════════════════\n`;
      return str;
    } else {
      return `ERROR [${result.error_code}]: ${result.error_message}`;
    }
  }

  return JSON.stringify(result, null, 2);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Build input
  let config: Record<string, unknown>;
  let schema: ConfigValidationInput['schema'];

  try {
    // Load configuration
    if (args.stdin) {
      const stdinData = await readStdin();
      config = JSON.parse(stdinData);
    } else if (args.file) {
      const fileContent = fs.readFileSync(args.file, 'utf8');
      config = JSON.parse(fileContent);
    } else if (args.config) {
      config = JSON.parse(args.config);
    } else {
      console.error('Error: No configuration provided. Use --config, --file, or --stdin');
      console.error('Use --help for usage information.');
      process.exit(1);
    }

    // Load schema if provided
    if (args.schemaFile) {
      const schemaContent = fs.readFileSync(args.schemaFile, 'utf8');
      schema = {
        content: JSON.parse(schemaContent),
        uri: args.schemaFile,
        format: 'json-schema',
      };
    } else if (args.schema) {
      schema = {
        content: JSON.parse(args.schema),
        format: 'json-schema',
      };
    }
  } catch (error) {
    console.error(`Error parsing input: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // Build full input
  const input: ConfigValidationInput = {
    config,
    format: 'json',
    schema,
    context: args.environment ? { environment: args.environment } : undefined,
    options: {
      strict: args.strict || false,
    },
  };

  // Generate execution reference if not provided
  const executionRef = args.executionRef || uuidv4();

  // Create agent dependencies
  const persistence = createRuvectorFromEnv();
  const telemetry = createTelemetryFromEnv();

  // Create and invoke agent
  const agent = new ConfigValidationAgent(persistence, telemetry);

  try {
    // Validate input
    const validatedInput = agent.validateInput(input);

    // Invoke agent
    const result = await agent.invoke(validatedInput, executionRef);

    // Output result
    console.log(formatOutput(result, args.format || 'json'));

    // Exit with appropriate code
    if (result.status === 'success') {
      const output = result.event.outputs as { valid: boolean };
      process.exit(output.valid ? 0 : 1);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(JSON.stringify({
      status: 'error',
      error_code: 'CLI_ERROR',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      execution_ref: executionRef,
      timestamp: new Date().toISOString(),
    }, null, 2));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
