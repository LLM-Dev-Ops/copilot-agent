# API Contracts and Validation - Complete Package

This directory contains comprehensive API contracts, validation rules, and implementation code for the LLM-CoPilot-Agent API.

## Documentation

### Primary Documents

1. **[API_CONTRACTS_DOCUMENTATION.md](../API_CONTRACTS_DOCUMENTATION.md)** (850+ lines)
   - Complete REST API documentation
   - WebSocket JSON-RPC protocol guide
   - gRPC usage examples
   - Validation rules reference
   - Error handling guide
   - Authentication & authorization
   - Rate limiting policies
   - Code examples in multiple languages

2. **[API_CONTRACTS_SUMMARY.md](../API_CONTRACTS_SUMMARY.md)** (650+ lines)
   - Executive summary
   - What was created
   - Key features
   - Implementation guidelines
   - Testing strategies
   - File structure overview

3. **[API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)** (500+ lines)
   - Quick lookup tables
   - All endpoints at a glance
   - Error code catalog
   - Validation constraints
   - Rate limits
   - Enums and constants

## Implementation Files

### OpenAPI Specification
- **File**: `schemas/openapi.yaml` (3,000+ lines)
- **Purpose**: Complete REST API contract
- **Features**:
  - 30+ endpoints
  - Detailed request/response schemas
  - Validation constraints
  - Error responses
  - Pagination patterns
  - SSE streaming definitions

### Rust Validation
- **File**: `validation/mod.rs` (1,100+ lines)
- **Purpose**: Request validation and sanitization
- **Features**:
  - Field-level validation (length, pattern, range)
  - Business logic validation (DAG cycles, dependencies)
  - Input sanitization (XSS, SQL injection prevention)
  - Validation middleware
  - Comprehensive test coverage

### Error Handling
- **File**: `contracts/error_codes.rs` (700+ lines)
- **Purpose**: Error code catalog and handling
- **Features**:
  - 90 error codes organized by category
  - Automatic HTTP status mapping
  - Multi-language error messages (6 languages)
  - Production error sanitization
  - Error localization

### WebSocket Protocol
- **File**: `contracts/websocket_jsonrpc.rs` (650+ lines)
- **Purpose**: WebSocket JSON-RPC 2.0 implementation
- **Features**:
  - Request/response types
  - Notification support
  - Batch requests
  - Heartbeat mechanism
  - Connection management

### API Versioning
- **File**: `contracts/versioning.rs` (500+ lines)
- **Purpose**: API version management
- **Features**:
  - Version negotiation
  - Deprecation handling
  - Breaking change policy
  - Migration guides
  - Changelog generation

### gRPC Protocol
- **File**: `proto/service.proto` (800+ lines)
- **Purpose**: gRPC service definitions
- **Features**:
  - 6 gRPC services
  - 80+ message types
  - 25+ enums
  - Streaming support
  - Complete type safety

## Quick Start

### REST API

```bash
# Create session
curl -X POST https://api.llm-copilot-agent.dev/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Session",
    "preferences": {"stream_responses": true}
  }'

# Send message
curl -X POST https://api.llm-copilot-agent.dev/v1/sessions/$SESSION_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Show me CPU usage for auth-service"
  }'
```

### WebSocket

```javascript
const ws = new WebSocket('wss://api.llm-copilot-agent.dev/v1/ws?token=' + token);

ws.send(JSON.stringify({
  jsonrpc: '2.0',
  method: 'message.send',
  params: {
    session_id: 'session-123',
    content: 'Deploy to production'
  },
  id: 1
}));
```

### gRPC (Rust)

```rust
use llm_copilot::v1::session_service_client::SessionServiceClient;

let mut client = SessionServiceClient::connect("http://localhost:50051").await?;

let response = client.create_session(CreateSessionRequest {
    name: "gRPC Session".to_string(),
    ..Default::default()
}).await?;
```

## Directory Structure

```
api/
├── README.md                          # This file
├── schemas/
│   └── openapi.yaml                   # OpenAPI 3.0 specification
├── validation/
│   └── mod.rs                         # Validation rules
├── contracts/
│   ├── error_codes.rs                 # Error catalog
│   ├── websocket_jsonrpc.rs           # WebSocket protocol
│   └── versioning.rs                  # Versioning system
└── proto/
    └── service.proto                  # gRPC definitions
```

## Key Features

### 1. Multi-Protocol Support
- REST API (HTTP/JSON)
- WebSocket (JSON-RPC 2.0)
- gRPC (Protocol Buffers)

### 2. Comprehensive Validation
- Schema validation (types, required fields)
- Constraint validation (length, pattern, range)
- Business logic validation (dependencies, cycles)
- Input sanitization (XSS, injection prevention)

### 3. Error Handling
- 90 error codes across 9 categories
- Multi-language support (6 languages)
- Field-level error details
- Production sanitization

### 4. Security
- JWT authentication
- RBAC authorization
- Input validation
- Rate limiting
- Error sanitization

