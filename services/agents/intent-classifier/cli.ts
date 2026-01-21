#!/usr/bin/env node
/**
 * Intent Classifier Agent CLI Endpoint
 *
 * Per Constitution: Must expose a CLI-invokable endpoint.
 *
 * Usage:
 *   npx ts-node cli.ts --text "Create a new user account"
 *   npx ts-node cli.ts --input '{"text": "...", "context": {...}}'
 *   cat input.json | npx ts-node cli.ts --stdin
 */

import { v4 as uuidv4 } from 'uuid';
import { IntentClassifierAgent } from './intent-classifier-agent';
import { createRuvectorFromEnv } from '../planner/ruvector-persistence';
import { Telemetry } from '../planner/telemetry';
import { IntentClassifierInput, AgentResult } from '../contracts';

interface CliArgs {
  text?: string;
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
      case '--text':
      case '-t':
        result.text = nextArg;
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
Intent Classifier Agent CLI

Classify user or system intent to guide downstream reasoning.

USAGE:
  intent-classifier --text "Create a new user account"
  intent-classifier --input '{"text": "...", "context": {...}}'
  cat input.json | intent-classifier --stdin

OPTIONS:
  -t, --text <text>           Text to classify
  -i, --input <json>          Full input JSON (IntentClassifierInput schema)
  --stdin                     Read input from stdin
  -e, --execution-ref <id>    Execution reference UUID (auto-generated if not provided)
  -f, --format <type>         Output format: json (default) or pretty
  -h, --help                  Show this help message

ENVIRONMENT:
  RUVECTOR_ENDPOINT           RuVector service endpoint (default: http://localhost:8081)
  RUVECTOR_API_KEY            RuVector API key
  RUVECTOR_NAMESPACE          RuVector namespace (default: agents)
  LLM_OBSERVATORY_ENDPOINT    Telemetry endpoint
  TELEMETRY_ENABLED           Enable telemetry (default: true)

EXAMPLES:
  # Simple text classification
  intent-classifier -t "Please create a new project for me"

  # Full input with context
  intent-classifier -i '{"text": "find user", "context": {"domain": "user-management"}}'

  # From file
  cat classify-request.json | intent-classifier --stdin

  # Pretty output
  intent-classifier -t "What is the status of my order?" -f pretty

OUTPUT:
  Returns a DecisionEvent with:
  - agent_id: intent-classifier-agent
  - agent_version: 1.0.0
  - decision_type: intent_classification
  - outputs: IntentClassifierOutput with primary_intent, secondary_intents, multi_intent_state
  - confidence: 0.0-1.0
  - constraints_applied: [read_only_analysis, no_workflow_triggering, ...]
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
        classification_id: string;
        original_text: string;
        primary_intent: {
          intent_type: string;
          confidence: number;
          signals: Array<{ signal_type: string; matched_text: string }>;
        };
        secondary_intents: Array<{
          intent_type: string;
          confidence: number;
        }>;
        multi_intent_state: {
          is_multi_intent: boolean;
          relationship: string;
        };
        overall_confidence: number;
        analysis: {
          intent_count: number;
          signal_count: number;
          notes: string[];
          ambiguity: {
            is_ambiguous: boolean;
            ambiguity_type: string;
            clarification_needed: boolean;
            suggested_clarification?: string;
          };
        };
      };

      let str = `\n═══════════════════════════════════════════════════════════════\n`;
      str += `  INTENT CLASSIFIER AGENT - CLASSIFICATION RESULT\n`;
      str += `═══════════════════════════════════════════════════════════════\n\n`;
      str += `Classification ID: ${output.classification_id}\n`;
      str += `Overall Confidence: ${(output.overall_confidence * 100).toFixed(1)}%\n`;
      str += `Input: "${output.original_text}"\n\n`;

      str += `PRIMARY INTENT:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Type: ${output.primary_intent.intent_type.toUpperCase()}\n`;
      str += `  Confidence: ${(output.primary_intent.confidence * 100).toFixed(1)}%\n`;
      str += `  Signals:\n`;
      for (const signal of output.primary_intent.signals.slice(0, 5)) {
        str += `    • [${signal.signal_type}] "${signal.matched_text}"\n`;
      }
      str += `\n`;

      if (output.secondary_intents.length > 0) {
        str += `SECONDARY INTENTS:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const intent of output.secondary_intents.slice(0, 3)) {
          str += `  • ${intent.intent_type}: ${(intent.confidence * 100).toFixed(1)}%\n`;
        }
        str += `\n`;
      }

      if (output.multi_intent_state.is_multi_intent) {
        str += `MULTI-INTENT STATE:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        str += `  Multiple intents: Yes\n`;
        str += `  Relationship: ${output.multi_intent_state.relationship}\n\n`;
      }

      str += `ANALYSIS:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Intents detected: ${output.analysis.intent_count}\n`;
      str += `  Signals identified: ${output.analysis.signal_count}\n`;
      str += `  Ambiguous: ${output.analysis.ambiguity.is_ambiguous ? 'Yes' : 'No'}\n`;
      if (output.analysis.ambiguity.is_ambiguous) {
        str += `  Ambiguity type: ${output.analysis.ambiguity.ambiguity_type}\n`;
        if (output.analysis.ambiguity.suggested_clarification) {
          str += `  Suggested: ${output.analysis.ambiguity.suggested_clarification}\n`;
        }
      }
      str += `\n`;

      if (output.analysis.notes.length > 0) {
        str += `NOTES:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const note of output.analysis.notes) {
          str += `  • ${note}\n`;
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

/**
 * Create telemetry configured for intent-classifier
 */
function createTelemetryForIntentClassifier(): Telemetry {
  return new Telemetry({
    endpoint: process.env.LLM_OBSERVATORY_ENDPOINT,
    serviceName: 'intent-classifier-agent',
    serviceVersion: '1.0.0',
    enabled: process.env.TELEMETRY_ENABLED !== 'false',
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Build input
  let input: IntentClassifierInput;

  try {
    if (args.stdin) {
      const stdinData = await readStdin();
      input = JSON.parse(stdinData);
    } else if (args.input) {
      input = JSON.parse(args.input);
    } else if (args.text) {
      input = { text: args.text };
    } else {
      console.error('Error: No input provided. Use --text, --input, or --stdin');
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
  const telemetry = createTelemetryForIntentClassifier();

  // Create and invoke agent
  const agent = new IntentClassifierAgent(persistence, telemetry);

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
