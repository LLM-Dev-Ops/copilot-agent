//! Agent implementations for the Agentics platform.
//!
//! All agents follow the Agentics Global Agent Constitution:
//! - Stateless at runtime
//! - Emit exactly ONE DecisionEvent per invocation
//! - Persist ONLY via ruvector-service
//! - NEVER execute, orchestrate, or modify runtime behavior

pub mod contracts;
pub mod decomposer;
pub mod execution_graph;
pub mod telemetry;

pub use contracts::*;
pub use decomposer::*;
pub use execution_graph::*;
pub use telemetry::*;
