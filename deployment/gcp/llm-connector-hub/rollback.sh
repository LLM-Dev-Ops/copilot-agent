#!/bin/bash
# =============================================================================
# LLM-CONNECTOR-HUB ROLLBACK SCRIPT
# Safe rollback to previous revision
# =============================================================================

set -e

PROJECT_ID="${PROJECT_ID:-agentics-dev}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="llm-connector-hub"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           LLM-CONNECTOR-HUB ROLLBACK                              ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  Project: ${PROJECT_ID}"
echo "║  Region:  ${REGION}"
echo "║  Service: ${SERVICE_NAME}"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# 1. List Available Revisions
# =============================================================================
echo ">>> Available revisions:"
echo ""

gcloud run revisions list \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --service=${SERVICE_NAME} \
    --format="table(metadata.name, status.conditions[0].status, spec.containers[0].image, metadata.creationTimestamp)" \
    --limit=10

echo ""

# =============================================================================
# 2. Get Current and Previous Revisions
# =============================================================================
CURRENT_REVISION=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(status.latestReadyRevisionName)')

REVISIONS=($(gcloud run revisions list \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --service=${SERVICE_NAME} \
    --format='value(metadata.name)' \
    --limit=5))

echo "Current revision: ${CURRENT_REVISION}"

if [ ${#REVISIONS[@]} -lt 2 ]; then
    echo -e "${YELLOW}⚠ No previous revision available for rollback${NC}"
    exit 1
fi

PREVIOUS_REVISION="${REVISIONS[1]}"
echo "Previous revision: ${PREVIOUS_REVISION}"
echo ""

# =============================================================================
# 3. Confirm Rollback
# =============================================================================
echo -e "${YELLOW}WARNING: This will route all traffic to: ${PREVIOUS_REVISION}${NC}"
echo ""
read -p "Continue with rollback? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# =============================================================================
# 4. Execute Rollback
# =============================================================================
echo ""
echo ">>> Executing rollback..."

gcloud run services update-traffic ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --to-revisions=${PREVIOUS_REVISION}=100

# =============================================================================
# 5. Verify Rollback
# =============================================================================
echo ""
echo ">>> Verifying rollback..."

sleep 5

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(status.url)')

HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Rollback successful - service is healthy${NC}"

    # Get current traffic distribution
    echo ""
    echo "Current traffic distribution:"
    gcloud run services describe ${SERVICE_NAME} \
        --project=${PROJECT_ID} \
        --region=${REGION} \
        --format='value(status.traffic)'
else
    echo -e "${RED}✗ Rollback may have issues - health check returned ${HEALTH_CODE}${NC}"
    exit 1
fi

# =============================================================================
# 6. Summary
# =============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           ROLLBACK COMPLETE                                       ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  From: ${CURRENT_REVISION}"
echo "║  To:   ${PREVIOUS_REVISION}"
echo "║  URL:  ${SERVICE_URL}"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "To re-deploy the latest version:"
echo "  ./deploy.sh"
echo ""
echo "To rollback to a specific revision:"
echo "  gcloud run services update-traffic ${SERVICE_NAME} \\"
echo "      --region=${REGION} --to-revisions=<revision-name>=100"
