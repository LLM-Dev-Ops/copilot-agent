# LLM-CoPilot-Agent Testing Guide

This directory contains the comprehensive test suite for the LLM-CoPilot-Agent system.

## Quick Start

```bash
# Run all tests
make test-all

# Run specific test types
make test-unit           # Unit tests only (fastest)
make test-integration    # Integration tests
make test-e2e           # End-to-end tests

# Development workflow
make test-watch         # Auto-rerun tests on file changes
make pre-commit         # Run before committing
```

## Directory Structure

```
tests/
├── unit/               # Unit tests (70% of tests)
│   ├── nlp_engine/
│   ├── context_engine/
│   ├── workflow_engine/
│   └── streaming/
│
├── integration/        # Integration tests (20% of tests)
│   ├── database/
│   ├── adapters/
│   ├── messaging/
│   └── api/
│
├── e2e/               # End-to-end tests (10% of tests)
│   ├── user_journeys/
│   ├── failure_scenarios/
│   └── performance/
│
├── performance/       # Performance and load tests
│   ├── load_test.js
│   ├── stress_test.js
│   └── soak_test.js
│
├── fixtures/          # Static test data
│   └── data.json
│
├── factories/         # Test data generators
│   └── mod.rs
│
├── mocks/            # Mock implementations
│   └── llm_mock.rs
│
└── helpers/          # Test utilities
    └── mod.rs
```

## Test Categories

### Unit Tests (70%)

Test individual components in isolation with mocked dependencies.

**Run:** `make test-unit` or `cargo test --lib --bins`

**Examples:**
- Intent classification logic
- Entity extraction algorithms
- State machine transitions
- Cache operations

**Speed:** <5 minutes for all unit tests

### Integration Tests (20%)

Test component interactions with real dependencies (databases, message queues).

**Run:** `make test-integration` or `cargo test --test '*'`

**Examples:**
- Database CRUD operations
- Redis pub/sub
- NATS messaging
- Module adapter integration

**Speed:** <15 minutes for all integration tests

### End-to-End Tests (10%)

Test complete user journeys through the entire system.

**Run:** `make test-e2e` or `cargo test --test 'e2e_*'`

**Examples:**
- Simple query workflows
- Multi-turn conversations
- Workflow execution
- Failure recovery

**Speed:** <30 minutes for all E2E tests

### Performance Tests

Validate system performance under various load conditions.

**Run:**
- `make performance-smoke` - 5 minute quick check
- `make performance-load` - 30 minute full load test
- `make performance-stress` - 15 minute stress test

**Tools:** k6, Gatling, wrk

## Writing Tests

### Unit Test Example

```rust
// tests/unit/nlp_engine/intent_classifier_tests.rs

use llm_copilot_agent::nlp_engine::IntentClassifier;
use mockall::predicate::*;
use tokio::test;

#[tokio::test]
async fn test_classify_metrics_intent() {
    // Arrange
    let classifier = create_test_classifier();
    let query = "Show me CPU usage";

    // Act
    let result = classifier.classify(query).await.unwrap();

    // Assert
    assert_eq!(result.intent_type, IntentType::QueryMetrics);
    assert!(result.confidence >= 0.95);
}
```

### Integration Test Example

```rust
// tests/integration/database/postgres_tests.rs

use testcontainers::{clients::Cli, images::postgres::Postgres};

#[tokio::test]
async fn test_save_conversation() {
    // Start test container
    let docker = Cli::default();
    let postgres = docker.run(Postgres::default());

    // Test database operations
    let store = connect_to_test_db(&postgres).await;
    // ... test logic
}
```

### E2E Test Example

```rust
// tests/e2e/user_journeys/simple_query_test.rs

#[tokio::test]
async fn test_simple_query_end_to_end() {
    let client = CopilotClient::new("http://localhost:8081").await;
    let session = client.create_session("test_user").await.unwrap();

    let response = client
        .send_message(&session.id, "Show me CPU usage")
        .await
        .unwrap();

    assert!(response.success);
    assert!(response.duration_ms < 1000); // SLA check
}
```

