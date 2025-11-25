//! gRPC service implementation

use crate::{error::ApiError, AppState};
use async_trait::async_trait;
use std::sync::Arc;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};
use tracing::{debug, error, info};

// These would normally be generated from .proto files
// For now, we'll define the trait and basic structure

/// CoPilot Service trait
///
/// This trait defines the gRPC service interface for the CoPilot service.
/// In a real implementation, this would be generated from protobuf definitions.
#[async_trait]
pub trait CoPilotServiceTrait {
    /// Send a message and get a response
    async fn send_message(
        &self,
        request: Request<SendMessageRequest>,
    ) -> Result<Response<SendMessageResponse>, Status>;

    /// Stream responses for a message
    async fn stream_response(
        &self,
        request: Request<SendMessageRequest>,
    ) -> Result<Response<ReceiverStream<Result<StreamResponseChunk, Status>>>, Status>;

    /// Create and execute a workflow
    async fn create_workflow(
        &self,
        request: Request<CreateWorkflowRequest>,
    ) -> Result<Response<CreateWorkflowResponse>, Status>;

    /// Get workflow status with streaming updates
    async fn get_workflow_status(
        &self,
        request: Request<GetWorkflowStatusRequest>,
    ) -> Result<Response<ReceiverStream<Result<WorkflowStatusUpdate, Status>>>, Status>;
}

/// gRPC service implementation
pub struct CoPilotServiceImpl {
    state: Arc<AppState>,
}

impl CoPilotServiceImpl {
    /// Create a new gRPC service instance
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Convert ApiError to tonic::Status
    fn api_error_to_status(error: ApiError) -> Status {
        match error {
            ApiError::AuthenticationFailed(msg) => Status::unauthenticated(msg),
            ApiError::AuthorizationFailed(msg) => Status::permission_denied(msg),
            ApiError::InvalidInput(msg) => Status::invalid_argument(msg),
            ApiError::NotFound(msg) => Status::not_found(msg),
            ApiError::InternalError(msg) => Status::internal(msg),
            ApiError::ServiceUnavailable(msg) => Status::unavailable(msg),
            ApiError::RateLimitExceeded => Status::resource_exhausted("Rate limit exceeded"),
            ApiError::WebSocketError(msg) => Status::internal(msg),
            ApiError::GrpcError(msg) => Status::internal(msg),
            ApiError::ConversationError(msg) => Status::failed_precondition(msg),
            ApiError::WorkflowError(msg) => Status::failed_precondition(msg),
        }
    }
}

#[async_trait]
impl CoPilotServiceTrait for CoPilotServiceImpl {
    async fn send_message(
        &self,
        request: Request<SendMessageRequest>,
    ) -> Result<Response<SendMessageResponse>, Status> {
        let req = request.into_inner();
        info!("gRPC SendMessage: session_id={}", req.session_id);

        // TODO: Implement actual message processing
        // For now, return a mock response
        let response = SendMessageResponse {
            message_id: uuid::Uuid::new_v4().to_string(),
            session_id: req.session_id,
            content: format!("Echo: {}", req.content),
            role: "assistant".to_string(),
            timestamp: chrono::Utc::now().timestamp(),
        };

        Ok(Response::new(response))
    }

