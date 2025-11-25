pub mod database;
pub mod cache;
pub mod messaging;
pub mod health;

pub use database::{
    pool::{create_pool, PgPoolConfig},
    repositories::{
        SessionRepository, ConversationRepository, MessageRepository, WorkflowRepository,
    },
    migrations::{run_migrations, rollback_migrations, Migration},
};

pub use cache::redis::{RedisCache, RedisCacheConfig};

pub use messaging::nats::{NatsPublisher, NatsConfig, NatsSubscriber};

pub use health::{
    DatabaseHealthCheck, RedisHealthCheck, NatsHealthCheck, CompositeHealthChecker, HealthStatus,
};

#[derive(Debug, thiserror::Error)]
pub enum InfraError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Cache error: {0}")]
    Cache(#[from] redis::RedisError),

    #[error("Messaging error: {0}")]
    Messaging(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Health check failed: {0}")]
    HealthCheck(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Migration error: {0}")]
    Migration(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, InfraError>;
