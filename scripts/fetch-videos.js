// fetch-videos.js
// Auto-discovers devotional video IDs from YouTube (channels + keyword search)
// and merges them into data/videos.json. Runs on a schedule via GitHub Actions.
//
// Requires Node 18+ (built-in fetch) and env var YOUTUBE_API_KEY.

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.YOUTUBE_API_KEY;
const SOURCES_PATH = path.join(__dirname, "..", "config", "sources.json");
const VIDEOS_PATH = path.join(__dirname, "..", "data", "videos.json");

// Max videos kept per category, newest-first, so the file doesn't grow forever.
const MAX_PER_CATEGORY = 300;
// How many results to pull per keyword/channel query.
const RESULTS_PER_QUERY = 15;

if (!API_KEY) {
  console.error("Missing YOUTUBE_API_KEY environment variable.");
  process.exit(1);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

async function searchByKeyword(keyword) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", keyword);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(RESULTS_PER_QUERY));
  url.searchParams.set("order", "relevance");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("key", API_KEY);
  return runSearch(url, keyword);
}

async function searchByChannel(channelId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(RESULTS_PER_QUERY));
  url.searchParams.set("order", "date");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("key", API_KEY);
  return runSearch(url, `channel:${channelId}`);
}

async function runSearch(url, label) {
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    console.error(`Search failed for "${label}": ${res.status} ${body}`);
    return [];
  }
  const json = await res.json();
  return (json.items || [])
    .filter((item) => item.id && item.id.videoId)
    .map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));
}

async function main() {
  const sources = loadJson(SOURCES_PATH);
  const db = loadJson(VIDEOS_PATH);

  let totalAdded = 0;

  for (const category of Object.keys(sources)) {
    const { channels = [], keywords = [] } = sources[category];
    const existing = db.categories[category] || [];
    const existingIds = new Set(existing.map((v) => v.id));

    const found = [];

    for (const keyword of keywords) {
      const results = await searchByKeyword(keyword);
      found.push(...results);
    }
    for (const channelId of channels) {
      const results = await searchByChannel(channelId);
      found.push(...results);
    }

    let addedThisCategory = 0;
    for (const video of found) {
      if (!existingIds.has(video.id)) {
        existing.unshift(video); // newest discoveries first
        existingIds.add(video.id);
        addedThisCategory++;
      }
    }

    // Cap growth
    db.categories[category] = existing.slice(0, MAX_PER_CATEGORY);
    totalAdded += addedThisCategory;
    console.log(`${category}: +${addedThisCategory} new (total ${db.categories[category].length})`);
  }

  db.lastUpdated = new Date().toISOString();
  saveJson(VIDEOS_PATH, db);
  console.log(`Done. ${totalAdded} new videos added across all categories.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
