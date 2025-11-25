# API Quick Reference

## REST Endpoints

### Sessions
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/sessions` | Create session | Required |
| GET | `/sessions` | List sessions | Required |
| GET | `/sessions/{id}` | Get session | Required |
| DELETE | `/sessions/{id}` | Delete session | Required |

### Messages
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/sessions/{id}/messages` | Send message | Required |
| GET | `/sessions/{id}/messages` | Message history | Required |
| GET | `/sessions/{id}/messages/stream` | Stream responses (SSE) | Required |

### Workflows
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/workflows` | Create workflow | Required |
| GET | `/workflows` | List workflows | Required |
| GET | `/workflows/{id}` | Get workflow | Required |
| POST | `/workflows/{id}/execute` | Execute workflow | Required |
| POST | `/workflows/{id}/cancel` | Cancel workflow | Required |
| POST | `/workflows/{id}/approve` | Approve task | Required |

### Queries
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/queries/metrics` | Query metrics (PromQL) | Required |
| POST | `/queries/logs` | Query logs (LogQL) | Required |
| POST | `/queries/traces` | Query traces (TraceQL) | Required |

### Tests
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/tests/generate` | Generate tests | Required |
| POST | `/tests/execute` | Execute tests | Required |
| POST | `/tests/coverage` | Analyze coverage | Required |

### Incidents
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/incidents` | Create incident | Required |
| GET | `/incidents` | List incidents | Required |
| GET | `/incidents/{id}` | Get incident | Required |
| PATCH | `/incidents/{id}` | Update incident | Required |
| POST | `/incidents/{id}/runbook` | Execute runbook | Required |

### Health
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Health check | None |
| GET | `/health/ready` | Readiness check | None |

## WebSocket Methods

### Client → Server
| Method | Description | Response |
|--------|-------------|----------|
| `session.create` | Create session | Session object |
| `session.get` | Get session info | Session object |
| `session.delete` | Delete session | Success |
| `message.send` | Send message | Message ID |
| `message.subscribe` | Subscribe to stream | Subscription ID |
| `message.unsubscribe` | Unsubscribe | Success |
| `workflow.create` | Create workflow | Workflow object |
| `workflow.execute` | Execute workflow | Execution ID |
| `workflow.cancel` | Cancel workflow | Success |
| `workflow.subscribe` | Subscribe to events | Subscription ID |
| `query.metrics` | Query metrics | Query results |
| `query.logs` | Query logs | Query results |
| `query.traces` | Query traces | Query results |
| `incident.create` | Create incident | Incident object |
| `incident.update` | Update incident | Incident object |
| `incident.subscribe` | Subscribe to updates | Subscription ID |

### Server → Client (Notifications)
| Method | Description | Payload |
|--------|-------------|---------|
| `notify.message` | Message chunk | MessageChunk |
| `notify.workflow.event` | Workflow event | WorkflowEvent |
| `notify.incident.update` | Incident update | IncidentUpdate |
| `notify.stream.chunk` | Generic stream | StreamChunk |

## gRPC Services

### SessionService
| RPC | Request | Response |
|-----|---------|----------|
| CreateSession | CreateSessionRequest | Session |
| GetSession | GetSessionRequest | Session |
| ListSessions | ListSessionsRequest | ListSessionsResponse |
| DeleteSession | DeleteSessionRequest | Empty |
| UpdateSessionPreferences | UpdateSessionPreferencesRequest | Session |

### MessageService
| RPC | Request | Response |
|-----|---------|----------|
| SendMessage | SendMessageRequest | Message |
| StreamMessages | StreamMessagesRequest | stream MessageChunk |
| GetMessageHistory | GetMessageHistoryRequest | GetMessageHistoryResponse |
| GetMessage | GetMessageRequest | Message |

