# Error Code Reference Guide

Complete catalog of all error codes used in the LLM-CoPilot-Agent API.

## Error Code Categories

| Category | Code Range | Count | HTTP Status Range |
|----------|------------|-------|-------------------|
| Validation Errors | 1000-1999 | 18 | 400, 413 |
| Authentication Errors | 2000-2999 | 9 | 401 |
| Authorization Errors | 3000-3999 | 6 | 403, 429 |
| Resource Errors | 4000-4999 | 10 | 404, 409, 410 |
| Rate Limiting Errors | 5000-5999 | 4 | 429 |
| Business Logic Errors | 6000-6999 | 10 | 422, 403, 409 |
| External Service Errors | 7000-7999 | 10 | 502, 504 |
| Internal Errors | 8000-8999 | 9 | 500, 503 |
| Streaming Errors | 9000-9999 | 5 | 500, 503, 504 |

**Total**: 90 error codes

## Complete Error Code Catalog

### Validation Errors (1000-1999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 1000 | VALIDATION_ERROR | 400 | Request validation failed | Yes |
| 1001 | INVALID_FORMAT | 400 | Invalid format | Yes |
| 1002 | MISSING_REQUIRED_FIELD | 400 | Required field missing | Yes |
| 1003 | INVALID_FIELD_VALUE | 400 | Invalid field value | Yes |
| 1004 | FIELD_TOO_LONG | 400 | Field value too long | Yes |
| 1005 | FIELD_TOO_SHORT | 400 | Field value too short | Yes |
| 1006 | INVALID_PATTERN | 400 | Field does not match required pattern | Yes |
| 1007 | INVALID_ENUM | 400 | Invalid enum value | Yes |
| 1008 | INVALID_UUID | 400 | Invalid UUID format | Yes |
| 1009 | INVALID_TIMESTAMP | 400 | Invalid timestamp format | Yes |
| 1010 | INVALID_TIME_RANGE | 400 | Invalid time range | Yes |
| 1011 | INVALID_JSON | 400 | Invalid JSON | Yes |
| 1012 | INVALID_CONTENT_TYPE | 400 | Invalid Content-Type header | Yes |
| 1013 | PAYLOAD_TOO_LARGE | 413 | Request payload too large | Yes |
| 1014 | TOO_MANY_ITEMS | 400 | Too many items in collection | Yes |
| 1015 | DUPLICATE_ENTRY | 400 | Duplicate entry | Yes |
| 1016 | CIRCULAR_DEPENDENCY | 400 | Circular dependency detected | Yes |
| 1017 | INVALID_DEPENDENCY | 400 | Invalid dependency reference | Yes |

**Example**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "field_errors": [
      {
        "field": "name",
        "message": "Name must be 1-200 characters",
        "constraint": "length: 1-200"
      }
    ]
  }
}
```

### Authentication Errors (2000-2999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 2000 | UNAUTHORIZED | 401 | Authentication required | Yes |
| 2001 | INVALID_TOKEN | 401 | Invalid authentication token | No |
| 2002 | EXPIRED_TOKEN | 401 | Authentication token expired | No |
| 2003 | MISSING_TOKEN | 401 | Authentication token missing | Yes |
| 2004 | INVALID_CREDENTIALS | 401 | Invalid credentials | No |
| 2005 | TOKEN_REVOKED | 401 | Authentication token revoked | No |
| 2006 | INVALID_SIGNATURE | 401 | Invalid token signature | No |
| 2007 | INVALID_ISSUER | 401 | Invalid token issuer | No |
| 2008 | INVALID_AUDIENCE | 401 | Invalid token audience | No |

**Example**:
```json
{
  "error": {
    "code": "EXPIRED_TOKEN",
    "message": "Authentication token expired",
    "documentation_url": "https://docs.llm-copilot-agent.dev/errors/2002"
  }
}
```

### Authorization Errors (3000-3999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 3000 | FORBIDDEN | 403 | Access forbidden | Yes |
| 3001 | INSUFFICIENT_PERMISSIONS | 403 | Insufficient permissions | No |
| 3002 | RESOURCE_ACCESS_DENIED | 403 | Resource access denied | No |
| 3003 | OPERATION_NOT_ALLOWED | 403 | Operation not allowed | No |
| 3004 | QUOTA_EXCEEDED | 429 | Quota exceeded | Yes |
| 3005 | FEATURE_NOT_ENABLED | 403 | Feature not enabled | No |

**Example**:
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Insufficient permissions",
    "details": {
      "required": "workflows:execute",
      "current": ["workflows:read"]
    }
  }
}
```

