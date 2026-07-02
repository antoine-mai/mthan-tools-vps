#!/usr/bin/env bash
set -euo pipefail

APP_NAME="mthan-vps"
CTL_NAME="mthanctl"
SERVICE_NAME="mthan-vps"
BIN_URL="${BIN_URL:-https://github.com/antoine-mai/mthan-tools-vps/raw/main/bin}"
BINARY_URL="${BINARY_URL:-${BIN_URL}/${APP_NAME}}"
CTL_BINARY_URL="${CTL_BINARY_URL:-${BIN_URL}/${CTL_NAME}}"
INSTALL_PATH="${INSTALL_PATH:-/usr/local/bin/${APP_NAME}}"
CTL_INSTALL_PATH="${CTL_INSTALL_PATH:-/usr/local/bin/${CTL_NAME}}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}@.service"
ROOT_ADDR="${ROOT_ADDR:-:2215}"
ROOT_SERVICE_UNIT=""

require_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    return
  fi

  echo "${SERVICE_NAME} installer must be run as root" >&2
  exit 1
}

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "missing required command: ${command_name}" >&2
    exit 1
  fi
}

download_binary() {
  local name="$1"
  local url="$2"
  local install_path="$3"
  local tmp_file
  tmp_file="$(mktemp)"

  echo "Downloading ${name} from ${url}"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${url}" -o "${tmp_file}"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "${tmp_file}" "${url}"
  else
    echo "missing required command: curl or wget" >&2
    rm -f "${tmp_file}"
    exit 1
  fi

  install -m 0755 "${tmp_file}" "${install_path}"
  rm -f "${tmp_file}"
}

download_binaries() {
  download_binary "${APP_NAME}" "${BINARY_URL}" "${INSTALL_PATH}"
  download_binary "${CTL_NAME}" "${CTL_BINARY_URL}" "${CTL_INSTALL_PATH}"
}

create_service() {
  cat >"${SERVICE_FILE}" <<EOF
[Unit]
Description=MThan VPS service for %I
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=%I
ExecStart=${INSTALL_PATH}
Restart=on-failure
RestartSec=3
Environment=APP_ENV=production
EnvironmentFile=-/etc/${SERVICE_NAME}/%i.env

[Install]
WantedBy=multi-user.target
EOF
}

write_service_env() {
  local env_file="/etc/${SERVICE_NAME}/root.env"

  mkdir -p "/etc/${SERVICE_NAME}"

  cat >"${env_file}" <<EOF
APP_ADDR=${ROOT_ADDR}
EOF
}

start_service() {
  systemctl daemon-reload
  write_service_env
  ROOT_SERVICE_UNIT="${SERVICE_NAME}@root.service"
  systemctl enable --now "${ROOT_SERVICE_UNIT}"
}

resolve_root_url() {
  local port
  port=$(echo "${ROOT_ADDR}" | sed 's/.*://')

  local ip=""
  # Try to fetch public IP (with timeout to prevent hanging)
  if command -v curl >/dev/null 2>&1; then
    ip=$(curl -fsSL --connect-timeout 2 https://ipinfo.io/ip 2>/dev/null || true)
  elif command -v wget >/dev/null 2>&1; then
    ip=$(wget -qO- --timeout=2 https://ipinfo.io/ip 2>/dev/null || true)
  fi

  # Fallback to local IP if public IP failed
  if [[ -z "${ip}" ]]; then
    if command -v hostname >/dev/null 2>&1; then
      ip=$(hostname -I | awk '{print $1}' || true)
    fi
  fi

  # Ultimate fallback
  if [[ -z "${ip}" ]]; then
    ip="<YOUR_SERVER_IP>"
  fi

  echo "http://${ip}:${port}"
}

cleanup_old_install() {
  echo "Cleaning up old installation..."

  # Stop and disable active/loaded service instances of mthan-vps or old vps service
  local units
  units=$(systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null \
    | awk '{print $1}' \
    | grep -E "^(${SERVICE_NAME}|vps)@.+\\.service$") || true
  for unit in ${units}; do
    if [[ -n "${unit}" ]]; then
      echo "Stopping service: ${unit}"
      systemctl stop "${unit}" || true
      echo "Disabling service: ${unit}"
      systemctl disable "${unit}" || true
    fi
  done

  # Clean up service files
  rm -f "/etc/systemd/system/${SERVICE_NAME}@.service"
  rm -f "/etc/systemd/system/vps@.service"

  # Clean up binaries
  rm -f "/usr/local/bin/vps"
  rm -f "${INSTALL_PATH}"
  rm -f "${CTL_INSTALL_PATH}"

  systemctl daemon-reload || true
}

main() {
  require_root
  require_command install
  require_command mktemp
  require_command systemctl

  cleanup_old_install
  download_binaries
  create_service
  start_service

  local root_url
  root_url=$(resolve_root_url)

  echo "${SERVICE_NAME} installed successfully"
  echo "Binary: ${INSTALL_PATH}"
  echo "Control binary: ${CTL_INSTALL_PATH}"
  echo "Service template: ${SERVICE_FILE}"
  echo "Root service instance: ${ROOT_SERVICE_UNIT}"
  echo "Root service URL: ${root_url}"
}

main "$@"