### WorkflowService
| RPC | Request | Response |
|-----|---------|----------|
| CreateWorkflow | CreateWorkflowRequest | Workflow |
| GetWorkflow | GetWorkflowRequest | Workflow |
| ListWorkflows | ListWorkflowsRequest | ListWorkflowsResponse |
| ExecuteWorkflow | ExecuteWorkflowRequest | WorkflowExecution |
| CancelWorkflow | CancelWorkflowRequest | Workflow |
| ApproveWorkflow | ApproveWorkflowRequest | Workflow |
| StreamWorkflowProgress | StreamWorkflowProgressRequest | stream WorkflowEvent |
| GetWorkflowExecution | GetWorkflowExecutionRequest | WorkflowExecution |

### QueryService
| RPC | Request | Response |
|-----|---------|----------|
| QueryMetrics | MetricsQueryRequest | MetricsQueryResponse |
| QueryLogs | LogsQueryRequest | LogsQueryResponse |
| QueryTraces | TracesQueryRequest | TracesQueryResponse |
| TranslateQuery | TranslateQueryRequest | TranslateQueryResponse |

### IncidentService
| RPC | Request | Response |
|-----|---------|----------|
| CreateIncident | CreateIncidentRequest | Incident |
| GetIncident | GetIncidentRequest | Incident |
| ListIncidents | ListIncidentsRequest | ListIncidentsResponse |
| UpdateIncident | UpdateIncidentRequest | Incident |
| ExecuteRunbook | ExecuteRunbookRequest | Runbook |
| AddTimelineEntry | AddTimelineEntryRequest | Incident |

### NlpService
| RPC | Request | Response |
|-----|---------|----------|
| ClassifyIntent | ClassifyIntentRequest | Intent |
| ExtractEntities | ExtractEntitiesRequest | ExtractEntitiesResponse |
| ProcessRequest | NlpRequest | NlpResponse |

## Validation Constraints

### Session Fields
| Field | Constraint | Example |
|-------|------------|---------|
| name | 1-200 chars, alphanumeric+space/hyphen/underscore | "Production Session" |
| metadata | Max 20 pairs, keys/values max 1000 chars | {"env": "prod"} |
| timeout_minutes | 5-1440 | 60 |
| language | enum | "en", "es", "fr", "de", "ja", "zh" |
| timezone | Region/City format | "America/New_York" |

### Message Fields
| Field | Constraint | Example |
|-------|------------|---------|
| content | 1-10,000 chars | "Show me CPU usage" |
| attachments | Max 10, max 100KB each | [...] |
| total_attachment_size | Max 1MB | - |

### Workflow Fields
| Field | Constraint | Example |
|-------|------------|---------|
| name | 1-200 chars | "Deploy v2.0" |
| description | Max 1000 chars | "Deploy to prod" |
| tasks | 1-100 tasks | [...] |
| task.id | Alphanumeric+hyphen/underscore | "deploy-prod" |
| task.timeout_seconds | 1-3600 | 300 |
| retry.max_attempts | 1-10 | 3 |
| retry.initial_delay_ms | 100-60,000 | 1000 |
| retry.max_delay_ms | 1000-300,000 | 30000 |

### Query Fields
| Field | Constraint | Example |
|-------|------------|---------|
| query | 1-5,000 chars | "rate(cpu[5m])" |
| limit | 1-5,000 (logs) | 100 |
| step | Format: \<number\>\<unit\> | "15s", "1m" |
| time_range | Max 30 days | {"relative": "1h"} |

### Incident Fields
| Field | Constraint | Example |
|-------|------------|---------|
| title | 1-200 chars | "High error rate" |
| description | Max 5,000 chars | "Error rate > 5%" |
| affected_services | Max 50 | ["auth", "api"] |
| severity | enum | "critical", "high", "medium", "low" |

## Error Codes

### Validation (1000-1999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 1000 | VALIDATION_ERROR | 400 | Request validation failed |
| 1001 | INVALID_FORMAT | 400 | Invalid format |
| 1002 | MISSING_REQUIRED_FIELD | 400 | Required field missing |
| 1008 | INVALID_UUID | 400 | Invalid UUID format |
| 1010 | INVALID_TIME_RANGE | 400 | Invalid time range |
| 1013 | PAYLOAD_TOO_LARGE | 413 | Request too large |
| 1016 | CIRCULAR_DEPENDENCY | 400 | Circular dependency |

