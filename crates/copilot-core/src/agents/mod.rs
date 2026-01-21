//! Agent implementations for the Agentics platform.
//!
//! All agents follow the Agentics Global Agent Constitution:
//! - Stateless at runtime
//! - Emit exactly ONE DecisionEvent per invocation
//! - Persist ONLY via ruvector-service
//! - NEVER execute, orchestrate, or modify runtime behavior

pub mod contracts;
pub mod decomposer;
pub mod telemetry;

pub use contracts::*;
pub use decomposer::*;
pub use telemetry::*;
