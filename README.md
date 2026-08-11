# BhaktiSangeet

Hindu devotional music jukebox — Bhajans, Aartis, Mantras across Shiv, Krishna,
Ram, Hanuman, Durga aur Ganesh. Sab kuch YouTube se stream hota hai, koi
audio/video is repo mein host nahi hota. Video library **daily automatically
update** hoti hai via GitHub Actions.

## Kaise kaam karta hai

```
config/sources.json   → kaunse channels + keywords track karne hain (aap edit karte ho)
scripts/fetch-videos.js → YouTube Data API se naye videos dhundhta hai
.github/workflows/update-videos.yml → yeh script daily automatically chalata hai
data/videos.json      → auto-updated database, website isi ko padhti hai
index.html / style.css / app.js → website (koi build step nahi, plain static)
```

## Setup (ek baar karna hai)

### 1. YouTube Data API key banaiye
1. Jaiye: https://console.cloud.google.com/
2. Naya project banaiye (ya existing use kariye)
3. **APIs & Services → Library** mein "YouTube Data API v3" search karke **Enable** kariye
4. **APIs & Services → Credentials → Create Credentials → API key**
5. Key copy kar lijiye (free hai, daily quota ~10,000 units milte hain — yeh setup roughly 30 search calls/day use karta hai, easily fits)

### 2. Repo mein secret add kariye
1. Apne GitHub repo mein: **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `YOUTUBE_API_KEY`
3. Value: jo key aapne banayi

### 3. Channels add kariye (optional, keywords already default hain)
`config/sources.json` mein har category ke `channels` array mein us channel ki
**Channel ID** (UC... se shuru hoti hai, username nahi) daal dijiye. Keywords
already set hain, wo automatically kaam karengi.

### 4. GitHub Pages enable kariye
**Settings → Pages → Source: Deploy from branch → main / (root)**

### 5. Pehli baar manually run kariye
**Actions tab → Update Devotional Video Library → Run workflow**

Isse turant `data/videos.json` populate ho jayega. Uske baad yeh daily
5:00 AM UTC (~10:30 AM IST) automatically chalega aur naye videos add karta
rahega — kabhi manual ID daalne ki zaroorat nahi.

## Local testing
Kisi bhi static server se chala sakte ho, jaise:
```
npx serve .
```
