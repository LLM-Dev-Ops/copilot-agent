-- ============================================================================
-- Migration: V001_initial_schema.sql
-- Description: Initial database schema for LLM-CoPilot-Agent
-- Version: 1.0.0
-- Date: 2025-11-25
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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
-- USERS TABLE
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'developer',
    status user_status NOT NULL DEFAULT 'pending',

    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',

    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    api_key_hash VARCHAR(255),
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT chk_username_format CHECK (username ~* '^[a-z0-9_-]{3,100}$')
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_api_key ON users(api_key_hash) WHERE api_key_hash IS NOT NULL;

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    token_hash VARCHAR(255) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(255) UNIQUE,
    status session_status NOT NULL DEFAULT 'active',

    ip_address INET NOT NULL,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),

    context JSONB DEFAULT '{}',

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

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(500),
    description TEXT,
    tags TEXT[] DEFAULT '{}',

    context_snapshot JSONB DEFAULT '{}',
    system_prompt TEXT,
    model_config JSONB DEFAULT '{}',

    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_started_at ON conversations(started_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text',

    model VARCHAR(100),
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER,

    tool_calls JSONB,
    tool_results JSONB,

    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    sequence_number INTEGER NOT NULL,

    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_role CHECK (role IN ('user', 'assistant', 'system', 'tool'))
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_sequence ON messages(conversation_id, sequence_number);

-- ============================================================================
-- WORKFLOWS TABLE
-- ============================================================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,

    definition JSONB NOT NULL,
    parameters JSONB DEFAULT '{}',
    environment_vars JSONB DEFAULT '{}',

    triggers JSONB DEFAULT '[]',

    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_workflow_name_version UNIQUE (user_id, name, version)
);

CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_name ON workflows(name);
CREATE INDEX idx_workflows_tags ON workflows USING GIN(tags);

-- ============================================================================
-- WORKFLOW EXECUTIONS TABLE
-- ============================================================================

CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status execution_status NOT NULL DEFAULT 'queued',
    parameters JSONB DEFAULT '{}',
    environment JSONB DEFAULT '{}',

    trigger_type VARCHAR(50),
    trigger_source JSONB,

    current_step VARCHAR(255),
    completed_steps TEXT[] DEFAULT '{}',
    failed_steps TEXT[] DEFAULT '{}',

    outputs JSONB,
    error_message TEXT,
    error_stack TEXT,

    total_duration_ms INTEGER,
    steps_executed INTEGER DEFAULT 0,

    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);

-- ============================================================================
-- INCIDENTS TABLE
-- ============================================================================

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity incident_severity NOT NULL,
    status incident_status NOT NULL DEFAULT 'open',

    source VARCHAR(100) NOT NULL,
    detection_method VARCHAR(100),

    affected_services TEXT[] DEFAULT '{}',
    affected_users_count INTEGER DEFAULT 0,
    blast_radius JSONB,

    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_team VARCHAR(100),

    metadata JSONB DEFAULT '{}',
    related_incidents UUID[],

    root_cause TEXT,
    resolution_notes TEXT,
    remediation_steps TEXT[],

    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_severity ON incidents(severity) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_detected_at ON incidents(detected_at DESC);

-- ============================================================================
-- RUNBOOKS TABLE
-- ============================================================================

CREATE TABLE runbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,

    trigger_conditions JSONB,
    steps JSONB NOT NULL,

    is_automated BOOLEAN DEFAULT FALSE,
    automation_config JSONB,

    tags TEXT[] DEFAULT '{}',
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,

    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX idx_runbooks_name ON runbooks(name) WHERE archived_at IS NULL;
CREATE INDEX idx_runbooks_tags ON runbooks USING GIN(tags);

-- ============================================================================
-- AUDIT LOGS TABLE (PARTITIONED)
-- ============================================================================

CREATE TABLE audit_logs (
    id BIGSERIAL,

    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,

    action audit_action NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,

    description TEXT,
    changes JSONB,
    metadata JSONB DEFAULT '{}',

    ip_address INET,
    user_agent TEXT,

    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next month
CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- Indexes on partitioned table
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
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

-- ============================================================================
-- VIEWS
-- ============================================================================

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

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Create application user (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'llm_copilot_app') THEN
        CREATE USER llm_copilot_app WITH PASSWORD 'change_this_password';
    END IF;
END
$$;

-- Grant permissions
GRANT CONNECT ON DATABASE llm_copilot_agent TO llm_copilot_app;
GRANT USAGE ON SCHEMA public TO llm_copilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO llm_copilot_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO llm_copilot_app;

-- Ensure future tables get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO llm_copilot_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO llm_copilot_app;

-- ============================================================================
-- ANALYZE
-- ============================================================================

ANALYZE users;
ANALYZE sessions;
ANALYZE conversations;
ANALYZE messages;
ANALYZE workflows;
ANALYZE workflow_executions;
ANALYZE incidents;
ANALYZE runbooks;
ANALYZE audit_logs;
