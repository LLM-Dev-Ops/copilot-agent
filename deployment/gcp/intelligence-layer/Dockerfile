# Intelligence Layer Agent - Phase 7 (Layer 2)
# Standalone Node.js deployment for Google Cloud Run

FROM node:20-alpine

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agent -u 1001

WORKDIR /app

# Install dependencies
RUN npm init -y && \
    npm install express uuid zod

# Copy server and agent files
COPY server.js ./
COPY agent-bundle.js ./

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Switch to non-root user
USER agent

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health/live || exit 1

# Start server
CMD ["node", "server.js"]
