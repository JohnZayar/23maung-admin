// admin.js — 23မောင်း Admin app wiring (ES module).
// Base = admin mockup v2.4 (UI, layout, CSS, Burmese labels unchanged).
// Data comes from PocketBase (pb.js) per 23maung-schema.md. Until the
// collections exist / Admin logs in, the mockup's sample data stays on
// screen and every action falls back to the mockup's local behaviour.
import * as PB from './pb.js';
import * as L from './logic.js?v=2.15';

// ---------------------------------------------------------------- state
// Sample data = the mockup v2.4 defaults. Replaced by live rows in loadAll().
const state = {
  loaded: false,
  settings: null,      // m23_settings row (key=main)
  settingsId: null,
  sessions: [],        // m23_sessions
  requests: [],        // m23_requests (pending + decided, for counts)
  players: [],         // m23_players
  bets2d: [], bets3d: [], betsFb: [],
  fixtures: [],        // m23_fixtures
  txs: [],             // m23_wallet_tx (summary only)
  hedges: [],          // m23_hedges (Admin v1.6)
  hedgeByMatch: {},   // match key -> {body, goal} hedge rows
  adminDate: null,    // record date picker (Admin v2.3): 'YYYY-MM-DD' Yangon; null until set
  adminCalView: null, // calendar popup viewed month {y, m} (m 0-based)
  adminPeriod: null,  // 2D period switch (Admin v2.5): 'am' | 'pm' | 'both'; null until resolved
  adminPeriodManual: false, // operator tapped a pill — the auto clock rule must not override it
  sumTab: '2d',       // summary game tab (Admin v2.11): '2d' | '3d' | 'fb'
};

// Mockup sample data (kept as the pre-login / offline fallback).
var LED2D = { '09': 5000, '12': 1500, '21': 1500, '45': 5000, '78': 5000, '90': 5000, '99': 5000 };
// Admin v2.4 am/pm split (Pho Nov 17): the same mockup day total (28,000)
// split by session — AM 11,500 + PM 16,500. LED2D stays the combined day
// total (ledger stats row + ledTotAll); the two sections below are the split.
var LED2D_AM = { '09': 5000, '12': 1500, '45': 5000 };
var LED2D_PM = { '21': 1500, '78': 5000, '90': 5000, '99': 5000 };
var LED3D = { '357': 5000, '123': 1000, '321': 1000 };
var LEDFB = [
  { user: 'User002', what: 'မောင်း 3 ပွဲ — မန်စီးတီး · လာဇီယို · ရိုးမား', amt: 5000 },
  { user: 'User003', what: 'ဘော်ဒီ — ရိုးမား 1-5', amt: 10000 },
  { user: 'User001', what: 'ဂိုးပေါ် — မန်စီးတီး vs ဖူလ်ဟမ် 3+25', amt: 2000 }
];
var BS = {
  '2d': [ { n: '12', v: 7500 }, { n: '65', v: 6500 }, { n: '45', v: 2500 } ],
  // Admin v2.4 am/pm split: the mockup '2d' list above, split by session.
  '2dAm': [ { n: '12', v: 5000 }, { n: '45', v: 2500 } ],
  '2dPm': [ { n: '12', v: 2500 }, { n: '65', v: 6500 } ],
  '3d': [ { n: '357', v: 5000 }, { n: '123', v: 1000 }, { n: '321', v: 1000 } ],
  'parlay': [ { n: 'User002 — မောင်း 3 ပွဲ', v: 5000 } ]
};
var BODY_NET = [
  { home: 'မန်ယူ', away: 'စပါး', h: 15000, a: 50000, over: 150000, under: 50000 },
  { home: 'ရိုးမား', away: 'ဆာဆူအိုလို', h: 10000, a: 0, over: 0, under: 0 }
];
var BLOCKED = { '2d': ['45', '78'], '3d': ['357'] };
var pendIn = 2, pendOut = 1;

// Sample requests (same three cards as the mockup) for the pre-login view.
var SAMPLE_REQS = [
  { id: 'rq1', kind: 'in', playerName: 'User001', amount: 50000, method: 'KBPay', phone: '09xxxxxxxxx', meta: '2026-11-12 21:30 · လွှဲပြီးကြောင်း screenshot ပါတယ်', shot: '📷 Screenshot — KBPay လွှဲငွေ (နမူနာ)', status: 'pending' },
  { id: 'rq2', kind: 'in', playerName: 'User002', amount: 20000, method: 'WavePay', phone: '09xxxxxxxxx', meta: '2026-11-12 21:45 · လွှဲပြီးကြောင်း screenshot ပါတယ်', shot: '📷 Screenshot — WavePay လွှဲငွေ (နမူနာ)', status: 'pending' },
  { id: 'rq3', kind: 'out', playerName: 'User003', amount: 30000, method: 'KBPay', phone: '09123456789', meta: '2026-11-12 20:15 · လက်ကျန် 100,000 ကျပ်', name: 'User003', status: 'pending' }
];

// ---------------------------------------------------------------- helpers
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmt(n) { return (n || 0).toLocaleString('en-US'); }
function todayYgn() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(new Date());
}
function isToday(iso) {
  if (!iso) return false;
  try {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(new Date(iso));
    return d === todayYgn();
  } catch (e) { return false; }
}
function playerName(pid) {
  const p = state.players.find(function (x) { return x.id === pid; });
  return p ? (p.name || p.email || pid) : pid;
}
function latestSession(game, period) {
  const list = state.sessions
    .filter(function (s) { return s.game === game && (!period || s.period === period); })
    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return list[0] || null;
}
// winOf (v2.10): the winning number of the ADMIN DATE's session for one
// game/period (Pho Nov 19 — the winning number shows green in the ledger
// and ကြီးငယ် lists). Date-scoped via L.winNumberForDate — never the
// latest session overall (wrong on past dates).
function winOf(game, period) {
  return L.winNumberForDate(state.sessions, game, period, ensureAdminDate());
}
function settingsOr(def) {
  const s = state.settings || {};
  return s[def] !== undefined && s[def] !== null ? s[def] : null;
}

// ---------------------------------------------------------------- nav/toast (mockup verbatim)
function go(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  $(id).classList.add('active');
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.scr === id); });
  window.scrollTo(0, 0);
}
function toast(msg) {
  var t = $('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(function () { t.style.display = 'none'; }, 2200);
}
function setReqTab(t) {
  document.querySelectorAll('[data-rt]').forEach(function (b) { b.classList.toggle('on', b.dataset.rt === t); });
  $('reqIn').style.display = t === 'in' ? '' : 'none';
  $('reqOut').style.display = t === 'out' ? '' : 'none';
}
function toggleUser(id) { $(id).classList.toggle('open'); }

// ---------------------------------------------------------------- login gate
async function loginAdmin() {
  const email = ($('loginEmail').value || '').trim();
  const pass = $('loginPass').value || '';
  const errEl = $('loginErr');
  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'email နဲ့ password ဖြည့်ပါ'; return; }
  try {
    await PB.authWithPassword(email, pass);
    $('loginGate').style.display = 'none';
    toast('ဝင်ပြီ');
    await loadAll();
  } catch (e) {
    errEl.textContent = 'ဝင်လို့ မရဘူး — email/password စစ်ပါ';
  }
}
async function boot() {
  if (!PB.isLoggedIn()) { $('loginGate').style.display = 'block'; return; }
  try {
    await PB.authRefresh();
  } catch (e) {
    PB.clearToken();
    $('loginGate').style.display = 'block';
    return;
  }
  await loadAll();
}

// ---------------------------------------------------------------- load live data
// Auto-refresh (same 30s poll as Player v1.6 startAutoRefresh): re-loads
// while the tab is visible, plus once when it becomes visible again.
// Guarded against double-start; only runs while logged in.
var _autoTimer = null;
function startAutoRefresh() {
  if (_autoTimer) return;
  _autoTimer = setInterval(function () {
    if (document.hidden || !PB.isLoggedIn()) return;
    loadAll(true);
  }, 30000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && PB.isLoggedIn()) loadAll(true);
  });
}

async function loadAll(quiet) {
  try {
    const settingsPage = await PB.getList('m23_settings', { filter: "key='main'", perPage: 1 });
    const sRow = (settingsPage.items || [])[0] || null;
    state.settings = sRow;
    state.settingsId = sRow ? sRow.id : null;
    if (sRow) {
      BLOCKED = {
        '2d': (sRow.blocked_2d || []).slice(),
        '3d': (sRow.blocked_3d || []).slice()
      };
    }
    state.sessions = await PB.getAll('m23_sessions', { sort: '-date' });
    // 2D auto-schedule (Admin v2.0, Pho Nov 15 18:31-18:43): Mon-Fri the
    // app creates today's missing am/pm 2D sessions (open=true, close_at
    // carried forward from the latest same-period session). Sat/Sun:
    // nothing. Creation only — an existing row is never touched, so a
    // manual holiday close (toggle) is never undone. A failure here must
    // never break the load, so it has its own try/catch; after creating,
    // the session list is re-fetched so toggles + Settings show the new rows.
    try {
      const created = await L.ensureToday2DSessions(PB, state.sessions, todayYgn());
      if (created.length) {
        state.sessions = await PB.getAll('m23_sessions', { sort: '-date' });
      }
    } catch (e2) { /* auto-create failed — keep loading with what we have */ }
    state.players = await PB.getAll('m23_players', { sort: 'name' });
    state.requests = await PB.getAll('m23_requests', { sort: '-created' });
    state.bets2d = await PB.getAll('m23_bets_2d', { sort: '-created' });
    state.bets3d = await PB.getAll('m23_bets_3d', { sort: '-created' });
    state.betsFb = await PB.getAll('m23_bets_fb', { sort: '-created' });
    state.fixtures = await PB.getAll('m23_fixtures', { sort: '-kickoff_utc' });
    state.txs = await PB.getAll('m23_wallet_tx', { sort: '-created', perPage: 200 });
    // Hedges (v1.6): own try/catch — a missing m23_hedges collection must
    // not break the whole load (until it exists, there are simply no hedges).
    try { state.hedges = await PB.getAll('m23_hedges', { sort: '-created' }); }
    catch (e2) { state.hedges = []; }
    state.loaded = true;
    fillWinInputs();
    ensureAdminDate();
    recomputeFromLive();
    renderAll();
    startAutoRefresh();
    if (!quiet) toast('ဒေတာ ရောက်ပြီ');
  } catch (e) {
    // Collections may not exist yet (parent creates them) or network failed:
    // keep the mockup sample data on screen, do not blank the app.
    state.loaded = false;
    if (!quiet) toast('PocketBase ချိတ်မရဘူး — နမူနာ ဒေတာ ပြနေတယ်');
  }
}

