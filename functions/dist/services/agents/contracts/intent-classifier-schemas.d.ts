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
/**
 * Intent Type enum - categories of user/system intent
 */
export declare const IntentType: {
    readonly QUERY: "query";
    readonly SEARCH: "search";
    readonly EXPLAIN: "explain";
    readonly CREATE: "create";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly EXECUTE: "execute";
    readonly NAVIGATE: "navigate";
    readonly CANCEL: "cancel";
    readonly CONFIRM: "confirm";
    readonly UNDO: "undo";
    readonly GREETING: "greeting";
    readonly FAREWELL: "farewell";
    readonly FEEDBACK: "feedback";
    readonly HELP: "help";
    readonly CONFIGURE: "configure";
    readonly AUTHENTICATE: "authenticate";
    readonly AUTHORIZE: "authorize";
    readonly COMPOUND: "compound";
    readonly AMBIGUOUS: "ambiguous";
    readonly UNKNOWN: "unknown";
};
export type IntentTypeValue = typeof IntentType[keyof typeof IntentType];
/**
 * Intent Signal - evidence supporting an intent classification
 */
export declare const IntentSignalSchema: z.ZodObject<{
    /** Type of signal detected */
    signal_type: z.ZodEnum<["keyword", "phrase", "structure", "context", "entity", "sentiment", "syntax"]>;
    /** The matched text or pattern */
    matched_text: z.ZodString;
    /** Position in input (character offset) */
    position: z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        start: number;
        end: number;
    }, {
        start: number;
        end: number;
    }>;
    /** Contribution to confidence (0.0-1.0) */
    weight: z.ZodNumber;
    /** Additional signal metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
    matched_text: string;
    position: {
        start: number;
        end: number;
    };
    weight: number;
    metadata?: Record<string, unknown> | undefined;
}, {
    signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
    matched_text: string;
    position: {
        start: number;
        end: number;
    };
    weight: number;
    metadata?: Record<string, unknown> | undefined;
}>;
export type IntentSignal = z.infer<typeof IntentSignalSchema>;
/**
 * Single classified intent with confidence
 */
