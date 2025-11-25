# Core Engine Components - Architecture Overview

## Executive Summary

This document provides a comprehensive overview of the three core engine components that power the LLM-CoPilot-Agent system:

1. **NLP Engine** - Natural language understanding and query translation
2. **Context Engine** - Multi-tier memory management and learning
3. **Workflow Engine** - DAG-based orchestration and state management
4. **Response Streaming** - Real-time SSE-based delivery

These engines work together to provide intelligent, context-aware DevOps automation with conversational interfaces.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LLM-CoPilot-Agent System                         │
└─────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   HTTP API   │
                              │  (Axum/gRPC) │
                              └──────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
         ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
         │   NLP Engine     │ │   Context    │ │   Workflow       │
         │                  │ │   Engine     │ │   Engine         │
         │ ┌──────────────┐ │ │ ┌──────────┐ │ │ ┌──────────────┐ │
         │ │Intent        │ │ │ │Short-term│ │ │ │DAG Builder   │ │
         │ │Classifier    │ │ │ │Memory    │ │ │ │              │ │
         │ └──────────────┘ │ │ └──────────┘ │ │ └──────────────┘ │
         │ ┌──────────────┐ │ │ ┌──────────┐ │ │ ┌──────────────┐ │
         │ │Entity        │ │ │ │Medium-   │ │ │ │Task Executor │ │
         │ │Extractor     │ │ │ │term      │ │ │ │              │ │
         │ └──────────────┘ │ │ └──────────┘ │ │ └──────────────┘ │
         │ ┌──────────────┐ │ │ ┌──────────┐ │ │ ┌──────────────┐ │
         │ │Query         │ │ │ │Long-term │ │ │ │State Machine │ │
         │ │Translator    │ │ │ │Memory    │ │ │ │              │ │
         │ └──────────────┘ │ │ └──────────┘ │ │ └──────────────┘ │
         └──────────────────┘ └──────────────┘ └──────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │  Response Streaming    │
                         │  ┌──────────────────┐  │
                         │  │  SSE Handler     │  │
                         │  └──────────────────┘  │
                         │  ┌──────────────────┐  │
                         │  │  Backpressure    │  │
                         │  └──────────────────┘  │
                         │  ┌──────────────────┐  │
                         │  │  Cache Manager   │  │
                         │  └──────────────────┘  │
                         └────────────────────────┘
                                      │
                                      ▼
                                  Client

┌─────────────────────────────────────────────────────────────────────┐
│                         Infrastructure Layer                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   LLM    │  │  Redis   │  │PostgreSQL│  │  Vector DB       │   │
│  │   API    │  │  Cache   │  │          │  │  (Qdrant)        │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### Request Flow

```
1. User Input
   "Show me CPU usage for auth-service in the last hour"
        │
        ▼
2. NLP Engine
   ├─ Intent Classification
   │  └─ Result: QueryMetrics (confidence: 0.95)
   │
   ├─ Entity Extraction
   │  ├─ Service: "auth-service"
   │  └─ TimeRange: "1h"
   │
   └─ Query Translation
      └─ PromQL: rate(cpu_usage{service="auth-service"}[1h])
        │
        ▼
3. Context Engine
   ├─ Retrieve relevant context
   │  ├─ Short-term: Last 3 conversation turns
   │  ├─ Medium-term: Recent queries about auth-service
   │  └─ Long-term: User prefers visual charts
   │
   └─ Token budget management
      └─ Fit context within 8000 token budget
        │
        ▼
4. Execute Query
   ├─ Run PromQL query against Prometheus
   └─ Get results
        │
        ▼
5. Response Streaming
   ├─ Create stream
   ├─ Send progress updates
   ├─ Stream visualization data
   └─ Send completion
        │
        ▼
6. Update Context
   ├─ Store conversation turn
   ├─ Update entity focus
   └─ Learn user preferences
        │
        ▼
7. Client receives real-time updates
```

### Workflow Execution Flow

