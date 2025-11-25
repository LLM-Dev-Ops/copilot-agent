# Data Layer Quick Reference Guide

**Purpose:** Fast lookup for common data operations
**Version:** 1.0.0
**Last Updated:** 2025-11-25

---

## Quick Links

- [Full Architecture Document](./06-data-storage-persistence-architecture.md)
- [Database Schema](../../migrations/V001_initial_schema.sql)
- [Configuration](../../config/database.yaml)
- [Backup Scripts](../../scripts/backup_postgres.sh)

---

## Database Credentials (Development)

```bash
# PostgreSQL
Host: localhost
Port: 5432
Database: llm_copilot_agent
User: llm_copilot_app
Password: ${POSTGRES_PASSWORD}

# Redis
Host: localhost
Port: 6379
Database: 0
Password: ${REDIS_PASSWORD}

# Qdrant
URL: http://localhost:6333
API Key: ${QDRANT_API_KEY}
```

---

## Common SQL Queries

### User Operations

```sql
-- Find user by email
SELECT * FROM users WHERE email = 'user@example.com' AND deleted_at IS NULL;

-- Create user
INSERT INTO users (email, username, password_hash, role)
VALUES ('user@example.com', 'username', 'hashed_password', 'developer')
RETURNING *;

-- Update user
UPDATE users SET full_name = 'New Name', updated_at = NOW()
WHERE id = 'user-uuid' AND deleted_at IS NULL;

-- Soft delete user
UPDATE users SET deleted_at = NOW() WHERE id = 'user-uuid';

-- List active users
SELECT id, email, username, role, created_at
FROM users
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 100;
```

### Session Operations

```sql
-- Create session
INSERT INTO sessions (user_id, token_hash, ip_address, expires_at)
VALUES ('user-uuid', 'token-hash', '192.168.1.1', NOW() + INTERVAL '24 hours')
RETURNING *;

-- Get active session
SELECT s.*, u.email, u.role
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.token_hash = 'token-hash'
  AND s.status = 'active'
  AND s.expires_at > NOW()
  AND u.deleted_at IS NULL;

-- Update last activity
UPDATE sessions
SET last_activity_at = NOW()
WHERE id = 'session-uuid';

-- Terminate session
UPDATE sessions
SET status = 'terminated', terminated_at = NOW()
WHERE id = 'session-uuid';

-- Cleanup expired sessions
DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days';
```

### Workflow Operations

```sql
-- Create workflow
INSERT INTO workflows (user_id, name, description, definition)
VALUES ('user-uuid', 'Deploy App', 'Deployment workflow', '{"steps": [...]}')
RETURNING *;

-- List user workflows
SELECT id, name, description, version, is_active, created_at
FROM workflows
WHERE user_id = 'user-uuid' AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Get workflow with recent executions
SELECT
    w.*,
    jsonb_agg(
        jsonb_build_object(
            'id', we.id,
            'status', we.status,
            'queued_at', we.queued_at,
            'completed_at', we.completed_at
        ) ORDER BY we.queued_at DESC
    ) FILTER (WHERE we.id IS NOT NULL) AS recent_executions
FROM workflows w
LEFT JOIN LATERAL (
    SELECT * FROM workflow_executions
    WHERE workflow_id = w.id
    ORDER BY queued_at DESC
    LIMIT 10
) we ON true
WHERE w.id = 'workflow-uuid'
GROUP BY w.id;
```

### Incident Operations

```sql
-- Create incident
INSERT INTO incidents (title, severity, status, source, affected_services)
VALUES (
    'High error rate in API',
    'critical',
    'open',
    'monitoring',
    ARRAY['api', 'database']
)
RETURNING *;

-- Get open incidents by severity
SELECT id, title, severity, status, detected_at, affected_services
FROM incidents
WHERE status NOT IN ('resolved', 'closed')
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        WHEN 'info' THEN 5
    END,
    detected_at DESC;

-- Assign incident
UPDATE incidents
SET assigned_to = 'user-uuid', status = 'acknowledged', acknowledged_at = NOW()
WHERE id = 'incident-uuid';

-- Resolve incident
UPDATE incidents
SET
    status = 'resolved',
    resolved_at = NOW(),
    root_cause = 'Database connection pool exhaustion',
    resolution_notes = 'Increased pool size from 50 to 100'
WHERE id = 'incident-uuid';
```

### Audit Log Queries

```sql
-- Recent user activity
SELECT created_at, action, resource_type, description
FROM audit_logs
WHERE user_id = 'user-uuid'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- Failed login attempts
SELECT created_at, ip_address, user_agent, error_message
FROM audit_logs
WHERE action = 'login'
  AND success = false
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Resource access audit
SELECT
    created_at,
    u.email,
    action,
    description
FROM audit_logs a
JOIN users u ON a.user_id = u.id
WHERE resource_type = 'workflow'
  AND resource_id = 'workflow-uuid'
ORDER BY created_at DESC;
```

