# Integration Architecture - Component Interfaces

## Overview
This document details how the core engines (NLP, Context, Workflow, Streaming) integrate with each other and with external systems.

## Complete System Integration

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              LLM-CoPilot-Agent Platform                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                   ┌─────────────────┐
                                   │  Client Layer   │
                                   │  - Web UI       │
                                   │  - CLI          │
                                   │  - VSCode Ext   │
                                   │  - Slack Bot    │
                                   └────────┬────────┘
                                            │
                                            │ HTTP/SSE
                                            │
                    ┌───────────────────────┴────────────────────────┐
                    │                                                 │
            ┌───────▼────────┐                              ┌────────▼────────┐
            │  API Gateway   │                              │  WebSocket      │
            │  - Auth        │                              │  Handler        │
            │  - Rate Limit  │                              │  (Real-time)    │
            │  - Routing     │                              └─────────────────┘
            └───────┬────────┘
                    │
        ┌───────────┴────────────┬─────────────────┬──────────────────┐
        │                        │                 │                  │
        ▼                        ▼                 ▼                  ▼
┌───────────────┐      ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐
│  NLP Service  │      │ Context Service │  │   Workflow   │  │  Streaming  │
│               │      │                 │  │   Service    │  │   Service   │
└───────┬───────┘      └────────┬────────┘  └──────┬───────┘  └──────┬──────┘
        │                       │                   │                 │
        │                       │                   │                 │
        │   ┌───────────────────┴───────────────────┴─────────────────┤
        │   │                Message Bus (Internal)                   │
        │   │                     (Channels)                           │
        │   └─────────────────────────────────────────────────────────┘
        │                       │                   │                 │
        ▼                       ▼                   ▼                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Shared Infrastructure                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Redis   │  │PostgreSQL│  │  Qdrant    │  │    S3/Object         │  │
│  │  Cluster │  │ Primary  │  │(Vector DB) │  │    Storage           │  │
│  │          │  │          │  │            │  │                      │  │
│  │- Cache   │  │- Context │  │- Embeddings│  │- Checkpoints         │  │
│  │- Sessions│  │- Workflow│  │- Semantic  │  │- Logs                │  │
│  │- Streams │  │- Metrics │  │  Search    │  │- Artifacts           │  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────────────┘  │
│                     │                                                    │
│              ┌──────┴──────┐                                            │
│              │   Replicas  │                                            │
│              └─────────────┘                                            │
└──────────────────────────────────────────────────────────────────────────┘
        │                       │                   │                 │
        ▼                       ▼                   ▼                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         External Systems                                  │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │   LLM    │  │Prometheus│  │   Loki     │  │    Kubernetes        │  │
│  │   API    │  │          │  │            │  │    Cluster           │  │
│  │(Anthropic│  │- Metrics │  │- Logs      │  │                      │  │
│  │ Claude)  │  │- Alerts  │  │            │  │- Deploy              │  │
│  └──────────┘  └──────────┘  └────────────┘  │- Scale               │  │
│                                               │- Monitor             │  │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  └──────────────────────┘  │
│  │  Tempo   │  │ Grafana  │  │   Slack    │                            │
│  │          │  │          │  │            │                            │
│  │- Traces  │  │- Dashbrd │  │- Notif     │                            │
│  └──────────┘  └──────────┘  └────────────┘                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## Service Interface Definitions

### NLP Service API

