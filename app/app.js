'use strict';

// Dev: ?sim=tizen forces the Tizen code path in any desktop browser
if (new URLSearchParams(location.search).get('sim') === 'tizen') window.tizen = window.tizen || {};

// ── Config ────────────────────────────────────────────────────────────────────
const VERSION   = '1.0.23';
const BASE      = 'https://wibu47.vip';
const CORS      = 'https://tizenanime-proxy.nghiadhd.workers.dev/fetch?url=';
// Cloudflare Worker that forwards requests with a custom Referer header.
// See worker/proxy.js — deploy it and paste your workers.dev URL here.
const HLS_PROXY = 'https://tizenanime-proxy.nghiadhd.workers.dev/';

// ── Catalog list ──────────────────────────────────────────────────────────────
const CATALOG_PATHS = {
  'moi-nhat':   '/',
  'anime':      '/the-loai/anime',
  'hanh-dong':  '/the-loai/hanh-dong',
  'hai-huoc':   '/the-loai/hai-huoc',
  'tinh-cam':   '/the-loai/tinh-cam',
  'harem':      '/the-loai/harem',
  'bi-an':      '/the-loai/bi-an',
  'bi-kich':    '/the-loai/bi-kich',
  'gia-tuong':  '/the-loai/gia-tuong',
  'doi-thuong': '/the-loai/doi-thuong',
  'phieu-luu':  '/the-loai/phieu-luu',
  'sieu-nhien': '/the-loai/sieu-nhien',
  'sieu-nang-luc': '/the-loai/sieu-nang-luc',
  'hoc-duong':  '/the-loai/hoc-duong',
  'vo-thuat':   '/the-loai/vo-thuat',
  'tro-choi':   '/the-loai/tro-choi',
  'tham-tu':    '/the-loai/tham-tu',
  'lich-su':    '/the-loai/lich-su',
  'shounen':    '/the-loai/shounen',
  'am-nhac':    '/the-loai/am-nhac',
  'mecha':      '/the-loai/mecha',
  'quan-doi':   '/the-loai/quan-doi',
  'drama':      '/the-loai/drama',
  'psychological': '/the-loai/psychological',
  'seinen':     '/the-loai/seinen',
  'shoujo':     '/the-loai/shoujo',
  'the-thao':   '/the-loai/the-thao',
  'kinh-di':    '/the-loai/kinh-di',
  'vien-tuong': '/the-loai/vien-tuong',
  'ecchi':      '/the-loai/ecchi',
  'demon':      '/the-loai/demon',
  'khoa-huyen': '/the-loai/khoa-huyen',
  '2025':       '/season/2025',
  '2024':       '/season/2024',
};

const CATALOGS = [
  { id: 'search',    name: 'Tìm Kiếm',    local: true },
  { id: 'continue',   name: 'Đang Xem',    local: true },
  { id: 'moi-nhat',   name: 'Mới Nhất' },
  { id: '2025',       name: 'Năm 2025' },
  { id: '2024',       name: 'Năm 2024' },
  { id: 'anime',      name: 'Anime' },
  { id: 'hanh-dong',  name: 'Hành Động' },
  { id: 'hai-huoc',   name: 'Hài Hước' },
  { id: 'tinh-cam',   name: 'Tình Cảm' },
  { id: 'harem',      name: 'Harem' },
  { id: 'bi-an',      name: 'Bí Ẩn' },
  { id: 'bi-kich',    name: 'Bi Kịch' },
  { id: 'gia-tuong',  name: 'Giả Tưởng' },
  { id: 'doi-thuong', name: 'Đời Thường' },
  { id: 'phieu-luu',  name: 'Phiêu Lưu' },
  { id: 'sieu-nhien', name: 'Siêu Nhiên' },
  { id: 'sieu-nang-luc', name: 'Siêu Năng Lực' },
  { id: 'hoc-duong',  name: 'Học Đường' },
  { id: 'vo-thuat',   name: 'Võ Thuật' },
  { id: 'tro-choi',   name: 'Trò Chơi' },
  { id: 'tham-tu',    name: 'Thám Tử' },
  { id: 'lich-su',    name: 'Lịch Sử' },
  { id: 'shounen',    name: 'Shounen' },
  { id: 'shoujo',     name: 'Shoujo' },
  { id: 'seinen',     name: 'Seinen' },
  { id: 'the-thao',   name: 'Thể Thao' },
  { id: 'am-nhac',    name: 'Âm Nhạc' },
  { id: 'mecha',      name: 'Mecha' },
  { id: 'quan-doi',   name: 'Quân Đội' },
  { id: 'drama',      name: 'Drama' },
  { id: 'psychological', name: 'Psychological' },
  { id: 'kinh-di',    name: 'Kinh Dị' },
  { id: 'vien-tuong', name: 'Viễn Tưởng' },
  { id: 'ecchi',      name: 'Ecchi' },
  { id: 'demon',      name: 'Demon' },
  { id: 'khoa-huyen', name: 'Khoa Huyễn' },
];

