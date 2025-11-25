use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;
use tracing::{info, warn};

use crate::{InfraError, Result};

#[derive(Debug, Clone)]
pub struct PgPoolConfig {
    pub database_url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connect_timeout: Duration,
    pub idle_timeout: Option<Duration>,
    pub max_lifetime: Option<Duration>,
}

impl Default for PgPoolConfig {
    fn default() -> Self {
        Self {
            database_url: String::from("postgres://localhost/copilot"),
            max_connections: 20,
            min_connections: 5,
            connect_timeout: Duration::from_secs(30),
            idle_timeout: Some(Duration::from_secs(600)),
            max_lifetime: Some(Duration::from_secs(1800)),
        }
    }
}

impl PgPoolConfig {
    pub fn new(database_url: impl Into<String>) -> Self {
        Self {
            database_url: database_url.into(),
            ..Default::default()
        }
    }

    pub fn with_max_connections(mut self, max: u32) -> Self {
        self.max_connections = max;
        self
    }

    pub fn with_min_connections(mut self, min: u32) -> Self {
        self.min_connections = min;
        self
    }

    pub fn with_connect_timeout(mut self, timeout: Duration) -> Self {
        self.connect_timeout = timeout;
        self
    }

    pub fn with_idle_timeout(mut self, timeout: Option<Duration>) -> Self {
        self.idle_timeout = timeout;
        self
    }

    pub fn with_max_lifetime(mut self, lifetime: Option<Duration>) -> Self {
        self.max_lifetime = lifetime;
        self
    }
}

/// Creates a new PostgreSQL connection pool with the given configuration
pub async fn create_pool(config: &PgPoolConfig) -> Result<PgPool> {
    info!(
        "Creating database pool with max_connections={}, min_connections={}",
        config.max_connections, config.min_connections
    );

    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(config.connect_timeout)
        .idle_timeout(config.idle_timeout)
        .max_lifetime(config.max_lifetime)
        .connect(&config.database_url)
        .await
        .map_err(|e| {
            warn!("Failed to create database pool: {}", e);
            InfraError::Database(e)
        })?;

    info!("Database pool created successfully");
    Ok(pool)
}

/// Checks the health of a database connection pool
pub async fn check_pool_health(pool: &PgPool) -> Result<()> {
    sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .map_err(|e| {
            warn!("Database health check failed: {}", e);
            InfraError::HealthCheck(format!("Database health check failed: {}", e))
        })?;

    Ok(())
}

/// Acquires a connection from the pool and tests it
pub async fn test_connection(pool: &PgPool) -> Result<()> {
    let mut conn = pool.acquire().await.map_err(|e| {
        warn!("Failed to acquire connection: {}", e);
        InfraError::Database(e)
    })?;

    sqlx::query("SELECT version()")
        .fetch_one(&mut *conn)
        .await
        .map_err(|e| {
            warn!("Failed to query database version: {}", e);
            InfraError::Database(e)
        })?;

    info!("Database connection test successful");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_config_builder() {
        let config = PgPoolConfig::new("postgres://localhost/test")
            .with_max_connections(10)
            .with_min_connections(2)
            .with_connect_timeout(Duration::from_secs(5));

        assert_eq!(config.max_connections, 10);
        assert_eq!(config.min_connections, 2);
        assert_eq!(config.connect_timeout, Duration::from_secs(5));
    }

    #[test]
    fn test_default_config() {
        let config = PgPoolConfig::default();
        assert_eq!(config.max_connections, 20);
        assert_eq!(config.min_connections, 5);
    }
}
