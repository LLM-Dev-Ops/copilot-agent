# Monitoring & Alerting Quick Reference

**For:** On-call Engineers and SREs
**Last Updated:** 2025-11-25

## Emergency Contacts

| Severity | Contact Method | Response Time |
|----------|----------------|---------------|
| Critical | PagerDuty | Immediate |
| High | PagerDuty (business hours) + Slack | <1 hour |
| Warning | Slack #reliability | <4 hours |

## Dashboard Quick Access

```
Executive:   https://grafana.internal/d/executive-sla
Operations:  https://grafana.internal/d/operations-health
Debug:       https://grafana.internal/d/debug-detailed
Business:    https://grafana.internal/d/business-usage
```

## Critical Alerts Cheat Sheet

### ServiceDown
```bash
# Check pod status
kubectl get pods -n llm-copilot

# Check recent events
kubectl get events -n llm-copilot --sort-by='.lastTimestamp'

# Check logs
kubectl logs -n llm-copilot deployment/llm-copilot-agent --tail=100

# Immediate action: Restart if needed
kubectl rollout restart deployment/llm-copilot-agent -n llm-copilot
```

### SLOAvailabilityBreach
```promql
# Check current availability
sli:availability:ratio5m

# Check error rate
sli:error_rate:ratio5m

# Identify error sources
topk(5, sum by (endpoint) (rate(http_requests_total{status_code=~"5.."}[5m])))

# Recent deployments?
kubectl rollout history deployment/llm-copilot-agent -n llm-copilot
```

### HighErrorRate
```bash
# View error logs
kubectl logs -n llm-copilot deployment/llm-copilot-agent | grep -i error | tail -50

# Check via Loki
{service="llm-copilot-agent",level="ERROR"}

# Consider rollback
kubectl rollout undo deployment/llm-copilot-agent -n llm-copilot
```

### DatabaseDown
```bash
# Check database pod
kubectl get pods -n database -l app=postgresql

# Check connectivity
kubectl exec -it deployment/llm-copilot-agent -n llm-copilot -- psql -h postgres -U user -d db -c "SELECT 1"

# Check RDS status (AWS)
aws rds describe-db-instances --db-instance-identifier llm-copilot-db
```

## Key Prometheus Queries

### Current Availability
```promql
sli:availability:ratio5m
```

### Error Budget Remaining
```promql
slo:error_budget:remaining * 100
```

### Request Rate
```promql
sum(rate(http_requests_total[5m]))
```

### Error Rate
```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

### Top Slow Endpoints
```promql
topk(5, histogram_quantile(0.95, sum by (endpoint, le) (rate(http_request_duration_seconds_bucket[5m]))))
```

### Top Error Endpoints
```promql
topk(5, sum by (endpoint) (rate(http_requests_total{status_code=~"5.."}[5m])))
```

### LLM Cost Today
```promql
sum(increase(llm_cost_usd[24h]))
```

## Key Loki Queries

### Recent Errors
```logql
{service="llm-copilot-agent",level="ERROR"} | json
```

### Trace by Correlation ID
```logql
{service="llm-copilot-agent"} |= "correlation_id=YOUR_ID"
```

### Slow Requests
```logql
{service="llm-copilot-agent"} | json | duration_ms > 1000
```

### Database Errors
```logql
{service="llm-copilot-agent",component="database",level="ERROR"}
```

### LLM API Errors
```logql
{service="llm-copilot-agent",component="llm-client",level="ERROR"}
```

## Key Jaeger Queries

### Slow Traces
```
duration > 2s
```

### Error Traces
```
error=true
```

### Traces for User
```
user.id=USER_ID
```

### LLM Traces
```
span.name=~'LLM.*'
```

## Common Troubleshooting

### High Latency
1. Check p95 latency by endpoint
2. Look for slow database queries
3. Check LLM API latency
4. Review event loop lag
5. Check for CPU/memory pressure

### High Error Rate
1. Check error logs for patterns
2. Review recent deployments
3. Check dependency health (DB, Redis, modules)
4. Verify LLM API status
5. Check for configuration issues

### Memory Issues
1. Check current memory usage
2. Look for memory leaks (trend over time)
3. Review GC metrics
4. Check for memory-intensive operations
5. Consider increasing limits or scaling

### Database Issues
1. Check connection pool utilization
2. Look for slow queries
3. Verify database health
4. Check for deadlocks
5. Review query patterns

## Rollback Procedure

```bash
# 1. Check rollout history
kubectl rollout history deployment/llm-copilot-agent -n llm-copilot

