//! Agentics contracts - schemas for agent communication.
//!
//! ALL schemas MUST be imported from this module.
//! No inline schemas. No inferred schemas. No dynamic schema mutation.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use uuid::Uuid;

/// Decision types for the Agentics platform.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DecisionType {
    /// Task decomposition - breaking plans into atomic tasks
    TaskDecomposition,
    /// Intent classification
    IntentClassification,
    /// Structure analysis
    StructuralAnalysis,
    /// Dependency identification
    DependencyIdentification,
    /// Risk assessment
    RiskAssessment,
}

impl std::fmt::Display for DecisionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DecisionType::TaskDecomposition => write!(f, "task_decomposition"),
            DecisionType::IntentClassification => write!(f, "intent_classification"),
            DecisionType::StructuralAnalysis => write!(f, "structural_analysis"),
            DecisionType::DependencyIdentification => write!(f, "dependency_identification"),
            DecisionType::RiskAssessment => write!(f, "risk_assessment"),
        }
    }
}

/// DecisionEvent - the ONLY output an agent may emit.
///
/// Per the Agentics Global Agent Constitution, all agents MUST emit
/// exactly ONE DecisionEvent per invocation containing:
/// - agent_id
/// - agent_version
/// - decision_type
/// - inputs_hash
/// - outputs
/// - confidence
/// - constraints_applied
/// - execution_ref
/// - timestamp (UTC)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionEvent {
    /// Unique identifier for this decision event
    pub id: Uuid,

    /// Identifier of the agent that produced this decision
    pub agent_id: String,

    /// Version of the agent
    pub agent_version: String,

    /// Type of decision made
    pub decision_type: DecisionType,

    /// SHA-256 hash of the inputs for reproducibility
    pub inputs_hash: String,

    /// The decision outputs (machine-readable)
    pub outputs: serde_json::Value,

    /// Confidence score (0.0 - 1.0)
    pub confidence: f32,

    /// List of constraints that were applied
    pub constraints_applied: Vec<String>,

    /// Reference to the execution context
    pub execution_ref: String,

    /// UTC timestamp when the decision was made
    pub timestamp: DateTime<Utc>,

    /// Optional telemetry metadata for LLM-Observatory
    #[serde(default)]
    pub telemetry: TelemetryMetadata,
}

impl DecisionEvent {
    /// Create a new DecisionEvent with required fields.
    pub fn new(
        agent_id: impl Into<String>,
        agent_version: impl Into<String>,
        decision_type: DecisionType,
        inputs_hash: impl Into<String>,
        outputs: serde_json::Value,
        confidence: f32,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            agent_id: agent_id.into(),
            agent_version: agent_version.into(),
            decision_type,
            inputs_hash: inputs_hash.into(),
            outputs,
            confidence: confidence.clamp(0.0, 1.0),
            constraints_applied: Vec::new(),
            execution_ref: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            telemetry: TelemetryMetadata::default(),
        }
    }

    /// Add a constraint that was applied during decision making.
    pub fn with_constraint(mut self, constraint: impl Into<String>) -> Self {
        self.constraints_applied.push(constraint.into());
        self
    }

    /// Add multiple constraints.
    pub fn with_constraints(mut self, constraints: Vec<String>) -> Self {
        self.constraints_applied.extend(constraints);
        self
    }

    /// Set the execution reference.
    pub fn with_execution_ref(mut self, execution_ref: impl Into<String>) -> Self {
        self.execution_ref = execution_ref.into();
        self
    }

    /// Add telemetry metadata.
    pub fn with_telemetry(mut self, telemetry: TelemetryMetadata) -> Self {
        self.telemetry = telemetry;
        self
    }

    /// Validate the decision event against constitution requirements.
    pub fn validate(&self) -> Result<(), DecisionEventError> {
        if self.agent_id.is_empty() {
            return Err(DecisionEventError::MissingField("agent_id".into()));
        }
        if self.agent_version.is_empty() {
            return Err(DecisionEventError::MissingField("agent_version".into()));
        }
        if self.inputs_hash.is_empty() {
            return Err(DecisionEventError::MissingField("inputs_hash".into()));
        }
        if self.confidence < 0.0 || self.confidence > 1.0 {
            return Err(DecisionEventError::InvalidConfidence(self.confidence));
        }
        Ok(())
    }
}

