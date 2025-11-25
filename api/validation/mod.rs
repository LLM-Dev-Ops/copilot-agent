// API Validation Module
// Comprehensive request validation using validator crate

use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};
use std::collections::HashMap;
use regex::Regex;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;

// ==================== VALIDATION TRAITS ====================

/// Custom validation trait for complex business logic
pub trait BusinessValidation {
    fn validate_business_rules(&self) -> Result<(), ValidationErrors>;
}

/// Validation errors with detailed field information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationErrors {
    pub errors: Vec<FieldError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldError {
    pub field: String,
    pub message: String,
    pub constraint: Option<String>,
}

impl ValidationErrors {
    pub fn new() -> Self {
        Self { errors: Vec::new() }
    }

    pub fn add(&mut self, field: impl Into<String>, message: impl Into<String>) {
        self.errors.push(FieldError {
            field: field.into(),
            message: message.into(),
            constraint: None,
        });
    }

    pub fn add_with_constraint(
        &mut self,
        field: impl Into<String>,
        message: impl Into<String>,
        constraint: impl Into<String>,
    ) {
        self.errors.push(FieldError {
            field: field.into(),
            message: message.into(),
            constraint: Some(constraint.into()),
        });
    }

    pub fn is_empty(&self) -> bool {
        self.errors.is_empty()
    }
}

// ==================== SESSION VALIDATION ====================

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct CreateSessionRequest {
    #[validate(
        length(min = 1, max = 200, message = "Name must be 1-200 characters"),
        regex(
            path = "SESSION_NAME_PATTERN",
            message = "Name can only contain alphanumeric, spaces, hyphens, and underscores"
        )
    )]
    pub name: Option<String>,

    #[validate(custom = "validate_metadata")]
    pub metadata: Option<HashMap<String, String>>,

    #[validate]
    pub preferences: Option<SessionPreferences>,

    #[validate(range(min = 5, max = 1440, message = "Timeout must be 5-1440 minutes"))]
    pub timeout_minutes: Option<u32>,
}

lazy_static::lazy_static! {
    static ref SESSION_NAME_PATTERN: Regex = Regex::new(r"^[a-zA-Z0-9\s\-_]+$").unwrap();
    static ref TIMEZONE_PATTERN: Regex = Regex::new(r"^[A-Za-z]+/[A-Za-z_]+$").unwrap();
    static ref UUID_PATTERN: Regex = Regex::new(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    ).unwrap();
}

fn validate_metadata(metadata: &HashMap<String, String>) -> Result<(), ValidationError> {
    if metadata.len() > 20 {
        return Err(ValidationError::new("metadata_max_properties")
            .with_message("Maximum 20 metadata properties allowed".into()));
    }

    for (key, value) in metadata {
        if key.len() > 100 {
            return Err(ValidationError::new("metadata_key_length")
                .with_message("Metadata key too long".into()));
        }
        if value.len() > 1000 {
            return Err(ValidationError::new("metadata_value_length")
                .with_message("Metadata value too long".into()));
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct SessionPreferences {
    #[validate(custom = "validate_language")]
    pub language: Option<String>,

    #[validate(regex(
        path = "TIMEZONE_PATTERN",
        message = "Invalid timezone format (expected: Region/City)"
    ))]
    pub timezone: Option<String>,

    pub stream_responses: Option<bool>,
    pub include_context: Option<bool>,
}

fn validate_language(language: &str) -> Result<(), ValidationError> {
    const SUPPORTED_LANGUAGES: &[&str] = &["en", "es", "fr", "de", "ja", "zh"];

    if !SUPPORTED_LANGUAGES.contains(&language) {
        return Err(ValidationError::new("unsupported_language")
            .with_message(format!("Language must be one of: {}", SUPPORTED_LANGUAGES.join(", ")).into()));
    }
    Ok(())
}

