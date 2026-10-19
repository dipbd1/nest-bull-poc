#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-local-postgres:17}"
CONTAINER_NAME="${CONTAINER_NAME:-postgres}"
VOLUME_NAME="${VOLUME_NAME:-postgres-data}"
PORT="${PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-app}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-app}"
POSTGRES_DB="${POSTGRES_DB:-app}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

usage() {
  echo "Usage: $(basename "$0") [install|remove]" >&2
  exit 1
}

wait_for_ready() {
  for _ in $(seq 1 30); do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      echo "Postgres is running on localhost:${PORT} (volume: ${VOLUME_NAME})"
      return 0
    fi
    sleep 1
  done

  echo "Postgres did not become ready." >&2
  exit 1
}

install_postgres() {
  docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"

  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    docker rm -f "$CONTAINER_NAME"
  fi

  docker run --name "$CONTAINER_NAME" -d \
    --restart unless-stopped \
    -p "${PORT}:5432" \
    -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    "$IMAGE_NAME"

  wait_for_ready
}

remove_postgres() {
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
    install_postgres
    ;;
  remove)
    remove_postgres
    ;;
  *)
    usage
    ;;
esac
