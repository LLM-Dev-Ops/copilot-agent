//! gRPC module
//!
//! Provides gRPC services for high-performance RPC communication.

pub mod service;

pub use service::{CoPilotServiceImpl, CoPilotServiceTrait};

// Proto-generated code would be included here
// pub mod proto {
//     tonic::include_proto!("copilot");
// }
