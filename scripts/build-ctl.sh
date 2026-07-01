#!/usr/bin/env bash
set -euo pipefail

APP_NAME="mthanctl"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${BIN_DIR:-${ROOT_DIR}/bin}"
BINARY_PATH="${BIN_DIR}/${APP_NAME}"

GOOS="${GOOS:-linux}"
GOARCH="${GOARCH:-amd64}"
CGO_ENABLED="${CGO_ENABLED:-0}"
GO_BUILD_FLAGS="${GO_BUILD_FLAGS:--buildvcs=false}"

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "missing required command: ${command_name}" >&2
    exit 1
  fi
}

build_binary() {
  require_command go

  mkdir -p "${BIN_DIR}"

  echo "Building ${APP_NAME} binary for ${GOOS}/${GOARCH}"
  (
    cd "${ROOT_DIR}"
    GOOS="${GOOS}" GOARCH="${GOARCH}" CGO_ENABLED="${CGO_ENABLED}" \
      go build ${GO_BUILD_FLAGS} -tags ctl -o "${BINARY_PATH}" .
  )

  chmod 0755 "${BINARY_PATH}"
}

main() {
  build_binary
  echo "Build complete: ${BINARY_PATH}"
}

main "$@"
