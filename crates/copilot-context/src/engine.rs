//! Context Engine Implementation
//!
//! Main engine for managing multi-tier context storage, retrieval, and compression.

use async_trait::async_trait;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tiktoken_rs::{get_bpe_from_model, CoreBPE};
use uuid::Uuid;

use crate::{
    compression::{CompressionConfig, Compressor, TokenBudgetManager},
    memory::{ImportanceScorer, InMemoryStore, MemoryItem, MemoryMetadata, MemoryStore, MemoryTier},
    retrieval::{ContextWindow, RetrievalConfig, RetrievalResult},
    ContextError, Result,
};

/// Configuration for the context engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEngineConfig {
    /// Maximum total tokens across all tiers
    pub max_tokens: usize,

    /// Target token utilization (0.0 - 1.0)
    pub target_utilization: f64,

    /// Retrieval configuration
    pub retrieval: RetrievalConfig,

    /// Compression configuration
    pub compression: CompressionConfig,

    /// Enable automatic tier management
    pub auto_tier_management: bool,

    /// Auto-compress when utilization exceeds this threshold
    pub auto_compress_threshold: f64,

    /// Model for token counting (e.g., "gpt-4", "gpt-3.5-turbo")
    pub tokenizer_model: String,
}

impl Default for ContextEngineConfig {
    fn default() -> Self {
        Self {
            max_tokens: 200_000,
            target_utilization: 0.8,
            retrieval: RetrievalConfig::default(),
            compression: CompressionConfig::default(),
            auto_tier_management: true,
            auto_compress_threshold: 0.85,
            tokenizer_model: "gpt-4".to_string(),
        }
    }
}

/// Context Engine trait
#[async_trait]
pub trait ContextEngine: Send + Sync {
    /// Store context with automatic tier selection
    async fn store(
        &self,
        content: String,
        metadata: MemoryMetadata,
        importance: f64,
    ) -> Result<Uuid>;

    /// Retrieve relevant context within token budget
    async fn retrieve(&self, query: &str) -> Result<RetrievalResult>;

    /// Compress context when approaching limits
    async fn compress(&self) -> Result<CompressionStats>;

    /// Get current statistics
    async fn stats(&self) -> Result<EngineStats>;

    /// Manually promote item to higher tier
    async fn promote(&self, id: &Uuid, tier: MemoryTier) -> Result<()>;

    /// Manually demote item to lower tier
    async fn demote(&self, id: &Uuid, tier: MemoryTier) -> Result<()>;

    /// Remove item from storage
    async fn remove(&self, id: &Uuid) -> Result<()>;

    /// Clear all context
    async fn clear(&self) -> Result<()>;

    /// Run maintenance (tier management, compression, eviction)
    async fn maintenance(&self) -> Result<MaintenanceReport>;
}

/// Implementation of the context engine
pub struct ContextEngineImpl {
    config: ContextEngineConfig,
    short_term: Arc<tokio::sync::RwLock<InMemoryStore>>,
    medium_term: Arc<tokio::sync::RwLock<InMemoryStore>>,
    long_term: Arc<tokio::sync::RwLock<InMemoryStore>>,
    budget_manager: Arc<tokio::sync::RwLock<TokenBudgetManager>>,
    compressor: Compressor,
    context_window: ContextWindow,
    tokenizer: CoreBPE,
    item_index: Arc<DashMap<Uuid, MemoryTier>>, // Quick lookup for item location
}

impl ContextEngineImpl {
    /// Create a new context engine
    pub fn new(config: ContextEngineConfig) -> Result<Self> {
        let tokenizer = get_bpe_from_model(&config.tokenizer_model)
            .map_err(|e| ContextError::CoreError(format!("Failed to load tokenizer: {}", e)))?;

        let budget_manager = TokenBudgetManager::new(config.max_tokens, config.target_utilization);
        let compressor = Compressor::new(config.compression.clone())?;
        let context_window = ContextWindow::new(config.retrieval.clone())?;

        Ok(Self {
            config,
            short_term: Arc::new(tokio::sync::RwLock::new(InMemoryStore::new(
                MemoryTier::ShortTerm,
            ))),
            medium_term: Arc::new(tokio::sync::RwLock::new(InMemoryStore::new(
                MemoryTier::MediumTerm,
            ))),
            long_term: Arc::new(tokio::sync::RwLock::new(InMemoryStore::new(
                MemoryTier::LongTerm,
            ))),
            budget_manager: Arc::new(tokio::sync::RwLock::new(budget_manager)),
            compressor,
            context_window,
            tokenizer,
            item_index: Arc::new(DashMap::new()),
        })
    }

