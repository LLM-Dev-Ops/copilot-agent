# NLP Engine Architecture

## Overview
The NLP Engine is responsible for understanding user intent, extracting entities, translating natural language queries to observability query languages, and generating contextual responses.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NLP Engine                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Intent     │      │   Entity     │      │    Query     │  │
│  │  Classifier  │─────▶│  Extractor   │─────▶│  Translator  │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│         │                      │                      │          │
│         │                      │                      │          │
│         └──────────────────────┴──────────────────────┘          │
│                                │                                 │
│                                ▼                                 │
│                     ┌──────────────────┐                         │
│                     │    Context       │                         │
│                     │    Resolver      │                         │
│                     └──────────────────┘                         │
│                                │                                 │
│                                ▼                                 │
│                     ┌──────────────────┐                         │
│                     │    Response      │                         │
│                     │    Generator     │                         │
│                     └──────────────────┘                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              LLM Integration Layer                     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │     │
│  │  │  Cache   │  │ Fallback │  │ Rate     │            │     │
│  │  │  Manager │  │ Handler  │  │ Limiter  │            │     │
│  │  └──────────┘  └──────────┘  └──────────┘            │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input
    │
    ▼
┌─────────────────────────────┐
│  1. Intent Classification   │
│     - Parse input           │
│     - Classify intent       │
│     - Confidence scoring    │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  2. Entity Extraction       │
│     - Extract entities      │
│     - Resolve ambiguities   │
│     - Validate entities     │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  3. Context Resolution      │
│     - Load session context  │
│     - Retrieve history      │
│     - Merge entity context  │
└─────────────────────────────┘
    │
    ├─────────────────────────┐
    │                         │
    ▼                         ▼
┌────────────────┐    ┌──────────────────┐
│ 4a. Query      │    │ 4b. Action       │
│     Translation│    │     Execution    │
│  - PromQL      │    │  - Deploy        │
│  - LogQL       │    │  - Scale         │
│  - TraceQL     │    │  - Configure     │
└────────────────┘    └──────────────────┘
    │                         │
    └─────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  5. Response Generation     │
│     - Format results        │
│     - Add context           │
│     - Stream output         │
└─────────────────────────────┘
    │
    ▼
User Response
```

## Rust Trait Definitions

### Core Traits

```rust
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;

/// Result type for NLP operations
pub type NlpResult<T> = Result<T, NlpError>;

/// Error types for NLP engine
#[derive(Error, Debug)]
pub enum NlpError {
    #[error("Intent classification failed: {0}")]
    ClassificationError(String),

    #[error("Entity extraction failed: {0}")]
    ExtractionError(String),

    #[error("Query translation failed: {0}")]
    TranslationError(String),

    #[error("Context resolution failed: {0}")]
    ContextError(String),

    #[error("Response generation failed: {0}")]
    GenerationError(String),

    #[error("LLM API error: {0}")]
    LlmApiError(String),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Insufficient confidence: {score}, threshold: {threshold}")]
    InsufficientConfidence { score: f32, threshold: f32 },
}

/// Intent types supported by the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum IntentType {
    // Query intents
    QueryMetrics,
    QueryLogs,
    QueryTraces,
    QueryTopology,

    // Action intents
    Deploy,
    Scale,
    Configure,
    Rollback,

    // Analysis intents
    Troubleshoot,
    RootCauseAnalysis,
    PerformanceAnalysis,
    CostAnalysis,

    // Information intents
    Explain,
    Compare,
    Summarize,

    // Workflow intents
    CreateWorkflow,
    ExecuteWorkflow,
    ScheduleWorkflow,

    // Conversational
    Clarification,
    Confirmation,
    Cancellation,

    // Unknown
    Unknown,
}

/// Confidence score for intent classification
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Confidence {
    pub score: f32,      // 0.0 to 1.0
    pub threshold: f32,  // Minimum required confidence
}

impl Confidence {
    pub fn new(score: f32, threshold: f32) -> Self {
        Self { score, threshold }
    }

    pub fn is_confident(&self) -> bool {
        self.score >= self.threshold
    }

    pub fn needs_clarification(&self) -> bool {
        !self.is_confident()
    }
}

