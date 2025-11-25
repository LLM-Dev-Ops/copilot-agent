//! Workflow step definitions and state management

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Type of workflow step
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepType {
    /// Execute an action
    Action,
    /// Conditional branching
    Condition,
    /// Approval gate - requires human approval
    Approval,
    /// Parallel execution of sub-steps
    Parallel,
    /// Wait/delay step
    Wait,
}

/// State of a workflow step
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepState {
    /// Step is waiting to be executed
    Pending,
    /// Step is currently executing
    Running,
    /// Step completed successfully
    Completed,
    /// Step failed
    Failed,
    /// Step was skipped (e.g., due to condition)
    Skipped,
    /// Step is waiting for approval
    WaitingApproval,
    /// Step is paused
    Paused,
}

/// Action to be performed in a step
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StepAction {
    /// Run a shell command
    Command {
        command: String,
        args: Vec<String>,
        #[serde(default)]
        env: HashMap<String, String>,
    },
    /// Execute a script
    Script {
        language: String,
        code: String,
    },
    /// Make an HTTP request
    HttpRequest {
        method: String,
        url: String,
        #[serde(default)]
        headers: HashMap<String, String>,
        #[serde(default)]
        body: Option<String>,
    },
    /// Invoke an LLM agent
    AgentInvoke {
        agent_id: String,
        #[serde(default)]
        parameters: HashMap<String, serde_json::Value>,
    },
    /// Conditional evaluation
    Condition {
        expression: String,
        #[serde(default)]
        true_steps: Vec<String>,
        #[serde(default)]
        false_steps: Vec<String>,
    },
    /// Wait for a duration
    Wait {
        duration_secs: u64,
    },
    /// Custom action
    Custom {
        handler: String,
        #[serde(default)]
        parameters: HashMap<String, serde_json::Value>,
    },
}

/// Result of step execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    /// Step ID
    pub step_id: String,
    /// Final state of the step
    pub state: StepState,
    /// Output data from the step
    #[serde(default)]
    pub outputs: HashMap<String, serde_json::Value>,
    /// Error message if failed
    #[serde(default)]
    pub error: Option<String>,
    /// Execution start time
    pub started_at: chrono::DateTime<chrono::Utc>,
    /// Execution end time
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Number of retry attempts
    #[serde(default)]
    pub retry_count: u32,
}

impl StepResult {
    /// Create a new pending result
    pub fn pending(step_id: String) -> Self {
        Self {
            step_id,
            state: StepState::Pending,
            outputs: HashMap::new(),
            error: None,
            started_at: chrono::Utc::now(),
            completed_at: None,
            retry_count: 0,
        }
    }

    /// Mark as completed successfully
    pub fn complete(mut self, outputs: HashMap<String, serde_json::Value>) -> Self {
        self.state = StepState::Completed;
        self.outputs = outputs;
        self.completed_at = Some(chrono::Utc::now());
        self
    }

    /// Mark as failed
    pub fn fail(mut self, error: String) -> Self {
        self.state = StepState::Failed;
        self.error = Some(error);
        self.completed_at = Some(chrono::Utc::now());
        self
    }

    /// Mark as skipped
    pub fn skip(mut self) -> Self {
        self.state = StepState::Skipped;
        self.completed_at = Some(chrono::Utc::now());
        self
    }

    /// Check if step is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(
            self.state,
            StepState::Completed | StepState::Failed | StepState::Skipped
        )
    }

    /// Check if step succeeded
    pub fn is_success(&self) -> bool {
        self.state == StepState::Completed
    }
}

/// Configuration for a workflow step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    /// Unique step identifier
    pub id: String,
    /// Human-readable step name
    pub name: String,
    /// Type of step
    pub step_type: StepType,
    /// Action to perform
    pub action: StepAction,
    /// Step IDs that must complete before this step
    #[serde(default)]
    pub dependencies: Vec<String>,
    /// Maximum execution time in seconds
    #[serde(default)]
    pub timeout_secs: Option<u64>,
    /// Whether to retry on failure
    #[serde(default)]
    pub retry_enabled: bool,
    /// Maximum retry attempts
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    /// Whether step failure should fail the entire workflow
    #[serde(default = "default_true")]
    pub fail_on_error: bool,
    /// Metadata for the step
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

fn default_max_retries() -> u32 {
    3
}

fn default_true() -> bool {
    true
}

impl WorkflowStep {
    /// Create a new workflow step
    pub fn new(name: impl Into<String>, step_type: StepType, action: StepAction) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            step_type,
            action,
            dependencies: Vec::new(),
            timeout_secs: None,
            retry_enabled: false,
            max_retries: 3,
            fail_on_error: true,
            metadata: HashMap::new(),
        }
    }

    /// Set step ID
    pub fn with_id(mut self, id: impl Into<String>) -> Self {
        self.id = id.into();
        self
    }

    /// Add a dependency
    pub fn with_dependency(mut self, dep: impl Into<String>) -> Self {
        self.dependencies.push(dep.into());
        self
    }

    /// Set dependencies
    pub fn with_dependencies(mut self, deps: Vec<String>) -> Self {
        self.dependencies = deps;
        self
    }

    /// Set timeout
    pub fn with_timeout(mut self, timeout_secs: u64) -> Self {
        self.timeout_secs = Some(timeout_secs);
        self
    }

    /// Enable retry
    pub fn with_retry(mut self, max_retries: u32) -> Self {
        self.retry_enabled = true;
        self.max_retries = max_retries;
        self
    }

    /// Set fail on error behavior
    pub fn with_fail_on_error(mut self, fail: bool) -> Self {
        self.fail_on_error = fail;
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.metadata.insert(key.into(), value);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_step_result_lifecycle() {
        let result = StepResult::pending("step1".to_string());
        assert_eq!(result.state, StepState::Pending);
        assert!(!result.is_terminal());

        let result = result.complete(HashMap::new());
        assert_eq!(result.state, StepState::Completed);
        assert!(result.is_terminal());
        assert!(result.is_success());
    }

    #[test]
    fn test_workflow_step_builder() {
        let step = WorkflowStep::new(
            "test_step",
            StepType::Action,
            StepAction::Wait { duration_secs: 10 },
        )
        .with_id("step1")
        .with_dependency("step0")
        .with_timeout(30)
        .with_retry(3);

        assert_eq!(step.id, "step1");
        assert_eq!(step.name, "test_step");
        assert_eq!(step.dependencies, vec!["step0"]);
        assert_eq!(step.timeout_secs, Some(30));
        assert!(step.retry_enabled);
        assert_eq!(step.max_retries, 3);
    }
}
