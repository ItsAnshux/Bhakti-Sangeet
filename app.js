/* ===== BhaktiSangeet — app logic ===== */
(function () {
  "use strict";

  // --- Config ---------------------------------------------------------
  const DEITIES = [
    { id: "all",     name: "All",      emoji: "🌟" },
    { id: "shiv",    name: "Shiv",     emoji: "🕉️" },
    { id: "krishna", name: "Krishna",  emoji: "🪈" },
    { id: "ram",     name: "Ram",      emoji: "🏹" },
    { id: "hanuman", name: "Hanuman",  emoji: "🐵" },
    { id: "durga",   name: "Durga",    emoji: "🌸" },
    { id: "ganesh",  name: "Ganesh",   emoji: "🙏" }
  ];
  const TYPES = [
    { id: "all",     name: "All" },
    { id: "bhajan",  name: "Bhajan" },
    { id: "aarti",   name: "Aarti" },
    { id: "mantra",  name: "Mantra" },
    { id: "stotra",  name: "Stotra" },
    { id: "kirtan",  name: "Kirtan" }
  ];

  // --- State ----------------------------------------------------------
  let allVideos = [];
  let activeDeity = "all";
  let activeType = "all";
  let searchTerm = "";

  // --- DOM ------------------------------------------------------------
  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("emptyState");
  const gridTitle = document.getElementById("gridTitle");
  const resultCount = document.getElementById("resultCount");
  const deityBar = document.getElementById("deityFilters");
  const typeBar = document.getElementById("typeFilters");
  const searchInput = document.getElementById("search");
  const modal = document.getElementById("playerModal");
  const playerFrame = document.getElementById("playerFrame");
  const playerTitle = document.getElementById("playerTitle");
  const playerInfo = document.getElementById("playerInfo");
  const playerLink = document.getElementById("playerLink");

  // --- Helpers --------------------------------------------------------
  function escapeHtml(str) {
    return window.BS_escapeHtml(str);
  }
  function thumbUrl(id) {
    return "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";
  }
  function formatDuration(iso) {
    if (!iso) return "";
    // PT#H#M#S
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return "";
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const s = m[3] ? parseInt(m[3], 10) : 0;
    if (h > 0) return h + ":" + String(min).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    return min + ":" + String(s).padStart(2, "0");
  }
  function formatViews(n) {
    if (!n && n !== 0) return "";
    if (n >= 10000000) return (n / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr";
    if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, "") + "L";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }
  function timeAgo(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return "today";
    if (days < 30) return days + " day" + (days > 1 ? "s" : "") + " ago";
    const months = Math.floor(days / 30);
    if (months < 12) return months + " month" + (months > 1 ? "s" : "") + " ago";
    const years = Math.floor(days / 365);
    return years + " year" + (years > 1 ? "s" : "") + " ago";
  }

  // --- Render filters -------------------------------------------------
  function renderFilters() {
    deityBar.innerHTML = DEITIES.map(function (d) {
      return '<button class="chip' + (d.id === activeDeity ? " active" : "") + '" data-deity="' + d.id + '">' +
        (d.emoji ? '<span>' + d.emoji + "</span>" : "") +
        d.name + '<span class="cnt" data-cnt="' + d.id + '"></span></button>';
    }).join("");
    typeBar.innerHTML = TYPES.map(function (t) {
      return '<button class="chip' + (t.id === activeType ? " active" : "") + '" data-type="' + t.id + '">' + t.name +
        '<span class="cnt" data-tcnt="' + t.id + '"></span></button>';
    }).join("");

    deityBar.querySelectorAll("[data-deity]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeDeity = btn.dataset.deity;
        renderFilters();
        renderGrid();
      });
    });
    typeBar.querySelectorAll("[data-type]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeType = btn.dataset.type;
        renderFilters();
        renderGrid();
      });
    });
    updateCounts();
  }

  function updateCounts() {
    // deity counts (respect type filter)
    DEITIES.forEach(function (d) {
      const el = deityBar.querySelector('[data-cnt="' + d.id + '"]');
      if (!el) return;
      const n = d.id === "all" ? allVideos.length : allVideos.filter(function (v) { return v.deity === d.id; }).length;
      el.textContent = n > 0 ? "(" + n + ")" : "";
    });
    // type counts (respect deity filter)
    TYPES.forEach(function (t) {
      const el = typeBar.querySelector('[data-tcnt="' + t.id + '"]');
      if (!el) return;
      let pool = allVideos;
      if (activeDeity !== "all") pool = pool.filter(function (v) { return v.deity === activeDeity; });
      const n = t.id === "all" ? pool.length : pool.filter(function (v) { return v.type === t.id; }).length;
      el.textContent = n > 0 ? "(" + n + ")" : "";
    });
  }

  // --- Filtering ------------------------------------------------------
  function filtered() {
    let list = allVideos;
    if (activeDeity !== "all") list = list.filter(function (v) { return v.deity === activeDeity; });
    if (activeType !== "all") list = list.filter(function (v) { return v.type === activeType; });
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(function (v) {
        return (v.title && v.title.toLowerCase().indexOf(q) > -1) ||
               (v.channel && v.channel.toLowerCase().indexOf(q) > -1) ||
               (v.deity && v.deity.indexOf(q) > -1) ||
               (v.type && v.type.indexOf(q) > -1);
      });
    }
    // sort: pinned first, then by publishedAt desc (newest first)
    list.sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });
    return list;
  }

  // --- Render grid ----------------------------------------------------
  function skeletonRow(n) {
    let html = "";
    for (let i = 0; i < n; i++) {
      html += '<div class="skeleton-card"><div class="thumb loading"></div>' +
        '<div class="sk-line"></div><div class="sk-line short"></div></div>';
    }
    return html;
  }

  function renderGrid() {
    const list = filtered();
    if (list.length === 0) {
      grid.innerHTML = "";
      emptyState.hidden = false;
      resultCount.textContent = "";
      return;
    }
    emptyState.hidden = true;
    resultCount.textContent = list.length + (list.length === 1 ? " video" : " videos");

    grid.innerHTML = list.map(function (v) {
      const deity = DEITIES.find(function (d) { return d.id === v.deity; });
      const dName = deity ? deity.name : v.deity;
      const dur = formatDuration(v.duration);
      return '<article class="card" data-id="' + v.id + '">' +
        '<div class="thumb loading">' +
          '<img src="' + thumbUrl(v.id) + '" alt="' + escapeHtml(v.title) + '" loading="lazy" ' +
          'onload="this.parentElement.classList.remove(\'loading\')" ' +
          'onerror="this.parentElement.classList.remove(\'loading\');this.src=\'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg\'" />' +
          '<span class="deity-tag">' + escapeHtml(dName) + '</span>' +
          (dur ? '<span class="dur-badge">' + dur + '</span>' : '') +
          '<div class="play-badge"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></div>' +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + escapeHtml(v.title) + '</h3>' +
          (v.channel ? '<span class="card-channel" style="font-size:.78rem;color:var(--muted)">' + escapeHtml(v.channel) + '</span>' : '') +
          '<div class="card-meta">' +
            '<span class="type-pill type-' + escapeHtml(v.type || "other") + '">' + escapeHtml(v.type || "song") + '</span>' +
            (v.viewCount ? '<span style="font-size:.72rem;color:var(--muted)">' + formatViews(v.viewCount) + ' views</span>' : '') +
          '</div>' +
        '</div>' +
      '</article>';
    }).join("");

    grid.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function () { openPlayer(card.dataset.id); });
    });
    updateCounts();
  }

  // --- Player ---------------------------------------------------------
  function openPlayer(id) {
    const v = allVideos.find(function (x) { return x.id === id; });
    if (!v) return;
    playerFrame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1";
    playerTitle.textContent = v.title || "Devotional Video";
    let info = "";
    if (v.channel) info += v.channel;
    if (v.viewCount) info += (info ? " · " : "") + formatViews(v.viewCount) + " views";
    if (v.publishedAt) info += (info ? " · " : "") + timeAgo(v.publishedAt);
    playerInfo.textContent = info;
    playerLink.href = "https://www.youtube.com/watch?v=" + id;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closePlayer() {
    playerFrame.src = "";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  modal.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", closePlayer);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closePlayer();
  });

  // --- Search (debounced) --------------------------------------------
  let searchTimer;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      searchTerm = searchInput.value.trim();
      renderGrid();
    }, 200);
  });

  // --- Data loading ---------------------------------------------------
  // Tries several path variants so it works whether the site is served
  // from the repo root or a project path (e.g. /repo-name/).
  async function loadVideos() {
    grid.innerHTML = skeletonRow(8);
    const candidates = [
      "videos.json",
      "./videos.json",
      "../videos.json",
      location.pathname.replace(/\/[^/]*$/, "/") + "videos.json"
    ];
    // also try relative to current path dir
    const baseDir = location.pathname.replace(/\/[^/]*$/, "/");
    if (baseDir && baseDir !== "/") candidates.unshift(baseDir + "videos.json");

    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        allVideos = Array.isArray(data) ? data : (data.videos || []);
        break;
      } catch (e) { /* try next */ }
    }
    if (!allVideos.length) {
      grid.innerHTML = "";
      emptyState.hidden = false;
      emptyState.querySelector("p").textContent = "Could not load videos. If you just deployed, the auto-updater may still be running its first fetch.";
      return;
    }
    renderGrid();
  }

  // --- Init -----------------------------------------------------------
  renderFilters();
  loadVideos();
})();