// Recompute every mockup aggregate from the live bet rows — for the
// SELECTED record date only (Admin v2.3 date picker). 2D/3D bets resolve
// their date from their session, football bets from `created`
// (L.adminBetDate); a bet whose date cannot be resolved is SHOWN, never
// hidden. The chosen date survives the 30s auto-refresh: loadAll re-runs
// this with state.adminDate untouched (ensureAdminDate only sets it once).
function recomputeFromLive() {
  const d = ensureAdminDate();
  const b2 = L.filterBetsByDate(state.bets2d, state.sessions, '2d', d);
  const s2 = L.split2DByPeriod(state.bets2d, state.sessions, d);
  const b3 = L.filterBetsByDate(state.bets3d, state.sessions, '3d', d);
  const bf = L.filterBetsByDate(state.betsFb, state.sessions, 'fb', d);
  LED2D = L.aggregate2D(b2);
  // Admin v2.4 am/pm split (Pho Nov 17): morning and evening are separate
  // draws — their totals live in separate sections and must never be mixed.
  // LED2D above stays the combined day total (stats row + ledTotAll).
  LED2D_AM = L.aggregate2D(s2.am);
  LED2D_PM = L.aggregate2D(s2.pm);
  LED3D = L.aggregate3D(b3);
  LEDFB = bf.map(function (b) {
    return { user: playerName(b.player), what: fbBetLabel(b), amt: b.stake || b.total || 0, bet: b };
  });
  BS = {
    '2d': L.bsEntriesFromTotals(LED2D),
    '2dAm': L.bsEntriesFromTotals(LED2D_AM),
    '2dPm': L.bsEntriesFromTotals(LED2D_PM),
    '3d': L.bsEntriesFromTotals(LED3D),
    'parlay': L.sortBsDesc(bf.filter(function (b) { return b.type === 'parlay'; }).map(function (b) {
      return { n: playerName(b.player) + ' — မောင်း ' + (b.legs || []).length + ' ပွဲ', v: b.stake || 0, bet: b };
    }))
  };
  BODY_NET = L.computeBodyNet(bf, fxById());
  state.hedgeByMatch = L.indexHedgesByMatch(state.hedges, state.fixtures);
  const pend = state.requests.filter(function (r) { return r.status === 'pending'; });
  pendIn = pend.filter(function (r) { return r.kind === 'topup'; }).length;
  pendOut = pend.filter(function (r) { return r.kind === 'withdraw'; }).length;
}

function fbBetLabel(b) {
  const legs = b.legs || [];
  if (b.type === 'parlay') {
    const teams = legs.map(function (l) { return l.pick === 'h' ? (l.home || '') : l.pick === 'a' ? (l.away || '') : (l.home || ''); });
    return 'မောင်း ' + legs.length + ' ပွဲ — ' + teams.join(' · ');
  }
  const l = legs[0] || {};
  if (l.kind === 'goal') {
    return (l.pick === 'over' ? 'ဂိုးပေါ်' : 'အောက်') + ' — ' + (l.home || '') + ' vs ' + (l.away || '') + ' ' + (l.over || '');
  }
  const team = l.pick === 'h' ? (l.home || '') : (l.away || '');
  return 'ဘော်ဒီ — ' + team + ' ' + (l.hcp || '');
}

// ---- football bet detail (Fix #4+#7) ---------------------------------------
// Legs are stored on m23_bets_fb.legs (NOT "picks"):
//   { fixture, home, away, kind:'body'|'goal', pick:'h'|'a'|'over'|'under',
//     hcp:'1-5', over:'3+25', ah_line, gl_line, stake, res, pyar }
// Team names on the leg are English; the fixture row (state.fixtures)
// carries home_mm/away_mm — prefer those when loaded.
function resText(res) {
  if (res === 'win') return 'နိုင်';
  if (res === 'halfWin') return 'နိုင်တစ်ဝက်';
  if (res === 'halfLoss') return 'ရှုံးတစ်ဝက်';
  if (res === 'loss') return 'ရှုံး';
  if (res === 'push') return 'ပြန်';
  return 'စောင့်';
}
function betStatusText(b) {
  if (!b) return '';
  if (b.status === 'won') return 'နိုင်';
  if (b.status === 'lost') return 'ရှုံး';
  if (b.status === 'settled') return 'ပြန်';
  return 'စောင့်နေတယ်';
}
function betStatusClass(b) {
  if (!b) return 'pend';
  if (b.status === 'won') return 'ok';
  if (b.status === 'lost') return 'no';
  return 'pend';
}
function fixtureById(id) {
  if (!id) return null;
  return state.fixtures.find(function (f) { return f.id === id; }) || null;
}
// Map fixture PB id -> fixture row (kickoff lookups for ledger times).
function fxById() {
  const map = {};
  state.fixtures.forEach(function (f) { map[f.id] = f; });
  return map;
}
function teamName(l, which) {
  const fx = fixtureById(l.fixture);
  if (fx) {
    if (which === 'h') return fx.home_mm || fx.home || l.home || '';
    return fx.away_mm || fx.away || l.away || '';
  }
  return which === 'h' ? (l.home || '') : (l.away || '');
}
// One leg as plain text: match + pick + odds + leg outcome.
// withTime (v1.7, parlay tab only): appends the leg's kickoff time
// (Yangon HH:MM) after the match part, e.g. 'Man City 1-25 vs Fulham ·
// 21:00 · စောင့်'. Default off — all other callers render byte-identical.
function legLine(l, withTime, fixturesById) {
  const h = teamName(l, 'h'), a = teamName(l, 'a');
  let s;
  if (l.kind === 'goal') {
    s = h + ' vs ' + a + ' · ' + (l.pick === 'over' ? 'ဂိုးပေါ်' : 'ဂိုးအောက်') + ' ' + (l.over || '');
  } else if (l.pick === 'h') {
    s = h + (l.hcp ? ' ' + l.hcp : '') + ' vs ' + a;
  } else {
    s = h + ' vs ' + a + (l.hcp ? ' ' + l.hcp : '');
  }
  if (withTime) {
    const t = L.legKickoffTime(l, fixturesById);
    if (t) s += ' · ' + t;
  }
  return s + ' · ' + resText(l.res);
}
// Status badge line (with payout when settled) + one .fb-leg per leg.
// withTime: append each leg's kickoff time (fixturesById map passed by the
// caller; defaults to the live state.fixtures when omitted).
function fbDetailHtml(b, withTime, fixturesById) {
  if (!b) return '';
  const txt = betStatusText(b) +
    ((b.status === 'won' || b.status === 'settled') && b.payout
      ? ' · ရငွေ ' + fmt(b.payout) : '');
  let out = '<div class="fb-leg"><span class="badge ' + betStatusClass(b) + '">' + esc(txt) + '</span></div>';
  const fxMap = withTime ? (fixturesById || fxById()) : null;
  (b.legs || []).forEach(function (l) {
    out += '<div class="fb-leg">' + esc(legLine(l, withTime, fxMap)) + '</div>';
  });
  return out;
}

function renderAll() {
  syncAdminDateText();
  syncAdminPeriod();
  renderRequests();
  renderBets();
  renderLedger2D(); renderLedger3D(); renderLedgerFb();
  renderBs(); renderBlocked(); updPend();
  renderDashboard(); renderSummary(); renderResults(); renderSettings(); renderHomeSessions();
  syncLimitInputs();
}

// ---------------------------------------------------------------- record date picker (Admin v2.3)
// MOUNG556-style calendar popup, SAME design as Player v2.10's voucher
// calendar (openVouchCal/renderVouchCal there): a calendar icon button +
// selected-date text in the top bar of EACH record screen (လယ်ဂျာ / ကြီးငယ် /
// လောင်းကစား), tap opens the month-view popup. ONE shared date state across
// all three screens; default = today (Yangon); the chosen date survives the
// 30s auto-refresh (ensureAdminDate only sets it once). Settings are NOT
// filtered: limit input, close times, blocked numbers stay as they are.
// scr-res (ရလဒ်) has NO picker (out of scope). scr-summary (စာရင်းချုပ်) got
// one in v2.11 — it shares state.adminDate with the other screens, and the
// picked date drives the summary's per-game period (2D week / 3D round /
// 1D day).
var CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function ensureAdminDate() {
  if (!state.adminDate) state.adminDate = todayYgn();
  return state.adminDate;
}
function syncAdminDateText() {
  const txt = state.adminDate ? L.fmtDateOnly(state.adminDate) : '';
  ['adminDateTextLedger', 'adminDateTextBs', 'adminDateTextBets', 'adminDateTextSummary'].forEach(function (id) {
    const el = $(id);
    if (el) el.textContent = txt;
  });
}
function setAdminDate(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
  state.adminDate = ymd;
  // Admin v2.5: a new picked date re-autos the period switch — a manual
  // tap from the old date must not carry over to the new one.
  state.adminPeriod = null;
  state.adminPeriodManual = false;
  syncAdminDateText();
  if (state.loaded) recomputeFromLive();
  renderAll();
}
// ---------------------------------------------------------------- 2D period switch (Admin v2.5)
// Pho (Nov 17 09:14): at 11:00 the morning ledger shows, at 14:00 the
// evening ledger shows — the 2D screens must follow the clock so morning
// and evening are never mixed on screen. ONE shared switch across all
// three 2D views (လယ်ဂျာ grid, ကြီးငယ် list, လောင်းကစား detail), like the
// shared date (v2.3). Auto default: before 14:00 Yangon -> 'am', from
// 14:00 -> 'pm', and 'both' when the picked date is not today. A manual
// tap overrides the auto choice and survives the 30s auto-refresh
// (adminPeriodManual — same fill-once idea as fillWinInputs); changing
// the picked date clears it (see setAdminDate above). The auto value is
// re-resolved on every render while not manual, so an app left open
// across 14:00 flips to the evening ledger by itself.
// `now` is optional (Date.now() in the app; tests pass explicit times).
function resolveAdminPeriod(now) {
  if (!state.adminPeriodManual) {
    state.adminPeriod = L.defaultAdminPeriod(ensureAdminDate(), todayYgn(), now === undefined ? Date.now() : now);
  }
  return state.adminPeriod || 'both';
}
function syncAdminPeriod() {
  resolveAdminPeriod();
  document.querySelectorAll('[data-per]').forEach(function (b) {
    b.classList.toggle('on', b.dataset.per === state.adminPeriod);
  });
}
function setAdminPeriod(p) {
  if (p !== 'am' && p !== 'pm' && p !== 'both') return;
  state.adminPeriod = p;
  state.adminPeriodManual = true;
  syncAdminPeriod();
  renderAll();
}
function renderAdminCal() {
  const card = $('adminCalCard');
  if (!card) return;
  const today = todayYgn();
  const ty = parseInt(today.slice(0, 4), 10), tm = parseInt(today.slice(5, 7), 10) - 1;
  const view = state.adminCalView || { y: ty, m: tm };
  const isCur = (view.y === ty && view.m === tm);
  const cells = L.calCells(view.y, view.m, today, state.adminDate);
  var h = '<div class="acal-nav">'
    + '<button onclick="adminCalMove(-1)" aria-label="prev month">‹</button>'
    + '<div class="acal-title">' + CAL_MONTHS[view.m] + ' &nbsp; ' + view.y + '</div>'
    + '<button onclick="adminCalMove(1)"' + (isCur ? ' disabled' : '') + ' aria-label="next month">›</button>'
    + '</div>';
  h += '<div class="acal-grid">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (d) { return '<div class="acal-dow">' + d + '</div>'; }).join('') + '</div>';
  h += '<div class="acal-grid">';
  cells.forEach(function (c) {
    if (!c) { h += '<div></div>'; return; }
    var cls = 'acal-day';
    if (c.we) cls += ' cal-we';
    if (c.future) cls += ' cal-future';
    if (c.today) cls += ' cal-today';
    if (c.sel && !c.today) cls += ' cal-sel';
    if (c.future) h += '<div class="' + cls + '">' + c.d + '</div>';
    else h += '<div class="' + cls + '" onclick="adminCalPick(\'' + c.ymd + '\')">' + c.d + '</div>';
  });
  h += '</div>';
  h += '<div class="acal-quick"><button onclick="adminCalQuick(\'yesterday\')">Yesterday</button><button onclick="adminCalQuick(\'today\')">Today</button></div>';
  card.innerHTML = h;
}
function openAdminCal() {
  ensureAdminDate();
  const sel = state.adminDate || todayYgn();
  state.adminCalView = { y: parseInt(sel.slice(0, 4), 10), m: parseInt(sel.slice(5, 7), 10) - 1 };
  renderAdminCal();
  const ov = $('adminCalOverlay');
  if (ov) ov.style.display = 'flex';
}
function closeAdminCal() {
  const ov = $('adminCalOverlay');
  if (ov) ov.style.display = 'none';
}
function adminCalMove(dir) {
  const today = todayYgn();
  const view = state.adminCalView || { y: parseInt(today.slice(0, 4), 10), m: parseInt(today.slice(5, 7), 10) - 1 };
  var m = view.m + dir, y = view.y;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  // Never into a future month beyond the current month.
  const ty = parseInt(today.slice(0, 4), 10), tm = parseInt(today.slice(5, 7), 10) - 1;
  if (y > ty || (y === ty && m > tm)) return;
  state.adminCalView = { y: y, m: m };
  renderAdminCal();
}
function adminCalPick(ymd) {
  setAdminDate(ymd);
  closeAdminCal();
}
function adminCalQuick(which) {
  const today = todayYgn();
  adminCalPick(which === 'yesterday' ? L.ymdAdd(today, -1) : today);
}

