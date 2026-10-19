#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-local-redis:8.10.2}"
CONTAINER_NAME="${CONTAINER_NAME:-redis}"
VOLUME_NAME="${VOLUME_NAME:-redis-data}"
PORT="${PORT:-6379}"

usage() {
  echo "Usage: $0 [install|remove]" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  usage
fi

case "${1:-install}" in
  install)
    ;;
  remove)
    if ! command -v docker >/dev/null 2>&1; then
      echo "Docker is required." >&2
      exit 1
    fi

    if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
      docker rm -f "$CONTAINER_NAME"
      echo "Removed container ${CONTAINER_NAME}"
    fi

    if docker volume ls --format '{{.Name}}' | grep -qx "$VOLUME_NAME"; then
      docker volume rm "$VOLUME_NAME"
      echo "Removed volume ${VOLUME_NAME}"
    fi
    exit 0
    ;;
  *)
    usage
    ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

chmod +x "$SCRIPT_DIR/docker-entrypoint.sh"

docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME"
fi

docker run --name "$CONTAINER_NAME" -d \
  --restart unless-stopped \
  -p "${PORT}:6379" \
  -v "${VOLUME_NAME}:/data" \
  "$IMAGE_NAME" \
  redis-server --appendonly yes

docker exec "$CONTAINER_NAME" redis-cli ping
echo "Redis is running on localhost:${PORT} (volume: ${VOLUME_NAME})"
