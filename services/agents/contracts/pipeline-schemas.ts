/**
 * Pipeline Orchestration Schemas
 *
 * Types for multi-agent pipeline orchestration.
 * Used by the decomposer to produce execution plans and by all agents
 * to accept/echo pipeline context for traceability.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// 27-Domain Registry
// ---------------------------------------------------------------------------

/**
 * The full Agentics domain registry. The decomposer uses this to route
 * pipeline steps to the correct domain + agent.
 */
export const DOMAIN_REGISTRY = {
  copilot:    { agents: ['planner', 'config', 'decomposer', 'clarifier', 'intent', 'reflection', 'meta-reasoner'] },
  forge:      { agents: ['sdk', 'scaffold', 'template'] },
  runtime:    { agents: ['executor', 'sandbox', 'wasm'] },
  data:       { agents: ['ingest', 'transform', 'query'] },
  auth:       { agents: ['identity', 'rbac', 'token'] },
  observability: { agents: ['metrics', 'trace', 'log'] },
  deploy:     { agents: ['ci', 'cd', 'rollback'] },
  test:       { agents: ['unit', 'integration', 'e2e'] },
  docs:       { agents: ['generate', 'index', 'search'] },
  security:   { agents: ['scan', 'audit', 'compliance'] },
  ml:         { agents: ['train', 'inference', 'evaluate'] },
  search:     { agents: ['index', 'query', 'rank'] },
  storage:    { agents: ['blob', 'cache', 'archive'] },
  messaging:  { agents: ['pubsub', 'queue', 'stream'] },
  gateway:    { agents: ['route', 'ratelimit', 'transform'] },
  workflow:   { agents: ['orchestrate', 'schedule', 'retry'] },
  ui:         { agents: ['component', 'layout', 'theme'] },
  analytics:  { agents: ['collect', 'aggregate', 'report'] },
  billing:    { agents: ['meter', 'invoice', 'plan'] },
  notification: { agents: ['email', 'push', 'webhook'] },
  migration:  { agents: ['schema', 'data', 'rollback'] },
  config:     { agents: ['validate', 'distribute', 'version'] },
  secret:     { agents: ['vault', 'rotate', 'inject'] },
  edge:       { agents: ['cdn', 'function', 'cache'] },
  compliance: { agents: ['gdpr', 'hipaa', 'soc2'] },
  i18n:       { agents: ['translate', 'locale', 'format'] },
  devtools:   { agents: ['lint', 'format', 'debug'] },
} as const;

export type DomainName = keyof typeof DOMAIN_REGISTRY;

export const DOMAIN_NAMES = Object.keys(DOMAIN_REGISTRY) as DomainName[];

// ---------------------------------------------------------------------------
// Pipeline Step (produced by decomposer)
// ---------------------------------------------------------------------------

export const PipelineStepSchema = z.object({
  /** Step identifier within the pipeline */
  step_id: z.string().min(1),

  /** Target domain from the 27-domain registry */
  domain: z.string().min(1),

  /** Target agent within the domain */
  agent: z.string().min(1),

  /** Human-readable description of what this step does */
  description: z.string().min(1),

  /** step_id of the step whose output feeds into this step (null if no dependency) */
  input_from: z.string().nullable(),

  /** Label for the expected output artifact type */
  output_schema: z.string().min(1),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;

// ---------------------------------------------------------------------------
// Pipeline Spec (decomposer output)
// ---------------------------------------------------------------------------

export const PipelineSpecSchema = z.object({
  /** Unique plan identifier */
  plan_id: z.string().uuid(),

  /** Ordered list of execution steps */
  steps: z.array(PipelineStepSchema).min(1),

  /** Pipeline metadata */
  metadata: z.object({
    /** Original NL query that triggered decomposition */
    source_query: z.string(),

    /** ISO timestamp of pipeline creation */
    created_at: z.string().datetime(),

    /** Number of steps in the pipeline */
    estimated_steps: z.number().int().nonnegative(),
  }),
});

export type PipelineSpec = z.infer<typeof PipelineSpecSchema>;

// ---------------------------------------------------------------------------
// Pipeline Context (sent with requests in a pipeline)
// ---------------------------------------------------------------------------

export const PipelineStepRefSchema = z.object({
  step_id: z.string(),
  domain: z.string(),
  agent: z.string(),
  output: z.unknown().optional(),
});

export type PipelineStepRef = z.infer<typeof PipelineStepRefSchema>;

export const PipelineContextSchema = z.object({
  /** Pipeline plan ID */
  plan_id: z.string(),

  /** Current step being executed */
  step_id: z.string(),

  /** Outputs from previously completed steps */
  previous_steps: z.array(PipelineStepRefSchema).default([]),

  /** Execution-level metadata */
  execution_metadata: z.object({
    trace_id: z.string(),
    initiated_by: z.string(),
  }).optional(),
});

export type PipelineContext = z.infer<typeof PipelineContextSchema>;