### Resource Errors (4000-4999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 4000 | NOT_FOUND | 404 | Resource not found | Yes |
| 4001 | RESOURCE_NOT_FOUND | 404 | Resource not found | Yes |
| 4002 | SESSION_NOT_FOUND | 404 | Session not found | Yes |
| 4003 | WORKFLOW_NOT_FOUND | 404 | Workflow not found | Yes |
| 4004 | INCIDENT_NOT_FOUND | 404 | Incident not found | Yes |
| 4005 | USER_NOT_FOUND | 404 | User not found | Yes |
| 4006 | ALREADY_EXISTS | 409 | Resource already exists | No |
| 4007 | RESOURCE_CONFLICT | 409 | Resource conflict | No |
| 4008 | RESOURCE_LOCKED | 409 | Resource locked | No |
| 4009 | RESOURCE_EXPIRED | 410 | Resource expired | No |

**Example**:
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found",
    "details": {
      "session_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

### Rate Limiting Errors (5000-5999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 5000 | RATE_LIMIT_EXCEEDED | 429 | Rate limit exceeded | Yes |
| 5001 | TOO_MANY_REQUESTS | 429 | Too many requests | Yes |
| 5002 | QUOTA_LIMIT_EXCEEDED | 429 | Quota limit exceeded | Yes |
| 5003 | CONCURRENCY_LIMIT_EXCEEDED | 429 | Concurrency limit exceeded | Yes |

**Example**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 3600 seconds",
    "details": {
      "limit": 1000,
      "reset_at": "2025-11-25T11:00:00Z"
    }
  }
}
```

**Headers**:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700003600
Retry-After: 3600
```

### Business Logic Errors (6000-6999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 6000 | INVALID_STATE | 400 | Invalid state | No |
| 6001 | WORKFLOW_EXECUTION_FAILED | 422 | Workflow execution failed | No |
| 6002 | WORKFLOW_ALREADY_RUNNING | 409 | Workflow already running | No |
| 6003 | WORKFLOW_NOT_APPROVED | 403 | Workflow not approved | No |
| 6004 | APPROVAL_REQUIRED | 403 | Approval required | No |
| 6005 | CANNOT_CANCEL_WORKFLOW | 422 | Cannot cancel workflow | No |
| 6006 | TASK_EXECUTION_FAILED | 422 | Task execution failed | No |
| 6007 | INVALID_WORKFLOW_STATE | 422 | Invalid workflow state | No |
| 6008 | INCIDENT_ALREADY_CLOSED | 409 | Incident already closed | No |
| 6009 | INCIDENT_NOT_RESOLVED | 422 | Incident not resolved | No |

**Example**:
```json
{
  "error": {
    "code": "WORKFLOW_EXECUTION_FAILED",
    "message": "Workflow execution failed",
    "details": {
      "workflow_id": "wf-123",
      "failed_task": "deploy-prod",
      "reason": "Deployment health check failed"
    }
  }
}
```

### External Service Errors (7000-7999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 7000 | EXTERNAL_SERVICE_ERROR | 502 | External service error | No |
| 7001 | LLM_API_ERROR | 502 | LLM API error | No |
| 7002 | LLM_API_TIMEOUT | 504 | LLM API timeout | No |
| 7003 | LLM_API_RATE_LIMITED | 429 | LLM API rate limited | No |
| 7004 | PROMETHEUS_ERROR | 502 | Prometheus error | No |
| 7005 | LOKI_ERROR | 502 | Loki error | No |
| 7006 | TEMPO_ERROR | 502 | Tempo error | No |
| 7007 | DATABASE_ERROR | 502 | Database error | No |
| 7008 | CACHE_ERROR | 502 | Cache error | No |
| 7009 | VECTOR_DB_ERROR | 502 | Vector database error | No |

