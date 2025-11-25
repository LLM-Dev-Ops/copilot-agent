//! Conversation Integration Tests
//!
//! This module tests multi-turn conversations, context retention,
//! reference resolution, and token limit handling.

use crate::common::*;
use serde_json::json;

#[tokio::test]
async fn test_multi_turn_conversation_basic() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Multiple turns
    let turn1 = send_conversation_message(&session_manager, &session_id, "What is the CPU usage?").await;
    let turn2 = send_conversation_message(&session_manager, &session_id, "What about memory?").await;
    let turn3 = send_conversation_message(&session_manager, &session_id, "Show me the trend over the last hour").await;

    // Assert - All turns should succeed
    assert!(turn1.is_ok());
    assert!(turn2.is_ok());
    assert!(turn3.is_ok());

    // Verify conversation history
    let history = get_conversation_history(&session_manager, &session_id).await;
    assert_eq!(history.len(), 6); // 3 user + 3 assistant messages
}

#[tokio::test]
async fn test_context_retention_across_turns() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - First turn establishes context
    let turn1 = send_conversation_message(
        &session_manager,
        &session_id,
        "I want to monitor the auth-service"
    ).await;
    assert!(turn1.is_ok());

    // Second turn uses implicit reference
    let turn2 = send_conversation_message(
        &session_manager,
        &session_id,
        "What is its CPU usage?"
    ).await;
    assert!(turn2.is_ok());

    // Assert - Context should resolve "its" to auth-service
    let response = turn2.unwrap();
    assert!(response.context.contains_key("service_name") ||
            response.resolved_references.iter().any(|r| r.contains("auth-service")));
}

#[tokio::test]
async fn test_reference_resolution_explicit() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Use explicit references
    let turn1 = send_conversation_message(
        &session_manager,
        &session_id,
        "Show me errors for service A and service B"
    ).await;
    assert!(turn1.is_ok());

    let turn2 = send_conversation_message(
        &session_manager,
        &session_id,
        "Compare their error rates"
    ).await;

    // Assert - Should resolve "their" to both services
    assert!(turn2.is_ok());
    let response = turn2.unwrap();
    assert!(response.resolved_references.len() >= 1);
}

#[tokio::test]
async fn test_reference_resolution_temporal() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Establish time context
    let turn1 = send_conversation_message(
        &session_manager,
        &session_id,
        "Show me CPU usage for the last 24 hours"
    ).await;
    assert!(turn1.is_ok());

    let turn2 = send_conversation_message(
        &session_manager,
        &session_id,
        "Now show me memory for the same period"
    ).await;

    // Assert - Should resolve time reference
    assert!(turn2.is_ok());
    let response = turn2.unwrap();
    assert!(response.context.contains_key("time_range") ||
            response.resolved_references.iter().any(|r| r.contains("24 hours")));
}

#[tokio::test]
async fn test_context_accumulation() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Build up context
    send_conversation_message(&session_manager, &session_id, "Monitor service: api-gateway").await.unwrap();
    send_conversation_message(&session_manager, &session_id, "In region: us-east-1").await.unwrap();
    send_conversation_message(&session_manager, &session_id, "For environment: production").await.unwrap();

    let final_turn = send_conversation_message(
        &session_manager,
        &session_id,
        "Show me the metrics"
    ).await;

    // Assert - All context should be available
    assert!(final_turn.is_ok());
    let response = final_turn.unwrap();
    assert!(response.context.len() >= 3);
    assert!(response.context.contains_key("service") ||
            response.context.contains_key("service_name"));
}

#[tokio::test]
async fn test_context_override() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Set initial context
    send_conversation_message(&session_manager, &session_id, "Monitor service: auth-service").await.unwrap();

    // Override context
    let response = send_conversation_message(
        &session_manager,
        &session_id,
        "Actually, show me metrics for billing-service instead"
    ).await.unwrap();

    // Assert - Context should be updated
    let context_value = response.context.get("service_name")
        .or(response.context.get("service"))
        .unwrap();
    assert!(context_value.to_string().contains("billing"));
}

#[tokio::test]
async fn test_token_limit_tracking() {
    // Arrange
    let (mut session_manager, session_id) = create_test_session_manager_with_limit(1000);

    // Act - Send messages until near limit
    for i in 0..10 {
        let result = send_conversation_message(
            &session_manager,
            &session_id,
            &format!("Message {} with some content to use tokens", i)
        ).await;

        if result.is_err() {
            // Assert - Should fail with token limit error
            let err = result.unwrap_err();
            assert!(err.to_string().contains("token") ||
                    err.to_string().contains("limit"));
            return;
        }
    }

    // If we get here, check that tokens are being tracked
    let session = session_manager.get_session(&session_id).await.unwrap();
    assert!(session.total_tokens > 0);
}

#[tokio::test]
async fn test_token_limit_exceeded() {
    // Arrange - Very low token limit
    let (mut session_manager, session_id) = create_test_session_manager_with_limit(10);

    // Act - Try to send a large message
    let result = send_conversation_message(
        &session_manager,
        &session_id,
        "This is a very long message that should exceed the token limit"
    ).await;

    // Assert - Should fail
    assert!(result.is_err());
}

#[tokio::test]
async fn test_conversation_branching() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Create a conversation branch
    send_conversation_message(&session_manager, &session_id, "Show CPU usage").await.unwrap();
    send_conversation_message(&session_manager, &session_id, "Show memory usage").await.unwrap();

    // Create a new conversation in the same session
    let branch_result = send_conversation_message(
        &session_manager,
        &session_id,
        "Start new: Show disk usage"
    ).await;

    // Assert - Should handle branching
    assert!(branch_result.is_ok());
}

