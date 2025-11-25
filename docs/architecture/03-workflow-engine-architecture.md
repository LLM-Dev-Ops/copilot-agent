# Workflow Engine Architecture

## Overview
The Workflow Engine orchestrates complex multi-step operations using DAG-based execution, state machines, and checkpoint-based recovery. It supports parallel execution, conditional branching, approval gates, and automatic retries.

## Component Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        Workflow Engine                             │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  Workflow Parser                          │    │
│  │  - YAML/JSON parsing                                      │    │
│  │  - Validation                                             │    │
│  │  - Schema verification                                    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                       │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  DAG Builder                              │    │
│  │  - Dependency analysis                                    │    │
│  │  - Topological sorting                                    │    │
│  │  - Cycle detection                                        │    │
│  │  - Parallelization optimization                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                       │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  State Machine                            │    │
│  │                                                           │    │
│  │   ┌─────────┐    ┌─────────┐    ┌──────────┐           │    │
│  │   │ Pending │───▶│ Running │───▶│Completed │           │    │
│  │   └─────────┘    └─────────┘    └──────────┘           │    │
│  │        │              │               │                  │    │
│  │        │              ▼               │                  │    │
│  │        │         ┌─────────┐          │                  │    │
│  │        └────────▶│ Failed  │◀─────────┘                  │    │
│  │                  └─────────┘                             │    │
│  │                       │                                  │    │
│  │                       ▼                                  │    │
│  │                  ┌─────────┐                             │    │
│  │                  │ Retrying│                             │    │
│  │                  └─────────┘                             │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                       │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  Task Executor                            │    │
│  │                                                           │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │Sequential│  │ Parallel │  │Conditional│              │    │
│  │  │Executor  │  │ Executor │  │ Executor │              │    │
│  │  └──────────┘  └──────────┘  └──────────┘              │    │
│  │                                                           │    │
│  │  ┌──────────────────────────────────────────────┐       │    │
│  │  │         Execution Context                     │       │    │
│  │  │  - Variables                                  │       │    │
│  │  │  - Outputs from previous tasks                │       │    │
│  │  │  - Environment config                         │       │    │
│  │  └──────────────────────────────────────────────┘       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                       │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  Checkpoint Manager                       │    │
│  │  - State snapshots                                        │    │
│  │  - Progress tracking                                      │    │
│  │  - Recovery points                                        │    │
│  │  - Rollback support                                       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                       │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  Approval System                          │    │
│  │  - Approval gates                                         │    │
│  │  - Notification service                                   │    │
│  │  - Timeout handling                                       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

## Workflow Execution Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    Workflow Execution                          │
└────────────────────────────────────────────────────────────────┘

1. Parse & Validate
   ┌──────────────┐
   │ YAML/JSON    │
   │ Definition   │
   └──────────────┘
          │
          ▼
   [Validate Schema]
          │
          ▼
   [Check Dependencies]
          │
          ▼
2. Build DAG
   ┌──────────────────────────────────┐
   │         Task Graph               │
   │                                  │
   │    A ─────┐                      │
   │           ▼                      │
   │    B ───▶ D ───▶ F              │
   │           ▲                      │
   │    C ─────┘                      │
   │                                  │
   └──────────────────────────────────┘
          │
          ▼
3. Topological Sort
   Execution Order: [A, B, C] → [D] → [F]
          │
          ▼
4. Execute Batches
   ┌─────────────────────────────────┐
   │ Batch 1: A, B, C (parallel)     │
   └─────────────────────────────────┘
          │
          ▼ (all completed)
   ┌─────────────────────────────────┐
   │ Batch 2: D                      │
   └─────────────────────────────────┘
          │
          ▼ (approval gate?)
   ┌─────────────────────────────────┐
   │ Wait for Approval               │
   └─────────────────────────────────┘
          │
          ▼ (approved)
   ┌─────────────────────────────────┐
   │ Batch 3: F                      │
   └─────────────────────────────────┘
          │
          ▼
5. Complete
   [Store Results]
   [Clean Up Resources]
   [Send Notifications]
