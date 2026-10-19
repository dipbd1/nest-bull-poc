#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

usage() {
  cat >&2 <<'EOF'
Usage:
  ./install.sh install
  ./install.sh remove
  ./install.sh install redis|postgres|mailpit
  ./install.sh remove redis|postgres|mailpit
EOF
  exit 1
}

if [[ $# -eq 0 || $# -gt 2 ]]; then
  usage
fi

action="$1"
target="${2:-}"

case "$action" in
  install|remove) ;;
  *) usage ;;
esac

case "$target" in
  ""|redis|postgres|mailpit) ;;
  *) usage ;;
esac

case "$action" in
  install)
    case "$target" in
      "")
        "$SCRIPT_DIR/redis/install.sh" install
        "$SCRIPT_DIR/postgres/install.sh" install
        "$SCRIPT_DIR/mailpit/install.sh" install
        ;;
      redis)
        "$SCRIPT_DIR/redis/install.sh" install
        ;;
      postgres)
        "$SCRIPT_DIR/postgres/install.sh" install
        ;;
      mailpit)
        "$SCRIPT_DIR/mailpit/install.sh" install
        ;;
    esac
    ;;
  remove)
    case "$target" in
      "")
        "$SCRIPT_DIR/mailpit/install.sh" remove
        "$SCRIPT_DIR/postgres/install.sh" remove
        "$SCRIPT_DIR/redis/install.sh" remove
        ;;
      redis)
        "$SCRIPT_DIR/redis/install.sh" remove
        ;;
      postgres)
        "$SCRIPT_DIR/postgres/install.sh" remove
        ;;
      mailpit)
        "$SCRIPT_DIR/mailpit/install.sh" remove
        ;;
    esac
    ;;
esac

