# ==============================================================================
# Multi-stage Dockerfile for LLM-CoPilot-Agent
# Optimized for production deployment with security hardening
# ==============================================================================

# ==============================================================================
# Stage 1: Base Image with Security Hardening
# ==============================================================================
FROM node:20-alpine AS base

# Install security updates and essential packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user for running the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# ==============================================================================
# Stage 2: Dependencies
# ==============================================================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Install development dependencies for building (if needed)
FROM base AS dev-dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# ==============================================================================
# Stage 3: Builder (if TypeScript compilation needed)
# ==============================================================================
FROM dev-dependencies AS builder

# Copy source code
COPY . .

# Build the application (uncomment if TypeScript/build step required)
# RUN npm run build

# Run security audit and fix
RUN npm audit fix || true

# ==============================================================================
# Stage 4: Production Image
# ==============================================================================
FROM base AS production

# Set environment to production
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    NODE_OPTIONS="--max-old-space-size=2048"

# Copy production dependencies
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code (adjust if using build output)
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs . .

# Remove unnecessary files
RUN rm -rf \
    .git \
    .gitignore \
    README.md \
    docs \
    tests \
    *.md \
    deployment

# Security hardening
RUN chmod -R 755 /app && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "index.js"]

# ==============================================================================
# Metadata Labels
# ==============================================================================
LABEL maintainer="LLM DevOps Team" \
      app.name="llm-copilot-agent" \
      app.version="1.0.0" \
      app.description="Intelligent DevOps assistant for LLM ecosystem" \
      security.scan="required" \
      security.vulnerability-threshold="high"