```
1. User Input
   "Deploy version 2.0 to production with approval"
        │
        ▼
2. NLP Engine
   ├─ Intent: ExecuteWorkflow
   ├─ Entities: version=2.0, environment=production
   └─ Extract workflow parameters
        │
        ▼
3. Workflow Engine
   ├─ Parse workflow definition
   ├─ Build DAG
   │  └─ Tasks: [validate, build, test, approve, deploy, verify]
   │
   ├─ Create workflow instance
   │
   └─ Start execution
      ├─ Batch 1: [validate, build, test] (parallel)
      ├─ Batch 2: [approve] (approval gate)
      └─ Batch 3: [deploy, verify] (sequential)
        │
        ▼
4. Response Streaming
   ├─ Stream: "Task 'validate' started"
   ├─ Stream: "Task 'validate' completed"
   ├─ Stream: "Task 'build' started"
   ├─ ... (continuous updates)
   └─ Stream: "Workflow completed successfully"
        │
        ▼
5. Context Engine
   ├─ Store workflow execution
   ├─ Learn deployment patterns
   └─ Update preferences
```

## Data Flow Diagrams

### NLP Processing Pipeline

```
User Input → Intent Classifier ─────────────┐
                                             │
User Input → Entity Extractor ──────────────┼─→ Context Resolver
                                             │
Context DB → Session History ───────────────┘
                                             │
                                             ▼
                                    Enriched Request
                                             │
                                             ├─→ Query Translator → PromQL/LogQL
                                             │
                                             └─→ Action Planner → Workflow
                                             │
                                             ▼
                                    Response Generator
                                             │
                                             ▼
                                    Streaming Response
```

### Context Retrieval Flow

```
Request
   │
   ▼
┌─────────────────────────────────────────┐
│  Parallel Retrieval from Memory Tiers   │
├─────────────────────────────────────────┤
│                                         │
│  Short-term (Redis)                     │
│  ├─ Current conversation                │
│  └─ Active entities                     │
│                                         │
│  Medium-term (PostgreSQL)               │
│  ├─ Session history                     │
│  └─ Recent context                      │
│                                         │
│  Long-term (Vector DB)                  │
│  ├─ Semantic search                     │
│  └─ Learned patterns                    │
└─────────────────────────────────────────┘
   │
   ▼
Relevance Scoring
   │
   ▼
Token Budget Allocation
   │
   ▼
Priority Selection
   │
   ▼
Compression (if needed)
   │
   ▼
Assembled Context
```

### Workflow Execution Flow

```
Workflow Definition (YAML)
   │
   ▼
Parser & Validator
   │
   ▼
DAG Builder
   ├─ Build dependency graph
   ├─ Detect cycles
   └─ Topological sort
   │
   ▼
Execution Batches
   │
   ├─────────────┐
   │             │
   ▼             ▼
Batch 1      Checkpoint
(Parallel)      │
   │             │
   ▼             ▼
Batch 2      Checkpoint
(Approval)      │
   │             │
   ▼             ▼
Batch 3      Checkpoint
(Sequential)    │
   │             │
   └─────────────┘
   │
   ▼
Completion
```

## Technology Stack

### NLP Engine
- **LLM Integration**: Claude API (Anthropic)
- **Caching**: Redis (3-tier cache)
- **Fallback**: Rule-based classifier
- **Language**: Rust (async/await, tokio)

### Context Engine
- **Short-term**: Redis (in-memory, 5min TTL)
- **Medium-term**: PostgreSQL (24hr retention)
- **Long-term**: Qdrant (vector DB, 90day retention)
- **Compression**: LLM-based summarization
- **Language**: Rust + SQL

### Workflow Engine
- **Execution**: Tokio async runtime
- **DAG**: In-memory graph (petgraph)
- **State**: PostgreSQL + Redis
- **Checkpoints**: PostgreSQL + S3
- **Language**: Rust

### Response Streaming
- **Protocol**: Server-Sent Events (SSE)
- **Framework**: Axum (Rust web framework)
- **Cache**: Redis Streams
- **Transport**: HTTP/2
- **Language**: Rust

