require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Parser = require("rss-parser");
const session = require("express-session");
const mysql = require("mysql2/promise");
const { createServer } = require("http");
const { Server } = require("socket.io");

function normalizeBasePath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

const app = express();
const httpServer = createServer(app);
const router = express.Router();

const PORT = process.env.PORT || 3000;
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || "");
const SOCKET_PATH = `${BASE_PATH}/socket.io`;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");

const io = new Server(httpServer, { path: SOCKET_PATH });
const parser = new Parser();

function withBasePath(routePath) {
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${BASE_PATH}${normalizedPath}`;
}

app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { path: BASE_PATH || "/" }
}));

router.use(express.static(path.join(__dirname, "public")));
router.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    if (["video/mp4", "video/webm", "video/ogg"].includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Envie uma imagem ou um vídeo MP4, WebM ou OGG."));
  }
});

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(DATA_DIR);
ensureDir(UPLOADS_DIR);

function readJson(fileName, fallback) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(fileName, data) {
  fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2), "utf-8");
}

function getSettings() { return readJson("settings.json", {}); }

function getNews() {
  const arr = readJson("news.json", []);
  return [...arr].sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));
}

function getEvents() { return readJson("events.json", []); }

let db = null;
let usingMysql = false;

async function initMysql() {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;
  if (!host || !user || !database) return;
  try {
    db = await mysql.createPool({
      host,
      port: Number(process.env.MYSQL_PORT || 3306),
      user,
      password: process.env.MYSQL_PASSWORD || "",
      database,
      waitForConnections: true,
      connectionLimit: 5
    });
    await db.query(`CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY,
      data LONGTEXT NOT NULL
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS news (
      id BIGINT PRIMARY KEY,
      data LONGTEXT NOT NULL
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS events (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      data LONGTEXT NOT NULL
    )`);
    usingMysql = true;
    console.log("MySQL conectado.");
  } catch (err) {
    console.log("MySQL indisponível, usando JSON local:", err.message);
    db = null;
    usingMysql = false;
  }
}
initMysql();

function broadcastState() { io.emit("state:update"); }

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: "Não autenticado" });
}

function safeDemoAuth(user, pass) {
  const u = process.env.ADMIN_USER || "admin";
  const p = process.env.ADMIN_PASSWORD;
  return Boolean(u && p && user === u && pass === p);
}

router.get("/api/me", (req, res) => {
  res.json({ authenticated: !!req.session?.user, user: req.session?.user || null, usingMysql });
});

router.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (safeDemoAuth(username, password)) {
    req.session.user = { username };
    return res.json({ ok: true, user: req.session.user });
  }
  return res.status(401).json({ error: "Usuário ou senha inválidos" });
});

router.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/api/state", async (req, res) => {
  const settings = getSettings();
  const news = getNews();
  const events = getEvents();
  res.json({ settings, news, events, usingMysql });
});

router.get("/api/settings", (req, res) => res.json(getSettings()));

router.put("/api/settings", requireAuth, (req, res) => {
  const current = getSettings();
  const next = { ...current, ...req.body };
  next.theme = { ...current.theme, ...(req.body.theme || {}) };
  writeJson("settings.json", next);
  broadcastState();
  res.json(next);
});

router.get("/api/news", (req, res) => res.json(getNews()));

router.post("/api/news", requireAuth, (req, res) => {
  const news = readJson("news.json", []);
  const item = {
    id: Date.now(),
    category: req.body.category || "GERAL",
    title: req.body.title || "Sem título",
    link: req.body.link || "",
    summary: req.body.summary || "",
    image: req.body.image || "",
    video: req.body.video || "",
    playFullVideo: Boolean(req.body.playFullVideo),
    time: req.body.time || new Date().toLocaleString("pt-BR"),
    priority: Number(req.body.priority || 999)
  };
  news.push(item);
  writeJson("news.json", news);
  broadcastState();
  res.json(item);
});

router.put("/api/news/:id", requireAuth, (req, res) => {
  const news = readJson("news.json", []);
  const id = Number(req.params.id);
  const idx = news.findIndex(n => Number(n.id) === id);
  if (idx === -1) return res.status(404).json({ error: "Notícia não encontrada" });
  news[idx] = { ...news[idx], ...req.body, priority: Number(req.body.priority ?? news[idx].priority ?? 999) };
  writeJson("news.json", news);
  broadcastState();
  res.json(news[idx]);
});

router.delete("/api/news/:id", requireAuth, (req, res) => {
  const news = readJson("news.json", []);
  const id = Number(req.params.id);
  writeJson("news.json", news.filter(n => Number(n.id) !== id));
  broadcastState();
  res.json({ ok: true });
});

router.get("/api/events", (req, res) => res.json(getEvents()));

router.post("/api/events", requireAuth, (req, res) => {
  const events = readJson("events.json", []);
  const item = {
    date: req.body.date || "",
    title: req.body.title || "",
    summary: req.body.summary || "",
    time: req.body.time || "",
    color: req.body.color || "red"
  };
  events.push(item);
  writeJson("events.json", events);
  broadcastState();
  res.json(item);
});

router.put("/api/events/:index", requireAuth, (req, res) => {
  const events = readJson("events.json", []);
  const index = Number(req.params.index);
  if (!events[index]) return res.status(404).json({ error: "Evento não encontrado" });
  events[index] = { ...events[index], ...req.body };
  writeJson("events.json", events);
  broadcastState();
  res.json(events[index]);
});

router.delete("/api/events/:index", requireAuth, (req, res) => {
  const events = readJson("events.json", []);
  const index = Number(req.params.index);
  if (!events[index]) return res.status(404).json({ error: "Evento não encontrado" });
  events.splice(index, 1);
  writeJson("events.json", events);
  broadcastState();
  res.json({ ok: true });
});

router.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Arquivo ausente" });
  const ext = (path.extname(req.file.originalname) || ".jpg").toLowerCase();
  const finalName = `${Date.now()}${ext}`;
  const finalPath = path.join(UPLOADS_DIR, finalName);
  fs.renameSync(req.file.path, finalPath);
  res.json({
    url: withBasePath(`/uploads/${finalName}`),
    mediaType: req.file.mimetype.startsWith("video/") ? "video" : "image"
  });
});

router.get("/api/rss", async (req, res) => {
  const settings = getSettings();
  const feeds = Array.isArray(settings.rssFeeds) ? settings.rssFeeds : [];
  const items = [];
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const entry of (feed.items || []).slice(0, 5)) {
        items.push({
          title: entry.title || "",
          summary: entry.contentSnippet || entry.content || "",
          link: entry.link || "",
          source: feed.title || url
        });
      }
    } catch (err) {
      items.push({ title: "Erro ao carregar RSS", summary: url, link: "", source: "Sistema" });
    }
  }
  res.json(items);
});

router.get("/api/weather", async (req, res) => {
  const settings = getSettings();
  const apiKey = process.env.OPENWEATHER_API_KEY || settings.openWeatherApiKey || "";
  const city = req.query.city || settings.city || "São Paulo";
  const units = settings.units || "metric";
  if (!apiKey) {
    return res.json({ city, temp: 22, description: "Ensolarado", humidity: 55, wind: 8, fallback: true });
  }
  try {
    let url;
    if (settings.openWeatherCityId) {
      url = `https://api.openweathermap.org/data/2.5/weather?id=${encodeURIComponent(settings.openWeatherCityId)}&appid=${apiKey}&units=${units}&lang=pt_br`;
    } else {
      url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${units}&lang=pt_br`;
    }
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Falha ao consultar clima");
    res.json({
      city: data.name || city,
      temp: Math.round(data.main?.temp ?? 0),
      description: data.weather?.[0]?.description || "",
      humidity: data.main?.humidity ?? 0,
      wind: data.wind?.speed ?? 0,
      icon: data.weather?.[0]?.icon || ""
    });
  } catch (err) {
    res.json({ city, temp: 22, description: "Ensolarado", humidity: 55, wind: 8, fallback: true, error: err.message });
  }
});

router.get("/admin", (req, res) => res.redirect(withBasePath("/admin.html")));
router.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

if (BASE_PATH) {
  app.get("/", (req, res) => res.redirect(`${BASE_PATH}/`));
  app.use((req, res, next) => {
    if (req.url === BASE_PATH) return res.redirect(`${BASE_PATH}/`);
    next();
  });
}
app.use(BASE_PATH || "/", router);

app.use((err, req, res, next) => {
  console.error(err);
  if (req.originalUrl.includes("/api/")) {
    return res.status(err.status || 500).json({ error: err.message || "Erro interno" });
  }
  return next(err);
});

io.on("connection", (socket) => socket.emit("state:update"));

httpServer.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}${BASE_PATH || ""}/`));
