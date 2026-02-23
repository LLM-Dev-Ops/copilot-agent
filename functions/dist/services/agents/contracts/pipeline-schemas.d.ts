/**
 * Pipeline Orchestration Schemas
 *
 * Types for multi-agent pipeline orchestration.
 * Used by the decomposer to produce execution plans and by all agents
 * to accept/echo pipeline context for traceability.
 */
import { z } from 'zod';
/**
 * The full Agentics domain registry. The decomposer uses this to route
 * pipeline steps to the correct domain + agent.
 */
export declare const DOMAIN_REGISTRY: {
    readonly copilot: {
        readonly agents: readonly ["planner", "config", "decomposer", "clarifier", "intent", "reflection", "meta-reasoner"];
    };
    readonly forge: {
        readonly agents: readonly ["sdk", "scaffold", "template"];
    };
    readonly runtime: {
        readonly agents: readonly ["executor", "sandbox", "wasm"];
    };
    readonly data: {
        readonly agents: readonly ["ingest", "transform", "query"];
    };
    readonly auth: {
        readonly agents: readonly ["identity", "rbac", "token"];
    };
    readonly observability: {
        readonly agents: readonly ["metrics", "trace", "log"];
    };
    readonly deploy: {
        readonly agents: readonly ["ci", "cd", "rollback"];
    };
    readonly test: {
        readonly agents: readonly ["unit", "integration", "e2e"];
    };
    readonly docs: {
        readonly agents: readonly ["generate", "index", "search"];
    };
    readonly security: {
        readonly agents: readonly ["scan", "audit", "compliance"];
    };
    readonly ml: {
        readonly agents: readonly ["train", "inference", "evaluate"];
    };
    readonly search: {
        readonly agents: readonly ["index", "query", "rank"];
    };
    readonly storage: {
        readonly agents: readonly ["blob", "cache", "archive"];
    };
    readonly messaging: {
        readonly agents: readonly ["pubsub", "queue", "stream"];
    };
    readonly gateway: {
        readonly agents: readonly ["route", "ratelimit", "transform"];
    };
    readonly workflow: {
        readonly agents: readonly ["orchestrate", "schedule", "retry"];
    };
    readonly ui: {
        readonly agents: readonly ["component", "layout", "theme"];
    };
    readonly analytics: {
        readonly agents: readonly ["collect", "aggregate", "report"];
    };
    readonly billing: {
        readonly agents: readonly ["meter", "invoice", "plan"];
    };
    readonly notification: {
        readonly agents: readonly ["email", "push", "webhook"];
    };
    readonly migration: {
        readonly agents: readonly ["schema", "data", "rollback"];
    };
    readonly config: {
        readonly agents: readonly ["validate", "distribute", "version"];
    };
    readonly secret: {
        readonly agents: readonly ["vault", "rotate", "inject"];
    };
    readonly edge: {
        readonly agents: readonly ["cdn", "function", "cache"];
    };
    readonly compliance: {
        readonly agents: readonly ["gdpr", "hipaa", "soc2"];
    };
    readonly i18n: {
        readonly agents: readonly ["translate", "locale", "format"];
    };
    readonly devtools: {
        readonly agents: readonly ["lint", "format", "debug"];
    };
};
export type DomainName = keyof typeof DOMAIN_REGISTRY;
export declare const DOMAIN_NAMES: DomainName[];
export declare const PipelineStepSchema: z.ZodObject<{
    /** Step identifier within the pipeline */
    step_id: z.ZodString;
    /** Target domain from the 27-domain registry */
    domain: z.ZodString;
    /** Target agent within the domain */
    agent: z.ZodString;
    /** Human-readable description of what this step does */
    description: z.ZodString;
    /** step_id of the step whose output feeds into this step (null if no dependency) */
    input_from: z.ZodNullable<z.ZodString>;
    /** Label for the expected output artifact type */
    output_schema: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    step_id: string;
    domain: string;
    agent: string;
    input_from: string | null;
    output_schema: string;
}, {
    description: string;
    step_id: string;
    domain: string;
    agent: string;
    input_from: string | null;
    output_schema: string;
}>;
export type PipelineStep = z.infer<typeof PipelineStepSchema>;
export declare const PipelineSpecSchema: z.ZodObject<{
    /** Unique plan identifier */
    plan_id: z.ZodString;
    /** Ordered list of execution steps */
    steps: z.ZodArray<z.ZodObject<{
        /** Step identifier within the pipeline */
        step_id: z.ZodString;
        /** Target domain from the 27-domain registry */
        domain: z.ZodString;
        /** Target agent within the domain */
        agent: z.ZodString;
        /** Human-readable description of what this step does */
        description: z.ZodString;
        /** step_id of the step whose output feeds into this step (null if no dependency) */
        input_from: z.ZodNullable<z.ZodString>;
        /** Label for the expected output artifact type */
        output_schema: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description: string;
        step_id: string;
        domain: string;
        agent: string;
        input_from: string | null;
        output_schema: string;
    }, {
        description: string;
        step_id: string;
        domain: string;
        agent: string;
        input_from: string | null;
        output_schema: string;
    }>, "many">;
    /** Pipeline metadata */
    metadata: z.ZodObject<{
        /** Original NL query that triggered decomposition */
        source_query: z.ZodString;
        /** ISO timestamp of pipeline creation */
        created_at: z.ZodString;
        /** Number of steps in the pipeline */
        estimated_steps: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        source_query: string;
        created_at: string;
        estimated_steps: number;
    }, {
        source_query: string;
        created_at: string;
        estimated_steps: number;
    }>;
}, "strip", z.ZodTypeAny, {
    plan_id: string;
    steps: {
        description: string;
        step_id: string;
        domain: string;
        agent: string;
        input_from: string | null;
        output_schema: string;
    }[];
    metadata: {
        source_query: string;
        created_at: string;
        estimated_steps: number;
    };
}, {
    plan_id: string;
    steps: {
        description: string;
        step_id: string;
        domain: string;
        agent: string;
        input_from: string | null;
        output_schema: string;
    }[];
    metadata: {
        source_query: string;
        created_at: string;
        estimated_steps: number;
    };
}>;
export type PipelineSpec = z.infer<typeof PipelineSpecSchema>;
export declare const PipelineStepRefSchema: z.ZodObject<{
    step_id: z.ZodString;
    domain: z.ZodString;
    agent: z.ZodString;
    output: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    step_id: string;
    domain: string;
    agent: string;
    output?: unknown;
}, {
    step_id: string;
    domain: string;
    agent: string;
    output?: unknown;
}>;
export type PipelineStepRef = z.infer<typeof PipelineStepRefSchema>;
export declare const PipelineContextSchema: z.ZodObject<{
    /** Pipeline plan ID */
    plan_id: z.ZodString;
    /** Current step being executed */
    step_id: z.ZodString;
    /** Outputs from previously completed steps */
    previous_steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        step_id: z.ZodString;
        domain: z.ZodString;
        agent: z.ZodString;
        output: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        step_id: string;
        domain: string;
        agent: string;
        output?: unknown;
    }, {
        step_id: string;
        domain: string;
        agent: string;
        output?: unknown;
    }>, "many">>;
    /** Execution-level metadata */
    execution_metadata: z.ZodOptional<z.ZodObject<{
        trace_id: z.ZodString;
        initiated_by: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        trace_id: string;
        initiated_by: string;
    }, {
        trace_id: string;
        initiated_by: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    step_id: string;
    plan_id: string;
    previous_steps: {
        step_id: string;
        domain: string;
        agent: string;
        output?: unknown;
    }[];
    execution_metadata?: {
        trace_id: string;
        initiated_by: string;
    } | undefined;
}, {
    step_id: string;
    plan_id: string;
    previous_steps?: {
        step_id: string;
        domain: string;
        agent: string;
        output?: unknown;
    }[] | undefined;
    execution_metadata?: {
        trace_id: string;
        initiated_by: string;
    } | undefined;
}>;
export type PipelineContext = z.infer<typeof PipelineContextSchema>;