## Performance Targets

### Latency Goals

| Component | Cold Start | Warm (Cached) | P95 | P99 |
|-----------|-----------|---------------|-----|-----|
| NLP Engine | < 2s | < 500ms | < 3s | < 5s |
| Context Retrieval | < 100ms | < 20ms | < 200ms | < 500ms |
| Workflow Start | < 50ms | < 20ms | < 100ms | < 200ms |
| Stream Chunk | - | < 10ms | < 50ms | < 100ms |

### Throughput Goals

| Component | Target | Max Burst |
|-----------|--------|-----------|
| NLP Requests | 100 req/s | 500 req/s |
| Context Lookups | 1000 req/s | 5000 req/s |
| Workflow Tasks | 50 tasks/s | 200 tasks/s |
| Stream Chunks | 10K chunks/s | 50K chunks/s |

### Resource Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Memory per Request | 100MB | Including context |
| Context Token Budget | 8000 tokens | Configurable |
| Concurrent Workflows | 100 | Per instance |
| Active Streams | 1000 | Per instance |
| Cache Size (Redis) | 10GB | Shared across tiers |
| DB Connections | 100 | PostgreSQL pool |

## Scalability

### Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
└─────────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │Instance│  │Instance│  │Instance│
   │   1    │  │   2    │  │   3    │
   └────────┘  └────────┘  └────────┘
        │           │           │
        └───────────┼───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
   ┌─────────┐           ┌───────────┐
   │  Redis  │           │PostgreSQL │
   │(Cluster)│           │ (Primary) │
   └─────────┘           └───────────┘
                              │
                         ┌────┴────┐
                         │         │
                    ┌────▼───┐ ┌───▼────┐
                    │Replica1│ │Replica2│
                    └────────┘ └────────┘
```

### Scaling Strategies

1. **Stateless API Layer**
   - All instances are identical
   - No session affinity required
   - Automatic failover

2. **Shared State in Redis**
   - Session data
   - Short-term context
   - Stream buffers
   - Rate limiting counters

3. **Database Replication**
   - Read replicas for context retrieval
   - Write to primary for workflows
   - Eventual consistency acceptable

4. **Distributed Caching**
   - Redis Cluster for high availability
   - Consistent hashing
   - Automatic shard rebalancing

## Fault Tolerance

### Recovery Mechanisms

1. **NLP Engine**
   - Fallback to rule-based classification
   - Cache redundancy (memory + Redis)
   - Retry with exponential backoff
   - Circuit breaker for LLM API

2. **Context Engine**
   - Multi-tier redundancy
   - Graceful degradation (skip long-term if slow)
   - Automatic cache warming
   - Background synchronization

3. **Workflow Engine**
   - Checkpoint-based recovery
   - Idempotent task execution
   - Automatic retry with policy
   - State persistence (PostgreSQL + S3)

4. **Response Streaming**
   - Reconnection with resume tokens
   - Partial response caching
   - Client-side buffering
   - Heartbeat monitoring

### Failure Scenarios

| Scenario | Impact | Recovery Strategy |
|----------|--------|-------------------|
| LLM API Down | High | Fallback to rules, cached responses |
| Redis Down | Medium | Degrade to DB only, no caching |
| PostgreSQL Down | High | Failover to replica, read-only mode |
| Vector DB Down | Low | Skip semantic search, use recent only |
| Network Partition | Medium | Retry with backoff, queue requests |
| OOM | High | Reduce context size, kill streams |

## Security Considerations

### Authentication & Authorization

```rust
// User authentication
pub struct AuthContext {
    pub user_id: String,
    pub roles: Vec<String>,
    pub permissions: Vec<Permission>,
    pub session_token: String,
}