// ---------------------------------------------------------------- requests
function renderRequests() {
  if (!state.loaded) return; // keep the mockup's three sample cards
  const reqs = state.requests;
  function card(r) {
    const isIn = r.kind === 'topup';
    const name = esc(playerName(r.player));
    const shot = PB.fileUrlFromRecord('m23_requests', r, 'screenshot');
    const shotHtml = isIn
      ? (shot
        ? '<div class="rshot"><img src="' + esc(shot) + '" alt="screenshot" style="max-width:100%;border-radius:8px"></div>'
        : '<div class="rshot">📷 Screenshot မရှိဘူး</div>')
      : '';
    const meta = esc(r.method || '') + ' · ' + esc(r.phone || '') +
      (r.kind === 'withdraw' ? '<br>အမည်: ' + esc(r.name || '') + (r.account ? ' · ' + esc(r.account) : '') : '') +
      '<br>' + esc(r.created || '');
    const badge = r.status === 'pending'
      ? '<span class="badge pend">စောင့်နေတယ်</span>'
      : r.status === 'approved'
        ? '<span class="badge ok">အတည်ပြုပြီ</span>'
        : '<span class="badge no">ပယ်လိုက်ပြီ</span>';
    const actions = r.status === 'pending'
      ? '<div class="ractions"><button class="btn-green" onclick="approveReq(\'' + esc(r.id) + '\',\'' + (isIn ? 'in' : 'out') + '\')">' + (isIn ? 'အတည်ပြုမယ်' : 'လွှဲပေးမယ်') + '</button><button class="btn-red" onclick="rejectReq(\'' + esc(r.id) + '\',\'' + (isIn ? 'in' : 'out') + '\')">ပယ်မယ်</button></div>'
      : '';
    return '<div class="req' + (r.status === 'pending' ? '' : ' done') + '" id="rq-' + esc(r.id) + '">' +
      '<div class="rhead"><span>' + name + '</span>' + badge + '</div>' +
      '<div class="ramt">' + fmt(r.amount) + ' ကျပ်</div>' +
      '<div class="rmeta">' + meta + '</div>' + shotHtml + actions + '</div>';
  }
  $('reqIn').innerHTML = reqs.filter(function (r) { return r.kind === 'topup'; }).map(card).join('') || '<div class="muted">ငွေသွင်း တောင်းဆိုမှု မရှိဘူး</div>';
  $('reqOut').innerHTML = reqs.filter(function (r) { return r.kind === 'withdraw'; }).map(card).join('') || '<div class="muted">ငွေထုတ် တောင်းဆိုမှု မရှိဘူး</div>';
}

function updPend() {
  $('cntIn').textContent = pendIn;
  $('cntOut').textContent = pendOut;
  $('stPend').textContent = pendIn + pendOut;
  const sp = $('sumPend'); if (sp) sp.textContent = pendIn + pendOut;
  const hb = $('hbReq'); if (hb) hb.textContent = (pendIn + pendOut) + ' ခု ကျန်';
  const wI = $('wIn'); if (wI) wI.textContent = pendIn + ' ခု';
  const wO = $('wOut'); if (wO) wO.textContent = pendOut + ' ခု';
}

function markReqDone(id, approved) {
  const el = $('rq-' + id) || $(id);
  if (!el) return;
  el.classList.add('done');
  const badge = el.querySelector('.badge');
  if (badge) {
    badge.textContent = approved ? 'အတည်ပြုပြီ' : 'ပယ်လိုက်ပြီ';
    badge.className = 'badge ' + (approved ? 'ok' : 'no');
  }
  const ra = el.querySelector('.ractions');
  if (ra) ra.innerHTML = '';
}

// approveReq / rejectReq: schema §7 side effects via logic.js when the
// request is a live PocketBase row; the mockup's local-only behaviour when
// it is still one of the three sample cards (no PB loaded).
async function approveReq(id, kind) {
  const live = state.loaded && state.requests.find(function (r) { return r.id === id; });
  if (!live) {
    markReqDone(id, true);
    if (kind === 'in') pendIn--; else pendOut--;
    updPend();
    toast(kind === 'in' ? 'ငွေသွင်း အတည်ပြုပြီ — wallet ထဲ ပေါင်းပြီ' : 'ငွေထုတ် အတည်ပြုပြီ');
    return;
  }
  try {
    const res = await L.approveRequest(PB, live);
    live.status = 'approved';
    live.decided_at = res.request.decided_at;
    if (live.kind === 'topup') pendIn--; else pendOut--;
    updPend();
    markReqDone(id, true);
    renderSummary(); renderDashboard();
    toast(kind === 'in' ? 'ငွေသွင်း အတည်ပြုပြီ — wallet ထဲ ပေါင်းပြီ' : 'ငွေထုတ် အတည်ပြုပြီ');
  } catch (e) {
    toast('အတည်ပြုလို့ မရဘူး — ' + (e.message || 'error'));
  }
}
async function rejectReq(id, kind) {
  const live = state.loaded && state.requests.find(function (r) { return r.id === id; });
  if (!live) {
    markReqDone(id, false);
    if (kind === 'in') pendIn--; else pendOut--;
    updPend();
    toast('ပယ်လိုက်ပြီ');
    return;
  }
  try {
    await L.rejectRequest(PB, live);
    live.status = 'rejected';
    if (live.kind === 'topup') pendIn--; else pendOut--;
    updPend();
    markReqDone(id, false);
    renderSummary(); renderDashboard();
    toast('ပယ်လိုက်ပြီ');
  } catch (e) {
    toast('ပယ်လို့ မရဘူး — ' + (e.message || 'error'));
  }
}

// Short-account numbers (v1.3): Pho creates accounts with password ONLY —
// no name, no phone, no email to type. The account number is auto-generated
// from the already-loaded players: take each player's email local-part,
// strip leading non-digits, keep the trailing digits (e.g. "005" from
// "23M005@23maung.local", "001" from "test001@23maung.local"), take the
// highest, and use the next one ("23M001" if none numeric). "23M" is Pho's
// brand symbol; the number after it is the user count. The player logs in
// by typing just "23M005" — the Player app expands it to 23M005@23maung.local.
function nextAccountNumber(players) {
  var max = 0;
  (players || []).forEach(function (p) {
    var local = String((p && p.email) || '').split('@')[0];
    var digits = local.replace(/^\D+/, '').match(/\d+$/);
    if (digits) max = Math.max(max, parseInt(digits[0], 10));
  });
  var n = max + 1;
  var taken = {};
  (players || []).forEach(function (p) { taken[String((p && p.email) || '')] = true; });
  while (taken['23M' + String(n).padStart(3, '0') + '@23maung.local']) n++;
  return '23M' + String(n).padStart(3, '0');
}

// Player-account creation (Fix #3, v1.3 password-only; v1.4 "23M" prefix):
// Admin (Pho) creates accounts ONLY — no self-registration. m23_players is
// an auth collection, so PocketBase requires email + password +
// passwordConfirm; the email is auto-generated (23M005@23maung.local) and
// the player logs in with just 23M005. Balance starts 0 (Pho credits it
// via top-up approve).
var _creatingPlayer = false;
async function createPlayer() {
  if (_creatingPlayer) return;
  if (!state.loaded) { toast('PocketBase ချိတ်ပြီးမှ အကောင့် ဖွင့်လို့ရတယ်'); return; }
  const pass = $('newPlPass').value || '';
  const msgEl = $('newPlMsg');
  function fail(m) { if (msgEl) msgEl.textContent = m; toast(m); }
  if (pass.length < 8) return fail('Password အနည်းဆုံး ၈ လုံး ဖြစ်ရမယ်');
  if (msgEl) msgEl.textContent = '';
  const nnn = nextAccountNumber(state.players);
  const email = nnn + '@23maung.local';
  _creatingPlayer = true;
  try {
    const rec = await PB.create('m23_players', {
      email: email, password: pass, passwordConfirm: pass,
      name: nnn, phone: '', status: 'active', balance: 0
    });
    state.players.push(rec);
    state.players.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
    $('newPlPass').value = '';
    renderDashboard(); renderSummary();
    if (msgEl) msgEl.textContent = 'အကောင့် ' + nnn + ' ဖွင့်ပြီးပြီ — Account: ' + nnn + ' · Password: ရိုက်ထားတဲ့အတိုင်း';
    toast('အကောင့် ' + nnn + ' ဖွင့်ပြီ');
  } catch (e) {
    fail(e && e.status === 400 ? 'အဲဒီ အကောင့် ရှိပြီးသား' : 'အကောင့် ဖွင့်လို့ မရဘူး — ' + (e.message || 'error'));
  } finally {
    _creatingPlayer = false;
  }
}

