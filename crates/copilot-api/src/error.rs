//! Error types for the API layer

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::fmt;

/// Result type for API operations
pub type Result<T> = std::result::Result<T, ApiError>;

/// API error types
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Authorization failed: {0}")]
    AuthorizationFailed(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("WebSocket error: {0}")]
    WebSocketError(String),

    #[error("gRPC error: {0}")]
    GrpcError(String),

    #[error("Conversation error: {0}")]
    ConversationError(String),

    #[error("Workflow error: {0}")]
    WorkflowError(String),

    #[error("Execution context error: {0}")]
    ExecutionContextError(String),
}

impl ApiError {
    /// Get the HTTP status code for this error
    pub fn status_code(&self) -> StatusCode {
        match self {
            ApiError::AuthenticationFailed(_) => StatusCode::UNAUTHORIZED,
            ApiError::AuthorizationFailed(_) => StatusCode::FORBIDDEN,
            ApiError::InvalidInput(_) => StatusCode::BAD_REQUEST,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            ApiError::RateLimitExceeded => StatusCode::TOO_MANY_REQUESTS,
            ApiError::WebSocketError(_) => StatusCode::BAD_REQUEST,
            ApiError::GrpcError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::ConversationError(_) => StatusCode::BAD_REQUEST,
            ApiError::WorkflowError(_) => StatusCode::BAD_REQUEST,
            ApiError::ExecutionContextError(_) => StatusCode::UNPROCESSABLE_ENTITY,
        }
    }

    /// Get the error code string
    pub fn error_code(&self) -> &'static str {
        match self {
            ApiError::AuthenticationFailed(_) => "AUTHENTICATION_FAILED",
            ApiError::AuthorizationFailed(_) => "AUTHORIZATION_FAILED",
            ApiError::InvalidInput(_) => "INVALID_INPUT",
            ApiError::NotFound(_) => "NOT_FOUND",
            ApiError::InternalError(_) => "INTERNAL_ERROR",
            ApiError::ServiceUnavailable(_) => "SERVICE_UNAVAILABLE",
            ApiError::RateLimitExceeded => "RATE_LIMIT_EXCEEDED",
            ApiError::WebSocketError(_) => "WEBSOCKET_ERROR",
            ApiError::GrpcError(_) => "GRPC_ERROR",
            ApiError::ConversationError(_) => "CONVERSATION_ERROR",
            ApiError::WorkflowError(_) => "WORKFLOW_ERROR",
            ApiError::ExecutionContextError(_) => "EXECUTION_CONTEXT_ERROR",
        }
    }
}

/// Error response body
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    /// Error code
    pub code: String,
    /// Error message
    pub message: String,
    /// Optional error details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = ErrorResponse {
            code: self.error_code().to_string(),
            message: self.to_string(),
            details: None,
        };

        (status, Json(body)).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        ApiError::InternalError(err.to_string())
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::InvalidInput(err.to_string())
    }
}

#[cfg(feature = "grpc")]
impl From<tonic::Status> for ApiError {
    fn from(status: tonic::Status) -> Self {
        ApiError::GrpcError(status.message().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_status_codes() {
        assert_eq!(
            ApiError::AuthenticationFailed("test".into()).status_code(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            ApiError::NotFound("test".into()).status_code(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            ApiError::RateLimitExceeded.status_code(),
            StatusCode::TOO_MANY_REQUESTS
        );
    }

    #[test]
    fn test_error_codes() {
        assert_eq!(
            ApiError::AuthenticationFailed("test".into()).error_code(),
            "AUTHENTICATION_FAILED"
        );
        assert_eq!(
            ApiError::NotFound("test".into()).error_code(),
            "NOT_FOUND"
        );
    }
}
