# API Contracts and Validation Rules - Complete Documentation

## Overview

This document provides comprehensive API contracts, validation rules, and implementation guidelines for the LLM-CoPilot-Agent API. The API supports three primary protocols:

1. **REST API** - HTTP/JSON with OpenAPI 3.0
2. **WebSocket** - Real-time bidirectional communication with JSON-RPC 2.0
3. **gRPC** - High-performance RPC with Protocol Buffers

## Table of Contents

- [REST API Contracts](#rest-api-contracts)
- [WebSocket JSON-RPC Contracts](#websocket-json-rpc-contracts)
- [gRPC Protocol Buffers](#grpc-protocol-buffers)
- [Validation Rules](#validation-rules)
- [Error Handling](#error-handling)
- [API Versioning](#api-versioning)
- [Authentication & Authorization](#authentication--authorization)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## REST API Contracts

### Base URL

```
Production:  https://api.llm-copilot-agent.dev/v1
Staging:     https://staging-api.llm-copilot-agent.dev/v1
Development: http://localhost:8080/v1
```

### Authentication

All endpoints require JWT Bearer token authentication:

```http
Authorization: Bearer <jwt-token>
```

### Common Headers

```http
Content-Type: application/json
Accept: application/json
X-API-Version: 1.0.0
X-Request-ID: <uuid>
```

### Endpoint Categories

#### 1. Sessions

**POST /sessions** - Create new conversation session

Request:
```json
{
  "name": "Production deployment session",
  "metadata": {
    "environment": "production",
    "team": "platform"
  },
  "preferences": {
    "language": "en",
    "timezone": "America/New_York",
    "stream_responses": true,
    "include_context": true
  },
  "timeout_minutes": 60
}
```

Response (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "name": "Production deployment session",
  "status": "active",
  "created_at": "2025-11-25T10:00:00Z",
  "updated_at": "2025-11-25T10:00:00Z",
  "last_activity": "2025-11-25T10:00:00Z",
  "message_count": 0,
  "metadata": {
    "environment": "production",
    "team": "platform"
  },
  "preferences": {
    "language": "en",
    "timezone": "America/New_York",
    "stream_responses": true,
    "include_context": true
  }
}
```

**GET /sessions** - List sessions

Query Parameters:
- `page` (integer, default: 1) - Page number
- `page_size` (integer, default: 20, max: 100) - Items per page
- `status` (enum) - Filter by status: active, paused, completed, expired
- `sort` (enum) - Sort by: created_at, updated_at, last_activity

**GET /sessions/{sessionId}** - Get session details

**DELETE /sessions/{sessionId}** - Delete session

#### 2. Messages

**POST /sessions/{sessionId}/messages** - Send message

Request:
```json
{
  "content": "Show me CPU usage for auth-service",
  "attachments": [
    {
      "type": "code",
      "content": "kubectl get pods",
      "filename": "query.sh",
      "mime_type": "text/plain"
    }
  ],
  "context_override": {
    "include_history": true,
    "max_history_turns": 10
  }
}
```

Response (200):
```json
{
  "id": "msg-123",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "assistant",
  "content": "Here's the CPU usage for auth-service...",
  "intent": {
    "type": "query_metrics",
    "confidence": 0.95,
    "parameters": {
      "service": "auth-service",
      "metric": "cpu"
    }
  },
  "entities": [
    {
      "type": "service",
      "value": "auth-service",
      "confidence": 0.98,
      "resolved_value": "auth-service"
    },
    {
      "type": "metric",
      "value": "CPU",
      "confidence": 0.92,
      "resolved_value": "cpu_usage"
    }
  ],
  "created_at": "2025-11-25T10:01:00Z",
  "metadata": {
    "model": "claude-sonnet-4.5",
    "tokens_used": 1250,
    "latency_ms": 850,
    "cache_hit": false
  }
}
```

**GET /sessions/{sessionId}/messages** - Get message history

**GET /sessions/{sessionId}/messages/stream** - Stream responses (SSE)

Server-Sent Events format:
```
event: message
data: {"chunk_id": 0, "content": "Here's", "delta": true}

event: message
data: {"chunk_id": 1, "content": " the CPU", "delta": true}

event: metadata
data: {"resume_token": "tok_abc123", "estimated_total": 50}

event: done
data: {}
```

#### 3. Workflows

**POST /workflows** - Create workflow

Request:
```json
{
  "name": "Production Deployment",
  "description": "Deploy v2.0 to production",
  "tasks": [
    {
      "id": "validate",
      "type": "command",
      "name": "Validate deployment",
      "config": {
        "command": "kubectl apply --dry-run=client -f deployment.yaml"
      },
      "timeout_seconds": 60
    },
    {
      "id": "deploy",
      "type": "deploy",
      "name": "Deploy to production",
      "depends_on": ["validate"],
      "config": {
        "environment": "production",
        "version": "v2.0"
      },
      "retry_policy": {
        "max_attempts": 3,
        "backoff_strategy": "exponential",
        "initial_delay_ms": 1000,
        "max_delay_ms": 30000
      }
    },
    {
      "id": "verify",
      "type": "query",
      "name": "Verify deployment",
      "depends_on": ["deploy"],
      "config": {
        "query": "up{job='auth-service',version='v2.0'}"
      }
    }
  ],
  "auto_execute": false,
  "approval_required": true,
  "rollback_on_failure": true
}
```

**POST /workflows/{workflowId}/execute** - Execute workflow

**POST /workflows/{workflowId}/cancel** - Cancel running workflow

**POST /workflows/{workflowId}/approve** - Approve workflow task

Request:
```json
{
  "task_id": "deploy",
  "approved": true,
  "comment": "Deployment approved by SRE team"
}
```

#### 4. Queries

**POST /queries/metrics** - Query Prometheus metrics

Request:
```json
{
  "query": "rate(http_requests_total[5m])",
  "time_range": {
    "relative": "1h"
  },
  "step": "15s",
  "natural_language": false
}
```

Or with natural language:
```json
{
  "query": "Show me HTTP request rate over the last hour",
  "natural_language": true
}
```

**POST /queries/logs** - Query Loki logs

Request:
```json
{
  "query": "{service=\"auth-service\"} |= \"error\"",
  "time_range": {
    "start": "2025-11-25T09:00:00Z",
    "end": "2025-11-25T10:00:00Z"
  },
  "limit": 100,
  "direction": "backward"
}
```

**POST /queries/traces** - Query Tempo traces

Request:
```json
{
  "service_name": "auth-service",
  "operation_name": "POST /login",
  "time_range": {
    "relative": "15m"
  },
  "min_duration": "100ms",
  "tags": {
    "http.status_code": "500"
  }
}
```

#### 5. Incidents

**POST /incidents** - Create incident

Request:
```json
{
  "title": "Auth service high error rate",
  "description": "Error rate exceeded 5% threshold",
  "severity": "critical",
  "affected_services": ["auth-service", "api-gateway"],
  "detected_by": "automated",
  "alert_ids": ["alert-123"]
}
```

**PATCH /incidents/{incidentId}** - Update incident

**POST /incidents/{incidentId}/runbook** - Execute incident runbook

---

## WebSocket JSON-RPC Contracts

### Connection

```
wss://api.llm-copilot-agent.dev/v1/ws
```

### Authentication

Include JWT token in connection URL or initial message:
```
wss://api.llm-copilot-agent.dev/v1/ws?token=<jwt>
```

### Message Format

All messages follow JSON-RPC 2.0 specification:

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "message.send",
  "params": {
    "session_id": "session-123",
    "content": "Show me CPU usage"
  },
  "id": 1
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "message_id": "msg-456",
    "status": "processing"
  },
  "id": 1
}
```

**Response (Error)**:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "session_id",
      "issue": "Session not found"
    }
  },
  "id": 1
}
```

**Notification (Server -> Client)**:
```json
{
  "jsonrpc": "2.0",
  "method": "notify.message",
  "params": {
    "session_id": "session-123",
    "message": {
      "chunk_id": 0,
      "content": "CPU usage is at 75%",
      "is_delta": false,
      "chunk_type": "text"
    }
  }
}
```

### Available Methods

#### Client -> Server Methods

- `session.create` - Create session
- `session.get` - Get session info
- `session.delete` - Delete session
- `message.send` - Send message
- `message.subscribe` - Subscribe to message stream
- `message.unsubscribe` - Unsubscribe from stream
- `workflow.create` - Create workflow
- `workflow.execute` - Execute workflow
- `workflow.cancel` - Cancel workflow
- `workflow.subscribe` - Subscribe to workflow events
- `query.metrics` - Query metrics
- `query.logs` - Query logs
- `query.traces` - Query traces
- `incident.create` - Create incident
- `incident.update` - Update incident
- `incident.subscribe` - Subscribe to incident updates

#### Server -> Client Notifications

- `notify.message` - Message chunk notification
- `notify.workflow.event` - Workflow event notification
- `notify.incident.update` - Incident update notification
- `notify.stream.chunk` - Generic stream chunk

### Batch Requests

Send multiple requests in one message:

```json
[
  {
    "jsonrpc": "2.0",
    "method": "query.metrics",
    "params": {"query": "up"},
    "id": 1
  },
  {
    "jsonrpc": "2.0",
    "method": "query.logs",
    "params": {"query": "{job='api'}"},
    "id": 2
  }
]
```

### Heartbeat

Client should send ping every 30 seconds:
```json
{
  "type": "ping",
  "timestamp": 1700000000
}
```

Server responds with pong:
```json
{
  "type": "pong",
  "timestamp": 1700000000
}
```

---

## gRPC Protocol Buffers

### Service Definitions

See `/api/proto/service.proto` for complete definitions.

Key services:

1. **SessionService** - Session management
2. **MessageService** - Message operations
3. **WorkflowService** - Workflow orchestration
4. **QueryService** - Observability queries
5. **IncidentService** - Incident management
6. **NlpService** - NLP processing

### Example Usage (Rust)

```rust
use llm_copilot::v1::session_service_client::SessionServiceClient;
use llm_copilot::v1::CreateSessionRequest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = SessionServiceClient::connect("http://localhost:50051").await?;

    let request = tonic::Request::new(CreateSessionRequest {
        name: "My Session".to_string(),
        metadata: HashMap::new(),
        preferences: None,
        timeout_minutes: 60,
    });

    let response = client.create_session(request).await?;
    println!("Session created: {:?}", response.into_inner());

    Ok(())
}
```

---

## Validation Rules

### Request Validation

All requests undergo multi-level validation:

1. **Schema Validation** - Type checking, required fields
2. **Constraint Validation** - Length limits, patterns, ranges
3. **Business Logic Validation** - Cross-field validation, dependencies
4. **Sanitization** - Input cleaning, injection prevention

### Field-Level Constraints

#### Session Fields

- `name`: 1-200 characters, alphanumeric + spaces/hyphens/underscores
- `metadata`: Max 20 key-value pairs, keys/values max 1000 chars
- `timeout_minutes`: 5-1440 (5 minutes to 24 hours)
- `language`: enum ["en", "es", "fr", "de", "ja", "zh"]
- `timezone`: Must match `Region/City` format

#### Message Fields

- `content`: 1-10,000 characters
- `attachments`: Max 10 attachments
- `attachment.content`: Max 100KB per attachment
- Total attachment size: Max 1MB

#### Workflow Fields

- `name`: 1-200 characters
- `description`: Max 1000 characters
- `tasks`: 1-100 tasks
- `task.id`: Alphanumeric + hyphens/underscores
- `task.timeout_seconds`: 1-3600 seconds
- `retry_policy.max_attempts`: 1-10
- `retry_policy.initial_delay_ms`: 100-60,000ms

#### Query Fields

- `query`: 1-5,000 characters
- `limit`: 1-5,000 for logs
- `step`: Format `<number><unit>` (e.g., "15s", "1m")
- `time_range`: Max 30 days

#### Incident Fields

- `title`: 1-200 characters
- `description`: Max 5,000 characters
- `affected_services`: Max 50 services
- `severity`: enum ["critical", "high", "medium", "low"]

### Custom Validation

See `/api/validation/mod.rs` for implementation.

Example custom validators:

```rust
// DAG validation for workflows
fn validate_dag(tasks: &[WorkflowTask]) -> Result<(), String> {
    // Kahn's algorithm for cycle detection
    // Returns error if circular dependencies found
}

// Time range validation
impl BusinessValidation for TimeRange {
    fn validate_business_rules(&self) -> Result<(), ValidationErrors> {
        // Must have either absolute or relative time
        // Start must be before end
        // Range cannot exceed 30 days
        // Start cannot be in future
    }
}

// Message content safety
fn validate_message_content(content: &str) -> Result<(), ValidationError> {
    // Check for empty/whitespace-only
    // Check for injection patterns
    // Sanitize dangerous content
}
```

### Input Sanitization

```rust
// HTML/XSS sanitization
InputSanitizer::sanitize_string("<script>alert('xss')</script>")
// Returns: "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"

// SQL injection prevention
InputSanitizer::sanitize_sql_like("test%value_")
// Returns: "test\\%value\\_"

// Control character removal
InputSanitizer::remove_control_chars("text\x00with\x01nulls")
// Returns: "textwith nulls"

// Safe truncation (UTF-8 aware)
InputSanitizer::truncate("Hello 世界", 8)
// Returns: "Hello 世"
```

---

## Error Handling

### Error Response Format

All errors follow consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "additional": "context"
    },
    "field_errors": [
      {
        "field": "tasks[0].timeout_seconds",
        "message": "Timeout must be between 1 and 3600 seconds",
        "constraint": "range: 1-3600"
      }
    ],
    "documentation_url": "https://docs.llm-copilot-agent.dev/errors/1000",
    "request_id": "req-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Error Code Catalog

See `/api/contracts/error_codes.rs` for complete catalog.

| Code Range | Category | HTTP Status |
|------------|----------|-------------|
| 1000-1999 | Validation Errors | 400 |
| 2000-2999 | Authentication Errors | 401 |
| 3000-3999 | Authorization Errors | 403 |
| 4000-4999 | Resource Errors | 404, 409, 410 |
| 5000-5999 | Rate Limiting | 429 |
| 6000-6999 | Business Logic | 422 |
| 7000-7999 | External Services | 502, 504 |
| 8000-8999 | Internal Errors | 500, 503 |
| 9000-9999 | Streaming Errors | 500, 503 |

### Common Error Codes

- `1000` - VALIDATION_ERROR - Request validation failed
- `1008` - INVALID_UUID - Invalid UUID format
- `1016` - CIRCULAR_DEPENDENCY - Circular dependency in workflow
- `2000` - UNAUTHORIZED - Authentication required
- `2002` - EXPIRED_TOKEN - JWT token expired
- `3000` - FORBIDDEN - Insufficient permissions
- `4000` - NOT_FOUND - Resource not found
- `4002` - SESSION_NOT_FOUND - Session not found
- `5000` - RATE_LIMIT_EXCEEDED - Rate limit exceeded
- `6001` - WORKFLOW_EXECUTION_FAILED - Workflow execution failed
- `7001` - LLM_API_ERROR - LLM API error
- `8000` - INTERNAL_ERROR - Internal server error

### Error Localization

Errors support multiple languages:

```rust
let localizer = ErrorLocalizer::new();
let error = ApiError::from_code(ErrorCode::NotFound);

// English
localizer.translate(error.code, "en")
// Returns: "Resource not found"

// Spanish
localizer.translate(error.code, "es")
// Returns: "Recurso no encontrado"

// Japanese
localizer.translate(error.code, "ja")
// Returns: "リソースが見つかりません"
```

### Production Error Sanitization

Internal errors are sanitized in production:

```rust
let error = ApiError::new(
    ErrorCode::DatabaseError,
    "Connection failed to postgres://localhost:5432/db"
).with_details(json!({"host": "localhost", "port": 5432}));

// In production:
error.sanitize_for_production()
// Returns: ApiError { code: DatabaseError, message: "Database error", details: None }
```

---

## API Versioning

### Version Negotiation

Specify API version in request:

```http
GET /sessions HTTP/1.1
Host: api.llm-copilot-agent.dev
X-API-Version: 1.0.0
```

Or in URL:
```
https://api.llm-copilot-agent.dev/v1/sessions
```

### Version Headers (Response)

```http
HTTP/1.1 200 OK
X-API-Version: 1.0.0
X-API-Supported-Versions: v1
X-API-Deprecated: false
```

For deprecated versions:
```http
HTTP/1.1 200 OK
X-API-Version: 1.0.0
X-API-Deprecated: true
X-API-Deprecation-Date: 2026-01-01T00:00:00Z
X-API-Sunset-Date: 2026-06-01T00:00:00Z
X-API-Migration-Guide: https://docs.llm-copilot-agent.dev/migration/v1-to-v2
```

### Breaking Change Policy

- Minimum 90 days deprecation notice
- Minimum 180 days sunset period
- Migration guide required
- Version bump required

### Supported Versions

- **v1** (Current) - Stable, no deprecation planned
- **v2** (Future) - Not yet released

---

## Authentication & Authorization

### JWT Token Structure

```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "roles": ["user", "developer"],
  "permissions": [
    "sessions:read",
    "sessions:write",
    "workflows:execute",
    "incidents:write"
  ],
  "iat": 1700000000,
  "exp": 1700086400
}
```

### RBAC Permissions

| Resource | Action | Permission |
|----------|--------|------------|
| Sessions | Read | `sessions:read` |
| Sessions | Write | `sessions:write` |
| Messages | Read | `messages:read` |
| Messages | Write | `messages:write` |
| Workflows | Read | `workflows:read` |
| Workflows | Execute | `workflows:execute` |
| Workflows | Approve | `workflows:approve` |
| Incidents | Read | `incidents:read` |
| Incidents | Write | `incidents:write` |
| Queries | Execute | `queries:execute` |

### Token Refresh

Tokens expire after 24 hours. Refresh before expiration:

```http
POST /auth/refresh
Authorization: Bearer <refresh-token>
```

---

## Rate Limiting

### Rate Limit Headers

Every response includes rate limit headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1700000000
```

When rate limit exceeded:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700003600
Retry-After: 3600

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 3600 seconds"
  }
}
```

### Rate Limits

- **Per User**: 1000 requests/hour
- **Burst**: 100 requests/minute
- **Concurrent Workflows**: 10 per user
- **Concurrent Sessions**: 100 per user
- **WebSocket Connections**: 5 per user

---

## Examples

### Complete Workflow Example (REST)

```bash
# 1. Create session
SESSION_RESPONSE=$(curl -X POST https://api.llm-copilot-agent.dev/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deployment Session",
    "preferences": {"stream_responses": true}
  }')

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.id')

