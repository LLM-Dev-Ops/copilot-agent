//! Workflow execution engine with retry logic and timeout handling

use crate::step::{StepAction, StepResult, StepState, WorkflowStep};
use crate::{Result, WorkflowError};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{timeout, Duration};

/// Configuration for retry behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Initial backoff duration in milliseconds
    pub initial_backoff_ms: u64,
    /// Maximum backoff duration in milliseconds
    pub max_backoff_ms: u64,
    /// Backoff multiplier
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_backoff_ms: 1000,
            max_backoff_ms: 60000,
            backoff_multiplier: 2.0,
        }
    }
}

impl RetryConfig {
    /// Calculate backoff duration for a retry attempt
    pub fn calculate_backoff(&self, attempt: u32) -> Duration {
        let backoff_ms = (self.initial_backoff_ms as f64
            * self.backoff_multiplier.powi(attempt as i32))
        .min(self.max_backoff_ms as f64) as u64;

        Duration::from_millis(backoff_ms)
    }
}

/// Execution context for a workflow
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    /// Workflow ID
    pub workflow_id: String,
    /// Execution ID
    pub execution_id: String,
    /// Shared state across steps
    state: Arc<RwLock<HashMap<String, serde_json::Value>>>,
    /// Step outputs
    outputs: Arc<RwLock<HashMap<String, HashMap<String, serde_json::Value>>>>,
}