/// Classified intent with confidence and alternatives
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassifiedIntent {
    pub primary: IntentType,
    pub confidence: Confidence,
    pub alternatives: Vec<(IntentType, f32)>,
    pub metadata: HashMap<String, String>,
}

/// Entity types that can be extracted
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EntityType {
    Service,
    Namespace,
    Pod,
    Container,
    Cluster,
    TimeRange,
    Metric,
    LogLevel,
    TraceId,
    SpanId,
    ErrorType,
    Threshold,
    Duration,
    Percentage,
    Custom(String),
}

/// Extracted entity with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub entity_type: EntityType,
    pub value: String,
    pub confidence: f32,
    pub span: (usize, usize),  // Position in original text
    pub resolved_value: Option<String>,  // After resolution
    pub metadata: HashMap<String, String>,
}

/// Query language type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QueryLanguage {
    PromQL,
    LogQL,
    TraceQL,
    GraphQL,
    SQL,
}

/// Translated query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslatedQuery {
    pub language: QueryLanguage,
    pub query: String,
    pub parameters: HashMap<String, String>,
    pub explanation: String,
    pub confidence: f32,
}

/// NLP processing request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpRequest {
    pub input: String,
    pub session_id: String,
    pub user_id: String,
    pub context: Option<HashMap<String, String>>,
    pub preferences: UserPreferences,
}

/// User preferences for NLP processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub confidence_threshold: f32,
    pub enable_caching: bool,
    pub response_format: ResponseFormat,
    pub verbosity: VerbosityLevel,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            confidence_threshold: 0.75,
            enable_caching: true,
            response_format: ResponseFormat::Markdown,
            verbosity: VerbosityLevel::Normal,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseFormat {
    Plain,
    Markdown,
    Json,
    Html,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerbosityLevel {
    Minimal,
    Normal,
    Detailed,
    Debug,
}

/// Complete NLP processing result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpResponse {
    pub intent: ClassifiedIntent,
    pub entities: Vec<Entity>,
    pub translated_queries: Vec<TranslatedQuery>,
    pub suggested_actions: Vec<String>,
    pub clarification_needed: Option<String>,
    pub response_text: Option<String>,
}

/// Intent Classifier trait
#[async_trait]
pub trait IntentClassifier: Send + Sync {
    /// Classify user intent from input text
    async fn classify(&self, request: &NlpRequest) -> NlpResult<ClassifiedIntent>;

    /// Batch classification for multiple inputs
    async fn classify_batch(&self, requests: &[NlpRequest]) -> NlpResult<Vec<ClassifiedIntent>>;

    /// Update classifier with feedback
    async fn update_with_feedback(
        &mut self,
        input: &str,
        actual_intent: IntentType,
        predicted_intent: IntentType,
    ) -> NlpResult<()>;

    /// Get supported intents
    fn supported_intents(&self) -> Vec<IntentType>;
}

/// Entity Extractor trait
#[async_trait]
pub trait EntityExtractor: Send + Sync {
    /// Extract entities from text
    async fn extract(&self, text: &str, intent: &IntentType) -> NlpResult<Vec<Entity>>;

    /// Resolve entity references (e.g., "that service" -> actual service name)
    async fn resolve(
        &self,
        entity: &Entity,
        context: &HashMap<String, String>,
    ) -> NlpResult<Entity>;

    /// Validate extracted entities
    async fn validate(
        &self,
        entities: &[Entity],
        intent: &IntentType,
    ) -> NlpResult<Vec<EntityValidation>>;

    /// Get entity suggestions for autocomplete
    async fn suggest(
        &self,
        entity_type: &EntityType,
        prefix: &str,
        limit: usize,
    ) -> NlpResult<Vec<String>>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityValidation {
    pub entity: Entity,
    pub is_valid: bool,
    pub error_message: Option<String>,
    pub suggestions: Vec<String>,
}

/// Query Translator trait
#[async_trait]
pub trait QueryTranslator: Send + Sync {
    /// Translate natural language to query language
    async fn translate(
        &self,
        intent: &ClassifiedIntent,
        entities: &[Entity],
        context: &HashMap<String, String>,
    ) -> NlpResult<Vec<TranslatedQuery>>;

    /// Validate generated query
    async fn validate_query(&self, query: &TranslatedQuery) -> NlpResult<bool>;

