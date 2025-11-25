# Deployment Files Index

Complete index of all deployment and infrastructure files created for LLM-CoPilot-Agent.

## Directory Structure

```
deployment/
├── README.md                                    # Main deployment guide
├── DEPLOYMENT-FILES-INDEX.md                   # This file
│
├── docker/                                      # Container configuration
│   ├── Dockerfile                              # Multi-stage production build
│   └── .dockerignore                           # Build exclusions
│
├── kubernetes/                                  # Kubernetes manifests
│   ├── base/                                   # Base configurations
│   │   ├── namespace.yaml                      # Namespace with Istio injection
│   │   ├── configmap.yaml                      # Application configuration
│   │   ├── secret.yaml                         # Secrets (with External Secrets)
│   │   ├── deployment.yaml                     # Application deployment
│   │   ├── service.yaml                        # Service definitions
│   │   ├── serviceaccount.yaml                 # RBAC configuration
│   │   ├── hpa.yaml                            # Horizontal Pod Autoscaler
│   │   ├── pdb.yaml                            # Pod Disruption Budget
│   │   ├── vpa.yaml                            # Vertical Pod Autoscaler
│   │   ├── ingress.yaml                        # Ingress + ALB configs
│   │   ├── networkpolicy.yaml                  # Network policies
│   │   ├── istio-virtualservice.yaml           # Service mesh configuration
│   │   ├── postgres-ha.yaml                    # PostgreSQL HA setup
│   │   ├── redis-cluster.yaml                  # Redis cluster setup
│   │   └── disaster-recovery.yaml              # Velero backup configs
│   │
│   └── overlays/                               # Environment-specific overlays
│       ├── dev/                                # Development environment
│       ├── staging/                            # Staging environment
│       └── production/                         # Production environment
│
├── helm/                                        # Helm charts
│   └── llm-copilot-agent/
│       ├── Chart.yaml                          # Chart metadata
│       ├── values.yaml                         # Default values
│       ├── templates/                          # Kubernetes templates
│       │   └── _helpers.tpl                    # Template helpers
│       └── charts/                             # Sub-charts
│
├── terraform/                                   # Infrastructure as Code
│   ├── main.tf                                 # Main configuration
│   ├── variables.tf                            # Input variables
│   ├── modules/                                # Terraform modules
│   │   └── eks/
│   │       ├── main.tf                         # EKS cluster module
│   │       └── variables.tf                    # Module variables
│   └── environments/                           # Environment configs
│       ├── dev/
│       ├── staging/
│       └── production/
│           └── terraform.tfvars                # Production variables
│
├── ci-cd/                                       # CI/CD pipelines
│   ├── github-actions-ci.yaml                  # CI pipeline
│   ├── github-actions-cd.yaml                  # CD pipeline (blue-green, canary)
│   └── argocd-application.yaml                 # GitOps application
│
└── observability/                               # Monitoring configurations
    ├── prometheus-config.yaml                   # Metrics collection + alerts
    ├── grafana-dashboard.json                   # Grafana dashboard
    ├── loki-config.yaml                         # Log aggregation
    └── jaeger-config.yaml                       # Distributed tracing
```

## File Descriptions

### Container Architecture

#### `docker/Dockerfile`
- **Purpose:** Multi-stage Docker build for production
- **Features:**
  - Security-hardened Alpine base
  - Non-root user execution
  - Health check configuration
  - Layer optimization
- **Usage:** `docker build -t llm-copilot-agent:1.0.0 -f deployment/docker/Dockerfile .`

#### `docker/.dockerignore`
- **Purpose:** Exclude unnecessary files from Docker build
- **Excludes:** Git, tests, docs, deployment configs, node_modules, etc.

---

### Kubernetes Manifests

#### Core Resources

**`namespace.yaml`**
- Namespace: `llm-copilot`
- Istio injection enabled
- Proper labeling for service mesh

**`configmap.yaml`**
- Application environment variables
- Feature flags
- Performance tuning parameters
- Module integration endpoints

**`secret.yaml`**
- Database credentials
- Redis password
- API keys (LLM providers)
- JWT secrets
- External Secrets Operator integration

**`deployment.yaml`**
- 3+ replicas for HA
- Rolling update strategy (maxUnavailable: 0)
- Security context (non-root, read-only filesystem)
- Resource requests/limits
- Health probes (liveness, readiness, startup)
- Init containers for dependency checks
- Topology spread constraints

