
const appUrl = window.appUrl || ((routePath) => routePath);

async function api(path, method = "GET", body) {
  const options = { method, headers: {} };
  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(appUrl(path), options);
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof data === "string" ? data : (data.error || "Erro"));
  return data;
}

function resolveAssetUrl(value) {
  const url = String(value || "");
  if (!url || /^(https?:|data:|blob:)/i.test(url)) return url;
  const basePath = window.APP_BASE_PATH || "";
  if (basePath && url.startsWith(`${basePath}/`)) return url;
  return appUrl(url.startsWith("/") ? url : `/${url}`);
}

const loginBox = document.getElementById("loginBox");
const adminRoot = document.getElementById("adminRoot");
const authInfo = document.getElementById("authInfo");
const newsFields = {
  category: document.getElementById("newsCategory"),
  title: document.getElementById("newsTitle"),
  link: document.getElementById("newsLink"),
  summary: document.getElementById("newsSummary"),
  image: document.getElementById("newsImage"),
  video: document.getElementById("newsVideo"),
  playFullVideo: document.getElementById("newsPlayFullVideo"),
  time: document.getElementById("newsTime"),
  priority: document.getElementById("newsPriority")
};
const newsFormTitle = newsFields.category.closest(".card").querySelector("h2");
const addNewsButton = document.getElementById("addNews");
const uploadFileInput = document.getElementById("uploadFile");
if (uploadFileInput) uploadFileInput.accept = "image/*,video/mp4,video/webm,video/ogg";

addNewsButton.insertAdjacentHTML("afterend", `
  <button class="btn secondary hidden" id="saveNews" type="button">Salvar altera\u00e7\u00e3o</button>
  <button class="btn gray hidden" id="cancelEditNews" type="button">Cancelar edi\u00e7\u00e3o</button>
`);

const saveNewsButton = document.getElementById("saveNews");
const cancelEditNewsButton = document.getElementById("cancelEditNews");
let latestNews = [];
let editingNewsId = null;

function getNewsPayload() {
  return {
    category: newsFields.category.value.trim() || "GERAL",
    title: newsFields.title.value.trim(),
    link: newsFields.link.value.trim(),
    summary: newsFields.summary.value.trim(),
    image: newsFields.image.value.trim(),
    video: newsFields.video.value.trim(),
    playFullVideo: newsFields.playFullVideo.checked,
    time: newsFields.time.value.trim(),
    priority: Number(newsFields.priority.value || 10)
  };
}

function setNewsFormMode(item = null) {
  editingNewsId = item ? String(item.id) : null;
  newsFormTitle.textContent = item ? "Editar not\u00edcia" : "Nova not\u00edcia";
  addNewsButton.classList.toggle("hidden", Boolean(item));
  saveNewsButton.classList.toggle("hidden", !item);
  cancelEditNewsButton.classList.toggle("hidden", !item);

  if (!item) {
    newsFields.category.value = "GERAL";
    newsFields.title.value = "";
    newsFields.link.value = "";
    newsFields.summary.value = "";
    newsFields.image.value = "";
    newsFields.video.value = "";
    newsFields.playFullVideo.checked = false;
    newsFields.time.value = "";
    newsFields.priority.value = "10";
    return;
  }

  newsFields.category.value = item.category || "GERAL";
  newsFields.title.value = item.title || "";
  newsFields.link.value = item.link || "";
  newsFields.summary.value = item.summary || "";
  newsFields.image.value = item.image || "";
  newsFields.video.value = item.video || "";
  newsFields.playFullVideo.checked = Boolean(item.playFullVideo);
  newsFields.time.value = item.time || "";
  newsFields.priority.value = item.priority ?? 10;
  newsFields.title.focus();
  newsFormTitle.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getNewsById(id) {
  return latestNews.find((item) => String(item.id) === String(id));
}

async function loadState() {
  const data = await api("/api/state");
  latestNews = data.news || [];
  const s = data.settings || {};
  document.getElementById("setTitle").value = s.title || "";
  document.getElementById("setSubtitle").value = s.subtitle || "";
  document.getElementById("setCity").value = s.city || "";
  document.getElementById("setVideoUrl").value = s.videoUrl || "";
  document.getElementById("setHeroImage").value = s.heroImage || "";
  document.getElementById("setQrText").value = s.qrText || "";
  document.getElementById("setWeatherKey").value = s.openWeatherApiKey || "";
  document.getElementById("setRssFeeds").value = (s.rssFeeds || []).join("\n");
  const current = document.getElementById("currentItems");
  current.innerHTML = "";
  latestNews.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${item.category || "GERAL"} — ${item.title || ""}</strong><div class="small">${item.summary || ""}</div>${item.video ? `<div class="small">Vídeo no carrossel: ${item.playFullVideo ? "até o fim" : "12 segundos"}</div>` : ""}${item.link ? `<div class="small">Link: ${item.link}</div>` : ""}<div class="actions"><button class="btn gray" data-del-news="${item.id}">Excluir notícia</button></div>`;
    current.appendChild(div);
  });
  (data.events || []).forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${item.date || ""} — ${item.title || ""}</strong><div class="small">${item.summary || ""}</div><div class="actions"><button class="btn gray" data-del-event="${idx}">Excluir evento</button></div>`;
    current.appendChild(div);
  });
  current.querySelectorAll("[data-del-news]").forEach((btn) => {
    const editButton = document.createElement("button");
    editButton.className = "btn secondary";
    editButton.type = "button";
    editButton.textContent = "Editar not\u00edcia";
    editButton.addEventListener("click", () => {
      const item = getNewsById(btn.dataset.delNews);
      if (!item) return alert("Not\u00edcia n\u00e3o encontrada.");
      setNewsFormMode(item);
    });
    btn.before(editButton);
  });
  current.querySelectorAll("[data-del-news]").forEach(btn => btn.addEventListener("click", async () => { await api(`/api/news/${btn.dataset.delNews}`, "DELETE"); loadState(); }));
  current.querySelectorAll("[data-del-event]").forEach(btn => btn.addEventListener("click", async () => { await api(`/api/events/${btn.dataset.delEvent}`, "DELETE"); loadState(); }));
}

