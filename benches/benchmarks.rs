//! Performance Benchmarks
//!
//! This module contains benchmarks for critical performance paths.

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use copilot_nlp::intent::IntentClassifier;
use copilot_context::retrieval::ContextRetriever;
use copilot_conversation::manager::ConversationManager;
use std::time::Duration;

// Intent Classification Benchmarks

fn bench_intent_classification_simple(c: &mut Criterion) {
    let classifier = IntentClassifier::new();

    c.bench_function("intent_classify_simple", |b| {
        b.iter(|| {
            classifier.classify(black_box("Show me CPU usage"))
        });
    });
}

fn bench_intent_classification_complex(c: &mut Criterion) {
    let classifier = IntentClassifier::new();

    c.bench_function("intent_classify_complex", |b| {
        b.iter(|| {
            classifier.classify(black_box(
                "Compare the CPU and memory usage between auth-service and api-gateway \
                 in us-east-1 and eu-west-1 for the last 24 hours and show me any anomalies"
            ))
        });
    });
}

fn bench_intent_classification_batch(c: &mut Criterion) {
    let mut group = c.benchmark_group("intent_classify_batch");
    let classifier = IntentClassifier::new();

    let queries = vec![
        "Show me CPU usage",
        "Find errors in the logs",
        "Why is the API slow?",
        "Trigger deployment workflow",
        "Show service dependencies",
    ];

    for size in [1, 10, 50, 100].iter() {
        group.throughput(Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.iter(|| {
                for _ in 0..size {
                    for query in &queries {
                        classifier.classify(black_box(query));
                    }
                }
            });
        });
    }
    group.finish();
}

fn bench_intent_classification_with_custom_patterns(c: &mut Criterion) {
    let mut classifier = IntentClassifier::new();

    // Add custom patterns
    for i in 0..100 {
        classifier.add_custom_pattern(
            &format!(r"(?i)\bcustom_pattern_{}\b", i),
            0.8,
            copilot_nlp::intent::IntentType::GeneralQuery,
        ).ok();
    }

    c.bench_function("intent_classify_with_custom_patterns", |b| {
        b.iter(|| {
            classifier.classify(black_box("Show me CPU usage"))
        });
    });
}

// Context Retrieval Benchmarks

fn bench_context_retrieval_simple(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let retriever = rt.block_on(async {
        create_test_context_retriever().await
    });

    c.bench_function("context_retrieve_simple", |b| {
        b.to_async(&rt).iter(|| async {
            retriever.retrieve(black_box("test query"), 10).await
        });
    });
}

fn bench_context_retrieval_large_corpus(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let retriever = rt.block_on(async {
        let mut retriever = create_test_context_retriever().await;
        // Add many documents
        for i in 0..10000 {
            retriever.add_document(
                format!("doc_{}", i),
                format!("This is test document number {} with some content", i),
            ).await.ok();
        }
        retriever
    });

    c.bench_function("context_retrieve_large_corpus", |b| {
        b.to_async(&rt).iter(|| async {
            retriever.retrieve(black_box("test query"), 10).await
        });
    });
}

fn bench_context_retrieval_varying_k(c: &mut Criterion) {
    let mut group = c.benchmark_group("context_retrieve_varying_k");
    let rt = tokio::runtime::Runtime::new().unwrap();

    let retriever = rt.block_on(async {
        create_test_context_retriever_with_docs(1000).await
    });

    for k in [1, 5, 10, 20, 50].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(k), k, |b, &k| {
            b.to_async(&rt).iter(|| async {
                retriever.retrieve(black_box("test query"), k).await
            });
        });
    }
    group.finish();
}

fn bench_context_compression(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let retriever = rt.block_on(async {
        create_test_context_retriever().await
    });

    // Large context to compress
    let large_context = (0..100)
        .map(|i| format!("Context item {} with detailed information", i))
        .collect::<Vec<_>>()
        .join("\n");

    c.bench_function("context_compress", |b| {
        b.to_async(&rt).iter(|| async {
            retriever.compress(black_box(&large_context), 500).await
        });
    });
}

// Response Generation Benchmarks

fn bench_response_generation_simple(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let manager = rt.block_on(async {
        create_test_conversation_manager().await
    });

    c.bench_function("response_generate_simple", |b| {
        b.to_async(&rt).iter(|| async {
            manager.generate_response(
                black_box("What is the CPU usage?"),
                Vec::new(),
            ).await
        });
    });
}

