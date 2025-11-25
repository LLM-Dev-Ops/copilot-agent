use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Authentication error: {message}")]
    Authentication { message: String },

    #[error("Authorization error: {message}")]
    Authorization { message: String },

    #[error("Not found: {resource}")]
    NotFound { resource: String },

    #[error("Rate limit exceeded: {message}")]
    RateLimit { message: String },

    #[error("Request timeout: {message}")]
    Timeout { message: String },

    #[error("Internal error: {message}")]
    Internal { message: String },

    #[error("Service unavailable: {message}")]
    ServiceUnavailable { message: String },

    #[error("Dependency failure: {service}: {message}")]
    DependencyFailure { service: String, message: String },
}

impl AppError {
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
        }
    }

    pub fn authentication(message: impl Into<String>) -> Self {
        Self::Authentication {
            message: message.into(),
        }
    }

    pub fn authorization(message: impl Into<String>) -> Self {
        Self::Authorization {
            message: message.into(),
        }
    }

    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound {
            resource: resource.into(),
        }
    }

    pub fn rate_limit(message: impl Into<String>) -> Self {
        Self::RateLimit {
            message: message.into(),
        }
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self::Timeout {
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    pub fn service_unavailable(message: impl Into<String>) -> Self {
        Self::ServiceUnavailable {
            message: message.into(),
        }
    }

    pub fn dependency_failure(service: impl Into<String>, message: impl Into<String>) -> Self {
        Self::DependencyFailure {
            service: service.into(),
            message: message.into(),
        }
    }

    pub fn status_code(&self) -> u16 {
        match self {
            AppError::Validation { .. } => 400,
            AppError::Authentication { .. } => 401,
            AppError::Authorization { .. } => 403,
            AppError::NotFound { .. } => 404,
            AppError::RateLimit { .. } => 429,
            AppError::Timeout { .. } => 408,
            AppError::Internal { .. } => 500,
            AppError::ServiceUnavailable { .. } => 503,
            AppError::DependencyFailure { .. } => 502,
        }
    }

    pub fn is_retriable(&self) -> bool {
        matches!(
            self,
            AppError::Timeout { .. }
                | AppError::ServiceUnavailable { .. }
                | AppError::DependencyFailure { .. }
        )
    }

    pub fn error_code(&self) -> &'static str {
        match self {
            AppError::Validation { .. } => "VALIDATION_ERROR",
            AppError::Authentication { .. } => "AUTHENTICATION_ERROR",
            AppError::Authorization { .. } => "AUTHORIZATION_ERROR",
            AppError::NotFound { .. } => "NOT_FOUND",
            AppError::RateLimit { .. } => "RATE_LIMIT_EXCEEDED",
            AppError::Timeout { .. } => "REQUEST_TIMEOUT",
            AppError::Internal { .. } => "INTERNAL_ERROR",
            AppError::ServiceUnavailable { .. } => "SERVICE_UNAVAILABLE",
            AppError::DependencyFailure { .. } => "DEPENDENCY_FAILURE",
        }
    }

    pub fn to_error_response(&self) -> ErrorResponse {
        ErrorResponse {
            error: self.error_code().to_string(),
            message: self.to_string(),
            status_code: self.status_code(),
            retriable: self.is_retriable(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
    pub status_code: u16,
    pub retriable: bool,
}

impl ErrorResponse {
    pub fn new(error: String, message: String, status_code: u16) -> Self {
        Self {
            error,
            message,
            status_code,
            retriable: false,
        }
    }

    pub fn with_retriable(mut self, retriable: bool) -> Self {
        self.retriable = retriable;
        self
    }
}

impl fmt::Display for ErrorResponse {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{}] {}: {}",
            self.status_code, self.error, self.message
        )
    }
}

impl From<AppError> for ErrorResponse {
    fn from(error: AppError) -> Self {
        error.to_error_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_error() {
        let err = AppError::validation("Invalid input");
        assert_eq!(err.status_code(), 400);
        assert_eq!(err.error_code(), "VALIDATION_ERROR");
        assert!(!err.is_retriable());
    }

    #[test]
    fn test_authentication_error() {
        let err = AppError::authentication("Invalid token");
        assert_eq!(err.status_code(), 401);
        assert_eq!(err.error_code(), "AUTHENTICATION_ERROR");
        assert!(!err.is_retriable());
    }

    #[test]
    fn test_authorization_error() {
        let err = AppError::authorization("Insufficient permissions");
        assert_eq!(err.status_code(), 403);
        assert_eq!(err.error_code(), "AUTHORIZATION_ERROR");
        assert!(!err.is_retriable());
    }

    #[test]
    fn test_not_found_error() {
        let err = AppError::not_found("User");
        assert_eq!(err.status_code(), 404);
        assert_eq!(err.error_code(), "NOT_FOUND");
        assert!(!err.is_retriable());
    }

    #[test]
    fn test_rate_limit_error() {
        let err = AppError::rate_limit("Too many requests");
        assert_eq!(err.status_code(), 429);
        assert_eq!(err.error_code(), "RATE_LIMIT_EXCEEDED");
        assert!(!err.is_retriable());
    }

    #[test]
    fn test_timeout_error() {
        let err = AppError::timeout("Request timed out");
        assert_eq!(err.status_code(), 408);
        assert_eq!(err.error_code(), "REQUEST_TIMEOUT");
        assert!(err.is_retriable());
    }

    #[test]
    fn test_internal_error() {
        let err = AppError::internal("Something went wrong");
        assert_eq!(err.status_code(), 500);
        assert_eq!(err.error_code(), "INTERNAL_ERROR");
        assert!(!err.is_retriable());
    }

    #[test]
    fn test_service_unavailable_error() {
        let err = AppError::service_unavailable("Service is down");
        assert_eq!(err.status_code(), 503);
        assert_eq!(err.error_code(), "SERVICE_UNAVAILABLE");
        assert!(err.is_retriable());
    }

    #[test]
    fn test_dependency_failure_error() {
        let err = AppError::dependency_failure("database", "Connection failed");
        assert_eq!(err.status_code(), 502);
        assert_eq!(err.error_code(), "DEPENDENCY_FAILURE");
        assert!(err.is_retriable());
    }

    #[test]
    fn test_error_response_conversion() {
        let err = AppError::validation("Invalid input");
        let response: ErrorResponse = err.into();

        assert_eq!(response.error, "VALIDATION_ERROR");
        assert_eq!(response.status_code, 400);
        assert!(!response.retriable);
    }
}
