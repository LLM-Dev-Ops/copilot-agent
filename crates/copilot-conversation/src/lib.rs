//! Conversation management for LLM CoPilot Agent
//!
//! This crate provides conversation management capabilities including:
//! - Multi-turn dialogue with context retention
//! - Session management with token tracking
//! - Response streaming with SSE support
//! - Conversation history with search and export
//! - Reference resolution for natural dialogue

pub mod manager;
pub mod session;
pub mod streaming;
pub mod history;

pub use manager::ConversationManager;
pub use session::{Session, SessionManager, SessionState};
pub use streaming::{StreamingResponse, StreamChunk};
pub use history::{HistoryManager, ConversationMessage, MessageRole};

use thiserror::Error;

/// Result type for conversation operations
pub type Result<T> = std::result::Result<T, ConversationError>;

/// Errors that can occur during conversation operations
#[derive(Error, Debug)]
pub enum ConversationError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session expired: {0}")]
    SessionExpired(String),

    #[error("Invalid message format: {0}")]
    InvalidMessage(String),

    #[error("History operation failed: {0}")]
    HistoryError(String),

    #[error("Streaming error: {0}")]
    StreamingError(String),

    #[error("Context error: {0}")]
    ContextError(String),

    #[error("NLP processing error: {0}")]
    NlpError(String),

    #[error("Token limit exceeded: used {used}, limit {limit}")]
    TokenLimitExceeded { used: usize, limit: usize },

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}
