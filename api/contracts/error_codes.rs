// Error Code Catalog and Definitions
// Comprehensive error handling with localization support

use serde::{Deserialize, Serialize};
use std::fmt;
use std::collections::HashMap;

// ==================== ERROR CODE CATALOG ====================

/// Error codes organized by category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    // ========== VALIDATION ERRORS (1000-1999) ==========
    ValidationError,
    InvalidFormat,
    MissingRequiredField,
    InvalidFieldValue,
    FieldTooLong,
    FieldTooShort,
    InvalidPattern,
    InvalidEnum,
    InvalidUuid,
    InvalidTimestamp,
    InvalidTimeRange,
    InvalidJson,
    InvalidContentType,
    PayloadTooLarge,
    TooManyItems,
    DuplicateEntry,
    CircularDependency,
    InvalidDependency,

    // ========== AUTHENTICATION ERRORS (2000-2999) ==========
    Unauthorized,
    InvalidToken,
    ExpiredToken,
    MissingToken,
    InvalidCredentials,
    TokenRevoked,
    InvalidSignature,
    InvalidIssuer,
    InvalidAudience,

    // ========== AUTHORIZATION ERRORS (3000-3999) ==========
    Forbidden,
    InsufficientPermissions,
    ResourceAccessDenied,
    OperationNotAllowed,
    QuotaExceeded,
    FeatureNotEnabled,

    // ========== RESOURCE ERRORS (4000-4999) ==========
    NotFound,
    ResourceNotFound,
    SessionNotFound,
    WorkflowNotFound,
    IncidentNotFound,
    UserNotFound,
    AlreadyExists,
    ResourceConflict,
    ResourceLocked,
    ResourceExpired,

    // ========== RATE LIMITING ERRORS (5000-5999) ==========
    RateLimitExceeded,
    TooManyRequests,
    QuotaLimitExceeded,
    ConcurrencyLimitExceeded,

    // ========== BUSINESS LOGIC ERRORS (6000-6999) ==========
    InvalidState,
    WorkflowExecutionFailed,
    WorkflowAlreadyRunning,
    WorkflowNotApproved,
    ApprovalRequired,
    CannotCancelWorkflow,
    TaskExecutionFailed,
    InvalidWorkflowState,
    IncidentAlreadyClosed,
    IncidentNotResolved,

    // ========== EXTERNAL SERVICE ERRORS (7000-7999) ==========
    ExternalServiceError,
    LlmApiError,
    LlmApiTimeout,
    LlmApiRateLimited,
    PrometheusError,
    LokiError,
    TempoError,
    DatabaseError,
    CacheError,
    VectorDbError,

    // ========== INTERNAL ERRORS (8000-8999) ==========
    InternalError,
    ConfigurationError,
    ServiceUnavailable,
    DependencyFailure,
    DatabaseConnectionError,
    CacheConnectionError,
    MessageQueueError,
    SerializationError,
    DeserializationError,

    // ========== STREAMING ERRORS (9000-9999) ==========
    StreamError,
    StreamClosed,
    StreamTimeout,
    InvalidResumeToken,
    StreamBackpressure,
}