## Test Data Management

### Fixtures

Static test data loaded from JSON files.

```rust
use tests::fixtures::TestFixtures;

let fixtures = TestFixtures::load();
let intent_fixture = &fixtures.intents[0];
```

### Factories

Generate test data programmatically.

```rust
use tests::factories::ConversationFactory;

let conversation = ConversationFactory::build()
    .with_turns(5)
    .with_user("test_user");
```

### Mocks

Mock external dependencies for isolated testing.

```rust
use tests::mocks::MockLlmClient;

let mock = MockLlmClient::with_responses(vec![
    ("cpu usage", IntentType::QueryMetrics, 0.95),
]);
```

## Coverage Requirements

| Component | Line Coverage | Branch Coverage |
|-----------|--------------|-----------------|
| NLP Engine | >85% | >80% |
| Context Engine | >85% | >75% |
| Workflow Engine | >90% | >85% |
| **Overall** | **>80%** | **>75%** |

**Check coverage:**
```bash
make coverage
make coverage-check  # Fails if below threshold
```

## Performance SLAs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Simple Query | <1s | P95 latency |
| Complex Query | <2s | P95 latency |
| Concurrent Users | 1000 | Per instance |
| Error Rate | <1% | Failed requests |
| Intent Accuracy | >95% | Classification confidence |

**Validate SLAs:**
```bash
make performance-smoke
```

## CI/CD Integration

### Pre-commit Hooks

Automatically run before each commit:
- Code formatting check
- Linting (clippy)
- Unit tests

**Install:**
```bash
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### GitHub Actions

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Nightly for long-running tests

**Workflows:**
- `.github/workflows/test.yml` - Main test suite
- `.github/workflows/nightly.yml` - Long-running tests

## Troubleshooting

### Tests Failing Locally

1. **Ensure test environment is running:**
   ```bash
   make setup-test-env
   ```

2. **Check service health:**
   ```bash
   docker-compose -f docker-compose.test.yml ps
   ```

3. **View logs:**
   ```bash
   docker-compose -f docker-compose.test.yml logs
   ```

4. **Reset environment:**
   ```bash
   make cleanup-test-env
   make setup-test-env
   ```

### Flaky Tests

If tests fail intermittently:

1. **Check for race conditions** - Use proper synchronization
2. **Increase timeouts** - For slow operations
3. **Isolate test data** - Ensure tests don't interfere with each other
4. **Use test-threads=1** - For integration tests

### Performance Test Issues

1. **Ensure adequate resources:**
   - 4+ CPU cores
   - 8+ GB RAM
   - Fast disk I/O

2. **Close other applications** during performance tests

3. **Use dedicated test environment** for accurate results

## Best Practices

### DO

- ✅ Write tests first (TDD)
- ✅ Keep tests simple and focused
- ✅ Use descriptive test names
- ✅ Mock external dependencies in unit tests
- ✅ Clean up resources (databases, files)
- ✅ Run tests locally before pushing
- ✅ Maintain test fixtures

### DON'T

- ❌ Test implementation details
- ❌ Create interdependent tests
- ❌ Use production data without anonymization
- ❌ Ignore flaky tests
- ❌ Skip tests without good reason
- ❌ Commit commented-out tests

## Resources

- [Testing Strategy Document](../TESTING_STRATEGY.md) - Comprehensive testing strategy
- [Architecture Documentation](../docs/architecture/) - System architecture
- [Rust Testing Guide](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [tokio Testing](https://docs.rs/tokio/latest/tokio/attr.test.html)
- [mockall Documentation](https://docs.rs/mockall/)
- [k6 Documentation](https://k6.io/docs/)

## Support

For questions or issues:
1. Check this README
2. Review the [Testing Strategy](../TESTING_STRATEGY.md)
3. Check existing tests for examples
4. Ask in team chat or create an issue
