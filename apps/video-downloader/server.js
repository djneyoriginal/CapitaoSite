"use strict";

const http = require("node:http");
const {promises: fs, existsSync} = require("node:fs");
const {spawn} = require("node:child_process");
const {pipeline} = require("node:stream/promises");
const path = require("node:path");
const {URL, URLSearchParams} = require("node:url");
const YTDlpWrap = require("yt-dlp-wrap-plus").default;

const ROOT_DIR = __dirname;
const PAGE_FILE = path.join(ROOT_DIR, "ia.html");
const LOGS_PAGE_FILE = path.join(ROOT_DIR, "logs.html");
const RUNTIME_DIR = path.join(ROOT_DIR, "runtime");
const STATS_FILE = path.join(RUNTIME_DIR, "stats.json");
const SPOTIFY_DOWNLOAD_DIR = path.join(RUNTIME_DIR, "spotify-downloads");
const BINARY_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const LOCAL_BINARY = path.join(RUNTIME_DIR, BINARY_NAME);
const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "127.0.0.1";
const LOGS_TOKEN = process.env.LOGS_TOKEN?.trim() || "";
const SPOTDL_PATH = process.env.SPOTDL_PATH?.trim() || "spotdl";
const BODY_LIMIT = 32 * 1024;
const INFO_TIMEOUT_MS = 120000;
const MAX_CONCURRENT_DOWNLOADS = positiveInteger(process.env.MAX_CONCURRENT_DOWNLOADS, 1);
const RATE_LIMIT_WINDOW_MS = positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60000);
const RATE_LIMIT_MAX_REQUESTS = positiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 12);

let ytDlpInstance = null;
let ytDlpSetupPromise = null;
let activeDownloads = 0;
let statsWritePromise = Promise.resolve();
const rateLimitBuckets = new Map();
const stats = {
	startedAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	pageViews: 0,
	apiInfoRequests: 0,
	downloadAttempts: 0,
	downloadsCompleted: 0,
	downloadErrors: 0,
	bytesConverted: 0,
	visitors: {},
	visitKeys: {},
	analyses: [],
	downloads: [],
	recentEvents: [],
};

function positiveInteger(value, fallback) {
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function json(res, status, payload, extraHeaders = {}) {
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
		...extraHeaders,
	});
	res.end(body);
}

async function loadStats() {
	try {
		const saved = JSON.parse(await fs.readFile(STATS_FILE, "utf8"));
		Object.assign(stats, {
			...saved,
			startedAt: saved.startedAt || stats.startedAt,
			visitors: saved && typeof saved.visitors === "object" && saved.visitors ? saved.visitors : {},
			visitKeys: saved && typeof saved.visitKeys === "object" && saved.visitKeys ? saved.visitKeys : {},
			analyses: Array.isArray(saved?.analyses) ? saved.analyses.slice(-200) : [],
			downloads: Array.isArray(saved?.downloads) ? saved.downloads.slice(-200) : [],
			recentEvents: Array.isArray(saved?.recentEvents) ? saved.recentEvents.slice(-80) : [],
		});
	} catch (error) {
		if (error.code !== "ENOENT") console.warn("Não foi possível carregar estatísticas:", error.message);
	}
}

function saveStatsSoon() {
	stats.updatedAt = new Date().toISOString();
	statsWritePromise = statsWritePromise.then(async () => {
		await fs.mkdir(RUNTIME_DIR, {recursive: true});
		await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
	}).catch((error) => console.warn("Não foi possível salvar estatísticas:", error.message));
	return statsWritePromise;
}

function addEvent(type, details = {}) {
	stats.recentEvents.push({time: new Date().toISOString(), type, ...details});
	if (stats.recentEvents.length > 80) stats.recentEvents.splice(0, stats.recentEvents.length - 80);
}

function recordVisit(req, page) {
	const address = clientAddress(req);
	const now = new Date();
	const day = now.toISOString().slice(0, 10);
	const visitKey = `${day}:${address}:${page}`;
	if (!stats.visitKeys[visitKey]) {
		stats.visitKeys[visitKey] = now.toISOString();
		stats.pageViews += 1;
		addEvent("visit", {ip: address, page});
	}
	stats.visitors[address] = {lastSeen: now.toISOString(), page};
	saveStatsSoon();
}

function rememberAnalysis(req, url) {
	const address = clientAddress(req);
	const event = {time: new Date().toISOString(), ip: address, url};
	stats.apiInfoRequests += 1;
	stats.analyses.push(event);
	if (stats.analyses.length > 200) stats.analyses.splice(0, stats.analyses.length - 200);
	addEvent("analysis", {ip: address, url});
	saveStatsSoon();
}

