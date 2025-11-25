# Data Storage and Persistence Layer Architecture

**Version:** 1.0.0
**Status:** Design Specification
**Last Updated:** 2025-11-25
**Author:** Data Architect

---

## Table of Contents

1. [Overview](#overview)
2. [PostgreSQL Schema Design](#postgresql-schema-design)
3. [Redis Data Structures](#redis-data-structures)
4. [Vector Database (Qdrant)](#vector-database-qdrant)
5. [Data Access Patterns](#data-access-patterns)
6. [Data Migration Strategy](#data-migration-strategy)
7. [Backup and Recovery](#backup-and-recovery)
8. [Rust Implementation Examples](#rust-implementation-examples)

---

## Overview

### Architecture Principles

The LLM-CoPilot-Agent persistence layer implements a polyglot persistence strategy:

- **PostgreSQL**: ACID-compliant primary data store for transactional data
- **Redis**: High-performance cache and session store
- **Qdrant**: Vector database for semantic search and embeddings
- **AgentDB (SQLite + HNSW)**: Local agent memory and context

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                        │
├─────────────────────────────────────────────────────────────────┤
│                    Repository Pattern Layer                     │
├──────────────┬──────────────┬──────────────┬──────────────────┤
│  PostgreSQL  │    Redis     │   Qdrant     │   AgentDB        │
│  Repository  │   Repository │  Repository  │   (Local)        │
├──────────────┼──────────────┼──────────────┼──────────────────┤
│ Connection   │ Connection   │ Connection   │ SQLite           │
│ Pool Manager │ Pool Manager │ Pool Manager │ Connection       │
├──────────────┼──────────────┼──────────────┼──────────────────┤
│              │              │              │                  │
│  PostgreSQL  │    Redis     │   Qdrant     │   AgentDB        │
│  Primary     │   Cluster    │   Cluster    │   Local DB       │
│     │        │      │       │      │       │                  │
│     ▼        │      ▼       │      ▼       │                  │
│  Read        │  Sentinel    │  Shards      │                  │
│  Replicas    │              │              │                  │
└──────────────┴──────────────┴──────────────┴──────────────────┘
```

### SLA Requirements

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| **RPO** | 1 hour | WAL archiving + incremental backups |
| **RTO** | 15 minutes | Hot standby + automated failover |
| **Availability** | 99.9% | Multi-AZ deployment |
| **Audit Retention** | 1 year | Partitioned audit_logs table |
| **Backup Retention** | 30 days | Automated S3/GCS backups |

---

## PostgreSQL Schema Design

### 1. Core Schema Structure

```sql
-- ============================================================================
-- DATABASE: llm_copilot_agent
-- VERSION: 1.0.0
-- DESCRIPTION: Primary transactional database for LLM-CoPilot-Agent
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'developer', 'operator', 'viewer');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE session_status AS ENUM ('active', 'idle', 'terminated', 'expired');
CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused');
CREATE TYPE execution_status AS ENUM ('queued', 'running', 'success', 'failed', 'timeout', 'cancelled');
CREATE TYPE incident_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE incident_status AS ENUM ('open', 'acknowledged', 'investigating', 'resolved', 'closed');
CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'execute', 'login', 'logout');

-- ============================================================================
-- 1. USERS AND AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL, -- bcrypt/argon2
    role user_role NOT NULL DEFAULT 'developer',
    status user_status NOT NULL DEFAULT 'pending',

    -- Profile
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',

    -- Security
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255), -- Encrypted TOTP secret
    api_key_hash VARCHAR(255), -- Hashed API key
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- Soft delete

    -- Constraints
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT chk_username_format CHECK (username ~* '^[a-z0-9_-]{3,100}$')
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_api_key ON users(api_key_hash) WHERE api_key_hash IS NOT NULL;

COMMENT ON TABLE users IS 'User accounts with authentication and authorization';
COMMENT ON COLUMN users.preferences IS 'User-specific settings: {theme, notifications, default_project}';

-- ============================================================================
-- 2. SESSIONS AND CONVERSATIONS
-- ============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session Management
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- Hashed JWT/session token
    refresh_token_hash VARCHAR(255) UNIQUE,
    status session_status NOT NULL DEFAULT 'active',

    -- Session Data
    ip_address INET NOT NULL,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),

    -- Context
    context JSONB DEFAULT '{}', -- Current workspace, project, etc.

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    terminated_at TIMESTAMPTZ,

    CONSTRAINT chk_expires_after_created CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash) WHERE status = 'active';
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE status IN ('active', 'idle');
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity_at) WHERE status = 'active';

COMMENT ON TABLE sessions IS 'User sessions with authentication tokens and context';
COMMENT ON COLUMN sessions.context IS 'Session context: {workspace_id, project_id, current_task}';

-- Conversations Table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Conversation Metadata
    title VARCHAR(500),
    description TEXT,
    tags TEXT[] DEFAULT '{}',

    -- Context and Memory
    context_snapshot JSONB DEFAULT '{}', -- Initial context
    system_prompt TEXT,
    model_config JSONB DEFAULT '{}', -- {model, temperature, max_tokens}

    -- Statistics
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0, -- Cost in cents

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_started_at ON conversations(started_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);
CREATE INDEX idx_conversations_archived ON conversations(archived_at) WHERE archived_at IS NOT NULL;

COMMENT ON TABLE conversations IS 'Conversation threads with context and metadata';
COMMENT ON COLUMN conversations.model_config IS 'LLM config: {model, temperature, max_tokens, top_p}';

-- Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Message Content
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system', 'tool'
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- 'text', 'code', 'markdown', 'json'

    -- Metadata
    model VARCHAR(100), -- Model used for assistant messages
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER, -- Response latency

    -- Tool/Function Calls
    tool_calls JSONB, -- Array of tool invocations
    tool_results JSONB, -- Results from tool executions

    -- Context
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    sequence_number INTEGER NOT NULL,

    -- Feedback
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comment TEXT,

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_role CHECK (role IN ('user', 'assistant', 'system', 'tool'))
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_sequence ON messages(conversation_id, sequence_number);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_parent ON messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON COLUMN messages.tool_calls IS 'Tool calls: [{name, arguments, id}]';
COMMENT ON COLUMN messages.tool_results IS 'Tool results: [{tool_call_id, result, error}]';

-- ============================================================================
-- 3. WORKFLOWS AND EXECUTIONS
-- ============================================================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Workflow Definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,

    -- Configuration
    definition JSONB NOT NULL, -- Workflow steps and logic
    parameters JSONB DEFAULT '{}', -- Default parameters
    environment_vars JSONB DEFAULT '{}', -- Encrypted environment variables

    -- Triggers
    triggers JSONB DEFAULT '[]', -- [{type: 'schedule|webhook|event', config}]

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_workflow_name_version UNIQUE (user_id, name, version)
);

CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_name ON workflows(name);
CREATE INDEX idx_workflows_tags ON workflows USING GIN(tags);
CREATE INDEX idx_workflows_active ON workflows(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_template ON workflows(is_template) WHERE is_template = TRUE;

COMMENT ON TABLE workflows IS 'Workflow definitions and configurations';
COMMENT ON COLUMN workflows.definition IS 'Workflow DAG: {steps: [{id, type, config, dependencies}]}';

-- Workflow Executions Table
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Execution Context
    status execution_status NOT NULL DEFAULT 'queued',
    parameters JSONB DEFAULT '{}', -- Runtime parameters
    environment JSONB DEFAULT '{}', -- Runtime environment

    -- Triggers
    trigger_type VARCHAR(50), -- 'manual', 'schedule', 'webhook', 'event'
    trigger_source JSONB, -- Details about what triggered this execution

    -- Progress Tracking
    current_step VARCHAR(255),
    completed_steps TEXT[] DEFAULT '{}',
    failed_steps TEXT[] DEFAULT '{}',

    -- Results
    outputs JSONB, -- Final workflow outputs
    error_message TEXT,
    error_stack TEXT,

    -- Performance
    total_duration_ms INTEGER,
    steps_executed INTEGER DEFAULT 0,

    -- Timing
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT chk_execution_timing CHECK (
        (started_at IS NULL OR started_at >= queued_at) AND
        (completed_at IS NULL OR completed_at >= started_at)
    )
);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_queued_at ON workflow_executions(queued_at DESC);
CREATE INDEX idx_workflow_executions_trigger_type ON workflow_executions(trigger_type);

COMMENT ON TABLE workflow_executions IS 'Individual workflow execution instances';

-- Step Executions Table
CREATE TABLE step_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,

    -- Step Details
    step_id VARCHAR(255) NOT NULL, -- From workflow definition
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(100) NOT NULL, -- 'test', 'deploy', 'query', 'webhook', etc.

    -- Execution
    status execution_status NOT NULL DEFAULT 'queued',
    inputs JSONB,
    outputs JSONB,

    -- Error Handling
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,

    -- Performance
    duration_ms INTEGER,

    -- Timing
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_step_executions_workflow_execution ON step_executions(workflow_execution_id);
CREATE INDEX idx_step_executions_status ON step_executions(status);
CREATE INDEX idx_step_executions_step_id ON step_executions(step_id);

COMMENT ON TABLE step_executions IS 'Individual step executions within workflows';

-- ============================================================================
-- 4. INCIDENTS AND RUNBOOKS
-- ============================================================================

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Classification
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity incident_severity NOT NULL,
    status incident_status NOT NULL DEFAULT 'open',

    -- Detection
    source VARCHAR(100) NOT NULL, -- 'monitoring', 'user_report', 'automated', 'alert'
    detection_method VARCHAR(100), -- 'anomaly_detection', 'threshold', 'pattern_match'

    -- Impact
    affected_services TEXT[] DEFAULT '{}',
    affected_users_count INTEGER DEFAULT 0,
    blast_radius JSONB, -- {regions: [], services: [], user_segments: []}

    -- Assignment
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_team VARCHAR(100),

    -- Context
    metadata JSONB DEFAULT '{}', -- Alert data, metrics, logs
    related_incidents UUID[], -- Array of related incident IDs

    -- Resolution
    root_cause TEXT,
    resolution_notes TEXT,
    remediation_steps TEXT[],

    -- Timing
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_incident_timing CHECK (
        (acknowledged_at IS NULL OR acknowledged_at >= detected_at) AND
        (resolved_at IS NULL OR resolved_at >= detected_at) AND
        (closed_at IS NULL OR closed_at >= resolved_at)
    )
);

