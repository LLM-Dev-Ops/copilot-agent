# LLM CoPilot Agent - Deployment Architecture

Complete deployment and infrastructure architecture for production Kubernetes deployment.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Infrastructure Components](#infrastructure-components)
- [Deployment Strategies](#deployment-strategies)
- [Monitoring & Observability](#monitoring--observability)
- [High Availability](#high-availability)
- [Disaster Recovery](#disaster-recovery)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Internet / Users                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │   Route53 DNS    │ (Multi-region failover)
                    │   + Health Check │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  CloudFront CDN  │ (Optional)
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │ Region  │         │ Region  │         │ Region  │
   │us-east-1│         │us-west-2│         │eu-west-1│
   └────┬────┘         └────┬────┘         └────┬────┘
        │                   │                    │
┌───────▼──────────────────────────────────────────────────┐
│                    AWS Load Balancer                      │
│              (ALB/NLB with SSL Termination)              │
└───────┬──────────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────┐
│              Kubernetes Cluster (EKS)                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Istio Service Mesh                      │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │      LLM CoPilot Agent Pods (3-20)        │  │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │   │
│  │  │  │  Pod 1   │  │  Pod 2   │  │  Pod 3   │ │  │   │
│  │  │  │ Node.js  │  │ Node.js  │  │ Node.js  │ │  │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘ │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└───────┬──────────────┬──────────────┬────────────────────┘
        │              │              │
  ┌─────▼─────┐  ┌────▼────┐   ┌────▼─────┐
  │PostgreSQL │  │  Redis  │   │   S3     │
  │(RDS Multi-│  │ Cluster │   │ Backups  │
  │    AZ)    │  │ElastiCache  │          │
  │Primary+2  │  │  3 nodes│   │          │
  │ Replicas  │  │         │   │          │
  └───────────┘  └─────────┘   └──────────┘
```

### Observability Stack

```
┌─────────────────────────────────────────────────────┐
│              Observability Namespace                 │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │Prometheus│  │  Grafana │  │   Loki   │         │
│  │  Metrics │  │Dashboards│  │   Logs   │         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│       │             │             │                │
│  ┌────▼─────────────▼─────────────▼─────┐         │
│  │         Jaeger Tracing                │         │
│  │    (Distributed Trace Analysis)       │         │
│  └───────────────────────────────────────┘         │
│                                                      │
│  ┌───────────────────────────────────────┐         │
│  │      AlertManager                      │         │
│  │  (PagerDuty, Slack, Email)            │         │
│  └───────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools

- **kubectl**: v1.28+
- **helm**: v3.13+
- **terraform**: v1.5+
- **aws-cli**: v2.0+
- **docker**: v24+
- **argocd**: v2.8+ (optional, for GitOps)

### AWS Account Setup

```bash
# Configure AWS credentials
aws configure

# Required IAM permissions:
# - EKS full access
# - RDS full access
# - ElastiCache full access
# - S3 full access
# - VPC full access
# - IAM role creation
```

### Domain and SSL

- Domain name registered (e.g., llmdevops.io)
- AWS Route53 hosted zone created
- ACM certificate requested and validated

## Quick Start

### 1. Infrastructure Provisioning

```bash
# Navigate to Terraform directory
cd deployment/terraform

# Initialize Terraform
terraform init

# Plan infrastructure changes
terraform plan -var-file=environments/production/terraform.tfvars

# Apply infrastructure
terraform apply -var-file=environments/production/terraform.tfvars

# Get cluster credentials
aws eks update-kubeconfig --name llm-copilot-production --region us-east-1
```

### 2. Install Core Components

```bash
# Install metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Install cert-manager for TLS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace observability --create-namespace

# Install Istio (optional)
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH
istioctl install --set profile=production -y
```

### 3. Deploy Application

#### Option A: Using Helm

```bash
# Add custom values
helm install llm-copilot-agent ./deployment/helm/llm-copilot-agent \
  --namespace llm-copilot \
  --create-namespace \
  --values ./deployment/helm/llm-copilot-agent/values-production.yaml \
  --set image.tag=1.0.0
```

#### Option B: Using Kustomize

```bash
# Apply base manifests
kubectl apply -k deployment/kubernetes/base

# Apply production overlay
kubectl apply -k deployment/kubernetes/overlays/production
```

#### Option C: Using ArgoCD (GitOps)

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Deploy application
kubectl apply -f deployment/ci-cd/argocd-application.yaml

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n llm-copilot

# Check service endpoints
kubectl get svc -n llm-copilot

# Test health endpoint
kubectl run curl-test --rm -i --restart=Never --image=curlimages/curl:latest \
  -- curl -f http://llm-copilot-agent.llm-copilot.svc.cluster.local/health

# Check logs
kubectl logs -n llm-copilot -l app=llm-copilot-agent --tail=100
```

## Infrastructure Components

### 1. Container Architecture

**Multi-stage Dockerfile optimizations:**
- Base image: `node:20-alpine` (security-hardened)
- Non-root user (UID 1001)
- Layer caching optimization
- Health check integration
- Security scanning with Trivy

**Build:**
```bash
cd deployment/docker
docker build -t llm-copilot-agent:1.0.0 -f Dockerfile ../..
```

### 2. Kubernetes Resources

#### Core Manifests

| Resource | Purpose | HA Config |
|----------|---------|-----------|
| Deployment | Application pods | 3 replicas min |
| Service | Load balancing | ClusterIP + Session Affinity |
| ConfigMap | Configuration | Versioned |
| Secret | Credentials | External Secrets Operator |
| HPA | Auto-scaling | 3-20 replicas |
| PDB | Disruption budget | minAvailable: 2 |
| VPA | Resource right-sizing | Auto mode |

#### Networking

- **Ingress**: NGINX + TLS termination (Let's Encrypt)
- **Service Mesh**: Istio with mTLS
- **Network Policies**: Zero-trust security model
- **Load Balancing**: Consistent hash for session affinity

### 3. Data Layer

#### PostgreSQL (RDS)

```yaml
Configuration:
  - Engine: PostgreSQL 15.4
  - Instance: db.r6g.xlarge
  - Storage: 200GB gp3 (encrypted)
  - Multi-AZ: Enabled
  - Read Replicas: 2
  - Backup: 30 days retention
  - Performance Insights: Enabled
```

#### Redis (ElastiCache)

```yaml
Configuration:
  - Engine: Redis 7.0
  - Node Type: cache.r6g.xlarge
  - Cluster Mode: Enabled
  - Nodes: 3 (1 primary + 2 replicas)
  - Automatic Failover: Enabled
  - Encryption: At-rest + in-transit
  - Backup: Daily snapshots
```

## Deployment Strategies

### 1. Rolling Update (Default)

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0  # Zero-downtime
```

**Process:**
1. Create new pod
2. Wait for readiness
3. Remove old pod
4. Repeat

**Rollback:**
```bash
kubectl rollout undo deployment/llm-copilot-agent -n llm-copilot
```

### 2. Blue-Green Deployment

**Implementation:**
```bash
# Deploy green version
helm upgrade llm-copilot-agent-green ./deployment/helm/llm-copilot-agent \
  --set color=green \
  --set image.tag=2.0.0

# Switch traffic
kubectl patch service llm-copilot-agent -n llm-copilot \
  -p '{"spec":{"selector":{"color":"green"}}}'

# Cleanup blue
helm uninstall llm-copilot-agent-blue
```

### 3. Canary Deployment (Istio)

**Traffic Split:**
```yaml
# 90% stable, 10% canary
- route:
    - destination:
        host: llm-copilot-agent
        subset: stable
      weight: 90
    - destination:
        host: llm-copilot-agent
        subset: canary
      weight: 10
```

**Automated canary with Argo Rollouts:**
```bash
kubectl apply -f deployment/ci-cd/argocd-application.yaml
```

## Monitoring & Observability

### Metrics (Prometheus)

**Key Metrics:**
- Request rate, error rate, duration (RED)
- CPU, memory, network (USE)
- Business metrics (test generations, incidents detected)

**Access Grafana:**
```bash
kubectl port-forward -n observability svc/prometheus-grafana 3000:80
# Default: admin/prom-operator
```

### Logs (Loki)

**Query Examples:**
```logql
# Error logs
{namespace="llm-copilot", app="llm-copilot-agent", level="error"}

# Slow queries
{namespace="llm-copilot"} |= "duration_ms" | json | duration_ms > 1000
```

### Traces (Jaeger)

**Access Jaeger UI:**
```bash
kubectl port-forward -n observability svc/jaeger-query 16686:16686
```

### Alerts

**Critical Alerts:**
- Service down (>2min)
- High error rate (>5%)
- SLA breach (<99.9%)
- Database connection failures
- OOM kills

**Alert Routing:**
- Critical → PagerDuty
- Warning → Slack
- Info → Email

## High Availability

### Multi-Zone Deployment

**Topology Spread:**
```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
```

**Node Distribution:**
- Zone A: 2 nodes
- Zone B: 2 nodes
- Zone C: 1 node

### Database HA

**PostgreSQL:**
- Primary: us-east-1a
- Replica 1: us-east-1b
- Replica 2: us-east-1c
- Automatic failover: <60 seconds

**Redis:**
- Cluster mode with auto-sharding
- Sentinel for automatic failover
- Cross-AZ replication

### Load Balancing

**Strategy:**
- Session affinity for stateful operations
- Least connections for new sessions
- Health check every 30s

## Disaster Recovery

### Backup Strategy

**Database Backups:**
- Automated daily snapshots
- Point-in-time recovery (PITR)
- Cross-region replication
- 30-day retention

**Kubernetes Backups (Velero):**
```bash
# Daily backup
velero schedule create llm-copilot-daily \
  --schedule="0 1 * * *" \
  --include-namespaces llm-copilot \
  --ttl 720h
```

### Recovery Procedures

**RTO: 15 minutes | RPO: 1 hour**

**Restore from backup:**
```bash
# 1. Restore infrastructure
cd deployment/terraform
terraform apply

# 2. Restore Kubernetes resources
velero restore create --from-backup llm-copilot-daily-TIMESTAMP

# 3. Restore database
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier llm-copilot-restored \
  --db-snapshot-identifier llm-copilot-snapshot-TIMESTAMP

# 4. Verify application
kubectl rollout status deployment/llm-copilot-agent -n llm-copilot
```

### Multi-Region Failover

**DNS Failover (Route53):**
- Primary: us-east-1
- Secondary: us-west-2
- Health check interval: 30s
- Failover threshold: 3 failures

**Manual Failover:**
```bash
# Update DNS to point to secondary region
aws route53 change-resource-record-sets \
  --hosted-zone-id ZONE_ID \
  --change-batch file://failover-dns.json
```

## Security

### Network Security

- **TLS 1.2+** for all external connections
- **mTLS** for service-to-service communication
- **Network policies** for zero-trust networking
- **WAF** rules for common attacks

### Authentication & Authorization

- **RBAC** for Kubernetes access
- **IRSA** for AWS service access
- **JWT** for API authentication
- **OAuth2** for user authentication

### Secrets Management

**External Secrets Operator:**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: llm-copilot-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
```

### Compliance

- SOC 2 Type II
- GDPR compliant
- HIPAA eligible (with BAA)
- Audit logging enabled

## Troubleshooting

### Common Issues

#### Pods not starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n llm-copilot

# Check logs
kubectl logs <pod-name> -n llm-copilot --previous

# Check events
kubectl get events -n llm-copilot --sort-by='.lastTimestamp'
```

#### Database connection failures

```bash
# Test connectivity
kubectl run psql-test --rm -i --restart=Never \
  --image=postgres:15 -- \
  psql -h <rds-endpoint> -U llm_user -d llm_copilot -c "SELECT 1"

# Check security groups
aws ec2 describe-security-groups --group-ids <sg-id>
```

#### High memory usage

```bash
# Check resource usage
kubectl top pods -n llm-copilot

# Enable VPA for right-sizing
kubectl apply -f deployment/kubernetes/base/vpa.yaml

# Increase memory limits if needed
kubectl patch deployment llm-copilot-agent -n llm-copilot \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"llm-copilot-agent","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
```

#### Ingress not working

```bash
# Check ingress status
kubectl describe ingress llm-copilot-agent-ingress -n llm-copilot

# Check nginx controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Verify certificate
kubectl describe certificate llm-copilot-tls-cert -n llm-copilot
```

### Debug Mode

```bash
# Enable debug logging
kubectl set env deployment/llm-copilot-agent -n llm-copilot \
  LOG_LEVEL=debug

# Port-forward for local debugging
kubectl port-forward -n llm-copilot \
  svc/llm-copilot-agent 3000:80
```

### Performance Profiling

```bash
# CPU profiling
kubectl exec -it <pod-name> -n llm-copilot -- \
  node --prof app.js

# Memory heap dump
kubectl exec -it <pod-name> -n llm-copilot -- \
  node --heapsnapshot app.js
```

## Maintenance

### Cluster Upgrades

```bash
# Upgrade EKS cluster
eksctl upgrade cluster --name llm-copilot-production

# Upgrade node groups (one at a time)
eksctl upgrade nodegroup --cluster=llm-copilot-production \
  --name=general-nodes

# Update addons
eksctl update addon --cluster llm-copilot-production \
  --name vpc-cni --version latest
```

### Database Maintenance

```bash
# Apply minor version updates
aws rds modify-db-instance \
  --db-instance-identifier llm-copilot-postgres \
  --apply-immediately \
  --engine-version 15.5

# Create manual snapshot before major changes
aws rds create-db-snapshot \
  --db-instance-identifier llm-copilot-postgres \
  --db-snapshot-identifier manual-snapshot-$(date +%Y%m%d)
```

## Cost Optimization

### Resource Right-Sizing

- Enable VPA for automatic resource adjustment
- Use Spot instances for non-critical workloads
- Enable cluster autoscaler for dynamic scaling

### Storage Optimization

- Use lifecycle policies for S3 backups
- Enable compression for logs
- Archive old backups to Glacier

### Monitoring Costs

```bash
# AWS Cost Explorer API
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --filter file://cost-filter.json \
  --metrics "UnblendedCost"
```

## Support

- **Documentation**: https://docs.llmdevops.io
- **Issues**: https://github.com/llm-devops/llm-copilot-agent/issues
- **Slack**: #llm-copilot-support
- **Email**: devops@llmdevops.io
- **On-call**: PagerDuty rotation

## License

See [LICENSE.md](../LICENSE.md)
