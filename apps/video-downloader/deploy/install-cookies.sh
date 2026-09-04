#!/usr/bin/env bash
set -Eeuo pipefail

# Instala um cookies.txt Netscape sem expor seu conteúdo na linha de comando.
# Uso: sudo bash deploy/install-cookies.sh /caminho/para/cookies.txt

SOURCE="${1:-}"
SERVICE_USER="${SERVICE_USER:-capitao}"
COOKIE_DIR="/var/lib/$SERVICE_USER"
COOKIE_FILE="$COOKIE_DIR/cookies.txt"
ENV_FILE="/etc/capitao-ia.env"
TEMP_COOKIE=""
TEMP_ENV=""

cleanup() {
	[[ -n "$TEMP_COOKIE" && -f "$TEMP_COOKIE" ]] && rm -f -- "$TEMP_COOKIE"
	[[ -n "$TEMP_ENV" && -f "$TEMP_ENV" ]] && rm -f -- "$TEMP_ENV"
}
trap cleanup EXIT

[[ "${EUID}" -eq 0 ]] || { echo "Execute com sudo." >&2; exit 1; }
[[ -f "$SOURCE" ]] || { echo "Arquivo cookies.txt não encontrado." >&2; exit 1; }
id -u "$SERVICE_USER" >/dev/null 2>&1 || { echo "Instale o serviço capitao-ia primeiro." >&2; exit 1; }

first_line="$(head -n 1 "$SOURCE" | tr -d '\r')"
if [[ "$first_line" != "# HTTP Cookie File" && "$first_line" != "# Netscape HTTP Cookie File" ]]; then
	echo "O arquivo precisa estar no formato Netscape cookies.txt." >&2
	exit 1
fi

install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0700 "$COOKIE_DIR"
TEMP_COOKIE="$(mktemp)"
sed 's/\r$//' "$SOURCE" > "$TEMP_COOKIE"
install -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0600 "$TEMP_COOKIE" "$COOKIE_FILE"

TEMP_ENV="$(mktemp)"
if [[ -f "$ENV_FILE" ]]; then
	grep -v '^YT_DLP_COOKIES_PATH=' "$ENV_FILE" > "$TEMP_ENV" || true
fi
printf 'YT_DLP_COOKIES_PATH=%s\n' "$COOKIE_FILE" >> "$TEMP_ENV"
install -o root -g root -m 0600 "$TEMP_ENV" "$ENV_FILE"

systemctl daemon-reload
systemctl restart capitao-ia

healthy=false
for _ in {1..15}; do
	if curl -fsS --max-time 3 http://127.0.0.1:8787/api/health >/dev/null; then
		healthy=true
		break
	fi
	sleep 1
done

if [[ "$healthy" != true ]]; then
	systemctl --no-pager --full status capitao-ia || true
	echo "Cookies instalados, mas o serviço não respondeu ao health check." >&2
	exit 1
fi

printf 'Cookies instalados em %s e serviço reiniciado.\n' "$COOKIE_FILE"
