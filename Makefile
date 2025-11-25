# LLM-CoPilot-Agent - Build and Test Makefile

.PHONY: help build test test-unit test-integration test-e2e test-all
.PHONY: test-watch coverage bench performance
.PHONY: setup-test-env cleanup-test-env
.PHONY: lint format check docker-build docker-run docker-stop
.PHONY: run dev install-tools audit

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Setup and teardown
setup-test-env: ## Start test infrastructure (databases, etc.)
	@echo "Starting test environment..."
	docker-compose -f docker-compose.test.yml up -d postgres-test redis-test qdrant-test nats-test
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "✅ Test environment ready"

cleanup-test-env: ## Stop and remove test infrastructure
	@echo "Cleaning up test environment..."
	docker-compose -f docker-compose.test.yml down -v
	@echo "✅ Test environment cleaned"

# Testing targets
test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	cargo test --lib --bins -- --nocapture

test-integration: setup-test-env ## Run integration tests
	@echo "Running integration tests..."
	DATABASE_URL=postgresql://test_user:test_pass@localhost:5433/copilot_test \
	REDIS_URL=redis://localhost:6380 \
	QDRANT_URL=http://localhost:6334 \
	NATS_URL=nats://localhost:4223 \
	cargo test --test '*' -- --test-threads=1 --nocapture
	$(MAKE) cleanup-test-env

test-e2e: ## Run end-to-end tests
	@echo "Running E2E tests..."
	docker-compose -f docker-compose.test.yml up -d
	@sleep 30
	API_URL=http://localhost:8081 cargo test --test 'e2e_*' -- --nocapture
	docker-compose -f docker-compose.test.yml down -v

test-all: ## Run all tests (unit + integration + e2e)
	@echo "Running all tests..."
	$(MAKE) test-unit
	$(MAKE) test-integration
	$(MAKE) test-e2e

test: test-unit ## Alias for test-unit (fastest feedback)

test-watch: ## Run tests in watch mode (auto-rerun on changes)
	cargo watch -x test

# Code quality
lint: ## Run linter (clippy)
	@echo "Running clippy..."
	cargo clippy --all-targets --all-features -- -D warnings

format: ## Format code
	@echo "Formatting code..."
	cargo fmt --all

format-check: ## Check code formatting
	@echo "Checking code format..."
	cargo fmt --all -- --check

check: format-check lint ## Run all code quality checks

# Coverage
coverage: ## Generate test coverage report
	@echo "Generating coverage report..."
	cargo tarpaulin --all-features --workspace --timeout 300 --out Html --out Xml
	@echo "Coverage report generated: tarpaulin-report.html"

coverage-check: ## Check if coverage meets threshold (80%)
	@echo "Checking coverage threshold..."
	cargo tarpaulin --all-features --workspace --timeout 300 --out Json
	@python3 -c "import json; \
		data = json.load(open('tarpaulin-report.json')); \
		coverage = sum(f['coverage'] for f in data['files'].values()) / len(data['files']); \
		print(f'Coverage: {coverage:.2f}%'); \
		exit(0 if coverage >= 80 else 1)"

# Performance testing
bench: ## Run benchmarks
	@echo "Running benchmarks..."
	cargo bench

performance-smoke: ## Run quick performance smoke test (5 min)
	@echo "Running performance smoke test..."
	docker-compose -f docker-compose.test.yml up -d
	@sleep 30
	k6 run tests/performance/smoke_test.js
	docker-compose -f docker-compose.test.yml down -v

performance-load: ## Run full load test (30 min)
	@echo "Running load test..."
	docker-compose -f docker-compose.test.yml up -d
	@sleep 30
	k6 run tests/performance/load_test.js --out json=results.json
	python3 tests/performance/check_performance.py results.json
	docker-compose -f docker-compose.test.yml down -v

performance-stress: ## Run stress test (15 min)
	@echo "Running stress test..."
	docker-compose -f docker-compose.test.yml up -d
	@sleep 30
	k6 run tests/performance/stress_test.js
	docker-compose -f docker-compose.test.yml down -v

# CI/CD simulation
ci: check test-unit coverage-check ## Simulate CI pipeline locally
	@echo "✅ CI checks passed"

pre-commit: format check test-unit ## Run pre-commit checks
	@echo "✅ Pre-commit checks passed"

# Development helpers
test-specific: ## Run a specific test (usage: make test-specific TEST=test_name)
	cargo test $(TEST) -- --nocapture --test-threads=1

test-failed: ## Re-run only failed tests
	cargo test -- --nocapture --test-threads=1 --failed

# Database management
db-migrate: ## Run database migrations
	@echo "Running migrations..."
	DATABASE_URL=postgresql://test_user:test_pass@localhost:5433/copilot_test \
	sqlx migrate run

db-reset: ## Reset test database
	@echo "Resetting test database..."
	docker-compose -f docker-compose.test.yml down -v postgres-test
	docker-compose -f docker-compose.test.yml up -d postgres-test
	@sleep 5
	$(MAKE) db-migrate

# Documentation
test-doc: ## Generate test documentation
	@echo "Generating test documentation..."
	cargo test --doc

# Clean
clean: ## Clean build artifacts
	cargo clean

clean-all: clean cleanup-test-env ## Clean everything including test environment
	@echo "✅ All cleaned"

# Build targets
build: ## Build the project in release mode
	@echo "Building project (release)..."
	cargo build --release
	@echo "✅ Build complete"

build-dev: ## Build the project in development mode
	@echo "Building project (dev)..."
	cargo build
	@echo "✅ Build complete"

# Docker targets
docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build -t llm-copilot-agent:latest .
	@echo "✅ Docker image built"

docker-run: ## Run Docker container
	@echo "Starting Docker container..."
	docker run -d \
		--name llm-copilot-agent \
		-p 8080:8080 \
		-e RUST_LOG=info \
		llm-copilot-agent:latest
	@echo "✅ Container started at http://localhost:8080"

docker-stop: ## Stop Docker container
	@echo "Stopping Docker container..."
	docker stop llm-copilot-agent || true
	docker rm llm-copilot-agent || true
	@echo "✅ Container stopped"

# Run targets
run: ## Run the server in development mode
	@echo "Running server (development)..."
	cargo run --bin copilot-server

run-release: ## Run the server in release mode
	@echo "Running server (release)..."
	cargo run --release --bin copilot-server

dev: ## Run the server with auto-reload (requires cargo-watch)
	@echo "Running server with auto-reload..."
	cargo watch -x 'run --bin copilot-server'

# Tools
install-tools: ## Install development tools
	@echo "Installing development tools..."
	cargo install cargo-watch
	cargo install cargo-tarpaulin
	cargo install cargo-audit
	cargo install cargo-outdated
	@echo "✅ Tools installed"

audit: ## Run security audit
	@echo "Running security audit..."
	cargo audit
	@echo "✅ Security audit complete"

outdated: ## Check for outdated dependencies
	@echo "Checking for outdated dependencies..."
	cargo outdated
	@echo "✅ Dependency check complete"

update: ## Update dependencies
	@echo "Updating dependencies..."
	cargo update
	@echo "✅ Dependencies updated"

# Documentation
doc: ## Generate documentation
	@echo "Generating documentation..."
	cargo doc --no-deps --all-features --open
	@echo "✅ Documentation generated"

# Complete setup
setup: install-tools ## Initial project setup
	@echo "Setting up project..."
	@echo "✅ Project setup complete"
	@echo "Run 'make help' to see available commands"
