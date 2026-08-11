(() => {
  const DATA_URL = "data/videos.json";

  let allData = null;       // full videos.json
  let currentCategory = "All";
  let currentList = [];     // flattened list for the active category
  let currentIndex = -1;
  let player = null;
  let playerReady = false;
  let pendingVideoId = null;

  const npTitle = document.getElementById("npTitle");
  const npMeta = document.getElementById("npMeta");
  const playlistEl = document.getElementById("playlist");
  const playlistTitle = document.getElementById("playlistTitle");
  const playlistCount = document.getElementById("playlistCount");
  const emptyState = document.getElementById("emptyState");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const thali = document.getElementById("categoryThali");

  // ---- YouTube IFrame API ----
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("player", {
      height: "100%",
      width: "100%",
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          playerReady = true;
          if (pendingVideoId) {
            player.loadVideoById(pendingVideoId);
            pendingVideoId = null;
          }
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) playNext();
        },
      },
    });
  };

  function playVideoId(id) {
    if (playerReady && player) {
      player.loadVideoById(id);
    } else {
      pendingVideoId = id;
    }
  }

  // ---- Data loading ----
  async function loadData() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    allData = await res.json();
    buildList();
    renderPlaylist();
  }

  function buildList() {
    if (currentCategory === "All") {
      currentList = Object.entries(allData.categories).flatMap(([cat, vids]) =>
        vids.map((v) => ({ ...v, category: cat }))
      );
    } else {
      currentList = (allData.categories[currentCategory] || []).map((v) => ({
        ...v,
        category: currentCategory,
      }));
    }
  }

  function renderPlaylist() {
    playlistTitle.textContent =
      currentCategory === "All" ? "All Bhajans" : `${currentCategory} Bhajans`;
    playlistCount.textContent = currentList.length
      ? `${currentList.length} videos`
      : "";
    playlistEl.innerHTML = "";

    if (!currentList.length) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    currentList.forEach((video, idx) => {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.dataset.index = idx;
      if (idx === currentIndex) li.classList.add("playing");
      li.innerHTML = `
        <span class="track-title">${escapeHtml(video.title)}</span>
        <span class="track-channel">${escapeHtml(video.channel || "")}</span>
      `;
      li.addEventListener("click", () => selectIndex(idx));
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectIndex(idx);
        }
      });
      playlistEl.appendChild(li);
    });
  }

  function selectIndex(idx) {
    if (idx < 0 || idx >= currentList.length) return;
    currentIndex = idx;
    const video = currentList[idx];
    playVideoId(video.id);
    npTitle.textContent = video.title;
    npMeta.textContent = `${video.category} • ${video.channel || ""}`;
    highlightPlaying();
  }

  function highlightPlaying() {
    [...playlistEl.children].forEach((li, i) => {
      li.classList.toggle("playing", i === currentIndex);
    });
  }

  function playRandom() {
    if (!currentList.length) return;
    let idx = Math.floor(Math.random() * currentList.length);
    if (currentList.length > 1 && idx === currentIndex) {
      idx = (idx + 1) % currentList.length;
    }
    selectIndex(idx);
  }

  function playNext() {
    if (!currentList.length) return;
    selectIndex((currentIndex + 1) % currentList.length);
  }

  function playPrev() {
    if (!currentList.length) return;
    selectIndex((currentIndex - 1 + currentList.length) % currentList.length);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Category switching ----
  thali.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-pill");
    if (!btn) return;
    [...thali.children].forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.category;
    currentIndex = -1;
    buildList();
    renderPlaylist();
  });

  shuffleBtn.addEventListener("click", playRandom);
  nextBtn.addEventListener("click", playNext);
  prevBtn.addEventListener("click", playPrev);

  loadData().catch((err) => {
    console.error(err);
    npTitle.textContent = "Library load nahi ho payi";
    npMeta.textContent = "data/videos.json check kariye";
  });
})();
