#!/usr/bin/env bash
#
# BurgerGo deploy script.
#
# Syncs this repo to the server, builds the Docker image there (so the native
# better-sqlite3 binary matches the server arch), and (re)starts the container.
# Migrations run automatically on container start. Re-run any time to deploy an
# update — it's idempotent and never touches the server's .env or data volumes.
#
# Prereqs (one-time, see deploy/README.md):
#   - Docker + nginx installed on the server (scripts/provision-server.sh)
#   - $APP_DIR/.env present on the server with the Maps keys + NEXT_PUBLIC_BASE_PATH
#   - nginx site enabled (this script installs/refreshes it)
#
# Usage:  ./scripts/deploy.sh
# Config via env:  SERVER=root@host  APP_DIR=/opt/webapp  (defaults below)

set -euo pipefail

SERVER="${SERVER:-root@172.235.40.132}"
APP_DIR="${APP_DIR:-/opt/webapp}"
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=15}"

# Resolve repo root (this script lives in <root>/scripts/).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$REPO_ROOT"

echo "==> Deploying BurgerGo from $REPO_ROOT to $SERVER:$APP_DIR"

# 1) Sync source to the server. Exclude build output, deps, local DBs, git, and
#    — critically — the server's .env (managed separately; holds secrets).
echo "==> Syncing source (rsync)…"
ssh $SSH_OPTS "$SERVER" "mkdir -p '$APP_DIR'"
rsync -az --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
  --exclude='.superpowers/' \
  --exclude='coverage/' \
  --exclude='expo-rn/' \
  --exclude='public/sw.js' --exclude='public/sw.js.map' \
  --exclude='public/icons/' --exclude='public/burgergo-logo.png' \
  --exclude='scripts/migrate.js' \
  -e "ssh $SSH_OPTS" \
  ./ "$SERVER:$APP_DIR/"

# 2) Install/refresh the nginx site (idempotent).
echo "==> Installing nginx site…"
ssh $SSH_OPTS "$SERVER" bash -se <<EOF
  set -euo pipefail
  # Self-signed origin cert for :443 so Cloudflare "Full" SSL mode can reach us
  # (generated once; Cloudflare "Full" doesn't validate it).
  mkdir -p /etc/nginx/ssl
  if [ ! -f /etc/nginx/ssl/burgergo-selfsigned.crt ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout /etc/nginx/ssl/burgergo-selfsigned.key \
      -out /etc/nginx/ssl/burgergo-selfsigned.crt \
      -subj "/CN=eric.month2month.com" 2>/dev/null
  fi
  install -m 0644 "$APP_DIR/deploy/nginx-burgergo.conf" /etc/nginx/sites-available/burgergo
  ln -sf /etc/nginx/sites-available/burgergo /etc/nginx/sites-enabled/burgergo
  nginx -t
  systemctl reload nginx
EOF

# 3) Build + (re)start the container on the server. compose reads $APP_DIR/.env
#    for the NEXT_PUBLIC_* build args and the runtime environment.
echo "==> Building + starting container…"
ssh $SSH_OPTS "$SERVER" bash -se <<EOF
  set -euo pipefail
  cd "$APP_DIR"
  if [ ! -f .env ]; then
    echo "ERROR: $APP_DIR/.env missing. Create it first (see deploy/README.md)." >&2
    exit 1
  fi
  docker compose build
  docker compose up -d
  docker compose ps
EOF

# 4) Health check via the origin (bypassing Cloudflare).
echo "==> Verifying origin health…"
ssh $SSH_OPTS "$SERVER" bash -se <<'EOF'
  set -euo pipefail
  for i in $(seq 1 20); do
    code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: eric.month2month.com' http://127.0.0.1/burgergo/api/health || true)
    if [ "$code" = "200" ]; then echo "origin /burgergo/api/health -> 200 OK"; exit 0; fi
    sleep 3
  done
  echo "Health check did not return 200 in time; check 'docker compose logs'." >&2
  exit 1
EOF

echo "==> Done. Live at https://eric.month2month.com/burgergo (via Cloudflare)."
