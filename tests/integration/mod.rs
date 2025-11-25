//! Integration tests module
//!
//! This module contains integration tests for the LLM-CoPilot-Agent.
//! Tests are organized by functionality areas.

pub mod api_tests;
pub mod conversation_tests;
pub mod workflow_tests;

// Re-export common test utilities
pub use crate::common::*;
