#!/usr/bin/env python3
"""
BhaktiSangeet — YouTube video fetcher.

Fetches devotional video IDs from the YouTube Data API v3 based on
search queries defined in scripts/config.json, enriches them with
snippet + statistics data, classifies each by deity + content type,
and merges them with any manually-pinned entries in videos.json.

Run locally:   python scripts/fetch_videos.py
In CI:         runs automatically via GitHub Actions (see .github/workflows/fetch.yml)

Requires the environment variable YOUTUBE_API_KEY.
The script is idempotent: re-running it refreshes metadata for known
IDs and adds newly-discovered videos without duplicating existing ones.
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# --- Paths -----------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONFIG_PATH = os.path.join(HERE, "config.json")
VIDEOS_PATH = os.path.join(ROOT, "videos.json")

API_BASE = "https://www.googleapis.com/youtube/v3"
API_KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()

# --- Type classification ---------------------------------------------
TYPE_KEYWORDS = {
    "aarti":   ["aarti", "aart", "arti", "aarti", "aarti"],
    "mantra":  ["mantra", "jaap", "jap", "chant", "chanting", "108 "],
    "stotra":  ["stotra", "stotram", "stuti", "path", "paath", "ashtakam", "chalisa"],
    "kirtan":  ["kirtan", "kirtan", "bhajan kirtan", "sampraday"],
    "bhajan":  ["bhajan", "bhajan", "song", "geet", "sangeet"],
}


def classify_type(title: str, query: str = "") -> str:
    """Guess the content type from the title + the search query used."""
    text = (title + " " + query).lower()
    for t, kws in TYPE_KEYWORDS.items():
        for kw in kws:
            if kw in text:
                return t
    return "bhajan"


def is_devotional(title: str) -> bool:
    """Reject obviously off-topic results (ads, movies, trailers...)."""
    t = title.lower()
    bad = ["official trailer", "movie scene", "full movie", "episode ",
           "comedy", "funny", "prank", "vlog", "gameplay", "minecraft"]
    return not any(b in t for b in bad)


# --- Existing videos -------------------------------------------------
def load_existing() -> dict:
    """Return {id: video-dict} of currently stored videos."""
    if not os.path.exists(VIDEOS_PATH):
        return {}
    try:
        with open(VIDEOS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        vids = data.get("videos", []) if isinstance(data, dict) else data
        return {v["id"]: v for v in vids}
    except Exception:
        return {}


def save_videos(videos: list):
    """Atomically write videos.json (sorted newest-first, pinned first)."""
    def sort_key(v):
        pub = v.get("publishedAt") or ""
        return (0 if v.get("pinned") else 1, pub)
    videos.sort(key=sort_key, reverse=True)
    # but pinned should be FIRST regardless of date -> re-sort
    videos.sort(key=lambda v: 0 if v.get("pinned") else 1)
    # within pinned / non-pinned, newest first
    videos.sort(key=lambda v: (0 if v.get("pinned") else 1,
                               v.get("publishedAt") or ""), reverse=False)
    videos.sort(key=lambda v: (0 if v.get("pinned") else 1))
    # stable enough; do a clean final sort
    videos = sorted(videos, key=lambda v: (
        0 if v.get("pinned") else 1,
        -(parse_ts(v.get("publishedAt")))
    ))
    out = {"videos": videos, "updated": datetime.now(timezone.utc).isoformat(),
           "count": len(videos)}
    tmp = VIDEOS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    os.replace(tmp, VIDEOS_PATH)
    print(f"  ✓ Saved {len(videos)} videos to videos.json")


def parse_ts(iso):
    if not iso:
        return 0
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0


# --- YouTube API -----------------------------------------------------
def api_get(endpoint: str, params: dict) -> dict:
    params["key"] = API_KEY
    url = f"{API_BASE}/{endpoint}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "BhaktiSangeet/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        print(f"  ✗ API error {e.code}: {body[:200]}", file=sys.stderr)
        if e.code == 403 and "quota" in body.lower():
            raise RuntimeError("YouTube API daily quota exceeded.")
        return {}
    except Exception as e:
        print(f"  ✗ Request failed: {e}", file=sys.stderr)
        return {}


def search_videos(query: str, max_results: int, order: str, duration: str) -> list:
    """Return list of {id, title, channel, publishedAt, query}."""
    res = api_get("search", {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": max_results,
        "order": order,
        "videoDuration": duration,
        "regionCode": "IN",
        "relevanceLanguage": "hi",
    })
    items = res.get("items", [])
    out = []
    for it in items:
        vid = it.get("id", {})
        iid = vid.get("videoId") if isinstance(vid, dict) else None
        if not iid:
            continue
        sn = it.get("snippet", {})
        title = sn.get("title", "")
        if not is_devotional(title):
            continue
        out.append({
            "id": iid,
            "title": title,
            "channel": sn.get("channelTitle", ""),
            "publishedAt": sn.get("publishedAt", ""),
            "query": query,
        })
    return out


def enrich_videos(video_ids: list) -> dict:
    """Fetch full snippet + contentDetails + statistics for up to 50 IDs."""
    enriched = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i + 50]
        res = api_get("videos", {
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(batch),
            "maxResults": 50,
        })
        for it in res.get("items", []):
            iid = it.get("id")
            sn = it.get("snippet", {})
            cd = it.get("contentDetails", {})
            st = it.get("statistics", {})
            enriched[iid] = {
                "title": sn.get("title", ""),
                "channel": sn.get("channelTitle", ""),
                "publishedAt": sn.get("publishedAt", ""),
                "duration": cd.get("duration", ""),
                "viewCount": int(st.get("viewCount", 0)) if st.get("viewCount") else 0,
                "likeCount": int(st.get("likeCount", 0)) if st.get("likeCount") else 0,
            }
    return enriched


# --- Main ------------------------------------------------------------
def main():
    if not API_KEY:
        print("ERROR: YOUTUBE_API_KEY environment variable is not set.", file=sys.stderr)
        print("       Get a free key at https://console.cloud.google.com/apis/library/youtube.googleapis.com",
              file=sys.stderr)
        sys.exit(1)

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    existing = load_existing()
    # Preserve manually-pinned entries (those without a 'query' field,
    # i.e. added by hand to videos.json).
    pinned = {k: v for k, v in existing.items() if v.get("pinned") or not v.get("query")}

    print(f"BhaktiSangeet fetcher — {len(existing)} existing videos ({len(pinned)} pinned/manual)")

    discovered = {}  # id -> partial data
    for deity_id, dcfg in config["deities"].items():
        per_deity = 0
        max_total = config.get("max_total_per_deity", 40)
        for q in dcfg["queries"]:
            if per_deity >= max_total:
                break
            print(f"  → [{deity_id}] searching: {q}")
            results = search_videos(
                q,
                max_results=config.get("max_per_query", 10),
                order=config.get("order", "viewCount"),
                duration=config.get("video_duration", "medium"),
            )
            for r in results:
                if r["id"] in pinned:
                    continue  # don't override manual entries
                if r["id"] not in discovered:
                    discovered[r["id"]] = {
                        "id": r["id"],
                        "deity": deity_id,
                        "type": classify_type(r["title"], r.get("query", "")),
                        "title": r["title"],
                        "channel": r["channel"],
                        "publishedAt": r["publishedAt"],
                        "query": r.get("query", ""),
                    }
                    per_deity += 1
            time.sleep(0.3)  # be polite

    print(f"\nDiscovered {len(discovered)} new/unique videos. Enriching...")

    # Enrich all discovered (and refresh existing non-pinned) videos
    refresh_ids = list(discovered.keys()) + [k for k in existing if k not in pinned and k not in discovered]
    if refresh_ids:
        enriched = enrich_videos(refresh_ids)
    else:
        enriched = {}

    final = dict(pinned)  # start with manual entries

    for vid, data in discovered.items():
        e = enriched.get(vid, {})
        final[vid] = {
            "id": vid,
            "deity": data["deity"],
            "type": data["type"],
            "title": e.get("title", data["title"]),
            "channel": e.get("channel", data["channel"]),
            "publishedAt": e.get("publishedAt", data["publishedAt"]),
            "duration": e.get("duration", ""),
            "viewCount": e.get("viewCount", 0),
            "likeCount": e.get("likeCount", 0),
            "query": data.get("query", ""),
        }

    # Refresh metadata for existing (non-pinned) videos too
    for vid in existing:
        if vid in pinned or vid in discovered:
            continue
        e = enriched.get(vid, {})
        v = dict(existing[vid])
        if e:
            v["title"] = e.get("title", v.get("title", ""))
            v["channel"] = e.get("channel", v.get("channel", ""))
            v["publishedAt"] = e.get("publishedAt", v.get("publishedAt", ""))
            v["duration"] = e.get("duration", v.get("duration", ""))
            v["viewCount"] = e.get("viewCount", v.get("viewCount", 0))
            v["likeCount"] = e.get("likeCount", v.get("likeCount", 0))
        final[vid] = v

    save_videos(list(final.values()))
    print("Done.")


if __name__ == "__main__":
    main()