// ==================== MESSAGE VALIDATION ====================

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct SendMessageRequest {
    #[validate(
        length(min = 1, max = 10000, message = "Content must be 1-10000 characters"),
        custom = "validate_message_content"
    )]
    pub content: String,

    #[validate]
    pub attachments: Option<Vec<MessageAttachment>>,

    #[validate]
    pub context_override: Option<ContextOverride>,
}

fn validate_message_content(content: &str) -> Result<(), ValidationError> {
    // Check for suspicious patterns
    if content.trim().is_empty() {
        return Err(ValidationError::new("content_empty")
            .with_message("Content cannot be only whitespace".into()));
    }

    // Check for potential injection attacks
    if content.contains("<?php") || content.contains("<script") {
        return Err(ValidationError::new("content_suspicious")
            .with_message("Content contains potentially malicious code".into()));
    }

    Ok(())
}

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct MessageAttachment {
    #[validate(custom = "validate_attachment_type")]
    pub attachment_type: String,

    #[validate(length(max = 100000, message = "Attachment content too large (max 100KB)"))]
    pub content: String,

    #[validate(length(max = 255, message = "Filename too long"))]
    pub filename: Option<String>,

    #[validate(regex(
        path = "MIME_TYPE_PATTERN",
        message = "Invalid MIME type format"
    ))]
    pub mime_type: Option<String>,
}

lazy_static::lazy_static! {
    static ref MIME_TYPE_PATTERN: Regex = Regex::new(r"^[a-z]+/[a-z0-9\-\+\.]+$").unwrap();
}

fn validate_attachment_type(attachment_type: &str) -> Result<(), ValidationError> {
    const VALID_TYPES: &[&str] = &["file", "url", "image", "code"];

    if !VALID_TYPES.contains(&attachment_type) {
        return Err(ValidationError::new("invalid_attachment_type")
            .with_message(format!("Type must be one of: {}", VALID_TYPES.join(", ")).into()));
    }
    Ok(())
}

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct ContextOverride {
    pub include_history: Option<bool>,

    #[validate(range(min = 0, max = 50, message = "Max history turns must be 0-50"))]
    pub max_history_turns: Option<u32>,
}