### Authentication (2000-2999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 2000 | UNAUTHORIZED | 401 | Authentication required |
| 2001 | INVALID_TOKEN | 401 | Invalid token |
| 2002 | EXPIRED_TOKEN | 401 | Token expired |
| 2003 | MISSING_TOKEN | 401 | Token missing |

### Authorization (3000-3999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 3000 | FORBIDDEN | 403 | Access forbidden |
| 3001 | INSUFFICIENT_PERMISSIONS | 403 | Insufficient permissions |
| 3004 | QUOTA_EXCEEDED | 429 | Quota exceeded |

### Resources (4000-4999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 4000 | NOT_FOUND | 404 | Resource not found |
| 4002 | SESSION_NOT_FOUND | 404 | Session not found |
| 4003 | WORKFLOW_NOT_FOUND | 404 | Workflow not found |
| 4006 | ALREADY_EXISTS | 409 | Resource exists |
| 4007 | RESOURCE_CONFLICT | 409 | Resource conflict |

### Rate Limiting (5000-5999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 5000 | RATE_LIMIT_EXCEEDED | 429 | Rate limit exceeded |
| 5001 | TOO_MANY_REQUESTS | 429 | Too many requests |
| 5003 | CONCURRENCY_LIMIT_EXCEEDED | 429 | Concurrency limit exceeded |

### Business Logic (6000-6999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 6001 | WORKFLOW_EXECUTION_FAILED | 422 | Workflow execution failed |
| 6002 | WORKFLOW_ALREADY_RUNNING | 409 | Workflow already running |
| 6004 | APPROVAL_REQUIRED | 403 | Approval required |

### External Services (7000-7999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 7001 | LLM_API_ERROR | 502 | LLM API error |
| 7002 | LLM_API_TIMEOUT | 504 | LLM API timeout |
| 7004 | PROMETHEUS_ERROR | 502 | Prometheus error |

### Internal (8000-8999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 8000 | INTERNAL_ERROR | 500 | Internal error |
| 8002 | SERVICE_UNAVAILABLE | 503 | Service unavailable |

### Streaming (9000-9999)
| Code | Name | HTTP | Description |
|------|------|------|-------------|
| 9000 | STREAM_ERROR | 500 | Stream error |
| 9002 | STREAM_TIMEOUT | 504 | Stream timeout |

## Rate Limits

| Resource | Limit | Window |
|----------|-------|--------|
| API Requests | 1000 | 1 hour |
| Burst Requests | 100 | 1 minute |
| Concurrent Workflows | 10 | Per user |
| Concurrent Sessions | 100 | Per user |
| WebSocket Connections | 5 | Per user |
| Message Attachments | 10 | Per message |
| Attachment Size | 100KB | Per attachment |
| Total Attachment Size | 1MB | Per message |
| Query Results | 5000 | Per query |
| Time Range | 30 days | Per query |

## HTTP Status Codes

| Status | Used For | Example |
|--------|----------|---------|
| 200 | Success | GET /sessions |
| 201 | Created | POST /sessions |
| 202 | Accepted (async) | POST /workflows/{id}/execute |
| 204 | No content | DELETE /sessions/{id} |
| 400 | Bad request | Validation error |
| 401 | Unauthorized | Invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not found | Resource not found |
| 409 | Conflict | Resource already exists |
| 413 | Payload too large | Request > 10MB |
| 422 | Unprocessable | Business logic error |
| 429 | Too many requests | Rate limit exceeded |
| 500 | Internal error | Server error |
| 502 | Bad gateway | External service error |
| 503 | Service unavailable | Service down |
| 504 | Gateway timeout | External timeout |

## Headers

### Request Headers
| Header | Required | Description | Example |
|--------|----------|-------------|---------|
| Authorization | Yes | JWT token | Bearer eyJ... |
| Content-Type | POST/PUT/PATCH | Content type | application/json |
| Accept | No | Response type | application/json |
| X-API-Version | No | API version | 1.0.0 |
| X-Request-ID | No | Request ID | req-uuid |