**Example (Production)**:
```json
{
  "error": {
    "code": "LLM_API_ERROR",
    "message": "LLM API error",
    "request_id": "req-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Example (Development)**:
```json
{
  "error": {
    "code": "LLM_API_ERROR",
    "message": "LLM API error",
    "details": {
      "upstream_error": "API rate limit exceeded",
      "upstream_status": 429
    }
  }
}
```

### Internal Errors (8000-8999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 8000 | INTERNAL_ERROR | 500 | Internal server error | No |
| 8001 | CONFIGURATION_ERROR | 500 | Configuration error | No |
| 8002 | SERVICE_UNAVAILABLE | 503 | Service unavailable | No |
| 8003 | DEPENDENCY_FAILURE | 502 | Dependency failure | No |
| 8004 | DATABASE_CONNECTION_ERROR | 500 | Database connection error | No |
| 8005 | CACHE_CONNECTION_ERROR | 500 | Cache connection error | No |
| 8006 | MESSAGE_QUEUE_ERROR | 500 | Message queue error | No |
| 8007 | SERIALIZATION_ERROR | 500 | Serialization error | No |
| 8008 | DESERIALIZATION_ERROR | 500 | Deserialization error | No |

**Example (Production)**:
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "request_id": "req-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Streaming Errors (9000-9999)

| Code | Name | HTTP | Message | Expose Details |
|------|------|------|---------|----------------|
| 9000 | STREAM_ERROR | 500 | Stream error | No |
| 9001 | STREAM_CLOSED | 503 | Stream closed | No |
| 9002 | STREAM_TIMEOUT | 504 | Stream timeout | No |
| 9003 | INVALID_RESUME_TOKEN | 400 | Invalid resume token | Yes |
| 9004 | STREAM_BACKPRESSURE | 503 | Stream backpressure | No |

**Example**:
```json
{
  "error": {
    "code": "STREAM_TIMEOUT",
    "message": "Stream timeout",
    "details": {
      "timeout_seconds": 30,
      "chunks_received": 15
    }
  }
}
```

## Error Response Format

### Standard Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "additional": "context"
    },
    "field_errors": [
      {
        "field": "path.to.field",
        "message": "Field-specific error",
        "constraint": "violated constraint"
      }
    ],
    "documentation_url": "https://docs.llm-copilot-agent.dev/errors/CODE",
    "request_id": "req-uuid"
  }
}
```

### Field Error Format
```json
{
  "field": "tasks[0].timeout_seconds",
  "message": "Timeout must be between 1 and 3600 seconds",
  "constraint": "range: 1-3600"
}
```

## Localized Error Messages

Errors support 6 languages based on `Accept-Language` header:

### English (en)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### Spanish (es)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Recurso no encontrado"
  }
}
```

### French (fr)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ressource non trouvée"
  }
}
```

### German (de)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ressource nicht gefunden"
  }
}
```

### Japanese (ja)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "リソースが見つかりません"
  }
}
```

### Chinese (zh)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "未找到资源"
  }
}
```

## Production vs Development

### Production (Sanitized)
Internal errors hide sensitive details:

```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database error",
    "request_id": "req-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Development (Detailed)
Development mode includes full details:

