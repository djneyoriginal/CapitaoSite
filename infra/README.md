# Infraestrutura do servidor

Arquivos desta pasta documentam a configuração observada no EC2. Antes de aplicar mudanças, faça backup dos arquivos ativos e execute os testes indicados abaixo.

## Mapa de implantação

```text
Nginx :80/:443
├── arquivos estáticos ........ /usr/share/nginx/html
├── /xis/ ..................... 127.0.0.1:3000 (six.service)
├── /imprensa/ ................ 127.0.0.1:3001 (imprensa.service)
└── /ia, /ia.html e /api/ ..... 127.0.0.1:8787 (capitao-ia.service)
                                 └── provedor PO Token: 127.0.0.1:4416
```

## Arquivos

- `nginx/six.conf.example`: virtual host principal, com os caminhos dos certificados substituídos por marcadores;
- `nginx/capitao-ia.conf`: rotas do downloader incluídas no bloco HTTPS;
- `systemd/*.service`: unidades dos serviços Node e do provedor local.

## Preparação em uma instalação nova

1. Clone o repositório em uma pasta temporária do servidor.
2. Copie cada aplicação para o destino indicado no `README.md` da raiz.
3. Execute `npm install` ou `npm ci` dentro de cada aplicação.
4. Crie os arquivos `.env` a partir dos exemplos e troque todos os segredos.
5. Instale as unidades systemd e ajuste usuário, grupo e caminhos se necessário.
6. Configure o virtual host e os certificados TLS com Certbot.
7. Teste antes de recarregar o Nginx.

```bash
sudo systemctl daemon-reload
sudo nginx -t
sudo systemctl enable --now six imprensa capitao-ia
sudo systemctl reload nginx
```

Para o Capitão IA em uma máquina limpa, use o instalador específico:

```bash
sudo bash apps/video-downloader/deploy/aws-install.sh apps/video-downloader www.capitao.tec.br
```

Cookies e proxy, quando necessários, pertencem ao arquivo protegido `/etc/capitao-ia.env`; eles nunca devem ser enviados ao GitHub.

## Atualização segura

Preserve antes de sincronizar código:

- `/opt/six/.env` e `/opt/six/data/`;
- `/opt/six/imprensa/.env`, `data/` e `uploads/`;
- `/etc/capitao-ia.env`;
- certificados em `/etc/letsencrypt/`.

Depois da atualização, valide os serviços com `systemctl status`, `journalctl -u <serviço>` e os endpoints públicos.

