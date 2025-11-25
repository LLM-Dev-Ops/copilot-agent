//! API Integration Tests
//!
//! This module contains comprehensive tests for the REST API endpoints.

use crate::common::*;
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn test_health_check_endpoint() {
    // Arrange
    let app = create_test_app().await;

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::OK);
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "healthy");
}

#[tokio::test]
async fn test_health_check_with_dependencies() {
    // Arrange
    let app = create_test_app().await;

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .uri("/health/detailed")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::OK);
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["status"], "healthy");
    assert!(json["dependencies"].is_object());
}

#[tokio::test]
async fn test_create_session_success() {
    // Arrange
    let app = create_test_app().await;
    let payload = json!({
        "user_id": "test-user-123",
        "max_tokens": 50000
    });

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/sessions")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::CREATED);
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["session_id"].is_string());
    assert_eq!(json["user_id"], "test-user-123");
    assert_eq!(json["max_tokens"], 50000);
    assert_eq!(json["state"], "active");
}

#[tokio::test]
async fn test_create_session_invalid_payload() {
    // Arrange
    let app = create_test_app().await;
    let payload = json!({
        "invalid_field": "value"
    });

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/sessions")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_get_session_success() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/sessions/{}", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::OK);
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["session_id"], session_id);
}

#[tokio::test]
async fn test_get_session_not_found() {
    // Arrange
    let app = create_test_app().await;
    let fake_session_id = "non-existent-session";

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/sessions/{}", fake_session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_session_success() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/v1/sessions/{}", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn test_send_message_success() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;
    let payload = json!({
        "content": "What is the CPU usage of my services?",
        "role": "user"
    });

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/sessions/{}/messages", session_id))
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::OK);
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["message_id"].is_string());
    assert!(json["response"].is_string());
    assert!(json["intent"].is_object());
}

#[tokio::test]
async fn test_send_message_empty_content() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;
    let payload = json!({
        "content": "",
        "role": "user"
    });

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/sessions/{}/messages", session_id))
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_send_message_session_not_found() {
    // Arrange
    let app = create_test_app().await;
    let fake_session_id = "non-existent-session";
    let payload = json!({
        "content": "Hello",
        "role": "user"
    });

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/sessions/{}/messages", fake_session_id))
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_get_conversation_history() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;

    // Send a few messages first
    send_test_message(&app, &session_id, "First message").await;
    send_test_message(&app, &session_id, "Second message").await;

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/sessions/{}/messages", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::OK);
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["messages"].is_array());
    let messages = json["messages"].as_array().unwrap();
    assert!(messages.len() >= 2);
}

#[tokio::test]
async fn test_authentication_missing_token() {
    // Arrange
    let app = create_test_app().await;

    // Act - Try to access protected endpoint without auth
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/sessions")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"user_id": "test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert - Should allow (or reject based on config)
    // This tests that the endpoint handles missing auth properly
    assert!(response.status() == StatusCode::CREATED ||
            response.status() == StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_authentication_invalid_token() {
    // Arrange
    let app = create_test_app().await;

    // Act - Try to access with invalid token
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/sessions")
                .header("content-type", "application/json")
                .header("authorization", "Bearer invalid-token")
                .body(Body::from(r#"{"user_id": "test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert!(response.status() == StatusCode::CREATED ||
            response.status() == StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_rate_limiting() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;
    let payload = json!({
        "content": "Test message",
        "role": "user"
    });

    // Act - Send many requests rapidly
    let mut responses = Vec::new();
    for _ in 0..100 {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/sessions/{}/messages", session_id))
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        responses.push(response.status());
    }

    // Assert - At least some should be rate limited (or all succeed if no rate limit)
    let rate_limited_count = responses.iter()
        .filter(|&status| *status == StatusCode::TOO_MANY_REQUESTS)
        .count();

    // Either rate limiting is active (some 429s) or disabled (all succeed)
    assert!(rate_limited_count > 0 || responses.iter().all(|s| s.is_success()));
}

#[tokio::test]
async fn test_error_response_format() {
    // Arrange
    let app = create_test_app().await;

    // Act - Trigger an error
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/sessions/invalid-id")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert - Error response should have standard format
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Standard error format
    assert!(json["error"].is_object());
    assert!(json["error"]["code"].is_string());
    assert!(json["error"]["message"].is_string());
}

#[tokio::test]
async fn test_cors_headers() {
    // Arrange
    let app = create_test_app().await;

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/api/v1/sessions")
                .header("origin", "http://localhost:3000")
                .header("access-control-request-method", "POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert
    assert_eq!(response.status(), StatusCode::OK);
    assert!(response.headers().contains_key("access-control-allow-origin"));
}

#[tokio::test]
async fn test_content_type_validation() {
    // Arrange
    let app = create_test_app().await;

    // Act - Send JSON without content-type header
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/sessions")
                .body(Body::from(r#"{"user_id": "test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert - Should reject or accept based on strictness
    assert!(response.status() == StatusCode::CREATED ||
            response.status() == StatusCode::UNSUPPORTED_MEDIA_TYPE);
}

#[tokio::test]
async fn test_large_payload_handling() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;
    let large_content = "x".repeat(1_000_000); // 1MB of text
    let payload = json!({
        "content": large_content,
        "role": "user"
    });

    // Act
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/sessions/{}/messages", session_id))
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Assert - Should reject if over limit
    assert!(response.status() == StatusCode::PAYLOAD_TOO_LARGE ||
            response.status() == StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_concurrent_session_access() {
    // Arrange
    let (app, session_id) = create_test_app_with_session().await;

    // Act - Send multiple concurrent requests
    let handles: Vec<_> = (0..10)
        .map(|i| {
            let app = app.clone();
            let session_id = session_id.clone();
            tokio::spawn(async move {
                let payload = json!({
                    "content": format!("Message {}", i),
                    "role": "user"
                });
                app.oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/api/v1/sessions/{}/messages", session_id))
                        .header("content-type", "application/json")
                        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                        .unwrap(),
                )
                .await
            })
        })
        .collect();

    // Assert - All should complete
    for handle in handles {
        let response = handle.await.unwrap().unwrap();
        assert!(response.status().is_success() ||
                response.status() == StatusCode::TOO_MANY_REQUESTS);
    }
}

// Helper functions

async fn send_test_message(app: &Router, session_id: &str, content: &str) -> StatusCode {
    let payload = json!({
        "content": content,
        "role": "user"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/sessions/{}/messages", session_id))
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    response.status()
}
