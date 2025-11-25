use async_trait::async_trait;
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

use crate::error::AppResult;

/// Generic repository trait for data access operations
#[async_trait]
pub trait Repository<T>
where
    T: Send + Sync,
{
    type Id: Send + Sync;

    /// Find an entity by its identifier
    async fn find(&self, id: &Self::Id) -> AppResult<Option<T>>;

    /// Find all entities matching the given criteria
    async fn find_all(&self) -> AppResult<Vec<T>>;

    /// Save an entity (create or update)
    async fn save(&self, entity: &T) -> AppResult<T>;

    /// Delete an entity by its identifier
    async fn delete(&self, id: &Self::Id) -> AppResult<bool>;

    /// Check if an entity exists
    async fn exists(&self, id: &Self::Id) -> AppResult<bool> {
        Ok(self.find(id).await?.is_some())
    }

    /// Count all entities
    async fn count(&self) -> AppResult<u64>;
}

/// Cache trait for key-value storage operations
#[async_trait]
pub trait Cache
where
    Self: Send + Sync,
{
    type Key: Send + Sync;
    type Value: Serialize + DeserializeOwned + Send + Sync;

    /// Get a value from the cache
    async fn get(&self, key: &Self::Key) -> AppResult<Option<Self::Value>>;

    /// Set a value in the cache with optional expiration
    async fn set(&self, key: Self::Key, value: Self::Value, ttl: Option<Duration>) -> AppResult<()>;

    /// Delete a value from the cache
    async fn delete(&self, key: &Self::Key) -> AppResult<bool>;

    /// Check if a key exists in the cache
    async fn exists(&self, key: &Self::Key) -> AppResult<bool>;

    /// Set expiration time for a key
    async fn expire(&self, key: &Self::Key, ttl: Duration) -> AppResult<bool>;

    /// Get multiple values from the cache
    async fn get_many(&self, keys: &[Self::Key]) -> AppResult<Vec<Option<Self::Value>>>;

    /// Set multiple values in the cache
    async fn set_many(&self, items: Vec<(Self::Key, Self::Value)>, ttl: Option<Duration>) -> AppResult<()>;

    /// Delete multiple values from the cache
    async fn delete_many(&self, keys: &[Self::Key]) -> AppResult<usize>;

    /// Clear all values from the cache (use with caution)
    async fn clear(&self) -> AppResult<()>;

    /// Get time-to-live for a key
    async fn ttl(&self, key: &Self::Key) -> AppResult<Option<Duration>>;
}

/// Event publisher trait for publishing and subscribing to events
#[async_trait]
pub trait EventPublisher
where
    Self: Send + Sync,
{
    type Event: Serialize + DeserializeOwned + Send + Sync;
    type Subscriber: Send + Sync;

    /// Publish an event to a topic/channel
    async fn publish(&self, topic: &str, event: Self::Event) -> AppResult<()>;

    /// Publish multiple events to a topic/channel
    async fn publish_batch(&self, topic: &str, events: Vec<Self::Event>) -> AppResult<()>;

    /// Subscribe to a topic/channel
    async fn subscribe(&self, topic: &str) -> AppResult<Self::Subscriber>;

    /// Unsubscribe from a topic/channel
    async fn unsubscribe(&self, topic: &str) -> AppResult<()>;

    /// List all active topics
    async fn list_topics(&self) -> AppResult<Vec<String>>;

    /// Get subscriber count for a topic
    async fn subscriber_count(&self, topic: &str) -> AppResult<usize>;
}

/// Transaction trait for managing database transactions
#[async_trait]
pub trait Transaction
where
    Self: Send + Sync,
{
    /// Begin a new transaction
    async fn begin(&mut self) -> AppResult<()>;

    /// Commit the current transaction
    async fn commit(&mut self) -> AppResult<()>;

    /// Rollback the current transaction
    async fn rollback(&mut self) -> AppResult<()>;

    /// Check if a transaction is active
    fn is_active(&self) -> bool;
}

/// Health check trait for service health monitoring
#[async_trait]
pub trait HealthCheck
where
    Self: Send + Sync,
{
    /// Check if the service is healthy
    async fn check(&self) -> AppResult<HealthStatus>;

    /// Get the service name
    fn name(&self) -> &str;
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub message: Option<String>,
    pub details: Option<serde_json::Value>,
}

impl HealthStatus {
    pub fn healthy() -> Self {
        Self {
            healthy: true,
            message: None,
            details: None,
        }
    }

    pub fn unhealthy(message: String) -> Self {
        Self {
            healthy: false,
            message: Some(message),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_creation() {
        let healthy = HealthStatus::healthy();
        assert!(healthy.healthy);
        assert!(healthy.message.is_none());

        let unhealthy = HealthStatus::unhealthy("Service down".to_string());
        assert!(!unhealthy.healthy);
        assert_eq!(unhealthy.message.unwrap(), "Service down");
    }

    #[test]
    fn test_health_status_with_details() {
        let status = HealthStatus::healthy()
            .with_details(serde_json::json!({
                "uptime": 3600,
                "version": "1.0.0"
            }));

        assert!(status.healthy);
        assert!(status.details.is_some());
    }
}