### Response Headers
| Header | Description | Example |
|--------|-------------|---------|
| X-API-Version | API version | 1.0.0 |
| X-API-Supported-Versions | Supported versions | v1 |
| X-RateLimit-Limit | Rate limit | 1000 |
| X-RateLimit-Remaining | Remaining requests | 950 |
| X-RateLimit-Reset | Reset timestamp | 1700000000 |
| X-Request-ID | Request ID | req-uuid |

## Enums

### SessionStatus
- `active`
- `paused`
- `completed`
- `expired`

### MessageRole
- `user`
- `assistant`
- `system`

### WorkflowStatus
- `draft`
- `pending_approval`
- `approved`
- `running`
- `paused`
- `completed`
- `failed`
- `cancelled`
- `rolled_back`

### TaskStatus
- `pending`
- `running`
- `completed`
- `failed`
- `skipped`
- `cancelled`

### TaskType
- `command`
- `http`
- `query`
- `deploy`
- `scale`
- `conditional`
- `loop`
- `subworkflow`
- `approval`

### BackoffStrategy
- `exponential`
- `linear`
- `constant`

### IncidentSeverity
- `critical`
- `high`
- `medium`
- `low`

### IncidentStatus
- `open`
- `investigating`
- `identified`
- `monitoring`
- `resolved`
- `closed`

### IntentType
- `query_metrics`
- `query_logs`
- `query_traces`
- `execute_workflow`
- `create_incident`
- `update_incident`
- `deploy_service`
- `scale_service`
- `rollback_deployment`
- `run_tests`
- `analyze_performance`
- `explain_error`
- `general_question`

### EntityType
- `service`
- `metric`
- `log_level`
- `time_range`
- `environment`
- `version`
- `user`
- `error_code`

### LogLevel
- `debug`
- `info`
- `warn`
- `error`
- `fatal`

## Pagination

### Query Parameters
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| page | integer | 1 | - | Page number (1-indexed) |
| page_size | integer | 20 | 100 | Items per page |

### Response Format
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 100,
    "total_pages": 5,
    "has_next": true,
    "has_previous": false
  }
}
```

## Time Formats

### Absolute Time
```json
{
  "start": "2025-11-25T09:00:00Z",
  "end": "2025-11-25T10:00:00Z"
}
```

### Relative Time
```json
{
  "relative": "1h"
}
```

Valid units:
- `s` - seconds
- `m` - minutes
- `h` - hours
- `d` - days

Examples: `30s`, `5m`, `1h`, `7d`

## Common Patterns

### UUID Format
```
550e8400-e29b-41d4-a716-446655440000
```

Pattern: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`

### ISO 8601 Timestamp
```
2025-11-25T10:00:00Z
2025-11-25T10:00:00+00:00
2025-11-25T10:00:00.123Z
```

### Duration Format (PromQL/LogQL)
```
100ms   - milliseconds
1s      - seconds
5m      - minutes
1h      - hours
7d      - days
```

### MIME Types
Pattern: `^[a-z]+/[a-z0-9\-\+\.]+$`

Examples:
- `application/json`
- `text/plain`
- `image/png`
- `application/octet-stream`

## Language Codes

Supported languages for error messages:

| Code | Language |
|------|----------|
| en | English |
| es | Spanish |
| fr | French |
| de | German |
| ja | Japanese |
| zh | Chinese |

## WebSocket Connection

### URL
```
wss://api.llm-copilot-agent.dev/v1/ws?token=<jwt>
```

### Heartbeat
- Client sends ping every 30 seconds
- Server responds with pong
- Connection closed if no heartbeat for 60 seconds

### Message Format
All messages are JSON-RPC 2.0 compliant:
```json
{
  "jsonrpc": "2.0",
  "method": "...",
  "params": {...},
  "id": 1
}
```

## gRPC Connection

### Address
```
api.llm-copilot-agent.dev:50051
```

### TLS
Production uses TLS. Development can use insecure channel.

### Metadata
Include JWT in metadata:
```
authorization: Bearer <jwt>
```

---

**Quick Reference Version**: 1.0.0
**Last Updated**: 2025-11-25
