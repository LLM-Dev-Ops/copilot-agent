# Input Validation and Sanitization Architecture

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-25

## Overview

This document defines comprehensive input validation and sanitization for LLM-CoPilot-Agent to prevent injection attacks (SQL, XSS, command injection), enforce data integrity, and protect against malicious inputs.

---

## Table of Contents

1. [Validation Framework](#validation-framework)
2. [SQL Injection Prevention](#sql-injection-prevention)
3. [XSS Prevention](#xss-prevention)
4. [Command Injection Prevention](#command-injection-prevention)
5. [Content Security Policy](#content-security-policy)
6. [Rate Limiting](#rate-limiting)
7. [Rust Implementation](#rust-implementation)

---

## Validation Framework

### Validator Trait

```rust
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ValidationError {
    #[error("Field '{field}' is required")]
    Required { field: String },

    #[error("Field '{field}' exceeds maximum length {max}")]
    MaxLength { field: String, max: usize },

    #[error("Field '{field}' is below minimum length {min}")]
    MinLength { field: String, min: usize },

    #[error("Field '{field}' does not match pattern")]
    Pattern { field: String },

    #[error("Field '{field}' contains invalid characters")]
    InvalidCharacters { field: String },

    #[error("Field '{field}' has invalid format: {reason}")]
    InvalidFormat { field: String, reason: String },

    #[error("Field '{field}' is out of range: {reason}")]
    OutOfRange { field: String, reason: String },

    #[error("Multiple validation errors: {0:?}")]
    Multiple(Vec<ValidationError>),
}

pub type ValidationResult<T> = Result<T, ValidationError>;

pub trait Validator {
    fn validate(&self) -> ValidationResult<()>;
}

/// Validation builder for common patterns
pub struct ValidatorBuilder {
    errors: Vec<ValidationError>,
}

impl ValidatorBuilder {
    pub fn new() -> Self {
        Self {
            errors: Vec::new(),
        }
    }

    /// Validate required field
    pub fn required<T>(&mut self, field: &str, value: &Option<T>) -> &mut Self {
        if value.is_none() {
            self.errors.push(ValidationError::Required {
                field: field.to_string(),
            });
        }
        self
    }

    /// Validate string length
    pub fn length(
        &mut self,
        field: &str,
        value: &str,
        min: Option<usize>,
        max: Option<usize>,
    ) -> &mut Self {
        if let Some(min_len) = min {
            if value.len() < min_len {
                self.errors.push(ValidationError::MinLength {
                    field: field.to_string(),
                    min: min_len,
                });
            }
        }

        if let Some(max_len) = max {
            if value.len() > max_len {
                self.errors.push(ValidationError::MaxLength {
                    field: field.to_string(),
                    max: max_len,
                });
            }
        }

        self
    }

    /// Validate regex pattern
    pub fn pattern(&mut self, field: &str, value: &str, pattern: &regex::Regex) -> &mut Self {
        if !pattern.is_match(value) {
            self.errors.push(ValidationError::Pattern {
                field: field.to_string(),
            });
        }
        self
    }

    /// Validate alphanumeric only
    pub fn alphanumeric(&mut self, field: &str, value: &str) -> &mut Self {
        if !value.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
            self.errors.push(ValidationError::InvalidCharacters {
                field: field.to_string(),
            });
        }
        self
    }

    /// Validate email format
    pub fn email(&mut self, field: &str, value: &str) -> &mut Self {
        let email_regex = regex::Regex::new(
            r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        ).unwrap();

        if !email_regex.is_match(value) {
            self.errors.push(ValidationError::InvalidFormat {
                field: field.to_string(),
                reason: "Invalid email format".to_string(),
            });
        }
        self
    }

    /// Validate URL format
    pub fn url(&mut self, field: &str, value: &str) -> &mut Self {
        if url::Url::parse(value).is_err() {
            self.errors.push(ValidationError::InvalidFormat {
                field: field.to_string(),
                reason: "Invalid URL format".to_string(),
            });
        }
        self
    }

    /// Validate numeric range
    pub fn range<T: PartialOrd + std::fmt::Display>(
        &mut self,
        field: &str,
        value: T,
        min: Option<T>,
        max: Option<T>,
    ) -> &mut Self {
        if let Some(min_val) = min {
            if value < min_val {
                self.errors.push(ValidationError::OutOfRange {
                    field: field.to_string(),
                    reason: format!("Value must be >= {}", min_val),
                });
            }
        }

        if let Some(max_val) = max {
            if value > max_val {
                self.errors.push(ValidationError::OutOfRange {
                    field: field.to_string(),
                    reason: format!("Value must be <= {}", max_val),
                });
            }
        }

        self
    }

    /// Finalize validation
    pub fn build(self) -> ValidationResult<()> {
        if self.errors.is_empty() {
            Ok(())
        } else if self.errors.len() == 1 {
            Err(self.errors.into_iter().next().unwrap())
        } else {
            Err(ValidationError::Multiple(self.errors))
        }
    }
}
```

### Example Request Validation

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateWorkflowRequest {
    pub name: String,
    pub description: Option<String>,
    pub environment: String,
    pub tasks: Vec<TaskDefinition>,
}

impl Validator for CreateWorkflowRequest {
    fn validate(&self) -> ValidationResult<()> {
        let mut validator = ValidatorBuilder::new();

        // Validate name
        validator
            .length("name", &self.name, Some(3), Some(100))
            .alphanumeric("name", &self.name);

        // Validate description
        if let Some(desc) = &self.description {
            validator.length("description", desc, None, Some(500));
        }

        // Validate environment
        let valid_envs = ["development", "staging", "production"];
        if !valid_envs.contains(&self.environment.as_str()) {
            validator.errors.push(ValidationError::InvalidFormat {
                field: "environment".to_string(),
                reason: "Must be one of: development, staging, production".to_string(),
            });
        }

        // Validate tasks
        validator.range("tasks", self.tasks.len(), Some(1), Some(100));

        for (i, task) in self.tasks.iter().enumerate() {
            if let Err(e) = task.validate() {
                validator.errors.push(ValidationError::InvalidFormat {
                    field: format!("tasks[{}]", i),
                    reason: e.to_string(),
                });
            }
        }

        validator.build()
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TaskDefinition {
    pub name: String,
    pub task_type: String,
    pub command: Option<String>,
}

impl Validator for TaskDefinition {
    fn validate(&self) -> ValidationResult<()> {
        let mut validator = ValidatorBuilder::new();

        validator
            .length("name", &self.name, Some(1), Some(100))
            .alphanumeric("name", &self.name);

        let valid_types = ["command", "http", "query", "deploy"];
        if !valid_types.contains(&self.task_type.as_str()) {
            validator.errors.push(ValidationError::InvalidFormat {
                field: "task_type".to_string(),
                reason: "Invalid task type".to_string(),
            });
        }

        validator.build()
    }
}
```

### Validation Middleware

```rust
use axum::{
    extract::{Json, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

pub async fn validation_middleware<T>(
    Json(payload): Json<T>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode>
where
    T: Validator + DeserializeOwned + 'static,
{
    // Validate the payload
    payload.validate().map_err(|e| {
        tracing::warn!("Validation failed: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Attach validated payload to request
    let mut request = request;
    request.extensions_mut().insert(payload);

    Ok(next.run(request).await)
}
```

---

## SQL Injection Prevention

### Parameterized Queries (SQLx)

```rust
use sqlx::{PgPool, FromRow};

#[derive(Debug, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
}

pub struct UserRepository {
    pool: PgPool,
}

impl UserRepository {
    /// SAFE: Uses parameterized query
    pub async fn get_user_by_email(
        &self,
        email: &str,
    ) -> Result<Option<User>, sqlx::Error> {
        sqlx::query_as::<_, User>(
            "SELECT id, email, name FROM users WHERE email = $1"
        )
        .bind(email)  // Parameterized - prevents SQL injection
        .fetch_optional(&self.pool)
        .await
    }

    /// UNSAFE: String concatenation (DO NOT USE)
    /// This is an example of what NOT to do
    #[allow(dead_code)]
    async fn unsafe_get_user(
        &self,
        email: &str,
    ) -> Result<Option<User>, sqlx::Error> {
        // VULNERABLE TO SQL INJECTION - NEVER DO THIS
        let query = format!("SELECT * FROM users WHERE email = '{}'", email);
        sqlx::query_as::<_, User>(&query)
            .fetch_optional(&self.pool)
            .await
    }

    /// SAFE: Complex query with multiple parameters
    pub async fn search_users(
        &self,
        name_pattern: &str,
        min_created_at: chrono::DateTime<chrono::Utc>,
        limit: i64,
    ) -> Result<Vec<User>, sqlx::Error> {
        sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, name
            FROM users
            WHERE name ILIKE $1
              AND created_at >= $2
            ORDER BY created_at DESC
            LIMIT $3
            "#
        )
        .bind(format!("%{}%", name_pattern))  // Pattern matching with param
        .bind(min_created_at)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }
}
```

### Query Builder Pattern

```rust
pub struct QueryBuilder {
    base_query: String,
    conditions: Vec<String>,
    params: Vec<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

impl QueryBuilder {
    pub fn new(table: &str, columns: &[&str]) -> Self {
        let cols = columns.join(", ");
        Self {
            base_query: format!("SELECT {} FROM {}", cols, table),
            conditions: Vec::new(),
            params: Vec::new(),
            limit: None,
            offset: None,
        }
    }

    pub fn where_eq(&mut self, column: &str, value: String) -> &mut Self {
        let param_num = self.params.len() + 1;
        self.conditions.push(format!("{} = ${}", column, param_num));
        self.params.push(value);
        self
    }

    pub fn where_like(&mut self, column: &str, pattern: String) -> &mut Self {
        let param_num = self.params.len() + 1;
        self.conditions.push(format!("{} LIKE ${}", column, param_num));
        self.params.push(format!("%{}%", pattern));
        self
    }

    pub fn limit(&mut self, limit: i64) -> &mut Self {
        self.limit = Some(limit);
        self
    }

    pub fn build(&self) -> (String, Vec<String>) {
        let mut query = self.base_query.clone();

        if !self.conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&self.conditions.join(" AND "));
        }

        if let Some(limit) = self.limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }

        (query, self.params.clone())
    }
}
```

---

## XSS Prevention

### HTML Sanitization

```rust
use ammonia::clean;

pub struct HtmlSanitizer;

impl HtmlSanitizer {
    /// Sanitize HTML to prevent XSS
    pub fn sanitize(html: &str) -> String {
        clean(html)
    }

    /// Sanitize with custom allowed tags
    pub fn sanitize_with_allowed_tags(html: &str, allowed_tags: &[&str]) -> String {
        ammonia::Builder::new()
            .tags(allowed_tags.iter().copied().collect())
            .clean(html)
            .to_string()
    }

    /// Strip all HTML tags
    pub fn strip_all_tags(html: &str) -> String {
        ammonia::Builder::new()
            .tags(std::collections::HashSet::new())
            .clean(html)
            .to_string()
    }

    /// Escape HTML entities
    pub fn escape_html(text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#x27;")
            .replace('/', "&#x2F;")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xss_prevention() {
        let malicious = r#"<script>alert('XSS')</script><p>Safe content</p>"#;
        let sanitized = HtmlSanitizer::sanitize(malicious);

        assert!(!sanitized.contains("<script"));
        assert!(sanitized.contains("<p>"));
    }

    #[test]
    fn test_escape_html() {
        let text = r#"<script>alert("XSS")</script>"#;
        let escaped = HtmlSanitizer::escape_html(text);

        assert_eq!(escaped, "&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;");
    }
}
```

### JSON Response Sanitization

```rust
use serde_json::Value;

pub struct JsonSanitizer;

impl JsonSanitizer {
    /// Sanitize string values in JSON
    pub fn sanitize_json(value: &mut Value) {
        match value {
            Value::String(s) => {
                *s = HtmlSanitizer::escape_html(s);
            }
            Value::Array(arr) => {
                for item in arr {
                    Self::sanitize_json(item);
                }
            }
            Value::Object(map) => {
                for (_, v) in map {
                    Self::sanitize_json(v);
                }
            }
            _ => {}
        }
    }

    /// Remove potentially dangerous fields from JSON
    pub fn remove_dangerous_fields(value: &mut Value) {
        if let Value::Object(map) = value {
            let dangerous_keys = vec![
                "__proto__",
                "constructor",
                "prototype",
            ];

            for key in dangerous_keys {
                map.remove(key);
            }

            for (_, v) in map {
                Self::remove_dangerous_fields(v);
            }
        }
    }
}
```

---

## Command Injection Prevention

### Safe Command Execution

```rust
use std::process::Command;
use std::ffi::OsStr;

pub struct CommandExecutor;

impl CommandExecutor {
    /// SAFE: Execute command with validated arguments
    pub fn execute_safe<I, S>(
        program: &str,
        args: I,
    ) -> Result<std::process::Output, std::io::Error>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        // Validate program is in allowlist
        let allowed_programs = vec![
            "/usr/bin/kubectl",
            "/usr/bin/docker",
            "/usr/bin/git",
        ];

        if !allowed_programs.contains(&program) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "Program not in allowlist",
            ));
        }

        // Execute with separate arguments (not shell interpolation)
        Command::new(program)
            .args(args)
            .output()
    }

    /// UNSAFE: Shell execution (DO NOT USE)
    #[allow(dead_code)]
    fn unsafe_execute(command: &str) -> Result<std::process::Output, std::io::Error> {
        // VULNERABLE TO COMMAND INJECTION - NEVER DO THIS
        Command::new("sh")
            .arg("-c")
            .arg(command)  // User input could be: "ls; rm -rf /"
            .output()
    }

    /// Validate command arguments
    pub fn validate_arg(arg: &str) -> Result<(), ValidationError> {
        // No shell metacharacters allowed
        let dangerous_chars = ['|', ';', '&', '$', '`', '\n', '(', ')', '<', '>', '\\'];

        if arg.chars().any(|c| dangerous_chars.contains(&c)) {
            return Err(ValidationError::InvalidCharacters {
                field: "command_argument".to_string(),
            });
        }

        Ok(())
    }
}

/// Workflow task executor with command validation
pub struct WorkflowExecutor;

impl WorkflowExecutor {
    pub async fn execute_command_task(
        &self,
        task: &CommandTask,
    ) -> Result<TaskOutput, TaskError> {
        // Validate all arguments
        for arg in &task.args {
            CommandExecutor::validate_arg(arg)
                .map_err(|e| TaskError::ValidationError(e.to_string()))?;
        }

        // Execute with validated arguments
        let output = CommandExecutor::execute_safe(&task.program, &task.args)
            .map_err(|e| TaskError::ExecutionError(e.to_string()))?;

        Ok(TaskOutput {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
        })
    }
}

#[derive(Debug)]
pub struct CommandTask {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug)]
pub struct TaskOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Debug, thiserror::Error)]
pub enum TaskError {
    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),
}
```

---

## Content Security Policy

### CSP Header Configuration

```rust
pub struct ContentSecurityPolicy {
    directives: Vec<(String, Vec<String>)>,
}

impl ContentSecurityPolicy {
    pub fn new() -> Self {
        Self {
            directives: Vec::new(),
        }
    }

    pub fn default_policy() -> Self {
        let mut csp = Self::new();

        csp.add_directive("default-src", vec!["'self'".to_string()])
            .add_directive("script-src", vec![
                "'self'".to_string(),
                "'unsafe-inline'".to_string(),  // Required for some frameworks
            ])
            .add_directive("style-src", vec![
                "'self'".to_string(),
                "'unsafe-inline'".to_string(),
            ])
            .add_directive("img-src", vec![
                "'self'".to_string(),
                "data:".to_string(),
                "https:".to_string(),
            ])
            .add_directive("font-src", vec![
                "'self'".to_string(),
                "data:".to_string(),
            ])
            .add_directive("connect-src", vec![
                "'self'".to_string(),
                "wss:".to_string(),
                "https:".to_string(),
            ])
            .add_directive("frame-ancestors", vec!["'none'".to_string()])
            .add_directive("base-uri", vec!["'self'".to_string()])
            .add_directive("form-action", vec!["'self'".to_string()])
            .add_directive("upgrade-insecure-requests", vec![]);

        csp
    }

    pub fn add_directive(&mut self, name: &str, values: Vec<String>) -> &mut Self {
        self.directives.push((name.to_string(), values));
        self
    }

    pub fn to_header_value(&self) -> String {
        self.directives
            .iter()
            .map(|(name, values)| {
                if values.is_empty() {
                    name.clone()
                } else {
                    format!("{} {}", name, values.join(" "))
                }
            })
            .collect::<Vec<_>>()
            .join("; ")
    }
}

/// CSP Middleware
pub async fn csp_middleware(
    mut response: axum::response::Response,
) -> axum::response::Response {
    let csp = ContentSecurityPolicy::default_policy();

    response.headers_mut().insert(
        "Content-Security-Policy",
        csp.to_header_value().parse().unwrap(),
    );

    response
}
```

---

## Rate Limiting

### Token Bucket Rate Limiter

```rust
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use std::collections::HashMap;

pub struct RateLimiter {
    buckets: Arc<Mutex<HashMap<String, TokenBucket>>>,
    config: RateLimitConfig,
}

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub burst_size: u32,
}

#[derive(Debug)]
struct TokenBucket {
    tokens: f64,
    last_refill: Instant,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            buckets: Arc::new(Mutex::new(HashMap::new())),
            config,
        }
    }

    /// Check if request is allowed for given key (user ID, IP, etc.)
    pub async fn check_rate_limit(&self, key: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let mut buckets = self.buckets.lock().await;

        let bucket = buckets.entry(key.to_string()).or_insert_with(|| TokenBucket {
            tokens: self.config.burst_size as f64,
            last_refill: Instant::now(),
        });

        // Refill tokens based on time elapsed
        let now = Instant::now();
        let elapsed = now.duration_since(bucket.last_refill).as_secs_f64();
        let refill_rate = self.config.requests_per_minute as f64 / 60.0;
        let new_tokens = elapsed * refill_rate;

        bucket.tokens = (bucket.tokens + new_tokens).min(self.config.burst_size as f64);
        bucket.last_refill = now;

        // Check if we have tokens
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Check API key rate limit
    pub async fn check_api_key_rate_limit(
        &self,
        key_id: &str,
        limit: u32,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let custom_config = RateLimitConfig {
            requests_per_minute: limit,
            burst_size: limit / 2,
        };

        let limiter = RateLimiter::new(custom_config);
        limiter.check_rate_limit(key_id).await
    }
}

/// Rate limiting middleware
pub async fn rate_limit_middleware(
    State(rate_limiter): State<Arc<RateLimiter>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract identifier (IP address or user ID)
    let identifier = extract_identifier(&request);

    // Check rate limit
    let allowed = rate_limiter
        .check_rate_limit(&identifier)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !allowed {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(request).await)
}

fn extract_identifier(request: &Request) -> String {
    // Try to get user ID from extensions (set by auth middleware)
    if let Some(context) = request.extensions().get::<AuthorizationContext>() {
        return context.user_id.clone();
    }

    // Fallback to IP address
    if let Some(addr) = request
        .headers()
        .get("X-Forwarded-For")
        .and_then(|h| h.to_str().ok())
    {
        return addr.split(',').next().unwrap_or("unknown").trim().to_string();
    }

    "unknown".to_string()
}
```

### Distributed Rate Limiting (Redis)

```rust
use redis::AsyncCommands;

pub struct RedisRateLimiter {
    client: redis::Client,
    config: RateLimitConfig,
}

impl RedisRateLimiter {
    pub fn new(redis_url: &str, config: RateLimitConfig) -> Result<Self, redis::RedisError> {
        Ok(Self {
            client: redis::Client::open(redis_url)?,
            config,
        })
    }

    pub async fn check_rate_limit(&self, key: &str) -> Result<bool, redis::RedisError> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let rate_key = format!("rate_limit:{}", key);
        let window_start = chrono::Utc::now().timestamp() / 60; // 1-minute windows

        let window_key = format!("{}:{}", rate_key, window_start);

        // Increment counter
        let count: u32 = conn.incr(&window_key, 1).await?;

        // Set expiration on first increment
        if count == 1 {
            conn.expire(&window_key, 120).await?; // 2 minutes TTL
        }

        // Check if under limit
        Ok(count <= self.config.requests_per_minute)
    }
}
```

---

## Summary

This input validation and sanitization architecture provides:

1. **Comprehensive Validation**: Builder pattern for flexible validation rules
2. **SQL Injection Prevention**: Parameterized queries and query builders
3. **XSS Prevention**: HTML/JSON sanitization and escaping
4. **Command Injection Prevention**: Allowlisting and argument validation
5. **Content Security Policy**: Configurable CSP headers
6. **Rate Limiting**: Token bucket and Redis-based distributed rate limiting

---

**Next Document:** [05-audit-compliance-architecture.md](./05-audit-compliance-architecture.md)