---

## Common Redis Commands

### Session Management

```redis
# Store session
HSET session:550e8400-e29b-41d4-a716-446655440000 \
    user_id "123e4567-e89b-12d3-a456-426614174000" \
    email "user@example.com" \
    role "developer" \
    created_at "2025-11-25T10:00:00Z"
EXPIRE session:550e8400-e29b-41d4-a716-446655440000 86400

# Get session
HGETALL session:550e8400-e29b-41d4-a716-446655440000

# Delete session
DEL session:550e8400-e29b-41d4-a716-446655440000

# Get session by token
GET session_token:abc123hash
# Returns: session-uuid
```

### Caching

```redis
# Cache query result
SET cache:query:sha256:abc123 '{"result": [...]}' EX 3600

# Get cached result
GET cache:query:sha256:abc123

# Invalidate cache by tag
SMEMBERS cache:tags:user:123e4567
# Returns list of cache keys
# Then: DEL cache:query:... for each key

# Cache statistics
HINCRBY cache:stats:global hits 1
HGETALL cache:stats:global
```

### Rate Limiting

```redis
# Check rate limit (sliding window)
# 1. Add current request
ZADD ratelimit:api:user:123e4567 1732537200000 "req:uuid1"

# 2. Remove old requests (older than 60 seconds)
ZREMRANGEBYSCORE ratelimit:api:user:123e4567 0 1732537140000

# 3. Count requests in window
ZCARD ratelimit:api:user:123e4567

# 4. Set TTL
EXPIRE ratelimit:api:user:123e4567 60
```

### Task Queue

```redis
# Add task to queue
RPUSH queue:workflow_executions '{"workflow_id": "...", "params": {...}}'

# Get queue length
LLEN queue:workflow_executions

# Worker: Get next task (blocking, 30s timeout)
BLPOP queue:workflow_executions 30

# Priority queue (sorted set)
ZADD queue:priority:workflows 1000 '{"id":"exec-1","priority":"high"}'
ZPOPMIN queue:priority:workflows 1
```

### Pub/Sub

```redis
# Publish event
PUBLISH incidents:alerts '{"incident_id": "inc-123", "severity": "critical"}'

# Subscribe to channel
SUBSCRIBE incidents:alerts

# Pattern subscription
PSUBSCRIBE incidents:*
```

---

## Qdrant Operations

### Create Collection

```bash
curl -X PUT http://localhost:6333/collections/code_embeddings \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 1536,
      "distance": "Cosine"
    }
  }'
```

### Insert Point

```bash
curl -X PUT http://localhost:6333/collections/code_embeddings/points \
  -H 'Content-Type: application/json' \
  -d '{
    "points": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "vector": [0.1, 0.2, ...],
        "payload": {
          "file_path": "/src/main.rs",
          "function_name": "handle_request",
          "language": "rust"
        }
      }
    ]
  }'
```

### Search

```bash
curl -X POST http://localhost:6333/collections/code_embeddings/points/search \
  -H 'Content-Type: application/json' \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 10,
    "with_payload": true,
    "filter": {
      "must": [
        {
          "key": "language",
          "match": {"value": "rust"}
        }
      ]
    }
  }'
```

---

## Backup and Restore Commands

### Backup

```bash
# Manual backup
/workspaces/llm-copilot-agent/scripts/backup_postgres.sh

# Check backup status
ls -lh /backup/postgresql/full_*

# Verify backup integrity
sha256sum -c /backup/postgresql/full_llm_copilot_agent_*.sha256

# Upload to S3
aws s3 cp /backup/postgresql/full_*.sql.gz \
    s3://llm-copilot-backups/postgresql/$(date +%Y/%m)/ \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256
```

### Restore

```bash
# Restore full backup
gunzip -c /backup/postgresql/full_*.sql.gz | pg_restore -C -d postgres

# Point-in-time recovery
# 1. Edit recovery.conf
cat > /var/lib/postgresql/14/main/recovery.conf <<EOF
restore_command = 'cp /backup/wal/%f %p'
recovery_target_time = '2025-11-25 14:00:00 UTC'
recovery_target_action = 'promote'
EOF

# 2. Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## Connection Strings

### PostgreSQL

```bash
# Standard format
postgresql://username:password@host:port/database

# Example (primary)
postgresql://llm_copilot_app:password@localhost:5432/llm_copilot_agent?sslmode=require

# Example (replica)
postgresql://llm_copilot_app:password@replica.db.internal:5432/llm_copilot_agent?sslmode=require

# With connection pool settings
postgresql://llm_copilot_app:password@localhost:5432/llm_copilot_agent?sslmode=require&application_name=llm_copilot&connect_timeout=30
```

### Redis

```bash
# Standard format
redis://[:password@]host:port/database

