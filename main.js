/**
 * Spotify Personalized Grammys
 * Front‑end SPA using Spotify OAuth (implicit grant or PKCE) and Web API.
 *
 * This file contains:
 *  - OAuth helpers (login, token parsing, logout)
 *  - Spotify API fetch helpers
 *  - Award computation logic
 *  - Ceremony sequencing, animations, and toast explanations
 *
 * IMPORTANT: Set your CLIENT_ID and REDIRECT_URI below before deploying.
 */

// ====== CONFIG ======

const CONFIG = {
    CLIENT_ID: "YOUR_SPOTIFY_CLIENT_ID_HERE",
    REDIRECT_URI: window.location.origin + window.location.pathname, // e.g. https://yourdomain.com/
    SCOPES: [
      "user-read-email",
      "user-read-private",
      "user-top-read",
      "user-read-recently-played",
    ],
    // Token storage keys
    STORAGE_KEYS: {
      ACCESS_TOKEN: "sp_grammys_access_token",
      EXPIRES_AT: "sp_grammys_expires_at",
    },
  };
  
  // ====== DOM REFERENCES ======
  
  const dom = {
    loginBtn: document.getElementById("loginBtn"),
    landingLoginBtn: document.getElementById("landingLoginBtn"),
    demoBtn: document.getElementById("demoBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    landingOverlay: document.getElementById("landingOverlay"),
    ceremonyContainer: document.getElementById("ceremonyContainer"),
    ceremonyStage: document.getElementById("ceremonyStage"),
    ceremonyUserName: document.getElementById("ceremonyUserName"),
    ceremonyMetaText: document.getElementById("ceremonyMetaText"),
    awardCategoryLabel: document.getElementById("awardCategoryLabel"),
    awardName: document.getElementById("awardName"),
    awardWinner: document.getElementById("awardWinner"),
    awardWinnerTitle: document.getElementById("awardWinnerTitle"),
    awardWinnerSubtitle: document.getElementById("awardWinnerSubtitle"),
    awardDescription: document.getElementById("awardDescription"),
    awardExplanation: document.getElementById("awardExplanation"),
    awardArtwork: document.getElementById("awardArtwork"),
    awardTagline: document.getElementById("awardTagline"),
    nomineesCard: document.getElementById("nomineesCard"),
    nomineesList: document.getElementById("nomineesList"),
    timelineList: document.getElementById("timelineList"),
    statChips: document.getElementById("statChips"),
    replayBtn: document.getElementById("replayBtn"),
    shareBtn: document.getElementById("shareBtn"),
    downloadVideoBtn: document.getElementById("downloadVideoBtn"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    toastContainer: document.getElementById("toastContainer"),
    navProfile: document.getElementById("navProfile"),
    navProfileImg: document.getElementById("navProfileImg"),
    navProfileName: document.getElementById("navProfileName"),
    confettiLayer: document.getElementById("confettiLayer"),
  };
  
  // ====== UTILITIES ======
  
  function showLoading(show) {
    dom.loadingOverlay.style.display = show ? "flex" : "none";
  }
  
  /**
   * Show a toast notification explaining each award or user actions.
   * @param {Object} opts
   * @param {string} opts.title
   * @param {string} opts.text
   * @param {number} [opts.durationMs=5000]
   */
  function showToast({ title, text, durationMs = 5000 }) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <div class="toast-icon">★</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-text">${text}</div>
      </div>
      <button class="toast-close" aria-label="Close toast">&times;</button>
    `;
    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => dismissToast(toast));
    dom.toastContainer.appendChild(toast);
  
    if (durationMs > 0) {
      setTimeout(() => dismissToast(toast), durationMs);
    }
  }
  
  function dismissToast(toastEl) {
    if (!toastEl || !toastEl.parentElement) return;
    toastEl.style.animation = "toast-out 0.18s ease-out forwards";
    setTimeout(() => {
      toastEl.remove();
    }, 200);
  }
  
  function formatDurationMsToMinSec(ms) {
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  
  function formatHourLabel(dateString) {
    const d = new Date(dateString);
    const h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:00 ${ampm}`;
  }
  
  function formatDayLabel(dateString) {
    const d = new Date(dateString);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[d.getDay()];
  }
  
  function getMonthKey(dateString) {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  
  function formatMonthLabel(key) {
    const [y, m] = key.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[Number(m) - 1]} ${y}`;
  }
  
  /**
   * Simple confetti burst for winner reveals.
   */
  function spawnConfettiBurst() {
    if (!dom.confettiLayer) return;
    const colors = ["#f6c453", "#ff9f43", "#ff6b81", "#4dd0e1", "#ffffff"];
    const width = dom.confettiLayer.clientWidth || 400;
  
    for (let i = 0; i < 36; i++) {
      const el = document.createElement("div");
      el.className = "confetto";
      const left = Math.random() * width;
      const delay = Math.random() * 0.4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      el.style.left = `${left}px`;
      el.style.top = `${-20 - Math.random() * 40}px`;
      el.style.backgroundColor = color;
      el.style.animationDelay = `${delay}s`;
      dom.confettiLayer.appendChild(el);
      setTimeout(() => {
        el.remove();
      }, 2800);
    }
  }
  
  // ====== AUTH & TOKEN HANDLING ======
  
  function buildAuthorizeUrl() {
    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      response_type: "token", // implicit grant – simplest for SPA
      redirect_uri: CONFIG.REDIRECT_URI,
      scope: CONFIG.SCOPES.join(" "),
      show_dialog: "true",
    });
  
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }
  
  function triggerSpotifyLogin() {
    if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID === "YOUR_SPOTIFY_CLIENT_ID_HERE") {
      alert("Please set your Spotify CLIENT_ID in main.js before using the app.");
      return;
    }
    window.location.href = buildAuthorizeUrl();
  }
  
  /**
   * Parse the hash fragment after Spotify redirects back with an access_token.
   * Example: #access_token=...&token_type=Bearer&expires_in=3600
   */
  function parseSpotifyHash() {
    if (!window.location.hash.startsWith("#")) return null;
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");
  
    if (!accessToken) return null;
  
    const expiresAt = Date.now() + Number(expiresIn || 3600) * 1000;
    return { accessToken, expiresAt };
  }
  
  function storeToken(token, expiresAtMs) {
    window.localStorage.setItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN, token);
    window.localStorage.setItem(CONFIG.STORAGE_KEYS.EXPIRES_AT, String(expiresAtMs));
  }
  
  function getStoredToken() {
    const token = window.localStorage.getItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    const expiresAt = Number(window.localStorage.getItem(CONFIG.STORAGE_KEYS.EXPIRES_AT) || "0");
    if (!token || !expiresAt) return null;
    if (Date.now() >= expiresAt) {
      clearToken();
      return null;
    }
    return { token, expiresAt };
  }
  
  function clearToken() {
    window.localStorage.removeItem(CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    window.localStorage.removeItem(CONFIG.STORAGE_KEYS.EXPIRES_AT);
  }
  
  function logout() {
    clearToken();
    window.location.hash = "";
    window.location.reload();
  }
  
  // ====== SPOTIFY API HELPERS ======
  
  /**
   * Basic Spotify API wrapper using fetch.
   * @param {string} path e.g. "/me"
   * @param {string} accessToken
   * @param {Object} [opts]
   */
  async function spotifyGet(path, accessToken, opts = {}) {
    const url = new URL(`https://api.spotify.com/v1${path}`);
    if (opts.query) {
      Object.entries(opts.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
    }
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Spotify API error (${res.status}): ${text}`);
    }
    return res.json();
  }
  
  /**
   * Batch fetch audio features for multiple track ids.
   */
  async function fetchAudioFeatures(trackIds, accessToken) {
    if (!trackIds.length) return {};
    const all = {};
    const chunkSize = 100;
    for (let i = 0; i < trackIds.length; i += chunkSize) {
      const slice = trackIds.slice(i, i + chunkSize);
      const data = await spotifyGet("/audio-features", accessToken, {
        query: { ids: slice.join(",") },
      });
      (data.audio_features || []).forEach((f) => {
        if (f && f.id) all[f.id] = f;
      });
    }
    return all;
  }
  
  // ====== AWARD LOGIC ======
  
  /**
   * Pull together all relevant Spotify data for the ceremony.
   * Returns a shape used by computeAwards.
   */
  async function fetchSpotifyStats(accessToken) {
    // 1) Profile
    const profile = await spotifyGet("/me", accessToken);
  
    // 2) Top tracks & artists across multiple ranges
    const [topTracksShort, topTracksMedium, topTracksLong] = await Promise.all([
      spotifyGet("/me/top/tracks", accessToken, { query: { limit: 30, time_range: "short_term" } }),
      spotifyGet("/me/top/tracks", accessToken, { query: { limit: 30, time_range: "medium_term" } }),
      spotifyGet("/me/top/tracks", accessToken, { query: { limit: 30, time_range: "long_term" } }),
    ]);
  
    const [topArtistsShort, topArtistsMedium, topArtistsLong] = await Promise.all([
      spotifyGet("/me/top/artists", accessToken, { query: { limit: 30, time_range: "short_term" } }),
      spotifyGet("/me/top/artists", accessToken, { query: { limit: 30, time_range: "medium_term" } }),
      spotifyGet("/me/top/artists", accessToken, { query: { limit: 30, time_range: "long_term" } }),
    ]);
  
    // 3) Recent listening history
    const recentlyPlayed = await spotifyGet("/me/player/recently-played", accessToken, {
      query: { limit: 50 },
    });
  
    // 4) Audio features for top tracks (for "Best Album Art" we don't strictly need it, but nice to have)
    const allTopTracks = new Map();
    [topTracksShort, topTracksMedium, topTracksLong].forEach((bucket) => {
      (bucket.items || []).forEach((t) => allTopTracks.set(t.id, t));
    });
    const trackIds = Array.from(allTopTracks.keys());
    const audioFeaturesById = await fetchAudioFeatures(trackIds, accessToken);
  
    return {
      profile,
      topTracks: {
        short: topTracksShort.items || [],
        medium: topTracksMedium.items || [],
        long: topTracksLong.items || [],
      },
      topArtists: {
        short: topArtistsShort.items || [],
        medium: topArtistsMedium.items || [],
        long: topArtistsLong.items || [],
      },
      recentlyPlayed: recentlyPlayed.items || [],
      audioFeaturesById,
    };
  }
  
  /**
   * Build some user‑friendly stats (used in chips sidebar).
   */
  function buildStatSnapshot(data) {
    const totalTopTracks = data.topTracks.short.length;
    const totalTopArtists = data.topArtists.short.length;
    const uniqueAlbums = new Set(
      data.topTracks.short.map((t) => t.album && t.album.id).filter(Boolean)
    ).size;
  
    const recentDistinctDays = new Set(
      data.recentlyPlayed.map((p) => new Date(p.played_at).toDateString())
    ).size;
  
    return [
      `${totalTopTracks} top tracks (short‑term)`,
      `${totalTopArtists} top artists (short‑term)`,
      `${uniqueAlbums} standout albums`,
      `${recentDistinctDays} days of recent listening`,
    ];
  }
  
  /**
   * Compute all the custom award categories from Spotify data.
   * Each award object:
   *  - id: string
   *  - name: string
   *  - categoryLabel: string
   *  - description: string
   *  - explanation: string
   *  - winner: { title, subtitle, imageUrl? }
   *  - nominees: [{ title, subtitle, valueBadge? }]
   *  - artworkImageUrl?: string
   *  - tagline?: string
   */
  function computeAwards(data) {
    const awards = [];
  
    const topShort = data.topTracks.short;
    const topArtistsShort = data.topArtists.short;
  
    // Helper: safe arrays
    const safeArr = (arr) => (Array.isArray(arr) ? arr : []);
  
    // --- Most Played Track (short‑term top #1) ---
    if (topShort.length) {
      const t = topShort[0];
      awards.push({
        id: "most_played_track",
        categoryLabel: "Most Played Track",
        name: "Most Played Track of the Season",
        description: "The song you simply could not escape — your undisputed #1 over the last few weeks.",
        explanation: "Chosen as your #1 track in Spotify’s short‑term top tracks list.",
        winner: {
          title: t.name,
          subtitle: (t.artists || []).map((a) => a.name).join(", "),
        },
        nominees: safeArr(topShort.slice(0, 5)).map((track, idx) => ({
          title: track.name,
          subtitle: (track.artists || []).map((a) => a.name).join(", "),
          valueBadge:
            idx === 0
              ? "Winner"
              : `#${idx + 1} in your recent favorites`,
        })),
        artworkImageUrl: (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || null,
        tagline: "Every stream was a vote.",
      });
    }
  
    // --- Top Artist (short‑term top #1) ---
    if (topArtistsShort.length) {
      const a = topArtistsShort[0];
      awards.push({
        id: "top_artist",
        categoryLabel: "Top Artist",
        name: "Artist of the Year (According to You)",
        description:
          "Your most‑streamed artist recently — the one dominating your queues, playlists, and replays.",
        explanation: "Selected as your #1 artist in Spotify’s short‑term top artists ranking.",
        winner: {
          title: a.name,
          subtitle: `${a.followers?.total?.toLocaleString?.() || "?"} followers on Spotify`,
        },
        nominees: safeArr(topArtistsShort.slice(0, 5)).map((artist, idx) => ({
          title: artist.name,
          subtitle: `${artist.genres?.[0] ? artist.genres[0] + " • " : ""}${artist.followers?.total?.toLocaleString?.() || "?"} followers`,
          valueBadge: idx === 0 ? "Winner" : `Top #${idx + 1} artist`,
        })),
        artworkImageUrl: (a.images && a.images[0] && a.images[0].url) || null,
        tagline: "Your main headliner.",
      });
    }
  
    // --- Top Album (by aggregate appearances in top tracks) ---
    if (topShort.length) {
      const albumCounts = new Map();
      topShort.forEach((t) => {
        const album = t.album;
        if (!album || !album.id) return;
        const key = album.id;
        const prev = albumCounts.get(key) || { album, count: 0, totalMs: 0 };
        prev.count += 1;
        prev.totalMs += Number(t.duration_ms || 0);
        albumCounts.set(key, prev);
      });
  
      const rankedAlbums = Array.from(albumCounts.values()).sort((a, b) => b.count - a.count);
      if (rankedAlbums.length) {
        const topAlbum = rankedAlbums[0].album;
        awards.push({
          id: "top_album",
          categoryLabel: "Top Album",
          name: "Album of the Year (Your Rotation)",
          description:
            "The album whose tracks kept sneaking into your sessions, playlists, and late‑night loops.",
          explanation:
            "Computed from which album contributed the most tracks to your short‑term top tracks.",
          winner: {
            title: topAlbum.name,
            subtitle: (topAlbum.artists || []).map((a) => a.name).join(", "),
          },
          nominees: rankedAlbums.slice(0, 5).map((entry, idx) => ({
            title: entry.album.name,
            subtitle: `${(entry.album.artists || []).map((a) => a.name).join(", ")} • ${entry.count} top tracks`,
            valueBadge: idx === 0 ? "Winner" : `#${idx + 1} album`,
          })),
          artworkImageUrl:
            (topAlbum.images && topAlbum.images[0] && topAlbum.images[0].url) || null,
          tagline: "The project you kept returning to.",
        });
      }
    }
  
    // --- Breakout Artist (biggest jump medium -> short term) ---
    const breakout = computeBreakoutArtist(data.topArtists.medium, data.topArtists.short);
    if (breakout) {
      awards.push({
        id: "breakout_artist",
        categoryLabel: "Breakout Artist",
        name: "Breakout Artist of the Season",
        description:
          "The artist whose star is rising fastest in your rotation — a sudden spike in plays recently.",
        explanation:
          "We compared your medium‑term vs short‑term artist rankings and looked for the biggest jump upward.",
        winner: {
          title: breakout.name,
          subtitle: `Jumped ${breakout.jump} spots in your ranking`,
        },
        nominees: breakout.nominees,
        artworkImageUrl:
          (breakout.artist.images && breakout.artist.images[0] && breakout.artist.images[0].url) || null,
        tagline: "Your surprise obsession.",
      });
    }
  
    // --- Comeback Artist (present in long + recent, but not short‑term top) ---
    const comeback = computeComebackArtist(
      data.topArtists.long,
      data.topArtists.short,
      data.recentlyPlayed
    );
    if (comeback) {
      awards.push({
        id: "comeback_artist",
        categoryLabel: "Comeback Artist",
        name: "Comeback Artist of the Year",
        description:
          "An artist you used to love, drifted away from, and now welcomed back into heavy rotation.",
        explanation:
          "Found by spotting long‑term favorites who dipped out of your short‑term top artists but reappeared in recent plays.",
        winner: {
          title: comeback.name,
          subtitle: `${comeback.recentPlays} recent plays across your queue`,
        },
        nominees: comeback.nominees,
        artworkImageUrl:
          (comeback.artist.images && comeback.artist.images[0] && comeback.artist.images[0].url) ||
          null,
        tagline: "Welcome back to the stage.",
      });
    }
  
    // --- One‑Hit Wonder (artist where one track dominates plays) ---
    const oneHit = computeOneHitWonder(data.recentlyPlayed);
    if (oneHit) {
      awards.push({
        id: "one_hit_wonder",
        categoryLabel: "One‑Hit Wonder",
        name: "One‑Hit Wonder (In Your Library)",
        description:
          "That artist you technically ‘listen to’, but really it’s just one song doing all the work.",
        explanation:
          "We looked for artists in your recent plays where one song makes up the vast majority of their streams.",
        winner: {
          title: oneHit.trackName,
          subtitle: `${oneHit.artistName} • ${oneHit.share}% of that artist’s recent plays`,
        },
        nominees: oneHit.nominees,
        artworkImageUrl: oneHit.albumArtUrl || null,
        tagline: "A single song, endless replays.",
      });
    }
  
    // --- Peak Listening Hour ---
    const peakHour = computePeakListeningHour(data.recentlyPlayed);
    if (peakHour) {
      awards.push({
        id: "peak_hour",
        categoryLabel: "Listening Rituals",
        name: "Peak Listening Hour",
        description:
          "The hour of the day when your listening energy routinely hits its highest volume.",
        explanation: "Computed from timestamps across your recent listening history.",
        winner: {
          title: peakHour.label,
          subtitle: `${peakHour.count} plays logged in that hour window`,
        },
        nominees: peakHour.nominees,
        artworkImageUrl: null,
        tagline: "Your unofficial listening time slot.",
      });
    }
  
    // --- Peak Listening Day ---
    const peakDay = computePeakListeningDay(data.recentlyPlayed);
    if (peakDay) {
      awards.push({
        id: "peak_day",
        categoryLabel: "Listening Rituals",
        name: "Peak Listening Day of the Week",
        description:
          "The weekday when you lean on music the most — intentional deep dives or casual background sound.",
        explanation: "We grouped your recent plays by weekday and picked the busiest.",
        winner: {
          title: peakDay.label,
          subtitle: `${peakDay.count} recent plays landed on this day`,
        },
        nominees: peakDay.nominees,
        artworkImageUrl: null,
        tagline: "Your go‑to day for soundtracks.",
      });
    }
  
    // --- Busiest Listening Month ---
    const busiestMonth = computeBusiestListeningMonth(data.recentlyPlayed);
    if (busiestMonth) {
      awards.push({
        id: "busiest_month",
        categoryLabel: "Listening Rituals",
        name: "Busiest Listening Month",
        description:
          "The month where you leaned on music the hardest — roadtrips, workouts, deep‑dive sessions and more.",
        explanation:
          "We grouped your recent plays by calendar month and looked for the most active period.",
        winner: {
          title: busiestMonth.label,
          subtitle: `${busiestMonth.count} recent plays in that month`,
        },
        nominees: busiestMonth.nominees,
        artworkImageUrl: null,
        tagline: "Your soundtrack‑heavy chapter.",
      });
    }
  
    // --- Underdog Champion (least‑followed artist among your short‑term top artists) ---
    const underdog = computeUnderdogChampion(topArtistsShort);
    if (underdog) {
      awards.push({
        id: "underdog_champion",
        categoryLabel: "Underdog Champion",
        name: "Underdog Champion",
        description:
          "An artist you champion that hasn’t blown up (yet) — low follower count, big presence in your queue.",
        explanation:
          "We looked for artists in your short‑term top list with relatively low follower counts.",
        winner: {
          title: underdog.name,
          subtitle: `${underdog.followers.toLocaleString()} followers • still a deep‑cut favorite for you`,
        },
        nominees: underdog.nominees,
        artworkImageUrl:
          (underdog.artist.images && underdog.artist.images[0] && underdog.artist.images[0].url) ||
          null,
        tagline: "You heard them before the world did.",
      });
    }
  
    // --- Best Album Art (purely aesthetic from your top tracks) ---
    const bestArt = computeBestAlbumArt(data.topTracks.medium || data.topTracks.short);
    if (bestArt) {
      awards.push({
        id: "best_album_art",
        categoryLabel: "Visuals",
        name: "Best Album Art",
        description:
          "The cover that caught your eye in the queue — bold palettes, clever design, or pure vibes.",
        explanation:
          "Randomly chosen from your most‑played albums, weighted slightly toward brighter artwork.",
        winner: {
          title: bestArt.albumName,
          subtitle: bestArt.artistName,
        },
        nominees: bestArt.nominees,
        artworkImageUrl: bestArt.artUrl,
        tagline: "Sometimes you really do judge a song by its cover.",
      });
    }
  
    return awards;
  }
  
  // --- Award helper computations ---
  
  function computeBreakoutArtist(mediumArtists, shortArtists) {
    if (!mediumArtists?.length || !shortArtists?.length) return null;
  
    const mediumIndex = new Map();
    mediumArtists.forEach((a, idx) => mediumIndex.set(a.id, idx));
  
    const jumps = [];
    shortArtists.forEach((a, idx) => {
      if (!mediumIndex.has(a.id)) return;
      const prevIdx = mediumIndex.get(a.id);
      const delta = prevIdx - idx; // positive = jump up
      if (delta > 0) {
        jumps.push({ artist: a, jump: delta, from: prevIdx + 1, to: idx + 1 });
      }
    });
  
    if (!jumps.length) return null;
    jumps.sort((a, b) => b.jump - a.jump);
    const top = jumps[0];
  
    const nominees = jumps.slice(0, 5).map((entry, idx) => ({
      title: entry.artist.name,
      subtitle: `From #${entry.from} → #${entry.to} in your rankings`,
      valueBadge: idx === 0 ? "Winner" : `Jumped +${entry.jump}`,
    }));
  
    return {
      artist: top.artist,
      name: top.artist.name,
      jump: top.jump,
      nominees,
    };
  }
  
  function computeComebackArtist(longArtists, shortArtists, recentlyPlayed) {
    if (!longArtists?.length || !recentlyPlayed?.length) return null;
  
    const shortIds = new Set(shortArtists.map((a) => a.id));
    const longTopIds = new Set(longArtists.slice(0, 20).map((a) => a.id));
  
    // Count recent plays by artist
    const recentArtistCounts = new Map();
    recentlyPlayed.forEach((item) => {
      const track = item.track;
      if (!track || !track.artists) return;
      track.artists.forEach((artist) => {
        if (!artist.id) return;
        if (!longTopIds.has(artist.id)) return;
        const prev = recentArtistCounts.get(artist.id) || 0;
        recentArtistCounts.set(artist.id, prev + 1);
      });
    });
  
    const candidates = [];
    recentArtistCounts.forEach((count, artistId) => {
      // Must not be in current short‑term top -> "comeback"
      if (shortIds.has(artistId)) return;
      const artist = longArtists.find((a) => a.id === artistId);
      if (!artist) return;
      candidates.push({ artist, recentPlays: count });
    });
  
    if (!candidates.length) return null;
  
    candidates.sort((a, b) => b.recentPlays - a.recentPlays);
    const top = candidates[0];
    const nominees = candidates.slice(0, 5).map((entry, idx) => ({
      title: entry.artist.name,
      subtitle: `${entry.recentPlays} recent plays • comeback from your long‑term favorites`,
      valueBadge: idx === 0 ? "Winner" : "Nominee",
    }));
  
    return {
      artist: top.artist,
      name: top.artist.name,
      recentPlays: top.recentPlays,
      nominees,
    };
  }
  
  function computeOneHitWonder(recentlyPlayed) {
    if (!recentlyPlayed?.length) return null;
  
    // Count plays per artist + track
    const artistTrackCounts = new Map();
    const artistTotals = new Map();
  
    recentlyPlayed.forEach((item) => {
      const track = item.track;
      if (!track || !track.artists || !track.artists.length) return;
      const artist = track.artists[0]; // primary
      if (!artist.id) return;
      const keyArtist = artist.id;
      const keyTrack = track.id;
  
      const totalPrev = artistTotals.get(keyArtist) || 0;
      artistTotals.set(keyArtist, totalPrev + 1);
  
      const perArtist = artistTrackCounts.get(keyArtist) || new Map();
      perArtist.set(keyTrack, (perArtist.get(keyTrack) || 0) + 1);
      artistTrackCounts.set(keyArtist, perArtist);
    });
  
    let best = null;
  
    artistTrackCounts.forEach((trackMap, artistId) => {
      const total = artistTotals.get(artistId) || 0;
      if (total < 3) return; // need at least a few plays
      let topTrack = null;
      let topCount = 0;
      trackMap.forEach((cnt, trackId) => {
        if (cnt > topCount) {
          topCount = cnt;
          topTrack = { trackId, count: cnt };
        }
      });
      const share = topCount / total;
      if (share >= 0.7) {
        // at least 70% of plays
        if (!best || share > best.share) {
          best = { artistId, topTrack, share, total };
        }
      }
    });
  
    if (!best) return null;
  
    const exampleItem = recentlyPlayed.find(
      (p) =>
        p.track &&
        p.track.id === best.topTrack.trackId &&
        p.track.artists &&
        p.track.artists[0] &&
        p.track.artists[0].id === best.artistId
    );
    if (!exampleItem) return null;
  
    const track = exampleItem.track;
    const artist = track.artists[0];
    const artUrl = track.album && track.album.images && track.album.images[0]?.url;
  
    const nominees = [
      {
        title: track.name,
        subtitle: `${artist.name} • ${best.topTrack.count} of ${best.total} plays (${Math.round(
          best.share * 100
        )}%)`,
        valueBadge: "Winner",
      },
    ];
  
    return {
      artistName: artist.name,
      trackName: track.name,
      albumArtUrl: artUrl,
      share: Math.round(best.share * 100),
      nominees,
    };
  }
  
  function computePeakListeningHour(recentlyPlayed) {
    if (!recentlyPlayed?.length) return null;
  
    const hourCounts = new Array(24).fill(0);
    recentlyPlayed.forEach((item) => {
      const d = new Date(item.played_at);
      hourCounts[d.getHours()]++;
    });
  
    let bestHour = 0;
    let bestCount = 0;
    hourCounts.forEach((cnt, h) => {
      if (cnt > bestCount) {
        bestCount = cnt;
        bestHour = h;
      }
    });
    if (!bestCount) return null;
  
    const label = formatHourLabel(
      new Date(new Date().setHours(bestHour, 0, 0, 0)).toISOString()
    );
  
    const nominees = [];
    hourCounts.forEach((cnt, h) => {
      if (!cnt) return;
      nominees.push({
        label: h,
        count: cnt,
      });
    });
    nominees.sort((a, b) => b.count - a.count);
  
    return {
      label,
      count: bestCount,
      nominees: nominees.slice(0, 5).map((item, idx) => ({
        title: formatHourLabel(new Date(new Date().setHours(item.label, 0, 0, 0)).toISOString()),
        subtitle: `${item.count} plays`,
        valueBadge: idx === 0 ? "Winner" : "Nominee",
      })),
    };
  }
  
  function computePeakListeningDay(recentlyPlayed) {
    if (!recentlyPlayed?.length) return null;
  
    const dayCounts = new Array(7).fill(0); // 0 = Sun
    recentlyPlayed.forEach((item) => {
      const d = new Date(item.played_at);
      dayCounts[d.getDay()]++;
    });
  
    let bestDay = 0;
    let bestCount = 0;
    dayCounts.forEach((cnt, day) => {
      if (cnt > bestCount) {
        bestCount = cnt;
        bestDay = day;
      }
    });
    if (!bestCount) return null;
  
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const label = days[bestDay];
  
    const nominees = [];
    dayCounts.forEach((cnt, day) => {
      if (!cnt) return;
      nominees.push({
        day,
        count: cnt,
      });
    });
    nominees.sort((a, b) => b.count - a.count);
  
    return {
      label,
      count: bestCount,
      nominees: nominees.slice(0, 7).map((item, idx) => ({
        title: days[item.day],
        subtitle: `${item.count} plays`,
        valueBadge: idx === 0 ? "Winner" : "Nominee",
      })),
    };
  }
  
  function computeBusiestListeningMonth(recentlyPlayed) {
    if (!recentlyPlayed?.length) return null;
  
    const monthCounts = new Map();
    recentlyPlayed.forEach((item) => {
      const key = getMonthKey(item.played_at);
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    });
    if (!monthCounts.size) return null;
  
    const months = Array.from(monthCounts.entries()).map(([key, count]) => ({ key, count }));
    months.sort((a, b) => b.count - a.count);
    const top = months[0];
  
    const nominees = months.slice(0, 5).map((entry, idx) => ({
      title: formatMonthLabel(entry.key),
      subtitle: `${entry.count} plays`,
      valueBadge: idx === 0 ? "Winner" : "Nominee",
    }));
  
    return {
      label: formatMonthLabel(top.key),
      count: top.count,
      nominees,
    };
  }
  
  function computeUnderdogChampion(topArtistsShort) {
    if (!topArtistsShort?.length) return null;
  
    // Filter to artists with follower data
    const artists = topArtistsShort.filter((a) => typeof a.followers?.total === "number");
    if (!artists.length) return null;
  
    artists.sort((a, b) => (a.followers.total || 0) - (b.followers.total || 0));
    const winner = artists[0];
    const nominees = artists.slice(0, 5).map((a, idx) => ({
      title: a.name,
      subtitle: `${a.followers.total.toLocaleString()} followers`,
      valueBadge: idx === 0 ? "Winner" : "Underdog",
    }));
  
    return {
      artist: winner,
      name: winner.name,
      followers: winner.followers.total || 0,
      nominees,
    };
  }
  
  function computeBestAlbumArt(tracks) {
    if (!tracks?.length) return null;
  
    // Score each album by a simple heuristic: presence in top tracks and random "brightness"
    const albumMap = new Map();
    tracks.forEach((t) => {
      const album = t.album;
      if (!album || !album.id) return;
      const prev = albumMap.get(album.id) || { album, count: 0 };
      prev.count += 1;
      albumMap.set(album.id, prev);
    });
  
    const albums = Array.from(albumMap.values());
    if (!albums.length) return null;
  
    // Weighted random: more appearances = more chance
    const weighted = [];
    albums.forEach((entry) => {
      const weight = 1 + entry.count;
      for (let i = 0; i < weight; i++) weighted.push(entry.album);
    });
    const randomAlbum = weighted[Math.floor(Math.random() * weighted.length)];
    const artUrl = randomAlbum.images && randomAlbum.images[0] && randomAlbum.images[0].url;
    const artistName = (randomAlbum.artists || []).map((a) => a.name).join(", ");
  
    const nominees = albums
      .slice(0, 5)
      .map((entry, idx) => ({
        title: entry.album.name,
        subtitle: (entry.album.artists || []).map((a) => a.name).join(", "),
        valueBadge: idx === 0 ? "Nominee" : "Nominee",
      }));
  
    return {
      albumName: randomAlbum.name,
      artistName,
      artUrl,
      nominees,
    };
  }
  
  // ====== CEREMONY RENDERING ======
  
  let ceremonyState = {
    awards: [],
    currentIndex: -1,
    data: null,
    profile: null,
    running: false,
  };
  
  function resetCeremonyState() {
    ceremonyState.currentIndex = -1;
    ceremonyState.running = false;
  }
  
  /**
   * Initialize timeline sidebar with award names.
   */
  function renderTimeline(awards) {
    dom.timelineList.innerHTML = "";
    awards.forEach((award, idx) => {
      const item = document.createElement("div");
      item.className = "timeline-item";
      item.dataset.index = String(idx);
      item.innerHTML = `
        <div class="timeline-dot">
          <div class="timeline-dot-inner"></div>
        </div>
        <div class="timeline-label">
          <strong>${award.name}</strong>
          <span>${award.categoryLabel}</span>
        </div>
        <div class="timeline-index">${idx + 1}/${awards.length}</div>
      `;
      dom.timelineList.appendChild(item);
    });
  }
  
  function setTimelineActive(index) {
    const items = dom.timelineList.querySelectorAll(".timeline-item");
    items.forEach((el, idx) => {
      const dot = el.querySelector(".timeline-dot");
      if (idx === index) {
        dot.classList.add("timeline-dot-current");
      } else {
        dot.classList.remove("timeline-dot-current");
      }
    });
  }
  
  /**
   * Render stats chips in sidebar.
   */
  function renderStatChips(stats) {
    dom.statChips.innerHTML = "";
    stats.forEach((label) => {
      const chip = document.createElement("div");
      chip.className = "stat-chip";
      chip.textContent = label;
      dom.statChips.appendChild(chip);
    });
  }
  
  /**
   * Render a single award with simple animations.
   */
  function renderAward(award, index, total) {
    dom.ceremonyStage.classList.add("fade-in-up");
  
    dom.awardCategoryLabel.textContent = award.categoryLabel;
    dom.awardName.textContent = award.name;
  
    dom.awardWinnerTitle.textContent = award.winner.title;
    dom.awardWinnerSubtitle.textContent = award.winner.subtitle || "";
  
    dom.awardDescription.textContent = award.description;
    dom.awardExplanation.textContent = award.explanation || "";
  
    // Artwork
    dom.awardArtwork.innerHTML = "";
    if (award.artworkImageUrl) {
      const img = document.createElement("img");
      img.src = award.artworkImageUrl;
      img.alt = award.winner.title;
      dom.awardArtwork.appendChild(img);
    } else {
      // leave gradient background
    }
  
    dom.awardTagline.textContent = award.tagline || "Another side of your listening habits.";
  
    // Nominees
    if (award.nominees && award.nominees.length) {
      dom.nomineesCard.classList.remove("hidden");
      dom.nomineesList.innerHTML = "";
      award.nominees.forEach((nom, idx) => {
        const div = document.createElement("div");
        div.className = "nominee-item";
        div.innerHTML = `
          <div class="nominee-left">
            <div class="nominee-rank">${idx + 1}</div>
            <div>
              <div class="nominee-name">${nom.title}</div>
              <div class="nominee-meta">${nom.subtitle || ""}</div>
            </div>
          </div>
          ${
            nom.valueBadge
              ? `<span class="nominee-badge">${nom.valueBadge}</span>`
              : ""
          }
        `;
        dom.nomineesList.appendChild(div);
      });
    } else {
      dom.nomineesCard.classList.add("hidden");
    }
  
    dom.ceremonyMetaText.textContent = `Award ${index + 1} of ${total} • ${award.categoryLabel}`;
    setTimelineActive(index);
  
    // Trigger small confetti burst on each winner
    spawnConfettiBurst();
  
    // Award info toast
    showToast({
      title: award.name,
      text: award.explanation || "Based on your listening data.",
      durationMs: 6500,
    });
  
    setTimeout(() => dom.ceremonyStage.classList.remove("fade-in-up"), 500);
  }
  
  /**
   * Run the ceremony, revealing awards one by one.
   */
  async function runCeremonySequence() {
    if (!ceremonyState.awards.length) return;
    if (ceremonyState.running) return;
    ceremonyState.running = true;
    dom.replayBtn.disabled = true;
    dom.shareBtn.disabled = true;
    dom.downloadVideoBtn.disabled = true;
  
    const total = ceremonyState.awards.length;
    const delayBetween = 4300; // ms
  
    for (let i = 0; i < total; i++) {
      ceremonyState.currentIndex = i;
      renderAward(ceremonyState.awards[i], i, total);
      await new Promise((resolve) => setTimeout(resolve, delayBetween));
    }
  
    ceremonyState.running = false;
    dom.replayBtn.disabled = false;
    dom.shareBtn.disabled = false;
    dom.downloadVideoBtn.disabled = true; // keep disabled, feature stub
  
    showToast({
      title: "Ceremony complete",
      text: "Replay the ceremony or share your favorite highlight. Video export is coming soon.",
      durationMs: 8000,
    });
  }
  
  // ====== DEMO MODE (SAMPLE DATA WITHOUT LOGIN) ======
  
  /**
   * Lightweight sample data approximation for previewing without logging in.
   * This is intentionally small and fabricated.
   */
  function buildSampleData() {
    const now = Date.now();
    const mkTime = (offsetHours) => new Date(now - offsetHours * 3600 * 1000).toISOString();
  
    const sampleArtist = (id, name, followers, genres) => ({
      id,
      name,
      followers: { total: followers },
      genres,
      images: [
        {
          url: "https://images.pexels.com/photos/167092/pexels-photo-167092.jpeg?auto=compress&cs=tinysrgb&w=800",
        },
      ],
    });
  
    const sampleAlbum = (id, name, artistNames) => ({
      id,
      name,
      artists: artistNames.map((n) => ({ name: n })),
      images: [
        {
          url: "https://images.pexels.com/photos/1047442/pexels-photo-1047442.jpeg?auto=compress&cs=tinysrgb&w=800",
        },
      ],
    });
  
    const sampleTrack = (id, name, album, artistNames, durationMs) => ({
      id,
      name,
      album,
      artists: artistNames.map((n) => ({ name: n, id: n.toLowerCase().replace(/\s+/g, "-") })),
      duration_ms: durationMs,
    });
  
    const alb1 = sampleAlbum("alb1", "Golden Hour Drive", ["Neon Skyline"]);
    const alb2 = sampleAlbum("alb2", "Midnight City Lights", ["Cosmic Echo"]);
    const alb3 = sampleAlbum("alb3", "Lo‑Fi Study Sessions", ["Soft Focus"]);
  
    const t1 = sampleTrack("t1", "Lights on the Overpass", alb1, ["Neon Skyline"], 227000);
    const t2 = sampleTrack("t2", "Late Night Parcels", alb1, ["Neon Skyline"], 209000);
    const t3 = sampleTrack("t3", "Subway Windows", alb2, ["Cosmic Echo"], 188000);
    const t4 = sampleTrack("t4", "Rain on Canal Street", alb3, ["Soft Focus"], 205000);
    const t5 = sampleTrack("t5", "Coffee Shop Corner", alb3, ["Soft Focus"], 199000);
  
    const artist1 = sampleArtist("a1", "Neon Skyline", 78000, ["indie pop"]);
    const artist2 = sampleArtist("a2", "Cosmic Echo", 120000, ["synthwave"]);
    const artist3 = sampleArtist("a3", "Soft Focus", 9500, ["lo‑fi beats"]);
    const artist4 = sampleArtist("a4", "Faded Tapes", 2200, ["ambient"]);
    const artist5 = sampleArtist("a5", "Nightbus", 41000, ["electronic"]);
  
    const topTracksShort = [t1, t2, t3, t4, t5];
    const topTracksMedium = [t3, t1, t4, t5, t2];
    const topTracksLong = [t4, t3, t1, t5, t2];
  
    const topArtistsShort = [artist1, artist3, artist2, artist4, artist5];
    const topArtistsMedium = [artist2, artist1, artist3, artist5, artist4];
    const topArtistsLong = [artist3, artist2, artist1, artist4, artist5];
  
    const recentlyPlayed = [];
    const tracksForRecent = [t1, t3, t4, t5, t1, t1, t2, t3, t4, t1, t4, t4, t4, t2, t3, t5];
    tracksForRecent.forEach((track, idx) => {
      recentlyPlayed.push({
        track,
        played_at: mkTime(idx), // spread over last hours
      });
    });
  
    return {
      profile: {
        display_name: "Sample Listener",
        images: [],
        email: "sample@example.com",
        id: "sample",
      },
      topTracks: {
        short: topTracksShort,
        medium: topTracksMedium,
        long: topTracksLong,
      },
      topArtists: {
        short: topArtistsShort,
        medium: topArtistsMedium,
        long: topArtistsLong,
      },
      recentlyPlayed,
      audioFeaturesById: {},
    };
  }
  
  // ====== INIT & EVENT BINDINGS ======
  
  function bindEvents() {
    dom.loginBtn.addEventListener("click", triggerSpotifyLogin);
    dom.landingLoginBtn.addEventListener("click", triggerSpotifyLogin);
  
    dom.demoBtn.addEventListener("click", async () => {
      showLoading(true);
      try {
        const data = buildSampleData();
        await startCeremonyFlow(data, { isDemo: true });
      } catch (e) {
        console.error(e);
        alert("Failed to start demo ceremony.");
      } finally {
        showLoading(false);
      }
    });
  
    dom.logoutBtn.addEventListener("click", logout);
  
    dom.replayBtn.addEventListener("click", () => {
      resetCeremonyState();
      runCeremonySequence();
    });
  
    dom.shareBtn.addEventListener("click", () => {
      const url = window.location.href.split("#")[0];
      const msg = "Check out my Spotify Personalized Grammys ceremony.";
      if (navigator.share) {
        navigator
          .share({
            title: "My Spotify Personalized Grammys",
            text: msg,
            url,
          })
          .catch(() => {});
      } else {
        navigator.clipboard
          .writeText(url)
          .then(() =>
            showToast({
              title: "Link copied",
              text: "Ceremony link copied to your clipboard.",
              durationMs: 4000,
            })
          )
          .catch(() => {});
      }
    });
  
    dom.downloadVideoBtn.addEventListener("click", () => {
      showToast({
        title: "Video export (coming soon)",
        text: "In a future version, this button will generate a shareable ceremony video.",
        durationMs: 6000,
      });
    });
  }
  
  /**
   * Main ceremony entry: compute awards and start the sequence.
   */
  async function startCeremonyFlow(spotifyData, { isDemo = false } = {}) {
    ceremonyState.data = spotifyData;
    ceremonyState.profile = spotifyData.profile || null;
  
    dom.ceremonyContainer.style.display = "block";
    dom.landingOverlay.style.display = "none";
  
    if (ceremonyState.profile) {
      dom.ceremonyUserName.textContent = `${ceremonyState.profile.display_name || "Your"} Ceremony`;
      if (ceremonyState.profile.images && ceremonyState.profile.images[0]) {
        dom.navProfileImg.src = ceremonyState.profile.images[0].url;
        dom.navProfileImg.alt = ceremonyState.profile.display_name || "Profile";
        dom.navProfile.style.display = "flex";
      }
      dom.navProfileName.textContent =
        (ceremonyState.profile.display_name || ceremonyState.profile.id || "").slice(0, 25);
    }
  
    dom.logoutBtn.style.display = isDemo ? "none" : "inline-flex";
  
    const stats = buildStatSnapshot(spotifyData);
    renderStatChips(stats);
  
    const awards = computeAwards(spotifyData);
    ceremonyState.awards = awards;
    resetCeremonyState();
    renderTimeline(awards);
  
    dom.ceremonyMetaText.textContent = isDemo
      ? "Demo ceremony using sample data."
      : "Analyzing your data • awards are about to roll.";
  
    await new Promise((resolve) => setTimeout(resolve, 900));
    runCeremonySequence();
  }
  
  /**
   * Initialize app:
   *  - parse OAuth hash if present
   *  - fall back to stored token
   *  - otherwise show landing
   */
  async function init() {
    bindEvents();
  
    // 1) Check for OAuth callback
    const hashToken = parseSpotifyHash();
    if (hashToken) {
      // Clear hash from URL
      window.location.hash = "";
      storeToken(hashToken.accessToken, hashToken.expiresAt);
    }
  
    // 2) Check for stored token
    const stored = getStoredToken();
    if (!stored) {
      // No token; stay on landing state
      dom.ceremonyContainer.style.display = "none";
      dom.landingOverlay.style.display = "flex";
      dom.logoutBtn.style.display = "none";
      return;
    }
  
    // 3) We have a token, fetch data & start ceremony
    showLoading(true);
    try {
      const data = await fetchSpotifyStats(stored.token);
      await startCeremonyFlow(data, { isDemo: false });
    } catch (err) {
      console.error("Error fetching Spotify data:", err);
      showToast({
        title: "Spotify session expired",
        text: "We couldn’t read your stats. Please log in again with Spotify.",
        durationMs: 7000,
      });
      clearToken();
      dom.ceremonyContainer.style.display = "none";
      dom.landingOverlay.style.display = "flex";
    } finally {
      showLoading(false);
    }
  }
  
  // Run on load
  document.addEventListener("DOMContentLoaded", init);