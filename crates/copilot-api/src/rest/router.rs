//! Axum router configuration

use crate::{
    rest::{handlers, middleware},
    AppState,
};
use axum::{
    http::{header, HeaderValue, Method},
    middleware as axum_middleware,
    routing::{get, post, delete},
    Router,
};
use std::{sync::Arc, time::Duration};
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer},
    LatencyUnit, ServiceBuilderExt,
};
use tracing::Level;

/// Create the main API router
pub fn create_router(state: AppState) -> Router {
    let state = Arc::new(state);

    // Create the API v1 router
    let api_v1 = Router::new()
        // Session routes
        .route("/sessions", post(handlers::create_session))
        .route("/sessions/:id", get(handlers::get_session))
        .route("/sessions/:id", delete(handlers::delete_session))
        // Message routes
        .route("/messages", post(handlers::send_message))
        .route("/messages/:session_id", get(handlers::get_messages))
        // Workflow routes
        .route("/workflows", post(handlers::create_workflow))
        .route("/workflows/:id", get(handlers::get_workflow_status))
        .layer(
            ServiceBuilder::new()
                .layer(axum_middleware::from_fn_with_state(
                    state.clone(),
                    middleware::auth_middleware,
                ))
                .layer(axum_middleware::from_fn(middleware::rate_limit_middleware))
                .layer(axum_middleware::from_fn(middleware::request_id_middleware)),
        );

    // Health check routes (no authentication required)
    let health_routes = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/ready", get(handlers::readiness_check));

    // Combine all routes
    Router::new()
        .nest("/api/v1", api_v1)
        .merge(health_routes)
        .layer(
            ServiceBuilder::new()
                .layer(error_handling_layer())
                .layer(cors_layer())
                .layer(tracing_layer())
                .layer(
                    tower::ServiceBuilder::new()
                        .timeout(Duration::from_secs(30))
                        .compression(),
                ),
        )
        .with_state(state)
}

/// Configure CORS layer
fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(
            std::env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "*".to_string())
                .parse::<HeaderValue>()
                .unwrap_or(HeaderValue::from_static("*")),
        )
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::ACCEPT,
            header::CONTENT_TYPE,
            header::HeaderName::from_static("x-request-id"),
        ])
        .allow_credentials(true)
        .max_age(Duration::from_secs(3600))
}

/// Configure tracing layer
fn tracing_layer() -> TraceLayer {
    TraceLayer::new_for_http()
        .make_span_with(
            DefaultMakeSpan::new()
                .level(Level::INFO)
                .include_headers(true),
        )
        .on_response(
            DefaultOnResponse::new()
                .level(Level::INFO)
                .latency_unit(LatencyUnit::Millis),
        )
}

/// Configure error handling layer
fn error_handling_layer() -> axum_middleware::HandleErrorLayer<
    impl Fn(tower::BoxError) -> std::result::Result<axum::response::Response, std::convert::Infallible> + Clone,
> {
    use axum::response::{IntoResponse, Response};
    use tower::BoxError;

    tower::ServiceBuilder::new().layer(axum_middleware::HandleErrorLayer::new(
        |error: BoxError| async move {
            if error.is::<tower::timeout::error::Elapsed>() {
                Ok::<Response, std::convert::Infallible>(
                    (
                        axum::http::StatusCode::REQUEST_TIMEOUT,
                        "Request timeout",
                    )
                        .into_response(),
                )
            } else {
                Ok::<Response, std::convert::Infallible>(
                    (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Unhandled error: {}", error),
                    )
                        .into_response(),
                )
            }
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    fn create_test_state() -> AppState {
        // This would need actual implementations for testing
        // For now, this is a placeholder
        todo!("Create test state with mock dependencies")
    }

    #[tokio::test]
    async fn test_health_check_route() {
        // let app = create_router(create_test_state());
        // let response = app
        //     .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        //     .await
        //     .unwrap();
        // assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_cors_configuration() {
        // Test CORS headers are properly set
        // This would require setting up a test server
    }
}
