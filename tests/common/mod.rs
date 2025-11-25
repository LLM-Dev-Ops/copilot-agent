//! Common test utilities
//!
//! This module provides shared test fixtures, mock builders,
//! assertion helpers, and test database setup.

use axum::Router;
use copilot_core::types::*;
use copilot_conversation::session::{Session, SessionManager, SessionConfig};
use copilot_nlp::intent::{IntentClassifier, IntentType};
use copilot_workflow::step::{WorkflowStep, StepType, StepAction};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub mod fixtures;
pub mod mocks;
pub mod assertions;
pub mod database;

// Re-export commonly used items
pub use fixtures::*;
pub use mocks::*;
pub use database::*;

// Assertions are namespaced to avoid conflicts
pub use assertions::{
    assert_intent_matches, assert_intent_confident,
    assert_has_entity_type, assert_has_entity_value,
    assert_message_role, assert_message_contains,
    assert_conversation_length, assert_conversation_has_role,
    assert_context_has_key, assert_context_value,
    assert_duration_within, assert_response_time_acceptable,
    assert_not_empty, assert_collection_size,
    assert_in_range, assert_valid_percentage, assert_valid_confidence,
    assert_json_eq, assert_matches_regex, assert_error_contains,
};

// Test configuration constants
pub const TEST_SESSION_TIMEOUT: i64 = 3600;
pub const TEST_MAX_TOKENS: usize = 100_000;
pub const TEST_DB_URL: &str = "postgresql://test:test@localhost:5432/copilot_test";
pub const TEST_REDIS_URL: &str = "redis://localhost:6379/1";

/// Create a test Axum application
pub async fn create_test_app() -> Router {
    // TODO: Initialize actual app when API crate is available
    Router::new()
}

/// Create a test app with a pre-created session
pub async fn create_test_app_with_session() -> (Router, String) {
    let app = create_test_app().await;
    let session_id = Uuid::new_v4().to_string();
    (app, session_id)
}

/// Create a test session manager
pub fn create_test_session_manager() -> (SessionManager, String) {
    let mut manager = SessionManager::new();
    let session = manager.create_session(Some(TEST_MAX_TOKENS));
    (manager, session.id)
}

/// Create a test session manager with specific token limit
pub fn create_test_session_manager_with_limit(max_tokens: usize) -> (SessionManager, String) {
    let mut manager = SessionManager::new();
    let session = manager.create_session(Some(max_tokens));
    (manager, session.id)
}

/// Create a test intent classifier
pub fn create_test_intent_classifier() -> IntentClassifier {
    IntentClassifier::new()
}

/// Create test messages
pub struct MessageBuilder {
    role: MessageRole,
    content: String,
    metadata: std::collections::HashMap<String, serde_json::Value>,
}

impl MessageBuilder {
    pub fn new() -> Self {
        Self {
            role: MessageRole::User,
            content: String::new(),
            metadata: std::collections::HashMap::new(),
        }
    }

    pub fn user() -> Self {
        Self::new().with_role(MessageRole::User)
    }

    pub fn assistant() -> Self {
        Self::new().with_role(MessageRole::Assistant)
    }

    pub fn system() -> Self {
        Self::new().with_role(MessageRole::System)
    }

    pub fn with_role(mut self, role: MessageRole) -> Self {
        self.role = role;
        self
    }

    pub fn with_content(mut self, content: impl Into<String>) -> Self {
        self.content = content.into();
        self
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.metadata.insert(key.into(), value);
        self
    }

    pub fn build(self) -> Message {
        let mut msg = Message::new(self.role, self.content);
        for (key, value) in self.metadata {
            msg.add_metadata(key, value);
        }
        msg
    }
}

impl Default for MessageBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Create test conversation
pub struct ConversationBuilder {
    session_id: SessionId,
    messages: Vec<Message>,
    context: std::collections::HashMap<String, serde_json::Value>,
}

impl ConversationBuilder {
    pub fn new(session_id: SessionId) -> Self {
        Self {
            session_id,
            messages: Vec::new(),
            context: std::collections::HashMap::new(),
        }
    }

    pub fn with_message(mut self, message: Message) -> Self {
        self.messages.push(message);
        self
    }

    pub fn with_user_message(self, content: impl Into<String>) -> Self {
        self.with_message(Message::user(content.into()))
    }

    pub fn with_assistant_message(self, content: impl Into<String>) -> Self {
        self.with_message(Message::assistant(content.into()))
    }

    pub fn with_context(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.context.insert(key.into(), value);
        self
    }

    pub fn build(self) -> Conversation {
        let mut conv = Conversation::new(self.session_id);
        for message in self.messages {
            conv.add_message(message);
        }
        for (key, value) in self.context {
            conv.set_context(key, value);
        }
        conv
    }
}

/// Create test workflow step
pub struct StepBuilder {
    id: String,
    name: String,
    step_type: StepType,
    action: StepAction,
    dependencies: Vec<String>,
    timeout: Option<std::time::Duration>,
}

impl StepBuilder {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            step_type: StepType::Action,
            action: StepAction::Wait { duration_secs: 0 },
            dependencies: Vec::new(),
            timeout: None,
        }
    }

    pub fn with_id(mut self, id: impl Into<String>) -> Self {
        self.id = id.into();
        self
    }

    pub fn with_type(mut self, step_type: StepType) -> Self {
        self.step_type = step_type;
        self
    }

    pub fn with_action(mut self, action: StepAction) -> Self {
        self.action = action;
        self
    }

    pub fn with_dependency(mut self, dep: impl Into<String>) -> Self {
        self.dependencies.push(dep.into());
        self
    }

    pub fn with_dependencies(mut self, deps: Vec<String>) -> Self {
        self.dependencies = deps;
        self
    }

    pub fn with_timeout(mut self, timeout: std::time::Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn build(self) -> WorkflowStep {
        let mut step = WorkflowStep::new(&self.name, self.step_type, self.action);
        step.id = self.id;
        step.dependencies = self.dependencies;
        if let Some(timeout) = self.timeout {
            step.timeout = Some(timeout);
        }
        step
    }
}

