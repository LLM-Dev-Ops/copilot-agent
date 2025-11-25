use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone)]
#[command(
    name = "copilot-server",
    about = "LLM CoPilot Agent Server",
    version,
    long_about = "A high-performance AI agent server with LLM orchestration, \
                  RAG capabilities, and workflow automation."
)]
pub struct Args {
    /// Path to configuration file
    #[arg(
        short,
        long,
        env = "CONFIG_PATH",
        default_value = "config/default.toml"
    )]
    pub config: PathBuf,

    /// HTTP server port (overrides config)
    #[arg(short, long, env = "PORT")]
    pub port: Option<u16>,

    /// gRPC server port (overrides config)
    #[arg(long, env = "GRPC_PORT")]
    pub grpc_port: Option<u16>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(
        short,
        long,
        env = "LOG_LEVEL",
        default_value = "info",
        value_parser = ["trace", "debug", "info", "warn", "error"]
    )]
    pub log_level: String,

    /// Environment (dev, staging, prod)
    #[arg(
        short,
        long,
        env = "ENVIRONMENT",
        default_value = "dev",
        value_parser = ["dev", "staging", "prod"]
    )]
    pub env: String,

    /// Enable JSON log format (useful for production)
    #[arg(long, env = "JSON_LOGS")]
    pub json_logs: bool,

    /// Enable OpenTelemetry export
    #[arg(long, env = "ENABLE_OTEL")]
    pub enable_otel: bool,

    /// OpenTelemetry collector endpoint
    #[arg(long, env = "OTEL_ENDPOINT", default_value = "http://localhost:4317")]
    pub otel_endpoint: String,

    /// Metrics port
    #[arg(long, env = "METRICS_PORT", default_value = "9090")]
    pub metrics_port: u16,

    /// Enable TLS
    #[arg(long, env = "ENABLE_TLS")]
    pub enable_tls: bool,

    /// TLS certificate path
    #[arg(long, env = "TLS_CERT_PATH")]
    pub tls_cert: Option<PathBuf>,

    /// TLS private key path
    #[arg(long, env = "TLS_KEY_PATH")]
    pub tls_key: Option<PathBuf>,

    /// Number of worker threads (defaults to number of CPUs)
    #[arg(long, env = "WORKER_THREADS")]
    pub worker_threads: Option<usize>,

    /// Maximum number of concurrent connections
    #[arg(long, env = "MAX_CONNECTIONS", default_value = "10000")]
    pub max_connections: usize,

    /// Request timeout in seconds
    #[arg(long, env = "REQUEST_TIMEOUT", default_value = "30")]
    pub request_timeout: u64,
}

impl Args {
    /// Validate the arguments
    pub fn validate(&self) -> anyhow::Result<()> {
        // Validate config file exists
        if !self.config.exists() {
            anyhow::bail!("Configuration file not found: {:?}", self.config);
        }

        // Validate TLS configuration
        if self.enable_tls {
            if self.tls_cert.is_none() || self.tls_key.is_none() {
                anyhow::bail!("TLS enabled but certificate or key path not provided");
            }

            if let Some(cert) = &self.tls_cert {
                if !cert.exists() {
                    anyhow::bail!("TLS certificate not found: {:?}", cert);
                }
            }

            if let Some(key) = &self.tls_key {
                if !key.exists() {
                    anyhow::bail!("TLS private key not found: {:?}", key);
                }
            }
        }

        Ok(())
    }
}