async function refreshAuth() {
  const me = await api("/api/me");
  if (me.authenticated) {
    loginBox.style.display = "none";
    adminRoot.style.display = "block";
    authInfo.textContent = `Logado como ${me.user.username}${me.usingMysql ? " • MySQL ativo" : " • Modo local"}`;
    loadState();
  } else {
    loginBox.style.display = "block";
    adminRoot.style.display = "none";
    authInfo.textContent = "";
  }
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    await api("/api/login", "POST", {
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    });
    refreshAuth();
  } catch (e) {
    alert(e.message || "Falha no login");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", "POST");
  refreshAuth();
});

document.getElementById("saveSettings").addEventListener("click", async () => {
  await api("/api/settings", "PUT", {
    title: document.getElementById("setTitle").value.trim(),
    subtitle: document.getElementById("setSubtitle").value.trim(),
    city: document.getElementById("setCity").value.trim(),
    videoUrl: document.getElementById("setVideoUrl").value.trim(),
    heroImage: document.getElementById("setHeroImage").value.trim(),
    qrText: document.getElementById("setQrText").value.trim(),
    openWeatherApiKey: document.getElementById("setWeatherKey").value.trim(),
    rssFeeds: document.getElementById("setRssFeeds").value.split("\n").map(s => s.trim()).filter(Boolean)
  });
  loadState();
  alert("Configurações salvas.");
});

saveNewsButton.addEventListener("click", async () => {
  if (!editingNewsId) return;
  await api(`/api/news/${editingNewsId}`, "PUT", getNewsPayload());
  await loadState();
  setNewsFormMode();
  alert("Not\u00edcia atualizada.");
});

cancelEditNewsButton.addEventListener("click", () => setNewsFormMode());

document.getElementById("addNews").addEventListener("click", async () => {
  await api("/api/news", "POST", getNewsPayload());
  await loadState();
  setNewsFormMode();
  alert("Notícia adicionada.");
});

document.getElementById("addEvent").addEventListener("click", async () => {
  await api("/api/events", "POST", {
    date: document.getElementById("eventDate").value,
    title: document.getElementById("eventTitle").value,
    summary: document.getElementById("eventSummary").value,
    time: document.getElementById("eventTime").value,
    color: document.getElementById("eventColor").value
  });
  loadState();
  alert("Evento adicionado.");
});

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const input = document.getElementById("uploadFile");
  const result = document.getElementById("uploadResult");
  if (!input.files[0]) { result.textContent = "Selecione um arquivo primeiro."; return; }

  const form = new FormData();
  form.append("file", input.files[0]);
  result.textContent = "Enviando arquivo...";

  try {
    const res = await fetch(appUrl("/api/upload"), { method: "POST", body: form });
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) throw new Error(typeof data === "string" ? data : (data.error || "Falha ao enviar imagem."));
    if (!data.url) throw new Error("O servidor nao retornou a URL do arquivo.");

    const isVideo = data.mediaType === "video";
    if (isVideo) newsFields.video.value = data.url;
    else newsFields.image.value = data.url;
    result.textContent = "";

    const message = document.createElement("div");
    message.textContent = isVideo
      ? "Vídeo enviado e aplicado ao campo da notícia."
      : "Imagem enviada e aplicada ao campo da notícia.";

    const code = document.createElement("code");
    code.textContent = data.url;
    code.style.display = "block";
    code.style.marginTop = "6px";

    const preview = document.createElement(isVideo ? "video" : "img");
    preview.src = resolveAssetUrl(data.url);
    if (isVideo) {
      preview.controls = true;
      preview.muted = true;
      preview.playsInline = true;
    } else {
      preview.alt = "Pr\u00e9via da imagem enviada";
    }
    preview.style.display = "block";
    preview.style.maxWidth = "220px";
    preview.style.marginTop = "10px";
    preview.style.borderRadius = "10px";

    result.append(message, code, preview);
    input.value = "";
  } catch (e) {
    result.textContent = e.message || "Falha ao enviar arquivo.";
  }
});

document.getElementById("reloadState").addEventListener("click", loadState);
refreshAuth();
