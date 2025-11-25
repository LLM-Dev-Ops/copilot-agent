use async_trait::async_trait;
use tonic::transport::Channel;
use tracing::{debug, error, info};

use crate::{
    AdapterError, AdapterResult, HealthStatus, ModuleCapabilities,
    traits::{
        ModuleAdapter, TestBenchAdapter, TestGenerationRequest, TestGenerationResponse,
        TestExecutionRequest, TestExecutionResponse, CoverageRequest, CoverageResponse,
    },
    circuit_breaker::CircuitBreaker,
    retry::with_retry,
};

pub struct TestBenchClient {
    endpoint: String,
    client: Option<Channel>,
    circuit_breaker: CircuitBreaker,
}

impl TestBenchClient {
    pub fn new(endpoint: impl Into<String>) -> Self {
        Self {
            endpoint: endpoint.into(),
            client: None,
            circuit_breaker: CircuitBreaker::default(),
        }
    }

    pub async fn connect(&mut self) -> AdapterResult<()> {
        info!("Connecting to LLM-Test-Bench at {}", self.endpoint);

        let channel = Channel::from_shared(self.endpoint.clone())
            .map_err(|e| AdapterError::ConnectionError(e.to_string()))?
            .connect()
            .await
            .map_err(|e| AdapterError::ConnectionError(e.to_string()))?;

        self.client = Some(channel);
        info!("Successfully connected to LLM-Test-Bench");
        Ok(())
    }

    async fn ensure_connected(&mut self) -> AdapterResult<&Channel> {
        if self.client.is_none() {
            self.connect().await?;
        }

        self.client.as_ref().ok_or_else(|| {
            AdapterError::ConnectionError("Not connected to Test-Bench".to_string())
        })
    }

    async fn send_request<T: serde::Serialize, R: serde::de::DeserializeOwned>(
        &mut self,
        path: &str,
        request: &T,
    ) -> AdapterResult<R> {
        self.ensure_connected().await?;

        let url = format!("{}{}", self.endpoint, path);
        debug!("Sending request to {}", url);

        let client = reqwest::Client::new();
        let response = with_retry(3, || async {
            self.circuit_breaker.call(|| async {
                client
                    .post(&url)
                    .json(request)
                    .send()
                    .await
                    .map_err(|e| AdapterError::RequestFailed(e.to_string()))
            }).await
        }).await?;

        if !response.status().is_success() {
            let error_msg = format!("Request failed with status: {}", response.status());
            error!("{}", error_msg);
            return Err(AdapterError::RequestFailed(error_msg));
        }

        response
            .json::<R>()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))
    }
}

#[async_trait]
impl ModuleAdapter for TestBenchClient {
    async fn health_check(&self) -> AdapterResult<HealthStatus> {
        let url = format!("{}/health", self.endpoint);
        debug!("Health check at {}", url);

        let client = reqwest::Client::new();
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                Ok(HealthStatus::healthy("Test-Bench is operational"))
            }
            Ok(response) => {
                let msg = format!("Test-Bench returned status: {}", response.status());
                Ok(HealthStatus::unhealthy(msg))
            }
            Err(e) => {
                let msg = format!("Test-Bench unreachable: {}", e);
                Ok(HealthStatus::unhealthy(msg))
            }
        }
    }

    async fn execute(&self, request: serde_json::Value) -> AdapterResult<serde_json::Value> {
        let url = format!("{}/execute", self.endpoint);
        debug!("Executing request at {}", url);

        let client = reqwest::Client::new();
        let response = client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AdapterError::RequestFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AdapterError::RequestFailed(format!(
                "Execute failed with status: {}",
                response.status()
            )));
        }

        response
            .json()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))
    }

    async fn get_capabilities(&self) -> AdapterResult<ModuleCapabilities> {
        Ok(ModuleCapabilities {
            name: "LLM-Test-Bench".to_string(),
            version: "0.1.0".to_string(),
            features: vec![
                "test_generation".to_string(),
                "test_execution".to_string(),
                "coverage_analysis".to_string(),
            ],
            endpoints: vec![
                "/generate_tests".to_string(),
                "/run_tests".to_string(),
                "/get_coverage".to_string(),
            ],
        })
    }
}

#[async_trait]
impl TestBenchAdapter for TestBenchClient {
    async fn generate_tests(&self, request: TestGenerationRequest) -> AdapterResult<TestGenerationResponse> {
        info!("Generating tests for {} code", request.language);

        let url = format!("{}/generate_tests", self.endpoint);
        let client = reqwest::Client::new();

        let response = with_retry(3, || async {
            client
                .post(&url)
                .json(&request)
                .send()
                .await
                .map_err(|e| AdapterError::RequestFailed(e.to_string()))
        }).await?;

        if !response.status().is_success() {
            return Err(AdapterError::RequestFailed(format!(
                "Test generation failed with status: {}",
                response.status()
            )));
        }

        let result = response
            .json::<TestGenerationResponse>()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))?;

        info!("Generated {} tests with {}% coverage estimate",
              result.test_count, result.coverage_estimate);

        Ok(result)
    }

    async fn run_tests(&self, request: TestExecutionRequest) -> AdapterResult<TestExecutionResponse> {
        info!("Running tests for {} using {}", request.language, request.test_framework);

        let url = format!("{}/run_tests", self.endpoint);
        let client = reqwest::Client::new();

        let response = with_retry(2, || async {
            client
                .post(&url)
                .json(&request)
                .send()
                .await
                .map_err(|e| AdapterError::RequestFailed(e.to_string()))
        }).await?;

        if !response.status().is_success() {
            return Err(AdapterError::RequestFailed(format!(
                "Test execution failed with status: {}",
                response.status()
            )));
        }

        let result = response
            .json::<TestExecutionResponse>()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))?;

        info!("Test execution completed: {}/{} passed in {}ms",
              result.passed_tests, result.total_tests, result.duration_ms);

        Ok(result)
    }

    async fn get_coverage(&self, request: CoverageRequest) -> AdapterResult<CoverageResponse> {
        info!("Calculating coverage for {} code", request.language);

        let url = format!("{}/get_coverage", self.endpoint);
        let client = reqwest::Client::new();

        let response = with_retry(3, || async {
            client
                .post(&url)
                .json(&request)
                .send()
                .await
                .map_err(|e| AdapterError::RequestFailed(e.to_string()))
        }).await?;

        if !response.status().is_success() {
            return Err(AdapterError::RequestFailed(format!(
                "Coverage analysis failed with status: {}",
                response.status()
            )));
        }

        let result = response
            .json::<CoverageResponse>()
            .await
            .map_err(|e| AdapterError::SerializationError(e.to_string()))?;

        info!("Coverage analysis: {:.2}% lines, {:.2}% branches, {:.2}% functions",
              result.line_coverage, result.branch_coverage, result.function_coverage);

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = TestBenchClient::new("http://localhost:50051");
        assert_eq!(client.endpoint, "http://localhost:50051");
    }

    #[tokio::test]
    async fn test_capabilities() {
        let client = TestBenchClient::new("http://localhost:50051");
        let caps = client.get_capabilities().await.unwrap();
        assert_eq!(caps.name, "LLM-Test-Bench");
        assert!(caps.features.contains(&"test_generation".to_string()));
    }
}
