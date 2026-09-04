#!/usr/bin/env bash
set -Eeuo pipefail

# Capitão IA — instalação automatizada em EC2/AWS Linux.
# Uso: sudo bash deploy/aws-install.sh [pacote.zip|diretório] [domínio] [e-mail]

APP_NAME="capitao-ia"
APP_DIR="${APP_DIR:-/opt/capitao-ia}"
SERVICE_USER="${SERVICE_USER:-capitao}"
PORT="${PORT:-8787}"
DOMAIN="${2:-${DOMAIN:-www.capitao.tec.br}}"
EMAIL="${3:-${CERTBOT_EMAIL:-}}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${1:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NGINX_FILE="/etc/nginx/conf.d/${APP_NAME}.conf"
NGINX_SNIPPET="/etc/nginx/snippets/${APP_NAME}.conf"
NGINX_MODE="${NGINX_MODE:-auto}"
NGINX_EXISTING_VHOST=""
TEMP_DIR=""

log() { printf '\n[capitao-ia] %s\n' "$*"; }
warn() { printf '\n[capitao-ia][aviso] %s\n' "$*" >&2; }
fail() { printf '\n[capitao-ia][erro] %s\n' "$*" >&2; exit 1; }

cleanup() {
	if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
		rm -rf -- "$TEMP_DIR"
	fi
}
trap cleanup EXIT

[[ "${EUID}" -eq 0 ]] || fail "Execute como root: sudo bash deploy/aws-install.sh ..."
[[ "$APP_DIR" != "/" && "$APP_DIR" != "/opt" ]] || fail "APP_DIR aponta para um diretório amplo demais."
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || fail "Domínio inválido: $DOMAIN"
[[ -e "$SOURCE" ]] || fail "Origem não encontrada: $SOURCE"

install_packages() {
	if command -v apt-get >/dev/null 2>&1; then
		export DEBIAN_FRONTEND=noninteractive
		apt-get update
		apt-get install -y ca-certificates curl nginx unzip tar xz-utils nodejs npm
		PKG_MANAGER="apt"
	elif command -v dnf >/dev/null 2>&1; then
		local dnf_packages=(ca-certificates nginx unzip tar xz)
		# Amazon Linux 2023 ships curl-minimal, which conflicts with the full curl
		# package even though it already provides the command needed here.
		command -v curl >/dev/null 2>&1 || dnf_packages+=(curl)
		dnf install -y "${dnf_packages[@]}"
		if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
			curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
			dnf install -y nodejs
		fi
		PKG_MANAGER="dnf"
	else
		fail "Sistema não suportado. Use Ubuntu/Debian ou Amazon Linux com apt/dnf."
	fi

	local node_major
	node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
	if (( node_major < 22 )); then
		log "Node.js $node_major detectado; atualizando para Node.js 22..."
		if [[ "$PKG_MANAGER" == "apt" ]]; then
			curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
			apt-get install -y nodejs
		else
			curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
			dnf install -y nodejs
		fi
	fi
}

install_ffmpeg() {
	command -v ffmpeg >/dev/null 2>&1 && return 0
	log "Instalando ffmpeg..."
	if [[ "${PKG_MANAGER}" == "apt" ]] && apt-get install -y ffmpeg; then return 0; fi
	if [[ "${PKG_MANAGER}" == "dnf" ]] && dnf install -y ffmpeg; then return 0; fi

	if [[ "$(uname -m)" != "x86_64" ]]; then
		fail "ffmpeg não está disponível no gerenciador deste sistema e o fallback incluído suporta apenas x86_64."
	fi

	local ffmpeg_tmp ffmpeg_dir
	ffmpeg_tmp="$(mktemp -d)"
	curl -fL --retry 3 https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o "$ffmpeg_tmp/ffmpeg.tar.xz"
	tar -xJf "$ffmpeg_tmp/ffmpeg.tar.xz" -C "$ffmpeg_tmp"
	ffmpeg_dir="$(find "$ffmpeg_tmp" -mindepth 1 -maxdepth 1 -type d -name 'ffmpeg-*' -print -quit)"
	[[ -n "$ffmpeg_dir" ]] || fail "Não foi possível localizar o pacote extraído do ffmpeg."
	install -m 0755 "$ffmpeg_dir/ffmpeg" /usr/local/bin/ffmpeg
	install -m 0755 "$ffmpeg_dir/ffprobe" /usr/local/bin/ffprobe
}

prepare_source() {
	TEMP_DIR="$(mktemp -d)"
	local source_root
	if [[ -d "$SOURCE" ]]; then
		cp -a "$SOURCE"/. "$TEMP_DIR/app" 2>/dev/null || {
			mkdir -p "$TEMP_DIR/app"
			cp -a "$SOURCE"/. "$TEMP_DIR/app/"
		}
	else
		mkdir -p "$TEMP_DIR/unpacked"
		unzip -q "$SOURCE" -d "$TEMP_DIR/unpacked"
		local source_file
		source_file="$(find "$TEMP_DIR/unpacked" -type f -name ia.html -print -quit)"
		[[ -n "$source_file" ]] || fail "O pacote não contém ia.html."
		source_root="$(dirname -- "$source_file")"
		[[ -f "$source_root/server.js" ]] || fail "O pacote não contém ia.html e server.js na mesma raiz."
		mkdir -p "$TEMP_DIR/app"
		cp -a "$source_root"/. "$TEMP_DIR/app/"
	fi

	[[ -f "$TEMP_DIR/app/ia.html" ]] || fail "ia.html não encontrado na origem."
	[[ -f "$TEMP_DIR/app/server.js" ]] || fail "server.js não encontrado na origem."
	install -d -m 0755 "$APP_DIR"
	cp -a "$TEMP_DIR/app"/. "$APP_DIR/"
}

