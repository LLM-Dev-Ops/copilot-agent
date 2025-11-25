use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use tracing::{debug, error, info};

use crate::{InfraError, Result};

// ============================================================================
// Session Repository
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SessionRecord {
    pub id: Uuid,
    pub user_id: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct SessionRepository {
    pool: PgPool,
}

impl SessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        user_id: &str,
        metadata: serde_json::Value,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<SessionRecord> {
        debug!("Creating session for user_id={}", user_id);

        let session = sqlx::query_as::<_, SessionRecord>(
            r#"
            INSERT INTO sessions (id, user_id, metadata, expires_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(metadata)
        .bind(expires_at)
        .bind(Utc::now())
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        info!("Session created: id={}", session.id);
        Ok(session)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<SessionRecord> {
        debug!("Finding session by id={}", id);

        let session = sqlx::query_as::<_, SessionRecord>(
            r#"
            SELECT * FROM sessions WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Session not found: {}", id)))?;

        Ok(session)
    }

    pub async fn find_by_user_id(&self, user_id: &str) -> Result<Vec<SessionRecord>> {
        debug!("Finding sessions for user_id={}", user_id);

        let sessions = sqlx::query_as::<_, SessionRecord>(
            r#"
            SELECT * FROM sessions
            WHERE user_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        debug!("Found {} sessions for user_id={}", sessions.len(), user_id);
        Ok(sessions)
    }

    pub async fn update_metadata(&self, id: Uuid, metadata: serde_json::Value) -> Result<SessionRecord> {
        debug!("Updating session metadata: id={}", id);

        let session = sqlx::query_as::<_, SessionRecord>(
            r#"
            UPDATE sessions
            SET metadata = $1, updated_at = $2
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(metadata)
        .bind(Utc::now())
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Session not found: {}", id)))?;

        info!("Session metadata updated: id={}", id);
        Ok(session)
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        debug!("Deleting session: id={}", id);

        let result = sqlx::query("DELETE FROM sessions WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(InfraError::NotFound(format!("Session not found: {}", id)));
        }

        info!("Session deleted: id={}", id);
        Ok(())
    }

    pub async fn delete_expired(&self) -> Result<u64> {
        debug!("Deleting expired sessions");

        let result = sqlx::query(
            r#"
            DELETE FROM sessions
            WHERE expires_at IS NOT NULL AND expires_at < $1
            "#,
        )
        .bind(Utc::now())
        .execute(&self.pool)
        .await?;

        let count = result.rows_affected();
        info!("Deleted {} expired sessions", count);
        Ok(count)
    }
}

// ============================================================================
// Conversation Repository
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConversationRecord {
    pub id: Uuid,
    pub session_id: Uuid,
    pub title: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct ConversationRepository {
    pool: PgPool,
}

impl ConversationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        session_id: Uuid,
        title: Option<String>,
        metadata: serde_json::Value,
    ) -> Result<ConversationRecord> {
        debug!("Creating conversation for session_id={}", session_id);

        let conversation = sqlx::query_as::<_, ConversationRecord>(
            r#"
            INSERT INTO conversations (id, session_id, title, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(session_id)
        .bind(title)
        .bind(metadata)
        .bind(Utc::now())
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        info!("Conversation created: id={}", conversation.id);
        Ok(conversation)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<ConversationRecord> {
        debug!("Finding conversation by id={}", id);

        let conversation = sqlx::query_as::<_, ConversationRecord>(
            r#"
            SELECT * FROM conversations WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Conversation not found: {}", id)))?;

        Ok(conversation)
    }

    pub async fn find_by_session_id(&self, session_id: Uuid) -> Result<Vec<ConversationRecord>> {
        debug!("Finding conversations for session_id={}", session_id);

        let conversations = sqlx::query_as::<_, ConversationRecord>(
            r#"
            SELECT * FROM conversations
            WHERE session_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;

        debug!("Found {} conversations for session_id={}", conversations.len(), session_id);
        Ok(conversations)
    }

    pub async fn update_title(&self, id: Uuid, title: String) -> Result<ConversationRecord> {
        debug!("Updating conversation title: id={}", id);

        let conversation = sqlx::query_as::<_, ConversationRecord>(
            r#"
            UPDATE conversations
            SET title = $1, updated_at = $2
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(title)
        .bind(Utc::now())
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Conversation not found: {}", id)))?;

        info!("Conversation title updated: id={}", id);
        Ok(conversation)
    }

    pub async fn update_metadata(&self, id: Uuid, metadata: serde_json::Value) -> Result<ConversationRecord> {
        debug!("Updating conversation metadata: id={}", id);

        let conversation = sqlx::query_as::<_, ConversationRecord>(
            r#"
            UPDATE conversations
            SET metadata = $1, updated_at = $2
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(metadata)
        .bind(Utc::now())
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Conversation not found: {}", id)))?;

        info!("Conversation metadata updated: id={}", id);
        Ok(conversation)
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        debug!("Deleting conversation: id={}", id);

        let result = sqlx::query("DELETE FROM conversations WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(InfraError::NotFound(format!("Conversation not found: {}", id)));
        }

        info!("Conversation deleted: id={}", id);
        Ok(())
    }
}

// ============================================================================
// Message Repository
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MessageRecord {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub role: String,
    pub content: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct MessageRepository {
    pool: PgPool,
}

impl MessageRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        conversation_id: Uuid,
        role: &str,
        content: &str,
        metadata: serde_json::Value,
    ) -> Result<MessageRecord> {
        debug!("Creating message for conversation_id={}", conversation_id);

        let message = sqlx::query_as::<_, MessageRecord>(
            r#"
            INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(conversation_id)
        .bind(role)
        .bind(content)
        .bind(metadata)
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        info!("Message created: id={}", message.id);
        Ok(message)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<MessageRecord> {
        debug!("Finding message by id={}", id);

        let message = sqlx::query_as::<_, MessageRecord>(
            r#"
            SELECT * FROM messages WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Message not found: {}", id)))?;

        Ok(message)
    }

    pub async fn find_by_conversation_id(&self, conversation_id: Uuid) -> Result<Vec<MessageRecord>> {
        debug!("Finding messages for conversation_id={}", conversation_id);

        let messages = sqlx::query_as::<_, MessageRecord>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await?;

        debug!("Found {} messages for conversation_id={}", messages.len(), conversation_id);
        Ok(messages)
    }

    pub async fn find_by_conversation_id_paginated(
        &self,
        conversation_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<MessageRecord>> {
        debug!(
            "Finding messages for conversation_id={} (limit={}, offset={})",
            conversation_id, limit, offset
        );

        let messages = sqlx::query_as::<_, MessageRecord>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(conversation_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        debug!("Found {} messages", messages.len());
        Ok(messages)
    }

    pub async fn count_by_conversation_id(&self, conversation_id: Uuid) -> Result<i64> {
        debug!("Counting messages for conversation_id={}", conversation_id);

        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM messages WHERE conversation_id = $1
            "#,
        )
        .bind(conversation_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0)
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        debug!("Deleting message: id={}", id);

        let result = sqlx::query("DELETE FROM messages WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(InfraError::NotFound(format!("Message not found: {}", id)));
        }

        info!("Message deleted: id={}", id);
        Ok(())
    }

    pub async fn delete_by_conversation_id(&self, conversation_id: Uuid) -> Result<u64> {
        debug!("Deleting messages for conversation_id={}", conversation_id);

        let result = sqlx::query("DELETE FROM messages WHERE conversation_id = $1")
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;

        let count = result.rows_affected();
        info!("Deleted {} messages for conversation_id={}", count, conversation_id);
        Ok(count)
    }
}

// ============================================================================
// Workflow Repository
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WorkflowRecord {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub status: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct WorkflowRepository {
    pool: PgPool,
}

impl WorkflowRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        name: &str,
        description: Option<String>,
        definition: serde_json::Value,
        metadata: serde_json::Value,
    ) -> Result<WorkflowRecord> {
        debug!("Creating workflow: name={}", name);

        let workflow = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            INSERT INTO workflows (id, name, description, definition, status, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(name)
        .bind(description)
        .bind(definition)
        .bind("draft")
        .bind(metadata)
        .bind(Utc::now())
        .bind(Utc::now())
        .fetch_one(&self.pool)
        .await?;

        info!("Workflow created: id={}, name={}", workflow.id, workflow.name);
        Ok(workflow)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<WorkflowRecord> {
        debug!("Finding workflow by id={}", id);

        let workflow = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            SELECT * FROM workflows WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Workflow not found: {}", id)))?;

        Ok(workflow)
    }

    pub async fn find_by_name(&self, name: &str) -> Result<WorkflowRecord> {
        debug!("Finding workflow by name={}", name);

        let workflow = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            SELECT * FROM workflows WHERE name = $1
            "#,
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Workflow not found: {}", name)))?;

        Ok(workflow)
    }

    pub async fn find_all(&self) -> Result<Vec<WorkflowRecord>> {
        debug!("Finding all workflows");

        let workflows = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            SELECT * FROM workflows ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        debug!("Found {} workflows", workflows.len());
        Ok(workflows)
    }

    pub async fn find_by_status(&self, status: &str) -> Result<Vec<WorkflowRecord>> {
        debug!("Finding workflows by status={}", status);

        let workflows = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            SELECT * FROM workflows WHERE status = $1 ORDER BY created_at DESC
            "#,
        )
        .bind(status)
        .fetch_all(&self.pool)
        .await?;

        debug!("Found {} workflows with status={}", workflows.len(), status);
        Ok(workflows)
    }

    pub async fn update_status(&self, id: Uuid, status: &str) -> Result<WorkflowRecord> {
        debug!("Updating workflow status: id={}, status={}", id, status);

        let workflow = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            UPDATE workflows
            SET status = $1, updated_at = $2
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(status)
        .bind(Utc::now())
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Workflow not found: {}", id)))?;

        info!("Workflow status updated: id={}, status={}", id, status);
        Ok(workflow)
    }

    pub async fn update_definition(&self, id: Uuid, definition: serde_json::Value) -> Result<WorkflowRecord> {
        debug!("Updating workflow definition: id={}", id);

        let workflow = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            UPDATE workflows
            SET definition = $1, updated_at = $2
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(definition)
        .bind(Utc::now())
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Workflow not found: {}", id)))?;

        info!("Workflow definition updated: id={}", id);
        Ok(workflow)
    }

    pub async fn update_metadata(&self, id: Uuid, metadata: serde_json::Value) -> Result<WorkflowRecord> {
        debug!("Updating workflow metadata: id={}", id);

        let workflow = sqlx::query_as::<_, WorkflowRecord>(
            r#"
            UPDATE workflows
            SET metadata = $1, updated_at = $2
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(metadata)
        .bind(Utc::now())
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| InfraError::NotFound(format!("Workflow not found: {}", id)))?;

        info!("Workflow metadata updated: id={}", id);
        Ok(workflow)
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        debug!("Deleting workflow: id={}", id);

        let result = sqlx::query("DELETE FROM workflows WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(InfraError::NotFound(format!("Workflow not found: {}", id)));
        }

        info!("Workflow deleted: id={}", id);
        Ok(())
    }
}
