const tvAppUrl = window.appUrl || ((routePath) => routePath);
const tvSocket = window.io ? io({ path: tvAppUrl("/socket.io") }) : null;
const TV_DURATION_MS = 12_000;
const TV_DEFAULT_IMAGE = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80";
const TV_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80";

const tvState = { settings: {}, news: [], heroIndex: 0 };
let tvTimer = null;
let tvSoundEnabled = false;
let tvYoutubeApiPromise = null;
let tvYoutubePlayer = null;
let tvActiveYoutube = null;

const tvEl = (id) => document.getElementById(id);

function tvAssetUrl(value) {
  const url = String(value || "");
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const basePath = window.APP_BASE_PATH || "";
  if (basePath && url.startsWith(`${basePath}/`)) return url;
  return tvAppUrl(url.startsWith("/") ? url : `/${url}`);
}

function tvNewsLink(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  const normalized = /^(https?:|\/)/i.test(url) ? url : `https://${url}`;
  try {
    const parsed = new URL(normalized, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function tvFirstLinkInText(value) {
  const match = String(value || "").match(/\b((?:https?:\/\/|www\.)[^\s<>"']+)/i);
  return match ? match[1].replace(/[),.;!?]+$/, "") : "";
}

function tvItemLink(item) {
  return tvNewsLink(item?.link) || tvNewsLink(tvFirstLinkInText(item?.summary));
}

function tvYoutubeVideoId(value) {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);
    let videoId = "";
    if (host === "youtu.be") videoId = segments[0] || "";
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      videoId = ["shorts", "embed"].includes(segments[0]) ? (segments[1] || "") : (parsed.searchParams.get("v") || "");
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : "";
  } catch {
    return "";
  }
}

function tvSortedNews() {
  return [...tvState.news].sort((a, b) => (a.priority || 999) - (b.priority || 999));
}

function tvSetImage(value, fallback = TV_DEFAULT_IMAGE) {
  const image = tvEl("tvImage");
  image.onerror = () => {
    image.onerror = null;
    image.src = TV_FALLBACK_IMAGE;
  };
  image.src = tvAssetUrl(value || fallback);
  image.style.display = "block";
}

function tvUpdateSoundControl(visible) {
  const button = tvEl("tvSound");
  button.hidden = !visible;
  button.setAttribute("aria-pressed", String(tvSoundEnabled));
  button.setAttribute("aria-label", tvSoundEnabled ? "Desativar som" : "Ativar som");
  button.title = tvSoundEnabled ? "Desativar som" : "Ativar som";
  button.innerHTML = tvSoundEnabled ? "&#128266;" : "&#128263;";
}

function tvHideVideo() {
  const video = tvEl("tvVideo");
  video.pause();
  video.muted = true;
  video.loop = true;
  video.onended = null;
  video.removeAttribute("src");
  video.load();
  video.style.display = "none";
}

function tvHideEmbed() {
  tvActiveYoutube = null;
  try {
    tvYoutubePlayer?.destroy?.();
  } catch {}
  tvYoutubePlayer = null;
  tvEl("tvEmbed")?.remove();
}

function tvShowVideo(value, item, playFullVideo) {
  const video = tvEl("tvVideo");
  tvHideEmbed();
  tvEl("tvImage").style.display = "none";
  video.pause();
  video.muted = !tvSoundEnabled;
  video.loop = !playFullVideo;
  video.onended = playFullVideo ? () => tvRotateHero() : null;
  video.onerror = () => {
    video.onerror = null;
    tvHideVideo();
    tvSetImage(item.image, TV_FALLBACK_IMAGE);
    tvUpdateSoundControl(false);
    tvScheduleRotation();
  };
  video.src = tvAssetUrl(value);
  video.style.display = "block";
  video.load();
  video.play().catch(() => {});
}

function tvLoadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (tvYoutubeApiPromise) return tvYoutubeApiPromise;

  tvYoutubeApiPromise = new Promise((resolve, reject) => {
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

  return tvYoutubeApiPromise;
}

function tvCreateYoutubeHost() {
  const host = document.createElement("div");
  host.id = "tvEmbed";
  host.setAttribute("aria-label", "Vídeo em destaque");
  tvEl("tvStory").insertBefore(host, tvEl("tvImage"));
  return host;
}

function tvShowEmbed(videoId, playFullVideo) {
  tvHideVideo();
  tvEl("tvImage").style.display = "none";
  tvHideEmbed();
  tvActiveYoutube = { id: videoId, playFullVideo };
  const host = tvCreateYoutubeHost();

  tvLoadYoutubeApi().then((YT) => {
    if (tvActiveYoutube?.id !== videoId) return;
    tvYoutubePlayer = new YT.Player(host.id, {
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
          if (tvActiveYoutube?.id !== videoId) return;
          event.target.mute();
          if (tvSoundEnabled) event.target.unMute();
          event.target.playVideo();
        },
        onStateChange: (event) => {
          if (tvActiveYoutube?.id === videoId && tvActiveYoutube.playFullVideo && event.data === YT.PlayerState.ENDED) tvRotateHero();
        },
        onError: () => {
          if (tvActiveYoutube?.id === videoId) tvRotateHero();
        }
      }
    });
  }).catch(() => {
    if (tvActiveYoutube?.id === videoId) tvScheduleRotation();
  });
}

function tvToggleSound() {
  tvSoundEnabled = !tvSoundEnabled;
  const video = tvEl("tvVideo");
  video.muted = !tvSoundEnabled;
  if (tvSoundEnabled) video.play().catch(() => {});
  if (tvYoutubePlayer) {
    if (tvSoundEnabled) tvYoutubePlayer.unMute?.();
    else tvYoutubePlayer.mute?.();
    if (tvSoundEnabled) tvYoutubePlayer.playVideo?.();
  }
  tvUpdateSoundControl(Boolean(tvActiveYoutube || video.style.display !== "none"));
}

function tvScheduleRotation(item = null) {
  window.clearTimeout(tvTimer);
  if (tvState.news.length < 2) return;
  if (item?.video && item.playFullVideo) return;
  tvTimer = window.setTimeout(() => tvRotateHero(), TV_DURATION_MS);
}

function tvApplyStoryLink(item) {
  const story = tvEl("tvStory");
  const href = tvItemLink(item);
  story.classList.toggle("is-clickable", Boolean(href));
  story.removeAttribute("href");
  story.removeAttribute("title");
  story.removeAttribute("aria-label");
  if (!href) return;
  story.href = href;
  story.title = "Abrir notícia original em nova guia";
  story.setAttribute("aria-label", `Abrir notícia original em nova guia: ${item.title || ""}`);
}

function tvRenderHero() {
  const news = tvSortedNews();
  const previous = tvEl("tvPrevious");
  const next = tvEl("tvNext");
  const dots = tvEl("tvDots");
  if (!news.length) {
    window.clearTimeout(tvTimer);
    tvSoundEnabled = false;
    tvUpdateSoundControl(false);
    tvHideVideo();
    tvHideEmbed();
    tvSetImage(tvState.settings.heroImage, TV_DEFAULT_IMAGE);
    tvEl("tvTag").textContent = "IMPRENSA JOVEM";
    tvEl("tvNewsTitle").textContent = tvState.settings.title || "Imprensa Jovem P.M.A";
    tvEl("tvSummary").hidden = false;
    tvEl("tvSummary").textContent = "Acompanhe as principais notícias da escola.";
    previous.disabled = true;
    next.disabled = true;
    dots.innerHTML = "";
    dots.hidden = true;
    return;
  }

  tvState.heroIndex = ((tvState.heroIndex % news.length) + news.length) % news.length;
  const item = news[tvState.heroIndex];
  tvSoundEnabled = false;
  tvUpdateSoundControl(Boolean(item.video));
  tvEl("tvTag").textContent = item.category || "DESTAQUE";
  tvEl("tvNewsTitle").textContent = item.title || "";
  tvEl("tvSummary").textContent = item.summary || "";
  tvEl("tvSummary").hidden = Boolean(item.video);
  tvEl("tvStory").classList.toggle("tv-stage__story--video", Boolean(item.video));

  const youtubeId = tvYoutubeVideoId(item.video);
  if (youtubeId) tvShowEmbed(youtubeId, Boolean(item.playFullVideo));
  else if (item.video) tvShowVideo(item.video, item, Boolean(item.playFullVideo));
  else {
    tvHideVideo();
    tvHideEmbed();
    tvSetImage(item.image, TV_FALLBACK_IMAGE);
    tvEl("tvImage").alt = item.title || "Imagem da notícia em destaque";
  }

  tvApplyStoryLink(item);
  const multipleNews = news.length > 1;
  previous.disabled = !multipleNews;
  next.disabled = !multipleNews;
  dots.hidden = Boolean(item.video);
  dots.innerHTML = news.map((_, index) => `<i class="${index === tvState.heroIndex ? "active" : ""}"></i>`).join("");
  tvScheduleRotation(item);
}

function tvRenderSettings() {
  const settings = tvState.settings;
  tvEl("tvTitle").textContent = settings.title || "IMPRENSA JOVEM CAPITÃO";
  tvEl("tvSubtitle").textContent = settings.subtitle || "Informação, educação e protagonismo estudantil";
  tvEl("tvLogo").textContent = settings.logoText || "P.M.A";
}

function tvRenderTicker() {
  const titles = tvSortedNews().slice(0, 6).map((item) => `${item.category || "GERAL"}: ${item.title || ""}`);
  tvEl("tvTicker").textContent = titles.length ? titles.join(" ••• ") : "Imprensa Jovem P.M.A no ar.";
}

function tvRotateHero(direction = 1) {
  const news = tvSortedNews();
  if (!news.length) return;
  tvState.heroIndex = (tvState.heroIndex + direction + news.length) % news.length;
  tvRenderHero();
}

function tvUpdateClock() {
  tvEl("tvClock").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function tvLoadState() {
  const response = await fetch(tvAppUrl("/api/state"));
  const data = await response.json();
  tvState.settings = data.settings || {};
  tvState.news = data.news || [];
  tvRenderSettings();
  tvRenderHero();
  tvRenderTicker();
}

tvEl("tvPrevious").addEventListener("click", () => tvRotateHero(-1));
tvEl("tvNext").addEventListener("click", () => tvRotateHero(1));
tvEl("tvSound").addEventListener("click", tvToggleSound);
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") tvRotateHero(-1);
  if (event.key === "ArrowRight") tvRotateHero(1);
  if (event.key.toLowerCase() === "m" && !tvEl("tvSound").hidden) tvToggleSound();
});

tvUpdateClock();
setInterval(tvUpdateClock, 1000);
tvLoadState().catch(() => tvRenderHero());
if (tvSocket) tvSocket.on("state:update", () => tvLoadState().catch(() => {}));
