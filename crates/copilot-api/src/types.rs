//! Common types used across the API

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Session creation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    /// Optional session name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Session metadata
    #[serde(default)]
    pub metadata: serde_json::Value,
}

/// Session response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionResponse {
    /// Session ID
    pub id: String,
    /// Session name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last activity timestamp
    pub last_activity: DateTime<Utc>,
    /// Session metadata
    pub metadata: serde_json::Value,
}

/// Message send request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    /// Session ID
    pub session_id: String,
    /// Message content
    pub content: String,
    /// Message role (user, assistant, system)
    pub role: MessageRole,
    /// Optional message metadata
    #[serde(default)]
    pub metadata: serde_json::Value,
}

/// Message role
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// Message response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageResponse {
    /// Message ID
    pub id: String,
    /// Session ID
    pub session_id: String,
    /// Message role
    pub role: MessageRole,
    /// Message content
    pub content: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Message metadata
    pub metadata: serde_json::Value,
}

/// Get messages response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetMessagesResponse {
    /// List of messages
    pub messages: Vec<MessageResponse>,
    /// Total count
    pub total: usize,
    /// Pagination cursor
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

/// Workflow creation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWorkflowRequest {
    /// Workflow name
    pub name: String,
    /// Workflow definition
    pub definition: WorkflowDefinition,
    /// Initial input
    #[serde(default)]
    pub input: serde_json::Value,
}

/// Workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    /// Workflow steps
    pub steps: Vec<WorkflowStep>,
    /// Workflow configuration
    #[serde(default)]
    pub config: serde_json::Value,
}

/// Workflow step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// Step ID
    pub id: String,
    /// Step type
    pub step_type: String,
    /// Step configuration
    pub config: serde_json::Value,
}

/// Workflow status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Workflow response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowResponse {
    /// Workflow ID
    pub id: String,
    /// Workflow name
    pub name: String,
    /// Workflow status
    pub status: WorkflowStatus,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Workflow result
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    /// Service status
    pub status: String,
    /// Service version
    pub version: String,
    /// Uptime in seconds
    pub uptime: u64,
}

/// API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    /// Success flag
    pub success: bool,
    /// Response data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    /// Error message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Execution graph (present when execution tracking is active)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_graph: Option<serde_json::Value>,
}

impl<T> ApiResponse<T> {
    /// Create a successful response
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            execution_graph: None,
        }
    }

    /// Create an error response
    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            execution_graph: None,
        }
    }

    /// Attach an execution graph to the response
    pub fn with_execution_graph(mut self, graph: serde_json::Value) -> Self {
        self.execution_graph = Some(graph);
        self
    }
}

/// JWT claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Expiration time
    pub exp: usize,
    /// Issued at
    pub iat: usize,
    /// Additional claims
    #[serde(flatten)]
    pub additional: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_response_success() {
        let response = ApiResponse::success("test data");
        assert!(response.success);
        assert_eq!(response.data, Some("test data"));
        assert_eq!(response.error, None);
    }

    #[test]
    fn test_api_response_error() {
        let response: ApiResponse<String> = ApiResponse::error("test error".to_string());
        assert!(!response.success);
        assert_eq!(response.data, None);
        assert_eq!(response.error, Some("test error".to_string()));
    }

    #[test]
    fn test_message_role_serialization() {
        let role = MessageRole::User;
        let json = serde_json::to_string(&role).unwrap();
        assert_eq!(json, "\"user\"");
    }

    #[test]
    fn test_workflow_status_serialization() {
        let status = WorkflowStatus::Running;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"running\"");
    }
}
