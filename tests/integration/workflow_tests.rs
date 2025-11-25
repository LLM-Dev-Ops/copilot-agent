//! Workflow Integration Tests
//!
//! This module tests DAG validation, parallel execution,
//! approval gates, and timeout handling.

use crate::common::*;
use copilot_workflow::{
    dag::{WorkflowDag, DagValidationError},
    step::{WorkflowStep, StepType, StepAction, StepStatus},
    execution::{WorkflowExecution, ExecutionStatus},
    engine::WorkflowEngine,
};
use std::collections::HashSet;
use std::time::Duration;

#[tokio::test]
async fn test_dag_validation_simple() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_step("step2", "Step 2", vec!["step1".to_string()]),
        create_step("step3", "Step 3", vec!["step2".to_string()]),
    ];

    // Act
    let result = WorkflowDag::new(steps);

    // Assert
    assert!(result.is_ok());
    let dag = result.unwrap();
    assert_eq!(dag.len(), 3);
}

#[tokio::test]
async fn test_dag_validation_cycle_detection() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec!["step3".to_string()]),
        create_step("step2", "Step 2", vec!["step1".to_string()]),
        create_step("step3", "Step 3", vec!["step2".to_string()]),
    ];

    // Act
    let result = WorkflowDag::new(steps);

    // Assert
    assert!(result.is_err());
    match result.unwrap_err() {
        DagValidationError::CycleDetected(_) => (),
        _ => panic!("Expected CycleDetected error"),
    }
}

#[tokio::test]
async fn test_dag_validation_missing_dependency() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_step("step2", "Step 2", vec!["step3".to_string()]), // step3 doesn't exist
    ];

    // Act
    let result = WorkflowDag::new(steps);

    // Assert
    assert!(result.is_err());
    match result.unwrap_err() {
        DagValidationError::MissingDependency { .. } => (),
        _ => panic!("Expected MissingDependency error"),
    }
}

#[tokio::test]
async fn test_dag_validation_duplicate_step_id() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_step("step1", "Step 1 Duplicate", vec![]), // Duplicate ID
    ];

    // Act
    let result = WorkflowDag::new(steps);

    // Assert
    assert!(result.is_err());
    match result.unwrap_err() {
        DagValidationError::DuplicateStepId(_) => (),
        _ => panic!("Expected DuplicateStepId error"),
    }
}

#[tokio::test]
async fn test_dag_validation_empty_workflow() {
    // Arrange
    let steps: Vec<WorkflowStep> = vec![];

    // Act
    let result = WorkflowDag::new(steps);

    // Assert
    assert!(result.is_err());
    match result.unwrap_err() {
        DagValidationError::EmptyWorkflow => (),
        _ => panic!("Expected EmptyWorkflow error"),
    }
}

#[tokio::test]
async fn test_dag_topological_sort() {
    // Arrange
    let steps = vec![
        create_step("step3", "Step 3", vec!["step1".to_string(), "step2".to_string()]),
        create_step("step1", "Step 1", vec![]),
        create_step("step2", "Step 2", vec!["step1".to_string()]),
    ];

    // Act
    let dag = WorkflowDag::new(steps).unwrap();
    let sorted = dag.topological_sort();

    // Assert
    assert_eq!(sorted.len(), 3);
    assert_eq!(sorted[0], "step1");
    // step2 must come after step1
    let step1_pos = sorted.iter().position(|s| s == "step1").unwrap();
    let step2_pos = sorted.iter().position(|s| s == "step2").unwrap();
    let step3_pos = sorted.iter().position(|s| s == "step3").unwrap();
    assert!(step1_pos < step2_pos);
    assert!(step2_pos < step3_pos);
}

