// WebSocket JSON-RPC 2.0 Protocol Implementation
// Bidirectional real-time communication

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;

// ==================== JSON-RPC 2.0 MESSAGE TYPES ====================

/// JSON-RPC 2.0 Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<Value>,
    pub id: RequestId,
}

impl JsonRpcRequest {
    pub fn new(method: impl Into<String>, params: Option<Value>, id: RequestId) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: method.into(),
            params,
            id,
        }
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.jsonrpc != "2.0" {
            return Err(ValidationError::InvalidVersion);
        }
        if self.method.is_empty() {
            return Err(ValidationError::EmptyMethod);
        }
        Ok(())
    }
}

/// JSON-RPC 2.0 Response (Success)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub result: Value,
    pub id: RequestId,
}

impl JsonRpcResponse {
    pub fn new(result: Value, id: RequestId) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            result,
            id,
        }
    }
}

/// JSON-RPC 2.0 Error Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub jsonrpc: String,
    pub error: ErrorObject,
    pub id: Option<RequestId>,
}

impl JsonRpcError {
    pub fn new(error: ErrorObject, id: Option<RequestId>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            error,
            id,
        }
    }

    pub fn parse_error() -> Self {
        Self::new(
            ErrorObject::new(ErrorCode::ParseError, "Parse error", None),
            None,
        )
    }

    pub fn invalid_request(id: Option<RequestId>) -> Self {
        Self::new(
            ErrorObject::new(ErrorCode::InvalidRequest, "Invalid request", None),
            id,
        )
    }

    pub fn method_not_found(id: RequestId) -> Self {
        Self::new(
            ErrorObject::new(ErrorCode::MethodNotFound, "Method not found", None),
            Some(id),
        )
    }

    pub fn invalid_params(id: RequestId, message: impl Into<String>) -> Self {
        Self::new(
            ErrorObject::new(ErrorCode::InvalidParams, message, None),
            Some(id),
        )
    }

    pub fn internal_error(id: RequestId) -> Self {
        Self::new(
            ErrorObject::new(ErrorCode::InternalError, "Internal error", None),
            Some(id),
        )
    }
}

/// JSON-RPC 2.0 Notification (no response expected)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    pub params: Option<Value>,
}

impl JsonRpcNotification {
    pub fn new(method: impl Into<String>, params: Option<Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: method.into(),
            params,
        }
    }
}

/// Request ID (can be string, number, or null)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(untagged)]
pub enum RequestId {
    String(String),
    Number(i64),
    Null,
}

impl fmt::Display for RequestId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RequestId::String(s) => write!(f, "{}", s),
            RequestId::Number(n) => write!(f, "{}", n),
            RequestId::Null => write!(f, "null"),
        }
    }
}

/// Error object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorObject {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl ErrorObject {
    pub fn new(code: ErrorCode, message: impl Into<String>, data: Option<Value>) -> Self {
        Self {
            code: code as i32,
            message: message.into(),
            data,
        }
    }
}

/// Standard JSON-RPC 2.0 error codes
#[derive(Debug, Clone, Copy)]
#[repr(i32)]
pub enum ErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    // Server errors: -32000 to -32099
    ServerError = -32000,
}

#[derive(Debug)]
pub enum ValidationError {
    InvalidVersion,
    EmptyMethod,
}

// ==================== WEBSOCKET MESSAGE TYPES ====================

/// WebSocket message wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    #[serde(rename = "request")]
    Request(JsonRpcRequest),

    #[serde(rename = "response")]
    Response(JsonRpcResponse),

    #[serde(rename = "error")]
    Error(JsonRpcError),

    #[serde(rename = "notification")]
    Notification(JsonRpcNotification),

    #[serde(rename = "ping")]
    Ping { timestamp: i64 },

    #[serde(rename = "pong")]
    Pong { timestamp: i64 },
}

// ==================== METHOD DEFINITIONS ====================

/// Available WebSocket methods
pub mod methods {
    pub const SESSION_CREATE: &str = "session.create";
    pub const SESSION_GET: &str = "session.get";
    pub const SESSION_DELETE: &str = "session.delete";

    pub const MESSAGE_SEND: &str = "message.send";
    pub const MESSAGE_SUBSCRIBE: &str = "message.subscribe";
    pub const MESSAGE_UNSUBSCRIBE: &str = "message.unsubscribe";

    pub const WORKFLOW_CREATE: &str = "workflow.create";
    pub const WORKFLOW_EXECUTE: &str = "workflow.execute";
    pub const WORKFLOW_CANCEL: &str = "workflow.cancel";
    pub const WORKFLOW_SUBSCRIBE: &str = "workflow.subscribe";

    pub const QUERY_METRICS: &str = "query.metrics";
    pub const QUERY_LOGS: &str = "query.logs";
    pub const QUERY_TRACES: &str = "query.traces";

    pub const INCIDENT_CREATE: &str = "incident.create";
    pub const INCIDENT_UPDATE: &str = "incident.update";
    pub const INCIDENT_SUBSCRIBE: &str = "incident.subscribe";

    // Notification methods (server -> client)
    pub const NOTIFY_MESSAGE: &str = "notify.message";
    pub const NOTIFY_WORKFLOW_EVENT: &str = "notify.workflow.event";
    pub const NOTIFY_INCIDENT_UPDATE: &str = "notify.incident.update";
    pub const NOTIFY_STREAM_CHUNK: &str = "notify.stream.chunk";
}