#[tokio::test]
async fn test_context_window_sliding() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Send many messages to test context window
    for i in 0..50 {
        send_conversation_message(
            &session_manager,
            &session_id,
            &format!("Message number {}", i)
        ).await.ok();
    }

    // Send a message that references early context
    let result = send_conversation_message(
        &session_manager,
        &session_id,
        "What was the first thing I asked about?"
    ).await;

    // Assert - Should either maintain history or indicate limitation
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_conversation_summarization() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Build up a long conversation
    for i in 0..20 {
        send_conversation_message(
            &session_manager,
            &session_id,
            &format!("Query about metric {} for service-{}", i, i)
        ).await.ok();
    }

    // Request a summary
    let result = send_conversation_message(
        &session_manager,
        &session_id,
        "Summarize our conversation"
    ).await;

    // Assert - Should provide summary
    assert!(result.is_ok());
    let response = result.unwrap();
    assert!(!response.content.is_empty());
}

#[tokio::test]
async fn test_anaphora_resolution() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Test pronoun resolution
    send_conversation_message(&session_manager, &session_id, "Show me the API gateway").await.unwrap();
    let response = send_conversation_message(
        &session_manager,
        &session_id,
        "What is it's latency?"
    ).await.unwrap();

    // Assert - Should resolve "it's" to API gateway
    assert!(response.resolved_references.iter().any(|r|
        r.to_lowercase().contains("gateway") || r.to_lowercase().contains("api")
    ));
}

#[tokio::test]
async fn test_context_reset() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Build context
    send_conversation_message(&session_manager, &session_id, "Monitor service: auth").await.unwrap();

    // Reset conversation
    reset_conversation(&session_manager, &session_id).await.unwrap();

    // Try to use previous context
    let response = send_conversation_message(
        &session_manager,
        &session_id,
        "Show me its metrics"
    ).await;

    // Assert - Should not resolve reference or should ask for clarification
    assert!(response.is_ok());
}

#[tokio::test]
async fn test_multiple_entity_tracking() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Mention multiple entities
    let response = send_conversation_message(
        &session_manager,
        &session_id,
        "Compare auth-service, api-gateway, and billing-service CPU usage in us-east-1 and eu-west-1"
    ).await.unwrap();

    // Assert - Should track all entities
    assert!(response.entities.len() >= 3); // At least services
    let service_entities: Vec<_> = response.entities.iter()
        .filter(|e| e.entity_type == "service")
        .collect();
    assert!(service_entities.len() >= 3);
}

#[tokio::test]
async fn test_conversation_state_persistence() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Create conversation state
    send_conversation_message(&session_manager, &session_id, "Set threshold to 80%").await.unwrap();
    send_conversation_message(&session_manager, &session_id, "Monitor CPU").await.unwrap();

    // Simulate session reload
    let reloaded_session = session_manager.get_session(&session_id).await.unwrap();

    // Assert - State should persist
    assert_eq!(reloaded_session.id, session_id);
}

#[tokio::test]
async fn test_conversation_intent_switching() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Switch between different intent types
    let metric_query = send_conversation_message(
        &session_manager,
        &session_id,
        "Show me CPU usage"
    ).await.unwrap();

    let log_search = send_conversation_message(
        &session_manager,
        &session_id,
        "Now find errors in the logs"
    ).await.unwrap();

    let workflow_trigger = send_conversation_message(
        &session_manager,
        &session_id,
        "Trigger the deployment workflow"
    ).await.unwrap();

    // Assert - Each should have correct intent
    assert!(metric_query.intent.intent_type.to_string().contains("metric"));
    assert!(log_search.intent.intent_type.to_string().contains("log"));
    assert!(workflow_trigger.intent.intent_type.to_string().contains("workflow"));
}

#[tokio::test]
async fn test_clarification_requests() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Send ambiguous query
    let response = send_conversation_message(
        &session_manager,
        &session_id,
        "Show me the metrics"
    ).await.unwrap();

    // Assert - Should ask for clarification or make reasonable assumptions
    assert!(response.content.contains("which") ||
            response.content.contains("specify") ||
            !response.context.is_empty());
}

#[tokio::test]
async fn test_conversation_metadata_tracking() {
    // Arrange
    let (session_manager, session_id) = create_test_session_manager();

    // Act - Send message and check metadata
    let response = send_conversation_message(
        &session_manager,
        &session_id,
        "Test message"
    ).await.unwrap();

    // Assert - Should have metadata
    assert!(response.metadata.contains_key("timestamp"));
    assert!(response.metadata.contains_key("session_id"));
}

// Helper functions

async fn send_conversation_message(
    session_manager: &SessionManager,
    session_id: &str,
    content: &str,
) -> Result<ConversationResponse, Box<dyn std::error::Error>> {
    // Implementation would interact with conversation manager
    todo!("Implement conversation message sending")
}

async fn get_conversation_history(
    session_manager: &SessionManager,
    session_id: &str,
) -> Vec<Message> {
    // Implementation would retrieve conversation history
    todo!("Implement history retrieval")
}

async fn reset_conversation(
    session_manager: &SessionManager,
    session_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Implementation would reset conversation state
    todo!("Implement conversation reset")
}

#[derive(Debug)]
struct ConversationResponse {
    content: String,
    context: std::collections::HashMap<String, serde_json::Value>,
    resolved_references: Vec<String>,
    entities: Vec<Entity>,
    intent: Intent,
    metadata: std::collections::HashMap<String, String>,
}

use copilot_core::types::{Entity, Intent, Message};
use copilot_conversation::session::SessionManager;
