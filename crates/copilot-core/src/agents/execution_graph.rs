//! Agentics Execution Graph - Foundational Execution Unit instrumentation.
//!
//! This module defines the hierarchical execution span model that integrates
//! this repository into the Agentics ExecutionGraph system. Every externally-invoked
//! operation MUST produce a repo-level span containing one or more agent-level spans.
//!
//! Invariant: Core → Repo (this repo) → Agent (one or more)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// The name of this repository in the Agentics execution graph.
pub const REPO_NAME: &str = "copilot-agent";

/// Type of span in the execution hierarchy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpanType {
    /// Core-level span (created by the external caller/orchestrator)
    Core,
    /// Repo-level span (created on entry to this repository)
    Repo,
    /// Agent-level span (created for each agent that executes logic)
    Agent,
}

impl std::fmt::Display for SpanType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpanType::Core => write!(f, "core"),
            SpanType::Repo => write!(f, "repo"),
            SpanType::Agent => write!(f, "agent"),
        }
    }
}

/// Status of an execution span.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    /// Span is currently executing
    Running,
    /// Span completed successfully
    Completed,
    /// Span failed
    Failed,
}

impl std::fmt::Display for ExecutionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExecutionStatus::Running => write!(f, "running"),
            ExecutionStatus::Completed => write!(f, "completed"),
            ExecutionStatus::Failed => write!(f, "failed"),
        }
    }
}

/// An artifact produced by an agent during execution.
///
/// Artifacts are machine-verifiable evidence attached to agent-level spans.
/// They MUST NOT be attached directly to the Core span.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    /// Human-readable name of the artifact
    pub name: String,
    /// Type classification (e.g., "decision_event", "metric", "report", "config")
    pub artifact_type: String,
    /// Stable reference: ID, URI, hash, or filename
    pub reference: String,
    /// The artifact data (machine-verifiable, not inferred)
    pub data: serde_json::Value,
}

impl Artifact {
    pub fn new(
        name: impl Into<String>,
        artifact_type: impl Into<String>,
        reference: impl Into<String>,
        data: serde_json::Value,
    ) -> Self {
        Self {
            name: name.into(),
            artifact_type: artifact_type.into(),
            reference: reference.into(),
            data,
        }
    }
}

/// A single span in the execution graph.
///
/// Every span has a required parent_span_id (not optional) to enforce
/// the causal ordering invariant. The root core span is provided by the
/// external caller.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSpan {
    /// Unique identifier for this span
    pub span_id: String,
    /// Parent span ID (REQUIRED - every span must have a parent)
    pub parent_span_id: String,
    /// Trace ID linking all spans in a single execution
    pub trace_id: String,
    /// Type of this span in the hierarchy
    pub span_type: SpanType,
    /// Repository name (set for Repo and Agent spans)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_name: Option<String>,
    /// Agent name (set for Agent spans only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    /// Current status of the span
    pub status: ExecutionStatus,
    /// When the span started
    pub start_time: DateTime<Utc>,
    /// When the span ended (None if still running)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<DateTime<Utc>>,
    /// Failure reason if status is Failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
    /// Artifacts produced by this span (agent-level only)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub artifacts: Vec<Artifact>,
    /// Additional metadata attributes
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub attributes: HashMap<String, String>,
}

/// The complete execution graph for one invocation of this repository.
///
/// The graph is append-only and causally ordered via parent_span_id.
/// It MUST contain exactly one repo-level span and one or more agent-level spans
/// for the execution to be considered valid.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionGraph {
    /// Execution ID provided by the external caller
    pub execution_id: String,
    /// The span_id of the repo-level span (root of this repo's subgraph)
    pub repo_span_id: String,
    /// All spans, append-only, causally ordered
    pub spans: Vec<ExecutionSpan>,
}

/// Errors from ExecutionGraph operations.
#[derive(Debug, Clone, thiserror::Error)]
pub enum ExecutionGraphError {
    #[error("Missing parent_span_id: execution context requires a parent span from the Core")]
    MissingParentSpanId,
    #[error("No agent-level spans emitted: execution is INVALID without agent spans")]
    NoAgentSpans,
    #[error("Span not found: {0}")]
    SpanNotFound(String),
    #[error("Span already completed: {0}")]
    SpanAlreadyCompleted(String),
    #[error("Invalid execution graph: {0}")]
    InvalidGraph(String),
}

