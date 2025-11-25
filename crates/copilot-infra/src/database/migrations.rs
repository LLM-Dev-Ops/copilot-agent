use sqlx::PgPool;
use tracing::{info, warn, error};

use crate::{InfraError, Result};

#[derive(Debug, Clone)]
pub struct Migration {
    pub version: i32,
    pub name: String,
    pub up_sql: String,
    pub down_sql: String,
}

impl Migration {
    pub fn new(version: i32, name: impl Into<String>, up_sql: impl Into<String>, down_sql: impl Into<String>) -> Self {
        Self {
            version,
            name: name.into(),
            up_sql: up_sql.into(),
            down_sql: down_sql.into(),
        }
    }
}

/// Runs all pending migrations
pub async fn run_migrations(pool: &PgPool) -> Result<()> {
    info!("Running database migrations");

    // Create migrations table if it doesn't exist
    create_migrations_table(pool).await?;

    let migrations = get_migrations();
    let applied_versions = get_applied_migrations(pool).await?;

    for migration in migrations {
        if !applied_versions.contains(&migration.version) {
            apply_migration(pool, &migration).await?;
        } else {
            info!("Migration {} already applied: {}", migration.version, migration.name);
        }
    }

    info!("All migrations completed successfully");
    Ok(())
}

/// Rolls back the last N migrations
pub async fn rollback_migrations(pool: &PgPool, count: usize) -> Result<()> {
    info!("Rolling back {} migrations", count);

    let applied_versions = get_applied_migrations(pool).await?;
    let migrations = get_migrations();

    let mut applied_count = 0;
    for version in applied_versions.iter().rev().take(count) {
        if let Some(migration) = migrations.iter().find(|m| m.version == *version) {
            rollback_migration(pool, migration).await?;
            applied_count += 1;
        } else {
            warn!("Migration {} not found in migration list", version);
        }
    }

    info!("Rolled back {} migrations", applied_count);
    Ok(())
}

async fn create_migrations_table(pool: &PgPool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn get_applied_migrations(pool: &PgPool) -> Result<Vec<i32>> {
    let versions: Vec<(i32,)> = sqlx::query_as(
        r#"
        SELECT version FROM _migrations ORDER BY version
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(versions.into_iter().map(|(v,)| v).collect())
}

async fn apply_migration(pool: &PgPool, migration: &Migration) -> Result<()> {
    info!("Applying migration {}: {}", migration.version, migration.name);

    let mut tx = pool.begin().await?;

    // Execute migration SQL
    sqlx::query(&migration.up_sql)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("Failed to apply migration {}: {}", migration.version, e);
            InfraError::Migration(format!("Failed to apply migration {}: {}", migration.version, e))
        })?;

    // Record migration
    sqlx::query(
        r#"
        INSERT INTO _migrations (version, name, applied_at)
        VALUES ($1, $2, NOW())
        "#,
    )
    .bind(migration.version)
    .bind(&migration.name)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    info!("Migration {} applied successfully", migration.version);
    Ok(())
}

async fn rollback_migration(pool: &PgPool, migration: &Migration) -> Result<()> {
    info!("Rolling back migration {}: {}", migration.version, migration.name);

    let mut tx = pool.begin().await?;

    // Execute rollback SQL
    sqlx::query(&migration.down_sql)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!("Failed to rollback migration {}: {}", migration.version, e);
            InfraError::Migration(format!("Failed to rollback migration {}: {}", migration.version, e))
        })?;

    // Remove migration record
    sqlx::query(
        r#"
        DELETE FROM _migrations WHERE version = $1
        "#,
    )
    .bind(migration.version)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    info!("Migration {} rolled back successfully", migration.version);
    Ok(())
}

/// Returns all migrations in order
fn get_migrations() -> Vec<Migration> {
    vec![
        // Migration 1: Create sessions table
        Migration::new(
            1,
            "create_sessions_table",
            r#"
            CREATE TABLE sessions (
                id UUID PRIMARY KEY,
                user_id TEXT NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE
            );
            CREATE INDEX idx_sessions_user_id ON sessions(user_id);
            CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE expires_at IS NOT NULL;
            "#,
            r#"
            DROP TABLE IF EXISTS sessions;
            "#,
        ),

        // Migration 2: Create conversations table
        Migration::new(
            2,
            "create_conversations_table",
            r#"
            CREATE TABLE conversations (
                id UUID PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                title TEXT,
                metadata JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL
            );
            CREATE INDEX idx_conversations_session_id ON conversations(session_id);
            CREATE INDEX idx_conversations_created_at ON conversations(created_at);
            "#,
            r#"
            DROP TABLE IF EXISTS conversations;
            "#,
        ),

        // Migration 3: Create messages table
        Migration::new(
            3,
            "create_messages_table",
            r#"
            CREATE TABLE messages (
                id UUID PRIMARY KEY,
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL
            );
            CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
            CREATE INDEX idx_messages_created_at ON messages(created_at);
            "#,
            r#"
            DROP TABLE IF EXISTS messages;
            "#,
        ),

        // Migration 4: Create workflows table
        Migration::new(
            4,
            "create_workflows_table",
            r#"
            CREATE TABLE workflows (
                id UUID PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                definition JSONB NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                metadata JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL
            );
            CREATE INDEX idx_workflows_name ON workflows(name);
            CREATE INDEX idx_workflows_status ON workflows(status);
            CREATE INDEX idx_workflows_created_at ON workflows(created_at);
            "#,
            r#"
            DROP TABLE IF EXISTS workflows;
            "#,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migration_creation() {
        let migration = Migration::new(
            1,
            "test_migration",
            "CREATE TABLE test (id INT);",
            "DROP TABLE test;",
        );

        assert_eq!(migration.version, 1);
        assert_eq!(migration.name, "test_migration");
        assert!(migration.up_sql.contains("CREATE TABLE"));
        assert!(migration.down_sql.contains("DROP TABLE"));
    }

    #[test]
    fn test_migrations_are_ordered() {
        let migrations = get_migrations();

        for i in 1..migrations.len() {
            assert!(migrations[i].version > migrations[i - 1].version);
        }
    }

    #[test]
    fn test_all_migrations_have_rollback() {
        let migrations = get_migrations();

        for migration in migrations {
            assert!(!migration.down_sql.is_empty(), "Migration {} missing rollback", migration.version);
        }
    }
}