function rememberDownload(req, details) {
	const address = clientAddress(req);
	const event = {time: new Date().toISOString(), ip: address, ...details};
	stats.downloads.push(event);
	if (stats.downloads.length > 200) stats.downloads.splice(0, stats.downloads.length - 200);
	return event;
}

function publicStats() {
	return {
		startedAt: stats.startedAt,
		updatedAt: stats.updatedAt,
		pageViews: stats.pageViews,
		uniqueVisitors: Object.keys(stats.visitors || {}).length,
		apiInfoRequests: stats.apiInfoRequests,
		downloadAttempts: stats.downloadAttempts,
		downloadsCompleted: stats.downloadsCompleted,
		downloadErrors: stats.downloadErrors,
		bytesConverted: stats.bytesConverted,
		megabytesConverted: Number((stats.bytesConverted / 1024 / 1024).toFixed(2)),
		activeDownloads,
		importedFromNginxAt: stats.importedFromNginxAt || null,
		importedFromNginxFiles: Array.isArray(stats.importedFromNginxFiles) ? stats.importedFromNginxFiles.length : 0,
		visitors: Object.entries(stats.visitors || {})
			.map(([ip, entry]) => ({ip, ...entry}))
			.sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || "")))
			.slice(0, 80),
		analyses: stats.analyses.slice(-80).reverse(),
		downloads: stats.downloads.slice(-80).reverse(),
		recentEvents: stats.recentEvents.slice(-20).reverse(),
	};
}

function authorizeLogs(req, requestUrl, res) {
	if (!LOGS_TOKEN) return true;
	const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
	const queryToken = requestUrl.searchParams.get("token")?.trim();
	if (headerToken === LOGS_TOKEN || queryToken === LOGS_TOKEN) return true;
	json(res, 401, {ok: false, error: "Acesso ao relatório exige token."}, {"WWW-Authenticate": "Bearer"});
	return false;
}

function clientAddress(req) {
	const realIp = req.headers["x-real-ip"];
	if (typeof realIp === "string" && realIp.trim()) return realIp.trim().slice(0, 64);

	const forwarded = req.headers["x-forwarded-for"];
	const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	if (typeof forwardedValue === "string" && forwardedValue.trim()) {
		return forwardedValue.split(",")[0].trim().slice(0, 64);
	}

	return String(req.socket.remoteAddress || "unknown").slice(0, 64);
}

function allowMediaRequest(req, res) {
	const now = Date.now();
	const key = clientAddress(req);
	let bucket = rateLimitBuckets.get(key);

	if (!bucket || now >= bucket.resetAt) {
		bucket = {count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS};
		rateLimitBuckets.set(key, bucket);
	}

	if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
		const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
		json(res, 429, {ok: false, error: "Muitas solicitações. Aguarde um minuto e tente novamente."}, {"Retry-After": String(retryAfter)});
		return false;
	}

	bucket.count += 1;
	if (rateLimitBuckets.size > 2000) {
		for (const [address, entry] of rateLimitBuckets) {
			if (now >= entry.resetAt) rateLimitBuckets.delete(address);
		}
	}
	return true;
}

function acquireDownloadSlot() {
	if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
		const error = new Error("O servidor já está processando outro download. Tente novamente em instantes.");
		error.statusCode = 429;
		throw error;
	}

	activeDownloads += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		activeDownloads = Math.max(0, activeDownloads - 1);
	};
}

function pageHeaders(contentType) {
	return {
		"Content-Type": contentType,
		"Cache-Control": "no-cache",
		"Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self';",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"X-Content-Type-Options": "nosniff",
	};
}

function validateMediaUrl(value) {
	if (typeof value !== "string" || value.length > 2048) {
		throw new Error("Informe uma URL válida.");
	}

	let parsed;
	try {
		parsed = new URL(value.trim());
	} catch {
		throw new Error("Informe uma URL válida.");
	}

	if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
		throw new Error("A URL precisa começar com http:// ou https://.");
	}

	return parsed.toString();
}

function isSpotifyUrl(value) {
	try {
		const parsed = new URL(value);
		return /(^|\.)spotify\.com$/i.test(parsed.hostname) || /^spotify:/i.test(value);
	} catch {
		return /^spotify:/i.test(String(value || ""));
	}
}

