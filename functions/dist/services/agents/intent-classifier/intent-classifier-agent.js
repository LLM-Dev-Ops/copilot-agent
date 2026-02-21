"use strict";
/**
 * Intent Classifier Agent
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
 * CONSTITUTION COMPLIANCE:
 * ✓ Stateless at runtime
 * ✓ Emits exactly ONE DecisionEvent per invocation
 * ✓ Persists ONLY via ruvector-service
 * ✓ NEVER connects directly to databases
 * ✓ NEVER executes SQL
 * ✓ NEVER modifies runtime behavior
 * ✓ NEVER orchestrates other agents
 * ✓ NEVER enforces policy
 * ✓ NEVER intercepts execution paths
 *
 * Must Never:
 * - Trigger workflows
 * - Route execution
 * - Enforce policy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentClassifierAgent = void 0;
const uuid_1 = require("uuid");
const contracts_1 = require("../contracts");
const intent_classifier_schemas_1 = require("../contracts/intent-classifier-schemas");
const AGENT_ID = 'intent-classifier-agent';
const AGENT_VERSION = '1.0.0';
const DECISION_TYPE = 'intent_classification';
const INTENT_PATTERNS = [
    // Information seeking
    {
        intent: intent_classifier_schemas_1.IntentType.QUERY,
        keywords: ['what', 'who', 'where', 'when', 'how', 'why', 'which', 'show', 'tell', 'get'],
        phrases: ['i want to know', 'can you tell', 'what is', 'what are', 'how does', 'how do'],
        weight: 0.8,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.SEARCH,
        keywords: ['find', 'search', 'look', 'locate', 'discover'],
        phrases: ['search for', 'find me', 'looking for', 'where can i find'],
        weight: 0.85,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.EXPLAIN,
        keywords: ['explain', 'describe', 'elaborate', 'clarify'],
        phrases: ['explain how', 'explain why', 'tell me about', 'can you explain'],
        weight: 0.85,
    },
    // Action requests
    {
        intent: intent_classifier_schemas_1.IntentType.CREATE,
        keywords: ['create', 'make', 'build', 'generate', 'add', 'new', 'write'],
        phrases: ['create a', 'make a', 'build a', 'add a', 'generate a', 'write a'],
        weight: 0.9,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.UPDATE,
        keywords: ['update', 'modify', 'change', 'edit', 'alter', 'revise', 'fix'],
        phrases: ['update the', 'change the', 'modify the', 'edit the', 'fix the'],
        weight: 0.9,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.DELETE,
        keywords: ['delete', 'remove', 'destroy', 'drop', 'clear', 'erase'],
        phrases: ['delete the', 'remove the', 'get rid of', 'clear the'],
        weight: 0.9,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.EXECUTE,
        keywords: ['run', 'execute', 'start', 'launch', 'trigger', 'invoke', 'call'],
        phrases: ['run the', 'execute the', 'start the', 'launch the'],
        weight: 0.85,
    },
    // Navigation/Flow
    {
        intent: intent_classifier_schemas_1.IntentType.NAVIGATE,
        keywords: ['go', 'navigate', 'open', 'show', 'display', 'view'],
        phrases: ['go to', 'take me to', 'navigate to', 'open the', 'show me'],
        weight: 0.8,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.CANCEL,
        keywords: ['cancel', 'abort', 'stop', 'quit', 'exit', 'nevermind'],
        phrases: ['cancel that', 'stop that', 'never mind', 'forget it'],
        weight: 0.95,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.CONFIRM,
        keywords: ['yes', 'confirm', 'okay', 'ok', 'sure', 'proceed', 'correct', 'right'],
        phrases: ['yes please', 'that is correct', 'go ahead', 'sounds good'],
        weight: 0.9,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.UNDO,
        keywords: ['undo', 'revert', 'rollback', 'restore'],
        phrases: ['undo that', 'take that back', 'revert to', 'go back to'],
        weight: 0.95,
    },
    // Conversational
    {
        intent: intent_classifier_schemas_1.IntentType.GREETING,
        keywords: ['hello', 'hi', 'hey', 'greetings', 'morning', 'afternoon', 'evening'],
        phrases: ['good morning', 'good afternoon', 'good evening', 'how are you'],
        weight: 0.9,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.FAREWELL,
        keywords: ['bye', 'goodbye', 'farewell', 'later', 'exit'],
        phrases: ['see you', 'talk later', 'have a good', 'take care'],
        weight: 0.9,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.FEEDBACK,
        keywords: ['feedback', 'suggest', 'recommend', 'opinion', 'think'],
        phrases: ['i think', 'in my opinion', 'i suggest', 'i recommend'],
        weight: 0.75,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.HELP,
        keywords: ['help', 'assist', 'support', 'guide', 'stuck'],
        phrases: ['help me', 'i need help', 'can you help', 'how do i', 'i am stuck'],
        weight: 0.9,
    },
    // System
    {
        intent: intent_classifier_schemas_1.IntentType.CONFIGURE,
        keywords: ['configure', 'setup', 'setting', 'preference', 'option', 'config'],
        phrases: ['set up', 'configure the', 'change setting', 'update preference'],
        weight: 0.85,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.AUTHENTICATE,
        keywords: ['login', 'signin', 'authenticate', 'logon'],
        phrases: ['log in', 'sign in', 'log me in'],
        weight: 0.95,
    },
    {
        intent: intent_classifier_schemas_1.IntentType.AUTHORIZE,
        keywords: ['permission', 'authorize', 'access', 'allow', 'grant'],
        phrases: ['grant access', 'give permission', 'allow me to'],
        weight: 0.85,
    },
];
/**
 * Intent Classifier Agent Implementation
 *
 * This agent analyzes text and classifies user/system intent.
 * It is purely analytical - it NEVER executes, routes, or enforces anything.
 */
