//! Mock builders for testing
//!
//! This module provides mock implementations of various components.

use async_trait::async_trait;
use copilot_core::{error::CopilotError, types::*};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Mock LLM provider for testing
#[derive(Clone)]
pub struct MockLLMProvider {
    responses: Arc<Mutex<Vec<String>>>,
    call_count: Arc<Mutex<usize>>,
}

impl MockLLMProvider {
    pub fn new() -> Self {
        Self {
            responses: Arc::new(Mutex::new(Vec::new())),
            call_count: Arc::new(Mutex::new(0)),
        }
    }

    pub fn with_response(mut self, response: impl Into<String>) -> Self {
        self.responses.lock().unwrap().push(response.into());
        self
    }

    pub fn with_responses(mut self, responses: Vec<String>) -> Self {
        *self.responses.lock().unwrap() = responses;
        self
    }

    pub fn call_count(&self) -> usize {
        *self.call_count.lock().unwrap()
    }

    pub async fn generate(&self, _prompt: &str) -> Result<String, CopilotError> {
        let mut count = self.call_count.lock().unwrap();
        *count += 1;

        let responses = self.responses.lock().unwrap();
        if responses.is_empty() {
            return Ok("Mock response".to_string());
        }

        let index = (*count - 1) % responses.len();
        Ok(responses[index].clone())
    }
}

impl Default for MockLLMProvider {
    fn default() -> Self {
        Self::new()
    }
}

/// Mock context retriever for testing
#[derive(Clone)]
pub struct MockContextRetriever {
    documents: Arc<Mutex<HashMap<String, String>>>,
    query_count: Arc<Mutex<usize>>,
}

impl MockContextRetriever {
    pub fn new() -> Self {
        Self {
            documents: Arc::new(Mutex::new(HashMap::new())),
            query_count: Arc::new(Mutex::new(0)),
        }
    }

    pub fn with_document(self, id: impl Into<String>, content: impl Into<String>) -> Self {
        self.documents
            .lock()
            .unwrap()
            .insert(id.into(), content.into());
        self
    }

    pub fn query_count(&self) -> usize {
        *self.query_count.lock().unwrap()
    }

    pub async fn retrieve(&self, _query: &str, k: usize) -> Result<Vec<String>, CopilotError> {
        let mut count = self.query_count.lock().unwrap();
        *count += 1;

        let docs = self.documents.lock().unwrap();
        let results: Vec<String> = docs.values().take(k).cloned().collect();
        Ok(results)
    }
}

impl Default for MockContextRetriever {
    fn default() -> Self {
        Self::new()
    }
}

/// Mock intent classifier for testing
#[derive(Clone)]
pub struct MockIntentClassifier {
    intents: Arc<Mutex<HashMap<String, Intent>>>,
}

