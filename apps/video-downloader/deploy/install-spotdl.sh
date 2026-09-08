#!/usr/bin/env bash
set -Eeuo pipefail

# Instala spotDL em um ambiente Python isolado para links do Spotify.

APP_DIR="${APP_DIR:-/opt/capitao-ia}"
SERVICE_USER="${SERVICE_USER:-capitao}"
VENV_DIR="${SPOTDL_VENV_DIR:-$APP_DIR/spotdl-venv}"
ENV_FILE="${ENV_FILE:-/etc/capitao-ia.env}"
SERVICE_NAME="${SERVICE_NAME:-capitao-ia}"

log() { printf '\n[capitao-spotdl] %s\n' "$*"; }
fail() { printf '\n[capitao-spotdl][erro] %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || fail "Execute com sudo."
id -u "$SERVICE_USER" >/dev/null 2>&1 || fail "Usuário $SERVICE_USER não existe."

install_packages() {
	if command -v apt-get >/dev/null 2>&1; then
		export DEBIAN_FRONTEND=noninteractive
		apt-get update
		apt-get install -y python3.11 python3.11-venv python3-pip ffmpeg zip || apt-get install -y python3 python3-venv python3-pip ffmpeg zip
	elif command -v dnf >/dev/null 2>&1; then
		dnf install -y python3.11 python3.11-pip zip || dnf install -y python3 python3-pip zip
		if ! command -v ffmpeg >/dev/null 2>&1; then
			dnf install -y ffmpeg || true
		fi
	else
		fail "Sistema não suportado. Use Ubuntu/Debian ou Amazon Linux com apt/dnf."
	fi
}

install_packages

PYTHON_BIN="$(command -v python3.11 || command -v python3)"
PYTHON_VERSION="$("$PYTHON_BIN" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
case "$PYTHON_VERSION" in
	3.10|3.11|3.12|3.13|3.14) ;;
	*) fail "spotDL exige Python 3.10 ou superior. Detectado: $PYTHON_VERSION" ;;
esac

log "Criando ambiente Python em $VENV_DIR..."
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0755 "$APP_DIR"
rm -rf -- "$VENV_DIR"
"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip wheel
"$VENV_DIR/bin/python" -m pip install --upgrade spotdl

chown -R "$SERVICE_USER:$SERVICE_USER" "$VENV_DIR"

log "Configurando SPOTDL_PATH em $ENV_FILE..."
touch "$ENV_FILE"
if grep -q '^SPOTDL_PATH=' "$ENV_FILE"; then
	sed -i "s|^SPOTDL_PATH=.*|SPOTDL_PATH=$VENV_DIR/bin/spotdl|" "$ENV_FILE"
else
	printf '\nSPOTDL_PATH=%s/bin/spotdl\n' "$VENV_DIR" >> "$ENV_FILE"
fi
chmod 0600 "$ENV_FILE"

systemctl restart "$SERVICE_NAME"

printf '\nspotDL instalado: %s/bin/spotdl\n' "$VENV_DIR"
