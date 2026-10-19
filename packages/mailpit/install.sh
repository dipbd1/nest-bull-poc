#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-local-mailpit:1.31.6}"
CONTAINER_NAME="${CONTAINER_NAME:-mailpit}"
VOLUME_NAME="${VOLUME_NAME:-mailpit-data}"
SMTP_PORT="${SMTP_PORT:-1025}"
UI_PORT="${UI_PORT:-8025}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

usage() {
  echo "Usage: $(basename "$0") [install|remove]" >&2
  exit 1
}

install_mailpit() {
  docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"

  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME"
  fi

  docker run --name "$CONTAINER_NAME" -d \
    --restart unless-stopped \
    -p "${SMTP_PORT}:1025" \
    -p "${UI_PORT}:8025" \
    -v "${VOLUME_NAME}:/data" \
    -e MP_DATABASE=/data/mailpit.db \
    -e MP_MAX_MESSAGES=5000 \
    -e MP_SMTP_AUTH_ACCEPT_ANY=1 \
    -e MP_SMTP_AUTH_ALLOW_INSECURE=1 \
    "$IMAGE_NAME"

  docker exec "$CONTAINER_NAME" /mailpit readyz
  echo "Mailpit UI: http://localhost:${UI_PORT}"
  echo "Mailpit SMTP: localhost:${SMTP_PORT}"
}

remove_mailpit() {
  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME"
    echo "Removed container ${CONTAINER_NAME}"
  fi

  if docker volume ls --format '{{.Name}}' | grep -qx "$VOLUME_NAME"; then
    docker volume rm "$VOLUME_NAME"
    echo "Removed volume ${VOLUME_NAME}"
  fi
}

if [[ $# -gt 1 ]]; then
  usage
fi

case "${1:-install}" in
  install)
    install_mailpit
    ;;
  remove)
    remove_mailpit
    ;;
  *)
    usage
    ;;
esac