```

## State Machine

```
┌────────────────────────────────────────────────────────────────┐
│                  Workflow State Machine                        │
└────────────────────────────────────────────────────────────────┘

                    ┌───────────┐
                    │  DRAFT    │ (initial)
                    └───────────┘
                         │
                         │ validate()
                         ▼
                    ┌───────────┐
                    │ VALIDATED │
                    └───────────┘
                         │
                         │ submit()
                         ▼
                    ┌───────────┐
                    │  PENDING  │
                    └───────────┘
                         │
                         │ start()
                         ▼
    ┌────────────────────────────────────────┐
    │              RUNNING                    │
    │                                        │
    │  Substates:                            │
    │  - ExecutingTasks                      │
    │  - WaitingApproval                     │
    │  - Retrying                            │
    └────────────────────────────────────────┘
         │         │           │
         │         │           │ (approval timeout)
         │         │           ▼
         │         │      ┌───────────┐
         │         │      │ CANCELLED │
         │         │      └───────────┘
         │         │
         │         │ (failure, retries exhausted)
         │         ▼
         │    ┌───────────┐
         │    │  FAILED   │────────┐
         │    └───────────┘        │
         │                          │ rollback()
         │                          ▼
         │                     ┌───────────┐
         │                     │ROLLED_BACK│
         │                     └───────────┘
         │
         │ (success)
         ▼
    ┌───────────┐
    │ COMPLETED │
    └───────────┘
         │
         │ archive()
         ▼
    ┌───────────┐
    │ ARCHIVED  │
    └───────────┘

State Transitions:
- DRAFT → VALIDATED: Schema validation passes
- VALIDATED → PENDING: Workflow submitted
- PENDING → RUNNING: Execution starts
- RUNNING → COMPLETED: All tasks succeed
- RUNNING → FAILED: Task fails after retries
- RUNNING → CANCELLED: User cancels or timeout
- FAILED → ROLLED_BACK: Rollback executed
- COMPLETED → ARCHIVED: After retention period
```

## Rust Trait Definitions

```rust
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use chrono::{DateTime, Utc};
use tokio::sync::RwLock;

/// Result type for workflow operations
pub type WorkflowResult<T> = Result<T, WorkflowError>;

/// Error types for workflow engine
#[derive(Error, Debug)]
pub enum WorkflowError {
    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Cycle detected in workflow graph")]
    CycleDetected,

    #[error("Task execution failed: {task_id}: {reason}")]
    TaskExecutionFailed { task_id: String, reason: String },

    #[error("Workflow not found: {0}")]
    WorkflowNotFound(String),

    #[error("Invalid state transition: {from} -> {to}")]
    InvalidStateTransition { from: String, to: String },

    #[error("Checkpoint error: {0}")]
    CheckpointError(String),

    #[error("Approval timeout: {0}")]
    ApprovalTimeout(String),

    #[error("Dependency not satisfied: {0}")]
    DependencyNotSatisfied(String),

    #[error("Storage error: {0}")]
    StorageError(String),
}

/// Workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub tasks: Vec<TaskDefinition>,
    pub variables: HashMap<String, serde_json::Value>,
    pub config: WorkflowConfig,
    pub metadata: HashMap<String, String>,
}

/// Task definition in workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDefinition {
    pub id: String,
    pub name: String,
    pub task_type: TaskType,
    pub depends_on: Vec<String>,
    pub config: TaskConfig,
    pub retry_policy: Option<RetryPolicy>,
    pub timeout: Option<std::time::Duration>,
    pub condition: Option<String>,  // Conditional execution
}

/// Type of task
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TaskType {
    /// Execute a command
    Command {
        command: String,
        args: Vec<String>,
        env: HashMap<String, String>,
    },

    /// Call HTTP endpoint
    Http {
        method: String,
        url: String,
        headers: HashMap<String, String>,
        body: Option<String>,
    },

    /// Execute a query
    Query {
        query_type: String,
        query: String,
        parameters: HashMap<String, String>,
    },

    /// Deploy operation
    Deploy {
        manifest: String,
        namespace: String,
        dry_run: bool,
    },

    /// Scale operation
    Scale {
        resource: String,
        replicas: i32,
    },

    /// Approval gate
    Approval {
        approvers: Vec<String>,
        timeout_seconds: u64,
        auto_approve: bool,
    },

    /// Conditional branch
    Conditional {
        condition: String,
        true_branch: Vec<String>,  // Task IDs
        false_branch: Vec<String>, // Task IDs
    },

    /// Loop over items
    Loop {
        items: String,  // Variable name or expression
        task_template: Box<TaskDefinition>,
        parallel: bool,
    },

    /// Subworkflow
    Subworkflow {
        workflow_id: String,
        inputs: HashMap<String, String>,
    },

    /// Custom plugin
    Plugin {
        plugin_name: String,
        config: serde_json::Value,
    },
}

/// Task configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskConfig {
    pub on_failure: FailureAction,
    pub collect_output: bool,
    pub stream_output: bool,
    pub checkpoint: bool,
}

impl Default for TaskConfig {
    fn default() -> Self {
        Self {
            on_failure: FailureAction::Fail,
            collect_output: true,
            stream_output: false,
            checkpoint: true,
        }
    }
}

/// Action to take on task failure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FailureAction {
    Fail,           // Fail entire workflow
    Continue,       // Continue to next task
    Retry,          // Retry with policy
    Rollback,       // Execute rollback
}