impl ErrorCode {
    /// Get numeric error code
    pub fn code(&self) -> u16 {
        match self {
            // Validation
            ErrorCode::ValidationError => 1000,
            ErrorCode::InvalidFormat => 1001,
            ErrorCode::MissingRequiredField => 1002,
            ErrorCode::InvalidFieldValue => 1003,
            ErrorCode::FieldTooLong => 1004,
            ErrorCode::FieldTooShort => 1005,
            ErrorCode::InvalidPattern => 1006,
            ErrorCode::InvalidEnum => 1007,
            ErrorCode::InvalidUuid => 1008,
            ErrorCode::InvalidTimestamp => 1009,
            ErrorCode::InvalidTimeRange => 1010,
            ErrorCode::InvalidJson => 1011,
            ErrorCode::InvalidContentType => 1012,
            ErrorCode::PayloadTooLarge => 1013,
            ErrorCode::TooManyItems => 1014,
            ErrorCode::DuplicateEntry => 1015,
            ErrorCode::CircularDependency => 1016,
            ErrorCode::InvalidDependency => 1017,

            // Authentication
            ErrorCode::Unauthorized => 2000,
            ErrorCode::InvalidToken => 2001,
            ErrorCode::ExpiredToken => 2002,
            ErrorCode::MissingToken => 2003,
            ErrorCode::InvalidCredentials => 2004,
            ErrorCode::TokenRevoked => 2005,
            ErrorCode::InvalidSignature => 2006,
            ErrorCode::InvalidIssuer => 2007,
            ErrorCode::InvalidAudience => 2008,

            // Authorization
            ErrorCode::Forbidden => 3000,
            ErrorCode::InsufficientPermissions => 3001,
            ErrorCode::ResourceAccessDenied => 3002,
            ErrorCode::OperationNotAllowed => 3003,
            ErrorCode::QuotaExceeded => 3004,
            ErrorCode::FeatureNotEnabled => 3005,

            // Resources
            ErrorCode::NotFound => 4000,
            ErrorCode::ResourceNotFound => 4001,
            ErrorCode::SessionNotFound => 4002,
            ErrorCode::WorkflowNotFound => 4003,
            ErrorCode::IncidentNotFound => 4004,
            ErrorCode::UserNotFound => 4005,
            ErrorCode::AlreadyExists => 4006,
            ErrorCode::ResourceConflict => 4007,
            ErrorCode::ResourceLocked => 4008,
            ErrorCode::ResourceExpired => 4009,

            // Rate Limiting
            ErrorCode::RateLimitExceeded => 5000,
            ErrorCode::TooManyRequests => 5001,
            ErrorCode::QuotaLimitExceeded => 5002,
            ErrorCode::ConcurrencyLimitExceeded => 5003,

            // Business Logic
            ErrorCode::InvalidState => 6000,
            ErrorCode::WorkflowExecutionFailed => 6001,
            ErrorCode::WorkflowAlreadyRunning => 6002,
            ErrorCode::WorkflowNotApproved => 6003,
            ErrorCode::ApprovalRequired => 6004,
            ErrorCode::CannotCancelWorkflow => 6005,
            ErrorCode::TaskExecutionFailed => 6006,
            ErrorCode::InvalidWorkflowState => 6007,
            ErrorCode::IncidentAlreadyClosed => 6008,
            ErrorCode::IncidentNotResolved => 6009,

            // External Services
            ErrorCode::ExternalServiceError => 7000,
            ErrorCode::LlmApiError => 7001,
            ErrorCode::LlmApiTimeout => 7002,
            ErrorCode::LlmApiRateLimited => 7003,
            ErrorCode::PrometheusError => 7004,
            ErrorCode::LokiError => 7005,
            ErrorCode::TempoError => 7006,
            ErrorCode::DatabaseError => 7007,
            ErrorCode::CacheError => 7008,
            ErrorCode::VectorDbError => 7009,

            // Internal
            ErrorCode::InternalError => 8000,
            ErrorCode::ConfigurationError => 8001,
            ErrorCode::ServiceUnavailable => 8002,
            ErrorCode::DependencyFailure => 8003,
            ErrorCode::DatabaseConnectionError => 8004,
            ErrorCode::CacheConnectionError => 8005,
            ErrorCode::MessageQueueError => 8006,
            ErrorCode::SerializationError => 8007,
            ErrorCode::DeserializationError => 8008,

            // Streaming
            ErrorCode::StreamError => 9000,
            ErrorCode::StreamClosed => 9001,
            ErrorCode::StreamTimeout => 9002,
            ErrorCode::InvalidResumeToken => 9003,
            ErrorCode::StreamBackpressure => 9004,
        }
    }