function safeFilename(value, extension) {
	const normalized = String(value || "capitao-download")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9._ -]+/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[. ]+$/g, "")
		.slice(0, 120);
	return `${normalized || "capitao-download"}.${extension}`;
}

function runCommand(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {windowsHide: true, ...options});
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => { stdout += chunk; });
		child.stderr?.on("data", (chunk) => { stderr += chunk; });
		child.once("error", reject);
		child.once("close", (code) => {
			if (code === 0) return resolve({stdout, stderr});
			const error = new Error(stderr || stdout || `${command} saiu com código ${code}`);
			error.statusCode = 502;
			reject(error);
		});
	});
}

async function directorySize(dir) {
	let total = 0;
	const entries = await fs.readdir(dir, {withFileTypes: true});
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) total += await directorySize(fullPath);
		if (entry.isFile()) total += (await fs.stat(fullPath)).size;
	}
	return total;
}

async function handleSpotifyDownload(req, res, body) {
	const url = validateMediaUrl(body.url);
	const filename = safeFilename(body.title || "capitao-spotify", "zip");
	await fs.mkdir(SPOTIFY_DOWNLOAD_DIR, {recursive: true});
	const jobDir = await fs.mkdtemp(path.join(SPOTIFY_DOWNLOAD_DIR, "job-"));
	const zipPath = path.join(SPOTIFY_DOWNLOAD_DIR, `${path.basename(jobDir)}.zip`);
	const downloadEvent = rememberDownload(req, {status: "started", url, title: String(body.title || "Spotify"), type: "spotify", format: "zip", filename, megabytes: 0});
	addEvent("download_started", {ip: downloadEvent.ip, url, filename});
	saveStatsSoon();

	try {
		const spotdlArgs = [
			"download",
			url,
			"--output",
			path.join(jobDir, "{artists} - {title}.{output-ext}"),
			"--format",
			"mp3",
			"--bitrate",
			"192k",
		];
		const cookiesPath = process.env.YT_DLP_COOKIES_PATH?.trim();
		const proxy = process.env.YT_DLP_PROXY?.trim();
		if (cookiesPath && existsSync(cookiesPath)) spotdlArgs.push("--cookie-file", cookiesPath);
		if (proxy) spotdlArgs.push("--proxy", proxy);
		await runCommand(SPOTDL_PATH, spotdlArgs, {cwd: jobDir});

		await runCommand("zip", ["-qr", zipPath, "."], {cwd: jobDir});
		const bytesSent = (await fs.stat(zipPath)).size || await directorySize(jobDir);

		res.writeHead(200, {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		});
		await pipeline(createReadStreamCompat(zipPath), res);

		stats.downloadsCompleted += 1;
		stats.bytesConverted += bytesSent;
		downloadEvent.status = "completed";
		downloadEvent.bytes = bytesSent;
		downloadEvent.megabytes = Number((bytesSent / 1024 / 1024).toFixed(2));
		downloadEvent.completedAt = new Date().toISOString();
		addEvent("download_completed", {ip: downloadEvent.ip, url, megabytes: downloadEvent.megabytes});
		saveStatsSoon();
	} catch (error) {
		stats.downloadErrors += 1;
		downloadEvent.status = "error";
		downloadEvent.error = friendlyError(error).slice(0, 160);
		addEvent("download_error", {ip: downloadEvent.ip, url, message: downloadEvent.error});
		saveStatsSoon();
		throw error;
	} finally {
		fs.rm(jobDir, {recursive: true, force: true}).catch(() => {});
		fs.rm(zipPath, {force: true}).catch(() => {});
	}
}

function createReadStreamCompat(filePath) {
	return require("node:fs").createReadStream(filePath);
}

function extensionFor(type, format) {
	if (type === "audio") return ["mp3", "m4a", "opus"].includes(format) ? format : "mp3";
	return ["mp4", "webm"].includes(format) ? format : "mp4";
}

function qualityFor(value) {
	const quality = Number.parseInt(value, 10);
	if (![360, 480, 720, 1080, 1440, 2160, 4320].includes(quality)) return 1080;
	return quality;
}

function commandExists(command) {
	return new Promise((resolve) => {
		const child = spawn(command, ["--version"], {stdio: "ignore", windowsHide: true});
		child.once("error", () => resolve(false));
		child.once("close", (code) => resolve(code === 0));
	});
}

