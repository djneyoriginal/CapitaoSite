# CapitaoVideoDownloader

Projeto web personalizado para o Capitão IA, publicado em `https://www.capitao.tec.br/ia`. Inclui interface responsiva em português, backend Node.js com yt-dlp e implantação automatizada para AWS Linux com nginx e systemd.

Execute localmente com:

```bash
npm install --omit=dev
npm run web
```

Abra `http://127.0.0.1:8787/ia`.

Este projeto deriva do ytDownloader de aandrew-me e mantém a licença GPL-3.0 e os créditos do projeto original abaixo.

<img src="https://github-production-user-asset-6210df.s3.amazonaws.com/66430340/238887646-33b4cba9-3c45-4042-83d1-b79e94a3a769.png" style="width:80px;">

## Projeto original: ytDownloader

[![Flathub](https://img.shields.io/flathub/downloads/io.github.aandrew_me.ytdn?label=Flathub%20downloads)](https://flathub.org/apps/details/me.aandrew.ytdownloader)
[![GitHub downloads](https://img.shields.io/github/downloads/aandrew-me/ytdownloader/total?label=Github%20downloads)](https://github.com/aandrew-me/ytDownloader/releases)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/aandrew-me/ytdownloader?label=latest%20release)](https://github.com/aandrew-me/ytDownloader/releases/latest)
[![Flathub](https://img.shields.io/flathub/v/io.github.aandrew_me.ytdn)](https://flathub.org/apps/io.github.aandrew_me.ytdn)
[![Snapcraft](https://img.shields.io/snapcraft/v/ytdownloader/latest/stable)](https://snapcraft.io/ytdownloader)
![Chocolatey Version](https://img.shields.io/chocolatey/v/ytdownloader)
![WinGet Package Version](https://img.shields.io/winget/v/aandrew-me.ytDownloader)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/BnjYbTDfF)

A modern GUI video and audio downloader supporting [hundreds of sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)


[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/ytdownloader)
[![Get AppImage](https://raw.githubusercontent.com/srevinsaju/get-appimage/master/static/badges/get-appimage-branding-blue.png)](https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Linux.AppImage)
<a href="https://apps.microsoft.com/detail/9pm2p40txw2s?referrer=appbadge&mode=full" target="_blank"  rel="noopener noreferrer">
	<img src="https://get.microsoft.com/images/en-us%20dark.svg" width="210"/>
</a>
<a href="https://flathub.org/apps/io.github.aandrew_me.ytdn"><img src="https://flathub.org/api/badge?svg&locale=en" style="width:180px;"></a>
<a href="https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Win.exe
"><img src="https://user-images.githubusercontent.com/66430340/187172806-a8edd12a-ef58-4a05-96a3-99d7490b42f6.png" style="width:190px;"></a>
<a href="https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Mac_arm64.dmg"><img src="https://cdn.jsdelivr.net/gh/aandrew-me/badges/download_mac_apple_silicon.png" style="width:200px;"></a>
<a href="https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Mac_x64.dmg"><img src="https://cdn.jsdelivr.net/gh/aandrew-me/badges/download_mac_intel.png" style="width:200px;"></a>
<a href="https://community.chocolatey.org/packages/ytdownloader"><img style="width:200px;" src="https://github-production-user-asset-6210df.s3.amazonaws.com/66430340/238886537-7b2769fe-bd62-4921-a0eb-edf2eb06216d.png" alt="Chocolatey"></a>

## Features 🚀

✅ Supports hundreds of sites including Youtube, Facebook, Instagram, Tiktok, Twitter and so on.

✅ Multiple themes

✅ Video Compressor with Hardware Acceleration

✅ Advanced options like Range Selection, Subtitles

✅ Download playlists

✅ Available on Linux, Windows & macOS

✅ Fast download speeds

✅ And of-course no trackers or ads

## Screenshots

<!-- ![ytdownloader_dark](https://github.com/aandrew-me/ytDownloader/assets/66430340/62efbca0-28b8-4016-bcf2-1a14bcaa782c) -->
<!-- ![ytdownloader_light](https://github.com/aandrew-me/ytDownloader/assets/66430340/34f5270f-bdea-460e-8622-6459cd147b73) -->

<!-- ![ss_homepage](https://github.com/user-attachments/assets/12410bca-31c3-48a0-bbd3-1d74bcc752b6) -->
<!-- ![ss_compressor](https://github.com/user-attachments/assets/52da7e50-46bb-4749-8152-5e79324a6cc3) -->

<img width="3178" height="1870" alt="ss_homepage" src="https://github.com/user-attachments/assets/cff15ee5-a78b-43d1-adce-19c7f5d59221" />
<img width="2848" height="1842" alt="ss_compressor" src="https://github.com/user-attachments/assets/e5d4fac3-9688-4617-960b-1cd0960e6ba0" />



# Installation

## Windows 🪟
- **Microsoft Store**

    Download app from [Microsoft Store](https://apps.microsoft.com/detail/9pm2p40txw2s).

- **Traditional way**

    Download and install the exe or msi file. Exe file lets you choose custom download location, msi file doesn't ask for location. Windows defender may show a popup saying **Windows Protected Your PC**. Just click on **More info** and click on **Run Anyway**

- **Chocolatey**
  App can be installed from [Chocolatey](https://community.chocolatey.org/packages/ytdownloader) using the following command
    ```
    choco install ytdownloader
    ```
- **Scoop**
  App can be installed with [Scoop](https://scoop.sh) using the following command
    ```
    scoop install https://raw.githubusercontent.com/aandrew-me/ytDownloader/main/ytdownloader.json
    ```
- **Winget**

    App can be installed with [Winget](https://github.com/microsoft/winget-cli) using the following command

    ```
    winget install aandrew-me.ytDownloader
    ```

## Linux 🐧

Linux has several options available - Flatpak, AppImage and Snap.
Flatpak is recommended. For arm processors, download from flathub.

- ### AppImage

    **AppImage** format is supported on most Linux distros and has Auto-Update support.
    It just needs to be executed after downloading. See more about [AppImages here](https://appimage.org/).

    [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) is recommended for integrating AppImages.

- ### Flatpak
    ```
    flatpak install flathub io.github.aandrew_me.ytdn
    ```
- ### Snapcraft
    ```
    sudo snap install ytdownloader
    ```

## macOS 🍎

Since the app is not signed, when you will try to open the app, macOS will not allow you to open it.

You need to open terminal and execute:

```
sudo xattr -r -d com.apple.quarantine /Applications/YTDownloader.app
```

You will also need to install `yt-dlp` with [homebrew](https://brew.sh/)

```
brew install yt-dlp
```

## Internationalization (Localization) 🌍

Translations into other languages would be highly appreciated. If you want to help translating the app to other languages, you can join from [here](https://crwd.in/ytdownloader). Open a new issue and that language will be added to Crowdin. Please don't make pull requests with json files, instead use Crowdin.

[![Crowdin](https://badges.crowdin.net/ytdownloader/localized.svg)](https://crowdin.com/project/ytdownloader)

### ✅ Available languages

| Name                | Status |
| ------------------- | ------ |
| Arabic              | ✔️     |
| Basque              | ✔️     |
| Bengali             | ✔️     |
| English             | ✔️     |
| Chinese Simplified  | ✔️     |
| Chinese Traditional | ✔️     |
| Finnish             | ✔️     |
| Hindi               | ✔️     |
| French              | ✔️     |
| Finnish             | ✔️     |
| German              | ✔️     |
| Greek               | ✔️     |
| Hungarian           | ✔️     |
| Italian             | ✔️     |
| Japanese            | ✔️     |
| Persian             | ✔️     |
| Polish              | ✔️     |
| Portuguese (Brazil) | ✔️     |
| Russian             | ✔️     |
| Spanish             | ✔️     |
| Turkish             | ✔️     |
| Ukrainian           | ✔️     |
| Vietnamese          | ✔️     |

Thanks to [nxjosephofficial](https://github.com/nxjosephofficial), [LINUX-SAUNA](https://t.me/linuxsauna), [Proxycon](https://github.com/proxycon), [albanobattistella](https://github.com/albanobattistella), [TheBlueQuasar](https://github.com/TheBlueQuasar), [MrQuerter](https://github.com/MrQuerter), [KotoWhiskas](https://github.com/KotoWhiskas), [André](https://github.com/andre1828), [haggen88](https://github.com/haggen88), [XfedeX](https://github.com/XfedeX), [Jok3r](https://github.com/th3knv), [TitouanReal](https://github.com/TitouanReal), [soredake](https://github.com/soredake), [yoi](https://github.com/thiennguyenqn), [HowlingWerewolf](https://github.com/HowlingWerewolf), [Kum](https://github.com/kum4423), [Mohammed Bakry](https://crowdin.com/profile/m7md_b4kry), [Huang Bingfeng](https://github.com/jackiotyu), [Abhinav](https://github.com/abhixdd), [CodWiz](https://github.com/C0dwiz) and others for helping.

## Used technologies

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [Electron](https://www.electronjs.org/)
- [ffmpeg](https://ffmpeg.org/)
- [nodeJS](https://nodejs.org/en/)
- [flaticon](https://www.flaticon.com/)

## For building or running from source code

[Nodejs](https://nodejs.org/) (along with npm) needs to be installed.

Required commands to get started.

```
git clone https://github.com/aandrew-me/ytDownloader.git
cd ytDownloader
npm i
```

To run with [Electron](https://www.electronjs.org/) :

```
npm start
```

You need to download ffmpeg and put it in the root directory of the project. If you don't need to build for arm processor, you can download ffmpeg by executing any of the files - linux.sh / mac.sh / windows.sh depending on the platform. Otherwise you need to download ffmpeg from [here](https://github.com/yt-dlp/FFmpeg-Builds/releases) for windows/linux and from [here](http://www.osxexperts.net/) for mac (not tested)

To build for Linux (It will create packages as specified in package.json). The builds are stored in **release** folder.

```
npm run linux
```

To build for Windows

```
npm run windows
```

To build for macOS

```
npm run mac
```

If you only want to build for one format, you can do

```
npx electron-builder -l appimage
```

It will just create a linux appimage build.

## AWS Linux deployment

The repository includes `deploy/aws-install.sh` for an AWS EC2 instance running Ubuntu/Debian or Amazon Linux with `apt`/`dnf`. It installs Node.js, nginx and ffmpeg, creates the isolated `capitao` system user, configures systemd, and publishes the web page through nginx.

Upload the ZIP package to the instance, then run:

```bash
scp capitao-ia-ytdownloader.zip ec2-user@YOUR_SERVER:/tmp/
ssh ec2-user@YOUR_SERVER
sudo bash /path/to/deploy/aws-install.sh /tmp/capitao-ia-ytdownloader.zip www.capitao.tec.br seu-email@example.com
```

The third argument is optional. When supplied, the installer also attempts to configure a Let’s Encrypt certificate with Certbot. Before running it, point the DNS `A` record for `www.capitao.tec.br` to the EC2 public IP and allow inbound TCP 80 and 443 in the AWS Security Group. The application itself stays bound to `127.0.0.1:8787`.

After installation, use `https://www.capitao.tec.br/ia`. Check the service with `sudo systemctl status capitao-ia` and view logs with `sudo journalctl -u capitao-ia -f`.

If `www.capitao.tec.br` already serves another site, do not replace its `server` block. Include `deploy/nginx-capitao-ia-location.conf` inside the existing nginx block for that domain, then run:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The existing site remains at `/`; the downloader uses `/ia` and `/api/`. `/ia.html` remains available as a compatibility alias.

### Cookies for protected sites

YouTube and other services can reject EC2/datacenter addresses with a bot or sign-in challenge. The application supports a Netscape-format `cookies.txt` through `YT_DLP_COOKIES_PATH`. Export cookies only from an account dedicated to this service; using a personal account on a public downloader can expose the account to rate limits or a ban. Follow the [official yt-dlp cookie instructions](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies).

Upload the file without pasting its contents into the terminal, then install it with restricted permissions:

```bash
sudo bash deploy/install-cookies.sh /path/to/cookies.txt
```

The script installs it as `/var/lib/capitao/cookies.txt`, owned by the isolated `capitao` user with mode `0600`, writes `/etc/capitao-ia.env` with mode `0600`, and restarts the service. yt-dlp needs write access because extractors can refresh cookie data while processing a request. The systemd unit loads this optional environment file automatically.

If a datacenter IP is still challenged after cookies are installed, you can add the local BgUtils PO Token provider used by yt-dlp:

```bash
sudo bash deploy/install-pot-provider.sh
```

The script pins provider and plugin version `1.3.1`, builds it with Node.js 20 or newer, and creates the resource-limited `capitao-pot-provider` systemd service. Version 1.3.1 normally listens on every interface, so this installer patches it to listen only on `127.0.0.1`; port `4416` is never added to nginx. A PO Token can help with YouTube integrity checks, but it cannot guarantee that an IP, account, or rights-restricted video will be accepted.

The AWS systemd unit enables Node as yt-dlp's JavaScript challenge runtime. When using the provider, add the recommended YouTube client to `/etc/capitao-ia.env`:

```ini
YT_DLP_EXTRACTOR_ARGS=youtube:player_client=mweb
```

If yt-dlp reports that account cookies were rotated, create a fresh private/incognito browser session with only one tab, log into YouTube, open `https://www.youtube.com/robots.txt` in that same tab, export the `youtube.com` cookies, and immediately close the private window. Do not open that private session again; then run `install-cookies.sh` with the new file. Cookie expiry dates alone do not prove that the server-side YouTube session is still valid.

If metadata works but the media transfer still returns HTTP 403, the AWS/datacenter egress IP is being rejected. You can supply an authorized proxy in the protected `/etc/capitao-ia.env` file and restart the application:

```ini
YT_DLP_PROXY=http://user:password@proxy-host:port
```

```bash
sudo systemctl restart capitao-ia
```

Keep the environment file at mode `0600`. Use only a proxy account intended for this service; proxy credentials are passed to the yt-dlp child process.

### Capacity limits

The AWS service defaults are sized for a small EC2 instance: one concurrent download, 12 media API requests per minute per client IP, a 384 MB memory high watermark, a 640 MB hard memory limit, and a 150% CPU quota. Override the application limits in `/etc/capitao-ia.env` when moving to a larger instance:

```ini
MAX_CONCURRENT_DOWNLOADS=1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=12
```

## Web page for capitao.tec.br

This repository also includes a server-backed web downloader at `ia.html`. The original ytDownloader desktop application remains available through Electron; the web page uses `server.js` to run yt-dlp on the server and stream the result back to the browser.

### Run locally

Node.js 22 or newer and `ffmpeg` are recommended for current YouTube JavaScript challenges. The first request downloads a compatible yt-dlp binary into the ignored `runtime/` folder when `yt-dlp` is not already available in `PATH`.

```bash
npm install --omit=dev
npm run web
```

Open `http://127.0.0.1:8787/ia`. Set `PORT` and `HOST` when the service needs a different bind address.

### Publish on `www.capitao.tec.br`

Run the Node service behind the HTTPS reverse proxy provided by the server or hosting panel. For example, with Caddy:

```text
www.capitao.tec.br {
    reverse_proxy 127.0.0.1:8787
}
```

The public page is then `https://www.capitao.tec.br/ia`. Keep the Node process alive with the hosting panel, systemd, Docker or another process manager. `ffmpeg` must be installed on the server for audio conversion and for merging separate video/audio streams.

If the server already has yt-dlp installed, set `YT_DLP_PATH` to its absolute path. Otherwise `server.js` downloads the stable binary automatically from the yt-dlp release service on first use.
