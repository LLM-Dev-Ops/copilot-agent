use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use tracing::{debug, warn};

use crate::{
    cache::redis::RedisCache,
    messaging::nats::NatsPublisher,
    InfraError, Result,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

impl HealthStatus {
    pub fn is_healthy(&self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }

    pub fn is_degraded(&self) -> bool {
        matches!(self, HealthStatus::Degraded)
    }

    pub fn is_unhealthy(&self) -> bool {
        matches!(self, HealthStatus::Unhealthy)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub status: HealthStatus,
    pub message: Option<String>,
    pub details: Option<HashMap<String, serde_json::Value>>,
}

impl HealthCheckResult {
    pub fn healthy() -> Self {
        Self {
            status: HealthStatus::Healthy,
            message: None,
            details: None,
        }
    }

    pub fn degraded(message: impl Into<String>) -> Self {
        Self {
            status: HealthStatus::Degraded,
            message: Some(message.into()),
            details: None,
        }
    }

    pub fn unhealthy(message: impl Into<String>) -> Self {
        Self {
            status: HealthStatus::Unhealthy,
            message: Some(message.into()),
            details: None,
        }
    }

    pub fn with_details(mut self, details: HashMap<String, serde_json::Value>) -> Self {
        self.details = Some(details);
        self
    }
}

#[async_trait]
pub trait HealthCheck: Send + Sync {
    async fn check(&self) -> Result<HealthCheckResult>;
    fn name(&self) -> &str;
}

// ============================================================================
// Database Health Check
// ============================================================================

pub struct DatabaseHealthCheck {
    pool: PgPool,
}

impl DatabaseHealthCheck {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl HealthCheck for DatabaseHealthCheck {
    async fn check(&self) -> Result<HealthCheckResult> {
        debug!("Checking database health");

        match sqlx::query("SELECT 1").execute(&self.pool).await {
            Ok(_) => {
                // Get connection pool stats
                let mut details = HashMap::new();
                details.insert(
                    "connections".to_string(),
                    serde_json::json!(self.pool.size()),
                );
                details.insert(
                    "idle_connections".to_string(),
                    serde_json::json!(self.pool.num_idle()),
                );

                Ok(HealthCheckResult::healthy().with_details(details))
            }
            Err(e) => {
                warn!("Database health check failed: {}", e);
                Ok(HealthCheckResult::unhealthy(format!(
                    "Database connection failed: {}",
                    e
                )))
            }
        }
    }

    fn name(&self) -> &str {
        "database"
    }
}

// ============================================================================
// Redis Health Check
// ============================================================================

pub struct RedisHealthCheck {
    cache: RedisCache,
}

impl RedisHealthCheck {
    pub fn new(cache: RedisCache) -> Self {
        Self { cache }
    }
}

#[async_trait]
impl HealthCheck for RedisHealthCheck {
    async fn check(&self) -> Result<HealthCheckResult> {
        debug!("Checking Redis health");

        match self.cache.health_check().await {
            Ok(_) => Ok(HealthCheckResult::healthy()),
            Err(e) => {
                warn!("Redis health check failed: {}", e);
                Ok(HealthCheckResult::unhealthy(format!(
                    "Redis connection failed: {}",
                    e
                )))
            }
        }
    }

    fn name(&self) -> &str {
        "redis"
    }
}

// ============================================================================
// NATS Health Check
// ============================================================================

pub struct NatsHealthCheck {
    publisher: NatsPublisher,
}

impl NatsHealthCheck {
    pub fn new(publisher: NatsPublisher) -> Self {
        Self { publisher }
    }
}

#[async_trait]
impl HealthCheck for NatsHealthCheck {
    async fn check(&self) -> Result<HealthCheckResult> {
        debug!("Checking NATS health");

        match self.publisher.health_check().await {
            Ok(_) => Ok(HealthCheckResult::healthy()),
            Err(e) => {
                warn!("NATS health check failed: {}", e);
                Ok(HealthCheckResult::unhealthy(format!(
                    "NATS connection failed: {}",
                    e
                )))
            }
        }
    }

    fn name(&self) -> &str {
        "nats"
    }
}

// ============================================================================
// Composite Health Checker
// ============================================================================

pub struct CompositeHealthChecker {
    checks: Vec<Box<dyn HealthCheck>>,
}

impl CompositeHealthChecker {
    pub fn new() -> Self {
        Self { checks: Vec::new() }
    }

    pub fn add_check(mut self, check: Box<dyn HealthCheck>) -> Self {
        self.checks.push(check);
        self
    }

    pub async fn check_all(&self) -> Result<HashMap<String, HealthCheckResult>> {
        debug!("Running all health checks");

        let mut results = HashMap::new();

        for check in &self.checks {
            let name = check.name().to_string();
            match check.check().await {
                Ok(result) => {
                    results.insert(name, result);
                }
                Err(e) => {
                    warn!("Health check for {} failed: {}", name, e);
                    results.insert(
                        name,
                        HealthCheckResult::unhealthy(format!("Health check error: {}", e)),
                    );
                }
            }
        }

        Ok(results)
    }

    pub async fn check_overall(&self) -> Result<HealthCheckResult> {
        let results = self.check_all().await?;

        let unhealthy_count = results
            .values()
            .filter(|r| r.status == HealthStatus::Unhealthy)
            .count();

        let degraded_count = results
            .values()
            .filter(|r| r.status == HealthStatus::Degraded)
            .count();

        let status = if unhealthy_count > 0 {
            HealthStatus::Unhealthy
        } else if degraded_count > 0 {
            HealthStatus::Degraded
        } else {
            HealthStatus::Healthy
        };

        let message = match status {
            HealthStatus::Healthy => Some("All checks passed".to_string()),
            HealthStatus::Degraded => Some(format!("{} checks degraded", degraded_count)),
            HealthStatus::Unhealthy => Some(format!("{} checks failed", unhealthy_count)),
        };

        let details = results
            .into_iter()
            .map(|(k, v)| (k, serde_json::to_value(v).unwrap_or_default()))
            .collect();

        Ok(HealthCheckResult {
            status,
            message,
            details: Some(details),
        })
    }
}

impl Default for CompositeHealthChecker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status() {
        assert!(HealthStatus::Healthy.is_healthy());
        assert!(!HealthStatus::Healthy.is_degraded());
        assert!(!HealthStatus::Healthy.is_unhealthy());

        assert!(!HealthStatus::Degraded.is_healthy());
        assert!(HealthStatus::Degraded.is_degraded());
        assert!(!HealthStatus::Degraded.is_unhealthy());

        assert!(!HealthStatus::Unhealthy.is_healthy());
        assert!(!HealthStatus::Unhealthy.is_degraded());
        assert!(HealthStatus::Unhealthy.is_unhealthy());
    }

    #[test]
    fn test_health_check_result_builders() {
        let healthy = HealthCheckResult::healthy();
        assert_eq!(healthy.status, HealthStatus::Healthy);
        assert!(healthy.message.is_none());

        let degraded = HealthCheckResult::degraded("Service slow");
        assert_eq!(degraded.status, HealthStatus::Degraded);
        assert_eq!(degraded.message, Some("Service slow".to_string()));

        let unhealthy = HealthCheckResult::unhealthy("Connection failed");
        assert_eq!(unhealthy.status, HealthStatus::Unhealthy);
        assert_eq!(unhealthy.message, Some("Connection failed".to_string()));
    }

    #[test]
    fn test_health_check_result_with_details() {
        let mut details = HashMap::new();
        details.insert("connections".to_string(), serde_json::json!(10));

        let result = HealthCheckResult::healthy().with_details(details);
        assert!(result.details.is_some());
        assert_eq!(
            result.details.unwrap().get("connections"),
            Some(&serde_json::json!(10))
        );
    }

    #[test]
    fn test_composite_health_checker_creation() {
        let checker = CompositeHealthChecker::new();
        assert_eq!(checker.checks.len(), 0);
    }
}
