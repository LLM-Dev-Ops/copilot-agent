//! Telemetry integration for LLM-Observatory.
//!
//! Provides tracing and metrics emission compatible with the LLM-Observatory platform.
//! All agents MUST emit telemetry for observability.

use crate::agents::contracts::{DecisionEvent, TelemetryMetadata};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Telemetry event types for LLM-Observatory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryEventType {
    /// Agent invocation started
    AgentInvocationStart,
    /// Agent invocation completed
    AgentInvocationComplete,
    /// Agent invocation failed
    AgentInvocationFailed,
    /// Decision event emitted
    DecisionEventEmitted,
}

/// Telemetry event for LLM-Observatory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    /// Event type
    pub event_type: TelemetryEventType,
    /// Timestamp in ISO 8601 format
    pub timestamp: String,
    /// Agent identifier
    pub agent_id: String,
    /// Agent version
    pub agent_version: String,
    /// Trace ID for distributed tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    /// Span ID for this operation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span_id: Option<String>,
    /// Parent span ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_span_id: Option<String>,
    /// Duration in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    /// Success status
    pub success: bool,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Additional attributes
    #[serde(default)]
    pub attributes: HashMap<String, String>,
}

impl TelemetryEvent {
    /// Create a new telemetry event.
    pub fn new(
        event_type: TelemetryEventType,
        agent_id: impl Into<String>,
        agent_version: impl Into<String>,
    ) -> Self {
        Self {
            event_type,
            timestamp: chrono::Utc::now().to_rfc3339(),
            agent_id: agent_id.into(),
            agent_version: agent_version.into(),
            trace_id: None,
            span_id: None,
            parent_span_id: None,
            duration_ms: None,
            success: true,
            error: None,
            attributes: HashMap::new(),
        }
    }

    /// Create an invocation start event.
    pub fn invocation_start(agent_id: impl Into<String>, agent_version: impl Into<String>) -> Self {
        Self::new(TelemetryEventType::AgentInvocationStart, agent_id, agent_version)
    }

    /// Create an invocation complete event.
    pub fn invocation_complete(
        agent_id: impl Into<String>,
        agent_version: impl Into<String>,
        duration_ms: u64,
    ) -> Self {
        Self::new(TelemetryEventType::AgentInvocationComplete, agent_id, agent_version)
            .with_duration(duration_ms)
    }

    /// Create an invocation failed event.
    pub fn invocation_failed(
        agent_id: impl Into<String>,
        agent_version: impl Into<String>,
        error: impl Into<String>,
    ) -> Self {
        let mut event = Self::new(TelemetryEventType::AgentInvocationFailed, agent_id, agent_version);
        event.success = false;
        event.error = Some(error.into());
        event
    }

    /// Create a decision event emitted telemetry.
    pub fn from_decision_event(decision: &DecisionEvent) -> Self {
        let mut event = Self::new(
            TelemetryEventType::DecisionEventEmitted,
            &decision.agent_id,
            &decision.agent_version,
        );

        event.trace_id = decision.telemetry.trace_id.clone();
        event.span_id = decision.telemetry.span_id.clone();
        event.parent_span_id = decision.telemetry.parent_span_id.clone();
        event.duration_ms = decision.telemetry.duration_ms;

        // Copy labels as attributes
        for (key, value) in &decision.telemetry.labels {
            event.attributes.insert(key.clone(), value.clone());
        }

        // Add decision-specific attributes
        event.attributes.insert(
            "decision_type".to_string(),
            format!("{:?}", decision.decision_type),
        );
        event.attributes.insert(
            "confidence".to_string(),
            format!("{:.4}", decision.confidence),
        );
        event.attributes.insert(
            "execution_ref".to_string(),
            decision.execution_ref.clone(),
        );

        event
    }

    /// Set trace ID.
    pub fn with_trace_id(mut self, trace_id: impl Into<String>) -> Self {
        self.trace_id = Some(trace_id.into());
        self
    }

    /// Set span ID.
    pub fn with_span_id(mut self, span_id: impl Into<String>) -> Self {
        self.span_id = Some(span_id.into());
        self
    }