// ==================== REQUEST/RESPONSE SCHEMAS ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCreateParams {
    pub name: Option<String>,
    pub metadata: Option<serde_json::Map<String, Value>>,
    pub preferences: Option<SessionPreferences>,
    pub timeout_minutes: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionPreferences {
    pub language: Option<String>,
    pub timezone: Option<String>,
    pub stream_responses: Option<bool>,
    pub include_context: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSendParams {
    pub session_id: String,
    pub content: String,
    pub attachments: Option<Vec<MessageAttachment>>,
    pub context_override: Option<ContextOverride>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageAttachment {
    pub attachment_type: String,
    pub content: String,
    pub filename: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextOverride {
    pub include_history: Option<bool>,
    pub max_history_turns: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSubscribeParams {
    pub session_id: String,
    pub resume_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowCreateParams {
    pub name: String,
    pub description: Option<String>,
    pub template: Option<String>,
    pub tasks: Vec<WorkflowTask>,
    pub auto_execute: Option<bool>,
    pub approval_required: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTask {
    pub id: String,
    pub task_type: String,
    pub name: Option<String>,
    pub depends_on: Option<Vec<String>>,
    pub config: serde_json::Map<String, Value>,
    pub retry_policy: Option<RetryPolicy>,
    pub timeout_seconds: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub backoff_strategy: String,
    pub initial_delay_ms: u32,
    pub max_delay_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecuteParams {
    pub workflow_id: String,
    pub variables: Option<serde_json::Map<String, Value>>,
    pub dry_run: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowSubscribeParams {
    pub workflow_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryMetricsParams {
    pub query: String,
    pub time_range: Option<TimeRange>,
    pub step: Option<String>,
    pub natural_language: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: Option<String>,
    pub end: Option<String>,
    pub relative: Option<String>,
}

// ==================== NOTIFICATION PAYLOADS ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageNotification {
    pub session_id: String,
    pub message: MessageChunk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageChunk {
    pub chunk_id: u32,
    pub content: String,
    pub is_delta: bool,
    pub chunk_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEventNotification {
    pub workflow_id: String,
    pub event_type: String,
    pub message: String,
    pub timestamp: String,
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentUpdateNotification {
    pub incident_id: String,
    pub update_type: String,
    pub data: Value,
}

// ==================== CONNECTION MANAGEMENT ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub connection_id: String,
    pub user_id: String,
    pub established_at: i64,
    pub subscriptions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionInfo {
    pub subscription_id: String,
    pub resource_type: String,
    pub resource_id: String,
    pub filters: Option<Value>,
}

// ==================== BATCH REQUESTS ====================

/// Batch request (array of requests)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchRequest {
    pub requests: Vec<JsonRpcRequest>,
}

/// Batch response (array of responses)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResponse {
    pub responses: Vec<BatchResponseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum BatchResponseItem {
    Success(JsonRpcResponse),
    Error(JsonRpcError),
}

// ==================== CLIENT IMPLEMENTATION HELPERS ====================

pub struct JsonRpcClient {
    next_id: std::sync::atomic::AtomicI64,
}

impl JsonRpcClient {
    pub fn new() -> Self {
        Self {
            next_id: std::sync::atomic::AtomicI64::new(1),
        }
    }

    pub fn next_id(&self) -> RequestId {
        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        RequestId::Number(id)
    }

    pub fn build_request(&self, method: impl Into<String>, params: Option<Value>) -> JsonRpcRequest {
        JsonRpcRequest::new(method, params, self.next_id())
    }

    pub fn build_notification(&self, method: impl Into<String>, params: Option<Value>) -> JsonRpcNotification {
        JsonRpcNotification::new(method, params)
    }
}

impl Default for JsonRpcClient {
    fn default() -> Self {
        Self::new()
    }
}

// ==================== EXAMPLE USAGE ====================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_request_serialization() {
        let request = JsonRpcRequest::new(
            "message.send",
            Some(json!({
                "session_id": "123",
                "content": "Hello"
            })),
            RequestId::Number(1),
        );

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
        assert!(json.contains("\"method\":\"message.send\""));
        assert!(json.contains("\"id\":1"));
    }

    #[test]
    fn test_response_serialization() {
        let response = JsonRpcResponse::new(
            json!({
                "id": "msg-123",
                "status": "sent"
            }),
            RequestId::Number(1),
        );

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
        assert!(json.contains("\"result\""));
    }

    #[test]
    fn test_error_serialization() {
        let error = JsonRpcError::method_not_found(RequestId::String("abc".to_string()));

        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"code\":-32601"));
        assert!(json.contains("Method not found"));
    }

    #[test]
    fn test_notification_serialization() {
        let notification = JsonRpcNotification::new(
            "notify.message",
            Some(json!({
                "session_id": "123",
                "content": "Update"
            })),
        );

        let json = serde_json::to_string(&notification).unwrap();
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
        assert!(json.contains("\"method\":\"notify.message\""));
        assert!(!json.contains("\"id\"")); // Notifications don't have IDs
    }

    #[test]
    fn test_batch_request() {
        let batch = BatchRequest {
            requests: vec![
                JsonRpcRequest::new("method1", None, RequestId::Number(1)),
                JsonRpcRequest::new("method2", None, RequestId::Number(2)),
            ],
        };

        let json = serde_json::to_string(&batch).unwrap();
        assert!(json.contains("method1"));
        assert!(json.contains("method2"));
    }

    #[test]
    fn test_client_id_generation() {
        let client = JsonRpcClient::new();

        let id1 = client.next_id();
        let id2 = client.next_id();

        match (id1, id2) {
            (RequestId::Number(n1), RequestId::Number(n2)) => {
                assert_eq!(n2, n1 + 1);
            }
            _ => panic!("Expected numeric IDs"),
        }
    }
}
