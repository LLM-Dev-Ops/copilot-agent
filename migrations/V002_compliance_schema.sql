-- ============================================================================
-- Migration: V002_compliance_schema.sql
-- Description: Compliance data layer -- the fifteen tables referenced by
--              services/compliance/ that no migration ever defined.
-- Version: 2.0.0
-- Date: 2026-07-27
-- ADR: docs/adr/ADR-0002-implement-phi-compliance-data-layer.md
--
-- Every endpoint on all three compliance routers currently fails at its first
-- query with `relation ... does not exist`. This migration creates the schema
-- those queries assume, following V001's conventions: uuid_generate_v4() keys,
-- TIMESTAMPTZ NOT NULL DEFAULT NOW(), JSONB DEFAULT '{}', ENUMs for closed sets,
-- and GIN indexes on array and JSONB columns.
--
-- Idempotent: safe to re-run. Creates no foreign keys into V001 except users(id).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE phi_access_type AS ENUM ('view', 'create', 'update', 'delete', 'export', 'print');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE compliance_framework AS ENUM (
        'soc2_type1', 'soc2_type2', 'hipaa', 'gdpr', 'ccpa', 'iso27001', 'pci_dss', 'fedramp'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE control_category AS ENUM (
        'security', 'availability', 'processing_integrity', 'confidentiality', 'privacy',
        'access_control', 'risk_management', 'incident_response', 'business_continuity',
        'vendor_management'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE control_status AS ENUM (
        'not_implemented', 'partially_implemented', 'implemented', 'effective', 'needs_improvement'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE compliance_audit_status AS ENUM (
        'scheduled', 'in_progress', 'pending_review', 'completed', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE compliance_audit_type AS ENUM ('internal', 'external', 'self_assessment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE finding_severity AS ENUM ('critical', 'high', 'medium', 'low', 'informational');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE finding_status AS ENUM ('open', 'in_progress', 'remediated', 'accepted', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE data_classification AS ENUM (
        'public', 'internal', 'confidential', 'restricted', 'phi', 'pii', 'pci'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE data_region AS ENUM (
        'us-east', 'us-west', 'eu-west', 'eu-central', 'apac-south', 'apac-east', 'global'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE baa_status AS ENUM ('pending', 'active', 'expired', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE baa_agreement_type AS ENUM ('baa', 'dpa', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transfer_status AS ENUM ('pending', 'approved', 'denied', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE policy_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE scheduled_task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- PHI ACCESS LOGS (PARTITIONED, APPEND-ONLY, TAMPER-EVIDENT)
--
-- Columns driven by the insert at hipaaService.ts:84-93. patient_id holds an
-- HMAC-SHA256 hex digest (see pseudonymize()), which is why it is a fixed-width
-- CHAR(64) rather than the variable-length iv:ciphertext the old scheme produced.
--
-- key_version exists from day one so that a future key-rotation ADR is not
-- blocked on a migration (ADR-0002 Consequences, "Neutral").
-- ============================================================================

CREATE TABLE IF NOT EXISTS phi_access_logs (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    patient_id CHAR(64),
    key_version SMALLINT NOT NULL DEFAULT 1,

    access_type phi_access_type NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,

    purpose TEXT,
    access_granted BOOLEAN NOT NULL,

    ip_address INET,
    user_agent TEXT,

    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',

    -- Tamper-evidence chain: entry_hash = SHA256(canonical row fields || prev_hash)
    prev_hash CHAR(64),
    entry_hash CHAR(64) NOT NULL,

    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- ON DELETE RESTRICT above is deliberate: an audit record must not disappear
-- because a user row was removed. Deleting a user with PHI access history now
-- requires an explicit decision rather than silently cascading the audit trail.

CREATE TABLE IF NOT EXISTS phi_access_logs_2026_07 PARTITION OF phi_access_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS phi_access_logs_2026_08 PARTITION OF phi_access_logs
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- DEFAULT partition so an insert never fails on a missing range. Without this a
-- PHI access would be REJECTED rather than logged, which is the wrong failure
-- direction for an audit control.
CREATE TABLE IF NOT EXISTS phi_access_logs_default PARTITION OF phi_access_logs DEFAULT;

-- The three filters at hipaaService.ts:116-136.
CREATE INDEX IF NOT EXISTS idx_phi_access_logs_patient
    ON phi_access_logs(patient_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_phi_access_logs_user
    ON phi_access_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_phi_access_logs_timestamp
    ON phi_access_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_phi_access_logs_access_type
    ON phi_access_logs(access_type, timestamp DESC);

-- ---------------------------------------------------------------------------
-- Append-only enforcement (ADR-0001 step 14, ADR-0002 step 2).
--
-- Belt and braces: the REVOKE below can be undone by a future GRANT, so the
-- trigger enforces it independently at the table level.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION phi_access_logs_deny_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'phi_access_logs is append-only: % is not permitted (HIPAA 45 CFR 164.312(b)). Record a compensating entry instead.',
        TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_phi_access_logs_append_only ON phi_access_logs;
CREATE TRIGGER trg_phi_access_logs_append_only
    BEFORE UPDATE OR DELETE ON phi_access_logs
    FOR EACH ROW EXECUTE FUNCTION phi_access_logs_deny_mutation();

-- ============================================================================
-- BUSINESS ASSOCIATE AGREEMENTS
--
-- documents is JSONB NOT NULL DEFAULT '[]' -- NOT nullable. hipaaService.ts:360
-- appends with `documents || $1::jsonb`, and `||` returns NULL on a NULL left
-- operand, which would silently erase the document list.
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_associate_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    vendor_id VARCHAR(255) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    agreement_type baa_agreement_type NOT NULL,
    status baa_status NOT NULL DEFAULT 'pending',

    effective_date TIMESTAMPTZ NOT NULL,
    expiration_date TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,

    terms JSONB NOT NULL DEFAULT '{}',
    contacts JSONB NOT NULL DEFAULT '[]',
    documents JSONB NOT NULL DEFAULT '[]',

    last_reviewed TIMESTAMPTZ,
    next_review TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_baa_status ON business_associate_agreements(status);
CREATE INDEX IF NOT EXISTS idx_baa_vendor ON business_associate_agreements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_baa_expiration
    ON business_associate_agreements(expiration_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_baa_documents ON business_associate_agreements USING GIN(documents);

-- ============================================================================
-- HIPAA BREACHES
--
-- phi_types and containment_actions are TEXT[] rather than JSONB: hipaaService.ts:719
-- passes JavaScript arrays as query parameters directly, without JSON.stringify,
-- so node-postgres serializes them to Postgres array literals.
-- ============================================================================

CREATE TABLE IF NOT EXISTS hipaa_breaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    discovery_date TIMESTAMPTZ NOT NULL,
    affected_individuals INTEGER NOT NULL CHECK (affected_individuals >= 0),

    phi_types TEXT[] NOT NULL DEFAULT '{}',
    description TEXT NOT NULL,
    containment_actions TEXT[] NOT NULL DEFAULT '{}',

    -- 60 days from discovery per 45 CFR 164.404(b)
    notification_deadline TIMESTAMPTZ NOT NULL,
    -- HHS notification required at 500+ individuals per 45 CFR 164.408(b)
    hhs_notification_required BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(50) NOT NULL DEFAULT 'investigating',
    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hipaa_breaches_status ON hipaa_breaches(status);
CREATE INDEX IF NOT EXISTS idx_hipaa_breaches_deadline ON hipaa_breaches(notification_deadline);
CREATE INDEX IF NOT EXISTS idx_hipaa_breaches_phi_types ON hipaa_breaches USING GIN(phi_types);

-- ============================================================================
-- SECURITY ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',

    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id, created_at DESC);

-- ============================================================================
-- SCHEDULED TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    task_type VARCHAR(100) NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status scheduled_task_status NOT NULL DEFAULT 'pending',

    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    executed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
    ON scheduled_tasks(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_type ON scheduled_tasks(task_type);

-- ============================================================================
-- COMPLIANCE CONTROLS
--
-- Needs BOTH a surrogate `id` (complianceService.ts:93 looks up by it) and a
-- distinct `control_id` (hipaaService.ts:613-616 joins on it against HIPAA
-- identifiers like '164.308(a)(1)'). They are not interchangeable.
--
-- `evidence` is absent from the INSERT at :68 but written by the UPDATEs at
-- :159 and :194, so it must exist with a default.
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    framework compliance_framework NOT NULL,
    control_id VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category control_category NOT NULL,
    status control_status NOT NULL DEFAULT 'not_implemented',
    owner VARCHAR(255) NOT NULL,

    implementation JSONB NOT NULL DEFAULT '{}',
    testing JSONB NOT NULL DEFAULT '{}',
    evidence JSONB NOT NULL DEFAULT '[]',

    related_controls TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE (framework, control_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework
    ON compliance_controls(framework, status);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_control_id ON compliance_controls(control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_category ON compliance_controls(category);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_related
    ON compliance_controls USING GIN(related_controls);
CREATE INDEX IF NOT EXISTS idx_compliance_controls_metadata
    ON compliance_controls USING GIN(metadata);

-- ============================================================================
-- COMPLIANCE AUDITS
--
-- `findings` is TEXT[]: complianceService.ts:439 uses array_append(findings, $1),
-- which requires a real array type and would fail against JSONB. Note the INSERT
-- at :296 passes JSON.stringify(audit.findings) for this column -- a pre-existing
-- inconsistency in the service, flagged in the ADR-0002 PR rather than silently
-- reshaped here. array_append is the operation that constrains the column type.
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(500) NOT NULL,
    framework compliance_framework NOT NULL,
    type compliance_audit_type NOT NULL,
    status compliance_audit_status NOT NULL DEFAULT 'scheduled',

    scope JSONB NOT NULL DEFAULT '{}',
    auditor JSONB NOT NULL DEFAULT '{}',
    schedule JSONB NOT NULL DEFAULT '{}',

    findings TEXT[] NOT NULL DEFAULT '{}',
    report JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_audits_framework
    ON compliance_audits(framework, status);
CREATE INDEX IF NOT EXISTS idx_compliance_audits_status ON compliance_audits(status);
CREATE INDEX IF NOT EXISTS idx_compliance_audits_findings
    ON compliance_audits USING GIN(findings);

-- ============================================================================
-- COMPLIANCE FINDINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    audit_id UUID NOT NULL REFERENCES compliance_audits(id) ON DELETE CASCADE,
    control_id VARCHAR(100),

    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity finding_severity NOT NULL,
    status finding_status NOT NULL DEFAULT 'open',

    risk JSONB NOT NULL DEFAULT '{}',
    remediation JSONB NOT NULL DEFAULT '{}',
    evidence JSONB NOT NULL DEFAULT '[]',
    comments JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_audit ON compliance_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity
    ON compliance_findings(severity, status);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_control ON compliance_findings(control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_created ON compliance_findings(created_at DESC);

-- ============================================================================
-- COMPLIANCE REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(500) NOT NULL,
    framework compliance_framework NOT NULL,
    report_type VARCHAR(50) NOT NULL,

    period JSONB NOT NULL DEFAULT '{}',
    summary JSONB NOT NULL DEFAULT '{}',
    sections JSONB NOT NULL DEFAULT '[]',
    recommendations JSONB NOT NULL DEFAULT '[]',

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'json',
    url TEXT
);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework
    ON compliance_reports(framework, generated_at DESC);

-- ============================================================================
-- COMPLIANCE AUDIT LOG
--
-- user_id is VARCHAR, not UUID: complianceService.ts:865 falls back to the
-- literal 'system' for unattributed internal actions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    action VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    user_id VARCHAR(255) NOT NULL DEFAULT 'system',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_action
    ON compliance_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_resource
    ON compliance_audit_log(resource_id);

-- ============================================================================
-- DATA RESIDENCY POLICIES
--
-- allowed_regions / restricted_regions are data_region[]: dataResidencyService.ts:100
-- passes JavaScript arrays directly, as with hipaa_breaches.phi_types.
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_residency_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(500) NOT NULL,
    description TEXT,
    classification data_classification NOT NULL,

    allowed_regions data_region[] NOT NULL DEFAULT '{}',
    restricted_regions data_region[] DEFAULT '{}',

    requirements JSONB NOT NULL DEFAULT '{}',
    applicable_to JSONB DEFAULT '{}',

    status policy_status NOT NULL DEFAULT 'draft',
    effective_date TIMESTAMPTZ,
    expiration_date TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_data_residency_policies_classification
    ON data_residency_policies(classification, status);
CREATE INDEX IF NOT EXISTS idx_data_residency_policies_allowed
    ON data_residency_policies USING GIN(allowed_regions);

-- ============================================================================
-- DATA ASSETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(500) NOT NULL,
    type VARCHAR(100) NOT NULL,
    classification data_classification NOT NULL,
    current_region data_region NOT NULL,

    policies TEXT[] NOT NULL DEFAULT '{}',

    encryption_status JSONB NOT NULL DEFAULT '{}',
    retention_info JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_data_assets_classification
    ON data_assets(classification, current_region);
CREATE INDEX IF NOT EXISTS idx_data_assets_region ON data_assets(current_region);
CREATE INDEX IF NOT EXISTS idx_data_assets_policies ON data_assets USING GIN(policies);

-- ============================================================================
-- DATA TRANSFER REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    asset_id UUID NOT NULL REFERENCES data_assets(id) ON DELETE CASCADE,
    source_region data_region NOT NULL,
    target_region data_region NOT NULL,

    purpose TEXT NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

    status transfer_status NOT NULL DEFAULT 'pending',
    transfer_mechanism VARCHAR(255),
    dpa_reference VARCHAR(255),

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_transfer_requests_status
    ON data_transfer_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_transfer_requests_asset
    ON data_transfer_requests(asset_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',

    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- ============================================================================
-- DATA RESIDENCY EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_residency_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    event_type VARCHAR(100) NOT NULL,
    asset_id UUID REFERENCES data_assets(id) ON DELETE SET NULL,
    request_id UUID REFERENCES data_transfer_requests(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_residency_events_type
    ON data_residency_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_residency_events_asset
    ON data_residency_events(asset_id, created_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS (V001 convention)
-- ============================================================================

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'business_associate_agreements', 'compliance_controls', 'compliance_audits',
        'compliance_findings', 'data_residency_policies', 'data_assets',
        'data_transfer_requests'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- ============================================================================
-- APPEND-ONLY GRANTS
--
-- Revoke mutation on phi_access_logs from the application role. The trigger above
-- is the real enforcement; this is defence in depth.
--
-- The role is `llm_copilot_app`, created by V001:432-438. V001 also issues a blanket
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES (V001:444) plus ALTER DEFAULT
-- PRIVILEGES (V001:448), so without this block the application role would hold UPDATE
-- and DELETE on the audit log by inheritance.
--
-- Guarded by IF EXISTS so the migration still applies in environments that do not
-- provision the role.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'llm_copilot_app') THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON phi_access_logs FROM llm_copilot_app;
        GRANT SELECT, INSERT ON phi_access_logs TO llm_copilot_app;
    END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION V002
-- ============================================================================
