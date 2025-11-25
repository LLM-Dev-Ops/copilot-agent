//! CoPilot API Layer
//!
//! This crate provides the API layer for the LLM CoPilot Agent, including:
//! - REST API endpoints
//! - WebSocket connections for real-time communication
//! - gRPC services for high-performance RPC
//!
//! # Features
//!
//! - `rest` - Enable REST API (enabled by default)
//! - `websocket` - Enable WebSocket support (enabled by default)
//! - `grpc` - Enable gRPC services (enabled by default)

pub mod error;

#[cfg(feature = "rest")]
pub mod rest;

#[cfg(feature = "websocket")]
pub mod websocket;

#[cfg(feature = "grpc")]
pub mod grpc;

pub mod types;

// Re-export commonly used types
pub use error::{ApiError, Result};
pub use types::*;

#[cfg(feature = "rest")]
pub use rest::router::create_router;

use std::sync::Arc;
use copilot_core::CoPilotEngine;
use copilot_conversation::ConversationManager;

/// Application state shared across all API handlers
#[derive(Clone)]
pub struct AppState {
    /// The CoPilot engine instance
    pub engine: Arc<CoPilotEngine>,
    /// Conversation manager
    pub conversation_manager: Arc<ConversationManager>,
    /// JWT secret for authentication
    pub jwt_secret: String,
}

impl AppState {
    /// Create a new application state
    pub fn new(
        engine: Arc<CoPilotEngine>,
        conversation_manager: Arc<ConversationManager>,
        jwt_secret: String,
    ) -> Self {
        Self {
            engine,
            conversation_manager,
            jwt_secret,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_creation() {
        // Test would require actual engine and manager instances
        // This is a placeholder for future tests
    }
}