/// Retry policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
    pub retryable_errors: Vec<String>,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
            retryable_errors: vec![],
        }
    }
}

/// Workflow configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowConfig {
    pub max_parallel_tasks: usize,
    pub timeout_seconds: Option<u64>,
    pub checkpoint_interval_seconds: u64,
    pub enable_rollback: bool,
    pub notification_config: Option<NotificationConfig>,
}

impl Default for WorkflowConfig {
    fn default() -> Self {
        Self {
            max_parallel_tasks: 10,
            timeout_seconds: Some(3600),
            checkpoint_interval_seconds: 60,
            enable_rollback: true,
            notification_config: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub on_completion: Vec<String>,  // Email addresses
    pub on_failure: Vec<String>,
    pub webhook_url: Option<String>,
}

/// Workflow state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkflowState {
    Draft,
    Validated,
    Pending,
    Running,
    WaitingApproval,
    Paused,
    Completed,
    Failed,
    Cancelled,
    RolledBack,
    Archived,
}

/// Workflow instance (runtime)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowInstance {
    pub id: String,
    pub workflow_id: String,
    pub definition: WorkflowDefinition,
    pub state: WorkflowState,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_by: String,
    pub execution_context: ExecutionContext,
    pub task_states: HashMap<String, TaskState>,
    pub checkpoints: Vec<Checkpoint>,
    pub error: Option<String>,
}

/// Execution context for workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub variables: HashMap<String, serde_json::Value>,
    pub outputs: HashMap<String, TaskOutput>,
    pub environment: HashMap<String, String>,
}

/// Task state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskState {
    pub task_id: String,
    pub state: TaskStatus,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub attempts: u32,
    pub output: Option<TaskOutput>,
    pub error: Option<String>,
}

/// Task status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
    WaitingApproval,
}

/// Task output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskOutput {
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
    pub data: serde_json::Value,
    pub metrics: HashMap<String, f64>,
}

/// Checkpoint for recovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub workflow_state: WorkflowState,
    pub task_states: HashMap<String, TaskState>,
    pub execution_context: ExecutionContext,
}

/// DAG representation of workflow
#[derive(Debug, Clone)]
pub struct WorkflowDag {
    pub nodes: HashMap<String, DagNode>,
    pub edges: Vec<DagEdge>,
    pub execution_batches: Vec<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct DagNode {
    pub task_id: String,
    pub task_def: TaskDefinition,
    pub level: usize,  // Topological level
}

#[derive(Debug, Clone)]
pub struct DagEdge {
    pub from: String,
    pub to: String,
}

/// Workflow Parser trait
#[async_trait]
pub trait WorkflowParser: Send + Sync {
    /// Parse workflow from YAML
    async fn parse_yaml(&self, yaml: &str) -> WorkflowResult<WorkflowDefinition>;

    /// Parse workflow from JSON
    async fn parse_json(&self, json: &str) -> WorkflowResult<WorkflowDefinition>;

    /// Validate workflow definition
    async fn validate(&self, workflow: &WorkflowDefinition) -> WorkflowResult<()>;

    /// Convert to canonical format
    async fn normalize(&self, workflow: WorkflowDefinition) -> WorkflowResult<WorkflowDefinition>;
}

/// DAG Builder trait
#[async_trait]
pub trait DagBuilder: Send + Sync {
    /// Build DAG from workflow definition
    async fn build_dag(&self, workflow: &WorkflowDefinition) -> WorkflowResult<WorkflowDag>;

    /// Detect cycles in DAG
    fn detect_cycles(&self, dag: &WorkflowDag) -> WorkflowResult<()>;

    /// Topological sort
    fn topological_sort(&self, dag: &WorkflowDag) -> WorkflowResult<Vec<Vec<String>>>;

    /// Optimize for parallel execution
    fn optimize_parallelism(&self, dag: &mut WorkflowDag) -> WorkflowResult<()>;
}

/// Task Executor trait
#[async_trait]
pub trait TaskExecutor: Send + Sync {
    /// Execute a single task
    async fn execute_task(
        &self,
        task: &TaskDefinition,
        context: &ExecutionContext,
    ) -> WorkflowResult<TaskOutput>;

    /// Execute tasks in parallel
    async fn execute_parallel(
        &self,
        tasks: Vec<&TaskDefinition>,
        context: &ExecutionContext,
    ) -> WorkflowResult<Vec<TaskOutput>>;

    /// Handle task retry
    async fn retry_task(
        &self,
        task: &TaskDefinition,
        context: &ExecutionContext,
        retry_policy: &RetryPolicy,
        attempt: u32,
    ) -> WorkflowResult<TaskOutput>;

