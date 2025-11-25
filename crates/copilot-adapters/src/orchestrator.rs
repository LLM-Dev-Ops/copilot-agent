use async_trait::async_trait;
use reqwest::Client;
use tracing::{debug, error, info};

use crate::{
    AdapterError, AdapterResult, HealthStatus, ModuleCapabilities,
    traits::{
        ModuleAdapter, OrchestratorAdapter, TriggerWorkflowRequest, WorkflowExecution,
        WorkflowStatusRequest, CancelWorkflowRequest,
    },
    circuit_breaker::CircuitBreaker,
    retry::with_retry,
};

pub struct OrchestratorClient {
    base_url: String,
    client: Client,
    circuit_breaker: CircuitBreaker,
}

impl OrchestratorClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            client: Client::new(),
            circuit_breaker: CircuitBreaker::default(),
        }
    }

    async fn send_request<T: serde::Serialize, R: serde::de::DeserializeOwned>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<&T>,
    ) -> AdapterResult<R> {
        let url = format!("{}{}", self.base_url, path);
        debug!("Sending {} request to {}", method, url);

        let response = with_retry(3, || async {
            self.circuit_breaker.call(|| async {
                let mut request = self.client.request(method.clone(), &url);

                if let Some(body) = body {
                    request = request.json(body);
                }

                request
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
impl ModuleAdapter for OrchestratorClient {
    async fn health_check(&self) -> AdapterResult<HealthStatus> {
        let url = format!("{}/health", self.base_url);
        debug!("Health check at {}", url);

        match self.client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                Ok(HealthStatus::healthy("Orchestrator is operational"))
            }
            Ok(response) => {
                let msg = format!("Orchestrator returned status: {}", response.status());
                Ok(HealthStatus::unhealthy(msg))
            }
            Err(e) => {
                let msg = format!("Orchestrator unreachable: {}", e);
                Ok(HealthStatus::unhealthy(msg))
            }
        }
    }

    async fn execute(&self, request: serde_json::Value) -> AdapterResult<serde_json::Value> {
        let url = format!("{}/execute", self.base_url);
        debug!("Executing request at {}", url);

        let response = self.client
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
            name: "LLM-Orchestrator".to_string(),
            version: "0.1.0".to_string(),
            features: vec![
                "workflow_orchestration".to_string(),
                "multi_step_automation".to_string(),
                "workflow_monitoring".to_string(),
                "workflow_cancellation".to_string(),
                "priority_scheduling".to_string(),
            ],
            endpoints: vec![
                "/workflows/trigger".to_string(),
                "/workflows/{execution_id}/status".to_string(),
                "/workflows/{execution_id}/cancel".to_string(),
            ],
        })
    }
}

#[async_trait]
impl OrchestratorAdapter for OrchestratorClient {
    async fn trigger_workflow(&self, request: TriggerWorkflowRequest) -> AdapterResult<WorkflowExecution> {
        info!("Triggering workflow: {}", request.workflow_id);
        debug!("Priority: {:?}", request.priority);
        debug!("Parameters: {:?}", request.parameters);

        let execution: WorkflowExecution = self.send_request(
            reqwest::Method::POST,
            "/workflows/trigger",
            Some(&request),
        ).await?;

        info!(
            "Workflow execution started: {} (status: {:?})",
            execution.execution_id,
            execution.status
        );

        Ok(execution)
    }

    async fn get_workflow_status(&self, request: WorkflowStatusRequest) -> AdapterResult<WorkflowExecution> {
        debug!("Getting workflow status: {}", request.execution_id);

        let path = format!("/workflows/{}/status", request.execution_id);
        let execution: WorkflowExecution = self.send_request(
            reqwest::Method::GET,
            &path,
            None::<&()>,
        ).await?;

        info!(
            "Workflow {} status: {:?} ({}/{} steps)",
            execution.execution_id,
            execution.status,
            execution.steps_completed,
            execution.steps_total
        );

        Ok(execution)
    }

    async fn cancel_workflow(&self, request: CancelWorkflowRequest) -> AdapterResult<WorkflowExecution> {
        info!("Cancelling workflow: {}", request.execution_id);
        if let Some(ref reason) = request.reason {
            debug!("Cancellation reason: {}", reason);
        }

        let path = format!("/workflows/{}/cancel", request.execution_id);
        let execution: WorkflowExecution = self.send_request(
            reqwest::Method::POST,
            &path,
            Some(&request),
        ).await?;

        info!(
            "Workflow {} cancelled (status: {:?})",
            execution.execution_id,
            execution.status
        );

        Ok(execution)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = OrchestratorClient::new("http://localhost:8081");
        assert_eq!(client.base_url, "http://localhost:8081");
    }

    #[tokio::test]
    async fn test_capabilities() {
        let client = OrchestratorClient::new("http://localhost:8081");
        let caps = client.get_capabilities().await.unwrap();
        assert_eq!(caps.name, "LLM-Orchestrator");
        assert!(caps.features.contains(&"workflow_orchestration".to_string()));
    }
}