// ---------------------------------------------------------------- bets tab
function renderBets() {
  if (!state.loaded) return; // keep the mockup's three sample user cards
  const d = ensureAdminDate();
  // Admin v2.5: the 2D period switch — one shared state across all three
  // 2D views, so the detail here follows the same period as လယ်ဂျာ + ကြီးငယ်.
  const per = resolveAdminPeriod();
  const wrap = $('betsList');
  const rows = state.players.map(function (p) {
    const b2 = state.bets2d.filter(function (b) { return b.player === p.id && L.betMatchesDate(b, state.sessions, '2d', d); });
    const b3 = state.bets3d.filter(function (b) { return b.player === p.id && L.betMatchesDate(b, state.sessions, '3d', d); });
    const bf = state.betsFb.filter(function (b) { return b.player === p.id && L.betMatchesDate(b, state.sessions, 'fb', d); });
    const total = b2.reduce(function (a, b) { return a + (b.total || 0); }, 0) +
      b3.reduce(function (a, b) { return a + (b.total || 0); }, 0) +
      bf.reduce(function (a, b) { return a + (b.stake || 0); }, 0);
    // Admin v2.5: this user's 2D bets split by session period (unresolvable
    // period counts in AM — L.split2DByPeriod, shown never hidden). Only
    // the switched-on section(s) render; the card shows only when the
    // current view has something to show. The header total above stays the
    // combined day total, like the ledger day-total stats.
    const s2 = L.split2DByPeriod(b2, state.sessions, d);
    const b2am = per === 'pm' ? [] : s2.am;
    const b2pm = per === 'am' ? [] : s2.pm;
    if (!b2am.length && !b2pm.length && !b3.length && !bf.length) return '';
    function betRows(list, label, withSub) {
      if (!list.length) return '';
      var out = '<div class="glabel">' + label + '</div>' + list.map(function (b) {
        const what = b.lines
          ? b.lines.map(function (ln) { return ln.n + (ln.rev ? ' (အာ ' + L.reverse2(ln.n) + ')' : ''); }).join(' · ')
          : fbBetLabel(b);
        const amt = b.lines ? (b.total || 0) : (b.stake || 0);
        // 'wrap': the numbers MUST wrap to multiple lines — the old
        // .bet-row .what ellipsis ('...') hid real bets Pho could not see.
        // No truncation anywhere in this detail: every number is shown.
        var row = '<div class="bet-row wrap"><span class="what">' + esc(what) + '</span><span class="amt">' + fmt(amt) + ' ကျပ်</span></div>';
        if (!b.lines) {
          // Football bet: status + one line per leg (match, pick, odds, outcome).
          const det = fbDetailHtml(b);
          if (det) row = '<div class="fb-bet">' + row + det + '</div>';
        }
        return row;
      }).join('');
      if (withSub) {
        var st = list.reduce(function (a, b) { return a + (b.lines ? (b.total || 0) : (b.stake || 0)); }, 0);
        out += '<div class="bet-row"><span class="what"><b>စုစုပေါင်း</b></span><span class="amt"><b>' + fmt(st) + ' ကျပ်</b></span></div>';
      }
      return out;
    }
    const cid = 'uc-' + esc(p.id);
    return '<div class="user-card" id="' + cid + '">' +
      '<div class="user-head" onclick="toggleUser(\'' + cid + '\')"><span>' + esc(p.name || p.email) + ' <span class="arr">›</span></span><span class="tot">' + fmt(total) + ' ကျပ်</span></div>' +
      '<div class="user-body">' +
      betRows(b2am, '2D မနက်ပိုင်း', true) + betRows(b2pm, '2D ညနေပိုင်း', true) + betRows(b3, '3D') + betRows(bf, '1D (ဘောပွဲ)') +
      '</div></div>';
  }).join('');
  wrap.innerHTML = rows || '<div class="muted">လောင်းကစား မရှိသေးဘူး</div>';
}

// ---------------------------------------------------------------- results
function renderResults() {
  if (!state.loaded) return; // keep the mockup's sample finished rows
  const fin = state.fixtures.filter(function (f) { return f.status === 'finished'; });
  const wrap = $('fbResults');
  if (!fin.length) { wrap.innerHTML = '<div class="muted">ပြီးတဲ့ ပွဲ မရှိသေးဘူး</div>'; }
  else {
    wrap.innerHTML = fin.slice(0, 30).map(function (f) {
      return '<div class="bet-row"><span>' + esc(f.home_mm || f.home) + ' vs ' + esc(f.away_mm || f.away) + '</span><b>' + f.home_goals + ' – ' + f.away_goals + '</b></div>';
    }).join('');
  }
  const note = $('fbResNote');
  if (note) note.textContent = 'API ကနေ auto ရောက်တဲ့ ရလဒ် — Admin ဖြည့်စရာ မလို';
  const pending = state.fixtures.filter(function (f) { return f.status !== 'finished'; }).length;
  const wR = $('wRes'); if (wR) wR.textContent = pending + ' ပွဲ';
  const hbR = $('hbRes'); if (hbR) hbR.textContent = pending + ' ပွဲ';
}

// fillWinInputs (v2.1, Pho Nov 16): after a save+reload the win inputs
// looked empty even though win_number was saved — fill them once on load
// from the latest sessions' saved win_number. Fill-once only: loadAll
// re-runs every 30s (auto-refresh), and re-filling would clobber a value
// the operator is typing. Only non-empty values are written.
let _winInputsFilled = false;
function fillWinInputs() {
  if (_winInputsFilled) return;
  _winInputsFilled = true;
  const v = L.winInputsFromSessions(state.sessions);
  if (v.am) $('win2dAm').value = v.am;
  if (v.pm) $('win2dPm').value = v.pm;
  if (v.round) $('win3d').value = v.round;
}
// saveWins: 2D/3D winning numbers are MANUAL — write win_number to the
// matching m23_sessions row, then run settlement (logic.settleSession).
async function saveWins() {
  var a = $('win2dAm').value.trim(), p = $('win2dPm').value.trim(), t = $('win3d').value.trim();
  if (!a && !p && !t) { toast('ပေါက်ဂဏန်း တစ်ခုခု ဖြည့်ပါ'); return; }
  if (!state.loaded) { toast('ပေါက်ဂဏန်း သိမ်းပြီ'); return; }
  const jobs = [];
  if (a) jobs.push({ game: '2d', period: 'am', win: a });
  if (p) jobs.push({ game: '2d', period: 'pm', win: p });
  if (t) jobs.push({ game: '3d', period: 'round', win: t });
  let settledAll = 0, paidAll = 0;
  for (const j of jobs) {
    const sess = latestSession(j.game, j.period);
    if (!sess) { toast(j.game.toUpperCase() + ' session မရှိသေးဘူး'); continue; }
    try {
      const updated = await PB.update('m23_sessions', sess.id, { win_number: j.win });
      sess.win_number = j.win;
      const coll = j.game === '2d' ? state.bets2d : state.bets3d;
      const bets = coll.filter(function (b) { return b.session === sess.id; });
      const r = await L.settleSession(PB, updated, bets, state.settings || {});
      settledAll += r.settled; paidAll += r.paidOut;
    } catch (e) {
      toast('သိမ်းလို့ မရဘူး — ' + (e.message || 'error'));
      return;
    }
  }
  renderBets(); renderSummary(); renderDashboard();
  toast('ပေါက်ဂဏန်း သိမ်းပြီ — ' + settledAll + ' ကွက် စာရင်းချုပ်၊ ' + fmt(paidAll) + ' ကျပ် ပေးပြီ');
}

// Football settlement trigger: run over all open m23_bets_fb rows whose
// fixtures are finished (feed job writes the results; Admin settles).
async function settleFootballNow() {
  if (!state.loaded) { toast('PocketBase ချိတ်ပြီးမှ settle လုပ်လို့ရတယ်'); return; }
  try {
    const byId = {};
    state.fixtures.forEach(function (f) { byId[f.id] = f; });
    const r = await L.settleFootball(PB, state.betsFb, byId, state.settings || {});
    await loadAll();
    toast('ဘောပွဲ စာရင်းချုပ် — ' + r.settled + ' ကွက်၊ ' + fmt(r.paidOut) + ' ကျပ်');
  } catch (e) {
    toast('settle လုပ်လို့ မရဘူး — ' + (e.message || 'error'));
  }
}

// ---------------------------------------------------------------- ledger
function setLedTab(t) {
  document.querySelectorAll('[data-led]').forEach(function (b) { b.classList.toggle('on', b.dataset.led === t); });
  $('ledPane2d').style.display = t === '2d' ? '' : 'none';
  $('ledPane3d').style.display = t === '3d' ? '' : 'none';
  $('ledPaneFb').style.display = t === 'fb' ? '' : 'none';
}
function limitOf(game) {
  if (game === '2d') return settingsOr('limit_2d') !== null ? settingsOr('limit_2d') : (parseInt($('limLed2d').value, 10) || 4000);
  if (game === '3d') return settingsOr('limit_3d') !== null ? settingsOr('limit_3d') : (parseInt($('limLed3d').value, 10) || 4000);
  return settingsOr('limit_fb') !== null ? settingsOr('limit_fb') : (parseInt($('limLedFb').value, 10) || 8000);
}
function syncLimitInputs() {
  if (!state.loaded || !state.settings) return;
  if (state.settings.limit_2d !== undefined) $('limLed2d').value = state.settings.limit_2d;
  if (state.settings.limit_3d !== undefined) $('limLed3d').value = state.settings.limit_3d;
  if (state.settings.limit_fb !== undefined) $('limLedFb').value = state.settings.limit_fb;
}
// Limit inputs read AND write m23_settings (limit_2d/limit_3d/limit_fb).
async function onLimitChange(game) {
  const inputId = game === '2d' ? 'limLed2d' : game === '3d' ? 'limLed3d' : 'limLedFb';
  const field = game === '2d' ? 'limit_2d' : game === '3d' ? 'limit_3d' : 'limit_fb';
  const v = parseInt($(inputId).value, 10) || 0;
  if (state.loaded && state.settingsId) {
    try {
      const patch = {}; patch[field] = v;
      state.settings = await PB.update('m23_settings', state.settingsId, patch);
    } catch (e) { toast('လီမစ် သိမ်းလို့ မရဘူး'); return; }
  }
  if (game === '2d') renderLedger2D();
  else if (game === '3d') renderLedger3D();
  else renderLedgerFb();
}
function totOf(tot) { return Object.keys(tot).reduce(function (a, k) { return a + tot[k]; }, 0); }
// One 00–99 grid for one 2D session's totals. Limit/blocked red is
// per-section (Admin v2.4): a number is red only when THIS session's total
// on it exceeds the limit (or it is blocked) — never because the other
// session pushed the combined total over.
function ledGridHtml(tot, lim, win) {
  var out = '';
  for (var i = 0; i < 100; i++) {
    var n = ('0' + i).slice(-2);
    var v = tot[n] || 0;
    // v2.10 (Pho Nov 19): the session's WINNING number is green — it beats
    // the red/purple classes (the draw is decided; "this number won" is
    // the operative fact). Null win = no green anywhere.
    var cls = (win && n === win) ? ' win' : L.cellClass(v, lim, BLOCKED['2d'].indexOf(n) >= 0);
    out += '<div class="led-cell' + cls + '"><b>' + n + '</b>' + (v ? fmt(v) : '–') + '</div>';
  }
  return out;
}
function renderLedger2D() {
  var lim = limitOf('2d');
  // Admin v2.4 am/pm split (Pho Nov 17): two grids, one per session.
  // The day total (ledSub2d + ledTot2d) is AM + PM and stays combined.
  var per = resolveAdminPeriod();
  var gAm = $('ledGrid2dAm'); if (gAm) gAm.innerHTML = ledGridHtml(LED2D_AM, lim, winOf('2d', 'am'));
  var gPm = $('ledGrid2dPm'); if (gPm) gPm.innerHTML = ledGridHtml(LED2D_PM, lim, winOf('2d', 'pm'));
  var tAm = totOf(LED2D_AM), tPm = totOf(LED2D_PM), tot = tAm + tPm;
  // Admin v2.5 LABEL FIX: the section heads in index.html already carry
  // the static 'မနက်ပိုင်း ·' / 'ညနေပိုင်း ·' prefix — the span must hold
  // ONLY the subtotal, or the period name renders twice
  // ('မနက်ပိုင်း · မနက်ပိုင်း စုစုပေါင်း …', seen on Pho's phone screenshot).
  const subAm = $('ledSub2dAm'); if (subAm) subAm.textContent = 'စုစုပေါင်း ' + fmt(tAm) + ' ကျပ်';
  const subPm = $('ledSub2dPm'); if (subPm) subPm.textContent = 'စုစုပေါင်း ' + fmt(tPm) + ' ကျပ်';
  const sub = $('ledSub2d'); if (sub) sub.textContent = 'စုစုပေါင်း ' + fmt(tot) + ' ကျပ်';
  const t2 = $('ledTot2d'); if (t2) t2.textContent = fmt(tot);
  // Admin v2.5 period switch: hide the non-selected section(s). The day
  // total above stays combined; only the sections follow the switch.
  const secAm = $('ledSec2dAm'); if (secAm) secAm.style.display = per === 'pm' ? 'none' : '';
  const secPm = $('ledSec2dPm'); if (secPm) secPm.style.display = per === 'am' ? 'none' : '';
}
function renderLedger3D() {
  var w = $('ledList3d');
  if (!w) return;
  var lim = limitOf('3d');
  var win = winOf('3d', 'round');
  var out = '';
  Object.keys(LED3D).sort().forEach(function (n) {
    var v = LED3D[n];
    var cls = (win && n === win) ? ' win' : L.cellClass(v, lim, BLOCKED['3d'].indexOf(n) >= 0);
    out += '<div class="bet-row' + cls + '"><span class="what">' + n + '</span><span class="amt">' + fmt(v) + ' ကျပ်</span></div>';
  });
  w.innerHTML = out || '<div class="muted">3D လောင်းကစား မရှိသေးဘူး</div>';
  const tot = Object.keys(LED3D).reduce(function (a, k) { return a + LED3D[k]; }, 0);
  const sub = $('ledSub3d'); if (sub) sub.textContent = 'စုစုပေါင်း ' + fmt(tot) + ' ကျပ်';
  const t3 = $('ledTot3d'); if (t3) t3.textContent = fmt(tot);
}
function renderLedgerFb() {
  var w = $('ledListFb');
  if (!w) return;
  var lim = limitOf('fb');
  var out = '';
  LEDFB.forEach(function (b) {
    const head = '<div class="bet-row' + (b.amt > lim ? ' over' : '') + '"><span><span class="who">' + esc(b.user) + '</span><br><span class="what">' + esc(b.what) + '</span></span><span class="amt">' + fmt(b.amt) + ' ကျပ်</span></div>';
    const det = b.bet ? fbDetailHtml(b.bet) : '';
    out += det ? '<div class="fb-bet">' + head + det + '</div>' : head;
  });
  w.innerHTML = out || '<div class="muted">ဘောပွဲ လောင်းကစား မရှိသေးဘူး</div>';
  const tot = LEDFB.reduce(function (a, b) { return a + (b.amt || 0); }, 0);
  const sub = $('ledSubFb'); if (sub) sub.textContent = 'စုစုပေါင်း ' + fmt(tot) + ' ကျပ်';
  const tF = $('ledTotFb'); if (tF) tF.textContent = fmt(tot);
  const tA = $('ledTotAll');
  if (tA) {
    const t2 = Object.keys(LED2D).reduce(function (a, k) { return a + LED2D[k]; }, 0);
    const t3 = Object.keys(LED3D).reduce(function (a, k) { return a + LED3D[k]; }, 0);
    tA.textContent = fmt(t2 + t3 + tot);
  }
}