CREATE INDEX idx_incidents_severity ON incidents(severity) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at DESC);
CREATE INDEX idx_incidents_assigned_to ON incidents(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_incidents_affected_services ON incidents USING GIN(affected_services);
CREATE INDEX idx_incidents_related ON incidents USING GIN(related_incidents);

COMMENT ON TABLE incidents IS 'Production incidents with detection and resolution tracking';

-- Runbooks Table
CREATE TABLE runbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Runbook Definition
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,

    -- Trigger Conditions
    trigger_conditions JSONB, -- {severity: [], services: [], patterns: []}

    -- Steps
    steps JSONB NOT NULL, -- [{step_num, title, action, automated, required_role}]

    -- Automation
    is_automated BOOLEAN DEFAULT FALSE,
    automation_config JSONB, -- Configuration for automated execution

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Usage Stats
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX idx_runbooks_name ON runbooks(name) WHERE archived_at IS NULL;
CREATE INDEX idx_runbooks_tags ON runbooks USING GIN(tags);
CREATE INDEX idx_runbooks_automated ON runbooks(is_automated) WHERE is_automated = TRUE;

COMMENT ON TABLE runbooks IS 'Incident response runbooks and playbooks';

-- Runbook Executions Table
CREATE TABLE runbook_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    runbook_id UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    executed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Execution
    status execution_status NOT NULL DEFAULT 'running',
    is_automated BOOLEAN DEFAULT FALSE,

    -- Progress
    current_step INTEGER,
    completed_steps INTEGER[] DEFAULT '{}',
    step_results JSONB DEFAULT '[]', -- [{step_num, status, output, duration_ms}]

    -- Results
    success BOOLEAN,
    notes TEXT,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_runbook_executions_runbook ON runbook_executions(runbook_id);
CREATE INDEX idx_runbook_executions_incident ON runbook_executions(incident_id);
CREATE INDEX idx_runbook_executions_started_at ON runbook_executions(started_at DESC);

COMMENT ON TABLE runbook_executions IS 'Runbook execution history and results';

-- ============================================================================
-- 5. AUDIT LOGS (PARTITIONED)
-- ============================================================================

CREATE TABLE audit_logs (
    id BIGSERIAL,

    -- Actor
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,

    -- Action
    action audit_action NOT NULL,
    resource_type VARCHAR(100) NOT NULL, -- 'user', 'workflow', 'incident', etc.
    resource_id UUID,

    -- Details
    description TEXT,
    changes JSONB, -- {before: {}, after: {}} for updates
    metadata JSONB DEFAULT '{}', -- IP, user agent, etc.

    -- Context
    ip_address INET,
    user_agent TEXT,

    -- Success/Failure
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for 1-year retention (monthly partitions)
-- These would be created by migration scripts
CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Create default partition for future data
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- Indexes on audit_logs (will be created on each partition)
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail with 1-year retention (partitioned monthly)';

-- ============================================================================
-- 6. TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_runbooks_updated_at BEFORE UPDATE ON runbooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation statistics
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        message_count = message_count + 1,
        total_tokens = total_tokens + COALESCE(NEW.tokens_used, 0),
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_stats_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    action_type audit_action;
    resource_type VARCHAR(100);
    changes_json JSONB;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'create';
        changes_json := jsonb_build_object('after', to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'update';
        changes_json := jsonb_build_object(
            'before', to_jsonb(OLD),
            'after', to_jsonb(NEW)
        );
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'delete';
        changes_json := jsonb_build_object('before', to_jsonb(OLD));
    END IF;

    -- Extract resource type from table name
    resource_type := TG_TABLE_NAME;

    -- Insert audit log
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        changes,
        success
    ) VALUES (
        COALESCE(NEW.user_id, OLD.user_id),
        action_type,
        resource_type,
        COALESCE(NEW.id, OLD.id),
        changes_json,
        TRUE
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables (optional, can be selective)
-- CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
--     FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- ============================================================================
-- 7. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active sessions view
CREATE VIEW active_sessions AS
SELECT
    s.id,
    s.user_id,
    u.email,
    u.username,
    s.status,
    s.ip_address,
    s.created_at,
    s.last_activity_at,
    s.expires_at,
    EXTRACT(EPOCH FROM (NOW() - s.last_activity_at)) AS idle_seconds
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'active'
  AND s.expires_at > NOW()
  AND u.deleted_at IS NULL;

-- Open incidents summary
CREATE VIEW open_incidents_summary AS
SELECT
    severity,
    COUNT(*) AS count,
    AVG(EXTRACT(EPOCH FROM (NOW() - detected_at))) AS avg_age_seconds,
    MAX(detected_at) AS most_recent,
    MIN(detected_at) AS oldest
FROM incidents
WHERE status NOT IN ('resolved', 'closed')
GROUP BY severity;

-- Workflow execution statistics
CREATE VIEW workflow_execution_stats AS
SELECT
    w.id AS workflow_id,
    w.name AS workflow_name,
    COUNT(we.id) AS total_executions,
    COUNT(CASE WHEN we.status = 'success' THEN 1 END) AS successful_executions,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) AS failed_executions,
    AVG(we.total_duration_ms) AS avg_duration_ms,
    MAX(we.completed_at) AS last_execution
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
WHERE w.deleted_at IS NULL
GROUP BY w.id, w.name;

-- ============================================================================
-- 8. PARTITIONING MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to create new audit_logs partition
CREATE OR REPLACE FUNCTION create_audit_logs_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'audit_logs_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
    );

    RAISE NOTICE 'Created partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old audit_logs partitions (for retention policy)
CREATE OR REPLACE FUNCTION drop_old_audit_logs_partitions(retention_months INTEGER DEFAULT 12)
RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := DATE_TRUNC('month', NOW() - (retention_months || ' months')::INTERVAL);

    FOR partition_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'audit_logs_%'
          AND tablename != 'audit_logs_default'
    LOOP
        -- Extract date from partition name and check if it's old
        IF TO_DATE(SUBSTRING(partition_record.tablename FROM 12), 'YYYY_MM') < cutoff_date THEN
            EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
            RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Analyze tables for query planning
ANALYZE users;
ANALYZE sessions;
ANALYZE conversations;
ANALYZE messages;
ANALYZE workflows;
ANALYZE workflow_executions;
ANALYZE step_executions;
ANALYZE incidents;
ANALYZE runbooks;
ANALYZE audit_logs;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO llm_copilot_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO llm_copilot_app;

```

### 2. Connection Pooling Configuration

```sql
-- PostgreSQL configuration for high-performance connection pooling
-- File: postgresql.conf

# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Connection Pooling (PgBouncer recommended)
# PgBouncer configuration:
# pool_mode = transaction
# max_client_conn = 1000
# default_pool_size = 25
# reserve_pool_size = 5
# reserve_pool_timeout = 3

# Memory Settings
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB

# WAL Settings (for RPO = 1 hour)
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
archive_timeout = 3600  # 1 hour

# Replication Settings (for RTO = 15 minutes)
max_wal_senders = 5
wal_keep_size = 1GB
hot_standby = on
hot_standby_feedback = on

# Performance
random_page_cost = 1.1  # SSD optimized
effective_io_concurrency = 200
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# Query Planning
default_statistics_target = 100

# Logging
log_min_duration_statement = 1000  # Log queries > 1s
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
```

---

## Redis Data Structures

### 1. Session Storage (Hash)

```redis
# Session storage using Redis Hash
# Key pattern: session:{session_id}
# TTL: 24 hours (86400 seconds)

# Session Hash Structure
HSET session:550e8400-e29b-41d4-a716-446655440000 \
    user_id "123e4567-e89b-12d3-a456-426614174000" \
    email "developer@example.com" \
    role "developer" \
    ip_address "192.168.1.100" \
    created_at "2025-11-25T10:00:00Z" \
    last_activity "2025-11-25T14:30:00Z" \
    context '{"workspace":"project-x","current_task":"deployment"}'

EXPIRE session:550e8400-e29b-41d4-a716-446655440000 86400

# Session lookup by token (String)
# Key pattern: session_token:{token_hash}
SET session_token:abc123...hash "550e8400-e29b-41d4-a716-446655440000" EX 86400

# Active sessions per user (Set)
# Key pattern: user_sessions:{user_id}
SADD user_sessions:123e4567-e89b-12d3-a456-426614174000 \
    "550e8400-e29b-41d4-a716-446655440000"
EXPIRE user_sessions:123e4567-e89b-12d3-a456-426614174000 86400
```

### 2. Rate Limiting (Sorted Set)

```redis
# Rate limiting using sliding window with Sorted Sets
# Key pattern: ratelimit:{resource}:{identifier}
# Score: timestamp (milliseconds)

# Example: API rate limiting (100 requests per minute)
# Add request with current timestamp
ZADD ratelimit:api:user:123e4567 1732537200000 "req:uuid1"

# Remove requests older than 1 minute
ZREMRANGEBYSCORE ratelimit:api:user:123e4567 0 1732537140000

# Count requests in the last minute
ZCARD ratelimit:api:user:123e4567

# If count < limit, allow request
# Set TTL to auto-cleanup
EXPIRE ratelimit:api:user:123e4567 60

# Rate limit configuration (Hash)
HSET ratelimit:config:api \
    window_seconds 60 \
    max_requests 100 \
    burst_allowance 20

# Token bucket rate limiting (alternative)
# Key pattern: ratelimit:bucket:{user_id}
# Use Hash with fields: tokens, last_refill
HSET ratelimit:bucket:123e4567 \
    tokens 95 \
    last_refill 1732537200000 \
    max_tokens 100 \
    refill_rate 10
```

### 3. Response Cache (String with TTL)

```redis
# Response caching for expensive queries
# Key pattern: cache:{type}:{hash}

# Cache LLM response
SET cache:llm:sha256:abc123... '{
    "prompt": "Explain rate limiting",
    "response": "Rate limiting is...",
    "model": "claude-sonnet-4.5",
    "tokens": 450,
    "cached_at": "2025-11-25T14:30:00Z"
}' EX 3600

