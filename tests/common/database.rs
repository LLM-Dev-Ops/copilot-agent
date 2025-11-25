//! Test database setup and utilities
//!
//! This module provides utilities for setting up and managing test databases.

use sqlx::{postgres::PgPoolOptions, PgPool, Postgres};
use std::sync::Once;
use uuid::Uuid;

static INIT: Once = Once::new();

/// Initialize test database connection pool
pub async fn create_test_db_pool() -> PgPool {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://test_user:test_pass@localhost:5432/copilot_test".to_string());

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test database")
}

/// Create a unique test database for isolation
pub async fn create_isolated_test_db() -> (PgPool, String) {
    let base_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://test_user:test_pass@localhost:5432".to_string());

    let db_name = format!("test_db_{}", Uuid::new_v4().simple());

    // Connect to postgres database to create new test database
    let mut base_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&format!("{}/postgres", base_url))
        .await
        .expect("Failed to connect to postgres database");

    // Create test database
    sqlx::query(&format!("CREATE DATABASE {}", db_name))
        .execute(&mut base_pool)
        .await
        .expect("Failed to create test database");

    // Connect to the new test database
    let test_db_url = format!("{}/{}", base_url, db_name);
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&test_db_url)
        .await
        .expect("Failed to connect to test database");

    (pool, db_name)
}

/// Drop a test database
pub async fn drop_test_db(db_name: &str) {
    let base_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://test_user:test_pass@localhost:5432".to_string());

    let mut base_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&format!("{}/postgres", base_url))
        .await
        .expect("Failed to connect to postgres database");

    // Disconnect all connections to the database
    sqlx::query(&format!(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{}'",
        db_name
    ))
    .execute(&mut base_pool)
    .await
    .ok();

    // Drop the database
    sqlx::query(&format!("DROP DATABASE IF EXISTS {}", db_name))
        .execute(&mut base_pool)
        .await
        .expect("Failed to drop test database");
}

/// Run migrations on test database
pub async fn run_migrations(pool: &PgPool) {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .expect("Failed to run migrations");
}

/// Clean all data from test database tables
pub async fn clean_test_db(pool: &PgPool) {
    // List of tables to clean (in order to respect foreign keys)
    let tables = vec![
        "messages",
        "conversations",
        "sessions",
        "workflow_executions",
        "workflows",
        "context_documents",
        "embeddings",
    ];

    for table in tables {
        sqlx::query(&format!("TRUNCATE TABLE {} CASCADE", table))
            .execute(pool)
            .await
            .ok(); // Ignore errors if table doesn't exist
    }
}

/// Seed test data into database
pub async fn seed_test_data(pool: &PgPool) {
    // Insert sample sessions
    sqlx::query(
        r#"
        INSERT INTO sessions (id, user_id, state, max_tokens, created_at, last_accessed)
        VALUES
            ('test-session-1', 'user-1', 'active', 100000, NOW(), NOW()),
            ('test-session-2', 'user-2', 'active', 50000, NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .execute(pool)
    .await
    .ok();

    // Insert sample conversations
    sqlx::query(
        r#"
        INSERT INTO conversations (id, session_id, created_at, updated_at)
        VALUES
            ('conv-1', 'test-session-1', NOW(), NOW()),
            ('conv-2', 'test-session-2', NOW(), NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .execute(pool)
    .await
    .ok();

    // Insert sample messages
    sqlx::query(
        r#"
        INSERT INTO messages (id, conversation_id, role, content, created_at)
        VALUES
            ('msg-1', 'conv-1', 'user', 'Show me CPU usage', NOW()),
            ('msg-2', 'conv-1', 'assistant', 'Here is the CPU usage...', NOW())
        ON CONFLICT DO NOTHING
        "#,
    )
    .execute(pool)
    .await
    .ok();
}

/// Test database transaction helper
pub struct TestTransaction<'a> {
    transaction: sqlx::Transaction<'a, Postgres>,
}

impl<'a> TestTransaction<'a> {
    pub async fn begin(pool: &'a PgPool) -> Self {
        let transaction = pool.begin().await.expect("Failed to begin transaction");
        Self { transaction }
    }

    pub async fn commit(self) {
        self.transaction
            .commit()
            .await
            .expect("Failed to commit transaction");
    }

    pub async fn rollback(self) {
        self.transaction
            .rollback()
            .await
            .expect("Failed to rollback transaction");
    }

    pub fn as_mut(&mut self) -> &mut sqlx::Transaction<'a, Postgres> {
        &mut self.transaction
    }
}

/// Database test helper macros
#[macro_export]
macro_rules! with_test_db {
    ($test_fn:expr) => {{
        let pool = crate::common::database::create_test_db_pool().await;
        crate::common::database::clean_test_db(&pool).await;
        crate::common::database::run_migrations(&pool).await;
        $test_fn(pool).await;
    }};
}

#[macro_export]
macro_rules! with_isolated_test_db {
    ($test_fn:expr) => {{
        let (pool, db_name) = crate::common::database::create_isolated_test_db().await;
        crate::common::database::run_migrations(&pool).await;
        let result = $test_fn(pool).await;
        crate::common::database::drop_test_db(&db_name).await;
        result
    }};
}

#[macro_export]
macro_rules! with_seeded_test_db {
    ($test_fn:expr) => {{
        let pool = crate::common::database::create_test_db_pool().await;
        crate::common::database::clean_test_db(&pool).await;
        crate::common::database::run_migrations(&pool).await;
        crate::common::database::seed_test_data(&pool).await;
        $test_fn(pool).await;
    }};
}

/// Redis test helpers
pub mod redis {
    use redis::{aio::ConnectionManager, Client};

    pub async fn create_test_redis_client() -> Client {
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());

        Client::open(redis_url).expect("Failed to create Redis client")
    }

    pub async fn create_test_redis_connection() -> ConnectionManager {
        let client = create_test_redis_client().await;
        ConnectionManager::new(client)
            .await
            .expect("Failed to create Redis connection")
    }

    pub async fn flush_test_redis(conn: &mut ConnectionManager) {
        redis::cmd("FLUSHDB")
            .query_async::<_, ()>(conn)
            .await
            .expect("Failed to flush Redis");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires test database to be running
    async fn test_create_db_pool() {
        let pool = create_test_db_pool().await;
        assert!(pool.size() > 0);
    }

    #[tokio::test]
    #[ignore] // Requires test database to be running
    async fn test_isolated_db() {
        let (pool, db_name) = create_isolated_test_db().await;
        assert!(!db_name.is_empty());
        assert!(pool.size() > 0);
        drop_test_db(&db_name).await;
    }

    #[tokio::test]
    #[ignore] // Requires Redis to be running
    async fn test_redis_connection() {
        let mut conn = redis::create_test_redis_connection().await;
        redis::flush_test_redis(&mut conn).await;
    }
}
