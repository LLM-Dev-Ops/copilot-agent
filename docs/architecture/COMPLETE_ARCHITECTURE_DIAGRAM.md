# LLM-CoPilot-Agent - Complete Architecture Diagram

This document presents the complete system architecture in a single comprehensive diagram.

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          CLIENT LAYER                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                  │
│    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐                     │
│    │  Web UI    │    │  CLI Tool  │    │  VS Code   │    │ Slack Bot  │    │  API       │                     │
│    │  (React)   │    │  (Rust)    │    │  Extension │    │            │    │  Clients   │                     │
│    └─────┬──────┘    └─────┬──────┘    └─────┬──────┘    └─────┬──────┘    └─────┬──────┘                     │
│          │                 │                  │                 │                 │                            │
│          │                 │                  │                 │                 │                            │
└──────────┼─────────────────┼──────────────────┼─────────────────┼─────────────────┼────────────────────────────┘
           │                 │                  │                 │                 │
           │                 └──────────────────┴─────────────────┴─────────────────┘
           │                                    │
           │                          HTTP/SSE, gRPC, WebSocket
           │                                    │
           ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          API GATEWAY LAYER                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐    │
│   │                                    API Gateway (Axum)                                                 │    │
│   │                                                                                                        │    │
│   │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │    │
│   │  │Authentication │  │   Rate        │  │   Request     │  │   Routing     │  │   Load           │  │    │
│   │  │    (JWT)      │─▶│   Limiting    │─▶│   Validation  │─▶│               │─▶│   Balancing      │  │    │
│   │  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘  └──────────────────┘  │    │
│   └──────────────────────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                     │                                                           │
└─────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                 │
                    │                                 │                                 │
                    ▼                                 ▼                                 ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐  ┌──────────────────────────────┐