/// Wait for a condition with timeout
pub async fn wait_for_condition<F>(
    mut check: F,
    timeout: std::time::Duration,
    interval: std::time::Duration,
) -> bool
where
    F: FnMut() -> bool,
{
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if check() {
            return true;
        }
        tokio::time::sleep(interval).await;
    }
    false
}

/// Generate random test data
pub mod random {
    use super::*;
    use rand::Rng;

    pub fn string(len: usize) -> String {
        use rand::distributions::Alphanumeric;
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(len)
            .map(char::from)
            .collect()
    }

    pub fn session_id() -> SessionId {
        SessionId::new()
    }

    pub fn user_id() -> UserId {
        UserId::new()
    }

    pub fn message_id() -> MessageId {
        MessageId::new()
    }

    pub fn conversation_id() -> ConversationId {
        ConversationId::new()
    }

    pub fn number(min: i32, max: i32) -> i32 {
        rand::thread_rng().gen_range(min..=max)
    }

    pub fn boolean() -> bool {
        rand::thread_rng().gen()
    }
}

/// Test assertion helpers
#[macro_export]
macro_rules! assert_session_active {
    ($session:expr) => {
        assert_eq!(
            $session.state,
            copilot_conversation::session::SessionState::Active,
            "Expected session to be active"
        );
    };
}

#[macro_export]
macro_rules! assert_intent_type {
    ($intent:expr, $expected:expr) => {
        assert_eq!(
            $intent.intent_type,
            $expected,
            "Expected intent type {:?}, got {:?}",
            $expected,
            $intent.intent_type
        );
    };
}

#[macro_export]
macro_rules! assert_intent_confident {
    ($intent:expr) => {
        assert!(
            $intent.is_confident(),
            "Expected confident intent (>= 0.7), got confidence: {}",
            $intent.confidence
        );
    };
}

#[macro_export]
macro_rules! assert_message_role {
    ($message:expr, $expected:expr) => {
        assert_eq!(
            $message.role,
            $expected,
            "Expected message role {:?}, got {:?}",
            $expected,
            $message.role
        );
    };
}

/// Snapshot testing helper
pub struct Snapshot {
    name: String,
    content: serde_json::Value,
}

impl Snapshot {
    pub fn new(name: impl Into<String>, content: serde_json::Value) -> Self {
        Self {
            name: name.into(),
            content,
        }
    }

    pub fn assert_matches(&self) {
        // TODO: Implement snapshot comparison
        // This would compare against stored snapshots
    }

    pub fn update(&self) {
        // TODO: Implement snapshot update
        // This would update the stored snapshot
    }
}

/// Performance measurement helper
pub struct Benchmark {
    name: String,
    start: std::time::Instant,
}

impl Benchmark {
    pub fn start(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            start: std::time::Instant::now(),
        }
    }

    pub fn stop(self) -> std::time::Duration {
        let elapsed = self.start.elapsed();
        println!("[BENCH] {}: {:?}", self.name, elapsed);
        elapsed
    }

    pub fn stop_and_assert_under(self, max: std::time::Duration) {
        let elapsed = self.stop();
        assert!(
            elapsed < max,
            "Benchmark {} took {:?}, expected under {:?}",
            self.name,
            elapsed,
            max
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_builder() {
        let msg = MessageBuilder::user()
            .with_content("Test message")
            .with_metadata("key", json!("value"))
            .build();

        assert_eq!(msg.role, MessageRole::User);
        assert_eq!(msg.content, "Test message");
        assert_eq!(msg.metadata.get("key").unwrap(), &json!("value"));
    }

    #[test]
    fn test_conversation_builder() {
        let session_id = SessionId::new();
        let conv = ConversationBuilder::new(session_id)
            .with_user_message("Hello")
            .with_assistant_message("Hi there")
            .with_context("test", json!(true))
            .build();

        assert_eq!(conv.session_id, session_id);
        assert_eq!(conv.messages.len(), 2);
        assert_eq!(conv.context.get("test").unwrap(), &json!(true));
    }

    #[test]
    fn test_step_builder() {
        let step = StepBuilder::new("Test Step")
            .with_id("step1")
            .with_dependency("step0")
            .build();

        assert_eq!(step.id, "step1");
        assert_eq!(step.name, "Test Step");
        assert_eq!(step.dependencies, vec!["step0"]);
    }

    #[tokio::test]
    async fn test_wait_for_condition() {
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;

        let flag = Arc::new(AtomicBool::new(false));
        let flag_clone = flag.clone();

        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            flag_clone.store(true, Ordering::SeqCst);
        });

        let result = wait_for_condition(
            || flag.load(Ordering::SeqCst),
            std::time::Duration::from_secs(1),
            std::time::Duration::from_millis(10),
        )
        .await;

        assert!(result);
    }

    #[test]
    fn test_random_generators() {
        let s1 = random::string(10);
        let s2 = random::string(10);
        assert_eq!(s1.len(), 10);
        assert_eq!(s2.len(), 10);
        assert_ne!(s1, s2);

        let n = random::number(1, 10);
        assert!(n >= 1 && n <= 10);
    }

    #[test]
    fn test_benchmark() {
        let bench = Benchmark::start("test");
        std::thread::sleep(std::time::Duration::from_millis(10));
        let elapsed = bench.stop();
        assert!(elapsed >= std::time::Duration::from_millis(10));
    }
}
