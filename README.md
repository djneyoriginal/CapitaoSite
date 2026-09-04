# Capitão Site

Monorepositório do site `www.capitao.tec.br`, organizado a partir da versão em produção em 4 de setembro de 2026.

Referências do snapshot inicial: SIX no commit `8df07f1`, Capitão IA no commit `9d257cc` e painel de imprensa incorporado a partir dos arquivos ativos do servidor.

## Componentes

| Diretório | Função | Destino no servidor | Porta local |
| --- | --- | --- | --- |
| `static-site/` | Página inicial, história e patrono | `/usr/share/nginx/html` | Nginx |
| `apps/six/` | Rede social escolar SIX | `/opt/six` | `3000` |
| `apps/imprensa/` | Painel da Imprensa Jovem | `/opt/six/imprensa` | `3001` |
| `apps/video-downloader/` | Capitão IA / downloader web | `/opt/capitao-ia` | `8787` |
| `infra/` | Exemplos de Nginx e unidades systemd | `/etc/nginx` e `/etc/systemd/system` | — |

Rotas públicas esperadas:

- `/`, `/historia/` e `/patrono/`: páginas estáticas;
- `/xis/`: aplicação SIX;
- `/imprensa/`: painel de notícias;
- `/ia` e `/ia.html`: Capitão IA;
- `/api/`: API do Capitão IA.

## Desenvolvimento local

Cada aplicação Node é independente. Entre no diretório desejado, copie o respectivo `.env.example` para `.env`, revise os valores e instale as dependências.

```bash
cd apps/six
cp .env.example .env
npm install
npm start
```

```bash
cd apps/imprensa
cp .env.example .env
npm ci
npm start
```

```bash
cd apps/video-downloader
npm ci
npm run web
```

O downloader também precisa de `yt-dlp` e `ffmpeg`. O instalador para EC2/Amazon Linux ou Ubuntu está em `apps/video-downloader/deploy/aws-install.sh`.

## Segurança e dados de produção

Este repositório contém código e configuração de exemplo. Ele não contém:

- arquivos `.env`;
- cookies de autenticação;
- chaves SSH, certificados privados ou tokens;
- banco SQLite do SIX;
- imagens, publicações e uploads feitos por usuários;
- notícias e configurações reais do painel de imprensa;
- `node_modules`, binários baixados e arquivos temporários.

Esses itens devem permanecer no servidor e ter backup privado e criptografado. Nunca os adicione ao Git com `git add -f`.

## Implantação

Consulte [`infra/README.md`](infra/README.md) antes de alterar o servidor. As configurações incluídas refletem a arquitetura atual, mas caminhos de certificados e segredos precisam ser configurados diretamente na máquina.

## Origem e licenças

O Capitão IA foi personalizado a partir do projeto [aandrew-me/ytDownloader](https://github.com/aandrew-me/ytDownloader) e mantém a licença GPL-3.0 no próprio diretório. Os demais componentes conservam os avisos e condições indicados em seus arquivos. Não há uma licença única para todo o monorepositório.