# Example
redis://:password@localhost:6379/0

# With TLS
rediss://:password@localhost:6379/0

# Cluster
redis://host1:6379,host2:6379,host3:6379
```

### Qdrant

```bash
# HTTP
http://localhost:6333

# HTTPS with API key
https://qdrant.example.com:6333
# Header: api-key: your-api-key-here
```

---

## Monitoring Queries

### Database Health

```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity WHERE datname = 'llm_copilot_agent';

-- Active queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- Database size
SELECT pg_size_pretty(pg_database_size('llm_copilot_agent'));

-- Table sizes
SELECT
    schemaname || '.' || tablename AS table,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Cache hit ratio (should be >99%)
SELECT
    round(sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100, 2) AS cache_hit_ratio
FROM pg_statio_user_tables;
```

### Replication Status

```sql
-- Primary: Check replication lag
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    pg_wal_lsn_diff(sent_lsn, write_lsn) AS lag_bytes
FROM pg_stat_replication;

-- Replica: Check if in recovery
SELECT pg_is_in_recovery();

-- Replica: Check lag
SELECT
    now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

### Redis Info

```redis
# Server info
INFO server

# Memory usage
INFO memory

# Connected clients
INFO clients

# Stats
INFO stats

# Replication status
INFO replication

# Keyspace statistics
INFO keyspace
```

---

## Troubleshooting

### PostgreSQL Not Responding

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check logs
tail -f /var/log/postgresql/postgresql-14-main.log

# Check connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Kill stuck query
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 12345;"

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Redis Not Responding

```bash
# Check if Redis is running
sudo systemctl status redis

# Test connection
redis-cli ping

# Check memory
redis-cli INFO memory

# Check slow log
redis-cli SLOWLOG GET 10

# Restart Redis
sudo systemctl restart redis
```

### Backup Failed

```bash
# Check disk space
df -h /backup

# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-14-main.log

# Verify credentials
pg_isready -h localhost -p 5432 -U postgres

# Manual backup test
pg_dump -U postgres llm_copilot_agent > /tmp/test_backup.sql
```

---

## Environment Variables

```bash
# PostgreSQL
export POSTGRES_PRIMARY_HOST=localhost
export POSTGRES_PRIMARY_PORT=5432
export POSTGRES_USER=llm_copilot_app
export POSTGRES_PASSWORD=your_password_here
export POSTGRES_DB=llm_copilot_agent
export POSTGRES_SSL_MODE=require

# Read Replica (optional)
export POSTGRES_REPLICA_ENABLED=false
export POSTGRES_REPLICA_HOST=replica.db.internal

# Redis
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=your_password_here
export REDIS_DB=0
export REDIS_TLS=false

# Qdrant
export QDRANT_URL=http://localhost:6333
export QDRANT_API_KEY=your_api_key_here

# Backup
export BACKUP_ENABLED=true
export BACKUP_S3_BUCKET=llm-copilot-backups
export BACKUP_S3_REGION=us-east-1

# Application
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_PRIMARY_HOST}:${POSTGRES_PRIMARY_PORT}/${POSTGRES_DB}?sslmode=${POSTGRES_SSL_MODE}"
export REDIS_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}"
```

---

## Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| Database connections | >80% of max | Scale up or add connection pooling |
| Cache hit ratio | <95% | Review caching strategy |
| Replication lag | >10 seconds | Investigate network/load issues |
| Disk usage | >80% | Cleanup or expand storage |
| Query duration (p95) | >1 second | Optimize queries or add indexes |
| Backup success rate | <99% | Review backup logs |
| Active sessions | Sudden spike | Check for DoS or bugs |

---

## Performance Targets

| Operation | Target Latency (p95) |
|-----------|---------------------|
| User login | <200ms |
| List workflows | <100ms |
| Execute workflow | <2000ms |
| Search conversations | <500ms |
| Vector search | <100ms |
| Cache GET | <1ms |
| Cache SET | <2ms |

---

## Emergency Contacts

```yaml
Database Issues:
  - Team: Data Platform
  - Slack: #data-platform
  - PagerDuty: data-platform-oncall

Backup/Recovery:
  - Team: Infrastructure
  - Slack: #infrastructure
  - PagerDuty: infra-oncall

Security Issues:
  - Team: Security
  - Slack: #security
  - Email: security@llm-copilot.dev
```

---

## Useful Links

- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Redis Commands](https://redis.io/commands/)
- [Qdrant API](https://qdrant.tech/documentation/quick-start/)
- [sqlx Documentation](https://docs.rs/sqlx/)
- [Internal Wiki](https://wiki.llm-copilot.dev/data-layer)

---

**Last Updated:** 2025-11-25
**Maintained By:** Data Platform Team
**Review Frequency:** Monthly
