# BhaktiSangeet — Automatic YouTube Song Updates

This version automatically collects YouTube video IDs using the official YouTube Data API and saves them to `songs.json`. The website then embeds those videos through YouTube.

## One-time setup

1. Create/enable a YouTube Data API v3 project in Google Cloud.
2. Create an API key.
3. On GitHub, open your repository:
   Settings → Secrets and variables → Actions → New repository secret
4. Name the secret exactly:
   `YOUTUBE_API_KEY`
5. Paste your API key as the secret value.
6. Upload all files from this package to the repository.
7. Open Actions → `Update YouTube Songs` → Run workflow.
8. Enable GitHub Pages from Settings → Pages and deploy from your branch.

The workflow also runs automatically every day at 03:00 UTC.

## What happens automatically

The workflow searches YouTube for:
- Shiv bhajan
- Krishna bhajan
- Shri Ram bhajan
- Hanuman bhajan
- Durga bhajan
- Ganesh bhajan
- Hindu aarti
- Hindi devotional bhajan

It requests embeddable/syndicated videos and writes the video IDs, titles and categories into `songs.json`.

The browser never needs the API key. The key stays in GitHub Actions Secrets.

## Important

YouTube search results can change. Automatic search does not guarantee that every result is suitable for your site. Review your queries/content and remove videos you do not want before publishing.

The site does not download or host the video/audio files; playback uses YouTube's embedded player.
