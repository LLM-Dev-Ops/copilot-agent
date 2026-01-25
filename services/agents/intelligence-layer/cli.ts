#!/usr/bin/env node
/**
 * Intelligence Layer Agent CLI - Phase 7 (Layer 2)
 *
 * Usage:
 *   npx ts-node cli.ts --input '{"mode":"explore","objective":{"statement":"...","domain":"...","constraints":[]}}'
 *
 * Environment:
 *   RUVECTOR_ENDPOINT - RuVector service endpoint (default: http://localhost:8081)
 *   RUVECTOR_API_KEY - RuVector API key
 *   RUVECTOR_NAMESPACE - RuVector namespace (default: agents)
 *   LLM_OBSERVATORY_ENDPOINT - Telemetry endpoint
 *   TELEMETRY_ENABLED - Enable/disable telemetry (default: true)
 */

import { v4 as uuidv4 } from 'uuid';
import { IntelligenceLayerAgent } from './intelligence-agent';
import { createTelemetryFromEnv } from './telemetry';
import { createRuvectorFromEnv } from '../planner/ruvector-persistence';
import { IntelligenceLayerInputSchema } from '../contracts';

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let inputJson: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputJson = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // Read from stdin if no --input provided
  if (!inputJson) {
    inputJson = await readStdin();
  }

  if (!inputJson) {
    console.error('Error: No input provided. Use --input or pipe JSON to stdin.');
    printHelp();
    process.exit(1);
  }

  try {
    // Parse and validate input
    const rawInput = JSON.parse(inputJson);
    const input = IntelligenceLayerInputSchema.parse(rawInput);

    // Create dependencies
    const persistence = createRuvectorFromEnv();
    const telemetry = createTelemetryFromEnv();

    // Create agent
    const agent = new IntelligenceLayerAgent(persistence, telemetry);

    // Generate execution reference
    const executionRef = uuidv4();

    console.error(`[Intelligence Layer Agent] Starting execution: ${executionRef}`);
    console.error(`[Intelligence Layer Agent] Mode: ${input.mode}`);
    console.error(`[Intelligence Layer Agent] Objective: ${input.objective.statement}`);

    // Invoke agent
    const result = await agent.invoke(input, executionRef);

    // Output result
    console.log(JSON.stringify(result, null, 2));

    if (result.status === 'success') {
      console.error(`[Intelligence Layer Agent] Success: execution_ref=${executionRef}`);
      process.exit(0);
    } else {
      console.error(`[Intelligence Layer Agent] Error: ${result.error_code} - ${result.error_message}`);
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[Intelligence Layer Agent] Fatal error: ${error.message}`);
      if (error.name === 'ZodError') {
        console.error('Input validation failed. Check your input JSON against the schema.');
      }
    }
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Intelligence Layer Agent - Phase 7 (Layer 2)

USAGE:
  npx ts-node cli.ts --input '<json>'
  echo '<json>' | npx ts-node cli.ts

OPTIONS:
  --input <json>    Input JSON for the agent
  --help, -h        Show this help message

INPUT SCHEMA:
  {
    "mode": "reason" | "simulate" | "explore",
    "objective": {
      "statement": "string (required)",
      "domain": "string (required)",
      "constraints": ["string"],
      "context": {} (optional)
    },
    "prior_hypotheses": [] (optional),
    "prior_simulations": [] (optional),
    "confidence_history": [] (optional),
    "performance_limits": {
      "max_tokens": 2500 (default),
      "max_latency_ms": 5000 (default)
    },
    "reasoning_chain_id": "uuid" (optional)
  }

ENVIRONMENT VARIABLES:
  RUVECTOR_ENDPOINT         RuVector service endpoint
  RUVECTOR_API_KEY          RuVector API key
  RUVECTOR_NAMESPACE        RuVector namespace
  LLM_OBSERVATORY_ENDPOINT  Telemetry endpoint
  TELEMETRY_ENABLED         Enable/disable telemetry

EXAMPLES:
  # Reason mode
  npx ts-node cli.ts --input '{
    "mode": "reason",
    "objective": {
      "statement": "Determine optimal caching strategy",
      "domain": "infrastructure",
      "constraints": ["low-latency", "cost-effective"]
    }
  }'

  # Explore mode with prior hypotheses
  npx ts-node cli.ts --input '{
    "mode": "explore",
    "objective": {
      "statement": "Investigate performance bottleneck",
      "domain": "performance",
      "constraints": []
    }
  }'

ROLE CLARITY:
  - Agents MAY: reason, simulate, explore
  - Agents MUST: emit signals, avoid final decisions

SIGNALS EMITTED:
  - hypothesis_signal
  - simulation_outcome_signal
  - confidence_delta_signal
`);
}

async function readStdin(): Promise<string | undefined> {
  // Check if stdin is a TTY (interactive)
  if (process.stdin.isTTY) {
    return undefined;
  }

  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data.trim() || undefined);
    });
    // Timeout after 100ms if no data
    setTimeout(() => {
      if (!data) resolve(undefined);
    }, 100);
  });
}

main();
