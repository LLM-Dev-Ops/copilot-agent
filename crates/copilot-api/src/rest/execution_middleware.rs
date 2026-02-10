//! Execution context middleware for Agentics ExecutionGraph integration.
//!
//! This middleware enforces the Foundational Execution Unit contract:
//! - Extracts execution_id and parent_span_id from request headers
//! - Rejects requests without parent_span_id (Rule 1)
//! - Creates a repo-level execution span on entry (Rule 2)
//! - Makes the ExecutionGraph available to handlers via request extensions
//! - Validates the graph on response (at least one agent span must exist)

use crate::error::ApiError;
use axum::{
    body::Body,
    extract::Request,
    http::header::HeaderMap,
    middleware::Next,
    response::{IntoResponse, Response},
};
use copilot_core::agents::execution_graph::ExecutionGraph;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, warn};
use uuid::Uuid;

/// Type alias for the shared execution graph stored in request extensions.
pub type SharedExecutionGraph = Arc<Mutex<ExecutionGraph>>;

/// Header name for the execution ID provided by the Core.
pub const HEADER_EXECUTION_ID: &str = "x-execution-id";
/// Header name for the parent span ID provided by the Core.
pub const HEADER_PARENT_SPAN_ID: &str = "x-parent-span-id";

/// Execution context middleware.
///
/// Extracts execution context headers, creates a repo-level span,
/// and makes the ExecutionGraph available to downstream handlers.
///
/// Rejects with 400 BAD_REQUEST if X-Parent-Span-Id is missing.
pub async fn execution_context_middleware(
    req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let headers = req.headers();

    // Extract parent_span_id (REQUIRED)
    let parent_span_id = extract_header(headers, HEADER_PARENT_SPAN_ID)
        .ok_or_else(|| {
            warn!("Request rejected: missing X-Parent-Span-Id header");
            ApiError::ExecutionContextError(
                "X-Parent-Span-Id header is required for execution tracking".to_string(),
            )
        })?;

    // Extract execution_id (optional, generate if missing)
    let execution_id = extract_header(headers, HEADER_EXECUTION_ID)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Extract trace_id from traceparent or x-trace-id, or generate
    let trace_id = extract_trace_id(headers)
        .unwrap_or_else(|| Uuid::new_v4().to_string().replace('-', ""));

    debug!(
        execution_id = %execution_id,
        parent_span_id = %parent_span_id,
        "Creating execution graph for request"
    );

    // Create the execution graph with a repo-level span
    let graph = ExecutionGraph::new(&execution_id, &parent_span_id, &trace_id)
        .map_err(|e| ApiError::ExecutionContextError(e.to_string()))?;

    let shared_graph: SharedExecutionGraph = Arc::new(Mutex::new(graph));

    // Store in request extensions for handlers to access
    let mut req = req;
    req.extensions_mut().insert(shared_graph.clone());

    // Run the handler
    let response = next.run(req).await;

    // After handler: finalize the graph
    let mut graph = shared_graph.lock().await;

    if response.status().is_success() {
        // Try to complete the repo span (validates agent spans exist)
        if let Err(e) = graph.complete_repo() {
            debug!("Execution graph validation: {}", e);
            // If no agent spans, mark as failed but still return the response
            graph.fail_repo(format!("Execution validation failed: {}", e));
        }
    } else {
        // Handler returned an error - mark repo as failed
        graph.fail_repo(format!("Handler returned status {}", response.status()));
    }

    Ok(response)
}

/// Extract a string header value.
fn extract_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

/// Extract trace ID from W3C traceparent header or x-trace-id.
fn extract_trace_id(headers: &HeaderMap) -> Option<String> {
    // Try traceparent first (format: version-trace_id-parent_id-flags)
    if let Some(traceparent) = extract_header(headers, "traceparent") {
        let parts: Vec<&str> = traceparent.split('-').collect();
        if parts.len() >= 4 {
            return Some(parts[1].to_string());
        }
    }

    // Fall back to x-trace-id
    extract_header(headers, "x-trace-id")
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn test_extract_header() {
        let mut headers = HeaderMap::new();
        headers.insert("x-parent-span-id", HeaderValue::from_static("span-123"));

        assert_eq!(
            extract_header(&headers, "x-parent-span-id"),
            Some("span-123".to_string())
        );
        assert_eq!(extract_header(&headers, "x-missing"), None);
    }

    #[test]
    fn test_extract_header_empty() {
        let mut headers = HeaderMap::new();
        headers.insert("x-parent-span-id", HeaderValue::from_static(""));

        assert_eq!(extract_header(&headers, "x-parent-span-id"), None);
    }

    #[test]
    fn test_extract_trace_id_from_traceparent() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "traceparent",
            HeaderValue::from_static("00-abcdef1234567890abcdef1234567890-1234567890abcdef-01"),
        );

        assert_eq!(
            extract_trace_id(&headers),
            Some("abcdef1234567890abcdef1234567890".to_string())
        );
    }

    #[test]
    fn test_extract_trace_id_from_header() {
        let mut headers = HeaderMap::new();
        headers.insert("x-trace-id", HeaderValue::from_static("trace-abc"));

        assert_eq!(
            extract_trace_id(&headers),
            Some("trace-abc".to_string())
        );
    }

    #[test]
    fn test_extract_trace_id_none() {
        let headers = HeaderMap::new();
        assert_eq!(extract_trace_id(&headers), None);
    }
}