    /// Cancel running task
    async fn cancel_task(&self, task_id: &str) -> WorkflowResult<()>;
}

/// Workflow Execution Engine trait
#[async_trait]
pub trait WorkflowEngine: Send + Sync {
    /// Create workflow instance
    async fn create_workflow(
        &self,
        definition: WorkflowDefinition,
        user_id: &str,
    ) -> WorkflowResult<WorkflowInstance>;

    /// Start workflow execution
    async fn start_workflow(&self, instance_id: &str) -> WorkflowResult<()>;

    /// Pause workflow
    async fn pause_workflow(&self, instance_id: &str) -> WorkflowResult<()>;

    /// Resume workflow
    async fn resume_workflow(&self, instance_id: &str) -> WorkflowResult<()>;

    /// Cancel workflow
    async fn cancel_workflow(&self, instance_id: &str) -> WorkflowResult<()>;

    /// Get workflow status
    async fn get_status(&self, instance_id: &str) -> WorkflowResult<WorkflowInstance>;

    /// List workflows
    async fn list_workflows(&self, filters: WorkflowFilters) -> WorkflowResult<Vec<WorkflowInstance>>;

    /// Stream workflow events
    async fn stream_events(
        &self,
        instance_id: &str,
    ) -> WorkflowResult<tokio::sync::mpsc::Receiver<WorkflowEvent>>;
}

#[derive(Debug, Clone, Default)]
pub struct WorkflowFilters {
    pub user_id: Option<String>,
    pub state: Option<WorkflowState>,
    pub created_after: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
}

/// Workflow events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowEvent {
    WorkflowStarted {
        instance_id: String,
        timestamp: DateTime<Utc>,
    },
    TaskStarted {
        task_id: String,
        timestamp: DateTime<Utc>,
    },
    TaskCompleted {
        task_id: String,
        output: TaskOutput,
        timestamp: DateTime<Utc>,
    },
    TaskFailed {
        task_id: String,
        error: String,
        timestamp: DateTime<Utc>,
    },
    ApprovalRequired {
        task_id: String,
        approvers: Vec<String>,
        timestamp: DateTime<Utc>,
    },
    ApprovalGranted {
        task_id: String,
        approver: String,
        timestamp: DateTime<Utc>,
    },
    CheckpointCreated {
        checkpoint_id: String,
        timestamp: DateTime<Utc>,
    },
    WorkflowCompleted {
        instance_id: String,
        timestamp: DateTime<Utc>,
    },
    WorkflowFailed {
        instance_id: String,
        error: String,
        timestamp: DateTime<Utc>,
    },
}

/// Checkpoint Manager trait
#[async_trait]
pub trait CheckpointManager: Send + Sync {
    /// Create checkpoint
    async fn create_checkpoint(
        &self,
        instance: &WorkflowInstance,
    ) -> WorkflowResult<Checkpoint>;

    /// Load checkpoint
    async fn load_checkpoint(
        &self,
        checkpoint_id: &str,
    ) -> WorkflowResult<Checkpoint>;

    /// List checkpoints for workflow
    async fn list_checkpoints(
        &self,
        instance_id: &str,
    ) -> WorkflowResult<Vec<Checkpoint>>;

    /// Restore from checkpoint
    async fn restore_from_checkpoint(
        &self,
        instance_id: &str,
        checkpoint_id: &str,
    ) -> WorkflowResult<WorkflowInstance>;

    /// Delete checkpoint
    async fn delete_checkpoint(&self, checkpoint_id: &str) -> WorkflowResult<()>;
}

/// Approval System trait
#[async_trait]
pub trait ApprovalSystem: Send + Sync {
    /// Request approval
    async fn request_approval(
        &self,
        workflow_id: &str,
        task_id: &str,
        approvers: Vec<String>,
        timeout_seconds: u64,
    ) -> WorkflowResult<String>;  // Returns approval_id

    /// Grant approval
    async fn grant_approval(
        &self,
        approval_id: &str,
        approver: &str,
        comment: Option<String>,
    ) -> WorkflowResult<()>;

    /// Reject approval
    async fn reject_approval(
        &self,
        approval_id: &str,
        approver: &str,
        reason: String,
    ) -> WorkflowResult<()>;

    /// Check approval status
    async fn check_approval_status(
        &self,
        approval_id: &str,
    ) -> WorkflowResult<ApprovalStatus>;

