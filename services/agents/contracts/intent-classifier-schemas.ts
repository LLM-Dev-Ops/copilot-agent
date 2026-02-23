/**
 * Intent Classifier Agent Schemas
 *
 * Purpose: Classify user or system intent to guide downstream reasoning
 * Classification: INTENT_ANALYSIS
 * decision_type: intent_classification
 *
 * Scope:
 * - Classify intent type
 * - Detect multi-intent states
 * - Assign confidence scores
 *
 * Must Never:
 * - Trigger workflows
 * - Route execution
 * - Enforce policy
 */

import { z } from 'zod';
import { PipelineContextSchema } from './pipeline-schemas';

/**
 * Intent Type enum - categories of user/system intent
 */
export const IntentType = {
  // Information seeking
  QUERY: 'query',                         // User seeking information
  SEARCH: 'search',                       // User searching for something
  EXPLAIN: 'explain',                     // User wants explanation

  // Action requests
  CREATE: 'create',                       // User wants to create something
  UPDATE: 'update',                       // User wants to modify something
  DELETE: 'delete',                       // User wants to remove something
  EXECUTE: 'execute',                     // User wants to run/execute something

  // Navigation/Flow
  NAVIGATE: 'navigate',                   // User wants to go somewhere
  CANCEL: 'cancel',                       // User wants to abort operation
  CONFIRM: 'confirm',                     // User confirming action
  UNDO: 'undo',                           // User wants to reverse action

  // Conversational
  GREETING: 'greeting',                   // User greeting
  FAREWELL: 'farewell',                   // User ending conversation
  FEEDBACK: 'feedback',                   // User providing feedback
  HELP: 'help',                           // User needs assistance

  // System
  CONFIGURE: 'configure',                 // User wants to change settings
  AUTHENTICATE: 'authenticate',           // User authentication intent
  AUTHORIZE: 'authorize',                 // User authorization intent

  // Complex
  COMPOUND: 'compound',                   // Multiple intents detected
  AMBIGUOUS: 'ambiguous',                 // Intent unclear
  UNKNOWN: 'unknown',                     // Cannot determine intent
} as const;

export type IntentTypeValue = typeof IntentType[keyof typeof IntentType];

/**
 * Intent Signal - evidence supporting an intent classification
 */
export const IntentSignalSchema = z.object({
  /** Type of signal detected */
  signal_type: z.enum([
    'keyword',           // Direct keyword match
    'phrase',            // Phrase pattern match
    'structure',         // Sentence structure analysis
    'context',           // Contextual inference
    'entity',            // Named entity detection
    'sentiment',         // Sentiment analysis
    'syntax',            // Syntactic pattern
  ]),

  /** The matched text or pattern */
  matched_text: z.string(),

  /** Position in input (character offset) */
  position: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }),

  /** Contribution to confidence (0.0-1.0) */
  weight: z.number().min(0).max(1),

  /** Additional signal metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type IntentSignal = z.infer<typeof IntentSignalSchema>;

/**
 * Single classified intent with confidence
 */
export const ClassifiedIntentSchema = z.object({
  /** Intent type */
  intent_type: z.string(),

  /** Confidence score for this intent (0.0-1.0) */
  confidence: z.number().min(0).max(1),

  /** Signals supporting this classification */
  signals: z.array(IntentSignalSchema),

  /** Intent target/object if identified */
  target: z.object({
    type: z.string(),
    value: z.string(),
    normalized: z.string().optional(),
  }).optional(),

  /** Intent action if applicable */
  action: z.object({
    verb: z.string(),
    normalized: z.string(),
    tense: z.enum(['present', 'past', 'future', 'imperative']).optional(),
  }).optional(),

  /** Intent scope/context */
  scope: z.object({
    domain: z.string().optional(),
    subject: z.string().optional(),
    qualifiers: z.array(z.string()).default([]),
  }).optional(),
});

export type ClassifiedIntent = z.infer<typeof ClassifiedIntentSchema>;

/**
 * Multi-intent state when multiple intents are detected
 */
