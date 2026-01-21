#!/bin/bash
# =============================================================================
# LLM-CONNECTOR-HUB DEPLOYMENT SCRIPT
# Deploy to Google Cloud Run
# =============================================================================

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-agentics-dev}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="llm-connector-hub"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM_ENV="${PLATFORM_ENV:-dev}"

# Service URLs (environment-specific)
case $PLATFORM_ENV in
  "prod")
    RUVECTOR_SERVICE_URL="https://ruvector-service-prod.agentics.app"
    TELEMETRY_ENDPOINT="https://llm-observatory-prod.agentics.app"
    MIN_INSTANCES=3
    MAX_INSTANCES=100
    ;;
  "staging")
    RUVECTOR_SERVICE_URL="https://ruvector-service-staging.agentics.app"
    TELEMETRY_ENDPOINT="https://llm-observatory-staging.agentics.app"
    MIN_INSTANCES=2
    MAX_INSTANCES=50
    ;;
  *)
    RUVECTOR_SERVICE_URL="https://ruvector-service-agentics-dev.a.run.app"
    TELEMETRY_ENDPOINT="https://llm-observatory-agentics-dev.a.run.app"
    MIN_INSTANCES=1
    MAX_INSTANCES=10
    ;;
esac

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           LLM-CONNECTOR-HUB DEPLOYMENT                            ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  Project:     ${PROJECT_ID}"
echo "║  Region:      ${REGION}"
echo "║  Service:     ${SERVICE_NAME}"
echo "║  Environment: ${PLATFORM_ENV}"
echo "║  Image Tag:   ${IMAGE_TAG}"
echo "╚═══════════════════════════════════════════════════════════════════╝"

# =============================================================================
# 1. Build and Push Docker Image
# =============================================================================
echo ""
echo ">>> Building Docker image..."

docker build \
    -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG} \
    -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:$(git rev-parse --short HEAD) \
    -f deployment/gcp/llm-connector-hub/Dockerfile \
    --build-arg SERVICE_VERSION=$(git rev-parse --short HEAD) \
    --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
    .

echo ""
echo ">>> Pushing to Container Registry..."

docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG}
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:$(git rev-parse --short HEAD)

# =============================================================================
# 2. Deploy to Cloud Run
# =============================================================================
echo ""
echo ">>> Deploying to Cloud Run..."

gcloud run deploy ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --image=gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG} \
    --platform=managed \
    --service-account=llm-connector-hub-sa@${PROJECT_ID}.iam.gserviceaccount.com \
    --min-instances=${MIN_INSTANCES} \
    --max-instances=${MAX_INSTANCES} \
    --memory=2Gi \
    --cpu=2 \
    --timeout=300 \
    --concurrency=80 \
    --port=8080 \
    --set-env-vars="SERVICE_NAME=${SERVICE_NAME}" \
    --set-env-vars="SERVICE_VERSION=$(git rev-parse --short HEAD)" \
    --set-env-vars="PLATFORM_ENV=${PLATFORM_ENV}" \
    --set-env-vars="RUVECTOR_SERVICE_URL=${RUVECTOR_SERVICE_URL}" \
    --set-env-vars="TELEMETRY_ENDPOINT=${TELEMETRY_ENDPOINT}" \
    --set-env-vars="TELEMETRY_ENABLED=true" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --set-secrets="RUVECTOR_API_KEY=ruvector-api-key:latest" \
    --allow-unauthenticated \
    --ingress=all \
    --execution-environment=gen2 \
    --cpu-boost \
    --no-cpu-throttling \
    --vpc-connector=agentics-vpc-connector \
    --vpc-egress=private-ranges-only

# =============================================================================
# 3. Get Service URL
# =============================================================================
echo ""
echo ">>> Getting service URL..."

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(status.url)')

echo "Service URL: ${SERVICE_URL}"

# =============================================================================
# 4. Verify Deployment
# =============================================================================
echo ""
echo ">>> Verifying deployment..."

# Wait for service to be ready
sleep 10

# Health check
echo "Checking /health..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health")
if [ "$HEALTH_STATUS" != "200" ]; then
    echo "❌ Health check failed: ${HEALTH_STATUS}"
    exit 1
fi
echo "✓ Health check passed"

# Readiness check
echo "Checking /ready..."
READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/ready")
if [ "$READY_STATUS" != "200" ]; then
    echo "❌ Readiness check failed: ${READY_STATUS}"
    exit 1
fi
echo "✓ Readiness check passed"

# Agent endpoints
for ENDPOINT in erp database webhook normalize auth; do
    echo "Checking /api/v1/connectors/${ENDPOINT}/health..."
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/v1/connectors/${ENDPOINT}/health")
    if [ "$STATUS" != "200" ]; then
        echo "⚠ ${ENDPOINT} agent: ${STATUS}"
    else
        echo "✓ ${ENDPOINT} agent: OK"
    fi
done

# Service info
echo ""
echo "Service Info:"
curl -s "${SERVICE_URL}/api/v1/info" | jq .

# =============================================================================
# 5. Output Summary
# =============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           DEPLOYMENT COMPLETE                                     ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  Service URL: ${SERVICE_URL}"
echo "║                                                                   ║"
echo "║  AGENT ENDPOINTS:                                                 ║"
echo "║  • ${SERVICE_URL}/api/v1/connectors/erp"
echo "║  • ${SERVICE_URL}/api/v1/connectors/database"
echo "║  • ${SERVICE_URL}/api/v1/connectors/webhook"
echo "║  • ${SERVICE_URL}/api/v1/connectors/normalize"
echo "║  • ${SERVICE_URL}/api/v1/connectors/auth"
echo "║                                                                   ║"
echo "║  MONITORING:                                                      ║"
echo "║  • Health:  ${SERVICE_URL}/health"
echo "║  • Ready:   ${SERVICE_URL}/ready"
echo "║  • Metrics: ${SERVICE_URL}/metrics"
echo "╚═══════════════════════════════════════════════════════════════════╝"