│      NLP ENGINE SERVICE       │  │   CONTEXT ENGINE SERVICE     │  │   WORKFLOW ENGINE SERVICE    │
├───────────────────────────────┤  ├──────────────────────────────┤  ├──────────────────────────────┤
│                               │  │                              │  │                              │
│  ┌─────────────────────────┐ │  │  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │  Intent Classifier      │ │  │  │  Session Manager       │  │  │  │  Workflow Parser       │  │
│  │  ┌──────────────────┐   │ │  │  │  - Create/Get Session  │  │  │  │  - YAML/JSON           │  │
│  │  │ LLM API Client   │   │ │  │  │  - Track Activity      │  │  │  │  - Validation          │  │
│  │  │ - Claude 3       │   │ │  │  └────────────────────────┘  │  │  └────────────────────────┘  │
│  │  │ - Circuit Breaker│   │ │  │                              │  │                              │
│  │  │ - Rate Limiter   │   │ │  │  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │  └──────────────────┘   │ │  │  │  Memory Tiers          │  │  │  │  DAG Builder           │  │
│  │  ┌──────────────────┐   │ │  │  │                        │  │  │  │  - Dependency Analysis │  │
│  │  │ Cache Manager    │   │ │  │  │  ┌──────────────────┐  │  │  │  │  - Topological Sort    │  │
│  │  │ - L1: Memory LRU │   │ │  │  │  │  Short-term      │  │  │  │  │  - Cycle Detection     │  │
│  │  │ - L2: Redis      │   │ │  │  │  │  (Redis)         │  │  │  │  └────────────────────────┘  │
│  │  │ - L3: PostgreSQL │   │ │  │  │  │  TTL: 5min       │  │  │                              │
│  │  └──────────────────┘   │ │  │  │  └──────────────────┘  │  │  ┌────────────────────────┐  │
│  │  ┌──────────────────┐   │ │  │  │                        │  │  │  State Machine         │  │
│  │  │ Fallback Handler │   │ │  │  │  ┌──────────────────┐  │  │  │  - Draft → Running     │  │
│  │  │ - Rule-based     │   │ │  │  │  │  Medium-term     │  │  │  │  - Approval Gates      │  │
│  │  └──────────────────┘   │ │  │  │  │  (PostgreSQL)    │  │  │  │  - Failed → Rollback   │  │
│  └─────────────────────────┘ │  │  │  │  TTL: 24hr       │  │  │  └────────────────────────┘  │
│                               │  │  │  └──────────────────┘  │  │                              │
│  ┌─────────────────────────┐ │  │  │                        │  │  ┌────────────────────────┐  │
│  │  Entity Extractor       │ │  │  │  ┌──────────────────┐  │  │  │  Task Executor         │  │
│  │  - NER (LLM + Rules)    │ │  │  │  │  Long-term       │  │  │  │  - Sequential          │  │
│  │  - Entity Resolution    │ │  │  │  │  (Qdrant)        │  │  │  │  - Parallel            │  │
│  │  - Validation           │ │  │  │  │  TTL: 90days     │  │  │  │  - Conditional         │  │
│  └─────────────────────────┘ │  │  │  └──────────────────┘  │  │  └────────────────────────┘  │
│                               │  │  │                        │  │                              │
│  ┌─────────────────────────┐ │  │  ┌────────────────────────┐  │  ┌────────────────────────┐  │
│  │  Query Translator       │ │  │  │  Context Retriever     │  │  │  Checkpoint Manager    │  │
│  │  - NL → PromQL          │ │  │  │  - Semantic Search     │  │  │  - State Snapshots     │  │
│  │  - NL → LogQL           │ │  │  │  - Relevance Ranking   │  │  │  - Recovery Points     │  │
│  │  - NL → TraceQL         │ │  │  │  - Token Budget Mgmt   │  │  │  - Rollback Support    │  │
│  │  - Query Validation     │ │  │  └────────────────────────┘  │  │  - S3 Storage          │  │
│  └─────────────────────────┘ │  │                              │  └────────────────────────┘  │
│                               │  │  ┌────────────────────────┐  │                              │
│  ┌─────────────────────────┐ │  │  │  Learning System       │  │  ┌────────────────────────┐  │
│  │  Response Generator     │ │  │  │  - Pattern Detection   │  │  │  Approval System       │  │
│  │  - Text Formatting      │ │  │  │  - Preference Learning │  │  │  - Request Approval    │  │
│  │  - Visualization Hints  │ │  │  │  - Behavior Adaptation │  │  │  - Grant/Reject        │  │
│  │  - Suggestion Engine    │ │  │  └────────────────────────┘  │  │  - Timeout Handling    │  │
│  └─────────────────────────┘ │  │                              │  └────────────────────────┘  │
│                               │  │  ┌────────────────────────┐  │                              │
└───────────────┬───────────────┘  │  │  Token Budget Manager  │  └────────────┬─────────────────┘
                │                  │  │  - Compression         │  │            │
                │                  │  │  - Priority Selection  │  │            │
                │                  │  └────────────────────────┘  │            │
                │                  └──────────────┬───────────────┘            │
                │                                 │                            │
                │                                 │                            │
                └─────────────────────────────────┼────────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     RESPONSE STREAMING SERVICE                                                   │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                  │
│   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐           │
│   │  Stream Manager    │   │  Backpressure      │   │  Cache Manager     │   │  Connection        │           │
│   │  - Create streams  │──▶│  Controller        │──▶│  (Redis Streams)   │──▶│  Tracker           │           │
│   │  - Multiplexing    │   │  - Token bucket    │   │  - Partial cache   │   │  - Resume tokens   │           │
│   │  - Lifecycle       │   │  - Flow control    │   │  - Replay          │   │  - Heartbeat       │           │
│   └────────────────────┘   └────────────────────┘   └────────────────────┘   └────────────────────┘           │
│                                                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐    │
│   │                                    SSE Event Stream                                                   │    │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │    │
│   │  │  Text    │  │  JSON    │  │  Event   │  │ Progress │  │  Error   │  │ Complete │                │    │
│   │  │  Chunks  │  │  Data    │  │  Payload │  │  Update  │  │  Message │  │  Signal  │                │    │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │    │
│   └──────────────────────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                                  │
└──────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                                   │
                                                                   │ SSE (Server-Sent Events)
                                                                   │
                                                                   ▼
                                                            Back to Client

┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      MESSAGE BUS & EVENT SYSTEM                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐     │
│   │                                Internal Message Channels (MPSC)                                      │     │
│   │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐     │     │
│   │  │  NLP Events   │  │Context Events │  │Workflow Events│  │ Stream Events │  │ System Events│     │     │
│   │  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘  └──────────────┘     │     │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐     │
│   │                              Redis Pub/Sub (Cross-Instance)                                          │     │
│   │  ┌───────────────────────────────────────────────────────────────────────────────────────────┐     │     │
│   │  │  Channels: workflow.*, task.*, approval.*, stream.*, metrics.*                            │     │     │
│   │  └───────────────────────────────────────────────────────────────────────────────────────────┘     │     │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                                                  │
└─────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                                      │
                                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      SHARED INFRASTRUCTURE LAYER                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐                      │