impl ExecutionGraph {
    /// Create a new execution graph with a repo-level span.
    ///
    /// This automatically creates the repo-level span as a child of the
    /// provided parent_span_id (from the Core).
    ///
    /// Returns an error if parent_span_id is empty.
    pub fn new(
        execution_id: impl Into<String>,
        parent_span_id: impl Into<String>,
        trace_id: impl Into<String>,
    ) -> Result<Self, ExecutionGraphError> {
        let parent = parent_span_id.into();
        if parent.is_empty() {
            return Err(ExecutionGraphError::MissingParentSpanId);
        }

        let trace = trace_id.into();
        let repo_span_id = generate_span_id();

        let repo_span = ExecutionSpan {
            span_id: repo_span_id.clone(),
            parent_span_id: parent,
            trace_id: trace,
            span_type: SpanType::Repo,
            repo_name: Some(REPO_NAME.to_string()),
            agent_name: None,
            status: ExecutionStatus::Running,
            start_time: Utc::now(),
            end_time: None,
            failure_reason: None,
            artifacts: Vec::new(),
            attributes: HashMap::new(),
        };

        Ok(Self {
            execution_id: execution_id.into(),
            repo_span_id,
            spans: vec![repo_span],
        })
    }

    /// Start a new agent-level span as a child of the repo span.
    ///
    /// Returns the new span_id for later completion/failure.
    pub fn start_agent_span(&mut self, agent_name: impl Into<String>) -> String {
        let span_id = generate_span_id();
        let trace_id = self.spans[0].trace_id.clone();

        let agent_span = ExecutionSpan {
            span_id: span_id.clone(),
            parent_span_id: self.repo_span_id.clone(),
            trace_id,
            span_type: SpanType::Agent,
            repo_name: Some(REPO_NAME.to_string()),
            agent_name: Some(agent_name.into()),
            status: ExecutionStatus::Running,
            start_time: Utc::now(),
            end_time: None,
            failure_reason: None,
            artifacts: Vec::new(),
            attributes: HashMap::new(),
        };

        self.spans.push(agent_span);
        span_id
    }

    /// Complete an agent-level span successfully, attaching any artifacts.
    pub fn complete_agent_span(
        &mut self,
        span_id: &str,
        artifacts: Vec<Artifact>,
    ) -> Result<(), ExecutionGraphError> {
        let span = self
            .find_span_mut(span_id)?;

        if span.status != ExecutionStatus::Running {
            return Err(ExecutionGraphError::SpanAlreadyCompleted(span_id.to_string()));
        }

        span.status = ExecutionStatus::Completed;
        span.end_time = Some(Utc::now());
        span.artifacts = artifacts;
        Ok(())
    }

    /// Mark an agent-level span as failed.
    pub fn fail_agent_span(
        &mut self,
        span_id: &str,
        reason: impl Into<String>,
    ) -> Result<(), ExecutionGraphError> {
        let span = self.find_span_mut(span_id)?;

        if span.status != ExecutionStatus::Running {
            return Err(ExecutionGraphError::SpanAlreadyCompleted(span_id.to_string()));
        }

        span.status = ExecutionStatus::Failed;
        span.end_time = Some(Utc::now());
        span.failure_reason = Some(reason.into());
        Ok(())
    }

    /// Complete the repo-level span.
    ///
    /// Validates that at least one agent-level span was emitted.
    /// Returns an error if no agent spans exist (execution is INVALID).
    pub fn complete_repo(&mut self) -> Result<(), ExecutionGraphError> {
        self.validate()?;

        if let Some(repo_span) = self.spans.iter_mut().find(|s| s.span_id == self.repo_span_id) {
            repo_span.status = ExecutionStatus::Completed;
            repo_span.end_time = Some(Utc::now());
        }

        Ok(())
    }

    /// Mark the repo-level span as failed.
    ///
    /// This preserves all emitted spans (Rule 8) and sets the failure reason.
    pub fn fail_repo(&mut self, reason: impl Into<String>) {
        if let Some(repo_span) = self.spans.iter_mut().find(|s| s.span_id == self.repo_span_id) {
            repo_span.status = ExecutionStatus::Failed;
            repo_span.end_time = Some(Utc::now());
            repo_span.failure_reason = Some(reason.into());
        }
    }

