'use strict';

// Dev: ?sim=tizen forces the Tizen code path in any desktop browser
if (new URLSearchParams(location.search).get('sim') === 'tizen') window.tizen = window.tizen || {};

// ── Config ────────────────────────────────────────────────────────────────────
const VERSION   = '1.0.0';
const BASE      = 'https://animevsub.app';
// Dedicated Worker for animevsub.app — separate from TizenPhim's worker and
// from the old tizenanime-proxy (which served the now-retired wibu47.vip source).
// See worker/proxy-avs.js — deploy it and paste your workers.dev URL here.
const CORS      = 'https://tizenanime-avs-proxy.nghiadhd.workers.dev/fetch?url=';
const HLS_PROXY = 'https://tizenanime-avs-proxy.nghiadhd.workers.dev/hls?url=';

// ── Catalog list ──────────────────────────────────────────────────────────────
// animevsub.app serves both listing feeds and genres as top-level slugs
// (/all/, /action/, ...). A few of the app's catalog ids differ from the
// site slug, so keep the mapping explicit rather than deriving `/${id}/`.
const CATALOG_PATHS = {
  'moi-nhat':      '/all/',
  'dang-chieu':    '/anime-dang-chieu/',
  'hoan-thanh':    '/anime-tron-bo/',
  'phim-le':       '/anime-le/',
  'action':        '/action/',
  'adventure':     '/adventure/',
  'comedy':        '/comedy/',
  'co-trang':      '/co-trang/',
  'dementia':      '/dementia/',
  'demons':        '/demons/',
  'drama':         '/drama/',
  'ecchi':         '/ecchi/',
  'fantasy':       '/fantasy/',
  'game':          '/game/',
  'harem':         '/harem/',
  'historical':    '/historical/',
  'horror':        '/horror/',
  'josei':         '/josei/',
  'kids':          '/kids/',
  'live-action':   '/live-action/',
  'mecha':         '/mecha/',
  'mystery':       '/mystery/',
  'romance':       '/romance/',
  'school':        '/school/',
  'supernatural':  '/supernatural/',
};

const CATALOGS = [
  { id: 'search',       name: 'Tìm Kiếm',    local: true },
  { id: 'continue',     name: 'Đang Xem',    local: true },
  { id: 'favorite',     name: 'Yêu Thích',   local: true },
  { id: 'moi-nhat',     name: 'Mới Nhất' },
  { id: 'dang-chieu',   name: 'Đang Chiếu' },
  { id: 'hoan-thanh',   name: 'Hoàn Thành' },
  { id: 'phim-le',      name: 'Phim Lẻ' },
  { id: 'action',       name: 'Action' },
  { id: 'adventure',    name: 'Adventure' },
  { id: 'comedy',       name: 'Comedy' },
  { id: 'co-trang',     name: 'Cổ Trang' },
  { id: 'dementia',     name: 'Dementia' },
  { id: 'demons',       name: 'Demons' },
  { id: 'drama',        name: 'Drama' },
  { id: 'ecchi',        name: 'Ecchi' },
  { id: 'fantasy',      name: 'Fantasy' },
  { id: 'game',         name: 'Game' },
  { id: 'harem',        name: 'Harem' },
  { id: 'historical',   name: 'Historical' },
  { id: 'horror',       name: 'Horror' },
  { id: 'josei',        name: 'Josei' },
  { id: 'kids',         name: 'Kids' },
  { id: 'live-action',  name: 'Live Action' },
  { id: 'mecha',        name: 'Mecha' },
  { id: 'mystery',      name: 'Mystery' },
  { id: 'romance',      name: 'Romance' },
  { id: 'school',       name: 'School' },
  { id: 'supernatural', name: 'Supernatural' },
];

const EP_COLS        = 6;
const HOME_GRID_COLS = 6; // cards per row in the home grid
const SEARCH_COLS    = 7; // more space since no sidebar

const HEART_SVG = '<svg class="heart-icon" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor">' +
  '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

// ── Key codes (standard + Tizen remote) ──────────────────────────────────────
const KEY = {
  UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13,
  BACK: 10009, ESC: 27, BACKSPACE: 8,
  PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252,
  STOP: 413, FF: 417, REW: 412,
};

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  screen: 'home',
  prevScreen: 'home',

  // Home — hero + overlay sidebar + rows + category grid
  hero: { item: null, meta: null, loading: false, zone: 'play' },
  homeRowZone: 'hero',      // 'sidebar' | 'hero' | 'row' | 'grid'
  homeSidebarFocus: 0,
  rows: [],
  rowFocusIndex: 0,
  homeMode: 'rows',         // 'rows' | 'category'
  catGrid: {
    catId: null, catName: '',
    items: [], page: 1, hasMore: false, loading: false, loadingMore: false, focus: 0,
    heroItem: null,
  },

  // Series
  series: null,
  focusEp: 0,
  seriesZone: 'eps',   // 'fav' | 'eps'

  // Search
  search: { query: '', items: [], loading: false, focus: -1, _debounce: null },

  // Player
  overlayTimer: null,
  currentVideoId: null,
  currentEpIdx: -1,
  currentStreamUrl: null,
  hls: null,
  playerZone: 'controls',        // 'seek' | 'controls'
  playerControlIndex: 1,
  playerSettingsOpen: false,
  playerSettingsFocus: 0,
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  registerTizenKeys();
  document.addEventListener('keydown', onKey);
  document.getElementById('btn-close-about').addEventListener('click', () => showHome());
  document.getElementById('search-input').addEventListener('input', e => {
    const q = e.target.value.trim();
    state.search.query = q;
    clearTimeout(state.search._debounce);
    if (!q) { state.search.items = []; renderSearch(); return; }
    state.search._debounce = setTimeout(() => doSearch(q), 500);
  });
  startApp();
});

async function startApp() {
  showScreen('loading');
  const vEl = document.querySelector('.loading-version');
  if (vEl) vEl.textContent = 'v' + VERSION;
  const aboutVer = document.getElementById('about-version');
  if (aboutVer) aboutVer.textContent = 'v' + VERSION;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[sw] register failed:', e.message));
  }

  // Launch the Tizen background service (segment proxy) if running on TV
  try {
    const pkgId = tizen.application.getCurrentApplication().appInfo.packageId;
    tizen.application.launch(pkgId + '.service', null, e => console.warn('[service] launch:', e?.message));
  } catch (_) {}

  showHome();
}

function registerTizenKeys() {
  try {
    ['MediaPlayPause','MediaPlay','MediaPause','MediaStop','MediaFastForward','MediaRewind']
      .forEach(k => tizen.tvinputdevice.registerKey(k));
  } catch (_) {}
}

