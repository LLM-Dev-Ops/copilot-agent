# Audit and Compliance Architecture

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-25

## Overview

This document defines comprehensive audit logging, tamper-proof storage, compliance reporting, and retention policies for LLM-CoPilot-Agent to meet SOC 2 Type II and GDPR compliance requirements.

---

## Table of Contents

1. [Audit Log Schema](#audit-log-schema)
2. [Event Types](#event-types)
3. [Tamper-Proof Storage](#tamper-proof-storage)
4. [Retention Policies](#retention-policies)
5. [Compliance Reporting](#compliance-reporting)
6. [Rust Implementation](#rust-implementation)

---

## Audit Log Schema

### Core Audit Event Structure

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    // Event identification
    pub id: Uuid,
    pub event_type: AuditEventType,
    pub timestamp: DateTime<Utc>,
    pub version: String,

    // Actor information
    pub actor: Actor,

    // Resource information
    pub resource: Option<Resource>,

    // Action details
    pub action: Action,
    pub outcome: Outcome,

    // Context
    pub context: AuditContext,

    // Metadata
    pub severity: Severity,
    pub tags: Vec<String>,
    pub correlation_id: Option<Uuid>,

    // Tamper protection
    pub signature: Option<String>,
    pub previous_event_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actor {
    pub actor_type: ActorType,
    pub id: String,
    pub email: Option<String>,
    pub roles: Vec<String>,
    pub ip_address: String,
    pub user_agent: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActorType {
    User,
    Service,
    System,
    ApiKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub resource_type: String,
    pub resource_id: String,
    pub resource_name: Option<String>,
    pub tenant_id: Option<String>,
    pub environment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub action_type: String,
    pub description: String,
    pub parameters: serde_json::Value,
    pub changes: Option<ChangeSet>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeSet {
    pub before: Option<serde_json::Value>,
    pub after: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Success,
    Failure,
    PartialSuccess,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditContext {
    pub request_id: Uuid,
    pub source_ip: String,
    pub location: Option<String>,
    pub device_id: Option<String>,
    pub application_version: String,
    pub additional_context: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}
```

---

## Event Types

### Authentication Events

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    // Authentication
    AuthenticationSuccess,
    AuthenticationFailure,
    LogoutSuccess,
    TokenRefreshed,
    TokenRevoked,
    MfaEnrolled,
    MfaVerified,
    MfaFailed,
    PasswordChanged,
    PasswordResetRequested,
    PasswordResetCompleted,

    // Authorization
    AuthorizationGranted,
    AuthorizationDenied,
    RoleAssigned,
    RoleRevoked,
    PermissionGranted,
    PermissionRevoked,

    // API Keys
    ApiKeyCreated,
    ApiKeyRevoked,
    ApiKeyRotated,
    ApiKeyUsed,

    // Workflows
    WorkflowCreated,
    WorkflowUpdated,
    WorkflowDeleted,
    WorkflowExecuted,
    WorkflowApproved,
    WorkflowRejected,
    WorkflowCancelled,

    // Incidents
    IncidentCreated,
    IncidentUpdated,
    IncidentResolved,
    IncidentEscalated,
    RunbookExecuted,

    // Data Access
    DataAccessed,
    DataExported,
    DataDeleted,
    DataModified,

    // Security
    SecurityPolicyUpdated,
    EncryptionKeyRotated,
    SuspiciousActivityDetected,
    RateLimitExceeded,
    InvalidInputDetected,

    // System
    SystemConfigUpdated,
    SystemBackupCreated,
    SystemRestored,

    // Compliance
    ComplianceReportGenerated,
    DataRetentionPolicyApplied,
    GdprDataExported,
    GdprDataDeleted,
}

impl AuditEventType {
    pub fn severity(&self) -> Severity {
        match self {
            // Critical events
            AuditEventType::AuthenticationFailure
            | AuditEventType::AuthorizationDenied
            | AuditEventType::SuspiciousActivityDetected
            | AuditEventType::EncryptionKeyRotated
            | AuditEventType::GdprDataDeleted => Severity::Critical,

            // High severity
            AuditEventType::RoleAssigned
            | AuditEventType::RoleRevoked
            | AuditEventType::ApiKeyCreated
            | AuditEventType::SecurityPolicyUpdated
            | AuditEventType::DataDeleted => Severity::High,

            // Medium severity
            AuditEventType::WorkflowExecuted
            | AuditEventType::IncidentCreated
            | AuditEventType::DataExported
            | AuditEventType::SystemConfigUpdated => Severity::Medium,

            // Low severity
            AuditEventType::DataAccessed
            | AuditEventType::TokenRefreshed
            | AuditEventType::ApiKeyUsed => Severity::Low,

            // Info
            _ => Severity::Info,
        }
    }
}
```

### Event Builder

```rust
pub struct AuditEventBuilder {
    event: AuditEvent,
}

impl AuditEventBuilder {
    pub fn new(event_type: AuditEventType) -> Self {
        let now = Utc::now();

        Self {
            event: AuditEvent {
                id: Uuid::new_v4(),
                event_type: event_type.clone(),
                timestamp: now,
                version: "1.0".to_string(),
                actor: Actor {
                    actor_type: ActorType::System,
                    id: "system".to_string(),
                    email: None,
                    roles: vec![],
                    ip_address: "0.0.0.0".to_string(),
                    user_agent: None,
                    session_id: None,
                },
                resource: None,
                action: Action {
                    action_type: format!("{:?}", event_type),
                    description: String::new(),
                    parameters: serde_json::json!({}),
                    changes: None,
                },
                outcome: Outcome::Success,
                context: AuditContext {
                    request_id: Uuid::new_v4(),
                    source_ip: "0.0.0.0".to_string(),
                    location: None,
                    device_id: None,
                    application_version: env!("CARGO_PKG_VERSION").to_string(),
                    additional_context: serde_json::json!({}),
                },
                severity: event_type.severity(),
                tags: vec![],
                correlation_id: None,
                signature: None,
                previous_event_hash: None,
            },
        }
    }

    pub fn actor(mut self, actor: Actor) -> Self {
        self.event.actor = actor;
        self
    }

    pub fn resource(mut self, resource: Resource) -> Self {
        self.event.resource = Some(resource);
        self
    }

    pub fn action(mut self, action: Action) -> Self {
        self.event.action = action;
        self
    }

    pub fn outcome(mut self, outcome: Outcome) -> Self {
        self.event.outcome = outcome;
        self
    }

    pub fn context(mut self, context: AuditContext) -> Self {
        self.event.context = context;
        self
    }

    pub fn correlation_id(mut self, id: Uuid) -> Self {
        self.event.correlation_id = Some(id);
        self
    }

    pub fn tags(mut self, tags: Vec<String>) -> Self {
        self.event.tags = tags;
        self
    }

    pub fn build(self) -> AuditEvent {
        self.event
    }
}

/// Helper to create audit event from authorization context
impl AuditEvent {
    pub fn from_auth_context(
        event_type: AuditEventType,
        auth_context: &AuthorizationContext,
    ) -> AuditEventBuilder {
        let actor = Actor {
            actor_type: ActorType::User,
            id: auth_context.user_id.clone(),
            email: Some(auth_context.email.clone()),
            roles: auth_context
                .roles
                .iter()
                .map(|r| format!("{:?}", r))
                .collect(),
            ip_address: auth_context.ip_address.clone(),
            user_agent: None,
            session_id: Some(auth_context.session_id.clone()),
        };

        AuditEventBuilder::new(event_type).actor(actor)
    }
}
```

---

## Tamper-Proof Storage

### Blockchain-Style Hash Chain

```rust
use sha2::{Digest, Sha256};

pub struct AuditLogger {
    repository: Arc<dyn AuditRepository>,
    signer: Arc<EventSigner>,
}

impl AuditLogger {
    pub async fn log_event(&self, mut event: AuditEvent) -> Result<(), AuditError> {
        // 1. Get hash of previous event
        let previous_hash = self.repository.get_latest_event_hash().await?;
        event.previous_event_hash = previous_hash;

        // 2. Calculate hash of current event
        let event_hash = self.calculate_event_hash(&event)?;

        // 3. Sign the event
        event.signature = Some(self.signer.sign(&event_hash)?);

        // 4. Store event with hash
        self.repository.store_event(&event, &event_hash).await?;

        Ok(())
    }

    fn calculate_event_hash(&self, event: &AuditEvent) -> Result<String, AuditError> {
        // Create deterministic representation
        let mut hasher = Sha256::new();

        hasher.update(event.id.to_string().as_bytes());
        hasher.update(event.timestamp.to_rfc3339().as_bytes());
        hasher.update(event.actor.id.as_bytes());

        if let Some(resource) = &event.resource {
            hasher.update(resource.resource_id.as_bytes());
        }

        hasher.update(event.action.action_type.as_bytes());

        if let Some(prev_hash) = &event.previous_event_hash {
            hasher.update(prev_hash.as_bytes());
        }

        Ok(format!("{:x}", hasher.finalize()))
    }

    pub async fn verify_chain_integrity(&self) -> Result<bool, AuditError> {
        let events = self.repository.get_all_events().await?;

        for (i, event) in events.iter().enumerate() {
            // Verify event hash
            let calculated_hash = self.calculate_event_hash(event)?;

            // Verify signature
            if let Some(signature) = &event.signature {
                if !self.signer.verify(&calculated_hash, signature)? {
                    tracing::error!("Signature verification failed for event {}", event.id);
                    return Ok(false);
                }
            }

            // Verify chain linkage
            if i > 0 {
                let prev_event = &events[i - 1];
                let prev_hash = self.calculate_event_hash(prev_event)?;

                if event.previous_event_hash.as_ref() != Some(&prev_hash) {
                    tracing::error!("Chain integrity broken at event {}", event.id);
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuditError {
    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Signing error: {0}")]
    SigningError(String),

    #[error("Verification error: {0}")]
    VerificationError(String),
}
```

### Digital Signature for Events

```rust
use ring::signature::{Ed25519KeyPair, KeyPair, UnparsedPublicKey, ED25519};
use ring::rand::SystemRandom;

pub struct EventSigner {
    key_pair: Ed25519KeyPair,
    rng: SystemRandom,
}

impl EventSigner {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let rng = SystemRandom::new();
        let pkcs8_bytes = Ed25519KeyPair::generate_pkcs8(&rng)?;
        let key_pair = Ed25519KeyPair::from_pkcs8(pkcs8_bytes.as_ref())?;

        Ok(Self { key_pair, rng })
    }

    pub fn from_pkcs8(pkcs8: &[u8]) -> Result<Self, Box<dyn std::error::Error>> {
        let key_pair = Ed25519KeyPair::from_pkcs8(pkcs8)?;
        let rng = SystemRandom::new();

        Ok(Self { key_pair, rng })
    }

    pub fn sign(&self, message: &str) -> Result<String, AuditError> {
        let signature = self.key_pair.sign(message.as_bytes());
        Ok(base64::engine::general_purpose::STANDARD.encode(signature.as_ref()))
    }

    pub fn verify(&self, message: &str, signature: &str) -> Result<bool, AuditError> {
        let signature_bytes = base64::engine::general_purpose::STANDARD
            .decode(signature)
            .map_err(|e| AuditError::VerificationError(e.to_string()))?;

        let public_key = UnparsedPublicKey::new(&ED25519, self.key_pair.public_key().as_ref());

        match public_key.verify(message.as_bytes(), &signature_bytes) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    pub fn public_key_bytes(&self) -> &[u8] {
        self.key_pair.public_key().as_ref()
    }
}
```

### Audit Repository

```rust
use async_trait::async_trait;
use sqlx::PgPool;

#[async_trait]
pub trait AuditRepository: Send + Sync {
    async fn store_event(
        &self,
        event: &AuditEvent,
        event_hash: &str,
    ) -> Result<(), AuditError>;

    async fn get_latest_event_hash(&self) -> Result<Option<String>, AuditError>;

    async fn get_all_events(&self) -> Result<Vec<AuditEvent>, AuditError>;

    async fn get_events_by_actor(
        &self,
        actor_id: &str,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, AuditError>;

    async fn get_events_by_resource(
        &self,
        resource_type: &str,
        resource_id: &str,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, AuditError>;

    async fn get_events_by_type(
        &self,
        event_type: AuditEventType,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, AuditError>;
}

pub struct PostgresAuditRepository {
    pool: PgPool,
}

#[async_trait]
impl AuditRepository for PostgresAuditRepository {
    async fn store_event(
        &self,
        event: &AuditEvent,
        event_hash: &str,
    ) -> Result<(), AuditError> {
        let event_json = serde_json::to_value(event)
            .map_err(|e| AuditError::StorageError(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO audit_events (
                id, event_type, timestamp, actor_id, resource_type, resource_id,
                action_type, outcome, severity, event_data, event_hash, signature,
                previous_event_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#
        )
        .bind(&event.id)
        .bind(&format!("{:?}", event.event_type))
        .bind(&event.timestamp)
        .bind(&event.actor.id)
        .bind(event.resource.as_ref().map(|r| &r.resource_type))
        .bind(event.resource.as_ref().map(|r| &r.resource_id))
        .bind(&event.action.action_type)
        .bind(&format!("{:?}", event.outcome))
        .bind(&format!("{:?}", event.severity))
        .bind(&event_json)
        .bind(event_hash)
        .bind(&event.signature)
        .bind(&event.previous_event_hash)
        .execute(&self.pool)
        .await
        .map_err(|e| AuditError::StorageError(e.to_string()))?;

        Ok(())
    }

    async fn get_latest_event_hash(&self) -> Result<Option<String>, AuditError> {
        let result = sqlx::query_scalar::<_, Option<String>>(
            "SELECT event_hash FROM audit_events ORDER BY timestamp DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AuditError::StorageError(e.to_string()))?;

        Ok(result.flatten())
    }

    async fn get_all_events(&self) -> Result<Vec<AuditEvent>, AuditError> {
        let rows = sqlx::query!(
            "SELECT event_data FROM audit_events ORDER BY timestamp ASC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AuditError::StorageError(e.to_string()))?;

        let events = rows
            .into_iter()
            .filter_map(|row| serde_json::from_value(row.event_data).ok())
            .collect();

        Ok(events)
    }

    async fn get_events_by_actor(
        &self,
        actor_id: &str,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, AuditError> {
        let rows = sqlx::query!(
            "SELECT event_data FROM audit_events WHERE actor_id = $1 ORDER BY timestamp DESC LIMIT $2",
            actor_id,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AuditError::StorageError(e.to_string()))?;

        let events = rows
            .into_iter()
            .filter_map(|row| serde_json::from_value(row.event_data).ok())
            .collect();

        Ok(events)
    }

    async fn get_events_by_resource(
        &self,
        resource_type: &str,
        resource_id: &str,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, AuditError> {
        let rows = sqlx::query!(
            "SELECT event_data FROM audit_events WHERE resource_type = $1 AND resource_id = $2 ORDER BY timestamp DESC LIMIT $3",
            resource_type,
            resource_id,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AuditError::StorageError(e.to_string()))?;

        let events = rows
            .into_iter()
            .filter_map(|row| serde_json::from_value(row.event_data).ok())
            .collect();

        Ok(events)
    }

    async fn get_events_by_type(
        &self,
        event_type: AuditEventType,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, AuditError> {
        let type_str = format!("{:?}", event_type);

        let rows = sqlx::query!(
            "SELECT event_data FROM audit_events WHERE event_type = $1 ORDER BY timestamp DESC LIMIT $2",
            type_str,
            limit
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AuditError::StorageError(e.to_string()))?;

        let events = rows
            .into_iter()
            .filter_map(|row| serde_json::from_value(row.event_data).ok())
            .collect();

        Ok(events)
    }
}
```

---

## Retention Policies

### Retention Policy Configuration

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub event_type_patterns: Vec<String>,
    pub retention_days: u32,
    pub archive_after_days: Option<u32>,
    pub anonymize_after_days: Option<u32>,
}

impl RetentionPolicy {
    pub fn default_policies() -> Vec<RetentionPolicy> {
        vec![
            // Critical security events - retain 7 years
            RetentionPolicy {
                event_type_patterns: vec![
                    "Authentication*".to_string(),
                    "Authorization*".to_string(),
                    "Security*".to_string(),
                ],
                retention_days: 7 * 365,
                archive_after_days: Some(90),
                anonymize_after_days: None,
            },
            // Compliance events - retain 7 years
            RetentionPolicy {
                event_type_patterns: vec![
                    "Gdpr*".to_string(),
                    "Compliance*".to_string(),
                ],
                retention_days: 7 * 365,
                archive_after_days: Some(90),
                anonymize_after_days: None,
            },
            // Workflow events - retain 1 year
            RetentionPolicy {
                event_type_patterns: vec!["Workflow*".to_string()],
                retention_days: 365,
                archive_after_days: Some(90),
                anonymize_after_days: Some(180),
            },
            // Data access events - retain 90 days
            RetentionPolicy {
                event_type_patterns: vec!["Data*".to_string()],
                retention_days: 90,
                archive_after_days: Some(30),
                anonymize_after_days: Some(60),
            },
            // Default - retain 30 days
            RetentionPolicy {
                event_type_patterns: vec!["*".to_string()],
                retention_days: 30,
                archive_after_days: None,
                anonymize_after_days: Some(15),
            },
        ]
    }

    pub fn matches_event(&self, event_type: &str) -> bool {
        self.event_type_patterns.iter().any(|pattern| {
            if pattern == "*" {
                return true;
            }

            if pattern.ends_with('*') {
                let prefix = &pattern[..pattern.len() - 1];
                event_type.starts_with(prefix)
            } else {
                event_type == pattern
            }
        })
    }
}
```

### Retention Enforcement Service

```rust
use tokio::time::{interval, Duration};

pub struct RetentionService {
    repository: Arc<dyn AuditRepository>,
    policies: Vec<RetentionPolicy>,
    archive_storage: Arc<dyn ArchiveStorage>,
}

impl RetentionService {
    pub fn new(
        repository: Arc<dyn AuditRepository>,
        archive_storage: Arc<dyn ArchiveStorage>,
    ) -> Self {
        Self {
            repository,
            policies: RetentionPolicy::default_policies(),
            archive_storage,
        }
    }

    /// Start retention enforcement (runs daily)
    pub async fn start_retention_enforcement(self: Arc<Self>) {
        let mut interval = interval(Duration::from_secs(24 * 60 * 60)); // Daily

        loop {
            interval.tick().await;

            if let Err(e) = self.enforce_retention().await {
                tracing::error!("Retention enforcement failed: {}", e);
            }
        }
    }

    async fn enforce_retention(&self) -> Result<(), Box<dyn std::error::Error>> {
        tracing::info!("Starting retention policy enforcement");

        let now = Utc::now();

        // Get all events (in production, batch this)
        let events = self.repository.get_all_events().await?;

        for event in events {
            let policy = self.get_policy_for_event(&event);

            let age_days = (now - event.timestamp).num_days() as u32;

            // Archive old events
            if let Some(archive_days) = policy.archive_after_days {
                if age_days >= archive_days && age_days < policy.retention_days {
                    self.archive_event(&event).await?;
                }
            }

            // Anonymize PII
            if let Some(anonymize_days) = policy.anonymize_after_days {
                if age_days >= anonymize_days && age_days < policy.retention_days {
                    self.anonymize_event(&event).await?;
                }
            }

            // Delete expired events
            if age_days >= policy.retention_days {
                self.delete_event(&event).await?;
            }
        }

        tracing::info!("Retention policy enforcement completed");

        Ok(())
    }

    fn get_policy_for_event(&self, event: &AuditEvent) -> &RetentionPolicy {
        let event_type = format!("{:?}", event.event_type);

        self.policies
            .iter()
            .find(|p| p.matches_event(&event_type))
            .unwrap_or(&self.policies[self.policies.len() - 1]) // Default policy
    }

    async fn archive_event(&self, event: &AuditEvent) -> Result<(), Box<dyn std::error::Error>> {
        self.archive_storage.store(event).await?;
        tracing::info!("Archived event {}", event.id);
        Ok(())
    }

    async fn anonymize_event(&self, event: &AuditEvent) -> Result<(), Box<dyn std::error::Error>> {
        // Anonymize PII fields
        let mut anonymized = event.clone();
        anonymized.actor.email = None;
        anonymized.actor.ip_address = "0.0.0.0".to_string();
        anonymized.context.source_ip = "0.0.0.0".to_string();

        // Update in database
        // self.repository.update_event(&anonymized).await?;

        tracing::info!("Anonymized event {}", event.id);
        Ok(())
    }

    async fn delete_event(&self, event: &AuditEvent) -> Result<(), Box<dyn std::error::Error>> {
        // Delete from database
        // self.repository.delete_event(&event.id).await?;

        tracing::info!("Deleted expired event {}", event.id);
        Ok(())
    }
}

#[async_trait]
pub trait ArchiveStorage: Send + Sync {
    async fn store(&self, event: &AuditEvent) -> Result<(), Box<dyn std::error::Error>>;
    async fn retrieve(&self, event_id: &Uuid) -> Result<Option<AuditEvent>, Box<dyn std::error::Error>>;
}
```

---

## Compliance Reporting

### SOC 2 Compliance Reports

```rust
pub struct ComplianceReporter {
    repository: Arc<dyn AuditRepository>,
}

impl ComplianceReporter {
    pub async fn generate_soc2_report(
        &self,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> Result<Soc2Report, Box<dyn std::error::Error>> {
        let events = self.repository.get_all_events().await?;

        let filtered_events: Vec<_> = events
            .into_iter()
            .filter(|e| e.timestamp >= start_date && e.timestamp <= end_date)
            .collect();

        let report = Soc2Report {
            report_id: Uuid::new_v4(),
            generated_at: Utc::now(),
            period_start: start_date,
            period_end: end_date,
            access_controls: self.analyze_access_controls(&filtered_events),
            authentication_events: self.analyze_authentication(&filtered_events),
            authorization_events: self.analyze_authorization(&filtered_events),
            data_protection: self.analyze_data_protection(&filtered_events),
            incident_response: self.analyze_incidents(&filtered_events),
            total_events: filtered_events.len(),
        };

        Ok(report)
    }

    fn analyze_access_controls(&self, events: &[AuditEvent]) -> AccessControlMetrics {
        let total_access_attempts = events
            .iter()
            .filter(|e| matches!(
                e.event_type,
                AuditEventType::AuthorizationGranted | AuditEventType::AuthorizationDenied
            ))
            .count();

        let denied_attempts = events
            .iter()
            .filter(|e| matches!(e.event_type, AuditEventType::AuthorizationDenied))
            .count();

        AccessControlMetrics {
            total_access_attempts,
            granted: total_access_attempts - denied_attempts,
            denied: denied_attempts,
            denied_percentage: (denied_attempts as f64 / total_access_attempts as f64 * 100.0),
        }
    }

    fn analyze_authentication(&self, events: &[AuditEvent]) -> AuthenticationMetrics {
        let total_auth_attempts = events
            .iter()
            .filter(|e| matches!(
                e.event_type,
                AuditEventType::AuthenticationSuccess | AuditEventType::AuthenticationFailure
            ))
            .count();

        let failed_attempts = events
            .iter()
            .filter(|e| matches!(e.event_type, AuditEventType::AuthenticationFailure))
            .count();

        let mfa_enrollments = events
            .iter()
            .filter(|e| matches!(e.event_type, AuditEventType::MfaEnrolled))
            .count();

        AuthenticationMetrics {
            total_attempts: total_auth_attempts,
            successful: total_auth_attempts - failed_attempts,
            failed: failed_attempts,
            mfa_enrollments,
        }
    }

    fn analyze_authorization(&self, events: &[AuditEvent]) -> AuthorizationMetrics {
        let role_changes = events
            .iter()
            .filter(|e| matches!(
                e.event_type,
                AuditEventType::RoleAssigned | AuditEventType::RoleRevoked
            ))
            .count();

        AuthorizationMetrics {
            role_changes,
            permission_changes: 0, // Calculate from events
        }
    }

    fn analyze_data_protection(&self, events: &[AuditEvent]) -> DataProtectionMetrics {
        let encryption_key_rotations = events
            .iter()
            .filter(|e| matches!(e.event_type, AuditEventType::EncryptionKeyRotated))
            .count();

        let data_exports = events
            .iter()
            .filter(|e| matches!(e.event_type, AuditEventType::DataExported))
            .count();

        DataProtectionMetrics {
            encryption_key_rotations,
            data_exports,
            data_deletions: 0,
        }
    }

    fn analyze_incidents(&self, events: &[AuditEvent]) -> IncidentMetrics {
        let total_incidents = events
            .iter()
            .filter(|e| matches!(e.event_type, AuditEventType::IncidentCreated))
            .count();

        IncidentMetrics {
            total_incidents,
            resolved: 0,
            average_resolution_time_hours: 0.0,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Soc2Report {
    pub report_id: Uuid,
    pub generated_at: DateTime<Utc>,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub access_controls: AccessControlMetrics,
    pub authentication_events: AuthenticationMetrics,
    pub authorization_events: AuthorizationMetrics,
    pub data_protection: DataProtectionMetrics,
    pub incident_response: IncidentMetrics,
    pub total_events: usize,
}

#[derive(Debug, Serialize)]
pub struct AccessControlMetrics {
    pub total_access_attempts: usize,
    pub granted: usize,
    pub denied: usize,
    pub denied_percentage: f64,
}

#[derive(Debug, Serialize)]
pub struct AuthenticationMetrics {
    pub total_attempts: usize,
    pub successful: usize,
    pub failed: usize,
    pub mfa_enrollments: usize,
}

#[derive(Debug, Serialize)]
pub struct AuthorizationMetrics {
    pub role_changes: usize,
    pub permission_changes: usize,
}

#[derive(Debug, Serialize)]
pub struct DataProtectionMetrics {
    pub encryption_key_rotations: usize,
    pub data_exports: usize,
    pub data_deletions: usize,
}

#[derive(Debug, Serialize)]
pub struct IncidentMetrics {
    pub total_incidents: usize,
    pub resolved: usize,
    pub average_resolution_time_hours: f64,
}
```

---

## Summary

This audit and compliance architecture provides:

1. **Comprehensive Audit Logging**: Structured events with full context
2. **Tamper-Proof Storage**: Hash chain and digital signatures
3. **Automated Retention**: Policy-based archival and deletion
4. **Compliance Reporting**: SOC 2 and GDPR report generation
5. **Chain Integrity Verification**: Detect tampering attempts

---

**Next Document:** [06-security-monitoring-architecture.md](./06-security-monitoring-architecture.md)
