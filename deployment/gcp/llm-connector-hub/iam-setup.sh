#!/bin/bash
# =============================================================================
# LLM-CONNECTOR-HUB IAM SETUP
# Google Cloud IAM configuration with least privilege
# =============================================================================

set -e

PROJECT_ID="${PROJECT_ID:-agentics-dev}"
REGION="${REGION:-us-central1}"
SERVICE_ACCOUNT_NAME="llm-connector-hub-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           LLM-CONNECTOR-HUB IAM SETUP                             ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  Project: ${PROJECT_ID}"
echo "║  Region:  ${REGION}"
echo "║  SA:      ${SERVICE_ACCOUNT_EMAIL}"
echo "╚═══════════════════════════════════════════════════════════════════╝"

# =============================================================================
# 1. Create Service Account
# =============================================================================
echo ""
echo ">>> Creating service account..."

gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
    --project=${PROJECT_ID} \
    --display-name="LLM Connector Hub Service Account" \
    --description="Service account for LLM-Connector-Hub Cloud Run service" \
    2>/dev/null || echo "Service account already exists"

# =============================================================================
# 2. Grant Required Roles (Least Privilege)
# =============================================================================
echo ""
echo ">>> Granting IAM roles..."

# Cloud Run Invoker (for internal service-to-service calls)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/run.invoker" \
    --condition=None \
    --quiet

# Secret Manager Access (for secrets)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None \
    --quiet

# Cloud Trace Agent (for telemetry)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/cloudtrace.agent" \
    --condition=None \
    --quiet

# Cloud Monitoring Writer (for metrics)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/monitoring.metricWriter" \
    --condition=None \
    --quiet

# Logging Writer (for logs)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/logging.logWriter" \
    --condition=None \
    --quiet

# =============================================================================
# 3. Create VPC Connector (for internal egress)
# =============================================================================
echo ""
echo ">>> Creating VPC connector..."

gcloud compute networks vpc-access connectors create agentics-vpc-connector \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --network=default \
    --range=10.8.0.0/28 \
    --min-instances=2 \
    --max-instances=10 \
    2>/dev/null || echo "VPC connector already exists"

# =============================================================================
# 4. Create Secrets
# =============================================================================
echo ""
echo ">>> Creating secrets..."

# RuVector API Key
gcloud secrets create ruvector-api-key \
    --project=${PROJECT_ID} \
    --replication-policy="automatic" \
    2>/dev/null || echo "Secret ruvector-api-key already exists"

# Add secret version (placeholder - replace with actual key)
echo -n "PLACEHOLDER_RUVECTOR_API_KEY" | gcloud secrets versions add ruvector-api-key \
    --project=${PROJECT_ID} \
    --data-file=- \
    2>/dev/null || echo "Secret version already exists"

# Grant SA access to secrets
gcloud secrets add-iam-policy-binding ruvector-api-key \
    --project=${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet

# =============================================================================
# 5. Verify Setup
# =============================================================================
echo ""
echo ">>> Verifying IAM setup..."

echo "Service Account:"
gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} \
    --project=${PROJECT_ID} \
    --format="table(email, displayName, disabled)"

echo ""
echo "IAM Bindings:"
gcloud projects get-iam-policy ${PROJECT_ID} \
    --flatten="bindings[].members" \
    --filter="bindings.members:${SERVICE_ACCOUNT_EMAIL}" \
    --format="table(bindings.role)"

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           IAM SETUP COMPLETE                                      ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  IMPORTANT: Update the ruvector-api-key secret with actual key    ║"
echo "║                                                                   ║"
echo "║  gcloud secrets versions add ruvector-api-key \\                  ║"
echo "║      --project=${PROJECT_ID} \\                                   ║"
echo "║      --data-file=<path-to-key-file>                               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
