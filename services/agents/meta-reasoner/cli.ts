#!/usr/bin/env node
/**
 * Meta-Reasoner Agent CLI Endpoint
 *
 * Per Constitution: Must expose a CLI-invokable endpoint.
 *
 * Usage:
 *   npx ts-node cli.ts --input '{"traces": [...]}'
 *   cat traces.json | npx ts-node cli.ts --stdin
 *   npx ts-node cli.ts --traces-file ./traces.json
 */

import { v4 as uuidv4 } from 'uuid';
import { MetaReasonerAgent } from './meta-reasoner-agent';
import { createRuvectorFromEnv } from '../planner/ruvector-persistence';
import { createTelemetryFromEnv } from './telemetry';
import { MetaReasonerInput, AgentResult, MetaReasonerOutput } from '../contracts';
import * as fs from 'fs';

interface CliArgs {
  input?: string;
  tracesFile?: string;
  stdin?: boolean;
  executionRef?: string;
  format?: 'json' | 'pretty';
  help?: boolean;
  scope?: {
    contradictions?: boolean;
    calibration?: boolean;
    systemic?: boolean;
  };
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = { format: 'json', scope: {} };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--input':
      case '-i':
        result.input = nextArg;
        i++;
        break;
      case '--traces-file':
      case '-t':
        result.tracesFile = nextArg;
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
      case '--no-contradictions':
        result.scope!.contradictions = false;
        break;
      case '--no-calibration':
        result.scope!.calibration = false;
        break;
      case '--no-systemic':
        result.scope!.systemic = false;
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
Meta-Reasoner Agent CLI

Evaluate reasoning quality and consistency across agent traces.

USAGE:
  meta-reasoner-agent --input '{"traces": [...]}'
  meta-reasoner-agent --traces-file ./traces.json
  cat traces.json | meta-reasoner-agent --stdin

OPTIONS:
  -i, --input <json>        Full input JSON (MetaReasonerInput schema)
  -t, --traces-file <path>  Read traces from JSON file
  --stdin                   Read input from stdin
  -e, --execution-ref <id>  Execution reference UUID (auto-generated if not provided)
  -f, --format <type>       Output format: json (default) or pretty
  --no-contradictions       Disable contradiction detection
  --no-calibration          Disable confidence calibration assessment
  --no-systemic             Disable systemic issue detection
  -h, --help                Show this help message

ENVIRONMENT:
  RUVECTOR_ENDPOINT         RuVector service endpoint (default: http://localhost:8081)
  RUVECTOR_API_KEY          RuVector API key
  RUVECTOR_NAMESPACE        RuVector namespace (default: agents)
  LLM_OBSERVATORY_ENDPOINT  Telemetry endpoint
  TELEMETRY_ENABLED         Enable telemetry (default: true)

INPUT SCHEMA (MetaReasonerInput):
  {
    "traces": [
      {
        "agent_id": "string",
        "agent_version": "1.0.0",
        "decision_type": "string",
        "execution_ref": "uuid",
        "timestamp": "ISO-8601",
        "reported_confidence": 0.0-1.0,
        "reasoning_content": {...},
        "constraints_applied": ["..."]
      }
    ],
    "scope": {
      "detect_contradictions": true,
      "assess_confidence_calibration": true,
      "identify_systemic_issues": true
    },
    "context": {
      "domain": "string",
      "historical_accuracy": {"agent_id": 0.85}
    }
  }

EXAMPLES:
  # From JSON file
  meta-reasoner-agent -t ./decision-events.json

  # Full input with context
  meta-reasoner-agent -i '{"traces": [...], "context": {"domain": "security"}}'

  # From stdin
  cat traces.json | meta-reasoner-agent --stdin --format pretty

OUTPUT:
  Returns a DecisionEvent with:
  - agent_id: meta-reasoner-agent
  - agent_version: 1.0.0
  - decision_type: meta_reasoning_analysis
  - outputs: MetaReasonerOutput with contradictions, calibrations, issues
  - confidence: 0.0-1.0
  - constraints_applied: [read_only_analysis, no_output_override, ...]
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
      const output = result.event.outputs as MetaReasonerOutput;

      let str = `\n═══════════════════════════════════════════════════════════════\n`;
      str += `  META-REASONER AGENT - ANALYSIS REPORT\n`;
      str += `═══════════════════════════════════════════════════════════════\n\n`;
      str += `Analysis ID: ${output.analysis_id}\n`;
      str += `Confidence: ${(result.event.confidence * 100).toFixed(1)}%\n\n`;

      str += `SUMMARY:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `${output.summary}\n\n`;

      str += `QUALITY METRICS:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Overall Score:        ${(output.quality_metrics.overall_score * 100).toFixed(1)}%\n`;
      str += `  Consistency:          ${(output.quality_metrics.consistency_score * 100).toFixed(1)}%\n`;
      str += `  Completeness:         ${(output.quality_metrics.completeness_score * 100).toFixed(1)}%\n`;
      str += `  Clarity:              ${(output.quality_metrics.clarity_score * 100).toFixed(1)}%\n`;
      str += `  Constraint Adherence: ${(output.quality_metrics.constraint_adherence_score * 100).toFixed(1)}%\n`;
      str += `  Traces Analyzed:      ${output.quality_metrics.traces_analyzed}\n`;
      str += `  Agents Analyzed:      ${output.quality_metrics.agents_analyzed}\n\n`;

      if (output.contradictions.length > 0) {
        str += `CONTRADICTIONS (${output.contradictions.length}):\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const c of output.contradictions) {
          str += `  [${c.severity.toUpperCase()}] ${c.type}: ${c.description}\n`;
          str += `    Agents: ${c.involved_agents.join(', ')}\n`;
          str += `    Confidence: ${(c.finding_confidence * 100).toFixed(0)}%\n\n`;
        }
      }

      if (output.confidence_calibrations.length > 0) {
        str += `CONFIDENCE CALIBRATIONS:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const cal of output.confidence_calibrations) {
          str += `  ${cal.agent_id}: ${cal.assessment} (score: ${(cal.calibration_score * 100).toFixed(0)}%)\n`;
          str += `    Mean Confidence: ${(cal.mean_reported_confidence * 100).toFixed(1)}%\n`;
          if (cal.calibration_gap !== undefined) {
            str += `    Calibration Gap: ${cal.calibration_gap > 0 ? '+' : ''}${(cal.calibration_gap * 100).toFixed(1)}%\n`;
          }
          if (cal.recommendations.length > 0) {
            str += `    Recommendations:\n`;
            for (const rec of cal.recommendations) {
              str += `      • ${rec}\n`;
            }
          }
          str += '\n';
        }
      }

      if (output.systemic_issues.length > 0) {
        str += `SYSTEMIC ISSUES (${output.systemic_issues.length}):\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const issue of output.systemic_issues) {
          str += `  [${issue.severity.toUpperCase()}] ${issue.type}\n`;
          str += `    ${issue.description}\n`;
          str += `    Frequency: ${issue.frequency}\n`;
          str += `    Impact: ${issue.impact}\n`;
          str += `    Affected Agents: ${issue.affected_agents.join(', ')}\n\n`;
        }
      }

      if (output.key_findings.length > 0) {
        str += `KEY FINDINGS:\n`;
        str += `───────────────────────────────────────────────────────────────\n`;
        for (const finding of output.key_findings) {
          str += `  ${finding.priority}. [${finding.category.toUpperCase()}] ${finding.finding}\n`;
        }
        str += '\n';
      }

      str += `METADATA:\n`;
      str += `───────────────────────────────────────────────────────────────\n`;
      str += `  Total Traces: ${output.analysis_metadata.total_traces}\n`;
      str += `  Unique Agents: ${output.analysis_metadata.unique_agents}\n`;
      str += `  Unique Decision Types: ${output.analysis_metadata.unique_decision_types}\n`;
      if (output.analysis_metadata.time_span) {
        str += `  Time Span: ${output.analysis_metadata.time_span.earliest} to ${output.analysis_metadata.time_span.latest}\n`;
      }

      str += `\nCONSTRAINTS APPLIED:\n`;
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
  let input: MetaReasonerInput;

  try {
    if (args.stdin) {
      const stdinData = await readStdin();
      input = JSON.parse(stdinData);
    } else if (args.input) {
      input = JSON.parse(args.input);
    } else if (args.tracesFile) {
      const fileContent = fs.readFileSync(args.tracesFile, 'utf8');
      const parsed = JSON.parse(fileContent);

      // Support both direct input format and just an array of traces
      if (Array.isArray(parsed)) {
        input = { traces: parsed };
      } else {
        input = parsed;
      }
    } else {
      console.error('Error: No input provided. Use --input, --traces-file, or --stdin');
      console.error('Use --help for usage information.');
      process.exit(1);
    }

    // Apply scope overrides from CLI
    if (args.scope) {
      input.scope = input.scope || {};
      if (args.scope.contradictions === false) {
        input.scope.detect_contradictions = false;
      }
      if (args.scope.calibration === false) {
        input.scope.assess_confidence_calibration = false;
      }
      if (args.scope.systemic === false) {
        input.scope.identify_systemic_issues = false;
      }
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
  const agent = new MetaReasonerAgent(persistence, telemetry);

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
