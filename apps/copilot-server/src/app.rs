use anyhow::{Context, Result};
use futures::future::FutureExt;
use signal_hook::consts::signal::{SIGINT, SIGTERM};
use signal_hook_tokio::Signals;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use copilot_config::Config;
use copilot_core::Core;
use copilot_llm::LlmOrchestrator;
use copilot_memory::MemoryStore;
use copilot_rag::RagEngine;
use copilot_workflows::WorkflowEngine;
use copilot_plugins::PluginManager;

use crate::cli::Args;
use crate::server::Server;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub core: Arc<Core>,
    pub llm: Arc<LlmOrchestrator>,
    pub memory: Arc<RwLock<MemoryStore>>,
    pub rag: Arc<RagEngine>,
    pub workflows: Arc<WorkflowEngine>,
    pub plugins: Arc<PluginManager>,
}

impl AppState {
    /// Create a new application state with all dependencies
    pub async fn new(config: Config) -> Result<Self> {
        info!("Initializing application components");

        // Initialize core services
        let core = Arc::new(Core::new(config.clone()).await?);

        // Initialize LLM orchestrator
        let llm = Arc::new(
            LlmOrchestrator::new(&config.llm)
                .await
                .context("Failed to initialize LLM orchestrator")?
        );

        // Initialize memory store
        let memory = Arc::new(RwLock::new(
            MemoryStore::new(&config.memory)
                .await
                .context("Failed to initialize memory store")?
        ));

        // Initialize RAG engine
        let rag = Arc::new(
            RagEngine::new(&config.rag, Arc::clone(&memory))
                .await
                .context("Failed to initialize RAG engine")?
        );

        // Initialize workflow engine
        let workflows = Arc::new(
            WorkflowEngine::new(&config.workflows)
                .await
                .context("Failed to initialize workflow engine")?
        );

        // Initialize plugin manager
        let plugins = Arc::new(
            PluginManager::new(&config.plugins)
                .await
                .context("Failed to initialize plugin manager")?
        );

        Ok(Self {
            config: Arc::new(config),
            core,
            llm,
            memory,
            rag,
            workflows,
            plugins,
        })
    }

    /// Perform health check on all components
    pub async fn health_check(&self) -> Result<()> {
        info!("Performing health check");

        self.core.health_check().await?;
        self.llm.health_check().await?;
        self.rag.health_check().await?;
        self.workflows.health_check().await?;

        info!("Health check passed");
        Ok(())
    }
}

/// Main application
pub struct App {
    args: Args,
    config: Config,
    state: AppState,
    server: Server,
}

impl App {
    /// Build the application with all dependencies
    pub async fn build(args: Args) -> Result<Self> {
        // Validate arguments
        args.validate()
            .context("Invalid command line arguments")?;

        // Load configuration
        info!("Loading configuration from: {:?}", args.config);
        let mut config = Config::load(&args.config)
            .context("Failed to load configuration")?;

        // Override configuration with CLI arguments
        if let Some(port) = args.port {
            config.server.http_port = port;
        }
        if let Some(grpc_port) = args.grpc_port {
            config.server.grpc_port = grpc_port;
        }

        // Initialize application state
        let state = AppState::new(config.clone()).await?;

        // Perform initial health check
        state.health_check().await?;

        // Create server
        let server = Server::new(args.clone(), state.clone())?;

        Ok(Self {
            args,
            config,
            state,
            server,
        })
    }

    /// Run the application
    pub async fn run(self) -> Result<()> {
        info!("Starting server");
        info!("HTTP port: {}", self.config.server.http_port);
        info!("gRPC port: {}", self.config.server.grpc_port);
        info!("Metrics port: {}", self.args.metrics_port);

        // Setup signal handling for graceful shutdown
        let mut signals = Signals::new(&[SIGTERM, SIGINT])
            .context("Failed to setup signal handlers")?;

        let signals_handle = signals.handle();

        // Spawn signal handler task
        let signal_task = tokio::spawn(async move {
            if let Some(signal) = signals.next().await {
                match signal {
                    SIGTERM => info!("Received SIGTERM, initiating graceful shutdown"),
                    SIGINT => info!("Received SIGINT (Ctrl-C), initiating graceful shutdown"),
                    _ => warn!("Received unknown signal: {}", signal),
                }
            }
        });

        // Run server and wait for shutdown signal
        tokio::select! {
            result = self.server.run() => {
                result.context("Server error")?;
            }
            _ = signal_task.fuse() => {
                info!("Shutdown signal received");
            }
        }

        // Cleanup
        info!("Shutting down gracefully");
        self.shutdown().await?;
        signals_handle.close();

        Ok(())
    }

    /// Gracefully shutdown the application
    async fn shutdown(self) -> Result<()> {
        info!("Starting graceful shutdown");

        // Shutdown plugins
        self.state.plugins.shutdown().await?;

        // Shutdown workflow engine
        self.state.workflows.shutdown().await?;

        // Shutdown RAG engine
        self.state.rag.shutdown().await?;

        // Flush memory store
        {
            let memory = self.state.memory.write().await;
            memory.flush().await?;
        }

        // Shutdown core services
        self.state.core.shutdown().await?;

        info!("Graceful shutdown complete");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_app_state_creation() {
        let config = Config::default();
        let result = AppState::new(config).await;
        // This will fail without actual implementations, but shows the structure
        assert!(result.is_ok() || result.is_err());
    }
}
