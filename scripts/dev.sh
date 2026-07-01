#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ADDR="${APP_ADDR:-:8000}"
POLL_INTERVAL="${POLL_INTERVAL:-1}"
GO_BUILD_FLAGS="${GO_BUILD_FLAGS:--buildvcs=false}"

APP_PID=""
LAST_STATE=""

cleanup() {
  if [[ -n "${APP_PID}" ]] && kill -0 "${APP_PID}" >/dev/null 2>&1; then
    kill "${APP_PID}" >/dev/null 2>&1 || true
    wait "${APP_PID}" >/dev/null 2>&1 || true
  fi
}

file_state() {
  (
    cd "${ROOT_DIR}"
    find . \
      -path "./client/node_modules" -prune -o \
      -path "./client/build" -prune -o \
      -path "./bin" -prune -o \
      -path "./tmp" -prune -o \
      -type f \( -name "*.go" -o -name "go.mod" -o -name "go.sum" \) \
      -exec stat -c "%n:%Y:%s" {} \; | sort
  )
}

start_app() {
  cleanup

  echo "Starting dev server on ${APP_ADDR}"
  (
    cd "${ROOT_DIR}"
    APP_ADDR="${APP_ADDR}" go run ${GO_BUILD_FLAGS} .
  ) &
  APP_PID="$!"
}

main() {
  trap cleanup EXIT INT TERM

  LAST_STATE="$(file_state)"
  start_app

  while true; do
    sleep "${POLL_INTERVAL}"

    current_state="$(file_state)"
    if [[ "${current_state}" != "${LAST_STATE}" ]]; then
      LAST_STATE="${current_state}"
      echo "Change detected, restarting..."
      start_app
    fi

    if [[ -n "${APP_PID}" ]] && ! kill -0 "${APP_PID}" >/dev/null 2>&1; then
      wait "${APP_PID}" >/dev/null 2>&1 || true
      APP_PID=""
      echo "App stopped. Waiting for file changes..."
    fi
  done
}

main "$@"