│  │    Redis Cluster         │  │   PostgreSQL Primary     │  │    Qdrant Vector DB      │                      │
│  │                          │  │                          │  │                          │                      │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                      │
│  │  │ Short-term Cache   │  │  │  │ Context Storage    │  │  │  │ Vector Embeddings  │  │                      │
│  │  │ - Sessions         │  │  │  │ - Medium-term ctx  │  │  │  │ - Semantic search  │  │                      │
│  │  │ - Hot data         │  │  │  │ - Workflow state   │  │  │  │ - User patterns    │  │                      │
│  │  └────────────────────┘  │  │  └────────────────────┘  │  │  └────────────────────┘  │                      │
│  │  ┌────────────────────┐  │  │                          │  │                          │                      │
│  │  │ Stream Buffers     │  │  │  ┌────────────────────┐  │  │  Collection: contexts    │                      │
│  │  │ - Partial cache    │  │  │  │ Read Replicas (2)  │  │  │  Dimension: 1536         │                      │
│  │  │ - Resume tokens    │  │  │  │ - Load balancing   │  │  │  Distance: Cosine        │                      │
│  │  └────────────────────┘  │  │  └────────────────────┘  │  │                          │                      │
│  │  ┌────────────────────┐  │  │                          │  │                          │                      │
│  │  │ Pub/Sub Channels   │  │  │  Replication: Streaming  │  │  Index: HNSW             │                      │
│  │  │ - Events           │  │  │  Failover: Automatic     │  │  Sharding: Optional      │                      │
│  │  └────────────────────┘  │  │                          │  │                          │                      │
│  │                          │  │                          │  │                          │                      │
│  │  Cluster: 3 nodes        │  │  HA: Primary + 2 replicas│  │  HA: Standalone          │                      │
│  │  Sharding: Consistent    │  │                          │  │                          │                      │
│  │  Persistence: AOF + RDB  │  │                          │  │                          │                      │
│  └──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘                      │
│                                                                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐                      │
│  │    S3 Object Storage     │  │   Monitoring Stack       │  │   Secret Management      │                      │
│  │                          │  │                          │  │                          │                      │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                      │
│  │  │ Checkpoints        │  │  │  │ Prometheus         │  │  │  │ Vault / AWS KMS    │  │                      │
│  │  │ Logs & Artifacts   │  │  │  │ - Metrics          │  │  │  │ - API keys         │  │                      │
│  │  │ Backups            │  │  │  │ - Alerts           │  │  │  │ - DB credentials   │  │                      │
│  │  └────────────────────┘  │  │  └────────────────────┘  │  │  └────────────────────┘  │                      │
│  │                          │  │                          │  │                          │                      │
│  │  Bucket: copilot-data    │  │  ┌────────────────────┐  │  │  Encryption: AES-256     │                      │
│  │  Versioning: Enabled     │  │  │ Grafana            │  │  │  Rotation: Automatic     │                      │
│  │  Lifecycle: 90 days      │  │  │ - Dashboards       │  │  │                          │                      │
│  └──────────────────────────┘  │  └────────────────────┘  │  └──────────────────────────┘                      │
│                                 │                          │                                                     │
│                                 │  ┌────────────────────┐  │                                                     │
│                                 │  │ Jaeger/Tempo       │  │                                                     │
│                                 │  │ - Traces           │  │                                                     │
│                                 │  └────────────────────┘  │                                                     │
│                                 └──────────────────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      EXTERNAL SYSTEMS LAYER                                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐                      │
│  │   Anthropic Claude API   │  │   Prometheus / Thanos    │  │      Kubernetes          │                      │
│  │                          │  │                          │  │                          │                      │
│  │  Model: claude-3-sonnet  │  │  Metrics Storage         │  │  ┌────────────────────┐  │                      │
│  │  Endpoint: api.anthropic │  │  Query API               │  │  │ Deployments        │  │                      │
│  │  Rate Limit: 100 req/s   │  │  Time Series DB          │  │  │ StatefulSets       │  │                      │
│  │  Timeout: 30s            │  │                          │  │  │ Services           │  │                      │
│  │  Circuit Breaker: Yes    │  │  Retention: 30 days      │  │  └────────────────────┘  │                      │
│  └──────────────────────────┘  └──────────────────────────┘  │                          │                      │
│                                                               │  Namespaces:             │                      │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  │  - production            │                      │
│  │     Loki / ELK           │  │      Tempo               │  │  - staging               │                      │
│  │                          │  │                          │  │  - development           │                      │
│  │  Log Aggregation         │  │  Distributed Tracing     │  │                          │                      │
│  │  LogQL Interface         │  │  TraceQL Interface       │  │  Auto-scaling: HPA       │                      │
│  │  Retention: 7 days       │  │  Sampling: 10%           │  │  Load Balancing: NGINX   │                      │
│  └──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘                      │
│                                                                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐                      │
│  │    Notification          │  │    Git Repositories      │  │    CI/CD Pipeline        │                      │
│  │                          │  │                          │  │                          │                      │
│  │  - Slack                 │  │  - GitHub / GitLab       │  │  - GitHub Actions        │                      │
│  │  - Email (SMTP)          │  │  - Version Control       │  │  - Build & Test          │                      │
│  │  - PagerDuty             │  │  - Workflow Definitions  │  │  - Deploy                │                      │
│  │  - Webhooks              │  │                          │  │                          │                      │
│  └──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘                      │
│                                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Complete Request Lifecycle

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                         Example: "Deploy v2.0 to production"                                  │
└───────────────────────────────────────────────────────────────────────────────────────────────┘