class IntentClassifierAgent {
    metadata = {
        id: AGENT_ID,
        name: 'Intent Classifier Agent',
        version: AGENT_VERSION,
        classifications: [contracts_1.AgentClassification.INTENT_ANALYSIS],
        decision_type: DECISION_TYPE,
        description: 'Classifies user or system intent to guide downstream reasoning. Detects multi-intent states and assigns confidence scores.',
    };
    persistence;
    telemetry;
    constructor(persistence, telemetry) {
        this.persistence = persistence;
        this.telemetry = telemetry;
    }
    /**
     * Validate input against IntentClassifierInputSchema
     */
    validateInput(input) {
        return intent_classifier_schemas_1.IntentClassifierInputSchema.parse(input);
    }
    /**
     * Invoke the intent classifier agent
     *
     * DETERMINISTIC: Same input always produces same output structure
     * STATELESS: No internal state modified
     * NON-BLOCKING: Fully async
     */
    async invoke(input, executionRef) {
        const startTime = Date.now();
        try {
            // Emit telemetry start
            this.telemetry.recordStart(AGENT_ID, executionRef, input);
            // Classify intent (pure analysis, no side effects)
            const output = this.classifyIntent(input);
            // Validate output
            const validatedOutput = intent_classifier_schemas_1.IntentClassifierOutputSchema.parse(output);
            // Calculate overall confidence
            const confidence = validatedOutput.overall_confidence;
            // Constraints applied during classification
            const constraintsApplied = this.getAppliedConstraints(input);
            // Create the DecisionEvent
            const event = (0, contracts_1.createDecisionEvent)(AGENT_ID, AGENT_VERSION, DECISION_TYPE, input, validatedOutput, confidence, constraintsApplied, executionRef);
            // Persist via ruvector-service ONLY
            await this.persistence.store(event);
            // Emit telemetry success
            this.telemetry.recordSuccess(AGENT_ID, executionRef, Date.now() - startTime);
            return {
                status: 'success',
                event,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorCode = this.classifyError(error);
            // Emit telemetry failure
            this.telemetry.recordFailure(AGENT_ID, executionRef, errorCode, errorMessage);
            return (0, contracts_1.createErrorResult)(errorCode, errorMessage, executionRef);
        }
    }
    /**
     * Classify intent from input text
     *
     * This is the core classification logic - purely analytical.
     * NEVER triggers workflows, routes execution, or enforces policy.
     */
    classifyIntent(input) {
        const classificationId = (0, uuid_1.v4)();
        const normalizedText = this.normalizeText(input.text);
        // Detect all potential intents with signals
        const detectedIntents = this.detectIntents(normalizedText, input);
        // Sort by confidence (descending)
        detectedIntents.sort((a, b) => b.confidence - a.confidence);
        // Apply hints filtering
        const filteredIntents = this.applyHints(detectedIntents, input.hints);
        // Determine primary and secondary intents
        const primaryIntent = filteredIntents[0] || this.createUnknownIntent(normalizedText);
        const secondaryIntents = filteredIntents.slice(1);
        // Analyze multi-intent state
        const multiIntentState = this.analyzeMultiIntentState(primaryIntent, secondaryIntents, normalizedText);
        // Detect ambiguity
        const ambiguity = this.detectAmbiguity(primaryIntent, secondaryIntents, normalizedText);
        // Count total signals
        const signalCount = [primaryIntent, ...secondaryIntents]
            .reduce((sum, intent) => sum + intent.signals.length, 0);
        // Calculate overall confidence
        const overallConfidence = this.calculateOverallConfidence(primaryIntent, secondaryIntents, ambiguity);
        return {
            classification_id: classificationId,
            original_text: input.text,
            normalized_text: normalizedText,
            primary_intent: primaryIntent,
            secondary_intents: secondaryIntents,
            multi_intent_state: multiIntentState,
            overall_confidence: overallConfidence,
            analysis: {
                intent_count: 1 + secondaryIntents.length,
                signal_count: signalCount,
                notes: this.generateNotes(primaryIntent, secondaryIntents, input),
                ambiguity,
                language: this.detectLanguage(input.text),
            },
            version: '1.0.0',
        };
    }
    /**
     * Normalize text for analysis
     */
    normalizeText(text) {
        return text
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\?\.\!\,\-\']/g, '');
    }
    /**
     * Detect all potential intents from normalized text
     */
    detectIntents(normalizedText, input) {
        const intents = [];
        const words = normalizedText.split(' ');
        for (const pattern of INTENT_PATTERNS) {
            const signals = [];
            let totalWeight = 0;
            // Check keywords
            for (const keyword of pattern.keywords) {
                const keywordLower = keyword.toLowerCase();
                let position = 0;
                let index = normalizedText.indexOf(keywordLower, position);
                while (index !== -1) {
                    // Check if it's a word boundary match
                    const beforeChar = index > 0 ? normalizedText[index - 1] : ' ';
                    const afterChar = index + keywordLower.length < normalizedText.length
                        ? normalizedText[index + keywordLower.length]
                        : ' ';
                    if ((beforeChar === ' ' || beforeChar === undefined) &&
                        (afterChar === ' ' || afterChar === '?' || afterChar === '.' || afterChar === '!' || afterChar === undefined)) {
                        signals.push({
                            signal_type: 'keyword',
                            matched_text: keyword,
                            position: { start: index, end: index + keywordLower.length },
                            weight: pattern.weight * 0.7,
                        });
                        totalWeight += pattern.weight * 0.7;
                    }
                    position = index + 1;
                    index = normalizedText.indexOf(keywordLower, position);
                }
            }
            // Check phrases
            for (const phrase of pattern.phrases) {
                const phraseLower = phrase.toLowerCase();
                const index = normalizedText.indexOf(phraseLower);
                if (index !== -1) {
                    signals.push({
                        signal_type: 'phrase',
                        matched_text: phrase,
                        position: { start: index, end: index + phraseLower.length },
                        weight: pattern.weight,
                    });
                    totalWeight += pattern.weight;
                }
            }
            if (signals.length > 0) {
                // Calculate confidence based on signals
                const confidence = Math.min(1.0, totalWeight / (signals.length * 0.8));
                // Extract target and action if possible
                const target = this.extractTarget(normalizedText, pattern.intent);
                const action = this.extractAction(normalizedText, pattern.intent);
                intents.push({
                    intent_type: pattern.intent,
                    confidence,
                    signals,
                    target,
                    action,
                    scope: this.extractScope(input),
                });
            }
        }
        return intents;
    }
    /**
     * Extract target from text based on intent
     */
    extractTarget(text, intent) {
        // Common patterns to extract targets
        const patterns = [
            /(?:the|a|an)\s+(\w+(?:\s+\w+)?)/i,
            /(?:create|update|delete|find|search)\s+(?:the|a|an)?\s*(\w+)/i,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return {
                    type: 'entity',
                    value: match[1],
                    normalized: match[1].toLowerCase().trim(),
                };
            }
        }
        return undefined;
    }
    /**
     * Extract action from text based on intent
     */
    extractAction(text, intent) {
        const actionVerbs = ['create', 'update', 'delete', 'find', 'search', 'get', 'set', 'run', 'execute'];
        const words = text.split(' ');
        for (const word of words) {
            const verb = actionVerbs.find(v => word.startsWith(v));
            if (verb) {
                return {
                    verb: word,
                    normalized: verb,
                    tense: word.endsWith('ing') ? 'present' : (word.endsWith('ed') ? 'past' : 'imperative'),
                };
            }
        }
        return undefined;
    }
    /**
     * Extract scope from input context
     */
    extractScope(input) {
        return {
            domain: input.context?.domain,
            subject: undefined,
            qualifiers: [],
        };
    }
    /**
     * Apply hints to filter intents
     */
    applyHints(intents, hints) {
        if (!hints)
            return intents;
        let filtered = intents;
        // Filter by expected intents (boost)
        if (hints.expected_intents?.length) {
            filtered = filtered.map(intent => {
                if (hints.expected_intents.includes(intent.intent_type)) {
                    return { ...intent, confidence: Math.min(1.0, intent.confidence * 1.2) };
                }
                return intent;
            });
        }
        // Filter by excluded intents
        if (hints.excluded_intents?.length) {
            filtered = filtered.filter(intent => !hints.excluded_intents.includes(intent.intent_type));
        }
        // Filter by minimum confidence
        if (hints.min_confidence !== undefined) {
            filtered = filtered.filter(intent => intent.confidence >= hints.min_confidence);
        }
        // Limit number of intents
        if (hints.max_intents !== undefined) {
            filtered = filtered.slice(0, hints.max_intents);
        }
        return filtered;
    }
    /**
     * Create unknown intent fallback
     */
    createUnknownIntent(normalizedText) {
        return {
            intent_type: intent_classifier_schemas_1.IntentType.UNKNOWN,
            confidence: 0.1,
            signals: [{
                    signal_type: 'context',
                    matched_text: normalizedText.substring(0, 50),
                    position: { start: 0, end: Math.min(50, normalizedText.length) },
                    weight: 0.1,
                }],
            scope: { qualifiers: [] },
        };
    }
    /**
     * Analyze multi-intent state
     */
    analyzeMultiIntentState(primary, secondary, text) {
        const isMultiIntent = secondary.length > 0 && secondary[0].confidence > 0.5;
        if (!isMultiIntent) {
            return {
                is_multi_intent: false,
                relationship: 'none',
            };
        }
        // Detect relationship type
        const relationship = this.detectIntentRelationship(primary, secondary, text);
        return {
            is_multi_intent: true,
            relationship,
            sequence: relationship === 'sequential'
                ? [primary.intent_type, ...secondary.map(s => s.intent_type)]
                : undefined,
        };
    }
    /**
     * Detect relationship between intents
     */
    detectIntentRelationship(primary, secondary, text) {
        // Check for sequential indicators
        if (/\b(then|after|next|before)\b/i.test(text)) {
            return 'sequential';
        }
        // Check for conditional indicators
        if (/\b(if|when|unless|provided)\b/i.test(text)) {
            return 'conditional';
        }
        // Check for alternative indicators
        if (/\b(or|either|instead)\b/i.test(text)) {
            return 'alternative';
        }
        // Check for parallel indicators
        if (/\b(and|also|plus|as well)\b/i.test(text)) {
            return 'parallel';
        }
        // Default to parallel if multiple high-confidence intents
        return 'parallel';
    }
    /**
     * Detect ambiguity in classification
     */
    detectAmbiguity(primary, secondary, text) {
        // Check for close confidence scores
        const hasCloseConfidence = secondary.some(s => Math.abs(primary.confidence - s.confidence) < 0.15);
        // Check for ambiguous words
        const hasAmbiguousWords = /\b(maybe|perhaps|could|might|possibly)\b/i.test(text);
        // Check for questions that could be multiple types
        const isAmbiguousQuestion = text.includes('?') && primary.intent_type === intent_classifier_schemas_1.IntentType.QUERY;
        const isAmbiguous = hasCloseConfidence || hasAmbiguousWords;
        let ambiguityType = 'none';
        if (hasAmbiguousWords) {
            ambiguityType = 'lexical';
        }
        else if (hasCloseConfidence) {
            ambiguityType = 'structural';
        }
        else if (isAmbiguousQuestion) {
            ambiguityType = 'contextual';
        }
        return {
            is_ambiguous: isAmbiguous,
            ambiguity_type: ambiguityType,
            clarification_needed: isAmbiguous && primary.confidence < 0.7,
            suggested_clarification: isAmbiguous
                ? `Could you clarify if you want to ${primary.intent_type} or ${secondary[0]?.intent_type || 'something else'}?`
                : undefined,
        };
    }
    /**
     * Detect language of input
     */
    detectLanguage(text) {
        // Simple heuristic - in production would use proper language detection
        const englishWords = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'do', 'does', 'a', 'an'];
        const words = text.toLowerCase().split(/\s+/);
        const englishCount = words.filter(w => englishWords.includes(w)).length;
        if (englishCount > 0) {
            return {
                detected: 'en',
                confidence: Math.min(1.0, 0.5 + (englishCount / words.length)),
            };
        }
        return undefined;
    }
    /**
     * Generate analysis notes
     */
    generateNotes(primary, secondary, input) {
        const notes = [];
        if (primary.confidence > 0.9) {
            notes.push('High confidence classification');
        }
        else if (primary.confidence < 0.5) {
            notes.push('Low confidence - intent may require clarification');
        }
        if (secondary.length > 2) {
            notes.push('Multiple potential intents detected');
        }
        if (input.context?.previous_messages?.length) {
            notes.push('Classification includes conversation context');
        }
        return notes;
    }
    /**
     * Calculate overall confidence
     */
    calculateOverallConfidence(primary, secondary, ambiguity) {
        let confidence = primary.confidence;
        // Reduce confidence if ambiguous
        if (ambiguity.is_ambiguous) {
            confidence *= 0.85;
        }
        // Reduce confidence if many competing intents
        if (secondary.length > 3) {
            confidence *= 0.9;
        }
        // Boost if clear single intent
        if (secondary.length === 0 && primary.signals.length > 2) {
            confidence = Math.min(1.0, confidence * 1.1);
        }
        return Math.min(1.0, Math.max(0.0, confidence));
    }
    /**
     * Get constraints applied during classification
     */
    getAppliedConstraints(input) {
        const constraints = [
            'read_only_analysis',
            'no_workflow_triggering',
            'no_execution_routing',
            'no_policy_enforcement',
            'deterministic_output',
            'signal_routing_only',
        ];
        if (input.hints?.min_confidence !== undefined) {
            constraints.push(`min_confidence:${input.hints.min_confidence}`);
        }
        if (input.hints?.max_intents !== undefined) {
            constraints.push(`max_intents:${input.hints.max_intents}`);
        }
        return constraints;
    }
    /**
     * Classify error for proper error code
     */
    classifyError(error) {
        if (error instanceof Error) {
            if (error.name === 'ZodError') {
                return contracts_1.AgentErrorCodes.VALIDATION_FAILED;
            }
            if (error.message.includes('persistence') || error.message.includes('ruvector')) {
                return contracts_1.AgentErrorCodes.PERSISTENCE_ERROR;
            }
        }
        return contracts_1.AgentErrorCodes.PROCESSING_ERROR;
    }
}
exports.IntentClassifierAgent = IntentClassifierAgent;
//# sourceMappingURL=intent-classifier-agent.js.map