function authenticationArguments() {
	const args = [];
	const cookiesPath = process.env.YT_DLP_COOKIES_PATH?.trim();
	const extractorArgs = process.env.YT_DLP_EXTRACTOR_ARGS?.trim();
	const jsRuntime = process.env.YT_DLP_JS_RUNTIME?.trim();
	const proxy = process.env.YT_DLP_PROXY?.trim();

	if (cookiesPath) {
		if (!existsSync(cookiesPath)) {
			throw new Error("O arquivo de cookies configurado não foi encontrado no servidor.");
		}
		args.push("--cookies", cookiesPath);
	}
	if (extractorArgs) args.push("--extractor-args", extractorArgs);
	if (jsRuntime) args.push("--js-runtimes", jsRuntime);
	if (proxy) args.push("--proxy", proxy);

	return args;
}

async function ensureYtDlp() {
	if (ytDlpInstance) return ytDlpInstance;
	if (ytDlpSetupPromise) return ytDlpSetupPromise;

	ytDlpSetupPromise = (async () => {
		const configuredPath = process.env.YT_DLP_PATH?.trim();
		let binaryPath = configuredPath || (existsSync(LOCAL_BINARY) ? LOCAL_BINARY : null);

		if (!binaryPath && await commandExists("yt-dlp")) binaryPath = "yt-dlp";

		if (!binaryPath) {
			await fs.mkdir(RUNTIME_DIR, {recursive: true});
			console.log("yt-dlp não encontrado; baixando o binário estável...");
			await YTDlpWrap.downloadFromGithub(
				LOCAL_BINARY,
				undefined,
				process.platform,
				(progress) => process.stdout.write(`\rBaixando yt-dlp: ${progress.toFixed(1)}%`),
				"stable",
			);
			if (process.platform !== "win32") await fs.chmod(LOCAL_BINARY, 0o755);
			process.stdout.write("\n");
			binaryPath = LOCAL_BINARY;
		}

		ytDlpInstance = new YTDlpWrap(binaryPath);
		console.log(`yt-dlp ativo em: ${binaryPath}`);
		return ytDlpInstance;
	})().catch((error) => {
		 ytDlpSetupPromise = null;
		 throw error;
	});

	return ytDlpSetupPromise;
}

function parseJsonOutput(output) {
	const lines = String(output || "").trim().split(/\r?\n/).filter(Boolean);
	for (let index = lines.length - 1; index >= 0; index -= 1) {
		try {
			return JSON.parse(lines[index]);
		} catch {
			// yt-dlp can emit a harmless warning before the JSON object.
		}
	}
	throw new Error("Não foi possível ler os dados desta mídia.");
}

function publicInfo(metadata, url) {
	return {
		url,
		title: metadata.title || "Mídia sem título",
		channel: metadata.channel || metadata.uploader || metadata.artist || "",
		thumbnail: metadata.thumbnail || "",
		duration: Number.isFinite(metadata.duration) ? metadata.duration : null,
		viewCount: Number.isFinite(metadata.view_count) ? metadata.view_count : null,
		extractor: metadata.extractor_key || metadata.extractor || "",
	};
}

function spotifyInfo(url) {
	let type = "link";
	try {
		const parts = new URL(url).pathname.split("/").filter(Boolean);
		type = parts[0] || type;
	} catch {
		// Keep the generic label.
	}
	return {
		url,
		title: `Spotify ${type}`,
		channel: "spotDL buscará o áudio correspondente no YouTube",
		thumbnail: "",
		duration: null,
		viewCount: null,
		extractor: "spotDL",
	};
}

