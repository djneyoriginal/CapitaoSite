#!/usr/bin/env bash
set -Eeuo pipefail

# Instala o provedor local de PO Token recomendado pelo yt-dlp.
# Ele fica restrito ao loopback e não é publicado pelo nginx.

PROVIDER_VERSION="${PROVIDER_VERSION:-1.3.1}"
PROVIDER_REPOSITORY="https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git"
PROVIDER_DIR="/opt/capitao-pot-provider"
PROVIDER_SOURCE="$PROVIDER_DIR/server/src/main.ts"
PLUGIN_DIR="/etc/yt-dlp/plugins"
PLUGIN_FILE="$PLUGIN_DIR/bgutil-ytdlp-pot-provider.zip"
PLUGIN_URL="https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/$PROVIDER_VERSION/bgutil-ytdlp-pot-provider.zip"
SERVICE_FILE="/etc/systemd/system/capitao-pot-provider.service"
SERVICE_USER="${SERVICE_USER:-capitao}"
TEMP_DIR=""

log() { printf '\n[capitao-pot] %s\n' "$*"; }
fail() { printf '\n[capitao-pot][erro] %s\n' "$*" >&2; exit 1; }

cleanup() {
	[[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]] && rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

[[ "${EUID}" -eq 0 ]] || fail "Execute com sudo."
id -u "$SERVICE_USER" >/dev/null 2>&1 || fail "Instale o serviço capitao-ia primeiro."
for command_name in curl git node npm npx sed ss unzip; do
	command -v "$command_name" >/dev/null 2>&1 || fail "Dependência ausente: $command_name"
done

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$node_major" =~ ^[0-9]+$ && "$node_major" -ge 20 ]] || fail "Node.js 20 ou mais recente é obrigatório."

if [[ -e "$PROVIDER_DIR" ]]; then
	[[ -d "$PROVIDER_DIR/.git" ]] || fail "$PROVIDER_DIR já existe e não é a instalação esperada."
	remote_url="$(git -C "$PROVIDER_DIR" remote get-url origin)"
	[[ "$remote_url" == "$PROVIDER_REPOSITORY" ]] || fail "$PROVIDER_DIR pertence a outro repositório."
	installed_tag="$(git -C "$PROVIDER_DIR" describe --tags --exact-match 2>/dev/null || true)"
	[[ "$installed_tag" == "$PROVIDER_VERSION" ]] || fail "A instalação existente não corresponde à versão $PROVIDER_VERSION."
else
	log "Baixando o provedor $PROVIDER_VERSION..."
	git clone --quiet --depth 1 --single-branch --branch "$PROVIDER_VERSION" "$PROVIDER_REPOSITORY" "$PROVIDER_DIR"
fi

[[ -f "$PROVIDER_SOURCE" ]] || fail "Fonte do servidor de tokens não encontrado."

# A versão 1.3.1 escuta em todas as interfaces. Restrinja-a ao IPv4 local,
# que também é o endereço padrão procurado pelo plugin.
if grep -q 'host: "::",' "$PROVIDER_SOURCE"; then
	sed -i 's/host: "::",/host: "127.0.0.1",/' "$PROVIDER_SOURCE"
fi
if grep -q 'host: "::1",' "$PROVIDER_SOURCE"; then
	sed -i 's/host: "::1",/host: "127.0.0.1",/' "$PROVIDER_SOURCE"
fi
if grep -q 'host: "0\.0\.0\.0",' "$PROVIDER_SOURCE"; then
	sed -i 's/host: "0\.0\.0\.0",/host: "127.0.0.1",/' "$PROVIDER_SOURCE"
fi
grep -q 'host: "127\.0\.0\.1",' "$PROVIDER_SOURCE" || fail "Não foi possível restringir o listener IPv4."

log "Instalando dependências e compilando o provedor..."
(
	cd "$PROVIDER_DIR/server"
	npm ci --no-audit --no-fund
	npx tsc
)
chown -R root:root "$PROVIDER_DIR"
find "$PROVIDER_DIR" -type d -exec chmod go-w {} +
find "$PROVIDER_DIR" -type f -exec chmod go-w {} +

TEMP_DIR="$(mktemp -d)"
log "Instalando o plugin correspondente para yt-dlp..."
curl -fL --retry 3 --connect-timeout 15 "$PLUGIN_URL" -o "$TEMP_DIR/provider.zip"
unzip -tq "$TEMP_DIR/provider.zip" >/dev/null || fail "O pacote do plugin é inválido."
unzip -Z1 "$TEMP_DIR/provider.zip" | grep -q '^yt_dlp_plugins/' || fail "O pacote não contém yt_dlp_plugins/."
install -d -o root -g root -m 0755 "$PLUGIN_DIR"
install -o root -g root -m 0644 "$TEMP_DIR/provider.zip" "$PLUGIN_FILE"

node_bin="$(command -v node)"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Capitao yt-dlp PO Token provider
After=network-online.target
Wants=network-online.target
Before=capitao-ia.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$PROVIDER_DIR/server
ExecStart=$node_bin $PROVIDER_DIR/server/build/main.js
Restart=on-failure
RestartSec=5
CPUQuota=50%
MemoryHigh=128M
MemoryMax=256M
TasksMax=32
LimitNOFILE=1024
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

log "Ativando o serviço local..."
systemctl daemon-reload
systemctl enable capitao-pot-provider.service
systemctl restart capitao-pot-provider.service

healthy=false
for _ in {1..30}; do
	if curl -fsS --noproxy '*' --max-time 3 http://127.0.0.1:4416/ping >/dev/null; then
		healthy=true
		break
	fi
	sleep 1
done

if [[ "$healthy" != true ]]; then
	systemctl --no-pager --full status capitao-pot-provider.service || true
	fail "O provedor não respondeu ao health check."
fi

listeners="$(ss -ltnH | grep -E '(^|[[:space:]])127\.0\.0\.1:4416([[:space:]]|$)' || true)"
[[ -n "$listeners" ]] || fail "O provedor não está ouvindo somente no loopback."
if ss -ltnH | grep -Eq '(^|[[:space:]])(0\.0\.0\.0|\[::\]|\*):4416([[:space:]]|$)'; then
	fail "A porta 4416 foi exposta fora do loopback."
fi

printf '\nProvedor PO Token %s instalado e restrito a 127.0.0.1:4416.\n' "$PROVIDER_VERSION"
