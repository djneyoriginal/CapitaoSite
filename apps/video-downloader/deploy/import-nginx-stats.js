"use strict";

const {createReadStream, promises: fs} = require("node:fs");
const {createGunzip} = require("node:zlib");
const {createInterface} = require("node:readline");
const path = require("node:path");

const logDir = process.argv[2] || "/var/log/nginx";
const statsFile = process.argv[3] || "/opt/capitao-ia/runtime/stats.json";
const since = new Date(process.argv[4] || "2026-08-21T00:00:00-03:00");
const accessPattern = /^access\.log($|-)/;
const logPattern = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^" ]+)[^"]*" (\d{3}) (\d+)/;

const totals = {
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
const latestAnalysisByIp = new Map();

function nginxDate(value) {
	const match = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
	if (!match) return null;
	const months = {Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11};
	const [, day, mon, year, hour, minute, second, offset] = match;
	const isoOffset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
	return new Date(`${year}-${String(months[mon] + 1).padStart(2, "0")}-${day}T${hour}:${minute}:${second}${isoOffset}`);
}

function publicPath(rawUrl) {
	try {
		return new URL(rawUrl, "http://localhost").pathname;
	} catch {
		return rawUrl.split("?")[0];
	}
}

function queryParam(rawUrl, name) {
	try {
		return new URL(rawUrl, "http://localhost").searchParams.get(name) || "";
	} catch {
		return "";
	}
}

function addEvent(time, type, details = {}) {
	totals.recentEvents.push({time: time.toISOString(), type, ...details});
	if (totals.recentEvents.length > 80) totals.recentEvents.shift();
}

async function processFile(file) {
	const source = createReadStream(path.join(logDir, file));
	const stream = file.endsWith(".gz") ? source.pipe(createGunzip()) : source;
	const lines = createInterface({input: stream, crlfDelay: Infinity});

	for await (const line of lines) {
		const match = line.match(logPattern);
		if (!match) continue;
		const [, ip, rawTime, method, rawUrl, rawStatus, rawBytes] = match;
		const time = nginxDate(rawTime);
		if (!time || time < since) continue;

		const route = publicPath(rawUrl);
		const status = Number(rawStatus);
		const bytes = Number(rawBytes) || 0;

		if (method === "GET" && ["/ia", "/ia.html"].includes(route) && status < 500) {
			const day = time.toISOString().slice(0, 10);
			const visitKey = `${day}:${ip}:/ia`;
			if (!totals.visitKeys[visitKey]) {
				totals.visitKeys[visitKey] = time.toISOString();
				totals.pageViews += 1;
				addEvent(time, "visit", {ip, page: "/ia"});
			}
			totals.visitors[ip] = {lastSeen: time.toISOString(), page: "/ia"};
		}

		if (method === "GET" && route === "/api/info") {
			const url = queryParam(rawUrl, "url");
			const event = {time: time.toISOString(), ip, url};
			totals.apiInfoRequests += 1;
			totals.analyses.push(event);
			if (totals.analyses.length > 200) totals.analyses.shift();
			latestAnalysisByIp.set(ip, event);
			addEvent(time, "analysis", {ip, url});
		}

		if (method === "POST" && route === "/api/download") {
			const lastAnalysis = latestAnalysisByIp.get(ip);
			const download = {
				time: time.toISOString(),
				ip,
				url: lastAnalysis?.url || "",
				status: status >= 200 && status < 300 ? "completed" : "error",
				bytes: status >= 200 && status < 300 ? bytes : 0,
				megabytes: status >= 200 && status < 300 ? Number((bytes / 1024 / 1024).toFixed(2)) : 0,
			};
			totals.downloadAttempts += 1;
			if (status >= 200 && status < 300) {
				totals.downloadsCompleted += 1;
				totals.bytesConverted += bytes;
				download.completedAt = time.toISOString();
				addEvent(time, "download_completed", {ip, url: download.url, megabytes: download.megabytes});
			} else {
				totals.downloadErrors += 1;
				download.error = `HTTP ${status}`;
				addEvent(time, "download_error", {ip, url: download.url, message: download.error});
			}
			totals.downloads.push(download);
			if (totals.downloads.length > 200) totals.downloads.shift();
		}
	}
}

async function main() {
	const files = (await fs.readdir(logDir)).filter((file) => accessPattern.test(file)).sort();
	for (const file of files) await processFile(file);

	let current = {};
	try {
		current = JSON.parse(await fs.readFile(statsFile, "utf8"));
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}

	const merged = {
		...current,
		startedAt: since.toISOString(),
		updatedAt: new Date().toISOString(),
		pageViews: totals.pageViews,
		apiInfoRequests: totals.apiInfoRequests,
		downloadAttempts: totals.downloadAttempts,
		downloadsCompleted: totals.downloadsCompleted,
		downloadErrors: totals.downloadErrors,
		bytesConverted: totals.bytesConverted,
		visitors: totals.visitors,
		visitKeys: totals.visitKeys,
		analyses: totals.analyses,
		downloads: totals.downloads,
		recentEvents: totals.recentEvents,
		importedFromNginxAt: new Date().toISOString(),
		importedFromNginxFiles: files,
	};

	await fs.mkdir(path.dirname(statsFile), {recursive: true});
	await fs.writeFile(statsFile, JSON.stringify(merged, null, 2));
	console.log(JSON.stringify({
		statsFile,
		pageViews: merged.pageViews,
		uniqueVisitors: Object.keys(merged.visitors || {}).length,
		apiInfoRequests: merged.apiInfoRequests,
		downloadAttempts: merged.downloadAttempts,
		downloadsCompleted: merged.downloadsCompleted,
		downloadErrors: merged.downloadErrors,
		megabytesConverted: Number((merged.bytesConverted / 1024 / 1024).toFixed(2)),
		files: files.length,
	}, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
