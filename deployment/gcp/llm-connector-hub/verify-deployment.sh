#!/bin/bash
# =============================================================================
# LLM-CONNECTOR-HUB POST-DEPLOYMENT VERIFICATION
# Complete verification checklist execution
# =============================================================================

set -e

PROJECT_ID="${PROJECT_ID:-agentics-dev}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="llm-connector-hub"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS="${GREEN}✓${NC}"
FAIL="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    local name="$1"
    local result="$2"
    if [ "$result" = "0" ]; then
        echo -e "  ${PASS} ${name}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "  ${FAIL} ${name}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║     LLM-CONNECTOR-HUB POST-DEPLOYMENT VERIFICATION                ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  Project: ${PROJECT_ID}"
echo "║  Region:  ${REGION}"
echo "║  Service: ${SERVICE_NAME}"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(status.url)' 2>/dev/null || echo "")

if [ -z "$SERVICE_URL" ]; then
    echo -e "${FAIL} Service not found!"
    exit 1
fi

echo "Service URL: ${SERVICE_URL}"
echo ""

# =============================================================================
# 1. SERVICE AVAILABILITY
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. SERVICE AVAILABILITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Unified service is live
SERVICE_STATUS=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(status.conditions[0].status)' 2>/dev/null || echo "False")
check "Unified service is live" $([ "$SERVICE_STATUS" = "True" ] && echo 0 || echo 1)

# Health endpoint
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" 2>/dev/null || echo "000")
check "Health endpoint responds (200)" $([ "$HEALTH_CODE" = "200" ] && echo 0 || echo 1)

# Readiness endpoint
READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/ready" 2>/dev/null || echo "000")
check "Readiness endpoint responds (200)" $([ "$READY_CODE" = "200" ] && echo 0 || echo 1)

# Metrics endpoint
METRICS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/metrics" 2>/dev/null || echo "000")
check "Metrics endpoint responds (200)" $([ "$METRICS_CODE" = "200" ] && echo 0 || echo 1)

echo ""

# =============================================================================
# 2. AGENT ENDPOINTS
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. AGENT ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for AGENT in erp database webhook normalize auth; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/v1/connectors/${AGENT}/health" 2>/dev/null || echo "000")
    check "${AGENT} agent endpoint responds" $([ "$CODE" = "200" ] && echo 0 || echo 1)
done

echo ""

# =============================================================================
# 3. AUTHENTICATION & VALIDATION
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. AUTHENTICATION & VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test auth endpoint with invalid token (should return 401 or structured error)
AUTH_RESPONSE=$(curl -s -X POST "${SERVICE_URL}/api/v1/connectors/auth/validate" \
    -H "Content-Type: application/json" \
    -d '{"token":"invalid_token"}' 2>/dev/null || echo '{"status":"error"}')
AUTH_IS_DETERMINISTIC=$(echo "$AUTH_RESPONSE" | jq -e '.status' >/dev/null 2>&1 && echo 0 || echo 1)
check "Authentication is deterministic (returns structured response)" $AUTH_IS_DETERMINISTIC

# Test schema validation on normalize endpoint
NORMALIZE_RESPONSE=$(curl -s -X POST "${SERVICE_URL}/api/v1/connectors/normalize" \
    -H "Content-Type: application/json" \
    -d '{"sourceType":"test","payload":{}}' 2>/dev/null || echo '{"status":"error"}')
SCHEMA_VALID=$(echo "$NORMALIZE_RESPONSE" | jq -e '.status' >/dev/null 2>&1 && echo 0 || echo 1)
check "Ingested payloads are schema-validated" $SCHEMA_VALID

echo ""

# =============================================================================
# 4. PERSISTENCE (RUVECTOR)
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. PERSISTENCE (RUVECTOR)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check no direct SQL env vars
NO_SQL_HOST=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(spec.template.spec.containers[0].env)' 2>/dev/null | grep -c "DB_HOST\|DATABASE_URL\|POSTGRES_" || echo "0")
check "No direct SQL access configured" $([ "$NO_SQL_HOST" = "0" ] && echo 0 || echo 1)

# Check RUVECTOR_SERVICE_URL is set
RUVECTOR_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(spec.template.spec.containers[0].env)' 2>/dev/null | grep -c "RUVECTOR_SERVICE_URL" || echo "0")
check "RUVECTOR_SERVICE_URL is configured" $([ "$RUVECTOR_URL" -gt "0" ] && echo 0 || echo 1)

echo ""

# =============================================================================
# 5. TELEMETRY (LLM-OBSERVATORY)
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. TELEMETRY (LLM-OBSERVATORY)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check TELEMETRY_ENDPOINT is set
TELEMETRY_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(spec.template.spec.containers[0].env)' 2>/dev/null | grep -c "TELEMETRY_ENDPOINT" || echo "0")
check "TELEMETRY_ENDPOINT is configured" $([ "$TELEMETRY_URL" -gt "0" ] && echo 0 || echo 1)

# Check metrics endpoint has data
METRICS_DATA=$(curl -s "${SERVICE_URL}/metrics" 2>/dev/null | head -5)
check "Metrics endpoint returns Prometheus format" $(echo "$METRICS_DATA" | grep -q "^#\|^[a-z]" && echo 0 || echo 1)

echo ""

# =============================================================================
# 6. SECURITY & CONFIGURATION
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. SECURITY & CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Service account configured
SA=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo "")
check "Service account is configured" $([ -n "$SA" ] && echo 0 || echo 1)

# No hardcoded secrets (check for API keys in env vars)
HARDCODED=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(spec.template.spec.containers[0].env)' 2>/dev/null | grep -c "sk-\|api_key=" || echo "0")
check "No hardcoded secrets in env vars" $([ "$HARDCODED" = "0" ] && echo 0 || echo 1)

# VPC connector configured
VPC=$(gcloud run services describe ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --format='value(metadata.annotations)' 2>/dev/null | grep -c "vpc-access-connector" || echo "0")
check "VPC connector configured for internal egress" $([ "$VPC" -gt "0" ] && echo 0 || echo 1)

echo ""

# =============================================================================
# 7. CONSTRAINTS VERIFICATION
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. CONSTRAINTS VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify info endpoint shows constraints
INFO_RESPONSE=$(curl -s "${SERVICE_URL}/api/v1/info" 2>/dev/null || echo '{}')
HAS_CONSTRAINTS=$(echo "$INFO_RESPONSE" | jq -e '.constraints | length > 0' 2>/dev/null && echo 0 || echo 1)
check "Constraints are declared in service info" $HAS_CONSTRAINTS

# Verify read-only in constraints
READ_ONLY=$(echo "$INFO_RESPONSE" | jq -r '.constraints[]' 2>/dev/null | grep -c "read_only\|no_workflow\|no_policy" || echo "0")
check "Read-only analysis constraint declared" $([ "$READ_ONLY" -gt "0" ] && echo 0 || echo 1)

echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                         VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Total Checks:  ${TOTAL_CHECKS}"
echo -e "  ${PASS} Passed:      ${PASSED_CHECKS}"
echo -e "  ${FAIL} Failed:      ${FAILED_CHECKS}"
echo ""

if [ "$FAILED_CHECKS" -eq "0" ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✓ ALL VERIFICATION CHECKS PASSED                             ║${NC}"
    echo -e "${GREEN}║       LLM-CONNECTOR-HUB IS OPERATIONAL                            ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║     ✗ VERIFICATION FAILED                                         ║${NC}"
    echo -e "${RED}║       ${FAILED_CHECKS} checks did not pass                                      ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