    /// Count tokens in text
    fn count_tokens(&self, text: &str) -> usize {
        self.tokenizer.encode_with_special_tokens(text).len()
    }

    /// Get the appropriate store for a tier
    fn get_store(&self, tier: MemoryTier) -> Arc<tokio::sync::RwLock<InMemoryStore>> {
        match tier {
            MemoryTier::ShortTerm => self.short_term.clone(),
            MemoryTier::MediumTerm => self.medium_term.clone(),
            MemoryTier::LongTerm => self.long_term.clone(),
        }
    }

    /// Select tier based on importance
    fn select_tier(&self, importance: f64) -> MemoryTier {
        if importance >= MemoryTier::LongTerm.importance_threshold() {
            MemoryTier::LongTerm
        } else if importance >= MemoryTier::MediumTerm.importance_threshold() {
            MemoryTier::MediumTerm
        } else {
            MemoryTier::ShortTerm
        }
    }

    /// Collect all items from all tiers
    async fn collect_all_items(&self) -> Result<Vec<MemoryItem>> {
        let mut all_items = Vec::new();

        let short = self.short_term.read().await.list().await?;
        let medium = self.medium_term.read().await.list().await?;
        let long = self.long_term.read().await.list().await?;

        all_items.extend(short);
        all_items.extend(medium);
        all_items.extend(long);

        Ok(all_items)
    }

    /// Manage tiers automatically (promote/demote based on access patterns)
    async fn manage_tiers(&self) -> Result<TierManagementStats> {
        let mut stats = TierManagementStats::default();

        // Check each tier for promotion/demotion candidates
        for tier in [MemoryTier::ShortTerm, MemoryTier::MediumTerm, MemoryTier::LongTerm] {
            let store = self.get_store(tier);
            let items = store.read().await.list().await?;

            for item in items {
                if let Some(new_tier) = item.should_promote() {
                    self.move_item(&item.metadata.id, item.tier, new_tier).await?;
                    stats.promotions += 1;
                } else if let Some(new_tier) = item.should_demote() {
                    self.move_item(&item.metadata.id, item.tier, new_tier).await?;
                    stats.demotions += 1;
                }
            }
        }

        Ok(stats)
    }

    /// Move item between tiers
    async fn move_item(&self, id: &Uuid, from: MemoryTier, to: MemoryTier) -> Result<()> {
        let from_store = self.get_store(from);
        let to_store = self.get_store(to);

        // Get item from source tier
        let mut item = from_store
            .read()
            .await
            .retrieve(id)
            .await?
            .ok_or_else(|| ContextError::ItemNotFound(id.to_string()))?;

        // Update tier
        item.tier = to;

        // Move to new tier
        to_store.write().await.store(item).await?;
        from_store.write().await.remove(id).await?;

        // Update index
        self.item_index.insert(*id, to);

        Ok(())
    }

    /// Evict items to free up space
    async fn evict_items(&self, tokens_needed: usize) -> Result<usize> {
        let mut tokens_freed = 0;

        // Evict from short-term first
        if tokens_freed < tokens_needed {
            let freed = self.short_term
                .write()
                .await
                .evict(self.short_term.read().await.total_tokens().await? - tokens_needed)
                .await?
                .iter()
                .map(|item| item.token_count)
                .sum::<usize>();
            tokens_freed += freed;
        }

        // Then medium-term if needed
        if tokens_freed < tokens_needed {
            let freed = self.medium_term
                .write()
                .await
                .evict(self.medium_term.read().await.total_tokens().await? - (tokens_needed - tokens_freed))
                .await?
                .iter()
                .map(|item| item.token_count)
                .sum::<usize>();
            tokens_freed += freed;
        }

        Ok(tokens_freed)
    }
}

#[async_trait]
impl ContextEngine for ContextEngineImpl {
    async fn store(
        &self,
        content: String,
        metadata: MemoryMetadata,
        importance: f64,
    ) -> Result<Uuid> {
        // Count tokens
        let token_count = self.count_tokens(&content);

        // Check if we need to make space
        let mut budget = self.budget_manager.write().await;
        if budget.add_tokens(token_count).is_err() {
            // Need to compress or evict
            drop(budget); // Release lock

            if self.config.auto_compress_threshold > 0.0 {
                self.compress().await?;
            }

            // Try again
            let mut budget = self.budget_manager.write().await;
            if budget.add_tokens(token_count).is_err() {
                // Still not enough space, evict items
                drop(budget);
                self.evict_items(token_count).await?;
                self.budget_manager.write().await.add_tokens(token_count)?;
            }
        }

        // Select tier
        let tier = self.select_tier(importance);

        // Create memory item
        let item = MemoryItem::new(content, metadata, importance, token_count);
        let id = item.metadata.id;

        // Store in appropriate tier
        let store = self.get_store(tier);
        store.write().await.store(item).await?;

        // Update index
        self.item_index.insert(id, tier);

        Ok(id)
    }

