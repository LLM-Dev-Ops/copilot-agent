use anyhow::{Context, Result};
use axum::{
    Router,
    routing::{get, post},
    extract::State,
    response::Json,
    http::StatusCode,
};
use axum_server::tls_rustls::RustlsConfig;
use metrics_exporter_prometheus::{Matcher, PrometheusBuilder, PrometheusHandle};
use serde_json::json;
use std::net::SocketAddr;
use std::time::Duration;
use tokio::task::JoinHandle;
use tonic::transport::Server as TonicServer;
use tower::ServiceBuilder;
use tower_http::{
    trace::TraceLayer,
    cors::CorsLayer,
    compression::CompressionLayer,
    timeout::TimeoutLayer,
};
use tracing::info;

use copilot_api::http::create_http_router;
use copilot_api::grpc::create_grpc_server;

use crate::app::AppState;
use crate::cli::Args;

pub struct Server {
    args: Args,
    state: AppState,
    metrics_handle: PrometheusHandle,
}

impl Server {
    pub fn new(args: Args, state: AppState) -> Result<Self> {
        // Setup Prometheus metrics exporter
        let metrics_handle = PrometheusBuilder::new()
            .idle_timeout(
                Matcher::Full("http_requests_duration_seconds".to_string()),
                Some(Duration::from_secs(30)),
            )
            .install_recorder()
            .context("Failed to install Prometheus recorder")?;

        Ok(Self {
            args,
            state,
            metrics_handle,
        })
    }

    pub async fn run(self) -> Result<()> {
        // Start metrics server
        let metrics_task = self.start_metrics_server();

        // Start HTTP server
        let http_task = self.start_http_server();

        // Start gRPC server
        let grpc_task = self.start_grpc_server();

        // Wait for all servers
        tokio::try_join!(metrics_task, http_task, grpc_task)?;

        Ok(())
    }

    async fn start_http_server(&self) -> Result<()> {
        let addr = SocketAddr::from(([0, 0, 0, 0], self.state.config.server.http_port));

        // Build HTTP router with all routes
        let app = self.build_http_router();

        info!("HTTP server listening on {}", addr);

        if self.args.enable_tls {
            // Start with TLS
            let tls_config = self.load_tls_config().await?;
            axum_server::bind_rustls(addr, tls_config)
                .serve(app.into_make_service())
                .await
                .context("HTTP server error")?;
        } else {
            // Start without TLS
            let listener = tokio::net::TcpListener::bind(addr)
                .await
                .context("Failed to bind HTTP server")?;
            axum::serve(listener, app.into_make_service())
                .await
                .context("HTTP server error")?;
        }

        Ok(())
    }

    async fn start_grpc_server(&self) -> Result<()> {
        let addr = SocketAddr::from(([0, 0, 0, 0], self.state.config.server.grpc_port));

        info!("gRPC server listening on {}", addr);

        // Create gRPC service
        let grpc_service = create_grpc_server(self.state.clone())
            .context("Failed to create gRPC server")?;

        // Build and start gRPC server
        TonicServer::builder()
            .timeout(Duration::from_secs(self.args.request_timeout))
            .add_service(grpc_service)
            .serve(addr)
            .await
            .context("gRPC server error")?;

        Ok(())
    }

    async fn start_metrics_server(&self) -> Result<()> {
        let addr = SocketAddr::from(([0, 0, 0, 0], self.args.metrics_port));
        let handle = self.metrics_handle.clone();

        info!("Metrics server listening on {}", addr);

        let app = Router::new()
            .route("/metrics", get(move || async move {
                handle.render()
            }))
            .route("/health", get(health_check));

        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .context("Failed to bind metrics server")?;

        axum::serve(listener, app.into_make_service())
            .await
            .context("Metrics server error")?;

        Ok(())
    }

    fn build_http_router(&self) -> Router {
        // Create API router from copilot-api crate
        let api_router = create_http_router(self.state.clone());

        // Build middleware stack
        let middleware = ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(CorsLayer::permissive())
            .layer(CompressionLayer::new())
            .layer(TimeoutLayer::new(Duration::from_secs(self.args.request_timeout)));

        // Combine routes
        Router::new()
            .route("/", get(root))
            .route("/health", get(health_check))
            .route("/ready", get(readiness_check))
            .nest("/api", api_router)
            .layer(middleware)
            .with_state(self.state.clone())
    }

    async fn load_tls_config(&self) -> Result<RustlsConfig> {
        let cert_path = self.args.tls_cert.as_ref()
            .context("TLS certificate path not provided")?;
        let key_path = self.args.tls_key.as_ref()
            .context("TLS key path not provided")?;

        RustlsConfig::from_pem_file(cert_path, key_path)
            .await
            .context("Failed to load TLS configuration")
    }
}

// Route handlers

async fn root() -> Json<serde_json::Value> {
    Json(json!({
        "service": "LLM CoPilot Agent",
        "version": env!("CARGO_PKG_VERSION"),
        "status": "running"
    }))
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}

async fn readiness_check(State(state): State<AppState>) -> StatusCode {
    match state.health_check().await {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::SERVICE_UNAVAILABLE,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_root_handler() {
        let response = root().await;
        assert_eq!(response.0["service"], "LLM CoPilot Agent");
    }

    #[tokio::test]
    async fn test_health_check_handler() {
        let status = health_check().await;
        assert_eq!(status, StatusCode::OK);
    }
}
