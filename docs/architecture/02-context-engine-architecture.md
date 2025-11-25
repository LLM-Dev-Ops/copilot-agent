# Context Engine Architecture

## Overview
The Context Engine manages conversation history, user preferences, system state, and learned patterns across multiple time horizons. It provides intelligent context retrieval and compression to optimize token usage while maintaining conversational coherence.

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Context Engine                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Session Manager                             │    │
│  │  - Session lifecycle                                     │    │
│  │  - User authentication                                   │    │
│  │  - Session persistence                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                      │
│                            ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Memory Tiers                              │ │
│  │                                                            │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │ │
│  │  │   Short     │  │   Medium     │  │    Long        │  │ │
│  │  │   Term      │  │   Term       │  │    Term        │  │ │
│  │  │  (Working)  │  │  (Session)   │  │  (Knowledge)   │  │ │
│  │  │             │  │              │  │                │  │ │
│  │  │ - Current   │  │ - History    │  │ - Patterns     │  │ │
│  │  │   exchange  │  │ - Entities   │  │ - Preferences  │  │ │
│  │  │ - Temp vars │  │ - Metrics    │  │ - Analytics    │  │ │
│  │  │             │  │              │  │                │  │ │
│  │  │ TTL: 5 min  │  │ TTL: 24 hrs  │  │ TTL: 90 days   │  │ │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Context Retriever                           │    │
│  │  - Semantic search                                       │    │
│  │  - Relevance ranking                                     │    │
│  │  - Context assembly                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                      │
│                            ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Token Budget Manager                        │    │
│  │  - Token counting                                        │    │
│  │  - Context compression                                   │    │
│  │  - Priority-based selection                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                      │
│                            ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Learning System                             │    │
│  │  - Pattern detection                                     │    │
│  │  - Preference learning                                   │    │
│  │  - Behavior adaptation                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Memory Tier Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       Memory Hierarchy                         │
└────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│        SHORT-TERM MEMORY             │  Storage: In-Memory (Redis)
│                                      │  Capacity: ~4K tokens
│  - Current conversation turn         │  Access: O(1)
│  - Immediate context (last 3 msgs)   │  TTL: 5 minutes
│  - Temporary variables               │  Eviction: LRU
│  - Active entities                   │
└──────────────────────────────────────┘
                 │
                 ▼ (Summarization)
┌──────────────────────────────────────┐
│        MEDIUM-TERM MEMORY            │  Storage: Redis + PostgreSQL
│                                      │  Capacity: ~16K tokens
│  - Session history (last N turns)    │  Access: O(log n)
│  - Extracted entities                │  TTL: 24 hours
│  - Metrics and logs context          │  Eviction: Priority-based
│  - Workflow state                    │
│  - Conversation summary              │
└──────────────────────────────────────┘
                 │
                 ▼ (Aggregation)
┌──────────────────────────────────────┐
│        LONG-TERM MEMORY              │  Storage: PostgreSQL + Vector DB
│                                      │  Capacity: Unlimited
│  - User preferences                  │  Access: Semantic search
│  - Historical patterns               │  TTL: 90 days
│  - Learned behaviors                 │  Eviction: Age-based
│  - Knowledge base                    │
│  - Analytics data                    │
└──────────────────────────────────────┘
```

## Rust Trait Definitions

```rust
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use chrono::{DateTime, Utc};

/// Result type for context operations
pub type ContextResult<T> = Result<T, ContextError>;

/// Error types for context engine
#[derive(Error, Debug)]
pub enum ContextError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Token budget exceeded: {used} / {limit}")]
    TokenBudgetExceeded { used: usize, limit: usize },

    #[error("Compression failed: {0}")]
    CompressionError(String),

    #[error("Retrieval error: {0}")]
    RetrievalError(String),

    #[error("Invalid context tier: {0}")]
    InvalidTier(String),
}

/// Memory tier enum
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum MemoryTier {
    ShortTerm,   // Working memory (current conversation)
    MediumTerm,  // Session memory (recent history)
    LongTerm,    // Knowledge memory (persistent learning)
}

/// Context entry stored in memory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEntry {
    pub id: String,
    pub session_id: String,
    pub user_id: String,
    pub tier: MemoryTier,
    pub timestamp: DateTime<Utc>,
    pub content: ContextContent,
    pub metadata: ContextMetadata,
    pub embedding: Option<Vec<f32>>,  // For semantic search
}

