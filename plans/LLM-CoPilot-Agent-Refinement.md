# LLM-CoPilot-Agent Refinement

**Document Type:** SPARC Refinement (Phase 4 of 5)
**Version:** 1.0.0
**Date:** 2025-11-25
**Status:** Draft

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Roadmap](#implementation-roadmap)
3. [Testing Strategy](#testing-strategy)
4. [Performance Optimization](#performance-optimization)
5. [Error Handling](#error-handling)
6. [API Contracts](#api-contracts)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Security Hardening](#security-hardening)
9. [Quality Gates](#quality-gates)

---

## Overview

This Refinement document provides the implementation details, optimization strategies, and production readiness guidelines for LLM-CoPilot-Agent. It bridges the gap between architectural design and final implementation.

### Refinement Objectives

| Objective | Description | Success Criteria |
|-----------|-------------|------------------|
| **Implementation Clarity** | Clear roadmap with milestones | 35 milestones defined |
| **Quality Assurance** | Comprehensive testing strategy | >80% code coverage |
| **Performance** | Meet SLA requirements | <1s p95 simple queries |
| **Reliability** | Error handling and resilience | 99.9% uptime |
| **Security** | Production hardening | SOC 2 / GDPR compliant |
| **Observability** | Full monitoring coverage | <2 min MTTD |

---

## Implementation Roadmap

### Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    12-MONTH IMPLEMENTATION TIMELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Foundation        ████████░░░░░░░░░░░░░░░░░░░░  Months 1-2       │
│  Phase 2: Core Engines          ░░░░████████████░░░░░░░░  Months 3-5       │
│  Phase 3: Module Integration        ░░░░░░░░░░░████████░░  Months 6-7       │
│  Phase 4: Advanced Features             ░░░░░░░░░░░░████████  Months 8-9   │
│  Phase 5: Production Readiness              ░░░░░░░░░░░░░░████████  M10-11 │
│  Phase 6: Launch                                ░░░░░░░░░░░░░░░░████  M12  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Foundation (Weeks 1-8)

**Milestones:**
| ID | Milestone | Duration | Dependencies | Deliverables |
|----|-----------|----------|--------------|--------------|
| M1.1 | Dev Environment | Week 1 | None | Rust toolchain, IDE setup, CI skeleton |
| M1.2 | Database Schema | Week 2 | M1.1 | PostgreSQL schema, migrations |
| M1.3 | API Framework | Weeks 2-3 | M1.1 | Axum setup, JWT auth, rate limiting |
| M1.4 | Redis Layer | Week 3 | M1.2 | Session store, caching, rate limits |
| M1.5 | Observability | Weeks 4-5 | M1.3 | OpenTelemetry, Prometheus, Grafana |
| M1.6 | Kubernetes | Weeks 5-8 | M1.3-M1.5 | Helm charts, deployments, HPA |

**Acceptance Criteria:**
- [ ] All developers can build and run locally
- [ ] Database migrations run successfully
- [ ] API returns health check responses
- [ ] Metrics visible in Grafana
- [ ] Deployable to staging environment

### Phase 2: Core Engines (Weeks 9-20)

**Milestones:**
| ID | Milestone | Duration | Dependencies | Deliverables |
|----|-----------|----------|--------------|--------------|
| M2.1 | Intent Classification | Weeks 9-11 | M1.3 | 15+ intent types, >95% accuracy |
| M2.2 | Entity Extraction | Weeks 10-12 | M2.1 | Time, service, metric entities |
| M2.3 | Query Translation | Weeks 12-14 | M2.2 | NL to PromQL/LogQL/TraceQL |
| M2.4 | Multi-Tier Storage | Weeks 11-14 | M1.4 | Short/medium/long-term memory |
| M2.5 | Context Compression | Weeks 14-16 | M2.4 | 200K token management |
| M2.6 | Response Streaming | Weeks 15-17 | M2.1 | SSE, <500ms first token |
| M2.7 | Multi-Turn Dialogue | Weeks 17-20 | M2.1-M2.6 | Context retention, references |

**Acceptance Criteria:**
- [ ] Intent classification >95% accuracy on test set
- [ ] Query translation generates valid queries
- [ ] Streaming responses begin within 500ms
- [ ] Multi-turn conversations maintain context

### Phase 3: Module Integration (Weeks 21-28)

**Milestones:**
| ID | Milestone | Duration | Dependencies | Deliverables |
|----|-----------|----------|--------------|--------------|
| M3.1 | Test-Bench Adapter | Weeks 21-23 | M2.3 | Test generation, execution, coverage |
| M3.2 | Observatory Adapter | Weeks 21-23 | M2.3 | Metrics, logs, traces queries |
| M3.3 | Incident Adapter | Weeks 23-25 | M2.7 | Incident creation, runbook execution |
| M3.4 | Orchestrator Adapter | Weeks 23-25 | M2.7 | Workflow triggering, status |
| M3.5 | gRPC Service Mesh | Weeks 25-27 | M3.1-M3.4 | Inter-service communication |
| M3.6 | NATS Event Bus | Weeks 26-28 | M3.5 | Async event handling |

**Acceptance Criteria:**
- [ ] All four module adapters functional
- [ ] Circuit breakers prevent cascade failures
- [ ] Event-driven updates working
- [ ] Integration tests passing

### Phase 4: Advanced Features (Weeks 29-36)

**Milestones:**
| ID | Milestone | Duration | Dependencies | Deliverables |
|----|-----------|----------|--------------|--------------|
| M4.1 | DAG Builder | Weeks 29-31 | M3.4 | Workflow parsing, validation |
| M4.2 | Execution Engine | Weeks 31-33 | M4.1 | Parallel execution, state machine |
| M4.3 | Approval Gates | Weeks 33-35 | M4.2 | Human-in-the-loop, timeouts |
| M4.4 | Incident Response | Weeks 32-34 | M3.3 | Automated triage, severity |
| M4.5 | AI Learning | Weeks 34-36 | M2.7 | Preference learning, recommendations |

**Acceptance Criteria:**
- [ ] Complex workflows execute correctly
- [ ] Approval workflows pause and resume
- [ ] Incident severity classification >90% accuracy
- [ ] Recommendations improve over time

### Phase 5: Production Readiness (Weeks 37-44)

**Milestones:**
| ID | Milestone | Duration | Dependencies | Deliverables |
|----|-----------|----------|--------------|--------------|
| M5.1 | Security Hardening | Weeks 37-39 | All | TLS, secrets, audit logs |
| M5.2 | Performance Tuning | Weeks 38-40 | All | <1s p95, caching, pooling |
| M5.3 | Load Testing | Weeks 40-42 | M5.2 | 1000 users, chaos engineering |
| M5.4 | Disaster Recovery | Weeks 41-43 | M5.1 | Backup/restore, failover |
| M5.5 | Documentation | Weeks 42-44 | All | User guides, API docs, runbooks |
| M5.6 | Compliance | Weeks 43-44 | M5.1 | SOC 2, GDPR audit prep |

**Acceptance Criteria:**
- [ ] All security scans passing
- [ ] Performance meets SLA under load
- [ ] DR tested successfully
- [ ] Documentation complete

### Phase 6: Launch (Weeks 45-52)

**Milestones:**
| ID | Milestone | Duration | Dependencies | Deliverables |
|----|-----------|----------|--------------|--------------|
| M6.1 | Production Deploy | Week 45-46 | M5.1-M5.6 | Blue-green deployment |
| M6.2 | Beta Launch | Weeks 47-48 | M6.1 | 50 users, feedback collection |
| M6.3 | General Availability | Weeks 49-50 | M6.2 | Public launch |
| M6.4 | Post-Launch Support | Weeks 51-52 | M6.3 | Bug fixes, optimization |

---

## Testing Strategy

### Testing Pyramid

```
                    ┌───────────┐
                   /             \
                  /   E2E Tests   \     10% (300+ tests)
                 /   (Playwright)  \
                /───────────────────\
               /                     \
              /   Integration Tests   \   20% (600+ tests)
             /   (testcontainers)      \
            /───────────────────────────\
           /                             \
          /        Unit Tests             \  70% (2100+ tests)
         /    (tokio::test, mockall)       \
        /───────────────────────────────────\
```

### Unit Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use tokio_test;

    #[tokio::test]
    async fn test_intent_classification_metric_query() {
        // Arrange
        let nlp_engine = NlpEngineImpl::new(test_config());
        let input = "What is the p95 latency for the API service?";
        let context = ConversationContext::default();

        // Act
        let intent = nlp_engine.classify_intent(input, &context).await.unwrap();

        // Assert
        assert_eq!(intent.category, IntentCategory::MetricQuery);
        assert!(intent.confidence > 0.95);
        assert!(intent.entities.iter().any(|e| e.entity_type == "metric"));
    }

    #[tokio::test]
    async fn test_context_retrieval_relevance_scoring() {
        // Arrange
        let context_engine = ContextEngine::new(test_config()).await;
        let session_id = "test-session";
        let query = "deployment status";

        // Seed test data
        context_engine.store(session_id, test_context_items()).await.unwrap();

        // Act
        let results = context_engine.retrieve(query, session_id, 1000).await.unwrap();

        // Assert
        assert!(!results.items.is_empty());
        assert!(results.items[0].relevance_score > 0.7);
        assert!(results.total_tokens <= 1000);
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_failures() {
        // Arrange
        let circuit_breaker = CircuitBreaker::new(CircuitBreakerConfig {
            failure_threshold: 3,
            recovery_timeout: Duration::from_secs(30),
            ..Default::default()
        });

        // Act - Simulate 3 failures
        for _ in 0..3 {
            circuit_breaker.record_failure();
        }

        // Assert
        assert!(circuit_breaker.is_open());
    }
}
```

### Integration Testing

```rust
#[cfg(test)]
mod integration_tests {
    use testcontainers::{clients, images::postgres::Postgres};

    #[tokio::test]
    async fn test_session_persistence() {
        // Start PostgreSQL container
        let docker = clients::Cli::default();
        let postgres = docker.run(Postgres::default());
        let connection_string = format!(
            "postgres://postgres:postgres@localhost:{}/postgres",
            postgres.get_host_port_ipv4(5432)
        );

        // Run migrations
        let pool = PgPool::connect(&connection_string).await.unwrap();
        sqlx::migrate!().run(&pool).await.unwrap();

        // Test session CRUD
        let session_repo = SessionRepository::new(pool);
        let session = Session::new("user-123");

        // Create
        session_repo.save(&session).await.unwrap();

        // Read
        let retrieved = session_repo.find_by_id(&session.id).await.unwrap();
        assert_eq!(retrieved.unwrap().user_id, "user-123");

        // Update
        let mut updated = session.clone();
        updated.token_count = 100;
        session_repo.save(&updated).await.unwrap();

        // Delete
        session_repo.delete(&session.id).await.unwrap();
        assert!(session_repo.find_by_id(&session.id).await.unwrap().is_none());
    }
}
```

### End-to-End Testing

```typescript
// tests/e2e/conversation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Multi-turn Conversation', () => {
  test('should maintain context across turns', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');

    // Navigate to chat
    await page.goto('/chat');

    // First turn - ask about a service
    await page.fill('[data-testid="message-input"]', 'What is the latency for the API service?');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toContainText('latency');

    // Second turn - reference "it" (should resolve to API service)
    await page.fill('[data-testid="message-input"]', 'What about its error rate?');
    await page.click('[data-testid="send-button"]');

    // Verify context was maintained
    const response = await page.locator('[data-testid="assistant-message"]').last();
    await expect(response).toContainText('API service');
    await expect(response).toContainText('error');
  });
});
```

### Coverage Requirements

| Component | Target | Enforcement |
|-----------|--------|-------------|
| NLP Engine | >85% | CI gate |
| Context Engine | >85% | CI gate |
| Workflow Engine | >90% | CI gate |
| Module Adapters | >85% | CI gate |
| API Handlers | >80% | CI gate |
| **Overall** | **>80%** | **Release gate** |

---

## Performance Optimization

### Latency Optimization

#### Request Path Analysis

```
Request → API Gateway → Auth → Rate Limit → Intent → LLM → Response
           │              │        │          │        │
           │              │        │          │        └── 800ms (LLM call)
           │              │        │          └── 50ms (intent classification)
           │              │        └── 2ms (rate limit check)
           │              └── 10ms (JWT validation)
           └── 5ms (TLS termination)

Total: ~870ms (target: <1000ms p95)
```

#### Hot Path Optimization

```rust
/// Pre-compiled regex patterns for common intents
lazy_static! {
    static ref METRIC_PATTERN: Regex = Regex::new(
        r"(?i)(what|show|get|display).*(latency|error|throughput|cpu|memory)"
    ).unwrap();

    static ref TIME_PATTERN: Regex = Regex::new(
        r"(?i)(last|past)\s+(\d+)\s*(minutes?|hours?|days?|weeks?)"
    ).unwrap();
}

/// Fast-path intent matching for common patterns
pub fn fast_match_intent(input: &str) -> Option<Intent> {
    if METRIC_PATTERN.is_match(input) {
        return Some(Intent::new(IntentCategory::MetricQuery, 0.98));
    }
    None
}
```

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MULTI-LEVEL CACHE ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │   L1 Cache  │    │   L2 Cache  │    │   L3 Cache  │             │
│  │  (In-Memory)│───▶│   (Redis)   │───▶│ (PostgreSQL)│             │
│  │   TTL: 1m   │    │   TTL: 1h   │    │   TTL: 24h  │             │
│  │  Size: 100MB│    │  Size: 1GB  │    │  Persistent │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                      │
│  Hit Rate Target: >85%                                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

```rust
pub struct MultiLevelCache {
    l1: Arc<Cache<String, CachedResponse>>,  // moka cache
    l2: Arc<RedisPool>,
    l3: Arc<PgPool>,
}

impl MultiLevelCache {
    pub async fn get(&self, key: &str) -> Option<CachedResponse> {
        // L1: In-memory (1ms)
        if let Some(cached) = self.l1.get(key) {
            metrics::counter!("cache_hit", "level" => "l1").increment(1);
            return Some(cached);
        }

        // L2: Redis (5ms)
        if let Ok(Some(cached)) = self.l2.get::<CachedResponse>(key).await {
            self.l1.insert(key.to_string(), cached.clone());
            metrics::counter!("cache_hit", "level" => "l2").increment(1);
            return Some(cached);
        }

        // L3: PostgreSQL materialized view (50ms)
        if let Ok(Some(cached)) = self.l3_lookup(key).await {
            self.l2.set(key, &cached, Duration::from_secs(3600)).await.ok();
            self.l1.insert(key.to_string(), cached.clone());
            metrics::counter!("cache_hit", "level" => "l3").increment(1);
            return Some(cached);
        }

        metrics::counter!("cache_miss").increment(1);
        None
    }
}
```

### Connection Pooling

```rust
/// Optimal connection pool configuration
pub fn create_pg_pool(config: &DatabaseConfig) -> PgPool {
    PgPoolOptions::new()
        .max_connections(100)           // cores * 2 + spindles
        .min_connections(10)            // Keep warm connections
        .acquire_timeout(Duration::from_secs(3))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
        .connect_lazy(&config.url)
        .unwrap()
}

/// Redis connection with reconnection
pub fn create_redis_pool(config: &RedisConfig) -> RedisPool {
    let manager = RedisConnectionManager::new(config.url.clone()).unwrap();
    Pool::builder()
        .max_size(50)
        .min_idle(Some(5))
        .connection_timeout(Duration::from_secs(2))
        .build(manager)
        .unwrap()
}
```

---

## Error Handling

### Error Taxonomy

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    // Client Errors (4xx)
    #[error("Validation error: {0}")]
    Validation(#[from] ValidationError),

    #[error("Authentication failed: {0}")]
    Authentication(String),

    #[error("Authorization denied: {0}")]
    Authorization(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Rate limit exceeded")]
    RateLimit { retry_after: Duration },

    #[error("Request timeout")]
    Timeout,

    // Server Errors (5xx)
    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Dependency failure: {service}")]
    DependencyFailure { service: String, cause: Box<dyn std::error::Error + Send + Sync> },
}

impl AppError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            Self::Validation(_) => StatusCode::BAD_REQUEST,
            Self::Authentication(_) => StatusCode::UNAUTHORIZED,
            Self::Authorization(_) => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::RateLimit { .. } => StatusCode::TOO_MANY_REQUESTS,
            Self::Timeout => StatusCode::GATEWAY_TIMEOUT,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::DependencyFailure { .. } => StatusCode::BAD_GATEWAY,
        }
    }

    pub fn is_retriable(&self) -> bool {
        matches!(self,
            Self::Timeout |
            Self::ServiceUnavailable(_) |
            Self::DependencyFailure { .. }
        )
    }

    pub fn error_code(&self) -> &'static str {
        match self {
            Self::Validation(_) => "VALIDATION_ERROR",
            Self::Authentication(_) => "AUTH_FAILED",
            Self::Authorization(_) => "FORBIDDEN",
            Self::NotFound(_) => "NOT_FOUND",
            Self::RateLimit { .. } => "RATE_LIMIT_EXCEEDED",
            Self::Timeout => "TIMEOUT",
            Self::Internal(_) => "INTERNAL_ERROR",
            Self::ServiceUnavailable(_) => "SERVICE_UNAVAILABLE",
            Self::DependencyFailure { .. } => "DEPENDENCY_FAILURE",
        }
    }
}
```

### Circuit Breaker Implementation

```rust
pub struct CircuitBreaker {
    state: AtomicU8,
    failure_count: AtomicU32,
    success_count: AtomicU32,
    last_failure: AtomicU64,
    config: CircuitBreakerConfig,
}

impl CircuitBreaker {
    const CLOSED: u8 = 0;
    const OPEN: u8 = 1;
    const HALF_OPEN: u8 = 2;

    pub async fn call<F, T, E>(&self, f: F) -> Result<T, CircuitBreakerError<E>>
    where
        F: Future<Output = Result<T, E>>,
    {
        // Check state
        match self.state.load(Ordering::SeqCst) {
            Self::OPEN => {
                if self.should_attempt_reset() {
                    self.transition_to_half_open();
                } else {
                    return Err(CircuitBreakerError::Open {
                        retry_after: self.time_until_reset(),
                    });
                }
            }
            Self::HALF_OPEN => {
                // Allow limited calls
            }
            _ => {}
        }

        // Execute operation
        match f.await {
            Ok(result) => {
                self.record_success();
                Ok(result)
            }
            Err(e) => {
                self.record_failure();
                Err(CircuitBreakerError::Inner(e))
            }
        }
    }

    fn record_success(&self) {
        match self.state.load(Ordering::SeqCst) {
            Self::CLOSED => {
                self.failure_count.store(0, Ordering::SeqCst);
            }
            Self::HALF_OPEN => {
                let successes = self.success_count.fetch_add(1, Ordering::SeqCst) + 1;
                if successes >= self.config.success_threshold {
                    self.transition_to_closed();
                }
            }
            _ => {}
        }
    }

    fn record_failure(&self) {
        self.last_failure.store(
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            Ordering::SeqCst,
        );

        match self.state.load(Ordering::SeqCst) {
            Self::CLOSED => {
                let failures = self.failure_count.fetch_add(1, Ordering::SeqCst) + 1;
                if failures >= self.config.failure_threshold {
                    self.transition_to_open();
                }
            }
            Self::HALF_OPEN => {
                self.transition_to_open();
            }
            _ => {}
        }
    }
}
```

### Graceful Degradation

```rust
pub struct DegradationManager {
    feature_flags: Arc<FeatureFlags>,
    health_checker: Arc<HealthChecker>,
}

impl DegradationManager {
    pub async fn get_response<F, T>(&self, feature: &str, primary: F) -> Result<T, AppError>
    where
        F: Future<Output = Result<T, AppError>>,
        T: Default + Cacheable,
    {
        // Check if feature is degraded
        if self.feature_flags.is_degraded(feature) {
            return self.get_fallback::<T>(feature).await;
        }

        // Try primary with timeout
        match timeout(Duration::from_secs(5), primary).await {
            Ok(Ok(result)) => Ok(result),
            Ok(Err(e)) if e.is_retriable() => {
                // Try cached response
                if let Some(cached) = self.get_cached::<T>(feature).await {
                    tracing::warn!("Using cached response for {}", feature);
                    return Ok(cached);
                }
                Err(e)
            }
            Ok(Err(e)) => Err(e),
            Err(_) => {
                // Timeout - try fallback
                tracing::warn!("Timeout for {}, using fallback", feature);
                self.get_fallback::<T>(feature).await
            }
        }
    }
}
```

---

## API Contracts

### Request Validation

```rust
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct SendMessageRequest {
    #[validate(length(min = 1, max = 10000))]
    pub content: String,

    #[validate(length(max = 10))]
    pub attachments: Option<Vec<Attachment>>,

    #[serde(default)]
    pub stream: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateWorkflowRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,

    #[validate(length(max = 1000))]
    pub description: Option<String>,

    #[validate]
    pub steps: Vec<WorkflowStepRequest>,

    #[validate(range(min = 60, max = 86400))]
    pub timeout_seconds: Option<u32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct WorkflowStepRequest {
    #[validate(length(min = 1, max = 100))]
    pub name: String,

    pub step_type: StepType,

    #[validate(length(max = 50))]
    pub dependencies: Option<Vec<String>>,

    #[validate(custom = "validate_action")]
    pub action: serde_json::Value,
}

fn validate_action(action: &serde_json::Value) -> Result<(), ValidationError> {
    // Custom validation logic
    if !action.is_object() {
        return Err(ValidationError::new("action_must_be_object"));
    }
    Ok(())
}
```

### Response Format

```rust
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pagination: Option<Pagination>,
    pub metadata: ResponseMetadata,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
    pub request_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<FieldError>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct Pagination {
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
    pub total_pages: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}
```

---

## Monitoring and Alerting

### Key Metrics

```yaml
# Prometheus metrics catalog
metrics:
  # Request metrics
  - name: http_requests_total
    type: counter
    labels: [method, path, status]

  - name: http_request_duration_seconds
    type: histogram
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    labels: [method, path]

  # Business metrics
  - name: copilot_sessions_active
    type: gauge

  - name: copilot_messages_total
    type: counter
    labels: [intent_category]

  - name: copilot_workflows_total
    type: counter
    labels: [status]

  # LLM metrics
  - name: llm_tokens_total
    type: counter
    labels: [provider, model, type]

  - name: llm_request_duration_seconds
    type: histogram
    labels: [provider, model]

  - name: llm_cost_dollars_total
    type: counter
    labels: [provider, model]
```

### Alert Rules

```yaml
groups:
  - name: sla
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m]))
          > 0.001
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error rate exceeds 0.1% SLA"
          runbook: "https://runbooks.example.com/high-error-rate"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
          > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency exceeds 1 second"

      - alert: ServiceDown
        expr: up{job="copilot-agent"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CoPilot Agent service is down"
```

### SLI/SLO Definitions

| SLI | Target | Measurement |
|-----|--------|-------------|
| Availability | 99.9% | `successful_requests / total_requests` |
| Latency (Simple) | <1s p95 | `histogram_quantile(0.95, request_duration{type="simple"})` |
| Latency (Complex) | <2s p95 | `histogram_quantile(0.95, request_duration{type="complex"})` |
| Error Rate | <0.1% | `error_requests / total_requests` |

---

## Security Hardening

### Authentication

```rust
/// JWT validation with comprehensive checks
pub async fn validate_jwt(token: &str, config: &AuthConfig) -> Result<Claims, AuthError> {
    let validation = Validation::new(Algorithm::RS256);

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_rsa_pem(&config.public_key)?,
        &validation,
    )?;

    let claims = token_data.claims;

    // Check expiration
    if claims.exp < Utc::now().timestamp() {
        return Err(AuthError::TokenExpired);
    }

    // Check issuer
    if claims.iss != config.expected_issuer {
        return Err(AuthError::InvalidIssuer);
    }

    // Check audience
    if !claims.aud.contains(&config.expected_audience) {
        return Err(AuthError::InvalidAudience);
    }

    // Check token not revoked
    if is_token_revoked(&claims.jti).await? {
        return Err(AuthError::TokenRevoked);
    }

    Ok(claims)
}
```

### Input Sanitization

```rust
/// Comprehensive input sanitization
pub fn sanitize_input(input: &str) -> String {
    let mut sanitized = input.to_string();

    // Remove null bytes
    sanitized = sanitized.replace('\0', "");

    // HTML escape
    sanitized = html_escape::encode_text(&sanitized).to_string();

    // Remove potential SQL injection patterns
    let sql_patterns = ["--", ";--", "/*", "*/", "@@", "char(", "nchar("];
    for pattern in sql_patterns {
        sanitized = sanitized.replace(pattern, "");
    }

    // Limit length
    if sanitized.len() > MAX_INPUT_LENGTH {
        sanitized.truncate(MAX_INPUT_LENGTH);
    }

    sanitized
}
```

### Rate Limiting

```rust
/// Token bucket rate limiter
pub struct RateLimiter {
    redis: Arc<RedisPool>,
    config: RateLimitConfig,
}

impl RateLimiter {
    pub async fn check(&self, key: &str) -> Result<bool, RateLimitError> {
        let now = Utc::now().timestamp_millis();
        let window_start = now - self.config.window_ms as i64;

        let script = r#"
            redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
            local count = redis.call('ZCARD', KEYS[1])
            if count < tonumber(ARGV[2]) then
                redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
                redis.call('EXPIRE', KEYS[1], ARGV[4])
                return 1
            end
            return 0
        "#;

        let result: i32 = self.redis
            .eval(script, &[key], &[
                window_start.to_string(),
                self.config.max_requests.to_string(),
                now.to_string(),
                (self.config.window_ms / 1000).to_string(),
            ])
            .await?;

        Ok(result == 1)
    }
}
```

---

## Quality Gates

### Pre-Commit Gate

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: cargo-fmt
        name: cargo fmt
        entry: cargo fmt -- --check
        language: system
        types: [rust]

      - id: cargo-clippy
        name: cargo clippy
        entry: cargo clippy -- -D warnings
        language: system
        types: [rust]

      - id: cargo-test
        name: cargo test
        entry: cargo test --lib
        language: system
        types: [rust]
```

### CI/CD Gates

| Gate | Checks | Blocking |
|------|--------|----------|
| **Pre-commit** | Format, lint, unit tests | Yes |
| **PR** | + Integration tests, coverage >80%, security scan | Yes |
| **Pre-merge** | + E2E tests, performance benchmarks | Yes |
| **Pre-release** | + Load test, chaos test, compliance check | Yes |
| **Post-deploy** | Smoke tests, synthetic monitoring | Rollback trigger |

### Release Criteria

- [ ] All tests passing (unit, integration, E2E)
- [ ] Code coverage >80%
- [ ] No critical/high security vulnerabilities
- [ ] Performance meets SLA under load test
- [ ] Documentation updated
- [ ] Changelog complete
- [ ] Rollback procedure tested
- [ ] On-call runbooks updated

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-25 | LLM DevOps Team | Initial refinement |

---

## Next Steps (SPARC Phase 5)

This Refinement document completes Phase 4 of the SPARC methodology. The final phase will include:

1. **Completion (Phase 5):** Production-ready Rust implementation with full test coverage

---

*This refinement document is part of the LLM DevOps ecosystem. For implementation details, see the component-specific documentation.*
