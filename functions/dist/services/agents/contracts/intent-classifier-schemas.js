"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentClassifierOutputSchema = exports.IntentClassifierInputSchema = exports.MultiIntentStateSchema = exports.ClassifiedIntentSchema = exports.IntentSignalSchema = exports.IntentType = void 0;
const zod_1 = require("zod");
const pipeline_schemas_1 = require("./pipeline-schemas");
/**
 * Intent Type enum - categories of user/system intent
 */
exports.IntentType = {
    // Information seeking
    QUERY: 'query', // User seeking information
    SEARCH: 'search', // User searching for something
    EXPLAIN: 'explain', // User wants explanation
    // Action requests
    CREATE: 'create', // User wants to create something
    UPDATE: 'update', // User wants to modify something
    DELETE: 'delete', // User wants to remove something
    EXECUTE: 'execute', // User wants to run/execute something
    // Navigation/Flow
    NAVIGATE: 'navigate', // User wants to go somewhere
    CANCEL: 'cancel', // User wants to abort operation
    CONFIRM: 'confirm', // User confirming action
    UNDO: 'undo', // User wants to reverse action
    // Conversational
    GREETING: 'greeting', // User greeting
    FAREWELL: 'farewell', // User ending conversation
    FEEDBACK: 'feedback', // User providing feedback
    HELP: 'help', // User needs assistance
    // System
    CONFIGURE: 'configure', // User wants to change settings
    AUTHENTICATE: 'authenticate', // User authentication intent
    AUTHORIZE: 'authorize', // User authorization intent
    // Complex
    COMPOUND: 'compound', // Multiple intents detected
    AMBIGUOUS: 'ambiguous', // Intent unclear
    UNKNOWN: 'unknown', // Cannot determine intent
};
/**
 * Intent Signal - evidence supporting an intent classification
 */
exports.IntentSignalSchema = zod_1.z.object({
    /** Type of signal detected */
    signal_type: zod_1.z.enum([
        'keyword', // Direct keyword match
        'phrase', // Phrase pattern match
        'structure', // Sentence structure analysis
        'context', // Contextual inference
        'entity', // Named entity detection
        'sentiment', // Sentiment analysis
        'syntax', // Syntactic pattern
    ]),
    /** The matched text or pattern */
    matched_text: zod_1.z.string(),
    /** Position in input (character offset) */
    position: zod_1.z.object({
        start: zod_1.z.number().int().nonnegative(),
        end: zod_1.z.number().int().nonnegative(),
    }),
    /** Contribution to confidence (0.0-1.0) */
    weight: zod_1.z.number().min(0).max(1),
    /** Additional signal metadata */
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/**
 * Single classified intent with confidence
 */
exports.ClassifiedIntentSchema = zod_1.z.object({
    /** Intent type */
    intent_type: zod_1.z.string(),
    /** Confidence score for this intent (0.0-1.0) */
    confidence: zod_1.z.number().min(0).max(1),
    /** Signals supporting this classification */
    signals: zod_1.z.array(exports.IntentSignalSchema),
    /** Intent target/object if identified */
    target: zod_1.z.object({
        type: zod_1.z.string(),
        value: zod_1.z.string(),
        normalized: zod_1.z.string().optional(),
    }).optional(),
    /** Intent action if applicable */
    action: zod_1.z.object({
        verb: zod_1.z.string(),
        normalized: zod_1.z.string(),
        tense: zod_1.z.enum(['present', 'past', 'future', 'imperative']).optional(),
    }).optional(),
    /** Intent scope/context */
    scope: zod_1.z.object({
        domain: zod_1.z.string().optional(),
        subject: zod_1.z.string().optional(),
        qualifiers: zod_1.z.array(zod_1.z.string()).default([]),
    }).optional(),
});
/**
 * Multi-intent state when multiple intents are detected
 */
exports.MultiIntentStateSchema = zod_1.z.object({
    /** Whether multiple intents were detected */
    is_multi_intent: zod_1.z.boolean(),
    /** Relationship between intents */
    relationship: zod_1.z.enum([
        'sequential', // Intents are meant to be executed in order
        'conditional', // One intent depends on another
        'alternative', // Either/or intents
        'parallel', // Independent intents
        'nested', // Intent contains sub-intents
        'clarification', // Secondary intent clarifies primary
        'none', // Single intent or no relationship
    ]),
    /** Order of intents if sequential */
    sequence: zod_1.z.array(zod_1.z.string()).optional(),
    /** Condition between intents if conditional */
    condition: zod_1.z.object({
        if_intent: zod_1.z.string(),
        then_intent: zod_1.z.string(),
        condition_text: zod_1.z.string(),
    }).optional(),
});
/**
 * Intent Classifier Input Schema
 */
exports.IntentClassifierInputSchema = zod_1.z.object({
    /** Text to classify (user message or system input) */
    text: zod_1.z.string().min(1).max(50000),
    /** Optional conversation context */
    context: zod_1.z.object({
        /** Previous messages for context */
        previous_messages: zod_1.z.array(zod_1.z.object({
            role: zod_1.z.enum(['user', 'system', 'assistant']),
            text: zod_1.z.string(),
        })).optional(),
        /** Current domain/topic */
        domain: zod_1.z.string().optional(),
        /** Known entities in scope */
        entities: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.string(),
            value: zod_1.z.string(),
        })).optional(),
        /** Active session state */
        session_state: zod_1.z.record(zod_1.z.unknown()).optional(),
    }).optional(),
    /** Classification hints */
    hints: zod_1.z.object({
        /** Expected intent types to prioritize */
        expected_intents: zod_1.z.array(zod_1.z.string()).optional(),
        /** Intents to exclude from consideration */
        excluded_intents: zod_1.z.array(zod_1.z.string()).optional(),
        /** Minimum confidence threshold */
        min_confidence: zod_1.z.number().min(0).max(1).optional(),
        /** Maximum number of intents to return */
        max_intents: zod_1.z.number().int().positive().max(10).optional(),
        /** Language hint */
        language: zod_1.z.string().optional(),
    }).optional(),
    /** Request ID for tracing */
    request_id: zod_1.z.string().uuid().optional(),
    /** Optional pipeline context for multi-agent orchestration */
    pipeline_context: pipeline_schemas_1.PipelineContextSchema.optional(),
});
/**
 * Intent Classifier Output Schema
 */