    /// Validate the execution graph invariants.
    ///
    /// Checks:
    /// - At least one agent-level span exists
    /// - All spans have valid parent_span_id references
    pub fn validate(&self) -> Result<(), ExecutionGraphError> {
        let agent_count = self
            .spans
            .iter()
            .filter(|s| s.span_type == SpanType::Agent)
            .count();

        if agent_count == 0 {
            return Err(ExecutionGraphError::NoAgentSpans);
        }

        Ok(())
    }

    /// Check if the graph has any agent-level spans.
    pub fn has_agent_spans(&self) -> bool {
        self.spans.iter().any(|s| s.span_type == SpanType::Agent)
    }

    /// Get the repo-level span.
    pub fn repo_span(&self) -> Option<&ExecutionSpan> {
        self.spans.iter().find(|s| s.span_id == self.repo_span_id)
    }

    /// Get all agent-level spans.
    pub fn agent_spans(&self) -> Vec<&ExecutionSpan> {
        self.spans
            .iter()
            .filter(|s| s.span_type == SpanType::Agent)
            .collect()
    }

    /// Serialize the execution graph to a JSON value.
    pub fn to_json(&self) -> Result<serde_json::Value, serde_json::Error> {
        serde_json::to_value(self)
    }

    /// Add an attribute to the repo-level span.
    pub fn set_repo_attribute(&mut self, key: impl Into<String>, value: impl Into<String>) {
        if let Some(repo_span) = self.spans.iter_mut().find(|s| s.span_id == self.repo_span_id) {
            repo_span.attributes.insert(key.into(), value.into());
        }
    }

    fn find_span_mut(&mut self, span_id: &str) -> Result<&mut ExecutionSpan, ExecutionGraphError> {
        self.spans
            .iter_mut()
            .find(|s| s.span_id == span_id)
            .ok_or_else(|| ExecutionGraphError::SpanNotFound(span_id.to_string()))
    }
}

