# =============================================================================
# LLM-CONNECTOR-HUB DOCKERFILE
# Multi-stage build for Google Cloud Run deployment
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY services/agents/contracts/package*.json ./services/agents/contracts/
COPY services/llm-connector-hub/package*.json ./services/llm-connector-hub/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY services/agents/contracts ./services/agents/contracts
COPY services/llm-connector-hub ./services/llm-connector-hub

# Build TypeScript
WORKDIR /app/services/llm-connector-hub
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Production
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production

# Build arguments
ARG SERVICE_VERSION=unknown
ARG BUILD_DATE=unknown

# Labels
LABEL org.opencontainers.image.title="LLM-Connector-Hub"
LABEL org.opencontainers.image.description="External Integration & Platform Boundary Layer"
LABEL org.opencontainers.image.version="${SERVICE_VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.vendor="Agentics"

# Security: Run as non-root user
RUN addgroup -g 1001 -S agentics && \
    adduser -u 1001 -S agentics -G agentics

WORKDIR /app

# Copy built artifacts
COPY --from=builder --chown=agentics:agentics /app/services/llm-connector-hub/dist ./dist
COPY --from=builder --chown=agentics:agentics /app/services/llm-connector-hub/node_modules ./node_modules
COPY --from=builder --chown=agentics:agentics /app/services/llm-connector-hub/package.json ./

# Environment
ENV NODE_ENV=production
ENV SERVICE_NAME=llm-connector-hub
ENV SERVICE_VERSION=${SERVICE_VERSION}
ENV PORT=8080

# Switch to non-root user
USER agentics

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start service
CMD ["node", "dist/server.js"]