impl ExecutionContext {
    /// Create a new execution context
    pub fn new(workflow_id: impl Into<String>, execution_id: impl Into<String>) -> Self {
        Self {
            workflow_id: workflow_id.into(),
            execution_id: execution_id.into(),
            state: Arc::new(RwLock::new(HashMap::new())),
            outputs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get a value from the shared state
    pub async fn get_state(&self, key: &str) -> Option<serde_json::Value> {
        let state = self.state.read().await;
        state.get(key).cloned()
    }

    /// Set a value in the shared state
    pub async fn set_state(&self, key: impl Into<String>, value: serde_json::Value) {
        let mut state = self.state.write().await;
        state.insert(key.into(), value);
    }

    /// Get all state
    pub async fn get_all_state(&self) -> HashMap<String, serde_json::Value> {
        let state = self.state.read().await;
        state.clone()
    }

    /// Get outputs from a step
    pub async fn get_step_outputs(&self, step_id: &str) -> Option<HashMap<String, serde_json::Value>> {
        let outputs = self.outputs.read().await;
        outputs.get(step_id).cloned()
    }

    /// Store outputs from a step
    pub async fn set_step_outputs(
        &self,
        step_id: impl Into<String>,
        outputs: HashMap<String, serde_json::Value>,
    ) {
        let mut all_outputs = self.outputs.write().await;
        all_outputs.insert(step_id.into(), outputs);
    }

    /// Get all outputs
    pub async fn get_all_outputs(&self) -> HashMap<String, HashMap<String, serde_json::Value>> {
        let outputs = self.outputs.read().await;
        outputs.clone()
    }

    /// Clear all state and outputs
    pub async fn clear(&self) {
        let mut state = self.state.write().await;
        state.clear();
        let mut outputs = self.outputs.write().await;
        outputs.clear();
    }
}

/// Trait for executing workflow steps
#[async_trait]
pub trait StepExecutor: Send + Sync {
    /// Execute a workflow step
    async fn execute_step(
        &self,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<StepResult>;
}

/// Default step executor implementation
#[derive(Debug, Clone)]
pub struct DefaultStepExecutor {
    retry_config: RetryConfig,
}

impl Default for DefaultStepExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl DefaultStepExecutor {
    /// Create a new default step executor
    pub fn new() -> Self {
        Self {
            retry_config: RetryConfig::default(),
        }
    }

    /// Create with custom retry configuration
    pub fn with_retry_config(retry_config: RetryConfig) -> Self {
        Self { retry_config }
    }

    /// Execute a step with retry logic
    async fn execute_with_retry(
        &self,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<StepResult> {
        let max_retries = if step.retry_enabled {
            step.max_retries
        } else {
            0
        };

        let mut last_error = None;
        let mut retry_count = 0;

        loop {
            tracing::debug!(
                step_id = %step.id,
                attempt = retry_count + 1,
                "Executing step"
            );

            let result = self.execute_step_once(step, context).await;

            match result {
                Ok(step_result) => {
                    if step_result.is_success() {
                        return Ok(step_result);
                    } else if retry_count < max_retries {
                        last_error = step_result.error.clone();
                        retry_count += 1;

                        let backoff = self.retry_config.calculate_backoff(retry_count - 1);
                        tracing::warn!(
                            step_id = %step.id,
                            retry_count,
                            backoff_ms = backoff.as_millis(),
                            error = ?step_result.error,
                            "Step failed, retrying"
                        );

                        tokio::time::sleep(backoff).await;
                    } else {
                        return Ok(step_result);
                    }
                }
                Err(e) => {
                    if retry_count < max_retries {
                        last_error = Some(e.to_string());
                        retry_count += 1;

                        let backoff = self.retry_config.calculate_backoff(retry_count - 1);
                        tracing::warn!(
                            step_id = %step.id,
                            retry_count,
                            backoff_ms = backoff.as_millis(),
                            error = %e,
                            "Step execution error, retrying"
                        );

                        tokio::time::sleep(backoff).await;
                    } else {
                        return Err(e);
                    }
                }
            }
        }
    }

    /// Execute a step once (without retry)
    async fn execute_step_once(
        &self,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<StepResult> {
        let mut result = StepResult::pending(step.id.clone());
        result.state = StepState::Running;

        // Apply timeout if configured
        let execution = async {
            match &step.action {
                StepAction::Command { command, args, env } => {
                    self.execute_command(command, args, env, context).await
                }
                StepAction::Script { language, code } => {
                    self.execute_script(language, code, context).await
                }
                StepAction::HttpRequest { method, url, headers, body } => {
                    self.execute_http_request(method, url, headers, body.as_deref(), context).await
                }
                StepAction::AgentInvoke { agent_id, parameters } => {
                    self.execute_agent_invoke(agent_id, parameters, context).await
                }
                StepAction::Condition { expression, true_steps, false_steps } => {
                    self.execute_condition(expression, true_steps, false_steps, context).await
                }
                StepAction::Wait { duration_secs } => {
                    self.execute_wait(*duration_secs).await
                }
                StepAction::Custom { handler, parameters } => {
                    self.execute_custom(handler, parameters, context).await
                }
            }
        };

        let execution_result = if let Some(timeout_secs) = step.timeout_secs {
            match timeout(Duration::from_secs(timeout_secs), execution).await {
                Ok(r) => r,
                Err(_) => {
                    return Ok(result.fail(format!(
                        "Step timed out after {} seconds",
                        timeout_secs
                    )));
                }
            }
        } else {
            execution.await
        };

        match execution_result {
            Ok(outputs) => {
                context.set_step_outputs(&step.id, outputs.clone()).await;
                Ok(result.complete(outputs))
            }
            Err(e) => {
                Ok(result.fail(e.to_string()))
            }
        }
    }

    async fn execute_command(
        &self,
        command: &str,
        args: &[String],
        env: &HashMap<String, String>,
        _context: &ExecutionContext,
    ) -> Result<HashMap<String, serde_json::Value>> {
        tracing::info!(command, ?args, "Executing command");

        // In a real implementation, this would execute the command
        // For now, return a mock success
        let mut outputs = HashMap::new();
        outputs.insert("stdout".to_string(), serde_json::json!(""));
        outputs.insert("stderr".to_string(), serde_json::json!(""));
        outputs.insert("exit_code".to_string(), serde_json::json!(0));

        Ok(outputs)
    }

    async fn execute_script(
        &self,
        language: &str,
        code: &str,
        _context: &ExecutionContext,
    ) -> Result<HashMap<String, serde_json::Value>> {
        tracing::info!(language, "Executing script");

        // Mock implementation
        let mut outputs = HashMap::new();
        outputs.insert("result".to_string(), serde_json::json!("success"));

        Ok(outputs)
    }

    async fn execute_http_request(
        &self,
        method: &str,
        url: &str,
        headers: &HashMap<String, String>,
        body: Option<&str>,
        _context: &ExecutionContext,
    ) -> Result<HashMap<String, serde_json::Value>> {
        tracing::info!(method, url, "Executing HTTP request");

        // Mock implementation
        let mut outputs = HashMap::new();
        outputs.insert("status_code".to_string(), serde_json::json!(200));
        outputs.insert("body".to_string(), serde_json::json!("{}"));

        Ok(outputs)
    }

    async fn execute_agent_invoke(
        &self,
        agent_id: &str,
        parameters: &HashMap<String, serde_json::Value>,
        _context: &ExecutionContext,
    ) -> Result<HashMap<String, serde_json::Value>> {
        tracing::info!(agent_id, "Invoking agent");

        // Mock implementation
        let mut outputs = HashMap::new();
        outputs.insert("agent_response".to_string(), serde_json::json!({}));

        Ok(outputs)
    }

    async fn execute_condition(
        &self,
        expression: &str,
        true_steps: &[String],
        false_steps: &[String],
        _context: &ExecutionContext,
    ) -> Result<HashMap<String, serde_json::Value>> {
        tracing::info!(expression, "Evaluating condition");

        // Mock implementation - always returns true
        let mut outputs = HashMap::new();
        outputs.insert("condition_result".to_string(), serde_json::json!(true));
        outputs.insert("next_steps".to_string(), serde_json::json!(true_steps));

        Ok(outputs)
    }

    async fn execute_wait(&self, duration_secs: u64) -> Result<HashMap<String, serde_json::Value>> {
        tracing::info!(duration_secs, "Waiting");

        tokio::time::sleep(Duration::from_secs(duration_secs)).await;

        let mut outputs = HashMap::new();
        outputs.insert("waited_secs".to_string(), serde_json::json!(duration_secs));

        Ok(outputs)
    }

    async fn execute_custom(
        &self,
        handler: &str,
        parameters: &HashMap<String, serde_json::Value>,
        _context: &ExecutionContext,
    ) -> Result<HashMap<String, serde_json::Value>> {
        tracing::info!(handler, "Executing custom action");

        // Mock implementation
        let mut outputs = HashMap::new();
        outputs.insert("custom_result".to_string(), serde_json::json!({}));

        Ok(outputs)
    }
}

#[async_trait]
impl StepExecutor for DefaultStepExecutor {
    async fn execute_step(
        &self,
        step: &WorkflowStep,
        context: &ExecutionContext,
    ) -> Result<StepResult> {
        self.execute_with_retry(step, context).await
    }
}

/// Execute multiple steps in parallel
pub async fn execute_parallel_steps(
    steps: Vec<WorkflowStep>,
    executor: Arc<dyn StepExecutor>,
    context: ExecutionContext,
) -> Vec<Result<StepResult>> {
    let mut handles = Vec::new();

    for step in steps {
        let executor = executor.clone();
        let context = context.clone();

        let handle = tokio::spawn(async move {
            executor.execute_step(&step, &context).await
        });

        handles.push(handle);
    }

    let mut results = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(result) => results.push(result),
            Err(e) => results.push(Err(WorkflowError::StepExecutionFailed {
                step_id: "unknown".to_string(),
                reason: e.to_string(),
            })),
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::step::{StepType, StepAction};

    #[tokio::test]
    async fn test_execution_context() {
        let ctx = ExecutionContext::new("wf1", "exec1");

        ctx.set_state("key1", serde_json::json!("value1")).await;
        let value = ctx.get_state("key1").await;
        assert_eq!(value, Some(serde_json::json!("value1")));
    }

    #[tokio::test]
    async fn test_step_execution() {
        let executor = DefaultStepExecutor::new();
        let context = ExecutionContext::new("wf1", "exec1");

        let step = WorkflowStep::new(
            "test_step",
            StepType::Action,
            StepAction::Wait { duration_secs: 0 },
        );

        let result = executor.execute_step(&step, &context).await.unwrap();
        assert_eq!(result.state, StepState::Completed);
    }

    #[tokio::test]
    async fn test_retry_config() {
        let config = RetryConfig::default();

        let backoff1 = config.calculate_backoff(0);
        let backoff2 = config.calculate_backoff(1);
        let backoff3 = config.calculate_backoff(2);

        assert!(backoff2 > backoff1);
        assert!(backoff3 > backoff2);
    }
}