# 2. Send message
curl -X POST "https://api.llm-copilot-agent.dev/v1/sessions/$SESSION_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Deploy v2.0 to production with health checks"
  }'

# 3. Create workflow from response
curl -X POST https://api.llm-copilot-agent.dev/v1/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @workflow.json

# 4. Execute workflow
WORKFLOW_ID="wf-123"
curl -X POST "https://api.llm-copilot-agent.dev/v1/workflows/$WORKFLOW_ID/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dry_run": false}'

# 5. Approve workflow task
curl -X POST "https://api.llm-copilot-agent.dev/v1/workflows/$WORKFLOW_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "task_id": "deploy-prod",
    "approved": true,
    "comment": "Approved by SRE"
  }'
```

### WebSocket Example (JavaScript)

```javascript
const ws = new WebSocket('wss://api.llm-copilot-agent.dev/v1/ws?token=' + token);

let requestId = 1;

ws.onopen = () => {
  // Create session
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'session.create',
    params: {
      name: 'WebSocket Session'
    },
    id: requestId++
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.result) {
    // Response to request
    console.log('Response:', msg.result);

    if (msg.id === 1) {
      const sessionId = msg.result.id;

      // Subscribe to messages
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'message.subscribe',
        params: { session_id: sessionId },
        id: requestId++
      }));

      // Send a message
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'message.send',
        params: {
          session_id: sessionId,
          content: 'Show me system metrics'
        },
        id: requestId++
      }));
    }
  } else if (msg.method) {
    // Notification from server
    console.log('Notification:', msg.method, msg.params);

    if (msg.method === 'notify.message') {
      // Handle streaming message chunks
      const chunk = msg.params.message;
      console.log('Chunk:', chunk.content);
    }
  }
};