exports.IntentClassifierOutputSchema = zod_1.z.object({
    /** Classification ID */
    classification_id: zod_1.z.string().uuid(),
    /** Original text (echoed for verification) */
    original_text: zod_1.z.string(),
    /** Normalized/cleaned text used for analysis */
    normalized_text: zod_1.z.string(),
    /** Primary classified intent */
    primary_intent: exports.ClassifiedIntentSchema,
    /** Secondary intents (if multi-intent detected) */
    secondary_intents: zod_1.z.array(exports.ClassifiedIntentSchema).default([]),
    /** Multi-intent state analysis */
    multi_intent_state: exports.MultiIntentStateSchema,
    /** Overall classification confidence (0.0-1.0) */
    overall_confidence: zod_1.z.number().min(0).max(1),
    /** Analysis metadata */
    analysis: zod_1.z.object({
        /** Number of intents detected */
        intent_count: zod_1.z.number().int().nonnegative(),
        /** Total signals identified */
        signal_count: zod_1.z.number().int().nonnegative(),
        /** Processing notes */
        notes: zod_1.z.array(zod_1.z.string()).default([]),
        /** Ambiguity indicators */
        ambiguity: zod_1.z.object({
            is_ambiguous: zod_1.z.boolean(),
            ambiguity_type: zod_1.z.enum(['lexical', 'structural', 'contextual', 'none']),
            clarification_needed: zod_1.z.boolean(),
            suggested_clarification: zod_1.z.string().optional(),
        }),
        /** Language detection */
        language: zod_1.z.object({
            detected: zod_1.z.string(),
            confidence: zod_1.z.number().min(0).max(1),
        }).optional(),
    }),
    /** Version for tracking iterations */
    version: zod_1.z.string().default('1.0.0'),
});
//# sourceMappingURL=intent-classifier-schemas.js.map