# Cache database query result
SET cache:query:sha256:def456... '{
    "query": "SELECT * FROM workflows WHERE user_id = ?",
    "params": ["123e4567"],
    "result": [{...}],
    "cached_at": "2025-11-25T14:30:00Z"
}' EX 300

# Cache invalidation tags (Set)
# Key pattern: cache:tags:{tag}
SADD cache:tags:user:123e4567 \
    "cache:query:sha256:def456..." \
    "cache:llm:sha256:ghi789..."

# Invalidate all caches for a user
SMEMBERS cache:tags:user:123e4567
# Then DEL each cache key

# Cache statistics (Hash)
HINCRBY cache:stats:global hits 1
HINCRBY cache:stats:global misses 0
HINCRBYFLOAT cache:stats:global hit_rate 0.95
```

### 4. Real-time Metrics (Stream)

```redis
# Real-time metrics using Redis Streams
# Key pattern: metrics:{metric_name}

# Add metric entry
XADD metrics:api_latency * \
    endpoint "/api/workflows" \
    method "GET" \
    duration_ms 145 \
    status 200 \
    user_id "123e4567" \
    timestamp 1732537200000

# Add system metric
XADD metrics:system_health * \
    cpu_percent 45.2 \
    memory_percent 62.8 \
    disk_io_read 1200 \
    disk_io_write 450 \
    network_rx_bytes 1048576 \
    network_tx_bytes 524288 \
    timestamp 1732537200000

# Consumer group for metric processing
XGROUP CREATE metrics:api_latency analytics $ MKSTREAM
XREADGROUP GROUP analytics consumer1 COUNT 10 STREAMS metrics:api_latency >

# Aggregate metrics (Time Series - Redis Stack)
TS.CREATE metrics:api:latency:p95 RETENTION 86400 LABELS endpoint /api/workflows metric p95
TS.ADD metrics:api:latency:p95 * 145

# Trim old entries (keep last 10000)
XTRIM metrics:api_latency MAXLEN ~ 10000
```

### 5. Pub/Sub Channels

```redis
# Real-time event broadcasting

# Incident alerts channel
PUBLISH incidents:alerts '{
    "incident_id": "inc-123",
    "severity": "critical",
    "title": "High error rate detected",
    "affected_services": ["api", "worker"],
    "detected_at": "2025-11-25T14:30:00Z"
}'

# Workflow status updates
PUBLISH workflows:status:550e8400 '{
    "workflow_id": "550e8400",
    "execution_id": "exec-456",
    "status": "running",
    "current_step": "deploy",
    "progress": 0.65
}'

# System notifications
PUBLISH notifications:user:123e4567 '{
    "type": "workflow_completed",
    "title": "Deployment completed successfully",
    "workflow_id": "550e8400",
    "execution_id": "exec-456"
}'

# Presence tracking (Set with expiry)
# Online users
SETEX presence:online:123e4567 60 "1"
# Subscribe to presence updates
SUBSCRIBE presence:updates

# Distributed locks (for coordination)
SET lock:workflow:550e8400 "worker-1" NX PX 30000
# If SET returns OK, lock acquired
# If SET returns nil, lock held by another worker
```

### 6. Queue Management (List)

```redis
# Task queue using Redis Lists (FIFO)
# Key pattern: queue:{queue_name}

# Push task to queue (right side)
RPUSH queue:workflow_executions '{
    "workflow_id": "550e8400",
    "execution_id": "exec-456",
    "user_id": "123e4567",
    "priority": "normal",
    "queued_at": "2025-11-25T14:30:00Z"
}'

# Worker pops task from queue (left side, blocking)
BLPOP queue:workflow_executions 30

# Priority queue (Sorted Set)
# Key pattern: queue:priority:{queue_name}
# Score: negative timestamp (for FIFO within priority)

ZADD queue:priority:workflows \
    1000 '{"id":"exec-456","priority":"high"}' \
    2000 '{"id":"exec-789","priority":"medium"}' \
    3000 '{"id":"exec-012","priority":"low"}'

# Pop highest priority task
ZPOPMIN queue:priority:workflows 1

# Dead letter queue (for failed tasks)
RPUSH queue:workflow_executions:dlq '{
    "original_task": {...},
    "error": "Max retries exceeded",
    "failed_at": "2025-11-25T14:35:00Z",
    "retry_count": 3
}'

# Queue metrics
HSET queue:metrics:workflow_executions \
    pending 45 \
    processing 12 \
    completed 1523 \
    failed 23 \
    avg_processing_time_ms 2450
```

### 7. Circuit Breaker State (Hash)

```redis
# Circuit breaker for external services
# Key pattern: circuit_breaker:{service}

HSET circuit_breaker:llm_api \
    state "closed" \
    failure_count 0 \
    last_failure_time 0 \
    success_count 150 \
    last_success_time 1732537200000 \
    threshold 5 \
    timeout_seconds 60

# State transitions: closed -> open -> half_open -> closed
# On failure (when closed):
HINCRBY circuit_breaker:llm_api failure_count 1
HSET circuit_breaker:llm_api last_failure_time 1732537200000

# Check if should open
# If failure_count >= threshold: HSET state "open"

# On timeout (when open):
HSET circuit_breaker:llm_api state "half_open"

# On success (when half_open):
HSET circuit_breaker:llm_api state "closed" failure_count 0
```

---

## Vector Database (Qdrant)

### 1. Collection Schema

```rust
// Qdrant collection configuration for embeddings

use qdrant_client::{
    client::QdrantClient,
    qdrant::{
        vectors_config::Config, CreateCollection, Distance, VectorParams, VectorsConfig,
        SearchPoints, Filter, Condition, FieldCondition, Range, Match,
    },
};

// Collection schemas
pub async fn create_collections(client: &QdrantClient) -> Result<(), Box<dyn std::error::Error>> {

    // 1. Code Embeddings Collection
    client.create_collection(&CreateCollection {
        collection_name: "code_embeddings".to_string(),
        vectors_config: Some(VectorsConfig {
            config: Some(Config::Params(VectorParams {
                size: 1536, // OpenAI ada-002 or equivalent
                distance: Distance::Cosine as i32,
                hnsw_config: None, // Use defaults
                quantization_config: None,
                on_disk: Some(false), // Keep in memory for speed
            })),
        }),
        ..Default::default()
    }).await?;

    // 2. Documentation Embeddings Collection
    client.create_collection(&CreateCollection {
        collection_name: "documentation_embeddings".to_string(),
        vectors_config: Some(VectorsConfig {
            config: Some(Config::Params(VectorParams {
                size: 1536,
                distance: Distance::Cosine as i32,
                hnsw_config: None,
                quantization_config: None,
                on_disk: Some(false),
            })),
        }),
        ..Default::default()
    }).await?;

    // 3. Conversation History Embeddings
    client.create_collection(&CreateCollection {
        collection_name: "conversation_embeddings".to_string(),
        vectors_config: Some(VectorsConfig {
            config: Some(Config::Params(VectorParams {
                size: 1536,
                distance: Distance::Cosine as i32,
                hnsw_config: None,
                quantization_config: None,
                on_disk: Some(true), // Can be on disk (accessed less frequently)
            })),
        }),
        ..Default::default()
    }).await?;

    // 4. Incident Knowledge Base
    client.create_collection(&CreateCollection {
        collection_name: "incident_knowledge".to_string(),
        vectors_config: Some(VectorsConfig {
            config: Some(Config::Params(VectorParams {
                size: 1536,
                distance: Distance::Cosine as i32,
                hnsw_config: None,
                quantization_config: None,
                on_disk: Some(false),
            })),
        }),
        ..Default::default()
    }).await?;

    Ok(())
}
```

### 2. Point Structure and Metadata

```rust
use qdrant_client::qdrant::{PointStruct, Value, Payload};
use serde_json::json;
use uuid::Uuid;