/// Types of context content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextContent {
    ConversationTurn {
        user_input: String,
        assistant_response: String,
        intent: String,
        entities: Vec<String>,
    },
    EntityReference {
        entity_type: String,
        entity_value: String,
        resolved_value: Option<String>,
        last_used: DateTime<Utc>,
    },
    MetricContext {
        metric_name: String,
        service: String,
        namespace: String,
        time_range: TimeRange,
        last_value: Option<f64>,
    },
    WorkflowState {
        workflow_id: String,
        current_step: String,
        variables: HashMap<String, serde_json::Value>,
    },
    UserPreference {
        preference_key: String,
        preference_value: serde_json::Value,
    },
    LearnedPattern {
        pattern_type: String,
        pattern_data: serde_json::Value,
        confidence: f32,
        occurrences: usize,
    },
    Summary {
        summary_of: Vec<String>,  // IDs of summarized entries
        summary_text: String,
        compression_ratio: f32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

/// Metadata for context entries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMetadata {
    pub priority: f32,           // 0.0 to 1.0, for budget management
    pub access_count: usize,     // How many times accessed
    pub last_accessed: DateTime<Utc>,
    pub ttl_seconds: Option<u64>,
    pub tags: Vec<String>,
    pub compressed: bool,
}

/// Session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub session_id: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub state: SessionState,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionState {
    Active,
    Idle,
    Expired,
    Terminated,
}

/// Session Manager trait
#[async_trait]
pub trait SessionManager: Send + Sync {
    /// Create a new session
    async fn create_session(&self, user_id: &str) -> ContextResult<Session>;

    /// Get existing session
    async fn get_session(&self, session_id: &str) -> ContextResult<Option<Session>>;

    /// Update session activity
    async fn update_activity(&self, session_id: &str) -> ContextResult<()>;

    /// Terminate session
    async fn terminate_session(&self, session_id: &str) -> ContextResult<()>;

    /// List user sessions
    async fn list_user_sessions(&self, user_id: &str) -> ContextResult<Vec<Session>>;

    /// Cleanup expired sessions
    async fn cleanup_expired(&self) -> ContextResult<usize>;
}

/// Memory tier storage trait
#[async_trait]
pub trait MemoryStorage: Send + Sync {
    /// Store context entry
    async fn store(&self, entry: ContextEntry) -> ContextResult<()>;

    /// Retrieve context entry by ID
    async fn retrieve(&self, id: &str) -> ContextResult<Option<ContextEntry>>;

    /// Query context entries
    async fn query(&self, query: &ContextQuery) -> ContextResult<Vec<ContextEntry>>;

    /// Delete context entry
    async fn delete(&self, id: &str) -> ContextResult<()>;

    /// Batch delete
    async fn delete_batch(&self, ids: &[String]) -> ContextResult<usize>;

    /// Update metadata
    async fn update_metadata(&self, id: &str, metadata: ContextMetadata) -> ContextResult<()>;

    /// Get storage stats
    async fn get_stats(&self) -> ContextResult<StorageStats>;
}

/// Context query builder
#[derive(Debug, Clone, Default)]
pub struct ContextQuery {
    pub session_id: Option<String>,
    pub user_id: Option<String>,
    pub tier: Option<MemoryTier>,
    pub content_types: Vec<String>,
    pub tags: Vec<String>,
    pub time_range: Option<TimeRange>,
    pub min_priority: Option<f32>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub order_by: QueryOrder,
}

#[derive(Debug, Clone)]
pub enum QueryOrder {
    Timestamp(SortOrder),
    Priority(SortOrder),
    AccessCount(SortOrder),
    Relevance(SortOrder),
}

impl Default for QueryOrder {
    fn default() -> Self {
        QueryOrder::Timestamp(SortOrder::Descending)
    }
}

#[derive(Debug, Clone)]
pub enum SortOrder {
    Ascending,
    Descending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub total_entries: usize,
    pub size_bytes: usize,
    pub entries_by_tier: HashMap<String, usize>,
    pub avg_priority: f32,
}

/// Context Retriever trait
#[async_trait]
pub trait ContextRetriever: Send + Sync {
    /// Retrieve relevant context for a request
    async fn retrieve_context(
        &self,
        request: &RetrievalRequest,
    ) -> ContextResult<RetrievedContext>;