create_service_user() {
	if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
		useradd --system --create-home --home-dir "/var/lib/$SERVICE_USER" --shell /usr/sbin/nologin "$SERVICE_USER"
	fi
	chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
}

install_dependencies() {
	log "Instalando dependências de produção..."
	if [[ -f "$APP_DIR/package-lock.json" ]]; then
		runuser -u "$SERVICE_USER" -- env HOME="/var/lib/$SERVICE_USER" npm ci --omit=dev --no-audit --no-fund --prefix "$APP_DIR"
	else
		runuser -u "$SERVICE_USER" -- env HOME="/var/lib/$SERVICE_USER" npm install --omit=dev --no-audit --no-fund --prefix "$APP_DIR"
	fi
}

write_service() {
	local node_bin
	node_bin="$(command -v node)"
	cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Capitão IA web downloader
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=$node_bin $APP_DIR/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$PORT
Environment=MAX_CONCURRENT_DOWNLOADS=1
Environment=RATE_LIMIT_WINDOW_MS=60000
Environment=RATE_LIMIT_MAX_REQUESTS=12
Environment=YT_DLP_JS_RUNTIME=node
EnvironmentFile=-/etc/capitao-ia.env
CPUQuota=150%
MemoryHigh=384M
MemoryMax=640M
TasksMax=64
LimitNOFILE=4096
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF
}

write_nginx() {
	local existing_vhost=""
	if [[ "$NGINX_MODE" != "dedicated" ]]; then
		existing_vhost="$(grep -RIl --include='*.conf' "$DOMAIN" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -v -F "$NGINX_FILE" | head -n 1 || true)"
	fi

	if [[ "$NGINX_MODE" == "existing" || -n "$existing_vhost" ]]; then
		NGINX_EXISTING_VHOST="$existing_vhost"
		install -d -m 0755 /etc/nginx/snippets
		cat > "$NGINX_SNIPPET" <<EOF
# Inclua este arquivo dentro do bloco server de $DOMAIN.
location = /ia {
    proxy_pass http://127.0.0.1:$PORT/ia;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}

location = /ia.html {
    proxy_pass http://127.0.0.1:$PORT/ia;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}

location ^~ /api/ {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF
		if [[ -f "$NGINX_FILE" ]]; then
			mv -- "$NGINX_FILE" "$NGINX_FILE.disabled"
		fi
		warn "Virtual host existente detectado. Inclua $NGINX_SNIPPET dentro de $existing_vhost antes de acessar /ia."
		nginx -t
		return 0
	fi

	install -d -m 0755 /etc/nginx/conf.d
	cat > "$NGINX_FILE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 1m;
    proxy_read_timeout 1h;
    proxy_send_timeout 1h;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
	nginx -t
}

setup_tls() {
	[[ -n "$EMAIL" ]] || { warn "HTTPS não configurado: informe o e-mail como terceiro argumento para usar Certbot."; return 0; }

	log "Instalando Certbot para $DOMAIN..."
	if [[ "$PKG_MANAGER" == "apt" ]]; then
		apt-get install -y certbot python3-certbot-nginx || warn "Certbot não está disponível neste repositório."
	else
		dnf install -y certbot python3-certbot-nginx || warn "Certbot não está disponível neste repositório."
	fi

	if command -v certbot >/dev/null 2>&1; then
		if ! certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" -d "$DOMAIN"; then
			warn "Certbot não conseguiu emitir o certificado. Confirme DNS e portas 80/443; o site continua disponível em HTTP."
		fi
	fi
}

log "Instalando pacotes do sistema..."
install_packages
install_ffmpeg
prepare_source
create_service_user
install_dependencies
write_service
write_nginx

log "Ativando Capitão IA e nginx..."
systemctl daemon-reload
systemctl enable --now "${APP_NAME}.service"
systemctl enable --now nginx
systemctl restart "${APP_NAME}.service"
sleep 2

if ! curl -fsS --max-time 10 "http://127.0.0.1:$PORT/api/health" >/dev/null; then
	systemctl --no-pager --full status "${APP_NAME}.service" || true
	fail "O serviço não respondeu ao health check."
fi

setup_tls

log "Instalação concluída."
printf 'Página:  http://%s/ia\n' "$DOMAIN"
printf 'Serviço: systemctl status %s\n' "$APP_NAME"
printf 'Logs:    journalctl -u %s -f\n' "$APP_NAME"
printf 'AWS:     libere TCP 80 e 443 no Security Group; não exponha a porta %s.\n' "$PORT"
if [[ -n "$NGINX_EXISTING_VHOST" ]]; then
	printf 'Nginx:   inclua %s dentro de %s e execute: sudo nginx -t && sudo systemctl reload nginx\n' "$NGINX_SNIPPET" "$NGINX_EXISTING_VHOST"
fi