    /// Set parent span ID.
    pub fn with_parent_span_id(mut self, parent_span_id: impl Into<String>) -> Self {
        self.parent_span_id = Some(parent_span_id.into());
        self
    }

    /// Set duration.
    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    /// Add attribute.
    pub fn with_attribute(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.attributes.insert(key.into(), value.into());
        self
    }

    /// Mark as failed with error.
    pub fn failed(mut self, error: impl Into<String>) -> Self {
        self.success = false;
        self.error = Some(error.into());
        self
    }

    /// Convert to JSON for emission.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Convert to JSON pretty-printed.
    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
}

/// Telemetry context for tracing across agent invocations.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TelemetryContext {
    /// Current trace ID
    pub trace_id: Option<String>,
    /// Current span ID
    pub span_id: Option<String>,
    /// Baggage items passed across boundaries
    #[serde(default)]
    pub baggage: HashMap<String, String>,
}

impl TelemetryContext {
    /// Create a new telemetry context with a generated trace ID.
    pub fn new() -> Self {
        Self {
            trace_id: Some(uuid::Uuid::new_v4().to_string()),
            span_id: Some(uuid::Uuid::new_v4().to_string()),
            baggage: HashMap::new(),
        }
    }

    /// Create a child context (new span, same trace).
    pub fn child(&self) -> Self {
        Self {
            trace_id: self.trace_id.clone(),
            span_id: Some(uuid::Uuid::new_v4().to_string()),
            baggage: self.baggage.clone(),
        }
    }

    /// Convert to TelemetryMetadata for inclusion in DecisionEvent.
    pub fn to_metadata(&self) -> TelemetryMetadata {
        let mut metadata = TelemetryMetadata::new();
        if let Some(ref trace_id) = self.trace_id {
            metadata = metadata.with_trace(trace_id.clone());
        }
        if let Some(ref span_id) = self.span_id {
            metadata = metadata.with_span(span_id.clone());
        }
        for (key, value) in &self.baggage {
            metadata = metadata.with_label(key.clone(), value.clone());
        }
        metadata
    }

    /// Add baggage item.
    pub fn with_baggage(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.baggage.insert(key.into(), value.into());
        self
    }
}

/// Metrics for agent performance monitoring.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentMetrics {
    /// Total invocations
    pub total_invocations: u64,
    /// Successful invocations
    pub successful_invocations: u64,
    /// Failed invocations
    pub failed_invocations: u64,
    /// Average latency in milliseconds
    pub avg_latency_ms: f64,
    /// P95 latency in milliseconds
    pub p95_latency_ms: f64,
    /// P99 latency in milliseconds
    pub p99_latency_ms: f64,
    /// Average confidence score
    pub avg_confidence: f64,
}

impl AgentMetrics {
    /// Calculate success rate.
    pub fn success_rate(&self) -> f64 {
        if self.total_invocations == 0 {
            0.0
        } else {
            self.successful_invocations as f64 / self.total_invocations as f64
        }
    }

    /// Calculate failure rate.
    pub fn failure_rate(&self) -> f64 {
        if self.total_invocations == 0 {
            0.0
        } else {
            self.failed_invocations as f64 / self.total_invocations as f64
        }
    }
}

/// OpenTelemetry-compatible span data for export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OTelSpan {
    /// Trace ID (16 bytes hex)
    pub trace_id: String,
    /// Span ID (8 bytes hex)
    pub span_id: String,
    /// Parent span ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_span_id: Option<String>,
    /// Operation name
    pub name: String,
    /// Span kind
    pub kind: SpanKind,
    /// Start timestamp (Unix nano)
    pub start_time_unix_nano: u64,
    /// End timestamp (Unix nano)
    pub end_time_unix_nano: u64,
    /// Span attributes
    #[serde(default)]
    pub attributes: Vec<KeyValue>,
    /// Status
    pub status: SpanStatus,
}

/// Span kind for OpenTelemetry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SpanKind {
    Internal,
    Server,
    Client,
    Producer,
    Consumer,
}

/// Key-value pair for OpenTelemetry attributes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyValue {
    pub key: String,
    pub value: AttributeValue,
}

/// Attribute value types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AttributeValue {
    String(String),
    Int(i64),
    Float(f64),
    Bool(bool),
}

