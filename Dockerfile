# syntax=docker/dockerfile:1.7

# -----------------------------
# Base image for dependency install
# -----------------------------
FROM node:20-bookworm-slim AS base

WORKDIR /app

# Install only package metadata first to maximize Docker layer cache reuse.
COPY package*.json ./

# -----------------------------
# Production dependencies stage
# -----------------------------
FROM base AS prod-deps

# Install only runtime dependencies for a smaller final image.
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------
# Runtime stage
# -----------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=9000

WORKDIR /app

# Use the unprivileged node user included in the official image.
USER node

# Copy production node_modules with proper ownership.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Copy app source.
COPY --chown=node:node . .

EXPOSE 9000

# Lightweight healthcheck that validates the API health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "const http=require('http');const req=http.get('http://127.0.0.1:'+ (process.env.PORT||9000) +'/api/health',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));"

CMD ["node", "index.js"]