    /// Get HTTP status code for this error
    pub fn http_status(&self) -> u16 {
        match self {
            // 400 Bad Request
            ErrorCode::ValidationError
            | ErrorCode::InvalidFormat
            | ErrorCode::MissingRequiredField
            | ErrorCode::InvalidFieldValue
            | ErrorCode::FieldTooLong
            | ErrorCode::FieldTooShort
            | ErrorCode::InvalidPattern
            | ErrorCode::InvalidEnum
            | ErrorCode::InvalidUuid
            | ErrorCode::InvalidTimestamp
            | ErrorCode::InvalidTimeRange
            | ErrorCode::InvalidJson
            | ErrorCode::InvalidContentType
            | ErrorCode::TooManyItems
            | ErrorCode::DuplicateEntry
            | ErrorCode::CircularDependency
            | ErrorCode::InvalidDependency
            | ErrorCode::InvalidState
            | ErrorCode::InvalidResumeToken => 400,

            // 401 Unauthorized
            ErrorCode::Unauthorized
            | ErrorCode::InvalidToken
            | ErrorCode::ExpiredToken
            | ErrorCode::MissingToken
            | ErrorCode::InvalidCredentials
            | ErrorCode::TokenRevoked
            | ErrorCode::InvalidSignature
            | ErrorCode::InvalidIssuer
            | ErrorCode::InvalidAudience => 401,

            // 403 Forbidden
            ErrorCode::Forbidden
            | ErrorCode::InsufficientPermissions
            | ErrorCode::ResourceAccessDenied
            | ErrorCode::OperationNotAllowed
            | ErrorCode::FeatureNotEnabled
            | ErrorCode::WorkflowNotApproved
            | ErrorCode::ApprovalRequired => 403,

            // 404 Not Found
            ErrorCode::NotFound
            | ErrorCode::ResourceNotFound
            | ErrorCode::SessionNotFound
            | ErrorCode::WorkflowNotFound
            | ErrorCode::IncidentNotFound
            | ErrorCode::UserNotFound => 404,

            // 409 Conflict
            ErrorCode::AlreadyExists
            | ErrorCode::ResourceConflict
            | ErrorCode::ResourceLocked
            | ErrorCode::WorkflowAlreadyRunning
            | ErrorCode::IncidentAlreadyClosed => 409,

            // 410 Gone
            ErrorCode::ResourceExpired => 410,

            // 413 Payload Too Large
            ErrorCode::PayloadTooLarge => 413,

            // 422 Unprocessable Entity
            ErrorCode::WorkflowExecutionFailed
            | ErrorCode::TaskExecutionFailed
            | ErrorCode::InvalidWorkflowState
            | ErrorCode::CannotCancelWorkflow
            | ErrorCode::IncidentNotResolved => 422,

            // 429 Too Many Requests
            ErrorCode::RateLimitExceeded
            | ErrorCode::TooManyRequests
            | ErrorCode::QuotaLimitExceeded
            | ErrorCode::QuotaExceeded
            | ErrorCode::ConcurrencyLimitExceeded
            | ErrorCode::LlmApiRateLimited => 429,

            // 500 Internal Server Error
            ErrorCode::InternalError
            | ErrorCode::ConfigurationError
            | ErrorCode::DatabaseConnectionError
            | ErrorCode::CacheConnectionError
            | ErrorCode::MessageQueueError
            | ErrorCode::SerializationError
            | ErrorCode::DeserializationError => 500,

            // 502 Bad Gateway
            ErrorCode::ExternalServiceError
            | ErrorCode::LlmApiError
            | ErrorCode::PrometheusError
            | ErrorCode::LokiError
            | ErrorCode::TempoError
            | ErrorCode::DatabaseError
            | ErrorCode::CacheError
            | ErrorCode::VectorDbError
            | ErrorCode::DependencyFailure => 502,

            // 503 Service Unavailable
            ErrorCode::ServiceUnavailable
            | ErrorCode::StreamClosed
            | ErrorCode::StreamBackpressure => 503,

            // 504 Gateway Timeout
            ErrorCode::LlmApiTimeout | ErrorCode::StreamTimeout => 504,

            // 500 for streaming errors (default)
            ErrorCode::StreamError => 500,
        }
    }

