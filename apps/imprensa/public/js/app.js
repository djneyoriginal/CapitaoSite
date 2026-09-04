
const appUrl = window.appUrl || ((routePath) => routePath);
const socket = window.io ? io({ path: appUrl("/socket.io") }) : null;
const state = { settings: null, news: [], events: [], rss: [], weather: null, heroIndex: 0 };
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80";
const NEWS_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80";
const LOCAL_FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23122a50'/%3E%3Cstop offset='1' stop-color='%2307142b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='800' fill='url(%23g)'/%3E%3Ccircle cx='950' cy='130' r='190' fill='%231d5cff' opacity='.18'/%3E%3Ccircle cx='180' cy='690' r='240' fill='%23e31d2b' opacity='.16'/%3E%3Ctext x='72' y='420' fill='white' font-family='Arial,sans-serif' font-size='64' font-weight='700'%3EImprensa Jovem P.M.A%3C/text%3E%3C/svg%3E";
const HERO_DURATION_MS = 12_000;
let heroTimer = null;
let youtubeApiPromise = null;
let youtubePlayer = null;
let activeYoutubeVideo = null;
let heroSoundEnabled = false;

const el = (id) => document.getElementById(id);

function assetUrl(value) {
  const url = String(value || "");
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const basePath = window.APP_BASE_PATH || "";
  if (basePath && url.startsWith(`${basePath}/`)) return url;
  return appUrl(url.startsWith("/") ? url : `/${url}`);
}
/* Imprensa Jovem P.M.A | Autoria: Prof. Sidney Cambauva | Licença: MIT */

function youtubeVideoId(value) {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return "";

  try {
    const parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);
    let videoId = "";

    if (host === "youtu.be") videoId = segments[0] || "";
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (["shorts", "embed"].includes(segments[0])) videoId = segments[1] || "";
      else videoId = parsed.searchParams.get("v") || "";
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : "";
  } catch {
    return "";
  }
}