**`service.yaml`**
- ClusterIP service with session affinity
- Metrics port exposure
- Headless service for StatefulSet

**`serviceaccount.yaml`**
- RBAC configuration
- IRSA annotations for AWS
- Role and RoleBinding

#### Auto-Scaling

**`hpa.yaml`**
- Min: 3, Max: 20 replicas
- CPU target: 70%
- Memory target: 80%
- Custom metrics support
- Scale-down stabilization: 5 minutes

**`pdb.yaml`**
- Minimum available: 2 pods
- Prevents complete service disruption

**`vpa.yaml`**
- Automatic resource right-sizing
- Min: 250m CPU, 256Mi memory
- Max: 4000m CPU, 4Gi memory

#### Networking

**`ingress.yaml`**
- NGINX Ingress with TLS
- Rate limiting (100 req/s)
- CORS configuration
- Security headers
- AWS ALB alternative

**`networkpolicy.yaml`**
- Default deny all
- Explicit allow rules for:
  - Ingress controller
  - Module communication
  - DNS
  - Database/Redis
  - External APIs
  - Prometheus

**`istio-virtualservice.yaml`**
- Traffic routing rules
- Circuit breaker configuration
- mTLS peer authentication
- Authorization policies
- Gateway configuration

#### High Availability

**`postgres-ha.yaml`**
- Zalando PostgreSQL Operator
- 3 instances (1 primary + 2 replicas)
- Patroni for automatic failover
- PgBouncer connection pooler
- Prometheus exporter
- Backup configuration

**`redis-cluster.yaml`**
- Redis Cluster mode (3 masters)
- Automatic sharding
- Redis Sentinel alternative
- Daily backups to S3
- Prometheus exporter

**`disaster-recovery.yaml`**
- Velero backup schedules
- Daily backups (30-day retention)
- Weekly full backups (90-day retention)
- Multi-region configuration
- DR runbook
- External-DNS for failover

---

### Helm Charts

**`helm/llm-copilot-agent/Chart.yaml`**
- Chart metadata and dependencies
- PostgreSQL dependency (Bitnami)
- Redis dependency (Bitnami)

**`helm/llm-copilot-agent/values.yaml`**
- Default configuration values
- Environment-specific overrides
- Resource specifications
- Feature toggles

**`helm/llm-copilot-agent/templates/_helpers.tpl`**
- Template helper functions
- Name generators
- Label generators
- Database/Redis connection helpers

---

### Terraform Infrastructure

**`terraform/main.tf`**
- Complete infrastructure definition
- Modules: VPC, EKS, RDS, ElastiCache, S3
- IAM roles for IRSA
- KMS encryption keys
- Backend configuration (S3 + DynamoDB)

**`terraform/variables.tf`**
- Input variable definitions
- Validation rules
- Default values

**`terraform/modules/eks/main.tf`**
- EKS cluster configuration
- Managed node groups
- Cluster addons
- IAM policies for autoscaler and EBS CSI

**`terraform/modules/eks/variables.tf`**
- EKS module variables

**`terraform/environments/production/terraform.tfvars`**
- Production-specific values
- Resource sizing
- Backup retention
- Tags

---

### CI/CD Pipelines

**`ci-cd/github-actions-ci.yaml`**
- Continuous Integration pipeline
- Jobs:
  1. Lint and code quality
  2. Unit tests with coverage
  3. Integration tests (PostgreSQL + Redis)
  4. Security scanning (npm audit, Snyk, Trivy)
  5. Docker image build (multi-platform)
  6. Image vulnerability scanning
  7. Performance tests (k6)

**`ci-cd/github-actions-cd.yaml`**
- Continuous Deployment pipeline
- Environments: dev, staging, production
- Deployment strategies:
  - Rolling update (dev, staging)
  - Blue-green (production)
  - Canary (production, optional)
- Automated smoke tests
- Automated rollback on failures
- Slack notifications

**`ci-cd/argocd-application.yaml`**
- GitOps application definition
- Auto-sync configuration
- Progressive delivery with Argo Rollouts
- Canary analysis templates
- Health assessment rules

---

### Observability

**`observability/prometheus-config.yaml`**
- ServiceMonitor for automatic discovery
- PodMonitor for direct pod scraping
- PrometheusRule with alerts:
  - High error rate
  - Service down
  - High latency
  - Resource exhaustion
  - SLA breach
- Recording rules for common queries