    /// Semantic search in context
    async fn semantic_search(
        &self,
        query: &str,
        session_id: &str,
        limit: usize,
    ) -> ContextResult<Vec<ContextEntry>>;

    /// Get conversation history
    async fn get_history(
        &self,
        session_id: &str,
        limit: usize,
    ) -> ContextResult<Vec<ContextEntry>>;

    /// Get entities in focus
    async fn get_entities_in_focus(
        &self,
        session_id: &str,
    ) -> ContextResult<Vec<ContextEntry>>;

    /// Update relevance scores
    async fn update_relevance(
        &self,
        entry_ids: &[String],
        feedback: RelevanceFeedback,
    ) -> ContextResult<()>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievalRequest {
    pub session_id: String,
    pub user_id: String,
    pub current_input: String,
    pub intent: Option<String>,
    pub max_tokens: usize,
    pub include_tiers: Vec<MemoryTier>,
    pub preferences: RetrievalPreferences,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievalPreferences {
    pub prefer_recent: bool,
    pub include_summaries: bool,
    pub semantic_threshold: f32,
    pub entity_tracking: bool,
}

impl Default for RetrievalPreferences {
    fn default() -> Self {
        Self {
            prefer_recent: true,
            include_summaries: true,
            semantic_threshold: 0.7,
            entity_tracking: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrievedContext {
    pub entries: Vec<ContextEntry>,
    pub total_tokens: usize,
    pub sources: ContextSources,
    pub compressed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSources {
    pub short_term: usize,
    pub medium_term: usize,
    pub long_term: usize,
}

#[derive(Debug, Clone)]
pub enum RelevanceFeedback {
    Positive,
    Negative,
    Neutral,
}

/// Token Budget Manager trait
#[async_trait]
pub trait TokenBudgetManager: Send + Sync {
    /// Fit context within token budget
    async fn fit_budget(
        &self,
        entries: Vec<ContextEntry>,
        budget: TokenBudget,
    ) -> ContextResult<Vec<ContextEntry>>;

    /// Compress context to fit budget
    async fn compress(
        &self,
        entries: Vec<ContextEntry>,
        target_tokens: usize,
    ) -> ContextResult<Vec<ContextEntry>>;

    /// Calculate token count for entries
    fn count_tokens(&self, entries: &[ContextEntry]) -> usize;

    /// Estimate compression ratio
    fn estimate_compression_ratio(
        &self,
        content_type: &str,
    ) -> f32;
}

#[derive(Debug, Clone)]
pub struct TokenBudget {
    pub total_budget: usize,
    pub reserved_for_response: usize,
    pub tier_allocations: HashMap<MemoryTier, usize>,
}

impl TokenBudget {
    pub fn new(total: usize) -> Self {
        let reserved = (total as f32 * 0.3) as usize;
        let available = total - reserved;

        let mut tier_allocations = HashMap::new();
        tier_allocations.insert(MemoryTier::ShortTerm, (available as f32 * 0.5) as usize);
        tier_allocations.insert(MemoryTier::MediumTerm, (available as f32 * 0.3) as usize);
        tier_allocations.insert(MemoryTier::LongTerm, (available as f32 * 0.2) as usize);

        Self {
            total_budget: total,
            reserved_for_response: reserved,
            tier_allocations,
        }
    }

    pub fn available_for_context(&self) -> usize {
        self.total_budget - self.reserved_for_response
    }
}

/// Context Compressor trait
#[async_trait]
pub trait ContextCompressor: Send + Sync {
    /// Compress context content
    async fn compress_content(
        &self,
        content: &ContextContent,
    ) -> ContextResult<ContextContent>;

    /// Summarize multiple entries
    async fn summarize_entries(
        &self,
        entries: &[ContextEntry],
    ) -> ContextResult<ContextEntry>;

    /// Decompress content
    async fn decompress_content(
        &self,
        compressed: &ContextContent,
    ) -> ContextResult<ContextContent>;
}

/// Learning System trait
#[async_trait]
pub trait LearningSystem: Send + Sync {
    /// Detect patterns in context
    async fn detect_patterns(
        &self,
        session_id: &str,
    ) -> ContextResult<Vec<DetectedPattern>>;

    /// Learn user preferences
    async fn learn_preferences(
        &self,
        user_id: &str,
        behavior: UserBehavior,
    ) -> ContextResult<()>;

    /// Get user preferences
    async fn get_preferences(
        &self,
        user_id: &str,
    ) -> ContextResult<UserPreferences>;

    /// Adapt to user behavior
    async fn adapt_behavior(
        &self,
        user_id: &str,
        feedback: BehaviorFeedback,
    ) -> ContextResult<()>;

    /// Get insights
    async fn get_insights(
        &self,
        user_id: &str,
    ) -> ContextResult<Vec<UserInsight>>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedPattern {
    pub pattern_type: PatternType,
    pub description: String,
    pub confidence: f32,
    pub occurrences: usize,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternType {
    RecurringQuery,
    PreferredTimeRange,
    FrequentService,
    CommonWorkflow,
    ErrorPattern,
    UsagePattern,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserBehavior {
    pub action: String,
    pub context: HashMap<String, String>,
    pub timestamp: DateTime<Utc>,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub preferred_format: String,
    pub timezone: String,
    pub language: String,
    pub default_time_range: String,
    pub favorite_services: Vec<String>,
    pub notification_settings: HashMap<String, bool>,
    pub custom_settings: HashMap<String, serde_json::Value>,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            preferred_format: "markdown".to_string(),
            timezone: "UTC".to_string(),
            language: "en".to_string(),
            default_time_range: "1h".to_string(),
            favorite_services: vec![],
            notification_settings: HashMap::new(),
            custom_settings: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct BehaviorFeedback {
    pub action_id: String,
    pub helpful: bool,
    pub comments: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInsight {
    pub insight_type: InsightType,
    pub title: String,
    pub description: String,
    pub confidence: f32,
    pub actionable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InsightType {
    UsageAnomaly,
    CostOptimization,
    PerformanceImprovement,
    SecurityRisk,
    BestPractice,
}

/// Main Context Engine trait
#[async_trait]
pub trait ContextEngine: Send + Sync {
    /// Add context entry
    async fn add_entry(&self, entry: ContextEntry) -> ContextResult<String>;

    /// Retrieve context for request
    async fn get_context(&self, request: &RetrievalRequest) -> ContextResult<RetrievedContext>;

    /// Update context
    async fn update_context(
        &self,
        session_id: &str,
        updates: Vec<ContextUpdate>,
    ) -> ContextResult<()>;

    /// Clear context
    async fn clear_context(&self, session_id: &str, tier: Option<MemoryTier>) -> ContextResult<()>;

    /// Health check
    async fn health_check(&self) -> ContextResult<ContextHealth>;
}

#[derive(Debug, Clone)]
pub struct ContextUpdate {
    pub entry_id: Option<String>,  // None for new entry
    pub content: ContextContent,
    pub tier: MemoryTier,
    pub priority: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextHealth {
    pub healthy: bool,
    pub tier_stats: HashMap<String, TierHealth>,
    pub session_count: usize,
    pub total_entries: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierHealth {
    pub entry_count: usize,
    pub size_bytes: usize,
    pub avg_age_seconds: f64,
    pub eviction_rate: f32,
}
```

## Storage Backend Implementations

### Short-Term Memory: Redis

```rust
pub struct RedisShortTermStorage {
    client: redis::Client,
    pool: redis::aio::ConnectionManager,
    ttl_seconds: u64,
}

impl RedisShortTermStorage {
    pub fn new(redis_url: &str) -> ContextResult<Self> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        // Connection pool will be initialized async
        Ok(Self {
            client,
            pool: todo!("Initialize in async context"),
            ttl_seconds: 300, // 5 minutes
        })
    }

    fn key(&self, id: &str) -> String {
        format!("context:short:{}", id)
    }

    fn session_key(&self, session_id: &str) -> String {
        format!("context:session:{}", session_id)
    }
}

#[async_trait]
impl MemoryStorage for RedisShortTermStorage {
    async fn store(&self, entry: ContextEntry) -> ContextResult<()> {
        let key = self.key(&entry.id);
        let session_key = self.session_key(&entry.session_id);

        let serialized = serde_json::to_string(&entry)
            .map_err(|e| ContextError::SerializationError(e.to_string()))?;

        let mut conn = self.pool.clone();

        // Store entry with TTL
        redis::cmd("SET")
            .arg(&key)
            .arg(&serialized)
            .arg("EX")
            .arg(self.ttl_seconds)
            .query_async(&mut conn)
            .await
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        // Add to session index
        redis::cmd("SADD")
            .arg(&session_key)
            .arg(&entry.id)
            .query_async(&mut conn)
            .await
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        Ok(())
    }

    async fn retrieve(&self, id: &str) -> ContextResult<Option<ContextEntry>> {
        let key = self.key(id);
        let mut conn = self.pool.clone();

        let result: Option<String> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        match result {
            Some(data) => {
                let entry = serde_json::from_str(&data)
                    .map_err(|e| ContextError::SerializationError(e.to_string()))?;
                Ok(Some(entry))
            }
            None => Ok(None),
        }
    }

    async fn query(&self, query: &ContextQuery) -> ContextResult<Vec<ContextEntry>> {
        if let Some(session_id) = &query.session_id {
            let session_key = self.session_key(session_id);
            let mut conn = self.pool.clone();

            // Get all entry IDs for session
            let entry_ids: Vec<String> = redis::cmd("SMEMBERS")
                .arg(&session_key)
                .query_async(&mut conn)
                .await
                .map_err(|e| ContextError::StorageError(e.to_string()))?;

            // Retrieve all entries
            let mut entries = Vec::new();
            for id in entry_ids {
                if let Some(entry) = self.retrieve(&id).await? {
                    entries.push(entry);
                }
            }

            // Apply filters and limits
            self.apply_query_filters(entries, query)
        } else {
            Ok(Vec::new())
        }
    }

    async fn delete(&self, id: &str) -> ContextResult<()> {
        let key = self.key(id);
        let mut conn = self.pool.clone();

        redis::cmd("DEL")
            .arg(&key)
            .query_async(&mut conn)
            .await
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        Ok(())
    }

    async fn delete_batch(&self, ids: &[String]) -> ContextResult<usize> {
        let mut conn = self.pool.clone();
        let keys: Vec<String> = ids.iter().map(|id| self.key(id)).collect();

        let deleted: usize = redis::cmd("DEL")
            .arg(&keys)
            .query_async(&mut conn)
            .await
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        Ok(deleted)
    }

    async fn update_metadata(&self, id: &str, metadata: ContextMetadata) -> ContextResult<()> {
        // Retrieve, update metadata, store back
        if let Some(mut entry) = self.retrieve(id).await? {
            entry.metadata = metadata;
            self.store(entry).await?;
        }
        Ok(())
    }

    async fn get_stats(&self) -> ContextResult<StorageStats> {
        // Implementation to collect stats
        Ok(StorageStats {
            total_entries: 0,
            size_bytes: 0,
            entries_by_tier: HashMap::new(),
            avg_priority: 0.0,
        })
    }
}

impl RedisShortTermStorage {
    fn apply_query_filters(
        &self,
        mut entries: Vec<ContextEntry>,
        query: &ContextQuery,
    ) -> ContextResult<Vec<ContextEntry>> {
        // Filter by tier
        if let Some(tier) = &query.tier {
            entries.retain(|e| &e.tier == tier);
        }

        // Filter by time range
        if let Some(time_range) = &query.time_range {
            entries.retain(|e| {
                e.timestamp >= time_range.start && e.timestamp <= time_range.end
            });
        }

        // Filter by priority
        if let Some(min_priority) = query.min_priority {
            entries.retain(|e| e.metadata.priority >= min_priority);
        }

        // Sort
        match &query.order_by {
            QueryOrder::Timestamp(order) => {
                entries.sort_by(|a, b| {
                    let cmp = a.timestamp.cmp(&b.timestamp);
                    match order {
                        SortOrder::Ascending => cmp,
                        SortOrder::Descending => cmp.reverse(),
                    }
                });
            }
            QueryOrder::Priority(order) => {
                entries.sort_by(|a, b| {
                    let cmp = a.metadata.priority.partial_cmp(&b.metadata.priority).unwrap();
                    match order {
                        SortOrder::Ascending => cmp,
                        SortOrder::Descending => cmp.reverse(),
                    }
                });
            }
            _ => {}
        }

        // Apply limit and offset
        if let Some(offset) = query.offset {
            entries = entries.into_iter().skip(offset).collect();
        }
        if let Some(limit) = query.limit {
            entries.truncate(limit);
        }

        Ok(entries)
    }
}
```

### Medium-Term Memory: PostgreSQL

```rust
pub struct PostgresMediumTermStorage {
    pool: sqlx::PgPool,
}

impl PostgresMediumTermStorage {
    pub async fn new(database_url: &str) -> ContextResult<Self> {
        let pool = sqlx::PgPool::connect(database_url)
            .await
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        Ok(Self { pool })
    }

    async fn init_schema(&self) -> ContextResult<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS context_entries (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                tier TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                content JSONB NOT NULL,
                metadata JSONB NOT NULL,
                embedding vector(1536),  -- For pgvector extension
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ
            );

            CREATE INDEX IF NOT EXISTS idx_session_id ON context_entries(session_id);
            CREATE INDEX IF NOT EXISTS idx_user_id ON context_entries(user_id);
            CREATE INDEX IF NOT EXISTS idx_tier ON context_entries(tier);
            CREATE INDEX IF NOT EXISTS idx_timestamp ON context_entries(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_expires_at ON context_entries(expires_at);
            "#
        )
        .execute(&self.pool)
        .await
        .map_err(|e| ContextError::StorageError(e.to_string()))?;

        Ok(())
    }
}
```

### Long-Term Memory: Vector Database (Qdrant)

```rust
use qdrant_client::prelude::*;

pub struct VectorLongTermStorage {
    client: QdrantClient,
    collection_name: String,
    embedding_dim: usize,
}

impl VectorLongTermStorage {
    pub async fn new(url: &str, collection: &str) -> ContextResult<Self> {
        let client = QdrantClient::from_url(url)
            .build()
            .map_err(|e| ContextError::StorageError(e.to_string()))?;

        let storage = Self {
            client,
            collection_name: collection.to_string(),
            embedding_dim: 1536,
        };

        storage.init_collection().await?;
        Ok(storage)
    }

    async fn init_collection(&self) -> ContextResult<()> {
        // Create collection if not exists
        let result = self.client
            .create_collection(&CreateCollection {
                collection_name: self.collection_name.clone(),
                vectors_config: Some(VectorsConfig {
                    config: Some(Config::Params(VectorParams {
                        size: self.embedding_dim as u64,
                        distance: Distance::Cosine.into(),
                        ..Default::default()
                    })),
                }),
                ..Default::default()
            })
            .await;

        // Ignore error if collection already exists
        match result {
            Ok(_) | Err(_) => Ok(()),
        }
    }

    pub async fn semantic_search(
        &self,
        query_embedding: Vec<f32>,
        limit: usize,
        filter: Option<qdrant_client::qdrant::Filter>,
    ) -> ContextResult<Vec<ContextEntry>> {
        let search_result = self.client
            .search_points(&SearchPoints {
                collection_name: self.collection_name.clone(),
                vector: query_embedding,
                limit: limit as u64,
                filter,
                with_payload: Some(true.into()),
                ..Default::default()
            })
            .await
            .map_err(|e| ContextError::RetrievalError(e.to_string()))?;

        let entries = search_result
            .result
            .into_iter()
            .filter_map(|point| {
                point.payload.and_then(|p| {
                    serde_json::from_value(serde_json::Value::Object(
                        p.into_iter().collect()
                    )).ok()
                })
            })
            .collect();

        Ok(entries)
    }
}
```

## Context Retrieval Strategy

```
┌────────────────────────────────────────────────────────────┐
│              Context Retrieval Algorithm                   │
└────────────────────────────────────────────────────────────┘

Input: RetrievalRequest
Output: RetrievedContext (within token budget)

1. PARALLEL RETRIEVAL FROM TIERS
   ┌─────────────┐  ┌──────────────┐  ┌─────────────┐
   │ Short-term  │  │ Medium-term  │  │ Long-term   │
   │ (Redis)     │  │ (PostgreSQL) │  │ (Vector DB) │
   └─────────────┘  └──────────────┘  └─────────────┘
         │                  │                  │
         └──────────────────┴──────────────────┘
                            │
                            ▼
2. RELEVANCE SCORING
   For each entry, calculate:
   - Recency score: f(time_since_created)
   - Semantic similarity: cosine(query_embed, entry_embed)
   - Access pattern: f(access_count, last_accessed)
   - Priority: entry.metadata.priority

   Combined score = w1*recency + w2*similarity + w3*access + w4*priority
                            │
                            ▼
3. PRIORITY RANKING
   Sort entries by combined score (descending)
                            │
                            ▼
4. TOKEN BUDGET ALLOCATION
   Allocate tokens by tier:
   - Short-term: 50% of budget
   - Medium-term: 30% of budget
   - Long-term: 20% of budget
                            │
                            ▼
5. GREEDY SELECTION
   For each tier (in priority order):
     While budget_remaining > 0:
       - Select highest scored entry
       - If entry fits: add to result
       - Else: try compression
       - Update budget_remaining
                            │
                            ▼
6. COMPRESSION (if needed)
   - Summarize old conversation turns
   - Compress metric data
   - Aggregate similar entities
                            │
                            ▼
7. ASSEMBLY
   Assemble final context:
   - System prompt
   - Long-term context (patterns, preferences)
   - Medium-term context (session history)
   - Short-term context (current conversation)
   - Current query
                            │
                            ▼
   Return: RetrievedContext
```

## Compression Strategies

```rust
pub struct ContextCompressionEngine {
    llm_client: Arc<dyn LlmClient>,
}

impl ContextCompressionEngine {
    /// Compression strategies by content type
    pub async fn compress_by_type(
        &self,
        content: &ContextContent,
    ) -> ContextResult<ContextContent> {
        match content {
            ContextContent::ConversationTurn { .. } => {
                self.compress_conversation(content).await
            }
            ContextContent::MetricContext { .. } => {
                self.compress_metrics(content).await
            }
            ContextContent::EntityReference { .. } => {
                self.compress_entity(content).await
            }
            _ => Ok(content.clone()),
        }
    }

    /// Compress conversation turn using LLM summarization
    async fn compress_conversation(
        &self,
        content: &ContextContent,
    ) -> ContextResult<ContextContent> {
        if let ContextContent::ConversationTurn {
            user_input,
            assistant_response,
            intent,
            entities,
        } = content {
            let prompt = format!(
                "Summarize this conversation turn concisely (max 50 words):\n\
                 User: {}\nAssistant: {}",
                user_input, assistant_response
            );

            let summary = self.llm_client
                .complete(&LlmRequest {
                    messages: vec![LlmMessage {
                        role: LlmRole::User,
                        content: prompt,
                    }],
                    model: "claude-3-haiku".to_string(),
                    temperature: 0.0,
                    max_tokens: 100,
                    stop_sequences: vec![],
                    metadata: HashMap::new(),
                })
                .await
                .map_err(|e| ContextError::CompressionError(e.to_string()))?;

            Ok(ContextContent::Summary {
                summary_of: vec![],
                summary_text: summary.content,
                compression_ratio: 0.3, // Estimated
            })
        } else {
            Ok(content.clone())
        }
    }

    /// Compress metrics by aggregation
    async fn compress_metrics(
        &self,
        content: &ContextContent,
    ) -> ContextResult<ContextContent> {
        // Aggregate multiple metric points
        // Keep only: min, max, avg, current
        Ok(content.clone())
    }

    /// Compress entity by keeping only essential info
    async fn compress_entity(
        &self,
        content: &ContextContent,
    ) -> ContextResult<ContextContent> {
        // Keep only: type, value, last_used
        Ok(content.clone())
    }
}
```

## Performance Characteristics

| Operation | Short-Term | Medium-Term | Long-Term |
|-----------|-----------|-------------|-----------|
| Write | < 10ms | < 50ms | < 100ms |
| Read (by ID) | < 5ms | < 20ms | < 50ms |
| Query | < 20ms | < 100ms | < 200ms |
| Semantic Search | N/A | N/A | < 500ms |
| Cleanup | < 100ms | < 500ms | < 2s |

## Data Flow Example

```
User Query: "Show me CPU usage for auth-service"

1. Retrieve Context
   ├─ Short-term: Last 3 conversation turns (500 tokens)
   ├─ Medium-term: Recent metrics queries (800 tokens)
   └─ Long-term: User prefers Grafana-style charts (200 tokens)

2. Token Budget: 8000 tokens
   ├─ Reserved for response: 2400 tokens
   ├─ Available for context: 5600 tokens
   └─ Used: 1500 tokens (27%)

3. Context Assembly
   System: "You are a DevOps assistant..."
   Long-term: "User prefers visual charts, UTC timezone"
   Medium-term: "Recent queries about auth-service, default range: 1h"
   Short-term: "Last discussed: auth-service deployment"
   Query: "Show me CPU usage for auth-service"

4. Total tokens: 1500 + query tokens
```
