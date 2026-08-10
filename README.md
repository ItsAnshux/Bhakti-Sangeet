# 🙏 BhaktiSangeet

A modern Hindu devotional music website powered by YouTube. Discover and play **Bhajans, Aartis, Mantras, Stotras and Kirtans** across **Shiv, Krishna, Ram, Hanuman, Durga & Ganesh** categories.

- **No audio/video hosting** — all media streams directly from YouTube.
- **Auto-updating video library** — a GitHub Action fetches fresh devotional video IDs from the YouTube Data API every day and commits them to `videos.json`.
- **Zero backend** — pure static HTML/CSS/JS. Host free on GitHub Pages.
- **Beautiful, fast, mobile-friendly** UI with search, deity filters, and content-type filters.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🕉️ Deity categories | Shiv · Krishna · Ram · Hanuman · Durga · Ganesh |
| 🎵 Content types | Bhajan · Aarti · Mantra · Stotra · Kirtan |
| 🔍 Search | Instant search across titles, channels, deities, types |
| ▶️ Inline player | Plays videos in a modal via YouTube (privacy-enhanced mode) |
| 🤖 Auto-fetch | GitHub Action runs daily, adds new videos automatically |
| 📊 Metadata | Views, duration, channel, publish date — auto-enriched |
| 📱 Responsive | Works beautifully on mobile, tablet, desktop |

---

## 🚀 Quick Start (5 minutes)

### Step 1 — Create the repository

1. Go to **GitHub → New repository**.
2. Name it `bhaktisangeet` (or anything you like).
3. Set it **Public** (required for free GitHub Pages).
4. **Don't** initialize with README (you'll upload files instead).

### Step 2 — Upload the files

Upload **all files** from this project to the repository:

```
bhaktisangeet/
├── index.html
├── videos.json              ← pre-seeded with 60 videos
├── assets/
│   ├── styles.css
│   ├── app.js
│   └── escape.js
├── scripts/
│   ├── config.json          ← search queries & categories
│   └── fetch_videos.py      ← the auto-fetcher
└── .github/
    └── workflows/
        └── fetch.yml        ← daily auto-update job
```

You can drag-and-drop the files on the GitHub web UI, or clone & push:

```bash
git clone https://github.com/<your-username>/bhaktisangeet.git
cd bhaktisangeet
# copy all project files here
git add .
git commit -m "Initial commit"
git push
```

### Step 3 — Get a YouTube API key (free)

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Create a new project (or pick an existing one).
3. Navigate to **APIs & Services → Library → YouTube Data API v3 → Enable**.
4. Go to **APIs & Services → Credentials → Create credentials → API key**.
5. Copy the key. (Optional but recommended: restrict it to "YouTube Data API v3".)

> 💡 The free daily quota is **10,000 units**. Each search costs 100 units, each video-list call costs 1 unit. This script uses ~3,600 units per run — well within the free limit.

### Step 4 — Add the API key as a secret

1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. Name: `YOUTUBE_API_KEY`
4. Value: paste your API key.
5. Click **Add secret**.

### Step 5 — Enable GitHub Pages

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **Deploy from a branch**.
3. Choose branch `main`, folder `/ (root)`.
4. Click **Save**.
5. Wait 1–2 minutes. Your site goes live at:

```
https://<your-username>.github.io/bhaktisangeet/
```

### Step 6 — Run the fetcher for the first time

1. Go to the **Actions** tab in your repo.
2. Select the **"Fetch YouTube Videos"** workflow on the left.
3. Click **Run workflow → Run workflow** (green button).
4. Wait ~1 minute for it to complete. It will auto-commit an updated `videos.json` with real YouTube videos (titles, views, durations).

That's it! 🎉 The job will now run **daily at 11:30 AM IST** automatically and keep your video library fresh.

---

## 🎛️ Customisation

### Change search queries

Edit `scripts/config.json` to control which search terms are used per deity:

```json
{
  "deities": {
    "shiv": {
      "name": "Shiv",
      "queries": ["Shiv Bhajan", "Mahadev Aarti", "Om Namah Shivaya Mantra"]
    }
  },
  "max_per_query": 10,
  "max_total_per_deity": 40,
  "order": "viewCount",
  "video_duration": "medium"
}
```

- `max_per_query` — max results per search term (max 50).
- `max_total_per_deity` — cap per deity to balance categories.
- `order` — `viewCount` (most viewed), `date` (newest), `relevance`.
- `video_duration` — `any`, `short` (<4min), `medium` (4–20min), `long` (>20min).

### Add a new deity

1. Add an entry in `scripts/config.json` under `deities`.
2. Add the deity in `assets/app.js` in the `DEITIES` array at the top.
3. (Optional) Add new type in `TYPES` array and a matching `.type-<name>` CSS class in `assets/styles.css`.

### Manually pin a video

Open `videos.json` and add `"pinned": true` to any video entry. Pinned videos always appear first and are never overwritten by the auto-fetcher:

```json
{
  "id": "dQw4w9WgXcQ",
  "deity": "krishna",
  "type": "bhajan",
  "title": "My Favourite Bhajan",
  "channel": "Channel Name",
  "pinned": true
}
```

---

## 📂 Project Structure

```
.
├── index.html              # Main page
├── videos.json             # Video database (auto-updated by CI)
├── assets/
│   ├── styles.css          # All styling
│   ├── app.js              # Filter/search/grid/player logic
│   └── escape.js           # HTML-escape helper
├── scripts/
│   ├── config.json         # Search configuration
│   └── fetch_videos.py     # YouTube fetcher script
└── .github/workflows/
    └── fetch.yml           # Daily auto-update job
```

---

## 🔧 How the Auto-Update Works

```
   ┌──────────────────┐    every day    ┌─────────────────────┐
   │  GitHub Actions  │ ──────────────> │  fetch_videos.py    │
   │   (cron 6:00 UTC)│                 │                     │
   └──────────────────┘                 │  1. Read config.json│
        ▲                               │  2. Search YouTube   │
        │                               │  3. Enrich metadata  │
        │ commit                        │  4. Merge w/ pinned  │
        └───────────────────────────────┘  5. Write videos.json
```

- The script is **idempotent** — safe to re-run.
- Manually-pinned videos are preserved.
- Metadata (views, duration) is refreshed for all known videos.
- New videos discovered via search are added automatically.

---

## ❓ Troubleshooting

**The fetch workflow fails with "quota exceeded"**
The free quota is 10,000 units/day. Reduce `max_per_query` or `max_total_per_deity` in `config.json`, or wait 24h for the quota to reset.

**No videos show on the website**
- Confirm `videos.json` exists in the repo root and isn't empty.
- Open browser DevTools → Network tab → check the `videos.json` request returns 200.
- If your repo isn't named `bhaktisangeet`, the paths should still work (they're relative).

**The Action didn't commit anything**
This means `videos.json` had no changes — either the search results are the same as yesterday, or the API returned errors. Check the Action logs.

**Thumbnails are blank**
YouTube thumbnails sometimes take time to propagate for very new videos. They will appear automatically once available.

---

## 📜 Disclaimer

All media is streamed directly from YouTube. BhaktiSangeet **does not host, store, or cache any audio or video content**. All copyrights belong to the respective creators and YouTube. This project is a discovery layer that helps users find existing public YouTube content.

---

## 🙏 Made with devotion

Built for the devotee community. Free, open, and ad-free.
