// admin.js — 23မောင်း Admin app wiring (ES module).
// Base = admin mockup v2.4 (UI, layout, CSS, Burmese labels unchanged).
// Data comes from PocketBase (pb.js) per 23maung-schema.md. Until the
// collections exist / Admin logs in, the mockup's sample data stays on
// screen and every action falls back to the mockup's local behaviour.
import * as PB from './pb.js';
import * as L from './logic.js';

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
  txs: []              // m23_wallet_tx (summary only)
};

// Mockup sample data (kept as the pre-login / offline fallback).
var LED2D = { '09': 5000, '12': 1500, '21': 1500, '45': 5000, '78': 5000, '90': 5000, '99': 5000 };
var LED3D = { '357': 5000, '123': 1000, '321': 1000 };
var LEDFB = [
  { user: 'User002', what: 'မောင်း 3 ပွဲ — မန်စီးတီး · လာဇီယို · ရိုးမား', amt: 5000 },
  { user: 'User003', what: 'ဘော်ဒီ — ရိုးမား 1-5', amt: 10000 },
  { user: 'User001', what: 'ဂိုးပေါ် — မန်စီးတီး vs ဖူလ်ဟမ် 3+25', amt: 2000 }
];
var BS = {
  '2d': [ { n: '12', v: 7500 }, { n: '65', v: 6500 }, { n: '45', v: 2500 } ],
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
async function loadAll() {
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
    state.players = await PB.getAll('m23_players', { sort: 'name' });
    state.requests = await PB.getAll('m23_requests', { sort: '-created' });
    state.bets2d = await PB.getAll('m23_bets_2d', { sort: '-created' });
    state.bets3d = await PB.getAll('m23_bets_3d', { sort: '-created' });
    state.betsFb = await PB.getAll('m23_bets_fb', { sort: '-created' });
    state.fixtures = await PB.getAll('m23_fixtures', { sort: '-kickoff_utc' });
    state.txs = await PB.getAll('m23_wallet_tx', { sort: '-created', perPage: 200 });
    state.loaded = true;
    recomputeFromLive();
    renderAll();
    toast('ဒေတာ ရောက်ပြီ');
  } catch (e) {
    // Collections may not exist yet (parent creates them) or network failed:
    // keep the mockup sample data on screen, do not blank the app.
    state.loaded = false;
    toast('PocketBase ချိတ်မရဘူး — နမူနာ ဒေတာ ပြနေတယ်');
  }
}

