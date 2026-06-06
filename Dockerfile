# syntax=docker/dockerfile:1

# 1) deps — install with the native toolchain so better-sqlite3 (node-gyp) builds against glibc.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# 2) builder — compile the app: standalone server, static assets, icons, Serwist sw.js,
#    and the committed/generated drizzle SQL migrations baked into /app/drizzle.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Bake SQL migrations into the image (committed under drizzle/, regenerate to be safe).
RUN npm run db:generate
# build runs gen:icons then next build (output: standalone), which also emits public/sw.js.
RUN npm run build
# Bundle the migrator into a self-contained JS file so node can run it in the runner (no tsx).
RUN npm run build:migrator

# 3) runner — clean glibc slim image. Non-root. Only the runtime artifacts.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN useradd -m -u 1001 burgergo
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh
RUN mkdir -p /data /data/uploads && chown -R burgergo /data
USER burgergo
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
