use async_trait::async_trait;
use reqwest::Client;
use tracing::{debug, error, info};

use crate::{
    AdapterError, AdapterResult, HealthStatus, ModuleCapabilities,
    traits::{
        ModuleAdapter, ObservatoryAdapter, MetricsQuery, MetricsResponse,
        LogsQuery, LogsResponse, TracesQuery, TracesResponse,
    },
    circuit_breaker::CircuitBreaker,
    retry::with_retry,
};

pub struct ObservatoryClient {
    prometheus_url: String,
    loki_url: String,
    jaeger_url: String,
    client: Client,
    circuit_breaker: CircuitBreaker,
}

impl ObservatoryClient {
    pub fn new(
        prometheus_url: impl Into<String>,
        loki_url: impl Into<String>,
        jaeger_url: impl Into<String>,
    ) -> Self {
        Self {
            prometheus_url: prometheus_url.into(),
            loki_url: loki_url.into(),
            jaeger_url: jaeger_url.into(),
            client: Client::new(),
            circuit_breaker: CircuitBreaker::default(),
        }
    }

    pub fn with_prometheus(prometheus_url: impl Into<String>) -> Self {
        let url = prometheus_url.into();
        Self {
            prometheus_url: url.clone(),
            loki_url: url.clone(),
            jaeger_url: url,
            client: Client::new(),
            circuit_breaker: CircuitBreaker::default(),
        }
    }

    async fn query_prometheus(&self, query: &str, start: i64, end: i64, step: &str) -> AdapterResult<MetricsResponse> {
        let url = format!("{}/api/v1/query_range", self.prometheus_url);
        debug!("Querying Prometheus: {}", query);

        let response = with_retry(3, || async {
            self.circuit_breaker.call(|| async {
                self.client
                    .get(&url)
                    .query(&[
                        ("query", query),
                        ("start", &start.to_string()),
                        ("end", &end.to_string()),
                        ("step", step),
                    ])
                    .send()
                    .await
                    .map_err(|e| AdapterError::RequestFailed(e.to_string()))
            }).await
        }).await?;

        if !response.status().is_success() {
            let error_msg = format!("Prometheus query failed with status: {}", response.status());
            error!("{}", error_msg);
            return Err(AdapterError::RequestFailed(error_msg));
        }

        response
            .json::<MetricsResponse>()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))
    }

    async fn query_loki(&self, query: &str, start: i64, end: i64, limit: usize) -> AdapterResult<LogsResponse> {
        let url = format!("{}/loki/api/v1/query_range", self.loki_url);
        debug!("Querying Loki: {}", query);

        let response = with_retry(3, || async {
            self.circuit_breaker.call(|| async {
                self.client
                    .get(&url)
                    .query(&[
                        ("query", query),
                        ("start", &start.to_string()),
                        ("end", &end.to_string()),
                        ("limit", &limit.to_string()),
                    ])
                    .send()
                    .await
                    .map_err(|e| AdapterError::RequestFailed(e.to_string()))
            }).await
        }).await?;

        if !response.status().is_success() {
            let error_msg = format!("Loki query failed with status: {}", response.status());
            error!("{}", error_msg);
            return Err(AdapterError::RequestFailed(error_msg));
        }

        response
            .json::<LogsResponse>()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))
    }

    async fn query_jaeger(&self, params: &TracesQuery) -> AdapterResult<TracesResponse> {
        let url = format!("{}/api/traces", self.jaeger_url);
        debug!("Querying Jaeger for traces");

        let response = with_retry(3, || async {
            self.circuit_breaker.call(|| async {
                self.client
                    .get(&url)
                    .json(&params)
                    .send()
                    .await
                    .map_err(|e| AdapterError::RequestFailed(e.to_string()))
            }).await
        }).await?;

        if !response.status().is_success() {
            let error_msg = format!("Jaeger query failed with status: {}", response.status());
            error!("{}", error_msg);
            return Err(AdapterError::RequestFailed(error_msg));
        }

        response
            .json::<TracesResponse>()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))
    }
}