    async fn retrieve(&self, query: &str) -> Result<RetrievalResult> {
        // Collect all items
        let all_items = self.collect_all_items().await?;

        // Use context window to retrieve relevant items
        let result = self.context_window.retrieve_optimized(query, all_items)?;

        // Update access statistics for retrieved items
        for scored in &result.selected {
            if let Some(tier) = self.item_index.get(&scored.item.metadata.id) {
                let store = self.get_store(*tier);
                let mut store_write = store.write().await;

                if let Some(mut item) = store_write.retrieve(&scored.item.metadata.id).await? {
                    item.record_access();
                    store_write.update(item).await?;
                }
            }
        }

        Ok(result)
    }

    async fn compress(&self) -> Result<CompressionStats> {
        let mut stats = CompressionStats::default();

        // Compress items in each tier
        for tier in [MemoryTier::ShortTerm, MemoryTier::MediumTerm, MemoryTier::LongTerm] {
            let store = self.get_store(tier);
            let items = store.read().await.list().await?;

            for item in items {
                if item.compressed_content.is_some() {
                    continue; // Already compressed
                }

                let compressed = self.compressor.compress_item(&item)?;
                let compressed_tokens = self.count_tokens(&compressed);

                if compressed_tokens < item.token_count {
                    let mut updated_item = item.clone();
                    updated_item.compressed_content = Some(compressed);

                    store.write().await.update(updated_item).await?;

                    stats.items_compressed += 1;
                    stats.tokens_saved += item.token_count - compressed_tokens;

                    // Update budget
                    self.budget_manager
                        .write()
                        .await
                        .remove_tokens(item.token_count - compressed_tokens);
                }
            }
        }

        Ok(stats)
    }

    async fn stats(&self) -> Result<EngineStats> {
        let short_tokens = self.short_term.read().await.total_tokens().await?;
        let medium_tokens = self.medium_term.read().await.total_tokens().await?;
        let long_tokens = self.long_term.read().await.total_tokens().await?;
        let total_tokens = short_tokens + medium_tokens + long_tokens;

        let short_items = self.short_term.read().await.list().await?.len();
        let medium_items = self.medium_term.read().await.list().await?.len();
        let long_items = self.long_term.read().await.list().await?.len();

        let budget = self.budget_manager.read().await;

        Ok(EngineStats {
            total_items: short_items + medium_items + long_items,
            total_tokens,
            short_term_tokens: short_tokens,
            medium_term_tokens: medium_tokens,
            long_term_tokens: long_tokens,
            short_term_items: short_items,
            medium_term_items: medium_items,
            long_term_items: long_items,
            utilization: budget.utilization(),
            within_budget: budget.is_within_budget(),
        })
    }

    async fn promote(&self, id: &Uuid, tier: MemoryTier) -> Result<()> {
        if let Some(current_tier) = self.item_index.get(id) {
            if *current_tier != tier {
                self.move_item(id, *current_tier, tier).await?;
            }
            Ok(())
        } else {
            Err(ContextError::ItemNotFound(id.to_string()))
        }
    }

    async fn demote(&self, id: &Uuid, tier: MemoryTier) -> Result<()> {
        self.promote(id, tier).await
    }

    async fn remove(&self, id: &Uuid) -> Result<()> {
        if let Some((_, tier)) = self.item_index.remove(id) {
            let store = self.get_store(tier);
            let item = store.read().await.retrieve(id).await?;

            if let Some(item) = item {
                self.budget_manager.write().await.remove_tokens(item.token_count);
                store.write().await.remove(id).await?;
            }

            Ok(())
        } else {
            Err(ContextError::ItemNotFound(id.to_string()))
        }
    }

    async fn clear(&self) -> Result<()> {
        self.short_term.write().await.clear().await?;
        self.medium_term.write().await.clear().await?;
        self.long_term.write().await.clear().await?;
        self.item_index.clear();

        let mut budget = self.budget_manager.write().await;
        *budget = TokenBudgetManager::new(self.config.max_tokens, self.config.target_utilization);

        Ok(())
    }