    /// List pending approvals
    async fn list_pending_approvals(
        &self,
        approver: &str,
    ) -> WorkflowResult<Vec<ApprovalRequest>>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub approval_id: String,
    pub workflow_id: String,
    pub task_id: String,
    pub requested_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub approvers: Vec<String>,
    pub context: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApprovalStatus {
    Pending,
    Approved { approver: String, at: DateTime<Utc> },
    Rejected { approver: String, reason: String, at: DateTime<Utc> },
    Expired,
}

/// State Machine trait
#[async_trait]
pub trait StateMachine: Send + Sync {
    /// Transition to new state
    async fn transition(
        &self,
        instance_id: &str,
        from: WorkflowState,
        to: WorkflowState,
    ) -> WorkflowResult<()>;

    /// Check if transition is valid
    fn is_valid_transition(&self, from: &WorkflowState, to: &WorkflowState) -> bool;

    /// Get current state
    async fn get_state(&self, instance_id: &str) -> WorkflowResult<WorkflowState>;

    /// Get state history
    async fn get_state_history(
        &self,
        instance_id: &str,
    ) -> WorkflowResult<Vec<StateTransition>>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateTransition {
    pub from: WorkflowState,
    pub to: WorkflowState,
    pub timestamp: DateTime<Utc>,
    pub reason: Option<String>,
}
```

## Workflow Definition Schema

```yaml
# Example workflow definition
id: "deploy-with-approval"
name: "Production Deployment with Approval"
version: "1.0.0"
description: "Deploy to production with approval gate and rollback"

variables:
  namespace: "production"
  image_tag: "${CI_COMMIT_SHA}"
  replicas: 3

config:
  max_parallel_tasks: 5
  timeout_seconds: 3600
  checkpoint_interval_seconds: 60
  enable_rollback: true
  notification_config:
    on_completion: ["team@example.com"]
    on_failure: ["oncall@example.com"]

tasks:
  - id: "validate-manifest"
    name: "Validate Kubernetes Manifest"
    type:
      type: "Command"
      command: "kubectl"
      args: ["apply", "--dry-run=client", "-f", "manifest.yaml"]
    config:
      on_failure: "Fail"
      checkpoint: true
    retry_policy:
      max_attempts: 1

  - id: "run-tests"
    name: "Run Integration Tests"
    type:
      type: "Command"
      command: "npm"
      args: ["test"]
    depends_on: []
    retry_policy:
      max_attempts: 2
      initial_delay_ms: 5000

  - id: "build-image"
    name: "Build Docker Image"
    type:
      type: "Command"
      command: "docker"
      args: ["build", "-t", "app:${image_tag}", "."]
    depends_on: ["run-tests"]

  - id: "push-image"
    name: "Push to Registry"
    type:
      type: "Command"
      command: "docker"
      args: ["push", "app:${image_tag}"]
    depends_on: ["build-image"]

  - id: "request-approval"
    name: "Request Production Deployment Approval"
    type:
      type: "Approval"
      approvers: ["alice@example.com", "bob@example.com"]
      timeout_seconds: 3600
      auto_approve: false
    depends_on: ["validate-manifest", "push-image"]

  - id: "deploy"
    name: "Deploy to Production"
    type:
      type: "Deploy"
      manifest: "manifest.yaml"
      namespace: "${namespace}"
      dry_run: false
    depends_on: ["request-approval"]
    config:
      on_failure: "Rollback"
      checkpoint: true
    timeout: "PT15M"

  - id: "health-check"
    name: "Verify Deployment Health"
    type:
      type: "Command"
      command: "kubectl"
      args: ["rollout", "status", "deployment/app", "-n", "${namespace}"]
    depends_on: ["deploy"]
    retry_policy:
      max_attempts: 5
      initial_delay_ms: 10000
      max_delay_ms: 60000
      backoff_multiplier: 2.0

  - id: "smoke-tests"
    name: "Run Smoke Tests"
    type:
      type: "Http"
      method: "GET"
      url: "https://app.example.com/health"
      headers:
        User-Agent: "Workflow-Engine/1.0"
    depends_on: ["health-check"]
    retry_policy:
      max_attempts: 3

  - id: "notify-success"
    name: "Send Success Notification"
    type:
      type: "Http"
      method: "POST"
      url: "https://hooks.slack.com/services/XXX"
      body: |
        {
          "text": "Deployment ${image_tag} successful!"
        }
    depends_on: ["smoke-tests"]
    config:
      on_failure: "Continue"
```

## DAG Builder Implementation

```rust
use std::collections::{HashMap, HashSet, VecDeque};

pub struct WorkflowDagBuilder;

impl WorkflowDagBuilder {
    pub fn new() -> Self {
        Self
    }

    /// Build adjacency list representation
    fn build_adjacency_list(
        &self,
        tasks: &[TaskDefinition],
    ) -> HashMap<String, Vec<String>> {
        let mut adj_list: HashMap<String, Vec<String>> = HashMap::new();

        // Initialize all nodes
        for task in tasks {
            adj_list.insert(task.id.clone(), Vec::new());
        }

        // Add edges based on dependencies
        for task in tasks {
            for dep in &task.depends_on {
                adj_list
                    .get_mut(dep)
                    .unwrap()
                    .push(task.id.clone());
            }
        }

        adj_list
    }

