# ─────────────────────────────────────────────────────────────────────────────
# Spring Bank API – Production Dockerfile
# Multi-stage build: builder compiles TypeScript; production image is minimal.
# ─────────────────────────────────────────────────────────────────────────────

# =============================================================================
# Stage 1 – builder
# Installs all dependencies (including devDependencies) and compiles TypeScript.
# =============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching.
# A change to source code will NOT invalidate the npm install layer.
COPY package*.json ./
COPY prisma/ ./prisma/

# Install all dependencies (dev + prod) required for the TypeScript build.
RUN npm ci

# Copy the rest of the source code.
COPY . .

# Generate the Prisma client for the target platform.
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# =============================================================================
# Stage 2 – production
# Copies only the compiled output and production node_modules.
# The final image contains no TypeScript compiler, source maps, or dev tools.
# =============================================================================
FROM node:18-alpine AS production

# Install dumb-init for proper PID 1 signal handling (graceful shutdown).
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy production node_modules from the builder stage.
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled JavaScript output.
COPY --from=builder /app/dist ./dist

# Copy the Prisma schema and generated client (needed at runtime for migrations).
COPY --from=builder /app/prisma ./prisma

# Copy package.json so that `node -e "require('./package.json').version"` works.
COPY --from=builder /app/package.json ./package.json

# ── Security: run as the built-in non-root 'node' user ──────────────────────
USER node

# Expose the API port (must match PORT env var; default 3001).
EXPOSE 3001

# ── Health check ──────────────────────────────────────────────────────────────
# Docker will mark the container unhealthy if /health returns non-200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# ── Entrypoint ────────────────────────────────────────────────────────────────
# dumb-init ensures signals (SIGTERM from docker stop / k8s) reach the Node process.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