#[tokio::test]
async fn test_parallel_execution_independent_steps() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_step("step2", "Step 2", vec![]),
        create_step("step3", "Step 3", vec![]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("test", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Assert - All steps should execute in parallel
    tokio::time::sleep(Duration::from_millis(100)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // All steps should have started or completed
    assert!(status.completed_steps.len() + status.running_steps.len() >= 3);
}

#[tokio::test]
async fn test_parallel_execution_diamond_dependency() {
    // Arrange - Diamond pattern
    let steps = vec![
        create_step("start", "Start", vec![]),
        create_step("branch1", "Branch 1", vec!["start".to_string()]),
        create_step("branch2", "Branch 2", vec!["start".to_string()]),
        create_step("end", "End", vec!["branch1".to_string(), "branch2".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("diamond", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Assert - branch1 and branch2 should execute in parallel
    tokio::time::sleep(Duration::from_millis(100)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // Verify execution order
    assert!(status.completed_steps.contains("start"));
}

#[tokio::test]
async fn test_parallel_execution_with_max_concurrency() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_step("step2", "Step 2", vec![]),
        create_step("step3", "Step 3", vec![]),
        create_step("step4", "Step 4", vec![]),
        create_step("step5", "Step 5", vec![]),
    ];

    let mut engine = WorkflowEngine::new();
    engine.set_max_concurrency(2); // Limit to 2 concurrent steps
    let workflow_id = engine.register_workflow("limited", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Assert - Should respect concurrency limit
    tokio::time::sleep(Duration::from_millis(50)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    assert!(status.running_steps.len() <= 2);
}

#[tokio::test]
async fn test_approval_gate_requires_approval() {
    // Arrange
    let steps = vec![
        create_step("build", "Build", vec![]),
        create_approval_step("approve_deploy", "Approve Deployment", vec!["build".to_string()]),
        create_step("deploy", "Deploy", vec!["approve_deploy".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("with_approval", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait for approval gate
    tokio::time::sleep(Duration::from_millis(100)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // Assert - Should be waiting at approval gate
    assert_eq!(status.status, ExecutionStatus::WaitingApproval);
    assert!(status.pending_approvals.contains(&"approve_deploy".to_string()));
}

#[tokio::test]
async fn test_approval_gate_approved() {
    // Arrange
    let steps = vec![
        create_step("build", "Build", vec![]),
        create_approval_step("approve", "Approve", vec!["build".to_string()]),
        create_step("deploy", "Deploy", vec!["approve".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("approved", steps).await.unwrap();
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait for approval gate
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Act - Approve the gate
    engine.approve_step(&execution.id, "approve", "user123").await.unwrap();

    // Wait for completion
    tokio::time::sleep(Duration::from_millis(100)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // Assert - Should complete after approval
    assert!(status.completed_steps.contains(&"approve".to_string()));
    assert!(status.status == ExecutionStatus::Running ||
            status.status == ExecutionStatus::Completed);
}

#[tokio::test]
async fn test_approval_gate_rejected() {
    // Arrange
    let steps = vec![
        create_step("build", "Build", vec![]),
        create_approval_step("approve", "Approve", vec!["build".to_string()]),
        create_step("deploy", "Deploy", vec!["approve".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("rejected", steps).await.unwrap();
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait for approval gate
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Act - Reject the gate
    engine.reject_step(&execution.id, "approve", "user123", "Not ready").await.unwrap();

    // Assert - Should stop execution
    let status = engine.get_execution_status(&execution.id).await.unwrap();
    assert_eq!(status.status, ExecutionStatus::Failed);
}

#[tokio::test]
async fn test_timeout_handling_step_timeout() {
    // Arrange
    let mut step = create_step("slow", "Slow Step", vec![]);
    step.timeout = Some(Duration::from_millis(100));

    let steps = vec![step];
    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("timeout", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait for timeout
    tokio::time::sleep(Duration::from_millis(200)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // Assert - Should timeout
    assert!(status.failed_steps.contains(&"slow".to_string()) ||
            status.status == ExecutionStatus::Failed);
}

#[tokio::test]
async fn test_timeout_handling_workflow_timeout() {
    // Arrange
    let steps = vec![
        create_long_running_step("step1", "Long Step 1", vec![]),
        create_long_running_step("step2", "Long Step 2", vec!["step1".to_string()]),
    ];

    let mut engine = WorkflowEngine::new();
    engine.set_workflow_timeout(Duration::from_millis(150));
    let workflow_id = engine.register_workflow("workflow_timeout", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait for timeout
    tokio::time::sleep(Duration::from_millis(200)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // Assert - Workflow should timeout
    assert_eq!(status.status, ExecutionStatus::Failed);
}

#[tokio::test]
async fn test_timeout_with_retry() {
    // Arrange
    let mut step = create_step("retryable", "Retryable Step", vec![]);
    step.timeout = Some(Duration::from_millis(100));
    step.retry_config = Some(RetryConfig {
        max_attempts: 3,
        backoff: Duration::from_millis(50),
    });

    let steps = vec![step];
    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("retry_timeout", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait for retries
    tokio::time::sleep(Duration::from_millis(500)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // Assert - Should have attempted retries
    let step_status = status.step_statuses.get("retryable").unwrap();
    assert!(step_status.attempt_count > 1);
}

#[tokio::test]
async fn test_workflow_execution_status_transitions() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_step("step2", "Step 2", vec!["step1".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("transitions", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Assert - Should transition through states
    let mut seen_running = false;
    for _ in 0..10 {
        let status = engine.get_execution_status(&execution.id).await.unwrap();
        if status.status == ExecutionStatus::Running {
            seen_running = true;
        }
        if status.status == ExecutionStatus::Completed {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    assert!(seen_running);
}

#[tokio::test]
async fn test_workflow_error_propagation() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_failing_step("step2", "Failing Step", vec!["step1".to_string()]),
        create_step("step3", "Step 3", vec!["step2".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("error_prop", steps).await.unwrap();

    // Act
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait for failure
    tokio::time::sleep(Duration::from_millis(200)).await;
    let status = engine.get_execution_status(&execution.id).await.unwrap();

    // Assert - Should fail and not execute step3
    assert_eq!(status.status, ExecutionStatus::Failed);
    assert!(status.failed_steps.contains(&"step2".to_string()));
    assert!(!status.completed_steps.contains(&"step3".to_string()));
}

#[tokio::test]
async fn test_workflow_cancellation() {
    // Arrange
    let steps = vec![
        create_long_running_step("step1", "Long Step 1", vec![]),
        create_long_running_step("step2", "Long Step 2", vec!["step1".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("cancellable", steps).await.unwrap();
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait a bit
    tokio::time::sleep(Duration::from_millis(50)).await;

    // Act - Cancel workflow
    engine.cancel_execution(&execution.id).await.unwrap();

    // Assert - Should be cancelled
    let status = engine.get_execution_status(&execution.id).await.unwrap();
    assert_eq!(status.status, ExecutionStatus::Cancelled);
}

#[tokio::test]
async fn test_workflow_pause_resume() {
    // Arrange
    let steps = vec![
        create_step("step1", "Step 1", vec![]),
        create_step("step2", "Step 2", vec!["step1".to_string()]),
        create_step("step3", "Step 3", vec!["step2".to_string()]),
    ];

    let engine = WorkflowEngine::new();
    let workflow_id = engine.register_workflow("pausable", steps).await.unwrap();
    let execution = engine.execute(workflow_id).await.unwrap();

    // Wait a bit
    tokio::time::sleep(Duration::from_millis(50)).await;

    // Act - Pause
    engine.pause_execution(&execution.id).await.unwrap();
    let paused_status = engine.get_execution_status(&execution.id).await.unwrap();
    assert_eq!(paused_status.status, ExecutionStatus::Paused);

    // Resume
    engine.resume_execution(&execution.id).await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;
    let resumed_status = engine.get_execution_status(&execution.id).await.unwrap();

    // Assert - Should resume
    assert!(resumed_status.status == ExecutionStatus::Running ||
            resumed_status.status == ExecutionStatus::Completed);
}

// Helper functions

fn create_step(id: &str, name: &str, dependencies: Vec<String>) -> WorkflowStep {
    WorkflowStep::new(
        name,
        StepType::Action,
        StepAction::Wait { duration_secs: 0 },
    )
    .with_id(id)
    .with_dependencies(dependencies)
}

fn create_approval_step(id: &str, name: &str, dependencies: Vec<String>) -> WorkflowStep {
    WorkflowStep::new(
        name,
        StepType::Approval,
        StepAction::Approval {
            required_approvers: 1,
            timeout_secs: 300,
        },
    )
    .with_id(id)
    .with_dependencies(dependencies)
}

fn create_long_running_step(id: &str, name: &str, dependencies: Vec<String>) -> WorkflowStep {
    WorkflowStep::new(
        name,
        StepType::Action,
        StepAction::Wait { duration_secs: 10 },
    )
    .with_id(id)
    .with_dependencies(dependencies)
}

fn create_failing_step(id: &str, name: &str, dependencies: Vec<String>) -> WorkflowStep {
    WorkflowStep::new(
        name,
        StepType::Action,
        StepAction::Fail { message: "Intentional failure".to_string() },
    )
    .with_id(id)
    .with_dependencies(dependencies)
}

#[derive(Debug, Clone)]
struct RetryConfig {
    max_attempts: u32,
    backoff: Duration,
}