function newsLink(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  let normalized = url;
  if (normalized.startsWith("//")) normalized = `https:${normalized}`;
  if (!/^(https?:|\/)/i.test(normalized)) {
    if (!/^(?:www\.)?[^\s./]+\.[^\s./]+(?:[/:?#]|$)/i.test(normalized)) return "";
    normalized = `https://${normalized}`;
  }
  try {
    const parsed = new URL(normalized, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}


function firstLinkInText(value) {
  const match = String(value || "").match(/\b((?:https?:\/\/|www\.)[^\s<>"']+)/i);
  if (!match) return "";
  return match[1].replace(/[),.;!?]+$/, "");
}

function itemNewsLink(item) {
  return newsLink(item?.link) || newsLink(firstLinkInText(item?.summary));
}
function applyNewsLink(element, item) {
  if (!element) return;
  const href = itemNewsLink(item);
  element.classList.toggle("is-clickable", Boolean(href));
  element.removeAttribute("href");
  element.removeAttribute("target");
  element.removeAttribute("rel");
  element.removeAttribute("title");
  element.removeAttribute("aria-label");

  if (!href) return;

  element.href = href;
  element.target = "_blank";
  element.rel = "noopener noreferrer";
  element.setAttribute("title", "Abrir noticia original em nova guia");
  element.setAttribute("aria-label", `Abrir noticia original em nova guia: ${item?.title || ""}`);
}

function sortedNews() {
  return [...state.news].sort((a, b) => (a.priority || 999) - (b.priority || 999));
}

function setImage(imageEl, value, fallback = DEFAULT_IMAGE) {
  if (!imageEl) return;
  imageEl.onerror = () => {
    imageEl.onerror = null;
    imageEl.src = LOCAL_FALLBACK_IMAGE;
  };
  imageEl.src = assetUrl(value || fallback);
}

function youtubeThumbnail(value) {
  const videoId = youtubeVideoId(value);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
}

function createNewsThumbnail(item) {
  const youtubeImage = youtubeThumbnail(item?.video);
  if (youtubeImage) {
    const image = document.createElement("img");
    image.alt = "";
    setImage(image, youtubeImage, NEWS_FALLBACK_IMAGE);
    return image;
  }
  if (item?.video) {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = assetUrl(item.video);
    video.poster = assetUrl(item.image || NEWS_FALLBACK_IMAGE);
    const seekToStart = () => { try { video.currentTime = 0; } catch {} };
    video.addEventListener("loadedmetadata", seekToStart, { once: true });
    video.addEventListener("loadeddata", seekToStart, { once: true });
    return video;
  }
  const image = document.createElement("img");
  image.alt = "";
  setImage(image, item?.image, NEWS_FALLBACK_IMAGE);
  return image;
}

function renderHighlightMedia(item) {
  const image = el("highlightImage");
  const video = el("highlightVideo");
  const youtubeImage = youtubeThumbnail(item?.video);
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.style.display = "none";
  image.style.display = "block";
  if (item?.video && !youtubeImage) {
    video.poster = assetUrl(item.image || NEWS_FALLBACK_IMAGE);
    video.src = assetUrl(item.video);
    const seekToStart = () => { try { video.currentTime = 0; } catch {} };
    video.addEventListener("loadedmetadata", seekToStart, { once: true });
    video.addEventListener("loadeddata", seekToStart, { once: true });
    video.onerror = () => { video.onerror = null; video.style.display = "none"; image.style.display = "block"; setImage(image, item.image, NEWS_FALLBACK_IMAGE); };
    image.style.display = "none";
    video.style.display = "block";
    video.load();
    return;
  }
  setImage(image, youtubeImage || item?.image || "", NEWS_FALLBACK_IMAGE);
}

function updateHeroSoundControl(visible) {
  const button = el("heroSound");
  button.hidden = !visible;
  button.setAttribute("aria-pressed", String(heroSoundEnabled));
  button.setAttribute("aria-label", heroSoundEnabled ? "Desativar som" : "Ativar som");
  button.title = heroSoundEnabled ? "Desativar som" : "Ativar som";
  button.innerHTML = heroSoundEnabled ? "&#128266;" : "&#128263;";
}

function updateHeroFullscreenControl(visible) {
  const button = el("heroFullscreen");
  button.hidden = !visible;
  button.setAttribute("aria-label", document.fullscreenElement ? "Sair da tela cheia" : "Exibir vídeo em tela cheia");
  button.title = document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia";
  button.innerHTML = document.fullscreenElement ? "&#x2715;" : "&#x26F6;";
}

function toggleHeroFullscreen() {
  const target = document.querySelector(".hero");
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch?.(() => {});
    return;
  }
  target?.requestFullscreen?.().catch?.(() => {});
}

function toggleHeroSound() {
  heroSoundEnabled = !heroSoundEnabled;
  const video = el("heroVideo");
  video.muted = !heroSoundEnabled;
  if (heroSoundEnabled) video.play().catch(() => {});

  if (youtubePlayer) {
    if (heroSoundEnabled) youtubePlayer.unMute?.();
    else youtubePlayer.mute?.();
    if (heroSoundEnabled) youtubePlayer.playVideo?.();
  }

  updateHeroSoundControl(Boolean(activeYoutubeVideo || video.style.display !== "none"));
}

function hideHeroVideo() {
  const video = el("heroVideo");
  video.pause();
  video.muted = true;
  video.onended = null;
  video.loop = true;
  video.removeAttribute("src");
  video.load();
  video.style.display = "none";
}

function hideHeroEmbed() {
  activeYoutubeVideo = null;
  try {
    youtubePlayer?.destroy?.();
  } catch {}
  youtubePlayer = null;
  el("heroEmbed")?.remove();
}

function showHeroVideo(value, item, playFullVideo) {
  const video = el("heroVideo");
  const image = el("heroImage");
  hideHeroEmbed();
  image.style.display = "none";
  video.pause();
  video.muted = !heroSoundEnabled;
  video.loop = !playFullVideo;
  video.onended = playFullVideo ? () => rotateHero() : null;
  video.onerror = () => {
    video.onerror = null;
    hideHeroVideo();
    setImage(image, item.image, NEWS_FALLBACK_IMAGE);
    image.style.display = "block";
    updateHeroSoundControl(false);
    updateHeroFullscreenControl(false);
    scheduleHeroRotation();
  };
  video.src = assetUrl(value);
  video.style.display = "block";
  video.load();
  video.play().catch(() => {});
}

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error("YouTube indisponível.")), 10_000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previousReady?.();
      resolve(window.YT);
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("YouTube indisponível."));
    };
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function createYoutubeHost() {
  const host = document.createElement("div");
  host.id = "heroEmbed";
  host.setAttribute("aria-label", "Vídeo em destaque");
  el("heroLink").insertBefore(host, el("heroImage"));
  return host;
}

function showHeroEmbed(videoId, playFullVideo) {
  hideHeroVideo();
  el("heroImage").style.display = "none";
  hideHeroEmbed();
  activeYoutubeVideo = { id: videoId, playFullVideo };
  const host = createYoutubeHost();

  loadYoutubeApi().then((YT) => {
    if (activeYoutubeVideo?.id !== videoId) return;
    youtubePlayer = new YT.Player(host.id, {
      width: "100%",
      height: "100%",
      videoId,
      playerVars: {
        autoplay: 1,
        mute: 1,
        playsinline: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        loop: playFullVideo ? 0 : 1,
        playlist: playFullVideo ? undefined : videoId
      },
      events: {
        onReady: (event) => {
          if (activeYoutubeVideo?.id !== videoId) return;
          event.target.mute();
          if (heroSoundEnabled) event.target.unMute();
          event.target.playVideo();
        },
        onStateChange: (event) => {
          if (activeYoutubeVideo?.id === videoId && activeYoutubeVideo.playFullVideo && event.data === YT.PlayerState.ENDED) rotateHero();
        },
        onError: () => {
          if (activeYoutubeVideo?.id === videoId) rotateHero();
        }
      }
    });
  }).catch(() => {
    if (activeYoutubeVideo?.id === videoId) scheduleHeroRotation();
  });
}

function scheduleHeroRotation(item = null) {
  window.clearTimeout(heroTimer);
  if (state.news.length < 2) return;
  if (item?.video && item.playFullVideo) return;
  heroTimer = window.setTimeout(() => rotateHero(), HERO_DURATION_MS);
}

function fmtDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(date);
}

function updateClock() {
  const now = new Date();
  el("clock").textContent = now.toLocaleTimeString("pt-BR");
  el("bottomClock").textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  el("date").textContent = fmtDate(now);
}

function themeApply(settings) {
  if (!settings?.theme) return;
  const root = document.documentElement.style;
  Object.entries(settings.theme).forEach(([k, v]) => v && root.setProperty(`--${k}`, v));
  document.body.style.background = `radial-gradient(circle at top, ${settings.theme.panel2 || "#0d2550"} 0, ${settings.theme.bg || "#07142b"} 50%, #051022 100%)`;
}

function renderSettings(settings) {
  el("title").textContent = settings.title || "IMPRENSA JOVEM P.M.A";
  el("subtitle").textContent = settings.subtitle || "";
  el("brandLogo").textContent = settings.logoText || "P.M.A";
  el("qrText").textContent = settings.qrText || "ACESSE NOSSO SITE";
  themeApply(settings);

  if (state.news.length) return;

  const video = el("heroVideo");
  const img = el("heroImage");
  hideHeroEmbed();
  if (settings.videoUrl) {
    img.style.display = "none";
    video.style.display = "block";
    video.src = assetUrl(settings.videoUrl);
    video.play().catch(() => {});
  } else if (settings.heroImage) {
    video.style.display = "none";
    img.style.display = "block";
    setImage(img, settings.heroImage);
  } else {
    video.style.display = "none";
    img.style.display = "block";
    setImage(img, DEFAULT_IMAGE);
  }
}

function renderNews() {
  const newsList = el("newsList");
  newsList.innerHTML = "";
  const news = sortedNews();
  if (!news.length) {
    renderHero();
    return newsList.innerHTML = "<div class='small-muted'>Nenhuma notícia cadastrada.</div>";
  }

  news.forEach((item) => {
    const href = itemNewsLink(item);
    const card = document.createElement(href ? "a" : "article");
    card.className = `news-item${href ? " news-item--link" : ""}`;
    if (href) {
      card.href = href;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.setAttribute("aria-label", `Abrir noticia original em nova guia: ${item.title || ""}`);
    }
    card.innerHTML = `
      <div class="news-item__media"></div>
      <div>
        <div class="cat">${item.category || "GERAL"}</div>
        <h3>${item.title || ""}</h3>
        <p>${item.summary || ""}</p>
        <div class="time">${item.time || ""}</div>
      </div>
    `;
    card.querySelector(".news-item__media").appendChild(createNewsThumbnail(item));
    newsList.appendChild(card);
  });

  renderHero();

  const hero = news[0];
  const highlight = news[1] || hero;
  if (highlight) {
    renderHighlightMedia(highlight || hero);
    el("highlightTitle").textContent = highlight.title || "";
    el("highlightSummary").textContent = highlight.summary || "";
    applyNewsLink(document.querySelector(".highlight__main"), highlight);
  }
}

function renderHero() {
  const news = sortedNews();
  const previous = el("heroPrevious");
  const next = el("heroNext");
  const dots = el("heroDots");
  if (!news.length) {
    window.clearTimeout(heroTimer);
    heroSoundEnabled = false;
    updateHeroSoundControl(false);
    document.querySelector(".hero")?.classList.remove("hero--video");
    previous.disabled = true;
    next.disabled = true;
    dots.innerHTML = "";
    dots.hidden = true;
    return;
  }

  state.heroIndex = ((state.heroIndex % news.length) + news.length) % news.length;
  const item = news[state.heroIndex];
  heroSoundEnabled = false;
  updateHeroSoundControl(Boolean(item.video));
  updateHeroFullscreenControl(Boolean(item.video));
  el("heroTag").textContent = item.category || "DESTAQUE";
  el("heroTitle").textContent = item.title || "";
  el("heroSummary").textContent = item.summary || "";
  el("heroSummary").hidden = Boolean(item.video);
  el("heroLink").classList.toggle("hero__story--video", Boolean(item.video));
  document.querySelector(".hero")?.classList.toggle("hero--video", Boolean(item.video));
  const youtubeId = youtubeVideoId(item.video);
  if (youtubeId) {
    showHeroEmbed(youtubeId, Boolean(item.playFullVideo));
  } else if (item.video) {
    showHeroVideo(item.video, item, Boolean(item.playFullVideo));
  } else {
    hideHeroVideo();
    hideHeroEmbed();
    setImage(el("heroImage"), item.image, NEWS_FALLBACK_IMAGE);
    el("heroImage").alt = item.title || "Imagem da noticia em destaque";
    el("heroImage").style.display = "block";
  }
  applyNewsLink(el("heroLink"), item);

  const hasMultipleNews = news.length > 1;
  previous.disabled = !hasMultipleNews;
  next.disabled = !hasMultipleNews;
  dots.hidden = Boolean(item.video);
  dots.innerHTML = news.map((_, index) => `<span class="dot${index === state.heroIndex ? " active" : ""}"></span>`).join("");
  scheduleHeroRotation(item);
}

function renderEvents() {
  const list = el("eventsList");
  list.innerHTML = "";
  if (!state.events.length) return list.innerHTML = "<div class='small-muted'>Nenhum evento cadastrado.</div>";

  state.events.forEach((item) => {
    const div = document.createElement("article");
    div.className = `event-item ${item.color || "red"}`;
    const [day, mon] = (item.date || "00 JAN").split(" ");
    div.innerHTML = `
      <div class="event-date"><div class="day">${day || "00"}</div><div class="mon">${mon || "JAN"}</div></div>
      <div>
        <h3>${item.title || ""}</h3>
        <p>${item.summary || ""}</p>
        <div class="time">${item.time || ""}</div>
      </div>
    `;
    list.appendChild(div);
  });
}

function renderSocial() {
  const list = el("socialList");
  list.innerHTML = "";
  (state.settings?.social || []).forEach((s) => {
    const div = document.createElement("div");
    div.className = "social-item";
    div.innerHTML = `<strong>${s.label}</strong><span>${s.value}</span>`;
    list.appendChild(div);
  });
}

function renderTicker() {
  const items = [];
  state.news.slice(0, 6).forEach((n) => items.push(`${n.category || "GERAL"}: ${n.title || ""}`));
  state.rss.slice(0, 6).forEach((r) => items.push(`RSS: ${r.title || ""}`));
  el("tickerTrack").textContent = items.length ? items.join(" ••• ") : "Imprensa Jovem P.M.A no ar.";
  el("tickerTrack").style.animationDuration = `${state.settings?.tickerSpeed || 35}s`;
}

async function loadWeather() {
  try {
    const city = encodeURIComponent(state.settings?.city || "São Paulo");
    const response = await fetch(appUrl(`/api/weather?city=${city}`));
    state.weather = await response.json();
    el("weatherTemp").textContent = `${state.weather.temp}°C`;
    el("weatherDesc").textContent = `${state.weather.city || ""} • ${state.weather.description || ""}`;
  } catch {
    el("weatherTemp").textContent = "—";
    el("weatherDesc").textContent = "—";
  }
}

async function loadAll() {
  const res = await fetch(appUrl("/api/state"));
  const data = await res.json();
  state.settings = data.settings || {};
  state.news = data.news || [];
  state.events = data.events || [];
  renderSettings(state.settings);
  renderNews();
  renderEvents();
  renderSocial();
  renderTicker();
  await loadWeather();
}

async function loadRss() {
  try {
    const res = await fetch(appUrl("/api/rss"));
    state.rss = await res.json();
    renderTicker();
  } catch {
    state.rss = [];
  }
}

function rotateHero(direction = 1) {
  const news = sortedNews();
  if (!news.length) return;
  state.heroIndex = (state.heroIndex + direction + news.length) % news.length;
  renderHero();
}

updateClock();
setInterval(updateClock, 1000);
setInterval(loadWeather, 10 * 60 * 1000);
setInterval(loadRss, 5 * 60 * 1000);

el("heroPrevious").addEventListener("click", () => rotateHero(-1));
el("heroNext").addEventListener("click", () => rotateHero(1));
el("heroSound").addEventListener("click", toggleHeroSound);
el("heroFullscreen").addEventListener("click", toggleHeroFullscreen);
document.addEventListener("fullscreenchange", () => updateHeroFullscreenControl(Boolean(activeYoutubeVideo || el("heroVideo").style.display !== "none")));

loadAll().then(loadRss);
if (socket) socket.on("state:update", () => loadAll().then(loadRss));