// Code embedding point
pub fn create_code_point(
    id: Uuid,
    embedding: Vec<f32>,
    file_path: &str,
    function_name: &str,
    language: &str,
    project_id: &str,
) -> PointStruct {
    let mut payload = Payload::new();
    payload.insert("file_path", file_path.into());
    payload.insert("function_name", function_name.into());
    payload.insert("language", language.into());
    payload.insert("project_id", project_id.into());
    payload.insert("indexed_at", chrono::Utc::now().to_rfc3339().into());

    PointStruct {
        id: Some(id.to_string().into()),
        vectors: Some(embedding.into()),
        payload,
    }
}

// Conversation embedding point
pub fn create_conversation_point(
    id: Uuid,
    embedding: Vec<f32>,
    conversation_id: Uuid,
    message_id: Uuid,
    user_id: Uuid,
    content: &str,
    timestamp: chrono::DateTime<chrono::Utc>,
) -> PointStruct {
    let mut payload = Payload::new();
    payload.insert("conversation_id", conversation_id.to_string().into());
    payload.insert("message_id", message_id.to_string().into());
    payload.insert("user_id", user_id.to_string().into());
    payload.insert("content_preview", content.chars().take(200).collect::<String>().into());
    payload.insert("timestamp", timestamp.to_rfc3339().into());
    payload.insert("char_count", (content.len() as i64).into());

    PointStruct {
        id: Some(id.to_string().into()),
        vectors: Some(embedding.into()),
        payload,
    }
}

// Incident knowledge point
pub fn create_incident_point(
    id: Uuid,
    embedding: Vec<f32>,
    incident_id: Uuid,
    title: &str,
    severity: &str,
    services: Vec<String>,
    resolution: &str,
) -> PointStruct {
    let mut payload = Payload::new();
    payload.insert("incident_id", incident_id.to_string().into());
    payload.insert("title", title.into());
    payload.insert("severity", severity.into());
    payload.insert("services", services.into());
    payload.insert("resolution_preview", resolution.chars().take(500).collect::<String>().into());
    payload.insert("indexed_at", chrono::Utc::now().to_rfc3339().into());

    PointStruct {
        id: Some(id.to_string().into()),
        vectors: Some(embedding.into()),
        payload,
    }
}
```

### 3. Search and Filtering

```rust
use qdrant_client::qdrant::{SearchPoints, Filter, Condition, FieldCondition, Match};

// Search code with filters
pub async fn search_code_semantically(
    client: &QdrantClient,
    query_embedding: Vec<f32>,
    project_id: &str,
    language: Option<&str>,
    limit: u64,
) -> Result<Vec<qdrant_client::qdrant::ScoredPoint>, Box<dyn std::error::Error>> {

    let mut must_conditions = vec![
        Condition::field(FieldCondition {
            key: "project_id".to_string(),
            r#match: Some(Match {
                match_value: Some(project_id.into()),
            }),
            ..Default::default()
        }),
    ];

    if let Some(lang) = language {
        must_conditions.push(Condition::field(FieldCondition {
            key: "language".to_string(),
            r#match: Some(Match {
                match_value: Some(lang.into()),
            }),
            ..Default::default()
        }));
    }

    let search_points = SearchPoints {
        collection_name: "code_embeddings".to_string(),
        vector: query_embedding,
        limit,
        with_payload: Some(true.into()),
        filter: Some(Filter {
            must: must_conditions,
            ..Default::default()
        }),
        ..Default::default()
    };

    let response = client.search_points(&search_points).await?;
    Ok(response.result)
}

// Search similar incidents
pub async fn search_similar_incidents(
    client: &QdrantClient,
    query_embedding: Vec<f32>,
    severity_filter: Option<Vec<&str>>,
    service_filter: Option<&str>,
    limit: u64,
) -> Result<Vec<qdrant_client::qdrant::ScoredPoint>, Box<dyn std::error::Error>> {

    let mut must_conditions = Vec::new();

    if let Some(severities) = severity_filter {
        must_conditions.push(Condition::field(FieldCondition {
            key: "severity".to_string(),
            r#match: Some(Match {
                match_value: Some(severities[0].into()), // Simplified - use proper multi-match
            }),
            ..Default::default()
        }));
    }

    let search_points = SearchPoints {
        collection_name: "incident_knowledge".to_string(),
        vector: query_embedding,
        limit,
        with_payload: Some(true.into()),
        filter: Some(Filter {
            must: must_conditions,
            ..Default::default()
        }),
        score_threshold: Some(0.7), // Only return high-confidence matches
        ..Default::default()
    };

    let response = client.search_points(&search_points).await?;
    Ok(response.result)
}

// Hybrid search (combining vector similarity with full-text)
pub async fn hybrid_search_documentation(
    client: &QdrantClient,
    query_embedding: Vec<f32>,
    keywords: Vec<&str>,
    limit: u64,
) -> Result<Vec<qdrant_client::qdrant::ScoredPoint>, Box<dyn std::error::Error>> {

    // In production, combine vector search with keyword matching
    // This is a simplified example

    let search_points = SearchPoints {
        collection_name: "documentation_embeddings".to_string(),
        vector: query_embedding,
        limit,
        with_payload: Some(true.into()),
        ..Default::default()
    };

    let response = client.search_points(&search_points).await?;
    Ok(response.result)
}
```

### 4. Indexing Configuration

```rust
// Qdrant HNSW index configuration for optimal performance

use qdrant_client::qdrant::{HnswConfigDiff, OptimizersConfigDiff, UpdateCollection};