Step 1: CLIENT REQUEST
────────────────────
Web UI → HTTP POST /api/execute
Body: { "input": "Deploy version 2.0 to production with approval" }
        │
        ▼

Step 2: API GATEWAY
────────────────────
┌──────────────────┐
│ Authenticate     │ → Verify JWT token
│ Rate Limit       │ → Check user quota (100 req/s)
│ Validate         │ → Schema validation
│ Route            │ → Route to NLP service
└──────────────────┘
        │
        ▼

Step 3: NLP ENGINE
──────────────────
┌──────────────────────────────────────┐
│ Intent Classification                │
├──────────────────────────────────────┤
│ Input: "Deploy version 2.0..."       │
│ Cache Check: MISS                    │
│ LLM Call: Claude API                 │
│ Result: ExecuteWorkflow (conf: 0.95) │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Entity Extraction                    │
├──────────────────────────────────────┤
│ Entities Found:                      │
│ - version: "2.0"                     │
│ - environment: "production"          │
│ - requires_approval: true            │
└──────────────────────────────────────┘
        │
        ▼

Step 4: CONTEXT ENGINE
───────────────────────
┌──────────────────────────────────────┐
│ Retrieve Context                     │
├──────────────────────────────────────┤
│ Short-term (Redis):                  │
│ - Last deployment: v1.9 to staging   │
│ - User: DevOps Engineer              │
│                                      │
│ Medium-term (PostgreSQL):            │
│ - Recent deployments: 5 in last week │
│ - Success rate: 95%                  │
│                                      │
│ Long-term (Qdrant):                  │
│ - User prefers approval gates        │
│ - Typical deploy time: 15min         │
│                                      │
│ Token Budget: 1200 / 8000 used       │
└──────────────────────────────────────┘
        │
        ▼

Step 5: WORKFLOW ENGINE
────────────────────────
┌──────────────────────────────────────┐
│ Workflow Selection                   │
├──────────────────────────────────────┤
│ Matched: "production-deploy-v2.yaml" │
│ Parameters:                          │
│ - image_tag: "v2.0"                  │
│ - namespace: "production"            │
│ - require_approval: true             │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ DAG Construction                     │
├──────────────────────────────────────┤
│ Tasks Parsed: 7                      │
│ Dependencies:                        │
│   validate ─┐                        │
│   build ────┼──▶ push ──▶ approval   │
│   test ─────┘       └──▶ deploy      │
│                          └──▶ verify │
│                                      │
│ Execution Batches:                   │
│ 1. [validate, build, test]           │
│ 2. [push]                            │
│ 3. [approval]                        │
│ 4. [deploy]                          │
│ 5. [verify]                          │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Instance Creation                    │
├──────────────────────────────────────┤
│ Instance ID: wf_20251125_001         │
│ State: PENDING → RUNNING             │
│ Storage: PostgreSQL + Redis          │
└──────────────────────────────────────┘
        │
        ▼

