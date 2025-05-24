FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S emailmonitor && \
    adduser -S emailmonitor -u 1001 -G emailmonitor

# Copy application files
COPY --chown=emailmonitor:emailmonitor . .

# Create config directory
RUN mkdir -p /app/config && chown emailmonitor:emailmonitor /app/config

# Switch to non-root user
USER emailmonitor

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Expose port for health checks (optional)
EXPOSE 3000

# Start the application
CMD ["node", "email-monitor.js"]