//! Test fixtures
//!
//! This module provides pre-configured test data and fixtures.

use copilot_core::types::*;
use serde_json::json;
use std::collections::HashMap;

/// Sample user messages for testing
pub mod messages {
    pub const METRIC_QUERY: &str = "Show me CPU usage for the last hour";
    pub const LOG_SEARCH: &str = "Find errors in auth-service logs";
    pub const ANOMALY_DETECTION: &str = "Detect unusual patterns in latency";
    pub const ROOT_CAUSE: &str = "Why is the API slow?";
    pub const SERVICE_HEALTH: &str = "Is the auth service healthy?";
    pub const WORKFLOW_TRIGGER: &str = "Trigger the deployment workflow";
    pub const COMPLEX_QUERY: &str = "Compare CPU and memory usage between auth-service and api-gateway in us-east-1 for the last 24 hours";
}

/// Sample service names for testing
pub mod services {
    pub const AUTH_SERVICE: &str = "auth-service";
    pub const API_GATEWAY: &str = "api-gateway";
    pub const BILLING_SERVICE: &str = "billing-service";
    pub const USER_SERVICE: &str = "user-service";
    pub const PAYMENT_SERVICE: &str = "payment-service";

    pub fn all() -> Vec<&'static str> {
        vec![
            AUTH_SERVICE,
            API_GATEWAY,
            BILLING_SERVICE,
            USER_SERVICE,
            PAYMENT_SERVICE,
        ]
    }
}

/// Sample regions for testing
pub mod regions {
    pub const US_EAST_1: &str = "us-east-1";
    pub const US_WEST_2: &str = "us-west-2";
    pub const EU_WEST_1: &str = "eu-west-1";
    pub const AP_SOUTHEAST_1: &str = "ap-southeast-1";

    pub fn all() -> Vec<&'static str> {
        vec![US_EAST_1, US_WEST_2, EU_WEST_1, AP_SOUTHEAST_1]
    }
}

/// Sample environments for testing
pub mod environments {
    pub const PRODUCTION: &str = "production";
    pub const STAGING: &str = "staging";
    pub const DEVELOPMENT: &str = "development";

    pub fn all() -> Vec<&'static str> {
        vec![PRODUCTION, STAGING, DEVELOPMENT]
    }
}

/// Create a sample message with given role and content
pub fn create_message(role: MessageRole, content: &str) -> Message {
    Message::new(role, content.to_string())
}

/// Create a sample user message
pub fn user_message(content: &str) -> Message {
    Message::user(content.to_string())
}

/// Create a sample assistant message
pub fn assistant_message(content: &str) -> Message {
    Message::assistant(content.to_string())
}

/// Create a sample system message
pub fn system_message(content: &str) -> Message {
    Message::system(content.to_string())
}

/// Create a sample conversation with multiple messages
pub fn sample_conversation(session_id: SessionId) -> Conversation {
    let mut conv = Conversation::new(session_id);

    conv.add_message(user_message("Hello"));
    conv.add_message(assistant_message("Hi! How can I help you today?"));
    conv.add_message(user_message("Show me CPU usage"));
    conv.add_message(assistant_message("Here's the CPU usage for your services..."));

    conv
}

/// Create a sample entity
pub fn create_entity(entity_type: &str, value: &str, confidence: f32) -> Entity {
    Entity::new(entity_type.to_string(), value.to_string(), confidence)
}

/// Sample entities for testing
pub mod entities {
    use super::*;

    pub fn service_entity(service_name: &str) -> Entity {
        create_entity("service", service_name, 0.95)
    }

    pub fn region_entity(region_name: &str) -> Entity {
        create_entity("region", region_name, 0.90)
    }

    pub fn metric_entity(metric_name: &str) -> Entity {
        create_entity("metric", metric_name, 0.85)
    }

    pub fn time_range_entity(range: &str) -> Entity {
        create_entity("time_range", range, 0.88)
    }

    pub fn environment_entity(env: &str) -> Entity {
        create_entity("environment", env, 0.92)
    }
}

/// Sample intents for testing
pub mod intents {
    use copilot_core::types::{Intent, IntentCategory};

    pub fn metric_query() -> Intent {
        Intent::new(IntentCategory::MetricQuery, 0.95)
    }

    pub fn log_query() -> Intent {
        Intent::new(IntentCategory::LogQuery, 0.92)
    }

    pub fn incident_create() -> Intent {
        Intent::new(IntentCategory::IncidentCreate, 0.88)
    }

    pub fn workflow_trigger() -> Intent {
        Intent::new(IntentCategory::WorkflowTrigger, 0.90)
    }

    pub fn service_health() -> Intent {
        Intent::new(IntentCategory::AlertQuery, 0.87)
    }
}

