//! REST API module
//!
//! Provides REST API endpoints for the CoPilot service.

pub mod handlers;
pub mod middleware;
pub mod router;

pub use handlers::*;
pub use middleware::*;
pub use router::create_router;