```rust
/// gRPC service definition for NLP
#[tonic::async_trait]
pub trait NlpService {
    /// Process natural language input
    async fn process_input(
        &self,
        request: ProcessInputRequest,
    ) -> Result<ProcessInputResponse, Status>;

    /// Classify intent only
    async fn classify_intent(
        &self,
        request: ClassifyRequest,
    ) -> Result<ClassifyResponse, Status>;

    /// Extract entities only
    async fn extract_entities(
        &self,
        request: ExtractRequest,
    ) -> Result<ExtractResponse, Status>;

    /// Translate to query language
    async fn translate_query(
        &self,
        request: TranslateRequest,
    ) -> Result<TranslateResponse, Status>;

    /// Stream processing (long-running)
    async fn process_stream(
        &self,
        request: ProcessInputRequest,
    ) -> Result<tonic::Streaming<NlpStreamChunk>, Status>;
}

#[derive(Serialize, Deserialize)]
pub struct ProcessInputRequest {
    pub input: String,
    pub session_id: String,
    pub user_id: String,
    pub context_hints: HashMap<String, String>,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessInputResponse {
    pub intent: ClassifiedIntent,
    pub entities: Vec<Entity>,
    pub queries: Vec<TranslatedQuery>,
    pub suggested_actions: Vec<Action>,
    pub confidence: f32,
}

#[derive(Serialize, Deserialize)]
pub enum Action {
    ExecuteQuery { query: TranslatedQuery },
    ExecuteWorkflow { workflow_id: String, params: HashMap<String, String> },
    RequestClarification { question: String, options: Vec<String> },
}
```

### Context Service API

```rust
#[tonic::async_trait]
pub trait ContextService {
    /// Get context for request
    async fn get_context(
        &self,
        request: GetContextRequest,
    ) -> Result<GetContextResponse, Status>;

    /// Store context entry
    async fn store_context(
        &self,
        request: StoreContextRequest,
    ) -> Result<StoreContextResponse, Status>;

    /// Update session
    async fn update_session(
        &self,
        request: UpdateSessionRequest,
    ) -> Result<UpdateSessionResponse, Status>;

    /// Query context
    async fn query_context(
        &self,
        request: QueryContextRequest,
    ) -> Result<QueryContextResponse, Status>;
}

#[derive(Serialize, Deserialize)]
pub struct GetContextRequest {
    pub session_id: String,
    pub user_id: String,
    pub current_input: String,
    pub max_tokens: usize,
    pub include_tiers: Vec<MemoryTier>,
}

#[derive(Serialize, Deserialize)]
pub struct GetContextResponse {
    pub entries: Vec<ContextEntry>,
    pub total_tokens: usize,
    pub sources: ContextSources,
    pub summary: Option<String>,
}
```

### Workflow Service API

```rust
#[tonic::async_trait]
pub trait WorkflowService {
    /// Create workflow
    async fn create_workflow(
        &self,
        request: CreateWorkflowRequest,
    ) -> Result<CreateWorkflowResponse, Status>;

    /// Start execution
    async fn start_workflow(
        &self,
        request: StartWorkflowRequest,
    ) -> Result<StartWorkflowResponse, Status>;

    /// Get status
    async fn get_workflow_status(
        &self,
        request: GetWorkflowStatusRequest,
    ) -> Result<GetWorkflowStatusResponse, Status>;

    /// Stream events
    async fn stream_workflow_events(
        &self,
        request: StreamEventsRequest,
    ) -> Result<tonic::Streaming<WorkflowEvent>, Status>;

    /// Control operations
    async fn control_workflow(
        &self,
        request: ControlWorkflowRequest,
    ) -> Result<ControlWorkflowResponse, Status>;
}

#[derive(Serialize, Deserialize)]
pub struct CreateWorkflowRequest {
    pub definition: WorkflowDefinition,
    pub user_id: String,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
pub struct ControlWorkflowRequest {
    pub instance_id: String,
    pub action: ControlAction,
}

#[derive(Serialize, Deserialize)]
pub enum ControlAction {
    Pause,
    Resume,
    Cancel,
    Retry { task_id: String },
    Approve { approval_id: String },
    Reject { approval_id: String, reason: String },
}
```

### Streaming Service API

```rust
#[tonic::async_trait]
pub trait StreamingService {
    /// Create new stream
    async fn create_stream(
        &self,
        request: CreateStreamRequest,
    ) -> Result<CreateStreamResponse, Status>;

    /// Subscribe to stream (SSE)
    async fn subscribe_stream(
        &self,
        request: SubscribeStreamRequest,
    ) -> Result<tonic::Streaming<StreamChunk>, Status>;

    /// Send to stream
    async fn send_chunk(
        &self,
        request: SendChunkRequest,
    ) -> Result<SendChunkResponse, Status>;

    /// Close stream
    async fn close_stream(
        &self,
        request: CloseStreamRequest,
    ) -> Result<CloseStreamResponse, Status>;
}
```

