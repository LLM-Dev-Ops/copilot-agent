#!/usr/bin/env node
/**
 * Objective Clarifier Agent CLI Endpoint
 *
 * Per Constitution: Must expose a CLI-invokable endpoint.
 *
 * Usage:
 *   npx ts-node cli.ts --objective "Build a user authentication system"
 *   npx ts-node cli.ts --input '{"objective": "...", "context": {...}}'
 *   cat input.json | npx ts-node cli.ts --stdin
 */

import { v4 as uuidv4 } from 'uuid';
import { ObjectiveClarifierAgent } from './objective-clarifier-agent';
import { createRuvectorFromEnv } from './ruvector-persistence';
import { createTelemetryFromEnv } from './telemetry';
import { AgentResult } from '../contracts';
import { ObjectiveClarifierInput, ObjectiveClarifierOutput } from '../contracts/objective-clarifier-schemas';

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
Objective Clarifier Agent CLI

Clarify ambiguous or incomplete objectives by identifying ambiguities,
missing constraints, and normalizing goals.

USAGE:
  objective-clarifier --objective "Build a user authentication system"
  objective-clarifier --input '{"objective": "...", "context": {...}}'
  cat input.json | objective-clarifier --stdin

OPTIONS:
  -o, --objective <text>    Simple objective string
  -i, --input <json>        Full input JSON (ObjectiveClarifierInput schema)
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
  objective-clarifier -o "Create a REST API for user management"

  # Full input with context
  objective-clarifier -i '{"objective": "Build auth", "context": {"domain": "security"}}'

  # From file
  cat clarify-request.json | objective-clarifier --stdin

  # Pretty output
  objective-clarifier -o "Build something fast with many features" -f pretty

OUTPUT:
  Returns a DecisionEvent with:
  - agent_id: objective-clarifier-agent
  - agent_version: 1.0.0
  - decision_type: objective_clarification
  - outputs: ObjectiveClarifierOutput with ambiguities, constraints, normalized goals
  - confidence: 0.0-1.0
  - constraints_applied: [read_only_analysis, no_plan_generation, ...]
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
      const output = result.event.outputs as ObjectiveClarifierOutput;

      let str = `\n═══════════════════════════════════════════════════════════════\n`;
      str += `  OBJECTIVE CLARIFIER AGENT - ANALYSIS RESULTS\n`;
      str += `═══════════════════════════════════════════════════════════════\n\n`;
      str += `Clarification ID: ${output.clarification_id}\n`;
      str += `Status: ${output.status.toUpperCase()}\n`;
      str += `Confidence: ${(result.event.confidence * 100).toFixed(1)}%\n\n`;

      str += `ORIGINAL OBJECTIVE:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  ${output.original_objective}\n\n`;

      if (output.clarified_objective.statement !== output.original_objective) {
        str += `CLARIFIED OBJECTIVE:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        str += `  ${output.clarified_objective.statement}\n`;
        str += `  Confidence: ${(output.clarified_objective.confidence * 100).toFixed(1)}%\n\n`;
      }

      str += `ANALYSIS METRICS:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Clarity Score:      ${(output.analysis.clarity_score * 100).toFixed(1)}%\n`;
      str += `  Completeness Score: ${(output.analysis.completeness_score * 100).toFixed(1)}%\n`;
      str += `  Complexity:         ${output.analysis.complexity}\n`;
      str += `  Word Count:         ${output.analysis.word_count}\n\n`;

      if (output.ambiguities.length > 0) {
        str += `AMBIGUITIES DETECTED (${output.ambiguities.length}):\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const amb of output.ambiguities) {
          str += `  [${amb.severity.toUpperCase()}] ${amb.type}: ${amb.description}\n`;
          str += `    Source: "${amb.source_text}"\n`;
          str += `    Question: ${amb.clarification_prompt}\n\n`;
        }
      }

      if (output.missing_constraints.length > 0) {
        str += `MISSING CONSTRAINTS (${output.missing_constraints.length}):\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const constraint of output.missing_constraints) {
          str += `  [${constraint.severity.toUpperCase()}] ${constraint.category}: ${constraint.description}\n`;
          str += `    Impact: ${constraint.impact}\n`;
          str += `    Question: ${constraint.clarification_prompt}\n\n`;
        }
      }

      if (output.normalized_goals.length > 0) {
        str += `NORMALIZED GOALS (${output.normalized_goals.length}):\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const goal of output.normalized_goals) {
          str += `  ${goal.goal_id}. [${goal.type}] ${goal.statement}\n`;
          str += `    Action: ${goal.action} | Subject: ${goal.subject}\n`;
          str += `    Confidence: ${(goal.confidence * 100).toFixed(1)}%\n\n`;
        }
      }

      if (output.clarification_questions.length > 0) {
        str += `CLARIFICATION QUESTIONS (Priority Order):\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (let i = 0; i < output.clarification_questions.length; i++) {
          const q = output.clarification_questions[i];
          str += `  ${i + 1}. [${q.priority.toUpperCase()}] ${q.question}\n`;
        }
        str += '\n';
      }

      if (output.clarified_objective.assumptions.length > 0) {
        str += `ASSUMPTIONS MADE:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const assumption of output.clarified_objective.assumptions) {
          str += `  • ${assumption}\n`;
        }
        str += '\n';
      }

      if (output.clarified_objective.unresolved.length > 0) {
        str += `UNRESOLVED ISSUES:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const unresolved of output.clarified_objective.unresolved) {
          str += `  ⚠ ${unresolved}\n`;
        }
        str += '\n';
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
  let input: ObjectiveClarifierInput;

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
  const agent = new ObjectiveClarifierAgent(persistence, telemetry);

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