/// Errors for DecisionEvent validation.
#[derive(Debug, Clone, thiserror::Error)]
pub enum DecisionEventError {
    #[error("Missing required field: {0}")]
    MissingField(String),
    #[error("Invalid confidence value: {0} (must be 0.0-1.0)")]
    InvalidConfidence(f32),
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// Telemetry metadata compatible with LLM-Observatory.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TelemetryMetadata {
    /// Trace ID for distributed tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,

    /// Span ID for this operation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span_id: Option<String>,

    /// Parent span ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_span_id: Option<String>,

    /// Processing duration in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,

    /// Additional labels for metrics
    #[serde(default)]
    pub labels: HashMap<String, String>,
}

impl TelemetryMetadata {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_trace(mut self, trace_id: impl Into<String>) -> Self {
        self.trace_id = Some(trace_id.into());
        self
    }

    pub fn with_span(mut self, span_id: impl Into<String>) -> Self {
        self.span_id = Some(span_id.into());
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_label(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.labels.insert(key.into(), value.into());
        self
    }
}

/// Compute SHA-256 hash of inputs for determinism verification.
pub fn compute_inputs_hash<T: Serialize>(inputs: &T) -> String {
    let json = serde_json::to_string(inputs).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Agent capability classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentClassification {
    /// Task decomposition agents
    TaskDecomposition,
    /// Structural analysis agents
    StructuralAnalysis,
    /// Intent classification agents
    IntentClassification,
    /// Dependency analysis agents
    DependencyAnalysis,
    /// Risk assessment agents
    RiskAssessment,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decision_event_creation() {
        let event = DecisionEvent::new(
            "decomposer-agent",
            "1.0.0",
            DecisionType::TaskDecomposition,
            "abc123hash",
            serde_json::json!({"tasks": []}),
            0.95,
        );

        assert_eq!(event.agent_id, "decomposer-agent");
        assert_eq!(event.agent_version, "1.0.0");
        assert_eq!(event.decision_type, DecisionType::TaskDecomposition);
        assert!(event.validate().is_ok());
    }

    #[test]
    fn test_decision_event_validation() {
        let event = DecisionEvent::new(
            "",
            "1.0.0",
            DecisionType::TaskDecomposition,
            "hash",
            serde_json::json!({}),
            0.5,
        );

        assert!(event.validate().is_err());
    }

    #[test]
    fn test_confidence_clamping() {
        let event = DecisionEvent::new(
            "test",
            "1.0.0",
            DecisionType::TaskDecomposition,
            "hash",
            serde_json::json!({}),
            1.5, // Should be clamped to 1.0
        );

        assert_eq!(event.confidence, 1.0);
    }

    #[test]
    fn test_compute_inputs_hash() {
        let input1 = serde_json::json!({"key": "value"});
        let input2 = serde_json::json!({"key": "value"});
        let input3 = serde_json::json!({"key": "different"});

        let hash1 = compute_inputs_hash(&input1);
        let hash2 = compute_inputs_hash(&input2);
        let hash3 = compute_inputs_hash(&input3);

        // Same input = same hash (deterministic)
        assert_eq!(hash1, hash2);
        // Different input = different hash
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_telemetry_metadata() {
        let telemetry = TelemetryMetadata::new()
            .with_trace("trace-123")
            .with_span("span-456")
            .with_duration(150)
            .with_label("service", "decomposer");

        assert_eq!(telemetry.trace_id, Some("trace-123".to_string()));
        assert_eq!(telemetry.duration_ms, Some(150));
    }
}
