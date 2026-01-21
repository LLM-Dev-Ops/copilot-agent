# LLM-CONNECTOR-HUB CLI COMMANDS

## CLI Activation Verification

All Connector-Hub agents are callable via CLI using the `agentics-cli` tool.
The CLI resolves service URL dynamically based on environment.

---

## Environment Setup

```bash
# Set environment
export AGENTICS_ENV=dev  # dev | staging | prod
export CONNECTOR_HUB_URL=$(gcloud run services describe llm-connector-hub --region=us-central1 --format='value(status.url)')

# Verify connection
curl -s ${CONNECTOR_HUB_URL}/health | jq .
```

---

## 1. ERP Surface Agent Commands

### Connect to ERP System
```bash
agentics-cli connector erp connect \
  --system salesforce \
  --credentials '{"client_id":"xxx","client_secret":"xxx"}' \
  --config '{"sandbox":true}'
```

**Expected Output:**
```json
{
  "status": "success",
  "event": {
    "agent_id": "erp-surface-agent",
    "decision_type": "erp_connection",
    "outputs": {
      "connected": true,
      "system": "salesforce",
      "connection_id": "conn_abc123",
      "capabilities": ["read", "query"]
    },
    "confidence": 0.95
  }
}
```

### Query ERP Data
```bash
agentics-cli connector erp query \
  --system salesforce \
  --query "SELECT Id, Name FROM Account LIMIT 10"
```

### Sync ERP Entities
```bash
agentics-cli connector erp sync \
  --system salesforce \
  --entities '["Account","Contact"]' \
  --since "2024-01-01T00:00:00Z"
```

---

## 2. Database Query Agent Commands

### Execute Read-Only Query
```bash
agentics-cli connector database query \
  --connection '{"type":"postgres","host":"db.example.com","database":"analytics"}' \
  --query "SELECT * FROM metrics WHERE date > NOW() - INTERVAL '7 days'" \
  --parameters '[]'
```

**Expected Output:**
```json
{
  "status": "success",
  "event": {
    "agent_id": "database-query-agent",
    "decision_type": "database_query",
    "outputs": {
      "rows": [...],
      "row_count": 150,
      "columns": ["id", "metric_name", "value", "date"],
      "execution_time_ms": 45,
      "read_only": true
    },
    "confidence": 0.98
  }
}
```

### Get Schema Information
```bash
agentics-cli connector database schema \
  --connection '{"type":"postgres","host":"db.example.com"}' \
  --tables '["users","orders","products"]'
```

---

## 3. Webhook Listener Agent Commands

### Ingest Webhook Payload
```bash
agentics-cli connector webhook ingest \
  --source github \
  --event-type push \
  --payload '{"ref":"refs/heads/main","commits":[...]}'
```

**Expected Output:**
```json
{
  "status": "success",
  "event": {
    "agent_id": "webhook-listener-agent",
    "decision_type": "webhook_ingestion",
    "outputs": {
      "ingested": true,
      "source": "github",
      "event_type": "push",
      "event_id": "evt_xyz789",
      "schema_valid": true,
      "normalized": true
    },
    "confidence": 0.92
  }
}
```

### Register Webhook Source
```bash
agentics-cli connector webhook register \
  --source stripe \
  --config '{"secret":"whsec_xxx","events":["payment.succeeded","payment.failed"]}'
```

---

## 4. Event Normalization Agent Commands

### Normalize Single Event
```bash
agentics-cli connector normalize \
  --source-type github_webhook \
  --payload '{"action":"opened","pull_request":{...}}' \
  --target-schema agentics_event_v1
```

**Expected Output:**
```json
{
  "status": "success",
  "event": {
    "agent_id": "event-normalization-agent",
    "decision_type": "event_normalization",
    "outputs": {
      "normalized_event": {
        "event_type": "code_review.opened",
        "source": "github",
        "timestamp": "2024-01-15T10:30:00Z",
        "actor": "user123",
        "resource": {"type": "pull_request", "id": "123"},
        "metadata": {...}
      },
      "schema_version": "agentics_event_v1",
      "transformations_applied": 3
    },
    "confidence": 0.89
  }
}
```

### Normalize Batch Events
```bash
agentics-cli connector normalize batch \
  --source-type salesforce_event \
  --payloads '[{...},{...},{...}]' \
  --target-schema agentics_event_v1
```

---

## 5. Auth Identity Agent Commands

### Authenticate
```bash
agentics-cli connector auth authenticate \
  --provider okta \
  --credentials '{"username":"user@example.com","password":"xxx"}' \
  --scopes '["openid","profile","email"]'
```

**Expected Output:**
```json
{
  "status": "success",
  "event": {
    "agent_id": "auth-identity-agent",
    "decision_type": "authentication",
    "outputs": {
      "authenticated": true,
      "provider": "okta",
      "token_type": "Bearer",
      "expires_in": 3600,
      "scopes_granted": ["openid", "profile", "email"],
      "identity": {
        "sub": "user123",
        "email": "user@example.com"
      }
    },
    "confidence": 0.99
  }
}
```

### Validate Token
```bash
agentics-cli connector auth validate \
  --token "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --required-scopes '["read:data"]'
```

### Refresh Token
```bash
agentics-cli connector auth refresh \
  --refresh-token "rt_abc123..." \
  --provider okta
```

---

## CLI Configuration

### Set Default Environment
```bash
agentics-cli config set environment dev
agentics-cli config set connector-hub-url https://llm-connector-hub-xxx.a.run.app
```

### View Configuration
```bash
agentics-cli config list
```

### Test Connectivity
```bash
agentics-cli connector health --all
```

---

## Notes

- **CLI resolves service URL dynamically** - no agent redeploys needed for CLI changes
- **All operations are read-only** - the connector hub does not modify external systems
- **All DecisionEvents are persisted** via ruvector-service
- **Telemetry is automatically captured** for LLM-Observatory
