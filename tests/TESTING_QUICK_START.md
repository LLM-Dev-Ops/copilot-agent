# Testing Quick Start Guide

Quick reference for running tests in the LLM-CoPilot-Agent project.

## 🚀 Quick Commands

```bash
# Run all unit tests (fastest, ~2 min)
make test-unit

# Run integration tests (~5 min)
make test-integration

# Run all tests (~10 min)
make test-all

# Auto-run tests on file changes
make test-watch

# Generate coverage report
make coverage

# Run benchmarks
make bench
```

## 📋 Common Development Workflows

### Before Committing

```bash
# Run pre-commit checks (format, lint, unit tests)
make pre-commit
```

### Writing New Features

```bash
# 1. Write test first
# 2. Run in watch mode
make test-watch

# 3. Run specific test
cargo test my_new_feature -- --nocapture

# 4. Verify all tests pass
make test-all
```

### Debugging Failed Tests

```bash
# Run with output
cargo test failing_test -- --nocapture

# Run single-threaded
cargo test failing_test -- --test-threads=1

# Run specific test file
cargo test --test api_tests
```

## 🔧 Test Environment Setup

### First Time Setup

```bash
# Install development tools
make install-tools

# Start test infrastructure (databases, etc.)
make setup-test-env

# Verify setup
make test-unit
```

### Daily Development

```bash
# Start test services (if not running)
make setup-test-env

# Stop test services (when done)
make cleanup-test-env
```

## 📝 Writing Tests

### Basic Test Template

```rust
#[tokio::test]
async fn test_my_feature() {
    // Arrange
    let input = "test data";

    // Act
    let result = my_function(input).await;

    // Assert
    assert!(result.is_ok());
}
```

### Using Test Utilities

```rust
use crate::common::*;

#[tokio::test]
async fn test_with_utilities() {
    // Use fixtures
    let msg = fixtures::user_message("Hello");

    // Use builders
    let session = create_test_session_manager().0;

    // Use assertions
    assert_intent_confident(&intent);
}
```

### Integration Test with Database

```rust
#[tokio::test]
async fn test_database_operation() {
    with_test_db!(|pool| async move {
        let result = save_to_db(&pool, data).await;
        assert!(result.is_ok());
    });
}
```

## 🎯 Test Categories

| Category | Command | When to Use |
|----------|---------|-------------|
| Unit | `make test-unit` | Testing individual functions |
| Integration | `make test-integration` | Testing component interactions |
| E2E | `make test-e2e` | Testing complete workflows |
| Benchmarks | `make bench` | Performance testing |

## 📊 Coverage

```bash
# Generate HTML coverage report
make coverage

# Open coverage report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux

# Check if coverage meets threshold (80%)
make coverage-check
```

## 🐛 Troubleshooting

### Tests Won't Run

```bash
# Check test environment
make setup-test-env

# Verify services are running
docker ps

# Check logs
docker-compose -f docker-compose.test.yml logs
```

### Flaky Tests

```bash
# Run with single thread
cargo test -- --test-threads=1

# Reset test environment
make cleanup-test-env
make setup-test-env
```

### Slow Tests

```bash
# Run only fast unit tests
cargo test --lib --bins

# Skip integration tests
cargo test --lib
```

## 🔍 Finding Tests

```bash
# List all tests
cargo test -- --list

# Find tests by name
cargo test keyword

# Run tests in specific module
cargo test integration::api_tests
```

## 📈 Benchmarks

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench intent_classification

# Compare with baseline
cargo bench -- --baseline main
```

## 🤖 CI/CD

### Local CI Simulation

```bash
# Run same checks as CI
make ci
```

### CI Status

- ✅ All checks must pass before merge
- 📊 Coverage must be > 80%
- 🔒 Security audit must pass
- 📝 Code must be formatted

## 💡 Pro Tips

### Speed Up Tests

```bash
# Use cargo-nextest (faster test runner)
cargo install cargo-nextest
cargo nextest run

# Run tests in parallel
cargo test -- --test-threads=4
```

### Test Specific Feature

```bash
# Test only conversation module
cargo test conversation

# Test only workflow module
cargo test workflow
```

### Debug Mode

```bash
# Enable debug output
RUST_LOG=debug cargo test -- --nocapture

# Show test execution time
cargo test -- --report-time
```

## 📚 Common Assertions

```rust
// Standard assertions
assert_eq!(actual, expected);
assert!(condition);
assert!(result.is_ok());

// Custom assertions
assert_intent_confident(&intent);
assert_has_entity_type(&entities, "service");
assert_message_contains(&msg, "text");
assert_context_has_key(&context, "key");
```

## 🎨 Test Data

### Using Fixtures

```rust
use crate::common::fixtures::*;

// Sample messages
let query = messages::METRIC_QUERY;

// Sample services
let service = services::AUTH_SERVICE;

// Random data
let service = generators::random_service();
```

### Using Mocks

```rust
use crate::common::mocks::*;

// Mock LLM
let llm = MockLLMProvider::new()
    .with_response("Response");

// Mock database
let db = MockDatabase::new();
```

## 📞 Getting Help

1. **Check documentation**: See TESTING_IMPLEMENTATION.md
2. **Review examples**: Look at existing tests
3. **Run help command**: `make help`
4. **Ask team**: Post in team chat

## ⚡ Keyboard Shortcuts (with cargo-watch)

```bash
# Start watch mode
make test-watch

# In watch mode:
# - Tests auto-run on file save
# - Press Ctrl+C to stop
```

## 🏁 Quick Checklist

Before pushing code:

- [ ] All tests pass: `make test-all`
- [ ] Code formatted: `make format`
- [ ] No lint warnings: `make lint`
- [ ] Coverage > 80%: `make coverage-check`
- [ ] Pre-commit passes: `make pre-commit`

---

**Need more details?** See TESTING_IMPLEMENTATION.md
