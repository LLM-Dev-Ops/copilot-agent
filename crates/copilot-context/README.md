# Copilot Context Engine

Multi-tier context management system for LLM-CoPilot-Agent with intelligent retrieval, compression, and token budget management.

## Features

- **Multi-tier Storage**: Automatic management of short-term, medium-term, and long-term memory
- **Intelligent Retrieval**: Context-aware retrieval with relevance scoring and prioritization
- **Compression**: Multiple compression strategies to manage token budgets
- **Token Management**: Built-in token counting and budget management for 200K context windows
- **Automatic Tier Management**: Promotes/demotes items based on importance and access patterns

## Architecture

### Memory Tiers

1. **Short-term Memory** (10K tokens)
   - Recent, frequently accessed content
   - Fast decay rate
   - Retention: Minutes to hours

2. **Medium-term Memory** (50K tokens)
   - Important, moderately accessed content
   - Medium decay rate
   - Retention: Hours to days

3. **Long-term Memory** (140K tokens)
   - Archived, rarely accessed content
   - Slow decay rate
   - Retention: Days to weeks

### Components

#### Engine (`engine.rs`)
- `ContextEngine` trait: Main interface for context operations
- `ContextEngineImpl`: Implementation with multi-tier storage
- Automatic tier selection based on importance
- Token counting using tiktoken
- Maintenance operations (compression, eviction, tier management)

#### Memory (`memory.rs`)
- `MemoryTier`: Enumeration of storage tiers
- `MemoryItem`: Context item with metadata and statistics
- `MemoryStore` trait: Abstract storage interface
- `InMemoryStore`: In-memory implementation
- `ImportanceScorer`: Algorithm for calculating item importance

#### Retrieval (`retrieval.rs`)
- `RelevanceScorer`: Scores items by relevance to query
- `ContextWindow`: Manages context window with token budget
- Prioritization algorithm combining relevance, importance, and recency
- Optimized selection using greedy algorithms

#### Compression (`compression.rs`)
- Multiple compression strategies:
  - Truncate: Simple size reduction
  - Summarize: Extract key sentences
  - Extract: Pull out code, errors, key phrases
  - Deduplicate: Remove repeated content
  - Hybrid: Combine multiple strategies
- `TokenBudgetManager`: Track and enforce token limits
- Compression metrics and reporting

## Usage

### Basic Example

```rust
use copilot_context::{ContextEngineImpl, ContextEngineConfig, MemoryMetadata};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create engine with default config (200K token limit)
    let config = ContextEngineConfig::default();
    let engine = ContextEngineImpl::new(config)?;

    // Store context
    let metadata = MemoryMetadata::new("conversation", "user_input");
    let id = engine.store(
        "How do I implement async Rust?".to_string(),
        metadata,
        0.8, // importance score
    ).await?;

    // Retrieve relevant context
    let result = engine.retrieve("async rust implementation").await?;

    // Access retrieved items
    for scored_item in result.selected {
        println!("Score: {:.3}", scored_item.score);
        println!("Content: {}", scored_item.item.content);
    }

    // Get statistics
    let stats = engine.stats().await?;
    println!("Total tokens: {}", stats.total_tokens);
    println!("Utilization: {:.1}%", stats.utilization * 100.0);

    // Run maintenance
    let report = engine.maintenance().await?;
    println!("Items compressed: {}", report.items_compressed);
    println!("Tokens saved: {}", report.tokens_saved);

    Ok(())
}
```

### Advanced Configuration

```rust
use copilot_context::{
    ContextEngineConfig,
    RetrievalConfig,
    CompressionConfig,
    CompressionStrategy,
};

let config = ContextEngineConfig {
    max_tokens: 200_000,
    target_utilization: 0.8,
    retrieval: RetrievalConfig {
        relevance_weight: 0.5,
        importance_weight: 0.3,
        recency_weight: 0.2,
        min_relevance: 0.3,
        ..Default::default()
    },
    compression: CompressionConfig {
        strategy: CompressionStrategy::Hybrid,
        target_ratio: 0.5,
        preserve_important: true,
        ..Default::default()
    },
    auto_tier_management: true,
    auto_compress_threshold: 0.85,
    tokenizer_model: "gpt-4".to_string(),
};

let engine = ContextEngineImpl::new(config)?;
```

### Custom Importance Scoring

```rust
use copilot_context::memory::ImportanceScorer;
use std::collections::HashMap;

let context = HashMap::new();
let importance = ImportanceScorer::score(
    "Error: Connection timeout",
    "error",
    "system",
    &context,
);

println!("Importance: {:.3}", importance);
```

### Manual Tier Management

```rust
// Promote item to long-term storage
engine.promote(&item_id, MemoryTier::LongTerm).await?;

// Demote item to short-term storage
engine.demote(&item_id, MemoryTier::ShortTerm).await?;
```

## Token Budget Management

The engine automatically manages a 200K token context window:

- **Target Utilization**: 80% (160K tokens)
- **Auto-compression**: Triggered at 85% utilization
- **Eviction**: Lowest-importance items removed when needed
- **Token Counting**: Uses tiktoken for accurate counting

## Testing

Run tests with:

```bash
cargo test -p copilot-context
```

Run with logging:

```bash
RUST_LOG=debug cargo test -p copilot-context -- --nocapture
```

## Performance

- **Retrieval**: O(n log n) for optimal selection
- **Compression**: Varies by strategy (O(n) to O(n²))
- **Token Counting**: O(n) where n is content length
- **Tier Management**: O(n) where n is number of items

## Integration

This crate is designed to integrate with:

- `copilot-core`: Core types and traits
- `copilot-conversation`: Conversation management
- `copilot-nlp`: Natural language processing

## Future Enhancements

- Vector embeddings for semantic similarity
- Persistent storage backends (Redis, PostgreSQL)
- Clustering for better organization
- Learning from user feedback
- Context templates for common patterns

## License

See LICENSE.md in the repository root.