    async fn maintenance(&self) -> Result<MaintenanceReport> {
        let mut report = MaintenanceReport::default();

        // Tier management
        if self.config.auto_tier_management {
            let tier_stats = self.manage_tiers().await?;
            report.promotions = tier_stats.promotions;
            report.demotions = tier_stats.demotions;
        }

        // Compression
        let budget = self.budget_manager.read().await;
        if budget.utilization() >= self.config.auto_compress_threshold {
            drop(budget);
            let compression_stats = self.compress().await?;
            report.items_compressed = compression_stats.items_compressed;
            report.tokens_saved = compression_stats.tokens_saved;
        }

        // Eviction if still needed
        let budget = self.budget_manager.read().await;
        if !budget.is_within_budget() {
            let tokens_to_free = budget.tokens_to_free();
            drop(budget);
            let freed = self.evict_items(tokens_to_free).await?;
            report.items_evicted = freed;
        }

        Ok(report)
    }
}

/// Statistics about the context engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStats {
    pub total_items: usize,
    pub total_tokens: usize,
    pub short_term_tokens: usize,
    pub medium_term_tokens: usize,
    pub long_term_tokens: usize,
    pub short_term_items: usize,
    pub medium_term_items: usize,
    pub long_term_items: usize,
    pub utilization: f64,
    pub within_budget: bool,
}

/// Compression statistics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct CompressionStats {
    pub items_compressed: usize,
    pub tokens_saved: usize,
}

/// Tier management statistics
#[derive(Debug, Default, Clone)]
struct TierManagementStats {
    promotions: usize,
    demotions: usize,
}

/// Maintenance report
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct MaintenanceReport {
    pub promotions: usize,
    pub demotions: usize,
    pub items_compressed: usize,
    pub tokens_saved: usize,
    pub items_evicted: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_engine_creation() {
        let config = ContextEngineConfig::default();
        let engine = ContextEngineImpl::new(config);
        assert!(engine.is_ok());
    }

    #[tokio::test]
    async fn test_store_and_retrieve() {
        let config = ContextEngineConfig::default();
        let engine = ContextEngineImpl::new(config).unwrap();

        let metadata = MemoryMetadata::new("test", "test_source");
        let content = "This is a test content for context storage".to_string();

        let id = engine.store(content.clone(), metadata, 0.8).await.unwrap();
        assert!(engine.item_index.contains_key(&id));

        let result = engine.retrieve("test content").await.unwrap();
        assert!(!result.selected.is_empty());
    }

    #[tokio::test]
    async fn test_tier_selection() {
        let config = ContextEngineConfig::default();
        let engine = ContextEngineImpl::new(config).unwrap();

        // High importance -> Long term
        let metadata1 = MemoryMetadata::new("test", "test");
        let id1 = engine
            .store("High importance".to_string(), metadata1, 0.9)
            .await
            .unwrap();
        assert_eq!(engine.item_index.get(&id1).unwrap().value(), &MemoryTier::LongTerm);

        // Medium importance -> Medium term
        let metadata2 = MemoryMetadata::new("test", "test");
        let id2 = engine
            .store("Medium importance".to_string(), metadata2, 0.6)
            .await
            .unwrap();
        assert_eq!(engine.item_index.get(&id2).unwrap().value(), &MemoryTier::MediumTerm);

        // Low importance -> Short term
        let metadata3 = MemoryMetadata::new("test", "test");
        let id3 = engine
            .store("Low importance".to_string(), metadata3, 0.4)
            .await
            .unwrap();
        assert_eq!(engine.item_index.get(&id3).unwrap().value(), &MemoryTier::ShortTerm);
    }

    #[tokio::test]
    async fn test_stats() {
        let config = ContextEngineConfig::default();
        let engine = ContextEngineImpl::new(config).unwrap();

        let metadata = MemoryMetadata::new("test", "test");
        engine
            .store("Test content".to_string(), metadata, 0.5)
            .await
            .unwrap();

        let stats = engine.stats().await.unwrap();
        assert_eq!(stats.total_items, 1);
        assert!(stats.total_tokens > 0);
    }

    #[tokio::test]
    async fn test_clear() {
        let config = ContextEngineConfig::default();
        let engine = ContextEngineImpl::new(config).unwrap();

        let metadata = MemoryMetadata::new("test", "test");
        engine
            .store("Test content".to_string(), metadata, 0.5)
            .await
            .unwrap();

        let stats_before = engine.stats().await.unwrap();
        assert_eq!(stats_before.total_items, 1);

        engine.clear().await.unwrap();

        let stats_after = engine.stats().await.unwrap();
        assert_eq!(stats_after.total_items, 0);
        assert_eq!(stats_after.total_tokens, 0);
    }
}