impl BusinessValidation for SendMessageRequest {
    fn validate_business_rules(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Validate attachments count
        if let Some(attachments) = &self.attachments {
            if attachments.len() > 10 {
                errors.add("attachments", "Maximum 10 attachments allowed");
            }

            // Validate total attachment size
            let total_size: usize = attachments.iter().map(|a| a.content.len()).sum();
            if total_size > 1_000_000 {
                errors.add("attachments", "Total attachment size exceeds 1MB");
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// ==================== WORKFLOW VALIDATION ====================

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct CreateWorkflowRequest {
    #[validate(length(min = 1, max = 200, message = "Name must be 1-200 characters"))]
    pub name: String,

    #[validate(length(max = 1000, message = "Description too long"))]
    pub description: Option<String>,

    #[validate(length(max = 100))]
    pub template: Option<String>,

    #[validate(length(min = 1, max = 100, message = "Must have 1-100 tasks"))]
    pub tasks: Vec<WorkflowTask>,

    pub auto_execute: Option<bool>,
    pub approval_required: Option<bool>,
    pub rollback_on_failure: Option<bool>,
}

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct WorkflowTask {
    #[validate(
        length(max = 100),
        regex(
            path = "TASK_ID_PATTERN",
            message = "Task ID can only contain alphanumeric, hyphens, and underscores"
        )
    )]
    pub id: String,

    #[validate(custom = "validate_task_type")]
    pub task_type: String,

    #[validate(length(max = 200))]
    pub name: Option<String>,

    pub depends_on: Option<Vec<String>>,

    #[serde(default)]
    pub config: HashMap<String, serde_json::Value>,

    #[validate]
    pub retry_policy: Option<RetryPolicy>,

    #[validate(range(min = 1, max = 3600, message = "Timeout must be 1-3600 seconds"))]
    pub timeout_seconds: Option<u32>,
}

lazy_static::lazy_static! {
    static ref TASK_ID_PATTERN: Regex = Regex::new(r"^[a-zA-Z0-9\-_]+$").unwrap();
}

fn validate_task_type(task_type: &str) -> Result<(), ValidationError> {
    const VALID_TYPES: &[&str] = &[
        "command", "http", "query", "deploy", "scale",
        "conditional", "loop", "subworkflow", "approval"
    ];

    if !VALID_TYPES.contains(&task_type) {
        return Err(ValidationError::new("invalid_task_type")
            .with_message(format!("Type must be one of: {}", VALID_TYPES.join(", ")).into()));
    }
    Ok(())
}

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct RetryPolicy {
    #[validate(range(min = 1, max = 10, message = "Max attempts must be 1-10"))]
    pub max_attempts: u32,

    #[validate(custom = "validate_backoff_strategy")]
    pub backoff_strategy: String,

    #[validate(range(min = 100, max = 60000, message = "Initial delay must be 100-60000ms"))]
    pub initial_delay_ms: u32,

    #[validate(range(min = 1000, max = 300000, message = "Max delay must be 1000-300000ms"))]
    pub max_delay_ms: u32,
}

fn validate_backoff_strategy(strategy: &str) -> Result<(), ValidationError> {
    const VALID_STRATEGIES: &[&str] = &["exponential", "linear", "constant"];

    if !VALID_STRATEGIES.contains(&strategy) {
        return Err(ValidationError::new("invalid_backoff_strategy")
            .with_message(format!("Strategy must be one of: {}", VALID_STRATEGIES.join(", ")).into()));
    }
    Ok(())
}

impl BusinessValidation for CreateWorkflowRequest {
    fn validate_business_rules(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Validate task dependencies form a DAG (no cycles)
        if let Err(e) = validate_dag(&self.tasks) {
            errors.add("tasks", e);
        }

        // Validate all dependency references exist
        let task_ids: Vec<&str> = self.tasks.iter().map(|t| t.id.as_str()).collect();
        for task in &self.tasks {
            if let Some(deps) = &task.depends_on {
                for dep in deps {
                    if !task_ids.contains(&dep.as_str()) {
                        errors.add(
                            format!("tasks[{}].depends_on", task.id),
                            format!("Dependency '{}' not found", dep),
                        );
                    }
                }
            }
        }

        // Validate unique task IDs
        let mut seen_ids = std::collections::HashSet::new();
        for task in &self.tasks {
            if !seen_ids.insert(&task.id) {
                errors.add("tasks", format!("Duplicate task ID: {}", task.id));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

fn validate_dag(tasks: &[WorkflowTask]) -> Result<(), String> {
    use std::collections::{HashMap, HashSet, VecDeque};

    let mut graph: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut in_degree: HashMap<&str, usize> = HashMap::new();

    // Build adjacency list and in-degree map
    for task in tasks {
        in_degree.entry(&task.id).or_insert(0);

        if let Some(deps) = &task.depends_on {
            for dep in deps {
                graph.entry(dep.as_str()).or_default().push(&task.id);
                *in_degree.entry(&task.id).or_insert(0) += 1;
            }
        }
    }

    // Kahn's algorithm for cycle detection
    let mut queue: VecDeque<&str> = in_degree
        .iter()
        .filter(|(_, &degree)| degree == 0)
        .map(|(&id, _)| id)
        .collect();

    let mut processed = 0;

    while let Some(node) = queue.pop_front() {
        processed += 1;

        if let Some(neighbors) = graph.get(node) {
            for &neighbor in neighbors {
                if let Some(degree) = in_degree.get_mut(neighbor) {
                    *degree -= 1;
                    if *degree == 0 {
                        queue.push_back(neighbor);
                    }
                }
            }
        }
    }

    if processed != tasks.len() {
        Err("Workflow contains circular dependencies".to_string())
    } else {
        Ok(())
    }
}

// ==================== QUERY VALIDATION ====================

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct MetricsQueryRequest {
    #[validate(
        length(min = 1, max = 5000, message = "Query must be 1-5000 characters"),
        custom = "validate_promql_safety"
    )]
    pub query: String,

    #[validate]
    pub time_range: Option<TimeRange>,

    #[validate(regex(
        path = "STEP_PATTERN",
        message = "Step must be in format: <number><unit> where unit is s/m/h/d"
    ))]
    pub step: Option<String>,

    pub natural_language: Option<bool>,
}

lazy_static::lazy_static! {
    static ref STEP_PATTERN: Regex = Regex::new(r"^\d+[smhd]$").unwrap();
    static ref DURATION_PATTERN: Regex = Regex::new(r"^\d+[mun]?s$").unwrap();
}

fn validate_promql_safety(query: &str) -> Result<(), ValidationError> {
    // Check for potentially dangerous operations
    if query.len() > 5000 {
        return Err(ValidationError::new("query_too_long"));
    }

    // Limit number of operators to prevent resource exhaustion
    let operator_count = query.matches(|c: char| c == '+' || c == '-' || c == '*' || c == '/').count();
    if operator_count > 50 {
        return Err(ValidationError::new("query_too_complex")
            .with_message("Query contains too many operators".into()));
    }

    Ok(())
}

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct LogsQueryRequest {
    #[validate(length(min = 1, max = 5000))]
    pub query: String,

    #[validate]
    pub time_range: Option<TimeRange>,

    #[validate(range(min = 1, max = 5000, message = "Limit must be 1-5000"))]
    pub limit: Option<u32>,

    #[validate(custom = "validate_direction")]
    pub direction: Option<String>,

    pub natural_language: Option<bool>,
}

fn validate_direction(direction: &str) -> Result<(), ValidationError> {
    const VALID_DIRECTIONS: &[&str] = &["forward", "backward"];

    if !VALID_DIRECTIONS.contains(&direction) {
        return Err(ValidationError::new("invalid_direction"));
    }
    Ok(())
}

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct TimeRange {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,

    #[validate(regex(
        path = "STEP_PATTERN",
        message = "Relative time must be in format: <number><unit>"
    ))]
    pub relative: Option<String>,
}