# 2. Rollback to previous version
kubectl rollout undo deployment/llm-copilot-agent -n llm-copilot

# 3. Or rollback to specific revision
kubectl rollout undo deployment/llm-copilot-agent -n llm-copilot --to-revision=5

# 4. Monitor rollout
kubectl rollout status deployment/llm-copilot-agent -n llm-copilot

# 5. Verify health
kubectl get pods -n llm-copilot
```

## Scaling Commands

```bash
# Manual scale up
kubectl scale deployment/llm-copilot-agent -n llm-copilot --replicas=10

# Check HPA status
kubectl get hpa -n llm-copilot

# Check current pod count
kubectl get pods -n llm-copilot -l app=llm-copilot-agent
```

## Log Access

```bash
# Follow logs (all pods)
kubectl logs -f deployment/llm-copilot-agent -n llm-copilot

# Specific pod
kubectl logs -f POD_NAME -n llm-copilot

# Previous container (if crashed)
kubectl logs POD_NAME -n llm-copilot --previous

# Last 100 lines
kubectl logs deployment/llm-copilot-agent -n llm-copilot --tail=100

# Filter for errors
kubectl logs deployment/llm-copilot-agent -n llm-copilot | grep '"level":"ERROR"'
```

## Metric Troubleshooting

```bash
# Check if metrics endpoint is working
kubectl port-forward deployment/llm-copilot-agent 3000:3000 -n llm-copilot
curl http://localhost:3000/metrics

# Check Prometheus targets
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Open http://localhost:9090/targets

# Check ServiceMonitor
kubectl get servicemonitor -n monitoring
kubectl describe servicemonitor llm-copilot-agent -n monitoring
```

## SLO Status

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Availability | 99.9% | 99.95% | ✅ |
| Latency (Simple) | p95 <1s | 450ms | ✅ |
| Latency (Complex) | p95 <2s | 1.2s | ✅ |
| Error Rate | <0.1% | 0.03% | ✅ |
| Error Budget | N/A | 72% remaining | ✅ |

Check current status: https://grafana.internal/d/executive-sla

## Escalation Path

1. **L1:** On-call engineer (immediate response)
2. **L2:** Senior SRE (after 15 minutes)
3. **L3:** Engineering lead (after 30 minutes)
4. **L4:** CTO (for extended outages)

## Maintenance Windows

- **Weekly:** Sunday 2-4am EST (low-priority deployments)
- **Monthly:** First Sunday 2-4am EST (infrastructure updates)

During maintenance:
- Non-critical alerts are suppressed
- Status page updated
- Engineering team on standby

## Useful Commands Summary

```bash
# Health check
kubectl get pods -n llm-copilot

# Logs
kubectl logs -f deployment/llm-copilot-agent -n llm-copilot --tail=50

# Restart
kubectl rollout restart deployment/llm-copilot-agent -n llm-copilot

# Rollback
kubectl rollout undo deployment/llm-copilot-agent -n llm-copilot

# Scale
kubectl scale deployment/llm-copilot-agent -n llm-copilot --replicas=5

# Describe (detailed info)
kubectl describe deployment llm-copilot-agent -n llm-copilot

# Events
kubectl get events -n llm-copilot --sort-by='.lastTimestamp' | head -20

# Port forward
kubectl port-forward deployment/llm-copilot-agent 3000:3000 -n llm-copilot
```

## Remember

1. **Safety first:** If unsure, escalate immediately
2. **Document actions:** Update incident ticket with all steps taken
3. **Communicate:** Keep stakeholders informed via #incidents channel
4. **Preserve evidence:** Capture logs/metrics before making changes
5. **Follow runbooks:** Each alert has a linked runbook

## Quick Links

- **Runbooks:** https://wiki.internal/runbooks/
- **Incident Response:** https://wiki.internal/incident-response
- **Status Page:** https://status.llm-copilot-agent.com
- **Slack #incidents:** https://company.slack.com/archives/incidents
- **PagerDuty:** https://company.pagerduty.com

---

**Print this page and keep it handy during on-call shifts!**