    /// Detect cycles using DFS
    fn has_cycle(
        &self,
        node: &str,
        adj_list: &HashMap<String, Vec<String>>,
        visited: &mut HashSet<String>,
        rec_stack: &mut HashSet<String>,
    ) -> bool {
        visited.insert(node.to_string());
        rec_stack.insert(node.to_string());

        if let Some(neighbors) = adj_list.get(node) {
            for neighbor in neighbors {
                if !visited.contains(neighbor) {
                    if self.has_cycle(neighbor, adj_list, visited, rec_stack) {
                        return true;
                    }
                } else if rec_stack.contains(neighbor) {
                    return true;
                }
            }
        }

        rec_stack.remove(node);
        false
    }

    /// Calculate in-degrees for topological sort
    fn calculate_in_degrees(
        &self,
        tasks: &[TaskDefinition],
    ) -> HashMap<String, usize> {
        let mut in_degrees: HashMap<String, usize> = HashMap::new();

        // Initialize all nodes with 0
        for task in tasks {
            in_degrees.insert(task.id.clone(), 0);
        }

        // Count dependencies
        for task in tasks {
            for dep in &task.depends_on {
                *in_degrees.get_mut(&task.id).unwrap() += 1;
            }
        }

        in_degrees
    }

    /// Kahn's algorithm for topological sort
    /// Returns batches of tasks that can be executed in parallel
    fn topological_sort_batched(
        &self,
        tasks: &[TaskDefinition],
    ) -> WorkflowResult<Vec<Vec<String>>> {
        let adj_list = self.build_adjacency_list(tasks);
        let mut in_degrees = self.calculate_in_degrees(tasks);
        let mut batches: Vec<Vec<String>> = Vec::new();
        let mut queue: VecDeque<String> = VecDeque::new();

        // Add nodes with no dependencies to queue
        for (node, &degree) in &in_degrees {
            if degree == 0 {
                queue.push_back(node.clone());
            }
        }

        while !queue.is_empty() {
            // Process entire current level (batch)
            let batch_size = queue.len();
            let mut current_batch = Vec::new();

            for _ in 0..batch_size {
                if let Some(node) = queue.pop_front() {
                    current_batch.push(node.clone());

                    // Decrease in-degree for neighbors
                    if let Some(neighbors) = adj_list.get(&node) {
                        for neighbor in neighbors {
                            let degree = in_degrees.get_mut(neighbor).unwrap();
                            *degree -= 1;
                            if *degree == 0 {
                                queue.push_back(neighbor.clone());
                            }
                        }
                    }
                }
            }

            if !current_batch.is_empty() {
                batches.push(current_batch);
            }
        }

        // Check if all nodes were processed
        let processed: usize = batches.iter().map(|b| b.len()).sum();
        if processed != tasks.len() {
            return Err(WorkflowError::CycleDetected);
        }

        Ok(batches)
    }
}

#[async_trait]
impl DagBuilder for WorkflowDagBuilder {
    async fn build_dag(&self, workflow: &WorkflowDefinition) -> WorkflowResult<WorkflowDag> {
        let adj_list = self.build_adjacency_list(&workflow.tasks);

        // Check for cycles
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();
        for task in &workflow.tasks {
            if !visited.contains(&task.id) {
                if self.has_cycle(&task.id, &adj_list, &mut visited, &mut rec_stack) {
                    return Err(WorkflowError::CycleDetected);
                }
            }
        }

        // Build execution batches
        let batches = self.topological_sort_batched(&workflow.tasks)?;

        // Build nodes
        let mut nodes = HashMap::new();
        let mut level_map: HashMap<String, usize> = HashMap::new();

        for (level, batch) in batches.iter().enumerate() {
            for task_id in batch {
                level_map.insert(task_id.clone(), level);
            }
        }

        for task in &workflow.tasks {
            let level = level_map.get(&task.id).copied().unwrap_or(0);
            nodes.insert(
                task.id.clone(),
                DagNode {
                    task_id: task.id.clone(),
                    task_def: task.clone(),
                    level,
                },
            );
        }

        // Build edges
        let mut edges = Vec::new();
        for task in &workflow.tasks {
            for dep in &task.depends_on {
                edges.push(DagEdge {
                    from: dep.clone(),
                    to: task.id.clone(),
                });
            }
        }

        Ok(WorkflowDag {
            nodes,
            edges,
            execution_batches: batches,
        })
    }