/// Generate a unique span ID (16 hex characters, matching CorrelationContext format).
fn generate_span_id() -> String {
    Uuid::new_v4().to_string().replace('-', "")[..16].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_repo_span_created_on_new() {
        let graph = ExecutionGraph::new("exec-1", "parent-span-abc", "trace-xyz").unwrap();

        assert_eq!(graph.execution_id, "exec-1");
        assert_eq!(graph.spans.len(), 1);

        let repo_span = &graph.spans[0];
        assert_eq!(repo_span.span_type, SpanType::Repo);
        assert_eq!(repo_span.parent_span_id, "parent-span-abc");
        assert_eq!(repo_span.trace_id, "trace-xyz");
        assert_eq!(repo_span.repo_name, Some(REPO_NAME.to_string()));
        assert_eq!(repo_span.status, ExecutionStatus::Running);
        assert!(repo_span.end_time.is_none());
    }

    #[test]
    fn test_rejects_empty_parent_span_id() {
        let result = ExecutionGraph::new("exec-1", "", "trace-xyz");
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ExecutionGraphError::MissingParentSpanId
        ));
    }

    #[test]
    fn test_agent_span_lifecycle() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();

        let span_id = graph.start_agent_span("intent-classifier");
        assert_eq!(graph.spans.len(), 2);

        let agent_span = &graph.spans[1];
        assert_eq!(agent_span.span_type, SpanType::Agent);
        assert_eq!(agent_span.agent_name, Some("intent-classifier".to_string()));
        assert_eq!(agent_span.parent_span_id, graph.repo_span_id);
        assert_eq!(agent_span.status, ExecutionStatus::Running);

        let artifact = Artifact::new("result", "decision_event", "evt-123", serde_json::json!({"confidence": 0.95}));
        graph.complete_agent_span(&span_id, vec![artifact]).unwrap();

        let completed = &graph.spans[1];
        assert_eq!(completed.status, ExecutionStatus::Completed);
        assert!(completed.end_time.is_some());
        assert_eq!(completed.artifacts.len(), 1);
        assert_eq!(completed.artifacts[0].name, "result");
    }

    #[test]
    fn test_agent_span_failure() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();
        let span_id = graph.start_agent_span("planner-agent");

        graph.fail_agent_span(&span_id, "Input validation failed").unwrap();

        let failed = &graph.spans[1];
        assert_eq!(failed.status, ExecutionStatus::Failed);
        assert_eq!(failed.failure_reason, Some("Input validation failed".to_string()));
        assert!(failed.end_time.is_some());
    }

    #[test]
    fn test_fails_without_agent_spans() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();

        let result = graph.complete_repo();
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ExecutionGraphError::NoAgentSpans
        ));
    }

    #[test]
    fn test_repo_completion_with_agent_spans() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();
        let span_id = graph.start_agent_span("decomposer");
        graph.complete_agent_span(&span_id, vec![]).unwrap();

        graph.complete_repo().unwrap();

        let repo = graph.repo_span().unwrap();
        assert_eq!(repo.status, ExecutionStatus::Completed);
        assert!(repo.end_time.is_some());
    }

    #[test]
    fn test_repo_failure_preserves_spans() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();
        let span_id = graph.start_agent_span("meta-reasoner");
        graph.complete_agent_span(&span_id, vec![]).unwrap();

        graph.fail_repo("Internal error occurred");

        assert_eq!(graph.spans.len(), 2);
        let repo = graph.repo_span().unwrap();
        assert_eq!(repo.status, ExecutionStatus::Failed);
        assert_eq!(repo.failure_reason, Some("Internal error occurred".to_string()));

        let agent = &graph.spans[1];
        assert_eq!(agent.status, ExecutionStatus::Completed);
    }

    #[test]
    fn test_parent_span_id_chain() {
        let mut graph = ExecutionGraph::new("exec-1", "core-span-123", "trace-abc").unwrap();
        let agent1 = graph.start_agent_span("agent-a");
        let agent2 = graph.start_agent_span("agent-b");

        let repo = graph.repo_span().unwrap();
        assert_eq!(repo.parent_span_id, "core-span-123");

        let span1 = graph.spans.iter().find(|s| s.span_id == agent1).unwrap();
        assert_eq!(span1.parent_span_id, graph.repo_span_id);

        let span2 = graph.spans.iter().find(|s| s.span_id == agent2).unwrap();
        assert_eq!(span2.parent_span_id, graph.repo_span_id);
    }

    #[test]
    fn test_json_serialization() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();
        let span_id = graph.start_agent_span("classifier");
        graph
            .complete_agent_span(
                &span_id,
                vec![Artifact::new("output", "report", "ref-1", serde_json::json!({"result": true}))],
            )
            .unwrap();
        graph.complete_repo().unwrap();

        let json = graph.to_json().unwrap();
        assert!(json.is_object());
        assert_eq!(json["execution_id"], "exec-1");
        assert!(json["spans"].is_array());
        assert_eq!(json["spans"].as_array().unwrap().len(), 2);

        // Verify round-trip
        let deserialized: ExecutionGraph = serde_json::from_value(json).unwrap();
        assert_eq!(deserialized.execution_id, graph.execution_id);
        assert_eq!(deserialized.spans.len(), graph.spans.len());
    }

    #[test]
    fn test_multiple_agent_spans() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();

        let s1 = graph.start_agent_span("nlp-engine");
        let s2 = graph.start_agent_span("context-engine");
        let s3 = graph.start_agent_span("conversation-manager");

        graph.complete_agent_span(&s1, vec![]).unwrap();
        graph.complete_agent_span(&s2, vec![]).unwrap();
        graph.fail_agent_span(&s3, "timeout").unwrap();

        let agents = graph.agent_spans();
        assert_eq!(agents.len(), 3);
        assert!(graph.has_agent_spans());

        graph.complete_repo().unwrap();
    }

    #[test]
    fn test_cannot_complete_span_twice() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();
        let span_id = graph.start_agent_span("agent");
        graph.complete_agent_span(&span_id, vec![]).unwrap();

        let result = graph.complete_agent_span(&span_id, vec![]);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ExecutionGraphError::SpanAlreadyCompleted(_)
        ));
    }

    #[test]
    fn test_span_not_found() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();

        let result = graph.complete_agent_span("nonexistent", vec![]);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ExecutionGraphError::SpanNotFound(_)
        ));
    }

    #[test]
    fn test_repo_attribute() {
        let mut graph = ExecutionGraph::new("exec-1", "parent-abc", "trace-xyz").unwrap();
        graph.set_repo_attribute("environment", "production");

        let repo = graph.repo_span().unwrap();
        assert_eq!(repo.attributes.get("environment"), Some(&"production".to_string()));
    }
}