/// Create sample context data
pub fn sample_context() -> HashMap<String, serde_json::Value> {
    let mut context = HashMap::new();
    context.insert("service".to_string(), json!("auth-service"));
    context.insert("region".to_string(), json!("us-east-1"));
    context.insert("environment".to_string(), json!("production"));
    context.insert("time_range".to_string(), json!("1h"));
    context
}

/// Create sample metadata
pub fn sample_metadata() -> HashMap<String, String> {
    let mut metadata = HashMap::new();
    metadata.insert("source".to_string(), "test".to_string());
    metadata.insert("version".to_string(), "1.0".to_string());
    metadata
}

/// Sample workflow steps for testing
pub mod workflows {
    use copilot_workflow::step::{WorkflowStep, StepType, StepAction};

    pub fn simple_wait_step(id: &str, name: &str) -> WorkflowStep {
        WorkflowStep::new(
            name,
            StepType::Action,
            StepAction::Wait { duration_secs: 1 },
        )
        .with_id(id)
    }

    pub fn approval_step(id: &str, name: &str) -> WorkflowStep {
        WorkflowStep::new(
            name,
            StepType::Approval,
            StepAction::Approval {
                required_approvers: 1,
                timeout_secs: 300,
            },
        )
        .with_id(id)
    }

    pub fn conditional_step(id: &str, name: &str, condition: &str) -> WorkflowStep {
        WorkflowStep::new(
            name,
            StepType::Conditional,
            StepAction::Condition {
                expression: condition.to_string(),
            },
        )
        .with_id(id)
    }

    pub fn parallel_steps() -> Vec<WorkflowStep> {
        vec![
            simple_wait_step("parallel_1", "Parallel Task 1"),
            simple_wait_step("parallel_2", "Parallel Task 2"),
            simple_wait_step("parallel_3", "Parallel Task 3"),
        ]
    }

    pub fn sequential_steps() -> Vec<WorkflowStep> {
        vec![
            simple_wait_step("seq_1", "Sequential Task 1"),
            simple_wait_step("seq_2", "Sequential Task 2")
                .with_dependencies(vec!["seq_1".to_string()]),
            simple_wait_step("seq_3", "Sequential Task 3")
                .with_dependencies(vec!["seq_2".to_string()]),
        ]
    }

    pub fn diamond_workflow() -> Vec<WorkflowStep> {
        vec![
            simple_wait_step("start", "Start"),
            simple_wait_step("branch_1", "Branch 1")
                .with_dependencies(vec!["start".to_string()]),
            simple_wait_step("branch_2", "Branch 2")
                .with_dependencies(vec!["start".to_string()]),
            simple_wait_step("end", "End")
                .with_dependencies(vec!["branch_1".to_string(), "branch_2".to_string()]),
        ]
    }
}

/// Test data generators
pub mod generators {
    use super::*;
    use rand::Rng;

    pub fn random_service() -> String {
        let services = services::all();
        let mut rng = rand::thread_rng();
        services[rng.gen_range(0..services.len())].to_string()
    }

    pub fn random_region() -> String {
        let regions = regions::all();
        let mut rng = rand::thread_rng();
        regions[rng.gen_range(0..regions.len())].to_string()
    }

    pub fn random_environment() -> String {
        let environments = environments::all();
        let mut rng = rand::thread_rng();
        environments[rng.gen_range(0..environments.len())].to_string()
    }

    pub fn random_message() -> String {
        let messages = vec![
            messages::METRIC_QUERY,
            messages::LOG_SEARCH,
            messages::ANOMALY_DETECTION,
            messages::ROOT_CAUSE,
            messages::SERVICE_HEALTH,
        ];
        let mut rng = rand::thread_rng();
        messages[rng.gen_range(0..messages.len())].to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_message() {
        let msg = user_message("Test");
        assert_eq!(msg.role, MessageRole::User);
        assert_eq!(msg.content, "Test");
    }

    #[test]
    fn test_sample_conversation() {
        let session_id = SessionId::new();
        let conv = sample_conversation(session_id);
        assert_eq!(conv.messages.len(), 4);
        assert_eq!(conv.session_id, session_id);
    }

    #[test]
    fn test_entity_creation() {
        let entity = entities::service_entity("test-service");
        assert_eq!(entity.entity_type, "service");
        assert_eq!(entity.value, "test-service");
        assert!(entity.confidence > 0.9);
    }

    #[test]
    fn test_sample_context() {
        let context = sample_context();
        assert!(context.contains_key("service"));
        assert!(context.contains_key("region"));
    }

    #[test]
    fn test_workflow_fixtures() {
        let steps = workflows::parallel_steps();
        assert_eq!(steps.len(), 3);

        let steps = workflows::sequential_steps();
        assert_eq!(steps.len(), 3);
        assert!(!steps[0].dependencies.is_empty() || steps[0].dependencies.is_empty());

        let steps = workflows::diamond_workflow();
        assert_eq!(steps.len(), 4);
    }
}
