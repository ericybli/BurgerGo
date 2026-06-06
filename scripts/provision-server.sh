#!/usr/bin/env bash
#
# One-time server provisioning for BurgerGo (Ubuntu 22.04/24.04).
# Installs Docker Engine + compose plugin and nginx, and creates the app dir.
# Run ON the server as root (or: ssh root@host 'bash -s' < scripts/provision-server.sh).
# Idempotent — safe to re-run.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/webapp}"

echo "==> apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx

echo "==> Install Docker Engine + compose plugin (official repo)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "docker already installed: $(docker --version)"
fi

echo "==> Enable + start services"
systemctl enable --now docker
systemctl enable --now nginx

echo "==> App dir"
mkdir -p "$APP_DIR"

echo "==> Versions"
docker --version
docker compose version
nginx -v

echo "==> Provisioning complete. Next: create $APP_DIR/.env (see deploy/README.md), then run scripts/deploy.sh from your workstation."
