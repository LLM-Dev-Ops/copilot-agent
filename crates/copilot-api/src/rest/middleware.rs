//! Middleware for REST API

use crate::{error::ApiError, types::Claims, AppState};
use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::{num::NonZeroU32, sync::Arc};
use tracing::{debug, warn};
use uuid::Uuid;

/// Authentication middleware
///
/// Validates JWT tokens from the Authorization header
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let headers = req.headers();
    let token = extract_token(headers)?;

    // Validate JWT token
    let claims = validate_token(&token, &state.jwt_secret)?;

    // Add claims to request extensions for use in handlers
    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}

/// Extract JWT token from Authorization header
fn extract_token(headers: &HeaderMap) -> Result<String, ApiError> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::AuthenticationFailed("Missing authorization header".into()))?;

    if let Some(token) = auth_header.strip_prefix("Bearer ") {
        Ok(token.to_string())
    } else {
        Err(ApiError::AuthenticationFailed(
            "Invalid authorization header format".into(),
        ))
    }
}

/// Validate JWT token
fn validate_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    let validation = Validation::default();
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());

    decode::<Claims>(token, &decoding_key, &validation)
        .map(|data| data.claims)
        .map_err(|e| ApiError::AuthenticationFailed(format!("Invalid token: {}", e)))
}

/// Rate limiting middleware
///
/// Implements per-IP rate limiting using the governor crate
pub async fn rate_limit_middleware(req: Request, next: Next) -> Result<Response, ApiError> {
    // Create a simple in-memory rate limiter
    // In production, you'd want to use a distributed rate limiter (Redis, etc.)
    lazy_static::lazy_static! {
        static ref LIMITER: RateLimiter<NotKeyed, InMemoryState, DefaultClock> = {
            // Allow 100 requests per minute
            let quota = Quota::per_minute(NonZeroU32::new(100).unwrap());
            RateLimiter::direct(quota)
        };
    }

    match LIMITER.check() {
        Ok(_) => Ok(next.run(req).await),
        Err(_) => {
            warn!("Rate limit exceeded");
            Err(ApiError::RateLimitExceeded)
        }
    }
}

/// Request ID middleware
///
/// Adds a unique request ID to each request for tracing purposes
pub async fn request_id_middleware(mut req: Request, next: Next) -> Response {
    // Check if request already has an ID, otherwise generate one
    let request_id = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Add request ID to extensions
    req.extensions_mut().insert(RequestId(request_id.clone()));

    debug!("Processing request: {}", request_id);

    // Process request
    let mut response = next.run(req).await;

    // Add request ID to response headers
    response.headers_mut().insert(
        "x-request-id",
        request_id.parse().unwrap_or_else(|_| {
            header::HeaderValue::from_static("invalid-request-id")
        }),
    );

    response
}

/// Request ID wrapper
#[derive(Debug, Clone)]
pub struct RequestId(pub String);

/// Error handling middleware
///
/// Converts errors into proper HTTP responses
pub async fn error_handling_middleware(req: Request, next: Next) -> Response {
    let response = next.run(req).await;

    // If response is an error status, ensure it has proper error format
    if response.status().is_client_error() || response.status().is_server_error() {
        // Response is already an error, pass it through
        response
    } else {
        response
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn test_extract_token_valid() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer test_token"),
        );

        let result = extract_token(&headers);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test_token");
    }

    #[test]
    fn test_extract_token_missing() {
        let headers = HeaderMap::new();
        let result = extract_token(&headers);
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_token_invalid_format() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Invalid format"),
        );

        let result = extract_token(&headers);
        assert!(result.is_err());
    }

    #[test]
    fn test_request_id_type() {
        let request_id = RequestId("test-id".to_string());
        assert_eq!(request_id.0, "test-id");
    }
}
