#!/usr/bin/env node
/**
 * Planner Agent CLI Endpoint
 *
 * Per Constitution: Must expose a CLI-invokable endpoint.
 *
 * Usage:
 *   npx ts-node cli.ts --objective "Build a user authentication system"
 *   npx ts-node cli.ts --input '{"objective": "..."}'
 *   cat input.json | npx ts-node cli.ts --stdin
 */

import { v4 as uuidv4 } from 'uuid';
import { PlannerAgent } from './planner-agent';
import { createRuvectorFromEnv } from './ruvector-persistence';
import { createTelemetryFromEnv } from './telemetry';
import { PlannerInput, AgentResult } from '../contracts';

interface CliArgs {
  objective?: string;
  input?: string;
  stdin?: boolean;
  executionRef?: string;
  format?: 'json' | 'pretty';
  help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = { format: 'json' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--objective':
      case '-o':
        result.objective = nextArg;
        i++;
        break;
      case '--input':
      case '-i':
        result.input = nextArg;
        i++;
        break;
      case '--stdin':
        result.stdin = true;
        break;
      case '--execution-ref':
      case '-e':
        result.executionRef = nextArg;
        i++;
        break;
      case '--format':
      case '-f':
        result.format = nextArg as 'json' | 'pretty';
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
Planner Agent CLI

Translate clarified objectives into structured execution plans.

USAGE:
  planner-agent --objective "Build a user authentication system"
  planner-agent --input '{"objective": "...", "context": {...}}'
  cat input.json | planner-agent --stdin

OPTIONS:
  -o, --objective <text>    Simple objective string
  -i, --input <json>        Full input JSON (PlannerInput schema)
  --stdin                   Read input from stdin
  -e, --execution-ref <id>  Execution reference UUID (auto-generated if not provided)
  -f, --format <type>       Output format: json (default) or pretty
  -h, --help                Show this help message

ENVIRONMENT:
  RUVECTOR_ENDPOINT         RuVector service endpoint (default: http://localhost:8081)
  RUVECTOR_API_KEY          RuVector API key
  RUVECTOR_NAMESPACE        RuVector namespace (default: agents)
  LLM_OBSERVATORY_ENDPOINT  Telemetry endpoint
  TELEMETRY_ENABLED         Enable telemetry (default: true)

EXAMPLES:
  # Simple objective
  planner-agent -o "Create a REST API for user management"

  # Full input with context
  planner-agent -i '{"objective": "Build auth", "context": {"domain": "security"}}'

  # From file
  cat plan-request.json | planner-agent --stdin

OUTPUT:
  Returns a DecisionEvent with:
  - agent_id: planner-agent
  - agent_version: 1.0.0
  - decision_type: plan_generation
  - outputs: PlannerOutput with steps, dependencies, critical path
  - confidence: 0.0-1.0
  - constraints_applied: [read_only_analysis, no_execution, ...]
`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);

    // Timeout after 5 seconds if no input
    setTimeout(() => {
      if (!data) {
        reject(new Error('No input received on stdin'));
      }
    }, 5000);
  });
}

function formatOutput(result: AgentResult, format: 'json' | 'pretty'): string {
  if (format === 'pretty') {
    if (result.status === 'success') {
      const output = result.event.outputs as {
        plan_id: string;
        objective_summary: string;
        steps: Array<{ step_id: string; name: string; description: string; sequence_order: number }>;
        critical_path: string[];
        analysis: { total_steps: number; max_depth: number; parallel_opportunities: number };
      };

      let str = `\n═══════════════════════════════════════════════════════════════\n`;
      str += `  PLANNER AGENT - EXECUTION PLAN\n`;
      str += `═══════════════════════════════════════════════════════════════\n\n`;
      str += `Plan ID: ${output.plan_id}\n`;
      str += `Confidence: ${(result.event.confidence * 100).toFixed(1)}%\n`;
      str += `Objective: ${output.objective_summary}\n\n`;

      str += `STEPS (${output.analysis.total_steps}):\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      for (const step of output.steps) {
        str += `  ${step.sequence_order + 1}. [${step.step_id}] ${step.name}\n`;
        str += `     ${step.description}\n\n`;
      }

      str += `CRITICAL PATH:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  ${output.critical_path.join(' → ')}\n\n`;

      str += `ANALYSIS:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Max Depth: ${output.analysis.max_depth}\n`;
      str += `  Parallel Opportunities: ${output.analysis.parallel_opportunities}\n\n`;

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
  let input: PlannerInput;

  try {
    if (args.stdin) {
      const stdinData = await readStdin();
      input = JSON.parse(stdinData);
    } else if (args.input) {
      input = JSON.parse(args.input);
    } else if (args.objective) {
      input = { objective: args.objective };
    } else {
      console.error('Error: No input provided. Use --objective, --input, or --stdin');
      console.error('Use --help for usage information.');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error parsing input: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // Generate execution reference if not provided
  const executionRef = args.executionRef || uuidv4();

  // Create agent dependencies
  const persistence = createRuvectorFromEnv();
  const telemetry = createTelemetryFromEnv();

  // Create and invoke agent
  const agent = new PlannerAgent(persistence, telemetry);

  try {
    // Validate input
    const validatedInput = agent.validateInput(input);

    // Invoke agent
    const result = await agent.invoke(validatedInput, executionRef);

    // Output result
    console.log(formatOutput(result, args.format || 'json'));

    // Exit with appropriate code
    process.exit(result.status === 'success' ? 0 : 1);
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