    fn detect_cycles(&self, dag: &WorkflowDag) -> WorkflowResult<()> {
        let adj_list: HashMap<String, Vec<String>> = dag
            .edges
            .iter()
            .fold(HashMap::new(), |mut acc, edge| {
                acc.entry(edge.from.clone())
                    .or_insert_with(Vec::new)
                    .push(edge.to.clone());
                acc
            });

        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        for node_id in dag.nodes.keys() {
            if !visited.contains(node_id) {
                if self.has_cycle(node_id, &adj_list, &mut visited, &mut rec_stack) {
                    return Err(WorkflowError::CycleDetected);
                }
            }
        }

        Ok(())
    }

    fn topological_sort(&self, dag: &WorkflowDag) -> WorkflowResult<Vec<Vec<String>>> {
        Ok(dag.execution_batches.clone())
    }

    fn optimize_parallelism(&self, dag: &mut WorkflowDag) -> WorkflowResult<()> {
        // Already optimized in build_dag through batching
        // Additional optimizations could include:
        // - Resource-aware scheduling
        // - Critical path analysis
        // - Load balancing
        Ok(())
    }
}
```

## Workflow Execution Engine Implementation

```rust
pub struct DefaultWorkflowEngine {
    parser: Arc<dyn WorkflowParser>,
    dag_builder: Arc<dyn DagBuilder>,
    task_executor: Arc<dyn TaskExecutor>,
    checkpoint_manager: Arc<dyn CheckpointManager>,
    approval_system: Arc<dyn ApprovalSystem>,
    state_machine: Arc<dyn StateMachine>,
    storage: Arc<dyn WorkflowStorage>,
    instances: Arc<RwLock<HashMap<String, WorkflowInstance>>>,
}

impl DefaultWorkflowEngine {
    pub fn new(
        parser: Arc<dyn WorkflowParser>,
        dag_builder: Arc<dyn DagBuilder>,
        task_executor: Arc<dyn TaskExecutor>,
        checkpoint_manager: Arc<dyn CheckpointManager>,
        approval_system: Arc<dyn ApprovalSystem>,
        state_machine: Arc<dyn StateMachine>,
        storage: Arc<dyn WorkflowStorage>,
    ) -> Self {
        Self {
            parser,
            dag_builder,
            task_executor,
            checkpoint_manager,
            approval_system,
            state_machine,
            storage,
            instances: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn execute_workflow_internal(
        &self,
        instance_id: String,
    ) -> WorkflowResult<()> {
        // Get instance
        let instance = {
            let instances = self.instances.read().await;
            instances
                .get(&instance_id)
                .ok_or_else(|| WorkflowError::WorkflowNotFound(instance_id.clone()))?
                .clone()
        };

        // Build DAG
        let dag = self.dag_builder.build_dag(&instance.definition).await?;

        // Execute batches
        for batch in &dag.execution_batches {
            self.execute_batch(&instance_id, batch).await?;
        }

        // Mark as completed
        self.state_machine
            .transition(&instance_id, WorkflowState::Running, WorkflowState::Completed)
            .await?;

        Ok(())
    }

    async fn execute_batch(
        &self,
        instance_id: &str,
        task_ids: &[String],
    ) -> WorkflowResult<()> {
        // Get instance
        let instance = {
            let instances = self.instances.read().await;
            instances
                .get(instance_id)
                .ok_or_else(|| WorkflowError::WorkflowNotFound(instance_id.to_string()))?
                .clone()
        };

        // Get task definitions
        let tasks: Vec<&TaskDefinition> = task_ids
            .iter()
            .filter_map(|id| {
                instance.definition.tasks.iter().find(|t| &t.id == id)
            })
            .collect();

        // Execute in parallel
        let outputs = self
            .task_executor
            .execute_parallel(tasks, &instance.execution_context)
            .await?;

        // Update task states
        let mut instances = self.instances.write().await;
        if let Some(inst) = instances.get_mut(instance_id) {
            for (task_id, output) in task_ids.iter().zip(outputs) {
                if let Some(task_state) = inst.task_states.get_mut(task_id) {
                    task_state.state = TaskStatus::Completed;
                    task_state.output = Some(output.clone());
                    task_state.completed_at = Some(Utc::now());
                }

                // Store output in execution context
                inst.execution_context.outputs.insert(task_id.clone(), output);
            }
        }

        Ok(())
    }
}

#[async_trait]
impl WorkflowEngine for DefaultWorkflowEngine {
    async fn create_workflow(
        &self,
        definition: WorkflowDefinition,
        user_id: &str,
    ) -> WorkflowResult<WorkflowInstance> {
        // Validate definition
        self.parser.validate(&definition).await?;

        // Create instance
        let instance_id = uuid::Uuid::new_v4().to_string();
        let instance = WorkflowInstance {
            id: instance_id.clone(),
            workflow_id: definition.id.clone(),
            definition,
            state: WorkflowState::Pending,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            created_by: user_id.to_string(),
            execution_context: ExecutionContext {
                variables: HashMap::new(),
                outputs: HashMap::new(),
                environment: HashMap::new(),
            },
            task_states: HashMap::new(),
            checkpoints: Vec::new(),
            error: None,
        };

        // Store instance
        self.storage.store_workflow(&instance).await?;
        self.instances.write().await.insert(instance_id.clone(), instance.clone());

        Ok(instance)
    }

    async fn start_workflow(&self, instance_id: &str) -> WorkflowResult<()> {
        // Transition to running
        self.state_machine
            .transition(instance_id, WorkflowState::Pending, WorkflowState::Running)
            .await?;

        // Spawn execution task
        let engine = self.clone();
        let id = instance_id.to_string();
        tokio::spawn(async move {
            if let Err(e) = engine.execute_workflow_internal(id).await {
                eprintln!("Workflow execution failed: {}", e);
            }
        });

        Ok(())
    }

    async fn pause_workflow(&self, instance_id: &str) -> WorkflowResult<()> {
        // Create checkpoint
        let instance = self.get_status(instance_id).await?;
        self.checkpoint_manager.create_checkpoint(&instance).await?;

        // Transition to paused
        self.state_machine
            .transition(instance_id, WorkflowState::Running, WorkflowState::Paused)
            .await?;

        Ok(())
    }

    async fn resume_workflow(&self, instance_id: &str) -> WorkflowResult<()> {
        self.state_machine
            .transition(instance_id, WorkflowState::Paused, WorkflowState::Running)
            .await?;

        // Resume execution
        self.start_workflow(instance_id).await
    }

    async fn cancel_workflow(&self, instance_id: &str) -> WorkflowResult<()> {
        // Cancel all running tasks
        let instance = self.get_status(instance_id).await?;
        for task_id in instance.task_states.keys() {
            let _ = self.task_executor.cancel_task(task_id).await;
        }

        // Transition to cancelled
        self.state_machine
            .transition(instance_id, WorkflowState::Running, WorkflowState::Cancelled)
            .await?;

        Ok(())
    }

    async fn get_status(&self, instance_id: &str) -> WorkflowResult<WorkflowInstance> {
        let instances = self.instances.read().await;
        instances
            .get(instance_id)
            .cloned()
            .ok_or_else(|| WorkflowError::WorkflowNotFound(instance_id.to_string()))
    }

    async fn list_workflows(
        &self,
        filters: WorkflowFilters,
    ) -> WorkflowResult<Vec<WorkflowInstance>> {
        self.storage.list_workflows(filters).await
    }

    async fn stream_events(
        &self,
        instance_id: &str,
    ) -> WorkflowResult<tokio::sync::mpsc::Receiver<WorkflowEvent>> {
        let (tx, rx) = tokio::sync::mpsc::channel(100);
        // Implementation for event streaming
        Ok(rx)
    }
}

/// Storage trait for workflows
#[async_trait]
pub trait WorkflowStorage: Send + Sync {
    async fn store_workflow(&self, instance: &WorkflowInstance) -> WorkflowResult<()>;
    async fn load_workflow(&self, instance_id: &str) -> WorkflowResult<Option<WorkflowInstance>>;
    async fn update_workflow(&self, instance: &WorkflowInstance) -> WorkflowResult<()>;
    async fn list_workflows(&self, filters: WorkflowFilters) -> WorkflowResult<Vec<WorkflowInstance>>;
    async fn delete_workflow(&self, instance_id: &str) -> WorkflowResult<()>;
}
```

## Checkpoint and Recovery

```
┌────────────────────────────────────────────────────────────────┐
│                  Checkpoint Strategy                           │
└────────────────────────────────────────────────────────────────┘

Checkpoint Triggers:
1. Time-based: Every N seconds (configurable)
2. Event-based: After each batch completion
3. Manual: On demand via API
4. Before risky operations (deploy, scale)

Checkpoint Contents:
- Workflow state
- Task states (all tasks)
- Execution context (variables, outputs)
- DAG execution progress
- Timestamp and version

Recovery Process:
1. Detect failure
2. Load latest checkpoint
3. Validate checkpoint integrity
4. Restore execution context
5. Resume from last completed batch
6. Retry failed tasks (if applicable)

Storage:
- Primary: PostgreSQL (durability)
- Cache: Redis (fast access)
- Backup: S3 (long-term retention)
```

This completes the Workflow Engine architecture design. The system provides robust workflow orchestration with fault tolerance, parallel execution, and comprehensive state management.