// Recompute every mockup aggregate from the live bet rows.
function recomputeFromLive() {
  const cur2d = latestSession('2d');
  const cur3d = latestSession('3d');
  const b2 = cur2d ? state.bets2d.filter(function (b) { return b.session === cur2d.id; }) : state.bets2d;
  const b3 = cur3d ? state.bets3d.filter(function (b) { return b.session === cur3d.id; }) : state.bets3d;
  LED2D = L.aggregate2D(b2);
  LED3D = L.aggregate3D(b3);
  LEDFB = state.betsFb.map(function (b) {
    return { user: playerName(b.player), what: fbBetLabel(b), amt: b.stake || b.total || 0 };
  });
  BS = {
    '2d': L.bsEntriesFromTotals(L.aggregate2D(state.bets2d)),
    '3d': L.bsEntriesFromTotals(L.aggregate3D(state.bets3d)),
    'parlay': L.sortBsDesc(state.betsFb.filter(function (b) { return b.type === 'parlay'; }).map(function (b) {
      return { n: playerName(b.player) + ' — မောင်း ' + (b.legs || []).length + ' ပွဲ', v: b.stake || 0 };
    }))
  };
  BODY_NET = L.computeBodyNet(state.betsFb);
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

function renderAll() {
  renderRequests();
  renderBets();
  renderLedger2D(); renderLedger3D(); renderLedgerFb();
  renderBs(); renderBlocked(); updPend();
  renderDashboard(); renderSummary(); renderResults(); renderSettings(); renderHomeSessions();
  syncLimitInputs();
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

// ---------------------------------------------------------------- bets tab
function renderBets() {
  if (!state.loaded) return; // keep the mockup's three sample user cards
  const wrap = $('betsList');
  const rows = state.players.map(function (p) {
    const b2 = state.bets2d.filter(function (b) { return b.player === p.id; });
    const b3 = state.bets3d.filter(function (b) { return b.player === p.id; });
    const bf = state.betsFb.filter(function (b) { return b.player === p.id; });
    const total = b2.reduce(function (a, b) { return a + (b.total || 0); }, 0) +
      b3.reduce(function (a, b) { return a + (b.total || 0); }, 0) +
      bf.reduce(function (a, b) { return a + (b.stake || 0); }, 0);
    if (!b2.length && !b3.length && !bf.length) return '';
    function betRows(list, label) {
      if (!list.length) return '';
      return '<div class="glabel">' + label + '</div>' + list.map(function (b) {
        const what = b.lines
          ? b.lines.map(function (ln) { return ln.n + (ln.rev ? ' (အာ ' + L.reverse2(ln.n) + ')' : ''); }).join(' · ')
          : fbBetLabel(b);
        const amt = b.lines ? (b.total || 0) : (b.stake || 0);
        return '<div class="bet-row"><span class="what">' + esc(what) + '</span><span class="amt">' + fmt(amt) + ' ကျပ်</span></div>';
      }).join('');
    }
    const cid = 'uc-' + esc(p.id);
    return '<div class="user-card" id="' + cid + '">' +
      '<div class="user-head" onclick="toggleUser(\'' + cid + '\')"><span>' + esc(p.name || p.email) + ' <span class="arr">›</span></span><span class="tot">' + fmt(total) + ' ကျပ်</span></div>' +
      '<div class="user-body">' +
      betRows(b2, '2D') + betRows(b3, '3D') + betRows(bf, '1D (ဘောပွဲ)') +
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
function renderLedger2D() {
  var g = $('ledGrid2d');
  if (!g) return;
  var lim = limitOf('2d');
  var out = '';
  for (var i = 0; i < 100; i++) {
    var n = ('0' + i).slice(-2);
    var v = LED2D[n] || 0;
    // Blocked = RED, identical to over-limit (cellClass returns ' over'
    // for both — never dark, never strikethrough, never '(ပိတ်)').
    var cls = L.cellClass(v, lim, BLOCKED['2d'].indexOf(n) >= 0);
    out += '<div class="led-cell' + cls + '"><b>' + n + '</b>' + (v ? fmt(v) : '–') + '</div>';
  }
  g.innerHTML = out;
  const tot = Object.keys(LED2D).reduce(function (a, k) { return a + LED2D[k]; }, 0);
  const sub = $('ledSub2d'); if (sub) sub.textContent = 'စုစုပေါင်း ' + fmt(tot) + ' ကျပ်';
  const t2 = $('ledTot2d'); if (t2) t2.textContent = fmt(tot);
}
function renderLedger3D() {
  var w = $('ledList3d');
  if (!w) return;
  var lim = limitOf('3d');
  var out = '';
  Object.keys(LED3D).sort().forEach(function (n) {
    var v = LED3D[n];
    var cls = L.cellClass(v, lim, BLOCKED['3d'].indexOf(n) >= 0);
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
    out += '<div class="bet-row' + (b.amt > lim ? ' over' : '') + '"><span><span class="who">' + esc(b.user) + '</span><br><span class="what">' + esc(b.what) + '</span></span><span class="amt">' + fmt(b.amt) + ' ကျပ်</span></div>';
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
function renderBsBody() {
  var w = $('bsList');
  if (!w) return;
  var out = '';
  BODY_NET.forEach(function (m) {
    var bn = netSide(m.h, m.a, m.home, m.away);
    var gn = netSide(m.over, m.under, 'ဂိုးပေါ်', 'အောက်');
    out += '<div class="net-match"><div class="nm-head">' + esc(m.home) + ' vs ' + esc(m.away) + '</div>';
    out += '<div class="net-row"><span>ဘော်ဒီ</span><span><b>' + esc(m.home) + ' ' + m.h + '</b> · <b>' + esc(m.away) + ' ' + m.a + '</b></span></div>';
    out += '<div class="net-row"><span>ဂိုးပေါင်း</span><span><b>ဂိုးပေါ် ' + m.over + '</b> · <b>အောက် ' + m.under + '</b></span></div>';
    out += '<div class="net-res">အကျန်: ' + esc(bn.side) + (bn.amt ? ' ' + bn.amt : '') + ' · ' + esc(gn.side) + (gn.amt ? ' ' + gn.amt : '') + '</div></div>';
  });
  w.innerHTML = out || '<div class="muted">ဘော်ဒီ လောင်းကစား မရှိသေးဘူး</div>';
}
function bsBodyText() {
  var lines = ['ဘော်ဒီစာရင်း'];
  BODY_NET.forEach(function (m) {
    var bn = netSide(m.h, m.a, m.home, m.away);
    var gn = netSide(m.over, m.under, 'ဂိုးပေါ်', 'အောက်');
    lines.push(m.home + ' vs ' + m.away);
    lines.push(m.home + ' ' + m.h + ' - ' + m.away + ' ' + m.a + ' = ' + bn.side + (bn.amt ? ' ' + bn.amt : ''));
    lines.push('ဂိုးပေါ် ' + m.over + ' - အောက် ' + m.under + ' = ' + gn.side + (gn.amt ? ' ' + gn.amt : ''));
  });
  return lines.join('\n');
}
var BS_LABEL = { '2d': '2D ကြီးငယ်စာရင်း', '3d': '3D ကြီးငယ်စာရင်း', 'body': 'ဘော်ဒီစာရင်း', 'parlay': 'မောင်းစာရင်း' };
var bsTab = '2d';
function setBsTab(t) {
  bsTab = t;
  document.querySelectorAll('[data-bs]').forEach(function (b) { b.classList.toggle('on', b.dataset.bs === t); });
  renderBs();
}
function renderBs() {
  var w = $('bsList');
  if (!w) return;
  if (bsTab === 'body') { renderBsBody(); return; }
  var list = L.sortBsDesc(BS[bsTab] || []);
  var out = '';
  list.forEach(function (e, i) {
    out += '<div class="bs-row"><span><span class="rank">' + (i + 1) + '.</span> <span class="num">' + esc(e.n) + ' = ' + e.v + '</span></span></div>';
  });
  w.innerHTML = out || '<div class="muted">စာရင်း မရှိသေးဘူး</div>';
}
function bsText() {
  if (bsTab === 'body') return bsBodyText();
  var list = L.sortBsDesc(BS[bsTab] || []);
  var lines = [BS_LABEL[bsTab]];
  list.forEach(function (e, i) { lines.push((i + 1) + '. ' + e.n + ' = ' + e.v); });
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
function renderSummary() {
  if (!state.loaded) return;
  const t2 = state.bets2d.reduce(function (a, b) { return a + (b.total || 0); }, 0);
  const t3 = state.bets3d.reduce(function (a, b) { return a + (b.total || 0); }, 0);
  const tf = state.betsFb.reduce(function (a, b) { return a + (b.stake || 0); }, 0);
  const n = state.bets2d.length + state.bets3d.length + state.betsFb.length;
  $('sumStake').textContent = fmt(t2 + t3 + tf);
  $('sumBets').textContent = n;
  $('sumPlayers').textContent = state.players.length;
  $('sum2d').textContent = fmt(t2) + ' ကျပ်';
  $('sum3d').textContent = fmt(t3) + ' ကျပ်';
  $('sumFb').textContent = fmt(tf) + ' ကျပ်';
  const perUser = {};
  state.players.forEach(function (p) { perUser[p.id] = 0; });
  state.bets2d.forEach(function (b) { perUser[b.player] = (perUser[b.player] || 0) + (b.total || 0); });
  state.bets3d.forEach(function (b) { perUser[b.player] = (perUser[b.player] || 0) + (b.total || 0); });
  state.betsFb.forEach(function (b) { perUser[b.player] = (perUser[b.player] || 0) + (b.stake || 0); });
  $('sumPerUser').innerHTML = Object.keys(perUser).map(function (pid) {
    return '<div class="bet-row"><span class="who">' + esc(playerName(pid)) + '</span><span class="amt">' + fmt(perUser[pid]) + ' ကျပ်</span></div>';
  }).join('') || '<div class="muted">ယူဆာ မရှိသေးဘူး</div>';
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
  if (s.comm_23 !== undefined) $('comm23').value = s.comm_23;
  if (s.comm_47 !== undefined) $('comm47').value = s.comm_47;
  if (s.comm_810 !== undefined) $('comm810').value = s.comm_810;
  if (s.max_legs !== undefined) $('maxLegs').value = s.max_legs;
  if (s.min_fb !== undefined) $('minFb').value = s.min_fb;
  if (s.min_2d3d !== undefined) $('min23').value = s.min_2d3d;
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
}

// Session open/close toggles on Home write m23_sessions.open.
// Football has no session row: its close rule (5 min before kickoff) lives
// in the player app, so the toggle only explains that.
async function toggleSession(game, period, btn) {
  if (!state.loaded) {
    btn.classList.toggle('on');
    toast(btn.classList.contains('on') ? 'ဖွင့်ပြီ' : 'ပိတ်ပြီ');
    return;
  }
  if (game === 'fb') {
    toast('ဘောပွဲ — ပွဲတိုင်း kickoff ၅ မိနစ်အလို auto ပိတ်တယ်');
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
    comm_23: parseInt($('comm23').value, 10) || 15,
    comm_47: parseInt($('comm47').value, 10) || 20,
    comm_810: parseInt($('comm810').value, 10) || 30,
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
    const closeAm = $('close2dAm').value, closePm = $('close2dPm').value, close3d = $('close3d').value;
    const sAm = latestSession('2d', 'am');
    const sPm = latestSession('2d', 'pm');
    const s3 = latestSession('3d', 'round');
    if (sAm && closeAm) await PB.update('m23_sessions', sAm.id, { close_at: sAm.date + ' ' + closeAm + ':00' });
    if (sPm && closePm) await PB.update('m23_sessions', sPm.id, { close_at: sPm.date + ' ' + closePm + ':00' });
    if (s3 && close3d) await PB.update('m23_sessions', s3.id, { close_at: s3.date + ' ' + close3d + ':00' });
    toast('သတ်မှတ်ချက် သိမ်းပြီ');
  } catch (e) {
    toast('သိမ်းလို့ မရဘူး — ' + (e.message || 'error'));
  }
}

// ---------------------------------------------------------------- init
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
window.copyBs = copyBs;
window.setLedTab = setLedTab;
window.setBlockedGame = setBlockedGame;
window.addBlocked = addBlocked;
window.removeBlocked = removeBlocked;
window.renderLedger2D = renderLedger2D;
window.renderLedger3D = renderLedger3D;
window.renderLedgerFb = renderLedgerFb;
window.approveReq = approveReq;
window.rejectReq = rejectReq;
window.saveWins = saveWins;
window.saveSettings = saveSettings;
window.toggleSession = toggleSession;
window.onLimitChange = onLimitChange;
window.loginAdmin = loginAdmin;
window.settleFootballNow = settleFootballNow;
