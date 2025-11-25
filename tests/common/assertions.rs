//! Custom assertion helpers for tests
//!
//! This module provides specialized assertion functions for common test patterns.

use copilot_core::types::*;
use std::time::Duration;

/// Assert that an intent matches the expected category with sufficient confidence
pub fn assert_intent_matches(
    intent: &Intent,
    expected_category: IntentCategory,
    min_confidence: f32,
) {
    assert_eq!(
        intent.category, expected_category,
        "Expected intent category {:?}, got {:?}",
        expected_category, intent.category
    );
    assert!(
        intent.confidence >= min_confidence,
        "Expected confidence >= {}, got {}",
        min_confidence,
        intent.confidence
    );
}

/// Assert that an intent is confident (>= 0.7)
pub fn assert_intent_confident(intent: &Intent) {
    assert!(
        intent.is_confident(),
        "Expected confident intent (>= 0.7), got confidence: {}",
        intent.confidence
    );
}

/// Assert that a collection contains an entity of a specific type
pub fn assert_has_entity_type(entities: &[Entity], entity_type: &str) {
    let found = entities.iter().any(|e| e.entity_type == entity_type);
    assert!(
        found,
        "Expected to find entity of type '{}', but none found. Available types: {:?}",
        entity_type,
        entities.iter().map(|e| &e.entity_type).collect::<Vec<_>>()
    );
}

/// Assert that a collection contains an entity with a specific value
pub fn assert_has_entity_value(entities: &[Entity], value: &str) {
    let found = entities.iter().any(|e| e.value == value);
    assert!(
        found,
        "Expected to find entity with value '{}', but none found. Available values: {:?}",
        value,
        entities.iter().map(|e| &e.value).collect::<Vec<_>>()
    );
}

/// Assert that an entity has sufficient confidence
pub fn assert_entity_confident(entity: &Entity, min_confidence: f32) {
    assert!(
        entity.confidence >= min_confidence,
        "Expected entity '{}' confidence >= {}, got {}",
        entity.value,
        min_confidence,
        entity.confidence
    );
}

/// Assert that a message has the expected role
pub fn assert_message_role(message: &Message, expected_role: MessageRole) {
    assert_eq!(
        message.role, expected_role,
        "Expected message role {:?}, got {:?}",
        expected_role, message.role
    );
}

/// Assert that a message contains specific text
pub fn assert_message_contains(message: &Message, text: &str) {
    assert!(
        message.content.contains(text),
        "Expected message to contain '{}', but got: '{}'",
        text,
        message.content
    );
}

/// Assert that a conversation has a specific number of messages
pub fn assert_conversation_length(conversation: &Conversation, expected_length: usize) {
    assert_eq!(
        conversation.messages.len(),
        expected_length,
        "Expected conversation to have {} messages, got {}",
        expected_length,
        conversation.messages.len()
    );
}

/// Assert that a conversation has messages from a specific role
pub fn assert_conversation_has_role(conversation: &Conversation, role: MessageRole) {
    let has_role = conversation.messages.iter().any(|m| m.role == role);
    assert!(
        has_role,
        "Expected conversation to have messages from role {:?}",
        role
    );
}

/// Assert that context contains a specific key
pub fn assert_context_has_key(
    context: &std::collections::HashMap<String, serde_json::Value>,
    key: &str,
) {
    assert!(
        context.contains_key(key),
        "Expected context to contain key '{}', available keys: {:?}",
        key,
        context.keys().collect::<Vec<_>>()
    );
}

/// Assert that context value matches expected
pub fn assert_context_value(
    context: &std::collections::HashMap<String, serde_json::Value>,
    key: &str,
    expected: &serde_json::Value,
) {
    let value = context.get(key).expect(&format!("Key '{}' not found", key));
    assert_eq!(
        value, expected,
        "Expected context['{}'] = {:?}, got {:?}",
        key, expected, value
    );
}

/// Assert that a duration is within acceptable range
pub fn assert_duration_within(actual: Duration, expected: Duration, tolerance: Duration) {
    let lower = expected.saturating_sub(tolerance);
    let upper = expected.saturating_add(tolerance);

    assert!(
        actual >= lower && actual <= upper,
        "Expected duration within {:?} ± {:?}, got {:?}",
        expected,
        tolerance,
        actual
    );
}

/// Assert that a response time is acceptable (< max_duration)
pub fn assert_response_time_acceptable(duration: Duration, max_duration: Duration) {
    assert!(
        duration < max_duration,
        "Response time {:?} exceeds maximum {:?}",
        duration,
        max_duration
    );
}

/// Assert that a collection is not empty
pub fn assert_not_empty<T>(collection: &[T], name: &str) {
    assert!(
        !collection.is_empty(),
        "Expected {} to not be empty",
        name
    );
}

/// Assert that a collection has a specific size
pub fn assert_collection_size<T>(collection: &[T], expected_size: usize, name: &str) {
    assert_eq!(
        collection.len(),
        expected_size,
        "Expected {} to have {} items, got {}",
        name,
        expected_size,
        collection.len()
    );
}

/// Assert that a value is within a numeric range
pub fn assert_in_range<T: PartialOrd + std::fmt::Display>(
    value: T,
    min: T,
    max: T,
    name: &str,
) {
    assert!(
        value >= min && value <= max,
        "Expected {} to be in range [{}, {}], got {}",
        name,
        min,
        max,
        value
    );
}

