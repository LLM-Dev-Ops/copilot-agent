#!/usr/bin/env node
/**
 * Reflection Agent CLI Endpoint
 *
 * Per Constitution: Must expose a CLI-invokable endpoint.
 *
 * Usage:
 *   npx ts-node cli.ts --events '[...]'
 *   npx ts-node cli.ts --input '{"decision_events": [...]}'
 *   cat events.json | npx ts-node cli.ts --stdin
 */

import { v4 as uuidv4 } from 'uuid';
import { ReflectionAgent } from './reflection-agent';
import { createRuvectorFromEnv } from './ruvector-persistence';
import { createTelemetryFromEnv } from './telemetry';
import { ReflectionInput, AgentResult, DecisionEvent } from '../contracts';

interface CliArgs {
  events?: string;
  input?: string;
  stdin?: boolean;
  executionRef?: string;
  format?: 'json' | 'pretty';
  focusAreas?: string;
  minConfidence?: number;
  help?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = { format: 'json' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--events':
      case '-e':
        result.events = nextArg;
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
      case '-r':
        result.executionRef = nextArg;
        i++;
        break;
      case '--format':
      case '-f':
        result.format = nextArg as 'json' | 'pretty';
        i++;
        break;
      case '--focus':
        result.focusAreas = nextArg;
        i++;
        break;
      case '--min-confidence':
      case '-c':
        result.minConfidence = parseFloat(nextArg);
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
Reflection Agent CLI

Analyze DecisionEvents to extract learning and quality signals.

USAGE:
  reflection-agent --events '[{...}, {...}]'
  reflection-agent --input '{"decision_events": [...], "context": {...}}'
  cat events.json | reflection-agent --stdin

OPTIONS:
  -e, --events <json>         Array of DecisionEvents to analyze
  -i, --input <json>          Full input JSON (ReflectionInput schema)
  --stdin                     Read input from stdin
  -r, --execution-ref <id>    Execution reference UUID (auto-generated if not provided)
  -f, --format <type>         Output format: json (default) or pretty
  --focus <areas>             Focus areas (comma-separated): quality,learning,gaps,outcomes,all
  -c, --min-confidence <n>    Minimum confidence threshold (0.0-1.0, default: 0.5)
  -h, --help                  Show this help message

ENVIRONMENT:
  RUVECTOR_ENDPOINT           RuVector service endpoint (default: http://localhost:8081)
  RUVECTOR_API_KEY            RuVector API key
  RUVECTOR_NAMESPACE          RuVector namespace (default: agents)
  LLM_OBSERVATORY_ENDPOINT    Telemetry endpoint
  TELEMETRY_ENABLED           Enable telemetry (default: true)

EXAMPLES:
  # Analyze events from JSON array
  reflection-agent -e '[{"agent_id": "planner-agent", ...}]'

  # Full input with context
  reflection-agent -i '{"decision_events": [...], "context": {"focus_areas": ["quality"]}}'

  # From file
  cat decision-events.json | reflection-agent --stdin --format pretty

  # Focus on specific areas
  reflection-agent -e '[...]' --focus quality,learning

OUTPUT:
  Returns a DecisionEvent with:
  - agent_id: reflection-agent
  - agent_version: 1.0.0
  - decision_type: reflection_analysis
  - outputs: ReflectionOutput with quality signals, learning signals, gaps
  - confidence: 0.0-1.0
  - constraints_applied: [read_only_analysis, no_behavior_modification, ...]

CONSTITUTION COMPLIANCE:
  This agent:
  - Is stateless at runtime
  - Emits exactly ONE DecisionEvent per invocation
  - Persists ONLY via ruvector-service
  - NEVER modifies behavior
  - NEVER triggers retries
  - NEVER applies optimizations
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
        reflection_id: string;
        events_analyzed: number;
        agents_analyzed: string[];
        summary: {
          overall_quality_score: number;
          total_quality_signals: number;
          total_learning_signals: number;
          total_gaps: number;
          expectations_met_rate: number;
          key_findings: string[];
          improvement_suggestions: string[];
        };
        quality_signals: Array<{ signal_id: string; type: string; value: number; description: string }>;
        learning_signals: Array<{ learning_id: string; category: string; title: string; confidence: number }>;
        gap_analysis: Array<{ gap_id: string; type: string; title: string; impact: string }>;
      };

      let str = `\n`;
      str += `${'='.repeat(70)}\n`;
      str += `  REFLECTION AGENT - ANALYSIS REPORT\n`;
      str += `${'='.repeat(70)}\n\n`;
      str += `Reflection ID: ${output.reflection_id}\n`;
      str += `Confidence: ${(result.event.confidence * 100).toFixed(1)}%\n`;
      str += `Events Analyzed: ${output.events_analyzed}\n`;
      str += `Agents Analyzed: ${output.agents_analyzed.join(', ')}\n\n`;

      str += `SUMMARY\n`;
      str += `${'-'.repeat(70)}\n`;
      str += `  Overall Quality Score: ${(output.summary.overall_quality_score * 100).toFixed(1)}%\n`;
      str += `  Expectations Met Rate: ${(output.summary.expectations_met_rate * 100).toFixed(1)}%\n`;
      str += `  Quality Signals: ${output.summary.total_quality_signals}\n`;
      str += `  Learning Signals: ${output.summary.total_learning_signals}\n`;
      str += `  Gaps Identified: ${output.summary.total_gaps}\n\n`;

      if (output.summary.key_findings.length > 0) {
        str += `KEY FINDINGS\n`;
        str += `${'-'.repeat(70)}\n`;
        output.summary.key_findings.forEach(f => {
          str += `  - ${f}\n`;
        });
        str += `\n`;
      }

      if (output.quality_signals.length > 0) {
        str += `QUALITY SIGNALS (${output.quality_signals.length})\n`;
        str += `${'-'.repeat(70)}\n`;
        output.quality_signals.forEach(s => {
          str += `  [${s.signal_id}] ${s.type.toUpperCase()}: ${(s.value * 100).toFixed(0)}%\n`;
          str += `    ${s.description}\n\n`;
        });
      }

      if (output.learning_signals.length > 0) {
        str += `LEARNING SIGNALS (${output.learning_signals.length})\n`;
        str += `${'-'.repeat(70)}\n`;
        output.learning_signals.forEach(s => {
          str += `  [${s.learning_id}] ${s.category.toUpperCase()}: ${s.title}\n`;
          str += `    Confidence: ${(s.confidence * 100).toFixed(0)}%\n\n`;
        });
      }

      if (output.gap_analysis.length > 0) {
        str += `GAPS IDENTIFIED (${output.gap_analysis.length})\n`;
        str += `${'-'.repeat(70)}\n`;
        output.gap_analysis.forEach(g => {
          str += `  [${g.gap_id}] ${g.type.toUpperCase()} (${g.impact}): ${g.title}\n\n`;
        });
      }

      if (output.summary.improvement_suggestions.length > 0) {
        str += `IMPROVEMENT SUGGESTIONS\n`;
        str += `${'-'.repeat(70)}\n`;
        output.summary.improvement_suggestions.forEach(s => {
          str += `  - ${s}\n`;
        });
        str += `\n`;
      }

      str += `CONSTRAINTS APPLIED\n`;
      str += `${'-'.repeat(70)}\n`;
      result.event.constraints_applied.forEach(c => {
        str += `  - ${c}\n`;
      });

      str += `\n${'='.repeat(70)}\n`;
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
  let input: ReflectionInput;

  try {
    if (args.stdin) {
      const stdinData = await readStdin();
      const parsed = JSON.parse(stdinData);

      // If stdin contains just an array of events, wrap it
      if (Array.isArray(parsed)) {
        input = { decision_events: parsed as DecisionEvent[] };
      } else {
        input = parsed;
      }
    } else if (args.input) {
      input = JSON.parse(args.input);
    } else if (args.events) {
      const events = JSON.parse(args.events) as DecisionEvent[];
      input = { decision_events: events };
    } else {
      console.error('Error: No input provided. Use --events, --input, or --stdin');
      console.error('Use --help for usage information.');
      process.exit(1);
    }

    // Apply CLI overrides
    if (args.focusAreas) {
      const focusAreas = args.focusAreas.split(',').map(a => a.trim()) as Array<'quality' | 'learning' | 'gaps' | 'outcomes' | 'all'>;
      input.context = { ...input.context, focus_areas: focusAreas };
    }

    if (args.minConfidence !== undefined) {
      input.preferences = {
        min_confidence: args.minConfidence,
        max_signals_per_category: input.preferences?.max_signals_per_category ?? 10,
        include_evidence: input.preferences?.include_evidence ?? true,
        correlate_events: input.preferences?.correlate_events ?? true,
      };
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
  const agent = new ReflectionAgent(persistence, telemetry);

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
