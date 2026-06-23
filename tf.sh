#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ENV_FILE="$SCRIPT_DIR/infrastructure/.env"
ENV_FILE="$DEFAULT_ENV_FILE"

usage() {
  cat <<EOF >&2
Usage: ./tf.sh [--env-file PATH] [terraform args...]

Loads infrastructure/.env automatically (1Password FIFO mount or plain file).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || {
        echo "--env-file requires a path" >&2
        exit 1
      }
      ENV_FILE=$2
      shift 2
      ;;
    --env-stdin)
      # Deprecated: stdin is detected automatically when piped.
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

env_ready() {
  [[ -n "${R2_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-}}" ]] \
    && [[ -n "${R2_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:-}}" ]]
}

export_from_dotenv() {
  local file=$1
  local line key value

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]] && line="${line#export }"
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      if [[ "$value" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi
      export "$key=$value"
    fi
  done <"$file"
}

load_dotenv_file() {
  local file=$1

  set +u
  set -a
  export_from_dotenv "$file"
  set +a
  set -u
}

load_env_from_stream() {
  local src=$1
  local tmp

  tmp="$(mktemp "${TMPDIR:-/tmp}/mysayo-env.XXXXXX")"
  chmod 600 "$tmp"

  if ! cat "$src" >"$tmp"; then
    rm -f "$tmp"
    echo "Failed to read env from $src." >&2
    return 1
  fi

  if [[ ! -s "$tmp" ]]; then
    rm -f "$tmp"
    return 1
  fi

  load_dotenv_file "$tmp"
  rm -f "$tmp"
}

load_env() {
  if [[ ! -t 0 ]]; then
    # e.g. cat infrastructure/.env | ./tf.sh plan
    load_env_from_stream /dev/stdin
    return
  fi

  if [[ ! -e "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE — mount it from 1Password (see infrastructure/.env.example)" >&2
    return 1
  fi

  if [[ -p "$ENV_FILE" ]]; then
    echo "Loading secrets from 1Password — approve the prompt if shown…" >&2
    echo "Close other readers of $ENV_FILE first (IDE tabs, other terminals)." >&2
  fi

  load_env_from_stream "$ENV_FILE"
}

if ! load_env; then
  echo "Could not load secrets." >&2
  echo "  • Close IDE tabs showing infrastructure/.env" >&2
  echo "  • Remount in 1Password if the prompt never appears" >&2
  echo "  • Retry: ./tf.sh plan" >&2
  exit 1
fi

R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-}}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:-}}"

if ! env_ready; then
  echo "Loaded env but R2 credentials are missing or empty." >&2
  echo "Add R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY to your 1Password Environment." >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

exec terraform -chdir="$SCRIPT_DIR/infrastructure" "$@"
