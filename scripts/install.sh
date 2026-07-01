#!/usr/bin/env bash
set -euo pipefail

APP_NAME="vps"
CTL_NAME="mthanctl"
BIN_URL="${BIN_URL:-https://github.com/antoine-mai/mthan-tools-vps/raw/main/bin}"
BINARY_URL="${BINARY_URL:-${BIN_URL}/${APP_NAME}}"
CTL_BINARY_URL="${CTL_BINARY_URL:-${BIN_URL}/${CTL_NAME}}"
INSTALL_PATH="${INSTALL_PATH:-/usr/local/bin/${APP_NAME}}"
CTL_INSTALL_PATH="${CTL_INSTALL_PATH:-/usr/local/bin/${CTL_NAME}}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}@.service"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-root}}"
ROOT_ADDR="${ROOT_ADDR:-:2215}"
USER_ADDR="${USER_ADDR:-:2205}"
ROOT_SERVICE_UNIT=""
USER_SERVICE_UNIT=""

require_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    return
  fi

  echo "${APP_NAME} installer must be run as root" >&2
  exit 1
}

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "missing required command: ${command_name}" >&2
    exit 1
  fi
}

resolve_service_user() {
  if [[ -z "${SERVICE_USER}" ]]; then
    echo "set SERVICE_USER to the linux user that should run ${APP_NAME}" >&2
    echo "example: sudo SERVICE_USER=deploy ./scripts/install.sh" >&2
    exit 1
  fi

  if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
    echo "linux user does not exist: ${SERVICE_USER}" >&2
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
Description=VPS service for %I
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=%I
ExecStart=${INSTALL_PATH}
Restart=on-failure
RestartSec=3
Environment=APP_ENV=production
EnvironmentFile=-/etc/${APP_NAME}/%i.env

[Install]
WantedBy=multi-user.target
EOF
}

write_service_env() {
  local service_user="$1"
  local escaped_user="$2"
  local env_file="/etc/${APP_NAME}/${escaped_user}.env"

  mkdir -p "/etc/${APP_NAME}"

  if [[ "${service_user}" == "root" ]]; then
    cat >"${env_file}" <<EOF
APP_ADDR=${ROOT_ADDR}
EOF
    return
  fi

  cat >"${env_file}" <<EOF
APP_ADDR=${USER_ADDR}
POST_BASE_URL=http://127.0.0.1:2215
EOF
}

start_service_for_user() {
  local service_user="$1"
  local escaped_user
  local service_unit

  escaped_user="$(systemd-escape "${service_user}")"
  service_unit="${APP_NAME}@${escaped_user}.service"
  write_service_env "${service_user}" "${escaped_user}"

  systemctl enable --now "${service_unit}"

  if [[ "${service_user}" == "root" ]]; then
    ROOT_SERVICE_UNIT="${service_unit}"
  else
    USER_SERVICE_UNIT="${service_unit}"
  fi
}

start_services() {
  systemctl daemon-reload
  start_service_for_user root

  if [[ "${SERVICE_USER}" != "root" ]]; then
    start_service_for_user "${SERVICE_USER}"
  fi
}

main() {
  require_root
  require_command id
  require_command install
  require_command mktemp
  require_command systemctl
  require_command systemd-escape

  resolve_service_user
  download_binaries
  create_service
  start_services

  echo "${APP_NAME} installed successfully"
  echo "Binary: ${INSTALL_PATH}"
  echo "Control binary: ${CTL_INSTALL_PATH}"
  echo "Service template: ${SERVICE_FILE}"
  echo "Root service instance: ${ROOT_SERVICE_UNIT}"
  echo "Root service addr: ${ROOT_ADDR}"
  if [[ -n "${USER_SERVICE_UNIT}" ]]; then
    echo "User service instance: ${USER_SERVICE_UNIT}"
    echo "User service addr: ${USER_ADDR}"
    echo "User service POST_BASE_URL: http://127.0.0.1:2215"
  fi
}

main "$@"