export declare const ClassifiedIntentSchema: z.ZodObject<{
    /** Intent type */
    intent_type: z.ZodString;
    /** Confidence score for this intent (0.0-1.0) */
    confidence: z.ZodNumber;
    /** Signals supporting this classification */
    signals: z.ZodArray<z.ZodObject<{
        /** Type of signal detected */
        signal_type: z.ZodEnum<["keyword", "phrase", "structure", "context", "entity", "sentiment", "syntax"]>;
        /** The matched text or pattern */
        matched_text: z.ZodString;
        /** Position in input (character offset) */
        position: z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            start: number;
            end: number;
        }, {
            start: number;
            end: number;
        }>;
        /** Contribution to confidence (0.0-1.0) */
        weight: z.ZodNumber;
        /** Additional signal metadata */
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
        matched_text: string;
        position: {
            start: number;
            end: number;
        };
        weight: number;
        metadata?: Record<string, unknown> | undefined;
    }, {
        signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
        matched_text: string;
        position: {
            start: number;
            end: number;
        };
        weight: number;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">;
    /** Intent target/object if identified */
    target: z.ZodOptional<z.ZodObject<{
        type: z.ZodString;
        value: z.ZodString;
        normalized: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        type: string;
        normalized?: string | undefined;
    }, {
        value: string;
        type: string;
        normalized?: string | undefined;
    }>>;
    /** Intent action if applicable */
    action: z.ZodOptional<z.ZodObject<{
        verb: z.ZodString;
        normalized: z.ZodString;
        tense: z.ZodOptional<z.ZodEnum<["present", "past", "future", "imperative"]>>;
    }, "strip", z.ZodTypeAny, {
        normalized: string;
        verb: string;
        tense?: "present" | "past" | "future" | "imperative" | undefined;
    }, {
        normalized: string;
        verb: string;
        tense?: "present" | "past" | "future" | "imperative" | undefined;
    }>>;
    /** Intent scope/context */
    scope: z.ZodOptional<z.ZodObject<{
        domain: z.ZodOptional<z.ZodString>;
        subject: z.ZodOptional<z.ZodString>;
        qualifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        qualifiers: string[];
        domain?: string | undefined;
        subject?: string | undefined;
    }, {
        domain?: string | undefined;
        subject?: string | undefined;
        qualifiers?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    intent_type: string;
    signals: {
        signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
        matched_text: string;
        position: {
            start: number;
            end: number;
        };
        weight: number;
        metadata?: Record<string, unknown> | undefined;
    }[];
    scope?: {
        qualifiers: string[];
        domain?: string | undefined;
        subject?: string | undefined;
    } | undefined;
    action?: {
        normalized: string;
        verb: string;
        tense?: "present" | "past" | "future" | "imperative" | undefined;
    } | undefined;
    target?: {
        value: string;
        type: string;
        normalized?: string | undefined;
    } | undefined;
}, {
    confidence: number;
    intent_type: string;
    signals: {
        signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
        matched_text: string;
        position: {
            start: number;
            end: number;
        };
        weight: number;
        metadata?: Record<string, unknown> | undefined;
    }[];
    scope?: {
        domain?: string | undefined;
        subject?: string | undefined;
        qualifiers?: string[] | undefined;
    } | undefined;
    action?: {
        normalized: string;
        verb: string;
        tense?: "present" | "past" | "future" | "imperative" | undefined;
    } | undefined;
    target?: {
        value: string;
        type: string;
        normalized?: string | undefined;
    } | undefined;
}>;
export type ClassifiedIntent = z.infer<typeof ClassifiedIntentSchema>;
/**
 * Multi-intent state when multiple intents are detected
 */
export declare const MultiIntentStateSchema: z.ZodObject<{
    /** Whether multiple intents were detected */
    is_multi_intent: z.ZodBoolean;
    /** Relationship between intents */
    relationship: z.ZodEnum<["sequential", "conditional", "alternative", "parallel", "nested", "clarification", "none"]>;
    /** Order of intents if sequential */
    sequence: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Condition between intents if conditional */
    condition: z.ZodOptional<z.ZodObject<{
        if_intent: z.ZodString;
        then_intent: z.ZodString;
        condition_text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        if_intent: string;
        then_intent: string;
        condition_text: string;
    }, {
        if_intent: string;
        then_intent: string;
        condition_text: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    is_multi_intent: boolean;
    relationship: "sequential" | "conditional" | "alternative" | "parallel" | "nested" | "clarification" | "none";
    sequence?: string[] | undefined;
    condition?: {
        if_intent: string;
        then_intent: string;
        condition_text: string;
    } | undefined;
}, {
    is_multi_intent: boolean;
    relationship: "sequential" | "conditional" | "alternative" | "parallel" | "nested" | "clarification" | "none";
    sequence?: string[] | undefined;
    condition?: {
        if_intent: string;
        then_intent: string;
        condition_text: string;
    } | undefined;
}>;
export type MultiIntentState = z.infer<typeof MultiIntentStateSchema>;
/**
 * Intent Classifier Input Schema
 */
export declare const IntentClassifierInputSchema: z.ZodObject<{
    /** Text to classify (user message or system input) */
    text: z.ZodString;
    /** Optional conversation context */
    context: z.ZodOptional<z.ZodObject<{
        /** Previous messages for context */
        previous_messages: z.ZodOptional<z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<["user", "system", "assistant"]>;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            text: string;
            role: "user" | "system" | "assistant";
        }, {
            text: string;
            role: "user" | "system" | "assistant";
        }>, "many">>;
        /** Current domain/topic */
        domain: z.ZodOptional<z.ZodString>;
        /** Known entities in scope */
        entities: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            value: string;
            type: string;
        }, {
            value: string;
            type: string;
        }>, "many">>;
        /** Active session state */
        session_state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        domain?: string | undefined;
        previous_messages?: {
            text: string;
            role: "user" | "system" | "assistant";
        }[] | undefined;
        entities?: {
            value: string;
            type: string;
        }[] | undefined;
        session_state?: Record<string, unknown> | undefined;
    }, {
        domain?: string | undefined;
        previous_messages?: {
            text: string;
            role: "user" | "system" | "assistant";
        }[] | undefined;
        entities?: {
            value: string;
            type: string;
        }[] | undefined;
        session_state?: Record<string, unknown> | undefined;
    }>>;
    /** Classification hints */
    hints: z.ZodOptional<z.ZodObject<{
        /** Expected intent types to prioritize */
        expected_intents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Intents to exclude from consideration */
        excluded_intents: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Minimum confidence threshold */
        min_confidence: z.ZodOptional<z.ZodNumber>;
        /** Maximum number of intents to return */
        max_intents: z.ZodOptional<z.ZodNumber>;
        /** Language hint */
        language: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        min_confidence?: number | undefined;
        expected_intents?: string[] | undefined;
        excluded_intents?: string[] | undefined;
        max_intents?: number | undefined;
        language?: string | undefined;
    }, {
        min_confidence?: number | undefined;
        expected_intents?: string[] | undefined;
        excluded_intents?: string[] | undefined;
        max_intents?: number | undefined;
        language?: string | undefined;
    }>>;
    /** Request ID for tracing */
    request_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    context?: {
        domain?: string | undefined;
        previous_messages?: {
            text: string;
            role: "user" | "system" | "assistant";
        }[] | undefined;
        entities?: {
            value: string;
            type: string;
        }[] | undefined;
        session_state?: Record<string, unknown> | undefined;
    } | undefined;
    hints?: {
        min_confidence?: number | undefined;
        expected_intents?: string[] | undefined;
        excluded_intents?: string[] | undefined;
        max_intents?: number | undefined;
        language?: string | undefined;
    } | undefined;
    request_id?: string | undefined;
}, {
    text: string;
    context?: {
        domain?: string | undefined;
        previous_messages?: {
            text: string;
            role: "user" | "system" | "assistant";
        }[] | undefined;
        entities?: {
            value: string;
            type: string;
        }[] | undefined;
        session_state?: Record<string, unknown> | undefined;
    } | undefined;
    hints?: {
        min_confidence?: number | undefined;
        expected_intents?: string[] | undefined;
        excluded_intents?: string[] | undefined;
        max_intents?: number | undefined;
        language?: string | undefined;
    } | undefined;
    request_id?: string | undefined;
}>;
export type IntentClassifierInput = z.infer<typeof IntentClassifierInputSchema>;
/**
 * Intent Classifier Output Schema
 */