/// Assert that a percentage is valid (0.0 - 100.0)
pub fn assert_valid_percentage(value: f64, name: &str) {
    assert_in_range(value, 0.0, 100.0, name);
}

/// Assert that a confidence score is valid (0.0 - 1.0)
pub fn assert_valid_confidence(value: f32, name: &str) {
    assert!(
        value >= 0.0 && value <= 1.0,
        "Expected {} to be in range [0.0, 1.0], got {}",
        name,
        value
    );
}

/// Assert that two JSON values are semantically equal (ignoring order)
pub fn assert_json_eq(actual: &serde_json::Value, expected: &serde_json::Value) {
    assert_eq!(
        actual, expected,
        "JSON values do not match.\nActual:\n{}\n\nExpected:\n{}",
        serde_json::to_string_pretty(actual).unwrap(),
        serde_json::to_string_pretty(expected).unwrap()
    );
}

/// Assert that a string matches a regex pattern
pub fn assert_matches_regex(text: &str, pattern: &str) {
    let re = regex::Regex::new(pattern).expect("Invalid regex pattern");
    assert!(
        re.is_match(text),
        "Expected text to match pattern '{}', got: '{}'",
        pattern,
        text
    );
}

/// Assert that an error message contains specific text
pub fn assert_error_contains<E: std::fmt::Display>(error: &E, text: &str) {
    let error_msg = error.to_string();
    assert!(
        error_msg.contains(text),
        "Expected error to contain '{}', got: '{}'",
        text,
        error_msg
    );
}

/// Custom assertion for workflow DAG validation
pub mod workflow {
    use copilot_workflow::dag::WorkflowDag;
    use std::collections::HashSet;

    pub fn assert_dag_valid(dag: &WorkflowDag) {
        assert!(
            dag.validate().is_ok(),
            "Expected DAG to be valid"
        );
    }

    pub fn assert_step_exists(dag: &WorkflowDag, step_id: &str) {
        assert!(
            dag.get_step(step_id).is_some(),
            "Expected step '{}' to exist in DAG",
            step_id
        );
    }

    pub fn assert_step_ready(
        dag: &WorkflowDag,
        step_id: &str,
        completed: &HashSet<String>,
    ) {
        let ready_steps = dag.get_ready_steps(completed);
        assert!(
            ready_steps.contains(&step_id.to_string()),
            "Expected step '{}' to be ready",
            step_id
        );
    }

    pub fn assert_has_dependency(dag: &WorkflowDag, step_id: &str, dependency_id: &str) {
        let deps = dag.get_dependencies(step_id);
        assert!(
            deps.contains(&dependency_id.to_string()),
            "Expected step '{}' to depend on '{}'",
            step_id,
            dependency_id
        );
    }
}

/// Session-specific assertions
pub mod session {
    use copilot_conversation::session::{Session, SessionState};

    pub fn assert_session_active(session: &Session) {
        assert_eq!(
            session.state,
            SessionState::Active,
            "Expected session to be active, got {:?}",
            session.state
        );
    }

    pub fn assert_session_has_tokens(session: &Session, expected: usize) {
        assert_eq!(
            session.total_tokens, expected,
            "Expected session to have {} tokens, got {}",
            expected, session.total_tokens
        );
    }

    pub fn assert_session_within_limit(session: &Session) {
        assert!(
            session.total_tokens <= session.max_tokens,
            "Session tokens {} exceeds limit {}",
            session.total_tokens,
            session.max_tokens
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assert_intent_matches() {
        let intent = Intent::new(IntentCategory::MetricQuery, 0.95);
        assert_intent_matches(&intent, IntentCategory::MetricQuery, 0.9);
    }

    #[test]
    #[should_panic(expected = "Expected confident intent")]
    fn test_assert_intent_confident_fails() {
        let intent = Intent::new(IntentCategory::MetricQuery, 0.5);
        assert_intent_confident(&intent);
    }

    #[test]
    fn test_assert_has_entity_type() {
        let entities = vec![
            Entity::new("service".to_string(), "auth".to_string(), 0.9),
            Entity::new("region".to_string(), "us-east-1".to_string(), 0.8),
        ];
        assert_has_entity_type(&entities, "service");
        assert_has_entity_type(&entities, "region");
    }

    #[test]
    fn test_assert_duration_within() {
        let actual = Duration::from_millis(105);
        let expected = Duration::from_millis(100);
        let tolerance = Duration::from_millis(10);
        assert_duration_within(actual, expected, tolerance);
    }

    #[test]
    fn test_assert_in_range() {
        assert_in_range(5, 0, 10, "value");
        assert_in_range(0, 0, 10, "value");
        assert_in_range(10, 0, 10, "value");
    }

    #[test]
    fn test_assert_valid_confidence() {
        assert_valid_confidence(0.0, "min");
        assert_valid_confidence(0.5, "mid");
        assert_valid_confidence(1.0, "max");
    }

    #[test]
    fn test_assert_matches_regex() {
        assert_matches_regex("test@example.com", r"^[\w\.-]+@[\w\.-]+\.\w+$");
        assert_matches_regex("CPU usage", r"(?i)cpu");
    }
}