```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database error",
    "details": {
      "connection_string": "postgres://localhost:5432/db",
      "error": "connection refused",
      "stack_trace": "..."
    },
    "request_id": "req-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## HTTP Status Code Mapping

| HTTP Status | Error Codes | Description |
|-------------|-------------|-------------|
| 400 | 1000-1017, 6000, 9003 | Bad Request - Client error |
| 401 | 2000-2008 | Unauthorized - Authentication required |
| 403 | 3000-3003, 3005, 6003-6004 | Forbidden - Insufficient permissions |
| 404 | 4000-4005 | Not Found - Resource doesn't exist |
| 409 | 4006-4008, 6002, 6008 | Conflict - Resource state conflict |
| 410 | 4009 | Gone - Resource no longer available |
| 413 | 1013 | Payload Too Large - Request too big |
| 422 | 6001, 6005-6007, 6009 | Unprocessable Entity - Business logic error |
| 429 | 3004, 5000-5003, 7003 | Too Many Requests - Rate limited |
| 500 | 8000-8008, 9000 | Internal Server Error |
| 502 | 7000-7009, 8003 | Bad Gateway - Upstream error |
| 503 | 8002, 9001, 9004 | Service Unavailable - Temporary unavailability |
| 504 | 7002, 9002 | Gateway Timeout - Upstream timeout |

## Error Code Usage Examples

### Validation Error
```http
POST /sessions
Content-Type: application/json

{
  "name": "A",
  "timeout_minutes": 5000
}

HTTP/1.1 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "field_errors": [
      {
        "field": "timeout_minutes",
        "message": "Timeout must be 5-1440 minutes",
        "constraint": "range: 5-1440"
      }
    ]
  }
}
```

### Authentication Error
```http
GET /sessions
Authorization: Bearer expired-token

HTTP/1.1 401 Unauthorized
{
  "error": {
    "code": "EXPIRED_TOKEN",
    "message": "Authentication token expired"
  }
}
```

### Resource Not Found
```http
GET /sessions/invalid-uuid

HTTP/1.1 404 Not Found
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found"
  }
}
```

### Rate Limit Exceeded
```http
POST /sessions
(after 1000 requests)

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

## Error Handling Best Practices

### Client-Side
```javascript
async function createSession(data) {
  try {
    const response = await fetch('/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();

      switch (error.error.code) {
        case 'VALIDATION_ERROR':
          // Show field-level errors to user
          displayFieldErrors(error.error.field_errors);
          break;

        case 'EXPIRED_TOKEN':
          // Refresh token and retry
          await refreshToken();
          return createSession(data);

        case 'RATE_LIMIT_EXCEEDED':
          // Wait and retry
          const resetTime = response.headers.get('X-RateLimit-Reset');
          await sleep(resetTime * 1000 - Date.now());
          return createSession(data);

        default:
          // Show generic error
          displayError(error.error.message);
      }

      throw error;
    }

    return await response.json();
  } catch (err) {
    console.error('Request failed:', err);
    throw err;
  }
}
```

### Server-Side (Rust)
```rust
use axum::{Json, http::StatusCode};

async fn create_session(
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<SessionResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate
    if let Err(e) = request.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: ApiError::from_code(ErrorCode::ValidationError)
                    .with_field_errors(convert_validation_errors(e))
            })
        ));
    }

    // Business logic
    match session_service.create(request).await {
        Ok(session) => Ok(Json(SessionResponse::from(session))),
        Err(ServiceError::NotFound) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: ApiError::from_code(ErrorCode::SessionNotFound)
            })
        )),
        Err(ServiceError::AlreadyExists) => Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: ApiError::from_code(ErrorCode::AlreadyExists)
            })
        )),
        Err(e) => {
            log::error!("Session creation failed: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: ApiError::from_code(ErrorCode::InternalError)
                        .sanitize_for_production()
                })
            ))
        }
    }
}
```

## Documentation URLs

All errors can include documentation links:

```
https://docs.llm-copilot-agent.dev/errors/{code}
```

Examples:
- `https://docs.llm-copilot-agent.dev/errors/1000` - Validation Error
- `https://docs.llm-copilot-agent.dev/errors/2002` - Expired Token
- `https://docs.llm-copilot-agent.dev/errors/5000` - Rate Limit Exceeded

---

**Error Code Reference Version**: 1.0.0
**Last Updated**: 2025-11-25
**Total Error Codes**: 90