// ---------------------------------------------------------------- big/small
function netSide(x, y, xName, yName) { return L.netSide(x, y, xName, yName); }
// ---------------------------------------------------------------- body ledger (v1.6)
// Ledger-format body list (Pho, approved mockup Nov 15): per-match card
// with odds header, amounts, red post-hedge net line and a gold hedge line.
// TAP a card -> hedge bottom sheet. No summary totals on this screen.
function amtCell(v) { return '<span class="' + (v ? '' : 'zero') + '">' + fmt(v || 0) + '</span>'; }
// Tap a passed match's card: no hedge sheet — the time has passed.
function toastKickoffPassed() { toast('ပွဲချိန် ကျော်သွားပြီ'); }
function renderBsBody() {
  var w = $('bsList');
  if (!w) return;
  // Time order (earliest first, unknown last); BODY_NET is the same array
  // openHedgeSheet indexes into, so sort it in place, not a copy.
  BODY_NET = L.sortBodyNetByKickoff(BODY_NET);
  var out = '';
  out += '<div class="ld-legend">⬆️ = ဂိုးပေါ် · ⬇️ = ဂိုးအောက် · {} = အကျန်</div>';
  out += '<div class="muted" style="margin:4px 0 8px">အကန် ထည့်ရန် / ပြင်ရန် ပွဲကို ဖိပါ · အချိန်အစဉ်လိုက်</div>';
  BODY_NET.forEach(function (m, idx) {
    var hedges = state.hedgeByMatch[m.key] || {};
    var bn = L.bodyNetOf(m), gn = L.goalNetOf(m);
    var bRem = L.remainingAfterHedge(bn.net, hedges.body ? hedges.body.amount : 0);
    var gRem = L.remainingAfterHedge(gn.net, hedges.goal ? hedges.goal.amount : 0);
    var bSide = bn.side === 'h' ? L.teamShort(m.home) : bn.side === 'a' ? L.teamShort(m.away) : '';
    var bTxt = bRem === 0 ? 'မျှ' : bSide + ' ' + fmt(bRem);
    var gTxt = gRem === 0 ? 'မျှ' : '{' + (gn.side === 'over' ? '⬆️' : '⬇️') + fmt(gRem) + '}';
    var hl = [];
    if (hedges.body) hl.push(L.hedgeLineText(hedges.body));
    if (hedges.goal) hl.push(L.hedgeLineText(hedges.goal));
    // Kickoff time (Yangon HH:MM) next to the header; a passed match is
    // muted and its tap only toasts — no hedge sheet, no save (v1.7).
    var passed = !L.canHedgeMatch(m);
    var koTime = L.formatKickoffYangon(m.kickoff_utc);
    var timeHtml = koTime ? '<span class="ld-time' + (passed ? ' passed' : '') + '">' + koTime + (passed ? ' · ပိတ်ပြီ' : '') + '</span>' : '';
    var cardCls = passed ? 'ld-card ld-passed' : 'ld-card';
    var tap = passed ? 'toastKickoffPassed()' : 'openHedgeSheet(' + idx + ')';
    out += '<div class="' + cardCls + '" tabindex="0" role="button" onclick="' + tap + '" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();' + tap + ';}">';
    out += '<div class="ld-head"><span>' + esc(L.ledgerHeaderText(m)) + '</span>' + timeHtml + '</div>';
    out += '<div class="ld-amt">' + amtCell(m.h) + amtCell(m.a) + '<span class="' + (m.over ? '' : 'zero') + '">⬆️' + fmt(m.over || 0) + '</span></div>';
    out += '<div class="ld-under"><span class="' + (m.under ? '' : 'zero') + '">⬇️' + fmt(m.under || 0) + '</span></div>';
    out += '<div class="ld-net"><span>အကျန်</span><span>' + esc(bTxt) + ' ' + esc(gTxt) + '</span></div>';
    if (hl.length) out += '<div class="m-hedged">' + esc(hl.join(' · ')) + '</div>';
    out += '</div>';
  });
  if (!BODY_NET.length) out += '<div class="muted">ဘော်ဒီ လောင်းကစား မရှိသေးဘူး</div>';
  out += '<button class="btn-block" onclick="openFbSum()" style="margin-top:10px">စာရင်းချုပ် ›</button>';
  w.innerHTML = out;
}
function bsBodyText() {
  // Ledger copy-all: per-match ledger format with post-hedge nets and
  // per-match အကန် lines appended (2D/3D 'N = V' tabs untouched).
  return L.ledgerCopyText(BODY_NET, state.hedgeByMatch);
}
var BS_LABEL = { '2d': '2D ကြီးငယ်စာရင်း', '3d': '3D ကြီးငယ်စာရင်း', 'body': 'ဘော်ဒီစာရင်း', 'parlay': 'မောင်းစာရင်း' };
var bsTab = '2d';
function setBsTab(t) {
  bsTab = t;
  document.querySelectorAll('[data-bs]').forEach(function (b) { b.classList.toggle('on', b.dataset.bs === t); });
  renderBs();
}
// One big/small section (Admin v2.4 am/pm split): a heading plus the
// section's biggest-first list, ranked 1..n within the section.
function bsSectionHtml(title, list, win) {
  var out = '<div class="sec-head">' + esc(title) + '</div>';
  var sorted = L.sortBsDesc(list || []);
  if (!sorted.length) { out += '<div class="muted">စာရင်း မရှိသေးဘူး</div>'; return out; }
  sorted.forEach(function (e, i) {
    // v2.10 (Pho Nov 19): the winning number's row is green.
    var wcls = (win && String(e.n) === String(win)) ? ' win' : '';
    out += '<div class="bs-row' + wcls + '"><span><span class="rank">' + (i + 1) + '.</span> <span class="num">' + esc(e.n) + ' = ' + e.v + '</span></span></div>';
  });
  return out;
}
function renderBs() {
  var w = $('bsList');
  if (!w) return;
  // Admin v2.5: the period pills show only on the 2D tab (3D / body /
  // parlay have no morning/evening split).
  var pr = $('perRowBs'); if (pr) pr.style.display = (bsTab === '2d') ? '' : 'none';
  if (bsTab === 'body') { renderBsBody(); return; }
  if (bsTab === '2d') {
    // Admin v2.4 am/pm split (Pho Nov 17): two biggest-first lists, one
    // per session — morning and evening are separate draws and must never
    // be mixed. Admin v2.5: the switch shows only the selected section(s).
    var per = resolveAdminPeriod();
    var out = '';
    if (per !== 'pm') out += bsSectionHtml('မနက်ပိုင်း', BS['2dAm'] || [], winOf('2d', 'am'));
    if (per !== 'am') out += bsSectionHtml('ညနေပိုင်း', BS['2dPm'] || [], winOf('2d', 'pm'));
    w.innerHTML = out;
    return;
  }
  // Parlay (v1.7): earliest leg kickoff first, unknown last; each leg
  // shows its kickoff time. 2D/3D stay biggest-first, untouched.
  var list = bsTab === 'parlay'
    ? L.sortParlayEntriesByKickoff(BS['parlay'] || [], fxById())
    : L.sortBsDesc(BS[bsTab] || []);
  var out = '';
  // v2.10 (Pho Nov 19): 3D list rows — the winning number's row is green.
  // Parlay rows never get it (win3 is null unless this is the 3D tab).
  var win3 = (bsTab === '3d') ? winOf('3d', 'round') : null;
  list.forEach(function (e, i) {
    var wcls = (win3 && String(e.n) === String(win3)) ? ' win' : '';
    var row = '<div class="bs-row' + wcls + '"><span><span class="rank">' + (i + 1) + '.</span> <span class="num">' + esc(e.n) + ' = ' + e.v + '</span></span></div>';
    if (bsTab === 'parlay' && e.bet) {
      // Parlay: one line per leg (match, pick, odds, kickoff time, outcome) + status.
      out += '<div class="fb-bet">' + row + fbDetailHtml(e.bet, true, fxById()) + '</div>';
    } else {
      out += row;
    }
  });
  w.innerHTML = out || '<div class="muted">စာရင်း မရှိသေးဘူး</div>';
}
function bsText() {
  if (bsTab === 'body') return bsBodyText();
  if (bsTab === '2d') {
    // Admin v2.7 (Pho Nov 17 15:49): copy follows the period switch — the
    // same sections the screen shows. Before this the copy always carried
    // BOTH sections whatever the switch said (flagged 09:28). 'both' keeps
    // the old both-sections copy.
    var per = resolveAdminPeriod();
    var lines = ['2D ကြီးငယ်စာရင်း'];
    var secs = [];
    if (per !== 'pm') secs.push(['မနက်ပိုင်း', BS['2dAm'] || []]);
    if (per !== 'am') secs.push(['ညနေပိုင်း', BS['2dPm'] || []]);
    secs.forEach(function (sec) {
      lines.push(sec[0] + ':');
      L.sortBsDesc(sec[1]).forEach(function (e, i) { lines.push((i + 1) + '. ' + e.n + ' = ' + e.v); });
    });
    return lines.join('\n');
  }
  var list = bsTab === 'parlay'
    ? L.sortParlayEntriesByKickoff(BS['parlay'] || [], fxById())
    : L.sortBsDesc(BS[bsTab] || []);
  var lines = [BS_LABEL[bsTab]];
  var fxMap = bsTab === 'parlay' ? fxById() : null;
  list.forEach(function (e, i) {
    lines.push((i + 1) + '. ' + e.n + ' = ' + e.v);
    if (bsTab === 'parlay' && e.bet) {
      lines.push('   ' + betStatusText(e.bet) + (((e.bet.status === 'won' || e.bet.status === 'settled') && e.bet.payout) ? ' · ရငွေ ' + e.bet.payout : ''));
      (e.bet.legs || []).forEach(function (l) { lines.push('   ' + legLine(l, true, fxMap)); });
    }
  });
  return lines.join('\n');
}
function copyBs() {
  var txt = bsText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { toast('ကော်ပီကူးပြီ'); }, function () { toast('ကော်ပီ မရဘူး'); });
  } else {
    toast('ကော်ပီ မရဘူး');
  }
}