// ── Remote log relay ─────────────────────────────────────────────────────────
function rlog(msg) {
  console.log(msg);
  fetch(HLS_PROXY, { method: 'POST', body: String(msg), headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
}

// ── CORS-proxy fetch ──────────────────────────────────────────────────────────
async function proxyFetch(url) {
  const res = await fetch(CORS + encodeURIComponent(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// ── HTML parsing ──────────────────────────────────────────────────────────────
// A film's slug is the first path segment of its top-level URL (https://host/<slug>/).
function slugFromHref(href) {
  return (href || '').replace(/^https?:\/\/[^/]+/, '').match(/^\/([^/?#]+)/)?.[1];
}

// animevsub.app blocks direct image hotlinking (unlike TizenPhim's phimimg.com),
// and its posters are .webp — both of which the TV webview can't load directly.
// Route them through the weserv image CDN, which fetches server-side and
// re-encodes to JPEG. Idempotent so it's safe on already-proxied/stored URLs.
function posterUrl(u) {
  if (!u) return '';
  if (u.indexOf('images.weserv.nl') !== -1) return u;
  return 'https://images.weserv.nl/?url=' + encodeURIComponent('ssl:' + u.replace(/^https?:\/\//i, '')) + '&output=jpg';
}

function parseCards(doc) {
  const items = [], seen = new Set();
  doc.querySelectorAll('.movie-item').forEach(card => {
    const link = card.querySelector('a.movie-link') || card.querySelector('.movie-title a');
    const slug = slugFromHref(link?.getAttribute('href'));
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    const name = (card.querySelector('.movie-title')?.textContent || '').trim();
    if (!name || name.length < 2) return;
    const img = card.querySelector('img');
    let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
    if (poster && !poster.startsWith('http')) poster = BASE + poster;
    items.push({ id: slug, name, poster: posterUrl(poster), type: 'series' });
  });
  return items;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
async function fetchCatalog(id, page = 1) {
  const path = CATALOG_PATHS[id];
  if (!path) return [];
  const url = `${BASE}${path}${page > 1 ? `page/${page}/` : ''}`;
  const html = await proxyFetch(url);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseCards(doc).slice(0, 24);
}

async function fetchMeta(slug) {
  const html = await proxyFetch(`${BASE}/${slug}/`);
  const doc  = new DOMParser().parseFromString(html, 'text/html');

  const rawTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim()
    || doc.querySelector('h1')?.textContent?.trim() || slug;
  // og:title is "<Name> Vietsub | Animevsub" — strip the site suffix.
  const name = rawTitle.replace(/\s*\|\s*Animevsub.*$/i, '').replace(/\s+Vietsub\s*$/i, '').trim() || slug;

  const poster      = posterUrl(doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '');
  const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

  const videos = [], seenEp = new Set();
  doc.querySelectorAll('.episodes-grid a.episode-item, a.episode-item').forEach(el => {
    const href  = el.getAttribute('href') || '';
    const epId  = href.match(/tap-(\d+)/)?.[1]
      || (el.querySelector('.episode-number')?.textContent || '').match(/\d+/)?.[0];
    if (!epId || seenEp.has(epId)) return;
    seenEp.add(epId);
    videos.push({ id: `${slug}:${epId}`, title: `Tập ${epId}`, episode: Number(epId) || 0 });
  });
  videos.sort((a, b) => a.episode - b.episode);
  if (!videos.length) videos.push({ id: `${slug}:1`, title: 'Tập 1', episode: 1 });

  return { id: slug, name, poster, description, videos };
}

async function fetchStream(slug, ep) {
  const watchUrl = `${BASE}/${slug}/tap-${ep}/`;
  console.log('[stream] watch url:', watchUrl);

  const html = await proxyFetch(watchUrl);
  console.log('[stream] watch page length:', html.length);

  // The watch page runs ArtPlayer + HLS.js and embeds its sources in a plain
  // inline array: `var all_sources = [ "https://.../index.m3u8" ];` (empty on
  // titles with no stream yet). Pull the first .m3u8 out of that array.
  const sourcesMatch = html.match(/all_sources\s*=\s*\[([\s\S]*?)\]/);
  const scope   = sourcesMatch ? sourcesMatch[1] : html;
  const m3u8Url = scope.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/)?.[0];
  if (!m3u8Url) {
    console.log('[stream] no m3u8 found on watch page (empty or missing)');
    return { externalUrl: watchUrl, name: 'AnimeVsub', title: `Tập ${ep}` };
  }
  rlog('m3u8 url: ' + m3u8Url);

  // Play the manifest directly — do NOT route it through the /hls worker. The
  // kkphimplayer* CDN sends permissive CORS (works from HLS.js cross-origin) and
  // its master playlist references sub-playlists/segments by *relative* path, so
  // proxying the manifest would break their resolution. The worker also can't
  // fetch this CDN anyway (it 404s Cloudflare Worker egress).
  return { url: m3u8Url, name: 'AnimeVsub', title: `Tập ${ep} · HLS` };
}


// ── Screen switcher ───────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  state.screen = name;
}

// ── About screen ──────────────────────────────────────────────────────────────
function showAbout() {
  showScreen('about');
  setTimeout(() => document.getElementById('btn-close-about').focus(), 50);
}

// ── Search screen ─────────────────────────────────────────────────────────────
function showSearch(reset = true) {
  if (reset) {
    state.search.query = '';
    state.search.items = [];
    state.search.loading = false;
    state.search.focus = -1;
    clearTimeout(state.search._debounce);
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
  }
  state.prevScreen = state.screen;
  showScreen('search');
  renderSearch();
  setTimeout(() => document.getElementById('search-input')?.focus(), 80);
}

async function fetchSearch(query) {
  const url = `${BASE}/?s=${encodeURIComponent(query)}`;
  const html = await proxyFetch(url);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseCards(doc).slice(0, 42);
}

async function doSearch(query) {
  if (!query || state.search.query !== query) return;
  state.search.loading = true;
  state.search.items = [];
  state.search.focus = -1;
  renderSearch();
  try {
    const items = await fetchSearch(query);
    if (state.search.query !== query) return;
    state.search.items = items;
  } catch (_) {}
  state.search.loading = false;
  renderSearch();
}

function renderSearch() {
  const { items, loading, focus, query } = state.search;
  const el = document.getElementById('search-results');
  if (!el) return;

  const wrap = document.getElementById('search-input-wrap');
  if (wrap) wrap.classList.toggle('focused', focus === -1);

  if (loading && !items.length) {
    el.classList.add('is-spinner');
    el.innerHTML = '<div class="spinner"></div>';
  } else if (!items.length) {
    el.classList.remove('is-spinner');
    el.innerHTML = `<div class="grid-hint">${query ? 'Không tìm thấy kết quả' : 'Nhập tên anime để tìm kiếm'}</div>`;
  } else {
    el.classList.remove('is-spinner');
    el.innerHTML = items.map((item, i) =>
      `<div class="card ${i === focus ? 'focused' : ''}">
        <div class="card-poster" style="background-image:url('${escHtml(item.poster || '')}')"></div>
        <div class="card-title">${escHtml(item.name)}</div>
      </div>`
    ).join('');
    requestAnimationFrame(() => {
      const fc = el.querySelector('.card.focused');
      if (fc) fc.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
}

function handleSearch(k) {
  const { items, focus } = state.search;

  if (focus === -1) {
    if (k === KEY.DOWN && items.length) {
      state.search.focus = 0;
      document.getElementById('search-input').blur();
      renderSearch();
      return true;
    }
    // LEFT is the reliable escape here — on real Tizen hardware the physical
    // Back button can be swallowed by the platform (keyboard-dismiss handling)
    // while a native <input> has focus, so BACK/ESC alone isn't dependable.
    if (k === KEY.BACK || k === KEY.ESC || k === KEY.LEFT) { showHome(); return true; }
    return false;
  }

  const max = items.length - 1;
  const col = focus % SEARCH_COLS;
  const row = Math.floor(focus / SEARCH_COLS);

  if (k === KEY.UP) {
    if (row === 0) {
      state.search.focus = -1;
      document.getElementById('search-input').focus();
      renderSearch();
      return true;
    }
    state.search.focus = Math.max(0, focus - SEARCH_COLS);
  } else if (k === KEY.DOWN) {
    state.search.focus = Math.min(max, focus + SEARCH_COLS);
  } else if (k === KEY.LEFT) {
    if (col === 0) { showHome(); return true; }
    state.search.focus--;
  } else if (k === KEY.RIGHT) {
    if (focus >= max) return false;
    state.search.focus++;
  } else if (k === KEY.ENTER) {
    const item = items[focus];
    if (item) { state.prevScreen = 'search'; showSeries(item.id); }
    return true;
  } else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    state.search.focus = -1;
    document.getElementById('search-input').focus();
    renderSearch();
    return true;
  } else {
    return false;
  }

  renderSearch();
  return true;
}

// ── Home screen (hero + overlay sidebar + rows + category grid) ─────────────
const HERO_SOURCE_CAT = 'moi-nhat';
const HOME_SIDEBAR_ALL_IDS = ['home-nav-home', 'home-search-btn', 'home-nav-continue', 'home-nav-favorite', 'home-nav-latest', 'home-nav-genre'];
const LOCAL_BUILDERS = { continue: buildContinueWatching, favorite: buildFavorites };

function showHome() {
  showScreen('home');
  if (!state.rows.length) {
    state.rows = buildHomeRows();
    renderHomeRows();
  }
  if (!state.hero.item && !state.hero.loading) loadHomeHero();
  renderHomeScreen();
}

async function loadHomeHero() {
  state.hero.loading = true;
  renderHomeScreen();
  try {
    const items = await fetchCatalog(HERO_SOURCE_CAT, 1);
    state.hero.item = items[0] || null;
    // The HERO_SOURCE_CAT row is pre-marked loading:true (not queued through
    // ensureRowLoaded) specifically so this same fetch can resolve it too,
    // instead of firing a redundant second request for identical data.
    const heroRow = state.rows.find(r => r.catId === HERO_SOURCE_CAT);
    if (heroRow && !heroRow.loaded) {
      heroRow.items   = items;
      heroRow.loading = false;
      heroRow.loaded  = true;
      heroRow.hasMore = items.length >= 12;
      renderHomeRow(heroRow);
    }
    if (state.hero.item) {
      try { state.hero.meta = await fetchMeta(state.hero.item.id); } catch (_) { state.hero.meta = null; }
    }
  } catch (_) {}
  state.hero.loading = false;
  renderHomeScreen();
}

function getDisplayedHeroItem() {
  if (state.homeMode === 'category') {
    const g = state.catGrid;
    if (state.homeRowZone === 'grid' && g.items[g.focus]) {
      // Sticks so that jumping back to hero (BACK / UP-at-top) keeps showing
      // whatever card was last focused, instead of resetting to items[0].
      g.heroItem = g.items[g.focus];
    }
    return g.heroItem || g.items[0] || null;
  }
  if (state.homeRowZone === 'row') {
    const row = state.rows[state.rowFocusIndex];
    if (row && row.loaded && row.items[row.focus]) {
      // Same stickiness for rows mode: keep the last-hovered row item as the
      // hero content once focus moves away from the row, so Play/Info act on
      // the film the user was actually looking at.
      state.hero.item = row.items[row.focus];
    }
  }
  return state.hero.item;
}

function getHomeSidebarIds() {
  const ids = ['home-nav-home', 'home-search-btn'];
  const continueRow = state.rows.find(r => r.catId === 'continue');
  if (continueRow && continueRow.items.length) ids.push('home-nav-continue');
  const favRow = state.rows.find(r => r.catId === 'favorite');
  if (favRow && favRow.items.length) ids.push('home-nav-favorite');
  ids.push('home-nav-latest', 'home-nav-genre');
  return ids;
}

function renderHomeSidebar() {
  const ids = getHomeSidebarIds();
  HOME_SIDEBAR_ALL_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden', ids.indexOf(id) === -1);
    el.classList.remove('focused');
  });
  const sidebarEl = document.getElementById('home-sidebar');
  if (sidebarEl) sidebarEl.classList.toggle('expanded', state.homeRowZone === 'sidebar');
  if (state.homeRowZone === 'sidebar') {
    const activeId = ids[state.homeSidebarFocus];
    const el = activeId && document.getElementById(activeId);
    if (el) el.classList.add('focused');
  }
}

function updateHomeSectionVisibility() {
  const rowsEl = document.getElementById('home-rows');
  const gridEl = document.getElementById('home-catgrid');
  const isCategory = state.homeMode === 'category';
  if (rowsEl) rowsEl.classList.toggle('hidden', isCategory);
  if (gridEl) gridEl.classList.toggle('hidden', !isCategory);
}

function renderHomeScreen() {
  renderHomeSidebar();
  updateHomeSectionVisibility();

  const item      = getDisplayedHeroItem();
  const backdrop  = document.getElementById('home-hero-backdrop');
  const title     = document.getElementById('home-hero-title');
  const desc      = document.getElementById('home-hero-desc');
  const playBtn   = document.getElementById('home-hero-play');
  const infoBtn   = document.getElementById('home-hero-info');
  const loadingEl = document.getElementById('home-hero-loading');

  const heroLoading = state.homeMode === 'category'
    ? (state.catGrid.loading && !state.catGrid.items.length)
    : state.hero.loading;
  if (loadingEl) loadingEl.classList.toggle('hidden', !heroLoading);

  if (item) {
    if (backdrop) backdrop.style.backgroundImage = `url('${escHtml(item.poster || '')}')`;
    if (title) title.textContent = item.name || '';
    // Only the global featured item has a fetched description (state.hero.meta) —
    // row/grid-focused cards don't carry one without an extra fetch per keypress.
    if (desc) desc.textContent = (item === state.hero.item && state.hero.meta?.description) || '';
  } else {
    if (backdrop) backdrop.style.backgroundImage = '';
    if (title) title.textContent = '';
    if (desc) desc.textContent = '';
  }

  if (playBtn) playBtn.classList.toggle('focused', state.homeRowZone === 'hero' && state.hero.zone === 'play');
  if (infoBtn) infoBtn.classList.toggle('focused', state.homeRowZone === 'hero' && state.hero.zone === 'info');
}

function handleHomeScreen(k) {
  // BACK steps back one level at a time within a category page: from the grid it
  // jumps to that page's own hero first (handled in handleHomeCategoryGridKey);
  // only pressing BACK again once already at the hero exits the category page.
  if ((k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) && state.homeMode === 'category' && state.homeRowZone === 'hero') {
    exitCategoryGrid();
    return true;
  }
  if (state.homeRowZone === 'sidebar') return handleHomeSidebarKey(k);
  if (state.homeRowZone === 'hero')    return handleHomeHeroKey(k);
  if (state.homeRowZone === 'grid')    return handleHomeCategoryGridKey(k);
  return handleHomeRowKey(k);
}

function handleHomeSidebarKey(k) {
  const ids = getHomeSidebarIds();
  if (k === KEY.RIGHT) {
    state.homeRowZone = 'hero';
  } else if (k === KEY.UP) {
    state.homeSidebarFocus = Math.max(0, state.homeSidebarFocus - 1);
  } else if (k === KEY.DOWN) {
    state.homeSidebarFocus = Math.min(ids.length - 1, state.homeSidebarFocus + 1);
  } else if (k === KEY.ENTER) {
    activateHomeSidebarIcon(ids[state.homeSidebarFocus]);
    return true;
  } else { return false; }
  renderHomeScreen();
  return true;
}

function activateHomeSidebarIcon(id) {
  if (id === 'home-nav-home') {
    state.homeMode = 'rows';
    const scrollEl = document.getElementById('home-scroll');
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    state.homeRowZone = 'hero';
    renderHomeScreen();
  } else if (id === 'home-search-btn') {
    showSearch();
  } else if (id === 'home-nav-continue') {
    openCategoryGrid('continue');
  } else if (id === 'home-nav-favorite') {
    openCategoryGrid('favorite');
  } else if (id === 'home-nav-latest') {
    openCategoryGrid('moi-nhat');
  } else if (id === 'home-nav-genre') {
    openCategoryGrid('action');
  }
}

function handleHomeHeroKey(k) {
  if (k === KEY.RIGHT) {
    state.hero.zone = 'info';
  } else if (k === KEY.LEFT) {
    if (state.hero.zone === 'info') { state.hero.zone = 'play'; }
    else { state.homeRowZone = 'sidebar'; }
  } else if (k === KEY.UP) {
    state.homeRowZone = 'sidebar';
  } else if (k === KEY.DOWN) {
    if (state.homeMode === 'category') {
      if (!state.catGrid.items.length) return false;
      state.homeRowZone = 'grid';
      renderHomeScreen();
      renderCategoryGrid();
      return true;
    }
    if (!state.rows.length) return false;
    enterHomeRowZone(0);
    return true;
  } else if (k === KEY.ENTER) {
    const item = getDisplayedHeroItem();
    if (!item) return true;
    state.prevScreen = 'home';
    showSeries(item.id, state.hero.zone === 'play');
    return true;
  } else { return false; }
  renderHomeScreen();
  return true;
}

function handleHomeRowKey(k) {
  const i   = state.rowFocusIndex;
  const row = state.rows[i];
  if (!row) return false;

  if (k === KEY.UP) {
    if (i === 0) {
      state.homeRowZone = 'hero';
      updateHomeRowShellFocus(i);
      updateHomeRowCardFocus(i, null, false);
      renderHomeScreen();
    } else {
      moveHomeRowFocus(i - 1);
    }
    return true;
  }
  if (k === KEY.DOWN) {
    if (i >= state.rows.length - 1) return false;
    moveHomeRowFocus(i + 1);
    return true;
  }
  if (k === KEY.LEFT) {
    if (!row.loaded || row.focus <= 0) {
      state.homeRowZone = 'sidebar';
      updateHomeRowShellFocus(i);
      updateHomeRowCardFocus(i, null, false);
      renderHomeScreen();
      return true;
    }
    const oldFocus = row.focus;
    row.focus--;
    updateGridFocus(document.getElementById(`home-row-track-${i}`), oldFocus, row.focus, true);
    renderHomeScreen();
    return true;
  }
  if (k === KEY.RIGHT) {
    if (!row.loaded) return false;
    const maxFocus = row.items.length - 1 + (row.hasMore ? 1 : 0);
    if (row.focus >= maxFocus) return false;
    const oldFocus = row.focus;
    row.focus++;
    updateGridFocus(document.getElementById(`home-row-track-${i}`), oldFocus, row.focus, true);
    renderHomeScreen();
    return true;
  }
  if (k === KEY.ENTER) {
    if (!row.loaded) return true;
    if (row.hasMore && row.focus === row.items.length) { loadMoreHomeRow(row); return true; }
    const item = row.items[row.focus];
    if (item) { state.prevScreen = 'home'; showSeries(item.id); }
    return true;
  }
  if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    // Quick jump to the hero from any row depth — the hero is already always
    // visible (sticky), so this is purely a focus move, no scrolling involved.
    state.homeRowZone = 'hero';
    updateHomeRowShellFocus(i);
    updateHomeRowCardFocus(i, null, false);
    renderHomeScreen();
    return true;
  }
  return false;
}

function enterHomeRowZone(index) {
  state.homeRowZone   = 'row';
  state.rowFocusIndex = index;
  ensureRowLoaded(state.rows[index]);
  renderHomeScreen();
  updateHomeRowShellFocus(index);
  updateHomeRowCardFocus(null, index, true);
  scrollHomeRowIntoView(index);
}

function moveHomeRowFocus(newIndex) {
  const oldIndex = state.rowFocusIndex;
  state.rowFocusIndex = newIndex;
  ensureRowLoaded(state.rows[newIndex]);
  updateHomeRowShellFocus(oldIndex);
  updateHomeRowShellFocus(newIndex);
  updateHomeRowCardFocus(oldIndex, newIndex, true);
  renderHomeScreen();
  scrollHomeRowIntoView(newIndex);
}

function updateHomeRowShellFocus(i) {
  const shellEl = document.querySelector(`.home-row[data-row-index="${i}"]`);
  if (shellEl) shellEl.classList.toggle('focused', state.homeRowZone === 'row' && state.rowFocusIndex === i);
}

// Row-aware wrapper around the updateGridFocus pattern: updateGridFocus itself only
// handles a single container, but moving focus between rows means blurring a card in
// one row's track and focusing a card in a *different* row's track. Pass null for
// either side when there's nothing to blur/focus on that side (e.g. entering/leaving
// row zone entirely).
function updateHomeRowCardFocus(oldRowIndex, newRowIndex, marquee) {
  if (oldRowIndex != null) {
    const oldRow = state.rows[oldRowIndex];
    if (oldRow && oldRow.loaded) {
      const oldTrack = document.getElementById(`home-row-track-${oldRowIndex}`);
      const oldCard  = oldTrack && oldTrack.children[oldRow.focus];
      if (oldCard) { oldCard.classList.remove('focused'); stopCardMarquee(oldCard); }
    }
  }
  if (newRowIndex != null) {
    const newRow = state.rows[newRowIndex];
    if (newRow && newRow.loaded) {
      const newTrack = document.getElementById(`home-row-track-${newRowIndex}`);
      const newCard  = newTrack && newTrack.children[newRow.focus];
      if (newCard) {
        newCard.classList.add('focused');
        requestAnimationFrame(() => {
          newCard.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          if (marquee) marqueeTitle(newCard);
        });
      }
    }
  }
}

function scrollHomeRowIntoView(i) {
  const shellEl = document.querySelector(`.home-row[data-row-index="${i}"]`);
  if (shellEl) requestAnimationFrame(() => shellEl.scrollIntoView({ block: 'nearest' }));
}

function buildHomeRows() {
  const rows = [];
  CATALOGS.forEach(cat => {
    if (cat.id === 'search') return;
    if (LOCAL_BUILDERS[cat.id]) {
      const items = LOCAL_BUILDERS[cat.id]();
      if (!items.length) return;
      rows.push({ catId: cat.id, catName: cat.name, isLocal: true, items, loading: false, loaded: true, focus: 0, page: 1, hasMore: false });
    } else {
      const isHeroSource = cat.id === HERO_SOURCE_CAT;
      rows.push({ catId: cat.id, catName: cat.name, isLocal: false, items: [], loading: isHeroSource, loaded: false, focus: 0, page: 1, hasMore: false });
    }
  });
  return rows;
}

function renderHomeRows() {
  const el = document.getElementById('home-rows');
  if (!el) return;
  el.innerHTML = state.rows.map((row, i) => `
    <div class="home-row" data-row-index="${i}">
      <div class="home-row-title">${escHtml(row.catName)}</div>
      <div class="home-row-track" id="home-row-track-${i}"></div>
    </div>`).join('');
  state.rows.forEach((row, i) => renderHomeRowTrack(row, i));
  observeHomeRows();
}

function renderHomeRow(row) {
  const i = state.rows.indexOf(row);
  if (i === -1) return;
  renderHomeRowTrack(row, i);
  if (row.loaded && _homeRowObserver) {
    const el = document.querySelector(`.home-row[data-row-index="${i}"]`);
    if (el) _homeRowObserver.unobserve(el);
  }
  if (state.homeRowZone === 'row' && state.rowFocusIndex === i) renderHomeScreen();
}

function renderHomeRowTrack(row, i) {
  const track = document.getElementById(`home-row-track-${i}`);
  if (!track) return;
  const isFocusedRow = state.homeRowZone === 'row' && state.rowFocusIndex === i;

  if (!row.loaded) {
    track.innerHTML = new Array(6).fill(0).map(() =>
      '<div class="card"><div class="card-poster loading-card"></div><div class="card-title">&nbsp;</div></div>'
    ).join('');
    return;
  }

  const cardsHtml = row.items.map((m, ci) => `
    <div class="card ${isFocusedRow && ci === row.focus ? 'focused' : ''}">
      <div class="card-poster" style="background-image:url('${escHtml(m.poster || '')}')"></div>
      <div class="card-title">${escHtml(m.name)}</div>
    </div>`).join('');

  const loadMoreIdx  = row.items.length;
  const loadMoreHtml = row.hasMore
    ? `<div class="card card-load-more ${isFocusedRow && loadMoreIdx === row.focus ? 'focused' : ''}">
        <div class="card-load-more-icon">${row.loadingMore ? '…' : '+'}</div>
        <div class="card-title">Tải thêm</div>
      </div>`
    : '';

  track.innerHTML = cardsHtml + loadMoreHtml;

  if (isFocusedRow) {
    requestAnimationFrame(() => {
      const fc = track.querySelector('.card.focused');
      if (fc) { fc.scrollIntoView({ block: 'nearest', inline: 'nearest' }); marqueeTitle(fc); }
    });
  }
}

let _homeRowObserver = null;
let _activeRowFetches = 0;
const MAX_CONCURRENT_ROW_FETCHES = 3;
let _pendingRowFetches = [];

function ensureRowLoaded(row) {
  if (!row || row.loaded || row.loading) return;
  row.loading = true;
  _pendingRowFetches.push(row);
  _drainRowFetchQueue();
}

function _drainRowFetchQueue() {
  while (_activeRowFetches < MAX_CONCURRENT_ROW_FETCHES && _pendingRowFetches.length) {
    const row = _pendingRowFetches.shift();
    _activeRowFetches++;
    fetchCatalog(row.catId, 1)
      .then(items => { row.items = items; row.hasMore = items.length >= 12; })
      .catch(() => { row.items = []; row.hasMore = false; })
      .then(() => {
        row.loading = false;
        row.loaded  = true;
        _activeRowFetches--;
        renderHomeRow(row);
        _drainRowFetchQueue();
      });
  }
}

async function loadMoreHomeRow(row) {
  if (row.isLocal || !row.hasMore || row.loadingMore) return;
  row.loadingMore = true;
  const i = state.rows.indexOf(row);
  renderHomeRowTrack(row, i);
  try {
    const more = await fetchCatalog(row.catId, row.page + 1);
    row.items   = row.items.concat(more);
    row.page++;
    row.hasMore = more.length >= 12;
  } catch (_) {
    row.hasMore = false;
  }
  row.loadingMore = false;
  renderHomeRowTrack(row, i);
}

function observeHomeRows() {
  if (_homeRowObserver) { _homeRowObserver.disconnect(); }
  if (!window.IntersectionObserver) {
    state.rows.forEach(row => ensureRowLoaded(row));
    return;
  }
  const root = document.getElementById('home-scroll');
  _homeRowObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const idx = Number(entry.target.getAttribute('data-row-index'));
      const row = state.rows[idx];
      if (row) ensureRowLoaded(row);
    });
  }, { root, rootMargin: '0px 0px 900px 0px' });

  document.querySelectorAll('.home-row').forEach(el => {
    const idx = Number(el.getAttribute('data-row-index'));
    const row = state.rows[idx];
    if (row && !row.loaded) _homeRowObserver.observe(el);
  });
}

// ── Home screen — category grid pages ────────────────────────────────────────
function openCategoryGrid(catId) {
  const cat = CATALOGS.find(c => c.id === catId);
  if (!cat) return;
  state.homeMode    = 'category';
  state.homeRowZone = 'hero';
  state.catGrid = {
    catId: cat.id, catName: cat.name,
    items: [], page: 1, hasMore: false, loading: true, loadingMore: false, focus: 0,
    heroItem: null,
  };
  const scrollEl = document.getElementById('home-scroll');
  if (scrollEl) scrollEl.scrollTo({ top: 0 });
  renderHomeScreen();
  renderCategoryGrid();
  loadCategoryGrid();
}

function exitCategoryGrid() {
  state.homeMode    = 'rows';
  state.homeRowZone = 'hero';
  renderHomeScreen();
}

async function loadCategoryGrid() {
  const g = state.catGrid;
  if (LOCAL_BUILDERS[g.catId]) {
    g.items   = LOCAL_BUILDERS[g.catId]();
    g.hasMore = false;
    g.loading = false;
    renderHomeScreen();
    renderCategoryGrid();
    return;
  }
  try {
    const items = await fetchCatalog(g.catId, g.page);
    g.items   = g.items.concat(items);
    g.hasMore = items.length >= 12;
  } catch (_) {}
  g.loading = false;
  renderHomeScreen();
  renderCategoryGrid();
}

async function loadMoreCategoryGrid() {
  const g = state.catGrid;
  if (g.loading || g.loadingMore || !g.hasMore) return;
  g.loadingMore = true;
  g.page++;
  renderCategoryGrid();
  try {
    const more = await fetchCatalog(g.catId, g.page);
    g.items   = g.items.concat(more);
    g.hasMore = more.length >= 12;
  } catch (_) {}
  g.loadingMore = false;
  renderCategoryGrid();
}

function renderCategoryGrid() {
  const g       = state.catGrid;
  const titleEl = document.getElementById('home-catgrid-title');
  const gridEl  = document.getElementById('home-catgrid-items');
  if (!gridEl) return;
  if (titleEl) titleEl.textContent = g.catName || '';

  const inGrid   = state.homeRowZone === 'grid';
  const maxFocus = g.items.length - 1 + (g.hasMore ? 1 : 0);
  if (maxFocus >= 0 && g.focus > maxFocus) g.focus = maxFocus;

  if (g.loading && !g.items.length) {
    gridEl.innerHTML = new Array(12).fill(0).map(() =>
      '<div class="card"><div class="card-poster loading-card"></div><div class="card-title">&nbsp;</div></div>'
    ).join('');
    return;
  }

  const cardsHtml = g.items.map((m, i) => `
    <div class="card ${inGrid && i === g.focus ? 'focused' : ''}">
      <div class="card-poster" style="background-image:url('${escHtml(m.poster || '')}')"></div>
      <div class="card-title">${escHtml(m.name)}</div>
    </div>`).join('');

  const loadMoreIdx  = g.items.length;
  const loadMoreHtml = g.hasMore
    ? `<div class="card card-load-more ${inGrid && loadMoreIdx === g.focus ? 'focused' : ''}">
        <div class="card-load-more-icon">${g.loadingMore ? '…' : '+'}</div>
        <div class="card-title">Tải thêm</div>
      </div>`
    : '';

  gridEl.innerHTML = cardsHtml + loadMoreHtml;

  requestAnimationFrame(() => {
    const fc = gridEl.querySelector('.card.focused');
    if (fc) { fc.scrollIntoView({ block: 'nearest', inline: 'nearest' }); marqueeTitle(fc); }
  });
}

function handleHomeCategoryGridKey(k) {
  const g     = state.catGrid;
  const items = g.items;
  const totalCount = items.length + (g.hasMore ? 1 : 0);
  const max   = totalCount - 1;
  const cols  = HOME_GRID_COLS;
  const col   = g.focus % cols;
  const row   = Math.floor(g.focus / cols);

  if (max < 0) return false;

  const oldFocus = g.focus;
  let focusOnly  = false;

  if (k === KEY.UP) {
    if (row === 0) {
      state.homeRowZone = 'hero';
      renderHomeScreen();
      return true;
    }
    g.focus = Math.max(0, g.focus - cols);
    focusOnly = true;
  } else if (k === KEY.DOWN) {
    const next = g.focus + cols;
    if (next > max) return false;
    g.focus = next;
    focusOnly = true;
  } else if (k === KEY.LEFT) {
    if (col === 0) {
      state.homeRowZone = 'sidebar';
      renderHomeScreen();
      return true;
    }
    g.focus--;
    focusOnly = true;
  } else if (k === KEY.RIGHT) {
    if (g.focus >= max) return false;
    g.focus++;
    focusOnly = true;
  } else if (k === KEY.ENTER) {
    if (g.hasMore && g.focus === items.length) { loadMoreCategoryGrid(); return true; }
    const item = items[g.focus];
    if (item) { state.prevScreen = 'home'; showSeries(item.id); }
    return true;
  } else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    // Quick jump to this category page's own hero from any grid depth — mirrors
    // the row-list version. handleHomeScreen only exits the category page on a
    // second BACK once already at the hero, so this doesn't skip a level.
    state.homeRowZone = 'hero';
    renderHomeScreen();
    return true;
  } else { return false; }

  if (focusOnly) {
    updateGridFocus(document.getElementById('home-catgrid-items'), oldFocus, g.focus, true);
    renderHomeScreen();
  }
  return true;
}

// Auto-scroll (marquee) a focused card's title when it's too long to fit.
function marqueeTitle(card) {
  if (!card) return;
  const title = card.querySelector('.card-title');
  if (!title || !title.animate) return;
  if (title.scrollWidth - title.clientWidth <= 2) return;
  const text = title.innerHTML;
  title.innerHTML = `<span class="card-title-scroll"><span class="cts-piece">${text}</span><span class="cts-piece" aria-hidden="true">${text}</span></span>`;
  const scroll = title.firstChild;
  const pieces = scroll.querySelectorAll('.cts-piece');
  const shift  = pieces[1].offsetLeft - pieces[0].offsetLeft;
  if (shift <= 2) return;
  const dur = Math.max(9000, shift * 70);
  // Fixed 2s pause before scrolling starts, regardless of title length/duration
  // (a flat offset fraction like 0.35 would stretch the pause out on long titles).
  const startOffset = 2000 / dur;
  scroll.animate([
    { transform: 'translateX(0)',        offset: 0 },
    { transform: 'translateX(0)',        offset: startOffset },
    { transform: `translateX(${-shift}px)`, offset: 0.85 },
    { transform: `translateX(${-shift}px)`, offset: 1    },
  ], { duration: dur, iterations: Infinity, easing: 'linear' });
}

function stopCardMarquee(card) {
  const title  = card && card.querySelector('.card-title');
  const scroll = title && title.querySelector('.card-title-scroll');
  if (!scroll) return;
  const piece = scroll.querySelector('.cts-piece');
  // Collapsing back to plain text discards the animated node (and with it
  // the running Web Animation), instead of leaving it playing forever on a
  // card that's no longer focused.
  title.innerHTML = piece ? piece.innerHTML : title.textContent;
}

function updateGridFocus(containerEl, oldIndex, newIndex, marquee) {
  const cards = containerEl.children;
  if (cards[oldIndex]) {
    cards[oldIndex].classList.remove('focused');
    stopCardMarquee(cards[oldIndex]);
  }
  const nc = cards[newIndex];
  if (nc) {
    nc.classList.add('focused');
    requestAnimationFrame(() => {
      nc.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (marquee) marqueeTitle(nc);
    });
  }
}

// ── Series screen ─────────────────────────────────────────────────────────────
async function showSeries(slug, autoplay = false) {
  showScreen('series');
  document.getElementById('series-content').innerHTML = '<div class="loading-msg"><div class="spinner"></div></div>';

  try {
    const meta = await fetchMeta(slug);
    state.series  = meta;
    state.focusEp = 0;
    state.seriesZone = 'eps';
    recordLocalMeta(slug, meta.name, meta.poster);

    const history = JSON.parse(localStorage.getItem('watchHistory') || '{}');
    if (history[slug]) {
      const idx = (meta.videos || []).findIndex(v => v.id.endsWith(':' + history[slug].ep));
      if (idx >= 0) state.focusEp = idx;
    }

    renderSeries();
    if (autoplay && meta.videos && meta.videos[state.focusEp]) playEpisode(state.focusEp);
  } catch (e) {
    document.getElementById('series-content').innerHTML =
      `<div class="error-msg">Không tải được nội dung.<br>${escHtml(e.message)}</div>`;
  }
}

function renderSeries() {
  const meta    = state.series;
  const videos  = meta.videos || [];
  const slug    = meta.id;
  const history = JSON.parse(localStorage.getItem('watchHistory') || '{}');
  const lastEp  = history[slug]?.ep;

  const epGrid = videos.map((v, i) => {
    const epId     = v.id.split(':').pop();
    const isCurrent = String(epId) === String(lastEp);
    const isFocused = i === state.focusEp;
    return `<div class="ep-card ${isCurrent ? 'current-ep' : ''} ${isFocused ? 'focused' : ''}" data-idx="${i}">
      ${escHtml(v.title)}
    </div>`;
  }).join('');

  document.getElementById('series-content').innerHTML = `
    <div class="series-back">← Quay lại  •  <span>${escHtml(meta.name)}</span></div>
    <div class="series-layout">
      <div class="series-poster" style="background-image:url('${escHtml(meta.poster || '')}')"></div>
      <div class="series-meta">
        <div class="series-title">${escHtml(meta.name)}</div>
        <div class="series-desc">${escHtml(meta.description || '')}</div>
        ${lastEp ? `<div class="series-resume">▶ Tiếp tục từ Tập ${escHtml(lastEp)}</div>` : ''}
        <div class="fav-btn ${state.seriesZone === 'fav' ? 'focused' : ''} ${isFavorite(slug) ? 'active' : ''}">${HEART_SVG}${isFavorite(slug) ? 'Đã Thích' : 'Yêu Thích'}</div>
        <div class="ep-section-title">Danh sách tập (${videos.length})</div>
        <div class="episodes-grid" id="episodes-grid">${epGrid}</div>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const focused = document.querySelector('.ep-card.focused');
    if (focused) focused.scrollIntoView({ block: 'nearest' });
  });
}

// ── Player ────────────────────────────────────────────────────────────────────
const BUFFER_PRESETS = {
  low:    { label: 'Thấp (tiết kiệm dữ liệu)', maxBufferLength: 20,  maxMaxBufferLength: 40,  maxBufferSize: 30  * 1000 * 1000, fragLoadingMaxRetry: 4,  manifestLoadingMaxRetry: 3, levelLoadingMaxRetry: 3 },
  normal: { label: 'Bình thường',              maxBufferLength: 60,  maxMaxBufferLength: 120, maxBufferSize: 90  * 1000 * 1000, fragLoadingMaxRetry: 8,  manifestLoadingMaxRetry: 6, levelLoadingMaxRetry: 6 },
  high:   { label: 'Cao (mạng yếu/chập chờn)',  maxBufferLength: 120, maxMaxBufferLength: 240, maxBufferSize: 180 * 1000 * 1000, fragLoadingMaxRetry: 10, manifestLoadingMaxRetry: 8, levelLoadingMaxRetry: 8 },
};
const BUFFER_LEVEL_ORDER = ['low', 'normal', 'high'];

function getBufferLevel() {
  try {
    const v = localStorage.getItem('tizenanime_bufferLevel');
    if (v && BUFFER_PRESETS[v]) return v;
  } catch (_) {}
  return 'normal';
}

function setBufferLevel(level) {
  try { localStorage.setItem('tizenanime_bufferLevel', level); } catch (_) {}
}

async function playEpisode(epIdx) {
  const videos = state.series?.videos || [];
  const video  = videos[epIdx];
  if (!video) return;

  state.currentEpIdx   = epIdx;
  state.focusEp         = epIdx;
  state.currentVideoId = video.id;

  const [slug, ep] = video.id.split(':');
  recordLocalWatch(slug, ep);

  showScreen('player');
  const titleEl = document.getElementById('player-title');
  if (titleEl) titleEl.textContent = `${state.series?.name || ''} — ${video.title}`;
  const seekFillEl   = document.getElementById('seek-fill');
  const seekHandleEl = document.getElementById('seek-handle');
  const timeEl       = document.getElementById('player-time');
  if (seekFillEl)   seekFillEl.style.width  = '0%';
  if (seekHandleEl) seekHandleEl.style.left = '0%';
  if (timeEl) timeEl.textContent = '0:00 / 0:00';
  setPlayPauseIcon(true);
  const nextEpBtn = document.getElementById('player-next-ep');
  if (nextEpBtn) nextEpBtn.classList.toggle('hidden', epIdx >= videos.length - 1);
  const endHintEl = document.getElementById('player-end-hint');
  if (endHintEl) endHintEl.classList.add('hidden');
  showBuffering(false);
  state.playerZone         = 'controls';
  state.playerControlIndex = 1;
  renderPlayerFocus();
  showOverlayPersistent();

  try {
    const stream = await fetchStream(slug, ep);
    if (!stream.url && stream.externalUrl) {
      showPlayerError('Không tìm thấy stream để phát trực tiếp.');
      return;
    }
    startPlayback(stream.url, 0);
  } catch (e) {
    console.error('[stream] error:', e);
    showPlayerError('Lỗi: ' + e.message);
  }
}

function showBuffering(show) {
  const el = document.getElementById('player-buffering');
  if (el) el.classList.toggle('hidden', !show);
}

function showEndOfContent() {
  showOverlayPersistent();
  const endHintEl = document.getElementById('player-end-hint');
  if (endHintEl) endHintEl.classList.remove('hidden');
}

function handleVideoEnded() {
  const videos = state.series?.videos || [];
  const next   = state.currentEpIdx + 1;
  if (next < videos.length) playNext();
  else showEndOfContent();
}

function setPlayPauseIcon(isPlaying) {
  const btn = document.getElementById('player-playpause');
  if (btn) btn.innerHTML = isPlaying ? '&#10074;&#10074;' : '&#9654;';
}

function togglePlayPause(video) {
  if (!video) return;
  if (video.paused) { video.play().catch(() => {}); setPlayPauseIcon(true); }
  else { video.pause(); setPlayPauseIcon(false); }
}

function getPlayerControlIds() {
  const ids = ['player-rew', 'player-playpause', 'player-ff', 'player-settings'];
  const nextBtn = document.getElementById('player-next-ep');
  if (nextBtn && !nextBtn.classList.contains('hidden')) ids.push('player-next-ep');
  return ids;
}

function movePlayerControlFocus(delta) {
  const ids = getPlayerControlIds();
  const max = ids.length - 1;
  state.playerControlIndex = Math.max(0, Math.min(max, state.playerControlIndex + delta));
  renderPlayerFocus();
}

function activateFocusedPlayerControl(video) {
  const ids = getPlayerControlIds();
  const id  = ids[state.playerControlIndex];
  if (id === 'player-rew') {
    if (video) { video.currentTime = Math.max(0, video.currentTime - 10); updatePlayerBar(); }
  } else if (id === 'player-playpause') {
    togglePlayPause(video);
  } else if (id === 'player-ff') {
    if (video) { video.currentTime += 10; updatePlayerBar(); }
  } else if (id === 'player-settings') {
    openPlayerSettings();
  } else if (id === 'player-next-ep') {
    playNext();
  }
}

function renderPlayerFocus() {
  const seekBarEl = document.querySelector('.seek-bar');
  if (seekBarEl) seekBarEl.classList.toggle('focused', state.playerZone === 'seek');

  ['player-rew', 'player-playpause', 'player-ff', 'player-settings', 'player-next-ep'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('focused');
  });
  if (state.playerZone === 'controls') {
    const ids = getPlayerControlIds();
    const activeId = ids[state.playerControlIndex];
    const el = activeId && document.getElementById(activeId);
    if (el) el.classList.add('focused');
  }
}

function openPlayerSettings() {
  const idx = BUFFER_LEVEL_ORDER.indexOf(getBufferLevel());
  state.playerSettingsFocus = idx >= 0 ? idx : 1;
  state.playerSettingsOpen  = true;
  renderPlayerSettings();
}

function closePlayerSettings() {
  state.playerSettingsOpen = false;
  const overlay = document.getElementById('player-settings-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function renderPlayerSettings() {
  const overlay = document.getElementById('player-settings-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  const current = getBufferLevel();
  overlay.innerHTML = `
    <div class="settings-box">
      <div class="settings-title">Bộ đệm (Buffer)</div>
      ${BUFFER_LEVEL_ORDER.map((level, i) => {
        const preset = BUFFER_PRESETS[level];
        return `<div class="settings-option${i === state.playerSettingsFocus ? ' focused' : ''}${level === current ? ' active' : ''}">
          <span>${escHtml(preset.label)}</span>
          <span class="settings-option-check">&#10003;</span>
        </div>`;
      }).join('')}
    </div>`;
}

function handlePlayerSettings(k) {
  if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    closePlayerSettings();
    return true;
  }
  if (k === KEY.UP) {
    state.playerSettingsFocus = Math.max(0, state.playerSettingsFocus - 1);
    renderPlayerSettings();
    return true;
  }
  if (k === KEY.DOWN) {
    state.playerSettingsFocus = Math.min(BUFFER_LEVEL_ORDER.length - 1, state.playerSettingsFocus + 1);
    renderPlayerSettings();
    return true;
  }
  if (k === KEY.ENTER) {
    const level = BUFFER_LEVEL_ORDER[state.playerSettingsFocus];
    if (level) applyBufferLevelLive(level);
    closePlayerSettings();
    return true;
  }
  return false;
}

const MEDIA_ERROR_LABELS = {
  1: 'MEDIA_ERR_ABORTED (bị hủy)',
  2: 'MEDIA_ERR_NETWORK (lỗi mạng)',
  3: 'MEDIA_ERR_DECODE (lỗi giải mã)',
  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED (định dạng/nguồn không hỗ trợ)',
};

function showPlayerError(msg) {
  const el = document.getElementById('player-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  console.error('[TizenAnime player]', msg);
}

function hidePlayerError() {
  const el = document.getElementById('player-error');
  if (el) el.classList.add('hidden');
}

function startPlayback(url, resumeTime) {
  const video = document.getElementById('video');
  if (!video) return;

  if (state.hls) { state.hls.destroy(); state.hls = null; }
  state.currentStreamUrl = url;
  hidePlayerError();

  video.ontimeupdate = updatePlayerBar;
  video.onended      = handleVideoEnded;
  video.onloadedmetadata = () => {
    if (resumeTime && resumeTime > 5 && video.duration && resumeTime < video.duration - 2) {
      try { video.currentTime = resumeTime; } catch (_) {}
    }
  };
  video.onwaiting = () => showBuffering(true);
  video.onplaying = () => { showBuffering(false); hidePlayerError(); };
  video.oncanplay = () => showBuffering(false);
  video.onerror = () => {
    const code = video.error?.code;
    const msg  = video.error?.message || '';
    showPlayerError(`Không phát được video (${MEDIA_ERROR_LABELS[code] || 'lỗi không rõ #' + code})`);
    rlog('video error code=' + code + ' msg=' + msg + ' url=' + String(url).substring(0, 80));
  };

  const preset = BUFFER_PRESETS[getBufferLevel()] || BUFFER_PRESETS.normal;

  function attemptPlay() {
    const p = video.play();
    if (p && p.catch) p.catch(err => showPlayerError('Không thể tự phát: ' + (err?.message || String(err))));
  }

  // These streams' manifests carry #EXT-X-DISCONTINUITY (spliced/re-encoded
  // segments), which native HLS decoders — Safari/AVFoundation and Tizen's AVPlay
  // — reject outright even when canPlayType() claims support (verified on TizenPhim,
  // the sibling app proven on the TV). hls.js's software remuxer tolerates them, so
  // use it everywhere and never fall back to the native player. video.src is only a
  // last resort for the (Tizen-unlikely) case where MSE/hls.js is unavailable.
  if (window.Hls && window.Hls.isSupported()) {
    state.hls = new window.Hls({
      maxBufferLength: preset.maxBufferLength,
      maxMaxBufferLength: preset.maxMaxBufferLength,
      maxBufferSize: preset.maxBufferSize,
      fragLoadingMaxRetry: preset.fragLoadingMaxRetry,
      fragLoadingRetryDelay: 1000,
      manifestLoadingMaxRetry: preset.manifestLoadingMaxRetry,
      levelLoadingMaxRetry: preset.levelLoadingMaxRetry,
    });
    state.hls.loadSource(url);
    state.hls.attachMedia(video);
    state.hls.on(window.Hls.Events.MANIFEST_PARSED, attemptPlay);
    let mediaRecoveries = 0, netReloads = 0;
    state.hls.on(window.Hls.Events.ERROR, (_evt, data) => {
      if (!data || !data.fatal) return;
      const H = window.Hls;
      // Media errors (bufferAppendError, bufferStalledError, decode glitches) are
      // often transient — flush and re-append within hls.js's software pipeline
      // rather than switching to the native player (which can't handle these).
      if (data.type === H.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
        mediaRecoveries++;
        rlog('hls media error, recovering #' + mediaRecoveries + ': ' + data.details);
        state.hls.recoverMediaError();
        return;
      }
      // Fatal network error after the configured retries — try one reload pass.
      if (data.type === H.ErrorTypes.NETWORK_ERROR && netReloads < 2) {
        netReloads++;
        rlog('hls network error, reloading #' + netReloads + ': ' + data.details);
        state.hls.startLoad();
        return;
      }
      showPlayerError(`Lỗi phát HLS (${data.type}): ${data.details || 'không rõ'}`);
      rlog('hls fatal error: ' + data.type + ' ' + data.details);
    });
  } else {
    video.src = url;
    video.load();
    attemptPlay();
  }
  showOverlay();
}

function applyBufferLevelLive(level) {
  setBufferLevel(level);
  const video = document.getElementById('video');
  if (!video || !state.hls || !state.currentStreamUrl) return;
  const resumeAt  = video.currentTime || 0;
  const wasPaused = video.paused;
  startPlayback(state.currentStreamUrl, resumeAt);
  if (wasPaused) {
    setTimeout(() => { const v = document.getElementById('video'); if (v) { v.pause(); setPlayPauseIcon(false); } }, 300);
  }
}

function stopPlayback() {
  const video = document.getElementById('video');
  if (video) {
    video.src = '';
    video.ontimeupdate = null; video.onended = null; video.onloadedmetadata = null;
    video.onwaiting = null; video.onplaying = null; video.oncanplay = null; video.onerror = null;
  }
  if (state.hls) { state.hls.destroy(); state.hls = null; }
  showBuffering(false);
  closePlayerSettings();
  clearTimeout(state.overlayTimer);
}

function playNext() {
  const videos = state.series?.videos || [];
  const next   = state.currentEpIdx + 1;
  if (next < videos.length) playEpisode(next);
}

function updatePlayerBar() {
  const video = document.getElementById('video');
  if (!video || !video.duration) return;
  const fmt = t => {
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  };
  const pct = (video.currentTime / video.duration) * 100;
  const timeEl       = document.getElementById('player-time');
  const seekFillEl   = document.getElementById('seek-fill');
  const seekHandleEl = document.getElementById('seek-handle');
  if (timeEl)       timeEl.textContent   = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  if (seekFillEl)   seekFillEl.style.width  = pct + '%';
  if (seekHandleEl) seekHandleEl.style.left = pct + '%';
}

function showOverlay() {
  const overlay = document.getElementById('player-overlay');
  if (!overlay) return;
  overlay.classList.add('visible');
  clearTimeout(state.overlayTimer);
  state.overlayTimer = setTimeout(() => overlay.classList.remove('visible'), 3500);
}

function showOverlayPersistent() {
  clearTimeout(state.overlayTimer);
  const overlay = document.getElementById('player-overlay');
  if (overlay) overlay.classList.add('visible');
}

// ── Watch history ─────────────────────────────────────────────────────────────
function recordLocalWatch(slug, ep) {
  try {
    const h = JSON.parse(localStorage.getItem('watchHistory') || '{}');
    h[slug] = { ...h[slug], ep, ts: Date.now() };
    localStorage.setItem('watchHistory', JSON.stringify(h));
  } catch (_) {}
}

function recordLocalMeta(slug, name, poster) {
  try {
    const h = JSON.parse(localStorage.getItem('watchHistory') || '{}');
    if (h[slug]) { h[slug].name = name; h[slug].poster = poster; }
    localStorage.setItem('watchHistory', JSON.stringify(h));
  } catch (_) {}
}

// ── Favorites ─────────────────────────────────────────────────────────────────
function getFavorites() {
  try { return JSON.parse(localStorage.getItem('tizenanime_favorites') || '{}'); } catch (_) { return {}; }
}

function isFavorite(slug) {
  return !!getFavorites()[slug];
}

function toggleFavorite(slug, name, poster) {
  if (!slug) return false;
  try {
    const f = getFavorites();
    if (f[slug]) {
      delete f[slug];
      localStorage.setItem('tizenanime_favorites', JSON.stringify(f));
      syncLocalRow('favorite');
      return false;
    }
    f[slug] = { slug, name, poster, ts: Date.now() };
    localStorage.setItem('tizenanime_favorites', JSON.stringify(f));
    syncLocalRow('favorite');
    return true;
  } catch (_) { return false; }
}

function buildFavorites() {
  const f = getFavorites();
  return Object.keys(f)
    .map(slug => f[slug])
    .filter(v => v && v.name)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 40)
    .map(v => ({ id: v.slug, name: v.name, poster: v.poster || '', type: 'series' }));
}

// Position a to-be-inserted local row so state.rows keeps the order buildHomeRows()
// would have produced, by counting how many earlier CATALOGS entries have a row.
function homeRowInsertIndex(catId) {
  const targetIdx = CATALOGS.findIndex(c => c.id === catId);
  let insertAt = 0;
  for (let i = 0; i < targetIdx; i++) {
    const c = CATALOGS[i];
    if (c.id === 'search') continue;
    if (state.rows.some(r => r.catId === c.id)) insertAt++;
  }
  return insertAt;
}

// Refresh a local (favorite / continue-watching) row in place, or create+insert it
// if buildHomeRows() skipped it at startup (the list was empty then) but it now has
// items. Shared by favorite add/remove so the home row updates live.
function syncLocalRow(catId) {
  if (!LOCAL_BUILDERS[catId]) return;
  const items = LOCAL_BUILDERS[catId]();
  const row = state.rows.find(r => r.catId === catId);
  if (row) {
    row.items = items;
    if (row.focus > row.items.length - 1) row.focus = Math.max(0, row.items.length - 1);
    renderHomeRow(row);
  } else if (items.length) {
    const cat = CATALOGS.find(c => c.id === catId);
    if (!cat) return;
    const insertAt = homeRowInsertIndex(catId);
    state.rows.splice(insertAt, 0, {
      catId: cat.id, catName: cat.name, isLocal: true, items,
      loading: false, loaded: true, focus: 0, page: 1, hasMore: false,
    });
    // Inserting shifts every row's index (data-row-index / #home-row-track-N),
    // so rowFocusIndex must be adjusted to keep pointing at the same row.
    if (state.rowFocusIndex >= insertAt) state.rowFocusIndex++;
    renderHomeRows();
  }
  renderHomeSidebar();
}

function buildContinueWatching() {
  const h = JSON.parse(localStorage.getItem('watchHistory') || '{}');
  return Object.entries(h)
    .filter(([, v]) => v.name)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, 20)
    .map(([slug, v]) => ({
      id: slug, name: v.name, poster: v.poster || '', type: 'series',
      description: `Tập ${v.ep}`,
    }));
}

// ── Key handler ───────────────────────────────────────────────────────────────
function onKey(e) {
  const k      = e.keyCode;
  const screen = state.screen;

  if (state.playerSettingsOpen) { if (handlePlayerSettings(k)) e.preventDefault(); return; }

  if (screen === 'about')  { if (handleAbout(k))       e.preventDefault(); return; }
  if (screen === 'home')   { if (handleHomeScreen(k))  e.preventDefault(); return; }
  if (screen === 'search') { if (handleSearch(k))  e.preventDefault(); return; }
  if (screen === 'series') { if (handleSeries(k))  e.preventDefault(); return; }
  if (screen === 'player') { if (handlePlayer(k))  e.preventDefault(); return; }
}

function handleAbout(k) {
  if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE || k === KEY.ENTER) {
    showHome();
    return true;
  }
  return false;
}

function getEpGridCols() {
  const cards = document.querySelectorAll('#episodes-grid .ep-card');
  if (!cards.length) return EP_COLS;
  const firstTop = cards[0].offsetTop;
  let cols = 0;
  for (const card of cards) {
    if (card.offsetTop !== firstTop) break;
    cols++;
  }
  return cols || EP_COLS;
}

function handleSeries(k) {
  const videos = state.series?.videos || [];
  const max    = videos.length - 1;
  const epCols = getEpGridCols();

  if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    if (state.prevScreen === 'search') showSearch(false);
    else showHome();
    return true;
  }

  if (state.seriesZone === 'fav') {
    if (k === KEY.DOWN) { state.seriesZone = 'eps'; state.focusEp = 0; }
    else if (k === KEY.ENTER) {
      toggleFavorite(state.series.id, state.series.name, state.series.poster);
    } else { return false; }
    renderSeries();
    return true;
  }

  if (k === KEY.UP) {
    if (Math.floor(state.focusEp / epCols) === 0) state.seriesZone = 'fav';
    else state.focusEp = Math.max(0, state.focusEp - epCols);
  }
  else if (k === KEY.DOWN)  state.focusEp = Math.min(max, state.focusEp + epCols);
  else if (k === KEY.LEFT)  state.focusEp = Math.max(0, state.focusEp - 1);
  else if (k === KEY.RIGHT) state.focusEp = Math.min(max, state.focusEp + 1);
  else if (k === KEY.ENTER) { playEpisode(state.focusEp); return true; }
  else return false;

  renderSeries();
  return true;
}

function handlePlayer(k) {
  const video = document.getElementById('video');

  if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE || k === KEY.STOP) {
    stopPlayback();
    if (state.series) { showScreen('series'); renderSeries(); }
    else showHome();
    return true;
  }

  showOverlay();

  // Dedicated hardware transport buttons always work, regardless of focus zone.
  if (k === KEY.PLAY || k === KEY.PAUSE || k === KEY.PLAYPAUSE) {
    togglePlayPause(video);
    return true;
  }
  if (k === KEY.FF) {
    if (video) { video.currentTime += 10; updatePlayerBar(); }
    return true;
  }
  if (k === KEY.REW) {
    if (video) { video.currentTime = Math.max(0, video.currentTime - 10); updatePlayerBar(); }
    return true;
  }

  const inSeekZone = state.playerZone === 'seek';

  if (k === KEY.LEFT) {
    if (inSeekZone) { if (video) { video.currentTime = Math.max(0, video.currentTime - 10); updatePlayerBar(); } }
    else movePlayerControlFocus(-1);
    return true;
  }
  if (k === KEY.RIGHT) {
    if (inSeekZone) { if (video) { video.currentTime += 10; updatePlayerBar(); } }
    else movePlayerControlFocus(1);
    return true;
  }
  if (k === KEY.UP) {
    if (!inSeekZone) { state.playerZone = 'seek'; renderPlayerFocus(); }
    return true;
  }
  if (k === KEY.DOWN) {
    if (inSeekZone) { state.playerZone = 'controls'; renderPlayerFocus(); }
    return true;
  }
  if (k === KEY.ENTER) {
    if (inSeekZone) togglePlayPause(video);
    else activateFocusedPlayerControl(video);
    return true;
  }

  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