Step 6: STREAMING SERVICE
──────────────────────────
┌──────────────────────────────────────┐
│ Stream Creation                      │
├──────────────────────────────────────┤
│ Stream ID: stream_abc123             │
│ Client: SSE connection established   │
│ Buffer: 100 chunks                   │
│ Cache: Redis Streams enabled         │
└──────────────────────────────────────┘
        │
        ▼
Response to Client:
{
  "workflow_instance_id": "wf_20251125_001",
  "stream_id": "stream_abc123",
  "stream_url": "/stream?id=stream_abc123"
}

Step 7: WORKFLOW EXECUTION (Async)
───────────────────────────────────
Batch 1: Parallel Execution
┌──────────────────────────────────────┐
│ Task: validate                       │
│ Status: RUNNING → COMPLETED          │
│ Output: ✓ Manifest valid             │
│ Stream: Event sent                   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Task: build                          │
│ Status: RUNNING → COMPLETED          │
│ Output: ✓ Image built                │
│ Stream: Event sent                   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Task: test                           │
│ Status: RUNNING → COMPLETED          │
│ Output: ✓ Tests passed (127/127)     │
│ Stream: Event sent                   │
└──────────────────────────────────────┘
        │
        ▼ All completed
┌──────────────────────────────────────┐
│ Checkpoint Created                   │
├──────────────────────────────────────┤
│ Checkpoint ID: cp_001                │
│ Storage: PostgreSQL + S3             │
│ State: Batch 1 complete              │
└──────────────────────────────────────┘
        │
        ▼

Batch 2: Sequential
┌──────────────────────────────────────┐
│ Task: push                           │
│ Status: RUNNING → COMPLETED          │
│ Output: ✓ Pushed to registry         │
│ Stream: Event sent                   │
└──────────────────────────────────────┘
        │
        ▼

Batch 3: Approval Gate
┌──────────────────────────────────────┐
│ Task: approval                       │
│ Status: WAITING_APPROVAL             │
│ Approvers: [alice@ex.com, bob@ex.com]│
│ Timeout: 1 hour                      │
│ Stream: Approval request sent        │
└──────────────────────────────────────┘
        │
        │ Notification: Slack + Email
        │
        │ <User approves via UI>
        │
        ▼
┌──────────────────────────────────────┐
│ Approval Granted                     │
│ Approver: alice@example.com          │
│ Timestamp: 2025-11-25T10:15:00Z      │
│ Stream: Approval granted event       │
└──────────────────────────────────────┘
        │
        ▼

Batch 4: Deploy
┌──────────────────────────────────────┐
│ Task: deploy                         │
│ Status: RUNNING → COMPLETED          │
│ Output: ✓ Deployed to production     │
│ Stream: Deployment progress events   │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Checkpoint Created                   │
│ Checkpoint ID: cp_002                │
│ State: Deployment complete           │
└──────────────────────────────────────┘
        │
        ▼

Batch 5: Verification
┌──────────────────────────────────────┐
│ Task: verify                         │
│ Status: RUNNING → COMPLETED          │
│ Output: ✓ Health checks passed       │
│ Stream: Verification complete        │
└──────────────────────────────────────┘
        │
        ▼

Step 8: COMPLETION
──────────────────
┌──────────────────────────────────────┐
│ Workflow Status: COMPLETED           │
│ Duration: 14m 32s                    │
│ Tasks: 7/7 successful                │
│ Stream: Complete event sent          │
└──────────────────────────────────────┘
        │
        ▼

Step 9: CONTEXT UPDATE
──────────────────────
┌──────────────────────────────────────┐
│ Context Storage                      │
├──────────────────────────────────────┤
│ Short-term (Redis):                  │
│ - Latest deployment: v2.0 to prod    │
│                                      │
│ Medium-term (PostgreSQL):            │
│ - Workflow execution record          │
│ - Task outputs                       │
│                                      │
│ Long-term (Qdrant):                  │
│ - Learn: User prefers approval gates │
│ - Update: Avg deploy time = 14.5min  │
│ - Pattern: Deploys Tue-Thu 10-11am   │
└──────────────────────────────────────┘
        │
        ▼