const EP_COLS        = 6;
const HOME_GRID_COLS = 6; // cards per row in the home grid
const SEARCH_COLS    = 7; // more space since no sidebar

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

  // Home — sidebar + grid
  homeZone: 'sidebar',   // 'sidebar' | 'grid'
  sidebarFocus: 1,       // index into CATALOGS (0 = search, 1 = Đang Xem)
  grid: {
    catId: null, catName: '',
    items: [], page: 1, hasMore: false, loading: false, focus: 0,
  },

  // Series
  series: null,
  focusEp: 0,

  // Search
  search: { query: '', items: [], loading: false, focus: -1, _debounce: null },

  // Player
  overlayTimer: null,
  currentVideoId: null,
};

// ── Viewport scaling (FHD / 4K / desktop) ────────────────────────────────────
// App is authored at 1920×1080. Scale body to fill the screen while keeping
// the 16:9 coordinate space intact (letterbox/pillarbox if aspect differs).
function scaleToViewport() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  document.body.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  scaleToViewport();
  window.addEventListener('resize', scaleToViewport);
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
  const sidebarVer = document.getElementById('sidebar-version');
  if (sidebarVer) sidebarVer.textContent = 'v' + VERSION;
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
function parseCards(doc) {
  const items = [], seen = new Set();
  doc.querySelectorAll('a[href*="/phim/"]').forEach(el => {
    const href = el.getAttribute('href') || '';
    if (href.includes('/xem-phim/')) return;
    const slug = href.match(/\/phim\/([^/?#]+)/)?.[1];
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    const card = el.closest('article, li') || el.parentElement || el;
    const nameEl = card.querySelector('h2,h3,h4,[class*="title"],[class*="name"]');
    const name = nameEl?.textContent?.trim() || el.getAttribute('title') || el.textContent.trim() || '';
    if (!name || name.length < 2) return;
    const img = card.querySelector('img');
    let poster = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
    if (poster && !poster.startsWith('http')) poster = BASE + poster;
    items.push({ id: slug, name, poster, type: 'series' });
  });
  return items;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
async function fetchCatalog(id, page = 1) {
  const path = CATALOG_PATHS[id];
  if (!path) return [];
  const url = `${BASE}${path}${page > 1 ? `?page=${page}` : ''}`;
  const html = await proxyFetch(url);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseCards(doc).slice(0, 24);
}

async function fetchMeta(slug) {
  const html = await proxyFetch(`${BASE}/phim/${slug}`);
  const doc  = new DOMParser().parseFromString(html, 'text/html');

  let name = '';
  try {
    const ld = doc.querySelector('script[type="application/ld+json"]')?.textContent;
    if (ld) name = JSON.parse(ld).name || '';
  } catch {}
  if (!name) name = doc.querySelector('h1')?.textContent?.trim() || slug;

  const poster      = (doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '').replace(/^http:/, 'https:');
  const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

  const epIds = new Set();
  doc.querySelectorAll('a[href*="/xem-phim/"]').forEach(el => {
    const m = el.getAttribute('href')?.match(/\/xem-phim\/[^/]+\/([^/?#]+)$/);
    if (m) epIds.add(m[1]);
  });

  try {
    const wh  = await proxyFetch(`${BASE}/xem-phim/${slug}/1`);
    const wd  = new DOMParser().parseFromString(wh, 'text/html');
    wd.querySelectorAll('a[href*="/xem-phim/"]').forEach(el => {
      const m = el.getAttribute('href')?.match(/\/xem-phim\/[^/]+\/([^/?#]+)$/);
      if (m) epIds.add(m[1]);
    });
  } catch (_) {}

  const now        = Date.now();
  const numericEps = [...epIds].filter(e => /^\d+$/.test(e)).map(Number).sort((a, b) => a - b);
  const otherEps   = [...epIds].filter(e => !/^\d+$/.test(e)).sort();
  const videos     = [];
  const maxNumeric = numericEps.length ? numericEps[numericEps.length - 1] : 0;
  numericEps.forEach(ep => videos.push({
    id: `${slug}:${ep}`, title: `Tập ${ep}`, episode: ep,
    released: new Date(now - (maxNumeric - ep) * 86400000).toISOString(),
  }));
  otherEps.forEach((epId, i) => videos.push({
    id: `${slug}:${epId}`, title: epId, episode: numericEps.length + i + 1,
    released: new Date(now - (maxNumeric + i + 1) * 86400000).toISOString(),
  }));
  if (!videos.length) videos.push({ id: `${slug}:1`, title: 'Tập 1', episode: 1, released: new Date(now).toISOString() });

  return { id: slug, name, poster, description, videos };
}

async function fetchStream(slug, ep) {
  const watchUrl = `${BASE}/xem-phim/${slug}/${ep}`;
  console.log('[stream] watch url:', watchUrl);

  const html = await proxyFetch(watchUrl);
  console.log('[stream] watch page length:', html.length);

  const vproMatch = html.match(/var\s+VPRO\s*=\s*["'](https?:\/\/(embed\d+\.streamc\.xyz)\/embed\.php\?hash=([^"']+))["']/);
  console.log('[stream] VPRO match:', vproMatch ? vproMatch[1] : 'NONE — no VPRO variable found in page');

  if (vproMatch) {
    const [, embedUrl, embedHost] = vproMatch;
    console.log('[stream] fetching embed:', embedUrl);
    const embedHtml = await proxyFetch(embedUrl);
    console.log('[stream] embed page length:', embedHtml.length);

    const obfMatch = embedHtml.match(/data-obf="([^"]+)"/);
    console.log('[stream] data-obf found:', !!obfMatch);
    if (!obfMatch) throw new Error('no data-obf attribute in embed page');

    let outerJson;
    try {
      outerJson = JSON.parse(atob(obfMatch[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
      throw new Error('data-obf base64 decode failed: ' + e.message);
    }
    rlog('obf keys: ' + Object.keys(outerJson).join(', '));
    rlog('obf json: ' + JSON.stringify(outerJson).substring(0, 300));

    if (!outerJson.sUb) throw new Error('data-obf missing sUb; keys: ' + Object.keys(outerJson).join(', '));
    const m3u8Url = `https://${embedHost}/${outerJson.sUb}.m3u8`;
    rlog('m3u8 url: ' + m3u8Url);

    const streamUrl = HLS_PROXY
      + '?url=' + encodeURIComponent(m3u8Url)
      + '&ref=' + encodeURIComponent(embedUrl)
      + '&rewrite=1';
    rlog('stream url: ' + streamUrl.substring(0, 100));
    return { url: streamUrl, name: 'Wibu47', title: `Tập ${ep} · HLS` };
  }

  console.log('[stream] no VPRO — falling back to external url');
  return { externalUrl: watchUrl, name: 'Wibu47', title: `Tập ${ep}` };
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
  const url = `${BASE}/tim-kiem/?keyword=${encodeURIComponent(query)}`;
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
    if (k === KEY.BACK || k === KEY.ESC) { showHome(); return true; }
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
    if (col === 0) return false;
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

// ── Home screen ───────────────────────────────────────────────────────────────
let _sidebarDebounce = null;

function showHome() {
  showScreen('home');
  if (!state.grid.catId) loadHomeGrid(CATALOGS[state.sidebarFocus]);
  else renderHome();
}

function renderHome() {
  const home = document.getElementById('screen-home');
  if (home) home.classList.toggle('sidebar-collapsed', state.homeZone === 'grid');
  renderSidebar();
  renderHomeGrid();
}

function renderHomeGrid() {
  const { catName, items, loading, page, hasMore } = state.grid;
  const maxFocus = items.length + (hasMore ? 1 : 0) - 1;
  if (maxFocus >= 0 && state.grid.focus > maxFocus) state.grid.focus = maxFocus;
  let focus = state.grid.focus;
  if (focus < 0) focus = 0;
  document.getElementById('home-cat-name').textContent  = catName || '';
  document.getElementById('home-page-info').textContent = hasMore || page > 1 ? `Trang ${page}` : '';

  const el = document.getElementById('home-grid');
  const loadingOverlay = document.getElementById('home-loading');

  if (!state.grid.catId && !loading) {
    loadingOverlay?.classList.add('hidden');
    el.innerHTML = '<div class="grid-hint">← Chọn thể loại</div>';
    return;
  }
  if (loading && !items.length) {
    loadingOverlay?.classList.remove('hidden');
    el.innerHTML = '';
    return;
  }
  loadingOverlay?.classList.add('hidden');

  const inGrid = state.homeZone === 'grid';
  const cardsHtml = items.map((item, i) =>
    `<div class="card ${inGrid && i === focus ? 'focused' : ''}">
      <div class="card-poster" style="background-image:url('${escHtml(item.poster || '')}')"></div>
      <div class="card-title">${escHtml(item.name)}</div>
    </div>`
  ).join('');

  const loadMoreIdx = items.length;
  const loadMoreHtml = hasMore
    ? `<div class="card card-load-more ${inGrid && loadMoreIdx === focus ? 'focused' : ''}">
      <div class="card-load-more-icon">+</div>
      <div class="card-title">Tải thêm</div>
    </div>`
    : '';

  el.innerHTML = cardsHtml + loadMoreHtml + (loading ? '<div class="grid-loading"><div class="spinner" style="width:48px;height:48px;border-width:5px"></div></div>' : '');

  requestAnimationFrame(() => {
    const fc = el.querySelector('.card.focused');
    if (fc) fc.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

async function loadHomeGrid(cat) {
  if (cat.id === 'search') return;
  state.grid = { catId: cat.id, catName: cat.name, items: [], page: 1, hasMore: false, loading: true, focus: 0 };
  renderHome();
  try {
    const items = cat.local ? buildContinueWatching() : await fetchCatalog(cat.id, 1);
    state.grid.items   = items;
    state.grid.hasMore = !cat.local && items.length >= 24;
  } catch (_) {}
  state.grid.loading = false;
  renderHome();
}

async function loadMoreHomeGrid() {
  if (state.grid.loading || !state.grid.hasMore) return;
  state.grid.loading = true;
  state.grid.page++;
  renderHomeGrid();
  try {
    const more = await fetchCatalog(state.grid.catId, state.grid.page);
    state.grid.items   = [...state.grid.items, ...more];
    state.grid.hasMore = more.length >= 24;
    if (!state.grid.hasMore && state.grid.focus > state.grid.items.length - 1)
      state.grid.focus = Math.max(0, state.grid.items.length - 1);
  } catch (_) {}
  state.grid.loading = false;
  renderHome();
}

function handleHome(k) {
  return state.homeZone === 'sidebar' ? handleSidebarKey(k) : handleGridKey(k);
}

// Sidebar: cycle through catalog list
function handleSidebarKey(k) {
  const n    = CATALOGS.length;
  if (k === KEY.UP) {
    state.sidebarFocus = state.sidebarFocus === 0 ? n - 1 : state.sidebarFocus - 1;
    _scheduleSidebarLoad();
    renderSidebar();
  } else if (k === KEY.DOWN) {
    state.sidebarFocus = state.sidebarFocus >= n - 1 ? 0 : state.sidebarFocus + 1;
    _scheduleSidebarLoad();
    renderSidebar();
  } else if (k === KEY.ENTER || k === KEY.RIGHT) {
    clearTimeout(_sidebarDebounce);
    const cat = CATALOGS[state.sidebarFocus];
    if (cat.id === 'search') { showSearch(); return true; }
    if (cat.id !== state.grid.catId) loadHomeGrid(cat);
    if (k === KEY.RIGHT) { state.homeZone = 'grid'; state.grid.focus = 0; renderHome(); }
    return true;
  } else { return false; }
  return true;
}

function renderSidebar() {
  const list = document.getElementById('sidebar-list');
  list.innerHTML = CATALOGS.map((cat, i) => {
    const focused = state.homeZone === 'sidebar' && i === state.sidebarFocus;
    const active  = cat.id === state.grid.catId;
    return `<li class="sidebar-item${focused ? ' focused' : ''}${active ? ' active' : ''}">${escHtml(cat.name)}</li>`;
  }).join('');
  const fi = list.querySelector('.sidebar-item.focused');
  if (fi) fi.scrollIntoView({ block: 'nearest' });
}

function _scheduleSidebarLoad() {
  clearTimeout(_sidebarDebounce);
  const cat = CATALOGS[state.sidebarFocus];
  if (!cat || cat.id === 'search') return;
  _sidebarDebounce = setTimeout(() => {
    if (cat.id !== state.grid.catId) loadHomeGrid(cat);
  }, 350);
}

function getHomeGridCols() {
  const cards = document.querySelectorAll('#home-grid .card');
  if (!cards.length) return HOME_GRID_COLS;
  const firstTop = cards[0].offsetTop;
  let cols = 0;
  for (const card of cards) {
    if (card.offsetTop !== firstTop) break;
    cols++;
  }
  return cols || HOME_GRID_COLS;
}

function handleGridKey(k) {
  const { items, focus, hasMore, loading } = state.grid;
  const itemCount = items.length;
  const totalCount = itemCount + (hasMore ? 1 : 0);
  const max       = totalCount - 1;
  if (max < 0 && k !== KEY.LEFT && k !== KEY.BACK && k !== KEY.ESC && k !== KEY.BACKSPACE)
    return false;

  const cols      = getHomeGridCols();
  const col       = focus % cols;
  const row       = Math.floor(focus / cols);
  const totalRows = Math.ceil(totalCount / cols);

  if (k === KEY.LEFT) {
    if (col === 0) { state.homeZone = 'sidebar'; renderHome(); return true; }
    state.grid.focus--;
  } else if (k === KEY.RIGHT) {
    if (focus < max) {
      state.grid.focus++;
    } else if (!loading) {
      state.grid.focus = 0;
    }
  } else if (k === KEY.UP) {
    if (row === 0) {
      state.grid.focus = Math.min(max, (totalRows - 1) * cols + col);
    } else {
      state.grid.focus = Math.max(0, focus - cols);
    }
  } else if (k === KEY.DOWN) {
    const next = focus + cols;
    if (next <= max) {
      state.grid.focus = next;
    } else if (!loading) {
      state.grid.focus = col <= max ? col : 0;
    }
  } else if (k === KEY.ENTER) {
    if (hasMore && focus === itemCount) {
      loadMoreHomeGrid();
      return true;
    }
    const item = items[focus];
    if (item) showSeries(item.id);
    return true;
  } else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    state.homeZone = 'sidebar';
  } else { return false; }

  renderHome();
  return true;
}

// ── Series screen ─────────────────────────────────────────────────────────────
async function showSeries(slug) {
  showScreen('series');
  document.getElementById('series-content').innerHTML = '<div class="loading-msg"><div class="spinner"></div></div>';

  try {
    const meta = await fetchMeta(slug);
    state.series  = meta;
    state.focusEp = 0;
    recordLocalMeta(slug, meta.name, meta.poster);

    const history = JSON.parse(localStorage.getItem('watchHistory') || '{}');
    if (history[slug]) {
      const idx = (meta.videos || []).findIndex(v => v.id.endsWith(':' + history[slug].ep));
      if (idx >= 0) state.focusEp = idx;
    }

    renderSeries();
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
async function playEpisode(videoId) {
  showScreen('player');
document.getElementById('player-title').textContent = '...';
  document.getElementById('seek-fill').style.width = '0%';
  document.getElementById('player-time').textContent = '0:00 / 0:00';
  showOverlayPersistent();

  const [slug, ep] = videoId.split(':');
  recordLocalWatch(slug, ep);

  try {
    console.log(`[stream] fetching ${slug} ep ${ep}`);
    const stream = await fetchStream(slug, ep);
    console.log(`[stream] got:`, stream);

    if (!stream.url && stream.externalUrl) {
      document.getElementById('player-title').textContent =
        'Không tìm thấy stream để phát trực tiếp.';
      return;
    }

    state.currentVideoId = videoId;
    document.getElementById('player-title').textContent = stream.title || videoId;
    startPlayback(stream.url);
    showOverlay();
  } catch (e) {
    console.error('[stream] error:', e);
    document.getElementById('player-title').textContent = `Lỗi: ${e.message}`;
  }
}

function startPlayback(url) {
  const video = document.getElementById('video');
  if (!video) return;

  if (state.hls) { state.hls.destroy(); state.hls = null; }

  video.ontimeupdate = updatePlayerBar;
  video.onended      = () => playNext();

  video.addEventListener('loadedmetadata', () => console.log('[video] loadedmetadata duration=' + video.duration), { once: true });
  video.addEventListener('canplay',        () => console.log('[video] canplay'), { once: true });
  video.addEventListener('playing',        () => console.log('[video] playing'), { once: true });
  video.addEventListener('stalled',        () => console.log('[video] stalled'));
  video.addEventListener('waiting',        () => console.log('[video] waiting'));
  video.addEventListener('error', () => {
    const code = video.error?.code;
    const msg  = video.error?.message || '';
    console.error('[video] error code=' + code + ' msg=' + msg);
    showOverlayPersistent();
    const titleEl = document.getElementById('player-title');
    titleEl.textContent = `[${code}] ${msg || '?'} — diagnosing...`;
    rlog('video error code=' + code + ' msg=' + msg + ' url=' + String(url).substring(0, 80));
    fetch(url).then(r => r.text()).then(t => {
      const preview = t.substring(0, 300).replace(/\n/g, '|');
      titleEl.textContent = `[${code}] ${msg} | ${preview}`;
      rlog('video error content: ' + t.substring(0, 500).replace(/\n/g, '|'));
    }).catch(e2 => {
      titleEl.textContent = `[${code}] ${msg} | fetch err: ${e2.message}`;
      rlog('video error fetch failed: ' + e2.message);
    });
  });
  video.src = url;
  video.load();
  const p = video.play();
  if (p && p.catch) p.catch(e => console.warn('[video] play() rejected:', e.name, e.message));
}

function stopPlayback() {
  const video = document.getElementById('video');
  if (video) { video.src = ''; video.ontimeupdate = null; video.onended = null; }
  clearTimeout(state.overlayTimer);
}

function playNext() {
  if (!state.series || !state.currentVideoId) return;
  const videos = state.series.videos || [];
  const idx = videos.findIndex(v => v.id === state.currentVideoId);
  if (idx >= 0 && idx < videos.length - 1) {
    state.focusEp = idx + 1;
    playEpisode(videos[idx + 1].id);
  }
}

function updatePlayerBar() {
  const video = document.getElementById('video');
  if (!video || !video.duration) return;
  const fmt  = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const timeEl = document.getElementById('player-time');
  const fill   = document.getElementById('seek-fill');
  if (timeEl) timeEl.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
  if (fill)   fill.style.width   = `${(video.currentTime / video.duration) * 100}%`;
}

function showOverlay() {
  const overlay = document.getElementById('player-overlay');
  if (!overlay) return;
  overlay.classList.add('visible');
  clearTimeout(state.overlayTimer);
  state.overlayTimer = setTimeout(() => overlay.classList.remove('visible'), 3500);
}

function showOverlayPersistent() {
  const overlay = document.getElementById('player-overlay');
  if (!overlay) return;
  clearTimeout(state.overlayTimer);
  overlay.classList.add('visible');
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

  if (screen === 'about')  { if (handleAbout(k))   e.preventDefault(); return; }
  if (screen === 'home')   { if (handleHome(k))    e.preventDefault(); return; }
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

  if (k === KEY.UP)         state.focusEp = Math.max(0, state.focusEp - epCols);
  else if (k === KEY.DOWN)  state.focusEp = Math.min(max, state.focusEp + epCols);
  else if (k === KEY.LEFT)  state.focusEp = Math.max(0, state.focusEp - 1);
  else if (k === KEY.RIGHT) state.focusEp = Math.min(max, state.focusEp + 1);
  else if (k === KEY.ENTER) { playEpisode(videos[state.focusEp].id); return true; }
  else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    if (state.prevScreen === 'search') showSearch(false);
    else showHome();
    return true;
  }
  else return false;

  renderSeries();
  return true;
}

function handlePlayer(k) {
  const video = document.getElementById('video');

  if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) {
    stopPlayback();
    if (state.series) { showScreen('series'); renderSeries(); }
    else showHome();
    return true;
  }

  showOverlay();

  if (k === KEY.ENTER || k === KEY.PLAY || k === KEY.PAUSE || k === KEY.PLAYPAUSE) {
    if (video) video.paused ? video.play().catch(e => console.warn('[video] play() rejected:', e.name)) : video.pause();
  } else if (k === KEY.RIGHT || k === KEY.FF) {
    if (video) video.currentTime += 10;
  } else if (k === KEY.LEFT || k === KEY.REW) {
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
  } else if (k === KEY.STOP) {
    stopPlayback();
    if (state.series) { showScreen('series'); renderSeries(); }
    else showHome();
  } else {
    return false;
  }

  return true;
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
