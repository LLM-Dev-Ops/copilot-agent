# LLM-CoPilot-Agent Monitoring and Alerting

**Version:** 1.0.0
**Last Updated:** 2025-11-25
**Owner:** SRE Team

## Overview

This directory contains the complete monitoring and alerting configuration for LLM-CoPilot-Agent, designed to support a 99.9% uptime SLA with comprehensive observability across metrics, logs, and traces.

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration Files](#configuration-files)
- [SLA and SLO Summary](#sla-and-slo-summary)
- [Alert Severity Levels](#alert-severity-levels)
- [Dashboard Access](#dashboard-access)
- [Runbook Links](#runbook-links)
- [Troubleshooting](#troubleshooting)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM-CoPilot-Agent                             │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Metrics    │  │     Logs     │  │    Traces    │          │
│  │ (Prometheus) │  │   (Loki)     │  │  (Jaeger)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenTelemetry Collector                       │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Processors  │  │   Exporters  │  │   Receivers  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────┬───────────────────┬───────────────────┬───────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Prometheus    │  │      Loki       │  │     Jaeger      │
│   (Metrics)     │  │  (Log Aggr.)    │  │    (Traces)     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         ▼                    │                     │
┌─────────────────┐           │                     │
│  Alertmanager   │           │                     │
│  (Alerting)     │           │                     │
└────────┬────────┘           │                     │
         │                    │                     │
         ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Grafana                                  │
│                   (Visualization & Dashboards)                   │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Executive   │  │  Operations  │  │    Debug     │          │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────┬───────────────────┬───────────────────┬───────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PagerDuty     │  │      Slack      │  │     Email       │
│  (On-call)      │  │  (Notifications)│  │  (Reports)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Quick Start

### Prerequisites

- Kubernetes cluster (1.24+)
- Prometheus Operator installed
- Loki stack deployed
- Jaeger Operator installed
- Grafana (v10.0+)

### Installation

1. **Apply Prometheus Configuration**

```bash
# Create namespace
kubectl create namespace monitoring

# Apply ServiceMonitor
kubectl apply -f prometheus-servicemonitor.yaml

# Apply recording rules
kubectl apply -f prometheus-recording-rules.yaml

# Apply alert rules
kubectl apply -f prometheus-alert-rules.yaml
```

2. **Configure Alertmanager**

```bash
# Create secret with sensitive credentials
kubectl create secret generic alertmanager-config \
  --from-file=alertmanager.yaml=alertmanager-config.yaml \
  --namespace monitoring

# Apply Alertmanager configuration
kubectl apply -f alertmanager-deployment.yaml
```

3. **Deploy Loki**

```bash
# Apply Loki configuration
kubectl apply -f loki-config.yaml

# Deploy Promtail for log collection
kubectl apply -f promtail-daemonset.yaml
```

4. **Deploy Jaeger**

```bash
# Apply Jaeger configuration
kubectl apply -f jaeger-config.yaml
```

5. **Import Grafana Dashboards**

```bash
# Import dashboards via Grafana API
curl -X POST http://grafana.monitoring.svc.cluster.local/api/dashboards/import \
  -H "Content-Type: application/json" \
  -d @grafana-dashboards.json
```

6. **Configure Application Instrumentation**

```bash
# Set environment variables in deployment
kubectl set env deployment/llm-copilot-agent \
  OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.monitoring.svc.cluster.local:4317 \
  OTEL_SERVICE_NAME=llm-copilot-agent \
  OTEL_TRACES_SAMPLER=parentbased_traceidratio \
  OTEL_TRACES_SAMPLER_ARG=0.1
```

## Configuration Files

### Core Configuration

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `metrics-catalog.yaml` | Metric definitions and metadata | Quarterly |
| `sli-slo-definitions.yaml` | SLI/SLO targets and error budgets | Monthly |
| `prometheus-recording-rules.yaml` | Pre-computed metrics | As needed |
| `prometheus-alert-rules.yaml` | Alert definitions | Weekly |
| `alertmanager-config.yaml` | Alert routing and notifications | As needed |
| `grafana-dashboards.json` | Dashboard definitions | As needed |
| `log-aggregation-config.yaml` | Structured logging format | Quarterly |
| `distributed-tracing-config.yaml` | OpenTelemetry configuration | Quarterly |

### Implementation Examples

See the `examples/` directory for:
- Node.js instrumentation code
- Metric collection examples
- Log formatting examples
- Trace creation examples

## SLA and SLO Summary

### Service Level Agreement (SLA)

- **Target:** 99.9% uptime (monthly)
- **Allowed Downtime:** 43.2 minutes per month
- **Measurement:** Request-based availability

### Service Level Objectives (SLOs)

| SLO | Target | Measurement Window | Current Status |
|-----|--------|-------------------|----------------|
| **Availability** | 99.9% | 30 days | ✅ 99.95% |
| **Latency (Simple)** | p95 < 1s | 30 days | ✅ 450ms |
| **Latency (Complex)** | p95 < 2s | 30 days | ✅ 1.2s |
| **Error Rate** | < 0.1% | 30 days | ✅ 0.03% |

### Error Budget Status

- **Current Month:** 72% remaining
- **Burn Rate:** 0.8x (healthy)
- **Status:** 🟢 Green

## Alert Severity Levels

### Critical (Page Immediately - 24/7)

Alerts that require immediate attention and indicate service-impacting issues.

| Alert | Condition | Impact |
|-------|-----------|--------|
| ServiceDown | Service unavailable for 2+ minutes | Complete outage |
| NoHealthyPods | All pods unhealthy | Complete outage |
| SLOAvailabilityBreach | Availability < 99.9% for 5min | SLA at risk |
| HighErrorRate | Error rate > 5% for 5min | Significant user impact |
| DatabaseDown | Database unavailable for 1min | Data operations failing |
| ErrorBudgetBurnRateCritical | Budget exhausted in 1 hour | SLO breach imminent |

**Response Time:** Immediate
**Notification:** PagerDuty + Slack #incidents
**Escalation:** After 15 minutes

### High (Page During Business Hours)

Alerts that indicate degraded service but with partial functionality.

| Alert | Condition | Impact |
|-------|-----------|--------|
| HighLatencySimpleRequests | p95 > 1s for 10min | Poor user experience |
| HighLatencyComplexRequests | p95 > 2s for 10min | Slow operations |
| ModuleIntegrationFailure | Success rate < 90% | Degraded features |
| LLMAPIHighErrorRate | LLM errors > 10% | AI features failing |
| ErrorBudgetBurnRateHigh | Budget exhausted in 6 hours | SLO at risk |

**Response Time:** < 1 hour
**Notification:** PagerDuty (business hours) + Slack #reliability
**Escalation:** After 30 minutes

### Warning (Notify via Slack)

Alerts that indicate potential issues requiring attention.

| Alert | Condition | Impact |
|-------|-----------|--------|
| HighCPUUsage | CPU > 80% for 15min | Performance risk |
| HighMemoryUsage | Memory > 80% for 15min | OOM risk |
| LowCacheHitRate | Cache hit rate < 70% | Increased latency |
| ErrorBudget50PercentConsumed | 50% budget used | Planning needed |
| SlowDatabaseQueries | Slow queries detected | Potential bottleneck |

**Response Time:** < 4 hours
**Notification:** Slack #reliability
**Escalation:** None

### Info (Log Only)

Informational alerts for awareness.

| Alert | Condition | Impact |
|-------|-----------|--------|
| NewVersionDeployed | Deployment completed | None |
| AutoScalingEvent | Replica count changed | None |
| ErrorBudget25PercentConsumed | 25% budget used | None |

**Response Time:** N/A
**Notification:** Dashboard only
**Escalation:** None

## Dashboard Access

### Grafana Dashboards

| Dashboard | URL | Purpose | Audience |
|-----------|-----|---------|----------|
| Executive Dashboard | `/d/executive-sla` | SLA compliance overview | Leadership |
| Operations Dashboard | `/d/operations-health` | Real-time service health | SRE/On-call |
| Debug Dashboard | `/d/debug-detailed` | Detailed troubleshooting | Engineers |
| Business Dashboard | `/d/business-usage` | Usage and cost metrics | Product/Finance |

### Direct Links (Internal)

- **Grafana:** https://grafana.monitoring.internal
- **Prometheus:** https://prometheus.monitoring.internal
- **Alertmanager:** https://alertmanager.monitoring.internal
- **Jaeger:** https://jaeger.monitoring.internal

### Public Status Page

- **URL:** https://status.llm-copilot-agent.com
- **Update Frequency:** Real-time
- **Historical Data:** 90 days

## Runbook Links

Critical alerts include links to runbooks for quick resolution:

| Alert | Runbook |
|-------|---------|
| ServiceDown | [Service Down Runbook](https://wiki.internal/runbooks/service-down) |
| SLOBreach | [SLO Breach Response](https://wiki.internal/runbooks/slo-breach) |
| HighErrorRate | [High Error Rate Investigation](https://wiki.internal/runbooks/high-error-rate) |
| DatabaseIssues | [Database Troubleshooting](https://wiki.internal/runbooks/database-issues) |
| LLMAPIFailures | [LLM API Failure Response](https://wiki.internal/runbooks/llm-api-failures) |

## Key Queries

### Prometheus Queries

**Availability SLI:**
```promql
sum(rate(http_requests_total{status_code=~"2..|3..|429"}[5m]))
/
sum(rate(http_requests_total[5m]))
```

**Latency p95:**
```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

**Error Rate:**
```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

**Error Budget Remaining:**
```promql
1 - (
  (1 - sli:availability:ratio30d)
  /
  (1 - 0.999)
)
```

### Loki Queries

**All errors in last hour:**
```logql
{service="llm-copilot-agent",level="ERROR"}
```

**Trace by correlation ID:**
```logql
{service="llm-copilot-agent"} |= "correlation_id=550e8400"
```

**Slow requests (>1s):**
```logql
{service="llm-copilot-agent"} | json | duration_ms > 1000
```

### Jaeger Queries

**Find slow traces:**
```
duration > 2s
```

**Find traces with errors:**
```
error=true
```

**Find LLM API calls:**
```
span.name=~'LLM.*'
```

## Troubleshooting

### Common Issues

#### 1. Metrics Not Appearing in Prometheus

**Symptoms:** Missing metrics in Grafana dashboards

**Diagnosis:**
```bash
# Check if ServiceMonitor is created
kubectl get servicemonitor -n monitoring

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Open http://localhost:9090/targets

# Check application metrics endpoint
kubectl port-forward deployment/llm-copilot-agent 3000:3000
curl http://localhost:3000/metrics
```

**Resolution:**
- Verify ServiceMonitor labels match Prometheus selector
- Ensure application exposes /metrics endpoint
- Check network policies allow Prometheus scraping

#### 2. Alerts Not Firing

**Symptoms:** Expected alerts not triggering

**Diagnosis:**
```bash
# Check alert rules are loaded
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Open http://localhost:9090/rules

# Check alert state
# Open http://localhost:9090/alerts

# Test alert expression
# Use Prometheus UI to run alert query
```

**Resolution:**
- Verify alert rules are syntactically correct
- Check if recording rules are evaluating
- Ensure alert thresholds are appropriate

#### 3. Logs Not Showing in Loki

**Symptoms:** Missing logs in Grafana Explore

**Diagnosis:**
```bash
# Check Promtail is running
kubectl get pods -n monitoring -l app=promtail

# Check Promtail logs
kubectl logs -n monitoring -l app=promtail

# Test Loki ingestion
kubectl port-forward -n monitoring svc/loki 3100:3100
curl http://localhost:3100/loki/api/v1/label
```

**Resolution:**
- Verify Promtail DaemonSet is running on all nodes
- Check Promtail configuration for correct log paths
- Ensure Loki has sufficient storage

#### 4. Traces Not Appearing in Jaeger

**Symptoms:** Missing traces in Jaeger UI

**Diagnosis:**
```bash
# Check Jaeger collector is running
kubectl get pods -n monitoring -l app=jaeger-collector

# Check application tracing configuration
kubectl get deployment llm-copilot-agent -o yaml | grep OTEL

# Test trace export
kubectl logs deployment/llm-copilot-agent | grep trace
```

**Resolution:**
- Verify OpenTelemetry SDK is initialized
- Check OTEL_EXPORTER_OTLP_ENDPOINT is correct
- Ensure sampling rate is not too low for testing

### Performance Optimization

#### Reducing Metric Cardinality

If Prometheus memory usage is high:

1. Review high-cardinality metrics:
```promql
topk(10, count by (__name__)({__name__=~".+"}))
```

2. Adjust metric labels to reduce cardinality
3. Use recording rules to pre-aggregate
4. Increase Prometheus retention period

#### Optimizing Log Volume

If log storage costs are high:

1. Review log volume by level:
```logql
sum(count_over_time({service="llm-copilot-agent"}[1h])) by (level)
```

2. Implement sampling for high-volume logs
3. Reduce DEBUG logging in production
4. Adjust retention policies

## Maintenance

### Regular Tasks

**Daily:**
- Review critical alerts
- Check dashboard for anomalies
- Verify error budget status

**Weekly:**
- Review alert fatigue (false positives)
- Update alert thresholds if needed
- Check storage usage

**Monthly:**
- Review SLO compliance
- Update error budget policy
- Audit alert effectiveness

**Quarterly:**
- Update metrics catalog
- Review and optimize recording rules
- Update dashboard panels
- Capacity planning review

### Updating Configuration

1. Make changes to YAML files
2. Validate syntax: `promtool check config prometheus.yml`
3. Test in staging environment
4. Apply to production with change management
5. Monitor for issues after deployment

## Support

### Contact Information

- **On-Call Engineer:** PagerDuty rotation
- **SRE Team:** sre-team@internal.com
- **Slack Channels:**
  - #incidents (critical alerts)
  - #reliability (warnings)
  - #monitoring-help (questions)

### Documentation

- [Monitoring Strategy](https://wiki.internal/monitoring/strategy)
- [SLO Guidelines](https://wiki.internal/slo/guidelines)
- [Runbook Index](https://wiki.internal/runbooks/)
- [Incident Response](https://wiki.internal/incident-response)

### Training

- [Prometheus Training](https://wiki.internal/training/prometheus)
- [Grafana Workshop](https://wiki.internal/training/grafana)
- [On-Call Training](https://wiki.internal/training/on-call)

---

**Last Review:** 2025-11-25
**Next Review:** 2025-12-25
**Document Owner:** SRE Team