impl MockIntentClassifier {
    pub fn new() -> Self {
        Self {
            intents: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn with_intent(self, query: impl Into<String>, intent: Intent) -> Self {
        self.intents.lock().unwrap().insert(query.into(), intent);
        self
    }

    pub fn classify(&self, query: &str) -> Intent {
        let intents = self.intents.lock().unwrap();
        intents
            .get(query)
            .cloned()
            .unwrap_or_else(|| Intent::new(IntentCategory::Unknown, 0.5))
    }
}

impl Default for MockIntentClassifier {
    fn default() -> Self {
        Self::new()
    }
}

/// Mock entity extractor for testing
#[derive(Clone)]
pub struct MockEntityExtractor {
    entities: Arc<Mutex<HashMap<String, Vec<Entity>>>>,
}

impl MockEntityExtractor {
    pub fn new() -> Self {
        Self {
            entities: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn with_entities(self, query: impl Into<String>, entities: Vec<Entity>) -> Self {
        self.entities.lock().unwrap().insert(query.into(), entities);
        self
    }

    pub fn extract(&self, query: &str) -> Vec<Entity> {
        let entities = self.entities.lock().unwrap();
        entities.get(query).cloned().unwrap_or_default()
    }
}

impl Default for MockEntityExtractor {
    fn default() -> Self {
        Self::new()
    }
}

/// Mock workflow engine for testing
#[derive(Clone)]
pub struct MockWorkflowEngine {
    executions: Arc<Mutex<HashMap<String, WorkflowExecutionStatus>>>,
}

impl MockWorkflowEngine {
    pub fn new() -> Self {
        Self {
            executions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn execute(&self, workflow_id: &str) -> Result<String, CopilotError> {
        let execution_id = format!("exec_{}", uuid::Uuid::new_v4());
        let mut executions = self.executions.lock().unwrap();
        executions.insert(
            execution_id.clone(),
            WorkflowExecutionStatus {
                id: execution_id.clone(),
                workflow_id: workflow_id.to_string(),
                status: ExecutionStatus::Running,
                completed_steps: Vec::new(),
                running_steps: Vec::new(),
                failed_steps: Vec::new(),
            },
        );
        Ok(execution_id)
    }

    pub async fn get_status(&self, execution_id: &str) -> Option<WorkflowExecutionStatus> {
        let executions = self.executions.lock().unwrap();
        executions.get(execution_id).cloned()
    }

    pub async fn complete_step(&self, execution_id: &str, step_id: &str) {
        let mut executions = self.executions.lock().unwrap();
        if let Some(status) = executions.get_mut(execution_id) {
            status.completed_steps.push(step_id.to_string());
            status.running_steps.retain(|s| s != step_id);
        }
    }
}

impl Default for MockWorkflowEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct WorkflowExecutionStatus {
    pub id: String,
    pub workflow_id: String,
    pub status: ExecutionStatus,
    pub completed_steps: Vec<String>,
    pub running_steps: Vec<String>,
    pub failed_steps: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ExecutionStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Mock database for testing
#[derive(Clone)]
pub struct MockDatabase {
    data: Arc<Mutex<HashMap<String, serde_json::Value>>>,
}

impl MockDatabase {
    pub fn new() -> Self {
        Self {
            data: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn get(&self, key: &str) -> Option<serde_json::Value> {
        let data = self.data.lock().unwrap();
        data.get(key).cloned()
    }

    pub async fn set(&self, key: impl Into<String>, value: serde_json::Value) {
        let mut data = self.data.lock().unwrap();
        data.insert(key.into(), value);
    }

    pub async fn delete(&self, key: &str) -> bool {
        let mut data = self.data.lock().unwrap();
        data.remove(key).is_some()
    }

    pub async fn exists(&self, key: &str) -> bool {
        let data = self.data.lock().unwrap();
        data.contains_key(key)
    }

    pub fn len(&self) -> usize {
        let data = self.data.lock().unwrap();
        data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl Default for MockDatabase {
    fn default() -> Self {
        Self::new()
    }
}

/// Mock HTTP client for testing
#[derive(Clone)]
pub struct MockHttpClient {
    responses: Arc<Mutex<HashMap<String, String>>>,
    requests: Arc<Mutex<Vec<String>>>,
}

impl MockHttpClient {
    pub fn new() -> Self {
        Self {
            responses: Arc::new(Mutex::new(HashMap::new())),
            requests: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn with_response(self, url: impl Into<String>, response: impl Into<String>) -> Self {
        self.responses
            .lock()
            .unwrap()
            .insert(url.into(), response.into());
        self
    }

    pub async fn get(&self, url: &str) -> Result<String, CopilotError> {
        self.requests.lock().unwrap().push(url.to_string());
        let responses = self.responses.lock().unwrap();
        responses
            .get(url)
            .cloned()
            .ok_or_else(|| CopilotError::NotFound(format!("No mock response for {}", url)))
    }

    pub fn request_count(&self) -> usize {
        self.requests.lock().unwrap().len()
    }

    pub fn requests(&self) -> Vec<String> {
        self.requests.lock().unwrap().clone()
    }
}

impl Default for MockHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_llm_provider() {
        let provider = MockLLMProvider::new()
            .with_response("Response 1")
            .with_response("Response 2");

        let resp1 = provider.generate("test").await.unwrap();
        assert_eq!(resp1, "Response 1");

        let resp2 = provider.generate("test").await.unwrap();
        assert_eq!(resp2, "Response 2");

        assert_eq!(provider.call_count(), 2);
    }

    #[tokio::test]
    async fn test_mock_context_retriever() {
        let retriever = MockContextRetriever::new()
            .with_document("doc1", "Content 1")
            .with_document("doc2", "Content 2");

        let results = retriever.retrieve("test query", 2).await.unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(retriever.query_count(), 1);
    }

    #[test]
    fn test_mock_intent_classifier() {
        let classifier = MockIntentClassifier::new().with_intent(
            "show cpu",
            Intent::new(IntentCategory::MetricQuery, 0.95),
        );

        let intent = classifier.classify("show cpu");
        assert_eq!(intent.category, IntentCategory::MetricQuery);
        assert!(intent.confidence > 0.9);
    }

    #[tokio::test]
    async fn test_mock_database() {
        let db = MockDatabase::new();

        db.set("key1", serde_json::json!("value1")).await;
        assert!(db.exists("key1").await);

        let value = db.get("key1").await.unwrap();
        assert_eq!(value, serde_json::json!("value1"));

        assert!(db.delete("key1").await);
        assert!(!db.exists("key1").await);
    }

    #[tokio::test]
    async fn test_mock_http_client() {
        let client = MockHttpClient::new()
            .with_response("http://api.example.com/test", r#"{"status":"ok"}"#);

        let response = client.get("http://api.example.com/test").await.unwrap();
        assert_eq!(response, r#"{"status":"ok"}"#);
        assert_eq!(client.request_count(), 1);
    }
}
