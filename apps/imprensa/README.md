# Imprensa Jovem P.M.A

Painel de notícias para exibição em TV 16:9, com área administrativa, notícias, eventos, RSS, relógio, clima e uploads de imagens.

## Requisitos

- Node.js 18 ou superior
- npm

## Instalação local

```bash
npm install
copy .env.example .env
npm start
```

Com a configuração padrão de `BASE_PATH=/imprensa`, acesse:

- Painel: `http://localhost:3000/imprensa/`
- Admin: `http://localhost:3000/imprensa/admin.html`

## Configuração

Edite o arquivo `.env` depois de copiá-lo:

```env
PORT=3000
BASE_PATH=/imprensa
SESSION_SECRET=troque-por-uma-chave-grande-e-aleatoria
ADMIN_USER=admin
ADMIN_PASSWORD=troque-esta-senha
OPENWEATHER_API_KEY=
```

Não suba o `.env` ao GitHub. Use apenas `.env.example` como modelo.

## Deploy em www.capitao.com.br/imprensa

O projeto está preparado para rodar em subdiretório usando `BASE_PATH=/imprensa`.

Exemplo de proxy reverso com Nginx:

```nginx
location = /imprensa {
  return 301 /imprensa/;
}

location /imprensa/ {
  proxy_pass http://127.0.0.1:3000/imprensa/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Depois do deploy, a URL pública esperada é:

```text
https://www.capitao.com.br/imprensa/
```

## GitHub

Arquivos que devem ir para o repositório:

- `server.js`
- `package.json`
- `package-lock.json`
- `public/`
- `data/`
- `.env.example`
- `.gitignore`

Arquivos que não devem ir:

- `.env`
- `node_modules/`
- arquivos enviados em `uploads/`
- logs locais

## Modo quiosque

```bash
chrome.exe --kiosk https://www.capitao.com.br/imprensa/
```