// ---------------------------------------------------------------- fb summary (စာရင်းချုပ်, v1.6)
// Separate screen (reached from the body ledger): ထိုးသားစာရင်း + အကန်စာရင်း
// in Pho's EXACT one-line-per-entry format. NO aggregate totals anywhere.
function openFbSum() { renderFbSum(); go('scr-fbsum'); }
function renderFbSum() {
  var w = $('fbsumList');
  if (!w) return;
  var bettors = L.groupBettorEntries(state.betsFb, playerName);
  var hedges = L.groupHedgeEntries(state.hedges);
  var out = '';
  out += '<div class="fs-group"><div class="fs-head">ထိုးသားစာရင်း</div>';
  if (!bettors.length) { out += '<div class="muted">ထိုးသား မရှိသေးပါ</div>'; }
  bettors.forEach(function (g) {
    out += '<div class="fs-name">' + esc(g.name) + '</div>';
    g.lines.forEach(function (ln) { out += '<div class="fs-line">' + esc(ln) + '</div>'; });
  });
  out += '</div>';
  out += '<div class="fs-group"><div class="fs-head">အကန်စာရင်း</div>';
  if (!hedges.length) { out += '<div class="muted">အကန် မရှိသေးပါ</div>'; }
  hedges.forEach(function (g) {
    out += '<div class="fs-name">' + esc(g.bookie) + '</div>';
    g.lines.forEach(function (ln) { out += '<div class="fs-line">' + esc(ln) + '</div>'; });
  });
  out += '</div>';
  w.innerHTML = out;
}
function copyFbSum() {
  var bettors = L.groupBettorEntries(state.betsFb, playerName);
  var hedges = L.groupHedgeEntries(state.hedges);
  var txt = L.fbsumCopyText(bettors, hedges);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { toast('ကူးယူပြီးပါပြီ'); }, function () { toast('ကူးလို့ မရပါ'); });
  } else {
    toast('ကူးလို့ မရပါ');
  }
}