Step 10: CLIENT RECEIVES UPDATES
─────────────────────────────────
SSE Stream Events (in order):

event: workflow_started
data: {"instance_id": "wf_20251125_001", "timestamp": "..."}

event: task_started
data: {"task_id": "validate", "name": "Validate Manifest"}

event: task_completed
data: {"task_id": "validate", "output": "✓ Manifest valid"}

event: task_started
data: {"task_id": "build", "name": "Build Image"}

... (all events) ...

event: approval_required
data: {"task_id": "approval", "approvers": [...], "timeout": 3600}

event: approval_granted
data: {"approver": "alice@example.com", "timestamp": "..."}

event: task_started
data: {"task_id": "deploy", "name": "Deploy to Production"}

event: progress
data: {"current": 50, "total": 100, "message": "Rolling update..."}

event: task_completed
data: {"task_id": "deploy", "output": "✓ Deployed"}

event: complete
data: {"duration": "14m32s", "tasks_completed": 7}

───────────────────────────────────────

CLIENT UI:
✓ Validate Manifest (2s)
✓ Build Image (3m 15s)
✓ Run Tests (1m 30s)
✓ Push to Registry (45s)
⏸ Waiting for approval...
  ✓ Approved by alice@example.com
✓ Deploy to Production (7m 20s)
✓ Verify Deployment (30s)

Total: 14m 32s
Status: Success
```

## Cross-Cutting Concerns

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Distributed Tracing (OpenTelemetry)                                 │
│  ────────────────────────────────────────                            │
│  Request ID: req_abc123                                              │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ Span: nlp.process                                      │         │
│  │  ├─ Span: nlp.classify_intent                          │         │
│  │  ├─ Span: nlp.extract_entities                         │         │
│  │  └─ Span: nlp.translate_query                          │         │
│  │                                                         │         │
│  │ Span: context.retrieve                                 │         │
│  │  ├─ Span: redis.query                                  │         │
│  │  ├─ Span: postgres.query                               │         │
│  │  └─ Span: qdrant.search                                │         │
│  │                                                         │         │
│  │ Span: workflow.execute                                 │         │
│  │  ├─ Span: task.validate                                │         │
│  │  ├─ Span: task.build                                   │         │
│  │  └─ Span: task.deploy                                  │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  Metrics (Prometheus)                                                │
│  ────────────────────                                                │
│  - nlp_requests_total{status="success"} 1234                        │
│  - nlp_request_duration_seconds{p95} 0.45                           │
│  - context_retrieval_duration_seconds{tier="short"} 0.005           │
│  - workflow_executions_total{state="completed"} 89                  │
│  - stream_chunks_sent_total 45678                                   │
│                                                                       │
│  Structured Logging                                                  │
│  ──────────────────                                                  │
│  {                                                                    │
│    "timestamp": "2025-11-25T10:00:00Z",                             │
│    "level": "INFO",                                                  │
│    "service": "nlp-engine",                                          │
│    "request_id": "req_abc123",                                       │
│    "user_id": "user_123",                                            │
│    "message": "Intent classified",                                   │
│    "intent": "ExecuteWorkflow",                                      │
│    "confidence": 0.95                                                │
│  }                                                                    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         SECURITY                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Authentication                                                       │
│  ──────────────                                                       │
│  Client → JWT Token → API Gateway → Verify → Grant Access            │
│                                                                       │
│  Authorization (RBAC)                                                 │
│  ────────────────────                                                 │
│  User Roles:                                                          │
│  - Admin: Full access                                                 │
│  - DevOps: Deploy, scale, monitor                                     │
│  - Developer: Query, read-only workflows                              │
│  - Viewer: Read-only                                                  │
│                                                                       │
│  Data Encryption                                                      │
│  ──────────────                                                       │
│  - TLS 1.3 for all external communication                            │
│  - Encryption at rest (AES-256)                                       │
│  - Secret management (Vault)                                          │
│                                                                       │
│  Audit Logging                                                        │
│  ─────────────                                                        │
│  All actions logged:                                                  │
│  - Workflow executions                                                │
│  - Approval decisions                                                 │
│  - Context access                                                     │
│  - LLM API calls                                                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

This diagram provides a complete view of the entire LLM-CoPilot-Agent architecture from client to infrastructure.