async function getInfo(url) {
	const ytdlp = await ensureYtDlp();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), INFO_TIMEOUT_MS);
	try {
		const output = await ytdlp.execPromise([
			"--dump-single-json",
			"--skip-download",
			"--no-playlist",
			"--no-warnings",
			...authenticationArguments(),
			"--",
			url,
		], {maxBuffer: 16 * 1024 * 1024}, controller.signal);
		return publicInfo(parseJsonOutput(output), url);
	} catch (error) {
		if (controller.signal.aborted) throw new Error("A análise demorou mais que o esperado.");
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

function downloadArguments({type, format, quality, url}) {
	// execStream appends its own `-o -`; keep the URL last so yt-dlp can parse
	// the appended output option consistently on all supported platforms.
	const common = ["--no-playlist", "--no-warnings", "--quiet", "--no-progress", ...authenticationArguments(), url];
	if (type === "audio") {
		return ["-x", "--audio-format", format, "--audio-quality", "192K", "-f", "bestaudio/best", ...common];
	}

	const formatSelector = format === "webm"
		? `bestvideo[height<=${quality}][ext=webm]+bestaudio[ext=webm]/best[height<=${quality}][ext=webm]/best[height<=${quality}]/best[ext=webm]/best`
		: `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best[height<=${quality}]/best[ext=mp4]/best`;
	return ["-f", formatSelector, "--merge-output-format", format, ...common];
}

function friendlyError(error) {
	const message = String(error?.message || error || "Erro interno.");
	if (/spotdl|No such file|ENOENT/i.test(message)) return "O servidor precisa do spotDL instalado para links do Spotify.";
	if (/No results found|Could not find|not found/i.test(message)) return "O spotDL não encontrou áudio correspondente para este link do Spotify.";
	if (/ffmpeg/i.test(message)) return "O servidor precisa do ffmpeg instalado para converter ou juntar áudio e vídeo.";
	if (/ENOENT|spawn .*yt-dlp|cannot find module|not found/i.test(message)) return "Não foi possível iniciar o yt-dlp no servidor. Confira YT_DLP_PATH ou a conexão para o download automático.";
	if (/HTTP Error 403|403:\s*Forbidden/i.test(message)) return "O site recusou a transferência pelo IP do servidor (HTTP 403). Para o YouTube em AWS, configure um proxy autorizado ou use outro IP de saída.";
	if (/account cookies are no longer valid|cookies.*rotated/i.test(message)) return "Os cookies do YouTube perderam a validade. Exporte uma nova sessão com o navegador completamente fechado e instale o novo arquivo no servidor.";
	if (/sign in to confirm you.re not a bot/i.test(message)) return "O YouTube rejeitou o IP ou a sessão do servidor. Exporte cookies novos de uma conta dedicada seguindo o modo anônimo recomendado pelo yt-dlp.";
	if (/private|sign in|login|authentication|cookies/i.test(message)) return "Este site exige autenticação ou cookies e não pode ser processado sem configuração adicional.";
	return message.replace(/\s+/g, " ").slice(0, 500);
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.setEncoding("utf8");
		req.on("data", (chunk) => {
			body += chunk;
			if (Buffer.byteLength(body, "utf8") > BODY_LIMIT) {
				req.destroy();
				reject(new Error("Requisição muito grande."));
			}
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}

function parseRequestBody(raw, contentType) {
	if (contentType.includes("application/json")) return JSON.parse(raw || "{}");
	const params = new URLSearchParams(raw);
	return Object.fromEntries(params.entries());
}

async function handleDownload(req, res) {
	const releaseSlot = acquireDownloadSlot();
	res.once("finish", releaseSlot);
	res.once("close", releaseSlot);

	let stream;
	let responseHeaders;
	let downloadEvent;
	try {
		stats.downloadAttempts += 1;
		const raw = await readBody(req);
		const body = parseRequestBody(raw, req.headers["content-type"] || "");
		const url = validateMediaUrl(body.url);
		if (isSpotifyUrl(url)) return await handleSpotifyDownload(req, res, body);
		const type = body.type === "audio" ? "audio" : "video";
		const format = extensionFor(type, String(body.format || "mp4").toLowerCase());
		const quality = qualityFor(body.quality);
		const filename = safeFilename(body.title, format);
		downloadEvent = rememberDownload(req, {status: "started", url, title: String(body.title || ""), type, format, quality, filename, megabytes: 0});
		addEvent("download_started", {ip: downloadEvent.ip, url, filename});
		saveStatsSoon();
		const ytdlp = await ensureYtDlp();
		stream = ytdlp.execStream(downloadArguments({type, format, quality, url}));
		responseHeaders = {
			"Content-Type": type === "audio" ? (format === "mp3" ? "audio/mpeg" : `audio/${format}`) : (format === "webm" ? "video/webm" : "video/mp4"),
			"Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		};
	} catch (error) {
		releaseSlot();
		throw error;
	}

	let headersSent = false;
	let finished = false;
	let downloadFailed = false;
	let bytesSent = 0;
	stream.once("close", () => { finished = true; });
	stream.on("error", (error) => {
		if (downloadFailed) return;
		downloadFailed = true;
		stats.downloadErrors += 1;
		if (downloadEvent) {
			downloadEvent.status = "error";
			downloadEvent.error = friendlyError(error).slice(0, 160);
		}
		addEvent("download_error", {ip: downloadEvent?.ip, url: downloadEvent?.url, message: friendlyError(error).slice(0, 160)});
		saveStatsSoon();
		console.error("Falha no download:", error.message);
		if (!headersSent && !res.headersSent) return json(res, 502, {ok: false, error: friendlyError(error)});
		if (!res.writableEnded) res.destroy();
	});
	res.once("close", () => {
		if (!finished && stream.ytDlpProcess && !stream.ytDlpProcess.killed) stream.ytDlpProcess.kill();
	});
	stream.on("data", (chunk) => {
		if (res.destroyed) return stream.destroy();
		bytesSent += chunk.length;
		if (!headersSent) {
			res.writeHead(200, responseHeaders);
			headersSent = true;
		}
		if (!res.write(chunk)) stream.pause();
	});
	res.on("drain", () => stream.resume());
	stream.once("end", () => {
		if (!headersSent) return json(res, 502, {ok: false, error: "O servidor não recebeu dados para este download."});
		stats.downloadsCompleted += 1;
		stats.bytesConverted += bytesSent;
		if (downloadEvent) {
			downloadEvent.status = "completed";
			downloadEvent.bytes = bytesSent;
			downloadEvent.megabytes = Number((bytesSent / 1024 / 1024).toFixed(2));
			downloadEvent.completedAt = new Date().toISOString();
		}
		addEvent("download_completed", {ip: downloadEvent?.ip, url: downloadEvent?.url, megabytes: Number((bytesSent / 1024 / 1024).toFixed(2))});
		saveStatsSoon();
		if (!res.writableEnded) res.end();
	});
}

async function handleRequest(req, res) {
	if (req.method === "OPTIONS") {
		res.writeHead(204, {"Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"});
		return res.end();
	}

	const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
	try {
		if (req.method === "GET" && requestUrl.pathname === "/api/health") return json(res, 200, {ok: true, service: "capitao-ia-downloader", page: "/ia"});
		if (req.method === "GET" && requestUrl.pathname === "/api/stats") {
			if (!authorizeLogs(req, requestUrl, res)) return;
			return json(res, 200, {ok: true, stats: publicStats()});
		}
		if (req.method === "GET" && requestUrl.pathname === "/api/info") {
			if (!allowMediaRequest(req, res)) return;
			const mediaUrl = validateMediaUrl(requestUrl.searchParams.get("url") || "");
			rememberAnalysis(req, mediaUrl);
			if (isSpotifyUrl(mediaUrl)) return json(res, 200, {ok: true, media: spotifyInfo(mediaUrl)});
			return json(res, 200, {ok: true, media: await getInfo(mediaUrl)});
		}
		if (req.method === "POST" && requestUrl.pathname === "/api/download") {
			if (!allowMediaRequest(req, res)) return;
			return await handleDownload(req, res);
		}
		if (req.method === "GET" && requestUrl.pathname === "/") {
			res.writeHead(302, {Location: "/ia"});
			return res.end();
		}
		if (req.method === "GET" && ["/ia", "/ia.html"].includes(requestUrl.pathname)) {
			recordVisit(req, "/ia");
			const content = await fs.readFile(PAGE_FILE);
			res.writeHead(200, pageHeaders("text/html; charset=utf-8"));
			return res.end(content);
		}
		if (req.method === "GET" && ["/logs", "/logs.html"].includes(requestUrl.pathname)) {
			if (!authorizeLogs(req, requestUrl, res)) return;
			const content = await fs.readFile(LOGS_PAGE_FILE);
			res.writeHead(200, pageHeaders("text/html; charset=utf-8"));
			return res.end(content);
		}
		return json(res, 404, {ok: false, error: "Página não encontrada."});
	} catch (error) {
		console.error("Requisição rejeitada:", error);
		const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 400;
		if (!res.headersSent) return json(res, statusCode, {ok: false, error: friendlyError(error)});
		return res.destroy();
	}
}

const server = http.createServer(handleRequest);

if (require.main === module) {
	loadStats().then(() => server.listen(PORT, HOST, () => {
		console.log(`Capitão IA disponível em http://${HOST}:${PORT}/ia`);
		console.log(`Relatório disponível em http://${HOST}:${PORT}/logs.html`);
		console.log("Para publicar no domínio, use um proxy reverso HTTPS (Nginx, Caddy ou painel da hospedagem).");
	})).catch((error) => {
		console.error("Falha ao iniciar estatísticas:", error);
		process.exit(1);
	});
}

module.exports = {server, validateMediaUrl, safeFilename, downloadArguments, authenticationArguments, allowMediaRequest, acquireDownloadSlot, publicStats, loadStats};
