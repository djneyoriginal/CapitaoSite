"use strict";

const http = require("node:http");
const {promises: fs, existsSync} = require("node:fs");
const {spawn} = require("node:child_process");
const path = require("node:path");
const {URL, URLSearchParams} = require("node:url");
const YTDlpWrap = require("yt-dlp-wrap-plus").default;

const ROOT_DIR = __dirname;
const PAGE_FILE = path.join(ROOT_DIR, "ia.html");
const RUNTIME_DIR = path.join(ROOT_DIR, "runtime");
const BINARY_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const LOCAL_BINARY = path.join(RUNTIME_DIR, BINARY_NAME);
const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "127.0.0.1";
const BODY_LIMIT = 32 * 1024;
const INFO_TIMEOUT_MS = 120000;
const MAX_CONCURRENT_DOWNLOADS = positiveInteger(process.env.MAX_CONCURRENT_DOWNLOADS, 1);
const RATE_LIMIT_WINDOW_MS = positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60000);
const RATE_LIMIT_MAX_REQUESTS = positiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 12);

let ytDlpInstance = null;
let ytDlpSetupPromise = null;
let activeDownloads = 0;
const rateLimitBuckets = new Map();

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

function clientAddress(req) {
	const realIp = req.headers["x-real-ip"];
	if (typeof realIp === "string" && realIp.trim()) return realIp.trim().slice(0, 64);

	const forwarded = req.headers["x-forwarded-for"];
	const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
	if (typeof forwardedValue === "string" && forwardedValue.trim()) {
		return forwardedValue.split(",").at(-1).trim().slice(0, 64);
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
	try {
		const raw = await readBody(req);
		const body = parseRequestBody(raw, req.headers["content-type"] || "");
		const url = validateMediaUrl(body.url);
		const type = body.type === "audio" ? "audio" : "video";
		const format = extensionFor(type, String(body.format || "mp4").toLowerCase());
		const quality = qualityFor(body.quality);
		const filename = safeFilename(body.title, format);
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
	stream.once("close", () => { finished = true; });
	stream.on("error", (error) => {
		if (downloadFailed) return;
		downloadFailed = true;
		console.error("Falha no download:", error.message);
		if (!headersSent && !res.headersSent) return json(res, 502, {ok: false, error: friendlyError(error)});
		if (!res.writableEnded) res.destroy();
	});
	res.once("close", () => {
		if (!finished && stream.ytDlpProcess && !stream.ytDlpProcess.killed) stream.ytDlpProcess.kill();
	});
	stream.on("data", (chunk) => {
		if (res.destroyed) return stream.destroy();
		if (!headersSent) {
			res.writeHead(200, responseHeaders);
			headersSent = true;
		}
		if (!res.write(chunk)) stream.pause();
	});
	res.on("drain", () => stream.resume());
	stream.once("end", () => {
		if (!headersSent) return json(res, 502, {ok: false, error: "O servidor não recebeu dados para este download."});
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
		if (req.method === "GET" && requestUrl.pathname === "/api/info") {
			if (!allowMediaRequest(req, res)) return;
			const mediaUrl = validateMediaUrl(requestUrl.searchParams.get("url") || "");
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
			const content = await fs.readFile(PAGE_FILE);
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
	server.listen(PORT, HOST, () => {
		console.log(`Capitão IA disponível em http://${HOST}:${PORT}/ia`);
		console.log("Para publicar no domínio, use um proxy reverso HTTPS (Nginx, Caddy ou painel da hospedagem).");
	});
}

module.exports = {server, validateMediaUrl, safeFilename, downloadArguments, authenticationArguments, allowMediaRequest, acquireDownloadSlot};