fn bench_response_generation_with_context(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let manager = rt.block_on(async {
        create_test_conversation_manager().await
    });

    let context = vec![
        "Service: auth-service",
        "Region: us-east-1",
        "Environment: production",
        "Time range: last 24 hours",
    ];

    c.bench_function("response_generate_with_context", |b| {
        b.to_async(&rt).iter(|| async {
            manager.generate_response(
                black_box("Show me the metrics"),
                black_box(context.clone()),
            ).await
        });
    });
}

fn bench_response_generation_streaming(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let manager = rt.block_on(async {
        create_test_conversation_manager().await
    });

    c.bench_function("response_generate_streaming", |b| {
        b.to_async(&rt).iter(|| async {
            let mut stream = manager.generate_response_stream(
                black_box("Explain the current system status"),
            ).await.unwrap();

            while let Some(_chunk) = stream.next().await {
                // Consume stream
            }
        });
    });
}

fn bench_multi_turn_conversation(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("multi_turn_conversation", |b| {
        b.to_async(&rt).iter(|| async {
            let manager = create_test_conversation_manager().await;

            // Simulate 5-turn conversation
            for query in [
                "Show CPU usage",
                "What about memory?",
                "Compare them",
                "Show trends",
                "Any anomalies?",
            ] {
                manager.generate_response(query, Vec::new()).await.ok();
            }
        });
    });
}

// End-to-End Benchmarks

fn bench_end_to_end_query_processing(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let (classifier, retriever, manager) = rt.block_on(async {
        (
            IntentClassifier::new(),
            create_test_context_retriever().await,
            create_test_conversation_manager().await,
        )
    });

    c.bench_function("e2e_query_processing", |b| {
        b.to_async(&rt).iter(|| async {
            let query = black_box("Show me CPU usage for auth-service");

            // Intent classification
            let intent = classifier.classify(query);

            // Context retrieval
            let context = retriever.retrieve(query, 10).await.unwrap();

            // Response generation
            manager.generate_response(query, context).await.ok();
        });
    });
}

fn bench_concurrent_requests(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_requests");
    group.measurement_time(Duration::from_secs(10));

    let rt = tokio::runtime::Runtime::new().unwrap();

    for concurrency in [1, 10, 50, 100].iter() {
        group.throughput(Throughput::Elements(*concurrency as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(concurrency),
            concurrency,
            |b, &concurrency| {
                b.to_async(&rt).iter(|| async {
                    let manager = create_test_conversation_manager().await;

                    let handles: Vec<_> = (0..concurrency)
                        .map(|i| {
                            let manager = manager.clone();
                            tokio::spawn(async move {
                                manager.generate_response(
                                    &format!("Query {}", i),
                                    Vec::new(),
                                ).await
                            })
                        })
                        .collect();

                    for handle in handles {
                        handle.await.ok();
                    }
                });
            },
        );
    }
    group.finish();
}

// Memory Benchmarks

fn bench_memory_usage_large_conversation(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("memory_large_conversation", |b| {
        b.to_async(&rt).iter(|| async {
            let manager = create_test_conversation_manager().await;

            // Simulate large conversation
            for i in 0..1000 {
                manager.generate_response(
                    &format!("Message number {}", i),
                    Vec::new(),
                ).await.ok();
            }
        });
    });
}

// Helper functions

async fn create_test_context_retriever() -> ContextRetriever {
    // TODO: Create actual retriever when implementation is available
    todo!()
}

async fn create_test_context_retriever_with_docs(count: usize) -> ContextRetriever {
    let mut retriever = create_test_context_retriever().await;
    for i in 0..count {
        retriever.add_document(
            format!("doc_{}", i),
            format!("Document {} content", i),
        ).await.ok();
    }
    retriever
}

async fn create_test_conversation_manager() -> ConversationManager {
    // TODO: Create actual manager when implementation is available
    todo!()
}

// Benchmark groups

criterion_group!(
    intent_benches,
    bench_intent_classification_simple,
    bench_intent_classification_complex,
    bench_intent_classification_batch,
    bench_intent_classification_with_custom_patterns,
);

criterion_group!(
    context_benches,
    bench_context_retrieval_simple,
    bench_context_retrieval_large_corpus,
    bench_context_retrieval_varying_k,
    bench_context_compression,
);

criterion_group!(
    response_benches,
    bench_response_generation_simple,
    bench_response_generation_with_context,
    bench_response_generation_streaming,
    bench_multi_turn_conversation,
);

criterion_group!(
    e2e_benches,
    bench_end_to_end_query_processing,
    bench_concurrent_requests,
);

criterion_group!(
    memory_benches,
    bench_memory_usage_large_conversation,
);

criterion_main!(
    intent_benches,
    context_benches,
    response_benches,
    e2e_benches,
    memory_benches,
);