    /// Get default error message template
    pub fn default_message(&self) -> &'static str {
        match self {
            ErrorCode::ValidationError => "Request validation failed",
            ErrorCode::InvalidFormat => "Invalid format",
            ErrorCode::MissingRequiredField => "Required field missing",
            ErrorCode::InvalidFieldValue => "Invalid field value",
            ErrorCode::FieldTooLong => "Field value too long",
            ErrorCode::FieldTooShort => "Field value too short",
            ErrorCode::InvalidPattern => "Field does not match required pattern",
            ErrorCode::InvalidEnum => "Invalid enum value",
            ErrorCode::InvalidUuid => "Invalid UUID format",
            ErrorCode::InvalidTimestamp => "Invalid timestamp format",
            ErrorCode::InvalidTimeRange => "Invalid time range",
            ErrorCode::InvalidJson => "Invalid JSON",
            ErrorCode::InvalidContentType => "Invalid Content-Type header",
            ErrorCode::PayloadTooLarge => "Request payload too large",
            ErrorCode::TooManyItems => "Too many items in collection",
            ErrorCode::DuplicateEntry => "Duplicate entry",
            ErrorCode::CircularDependency => "Circular dependency detected",
            ErrorCode::InvalidDependency => "Invalid dependency reference",

            ErrorCode::Unauthorized => "Authentication required",
            ErrorCode::InvalidToken => "Invalid authentication token",
            ErrorCode::ExpiredToken => "Authentication token expired",
            ErrorCode::MissingToken => "Authentication token missing",
            ErrorCode::InvalidCredentials => "Invalid credentials",
            ErrorCode::TokenRevoked => "Authentication token revoked",
            ErrorCode::InvalidSignature => "Invalid token signature",
            ErrorCode::InvalidIssuer => "Invalid token issuer",
            ErrorCode::InvalidAudience => "Invalid token audience",

            ErrorCode::Forbidden => "Access forbidden",
            ErrorCode::InsufficientPermissions => "Insufficient permissions",
            ErrorCode::ResourceAccessDenied => "Resource access denied",
            ErrorCode::OperationNotAllowed => "Operation not allowed",
            ErrorCode::QuotaExceeded => "Quota exceeded",
            ErrorCode::FeatureNotEnabled => "Feature not enabled",

            ErrorCode::NotFound => "Resource not found",
            ErrorCode::ResourceNotFound => "Resource not found",
            ErrorCode::SessionNotFound => "Session not found",
            ErrorCode::WorkflowNotFound => "Workflow not found",
            ErrorCode::IncidentNotFound => "Incident not found",
            ErrorCode::UserNotFound => "User not found",
            ErrorCode::AlreadyExists => "Resource already exists",
            ErrorCode::ResourceConflict => "Resource conflict",
            ErrorCode::ResourceLocked => "Resource locked",
            ErrorCode::ResourceExpired => "Resource expired",

            ErrorCode::RateLimitExceeded => "Rate limit exceeded",
            ErrorCode::TooManyRequests => "Too many requests",
            ErrorCode::QuotaLimitExceeded => "Quota limit exceeded",
            ErrorCode::ConcurrencyLimitExceeded => "Concurrency limit exceeded",

            ErrorCode::InvalidState => "Invalid state",
            ErrorCode::WorkflowExecutionFailed => "Workflow execution failed",
            ErrorCode::WorkflowAlreadyRunning => "Workflow already running",
            ErrorCode::WorkflowNotApproved => "Workflow not approved",
            ErrorCode::ApprovalRequired => "Approval required",
            ErrorCode::CannotCancelWorkflow => "Cannot cancel workflow",
            ErrorCode::TaskExecutionFailed => "Task execution failed",
            ErrorCode::InvalidWorkflowState => "Invalid workflow state",
            ErrorCode::IncidentAlreadyClosed => "Incident already closed",
            ErrorCode::IncidentNotResolved => "Incident not resolved",

            ErrorCode::ExternalServiceError => "External service error",
            ErrorCode::LlmApiError => "LLM API error",
            ErrorCode::LlmApiTimeout => "LLM API timeout",
            ErrorCode::LlmApiRateLimited => "LLM API rate limited",
            ErrorCode::PrometheusError => "Prometheus error",
            ErrorCode::LokiError => "Loki error",
            ErrorCode::TempoError => "Tempo error",
            ErrorCode::DatabaseError => "Database error",
            ErrorCode::CacheError => "Cache error",
            ErrorCode::VectorDbError => "Vector database error",

            ErrorCode::InternalError => "Internal server error",
            ErrorCode::ConfigurationError => "Configuration error",
            ErrorCode::ServiceUnavailable => "Service unavailable",
            ErrorCode::DependencyFailure => "Dependency failure",
            ErrorCode::DatabaseConnectionError => "Database connection error",
            ErrorCode::CacheConnectionError => "Cache connection error",
            ErrorCode::MessageQueueError => "Message queue error",
            ErrorCode::SerializationError => "Serialization error",
            ErrorCode::DeserializationError => "Deserialization error",

            ErrorCode::StreamError => "Stream error",
            ErrorCode::StreamClosed => "Stream closed",
            ErrorCode::StreamTimeout => "Stream timeout",
            ErrorCode::InvalidResumeToken => "Invalid resume token",
            ErrorCode::StreamBackpressure => "Stream backpressure",
        }
    }

    /// Check if error should expose details to client
    pub fn expose_details(&self) -> bool {
        match self {
            // Expose validation and client errors
            ErrorCode::ValidationError
            | ErrorCode::InvalidFormat
            | ErrorCode::MissingRequiredField
            | ErrorCode::InvalidFieldValue
            | ErrorCode::FieldTooLong
            | ErrorCode::FieldTooShort
            | ErrorCode::InvalidPattern
            | ErrorCode::InvalidEnum
            | ErrorCode::InvalidUuid
            | ErrorCode::InvalidTimestamp
            | ErrorCode::InvalidTimeRange
            | ErrorCode::InvalidJson
            | ErrorCode::InvalidContentType
            | ErrorCode::PayloadTooLarge
            | ErrorCode::TooManyItems
            | ErrorCode::DuplicateEntry
            | ErrorCode::CircularDependency
            | ErrorCode::InvalidDependency
            | ErrorCode::Unauthorized
            | ErrorCode::Forbidden
            | ErrorCode::NotFound
            | ErrorCode::RateLimitExceeded
            | ErrorCode::QuotaExceeded => true,

            // Hide internal error details
            _ => false,
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

// ==================== ERROR RESPONSE ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field_errors: Option<Vec<FieldError>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldError {
    pub field: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraint: Option<String>,
}

impl ApiError {
    /// Create new error with code and message
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
            field_errors: None,
            documentation_url: None,
            request_id: None,
        }
    }

    /// Create error with default message
    pub fn from_code(code: ErrorCode) -> Self {
        Self::new(code, code.default_message())
    }

    /// Add additional details
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    /// Add field errors
    pub fn with_field_errors(mut self, errors: Vec<FieldError>) -> Self {
        self.field_errors = Some(errors);
        self
    }

    /// Add documentation URL
    pub fn with_docs(mut self, url: impl Into<String>) -> Self {
        self.documentation_url = Some(url.into());
        self
    }

    /// Add request ID for tracing
    pub fn with_request_id(mut self, id: impl Into<String>) -> Self {
        self.request_id = Some(id.into());
        self
    }

    /// Get HTTP status code
    pub fn http_status(&self) -> u16 {
        self.code.http_status()
    }

    /// Sanitize error for production (hide sensitive details)
    pub fn sanitize_for_production(self) -> Self {
        if self.code.expose_details() {
            self
        } else {
            Self {
                code: self.code,
                message: self.code.default_message().to_string(),
                details: None,
                field_errors: None,
                documentation_url: self.documentation_url,
                request_id: self.request_id,
            }
        }
    }
}

