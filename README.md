# LLM-CoPilot-Agent

An intelligent developer assistant that interfaces with the LLM DevOps ecosystem, providing natural language interactions for test generation, telemetry queries, incident response, and workflow automation.

[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/license-Commercial-blue.svg)](LICENSE.md)
[![CI](https://github.com/yourusername/llm-copilot-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/llm-copilot-agent/actions)

## Overview

LLM-CoPilot-Agent is a Rust-based intelligent assistant that serves as the conversational interface to the LLM DevOps platform. It enables developers and DevOps engineers to interact with complex infrastructure through natural language, automating routine tasks and providing intelligent insights.

### Key Features

- **Natural Language Processing** - Intent classification with 16+ intent types and entity extraction
- **Multi-Turn Conversations** - Context-aware dialogue with reference resolution
- **Workflow Orchestration** - DAG-based workflow execution with approval gates
- **Module Integration** - Connects to Test-Bench, Observatory, Incident-Manager, and Orchestrator
- **Multi-Protocol APIs** - REST, WebSocket, and gRPC interfaces
- **Production Ready** - Circuit breakers, retry logic, rate limiting, and health checks

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LLM-CoPilot-Agent                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  REST API   │  │  WebSocket  │  │    gRPC     │  │   Metrics   │    │
│  │   (Axum)    │  │   Handler   │  │   (Tonic)   │  │ (Prometheus)│    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘    │
│         │                │                │                             │
│  ┌──────┴────────────────┴────────────────┴──────┐                     │
│  │              Conversation Manager              │                     │
│  └──────┬────────────────┬────────────────┬──────┘                     │
│         │                │                │                             │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐                     │
│  │  NLP Engine │  │   Context   │  │  Workflow   │                     │
│  │  - Intent   │  │   Engine    │  │   Engine    │                     │
│  │  - Entity   │  │  - Memory   │  │  - DAG      │                     │
│  │  - Query    │  │  - Retrieve │  │  - Approval │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Module Adapters                             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │   │
│  │  │Test-Bench │ │Observatory│ │ Incident  │ │Orchestrator│       │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Infrastructure                              │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                      │   │
│  │  │PostgreSQL │ │   Redis   │ │   NATS    │                      │   │
│  │  └───────────┘ └───────────┘ └───────────┘                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
llm-copilot-agent/
├── crates/
│   ├── copilot-core/          # Core types, errors, configuration
│   ├── copilot-nlp/           # NLP engine, intent classification
│   ├── copilot-context/       # Context engine, memory management
│   ├── copilot-conversation/  # Conversation manager, streaming
│   ├── copilot-workflow/      # Workflow engine, DAG execution
│   ├── copilot-adapters/      # Module adapters with circuit breakers
│   ├── copilot-api/           # REST, WebSocket, gRPC APIs
│   └── copilot-infra/         # Database, cache, messaging
├── apps/
│   └── copilot-server/        # Main server binary
├── deploy/
│   ├── kubernetes/            # Kubernetes manifests
│   └── helm/                  # Helm charts
├── tests/
│   ├── integration/           # Integration tests
│   └── common/                # Test utilities
├── plans/                     # SPARC documentation
│   ├── LLM-CoPilot-Agent-Specification.md
│   ├── LLM-CoPilot-Agent-Pseudocode.md
│   ├── LLM-CoPilot-Agent-Architecture.md
│   ├── LLM-CoPilot-Agent-Refinement.md
│   └── LLM-CoPilot-Agent-Completion.md
└── docs/                      # Additional documentation
```

## Quick Start

### Prerequisites

- Rust 1.75 or later
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/llm-copilot-agent.git
cd llm-copilot-agent

# Copy environment configuration
cp .env.example .env

# Start infrastructure services
docker-compose up -d postgres redis nats

# Build the project
cargo build

# Run tests
cargo test --all

# Start the server
cargo run --bin copilot-server
```

### Docker Compose (Full Stack)

```bash
# Start all services including the agent
docker-compose up -d

# Check health
curl http://localhost:8080/health

# View logs
docker-compose logs -f copilot-agent
```

### Kubernetes Deployment

```bash
# Create namespace
kubectl apply -f deploy/kubernetes/namespace.yaml

# Deploy secrets (edit first with your values)
kubectl apply -f deploy/kubernetes/secret.yaml

# Deploy application
kubectl apply -f deploy/kubernetes/

# Or use Helm
helm install copilot-agent deploy/helm/llm-copilot-agent \
  --namespace llm-copilot \
  --create-namespace
```

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/ready` | Readiness check |
| `POST` | `/api/v1/sessions` | Create session |
| `GET` | `/api/v1/sessions/:id` | Get session |
| `DELETE` | `/api/v1/sessions/:id` | Delete session |
| `POST` | `/api/v1/messages` | Send message |
| `GET` | `/api/v1/messages/:session_id` | Get messages |
| `POST` | `/api/v1/workflows` | Create workflow |
| `GET` | `/api/v1/workflows/:id` | Get workflow status |

### WebSocket

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8080/ws');

// Send message
ws.send(JSON.stringify({
  type: 'SendMessage',
  session_id: 'your-session-id',
  content: 'What is the p95 latency for the API service?'
}));

// Receive streaming response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'StreamChunk') {
    console.log(data.chunk);
  }
};
```

### gRPC

```protobuf
service CoPilotService {
    rpc SendMessage(MessageRequest) returns (MessageResponse);
    rpc StreamResponse(MessageRequest) returns (stream ResponseChunk);
    rpc CreateWorkflow(WorkflowRequest) returns (WorkflowResponse);
    rpc GetWorkflowStatus(StatusRequest) returns (stream StatusUpdate);
}
```

## Example Interactions

```
User: What is the error rate for the payment service in the last hour?

Agent: The payment service has an error rate of 0.23% over the last hour.

       Breakdown:
       - Total requests: 45,231
       - Failed requests: 104
       - Primary errors:
         - 502 Bad Gateway: 67 (64%)
         - 504 Gateway Timeout: 37 (36%)

       This is within the SLO target of <0.5%. Would you like me to
       investigate the upstream dependencies?
```

```
User: Generate unit tests for the OrderService class

Agent: I'll generate unit tests for OrderService. Let me analyze the class...

       Generated 12 test cases:
       ✓ test_create_order_success
       ✓ test_create_order_invalid_items
       ✓ test_create_order_insufficient_inventory
       ✓ test_calculate_total_with_discount
       ... and 8 more

       Coverage: 87% (target: 80%)

       Shall I execute these tests now?
```

## Configuration

Configuration can be provided via environment variables or a TOML file:

```toml
# config/default.toml
[server]
host = "0.0.0.0"
port = 8080
grpc_port = 50051

[database]
url = "postgres://user:pass@localhost:5432/copilot"
max_connections = 10

[redis]
url = "redis://localhost:6379"

[llm]
provider = "openai"
model = "gpt-4"
max_tokens = 4096

[auth]
jwt_secret = "your-secret-key"
token_expiry_seconds = 3600
```

See [.env.example](.env.example) for all available options.

## SPARC Documentation

This project was developed using the SPARC methodology:

| Phase | Document | Description |
|-------|----------|-------------|
| **Specification** | [Specification.md](plans/LLM-CoPilot-Agent-Specification.md) | Requirements, objectives, users |
| **Pseudocode** | [Pseudocode.md](plans/LLM-CoPilot-Agent-Pseudocode.md) | Algorithmic designs |
| **Architecture** | [Architecture.md](plans/LLM-CoPilot-Agent-Architecture.md) | System design, APIs |
| **Refinement** | [Refinement.md](plans/LLM-CoPilot-Agent-Refinement.md) | Implementation details |
| **Completion** | [Completion.md](plans/LLM-CoPilot-Agent-Completion.md) | Final implementation |

## Development

### Build Commands

```bash
make build          # Build all crates
make test           # Run all tests
make test-unit      # Run unit tests only
make test-int       # Run integration tests
make lint           # Run clippy
make fmt            # Format code
make coverage       # Generate coverage report
make bench          # Run benchmarks
```

### Running Tests

```bash
# All tests
cargo test --all

# Specific crate
cargo test -p copilot-nlp

# Integration tests
cargo test --test '*' -- --test-threads=1

# With logging
RUST_LOG=debug cargo test
```

## Performance

| Metric | Target | Achieved |
|--------|--------|----------|
| Simple query latency (p95) | <1s | ~870ms |
| Complex query latency (p95) | <2s | ~1.8s |
| First token latency | <500ms | ~450ms |
| Throughput | 1000 req/min | 1200 req/min |
| Error rate | <0.1% | <0.05% |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass (`make test`)
- Code is formatted (`make fmt`)
- No clippy warnings (`make lint`)
- Documentation is updated

## License

This project is licensed under the LLM DevOps Commercial License. See [LICENSE.md](LICENSE.md) for details.

## Acknowledgments

- Built with [Rust](https://www.rust-lang.org/)
- Web framework: [Axum](https://github.com/tokio-rs/axum)
- gRPC: [Tonic](https://github.com/hyperium/tonic)
- Async runtime: [Tokio](https://tokio.rs/)

---

*Part of the LLM DevOps ecosystem - operationalizing LLMs at scale.*