## Integration Patterns

### Pattern 1: Simple Query Flow

```
Client
  │
  │ POST /api/query
  │ { "input": "Show CPU usage" }
  │
  ▼
API Gateway
  │
  │ auth + rate limit
  │
  ▼
NLP Service
  │
  ├─▶ Intent: QueryMetrics
  ├─▶ Entity: metric=cpu
  │
  ├─▶ Context Service
  │   └─▶ Returns: recent queries, user prefs
  │
  ├─▶ Translate to PromQL
  │   └─▶ "rate(cpu_usage[5m])"
  │
  ▼
Execute Query (external)
  │
  ├─▶ Prometheus API
  │   └─▶ Returns: time series data
  │
  ▼
Response Generator
  │
  ├─▶ Format results
  ├─▶ Add visualization
  │
  ▼
Context Service
  │
  └─▶ Store conversation turn
  │
  ▼
Client
  │
  └─▶ Display results
```

### Pattern 2: Workflow with Streaming

```
Client
  │
  │ POST /api/workflow/execute
  │ { "workflow": "deploy", "params": {...} }
  │
  ▼
API Gateway
  │
  ▼
Workflow Service
  │
  ├─▶ Create workflow instance
  ├─▶ Build DAG
  │
  ├─▶ Streaming Service
  │   └─▶ Create stream
  │       └─▶ Returns: stream_id
  │
  ├─▶ Start execution (async)
  │
  ▼
Client
  │
  ├─▶ Subscribe to stream
  │   └─▶ GET /stream?stream_id=xxx
  │
  │
Workflow Executor (background)
  │
  ├─▶ For each task:
  │   │
  │   ├─▶ Streaming Service
  │   │   └─▶ Send: TaskStarted
  │   │
  │   ├─▶ Execute task
  │   │
  │   ├─▶ Checkpoint Manager
  │   │   └─▶ Save checkpoint
  │   │
  │   ├─▶ Streaming Service
  │   │   └─▶ Send: TaskCompleted
  │   │
  │   └─▶ Context Service
  │       └─▶ Store task result
  │
  ▼
Client receives real-time updates via SSE
```

### Pattern 3: Conversational Context

```
Turn 1:
Client: "Show me errors for auth-service"
  │
  ▼
NLP Service
  ├─▶ Intent: QueryLogs
  ├─▶ Entity: service=auth-service, level=error
  │
  ▼
Context Service
  ├─▶ Store: entities in focus
  ├─▶ Store: conversation turn
  │
  ▼
Execute & Respond

Turn 2:
Client: "What about in the last hour?"
  │
  ▼
NLP Service
  ├─▶ Intent: QueryLogs (same)
  ├─▶ Entity: time_range=1h
  │
  ├─▶ Context Service
  │   └─▶ Retrieve: auth-service, error (from Turn 1)
  │   └─▶ Resolve: "in the last hour" → time_range
  │
  ▼
Query: "errors for auth-service in last 1h"
  │
  ▼
Context Service
  ├─▶ Update: time_range preference
  ├─▶ Store: conversation turn
```

## Message Bus Implementation

