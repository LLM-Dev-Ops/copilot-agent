# Testing Quick Reference

One-page reference for common testing tasks.

## Quick Commands

```bash
# Run tests
make test              # Unit tests only (fastest)
make test-all          # All tests
make test-watch        # Auto-rerun on changes

# Coverage
make coverage          # Generate HTML report
make coverage-check    # Validate >80% threshold

# Quality checks
make check             # Format + lint
make pre-commit        # Pre-commit validation

# Performance
make performance-smoke # 5-min quick check
make performance-load  # 30-min full test
```

## Test by Component

| Component | Command | Location |
|-----------|---------|----------|
| NLP Engine | `cargo test nlp_engine` | `tests/unit/nlp_engine/` |
| Context Engine | `cargo test context_engine` | `tests/unit/context_engine/` |
| Workflow Engine | `cargo test workflow_engine` | `tests/unit/workflow_engine/` |
| Database | `cargo test --test postgres` | `tests/integration/database/` |
| E2E | `cargo test --test e2e` | `tests/e2e/` |

## Coverage Targets

| Component | Target | Check |
|-----------|--------|-------|
| Overall | >80% | `make coverage-check` |
| NLP Engine | >85% | See report |
| Workflow Engine | >90% | See report |

## Performance SLAs

| Metric | SLA | Test |
|--------|-----|------|
| P95 Latency | <2s | `make performance-smoke` |
| Error Rate | <1% | Automatic in tests |
| Throughput | >100 req/s | Load test |
| Accuracy | >95% | Integration tests |

## Test Writing Template

### Unit Test
```rust
#[tokio::test]
async fn test_feature_name() {
    // Arrange
    let component = create_test_component();

    // Act
    let result = component.action().await.unwrap();

    // Assert
    assert_eq!(result, expected);
}
```

### Integration Test
```rust
#[tokio::test]
async fn test_database_operation() {
    let docker = Cli::default();
    let postgres = docker.run(Postgres::default());
    let store = setup_test_store(&postgres).await;

    // Test logic

    cleanup(&store).await;
}
```

### E2E Test
```rust
#[tokio::test]
async fn test_user_journey() {
    let client = CopilotClient::new(TEST_URL).await;
    let session = client.create_session("user").await.unwrap();

    let response = client.send_message(
        &session.id,
        "test query"
    ).await.unwrap();

    assert!(response.success);
}
```

## Common Issues

### Problem: Tests timeout
**Solution:** Increase timeout or check for deadlocks
```rust
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_name() { }
```

### Problem: Database connection fails
**Solution:** Ensure test environment is running
```bash
make setup-test-env
```

### Problem: Flaky tests
**Solution:** Use `--test-threads=1` for integration tests
```bash
cargo test --test '*' -- --test-threads=1
```

### Problem: Low coverage
**Solution:** Add tests for uncovered branches
```bash
make coverage  # See HTML report for gaps
```

## CI/CD Checklist

Before merging:
- [ ] `make pre-commit` passes
- [ ] All tests pass locally
- [ ] Coverage >80%
- [ ] Performance SLAs met
- [ ] No security vulnerabilities
- [ ] Code reviewed

## Useful Flags

```bash
# Show output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Run failed tests only
cargo test -- --failed

# Parallel execution
cargo test -- --test-threads=8

# Ignore expensive tests
cargo test -- --skip expensive
```

## Environment Variables

```bash
# Test database
DATABASE_URL=postgresql://test_user:test_pass@localhost:5433/copilot_test

# Test services
REDIS_URL=redis://localhost:6380
QDRANT_URL=http://localhost:6334
NATS_URL=nats://localhost:4223

# API endpoint
API_URL=http://localhost:8081

# Enable debug logs
RUST_LOG=debug
RUST_BACKTRACE=1
```

## Test Data

### Load fixtures
```rust
use tests::fixtures::TestFixtures;
let fixtures = TestFixtures::load();
```

### Create test data
```rust
use tests::factories::*;
let conversation = ConversationFactory::build();
let workflow = WorkflowFactory::complex_dag();
```

### Mock LLM
```rust
use tests::mocks::MockLlmClient;
let mock = MockLlmClient::with_default_responses();
```

## Performance Testing

### Quick check (5 min)
```bash
make performance-smoke
```

### Full load test (30 min)
```bash
k6 run tests/performance/load_test.js \
  --vus 1000 \
  --duration 30m
```

### Stress test (15 min)
```bash
k6 run tests/performance/stress_test.js
```

## Debugging Tests

```bash
# Run with logs
RUST_LOG=debug cargo test -- --nocapture

# Single-threaded (easier debugging)
cargo test -- --test-threads=1

# Specific test with verbose
cargo test test_name -- --nocapture --exact

# With debugger
rust-lldb target/debug/deps/test_binary
```

## Resources

- [Full Testing Strategy](./TESTING_STRATEGY.md)
- [Test README](./tests/README.md)
- [Architecture Docs](./docs/architecture/)
