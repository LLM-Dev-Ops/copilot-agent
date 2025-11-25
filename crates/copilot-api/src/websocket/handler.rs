//! WebSocket handler implementation

use crate::{error::ApiError, AppState};
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures::{
    sink::SinkExt,
    stream::{SplitSink, SplitStream, StreamExt},
};
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Duration};
use tokio::{sync::mpsc, time::interval};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WebSocketMessage {
    /// Client sends a message
    SendMessage {
        session_id: String,
        content: String,
        metadata: Option<serde_json::Value>,
    },
    /// Server sends a message response
    MessageResponse {
        message_id: String,
        session_id: String,
        content: String,
        role: String,
        timestamp: String,
    },
    /// Server sends a streaming chunk
    StreamChunk {
        message_id: String,
        chunk: String,
        finished: bool,
    },
    /// Client requests workflow execution
    ExecuteWorkflow {
        workflow_id: String,
        input: serde_json::Value,
    },
    /// Server sends workflow status update
    WorkflowStatus {
        workflow_id: String,
        status: String,
        progress: Option<f32>,
    },
    /// Ping message for keepalive
    Ping {
        timestamp: u64,
    },
    /// Pong response
    Pong {
        timestamp: u64,
    },
    /// Error message
    Error {
        code: String,
        message: String,
    },
}

/// WebSocket session state
pub struct WebSocketSession {
    /// Unique session ID
    pub id: String,
    /// User ID (from JWT claims)
    pub user_id: Option<String>,
    /// Active conversation session
    pub conversation_session_id: Option<String>,
}

impl WebSocketSession {
    /// Create a new WebSocket session
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            user_id: None,
            conversation_session_id: None,
        }
    }
}

/// Handle WebSocket upgrade
pub async fn handle_websocket(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    info!("WebSocket connection upgrade requested");
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let session = WebSocketSession::new();
    info!("WebSocket connection established: {}", session.id);

    let (sender, receiver) = socket.split();

    // Create channels for message passing
    let (tx, rx) = mpsc::unbounded_channel();

    // Spawn sender task
    let send_task = tokio::spawn(handle_sender(sender, rx));

    // Spawn receiver task
    let recv_task = tokio::spawn(handle_receiver(receiver, tx.clone(), state.clone()));

    // Spawn heartbeat task
    let heartbeat_task = tokio::spawn(heartbeat(tx.clone()));

    // Wait for any task to complete
    tokio::select! {
        _ = send_task => {
            info!("WebSocket sender task completed");
        }
        _ = recv_task => {
            info!("WebSocket receiver task completed");
        }
        _ = heartbeat_task => {
            info!("WebSocket heartbeat task completed");
        }
    }

    info!("WebSocket connection closed: {}", session.id);
}

/// Handle sending messages to the client
async fn handle_sender(
    mut sender: SplitSink<WebSocket, Message>,
    mut rx: mpsc::UnboundedReceiver<WebSocketMessage>,
) {
    while let Some(msg) = rx.recv().await {
        let json = match serde_json::to_string(&msg) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to serialize message: {}", e);
                continue;
            }
        };

        if let Err(e) = sender.send(Message::Text(json)).await {
            error!("Failed to send message: {}", e);
            break;
        }
    }
}

/// Handle receiving messages from the client
async fn handle_receiver(
    mut receiver: SplitStream<WebSocket>,
    tx: mpsc::UnboundedSender<WebSocketMessage>,
    state: Arc<AppState>,
) {
    while let Some(msg) = receiver.next().await {
        let msg = match msg {
            Ok(msg) => msg,
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                if let Err(e) = handle_text_message(&text, &tx, &state).await {
                    error!("Error handling message: {}", e);
                    let error_msg = WebSocketMessage::Error {
                        code: "PROCESSING_ERROR".to_string(),
                        message: e.to_string(),
                    };
                    let _ = tx.send(error_msg);
                }
            }
            Message::Binary(data) => {
                warn!("Received binary message, not supported: {} bytes", data.len());
            }
            Message::Ping(data) => {
                debug!("Received ping");
                // Axum automatically handles pong responses
            }
            Message::Pong(_) => {
                debug!("Received pong");
            }
            Message::Close(_) => {
                info!("Received close message");
                break;
            }
        }
    }
}

/// Handle text messages
async fn handle_text_message(
    text: &str,
    tx: &mpsc::UnboundedSender<WebSocketMessage>,
    state: &Arc<AppState>,
) -> Result<(), ApiError> {
    let msg: WebSocketMessage = serde_json::from_str(text)
        .map_err(|e| ApiError::InvalidInput(format!("Invalid JSON: {}", e)))?;

    debug!("Received message: {:?}", msg);

    match msg {
        WebSocketMessage::SendMessage {
            session_id,
            content,
            metadata,
        } => {
            // TODO: Process message using CoPilot engine
            // For now, echo back
            let response = WebSocketMessage::MessageResponse {
                message_id: Uuid::new_v4().to_string(),
                session_id: session_id.clone(),
                content: format!("Echo: {}", content),
                role: "assistant".to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            tx.send(response)
                .map_err(|e| ApiError::WebSocketError(e.to_string()))?;
        }
        WebSocketMessage::ExecuteWorkflow { workflow_id, input } => {
            // TODO: Execute workflow
            let response = WebSocketMessage::WorkflowStatus {
                workflow_id: workflow_id.clone(),
                status: "running".to_string(),
                progress: Some(0.0),
            };
            tx.send(response)
                .map_err(|e| ApiError::WebSocketError(e.to_string()))?;
        }
        WebSocketMessage::Ping { timestamp } => {
            let response = WebSocketMessage::Pong { timestamp };
            tx.send(response)
                .map_err(|e| ApiError::WebSocketError(e.to_string()))?;
        }
        _ => {
            warn!("Unhandled message type: {:?}", msg);
        }
    }

    Ok(())
}

/// Heartbeat task to keep connection alive
async fn heartbeat(tx: mpsc::UnboundedSender<WebSocketMessage>) {
    let mut interval = interval(Duration::from_secs(30));

    loop {
        interval.tick().await;

        let timestamp = chrono::Utc::now().timestamp() as u64;
        let ping = WebSocketMessage::Ping { timestamp };

        if tx.send(ping).is_err() {
            debug!("Failed to send heartbeat, connection likely closed");
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_websocket_session_creation() {
        let session = WebSocketSession::new();
        assert!(!session.id.is_empty());
        assert_eq!(session.user_id, None);
        assert_eq!(session.conversation_session_id, None);
    }

    #[test]
    fn test_websocket_message_serialization() {
        let msg = WebSocketMessage::Ping { timestamp: 12345 };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("ping"));
        assert!(json.contains("12345"));
    }

    #[test]
    fn test_websocket_message_deserialization() {
        let json = r#"{"type":"ping","timestamp":12345}"#;
        let msg: WebSocketMessage = serde_json::from_str(json).unwrap();
        match msg {
            WebSocketMessage::Ping { timestamp } => assert_eq!(timestamp, 12345),
            _ => panic!("Wrong message type"),
        }
    }

    #[test]
    fn test_send_message_serialization() {
        let msg = WebSocketMessage::SendMessage {
            session_id: "test-session".to_string(),
            content: "Hello".to_string(),
            metadata: None,
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("send_message"));
        assert!(json.contains("Hello"));
    }
}
