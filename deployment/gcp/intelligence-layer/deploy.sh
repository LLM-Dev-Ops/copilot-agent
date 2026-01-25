#!/bin/bash
##
# Intelligence Layer Agent - Phase 7 (Layer 2)
# Google Cloud Run Deployment Script
#
# Prerequisites:
# - gcloud CLI authenticated
# - Required secrets in Google Secret Manager:
#   - ruvector-api-key
#   - llm-observatory-api-key (optional)
#
# Usage:
#   ./deploy.sh [--project PROJECT_ID] [--region REGION]
##

set -e

# Default configuration
PROJECT_ID="${PROJECT_ID:-agentics-dev}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="intelligence-layer-agent"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --project)
      PROJECT_ID="$2"
      IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

TAG="${TAG:-latest}"

echo "=============================================="
echo "Intelligence Layer Agent - Phase 7, Layer 2"
echo "=============================================="
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo "Service:  ${SERVICE_NAME}"
echo "Image:    ${IMAGE_NAME}:${TAG}"
echo "=============================================="

# Step 1: Build and push container image
echo "[1/4] Building container image..."
cd "$(dirname "$0")/../../.."
docker build -f deployment/gcp/intelligence-layer/Dockerfile \
  -t "${IMAGE_NAME}:${TAG}" \
  .

echo "[2/4] Pushing to Container Registry..."
docker push "${IMAGE_NAME}:${TAG}"

# Step 3: Deploy to Cloud Run
echo "[3/4] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE_NAME}:${TAG}" \
  --platform=managed \
  --allow-unauthenticated=false \
  --service-account="intelligence-layer-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --memory=2Gi \
  --cpu=2 \
  --timeout=30s \
  --concurrency=80 \
  --min-instances=1 \
  --max-instances=50 \
  --cpu-boost \
  --execution-environment=gen2 \
  --ingress=internal-and-cloud-load-balancing \
  --vpc-connector="projects/${PROJECT_ID}/locations/${REGION}/connectors/agentics-vpc-connector" \
  --vpc-egress=private-ranges-only \
  --set-env-vars="SERVICE_NAME=${SERVICE_NAME},SERVICE_VERSION=1.0.0,PHASE=7,LAYER=2,RUVECTOR_NAMESPACE=agents,TELEMETRY_ENABLED=true,MAX_TOKENS=2500,MAX_LATENCY_MS=5000,ENABLE_REQUEST_LOGGING=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_REGION=${REGION}" \
  --set-secrets="RUVECTOR_API_KEY=ruvector-api-key:latest" \
  --update-labels="app=${SERVICE_NAME},phase=7,layer=2,component=agent"

# Step 4: Verify deployment
echo "[4/4] Verifying deployment..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)')

echo ""
echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Test the deployment:"
echo "  curl -H 'Authorization: Bearer \$(gcloud auth print-identity-token)' \\"
echo "    ${SERVICE_URL}/metadata"
echo ""
echo "Invoke the agent:"
echo "  curl -X POST \\"
echo "    -H 'Authorization: Bearer \$(gcloud auth print-identity-token)' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"explore\",\"objective\":{\"statement\":\"Test\",\"domain\":\"test\",\"constraints\":[]}}' \\"
echo "    ${SERVICE_URL}/invoke"
echo "=============================================="