// ==================== LOCALIZATION ====================

pub struct ErrorLocalizer {
    translations: HashMap<String, HashMap<ErrorCode, String>>,
}

impl ErrorLocalizer {
    pub fn new() -> Self {
        let mut localizer = Self {
            translations: HashMap::new(),
        };
        localizer.load_translations();
        localizer
    }

    fn load_translations(&mut self) {
        // English (default)
        let mut en = HashMap::new();
        en.insert(ErrorCode::ValidationError, "Request validation failed".to_string());
        en.insert(ErrorCode::Unauthorized, "Authentication required".to_string());
        en.insert(ErrorCode::NotFound, "Resource not found".to_string());
        self.translations.insert("en".to_string(), en);

        // Spanish
        let mut es = HashMap::new();
        es.insert(ErrorCode::ValidationError, "Falló la validación de la solicitud".to_string());
        es.insert(ErrorCode::Unauthorized, "Se requiere autenticación".to_string());
        es.insert(ErrorCode::NotFound, "Recurso no encontrado".to_string());
        self.translations.insert("es".to_string(), es);

        // French
        let mut fr = HashMap::new();
        fr.insert(ErrorCode::ValidationError, "Échec de la validation de la demande".to_string());
        fr.insert(ErrorCode::Unauthorized, "Authentification requise".to_string());
        fr.insert(ErrorCode::NotFound, "Ressource non trouvée".to_string());
        self.translations.insert("fr".to_string(), fr);

        // German
        let mut de = HashMap::new();
        de.insert(ErrorCode::ValidationError, "Anforderungsvalidierung fehlgeschlagen".to_string());
        de.insert(ErrorCode::Unauthorized, "Authentifizierung erforderlich".to_string());
        de.insert(ErrorCode::NotFound, "Ressource nicht gefunden".to_string());
        self.translations.insert("de".to_string(), de);

        // Japanese
        let mut ja = HashMap::new();
        ja.insert(ErrorCode::ValidationError, "リクエストの検証に失敗しました".to_string());
        ja.insert(ErrorCode::Unauthorized, "認証が必要です".to_string());
        ja.insert(ErrorCode::NotFound, "リソースが見つかりません".to_string());
        self.translations.insert("ja".to_string(), ja);

        // Chinese
        let mut zh = HashMap::new();
        zh.insert(ErrorCode::ValidationError, "请求验证失败".to_string());
        zh.insert(ErrorCode::Unauthorized, "需要身份验证".to_string());
        zh.insert(ErrorCode::NotFound, "未找到资源".to_string());
        self.translations.insert("zh".to_string(), zh);
    }

