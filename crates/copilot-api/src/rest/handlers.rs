//! Request handlers for REST API endpoints

use crate::{
    error::{ApiError, Result},
    rest::execution_middleware::SharedExecutionGraph,
    types::*,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension,
    Json,
};
use chrono::Utc;
use copilot_core::agents::execution_graph::Artifact;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, info};
use uuid::Uuid;

/// Health check handler
pub async fn health_check() -> Result<Json<HealthResponse>> {
    debug!("Health check requested");
    Ok(Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime: 0, // TODO: Track actual uptime
    }))
}

/// Readiness check handler
pub async fn readiness_check(State(state): State<Arc<AppState>>) -> Result<Json<HealthResponse>> {
    debug!("Readiness check requested");

    // TODO: Check if dependencies are ready (database, external services, etc.)

    Ok(Json(HealthResponse {
        status: "ready".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime: 0,
    }))
}

/// Create a new session
pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<ApiResponse<SessionResponse>>)> {
    info!("Creating new session: {:?}", req.name);

    let session_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // TODO: Actually create session using conversation manager
    // For now, return a mock response
    let response = SessionResponse {
        id: session_id.clone(),
        name: req.name,
        created_at: now,
        last_activity: now,
        metadata: req.metadata,
    };

    info!("Session created: {}", session_id);
    Ok((StatusCode::CREATED, Json(ApiResponse::success(response))))
}

/// Get session by ID
pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<SessionResponse>>> {
    debug!("Getting session: {}", id);

    // TODO: Fetch session from conversation manager
    // For now, return a mock response
    let now = Utc::now();
    let response = SessionResponse {
        id: id.clone(),
        name: Some("Example Session".to_string()),
        created_at: now,
        last_activity: now,
        metadata: serde_json::json!({}),
    };

    Ok(Json(ApiResponse::success(response)))
}

/// Delete session by ID
pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    info!("Deleting session: {}", id);

    // TODO: Delete session using conversation manager

    Ok(StatusCode::NO_CONTENT)
}

/// Send a message
pub async fn send_message(
    State(state): State<Arc<AppState>>,
    graph: Option<Extension<SharedExecutionGraph>>,
    Json(req): Json<SendMessageRequest>,
) -> Result<(StatusCode, Json<ApiResponse<MessageResponse>>)> {
    info!(
        "Sending message to session {}: {} characters",
        req.session_id,
        req.content.len()
    );

    let message_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Track agent-level spans for processing engines
    if let Some(Extension(ref graph)) = graph {
        let mut g = graph.lock().await;

        // NLP processing agent span
        let nlp_span = g.start_agent_span("nlp-engine");
        // TODO: actual NLP processing via state.engine
        g.complete_agent_span(
            &nlp_span,
            vec![Artifact::new(
                "nlp_result",
                "intent_classification",
                &message_id,
                serde_json::json!({"intent": "query", "confidence": 0.9}),
            )],
        )
        .ok();

        // Conversation processing agent span
        let conv_span = g.start_agent_span("conversation-manager");
        // TODO: actual conversation processing via state.conversation_manager
        g.complete_agent_span(
            &conv_span,
            vec![Artifact::new(
                "conversation_result",
                "message_response",
                &message_id,
                serde_json::json!({"session_id": &req.session_id}),
            )],
        )
        .ok();
    }

    let response = MessageResponse {
        id: message_id.clone(),
        session_id: req.session_id.clone(),
        role: req.role,
        content: req.content,
        created_at: now,
        metadata: req.metadata,
    };

    // Attach execution graph to the response if available
    let mut api_response = ApiResponse::success(response);
    if let Some(Extension(ref graph)) = graph {
        let g = graph.lock().await;
        if let Ok(json) = g.to_json() {
            api_response = api_response.with_execution_graph(json);
        }
    }

    info!("Message sent: {}", message_id);
    Ok((StatusCode::CREATED, Json(api_response)))
}

/// Query parameters for getting messages
#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    /// Maximum number of messages to return
    #[serde(default = "default_limit")]
    pub limit: usize,
    /// Cursor for pagination
    pub cursor: Option<String>,
}

fn default_limit() -> usize {
    50
}

/// Get messages for a session
pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Query(query): Query<GetMessagesQuery>,
) -> Result<Json<ApiResponse<GetMessagesResponse>>> {
    debug!(
        "Getting messages for session {}: limit={}, cursor={:?}",
        session_id, query.limit, query.cursor
    );

    // TODO: Fetch messages from conversation manager
    // For now, return a mock response
    let response = GetMessagesResponse {
        messages: vec![],
        total: 0,
        next_cursor: None,
    };

    Ok(Json(ApiResponse::success(response)))
}

/// Create a new workflow
pub async fn create_workflow(
    State(state): State<Arc<AppState>>,
    graph: Option<Extension<SharedExecutionGraph>>,
    Json(req): Json<CreateWorkflowRequest>,
) -> Result<(StatusCode, Json<ApiResponse<WorkflowResponse>>)> {
    info!("Creating workflow: {}", req.name);

    let workflow_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Track workflow agent span
    if let Some(Extension(ref graph)) = graph {
        let mut g = graph.lock().await;
        let span_id = g.start_agent_span("workflow-engine");
        // TODO: actual workflow execution via state.engine
        g.complete_agent_span(
            &span_id,
            vec![Artifact::new(
                "workflow_definition",
                "workflow",
                &workflow_id,
                serde_json::json!({"name": &req.name, "steps": req.definition.steps.len()}),
            )],
        )
        .ok();
    }

    let response = WorkflowResponse {
        id: workflow_id.clone(),
        name: req.name,
        status: WorkflowStatus::Pending,
        created_at: now,
        updated_at: now,
        result: None,
        error: None,
    };

    // Attach execution graph to the response if available
    let mut api_response = ApiResponse::success(response);
    if let Some(Extension(ref graph)) = graph {
        let g = graph.lock().await;
        if let Ok(json) = g.to_json() {
            api_response = api_response.with_execution_graph(json);
        }
    }

    info!("Workflow created: {}", workflow_id);
    Ok((StatusCode::CREATED, Json(api_response)))
}

/// Get workflow status
pub async fn get_workflow_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<WorkflowResponse>>> {
    debug!("Getting workflow status: {}", id);

    // TODO: Fetch workflow status from CoPilot engine
    // For now, return a mock response
    let now = Utc::now();
    let response = WorkflowResponse {
        id: id.clone(),
        name: "Example Workflow".to_string(),
        status: WorkflowStatus::Running,
        created_at: now,
        updated_at: now,
        result: None,
        error: None,
    };

    Ok(Json(ApiResponse::success(response)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let result = health_check().await;
        assert!(result.is_ok());
        let health = result.unwrap().0;
        assert_eq!(health.status, "healthy");
    }

    #[test]
    fn test_default_limit() {
        assert_eq!(default_limit(), 50);
    }

    #[test]
    fn test_get_messages_query_deserialization() {
        let query: GetMessagesQuery = serde_json::from_str(r#"{"limit": 100}"#).unwrap();
        assert_eq!(query.limit, 100);
        assert_eq!(query.cursor, None);
    }
}
