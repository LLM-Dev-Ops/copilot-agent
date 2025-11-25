use async_trait::async_trait;
use reqwest::Client;
use tracing::{debug, error, info};

use crate::{
    AdapterError, AdapterResult, HealthStatus, ModuleCapabilities,
    traits::{
        ModuleAdapter, IncidentAdapter, CreateIncidentRequest, Incident,
        UpdateIncidentRequest, RunbookExecutionRequest, RunbookExecutionResponse,
    },
    circuit_breaker::CircuitBreaker,
    retry::with_retry,
};

pub struct IncidentClient {
    base_url: String,
    client: Client,
    circuit_breaker: CircuitBreaker,
}

impl IncidentClient {
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
impl ModuleAdapter for IncidentClient {
    async fn health_check(&self) -> AdapterResult<HealthStatus> {
        let url = format!("{}/health", self.base_url);
        debug!("Health check at {}", url);

        match self.client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                Ok(HealthStatus::healthy("Incident Manager is operational"))
            }
            Ok(response) => {
                let msg = format!("Incident Manager returned status: {}", response.status());
                Ok(HealthStatus::unhealthy(msg))
            }
            Err(e) => {
                let msg = format!("Incident Manager unreachable: {}", e);
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
            name: "LLM-Incident-Manager".to_string(),
            version: "0.1.0".to_string(),
            features: vec![
                "incident_creation".to_string(),
                "incident_tracking".to_string(),
                "runbook_execution".to_string(),
                "automated_remediation".to_string(),
                "incident_analytics".to_string(),
            ],
            endpoints: vec![
                "/incidents".to_string(),
                "/incidents/{id}".to_string(),
                "/incidents/{id}/runbook".to_string(),
            ],
        })
    }
}

#[async_trait]
impl IncidentAdapter for IncidentClient {
    async fn create_incident(&self, request: CreateIncidentRequest) -> AdapterResult<Incident> {
        info!("Creating incident: {}", request.title);
        debug!("Incident severity: {:?}", request.severity);
        debug!("Affected services: {:?}", request.affected_services);

        let incident: Incident = self.send_request(
            reqwest::Method::POST,
            "/incidents",
            Some(&request),
        ).await?;

        info!("Created incident with ID: {}", incident.id);
        Ok(incident)
    }

    async fn update_incident(&self, request: UpdateIncidentRequest) -> AdapterResult<Incident> {
        info!("Updating incident: {}", request.incident_id);

        if let Some(ref status) = request.status {
            debug!("New status: {:?}", status);
        }

        let path = format!("/incidents/{}", request.incident_id);
        let incident: Incident = self.send_request(
            reqwest::Method::PATCH,
            &path,
            Some(&request),
        ).await?;

        info!("Updated incident {}: {:?}", incident.id, incident.status);
        Ok(incident)
    }

    async fn execute_runbook(&self, request: RunbookExecutionRequest) -> AdapterResult<RunbookExecutionResponse> {
        info!(
            "Executing runbook {} for incident {}",
            request.runbook_id,
            request.incident_id
        );
        debug!("Runbook parameters: {:?}", request.parameters);

        let path = format!("/incidents/{}/runbook", request.incident_id);
        let response: RunbookExecutionResponse = self.send_request(
            reqwest::Method::POST,
            &path,
            Some(&request),
        ).await?;

        info!(
            "Runbook execution started: {} ({}/{} steps completed)",
            response.execution_id,
            response.steps_completed,
            response.steps_total
        );

        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = IncidentClient::new("http://localhost:8080");
        assert_eq!(client.base_url, "http://localhost:8080");
    }

    #[tokio::test]
    async fn test_capabilities() {
        let client = IncidentClient::new("http://localhost:8080");
        let caps = client.get_capabilities().await.unwrap();
        assert_eq!(caps.name, "LLM-Incident-Manager");
        assert!(caps.features.contains(&"incident_creation".to_string()));
    }
}
