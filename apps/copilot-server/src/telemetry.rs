use anyhow::{Context, Result};
use opentelemetry::{
    global,
    trace::TracerProvider as _,
};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    runtime,
    trace::{self, RandomIdGenerator, Sampler, TracerProvider},
    Resource,
};
use tracing::Level;
use tracing_subscriber::{
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
    fmt,
    Registry,
};

use crate::cli::Args;

/// Guards that must be kept alive for the duration of the program
pub struct TelemetryGuards {
    _tracer_provider: Option<TracerProvider>,
}

/// Initialize telemetry stack (logging, tracing, metrics)
pub fn init_telemetry(args: &Args) -> Result<TelemetryGuards> {
    // Build environment filter
    let env_filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new(&args.log_level))
        .context("Failed to create environment filter")?;

    // Create base subscriber
    let subscriber = Registry::default().with(env_filter);

    // Add formatting layer
    let subscriber = if args.json_logs {
        // JSON formatting for production
        subscriber.with(
            fmt::layer()
                .json()
                .with_target(true)
                .with_current_span(true)
                .with_span_list(true)
        ).boxed()
    } else {
        // Pretty formatting for development
        subscriber.with(
            fmt::layer()
                .pretty()
                .with_target(true)
                .with_line_number(true)
                .with_file(true)
        ).boxed()
    };

    // Add OpenTelemetry layer if enabled
    let tracer_provider = if args.enable_otel {
        Some(init_opentelemetry(args)?)
    } else {
        None
    };

    if let Some(ref provider) = tracer_provider {
        let tracer = provider.tracer("copilot-server");
        let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
        subscriber.with(telemetry_layer).init();
    } else {
        subscriber.init();
    }

    Ok(TelemetryGuards {
        _tracer_provider: tracer_provider,
    })
}

/// Initialize OpenTelemetry tracing
fn init_opentelemetry(args: &Args) -> Result<TracerProvider> {
    // Create OTLP exporter
    let exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint(&args.otel_endpoint);

    // Create trace pipeline
    let tracer_provider = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(exporter)
        .with_trace_config(
            trace::config()
                .with_sampler(Sampler::AlwaysOn)
                .with_id_generator(RandomIdGenerator::default())
                .with_resource(Resource::new(vec![
                    opentelemetry::KeyValue::new("service.name", "copilot-server"),
                    opentelemetry::KeyValue::new("service.version", env!("CARGO_PKG_VERSION")),
                    opentelemetry::KeyValue::new("deployment.environment", args.env.clone()),
                ]))
        )
        .install_batch(runtime::Tokio)
        .context("Failed to install OpenTelemetry tracer")?;

    // Set as global tracer provider
    global::set_tracer_provider(tracer_provider.clone());

    Ok(tracer_provider)
}

impl Drop for TelemetryGuards {
    fn drop(&mut self) {
        // Shutdown OpenTelemetry
        if self._tracer_provider.is_some() {
            global::shutdown_tracer_provider();
        }
    }
}

/// Helper to get the current log level
pub fn get_log_level(level_str: &str) -> Level {
    match level_str.to_lowercase().as_str() {
        "trace" => Level::TRACE,
        "debug" => Level::DEBUG,
        "info" => Level::INFO,
        "warn" => Level::WARN,
        "error" => Level::ERROR,
        _ => Level::INFO,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_log_level() {
        assert_eq!(get_log_level("trace"), Level::TRACE);
        assert_eq!(get_log_level("debug"), Level::DEBUG);
        assert_eq!(get_log_level("info"), Level::INFO);
        assert_eq!(get_log_level("warn"), Level::WARN);
        assert_eq!(get_log_level("error"), Level::ERROR);
        assert_eq!(get_log_level("invalid"), Level::INFO);
    }
}
