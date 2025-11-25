# LLM-CoPilot-Agent - Comprehensive Testing Strategy

**Version:** 1.0.0
**Status:** Production-Ready
**Last Updated:** 2025-11-25
**Owner:** QA Architecture Team

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Pyramid](#testing-pyramid)
3. [Unit Testing Strategy](#unit-testing-strategy)
4. [Integration Testing Strategy](#integration-testing-strategy)
5. [End-to-End Testing Strategy](#end-to-end-testing-strategy)
6. [Performance Testing Strategy](#performance-testing-strategy)
7. [Test Data Management](#test-data-management)
8. [CI/CD Integration](#cicd-integration)
9. [Quality Gates](#quality-gates)
10. [Test Infrastructure](#test-infrastructure)

---

## Testing Philosophy

### Core Principles

1. **Test Early, Test Often**: Shift testing left to catch issues during development
2. **Fail Fast**: Quick feedback loops with fast unit tests
3. **Test in Production-Like Environments**: Integration and E2E tests mirror production
4. **Automate Everything**: Manual testing only for exploratory scenarios
5. **Measure and Improve**: Continuous monitoring of test effectiveness and coverage

### Testing Goals

- **Code Coverage**: >80% line coverage, >75% branch coverage
- **Performance**: Meet SLA targets (99.9% uptime, <1s simple queries, <2s complex)
- **Reliability**: >95% test stability (no flaky tests)
- **Speed**: Unit tests <5min, Integration tests <15min, E2E tests <30min
- **Confidence**: >90% defect detection before production

---

## Testing Pyramid

### Distribution

```
         /\
        /  \        E2E Tests (10%)
       /____\       - User journeys
      /      \      - Multi-turn conversations
     /        \     - Workflow orchestration
    /__________\
   /            \   Integration Tests (20%)
  /              \  - Database integration
 /                \ - Module adapters
/                  \- Event-driven flows
--------------------
Unit Tests (70%)    - Component logic
                    - Business rules
                    - Error handling
```

### Test Types by Layer

| Layer | Percentage | Count (Est) | Execution Time | Frequency |
|-------|-----------|-------------|----------------|-----------|
| Unit | 70% | 2,100+ | <5 min | Every commit |
| Integration | 20% | 600+ | <15 min | Every PR |
| E2E | 10% | 300+ | <30 min | Pre-merge, Nightly |
| Performance | - | 50+ | 1-2 hours | Nightly, Pre-release |

---

## Unit Testing Strategy

### Overview

Unit tests validate individual components in isolation with mocked dependencies. They form the foundation of our testing strategy, providing fast feedback and high coverage.

### File Organization

```
src/
├── nlp_engine/
│   ├── mod.rs
│   ├── intent_classifier.rs
│   ├── entity_extractor.rs
│   └── query_translator.rs
└── tests/
    └── unit/
        └── nlp_engine/
            ├── intent_classifier_tests.rs
            ├── entity_extractor_tests.rs
            └── query_translator_tests.rs
```

### Rust Testing Framework

```rust
// Standard library testing
#[cfg(test)]
mod tests {
    use super::*;

    // Dependencies
    use tokio::test;       // Async testing
    use mockall::*;        // Mocking framework
    use rstest::*;         // Parameterized tests
    use proptest::*;       // Property-based testing
}
```

---

## Unit Testing Strategy (Detailed)

### 1. NLP Engine Tests

#### 1.1 Intent Classification Tests

**Test Coverage Requirements:**
- Happy path: Valid inputs → correct intent classification
- Edge cases: Empty input, malformed queries, ambiguous intent
- Confidence scoring: Verify confidence thresholds
- Fallback behavior: Rule-based fallback when LLM unavailable

**Example Test Implementation:**

```rust
// File: tests/unit/nlp_engine/intent_classifier_tests.rs

use llm_copilot_agent::nlp_engine::{
    IntentClassifier, ClassifiedIntent, IntentType, NlpRequest
};
use mockall::predicate::*;
use mockall::mock;
use tokio::test;
use rstest::*;

// Mock LLM client for testing
mock! {
    LlmClient {}

    #[async_trait]
    impl LlmClient for LlmClient {
        async fn classify_intent(&self, query: &str) -> Result<ClassifiedIntent, LlmError>;
    }
}

#[tokio::test]
async fn test_classify_query_metrics_intent() {
    // Arrange
    let mut mock_llm = MockLlmClient::new();
    mock_llm
        .expect_classify_intent()
        .with(eq("Show me CPU usage for auth-service"))
        .times(1)
        .returning(|_| {
            Ok(ClassifiedIntent {
                intent_type: IntentType::QueryMetrics,
                confidence: 0.95,
                entities: vec![
                    Entity::new("service", "auth-service"),
                    Entity::new("metric", "cpu"),
                ],
            })
        });

    let classifier = IntentClassifier::new(mock_llm);
    let request = NlpRequest::new("Show me CPU usage for auth-service");

    // Act
    let result = classifier.classify(&request).await;

    // Assert
    assert!(result.is_ok());
    let classified = result.unwrap();
    assert_eq!(classified.intent_type, IntentType::QueryMetrics);
    assert!(classified.confidence >= 0.95);
    assert_eq!(classified.entities.len(), 2);
}

#[tokio::test]
async fn test_classify_with_low_confidence_falls_back_to_rules() {
    // Arrange
    let mut mock_llm = MockLlmClient::new();
    mock_llm
        .expect_classify_intent()
        .returning(|_| {
            Ok(ClassifiedIntent {
                intent_type: IntentType::Unknown,
                confidence: 0.60, // Below threshold
                entities: vec![],
            })
        });

    let classifier = IntentClassifier::builder()
        .llm_client(mock_llm)
        .confidence_threshold(0.95)
        .enable_rule_fallback(true)
        .build();

    let request = NlpRequest::new("show cpu");

    // Act
    let result = classifier.classify(&request).await;

    // Assert
    assert!(result.is_ok());
    let classified = result.unwrap();
    // Should use rule-based fallback
    assert_eq!(classified.intent_type, IntentType::QueryMetrics);
    assert!(classified.metadata.contains_key("fallback_used"));
}

// Parameterized tests for multiple scenarios
#[rstest]
#[case("Deploy to production", IntentType::ExecuteWorkflow, 0.98)]
#[case("What incidents are active?", IntentType::QueryIncidents, 0.96)]
#[case("Generate tests for auth module", IntentType::GenerateTests, 0.94)]
#[case("Show me error logs", IntentType::QueryLogs, 0.97)]
#[tokio::test]
async fn test_intent_classification_accuracy(
    #[case] query: &str,
    #[case] expected_intent: IntentType,
    #[case] min_confidence: f32,
) {
    let classifier = create_test_classifier().await;
    let request = NlpRequest::new(query);

    let result = classifier.classify(&request).await.unwrap();

    assert_eq!(result.intent_type, expected_intent);
    assert!(result.confidence >= min_confidence);
}

#[tokio::test]
async fn test_classify_handles_llm_timeout() {
    // Arrange
    let mut mock_llm = MockLlmClient::new();
    mock_llm
        .expect_classify_intent()
        .returning(|_| Err(LlmError::Timeout));

    let classifier = IntentClassifier::new(mock_llm);
    let request = NlpRequest::new("test query");

    // Act
    let result = classifier.classify(&request).await;

    // Assert
    assert!(result.is_err());
    match result.unwrap_err() {
        NlpError::LlmTimeout => { /* Expected */ },
        _ => panic!("Expected LlmTimeout error"),
    }
}

// Property-based testing
proptest! {
    #[test]
    fn test_classifier_never_panics_on_random_input(query in "\\PC*") {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let classifier = create_test_classifier().await;
            let request = NlpRequest::new(&query);

            // Should not panic, either succeeds or returns error
            let _ = classifier.classify(&request).await;
        });
    }
}
```

#### 1.2 Entity Extraction Tests

```rust
// File: tests/unit/nlp_engine/entity_extractor_tests.rs

use llm_copilot_agent::nlp_engine::{EntityExtractor, Entity, EntityType};

#[tokio::test]
async fn test_extract_service_name_from_query() {
    let extractor = EntityExtractor::new();
    let query = "Show me CPU usage for auth-service in production";

    let entities = extractor.extract(query).await.unwrap();

    assert_contains_entity(&entities, EntityType::Service, "auth-service");
    assert_contains_entity(&entities, EntityType::Environment, "production");
    assert_contains_entity(&entities, EntityType::Metric, "cpu");
}

#[tokio::test]
async fn test_extract_time_range_entities() {
    let extractor = EntityExtractor::new();
    let query = "Show errors from the last 24 hours";

    let entities = extractor.extract(query).await.unwrap();

    let time_entity = entities
        .iter()
        .find(|e| e.entity_type == EntityType::TimeRange)
        .expect("Should find time range entity");

    assert_eq!(time_entity.normalized_value, "24h");
}

#[rstest]
#[case("last 5 minutes", "5m")]
#[case("past 2 hours", "2h")]
#[case("last week", "7d")]
#[case("yesterday", "1d")]
async fn test_time_range_normalization(
    #[case] input: &str,
    #[case] expected: &str,
) {
    let extractor = EntityExtractor::new();
    let query = format!("Show metrics from {}", input);

    let entities = extractor.extract(&query).await.unwrap();
    let time_entity = find_entity(&entities, EntityType::TimeRange).unwrap();

    assert_eq!(time_entity.normalized_value, expected);
}

fn assert_contains_entity(entities: &[Entity], entity_type: EntityType, value: &str) {
    assert!(
        entities.iter().any(|e| e.entity_type == entity_type && e.value == value),
        "Expected entity type {:?} with value '{}' not found",
        entity_type, value
    );
}
```

#### 1.3 Query Translator Tests

```rust
// File: tests/unit/nlp_engine/query_translator_tests.rs

use llm_copilot_agent::nlp_engine::{QueryTranslator, QueryLanguage};

#[tokio::test]
async fn test_translate_to_promql() {
    let translator = QueryTranslator::new();
    let intent = create_test_intent(
        IntentType::QueryMetrics,
        vec![
            Entity::new("service", "auth-service"),
            Entity::new("metric", "cpu"),
            Entity::new("time_range", "5m"),
        ],
    );

    let query = translator.translate(&intent, QueryLanguage::PromQL).await.unwrap();

    assert_eq!(
        query,
        r#"rate(cpu_usage{service="auth-service"}[5m])"#
    );
}

#[tokio::test]
async fn test_translate_to_logql() {
    let translator = QueryTranslator::new();
    let intent = create_test_intent(
        IntentType::QueryLogs,
        vec![
            Entity::new("service", "payment-service"),
            Entity::new("log_level", "error"),
            Entity::new("time_range", "1h"),
        ],
    );

    let query = translator.translate(&intent, QueryLanguage::LogQL).await.unwrap();

    assert!(query.contains(r#"{service="payment-service"}"#));
    assert!(query.contains("|= `error`"));
}

#[tokio::test]
async fn test_translator_caches_similar_queries() {
    let translator = QueryTranslator::with_cache(CacheConfig::default());
    let intent = create_test_intent(IntentType::QueryMetrics, vec![]);

    // First call - cache miss
    let start = Instant::now();
    let query1 = translator.translate(&intent, QueryLanguage::PromQL).await.unwrap();
    let duration1 = start.elapsed();

    // Second call - cache hit (should be much faster)
    let start = Instant::now();
    let query2 = translator.translate(&intent, QueryLanguage::PromQL).await.unwrap();
    let duration2 = start.elapsed();

    assert_eq!(query1, query2);
    assert!(duration2 < duration1 / 10); // Cache should be 10x faster
}
```

### 2. Context Engine Tests

#### 2.1 Memory Management Tests

```rust
// File: tests/unit/context_engine/memory_tests.rs

use llm_copilot_agent::context_engine::{
    MemoryStore, ShortTermMemory, MediumTermMemory, LongTermMemory
};

#[tokio::test]
async fn test_short_term_memory_ttl_expiration() {
    let mut memory = ShortTermMemory::new(Duration::from_secs(5));

    memory.store("session_1", "turn_1", "test content").await.unwrap();

    // Should exist immediately
    assert!(memory.get("session_1", "turn_1").await.is_some());

    // Wait for TTL expiration
    tokio::time::sleep(Duration::from_secs(6)).await;

    // Should be expired
    assert!(memory.get("session_1", "turn_1").await.is_none());
}

#[tokio::test]
async fn test_memory_store_compression() {
    let mut memory = MediumTermMemory::new();

    // Store large conversation history
    let long_conversation = generate_test_conversation(1000);
    memory.store("session_1", &long_conversation).await.unwrap();

    // Retrieve and verify compression
    let retrieved = memory.get_compressed("session_1", 8000).await.unwrap();

    assert!(retrieved.token_count <= 8000);
    assert!(retrieved.compression_ratio > 0.5); // At least 50% compressed
    assert!(retrieved.summary.is_some());
}

#[tokio::test]
async fn test_context_retrieval_priority_ordering() {
    let context_engine = ContextEngine::new();

    // Store entities with different priorities
    context_engine.add_entity("low_priority", Priority::Low).await;
    context_engine.add_entity("high_priority", Priority::High).await;
    context_engine.add_entity("medium_priority", Priority::Medium).await;

    // Retrieve with token budget
    let context = context_engine.get_context(1000).await.unwrap();

    // High priority entities should be first
    assert_eq!(context.entities[0].value, "high_priority");
    assert_eq!(context.entities[1].value, "medium_priority");
}
```

#### 2.2 Vector Store Tests

```rust
// File: tests/unit/context_engine/vector_store_tests.rs

use llm_copilot_agent::context_engine::VectorStore;

#[tokio::test]
async fn test_semantic_search_returns_relevant_results() {
    let mut store = VectorStore::new_in_memory();

    // Index test documents
    store.index("doc1", "CPU usage is high in production").await.unwrap();
    store.index("doc2", "Memory leak in payment service").await.unwrap();
    store.index("doc3", "High CPU utilization detected").await.unwrap();

    // Search for similar content
    let results = store.search("CPU problems", 2).await.unwrap();

    assert_eq!(results.len(), 2);
    assert!(results[0].id == "doc1" || results[0].id == "doc3");
    assert!(results[0].score > 0.7); // High similarity
}

#[tokio::test]
async fn test_vector_store_handles_concurrent_writes() {
    let store = Arc::new(Mutex::new(VectorStore::new_in_memory()));
    let mut handles = vec![];

    // Spawn 100 concurrent writes
    for i in 0..100 {
        let store_clone = Arc::clone(&store);
        let handle = tokio::spawn(async move {
            let mut store = store_clone.lock().await;
            store.index(&format!("doc{}", i), "test content").await
        });
        handles.push(handle);
    }

    // Wait for all writes
    for handle in handles {
        assert!(handle.await.unwrap().is_ok());
    }

    // Verify all documents indexed
    let store = store.lock().await;
    assert_eq!(store.count().await.unwrap(), 100);
}
```

### 3. Workflow Engine Tests

#### 3.1 DAG Builder Tests

```rust
// File: tests/unit/workflow_engine/dag_tests.rs

use llm_copilot_agent::workflow_engine::{DagBuilder, WorkflowDefinition};

#[test]
fn test_dag_builder_detects_cycles() {
    let mut builder = DagBuilder::new();

    builder.add_task("task1", vec![]);
    builder.add_task("task2", vec!["task1"]);
    builder.add_task("task3", vec!["task2"]);
    builder.add_task("task1", vec!["task3"]); // Creates cycle

    let result = builder.build();

    assert!(result.is_err());
    match result.unwrap_err() {
        DagError::CycleDetected(cycle) => {
            assert!(cycle.contains(&"task1".to_string()));
        },
        _ => panic!("Expected CycleDetected error"),
    }
}

#[test]
fn test_dag_topological_sort_orders_correctly() {
    let mut builder = DagBuilder::new();

    builder.add_task("build", vec![]);
    builder.add_task("test", vec!["build"]);
    builder.add_task("deploy", vec!["test"]);

    let dag = builder.build().unwrap();
    let sorted = dag.topological_sort();

    assert_eq!(sorted, vec!["build", "test", "deploy"]);
}

#[test]
fn test_dag_identifies_parallel_execution_opportunities() {
    let mut builder = DagBuilder::new();

    builder.add_task("unit_tests", vec![]);
    builder.add_task("integration_tests", vec![]);
    builder.add_task("e2e_tests", vec![]);
    builder.add_task("deploy", vec!["unit_tests", "integration_tests", "e2e_tests"]);

    let dag = builder.build().unwrap();
    let batches = dag.execution_batches();

    assert_eq!(batches.len(), 2);
    assert_eq!(batches[0].len(), 3); // All tests can run in parallel
    assert_eq!(batches[1].len(), 1); // Deploy waits for tests
}
```

#### 3.2 State Machine Tests

```rust
// File: tests/unit/workflow_engine/state_machine_tests.rs

use llm_copilot_agent::workflow_engine::{StateMachine, WorkflowState};

#[tokio::test]
async fn test_state_transitions() {
    let mut sm = StateMachine::new();

    assert_eq!(sm.current_state(), WorkflowState::Draft);

    sm.transition_to(WorkflowState::Pending).await.unwrap();
    assert_eq!(sm.current_state(), WorkflowState::Pending);

    sm.transition_to(WorkflowState::Running).await.unwrap();
    assert_eq!(sm.current_state(), WorkflowState::Running);
}

#[tokio::test]
async fn test_invalid_state_transition_rejected() {
    let mut sm = StateMachine::new();

    // Cannot go directly from Draft to Running
    let result = sm.transition_to(WorkflowState::Running).await;

    assert!(result.is_err());
    assert_eq!(sm.current_state(), WorkflowState::Draft); // State unchanged
}

#[tokio::test]
async fn test_approval_gate_blocks_execution() {
    let mut workflow = Workflow::new();
    workflow.add_approval_gate("deploy_to_prod", ApprovalPolicy::RequireAll);

    workflow.start().await.unwrap();

    // Should stop at approval gate
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert_eq!(workflow.state(), WorkflowState::WaitingApproval);

    // Approve
    workflow.approve("user@example.com").await.unwrap();

    // Should continue
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert_eq!(workflow.state(), WorkflowState::Running);
}
```

#### 3.3 Checkpoint Recovery Tests

```rust
// File: tests/unit/workflow_engine/checkpoint_tests.rs

use llm_copilot_agent::workflow_engine::CheckpointManager;

#[tokio::test]
async fn test_checkpoint_save_and_restore() {
    let mut manager = CheckpointManager::new();
    let workflow_id = "wf_123";

    // Create workflow state
    let mut workflow = create_test_workflow();
    workflow.execute_task("task1").await.unwrap();
    workflow.execute_task("task2").await.unwrap();

    // Save checkpoint
    manager.save_checkpoint(workflow_id, &workflow).await.unwrap();

    // Simulate crash and restore
    let restored = manager.restore_checkpoint(workflow_id).await.unwrap();

    assert_eq!(restored.completed_tasks().len(), 2);
    assert!(restored.completed_tasks().contains(&"task1"));
    assert!(restored.completed_tasks().contains(&"task2"));
}

#[tokio::test]
async fn test_workflow_resumes_from_failure_point() {
    let mut workflow = create_test_workflow();
    workflow.enable_checkpointing(CheckpointInterval::PerTask);

    // Execute tasks
    workflow.execute_task("task1").await.unwrap();
    workflow.execute_task("task2").await.unwrap();

    // Simulate failure on task3
    let result = workflow.execute_task("task3").await;
    assert!(result.is_err());

    // Restore and resume
    workflow.restore_from_last_checkpoint().await.unwrap();

    // Should resume from task3, not re-execute task1 and task2
    assert_eq!(workflow.current_task(), Some("task3"));
    assert!(workflow.is_task_completed("task1"));
    assert!(workflow.is_task_completed("task2"));
}
```

### 4. Response Streaming Tests

```rust
// File: tests/unit/streaming/sse_tests.rs

use llm_copilot_agent::streaming::{StreamSource, SseFormatter};

#[tokio::test]
async fn test_stream_chunk_formatting() {
    let mut source = StreamSource::new();
    let formatter = SseFormatter::new();

    source.send_chunk("Hello").await.unwrap();
    source.send_chunk(" World").await.unwrap();

    let mut receiver = source.subscribe();

    let chunk1 = receiver.recv().await.unwrap();
    let formatted1 = formatter.format(&chunk1);
    assert_eq!(formatted1, "data: {\"type\":\"chunk\",\"content\":\"Hello\"}\n\n");

    let chunk2 = receiver.recv().await.unwrap();
    let formatted2 = formatter.format(&chunk2);
    assert_eq!(formatted2, "data: {\"type\":\"chunk\",\"content\":\" World\"}\n\n");
}

#[tokio::test]
async fn test_backpressure_handling() {
    let mut source = StreamSource::with_buffer_size(10);

    // Fill buffer
    for i in 0..10 {
        source.send_chunk(&format!("chunk{}", i)).await.unwrap();
    }

    // Next send should apply backpressure
    let send_task = tokio::spawn(async move {
        source.send_chunk("overflow").await
    });

    tokio::time::sleep(Duration::from_millis(100)).await;

    // Should timeout because buffer is full
    let result = tokio::time::timeout(Duration::from_millis(50), send_task).await;
    assert!(result.is_err()); // Timeout indicates backpressure working
}

#[tokio::test]
async fn test_stream_resume_from_token() {
    let mut source = StreamSource::new();

    // Send chunks
    source.send_chunk("chunk1").await.unwrap();
    source.send_chunk("chunk2").await.unwrap();
    let token = source.current_resume_token();
    source.send_chunk("chunk3").await.unwrap();

    // Resume from token
    let mut receiver = source.subscribe_from(token).await.unwrap();

    // Should only receive chunk3
    let chunk = receiver.recv().await.unwrap();
    assert_eq!(chunk.content, "chunk3");
}
```

### 5. Module Adapter Tests

```rust
// File: tests/unit/adapters/circuit_breaker_tests.rs

use llm_copilot_agent::adapters::CircuitBreaker;

#[tokio::test]
async fn test_circuit_breaker_opens_after_failures() {
    let breaker = CircuitBreaker::builder()
        .failure_threshold(3)
        .timeout(Duration::from_secs(30))
        .build();

    // Simulate 3 failures
    for _ in 0..3 {
        breaker.record_failure().await;
    }

    // Circuit should be open
    assert_eq!(breaker.state(), CircuitState::Open);

    // Calls should be rejected
    let result = breaker.execute(|| async { Ok(()) }).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_circuit_breaker_half_open_recovery() {
    let breaker = CircuitBreaker::builder()
        .failure_threshold(3)
        .timeout(Duration::from_secs(1))
        .build();

    // Open circuit
    for _ in 0..3 {
        breaker.record_failure().await;
    }
    assert_eq!(breaker.state(), CircuitState::Open);

    // Wait for timeout
    tokio::time::sleep(Duration::from_secs(2)).await;
    assert_eq!(breaker.state(), CircuitState::HalfOpen);

    // Successful call should close circuit
    breaker.execute(|| async { Ok(()) }).await.unwrap();
    assert_eq!(breaker.state(), CircuitState::Closed);
}
```

### 6. Cache Layer Tests

```rust
// File: tests/unit/cache/redis_cache_tests.rs

use llm_copilot_agent::cache::{RedisCache, CacheKey};

#[tokio::test]
async fn test_cache_set_and_get() {
    let cache = RedisCache::new_test_instance().await;

    cache.set("test_key", "test_value", Duration::from_secs(60)).await.unwrap();

    let value: Option<String> = cache.get("test_key").await.unwrap();
    assert_eq!(value, Some("test_value".to_string()));
}

#[tokio::test]
async fn test_cache_ttl_expiration() {
    let cache = RedisCache::new_test_instance().await;

    cache.set("expiring_key", "value", Duration::from_secs(1)).await.unwrap();

    tokio::time::sleep(Duration::from_secs(2)).await;

    let value: Option<String> = cache.get("expiring_key").await.unwrap();
    assert!(value.is_none());
}

#[tokio::test]
async fn test_cache_invalidation_pattern() {
    let cache = RedisCache::new_test_instance().await;

    cache.set("user:123:profile", "data1", Duration::from_secs(60)).await.unwrap();
    cache.set("user:123:settings", "data2", Duration::from_secs(60)).await.unwrap();
    cache.set("user:456:profile", "data3", Duration::from_secs(60)).await.unwrap();

    // Invalidate all user:123:* keys
    cache.invalidate_pattern("user:123:*").await.unwrap();

    assert!(cache.get::<String>("user:123:profile").await.unwrap().is_none());
    assert!(cache.get::<String>("user:123:settings").await.unwrap().is_none());
    assert!(cache.get::<String>("user:456:profile").await.unwrap().is_some());
}
```

### Coverage Requirements

| Component | Line Coverage | Branch Coverage | Mutation Score |
|-----------|--------------|-----------------|----------------|
| NLP Engine | >85% | >80% | >75% |
| Context Engine | >85% | >75% | >70% |
| Workflow Engine | >90% | >85% | >80% |
| Streaming | >80% | >75% | >70% |
| Adapters | >85% | >80% | >75% |
| Cache | >80% | >75% | >70% |
| **Overall** | **>80%** | **>75%** | **>70%** |

---

## Integration Testing Strategy

### Overview

Integration tests validate interactions between components and external services. These tests use real dependencies (databases, message queues) in containerized environments.

### Test Environment Setup

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: copilot_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_pass
    ports:
      - "5433:5432"

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"

  qdrant-test:
    image: qdrant/qdrant:latest
    ports:
      - "6334:6333"

  nats-test:
    image: nats:latest
    ports:
      - "4223:4222"
```

### Integration Test Structure

```
tests/
└── integration/
    ├── database/
    │   ├── postgres_integration_tests.rs
    │   └── redis_integration_tests.rs
    ├── adapters/
    │   ├── test_bench_adapter_tests.rs
    │   ├── observatory_adapter_tests.rs
    │   └── incident_manager_adapter_tests.rs
    ├── messaging/
    │   └── nats_integration_tests.rs
    └── workflows/
        └── end_to_end_workflow_tests.rs
```

### Database Integration Tests

```rust
// File: tests/integration/database/postgres_integration_tests.rs

use llm_copilot_agent::storage::PostgresStore;
use testcontainers::{clients::Cli, images::postgres::Postgres};

#[tokio::test]
async fn test_postgres_conversation_storage() {
    // Start test container
    let docker = Cli::default();
    let postgres = docker.run(Postgres::default());
    let connection_string = format!(
        "postgresql://postgres:postgres@localhost:{}/test",
        postgres.get_host_port_ipv4(5432)
    );

    // Initialize store
    let store = PostgresStore::connect(&connection_string).await.unwrap();
    store.run_migrations().await.unwrap();

    // Test conversation storage
    let conversation = Conversation {
        session_id: "test_session".to_string(),
        user_id: "user_123".to_string(),
        turns: vec![
            ConversationTurn {
                user_message: "Show me CPU usage".to_string(),
                assistant_response: "Here's the CPU usage...".to_string(),
                timestamp: Utc::now(),
            },
        ],
    };

    store.save_conversation(&conversation).await.unwrap();

    // Retrieve and verify
    let retrieved = store
        .get_conversation("test_session")
        .await
        .unwrap()
        .expect("Conversation should exist");

    assert_eq!(retrieved.session_id, conversation.session_id);
    assert_eq!(retrieved.turns.len(), 1);
}

#[tokio::test]
async fn test_postgres_transaction_rollback() {
    let docker = Cli::default();
    let postgres = docker.run(Postgres::default());
    let connection_string = format!(
        "postgresql://postgres:postgres@localhost:{}/test",
        postgres.get_host_port_ipv4(5432)
    );

    let store = PostgresStore::connect(&connection_string).await.unwrap();

    // Start transaction
    let mut tx = store.begin_transaction().await.unwrap();

    // Insert data
    tx.execute("INSERT INTO workflows (id, name) VALUES ($1, $2)", &[&"wf_1", &"test"])
        .await
        .unwrap();

    // Rollback
    tx.rollback().await.unwrap();

    // Verify data was not persisted
    let result = store
        .query_one("SELECT * FROM workflows WHERE id = $1", &[&"wf_1"])
        .await;

    assert!(result.is_err()); // Should not exist
}

#[tokio::test]
async fn test_postgres_connection_pool_concurrent_access() {
    let docker = Cli::default();
    let postgres = docker.run(Postgres::default());
    let connection_string = format!(
        "postgresql://postgres:postgres@localhost:{}/test",
        postgres.get_host_port_ipv4(5432)
    );

    let store = Arc::new(
        PostgresStore::connect_with_pool(&connection_string, 10).await.unwrap()
    );

    let mut handles = vec![];

    // Spawn 50 concurrent queries
    for i in 0..50 {
        let store_clone = Arc::clone(&store);
        let handle = tokio::spawn(async move {
            store_clone
                .save_workflow(&create_test_workflow(i))
                .await
        });
        handles.push(handle);
    }

    // Wait for all queries
    for handle in handles {
        assert!(handle.await.unwrap().is_ok());
    }
}
```

### Redis Integration Tests

```rust
// File: tests/integration/database/redis_integration_tests.rs

use llm_copilot_agent::cache::RedisCache;
use testcontainers::{clients::Cli, images::redis::Redis};

#[tokio::test]
async fn test_redis_pub_sub() {
    let docker = Cli::default();
    let redis = docker.run(Redis::default());
    let url = format!("redis://localhost:{}", redis.get_host_port_ipv4(6379));

    let cache = RedisCache::connect(&url).await.unwrap();

    // Subscribe to channel
    let mut subscriber = cache.subscribe("test_channel").await.unwrap();

    // Publish message
    cache.publish("test_channel", "test_message").await.unwrap();

    // Receive message
    let message = tokio::time::timeout(
        Duration::from_secs(1),
        subscriber.recv()
    ).await.unwrap().unwrap();

    assert_eq!(message, "test_message");
}

#[tokio::test]
async fn test_redis_stream_processing() {
    let docker = Cli::default();
    let redis = docker.run(Redis::default());
    let url = format!("redis://localhost:{}", redis.get_host_port_ipv4(6379));

    let cache = RedisCache::connect(&url).await.unwrap();

    // Add entries to stream
    for i in 0..10 {
        cache.xadd("events", &[("data", format!("event_{}", i))]).await.unwrap();
    }

    // Read from stream
    let entries = cache.xread("events", "0", 5).await.unwrap();

    assert_eq!(entries.len(), 5);
}

#[tokio::test]
async fn test_redis_lua_script_execution() {
    let docker = Cli::default();
    let redis = docker.run(Redis::default());
    let url = format!("redis://localhost:{}", redis.get_host_port_ipv4(6379));

    let cache = RedisCache::connect(&url).await.unwrap();

    // Atomic increment with limit
    let script = r#"
        local current = redis.call('GET', KEYS[1])
        if not current then
            current = 0
        end
        if tonumber(current) < tonumber(ARGV[1]) then
            return redis.call('INCR', KEYS[1])
        else
            return nil
        end
    "#;

    cache.set("counter", "0", Duration::from_secs(60)).await.unwrap();

    // Should increment
    let result = cache.eval::<i64>(script, &["counter"], &["5"]).await.unwrap();
    assert_eq!(result, Some(1));

    // Set to limit
    cache.set("counter", "5", Duration::from_secs(60)).await.unwrap();

    // Should not increment (at limit)
    let result = cache.eval::<i64>(script, &["counter"], &["5"]).await.unwrap();
    assert!(result.is_none());
}
```

### Module Adapter Integration Tests

```rust
// File: tests/integration/adapters/test_bench_adapter_tests.rs

use llm_copilot_agent::adapters::TestBenchAdapter;
use wiremock::{MockServer, Mock, ResponseTemplate};
use wiremock::matchers::{method, path};

#[tokio::test]
async fn test_test_bench_generate_tests_integration() {
    // Setup mock Test-Bench server
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/v1/tests/generate"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({
                    "test_id": "test_123",
                    "tests": [
                        {
                            "name": "test_authentication",
                            "code": "fn test_authentication() { ... }"
                        }
                    ]
                }))
        )
        .mount(&mock_server)
        .await;

    // Create adapter
    let adapter = TestBenchAdapter::new(&mock_server.uri());

    // Request test generation
    let request = GenerateTestsRequest {
        module: "auth".to_string(),
        code_changes: vec![],
        framework: "rust".to_string(),
    };

    let response = adapter.generate_tests(request).await.unwrap();

    assert_eq!(response.test_id, "test_123");
    assert_eq!(response.tests.len(), 1);
}

#[tokio::test]
async fn test_test_bench_adapter_retries_on_failure() {
    let mock_server = MockServer::start().await;

    // First two requests fail, third succeeds
    Mock::given(method("POST"))
        .and(path("/api/v1/tests/generate"))
        .respond_with(ResponseTemplate::new(500))
        .up_to_n_times(2)
        .mount(&mock_server)
        .await;

    Mock::given(method("POST"))
        .and(path("/api/v1/tests/generate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "test_id": "test_123",
            "tests": []
        })))
        .mount(&mock_server)
        .await;

    let adapter = TestBenchAdapter::builder()
        .base_url(&mock_server.uri())
        .max_retries(3)
        .build();

    let request = GenerateTestsRequest::default();
    let result = adapter.generate_tests(request).await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn test_test_bench_adapter_circuit_breaker() {
    let mock_server = MockServer::start().await;

    // Always fail
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let adapter = TestBenchAdapter::builder()
        .base_url(&mock_server.uri())
        .circuit_breaker_threshold(3)
        .build();

    // Make 3 requests to open circuit
    for _ in 0..3 {
        let _ = adapter.generate_tests(GenerateTestsRequest::default()).await;
    }

    // Circuit should be open, request should fail fast
    let start = Instant::now();
    let result = adapter.generate_tests(GenerateTestsRequest::default()).await;
    let duration = start.elapsed();

    assert!(result.is_err());
    assert!(duration < Duration::from_millis(100)); // Failed fast
}
```

### NATS Messaging Integration Tests

```rust
// File: tests/integration/messaging/nats_integration_tests.rs

use llm_copilot_agent::messaging::NatsClient;
use testcontainers::{clients::Cli, GenericImage};

#[tokio::test]
async fn test_nats_pub_sub_integration() {
    let docker = Cli::default();
    let nats = docker.run(GenericImage::new("nats", "latest").with_exposed_port(4222));
    let url = format!("nats://localhost:{}", nats.get_host_port_ipv4(4222));

    let client = NatsClient::connect(&url).await.unwrap();

    // Subscribe
    let mut sub = client.subscribe("test.subject").await.unwrap();

    // Publish
    client.publish("test.subject", b"test message").await.unwrap();

    // Receive
    let msg = tokio::time::timeout(Duration::from_secs(1), sub.next())
        .await
        .unwrap()
        .unwrap();

    assert_eq!(msg.data, b"test message");
}

#[tokio::test]
async fn test_nats_request_reply_pattern() {
    let docker = Cli::default();
    let nats = docker.run(GenericImage::new("nats", "latest").with_exposed_port(4222));
    let url = format!("nats://localhost:{}", nats.get_host_port_ipv4(4222));

    let client = NatsClient::connect(&url).await.unwrap();

    // Setup responder
    let client_clone = client.clone();
    tokio::spawn(async move {
        let mut sub = client_clone.subscribe("test.request").await.unwrap();
        while let Some(msg) = sub.next().await {
            if let Some(reply) = msg.reply {
                client_clone.publish(&reply, b"response").await.unwrap();
            }
        }
    });

    tokio::time::sleep(Duration::from_millis(100)).await;

    // Send request
    let response = client
        .request("test.request", b"request", Duration::from_secs(1))
        .await
        .unwrap();

    assert_eq!(response.data, b"response");
}

#[tokio::test]
async fn test_nats_queue_groups() {
    let docker = Cli::default();
    let nats = docker.run(GenericImage::new("nats", "latest").with_exposed_port(4222));
    let url = format!("nats://localhost:{}", nats.get_host_port_ipv4(4222));

    let client = NatsClient::connect(&url).await.unwrap();

    // Create queue group with 3 workers
    let counter = Arc::new(AtomicU32::new(0));
    let mut handles = vec![];

    for i in 0..3 {
        let client_clone = client.clone();
        let counter_clone = Arc::clone(&counter);
        let handle = tokio::spawn(async move {
            let mut sub = client_clone
                .queue_subscribe("work.tasks", "workers")
                .await
                .unwrap();

            while let Some(_msg) = sub.next().await {
                counter_clone.fetch_add(1, Ordering::Relaxed);
            }
        });
        handles.push(handle);
    }

    tokio::time::sleep(Duration::from_millis(100)).await;

    // Publish 10 messages
    for i in 0..10 {
        client.publish("work.tasks", b"task").await.unwrap();
    }

    tokio::time::sleep(Duration::from_millis(200)).await;

    // All messages should be processed
    assert_eq!(counter.load(Ordering::Relaxed), 10);
}
```

### API Contract Tests

```rust
// File: tests/integration/api/contract_tests.rs

use llm_copilot_agent::api::Server;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn test_api_nlp_classify_endpoint_contract() {
    let app = create_test_app().await;

    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/nlp/classify")
        .header("content-type", "application/json")
        .body(Body::from(
            json!({
                "query": "Show me CPU usage",
                "session_id": "test_session"
            })
            .to_string()
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Verify response contract
    assert!(json.get("intent_type").is_some());
    assert!(json.get("confidence").is_some());
    assert!(json.get("entities").is_some());

    let confidence = json["confidence"].as_f64().unwrap();
    assert!(confidence >= 0.0 && confidence <= 1.0);
}

#[tokio::test]
async fn test_api_workflow_execute_endpoint_contract() {
    let app = create_test_app().await;

    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/workflows/execute")
        .header("content-type", "application/json")
        .body(Body::from(
            json!({
                "workflow_name": "deploy-to-staging",
                "parameters": {
                    "service": "auth-service",
                    "version": "v1.2.3"
                }
            })
            .to_string()
        ))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::ACCEPTED);

    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Verify response contract
    assert!(json.get("workflow_id").is_some());
    assert!(json.get("status").is_some());
    assert_eq!(json["status"], "pending");
}
```

### Coverage Requirements

| Integration Type | Scenarios | Avg Duration |
|-----------------|-----------|--------------|
| Database | 30+ | <5s each |
| Module Adapters | 25+ | <3s each |
| Messaging | 15+ | <2s each |
| API Contracts | 40+ | <1s each |
| **Total** | **110+** | **<15min** |

---

## End-to-End Testing Strategy

### Overview

E2E tests validate complete user journeys through the system, simulating real-world usage patterns with all components integrated.

### Test Environment

```yaml
# docker-compose.e2e.yml
version: '3.8'

services:
  copilot-agent:
    build: .
    environment:
      - DATABASE_URL=postgresql://test:test@postgres:5432/copilot_e2e
      - REDIS_URL=redis://redis:6379
      - NATS_URL=nats://nats:4222
    depends_on:
      - postgres
      - redis
      - qdrant
      - nats
    ports:
      - "8080:8080"

  # All infrastructure services...
```

### E2E Test Structure

```
tests/
└── e2e/
    ├── user_journeys/
    │   ├── simple_query_test.rs
    │   ├── multi_turn_conversation_test.rs
    │   └── workflow_execution_test.rs
    ├── failure_scenarios/
    │   ├── database_failure_test.rs
    │   ├── llm_timeout_test.rs
    │   └── workflow_rollback_test.rs
    └── performance/
        └── load_test.rs
```

### Simple Query E2E Test

```rust
// File: tests/e2e/user_journeys/simple_query_test.rs

use llm_copilot_agent::client::CopilotClient;

#[tokio::test]
async fn test_simple_metrics_query_end_to_end() {
    // Setup
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    // Execute query
    let response = client
        .send_message(&session.id, "Show me CPU usage for auth-service")
        .await
        .unwrap();

    // Verify response
    assert!(response.intent == IntentType::QueryMetrics);
    assert!(response.success);
    assert!(response.data.is_some());

    // Verify PromQL query was generated
    let query = response.metadata.get("promql_query").unwrap();
    assert!(query.contains("cpu_usage"));
    assert!(query.contains(r#"service="auth-service""#));

    // Verify response time SLA
    assert!(response.duration_ms < 1000); // <1s for simple query
}

#[tokio::test]
async fn test_log_search_end_to_end() {
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    let response = client
        .send_message(&session.id, "Find error logs in payment-service from last hour")
        .await
        .unwrap();

    assert_eq!(response.intent, IntentType::QueryLogs);
    assert!(response.success);

    // Verify LogQL query was generated
    let query = response.metadata.get("logql_query").unwrap();
    assert!(query.contains(r#"{service="payment-service"}"#));
    assert!(query.contains("|= `error`"));
}
```

### Multi-Turn Conversation E2E Test

```rust
// File: tests/e2e/user_journeys/multi_turn_conversation_test.rs

#[tokio::test]
async fn test_multi_turn_conversation_with_context() {
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    // Turn 1: Initial query
    let response1 = client
        .send_message(&session.id, "Show me CPU usage for auth-service")
        .await
        .unwrap();

    assert!(response1.success);

    // Turn 2: Follow-up using context
    let response2 = client
        .send_message(&session.id, "What about memory?")
        .await
        .unwrap();

    assert!(response2.success);
    // Should understand "memory" refers to auth-service from context
    let query = response2.metadata.get("promql_query").unwrap();
    assert!(query.contains("memory"));
    assert!(query.contains(r#"service="auth-service""#));

    // Turn 3: Time range modification
    let response3 = client
        .send_message(&session.id, "Show me the last 24 hours")
        .await
        .unwrap();

    assert!(response3.success);
    let query = response3.metadata.get("promql_query").unwrap();
    assert!(query.contains("[24h]"));
    assert!(query.contains(r#"service="auth-service""#));
}

#[tokio::test]
async fn test_conversation_context_compression() {
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    // Simulate long conversation (30 turns)
    for i in 0..30 {
        client
            .send_message(&session.id, &format!("Query number {}", i))
            .await
            .unwrap();
    }

    // Retrieve context
    let context = client.get_context(&session.id).await.unwrap();

    // Should be compressed to fit token budget
    assert!(context.token_count <= 8000);
    assert!(context.compression_applied);

    // Recent turns should be preserved
    assert!(context.turns.len() >= 3);
}
```

### Workflow Execution E2E Test

```rust
// File: tests/e2e/user_journeys/workflow_execution_test.rs

#[tokio::test]
async fn test_deployment_workflow_end_to_end() {
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    // Trigger deployment workflow
    let response = client
        .send_message(
            &session.id,
            "Deploy auth-service v1.2.3 to staging with tests"
        )
        .await
        .unwrap();

    assert_eq!(response.intent, IntentType::ExecuteWorkflow);
    let workflow_id = response.metadata.get("workflow_id").unwrap();

    // Stream workflow progress
    let mut stream = client.stream_workflow(&workflow_id).await.unwrap();

    let mut events = Vec::new();
    while let Some(event) = stream.next().await {
        events.push(event);
        if event.event_type == WorkflowEventType::Completed {
            break;
        }
    }

    // Verify workflow executed all stages
    assert!(events.iter().any(|e| e.task_name.as_ref().unwrap() == "build"));
    assert!(events.iter().any(|e| e.task_name.as_ref().unwrap() == "test"));
    assert!(events.iter().any(|e| e.task_name.as_ref().unwrap() == "deploy"));

    // Verify final state
    let workflow = client.get_workflow(&workflow_id).await.unwrap();
    assert_eq!(workflow.state, WorkflowState::Completed);
    assert!(workflow.all_tasks_succeeded());
}

#[tokio::test]
async fn test_workflow_with_approval_gate() {
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    let response = client
        .send_message(
            &session.id,
            "Deploy to production with approval"
        )
        .await
        .unwrap();

    let workflow_id = response.metadata.get("workflow_id").unwrap();

    // Wait for approval gate
    tokio::time::sleep(Duration::from_secs(2)).await;

    let workflow = client.get_workflow(&workflow_id).await.unwrap();
    assert_eq!(workflow.state, WorkflowState::WaitingApproval);

    // Approve
    client.approve_workflow(&workflow_id, "test_user").await.unwrap();

    // Wait for completion
    tokio::time::sleep(Duration::from_secs(5)).await;

    let workflow = client.get_workflow(&workflow_id).await.unwrap();
    assert_eq!(workflow.state, WorkflowState::Completed);
}
```

### Failure Scenario Tests

```rust
// File: tests/e2e/failure_scenarios/database_failure_test.rs

#[tokio::test]
async fn test_graceful_degradation_on_database_failure() {
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    // Simulate database failure
    stop_postgres_container().await;

    // Query should still work (cached or in-memory fallback)
    let response = client
        .send_message(&session.id, "Show me CPU usage")
        .await
        .unwrap();

    // Should succeed with degraded service indicator
    assert!(response.success);
    assert!(response.metadata.contains_key("degraded_mode"));

    // Restore database
    start_postgres_container().await;
}

#[tokio::test]
async fn test_workflow_recovery_after_crash() {
    let client = CopilotClient::new("http://localhost:8080").await;
    let session = client.create_session("test_user").await.unwrap();

    // Start long-running workflow
    let response = client
        .send_message(&session.id, "Run integration tests")
        .await
        .unwrap();

    let workflow_id = response.metadata.get("workflow_id").unwrap();

    // Wait for some tasks to complete
    tokio::time::sleep(Duration::from_secs(2)).await;

    // Simulate agent crash
    restart_agent_container().await;

    // Wait for recovery
    tokio::time::sleep(Duration::from_secs(5)).await;

    // Workflow should resume from checkpoint
    let workflow = client.get_workflow(&workflow_id).await.unwrap();
    assert!(workflow.state == WorkflowState::Running || workflow.state == WorkflowState::Completed);

    // Should not re-execute completed tasks
    assert!(workflow.resumed_from_checkpoint);
}
```

### Concurrent User Test

```rust
// File: tests/e2e/performance/concurrent_users_test.rs

#[tokio::test]
async fn test_1000_concurrent_users() {
    let client = Arc::new(CopilotClient::new("http://localhost:8080").await);
    let mut handles = vec![];

    // Spawn 1000 concurrent sessions
    for i in 0..1000 {
        let client_clone = Arc::clone(&client);
        let handle = tokio::spawn(async move {
            let session = client_clone
                .create_session(&format!("user_{}", i))
                .await
                .unwrap();

            let response = client_clone
                .send_message(&session.id, "Show me CPU usage")
                .await
                .unwrap();

            assert!(response.success);
            response.duration_ms
        });
        handles.push(handle);
    }

    // Collect results
    let mut durations = vec![];
    for handle in handles {
        let duration = handle.await.unwrap();
        durations.push(duration);
    }

    // Calculate percentiles
    durations.sort();
    let p50 = durations[durations.len() / 2];
    let p95 = durations[durations.len() * 95 / 100];
    let p99 = durations[durations.len() * 99 / 100];

    println!("P50: {}ms, P95: {}ms, P99: {}ms", p50, p95, p99);

    // Verify SLA
    assert!(p95 < 2000); // P95 < 2s
    assert!(p99 < 5000); // P99 < 5s
}
```

### Coverage Requirements

| Journey Type | Scenarios | Avg Duration |
|--------------|-----------|--------------|
| Simple Queries | 15+ | <5s each |
| Multi-Turn | 10+ | <10s each |
| Workflows | 12+ | <30s each |
| Failures | 8+ | <15s each |
| **Total** | **45+** | **<30min** |

---

## Performance Testing Strategy

### Overview

Performance tests validate system behavior under load, stress, and sustained usage to ensure SLA compliance and identify bottlenecks.

### Tools

- **k6**: Load testing and performance validation
- **Gatling**: Complex scenario simulation
- **wrk**: HTTP benchmarking
- **Locust**: Python-based load testing

### Performance Test Categories

1. **Load Testing**: Expected production load
2. **Stress Testing**: Beyond capacity to find breaking point
3. **Soak Testing**: Sustained load to detect memory leaks
4. **Spike Testing**: Sudden traffic increases
5. **Scalability Testing**: Performance across different scales

### k6 Load Test Script

```javascript
// File: tests/performance/load_test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const intentAccuracy = new Rate('intent_accuracy');
const responseTime = new Trend('response_time');

// Load test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp to 500 users
    { duration: '5m', target: 500 },   // Stay at 500 users
    { duration: '2m', target: 1000 },  // Ramp to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users
    { duration: '3m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s
    http_req_failed: ['rate<0.01'],    // <1% errors
    intent_accuracy: ['rate>0.95'],    // >95% accuracy
  },
};

const BASE_URL = 'http://localhost:8080';

export default function() {
  // Create session
  const sessionRes = http.post(`${BASE_URL}/api/v1/sessions`, JSON.stringify({
    user_id: `user_${__VU}`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(sessionRes, {
    'session created': (r) => r.status === 201,
  });

  const sessionId = sessionRes.json('session_id');

  // Send query
  const queries = [
    'Show me CPU usage for auth-service',
    'What errors occurred in the last hour?',
    'Deploy to staging',
    'Show me memory usage',
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];

  const queryStart = Date.now();
  const queryRes = http.post(`${BASE_URL}/api/v1/messages`, JSON.stringify({
    session_id: sessionId,
    message: query,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const duration = Date.now() - queryStart;
  responseTime.add(duration);

  check(queryRes, {
    'query successful': (r) => r.status === 200,
    'has intent': (r) => r.json('intent_type') !== undefined,
    'high confidence': (r) => r.json('confidence') >= 0.95,
  });

  if (queryRes.status === 200 && queryRes.json('confidence') >= 0.95) {
    intentAccuracy.add(1);
  } else {
    intentAccuracy.add(0);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

### Stress Test

```javascript
// File: tests/performance/stress_test.js

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },   // Normal load
    { duration: '5m', target: 2000 },   // Above capacity
    { duration: '5m', target: 5000 },   // Extreme load
    { duration: '2m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<10000'], // Stay under 10s even under stress
    http_req_failed: ['rate<0.10'],     // <10% errors acceptable
  },
};

const BASE_URL = 'http://localhost:8080';

export default function() {
  const res = http.post(`${BASE_URL}/api/v1/messages`, JSON.stringify({
    session_id: 'test_session',
    message: 'Show me CPU usage',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'not server error': (r) => r.status !== 500,
  });
}
```

### Soak Test

```javascript
// File: tests/performance/soak_test.js

export const options = {
  stages: [
    { duration: '5m', target: 500 },     // Ramp to normal load
    { duration: '12h', target: 500 },    // Sustained load
    { duration: '5m', target: 0 },       // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

// Same test logic as load test
```

### Latency Benchmarks

```rust
// File: tests/performance/latency_benchmarks.rs

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};
use llm_copilot_agent::nlp_engine::IntentClassifier;

fn bench_intent_classification(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let classifier = runtime.block_on(async {
        IntentClassifier::new_with_cache().await
    });

    let mut group = c.benchmark_group("intent_classification");

    let queries = vec![
        "Show me CPU usage",
        "Deploy to production",
        "What errors occurred?",
    ];

    for query in queries {
        group.bench_with_input(
            BenchmarkId::from_parameter(query),
            query,
            |b, q| {
                b.to_async(&runtime).iter(|| async {
                    classifier.classify(q).await
                });
            },
        );
    }

    group.finish();
}

fn bench_context_retrieval(c: &mut Criterion) {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let context_engine = runtime.block_on(async {
        ContextEngine::new().await
    });

    // Seed with data
    runtime.block_on(async {
        for i in 0..1000 {
            context_engine.store(&format!("key_{}", i), "data").await.unwrap();
        }
    });

    c.bench_function("context_retrieval_1000_entries", |b| {
        b.to_async(&runtime).iter(|| async {
            context_engine.get("key_500").await
        });
    });
}

criterion_group!(
    benches,
    bench_intent_classification,
    bench_context_retrieval,
);
criterion_main!(benches);
```

### Performance Test Matrix

| Test Type | Duration | Concurrent Users | Throughput Target | Latency Target (P95) |
|-----------|----------|------------------|-------------------|----------------------|
| Load | 30min | 100-1000 | 100 req/s | <2s |
| Stress | 15min | 1000-5000 | Best effort | <10s |
| Soak | 12 hours | 500 | 50 req/s | <2s |
| Spike | 10min | 0-2000-0 | Best effort | <5s |
| Latency | 10min | 1 | N/A | <500ms (cached) |

### Performance SLAs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | 43.2min downtime/month |
| Simple Query | <1s | P95 latency |
| Complex Query | <2s | P95 latency |
| Concurrent Users | 1000 | Per instance |
| Throughput | 100 req/s | Sustained |
| Intent Accuracy | >95% | Classification confidence |
| Test Gen Accuracy | >90% | Relevance score |

---

## Test Data Management

### Overview

Effective test data management ensures consistent, realistic, and maintainable test datasets across all test levels.

### Test Data Strategy

```
Test Data Sources
├── Fixtures (Static)
│   ├── Valid inputs
│   ├── Edge cases
│   └── Error scenarios
├── Factories (Generated)
│   ├── Random data
│   ├── Property-based
│   └── Parametric
├── Snapshots (Captured)
│   ├── Production anonymized
│   ├── LLM responses
│   └── API responses
└── Mocks (Simulated)
    ├── LLM responses
    ├── Module adapters
    └── External services
```

### Test Fixtures

```rust
// File: tests/fixtures/mod.rs

use llm_copilot_agent::types::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestFixtures {
    pub intents: Vec<IntentFixture>,
    pub queries: Vec<QueryFixture>,
    pub workflows: Vec<WorkflowFixture>,
}

impl TestFixtures {
    pub fn load() -> Self {
        let fixtures_path = std::path::Path::new("tests/fixtures/data.json");
        let content = std::fs::read_to_string(fixtures_path)
            .expect("Failed to read fixtures");
        serde_json::from_str(&content).expect("Failed to parse fixtures")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentFixture {
    pub query: String,
    pub expected_intent: IntentType,
    pub expected_confidence: f32,
    pub expected_entities: Vec<EntityFixture>,
}

// File: tests/fixtures/data.json
{
  "intents": [
    {
      "query": "Show me CPU usage for auth-service",
      "expected_intent": "QueryMetrics",
      "expected_confidence": 0.95,
      "expected_entities": [
        { "type": "Service", "value": "auth-service" },
        { "type": "Metric", "value": "cpu" }
      ]
    },
    // ... more fixtures
  ]
}
```

### Test Data Factories

```rust
// File: tests/factories/mod.rs

use fake::{Fake, Faker};
use llm_copilot_agent::types::*;

pub struct ConversationFactory;

impl ConversationFactory {
    pub fn build() -> Conversation {
        Conversation {
            session_id: Faker.fake(),
            user_id: Faker.fake(),
            turns: vec![],
            created_at: chrono::Utc::now(),
        }
    }

    pub fn with_turns(mut self, count: usize) -> Conversation {
        let mut conversation = Self::build();
        for _ in 0..count {
            conversation.turns.push(ConversationTurnFactory::build());
        }
        conversation
    }
}

pub struct WorkflowFactory;

impl WorkflowFactory {
    pub fn build() -> WorkflowDefinition {
        WorkflowDefinition {
            name: format!("test-workflow-{}", Faker.fake::<u32>()),
            tasks: vec![
                Task {
                    id: "task1".to_string(),
                    task_type: TaskType::Command,
                    command: "echo test".to_string(),
                    dependencies: vec![],
                },
            ],
        }
    }

    pub fn complex_dag() -> WorkflowDefinition {
        WorkflowDefinition {
            name: "complex-workflow".to_string(),
            tasks: vec![
                Task::new("build", vec![]),
                Task::new("unit_test", vec!["build"]),
                Task::new("integration_test", vec!["build"]),
                Task::new("e2e_test", vec!["build"]),
                Task::new("deploy", vec!["unit_test", "integration_test", "e2e_test"]),
            ],
        }
    }
}

// Property-based test data generation
use proptest::prelude::*;

prop_compose! {
    pub fn arb_conversation()(
        session_id in "[a-z]{10}",
        user_id in "[a-z]{8}",
        turn_count in 1..10usize,
    ) -> Conversation {
        let mut conversation = Conversation {
            session_id,
            user_id,
            turns: vec![],
            created_at: chrono::Utc::now(),
        };

        for _ in 0..turn_count {
            conversation.turns.push(ConversationTurnFactory::build());
        }

        conversation
    }
}
```

### LLM Response Mocking

```rust
// File: tests/mocks/llm_mock.rs

use mockall::mock;
use llm_copilot_agent::llm::*;

mock! {
    pub LlmClient {}

    #[async_trait]
    impl LlmClient for LlmClient {
        async fn classify_intent(&self, query: &str) -> Result<ClassifiedIntent, LlmError>;
        async fn extract_entities(&self, query: &str) -> Result<Vec<Entity>, LlmError>;
        async fn translate_query(&self, intent: &ClassifiedIntent) -> Result<String, LlmError>;
    }
}

impl MockLlmClient {
    pub fn with_intent_responses(responses: Vec<(&str, IntentType, f32)>) -> Self {
        let mut mock = MockLlmClient::new();

        for (query, intent, confidence) in responses {
            mock.expect_classify_intent()
                .withf(move |q| q.contains(query))
                .returning(move |_| {
                    Ok(ClassifiedIntent {
                        intent_type: intent,
                        confidence,
                        entities: vec![],
                    })
                });
        }

        mock
    }
}

// Snapshot-based LLM mocking for deterministic tests
pub struct SnapshotLlmMock {
    snapshots: HashMap<String, ClassifiedIntent>,
}

impl SnapshotLlmMock {
    pub fn load_from_file(path: &str) -> Self {
        let content = std::fs::read_to_string(path).unwrap();
        let snapshots: HashMap<String, ClassifiedIntent> =
            serde_json::from_str(&content).unwrap();

        Self { snapshots }
    }
}

#[async_trait]
impl LlmClient for SnapshotLlmMock {
    async fn classify_intent(&self, query: &str) -> Result<ClassifiedIntent, LlmError> {
        self.snapshots
            .get(query)
            .cloned()
            .ok_or(LlmError::NotFound)
    }
}
```

### Database Seeding

```rust
// File: tests/seeds/mod.rs

use llm_copilot_agent::storage::PostgresStore;

pub struct TestSeeder {
    store: PostgresStore,
}

impl TestSeeder {
    pub async fn new(store: PostgresStore) -> Self {
        Self { store }
    }

    pub async fn seed_conversations(&self, count: usize) -> Result<(), Error> {
        for i in 0..count {
            let conversation = ConversationFactory::with_turns(5);
            self.store.save_conversation(&conversation).await?;
        }
        Ok(())
    }

    pub async fn seed_workflows(&self, count: usize) -> Result<(), Error> {
        for i in 0..count {
            let workflow = WorkflowFactory::build();
            self.store.save_workflow(&workflow).await?;
        }
        Ok(())
    }

    pub async fn seed_production_like_data(&self) -> Result<(), Error> {
        // Seed realistic production-like data
        self.seed_conversations(1000).await?;
        self.seed_workflows(500).await?;
        self.seed_entities(2000).await?;
        Ok(())
    }
}
```

### Anonymization for Production Data

```rust
// File: tests/tools/anonymizer.rs

use llm_copilot_agent::types::*;

pub struct DataAnonymizer;

impl DataAnonymizer {
    pub fn anonymize_conversation(conversation: &Conversation) -> Conversation {
        Conversation {
            session_id: hash_id(&conversation.session_id),
            user_id: hash_id(&conversation.user_id),
            turns: conversation
                .turns
                .iter()
                .map(|turn| Self::anonymize_turn(turn))
                .collect(),
            created_at: conversation.created_at,
        }
    }

    fn anonymize_turn(turn: &ConversationTurn) -> ConversationTurn {
        ConversationTurn {
            user_message: Self::redact_pii(&turn.user_message),
            assistant_response: Self::redact_pii(&turn.assistant_response),
            timestamp: turn.timestamp,
        }
    }

    fn redact_pii(text: &str) -> String {
        let email_regex = regex::Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap();
        let phone_regex = regex::Regex::new(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b").unwrap();

        let text = email_regex.replace_all(text, "[EMAIL]");
        let text = phone_regex.replace_all(&text, "[PHONE]");

        text.to_string()
    }
}

fn hash_id(id: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(id.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

---

## CI/CD Integration

### Overview

Automated testing is integrated into the CI/CD pipeline to ensure code quality at every stage of development.

### GitHub Actions Workflow

```yaml
# File: .github/workflows/test.yml

name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  RUST_VERSION: "1.75"
  CARGO_TERM_COLOR: always

jobs:
  lint:
    name: Lint and Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: ${{ env.RUST_VERSION }}
          components: rustfmt, clippy
          override: true

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Check formatting
        run: cargo fmt --all -- --check

      - name: Run clippy
        run: cargo clippy --all-targets --all-features -- -D warnings

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: ${{ env.RUST_VERSION }}
          override: true

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Run unit tests
        run: cargo test --lib --bins
        env:
          RUST_BACKTRACE: 1

      - name: Generate coverage report
        uses: actions-rs/tarpaulin@v0.1
        with:
          version: '0.22.0'
          args: '--all-features --workspace --timeout 300 --out Xml'

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./cobertura.xml
          fail_ci_if_error: true

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: copilot_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

      qdrant:
        image: qdrant/qdrant:latest
        ports:
          - 6333:6333

      nats:
        image: nats:latest
        ports:
          - 4222:4222

    steps:
      - uses: actions/checkout@v3

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: ${{ env.RUST_VERSION }}
          override: true

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Run database migrations
        run: |
          cargo install sqlx-cli --no-default-features --features postgres
          sqlx migrate run
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/copilot_test

      - name: Run integration tests
        run: cargo test --test '*' -- --test-threads=1
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/copilot_test
          REDIS_URL: redis://localhost:6379
          QDRANT_URL: http://localhost:6333
          NATS_URL: nats://localhost:4222

  e2e-tests:
    name: End-to-End Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          load: true
          tags: llm-copilot-agent:test
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30  # Wait for services to be ready

      - name: Run E2E tests
        run: cargo test --test e2e_*
        env:
          API_URL: http://localhost:8080

      - name: Collect logs
        if: failure()
        run: docker-compose -f docker-compose.test.yml logs > logs.txt

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: docker-logs
          path: logs.txt

      - name: Shutdown services
        if: always()
        run: docker-compose -f docker-compose.test.yml down

  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build and start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30

      - name: Install k6
        run: |
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run load tests
        run: k6 run tests/performance/load_test.js --out json=results.json

      - name: Analyze results
        run: |
          python tests/performance/analyze_results.py results.json

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: results.json

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('results.json'));

            const comment = `
            ## Performance Test Results

            - P95 Latency: ${results.metrics.http_req_duration.p95}ms
            - Requests/sec: ${results.metrics.http_reqs.rate}
            - Error Rate: ${results.metrics.http_req_failed.rate * 100}%
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run cargo audit
        uses: actions-rs/audit-check@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### Pre-commit Hooks

```bash
# File: .git/hooks/pre-commit

#!/bin/bash

echo "Running pre-commit checks..."

# Format check
echo "Checking code formatting..."
cargo fmt --all -- --check
if [ $? -ne 0 ]; then
    echo "❌ Code formatting check failed. Run 'cargo fmt' to fix."
    exit 1
fi

# Clippy
echo "Running clippy..."
cargo clippy --all-targets --all-features -- -D warnings
if [ $? -ne 0 ]; then
    echo "❌ Clippy found issues."
    exit 1
fi

# Unit tests
echo "Running unit tests..."
cargo test --lib --bins
if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed."
    exit 1
fi

echo "✅ All pre-commit checks passed!"
exit 0
```

### Nightly Test Pipeline

```yaml
# File: .github/workflows/nightly.yml

name: Nightly Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Run at 2 AM UTC daily
  workflow_dispatch:

jobs:
  soak-test:
    name: 12-Hour Soak Test
    runs-on: ubuntu-latest
    timeout-minutes: 720  # 12 hours
    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker-compose -f docker-compose.test.yml up -d

      - name: Run soak test
        run: k6 run tests/performance/soak_test.js

      - name: Check for memory leaks
        run: |
          docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" > memory_stats.txt
          python tests/tools/analyze_memory.py memory_stats.txt

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: soak-test-results
          path: |
            memory_stats.txt
            results.json

  mutation-testing:
    name: Mutation Testing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install cargo-mutants
        run: cargo install cargo-mutants

      - name: Run mutation tests
        run: cargo mutants -- --lib

      - name: Upload mutation report
        uses: actions/upload-artifact@v3
        with:
          name: mutation-report
          path: mutants.out/

  property-based-fuzzing:
    name: Property-Based Fuzzing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install cargo-fuzz
        run: cargo install cargo-fuzz

      - name: Run fuzz tests
        run: |
          cargo fuzz run intent_classifier -- -max_total_time=3600
          cargo fuzz run entity_extractor -- -max_total_time=3600

      - name: Upload crash artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: fuzz-crashes
          path: fuzz/artifacts/
```

---

## Quality Gates

### Overview

Quality gates enforce minimum standards before code can progress through the pipeline.

### Gate Definitions

| Gate | Stage | Criteria | Enforcement |
|------|-------|----------|-------------|
| Lint | Pre-commit | No formatting/style issues | Blocking |
| Unit Tests | Pre-commit | All pass, >80% coverage | Blocking |
| Integration Tests | PR | All pass | Blocking |
| E2E Tests | Pre-merge | All pass | Blocking |
| Performance | Pre-merge | P95 < 2s, <1% errors | Warning |
| Security Scan | Pre-merge | No high/critical vulns | Blocking |
| Load Test | Pre-release | 1000 users, P95 < 2s | Blocking |

### Coverage Gates

```rust
// File: scripts/check_coverage.sh

#!/bin/bash

MIN_LINE_COVERAGE=80
MIN_BRANCH_COVERAGE=75

# Run coverage
cargo tarpaulin --all-features --workspace --out Json

# Parse results
LINE_COVERAGE=$(jq '.files | map(.coverage) | add / length' tarpaulin-report.json)
BRANCH_COVERAGE=$(jq '.files | map(.branch_coverage) | add / length' tarpaulin-report.json)

echo "Line Coverage: $LINE_COVERAGE%"
echo "Branch Coverage: $BRANCH_COVERAGE%"

# Check thresholds
if (( $(echo "$LINE_COVERAGE < $MIN_LINE_COVERAGE" | bc -l) )); then
    echo "❌ Line coverage $LINE_COVERAGE% is below minimum $MIN_LINE_COVERAGE%"
    exit 1
fi

if (( $(echo "$BRANCH_COVERAGE < $MIN_BRANCH_COVERAGE" | bc -l) )); then
    echo "❌ Branch coverage $BRANCH_COVERAGE% is below minimum $MIN_BRANCH_COVERAGE%"
    exit 1
fi

echo "✅ Coverage requirements met"
exit 0
```

### Performance Gates

```python
# File: tests/performance/check_performance.py

import json
import sys

def check_performance_sla(results_file):
    with open(results_file) as f:
        results = json.load(f)

    metrics = results['metrics']

    # Check P95 latency
    p95_latency = metrics['http_req_duration']['p(95)']
    if p95_latency > 2000:
        print(f"❌ P95 latency {p95_latency}ms exceeds 2000ms SLA")
        return False

    # Check error rate
    error_rate = metrics['http_req_failed']['rate']
    if error_rate > 0.01:
        print(f"❌ Error rate {error_rate*100}% exceeds 1% SLA")
        return False

    # Check throughput
    throughput = metrics['http_reqs']['rate']
    if throughput < 100:
        print(f"❌ Throughput {throughput} req/s below 100 req/s target")
        return False

    print("✅ All performance SLAs met")
    return True

if __name__ == '__main__':
    if not check_performance_sla(sys.argv[1]):
        sys.exit(1)
```

---

## Test Infrastructure

### Local Development Setup

```bash
# File: scripts/setup_test_env.sh

#!/bin/bash

echo "Setting up local test environment..."

# Start test databases
docker-compose -f docker-compose.test.yml up -d postgres redis qdrant nats

# Wait for services
echo "Waiting for services to be ready..."
sleep 10

# Run migrations
export DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/copilot_test"
cargo install sqlx-cli --no-default-features --features postgres
sqlx migrate run

# Seed test data
cargo run --bin seed_test_data

echo "✅ Test environment ready"
```

### Test Database Management

```rust
// File: tests/helpers/database.rs

use sqlx::PgPool;

pub async fn create_test_database() -> PgPool {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/copilot_test".to_string());

    let pool = PgPool::connect(&db_url).await.expect("Failed to connect to database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}

pub async fn cleanup_test_database(pool: &PgPool) {
    sqlx::query("TRUNCATE TABLE conversations, workflows, entities CASCADE")
        .execute(pool)
        .await
        .expect("Failed to cleanup database");
}
```

### Test Helpers

```rust
// File: tests/helpers/mod.rs

pub mod database;
pub mod fixtures;
pub mod assertions;

use llm_copilot_agent::api::Server;

pub async fn create_test_app() -> Router {
    let config = TestConfig::default();
    Server::build(config).await.unwrap()
}

pub async fn create_test_classifier() -> IntentClassifier {
    let mock_llm = MockLlmClient::with_default_responses();
    IntentClassifier::new(mock_llm)
}

// Custom assertions
pub mod assertions {
    use llm_copilot_agent::types::*;

    pub fn assert_intent_matches(
        classified: &ClassifiedIntent,
        expected_type: IntentType,
        min_confidence: f32,
    ) {
        assert_eq!(
            classified.intent_type, expected_type,
            "Expected intent {:?}, got {:?}",
            expected_type, classified.intent_type
        );
        assert!(
            classified.confidence >= min_confidence,
            "Confidence {} is below minimum {}",
            classified.confidence, min_confidence
        );
    }

    pub fn assert_contains_entity(
        entities: &[Entity],
        entity_type: EntityType,
        value: &str,
    ) {
        assert!(
            entities.iter().any(|e| e.entity_type == entity_type && e.value == value),
            "Expected entity {:?} with value '{}' not found in {:?}",
            entity_type, value, entities
        );
    }
}
```

---

## Test Execution Commands

### Quick Reference

```bash
# Unit tests only
cargo test --lib --bins

# All tests
cargo test --all

# Integration tests
cargo test --test '*'

# E2E tests
cargo test --test 'e2e_*'

# Specific test
cargo test test_intent_classification

# With coverage
cargo tarpaulin --all-features --workspace

# Performance benchmarks
cargo bench

# Load tests
k6 run tests/performance/load_test.js

# Watch mode (auto-rerun on changes)
cargo watch -x test

# Parallel execution
cargo test -- --test-threads=8

# Show output
cargo test -- --nocapture
```

---

## Summary

This comprehensive testing strategy provides:

1. **70/20/10 Testing Pyramid**: Proper distribution ensures fast feedback and confidence
2. **>80% Code Coverage**: Unit tests cover all critical paths
3. **110+ Integration Tests**: Validate component interactions
4. **45+ E2E Tests**: Confirm user journeys work end-to-end
5. **Performance Validation**: Load, stress, and soak tests ensure SLA compliance
6. **Robust Test Data**: Fixtures, factories, and mocks for consistent testing
7. **CI/CD Integration**: Automated quality gates at every stage
8. **Production Readiness**: All tests validate against real-world requirements

### Key Metrics Tracking

| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| Test Coverage | >80% | TBD | - |
| Test Success Rate | >95% | TBD | - |
| Test Execution Time | <30min | TBD | - |
| P95 Latency | <2s | TBD | - |
| Defect Escape Rate | <5% | TBD | - |

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-25
**Next Review:** 2025-12-25
**Owner:** QA Architecture Team