    pub fn translate(&self, code: ErrorCode, language: &str) -> String {
        self.translations
            .get(language)
            .and_then(|lang_map| lang_map.get(&code))
            .cloned()
            .unwrap_or_else(|| code.default_message().to_string())
    }

    pub fn localize_error(&self, mut error: ApiError, language: &str) -> ApiError {
        error.message = self.translate(error.code, language);
        error
    }
}

// ==================== ERROR CODE TABLE ====================

/// Generate markdown table of all error codes
pub fn generate_error_code_table() -> String {
    let mut table = String::from("# Error Code Reference\n\n");
    table.push_str("| Code | HTTP | Name | Default Message |\n");
    table.push_str("|------|------|------|----------------|\n");

    let all_codes = vec![
        // Validation
        ErrorCode::ValidationError,
        ErrorCode::InvalidFormat,
        ErrorCode::MissingRequiredField,
        ErrorCode::InvalidFieldValue,
        ErrorCode::FieldTooLong,
        ErrorCode::FieldTooShort,
        ErrorCode::InvalidPattern,
        ErrorCode::InvalidEnum,
        ErrorCode::InvalidUuid,
        ErrorCode::InvalidTimestamp,
        ErrorCode::InvalidTimeRange,
        ErrorCode::InvalidJson,
        ErrorCode::InvalidContentType,
        ErrorCode::PayloadTooLarge,
        ErrorCode::TooManyItems,
        ErrorCode::DuplicateEntry,
        ErrorCode::CircularDependency,
        ErrorCode::InvalidDependency,
        // Authentication
        ErrorCode::Unauthorized,
        ErrorCode::InvalidToken,
        ErrorCode::ExpiredToken,
        ErrorCode::MissingToken,
        ErrorCode::InvalidCredentials,
        ErrorCode::TokenRevoked,
        ErrorCode::InvalidSignature,
        ErrorCode::InvalidIssuer,
        ErrorCode::InvalidAudience,
        // Authorization
        ErrorCode::Forbidden,
        ErrorCode::InsufficientPermissions,
        ErrorCode::ResourceAccessDenied,
        ErrorCode::OperationNotAllowed,
        ErrorCode::QuotaExceeded,
        ErrorCode::FeatureNotEnabled,
        // Resources
        ErrorCode::NotFound,
        ErrorCode::ResourceNotFound,
        ErrorCode::SessionNotFound,
        ErrorCode::WorkflowNotFound,
        ErrorCode::IncidentNotFound,
        ErrorCode::UserNotFound,
        ErrorCode::AlreadyExists,
        ErrorCode::ResourceConflict,
        ErrorCode::ResourceLocked,
        ErrorCode::ResourceExpired,
        // Rate Limiting
        ErrorCode::RateLimitExceeded,
        ErrorCode::TooManyRequests,
        ErrorCode::QuotaLimitExceeded,
        ErrorCode::ConcurrencyLimitExceeded,
        // Business Logic
        ErrorCode::InvalidState,
        ErrorCode::WorkflowExecutionFailed,
        ErrorCode::WorkflowAlreadyRunning,
        ErrorCode::WorkflowNotApproved,
        ErrorCode::ApprovalRequired,
        ErrorCode::CannotCancelWorkflow,
        ErrorCode::TaskExecutionFailed,
        ErrorCode::InvalidWorkflowState,
        ErrorCode::IncidentAlreadyClosed,
        ErrorCode::IncidentNotResolved,
        // External Services
        ErrorCode::ExternalServiceError,
        ErrorCode::LlmApiError,
        ErrorCode::LlmApiTimeout,
        ErrorCode::LlmApiRateLimited,
        ErrorCode::PrometheusError,
        ErrorCode::LokiError,
        ErrorCode::TempoError,
        ErrorCode::DatabaseError,
        ErrorCode::CacheError,
        ErrorCode::VectorDbError,
        // Internal
        ErrorCode::InternalError,
        ErrorCode::ConfigurationError,
        ErrorCode::ServiceUnavailable,
        ErrorCode::DependencyFailure,
        ErrorCode::DatabaseConnectionError,
        ErrorCode::CacheConnectionError,
        ErrorCode::MessageQueueError,
        ErrorCode::SerializationError,
        ErrorCode::DeserializationError,
        // Streaming
        ErrorCode::StreamError,
        ErrorCode::StreamClosed,
        ErrorCode::StreamTimeout,
        ErrorCode::InvalidResumeToken,
        ErrorCode::StreamBackpressure,
    ];

    for code in all_codes {
        table.push_str(&format!(
            "| {} | {} | {:?} | {} |\n",
            code.code(),
            code.http_status(),
            code,
            code.default_message()
        ));
    }

    table
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_code_mapping() {
        assert_eq!(ErrorCode::ValidationError.code(), 1000);
        assert_eq!(ErrorCode::Unauthorized.code(), 2000);
        assert_eq!(ErrorCode::NotFound.code(), 4000);
    }

    #[test]
    fn test_http_status_mapping() {
        assert_eq!(ErrorCode::ValidationError.http_status(), 400);
        assert_eq!(ErrorCode::Unauthorized.http_status(), 401);
        assert_eq!(ErrorCode::Forbidden.http_status(), 403);
        assert_eq!(ErrorCode::NotFound.http_status(), 404);
        assert_eq!(ErrorCode::RateLimitExceeded.http_status(), 429);
        assert_eq!(ErrorCode::InternalError.http_status(), 500);
    }

    #[test]
    fn test_error_localization() {
        let localizer = ErrorLocalizer::new();

        assert_eq!(
            localizer.translate(ErrorCode::NotFound, "en"),
            "Resource not found"
        );
        assert_eq!(
            localizer.translate(ErrorCode::NotFound, "es"),
            "Recurso no encontrado"
        );
        assert_eq!(
            localizer.translate(ErrorCode::NotFound, "fr"),
            "Ressource non trouvée"
        );
    }

    #[test]
    fn test_error_sanitization() {
        let error = ApiError::new(ErrorCode::InternalError, "Database connection failed: localhost:5432")
            .with_details(serde_json::json!({
                "host": "localhost",
                "port": 5432
            }));

        let sanitized = error.sanitize_for_production();

        assert_eq!(sanitized.message, "Internal server error");
        assert!(sanitized.details.is_none());
    }
}