    async fn stream_response(
        &self,
        request: Request<SendMessageRequest>,
    ) -> Result<Response<ReceiverStream<Result<StreamResponseChunk, Status>>>, Status> {
        let req = request.into_inner();
        info!("gRPC StreamResponse: session_id={}", req.session_id);

        let (tx, rx) = tokio::sync::mpsc::channel(128);
        let message_id = uuid::Uuid::new_v4().to_string();

        // Spawn a task to stream chunks
        tokio::spawn(async move {
            // TODO: Implement actual streaming from CoPilot engine
            // For now, send a few mock chunks
            let chunks = vec!["Hello", " from", " CoPilot", "!"];

            for (i, chunk) in chunks.iter().enumerate() {
                let response_chunk = StreamResponseChunk {
                    message_id: message_id.clone(),
                    chunk: chunk.to_string(),
                    finished: i == chunks.len() - 1,
                    timestamp: chrono::Utc::now().timestamp(),
                };

                if tx.send(Ok(response_chunk)).await.is_err() {
                    error!("Failed to send chunk, client disconnected");
                    break;
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }

    async fn create_workflow(
        &self,
        request: Request<CreateWorkflowRequest>,
    ) -> Result<Response<CreateWorkflowResponse>, Status> {
        let req = request.into_inner();
        info!("gRPC CreateWorkflow: name={}", req.name);

        // TODO: Implement actual workflow creation
        let response = CreateWorkflowResponse {
            workflow_id: uuid::Uuid::new_v4().to_string(),
            status: "pending".to_string(),
            created_at: chrono::Utc::now().timestamp(),
        };

        Ok(Response::new(response))
    }

    async fn get_workflow_status(
        &self,
        request: Request<GetWorkflowStatusRequest>,
    ) -> Result<Response<ReceiverStream<Result<WorkflowStatusUpdate, Status>>>, Status> {
        let req = request.into_inner();
        info!("gRPC GetWorkflowStatus: workflow_id={}", req.workflow_id);

        let (tx, rx) = tokio::sync::mpsc::channel(128);
        let workflow_id = req.workflow_id.clone();

        // Spawn a task to stream status updates
        tokio::spawn(async move {
            // TODO: Implement actual workflow status streaming
            // For now, send mock status updates
            let statuses = vec![
                ("pending", 0.0),
                ("running", 0.25),
                ("running", 0.50),
                ("running", 0.75),
                ("completed", 1.0),
            ];

            for (status, progress) in statuses {
                let update = WorkflowStatusUpdate {
                    workflow_id: workflow_id.clone(),
                    status: status.to_string(),
                    progress,
                    timestamp: chrono::Utc::now().timestamp(),
                    result: None,
                    error: None,
                };

                if tx.send(Ok(update)).await.is_err() {
                    error!("Failed to send status update, client disconnected");
                    break;
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }
}

// Message types (would normally be generated from .proto files)

/// Send message request
#[derive(Debug, Clone)]
pub struct SendMessageRequest {
    pub session_id: String,
    pub content: String,
    pub role: String,
    pub metadata: Option<Vec<u8>>, // JSON serialized metadata
}

/// Send message response
#[derive(Debug, Clone)]
pub struct SendMessageResponse {
    pub message_id: String,
    pub session_id: String,
    pub content: String,
    pub role: String,
    pub timestamp: i64,
}

/// Stream response chunk
#[derive(Debug, Clone)]
pub struct StreamResponseChunk {
    pub message_id: String,
    pub chunk: String,
    pub finished: bool,
    pub timestamp: i64,
}

/// Create workflow request
#[derive(Debug, Clone)]
pub struct CreateWorkflowRequest {
    pub name: String,
    pub definition: Vec<u8>, // JSON serialized workflow definition
    pub input: Option<Vec<u8>>, // JSON serialized input
}

/// Create workflow response
#[derive(Debug, Clone)]
pub struct CreateWorkflowResponse {
    pub workflow_id: String,
    pub status: String,
    pub created_at: i64,
}

/// Get workflow status request
#[derive(Debug, Clone)]
pub struct GetWorkflowStatusRequest {
    pub workflow_id: String,
}

/// Workflow status update
#[derive(Debug, Clone)]
pub struct WorkflowStatusUpdate {
    pub workflow_id: String,
    pub status: String,
    pub progress: f32,
    pub timestamp: i64,
    pub result: Option<Vec<u8>>, // JSON serialized result
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_send_message_request_creation() {
        let req = SendMessageRequest {
            session_id: "test-session".to_string(),
            content: "Hello".to_string(),
            role: "user".to_string(),
            metadata: None,
        };
        assert_eq!(req.session_id, "test-session");
        assert_eq!(req.content, "Hello");
    }

    #[test]
    fn test_workflow_status_update_creation() {
        let update = WorkflowStatusUpdate {
            workflow_id: "test-workflow".to_string(),
            status: "running".to_string(),
            progress: 0.5,
            timestamp: chrono::Utc::now().timestamp(),
            result: None,
            error: None,
        };
        assert_eq!(update.workflow_id, "test-workflow");
        assert_eq!(update.progress, 0.5);
    }
}