### 5. Developer Experience
- Clear error messages
- Comprehensive documentation
- Code examples
- Type safety
- API versioning

## Validation Examples

### Valid Session Request
```rust
CreateSessionRequest {
    name: Some("Production Session".to_string()),
    timeout_minutes: Some(60),
    preferences: Some(SessionPreferences {
        language: Some("en".to_string()),
        timezone: Some("America/New_York".to_string()),
        stream_responses: Some(true),
        include_context: Some(true),
    }),
    metadata: None,
}
// ✓ Passes validation
```

### Invalid Request (Shows Error)
```rust
CreateSessionRequest {
    name: Some("Invalid@Session!".to_string()),  // Contains @ and !
    timeout_minutes: Some(2000),                 // > 1440 max
    ..Default::default()
}
// ✗ Fails with field errors:
// - name: "Name can only contain alphanumeric, spaces, hyphens, underscores"
// - timeout_minutes: "Timeout must be 5-1440 minutes"
```

## Error Response Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "field_errors": [
      {
        "field": "tasks[0].timeout_seconds",
        "message": "Timeout must be between 1 and 3600 seconds",
        "constraint": "range: 1-3600"
      },
      {
        "field": "tasks[0].id",
        "message": "Task ID can only contain alphanumeric, hyphens, and underscores",
        "constraint": "pattern: ^[a-zA-Z0-9-_]+$"
      }
    ],
    "documentation_url": "https://docs.llm-copilot-agent.dev/errors/1000",
    "request_id": "req-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Rate Limiting

All endpoints include rate limit headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1700000000
```

**Limits**:
- 1000 requests/hour per user
- 100 requests/minute burst
- 10 concurrent workflows
- 5 WebSocket connections

## Testing

Run validation tests:

```bash
cargo test --package llm-copilot-agent --lib validation
```

Run contract tests:

```bash
cargo test --package llm-copilot-agent --lib contracts
```

## Code Generation

Generate client SDKs from contracts:

```bash
# OpenAPI client generation
openapi-generator-cli generate \
  -i api/schemas/openapi.yaml \
  -g typescript-axios \
  -o clients/typescript

# gRPC client generation
protoc --rust_out=src api/proto/service.proto
protoc --python_out=clients/python api/proto/service.proto
protoc --go_out=clients/go api/proto/service.proto
```

## Validation Middleware

The validation system integrates with Axum middleware:

```rust
use axum::{Router, middleware};
use crate::api::validation::middleware::{validate_content_length, validate_content_type};

let app = Router::new()
    .route("/sessions", post(create_session))
    .layer(middleware::from_fn(validate_content_length))
    .layer(middleware::from_fn(validate_content_type));
```

## Error Localization

Errors automatically localize based on Accept-Language header:

```http
GET /sessions/invalid-uuid
Accept-Language: es

HTTP/1.1 404 Not Found
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Sesión no encontrada"
  }
}
```

## API Versioning

Request specific API version:

```http
GET /sessions
X-API-Version: 1.0.0
```

Response includes version info:

```http
HTTP/1.1 200 OK
X-API-Version: 1.0.0
X-API-Supported-Versions: v1
X-API-Deprecated: false
```

## Resources

### Official Documentation
- [Complete API Docs](../API_CONTRACTS_DOCUMENTATION.md)
- [Quick Reference](API_QUICK_REFERENCE.md)
- [Summary](../API_CONTRACTS_SUMMARY.md)

### Specifications
- [OpenAPI 3.0 Spec](https://spec.openapis.org/oas/v3.0.3)
- [JSON-RPC 2.0 Spec](https://www.jsonrpc.org/specification)
- [Protocol Buffers](https://protobuf.dev/)

### Tools
- [Swagger UI](https://swagger.io/tools/swagger-ui/) - Interactive API docs
- [Postman](https://www.postman.com/) - API testing
- [grpcurl](https://github.com/fullstorydev/grpcurl) - gRPC testing

## Statistics

- **Total Lines**: ~7,600 lines
- **OpenAPI Spec**: 3,000+ lines
- **Validation Code**: 1,100+ lines
- **Error Handling**: 700+ lines
- **WebSocket Protocol**: 650+ lines
- **Versioning**: 500+ lines
- **gRPC Definitions**: 800+ lines
- **Documentation**: 2,000+ lines

- **Endpoints**: 30+ REST endpoints
- **WebSocket Methods**: 20+ methods
- **gRPC Services**: 6 services
- **Error Codes**: 90 codes
- **Validation Rules**: 100+ rules

## Contributing

When adding new endpoints:

1. Update `schemas/openapi.yaml` with endpoint definition
2. Add validation rules in `validation/mod.rs`
3. Add error codes if needed in `contracts/error_codes.rs`
4. Update gRPC proto if applicable
5. Add examples to documentation
6. Write tests for validation logic

## License

See [LICENSE.md](../LICENSE.md) for details.

---

**Version**: 1.0.0
**Created**: 2025-11-25
**Status**: Production Ready