export const MultiIntentStateSchema = z.object({
  /** Whether multiple intents were detected */
  is_multi_intent: z.boolean(),

  /** Relationship between intents */
  relationship: z.enum([
    'sequential',        // Intents are meant to be executed in order
    'conditional',       // One intent depends on another
    'alternative',       // Either/or intents
    'parallel',          // Independent intents
    'nested',            // Intent contains sub-intents
    'clarification',     // Secondary intent clarifies primary
    'none',              // Single intent or no relationship
  ]),

  /** Order of intents if sequential */
  sequence: z.array(z.string()).optional(),

  /** Condition between intents if conditional */
  condition: z.object({
    if_intent: z.string(),
    then_intent: z.string(),
    condition_text: z.string(),
  }).optional(),
});

export type MultiIntentState = z.infer<typeof MultiIntentStateSchema>;

/**
 * Intent Classifier Input Schema
 */
export const IntentClassifierInputSchema = z.object({
  /** Text to classify (user message or system input) */
  text: z.string().min(1).max(50000),

  /** Optional conversation context */
  context: z.object({
    /** Previous messages for context */
    previous_messages: z.array(z.object({
      role: z.enum(['user', 'system', 'assistant']),
      text: z.string(),
    })).optional(),

    /** Current domain/topic */
    domain: z.string().optional(),

    /** Known entities in scope */
    entities: z.array(z.object({
      type: z.string(),
      value: z.string(),
    })).optional(),

    /** Active session state */
    session_state: z.record(z.unknown()).optional(),
  }).optional(),

  /** Classification hints */
  hints: z.object({
    /** Expected intent types to prioritize */
    expected_intents: z.array(z.string()).optional(),

    /** Intents to exclude from consideration */
    excluded_intents: z.array(z.string()).optional(),

    /** Minimum confidence threshold */
    min_confidence: z.number().min(0).max(1).optional(),

    /** Maximum number of intents to return */
    max_intents: z.number().int().positive().max(10).optional(),

    /** Language hint */
    language: z.string().optional(),
  }).optional(),

  /** Request ID for tracing */
  request_id: z.string().uuid().optional(),

  /** Optional pipeline context for multi-agent orchestration */
  pipeline_context: PipelineContextSchema.optional(),
});

export type IntentClassifierInput = z.infer<typeof IntentClassifierInputSchema>;

/**
 * Intent Classifier Output Schema
 */
export const IntentClassifierOutputSchema = z.object({
  /** Classification ID */
  classification_id: z.string().uuid(),

  /** Original text (echoed for verification) */
  original_text: z.string(),

  /** Normalized/cleaned text used for analysis */
  normalized_text: z.string(),

  /** Primary classified intent */
  primary_intent: ClassifiedIntentSchema,

  /** Secondary intents (if multi-intent detected) */
  secondary_intents: z.array(ClassifiedIntentSchema).default([]),

  /** Multi-intent state analysis */
  multi_intent_state: MultiIntentStateSchema,

  /** Overall classification confidence (0.0-1.0) */
  overall_confidence: z.number().min(0).max(1),

  /** Analysis metadata */
  analysis: z.object({
    /** Number of intents detected */
    intent_count: z.number().int().nonnegative(),

    /** Total signals identified */
    signal_count: z.number().int().nonnegative(),

    /** Processing notes */
    notes: z.array(z.string()).default([]),

    /** Ambiguity indicators */
    ambiguity: z.object({
      is_ambiguous: z.boolean(),
      ambiguity_type: z.enum(['lexical', 'structural', 'contextual', 'none']),
      clarification_needed: z.boolean(),
      suggested_clarification: z.string().optional(),
    }),

    /** Language detection */
    language: z.object({
      detected: z.string(),
      confidence: z.number().min(0).max(1),
    }).optional(),
  }),

  /** Version for tracking iterations */
  version: z.string().default('1.0.0'),
});

export type IntentClassifierOutput = z.infer<typeof IntentClassifierOutputSchema>;
