#!/usr/bin/env node
/**
 * Decomposer Agent CLI Endpoint
 *
 * Per Constitution: Must expose a CLI-invokable endpoint.
 *
 * Usage:
 *   npx ts-node cli.ts --objective "Build a distributed system with caching"
 *   npx ts-node cli.ts --input '{"objective": "..."}'
 *   cat input.json | npx ts-node cli.ts --stdin
 */

import { v4 as uuidv4 } from 'uuid';
import { DecomposerAgent } from './decomposer-agent';
import { createRuvectorFromEnv } from '../planner/ruvector-persistence';
import { createTelemetryFromEnv } from '../planner/telemetry';
import { DecomposerInput, AgentResult } from '../contracts';

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
Decomposer Agent CLI

Decompose complex objectives into manageable sub-objectives.

USAGE:
  decomposer-agent --objective "Build a distributed system with caching"
  decomposer-agent --input '{"objective": "...", "context": {...}}'
  cat input.json | decomposer-agent --stdin

OPTIONS:
  -o, --objective <text>    Simple objective string
  -i, --input <json>        Full input JSON (DecomposerInput schema)
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

OUTPUT:
  Returns a DecisionEvent with:
  - agent_id: decomposer-agent
  - agent_version: 1.0.0
  - decision_type: objective_decomposition
  - outputs: DecomposerOutput with sub_objectives, tree_structure, dependency_graph
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
        decomposition_id: string;
        original_objective: string;
        sub_objectives: Array<{ sub_objective_id: string; title: string; description: string; depth: number }>;
        analysis: { total_sub_objectives: number; max_depth_reached: number; coverage_score: number };
      };

      let str = `\n═══════════════════════════════════════════════════════════════\n`;
      str += `  DECOMPOSER AGENT - DECOMPOSITION RESULT\n`;
      str += `═══════════════════════════════════════════════════════════════\n\n`;
      str += `Decomposition ID: ${output.decomposition_id}\n`;
      str += `Confidence: ${(result.event.confidence * 100).toFixed(1)}%\n`;
      str += `Objective: ${output.original_objective}\n\n`;

      str += `SUB-OBJECTIVES (${output.analysis.total_sub_objectives}):\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      for (const sub of output.sub_objectives) {
        const indent = '  '.repeat(sub.depth + 1);
        str += `${indent}[${sub.sub_objective_id}] ${sub.title}\n`;
        str += `${indent}  ${sub.description}\n\n`;
      }

      str += `ANALYSIS:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Max Depth: ${output.analysis.max_depth_reached}\n`;
      str += `  Coverage Score: ${(output.analysis.coverage_score * 100).toFixed(0)}%\n\n`;

      str += `═══════════════════════════════════════════════════════════════\n`;
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

  let input: DecomposerInput;

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

  const executionRef = args.executionRef || uuidv4();

  const persistence = createRuvectorFromEnv();
  const telemetry = createTelemetryFromEnv();

  const agent = new DecomposerAgent(persistence, telemetry);

  try {
    const validatedInput = agent.validateInput(input);
    const result = await agent.invoke(validatedInput, executionRef);
    console.log(formatOutput(result, args.format || 'json'));
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