// Heartbeat every 30 seconds
setInterval(() => {
  ws.send(JSON.stringify({
    type: 'ping',
    timestamp: Date.now()
  }));
}, 30000);
```

### gRPC Example (Python)

```python
import grpc
from llm_copilot.v1 import session_service_pb2
from llm_copilot.v1 import session_service_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = session_service_pb2_grpc.SessionServiceStub(channel)

# Create session
request = session_service_pb2.CreateSessionRequest(
    name="gRPC Session",
    timeout_minutes=60
)

response = stub.CreateSession(request)
print(f"Session created: {response.id}")

# List sessions
list_request = session_service_pb2.ListSessionsRequest(
    page=1,
    page_size=20
)

list_response = stub.ListSessions(list_request)
for session in list_response.sessions:
    print(f"Session: {session.id} - {session.name}")
```

---

## Summary

This comprehensive API contract specification provides:

1. **Complete OpenAPI 3.0 Schema** - All REST endpoints documented
2. **WebSocket JSON-RPC 2.0** - Real-time bidirectional communication
3. **gRPC Protocol Buffers** - High-performance RPC
4. **Validation Rules** - Field-level and business logic validation
5. **Error Handling** - Comprehensive error codes with localization
6. **API Versioning** - Deprecation and migration strategies
7. **Security** - JWT authentication and RBAC authorization
8. **Rate Limiting** - Fair usage policies

All contracts are production-ready with:
- Type safety (Rust validation)
- Input sanitization
- Comprehensive error handling
- Performance optimization
- Security best practices

## Files Created

- `/api/schemas/openapi.yaml` - Complete OpenAPI 3.0 specification
- `/api/validation/mod.rs` - Validation rules and middleware
- `/api/contracts/error_codes.rs` - Error code catalog
- `/api/contracts/websocket_jsonrpc.rs` - WebSocket JSON-RPC implementation
- `/api/contracts/versioning.rs` - API versioning system
- `/api/proto/service.proto` - gRPC Protocol Buffer definitions