```rust
use tokio::sync::mpsc;

/// Internal message bus for inter-service communication
pub struct MessageBus {
    nlp_tx: mpsc::Sender<NlpMessage>,
    context_tx: mpsc::Sender<ContextMessage>,
    workflow_tx: mpsc::Sender<WorkflowMessage>,
    stream_tx: mpsc::Sender<StreamMessage>,
}

#[derive(Debug, Clone)]
pub enum NlpMessage {
    ProcessRequest { request_id: String, input: String },
    ClassifyIntent { request_id: String, input: String },
    ExtractEntities { request_id: String, input: String },
}

#[derive(Debug, Clone)]
pub enum ContextMessage {
    GetContext { request_id: String, session_id: String },
    StoreEntry { entry: ContextEntry },
    UpdateSession { session_id: String, updates: HashMap<String, String> },
}

#[derive(Debug, Clone)]
pub enum WorkflowMessage {
    CreateWorkflow { definition: WorkflowDefinition },
    StartWorkflow { instance_id: String },
    ControlWorkflow { instance_id: String, action: ControlAction },
}

#[derive(Debug, Clone)]
pub enum StreamMessage {
    CreateStream { stream_id: String },
    SendChunk { stream_id: String, chunk: StreamChunk },
    CloseStream { stream_id: String },
}

impl MessageBus {
    pub fn new(buffer_size: usize) -> Self {
        let (nlp_tx, nlp_rx) = mpsc::channel(buffer_size);
        let (context_tx, context_rx) = mpsc::channel(buffer_size);
        let (workflow_tx, workflow_rx) = mpsc::channel(buffer_size);
        let (stream_tx, stream_rx) = mpsc::channel(buffer_size);

        // Start message handlers
        tokio::spawn(Self::handle_nlp_messages(nlp_rx));
        tokio::spawn(Self::handle_context_messages(context_rx));
        tokio::spawn(Self::handle_workflow_messages(workflow_rx));
        tokio::spawn(Self::handle_stream_messages(stream_rx));

        Self {
            nlp_tx,
            context_tx,
            workflow_tx,
            stream_tx,
        }
    }

    pub async fn send_nlp(&self, msg: NlpMessage) -> Result<(), String> {
        self.nlp_tx
            .send(msg)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn send_context(&self, msg: ContextMessage) -> Result<(), String> {
        self.context_tx
            .send(msg)
            .await
            .map_err(|e| e.to_string())
    }

    async fn handle_nlp_messages(mut rx: mpsc::Receiver<NlpMessage>) {
        while let Some(msg) = rx.recv().await {
            // Process NLP message
            match msg {
                NlpMessage::ProcessRequest { request_id, input } => {
                    // Handle processing
                }
                _ => {}
            }
        }
    }

    async fn handle_context_messages(mut rx: mpsc::Receiver<ContextMessage>) {
        while let Some(msg) = rx.recv().await {
            // Process context message
        }
    }

    async fn handle_workflow_messages(mut rx: mpsc::Receiver<WorkflowMessage>) {
        while let Some(msg) = rx.recv().await {
            // Process workflow message
        }
    }

    async fn handle_stream_messages(mut rx: mpsc::Receiver<StreamMessage>) {
        while let Some(msg) = rx.recv().await {
            // Process stream message
        }
    }
}
```

## State Synchronization

### Cross-Service State

```rust
/// Shared state manager using Redis
pub struct SharedStateManager {
    redis: Arc<redis::Client>,
}

impl SharedStateManager {
    /// Store workflow state accessible by all services
    pub async fn store_workflow_state(
        &self,
        instance_id: &str,
        state: &WorkflowState,
    ) -> Result<(), String> {
        let key = format!("workflow:state:{}", instance_id);
        let serialized = serde_json::to_string(state)
            .map_err(|e| e.to_string())?;

        let mut conn = self.redis.get_async_connection()
            .await
            .map_err(|e| e.to_string())?;

        redis::cmd("SET")
            .arg(&key)
            .arg(&serialized)
            .arg("EX")
            .arg(3600) // 1 hour TTL
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Publish event to all subscribers
    pub async fn publish_event(
        &self,
        channel: &str,
        event: &str,
    ) -> Result<(), String> {
        let mut conn = self.redis.get_async_connection()
            .await
            .map_err(|e| e.to_string())?;

        redis::cmd("PUBLISH")
            .arg(channel)
            .arg(event)
            .query_async(&mut conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Subscribe to events
    pub async fn subscribe(
        &self,
        channels: Vec<String>,
    ) -> Result<mpsc::Receiver<String>, String> {
        let mut conn = self.redis.get_async_connection()
            .await
            .map_err(|e| e.to_string())?;

        let mut pubsub = conn.into_pubsub();

        for channel in channels {
            pubsub.subscribe(&channel)
                .await
                .map_err(|e| e.to_string())?;
        }

        let (tx, rx) = mpsc::channel(100);

        tokio::spawn(async move {
            let mut stream = pubsub.on_message();
            while let Some(msg) = stream.next().await {
                let payload: String = msg.get_payload().unwrap_or_default();
                let _ = tx.send(payload).await;
            }
        });

        Ok(rx)
    }
}
```

