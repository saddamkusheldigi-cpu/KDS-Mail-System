# Install the full dependency tree, including build tools used by Next.js.
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build the Next.js app; NEXT_PUBLIC_APP_URL is embedded in client-side assets.
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# The upload API writes here, even when the repository has no public directory yet.
RUN mkdir -p public/uploads
RUN npm run build

# Keep the final image limited to production dependencies and runtime files.
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/app/data \
    HOME=/tmp \
    PM2_HOME=/tmp/pm2

COPY package.json package-lock.json ./
# Install production dependencies only; PM2 runs the web app and email worker.
RUN npm ci --omit=dev && npm install --global pm2
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/packages/email-worker/src ./packages/email-worker/src
COPY --from=builder /app/infra/setup-tables.js ./infra/setup-tables.js
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY ecosystem.config.cjs ./

# Compose mounts persistent host directories at these container paths.
RUN mkdir -p /app/data /app/public/uploads
EXPOSE 3000
# Initialize SQLite before starting both managed processes.
CMD ["sh", "-c", "npm run setup:tables && exec pm2-runtime ecosystem.config.cjs"]