pub async fn optimize_collection_indexes(
    client: &QdrantClient,
    collection_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {

    client.update_collection(&UpdateCollection {
        collection_name: collection_name.to_string(),
        optimizers_config: Some(OptimizersConfigDiff {
            deleted_threshold: Some(0.2), // Trigger optimization when 20% deleted
            vacuum_min_vector_number: Some(1000),
            default_segment_number: Some(2),
            max_segment_size: Some(200_000), // 200K vectors per segment
            memmap_threshold: Some(50_000), // Use memory mapping for large segments
            indexing_threshold: Some(20_000), // Start indexing after 20K vectors
            flush_interval_sec: Some(5), // Flush to disk every 5 seconds
            max_optimization_threads: Some(4),
        }),
        hnsw_config: Some(HnswConfigDiff {
            m: Some(16), // Number of edges per node (higher = better recall, more memory)
            ef_construct: Some(100), // Quality of index construction (higher = better quality, slower)
            full_scan_threshold: Some(10_000), // Use full scan for small collections
            max_indexing_threads: Some(0), // 0 = use all available CPUs
            on_disk: Some(false), // Keep index in memory
            payload_m: Some(16), // Payload index parameter
        }),
        ..Default::default()
    }).await?;

    Ok(())
}

// Create index for payload fields (for filtering)
use qdrant_client::qdrant::{CreateFieldIndexCollection, FieldType};

pub async fn create_payload_indexes(
    client: &QdrantClient,
    collection_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {

    // Index project_id for fast filtering
    client.create_field_index(&CreateFieldIndexCollection {
        collection_name: collection_name.to_string(),
        field_name: "project_id".to_string(),
        field_type: Some(FieldType::Keyword as i32),
        ..Default::default()
    }).await?;

    // Index severity for incidents
    if collection_name == "incident_knowledge" {
        client.create_field_index(&CreateFieldIndexCollection {
            collection_name: collection_name.to_string(),
            field_name: "severity".to_string(),
            field_type: Some(FieldType::Keyword as i32),
            ..Default::default()
        }).await?;
    }

    // Index timestamp for time-based filtering
    client.create_field_index(&CreateFieldIndexCollection {
        collection_name: collection_name.to_string(),
        field_name: "timestamp".to_string(),
        field_type: Some(FieldType::Integer as i32),
        ..Default::default()
    }).await?;

    Ok(())
}
```

---

## Data Access Patterns

### 1. Repository Pattern Implementation

```rust
// Repository pattern for clean data access abstraction

use async_trait::async_trait;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

// ============================================================================
// Domain Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub full_name: Option<String>,
    pub role: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub username: String,
    pub full_name: Option<String>,
    pub password: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Workflow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub version: i32,
    pub definition: serde_json::Value,
    pub parameters: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WorkflowExecution {
    pub id: Uuid,
    pub workflow_id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub parameters: serde_json::Value,
    pub current_step: Option<String>,
    pub outputs: Option<serde_json::Value>,
    pub queued_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ============================================================================
// Repository Traits
// ============================================================================

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn create(&self, req: CreateUserRequest) -> Result<User, sqlx::Error>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, sqlx::Error>;
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, sqlx::Error>;
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, sqlx::Error>;
    async fn update(&self, id: Uuid, user: User) -> Result<User, sqlx::Error>;
    async fn delete(&self, id: Uuid) -> Result<(), sqlx::Error>;
    async fn list(&self, limit: i64, offset: i64) -> Result<Vec<User>, sqlx::Error>;
}

#[async_trait]
pub trait WorkflowRepository: Send + Sync {
    async fn create(&self, workflow: Workflow) -> Result<Workflow, sqlx::Error>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Workflow>, sqlx::Error>;
    async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<Workflow>, sqlx::Error>;
    async fn update(&self, id: Uuid, workflow: Workflow) -> Result<Workflow, sqlx::Error>;
    async fn delete(&self, id: Uuid) -> Result<(), sqlx::Error>;
}

#[async_trait]
pub trait WorkflowExecutionRepository: Send + Sync {
    async fn create(&self, execution: WorkflowExecution) -> Result<WorkflowExecution, sqlx::Error>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<WorkflowExecution>, sqlx::Error>;
    async fn update_status(&self, id: Uuid, status: &str) -> Result<(), sqlx::Error>;
    async fn list_by_workflow(&self, workflow_id: Uuid, limit: i64) -> Result<Vec<WorkflowExecution>, sqlx::Error>;
}

// ============================================================================
// PostgreSQL Implementations
// ============================================================================

pub struct PgUserRepository {
    pool: PgPool,
}

impl PgUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PgUserRepository {
    async fn create(&self, req: CreateUserRequest) -> Result<User, sqlx::Error> {
        let password_hash = hash_password(&req.password); // Implement with bcrypt/argon2

        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (email, username, full_name, password_hash, role, status)
            VALUES ($1, $2, $3, $4, $5, 'active')
            RETURNING id, email, username, full_name, role, status, created_at, updated_at
            "#
        )
        .bind(&req.email)
        .bind(&req.username)
        .bind(&req.full_name)
        .bind(&password_hash)
        .bind(&req.role)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, username, full_name, role, status, created_at, updated_at
            FROM users
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn find_by_email(&self, email: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, username, full_name, role, status, created_at, updated_at
            FROM users
            WHERE email = $1 AND deleted_at IS NULL
            "#
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<User>, sqlx::Error> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, username, full_name, role, status, created_at, updated_at
            FROM users
            WHERE username = $1 AND deleted_at IS NULL
            "#
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn update(&self, id: Uuid, user: User) -> Result<User, sqlx::Error> {
        let updated = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET email = $2, username = $3, full_name = $4, role = $5, status = $6
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, email, username, full_name, role, status, created_at, updated_at
            "#
        )
        .bind(id)
        .bind(&user.email)
        .bind(&user.username)
        .bind(&user.full_name)
        .bind(&user.role)
        .bind(&user.status)
        .fetch_one(&self.pool)
        .await?;

        Ok(updated)
    }

    async fn delete(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE users SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn list(&self, limit: i64, offset: i64) -> Result<Vec<User>, sqlx::Error> {
        let users = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, username, full_name, role, status, created_at, updated_at
            FROM users
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(users)
    }
}

pub struct PgWorkflowExecutionRepository {
    pool: PgPool,
}

impl PgWorkflowExecutionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl WorkflowExecutionRepository for PgWorkflowExecutionRepository {
    async fn create(&self, execution: WorkflowExecution) -> Result<WorkflowExecution, sqlx::Error> {
        let created = sqlx::query_as::<_, WorkflowExecution>(
            r#"
            INSERT INTO workflow_executions
            (workflow_id, user_id, status, parameters, environment, trigger_type)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, workflow_id, user_id, status, parameters, current_step, outputs,
                      queued_at, started_at, completed_at
            "#
        )
        .bind(&execution.workflow_id)
        .bind(&execution.user_id)
        .bind(&execution.status)
        .bind(&execution.parameters)
        .bind(&serde_json::json!({})) // environment
        .bind("manual") // trigger_type
        .fetch_one(&self.pool)
        .await?;

        Ok(created)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<WorkflowExecution>, sqlx::Error> {
        let execution = sqlx::query_as::<_, WorkflowExecution>(
            r#"
            SELECT id, workflow_id, user_id, status, parameters, current_step, outputs,
                   queued_at, started_at, completed_at
            FROM workflow_executions
            WHERE id = $1
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(execution)
    }

    async fn update_status(&self, id: Uuid, status: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE workflow_executions
            SET status = $2,
                started_at = CASE WHEN $2 = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
                completed_at = CASE WHEN $2 IN ('success', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
            WHERE id = $1
            "#
        )
        .bind(id)
        .bind(status)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn list_by_workflow(&self, workflow_id: Uuid, limit: i64) -> Result<Vec<WorkflowExecution>, sqlx::Error> {
        let executions = sqlx::query_as::<_, WorkflowExecution>(
            r#"
            SELECT id, workflow_id, user_id, status, parameters, current_step, outputs,
                   queued_at, started_at, completed_at
            FROM workflow_executions
            WHERE workflow_id = $1
            ORDER BY queued_at DESC
            LIMIT $2
            "#
        )
        .bind(workflow_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(executions)
    }
}

// Placeholder for password hashing (implement with bcrypt/argon2)
fn hash_password(password: &str) -> String {
    // Use bcrypt or argon2 in production
    format!("hashed_{}", password)
}

// ============================================================================
// Transaction Support
// ============================================================================

pub struct UnitOfWork<'a> {
    tx: Transaction<'a, Postgres>,
}

impl<'a> UnitOfWork<'a> {
    pub async fn begin(pool: &'a PgPool) -> Result<Self, sqlx::Error> {
        let tx = pool.begin().await?;
        Ok(Self { tx })
    }

    pub async fn commit(self) -> Result<(), sqlx::Error> {
        self.tx.commit().await
    }

    pub async fn rollback(self) -> Result<(), sqlx::Error> {
        self.tx.rollback().await
    }

    // Example: Complex transaction
    pub async fn create_workflow_with_execution(
        mut self,
        workflow: Workflow,
        execution_params: serde_json::Value,
    ) -> Result<(Workflow, WorkflowExecution), sqlx::Error> {
        // Insert workflow
        let workflow = sqlx::query_as::<_, Workflow>(
            "INSERT INTO workflows (user_id, name, description, definition, parameters)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *"
        )
        .bind(&workflow.user_id)
        .bind(&workflow.name)
        .bind(&workflow.description)
        .bind(&workflow.definition)
        .bind(&workflow.parameters)
        .fetch_one(&mut *self.tx)
        .await?;

        // Create execution
        let execution = sqlx::query_as::<_, WorkflowExecution>(
            "INSERT INTO workflow_executions (workflow_id, user_id, parameters, status)
             VALUES ($1, $2, $3, 'queued')
             RETURNING *"
        )
        .bind(&workflow.id)
        .bind(&workflow.user_id)
        .bind(&execution_params)
        .fetch_one(&mut *self.tx)
        .await?;

        Ok((workflow, execution))
    }
}
```

### 2. Connection Pooling Configuration

```rust
// Connection pool configuration for PostgreSQL, Redis, and Qdrant

use sqlx::postgres::{PgPoolOptions, PgConnectOptions};
use redis::aio::ConnectionManager;
use qdrant_client::client::QdrantClient;
use std::time::Duration;

// ============================================================================
// PostgreSQL Connection Pool
// ============================================================================

pub async fn create_pg_pool(database_url: &str) -> Result<sqlx::PgPool, sqlx::Error> {
    let connect_options = database_url
        .parse::<PgConnectOptions>()?
        .application_name("llm_copilot_agent")
        .statement_cache_capacity(100);

    let pool = PgPoolOptions::new()
        .max_connections(50) // Maximum connections in pool
        .min_connections(5)  // Minimum idle connections
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(600)) // 10 minutes
        .max_lifetime(Duration::from_secs(1800)) // 30 minutes
        .test_before_acquire(true) // Test connection health before use
        .connect_with(connect_options)
        .await?;

    Ok(pool)
}

// Read replica configuration
pub struct DatabasePools {
    pub primary: sqlx::PgPool,
    pub replica: Option<sqlx::PgPool>,
}

impl DatabasePools {
    pub async fn new(
        primary_url: &str,
        replica_url: Option<&str>,
    ) -> Result<Self, sqlx::Error> {
        let primary = create_pg_pool(primary_url).await?;

        let replica = if let Some(url) = replica_url {
            Some(create_pg_pool(url).await?)
        } else {
            None
        };

        Ok(Self { primary, replica })
    }

    // Route read queries to replica if available
    pub fn read_pool(&self) -> &sqlx::PgPool {
        self.replica.as_ref().unwrap_or(&self.primary)
    }

    // Write queries always go to primary
    pub fn write_pool(&self) -> &sqlx::PgPool {
        &self.primary
    }
}

// ============================================================================
// Redis Connection Pool
// ============================================================================

pub async fn create_redis_client(redis_url: &str) -> Result<ConnectionManager, redis::RedisError> {
    let client = redis::Client::open(redis_url)?;
    let manager = ConnectionManager::new(client).await?;
    Ok(manager)
}

// Redis cluster configuration
pub struct RedisCluster {
    primary: ConnectionManager,
    // For Redis Sentinel or Cluster, use redis::cluster::ClusterClient
}

impl RedisCluster {
    pub async fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let primary = create_redis_client(redis_url).await?;
        Ok(Self { primary })
    }

    pub fn connection(&self) -> &ConnectionManager {
        &self.primary
    }
}

// ============================================================================
// Qdrant Connection
// ============================================================================

pub async fn create_qdrant_client(url: &str, api_key: Option<String>) -> Result<QdrantClient, Box<dyn std::error::Error>> {
    let mut client = QdrantClient::from_url(url).build()?;

    if let Some(key) = api_key {
        client = client.with_api_key(key);
    }

    Ok(client)
}

// ============================================================================
// Application State with All Connections
// ============================================================================

pub struct AppState {
    pub db: DatabasePools,
    pub redis: RedisCluster,
    pub qdrant: QdrantClient,
}

impl AppState {
    pub async fn new(
        pg_primary_url: &str,
        pg_replica_url: Option<&str>,
        redis_url: &str,
        qdrant_url: &str,
        qdrant_api_key: Option<String>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let db = DatabasePools::new(pg_primary_url, pg_replica_url).await?;
        let redis = RedisCluster::new(redis_url).await?;
        let qdrant = create_qdrant_client(qdrant_url, qdrant_api_key).await?;

        Ok(Self { db, redis, qdrant })
    }
}
```

### 3. Cache-Aside Pattern Implementation

```rust
// Cache-aside pattern with Redis

use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::marker::PhantomData;

pub struct CacheAsideRepository<T, R> {
    cache: redis::aio::ConnectionManager,
    repository: R,
    ttl_seconds: usize,
    _phantom: PhantomData<T>,
}

impl<T, R> CacheAsideRepository<T, R>
where
    T: Serialize + DeserializeOwned + Clone,
    R: Send + Sync,
{
    pub fn new(cache: redis::aio::ConnectionManager, repository: R, ttl_seconds: usize) -> Self {
        Self {
            cache,
            repository,
            ttl_seconds,
            _phantom: PhantomData,
        }
    }

    async fn get_from_cache(&mut self, key: &str) -> Result<Option<T>, redis::RedisError> {
        let cached: Option<String> = self.cache.get(key).await?;

        if let Some(json) = cached {
            match serde_json::from_str(&json) {
                Ok(value) => Ok(Some(value)),
                Err(_) => Ok(None),
            }
        } else {
            Ok(None)
        }
    }

    async fn set_in_cache(&mut self, key: &str, value: &T) -> Result<(), redis::RedisError> {
        let json = serde_json::to_string(value).map_err(|e| {
            redis::RedisError::from((redis::ErrorKind::TypeError, "Serialization error", e.to_string()))
        })?;

        self.cache.set_ex(key, json, self.ttl_seconds).await?;
        Ok(())
    }

    async fn invalidate(&mut self, key: &str) -> Result<(), redis::RedisError> {
        self.cache.del(key).await?;
        Ok(())
    }
}

// Specific implementation for User repository
impl CacheAsideRepository<User, PgUserRepository> {
    pub async fn find_user_by_id(&mut self, id: Uuid) -> Result<Option<User>, Box<dyn std::error::Error>> {
        let cache_key = format!("user:id:{}", id);

        // 1. Try cache first
        if let Some(user) = self.get_from_cache(&cache_key).await? {
            return Ok(Some(user));
        }

        // 2. Cache miss - query database
        if let Some(user) = self.repository.find_by_id(id).await? {
            // 3. Update cache
            self.set_in_cache(&cache_key, &user).await?;
            Ok(Some(user))
        } else {
            Ok(None)
        }
    }

    pub async fn update_user(&mut self, id: Uuid, user: User) -> Result<User, Box<dyn std::error::Error>> {
        // 1. Update database
        let updated = self.repository.update(id, user).await?;

        // 2. Invalidate cache
        let cache_key = format!("user:id:{}", id);
        self.invalidate(&cache_key).await?;

        // 3. Optionally warm cache
        self.set_in_cache(&cache_key, &updated).await?;

        Ok(updated)
    }
}

// Write-through cache pattern (alternative)
pub struct WriteThroughCache<T, R> {
    cache: redis::aio::ConnectionManager,
    repository: R,
    ttl_seconds: usize,
    _phantom: PhantomData<T>,
}

impl<T, R> WriteThroughCache<T, R>
where
    T: Serialize + DeserializeOwned + Clone,
{
    pub fn new(cache: redis::aio::ConnectionManager, repository: R, ttl_seconds: usize) -> Self {
        Self {
            cache,
            repository,
            ttl_seconds,
            _phantom: PhantomData,
        }
    }

    async fn write_through(&mut self, key: &str, value: &T) -> Result<(), Box<dyn std::error::Error>> {
        let json = serde_json::to_string(value)?;
        self.cache.set_ex(key, json, self.ttl_seconds).await?;
        Ok(())
    }
}
```

### 4. Read Replica Routing

```rust
// Intelligent read/write splitting

use sqlx::PgPool;

pub enum QueryType {
    Read,
    Write,
}

pub struct QueryRouter {
    pools: DatabasePools,
}

impl QueryRouter {
    pub fn new(pools: DatabasePools) -> Self {
        Self { pools }
    }

    pub fn route(&self, query_type: QueryType) -> &PgPool {
        match query_type {
            QueryType::Read => self.pools.read_pool(),
            QueryType::Write => self.pools.write_pool(),
        }
    }

    // Automatic routing based on SQL statement
    pub fn route_auto(&self, sql: &str) -> &PgPool {
        let sql_upper = sql.trim().to_uppercase();

        if sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH") {
            // Read queries go to replica
            self.pools.read_pool()
        } else {
            // Write queries (INSERT, UPDATE, DELETE) go to primary
            self.pools.write_pool()
        }
    }
}

// Usage in repositories
pub struct SmartUserRepository {
    router: QueryRouter,
}

impl SmartUserRepository {
    pub fn new(router: QueryRouter) -> Self {
        Self { router }
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, sqlx::Error> {
        let pool = self.router.route(QueryType::Read);

        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn create(&self, req: CreateUserRequest) -> Result<User, sqlx::Error> {
        let pool = self.router.route(QueryType::Write);

        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (email, username, full_name, password_hash, role)
             VALUES ($1, $2, $3, $4, $5) RETURNING *"
        )
        .bind(&req.email)
        .bind(&req.username)
        .bind(&req.full_name)
        .bind(hash_password(&req.password))
        .bind(&req.role)
        .fetch_one(pool)
        .await?;

        Ok(user)
    }
}
```

---

## Data Migration Strategy

### 1. Schema Versioning

```sql
-- Schema migrations table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT TRUE
);

-- Track migration status
CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);
```

### 2. Migration Scripts

```rust
// Migration framework using sqlx-cli or custom implementation

use sqlx::PgPool;
use std::fs;
use std::path::Path;

pub struct MigrationManager {
    pool: PgPool,
    migrations_dir: String,
}

impl MigrationManager {
    pub fn new(pool: PgPool, migrations_dir: String) -> Self {
        Self { pool, migrations_dir }
    }

    pub async fn run_migrations(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Ensure migrations table exists
        self.create_migrations_table().await?;

        // Get list of migration files
        let migrations = self.get_pending_migrations().await?;

        for migration in migrations {
            println!("Applying migration: {}", migration.name);

            let start = std::time::Instant::now();

            match self.apply_migration(&migration).await {
                Ok(_) => {
                    let duration = start.elapsed().as_millis() as i32;
                    self.record_migration(&migration, duration, true).await?;
                    println!("✓ Migration {} applied successfully ({} ms)", migration.name, duration);
                }
                Err(e) => {
                    self.record_migration(&migration, 0, false).await?;
                    return Err(format!("Migration {} failed: {}", migration.name, e).into());
                }
            }
        }

        Ok(())
    }

    async fn create_migrations_table(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version BIGINT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                checksum VARCHAR(64) NOT NULL,
                execution_time_ms INTEGER,
                success BOOLEAN NOT NULL DEFAULT TRUE
            )"
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_pending_migrations(&self) -> Result<Vec<Migration>, Box<dyn std::error::Error>> {
        // Read migration files from directory
        let mut migrations = Vec::new();

        for entry in fs::read_dir(&self.migrations_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("sql") {
                let filename = path.file_name().unwrap().to_str().unwrap();
                let version = self.extract_version(filename)?;

                // Check if already applied
                let applied = self.is_migration_applied(version).await?;

                if !applied {
                    let sql = fs::read_to_string(&path)?;
                    let checksum = self.calculate_checksum(&sql);

                    migrations.push(Migration {
                        version,
                        name: filename.to_string(),
                        sql,
                        checksum,
                    });
                }
            }
        }

        // Sort by version
        migrations.sort_by_key(|m| m.version);

        Ok(migrations)
    }

    async fn apply_migration(&self, migration: &Migration) -> Result<(), sqlx::Error> {
        // Execute migration in a transaction
        let mut tx = self.pool.begin().await?;

        sqlx::raw_sql(&migration.sql)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(())
    }

    async fn record_migration(
        &self,
        migration: &Migration,
        execution_time_ms: i32,
        success: bool,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO schema_migrations (version, name, checksum, execution_time_ms, success)
             VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(migration.version)
        .bind(&migration.name)
        .bind(&migration.checksum)
        .bind(execution_time_ms)
        .bind(success)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn is_migration_applied(&self, version: i64) -> Result<bool, sqlx::Error> {
        let result: Option<(bool,)> = sqlx::query_as(
            "SELECT success FROM schema_migrations WHERE version = $1"
        )
        .bind(version)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|(success,)| success).unwrap_or(false))
    }

    fn extract_version(&self, filename: &str) -> Result<i64, Box<dyn std::error::Error>> {
        // Format: V001_create_users_table.sql
        let parts: Vec<&str> = filename.split('_').collect();
        if parts.is_empty() {
            return Err("Invalid migration filename format".into());
        }

        let version_str = parts[0].trim_start_matches('V');
        let version = version_str.parse::<i64>()?;

        Ok(version)
    }

    fn calculate_checksum(&self, content: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

struct Migration {
    version: i64,
    name: String,
    sql: String,
    checksum: String,
}
```

### 3. Zero-Downtime Migration Example

```sql
-- Example: Adding a new column with zero downtime
-- V002_add_avatar_url_to_users.sql

-- Step 1: Add column as nullable (no table lock)
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Step 2: Create index concurrently (no blocking)
CREATE INDEX CONCURRENTLY idx_users_avatar_url ON users(avatar_url)
WHERE avatar_url IS NOT NULL;

-- Step 3: Update existing rows in batches (if needed)
-- This would be done in application code to avoid long transactions

-- Step 4: (Optional) Add constraint later if needed
-- ALTER TABLE users ALTER COLUMN avatar_url SET NOT NULL;

-- Migration is complete - application can be updated to use new column
```

### 4. Rollback Procedures

```sql
-- Rollback migrations table
CREATE TABLE IF NOT EXISTS schema_rollbacks (
    version BIGINT PRIMARY KEY,
    rollback_sql TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example rollback script
-- R002_rollback_avatar_url.sql
DROP INDEX CONCURRENTLY IF EXISTS idx_users_avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
```

```rust
// Rollback implementation
impl MigrationManager {
    pub async fn rollback_migration(&self, version: i64) -> Result<(), Box<dyn std::error::Error>> {
        // Find rollback script
        let rollback_path = format!("{}/R{:03}_rollback.sql", self.migrations_dir, version);

        if !Path::new(&rollback_path).exists() {
            return Err(format!("Rollback script not found for version {}", version).into());
        }

        let rollback_sql = fs::read_to_string(&rollback_path)?;

        println!("Rolling back migration version {}...", version);

        // Execute rollback in transaction
        let mut tx = self.pool.begin().await?;

        sqlx::raw_sql(&rollback_sql)
            .execute(&mut *tx)
            .await?;

        // Remove from migrations table
        sqlx::query("DELETE FROM schema_migrations WHERE version = $1")
            .bind(version)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        println!("✓ Migration version {} rolled back successfully", version);

        Ok(())
    }
}
```

---

## Backup and Recovery

### 1. Backup Schedule and Retention

```bash
#!/bin/bash
# PostgreSQL backup script with retention policy
# File: /scripts/backup_postgres.sh

set -e

# Configuration
DB_NAME="llm_copilot_agent"
DB_USER="postgres"
BACKUP_DIR="/backup/postgresql"
S3_BUCKET="s3://llm-copilot-backups/postgresql"
RETENTION_DAYS=30

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y%m%d)

# Backup filenames
FULL_BACKUP="${BACKUP_DIR}/full_${DB_NAME}_${TIMESTAMP}.sql.gz"
WAL_ARCHIVE="${BACKUP_DIR}/wal_${DATE}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"
mkdir -p "${WAL_ARCHIVE}"

echo "[$(date)] Starting PostgreSQL backup..."

# Full backup (compressed)
pg_dump -U "${DB_USER}" -Fc "${DB_NAME}" | gzip > "${FULL_BACKUP}"

# Verify backup
if [ -f "${FULL_BACKUP}" ]; then
    SIZE=$(du -h "${FULL_BACKUP}" | cut -f1)
    echo "[$(date)] Full backup completed: ${FULL_BACKUP} (${SIZE})"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

# Archive WAL files
pg_archivecleanup "${WAL_ARCHIVE}" $(pg_controldata | grep 'Latest checkpoint' | awk '{print $4}')

# Upload to S3 (encrypted)
aws s3 cp "${FULL_BACKUP}" "${S3_BUCKET}/$(date +%Y/%m)/" \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256

# Upload WAL archive
aws s3 sync "${WAL_ARCHIVE}" "${S3_BUCKET}/wal/$(date +%Y/%m)/" \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256

# Retention policy: Delete backups older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "full_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Delete old S3 backups (using lifecycle policy is preferred)
# aws s3 ls "${S3_BUCKET}/" --recursive | awk '{print $4}' | ...

echo "[$(date)] Backup process completed successfully"

# Incremental backup (using pg_basebackup for streaming replication)
# pg_basebackup -U replication_user -D /backup/basebackup -Fp -Xs -P

# Schedule via cron:
# # Full backup daily at 2 AM
# 0 2 * * * /scripts/backup_postgres.sh >> /var/log/postgres_backup.log 2>&1
#
# # WAL archiving (continuous)
# */5 * * * * /scripts/archive_wal.sh >> /var/log/wal_archive.log 2>&1
```

### 2. Point-in-Time Recovery (PITR)

```bash
#!/bin/bash
# Point-in-time recovery script
# File: /scripts/restore_pitr.sh

set -e

# Configuration
DB_NAME="llm_copilot_agent"
RESTORE_TIME="2025-11-25 14:00:00 UTC"  # Target recovery time
BACKUP_DIR="/backup/postgresql"
WAL_DIR="/backup/wal"
RESTORE_DIR="/var/lib/postgresql/14/restore"

echo "[$(date)] Starting point-in-time recovery to ${RESTORE_TIME}..."

# 1. Stop PostgreSQL
systemctl stop postgresql

# 2. Find the latest full backup before restore time
LATEST_BACKUP=$(find "${BACKUP_DIR}" -name "full_*.sql.gz" -type f | sort -r | head -n 1)

if [ -z "${LATEST_BACKUP}" ]; then
    echo "ERROR: No backup found!"
    exit 1
fi

echo "[$(date)] Using backup: ${LATEST_BACKUP}"

# 3. Restore base backup
mkdir -p "${RESTORE_DIR}"
gunzip -c "${LATEST_BACKUP}" | pg_restore -U postgres -d template1 -C

# 4. Configure recovery
cat > "${RESTORE_DIR}/recovery.conf" <<EOF
restore_command = 'cp ${WAL_DIR}/%f %p'
recovery_target_time = '${RESTORE_TIME}'
recovery_target_action = 'promote'
EOF

# 5. Move restored data to PostgreSQL data directory
mv "${RESTORE_DIR}" /var/lib/postgresql/14/main

# 6. Start PostgreSQL (will apply WAL up to target time)
systemctl start postgresql

# 7. Wait for recovery to complete
echo "[$(date)] Waiting for recovery to complete..."
sleep 10

# 8. Verify recovery
psql -U postgres -d "${DB_NAME}" -c "SELECT NOW() AS current_time, version();"

echo "[$(date)] Point-in-time recovery completed successfully!"
```

### 3. Cross-Region Replication

```sql
-- PostgreSQL streaming replication configuration
-- File: postgresql.conf (Primary)

# Replication Settings
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on
hot_standby_feedback = on

# Archive to remote location
archive_mode = on
archive_command = 'aws s3 cp %p s3://llm-copilot-backups/wal/%f --region us-west-2'

# Synchronous replication (optional - impacts performance)
synchronous_commit = remote_apply
synchronous_standby_names = 'standby1,standby2'

-- File: postgresql.conf (Standby/Replica)
hot_standby = on
hot_standby_feedback = on
primary_conninfo = 'host=primary.db.internal port=5432 user=replication_user password=xxx application_name=standby1'
primary_slot_name = 'standby1_slot'
restore_command = 'aws s3 cp s3://llm-copilot-backups/wal/%f %p --region us-west-2'
```

```bash
#!/bin/bash
# Setup streaming replication to standby
# File: /scripts/setup_replication.sh

set -e

PRIMARY_HOST="primary.db.internal"
STANDBY_HOST="standby.db.internal"
REPLICATION_USER="replication_user"

echo "Setting up streaming replication..."

# 1. On primary: Create replication user
psql -U postgres -c "CREATE USER ${REPLICATION_USER} REPLICATION LOGIN ENCRYPTED PASSWORD 'xxx';"

# 2. On primary: Create replication slot
psql -U postgres -c "SELECT * FROM pg_create_physical_replication_slot('standby1_slot');"

# 3. On standby: Take base backup from primary
pg_basebackup -h "${PRIMARY_HOST}" -D /var/lib/postgresql/14/main -U "${REPLICATION_USER}" -Fp -Xs -P -R

# 4. Start standby
systemctl start postgresql

# 5. Verify replication status on primary
psql -U postgres -c "SELECT * FROM pg_stat_replication;"

echo "Replication setup complete!"
```

### 4. Disaster Recovery Procedures

```yaml
# Disaster Recovery Runbook
# File: /docs/runbooks/disaster_recovery.yaml

disaster_recovery:
  name: "Complete System Disaster Recovery"
  rto: "15 minutes"
  rpo: "1 hour"

  prerequisites:
    - Automated backups enabled
    - Cross-region replication configured
    - S3 backups accessible
    - Standby database available

  scenarios:
    - scenario: "Primary Database Failure"
      steps:
        - step: 1
          action: "Detect failure"
          command: "pg_isready -h primary.db.internal"
          expected: "Connection refused or timeout"

        - step: 2
          action: "Promote standby to primary"
          command: "pg_ctl promote -D /var/lib/postgresql/14/main"
          timeout: "30 seconds"

        - step: 3
          action: "Update application DNS/config"
          command: "aws route53 change-resource-record-sets --change-batch ..."
          timeout: "60 seconds"

        - step: 4
          action: "Verify application connectivity"
          command: "psql -h new-primary.db.internal -c 'SELECT 1;'"
          expected: "Success"

        - step: 5
          action: "Setup new standby from failed primary"
          command: "/scripts/setup_replication.sh"
          timeout: "10 minutes"

      estimated_downtime: "5 minutes"
      data_loss: "< 1 hour (RPO)"

    - scenario: "Complete Region Failure"
      steps:
        - step: 1
          action: "Activate DR region"
          command: "terraform apply -var='region=us-west-2'"
          timeout: "10 minutes"

        - step: 2
          action: "Restore from S3 backup"
          command: "/scripts/restore_from_s3.sh"
          timeout: "15 minutes"

        - step: 3
          action: "Apply WAL for PITR"
          command: "/scripts/restore_pitr.sh"
          timeout: "5 minutes"

        - step: 4
          action: "Update global load balancer"
          command: "aws globalaccelerator update-listener ..."
          timeout: "2 minutes"

      estimated_downtime: "15 minutes"
      data_loss: "< 1 hour (RPO)"

  testing:
    frequency: "Monthly"
    last_test: "2025-11-01"
    next_test: "2025-12-01"
    success_criteria:
      - RTO met (< 15 minutes)
      - RPO met (< 1 hour data loss)
      - All applications functional
      - Data integrity verified
```

### 5. Automated Backup Validation

```rust
// Backup validation and testing

use sqlx::PgPool;
use std::process::Command;

pub struct BackupValidator {
    backup_path: String,
    test_db_name: String,
}

impl BackupValidator {
    pub fn new(backup_path: String) -> Self {
        Self {
            backup_path,
            test_db_name: "backup_validation_test".to_string(),
        }
    }

    pub async fn validate_backup(&self) -> Result<ValidationReport, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();

        // 1. Create temporary test database
        self.create_test_database().await?;

        // 2. Restore backup to test database
        let restore_success = self.restore_to_test_db()?;

        if !restore_success {
            return Ok(ValidationReport {
                success: false,
                error: Some("Restore failed".to_string()),
                duration_seconds: start_time.elapsed().as_secs(),
                ..Default::default()
            });
        }

        // 3. Validate data integrity
        let integrity_checks = self.check_data_integrity().await?;

        // 4. Verify row counts
        let row_counts = self.verify_row_counts().await?;

        // 5. Cleanup
        self.drop_test_database().await?;

        Ok(ValidationReport {
            success: true,
            error: None,
            duration_seconds: start_time.elapsed().as_secs(),
            tables_validated: integrity_checks.len(),
            total_rows: row_counts.values().sum(),
            integrity_checks,
            row_counts,
        })
    }

    async fn create_test_database(&self) -> Result<(), sqlx::Error> {
        let pool = PgPool::connect("postgresql://postgres@localhost/postgres").await?;

        sqlx::query(&format!("DROP DATABASE IF EXISTS {}", self.test_db_name))
            .execute(&pool)
            .await?;

        sqlx::query(&format!("CREATE DATABASE {}", self.test_db_name))
            .execute(&pool)
            .await?;

        Ok(())
    }

    fn restore_to_test_db(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let output = Command::new("pg_restore")
            .args(&[
                "-d", &self.test_db_name,
                &self.backup_path,
            ])
            .output()?;

        Ok(output.status.success())
    }

    async fn check_data_integrity(&self) -> Result<Vec<IntegrityCheck>, sqlx::Error> {
        let pool = PgPool::connect(&format!("postgresql://postgres@localhost/{}", self.test_db_name)).await?;

        let mut checks = Vec::new();

        // Check foreign key constraints
        let fk_violations: Vec<(String,)> = sqlx::query_as(
            "SELECT conname FROM pg_constraint WHERE contype = 'f' AND NOT convalidated"
        )
        .fetch_all(&pool)
        .await?;

        checks.push(IntegrityCheck {
            check_type: "foreign_keys".to_string(),
            passed: fk_violations.is_empty(),
            details: format!("{} violations", fk_violations.len()),
        });

        // Check for null violations
        // Add more integrity checks as needed

        Ok(checks)
    }

    async fn verify_row_counts(&self) -> Result<std::collections::HashMap<String, i64>, sqlx::Error> {
        let pool = PgPool::connect(&format!("postgresql://postgres@localhost/{}", self.test_db_name)).await?;

        let tables = vec!["users", "workflows", "incidents", "conversations"];
        let mut counts = std::collections::HashMap::new();

        for table in tables {
            let count: (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) FROM {}", table))
                .fetch_one(&pool)
                .await?;

            counts.insert(table.to_string(), count.0);
        }

        Ok(counts)
    }

    async fn drop_test_database(&self) -> Result<(), sqlx::Error> {
        let pool = PgPool::connect("postgresql://postgres@localhost/postgres").await?;

        sqlx::query(&format!("DROP DATABASE IF EXISTS {}", self.test_db_name))
            .execute(&pool)
            .await?;

        Ok(())
    }
}

#[derive(Debug, Default)]
pub struct ValidationReport {
    pub success: bool,
    pub error: Option<String>,
    pub duration_seconds: u64,
    pub tables_validated: usize,
    pub total_rows: i64,
    pub integrity_checks: Vec<IntegrityCheck>,
    pub row_counts: std::collections::HashMap<String, i64>,
}

#[derive(Debug)]
pub struct IntegrityCheck {
    pub check_type: String,
    pub passed: bool,
    pub details: String,
}

// Automated backup testing (runs monthly)
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let validator = BackupValidator::new("/backup/postgresql/latest.sql.gz".to_string());

    let report = validator.validate_backup().await?;

    if report.success {
        println!("✓ Backup validation successful!");
        println!("  Duration: {} seconds", report.duration_seconds);
        println!("  Tables validated: {}", report.tables_validated);
        println!("  Total rows: {}", report.total_rows);
    } else {
        println!("✗ Backup validation failed: {:?}", report.error);
    }

    Ok(())
}
```

---

## Configuration Files

### 1. Database Configuration (config/database.yaml)

```yaml
# Database configuration for LLM-CoPilot-Agent

postgres:
  primary:
    host: ${POSTGRES_PRIMARY_HOST:-localhost}
    port: ${POSTGRES_PRIMARY_PORT:-5432}
    database: llm_copilot_agent
    username: ${POSTGRES_USER:-postgres}
    password: ${POSTGRES_PASSWORD}
    ssl_mode: ${POSTGRES_SSL_MODE:-require}

  replica:
    enabled: ${POSTGRES_REPLICA_ENABLED:-false}
    host: ${POSTGRES_REPLICA_HOST}
    port: ${POSTGRES_REPLICA_PORT:-5432}
    database: llm_copilot_agent
    username: ${POSTGRES_USER:-postgres}
    password: ${POSTGRES_PASSWORD}
    ssl_mode: ${POSTGRES_SSL_MODE:-require}

  pool:
    max_connections: 50
    min_connections: 5
    acquire_timeout_seconds: 30
    idle_timeout_seconds: 600
    max_lifetime_seconds: 1800
    test_before_acquire: true

  performance:
    statement_cache_capacity: 100
    prepared_statements: true

redis:
  host: ${REDIS_HOST:-localhost}
  port: ${REDIS_PORT:-6379}
  password: ${REDIS_PASSWORD}
  database: ${REDIS_DB:-0}
  tls: ${REDIS_TLS:-false}

  pool:
    max_connections: 100
    connection_timeout_seconds: 5

  cache:
    default_ttl_seconds: 3600
    max_memory: "2gb"
    eviction_policy: "allkeys-lru"

  cluster:
    enabled: ${REDIS_CLUSTER_ENABLED:-false}
    nodes:
      - ${REDIS_NODE1}
      - ${REDIS_NODE2}
      - ${REDIS_NODE3}

qdrant:
  url: ${QDRANT_URL:-http://localhost:6333}
  api_key: ${QDRANT_API_KEY}

  collections:
    code_embeddings:
      vector_size: 1536
      distance: cosine
      on_disk: false

    documentation_embeddings:
      vector_size: 1536
      distance: cosine
      on_disk: false

    conversation_embeddings:
      vector_size: 1536
      distance: cosine
      on_disk: true

    incident_knowledge:
      vector_size: 1536
      distance: cosine
      on_disk: false

  hnsw:
    m: 16
    ef_construct: 100
    full_scan_threshold: 10000

backup:
  postgres:
    enabled: true
    schedule: "0 2 * * *"  # Daily at 2 AM
    retention_days: 30
    compression: true
    encryption: true

    s3:
      bucket: ${BACKUP_S3_BUCKET}
      region: ${BACKUP_S3_REGION:-us-east-1}
      storage_class: STANDARD_IA

  validation:
    enabled: true
    schedule: "0 3 1 * *"  # Monthly on 1st at 3 AM

disaster_recovery:
  rto_minutes: 15
  rpo_minutes: 60

  replication:
    enabled: true
    type: streaming  # streaming, logical, or snapshot
    sync_mode: async  # async, sync, or remote_apply

  cross_region:
    enabled: ${DR_CROSS_REGION_ENABLED:-false}
    region: ${DR_REGION:-us-west-2}
```

---

## Summary

This comprehensive data storage and persistence layer architecture provides:

### PostgreSQL
- Complete relational schema with 10+ core tables
- Partitioned audit logs (1-year retention, monthly partitions)
- Optimized indexes and constraints
- Triggers for automated updates and audit trail
- Views for common query patterns

### Redis
- 7 distinct data structure patterns (Hash, Set, SortedSet, List, String, Stream, Pub/Sub)
- Session management with TTL
- Rate limiting (sliding window + token bucket)
- Response caching with invalidation
- Real-time metrics and event broadcasting
- Task queue with priority support

### Qdrant (Vector Database)
- 4 specialized collections for embeddings
- HNSW indexing for fast similarity search
- Metadata filtering and hybrid search
- Optimized configuration for performance

### Data Access Patterns
- Repository pattern with async Rust implementation
- Connection pooling for PostgreSQL, Redis, and Qdrant
- Read replica routing for scalability
- Cache-aside pattern for performance
- Transaction support with Unit of Work

### Data Migration
- Schema versioning with migration tracking
- Zero-downtime migration strategies
- Rollback procedures
- Automated validation

### Backup & Recovery
- Automated daily backups with 30-day retention
- Point-in-time recovery (PITR) capability
- Cross-region replication for disaster recovery
- RTO: 15 minutes, RPO: 1 hour
- Monthly backup validation testing

All implementations follow production best practices with security, performance, and reliability as primary concerns.