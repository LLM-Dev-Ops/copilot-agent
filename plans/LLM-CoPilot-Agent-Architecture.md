# LLM-CoPilot-Agent Architecture

**Document Type:** SPARC Architecture (Phase 3 of 5)
**Version:** 1.0.0
**Date:** 2025-11-25
**Status:** Draft

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [API Layer Architecture](#api-layer-architecture)
4. [Core Engine Components](#core-engine-components)
5. [Module Integration Layer](#module-integration-layer)
6. [Data Storage Architecture](#data-storage-architecture)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)
9. [Cross-Cutting Concerns](#cross-cutting-concerns)

---

## Overview

This document provides the detailed system architecture for LLM-CoPilot-Agent, translating the pseudocode designs into concrete component specifications, interfaces, and deployment configurations.

### Architecture Principles

| Principle | Implementation |
|-----------|----------------|
| **Modularity** | Layered architecture with clear boundaries |
| **Scalability** | Horizontal scaling, stateless components |
| **Resilience** | Circuit breakers, retries, graceful degradation |
| **Security** | Defense in depth, zero-trust networking |
| **Observability** | Comprehensive metrics, logs, and traces |
| **Extensibility** | Plugin architecture, adapter pattern |

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Language** | Rust 1.75+ (2024 edition) |
| **Web Framework** | Axum |
| **Async Runtime** | Tokio |
| **gRPC** | Tonic |
| **Database** | PostgreSQL 15+ |
| **Cache** | Redis 7+ |
| **Vector DB** | Qdrant |
| **Message Queue** | NATS |
| **Observability** | OpenTelemetry, Prometheus, Grafana, Jaeger |
| **Container** | Docker, Kubernetes |
| **IaC** | Terraform, Helm |

---

## System Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                            │
│  │   CLI   │  │  Web UI │  │   IDE   │  │   API   │                            │
│  │ Client  │  │  (SPA)  │  │ Plugins │  │ Clients │                            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                            │
└───────┼────────────┼────────────┼────────────┼──────────────────────────────────┘
        │            │            │            │
        └────────────┴─────┬──────┴────────────┘
                           │ HTTPS/WSS
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      API Gateway (Axum)                                  │   │
│  │  • Authentication (JWT/OAuth 2.0)  • Rate Limiting  • Request Routing   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │    REST Handler     │  │  WebSocket Server   │  │    SSE Handler      │     │
│  │    (/api/v1/*)      │  │  (Bidirectional)    │  │   (Streaming)       │     │
│  └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘     │
└─────────────┼────────────────────────┼────────────────────────┼─────────────────┘
              │                        │                        │
              └────────────────────────┼────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     Core Agent Engine                                    │   │
│  │  • Request Orchestration  • Session Management  • Circuit Breakers      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  Conversation │  │     NLP       │  │    Context    │  │   Workflow    │   │
│  │    Manager    │  │    Engine     │  │    Engine     │  │    Engine     │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
└──────────┼──────────────────┼──────────────────┼──────────────────┼───────────┘
           │                  │                  │                  │
           └──────────────────┼──────────────────┼──────────────────┘
                              ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  LLM Service  │  │   Incident    │  │   Telemetry   │  │     Test      │   │
│  │               │  │    Service    │  │    Service    │  │    Service    │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
└──────────┼──────────────────┼──────────────────┼──────────────────┼───────────┘
           │                  │                  │                  │
           ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      MODULE INTEGRATION LAYER                                    │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  Test-Bench   │  │  Observatory  │  │   Incident    │  │  Orchestrator │   │
│  │   Adapter     │  │   Adapter     │  │    Adapter    │  │    Adapter    │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
└──────────┼──────────────────┼──────────────────┼──────────────────┼───────────┘
           │ gRPC             │ OTLP             │ Events           │ gRPC
           ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL MODULES                                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ LLM-Test-     │  │    LLM-       │  │ LLM-Incident- │  │     LLM-      │   │
│  │    Bench      │  │  Observatory  │  │    Manager    │  │  Orchestrator │   │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
           │                  │                  │                  │
           └──────────────────┼──────────────────┼──────────────────┘
                              ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  PostgreSQL   │  │    Redis      │  │    Qdrant     │  │     NATS      │   │
│  │  (Primary DB) │  │   (Cache)     │  │  (Vector DB)  │  │   (Events)    │   │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │  Prometheus   │  │   Grafana     │  │    Jaeger     │  │    Vault      │   │
│  │  (Metrics)    │  │ (Dashboards)  │  │  (Tracing)    │  │  (Secrets)    │   │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Scaling Strategy |
|-----------|----------------|------------------|
| API Gateway | Request routing, auth, rate limiting | Horizontal (stateless) |
| Core Agent Engine | Request orchestration, session management | Horizontal (stateless) |
| NLP Engine | Intent classification, entity extraction | Horizontal (stateless) |
| Context Engine | Memory management, retrieval | Horizontal (shared state) |
| Workflow Engine | Task orchestration, state machine | Horizontal (partitioned) |
| Module Adapters | External system integration | Per-module scaling |

---

## API Layer Architecture

### REST API Endpoints

```yaml
openapi: 3.0.3
info:
  title: LLM-CoPilot-Agent API
  version: 1.0.0

paths:
  # Session Management
  /api/v1/sessions:
    post:
      summary: Create new session
      security: [bearerAuth: []]
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSessionRequest'
      responses:
        '201':
          description: Session created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'

  /api/v1/sessions/{sessionId}:
    get:
      summary: Get session details
    delete:
      summary: End session

  # Conversations
  /api/v1/sessions/{sessionId}/messages:
    post:
      summary: Send message
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                content:
                  type: string
                attachments:
                  type: array
                  items:
                    $ref: '#/components/schemas/Attachment'
      responses:
        '200':
          description: Response (streaming via SSE)
          content:
            text/event-stream:
              schema:
                $ref: '#/components/schemas/StreamEvent'

  # Workflows
  /api/v1/workflows:
    get:
      summary: List workflow templates
    post:
      summary: Create workflow from natural language

  /api/v1/workflows/{workflowId}/execute:
    post:
      summary: Execute workflow

  /api/v1/executions/{executionId}:
    get:
      summary: Get execution status
    delete:
      summary: Cancel execution

  # Telemetry Queries
  /api/v1/query/metrics:
    post:
      summary: Query metrics (natural language)

  /api/v1/query/logs:
    post:
      summary: Search logs (natural language)

  /api/v1/query/traces:
    post:
      summary: Query traces (natural language)

  # Test Management
  /api/v1/tests/generate:
    post:
      summary: Generate tests from specification

  /api/v1/tests/{suiteId}/execute:
    post:
      summary: Execute test suite

  # Incidents
  /api/v1/incidents:
    get:
      summary: List active incidents
    post:
      summary: Create incident

  /api/v1/incidents/{incidentId}/runbooks:
    post:
      summary: Execute runbook

components:
  schemas:
    CreateSessionRequest:
      type: object
      properties:
        projectId:
          type: string
        preferences:
          $ref: '#/components/schemas/UserPreferences'

    Session:
      type: object
      properties:
        id:
          type: string
          format: uuid
        userId:
          type: string
        createdAt:
          type: string
          format: date-time
        expiresAt:
          type: string
          format: date-time

    StreamEvent:
      type: object
      properties:
        type:
          type: string
          enum: [content, tool_call, tool_result, error, done]
        data:
          type: object

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### WebSocket Protocol

```typescript
// WebSocket Message Types
interface WebSocketMessage {
  jsonrpc: "2.0";
  id?: string;
  method?: string;
  params?: object;
  result?: object;
  error?: WebSocketError;
}

// Client -> Server Methods
type ClientMethod =
  | "session.create"
  | "message.send"
  | "message.cancel"
  | "workflow.execute"
  | "workflow.cancel"
  | "subscription.create"
  | "subscription.cancel";

// Server -> Client Events
type ServerEvent =
  | "message.chunk"
  | "message.complete"
  | "workflow.progress"
  | "workflow.complete"
  | "incident.alert"
  | "system.notification";

// Connection Lifecycle
// 1. Connect: wss://api.example.com/ws
// 2. Authenticate: send JWT in first message
// 3. Heartbeat: ping/pong every 30s
// 4. Reconnect: exponential backoff with session resume
```

### gRPC Service Definitions

```protobuf
syntax = "proto3";
package copilot.internal.v1;

// Internal Agent Service
service AgentService {
  // Process a user request
  rpc ProcessRequest(ProcessRequestInput) returns (stream ProcessRequestOutput);

  // Execute a workflow
  rpc ExecuteWorkflow(ExecuteWorkflowInput) returns (stream WorkflowProgress);

  // Query telemetry
  rpc QueryTelemetry(TelemetryQuery) returns (TelemetryResult);
}

message ProcessRequestInput {
  string session_id = 1;
  string content = 2;
  map<string, string> metadata = 3;
}

message ProcessRequestOutput {
  oneof output {
    ContentChunk content = 1;
    ToolCall tool_call = 2;
    ToolResult tool_result = 3;
    Error error = 4;
    Complete complete = 5;
  }
}

message ContentChunk {
  string text = 1;
  int32 token_count = 2;
}

message ToolCall {
  string id = 1;
  string name = 2;
  string arguments = 3;  // JSON
}
```

---

## Core Engine Components

### NLP Engine

```rust
/// Intent classification result
#[derive(Debug, Clone)]
pub struct Intent {
    pub category: IntentCategory,
    pub sub_category: Option<String>,
    pub confidence: f32,
    pub entities: Vec<Entity>,
    pub requires_clarification: bool,
}

/// NLP Engine trait
#[async_trait]
pub trait NlpEngine: Send + Sync {
    /// Classify user intent
    async fn classify_intent(
        &self,
        input: &str,
        context: &ConversationContext,
    ) -> Result<Intent, NlpError>;

    /// Extract entities from input
    async fn extract_entities(
        &self,
        input: &str,
        intent: &Intent,
    ) -> Result<Vec<Entity>, NlpError>;

    /// Translate natural language to query
    async fn translate_query(
        &self,
        input: &str,
        target: QueryLanguage,
    ) -> Result<String, NlpError>;
}

/// NLP Engine implementation
pub struct NlpEngineImpl {
    llm_client: Arc<dyn LlmClient>,
    intent_cache: Arc<Cache<String, Intent>>,
    entity_patterns: Arc<EntityPatternMatcher>,
    query_templates: Arc<QueryTemplateStore>,
}

impl NlpEngineImpl {
    pub fn new(config: NlpConfig) -> Self {
        Self {
            llm_client: Arc::new(LlmClientImpl::new(config.llm)),
            intent_cache: Arc::new(Cache::new(config.cache_size)),
            entity_patterns: Arc::new(EntityPatternMatcher::new()),
            query_templates: Arc::new(QueryTemplateStore::load(config.templates_path)),
        }
    }
}

#[async_trait]
impl NlpEngine for NlpEngineImpl {
    async fn classify_intent(
        &self,
        input: &str,
        context: &ConversationContext,
    ) -> Result<Intent, NlpError> {
        // Check cache first
        let cache_key = format!("{}:{}", context.session_id, hash(input));
        if let Some(cached) = self.intent_cache.get(&cache_key).await {
            return Ok(cached);
        }

        // Try pattern matching for common intents
        if let Some(intent) = self.entity_patterns.match_intent(input) {
            if intent.confidence > 0.95 {
                self.intent_cache.set(&cache_key, intent.clone()).await;
                return Ok(intent);
            }
        }

        // Fall back to LLM classification
        let prompt = self.build_classification_prompt(input, context);
        let response = self.llm_client.complete(&prompt).await?;
        let intent = self.parse_intent_response(&response)?;

        self.intent_cache.set(&cache_key, intent.clone()).await;
        Ok(intent)
    }

    // ... other implementations
}
```

### Context Engine

```rust
/// Multi-tier context storage
pub struct ContextEngine {
    short_term: Arc<ShortTermMemory>,    // Redis - current session
    medium_term: Arc<MediumTermMemory>,  // PostgreSQL - 7 days
    long_term: Arc<LongTermMemory>,      // Qdrant - patterns/preferences
    token_budget: TokenBudgetManager,
}

/// Short-term memory (Redis-backed)
pub struct ShortTermMemory {
    redis: RedisPool,
    ttl: Duration,
    max_messages: usize,
}

impl ShortTermMemory {
    pub async fn get_context(&self, session_id: &str) -> Result<SessionContext, ContextError> {
        let key = format!("session:{}:context", session_id);
        let data: Option<Vec<u8>> = self.redis.get(&key).await?;

        match data {
            Some(bytes) => Ok(bincode::deserialize(&bytes)?),
            None => Ok(SessionContext::default()),
        }
    }

    pub async fn update_context(
        &self,
        session_id: &str,
        context: &SessionContext,
    ) -> Result<(), ContextError> {
        let key = format!("session:{}:context", session_id);
        let bytes = bincode::serialize(context)?;

        self.redis
            .set_ex(&key, &bytes, self.ttl.as_secs() as usize)
            .await?;

        Ok(())
    }
}

/// Context retrieval with relevance scoring
impl ContextEngine {
    pub async fn retrieve_relevant_context(
        &self,
        query: &str,
        session_id: &str,
        token_budget: usize,
    ) -> Result<RetrievedContext, ContextError> {
        // Embed the query
        let query_embedding = self.embed(query).await?;

        // Search all tiers in parallel
        let (short, medium, long) = tokio::join!(
            self.short_term.search(session_id, &query_embedding),
            self.medium_term.search(session_id, &query_embedding),
            self.long_term.search(&query_embedding),
        );

        // Merge and rank results
        let mut candidates = vec![];
        candidates.extend(short?.into_iter().map(|c| (c, 1.0)));  // Recency boost
        candidates.extend(medium?.into_iter().map(|c| (c, 0.8)));
        candidates.extend(long?.into_iter().map(|c| (c, 0.6)));

        // Sort by combined relevance score
        candidates.sort_by(|a, b| {
            let score_a = a.0.similarity * a.1;
            let score_b = b.0.similarity * b.1;
            score_b.partial_cmp(&score_a).unwrap()
        });

        // Select within token budget
        self.token_budget.select_within_budget(candidates, token_budget)
    }
}
```

### Workflow Engine

```rust
/// Workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: WorkflowId,
    pub name: String,
    pub description: String,
    pub steps: Vec<WorkflowStep>,
    pub timeout: Duration,
    pub retry_policy: RetryPolicy,
}

/// Workflow step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: StepId,
    pub name: String,
    pub step_type: StepType,
    pub action: Action,
    pub dependencies: Vec<StepId>,
    pub timeout: Option<Duration>,
    pub on_failure: FailureAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepType {
    Task,
    Parallel(Vec<WorkflowStep>),
    Conditional { condition: String, if_true: Box<WorkflowStep>, if_false: Option<Box<WorkflowStep>> },
    Approval { approvers: Vec<String>, timeout: Duration },
}

/// Workflow execution engine
pub struct WorkflowEngine {
    state_store: Arc<dyn StateStore>,
    task_executor: Arc<TaskExecutor>,
    checkpoint_manager: Arc<CheckpointManager>,
    event_bus: Arc<EventBus>,
}

impl WorkflowEngine {
    pub async fn execute(
        &self,
        workflow: &WorkflowDefinition,
        params: HashMap<String, Value>,
    ) -> Result<ExecutionId, WorkflowError> {
        // Build execution DAG
        let dag = self.build_dag(workflow)?;

        // Create execution record
        let execution_id = ExecutionId::new();
        let execution = WorkflowExecution {
            id: execution_id.clone(),
            workflow_id: workflow.id.clone(),
            status: ExecutionStatus::Running,
            params,
            started_at: Utc::now(),
            step_states: HashMap::new(),
        };

        self.state_store.save_execution(&execution).await?;

        // Start execution in background
        let engine = self.clone();
        tokio::spawn(async move {
            engine.run_dag(execution_id, dag).await
        });

        Ok(execution_id)
    }

    async fn run_dag(&self, execution_id: ExecutionId, dag: Dag) -> Result<(), WorkflowError> {
        // Execute level by level
        for level in dag.levels() {
            let steps = dag.steps_at_level(level);

            // Execute steps in parallel
            let results = futures::future::join_all(
                steps.iter().map(|step| self.execute_step(&execution_id, step))
            ).await;

            // Check for failures
            for (step, result) in steps.iter().zip(results) {
                match result {
                    Ok(output) => {
                        self.state_store.update_step_status(
                            &execution_id,
                            &step.id,
                            StepStatus::Completed(output),
                        ).await?;
                    }
                    Err(e) => {
                        self.handle_step_failure(&execution_id, step, e).await?;
                    }
                }
            }

            // Create checkpoint after each level
            self.checkpoint_manager.create(&execution_id).await?;
        }

        Ok(())
    }
}
```

---

## Module Integration Layer

### Adapter Interface

```rust
/// Common adapter trait for all module integrations
#[async_trait]
pub trait ModuleAdapter: Send + Sync {
    /// Get adapter name
    fn name(&self) -> &str;

    /// Check if adapter is healthy
    async fn health_check(&self) -> Result<HealthStatus, AdapterError>;

    /// Get supported capabilities
    fn capabilities(&self) -> Vec<Capability>;
}

/// Circuit breaker wrapper for adapters
pub struct CircuitBreakerAdapter<T: ModuleAdapter> {
    inner: T,
    circuit_breaker: CircuitBreaker,
}

impl<T: ModuleAdapter> CircuitBreakerAdapter<T> {
    pub fn new(inner: T, config: CircuitBreakerConfig) -> Self {
        Self {
            inner,
            circuit_breaker: CircuitBreaker::new(config),
        }
    }

    pub async fn call<F, R, E>(&self, f: F) -> Result<R, AdapterError>
    where
        F: FnOnce(&T) -> Pin<Box<dyn Future<Output = Result<R, E>> + Send + '_>>,
        E: Into<AdapterError>,
    {
        if self.circuit_breaker.is_open() {
            return Err(AdapterError::CircuitOpen);
        }

        match f(&self.inner).await {
            Ok(result) => {
                self.circuit_breaker.record_success();
                Ok(result)
            }
            Err(e) => {
                self.circuit_breaker.record_failure();
                Err(e.into())
            }
        }
    }
}
```

### Test-Bench Adapter

```rust
#[async_trait]
pub trait TestBenchAdapter: ModuleAdapter {
    /// Generate tests from specification
    async fn generate_tests(&self, spec: TestSpec) -> Result<TestSuite, AdapterError>;

    /// Execute test suite with streaming progress
    async fn execute_suite(
        &self,
        suite: &TestSuite,
    ) -> Result<impl Stream<Item = TestProgress>, AdapterError>;

    /// Get coverage report
    async fn get_coverage(&self, project_id: &str) -> Result<CoverageReport, AdapterError>;
}

pub struct TestBenchAdapterImpl {
    client: TestBenchClient,  // gRPC client
    config: TestBenchConfig,
}

#[async_trait]
impl TestBenchAdapter for TestBenchAdapterImpl {
    async fn generate_tests(&self, spec: TestSpec) -> Result<TestSuite, AdapterError> {
        let request = tonic::Request::new(GenerateTestsRequest {
            specification: Some(spec.into()),
        });

        let response = self.client
            .generate_tests(request)
            .await
            .map_err(|e| AdapterError::Grpc(e))?;

        Ok(response.into_inner().into())
    }

    async fn execute_suite(
        &self,
        suite: &TestSuite,
    ) -> Result<impl Stream<Item = TestProgress>, AdapterError> {
        let request = tonic::Request::new(ExecuteSuiteRequest {
            suite_id: suite.id.to_string(),
        });

        let response = self.client
            .execute_suite(request)
            .await
            .map_err(|e| AdapterError::Grpc(e))?;

        Ok(response.into_inner().map(|r| r.into()))
    }
}
```

### Observatory Adapter

```rust
#[async_trait]
pub trait ObservatoryAdapter: ModuleAdapter {
    /// Query metrics using PromQL
    async fn query_metrics(
        &self,
        query: &str,
        range: TimeRange,
    ) -> Result<MetricData, AdapterError>;

    /// Search logs using LogQL
    async fn search_logs(
        &self,
        query: &str,
        range: TimeRange,
    ) -> Result<LogData, AdapterError>;

    /// Query traces using TraceQL
    async fn query_traces(
        &self,
        query: &str,
        range: TimeRange,
    ) -> Result<TraceData, AdapterError>;

    /// Detect anomalies in metrics
    async fn detect_anomalies(
        &self,
        config: AnomalyConfig,
    ) -> Result<Vec<Anomaly>, AdapterError>;
}

pub struct ObservatoryAdapterImpl {
    prometheus_client: PrometheusClient,
    loki_client: LokiClient,
    tempo_client: TempoClient,
    cache: Arc<Cache<String, CachedResult>>,
}

#[async_trait]
impl ObservatoryAdapter for ObservatoryAdapterImpl {
    async fn query_metrics(
        &self,
        query: &str,
        range: TimeRange,
    ) -> Result<MetricData, AdapterError> {
        // Check cache
        let cache_key = format!("metrics:{}:{:?}", hash(query), range);
        if let Some(cached) = self.cache.get(&cache_key).await {
            return Ok(cached.into());
        }

        // Execute query
        let result = self.prometheus_client
            .query_range(query, range.start, range.end, range.step)
            .await
            .map_err(|e| AdapterError::Query(e))?;

        // Cache result (short TTL for freshness)
        self.cache.set(&cache_key, result.clone(), Duration::from_secs(60)).await;

        Ok(result)
    }
}
```

### Module Registry

```rust
/// Module registry for service discovery
pub struct ModuleRegistry {
    adapters: RwLock<HashMap<String, Arc<dyn ModuleAdapter>>>,
    health_checker: HealthChecker,
}

impl ModuleRegistry {
    pub async fn register<T: ModuleAdapter + 'static>(
        &self,
        name: &str,
        adapter: T,
    ) -> Result<(), RegistryError> {
        // Wrap with circuit breaker
        let wrapped = CircuitBreakerAdapter::new(
            adapter,
            CircuitBreakerConfig::default(),
        );

        // Verify health before registering
        wrapped.health_check().await?;

        let mut adapters = self.adapters.write().await;
        adapters.insert(name.to_string(), Arc::new(wrapped));

        // Start health monitoring
        self.health_checker.monitor(name, Arc::clone(&adapters[name]));

        Ok(())
    }

    pub async fn get<T: ModuleAdapter>(&self, name: &str) -> Option<Arc<T>> {
        let adapters = self.adapters.read().await;
        adapters.get(name).map(|a| Arc::clone(a) as Arc<T>)
    }

    pub async fn get_healthy(&self, capability: Capability) -> Vec<Arc<dyn ModuleAdapter>> {
        let adapters = self.adapters.read().await;
        adapters
            .values()
            .filter(|a| a.capabilities().contains(&capability))
            .filter(|a| self.health_checker.is_healthy(a.name()))
            .cloned()
            .collect()
    }
}
```

---

## Data Storage Architecture

### PostgreSQL Schema

```sql
-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    roles JSONB NOT NULL DEFAULT '[]',
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    project_id VARCHAR(255),
    context JSONB NOT NULL DEFAULT '{}',
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    token_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- Workflows
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    status VARCHAR(50) NOT NULL,
    params JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error TEXT
);

CREATE INDEX idx_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);

-- Audit Logs (Partitioned)
CREATE TABLE audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID,
    actor_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Redis Data Structures

```rust
/// Redis key patterns and operations
pub struct RedisStore {
    pool: RedisPool,
}

impl RedisStore {
    // Session storage (Hash)
    pub async fn get_session(&self, session_id: &str) -> Result<Option<Session>, RedisError> {
        let key = format!("session:{}", session_id);
        let data: Option<String> = self.pool.get(&key).await?;
        Ok(data.map(|s| serde_json::from_str(&s).unwrap()))
    }

    pub async fn set_session(&self, session: &Session, ttl: Duration) -> Result<(), RedisError> {
        let key = format!("session:{}", session.id);
        let value = serde_json::to_string(session)?;
        self.pool.set_ex(&key, &value, ttl.as_secs() as usize).await
    }

    // Rate limiting (Sorted Set)
    pub async fn check_rate_limit(
        &self,
        user_id: &str,
        limit: u32,
        window: Duration,
    ) -> Result<bool, RedisError> {
        let key = format!("rate_limit:{}", user_id);
        let now = Utc::now().timestamp_millis();
        let window_start = now - window.as_millis() as i64;

        // Remove old entries
        self.pool.zremrangebyscore(&key, "-inf", &window_start.to_string()).await?;

        // Count current entries
        let count: u32 = self.pool.zcard(&key).await?;

        if count < limit {
            // Add new entry
            self.pool.zadd(&key, &[(&now.to_string(), now as f64)]).await?;
            self.pool.expire(&key, window.as_secs() as usize).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    // Response cache (String with TTL)
    pub async fn cache_response(
        &self,
        key: &str,
        response: &str,
        ttl: Duration,
    ) -> Result<(), RedisError> {
        let cache_key = format!("cache:response:{}", key);
        self.pool.set_ex(&cache_key, response, ttl.as_secs() as usize).await
    }

    // Pub/Sub for events
    pub async fn publish_event(&self, channel: &str, event: &Event) -> Result<(), RedisError> {
        let message = serde_json::to_string(event)?;
        self.pool.publish(channel, &message).await
    }
}
```

### Vector Database (Qdrant)

```rust
/// Qdrant vector store for semantic search
pub struct VectorStore {
    client: QdrantClient,
    embedding_service: Arc<dyn EmbeddingService>,
}

impl VectorStore {
    pub async fn create_collection(&self, name: &str) -> Result<(), VectorError> {
        self.client.create_collection(&CreateCollection {
            collection_name: name.to_string(),
            vectors_config: Some(VectorsConfig {
                config: Some(Config::Params(VectorParams {
                    size: 1536,  // OpenAI embedding size
                    distance: Distance::Cosine.into(),
                    ..Default::default()
                })),
            }),
            ..Default::default()
        }).await?;

        Ok(())
    }

    pub async fn upsert(&self, collection: &str, documents: Vec<Document>) -> Result<(), VectorError> {
        let points: Vec<PointStruct> = futures::future::join_all(
            documents.iter().map(|doc| async {
                let embedding = self.embedding_service.embed(&doc.content).await?;
                Ok(PointStruct {
                    id: Some(doc.id.to_string().into()),
                    vectors: Some(embedding.into()),
                    payload: doc.metadata.clone().into(),
                })
            })
        ).await.into_iter().collect::<Result<Vec<_>, VectorError>>()?;

        self.client.upsert_points(collection, points, None).await?;
        Ok(())
    }

    pub async fn search(
        &self,
        collection: &str,
        query: &str,
        limit: usize,
        filter: Option<Filter>,
    ) -> Result<Vec<SearchResult>, VectorError> {
        let query_vector = self.embedding_service.embed(query).await?;

        let results = self.client.search_points(&SearchPoints {
            collection_name: collection.to_string(),
            vector: query_vector,
            limit: limit as u64,
            filter,
            with_payload: Some(true.into()),
            ..Default::default()
        }).await?;

        Ok(results.result.into_iter().map(|r| r.into()).collect())
    }
}
```

---

## Security Architecture

### Authentication

```rust
/// JWT-based authentication
pub struct AuthService {
    jwt_secret: Vec<u8>,
    token_expiry: Duration,
    refresh_expiry: Duration,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccessTokenClaims {
    pub sub: String,          // User ID
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub session_id: String,
    pub exp: i64,
    pub iat: i64,
}

impl AuthService {
    pub fn generate_token(&self, user: &User, session_id: &str) -> Result<TokenPair, AuthError> {
        let now = Utc::now();

        let access_claims = AccessTokenClaims {
            sub: user.id.to_string(),
            roles: user.roles.clone(),
            permissions: self.get_permissions(&user.roles),
            session_id: session_id.to_string(),
            exp: (now + self.token_expiry).timestamp(),
            iat: now.timestamp(),
        };

        let access_token = encode(
            &Header::new(Algorithm::RS256),
            &access_claims,
            &EncodingKey::from_rsa_pem(&self.jwt_secret)?,
        )?;

        let refresh_token = self.generate_refresh_token(user, session_id)?;

        Ok(TokenPair {
            access_token,
            refresh_token,
            expires_in: self.token_expiry.as_secs(),
        })
    }

    pub fn verify_token(&self, token: &str) -> Result<AccessTokenClaims, AuthError> {
        let validation = Validation::new(Algorithm::RS256);
        let token_data = decode::<AccessTokenClaims>(
            token,
            &DecodingKey::from_rsa_pem(&self.jwt_secret)?,
            &validation,
        )?;

        Ok(token_data.claims)
    }
}
```

### Authorization (RBAC)

```rust
/// Role-based access control
pub struct AuthzService {
    policy_store: Arc<PolicyStore>,
}

#[derive(Debug, Clone)]
pub struct Permission {
    pub resource: String,
    pub action: String,
}

impl AuthzService {
    pub fn authorize(
        &self,
        user: &User,
        resource: &str,
        action: &str,
    ) -> Result<bool, AuthzError> {
        // Check user permissions
        let required = Permission {
            resource: resource.to_string(),
            action: action.to_string(),
        };

        // Check direct permissions
        if user.permissions.contains(&required) {
            return Ok(true);
        }

        // Check role-based permissions
        for role in &user.roles {
            let role_permissions = self.policy_store.get_role_permissions(role)?;
            if role_permissions.contains(&required) {
                return Ok(true);
            }
        }

        Ok(false)
    }
}

/// Authorization middleware
pub async fn authorize_middleware(
    State(authz): State<Arc<AuthzService>>,
    Extension(user): Extension<User>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let resource = extract_resource(&request);
    let action = request.method().as_str();

    if !authz.authorize(&user, &resource, action)? {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(request).await)
}
```

### Data Encryption

```rust
/// Encryption service for data at rest
pub struct EncryptionService {
    key: [u8; 32],
}

impl EncryptionService {
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher.encrypt(&nonce, plaintext)?;

        // Prepend nonce to ciphertext
        let mut result = nonce.to_vec();
        result.extend(ciphertext);

        Ok(result)
    }

    pub fn decrypt(&self, encrypted: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)?;

        let (nonce, ciphertext) = encrypted.split_at(12);
        let nonce = GenericArray::from_slice(nonce);

        let plaintext = cipher.decrypt(nonce, ciphertext)?;

        Ok(plaintext)
    }
}
```

---

## Deployment Architecture

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-copilot-agent
  namespace: copilot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-copilot-agent
  template:
    metadata:
      labels:
        app: llm-copilot-agent
    spec:
      serviceAccountName: copilot-agent
      containers:
        - name: agent
          image: llm-copilot-agent:latest
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 8081
              name: grpc
            - containerPort: 9090
              name: metrics
          env:
            - name: RUST_LOG
              value: "info"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: copilot-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: copilot-secrets
                  key: redis-url
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          securityContext:
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: llm-copilot-agent
---
apiVersion: v1
kind: Service
metadata:
  name: llm-copilot-agent
  namespace: copilot
spec:
  selector:
    app: llm-copilot-agent
  ports:
    - name: http
      port: 80
      targetPort: 8080
    - name: grpc
      port: 9000
      targetPort: 8081
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-copilot-agent
  namespace: copilot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-copilot-agent
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: llm-copilot-agent
  namespace: copilot
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: llm-copilot-agent
```

### Dockerfile

```dockerfile
# Build stage
FROM rust:1.75-alpine AS builder

RUN apk add --no-cache musl-dev openssl-dev

WORKDIR /app

# Cache dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# Build application
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

RUN adduser -D -u 1000 appuser
USER appuser

COPY --from=builder /app/target/release/llm-copilot-agent /usr/local/bin/

EXPOSE 8080 8081 9090

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health/live || exit 1

ENTRYPOINT ["llm-copilot-agent"]
```

---

## Cross-Cutting Concerns

### Observability

```rust
/// OpenTelemetry instrumentation
pub fn init_telemetry(config: &TelemetryConfig) -> Result<(), TelemetryError> {
    // Initialize tracing subscriber
    let tracer = opentelemetry_jaeger::new_agent_pipeline()
        .with_service_name(&config.service_name)
        .with_endpoint(&config.jaeger_endpoint)
        .install_batch(opentelemetry::runtime::Tokio)?;

    let telemetry = tracing_opentelemetry::layer().with_tracer(tracer);

    // Initialize metrics
    let metrics = opentelemetry_prometheus::exporter()
        .with_registry(prometheus::default_registry().clone())
        .build()?;

    let meter = global::meter(&config.service_name);

    // Register custom metrics
    let request_counter = meter.u64_counter("http_requests_total").init();
    let request_duration = meter.f64_histogram("http_request_duration_seconds").init();

    // Set up tracing subscriber
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(telemetry)
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    Ok(())
}

/// Request tracing middleware
pub async fn tracing_middleware(request: Request, next: Next) -> Response {
    let span = tracing::info_span!(
        "http_request",
        method = %request.method(),
        path = %request.uri().path(),
        request_id = %Uuid::new_v4(),
    );

    async move {
        let start = Instant::now();
        let response = next.run(request).await;
        let duration = start.elapsed();

        tracing::info!(
            status = %response.status(),
            duration_ms = %duration.as_millis(),
            "Request completed"
        );

        response
    }
    .instrument(span)
    .await
}
```

### Error Handling

```rust
/// Application error types
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Authentication failed: {0}")]
    Authentication(String),

    #[error("Authorization denied: {0}")]
    Authorization(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::Authentication(msg) => (StatusCode::UNAUTHORIZED, "AUTH_FAILED", msg.clone()),
            AppError::Authorization(msg) => (StatusCode::FORBIDDEN, "FORBIDDEN", msg.clone()),
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::RateLimit => (StatusCode::TOO_MANY_REQUESTS, "RATE_LIMIT", "Rate limit exceeded".to_string()),
            AppError::Internal(e) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", e.to_string()),
            AppError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", msg.clone()),
        };

        let body = Json(ErrorResponse {
            error: ErrorDetail {
                code: code.to_string(),
                message,
                request_id: get_request_id(),
            },
        });

        (status, body).into_response()
    }
}
```

### Configuration

```rust
/// Application configuration
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub llm: LlmConfig,
    pub auth: AuthConfig,
    pub telemetry: TelemetryConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub request_timeout: Duration,
}

impl Config {
    pub fn load() -> Result<Self, ConfigError> {
        let config = config::Config::builder()
            .add_source(config::File::with_name("config/default"))
            .add_source(config::File::with_name(&format!("config/{}", env::var("ENV").unwrap_or_else(|_| "development".to_string()))).required(false))
            .add_source(config::Environment::with_prefix("COPILOT"))
            .build()?;

        config.try_deserialize()
    }
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-25 | LLM DevOps Team | Initial architecture |

---

## Next Steps (SPARC Phases 4-5)

This Architecture document completes Phase 3 of the SPARC methodology. Subsequent phases will include:

1. **Refinement (Phase 4):** Implementation iteration with prototyping and feedback
2. **Completion (Phase 5):** Production-ready Rust implementation with full test coverage

---

*This architecture is part of the LLM DevOps ecosystem. For implementation details, see the detailed component specifications.*
