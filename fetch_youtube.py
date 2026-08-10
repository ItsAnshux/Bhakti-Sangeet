import json, os, urllib.parse, urllib.request
from pathlib import Path

API_KEY = os.environ["YOUTUBE_API_KEY"]

# Edit these queries whenever you want to change what the site automatically collects.
QUERIES = {
    "Shiv": "Shiv bhajan Hindi devotional",
    "Krishna": "Krishna bhajan Hindi devotional",
    "Ram": "Shri Ram bhajan Hindi devotional",
    "Hanuman": "Hanuman bhajan Hindi devotional",
    "Durga": "Mata Durga bhajan Hindi devotional",
    "Ganesh": "Ganesh bhajan Hindi devotional",
    "Aarti": "Hindu aarti Hindi devotional",
    "Bhajans": "Hindi devotional bhajan",
}

def youtube_search(query, max_results=25):
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": max_results,
        "regionCode": "IN",
        "relevanceLanguage": "hi",
        "safeSearch": "moderate",
        "videoEmbeddable": "true",
        "videoSyndicated": "true",
        "key": API_KEY,
    }
    url = "https://www.googleapis.com/youtube/v3/search?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)

items = {}
for cat, query in QUERIES.items():
    data = youtube_search(query)
    for item in data.get("items", []):
        vid = item.get("id", {}).get("videoId")
        title = item.get("snippet", {}).get("title", "").strip()
        if vid and title:
            items[vid] = {"id": vid, "title": title, "cat": cat}

songs = list(items.values())
Path("songs.json").write_text(json.dumps(songs, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(songs)} videos to songs.json")
