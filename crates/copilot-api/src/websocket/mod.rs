//! WebSocket module
//!
//! Provides WebSocket support for real-time communication with the CoPilot service.

pub mod handler;

pub use handler::{handle_websocket, WebSocketMessage, WebSocketSession};
