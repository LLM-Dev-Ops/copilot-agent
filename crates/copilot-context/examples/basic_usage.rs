//! Basic usage example for the copilot-context crate
//!
//! Run with: cargo run --example basic_usage

use copilot_context::{
    ContextEngine, ContextEngineConfig, ContextEngineImpl, MemoryMetadata, MemoryTier,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("=== Copilot Context Engine Demo ===\n");

    // Create engine with default configuration
    let config = ContextEngineConfig::default();
    println!("Creating context engine with:");
    println!("  - Max tokens: {}", config.max_tokens);
    println!("  - Target utilization: {:.0}%", config.target_utilization * 100.0);
    println!("  - Auto-compression threshold: {:.0}%\n", config.auto_compress_threshold * 100.0);

    let engine = ContextEngineImpl::new(config)?;

    // Store various types of context
    println!("--- Storing Context Items ---\n");

    // 1. User query (high importance)
    let query_metadata = MemoryMetadata::new("user_query", "user_input")
        .with_tags(vec!["rust".to_string(), "async".to_string()]);
    let query_id = engine
        .store(
            "How do I implement async/await in Rust? I'm building a web server.".to_string(),
            query_metadata,
            0.9,
        )
        .await?;
    println!("✓ Stored user query (ID: {})", query_id);

    // 2. Code snippet (medium-high importance)
    let code_metadata = MemoryMetadata::new("code", "assistant_response")
        .with_tags(vec!["rust".to_string(), "example".to_string()]);
    let code_content = r#"
Here's an example of async Rust:

```rust
use tokio;

#[tokio::main]
async fn main() {
    let result = fetch_data().await;
    println!("Result: {:?}", result);
}

async fn fetch_data() -> String {
    // Async operation
    "data".to_string()
}
```
"#;
    let code_id = engine
        .store(code_content.to_string(), code_metadata, 0.8)
        .await?;
    println!("✓ Stored code example (ID: {})", code_id);

    // 3. Documentation reference (medium importance)
    let doc_metadata = MemoryMetadata::new("documentation", "external_source")
        .with_tags(vec!["rust".to_string(), "reference".to_string()]);
    let doc_id = engine
        .store(
            "Rust async/await allows you to write asynchronous code in a synchronous style. \
             The async keyword marks a function as asynchronous, and await suspends execution \
             until the future completes."
                .to_string(),
            doc_metadata,
            0.6,
        )
        .await?;
    println!("✓ Stored documentation (ID: {})", doc_id);

    // 4. Error message (high importance)
    let error_metadata = MemoryMetadata::new("error", "system")
        .with_tags(vec!["error".to_string()]);
    let error_id = engine
        .store(
            "ERROR: Failed to compile - missing tokio runtime. \
             Add tokio = { version = \"1.0\", features = [\"full\"] } to Cargo.toml"
                .to_string(),
            error_metadata,
            0.95,
        )
        .await?;
    println!("✓ Stored error message (ID: {})\n", error_id);

    // Get engine statistics
    println!("--- Engine Statistics ---\n");
    let stats = engine.stats().await?;
    println!("  Total items: {}", stats.total_items);
    println!("  Total tokens: {}", stats.total_tokens);
    println!("  Short-term: {} items, {} tokens", stats.short_term_items, stats.short_term_tokens);
    println!("  Medium-term: {} items, {} tokens", stats.medium_term_items, stats.medium_term_tokens);
    println!("  Long-term: {} items, {} tokens", stats.long_term_items, stats.long_term_tokens);
    println!("  Utilization: {:.2}%", stats.utilization * 100.0);
    println!("  Within budget: {}\n", if stats.within_budget { "Yes" } else { "No" });

    // Retrieve relevant context
    println!("--- Retrieving Context ---\n");
    let query = "async rust tokio";
    println!("Query: \"{}\"\n", query);

    let result = engine.retrieve(query).await?;
    println!("Retrieved {} items (total: {} tokens)", result.selected.len(), result.total_tokens);
    println!("Utilization: {:.1}%", result.utilization() * 100.0);
    println!("Efficiency: {:.1}%\n", result.efficiency() * 100.0);

    // Display retrieved items
    for (idx, scored_item) in result.selected.iter().enumerate() {
        println!("Item #{}", idx + 1);
        println!("  ID: {}", scored_item.item.metadata.id);
        println!("  Type: {}", scored_item.item.metadata.content_type);
        println!("  Score: {:.3}", scored_item.score);
        println!("  Importance: {:.3}", scored_item.item.current_importance());
        println!("  Tier: {:?}", scored_item.item.tier);
        println!("  Tokens: {}", scored_item.item.token_count);
        println!("  Access count: {}", scored_item.item.access_count);

        let content_preview = if scored_item.item.content.len() > 100 {
            format!("{}...", &scored_item.item.content[..100])
        } else {
            scored_item.item.content.clone()
        };
        println!("  Content: {}\n", content_preview.replace('\n', " "));
    }

    // Run maintenance
    println!("--- Running Maintenance ---\n");
    let maintenance_report = engine.maintenance().await?;
    println!("  Promotions: {}", maintenance_report.promotions);
    println!("  Demotions: {}", maintenance_report.demotions);
    println!("  Items compressed: {}", maintenance_report.items_compressed);
    println!("  Tokens saved: {}", maintenance_report.tokens_saved);
    println!("  Items evicted: {}\n", maintenance_report.items_evicted);

    // Demonstrate manual tier management
    println!("--- Manual Tier Management ---\n");
    println!("Promoting code example to long-term storage...");
    engine.promote(&code_id, MemoryTier::LongTerm).await?;
    println!("✓ Code example promoted\n");

    // Final statistics
    println!("--- Final Statistics ---\n");
    let final_stats = engine.stats().await?;
    println!("  Total items: {}", final_stats.total_items);
    println!("  Total tokens: {}", final_stats.total_tokens);
    println!("  Utilization: {:.2}%", final_stats.utilization * 100.0);
    println!("  Short-term: {} items", final_stats.short_term_items);
    println!("  Medium-term: {} items", final_stats.medium_term_items);
    println!("  Long-term: {} items\n", final_stats.long_term_items);

    // Demonstrate compression
    println!("--- Testing Compression ---\n");
    let compression_stats = engine.compress().await?;
    println!("  Items compressed: {}", compression_stats.items_compressed);
    println!("  Tokens saved: {}\n", compression_stats.tokens_saved);

    // Clean up
    println!("--- Cleanup ---\n");
    engine.clear().await?;
    let cleared_stats = engine.stats().await?;
    println!("✓ Engine cleared");
    println!("  Remaining items: {}", cleared_stats.total_items);
    println!("  Remaining tokens: {}\n", cleared_stats.total_tokens);

    println!("=== Demo Complete ===");

    Ok(())
}