// Permission check in workflow
pub async fn check_permission(
    user: &AuthContext,
    action: &str,
    resource: &str,
) -> Result<(), AuthError> {
    // Implement RBAC
}
```

### Data Privacy

1. **Context Isolation**
   - User data segregation
   - Session-based access control
   - Automatic PII redaction

2. **Encryption**
   - TLS for all external communication
   - Encryption at rest for sensitive context
   - Secret management (Vault/AWS KMS)

3. **Audit Logging**
   - All workflow executions logged
   - Context access tracked
   - LLM interactions recorded

## Monitoring & Observability

### Metrics Collection

```rust
pub struct EngineMetrics {
    // NLP metrics
    pub intent_classification_latency: Histogram,
    pub entity_extraction_accuracy: Gauge,
    pub llm_api_calls: Counter,
    pub cache_hit_rate: Gauge,

    // Context metrics
    pub context_retrieval_latency: Histogram,
    pub context_size_bytes: Histogram,
    pub memory_tier_distribution: Histogram,

    // Workflow metrics
    pub workflow_executions: Counter,
    pub task_success_rate: Gauge,
    pub workflow_duration: Histogram,
    pub checkpoint_frequency: Histogram,

    // Streaming metrics
    pub active_streams: Gauge,
    pub chunks_sent: Counter,
    pub reconnections: Counter,
    pub backpressure_events: Counter,
}
```

### Health Checks

```rust
#[derive(Serialize)]
pub struct HealthCheck {
    pub status: HealthStatus,
    pub components: HashMap<String, ComponentHealth>,
    pub timestamp: DateTime<Utc>,
}

pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

pub struct ComponentHealth {
    pub status: HealthStatus,
    pub latency_ms: Option<f64>,
    pub error_rate: Option<f32>,
    pub message: Option<String>,
}
```

## Testing Strategy

### Unit Tests
- Component-level testing
- Mock LLM responses
- Deterministic test data
- Coverage target: >80%

### Integration Tests
- Full pipeline testing
- Real LLM API (dev environment)
- Database integration
- Cache behavior validation

### Load Tests
- Concurrent user simulation
- Stress testing (2x normal load)
- Spike testing (10x burst)
- Soak testing (24hr sustained)

### Chaos Engineering
- Random component failures
- Network partitions
- Resource exhaustion
- Latency injection

## Deployment

### Container Architecture

```yaml
# docker-compose.yml (simplified)
services:
  api:
    image: llm-copilot-agent:latest
    replicas: 3
    environment:
      - RUST_LOG=info
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
    depends_on:
      - redis
      - postgres
      - qdrant

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:15
    volumes:
      - pg-data:/var/lib/postgresql/data

  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant-data:/qdrant/storage
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-copilot-agent
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
      containers:
      - name: api
        image: llm-copilot-agent:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

## Future Enhancements

### Phase 2
1. Multi-modal input (images, logs, traces)
2. Advanced workflow patterns (loops, conditionals)
3. Custom plugin system
4. Fine-tuned classification models

### Phase 3
1. Multi-tenancy support
2. Federation across regions
3. Real-time collaboration
4. Advanced analytics dashboard

### Phase 4
1. Autonomous agent capabilities
2. Predictive maintenance
3. Self-healing systems
4. Cost optimization recommendations

## References

### Internal Documentation
- [NLP Engine Architecture](./01-nlp-engine-architecture.md)
- [Context Engine Architecture](./02-context-engine-architecture.md)
- [Workflow Engine Architecture](./03-workflow-engine-architecture.md)
- [Response Streaming Architecture](./04-response-streaming-architecture.md)

### External Resources
- [Rust Async Book](https://rust-lang.github.io/async-book/)
- [Axum Framework](https://docs.rs/axum/)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [PromQL Documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/)

## Glossary

- **DAG**: Directed Acyclic Graph
- **SSE**: Server-Sent Events
- **PromQL**: Prometheus Query Language
- **LogQL**: Loki Query Language
- **TTL**: Time To Live
- **RBAC**: Role-Based Access Control
- **PII**: Personally Identifiable Information
- **LRU**: Least Recently Used
- **MPSC**: Multi-Producer Single-Consumer (channel)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-25
**Authors**: LLM-CoPilot-Agent Architecture Team