impl BusinessValidation for TimeRange {
    fn validate_business_rules(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();

        // Must have either absolute or relative time
        let has_absolute = self.start.is_some() && self.end.is_some();
        let has_relative = self.relative.is_some();

        if !has_absolute && !has_relative {
            errors.add("time_range", "Must specify either start/end or relative time");
        }

        if has_absolute && has_relative {
            errors.add("time_range", "Cannot specify both absolute and relative time");
        }

        // Validate absolute time range
        if let (Some(start), Some(end)) = (self.start, self.end) {
            if start >= end {
                errors.add("time_range", "Start time must be before end time");
            }

            let max_range = Duration::days(30);
            if end - start > max_range {
                errors.add("time_range", "Time range cannot exceed 30 days");
            }

            if start > Utc::now() {
                errors.add("time_range.start", "Start time cannot be in the future");
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// ==================== INCIDENT VALIDATION ====================

#[derive(Debug, Clone, Validate, Deserialize, Serialize)]
pub struct CreateIncidentRequest {
    #[validate(length(min = 1, max = 200, message = "Title must be 1-200 characters"))]
    pub title: String,

    #[validate(length(max = 5000, message = "Description too long"))]
    pub description: Option<String>,

    #[validate(custom = "validate_severity")]
    pub severity: String,

    #[validate(custom = "validate_services_list")]
    pub affected_services: Option<Vec<String>>,

    #[validate(custom = "validate_detected_by")]
    pub detected_by: Option<String>,

    pub alert_ids: Option<Vec<String>>,
}

fn validate_severity(severity: &str) -> Result<(), ValidationError> {
    const VALID_SEVERITIES: &[&str] = &["critical", "high", "medium", "low"];

    if !VALID_SEVERITIES.contains(&severity) {
        return Err(ValidationError::new("invalid_severity")
            .with_message(format!("Severity must be one of: {}", VALID_SEVERITIES.join(", ")).into()));
    }
    Ok(())
}

fn validate_services_list(services: &[String]) -> Result<(), ValidationError> {
    if services.len() > 50 {
        return Err(ValidationError::new("too_many_services")
            .with_message("Maximum 50 affected services allowed".into()));
    }

    for service in services {
        if service.len() > 100 {
            return Err(ValidationError::new("service_name_too_long")
                .with_message("Service name too long (max 100 characters)".into()));
        }
    }

    Ok(())
}

fn validate_detected_by(detected_by: &str) -> Result<(), ValidationError> {
    const VALID_VALUES: &[&str] = &["automated", "manual", "external"];

    if !VALID_VALUES.contains(&detected_by) {
        return Err(ValidationError::new("invalid_detected_by"));
    }
    Ok(())
}

// ==================== INPUT SANITIZATION ====================

/// Sanitize user input to prevent injection attacks
pub struct InputSanitizer;

impl InputSanitizer {
    /// Remove or escape potentially dangerous characters
    pub fn sanitize_string(input: &str) -> String {
        input
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#x27;")
            .replace('/', "&#x2F;")
    }

    /// Sanitize SQL-like input
    pub fn sanitize_sql_like(input: &str) -> String {
        input
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_")
    }

    /// Remove null bytes and control characters
    pub fn remove_control_chars(input: &str) -> String {
        input
            .chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
            .collect()
    }

    /// Truncate to maximum length safely (respecting UTF-8 boundaries)
    pub fn truncate(input: &str, max_len: usize) -> String {
        if input.len() <= max_len {
            input.to_string()
        } else {
            input
                .chars()
                .take(max_len)
                .collect()
        }
    }
}

// ==================== RATE LIMIT HEADERS ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub limit: u32,
    pub remaining: u32,
    pub reset: DateTime<Utc>,
}

impl RateLimitInfo {
    pub fn to_headers(&self) -> Vec<(String, String)> {
        vec![
            ("X-RateLimit-Limit".to_string(), self.limit.to_string()),
            ("X-RateLimit-Remaining".to_string(), self.remaining.to_string()),
            ("X-RateLimit-Reset".to_string(), self.reset.timestamp().to_string()),
        ]
    }
}

// ==================== VALIDATION MIDDLEWARE ====================

/// Validation middleware for Axum
pub mod middleware {
    use super::*;
    use axum::{
        body::Body,
        extract::Request,
        http::StatusCode,
        middleware::Next,
        response::{IntoResponse, Response},
        Json,
    };
    use serde_json::json;

    pub async fn validate_content_length(
        request: Request,
        next: Next,
    ) -> Result<Response, Response> {
        const MAX_CONTENT_LENGTH: u64 = 10 * 1024 * 1024; // 10MB

        if let Some(content_length) = request.headers().get("content-length") {
            if let Ok(length_str) = content_length.to_str() {
                if let Ok(length) = length_str.parse::<u64>() {
                    if length > MAX_CONTENT_LENGTH {
                        return Err((
                            StatusCode::PAYLOAD_TOO_LARGE,
                            Json(json!({
                                "error": {
                                    "code": "PAYLOAD_TOO_LARGE",
                                    "message": format!("Request body too large. Maximum size: {} bytes", MAX_CONTENT_LENGTH)
                                }
                            }))
                        ).into_response());
                    }
                }
            }
        }

        Ok(next.run(request).await)
    }

    pub async fn validate_content_type(
        request: Request,
        next: Next,
    ) -> Result<Response, Response> {
        if request.method() == "POST" || request.method() == "PUT" || request.method() == "PATCH" {
            if let Some(content_type) = request.headers().get("content-type") {
                let content_type = content_type.to_str().unwrap_or("");

                if !content_type.starts_with("application/json") {
                    return Err((
                        StatusCode::UNSUPPORTED_MEDIA_TYPE,
                        Json(json!({
                            "error": {
                                "code": "UNSUPPORTED_MEDIA_TYPE",
                                "message": "Content-Type must be application/json"
                            }
                        }))
                    ).into_response());
                }
            } else {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({
                        "error": {
                            "code": "MISSING_CONTENT_TYPE",
                            "message": "Content-Type header required"
                        }
                    }))
                ).into_response());
            }
        }

        Ok(next.run(request).await)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_name_validation() {
        let valid = CreateSessionRequest {
            name: Some("Production Session 2024".to_string()),
            metadata: None,
            preferences: None,
            timeout_minutes: Some(60),
        };
        assert!(valid.validate().is_ok());

        let invalid = CreateSessionRequest {
            name: Some("Invalid@Session!".to_string()),
            metadata: None,
            preferences: None,
            timeout_minutes: Some(60),
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_message_content_validation() {
        let valid = SendMessageRequest {
            content: "Show me CPU usage".to_string(),
            attachments: None,
            context_override: None,
        };
        assert!(valid.validate().is_ok());

        let invalid = SendMessageRequest {
            content: "   ".to_string(), // Only whitespace
            attachments: None,
            context_override: None,
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_workflow_dag_validation() {
        // Valid DAG
        let valid = CreateWorkflowRequest {
            name: "Test Workflow".to_string(),
            description: None,
            template: None,
            tasks: vec![
                WorkflowTask {
                    id: "task1".to_string(),
                    task_type: "command".to_string(),
                    name: None,
                    depends_on: None,
                    config: HashMap::new(),
                    retry_policy: None,
                    timeout_seconds: None,
                },
                WorkflowTask {
                    id: "task2".to_string(),
                    task_type: "command".to_string(),
                    name: None,
                    depends_on: Some(vec!["task1".to_string()]),
                    config: HashMap::new(),
                    retry_policy: None,
                    timeout_seconds: None,
                },
            ],
            auto_execute: None,
            approval_required: None,
            rollback_on_failure: None,
        };
        assert!(valid.validate_business_rules().is_ok());

        // Circular dependency
        let invalid = CreateWorkflowRequest {
            name: "Test Workflow".to_string(),
            description: None,
            template: None,
            tasks: vec![
                WorkflowTask {
                    id: "task1".to_string(),
                    task_type: "command".to_string(),
                    name: None,
                    depends_on: Some(vec!["task2".to_string()]),
                    config: HashMap::new(),
                    retry_policy: None,
                    timeout_seconds: None,
                },
                WorkflowTask {
                    id: "task2".to_string(),
                    task_type: "command".to_string(),
                    name: None,
                    depends_on: Some(vec!["task1".to_string()]),
                    config: HashMap::new(),
                    retry_policy: None,
                    timeout_seconds: None,
                },
            ],
            auto_execute: None,
            approval_required: None,
            rollback_on_failure: None,
        };
        assert!(invalid.validate_business_rules().is_err());
    }

    #[test]
    fn test_time_range_validation() {
        use chrono::Duration;

        // Valid relative time
        let valid = TimeRange {
            start: None,
            end: None,
            relative: Some("1h".to_string()),
        };
        assert!(valid.validate_business_rules().is_ok());

        // Invalid - both absolute and relative
        let invalid = TimeRange {
            start: Some(Utc::now() - Duration::hours(1)),
            end: Some(Utc::now()),
            relative: Some("1h".to_string()),
        };
        assert!(invalid.validate_business_rules().is_err());
    }

    #[test]
    fn test_input_sanitization() {
        assert_eq!(
            InputSanitizer::sanitize_string("<script>alert('xss')</script>"),
            "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
        );

        assert_eq!(
            InputSanitizer::sanitize_sql_like("test%value_"),
            "test\\%value\\_"
        );
    }
}