**`observability/grafana-dashboard.json`**
- Pre-configured dashboard with panels:
  - Service health metrics
  - Resource usage
  - Dependency status
  - Business metrics
- Template variables for filtering
- Deployment annotations

**`observability/loki-config.yaml`**
- Loki server configuration
- Promtail for log collection
- S3 storage backend
- Log-based alerts:
  - High error log rate
  - Critical errors
  - Database connection errors
  - OOM kills

**`observability/jaeger-config.yaml`**
- Jaeger all-in-one (dev)
- Production deployment with operator
- Elasticsearch storage
- Collector auto-scaling
- Sampling configuration
- 7-day retention

---

## Usage Examples

### Deploy with Kubectl

```bash
# Deploy all base manifests
kubectl apply -k deployment/kubernetes/base

# Deploy with environment overlay
kubectl apply -k deployment/kubernetes/overlays/production
```

### Deploy with Helm

```bash
# Install chart
helm install llm-copilot-agent deployment/helm/llm-copilot-agent \
  --namespace llm-copilot \
  --create-namespace \
  --values deployment/helm/llm-copilot-agent/values-production.yaml

# Upgrade chart
helm upgrade llm-copilot-agent deployment/helm/llm-copilot-agent \
  --namespace llm-copilot \
  --values deployment/helm/llm-copilot-agent/values-production.yaml
```

### Provision Infrastructure with Terraform

```bash
# Navigate to Terraform directory
cd deployment/terraform

# Initialize
terraform init

# Plan
terraform plan -var-file=environments/production/terraform.tfvars

# Apply
terraform apply -var-file=environments/production/terraform.tfvars
```

### Deploy with ArgoCD

```bash
# Apply ArgoCD application
kubectl apply -f deployment/ci-cd/argocd-application.yaml

# Sync application
argocd app sync llm-copilot-agent

# Monitor deployment
argocd app get llm-copilot-agent
```

---

## Key Features by File

### High Availability
- `deployment.yaml`: Multi-replica, anti-affinity
- `hpa.yaml`: Auto-scaling 3-20 replicas
- `pdb.yaml`: Prevent complete outage
- `postgres-ha.yaml`: Multi-AZ, automatic failover
- `redis-cluster.yaml`: Cluster mode with replication

### Zero-Downtime Deployments
- `deployment.yaml`: maxUnavailable: 0
- `github-actions-cd.yaml`: Blue-green, canary strategies
- `argocd-application.yaml`: Progressive delivery
- `hpa.yaml`: Gradual scale-down

### Security
- `Dockerfile`: Non-root user, read-only filesystem
- `networkpolicy.yaml`: Zero-trust networking
- `istio-virtualservice.yaml`: mTLS, authorization
- `secret.yaml`: External Secrets Operator
- `serviceaccount.yaml`: RBAC, IRSA

### Observability
- `prometheus-config.yaml`: Comprehensive metrics and alerts
- `grafana-dashboard.json`: Pre-built dashboards
- `loki-config.yaml`: Centralized logging
- `jaeger-config.yaml`: Distributed tracing

### Disaster Recovery
- `disaster-recovery.yaml`: Velero backups, multi-region failover
- `postgres-ha.yaml`: Automated backups, PITR
- `redis-cluster.yaml`: Daily snapshots, AOF persistence

---

## Environment-Specific Configurations

### Development
- Single AZ deployment
- Smaller instance sizes
- 1-day backup retention
- Spot instances allowed

### Staging
- 2 AZ deployment
- Medium instance sizes
- 7-day backup retention
- Mirrors production topology

### Production
- 3 AZ deployment
- Large instance sizes
- 30-day backup retention
- Reserved instances
- Enhanced monitoring
- Multi-region failover

---

## Next Steps

1. **Customize configurations** for your environment
2. **Set up AWS account** and credentials
3. **Register domain** and configure DNS
4. **Provision infrastructure** with Terraform
5. **Deploy application** with Helm or ArgoCD
6. **Configure monitoring** dashboards and alerts
7. **Test DR procedures** quarterly
8. **Set up CI/CD** pipelines in GitHub Actions

---

## Support

- **Documentation**: See `deployment/README.md` for detailed guide
- **Architecture**: See `DEPLOYMENT-ARCHITECTURE.md` for complete architecture
- **Issues**: Report via GitHub Issues
- **Questions**: Contact DevOps team

---

**Last Updated:** 2025-11-25
**Maintained By:** DevOps Team
