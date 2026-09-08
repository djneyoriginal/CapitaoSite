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
	recentEvents: [],
};

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

		if (method === "GET" && ["/ia", "/ia.html", "/logs", "/logs.html"].includes(route) && status < 500) {
			totals.pageViews += 1;
			totals.visitors[ip] = {lastSeen: time.toISOString(), page: route.startsWith("/logs") ? "/logs" : "/ia"};
			addEvent(time, "visit", {page: route.startsWith("/logs") ? "/logs" : "/ia"});
		}

		if (method === "GET" && route === "/api/info") {
			totals.apiInfoRequests += 1;
			addEvent(time, "analysis", {});
		}

		if (method === "POST" && route === "/api/download") {
			totals.downloadAttempts += 1;
			if (status >= 200 && status < 300) {
				totals.downloadsCompleted += 1;
				totals.bytesConverted += bytes;
				addEvent(time, "download_completed", {megabytes: Number((bytes / 1024 / 1024).toFixed(2))});
			} else {
				totals.downloadErrors += 1;
				addEvent(time, "download_error", {message: `HTTP ${status}`});
			}
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
		pageViews: Math.max(current.pageViews || 0, totals.pageViews),
		apiInfoRequests: Math.max(current.apiInfoRequests || 0, totals.apiInfoRequests),
		downloadAttempts: Math.max(current.downloadAttempts || 0, totals.downloadAttempts),
		downloadsCompleted: Math.max(current.downloadsCompleted || 0, totals.downloadsCompleted),
		downloadErrors: Math.max(current.downloadErrors || 0, totals.downloadErrors),
		bytesConverted: Math.max(current.bytesConverted || 0, totals.bytesConverted),
		visitors: {...totals.visitors, ...(current.visitors || {})},
		recentEvents: [...totals.recentEvents, ...(current.recentEvents || [])].slice(-80),
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