/// Span status for OpenTelemetry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanStatus {
    pub code: StatusCode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Status codes for OpenTelemetry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StatusCode {
    Unset,
    Ok,
    Error,
}

impl OTelSpan {
    /// Create a span from a DecisionEvent.
    pub fn from_decision_event(decision: &DecisionEvent, start_time_ns: u64) -> Self {
        let end_time_ns = start_time_ns
            + decision.telemetry.duration_ms.unwrap_or(0) * 1_000_000;

        let mut attributes = vec![
            KeyValue {
                key: "agent.id".to_string(),
                value: AttributeValue::String(decision.agent_id.clone()),
            },
            KeyValue {
                key: "agent.version".to_string(),
                value: AttributeValue::String(decision.agent_version.clone()),
            },
            KeyValue {
                key: "decision.type".to_string(),
                value: AttributeValue::String(format!("{:?}", decision.decision_type)),
            },
            KeyValue {
                key: "decision.confidence".to_string(),
                value: AttributeValue::Float(decision.confidence as f64),
            },
            KeyValue {
                key: "decision.inputs_hash".to_string(),
                value: AttributeValue::String(decision.inputs_hash.clone()),
            },
        ];

        // Add labels as attributes
        for (key, value) in &decision.telemetry.labels {
            attributes.push(KeyValue {
                key: format!("custom.{}", key),
                value: AttributeValue::String(value.clone()),
            });
        }

        Self {
            trace_id: decision
                .telemetry
                .trace_id
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            span_id: decision
                .telemetry
                .span_id
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            parent_span_id: decision.telemetry.parent_span_id.clone(),
            name: format!("agent.{}.invoke", decision.agent_id),
            kind: SpanKind::Internal,
            start_time_unix_nano: start_time_ns,
            end_time_unix_nano: end_time_ns,
            attributes,
            status: SpanStatus {
                code: StatusCode::Ok,
                message: None,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::contracts::{DecisionEvent, DecisionType};

    #[test]
    fn test_telemetry_event_creation() {
        let event = TelemetryEvent::invocation_start("test-agent", "1.0.0");
        assert_eq!(event.agent_id, "test-agent");
        assert_eq!(event.event_type, TelemetryEventType::AgentInvocationStart);
        assert!(event.success);
    }

    #[test]
    fn test_telemetry_event_failed() {
        let event = TelemetryEvent::invocation_failed("test-agent", "1.0.0", "Something went wrong");
        assert!(!event.success);
        assert_eq!(event.error, Some("Something went wrong".to_string()));
    }

    #[test]
    fn test_telemetry_context() {
        let ctx = TelemetryContext::new();
        assert!(ctx.trace_id.is_some());
        assert!(ctx.span_id.is_some());

        let child = ctx.child();
        assert_eq!(child.trace_id, ctx.trace_id);
        assert_ne!(child.span_id, ctx.span_id);
    }

    #[test]
    fn test_telemetry_from_decision_event() {
        let decision = DecisionEvent::new(
            "decomposer-agent",
            "1.0.0",
            DecisionType::TaskDecomposition,
            "hash123",
            serde_json::json!({}),
            0.95,
        );

        let telemetry = TelemetryEvent::from_decision_event(&decision);
        assert_eq!(telemetry.agent_id, "decomposer-agent");
        assert_eq!(
            telemetry.event_type,
            TelemetryEventType::DecisionEventEmitted
        );
        assert!(telemetry.attributes.contains_key("decision_type"));
    }

    #[test]
    fn test_agent_metrics() {
        let metrics = AgentMetrics {
            total_invocations: 100,
            successful_invocations: 95,
            failed_invocations: 5,
            avg_latency_ms: 50.0,
            p95_latency_ms: 100.0,
            p99_latency_ms: 150.0,
            avg_confidence: 0.92,
        };

        assert_eq!(metrics.success_rate(), 0.95);
        assert_eq!(metrics.failure_rate(), 0.05);
    }

    #[test]
    fn test_telemetry_event_json() {
        let event = TelemetryEvent::invocation_start("test-agent", "1.0.0")
            .with_attribute("key", "value");

        let json = event.to_json().unwrap();
        assert!(json.contains("test-agent"));
        assert!(json.contains("agent_invocation_start"));
    }
}