#[async_trait]
impl ModuleAdapter for ObservatoryClient {
    async fn health_check(&self) -> AdapterResult<HealthStatus> {
        debug!("Checking Observatory health");

        let prometheus_health = self.client
            .get(format!("{}/-/healthy", self.prometheus_url))
            .send()
            .await;

        match prometheus_health {
            Ok(response) if response.status().is_success() => {
                Ok(HealthStatus::healthy("Observatory is operational"))
            }
            Ok(response) => {
                let msg = format!("Observatory returned status: {}", response.status());
                Ok(HealthStatus::unhealthy(msg))
            }
            Err(e) => {
                let msg = format!("Observatory unreachable: {}", e);
                Ok(HealthStatus::unhealthy(msg))
            }
        }
    }

    async fn execute(&self, request: serde_json::Value) -> AdapterResult<serde_json::Value> {
        debug!("Executing generic Observatory request");

        let request_type = request.get("type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AdapterError::InvalidResponse("Missing request type".to_string()))?;

        match request_type {
            "metrics" => {
                let query: MetricsQuery = serde_json::from_value(request)
                    .map_err(|e| AdapterError::SerializationError(e.to_string()))?;
                let response = self.query_metrics(query).await?;
                serde_json::to_value(response)
                    .map_err(|e| AdapterError::SerializationError(e.to_string()))
            }
            "logs" => {
                let query: LogsQuery = serde_json::from_value(request)
                    .map_err(|e| AdapterError::SerializationError(e.to_string()))?;
                let response = self.query_logs(query).await?;
                serde_json::to_value(response)
                    .map_err(|e| AdapterError::SerializationError(e.to_string()))
            }
            "traces" => {
                let query: TracesQuery = serde_json::from_value(request)
                    .map_err(|e| AdapterError::SerializationError(e.to_string()))?;
                let response = self.query_traces(query).await?;
                serde_json::to_value(response)
                    .map_err(|e| AdapterError::SerializationError(e.to_string()))
            }
            _ => Err(AdapterError::InvalidResponse(format!("Unknown request type: {}", request_type)))
        }
    }

    async fn get_capabilities(&self) -> AdapterResult<ModuleCapabilities> {
        Ok(ModuleCapabilities {
            name: "LLM-Observatory".to_string(),
            version: "0.1.0".to_string(),
            features: vec![
                "metrics_collection".to_string(),
                "log_aggregation".to_string(),
                "distributed_tracing".to_string(),
                "prometheus_integration".to_string(),
                "grafana_dashboards".to_string(),
                "loki_logging".to_string(),
                "jaeger_tracing".to_string(),
            ],
            endpoints: vec![
                "/query_metrics".to_string(),
                "/query_logs".to_string(),
                "/query_traces".to_string(),
            ],
        })
    }
}

#[async_trait]
impl ObservatoryAdapter for ObservatoryClient {
    async fn query_metrics(&self, query: MetricsQuery) -> AdapterResult<MetricsResponse> {
        info!("Querying metrics: {}", query.query);

        let start = query.start_time.timestamp();
        let end = query.end_time.timestamp();
        let step = query.step.as_deref().unwrap_or("15s");

        let result = self.query_prometheus(&query.query, start, end, step).await?;

        info!("Metrics query returned {} results", result.data.result.len());
        Ok(result)
    }

    async fn query_logs(&self, query: LogsQuery) -> AdapterResult<LogsResponse> {
        info!("Querying logs: {}", query.query);

        let start = query.start_time.timestamp_nanos_opt().unwrap_or(0);
        let end = query.end_time.timestamp_nanos_opt().unwrap_or(0);
        let limit = query.limit.unwrap_or(100);

        let result = self.query_loki(&query.query, start, end, limit).await?;

        info!("Logs query returned {} entries", result.logs.len());
        Ok(result)
    }

    async fn query_traces(&self, query: TracesQuery) -> AdapterResult<TracesResponse> {
        info!("Querying traces for service: {:?}", query.service_name);

        let result = self.query_jaeger(&query).await?;

        info!("Traces query returned {} traces", result.traces.len());
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = ObservatoryClient::new(
            "http://prometheus:9090",
            "http://loki:3100",
            "http://jaeger:16686"
        );
        assert_eq!(client.prometheus_url, "http://prometheus:9090");
        assert_eq!(client.loki_url, "http://loki:3100");
        assert_eq!(client.jaeger_url, "http://jaeger:16686");
    }

    #[tokio::test]
    async fn test_capabilities() {
        let client = ObservatoryClient::with_prometheus("http://prometheus:9090");
        let caps = client.get_capabilities().await.unwrap();
        assert_eq!(caps.name, "LLM-Observatory");
        assert!(caps.features.contains(&"metrics_collection".to_string()));
    }
}