export declare const IntentClassifierOutputSchema: z.ZodObject<{
    /** Classification ID */
    classification_id: z.ZodString;
    /** Original text (echoed for verification) */
    original_text: z.ZodString;
    /** Normalized/cleaned text used for analysis */
    normalized_text: z.ZodString;
    /** Primary classified intent */
    primary_intent: z.ZodObject<{
        /** Intent type */
        intent_type: z.ZodString;
        /** Confidence score for this intent (0.0-1.0) */
        confidence: z.ZodNumber;
        /** Signals supporting this classification */
        signals: z.ZodArray<z.ZodObject<{
            /** Type of signal detected */
            signal_type: z.ZodEnum<["keyword", "phrase", "structure", "context", "entity", "sentiment", "syntax"]>;
            /** The matched text or pattern */
            matched_text: z.ZodString;
            /** Position in input (character offset) */
            position: z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                start: number;
                end: number;
            }, {
                start: number;
                end: number;
            }>;
            /** Contribution to confidence (0.0-1.0) */
            weight: z.ZodNumber;
            /** Additional signal metadata */
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }, {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }>, "many">;
        /** Intent target/object if identified */
        target: z.ZodOptional<z.ZodObject<{
            type: z.ZodString;
            value: z.ZodString;
            normalized: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            type: string;
            normalized?: string | undefined;
        }, {
            value: string;
            type: string;
            normalized?: string | undefined;
        }>>;
        /** Intent action if applicable */
        action: z.ZodOptional<z.ZodObject<{
            verb: z.ZodString;
            normalized: z.ZodString;
            tense: z.ZodOptional<z.ZodEnum<["present", "past", "future", "imperative"]>>;
        }, "strip", z.ZodTypeAny, {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        }, {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        }>>;
        /** Intent scope/context */
        scope: z.ZodOptional<z.ZodObject<{
            domain: z.ZodOptional<z.ZodString>;
            subject: z.ZodOptional<z.ZodString>;
            qualifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            qualifiers: string[];
            domain?: string | undefined;
            subject?: string | undefined;
        }, {
            domain?: string | undefined;
            subject?: string | undefined;
            qualifiers?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            qualifiers: string[];
            domain?: string | undefined;
            subject?: string | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    }, {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            domain?: string | undefined;
            subject?: string | undefined;
            qualifiers?: string[] | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    }>;
    /** Secondary intents (if multi-intent detected) */
    secondary_intents: z.ZodDefault<z.ZodArray<z.ZodObject<{
        /** Intent type */
        intent_type: z.ZodString;
        /** Confidence score for this intent (0.0-1.0) */
        confidence: z.ZodNumber;
        /** Signals supporting this classification */
        signals: z.ZodArray<z.ZodObject<{
            /** Type of signal detected */
            signal_type: z.ZodEnum<["keyword", "phrase", "structure", "context", "entity", "sentiment", "syntax"]>;
            /** The matched text or pattern */
            matched_text: z.ZodString;
            /** Position in input (character offset) */
            position: z.ZodObject<{
                start: z.ZodNumber;
                end: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                start: number;
                end: number;
            }, {
                start: number;
                end: number;
            }>;
            /** Contribution to confidence (0.0-1.0) */
            weight: z.ZodNumber;
            /** Additional signal metadata */
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }, {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }>, "many">;
        /** Intent target/object if identified */
        target: z.ZodOptional<z.ZodObject<{
            type: z.ZodString;
            value: z.ZodString;
            normalized: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            type: string;
            normalized?: string | undefined;
        }, {
            value: string;
            type: string;
            normalized?: string | undefined;
        }>>;
        /** Intent action if applicable */
        action: z.ZodOptional<z.ZodObject<{
            verb: z.ZodString;
            normalized: z.ZodString;
            tense: z.ZodOptional<z.ZodEnum<["present", "past", "future", "imperative"]>>;
        }, "strip", z.ZodTypeAny, {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        }, {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        }>>;
        /** Intent scope/context */
        scope: z.ZodOptional<z.ZodObject<{
            domain: z.ZodOptional<z.ZodString>;
            subject: z.ZodOptional<z.ZodString>;
            qualifiers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            qualifiers: string[];
            domain?: string | undefined;
            subject?: string | undefined;
        }, {
            domain?: string | undefined;
            subject?: string | undefined;
            qualifiers?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            qualifiers: string[];
            domain?: string | undefined;
            subject?: string | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    }, {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            domain?: string | undefined;
            subject?: string | undefined;
            qualifiers?: string[] | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    }>, "many">>;
    /** Multi-intent state analysis */
    multi_intent_state: z.ZodObject<{
        /** Whether multiple intents were detected */
        is_multi_intent: z.ZodBoolean;
        /** Relationship between intents */
        relationship: z.ZodEnum<["sequential", "conditional", "alternative", "parallel", "nested", "clarification", "none"]>;
        /** Order of intents if sequential */
        sequence: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Condition between intents if conditional */
        condition: z.ZodOptional<z.ZodObject<{
            if_intent: z.ZodString;
            then_intent: z.ZodString;
            condition_text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            if_intent: string;
            then_intent: string;
            condition_text: string;
        }, {
            if_intent: string;
            then_intent: string;
            condition_text: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        is_multi_intent: boolean;
        relationship: "sequential" | "conditional" | "alternative" | "parallel" | "nested" | "clarification" | "none";
        sequence?: string[] | undefined;
        condition?: {
            if_intent: string;
            then_intent: string;
            condition_text: string;
        } | undefined;
    }, {
        is_multi_intent: boolean;
        relationship: "sequential" | "conditional" | "alternative" | "parallel" | "nested" | "clarification" | "none";
        sequence?: string[] | undefined;
        condition?: {
            if_intent: string;
            then_intent: string;
            condition_text: string;
        } | undefined;
    }>;
    /** Overall classification confidence (0.0-1.0) */
    overall_confidence: z.ZodNumber;
    /** Analysis metadata */
    analysis: z.ZodObject<{
        /** Number of intents detected */
        intent_count: z.ZodNumber;
        /** Total signals identified */
        signal_count: z.ZodNumber;
        /** Processing notes */
        notes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Ambiguity indicators */
        ambiguity: z.ZodObject<{
            is_ambiguous: z.ZodBoolean;
            ambiguity_type: z.ZodEnum<["lexical", "structural", "contextual", "none"]>;
            clarification_needed: z.ZodBoolean;
            suggested_clarification: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            is_ambiguous: boolean;
            ambiguity_type: "contextual" | "lexical" | "none" | "structural";
            clarification_needed: boolean;
            suggested_clarification?: string | undefined;
        }, {
            is_ambiguous: boolean;
            ambiguity_type: "contextual" | "lexical" | "none" | "structural";
            clarification_needed: boolean;
            suggested_clarification?: string | undefined;
        }>;
        /** Language detection */
        language: z.ZodOptional<z.ZodObject<{
            detected: z.ZodString;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            detected: string;
        }, {
            confidence: number;
            detected: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        notes: string[];
        intent_count: number;
        signal_count: number;
        ambiguity: {
            is_ambiguous: boolean;
            ambiguity_type: "contextual" | "lexical" | "none" | "structural";
            clarification_needed: boolean;
            suggested_clarification?: string | undefined;
        };
        language?: {
            confidence: number;
            detected: string;
        } | undefined;
    }, {
        intent_count: number;
        signal_count: number;
        ambiguity: {
            is_ambiguous: boolean;
            ambiguity_type: "contextual" | "lexical" | "none" | "structural";
            clarification_needed: boolean;
            suggested_clarification?: string | undefined;
        };
        notes?: string[] | undefined;
        language?: {
            confidence: number;
            detected: string;
        } | undefined;
    }>;
    /** Version for tracking iterations */
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: string;
    analysis: {
        notes: string[];
        intent_count: number;
        signal_count: number;
        ambiguity: {
            is_ambiguous: boolean;
            ambiguity_type: "contextual" | "lexical" | "none" | "structural";
            clarification_needed: boolean;
            suggested_clarification?: string | undefined;
        };
        language?: {
            confidence: number;
            detected: string;
        } | undefined;
    };
    classification_id: string;
    original_text: string;
    normalized_text: string;
    primary_intent: {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            qualifiers: string[];
            domain?: string | undefined;
            subject?: string | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    };
    secondary_intents: {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            qualifiers: string[];
            domain?: string | undefined;
            subject?: string | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    }[];
    multi_intent_state: {
        is_multi_intent: boolean;
        relationship: "sequential" | "conditional" | "alternative" | "parallel" | "nested" | "clarification" | "none";
        sequence?: string[] | undefined;
        condition?: {
            if_intent: string;
            then_intent: string;
            condition_text: string;
        } | undefined;
    };
    overall_confidence: number;
}, {
    analysis: {
        intent_count: number;
        signal_count: number;
        ambiguity: {
            is_ambiguous: boolean;
            ambiguity_type: "contextual" | "lexical" | "none" | "structural";
            clarification_needed: boolean;
            suggested_clarification?: string | undefined;
        };
        notes?: string[] | undefined;
        language?: {
            confidence: number;
            detected: string;
        } | undefined;
    };
    classification_id: string;
    original_text: string;
    normalized_text: string;
    primary_intent: {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            domain?: string | undefined;
            subject?: string | undefined;
            qualifiers?: string[] | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    };
    multi_intent_state: {
        is_multi_intent: boolean;
        relationship: "sequential" | "conditional" | "alternative" | "parallel" | "nested" | "clarification" | "none";
        sequence?: string[] | undefined;
        condition?: {
            if_intent: string;
            then_intent: string;
            condition_text: string;
        } | undefined;
    };
    overall_confidence: number;
    version?: string | undefined;
    secondary_intents?: {
        confidence: number;
        intent_type: string;
        signals: {
            signal_type: "context" | "keyword" | "phrase" | "structure" | "entity" | "sentiment" | "syntax";
            matched_text: string;
            position: {
                start: number;
                end: number;
            };
            weight: number;
            metadata?: Record<string, unknown> | undefined;
        }[];
        scope?: {
            domain?: string | undefined;
            subject?: string | undefined;
            qualifiers?: string[] | undefined;
        } | undefined;
        action?: {
            normalized: string;
            verb: string;
            tense?: "present" | "past" | "future" | "imperative" | undefined;
        } | undefined;
        target?: {
            value: string;
            type: string;
            normalized?: string | undefined;
        } | undefined;
    }[] | undefined;
}>;
export type IntentClassifierOutput = z.infer<typeof IntentClassifierOutputSchema>;