// ---------------------------------------------------------------- hedge sheet (v1.6)
// Bottom sheet opened by tapping a ledger card. Draft-only until Save;
// Cancel / ✕ / backdrop discards. Bookie = TEXT INPUT with a datalist of
// bookies already used (Pho adds names himself at entry time — no
// predefined list; the datalist starts empty and grows from his entries).
// A hedge amount is stored as entered (matching the approved mockup);
// the DISPLAYED remaining is capped at 0 and an over-net amount warns.
// Setting an amount to 0 deletes that hedge row.
var hedgeCtx = null; // { idx, m, bn, gn, existing }
function yangonToday() {
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function hedgeSheetRow(kind, label, net, draftAmt, draftBookie) {
  var rem = L.remainingAfterHedge(net, draftAmt || 0);
  return '<div class="hs-row" data-kind="' + kind + '">' +
    '<div class="hs-label">' + esc(label) + ' · အကျန် <b>' + fmt(net) + '</b></div>' +
    '<div class="hs-inputs">' +
      '<input id="hg-amt-' + kind + '" type="number" min="0" step="500" inputmode="numeric" placeholder="ကန်မည့် ပမာဏ" value="' + (draftAmt || '') + '" oninput="updateHedgeRemain(\'' + kind + '\')">' +
      '<input id="hg-bookie-' + kind + '" type="text" list="bookieList" placeholder="အကန်ဒိုင် နာမည်" value="' + esc(draftBookie || '') + '">' +
      '<button type="button" onclick="hedgeAllIn(\'' + kind + '\')">အကုန်ကန်</button>' +
    '</div>' +
    '<div class="hs-rem" id="hg-rem-' + kind + '">ကျန် ' + fmt(rem) + '</div>' +
    '<div class="hs-warn" id="hg-warn-' + kind + '" style="display:none">အကျန် ထက် များနေတယ် — ကျန် 0 ပဲ ဖြစ်မယ်</div>' +
  '</div>';
}
function openHedgeSheet(idx) {
  var m = BODY_NET[idx];
  if (!m) return;
  // v1.7: a passed match cannot be hedged (plain kickoff rule, no 5-min
  // window — that lives in the Player app).
  if (!L.canHedgeMatch(m)) { toast('ပွဲချိန် ကျော်သွားပြီ'); return; }
  var bn = L.bodyNetOf(m), gn = L.goalNetOf(m);
  var existing = state.hedgeByMatch[m.key] || { body: null, goal: null };
  hedgeCtx = { idx: idx, m: m, bn: bn, gn: gn, existing: existing };
  $('hedgeSheetTitle').textContent = L.ledgerHeaderText(m);
  // Datalist of bookies already used (grows from Pho's entries).
  var dl = $('bookieList');
  if (dl) dl.innerHTML = L.usedBookies(state.hedges).map(function (b) { return '<option value="' + esc(b) + '">'; }).join('');
  var body = '';
  var hasRow = false;
  // A row shows when the net > 0 OR a hedge already exists for that kind
  // (so an existing hedge on a 0 net can still be seen and cleared).
  if (bn.net > 0 || existing.body) {
    var bSide = bn.side === 'h' ? L.teamShort(m.home) : bn.side === 'a' ? L.teamShort(m.away) : L.teamShort(m.home);
    body += hedgeSheetRow('body', 'ဘော်ဒီ — ' + bSide, bn.net, existing.body ? existing.body.amount : '', existing.body ? existing.body.bookie : '');
    hasRow = true;
  }
  if (gn.net > 0 || existing.goal) {
    var gLabel = gn.side === 'over' ? '⬆️ ဂိုးပေါ်' : gn.side === 'under' ? '⬇️ ဂိုးအောက်' : 'ဂိုးပေါင်း';
    body += hedgeSheetRow('goal', 'ဂိုးပေါင်း — ' + gLabel, gn.net, existing.goal ? existing.goal.amount : '', existing.goal ? existing.goal.bookie : '');
    hasRow = true;
  }
  if (!hasRow) body = '<div class="muted">မျှ — ကန်စရာ မရှိ</div>';
  $('hedgeSheetBody').innerHTML = body;
  var saveBtn = $('hedgeSaveBtn');
  if (saveBtn) saveBtn.style.display = hasRow ? '' : 'none';
  $('hedgeBackdrop').classList.add('open');
  $('hedgeSheet').classList.add('open');
}
function closeHedgeSheet() {
  hedgeCtx = null;
  var bd = $('hedgeBackdrop'); if (bd) bd.classList.remove('open');
  var sh = $('hedgeSheet'); if (sh) sh.classList.remove('open');
}
function hedgeAllIn(kind) {
  if (!hedgeCtx) return;
  var net = kind === 'body' ? hedgeCtx.bn.net : hedgeCtx.gn.net;
  var inp = $('hg-amt-' + kind);
  if (inp) { inp.value = net; updateHedgeRemain(kind); }
}
function updateHedgeRemain(kind) {
  if (!hedgeCtx) return;
  var net = kind === 'body' ? hedgeCtx.bn.net : hedgeCtx.gn.net;
  var inp = $('hg-amt-' + kind);
  var amt = inp ? (parseInt(inp.value, 10) || 0) : 0;
  var rem = L.remainingAfterHedge(net, amt);
  var remEl = $('hg-rem-' + kind);
  if (remEl) remEl.textContent = 'ကျန် ' + fmt(rem);
  var warnEl = $('hg-warn-' + kind);
  if (warnEl) warnEl.style.display = amt > net ? '' : 'none';
  if (inp) inp.classList.toggle('over', amt > net);
}
async function saveHedgeSheet() {
  if (!hedgeCtx) return;
  // v1.7: refuse to save a hedge for a match whose kickoff has passed
  // (the sheet could have been open across kickoff).
  if (!L.canHedgeMatch(hedgeCtx.m)) { toast('ပွဲချိန် ကျော်သွားပြီ'); return; }
  var m = hedgeCtx.m;
  var fx = fixtureById(m.key);
  var drafts = { body: null, goal: null };
  var kinds = ['body', 'goal'];
  for (var i = 0; i < kinds.length; i++) {
    var kind = kinds[i];
    var net = kind === 'body' ? hedgeCtx.bn.net : hedgeCtx.gn.net;
    var ex = kind === 'body' ? hedgeCtx.existing.body : hedgeCtx.existing.goal;
    if (net <= 0 && !ex) continue; // no row shown for this kind; leave it alone
    var amtInp = $('hg-amt-' + kind);
    var bookieInp = $('hg-bookie-' + kind);
    var amt = amtInp ? Math.max(0, parseInt(amtInp.value, 10) || 0) : 0;
    var bookie = bookieInp ? (bookieInp.value || '').trim() : '';
    if (amt > 0 && !bookie) { toast('အကန်ဒိုင် နာမည် ထည့်ပါ'); return; }
    if (amt > 0) {
      drafts[kind] = { amount: amt, bookie: bookie };
      if (kind === 'goal') drafts[kind].side = hedgeCtx.gn.side || '';
    }
    // amt == 0 leaves drafts[kind] null -> saveHedges deletes the row.
  }
  var matchInfo = {
    fixtureApiId: (fx && fx.api_id) || m.key,
    date: (fx && fx.date) || yangonToday(),
    home: m.home || '',
    away: m.away || '',
    bodyOdds: m.bodyOdds || '',
    goalOdds: m.goalOdds || '',
    bodyTeam: hedgeCtx.bn.side === 'h' ? L.teamShort(m.home) : hedgeCtx.bn.side === 'a' ? L.teamShort(m.away) : L.teamShort(m.home),
    goalTeam: L.teamShort(m.home)
  };
  try {
    await L.saveHedges(PB, hedgeCtx.existing, matchInfo, drafts);
    state.hedges = await L.loadHedges(PB);
    recomputeFromLive();
    renderBsBody();
    renderFbSum();
    closeHedgeSheet();
    toast('သိမ်းပြီးပါပြီ');
  } catch (e) {
    toast('အကန် သိမ်းလို့ မရဘူး');
  }
}

// ---------------------------------------------------------------- blocked numbers
var blockedGame = '2d';
function setBlockedGame(g) {
  blockedGame = g;
  document.querySelectorAll('[data-bg]').forEach(function (b) { b.classList.toggle('on', b.dataset.bg === g); });
  $('blockedInput').placeholder = g === '2d' ? 'ဂဏန်း ရိုက်ပါ (ဥပမာ 45)' : 'ဂဏန်း ရိုက်ပါ (ဥပမာ 357)';
  $('blockedInput').maxLength = g === '2d' ? 2 : 3;
  renderBlocked();
}
function renderBlocked() {
  var w = $('blockedChips');
  if (!w) return;
  var list = BLOCKED[blockedGame];
  if (!list.length) { w.innerHTML = '<span class="muted">ပိတ်ဂဏန်း မရှိသေးဘူး</span>'; return; }
  w.innerHTML = list.map(function (n) {
    return '<span class="chip">' + esc(n) + ' <button onclick="removeBlocked(\'' + esc(n) + '\')">×</button></span>';
  }).join('');
}
async function persistBlocked() {
  if (!state.loaded || !state.settingsId) return;
  try {
    state.settings = await PB.update('m23_settings', state.settingsId, {
      blocked_2d: BLOCKED['2d'], blocked_3d: BLOCKED['3d']
    });
  } catch (e) { toast('ပိတ်ဂဏန်း သိမ်းလို့ မရဘူး'); }
}
async function addBlocked() {
  var inp = $('blockedInput');
  var n = (inp.value || '').trim();
  var need = blockedGame === '2d' ? 2 : 3;
  if (n.length !== need || !/^\d+$/.test(n)) { toast(blockedGame === '2d' ? '2D ဆို ဂဏန်း ၂ လုံး ရိုက်ပါ' : '3D ဆို ဂဏန်း ၃ လုံး ရိုက်ပါ'); return; }
  if (BLOCKED[blockedGame].indexOf(n) >= 0) { toast('ပိတ်ပြီးသား ဂဏန်းပါ'); return; }
  BLOCKED[blockedGame].push(n);
  inp.value = '';
  renderBlocked(); renderLedger2D(); renderLedger3D();
  await persistBlocked();
  toast(n + ' ပိတ်လိုက်ပြီ');
}
async function removeBlocked(n) {
  var i = BLOCKED[blockedGame].indexOf(n);
  if (i >= 0) BLOCKED[blockedGame].splice(i, 1);
  renderBlocked(); renderLedger2D(); renderLedger3D();
  await persistBlocked();
  toast(n + ' ပြန်ဖွင့်လိုက်ပြီ');
}

// ---------------------------------------------------------------- dashboard / summary / settings
function renderDashboard() {
  if (!state.loaded) return;
  const todayBets = state.bets2d.filter(isTodayBet).length + state.bets3d.filter(isTodayBet).length + state.betsFb.filter(isTodayBet).length;
  const todayStake = state.bets2d.filter(isTodayBet).reduce(function (a, b) { return a + (b.total || 0); }, 0) +
    state.bets3d.filter(isTodayBet).reduce(function (a, b) { return a + (b.total || 0); }, 0) +
    state.betsFb.filter(isTodayBet).reduce(function (a, b) { return a + (b.stake || 0); }, 0);
  $('stBets').textContent = todayBets;
  $('stPlayers').textContent = state.players.length;
  $('stStake').textContent = fmt(todayStake);
  const hbB = $('hbBets'); if (hbB) hbB.textContent = todayBets + ' ကွက်';
  const hbL = $('hbLedger');
  if (hbL) {
    const t2 = Object.keys(LED2D).reduce(function (a, k) { return a + LED2D[k]; }, 0);
    const t3 = Object.keys(LED3D).reduce(function (a, k) { return a + LED3D[k]; }, 0);
    const tf = LEDFB.reduce(function (a, b) { return a + (b.amt || 0); }, 0);
    hbL.textContent = fmt(t2 + t3 + tf) + ' ကျပ်';
  }
  function isTodayBet(b) { return isToday(b.created); }
}
// Summary game tabs (Admin v2.11, Pho Nov 20): the စာရင်းချုပ် screen is
// split by game — 2D / 3D / ဘောပွဲ (1D) — each with its own natural period
// on the picked date (shared state.adminDate, same calendar as the other
// screens):
//   2D  = the week containing the date (Mon–Fri; Friday-evening total).
//   3D  = the round containing the date (1st or 16th draw).
//   1D  = the picked day itself.
// The top cards, the per-user list and (1D only) the football/hedge nets all
// follow the tab + date. The pending top-up/withdraw rows stay GLOBAL —
// they are "waiting right now", not period totals. ကစားသမား counts only
// players who bet in the shown period (not every registered player).
// No manual "close the week" action: the week is computed from the date, so
// on Monday the picked date's week is the new week — tap the calendar back
// to Friday (or Yesterday) to see last week's closed total.
function setSumTab(t) {
  if (t !== '2d' && t !== '3d' && t !== 'fb') return;
  state.sumTab = t;
  document.querySelectorAll('[data-sum]').forEach(function (b) {
    b.classList.toggle('on', b.dataset.sum === t);
  });
  renderSummary();
}
function renderSummary() {
  if (!state.loaded) return;
  const ymd = ensureAdminDate();
  const tab = state.sumTab || '2d';
  const sess = state.sessions || [];
  // Period for the active tab, and the bets in it. Bets whose date cannot be
  // resolved are EXCLUDED here (L.betInRange / L.betOnDate) — see logic.js.
  var bets = [], periodLabel = '';
  if (tab === '2d') {
    const w = L.weekRange(ymd) || { mon: ymd, fri: ymd };
    bets = state.bets2d.filter(function (b) { return L.betInRange(b, sess, '2d', w.mon, w.fri); });
    periodLabel = 'တပတ်: ' + L.fmtDateOnly(w.mon) + ' – ' + L.fmtDateOnly(w.fri);
  } else if (tab === '3d') {
    const r = L.roundForDate(ymd) || ymd;
    bets = state.bets3d.filter(function (b) { return L.betOnDate(b, sess, '3d', r); });
    periodLabel = 'ပွဲစဉ်: ' + L.fmtDateOnly(r) + ' ' + L.weekdayNameMm(r);
  } else {
    bets = state.betsFb.filter(function (b) { return L.betOnDate(b, sess, 'fb', ymd); });
    periodLabel = 'နေ့: ' + L.fmtDateOnly(ymd);
  }
  const amtOf = function (b) { return b.total || b.stake || 0; };
  const stake = bets.reduce(function (a, b) { return a + amtOf(b); }, 0);
  $('sumStake').textContent = fmt(stake);
  const plEl = $('sumPeriodLabel');
  if (plEl) plEl.textContent = periodLabel;
  // Football + hedge nets (1D tab only; the card hides on the 2D/3D tabs).
  const fbWrap = $('sumFbWrap');
  if (fbWrap) fbWrap.style.display = tab === 'fb' ? '' : 'none';
  const fbById = {};
  state.fixtures.forEach(function (f) { fbById[f.id] = f; });
  const fbNetEl = $('sumFbNet');
  if (fbNetEl) fbNetEl.textContent = fmt(-L.footballDailyTotal(bets, fbById, state.settings || {})) + ' ကျပ်';
  // Bettor profit/loss detail (Pho Nov 15 09:00): each settled football bet
  // shows gross (net), e.g. '+100000 (+95000)'; Total = sum of nets
  // (Pho's example: +95000 and -100000 total -5000). This is the PLAYERS'
  // view; the bookie's net above is its negative.
  let fbTotal = 0;
  const fbLines = [];
  const fbNetByUser = {}; // bookie's net per player (v2.14): -player profit
  bets.forEach(function (b) {
    const d = L.footballDailyDetail(b, fbById, state.settings || {});
    if (!d) return;
    fbTotal += d.net;
    fbNetByUser[b.player] = (fbNetByUser[b.player] || 0) - d.net;
    const gs = (d.gross >= 0 ? '+' : '') + fmt(d.gross);
    const ns = (d.net >= 0 ? '+' : '') + fmt(d.net);
    fbLines.push(gs + ' (' + ns + ')');
  });
  const fbDetailEl = $('sumFbDetail');
  if (fbDetailEl) {
    fbDetailEl.innerHTML = fbLines.length
      ? fbLines.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '<div><b>Total ' + fmt(fbTotal) + '</b></div>'
      : '<div>ဘောပွဲ မရှိသေးပါ</div>';
  }
  // Net profit (v2.13, Pho Nov 20, option A): stake - payouts, counting ONLY
  // settled bets. 2D/3D: sessions whose win_number is set (L.periodNet2D3D);
  // a session not drawn yet is excluded entirely. Football: -fbTotal (the
  // bookie's net; fbLines holds settled bets only). '—' when nothing in the
  // period is settled yet; negative shows red via the warn class.
  let netTxt = '—', netNeg = false, netVal = null;
  if (tab === 'fb') {
    if (fbLines.length) { const n = -fbTotal; netTxt = fmt(n); netNeg = n < 0; netVal = n; }
  } else {
    const r = L.periodNet2D3D(bets, sess, state.settings || {}, tab);
    if (r.settled > 0) { netTxt = fmt(r.net); netNeg = r.net < 0; netVal = r.net; }
  }
  const netEl = $('sumNet'); if (netEl) netEl.textContent = netTxt;
  const netStat = $('sumNetStat'); if (netStat) netStat.classList.toggle('warn', netNeg);
  // Per-user NET (v2.14, Pho Nov 20): the list shows ONLY each user's
  // remaining money (profit/loss), never the stake. 2D/3D via
  // L.periodNetByUser (settled sessions only, option A); football via the
  // settled detail lines above. Users with no settled bet in the period
  // do not appear. Signed (+ profit / - loss), red when negative.
  const perUserNet = tab === 'fb' ? fbNetByUser : L.periodNetByUser(bets, sess, state.settings || {}, tab);
  const perUserIds = Object.keys(perUserNet);
  const netRow = function (label, n, bold) {
    const sign = n >= 0 ? '+' : '';
    const cls = n < 0 ? ' class="amt neg"' : ' class="amt"';
    const w = bold ? '<b>' + label + '</b>' : label;
    const v = bold ? '<b>' + sign + fmt(n) + ' ကျပ်</b>' : sign + fmt(n) + ' ကျပ်';
    return '<div class="bet-row"><span class="who">' + w + '</span><span' + cls + '>' + v + '</span></div>';
  };
  $('sumPerUser').innerHTML = perUserIds.length
    ? perUserIds.map(function (pid) { return netRow(esc(playerName(pid)), perUserNet[pid], false); }).join('') + netRow('Total', netVal, true)
    : '<div class="muted">ယူဆာ မရှိသေးဘူး</div>';
  // Hedge profit/loss (v1.6, Pho Nov 15 08:56): the 1.5% rebate lives HERE,
  // in the hedge profit/loss — win x0.965, loss x0.985. Each settled hedge
  // shows gross (net), e.g. '+10000 (+9650)'; Total = sum of nets (Pho's
  // example: +9650 and -9850 total -200). Hedges keyed by api_id, filtered
  // to the picked day by their fixture's kickoff Yangon date.
  const fxByApi = {};
  state.fixtures.forEach(function (f) { if (f.api_id) fxByApi[f.api_id] = f; });
  let hedgeTotal = 0;
  const hedgeLines = [];
  (state.hedges || []).forEach(function (h) {
    const fx = fxByApi[h.fixture];
    if (!fx || L.yangonDateOf(fx.kickoff) !== ymd) return;
    const s = L.settleHedge(h, fxByApi);
    if (!s) return;
    const net = L.hedgeDailyResult(h, fxByApi);
    if (net === null || net === undefined) return;
    hedgeTotal += net;
    const g = s.gross;
    const gs = (g >= 0 ? '+' : '') + fmt(g);
    const ns = (net >= 0 ? '+' : '') + fmt(net);
    hedgeLines.push(gs + ' (' + ns + ')');
  });
  const hedgeNetEl = $('sumHedgeNet');
  if (hedgeNetEl) hedgeNetEl.textContent = fmt(hedgeTotal) + ' ကျပ်';
  const hedgeDetailEl = $('sumHedgeDetail');
  if (hedgeDetailEl) {
    hedgeDetailEl.innerHTML = hedgeLines.length
      ? hedgeLines.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '<div><b>Total ' + fmt(hedgeTotal) + '</b></div>'
      : '<div>အကန် မရှိသေးပါ</div>';
  }
  // Pending top-up/withdraw — GLOBAL, not period totals.
  const pend = state.requests.filter(function (r) { return r.status === 'pending'; });
  const inR = pend.filter(function (r) { return r.kind === 'topup'; });
  const outR = pend.filter(function (r) { return r.kind === 'withdraw'; });
  $('sumIn').textContent = fmt(inR.reduce(function (a, r) { return a + (r.amount || 0); }, 0)) + ' ကျပ် (' + inR.length + ' ခု)';
  $('sumOut').textContent = fmt(outR.reduce(function (a, r) { return a + (r.amount || 0); }, 0)) + ' ကျပ် (' + outR.length + ' ခု)';
}
function renderSettings() {
  if (!state.loaded || !state.settings) return;
  const s = state.settings;
  if (s.rate_2d !== undefined) $('rate2d').value = s.rate_2d;
  if (s.rate_3d !== undefined) $('rate3d').value = s.rate_3d;
  if (s.max_legs !== undefined) $('maxLegs').value = s.max_legs;
  if (s.min_fb !== undefined) $('minFb').value = s.min_fb;
  if (s.min_2d3d !== undefined) $('min23').value = s.min_2d3d;
  // Fix #5: populate the close-time inputs from the latest sessions'
  // saved close_at (HH:MM out of 'YYYY-MM-DD HH:MM:SS' or ISO). Without
  // this the inputs always showed the hardcoded HTML defaults (11:55 /
  // 15:55 / 16:00). No session/close_at for a slot -> keep the default.
  const sAm = latestSession('2d', 'am');
  const sPm = latestSession('2d', 'pm');
  const s3 = latestSession('3d', 'round');
  let t;
  if (sAm && (t = timeFromCloseAt(sAm.close_at))) $('close2dAm').value = t;
  if (sPm && (t = timeFromCloseAt(sPm.close_at))) $('close2dPm').value = t;
  if (s3 && (t = timeFromCloseAt(s3.close_at))) $('close3d').value = t;
}
// 'YYYY-MM-DD HH:MM:SS' or ISO 'YYYY-MM-DDTHH:MM:SS.000Z' -> 'HH:MM'.
// saveSettings writes the space format, so the digits round-trip as saved.
function timeFromCloseAt(closeAt) {
  if (!closeAt) return null;
  const m = String(closeAt).match(/(\d{2}):(\d{2})/);
  return m ? m[1] + ':' + m[2] : null;
}
// saveCloseAt (v1.9): write one session's close_at from its picked time.
// Skips silently when there is no session, no time, or the session date
// cannot be parsed (buildCloseAt returns null). A failed write toasts but
// never throws, so it cannot abort the other close_at writes or the
// settings save.
async function saveCloseAt(session, time) {
  if (!session || !time) return;
  const closeAt = L.buildCloseAt(session.date, time);
  if (!closeAt) return;
  try {
    await PB.update('m23_sessions', session.id, { close_at: closeAt });
  } catch (e) {
    toast('ပိတ်ချိန် သိမ်းလို့ မရဘူး — ' + (e.message || 'error'));
  }
}
function renderHomeSessions() {
  if (!state.loaded) return;
  // Toggles show the latest session per game; the football row has no
  // m23_sessions row (football auto-closes per match in the player app).
  const s2 = latestSession('2d');
  const s3 = latestSession('3d');
  const rows = document.querySelectorAll('#scr-home .set-row');
  if (rows[0]) {
    rows[0].querySelector('span').textContent = '2D — ' + (s2 ? (s2.label || (s2.date + ' ' + s2.period)) : 'session မရှိသေးဘူး');
    rows[0].querySelector('.toggle').classList.toggle('on', !!(s2 && s2.open));
  }
  if (rows[1]) {
    rows[1].querySelector('span').textContent = '3D — ' + (s3 ? (s3.label || s3.date) : 'session မရှိသေးဘူး');
    rows[1].querySelector('.toggle').classList.toggle('on', !!(s3 && s3.open));
  }
  if (rows[2]) {
    // Football has no session row: its on/off lives in m23_settings.football_enabled (default ON).
    const fbOn = !state.settings || state.settings.football_enabled !== false;
    rows[2].querySelector('.toggle').classList.toggle('on', fbOn);
  }
}

// Session open/close toggles on Home write m23_sessions.open.
// Football has no session row: its toggle flips m23_settings.football_enabled
// (Pho Nov 13 — real on/off switch; player greys မောင်း/ဘော်ဒီ when OFF).
// The per-match auto-close (5 min before kickoff) still lives in the player app.
async function toggleSession(game, period, btn) {
  if (!state.loaded) {
    btn.classList.toggle('on');
    toast(btn.classList.contains('on') ? 'ဖွင့်ပြီ' : 'ပိတ်ပြီ');
    return;
  }
  if (game === 'fb') {
    // Football on/off switch (Pho Nov 13, option A): flips m23_settings.football_enabled.
    // Default ON when the field is missing; the player app greys မောင်း/ဘော်ဒီ when OFF.
    const curOn = !state.settings || state.settings.football_enabled !== false;
    const next = !curOn;
    try {
      if (state.settingsId) {
        state.settings = await PB.update('m23_settings', state.settingsId, { football_enabled: next });
      } else {
        state.settings = await PB.create('m23_settings', { key: 'main', football_enabled: next });
        state.settingsId = state.settings.id;
      }
      btn.classList.toggle('on', next);
      toast('ဘောပွဲ ' + (next ? 'ဖွင့်ပြီ' : 'ပိတ်ပြီ'));
    } catch (e) {
      toast('ပြောင်းလို့ မရဘူး — ' + (e.message || 'error'));
    }
    return;
  }
  const sess = latestSession(game, period);
  if (!sess) { toast('session မရှိသေးဘူး'); return; }
  const next = !sess.open;
  try {
    await PB.update('m23_sessions', sess.id, { open: next });
    sess.open = next;
    btn.classList.toggle('on', next);
    toast((game === '2d' ? '2D' : '3D') + (next ? ' ဖွင့်ပြီ' : ' ပိတ်ပြီ'));
  } catch (e) {
    toast('ပြောင်းလို့ မရဘူး — ' + (e.message || 'error'));
  }
}

// saveSettings: write the single m23_settings row (key=main). Close-time
// fields map to m23_sessions.close_at (display only; the open flag enforces).
async function saveSettings() {
  if (!state.loaded) { toast('သတ်မှတ်ချက် သိမ်းပြီ'); return; }
  const body = {
    rate_2d: parseInt($('rate2d').value, 10) || 9000,
    rate_3d: parseInt($('rate3d').value, 10) || 65000,
    max_legs: parseInt($('maxLegs').value, 10) || 10,
    min_fb: parseInt($('minFb').value, 10) || 500,
    min_2d3d: parseInt($('min23').value, 10) || 100,
    blocked_2d: BLOCKED['2d'],
    blocked_3d: BLOCKED['3d']
  };
  try {
    if (state.settingsId) {
      state.settings = await PB.update('m23_settings', state.settingsId, body);
    } else {
      body.key = 'main';
      state.settings = await PB.create('m23_settings', body);
      state.settingsId = state.settings.id;
    }
    // Close times -> close_at on the latest matching sessions (display only).
    // v1.9: each write is independent (saveCloseAt) — the old code glued the
    // raw ISO session date to the time ("2026-11-15 17:30:00.000Z 12:00:00"),
    // which PocketBase rejected (400), so the first failed write aborted the
    // rest and nothing was ever stored.
    const closeAm = $('close2dAm').value, closePm = $('close2dPm').value, close3d = $('close3d').value;
    const sAm = latestSession('2d', 'am');
    const sPm = latestSession('2d', 'pm');
    const s3 = latestSession('3d', 'round');
    await saveCloseAt(sAm, closeAm);
    await saveCloseAt(sPm, closePm);
    await saveCloseAt(s3, close3d);
    toast('သတ်မှတ်ချက် သိမ်းပြီ');
  } catch (e) {
    toast('သိမ်းလို့ မရဘူး — ' + (e.message || 'error'));
  }
}

// ---------------------------------------------------------------- init
ensureAdminDate();
syncAdminDateText();
syncAdminPeriod();
renderBs();
renderBlocked();
renderLedger2D(); renderLedger3D(); renderLedgerFb();
updPend();
boot();

// Inline onclick handlers in index.html resolve to these globals.
window.go = go;
window.toast = toast;
window.setReqTab = setReqTab;
window.toggleUser = toggleUser;
window.setBsTab = setBsTab;
window.setAdminPeriod = setAdminPeriod;
window.copyBs = copyBs;
window.setLedTab = setLedTab;
window.setSumTab = setSumTab;
window.setBlockedGame = setBlockedGame;
window.addBlocked = addBlocked;
window.removeBlocked = removeBlocked;
window.renderLedger2D = renderLedger2D;
window.renderLedger3D = renderLedger3D;
window.renderLedgerFb = renderLedgerFb;
window.approveReq = approveReq;
window.rejectReq = rejectReq;
window.createPlayer = createPlayer;
window.saveWins = saveWins;
window.saveSettings = saveSettings;
window.toggleSession = toggleSession;
window.onLimitChange = onLimitChange;
window.loginAdmin = loginAdmin;
window.settleFootballNow = settleFootballNow;
window.openFbSum = openFbSum;
window.renderFbSum = renderFbSum;
window.copyFbSum = copyFbSum;
window.openHedgeSheet = openHedgeSheet;
window.toastKickoffPassed = toastKickoffPassed;
window.closeHedgeSheet = closeHedgeSheet;
window.openAdminCal = openAdminCal;
window.closeAdminCal = closeAdminCal;
window.adminCalMove = adminCalMove;
window.adminCalPick = adminCalPick;
window.adminCalQuick = adminCalQuick;
window.hedgeAllIn = hedgeAllIn;
window.updateHedgeRemain = updateHedgeRemain;
window.saveHedgeSheet = saveHedgeSheet;

// Named exports for Node tests (browser module load ignores them).
export { timeFromCloseAt, resText, betStatusText, betStatusClass, legLine, fbDetailHtml, nextAccountNumber };
export { renderAll, renderBets, renderLedger2D, renderLedger3D, renderLedgerFb, renderBs, bsText, recomputeFromLive, setBsTab, setLedTab, setSumTab, renderSummary };
export { ensureAdminDate, setAdminDate, syncAdminDateText, openAdminCal, closeAdminCal, renderAdminCal, adminCalMove, adminCalPick, adminCalQuick };
export { resolveAdminPeriod, setAdminPeriod, syncAdminPeriod };
// Test hook (Node tests only): replace the live state + aggregates wholesale
// so the render functions can be exercised without PocketBase.
export function setTestState(patch) {
  if (patch.state) Object.assign(state, patch.state);
  if (patch.LED2D !== undefined) LED2D = patch.LED2D;
  if (patch.LED2D_AM !== undefined) LED2D_AM = patch.LED2D_AM;
  if (patch.LED2D_PM !== undefined) LED2D_PM = patch.LED2D_PM;
  if (patch.LED3D !== undefined) LED3D = patch.LED3D;
  if (patch.LEDFB !== undefined) LEDFB = patch.LEDFB;
  if (patch.BS !== undefined) BS = patch.BS;
  if (patch.BODY_NET !== undefined) BODY_NET = patch.BODY_NET;
}
export function getTestState() { return state; }