## Event-Driven Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      Event Flow                                │
└────────────────────────────────────────────────────────────────┘

Event: WorkflowStarted
  │
  ├─▶ Workflow Service
  │   └─▶ Update internal state
  │
  ├─▶ Context Service
  │   └─▶ Store workflow context
  │
  ├─▶ Streaming Service
  │   └─▶ Notify subscribers
  │
  └─▶ Monitoring Service
      └─▶ Record metric

Event: TaskCompleted
  │
  ├─▶ Workflow Service
  │   └─▶ Advance to next task
  │
  ├─▶ Context Service
  │   └─▶ Store task output
  │
  └─▶ Streaming Service
      └─▶ Send SSE event

Event: ApprovalRequired
  │
  ├─▶ Workflow Service
  │   └─▶ Pause execution
  │
  ├─▶ Notification Service
  │   └─▶ Send notifications
  │
  └─▶ Streaming Service
      └─▶ Notify client
```

## Error Handling & Circuit Breaker

```rust
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

/// Circuit breaker for external service calls
pub struct CircuitBreaker {
    failure_threshold: u64,
    success_threshold: u64,
    timeout: Duration,
    failures: AtomicU64,
    successes: AtomicU64,
    state: Arc<RwLock<CircuitState>>,
    last_failure_time: Arc<RwLock<Option<Instant>>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CircuitState {
    Closed,      // Normal operation
    Open,        // Blocking calls
    HalfOpen,    // Testing recovery
}

impl CircuitBreaker {
    pub fn new(
        failure_threshold: u64,
        success_threshold: u64,
        timeout: Duration,
    ) -> Self {
        Self {
            failure_threshold,
            success_threshold,
            timeout,
            failures: AtomicU64::new(0),
            successes: AtomicU64::new(0),
            state: Arc::new(RwLock::new(CircuitState::Closed)),
            last_failure_time: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn call<F, T, E>(&self, f: F) -> Result<T, E>
    where
        F: FnOnce() -> Result<T, E>,
    {
        let state = self.state.read().await.clone();

        match state {
            CircuitState::Open => {
                // Check if timeout has elapsed
                let last_failure = self.last_failure_time.read().await;
                if let Some(time) = *last_failure {
                    if time.elapsed() > self.timeout {
                        // Transition to half-open
                        *self.state.write().await = CircuitState::HalfOpen;
                        self.successes.store(0, Ordering::Relaxed);
                    } else {
                        // Still open, fail fast
                        return Err(/* circuit open error */);
                    }
                }
            }
            _ => {}
        }

        // Execute function
        let result = f();

        match result {
            Ok(value) => {
                self.on_success().await;
                Ok(value)
            }
            Err(e) => {
                self.on_failure().await;
                Err(e)
            }
        }
    }

    async fn on_success(&self) {
        let successes = self.successes.fetch_add(1, Ordering::Relaxed) + 1;
        self.failures.store(0, Ordering::Relaxed);

        let state = self.state.read().await.clone();
        if state == CircuitState::HalfOpen && successes >= self.success_threshold {
            *self.state.write().await = CircuitState::Closed;
        }
    }

    async fn on_failure(&self) {
        let failures = self.failures.fetch_add(1, Ordering::Relaxed) + 1;
        self.successes.store(0, Ordering::Relaxed);

        if failures >= self.failure_threshold {
            *self.state.write().await = CircuitState::Open;
            *self.last_failure_time.write().await = Some(Instant::now());
        }
    }
}

/// Integration with LLM API
pub struct ResilientLlmClient {
    client: Arc<dyn LlmClient>,
    circuit_breaker: Arc<CircuitBreaker>,
    fallback: Arc<dyn FallbackHandler>,
}

impl ResilientLlmClient {
    pub async fn complete(&self, request: LlmRequest) -> NlpResult<LlmResponse> {
        self.circuit_breaker
            .call(|| async {
                self.client.complete(request.clone()).await
            })
            .await
            .or_else(|e| {
                // Use fallback on failure
                self.fallback.handle_llm_failure(&request, &e)
            })
    }
}
```

## Observability Integration

```rust
use opentelemetry::trace::{Tracer, Span};
use tracing::{info, error, warn};

/// Trace an NLP request across all services
pub async fn traced_nlp_request(
    tracer: &dyn Tracer,
    request: ProcessInputRequest,
) -> ProcessInputResponse {
    let mut span = tracer.start("nlp_request");
    span.set_attribute(KeyValue::new("session_id", request.session_id.clone()));
    span.set_attribute(KeyValue::new("user_id", request.user_id.clone()));

    // Intent classification
    let intent_span = tracer.start_with_context("intent_classification", &span.context());
    let intent = classify_intent(&request.input).await;
    intent_span.end();

    // Entity extraction
    let entity_span = tracer.start_with_context("entity_extraction", &span.context());
    let entities = extract_entities(&request.input, &intent).await;
    entity_span.end();

    // Context retrieval
    let context_span = tracer.start_with_context("context_retrieval", &span.context());
    let context = get_context(&request).await;
    context_span.end();

    span.end();

    ProcessInputResponse {
        intent,
        entities,
        queries: vec![],
        suggested_actions: vec![],
        confidence: 0.9,
    }
}

/// Metrics collection
pub struct MetricsCollector {
    nlp_requests: Counter,
    context_lookups: Counter,
    workflow_executions: Counter,
    stream_chunks: Counter,
}

impl MetricsCollector {
    pub fn record_nlp_request(&self, latency_ms: f64, success: bool) {
        self.nlp_requests.inc();
        // Record histogram, etc.
    }
}
```

## Configuration Management

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    pub nlp: NlpConfig,
    pub context: ContextConfig,
    pub workflow: WorkflowConfig,
    pub streaming: StreamingConfig,
    pub infrastructure: InfraConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpConfig {
    pub llm_api_url: String,
    pub llm_api_key: String,
    pub model: String,
    pub cache_enabled: bool,
    pub confidence_threshold: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextConfig {
    pub redis_url: String,
    pub postgres_url: String,
    pub qdrant_url: String,
    pub short_term_ttl: u64,
    pub medium_term_ttl: u64,
    pub long_term_ttl: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowConfig {
    pub max_parallel_tasks: usize,
    pub checkpoint_interval: u64,
    pub enable_rollback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingConfig {
    pub buffer_size: usize,
    pub heartbeat_interval: u64,
    pub cache_ttl: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfraConfig {
    pub redis_url: String,
    pub postgres_url: String,
    pub s3_bucket: String,
    pub log_level: String,
}

impl SystemConfig {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let config = config::Config::builder()
            .add_source(config::File::with_name("config/default"))
            .add_source(config::Environment::with_prefix("APP"))
            .build()?;

        config.try_deserialize()
    }
}
```

## Deployment Configuration

```yaml
# config/production.yaml
nlp:
  llm_api_url: "https://api.anthropic.com"
  model: "claude-3-sonnet-20240229"
  cache_enabled: true
  confidence_threshold: 0.75

context:
  redis_url: "redis://redis-cluster:6379"
  postgres_url: "postgresql://postgres:5432/copilot"
  qdrant_url: "http://qdrant:6333"
  short_term_ttl: 300
  medium_term_ttl: 86400
  long_term_ttl: 7776000

workflow:
  max_parallel_tasks: 10
  checkpoint_interval: 60
  enable_rollback: true

streaming:
  buffer_size: 100
  heartbeat_interval: 30
  cache_ttl: 300

infrastructure:
  log_level: "info"
```

This integration architecture provides a complete view of how all core engines work together to deliver the LLM-CoPilot-Agent functionality.