    /// Optimize query for performance
    async fn optimize(&self, query: &TranslatedQuery) -> NlpResult<TranslatedQuery>;

    /// Explain query in natural language
    async fn explain(&self, query: &TranslatedQuery) -> NlpResult<String>;
}

/// Context Resolver trait
#[async_trait]
pub trait ContextResolver: Send + Sync {
    /// Resolve context for NLP processing
    async fn resolve(&self, request: &NlpRequest) -> NlpResult<ResolvedContext>;

    /// Update context with new information
    async fn update(&self, session_id: &str, updates: ContextUpdate) -> NlpResult<()>;

    /// Clear context for session
    async fn clear(&self, session_id: &str) -> NlpResult<()>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedContext {
    pub session_history: Vec<HistoryEntry>,
    pub user_context: HashMap<String, String>,
    pub system_context: HashMap<String, String>,
    pub entities_in_focus: Vec<Entity>,
    pub last_intents: Vec<IntentType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub timestamp: i64,
    pub input: String,
    pub intent: IntentType,
    pub entities: Vec<Entity>,
    pub response: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextUpdate {
    pub entities: Option<Vec<Entity>>,
    pub intent: Option<IntentType>,
    pub metadata: Option<HashMap<String, String>>,
}

/// Response Generator trait
#[async_trait]
pub trait ResponseGenerator: Send + Sync {
    /// Generate response from NLP results
    async fn generate(
        &self,
        intent: &ClassifiedIntent,
        entities: &[Entity],
        query_results: Option<Vec<serde_json::Value>>,
        context: &ResolvedContext,
    ) -> NlpResult<GeneratedResponse>;

    /// Generate clarification request
    async fn generate_clarification(
        &self,
        ambiguity: &Ambiguity,
    ) -> NlpResult<String>;

    /// Format response according to user preferences
    async fn format(
        &self,
        response: &GeneratedResponse,
        format: &ResponseFormat,
    ) -> NlpResult<String>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedResponse {
    pub text: String,
    pub format: ResponseFormat,
    pub metadata: HashMap<String, String>,
    pub suggestions: Vec<String>,
    pub visualizations: Vec<Visualization>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Visualization {
    pub viz_type: VisualizationType,
    pub data: serde_json::Value,
    pub config: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VisualizationType {
    LineChart,
    BarChart,
    HeatMap,
    Table,
    Topology,
    Flamegraph,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Ambiguity {
    MultipleIntents(Vec<IntentType>),
    MissingEntities(Vec<EntityType>),
    AmbiguousEntity(Entity, Vec<String>),
    UnclearTimeRange,
}

/// Main NLP Engine trait
#[async_trait]
pub trait NlpEngine: Send + Sync {
    /// Process complete NLP pipeline
    async fn process(&self, request: NlpRequest) -> NlpResult<NlpResponse>;

    /// Process with streaming response
    async fn process_stream(
        &self,
        request: NlpRequest,
    ) -> NlpResult<tokio::sync::mpsc::Receiver<NlpStreamChunk>>;

    /// Health check
    async fn health_check(&self) -> NlpResult<HealthStatus>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NlpStreamChunk {
    Intent(ClassifiedIntent),
    Entities(Vec<Entity>),
    Query(TranslatedQuery),
    Response(String),
    Suggestion(String),
    Complete,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub components: HashMap<String, ComponentHealth>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentHealth {
    pub status: String,
    pub latency_ms: Option<f64>,
    pub error_rate: Option<f32>,
}
```

## LLM Integration Layer

### LLM Client Trait

```rust
/// LLM API client trait
#[async_trait]
pub trait LlmClient: Send + Sync {
    /// Send completion request
    async fn complete(&self, request: LlmRequest) -> NlpResult<LlmResponse>;

    /// Send streaming completion request
    async fn complete_stream(
        &self,
        request: LlmRequest,
    ) -> NlpResult<tokio::sync::mpsc::Receiver<LlmStreamChunk>>;

    /// Embed text for semantic search
    async fn embed(&self, text: &str) -> NlpResult<Vec<f32>>;

    /// Get token count for text
    fn count_tokens(&self, text: &str) -> usize;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmRequest {
    pub messages: Vec<LlmMessage>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: usize,
    pub stop_sequences: Vec<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: LlmRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LlmRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmResponse {
    pub content: String,
    pub model: String,
    pub tokens_used: usize,
    pub finish_reason: FinishReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FinishReason {
    Stop,
    Length,
    ContentFilter,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LlmStreamChunk {
    Content(String),
    Done(LlmResponse),
    Error(String),
}

/// Cache manager for LLM responses
#[async_trait]
pub trait CacheManager: Send + Sync {
    /// Get cached response
    async fn get(&self, key: &str) -> NlpResult<Option<String>>;

    /// Set cached response
    async fn set(&self, key: &str, value: String, ttl_seconds: u64) -> NlpResult<()>;

    /// Invalidate cache entry
    async fn invalidate(&self, key: &str) -> NlpResult<()>;

    /// Generate cache key from request
    fn generate_key(&self, request: &NlpRequest) -> String;
}

/// Fallback handler for LLM failures
#[async_trait]
pub trait FallbackHandler: Send + Sync {
    /// Handle LLM failure with fallback logic
    async fn handle_failure(
        &self,
        request: &NlpRequest,
        error: &NlpError,
    ) -> NlpResult<NlpResponse>;

    /// Check if fallback is available
    fn has_fallback(&self, error: &NlpError) -> bool;
}

/// Rate limiter for LLM API calls
#[async_trait]
pub trait RateLimiter: Send + Sync {
    /// Check if request is allowed
    async fn check(&self, user_id: &str) -> NlpResult<bool>;

    /// Record request
    async fn record(&self, user_id: &str) -> NlpResult<()>;

    /// Get remaining quota
    async fn get_remaining(&self, user_id: &str) -> NlpResult<usize>;
}
```

## Implementation Strategy

### 1. Intent Classifier Implementation

```rust
pub struct LlmIntentClassifier {
    llm_client: Arc<dyn LlmClient>,
    cache: Arc<dyn CacheManager>,
    fallback: Arc<dyn FallbackHandler>,
    prompt_template: String,
    confidence_threshold: f32,
}

impl LlmIntentClassifier {
    pub fn new(
        llm_client: Arc<dyn LlmClient>,
        cache: Arc<dyn CacheManager>,
        fallback: Arc<dyn FallbackHandler>,
    ) -> Self {
        Self {
            llm_client,
            cache,
            fallback,
            prompt_template: Self::default_prompt_template(),
            confidence_threshold: 0.75,
        }
    }

    fn default_prompt_template() -> String {
        r#"
        Classify the user's intent from the following categories:

        Query: QueryMetrics, QueryLogs, QueryTraces, QueryTopology
        Action: Deploy, Scale, Configure, Rollback
        Analysis: Troubleshoot, RootCauseAnalysis, PerformanceAnalysis

        User input: {input}

        Respond in JSON format:
        {
          "intent": "<intent_type>",
          "confidence": <0.0-1.0>,
          "reasoning": "<explanation>"
        }
        "#.to_string()
    }

    fn build_prompt(&self, input: &str) -> String {
        self.prompt_template.replace("{input}", input)
    }
}

#[async_trait]
impl IntentClassifier for LlmIntentClassifier {
    async fn classify(&self, request: &NlpRequest) -> NlpResult<ClassifiedIntent> {
        // Check cache first
        if request.preferences.enable_caching {
            let cache_key = self.cache.generate_key(request);
            if let Some(cached) = self.cache.get(&cache_key).await? {
                return serde_json::from_str(&cached)
                    .map_err(|e| NlpError::CacheError(e.to_string()));
            }
        }

        // Build LLM request
        let prompt = self.build_prompt(&request.input);
        let llm_request = LlmRequest {
            messages: vec![LlmMessage {
                role: LlmRole::User,
                content: prompt,
            }],
            model: "claude-3-sonnet".to_string(),
            temperature: 0.0,
            max_tokens: 500,
            stop_sequences: vec![],
            metadata: HashMap::new(),
        };

        // Call LLM
        let response = match self.llm_client.complete(llm_request).await {
            Ok(resp) => resp,
            Err(e) => {
                // Try fallback
                if self.fallback.has_fallback(&e) {
                    return self.fallback.handle_failure(request, &e).await
                        .map(|r| r.intent);
                }
                return Err(e);
            }
        };

        // Parse response
        let intent = self.parse_classification(&response.content)?;

        // Cache result
        if request.preferences.enable_caching {
            let cache_key = self.cache.generate_key(request);
            let serialized = serde_json::to_string(&intent)
                .map_err(|e| NlpError::CacheError(e.to_string()))?;
            self.cache.set(&cache_key, serialized, 3600).await?;
        }

        Ok(intent)
    }

    async fn classify_batch(&self, requests: &[NlpRequest]) -> NlpResult<Vec<ClassifiedIntent>> {
        // Process in parallel with concurrency limit
        let mut results = Vec::new();
        for request in requests {
            results.push(self.classify(request).await?);
        }
        Ok(results)
    }

    async fn update_with_feedback(
        &mut self,
        _input: &str,
        _actual_intent: IntentType,
        _predicted_intent: IntentType,
    ) -> NlpResult<()> {
        // TODO: Implement feedback loop for model fine-tuning
        Ok(())
    }

    fn supported_intents(&self) -> Vec<IntentType> {
        vec![
            IntentType::QueryMetrics,
            IntentType::QueryLogs,
            IntentType::Deploy,
            IntentType::Scale,
            IntentType::Troubleshoot,
            // ... all supported intents
        ]
    }
}
```

### 2. Caching Strategy

```
┌────────────────────────────────────────────────────────────┐
│                     Caching Layers                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Layer 1: In-Memory Cache (LRU)                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │  - Hot data (< 1 minute old)                     │    │
│  │  - Size limit: 1000 entries                      │    │
│  │  - TTL: 60 seconds                                │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                                 │
│                          ▼                                 │
│  Layer 2: Redis Cache                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  - Warm data (< 1 hour old)                      │    │
│  │  - Size limit: 100MB per user                    │    │
│  │  - TTL: 3600 seconds                              │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                                 │
│                          ▼                                 │
│  Layer 3: Database Cache                                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │  - Cold data (< 24 hours old)                    │    │
│  │  - Size limit: Unlimited                          │    │
│  │  - TTL: 86400 seconds                             │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  Cache Key Strategy:                                      │
│  - Format: nlp:{user_id}:{hash(input)}:{context_hash}   │
│  - Invalidation: TTL-based + manual invalidation         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3. Fallback Mechanism

```rust
pub struct LlmFallbackHandler {
    rule_based_classifier: Arc<RuleBasedClassifier>,
    pattern_matcher: Arc<PatternMatcher>,
}

impl LlmFallbackHandler {
    /// Fallback priority:
    /// 1. Rule-based classification
    /// 2. Pattern matching
    /// 3. Generic response with clarification
    async fn execute_fallback(
        &self,
        request: &NlpRequest,
    ) -> NlpResult<NlpResponse> {
        // Try rule-based first
        if let Ok(intent) = self.rule_based_classifier.classify(request).await {
            if intent.confidence.is_confident() {
                return self.build_response_from_rules(intent, request).await;
            }
        }

        // Try pattern matching
        if let Ok(patterns) = self.pattern_matcher.match_patterns(&request.input).await {
            if !patterns.is_empty() {
                return self.build_response_from_patterns(patterns, request).await;
            }
        }

        // Fall back to clarification
        Ok(self.build_clarification_response(request))
    }
}
```

## Performance Considerations

1. **Latency Targets**
   - Intent Classification: < 200ms (with cache), < 2s (without)
   - Entity Extraction: < 300ms
   - Query Translation: < 500ms
   - End-to-End: < 3s (cold), < 500ms (warm)

2. **Concurrency**
   - Process components in parallel where possible
   - Use async/await for I/O operations
   - Implement connection pooling for LLM APIs

3. **Resource Management**
   - Limit concurrent LLM requests per user
   - Implement backpressure for streaming responses
   - Monitor token usage and enforce quotas

## Testing Strategy

1. **Unit Tests**
   - Test each component in isolation
   - Mock LLM responses
   - Test error handling and fallbacks

2. **Integration Tests**
   - Test full NLP pipeline
   - Test with real LLM APIs (dev environment)
   - Test caching behavior

3. **Performance Tests**
   - Load testing with concurrent users
   - Latency benchmarks
   - Cache hit rate analysis

4. **Quality Tests**
   - Intent classification accuracy
   - Entity extraction precision/recall
   - Query translation correctness
