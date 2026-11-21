// logic.js — pure PocketBase-independent logic for the 23မောင်း Admin app.
// No DOM, no fetch, no secrets. Imported by admin.js (browser) and by
// test-admin.mjs (Node tests with a fake PocketBase client).
//
// Rules implemented here come ONLY from:
//   - 23maung-schema.md (rates 90x / 600x, commission tiers, approval side
//     effects, settlement flow), and
//   - the admin mockup v2.4's own functions (netSide, big/small "N = V").
// Where the schema leaves a rule open it is marked OPEN below and the
// chosen behaviour is the one the task assigned (see WIRING.md).

export function reverse2(n) { return String(n).split('').reverse().join(''); }

// ---- Aggregation ------------------------------------------------------------
// 2D: per-number total across all bets in the set. A line's direct amount
// counts on n; its reverse amount counts on reverse(n) (a palindrome such
// as 11 counts both on the same number, which is correct: both stakes sit
// on that number).
export function aggregate2D(bets) {
  const tot = {};
  (bets || []).forEach(function (b) {
    (b.lines || []).forEach(function (ln) {
      const n = String(ln.n);
      tot[n] = (tot[n] || 0) + (ln.amt || 0);
      if (ln.rev) {
        const r = reverse2(n);
        tot[r] = (tot[r] || 0) + (ln.rev || 0);
      }
    });
  });
  return tot;
}

// 3D: per-number total (no reverse field; (R) permutations are already
// expanded into separate lines at placement).
export function aggregate3D(bets) {
  const tot = {};
  (bets || []).forEach(function (b) {
    (b.lines || []).forEach(function (ln) {
      const n = String(ln.n);
      tot[n] = (tot[n] || 0) + (ln.amt || 0);
    });
  });
  return tot;
}

// Big/small list: biggest first, ties by number ascending. Output entries
// are { n, v } and render as plain "N = V" (no commas, no ကျပ်).
export function sortBsDesc(entries) {
  return (entries || []).slice().sort(function (a, b) {
    return (b.v - a.v) || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0);
  });
}
export function bsEntriesFromTotals(tot) {
  return sortBsDesc(Object.keys(tot).map(function (n) { return { n: n, v: tot[n] }; }));
}

// ---- Myanmar odds (ported verbatim from feed/myanmar-odds.js) ---------------
// Pho's CONFIRMED rule (Nov 11): direct transcription of the API LINE.
// goal = integer part of |line| (0 renders '='), pyar digits = fraction
// digits (.25->25, .5->5), sign '-' if line<0 / '+' if line>0 when
// fraction!=0, '=' when fraction==0 or line==0. Applies to body (AH) and
// goal total (GL). Decimal odds are NOT used for display.
// Ground truth: -1.25->'1-25', 1.25->'1+25', -1.5->'1-5', 3->'3=',
// -0.25->'=-25', 0.5->'=+5'.
export function lineToMyanmar(line) {
  if (line == null) return null;
  const rounded = Math.round(line * 100) / 100;
  if (rounded === 0) return '=';
  const neg = rounded < 0;
  const absStr = String(Math.abs(rounded));
  const parts = absStr.split('.');
  const goalInt = parseInt(parts[0], 10);
  const frac = parts.length > 1 ? parts[1].replace(/0+$/, '') : '';
  const goalStr = goalInt === 0 ? '=' : String(goalInt);
  if (!frac) return goalStr === '=' ? '=' : goalStr + '=';
  const sign = neg ? '-' : '+';
  return goalStr + sign + frac;
}

// Short team names for the ledger header / list lines (Pho's examples:
// Mu, Real, Liver, Ars, Tra, Che). No short-name map existed in the
// codebase (TEAM_MM is Burmese full names; legs carry full English names),
// so this map is the ledger's single source. Fallback = first word.
const TEAM_SHORT = {
  'Manchester United': 'Mu', 'Man Utd': 'Mu', 'Man United': 'Mu',
  'Real Madrid': 'Real',
  'Liverpool': 'Liver',
  'Arsenal': 'Ars',
  'Chelsea': 'Che',
  'Troyes': 'Tra',
  'Man City': 'City',
  'Tottenham': 'Spurs',
  'Roma': 'Roma', 'Napoli': 'Napoli', 'Torino': 'Torino',
  'Celta Vigo': 'Celta', 'Sassuolo': 'Sassuolo', 'Lazio': 'Lazio',
  'Fulham': 'Fulham', 'Como': 'Como', 'Parma': 'Parma', 'PSG': 'PSG',
  'Leeds': 'Leeds', 'Hull': 'Hull',
  'Athletic Club': 'Athletic', 'Augsburg': 'Aug', 'Auxerre': 'Aux',
  'Bayer Leverkusen': 'Lever', 'Bayern Munich': 'Bayern',
  'Bologna': 'Bol', 'Borussia Dortmund': 'Dort',
  "Borussia M'gladbach": 'Glad', 'CD Alaves': 'Alaves',
  'Cagliari': 'Cag', 'Deportivo A Coruna': 'Depor',
  'Eintracht Frankfurt': 'Frank', 'Elversberg': 'Elv',
  'Espanyol': 'Esp', 'Frosinone': 'Fro', 'Lecce': 'Lec',
  'Mainz': 'Mainz', 'Malaga': 'Mal', 'Newcastle': 'New',
  'Nottm Forest': 'Forest', 'Osasuna': 'Osa', 'Paderborn': 'Pad',
  'Paris FC': 'Paris', 'RB Leipzig': 'Leip',
  'Racing Santander': 'Racing', 'SC Freiburg': 'Frei',
  'TSG Hoffenheim': 'Hof', 'Union Berlin': 'Union',
  'Valencia': 'Val', 'VfB Stuttgart': 'Stutt',
  'Werder Bremen': 'Werder',
  'Inter': 'Inter', 'AC Milan': 'Milan', 'Juventus': 'Juve',
  'Barcelona': 'Barca', 'Atletico Madrid': 'Atletico',
  'Sevilla': 'Sevilla', 'Real Sociedad': 'Sociedad',
  'Villarreal': 'Villarreal', 'Real Betis': 'Betis',
  'Everton': 'Everton', 'West Ham': 'West Ham',
  'Aston Villa': 'Villa', 'Brighton': 'Brighton',
  'Brentford': 'Brent', 'Wolves': 'Wolves',
  'Crystal Palace': 'Palace', 'Bournemouth': 'Bourne'
};
export function teamShort(name) {
  if (!name) return '';
  if (TEAM_SHORT[name]) return TEAM_SHORT[name];
  const first = String(name).split(' ')[0];
  return first || String(name);
}

// ---- Football body NET (ကြီးငယ် ဘော်ဒီစာရင်း) ---------------------------------
// Mockup v2.4 netSide, verbatim logic: offset both sides, equal = "မျှ".
export function netSide(x, y, xName, yName) {
  if (x === y) return { side: 'မျှ', amt: 0 };
  return x > y ? { side: xName, amt: x - y } : { side: yName, amt: y - x };
}

// Net per match from m23_bets_fb legs of BODY placements only (parlay legs
// span matches, so they never net — they stay individual bets).
// A leg: { fixture, home, away, kind:'body'|'goal', pick:'h'|'a'|'over'|'under', stake }
// fixturesById (optional): map fixture PB id -> fixture row; when given,
// each entry carries its kickoff_utc and the list is sorted by kickoff
// (earliest first, unknown kickoff last) — Admin v1.7 (Pho Nov 15: the
// ledger must show match time in time order so a passed match is obvious).
// Home/away_mm are threaded too (Admin v2.18, Pho Nov 21: Burmese-first
// team names; English fallback when the fixture has no _mm).
export function computeBodyNet(fbBets, fixturesById, oddsByFixture) {
  const byKey = {};
  (fbBets || []).forEach(function (b) {
    if (b.type !== 'body') return;
    (b.legs || []).forEach(function (leg) {
      const key = leg.fixture || (leg.home + ' vs ' + leg.away);
      if (!byKey[key]) {
        byKey[key] = { key: key, home: leg.home || '', away: leg.away || '', h: 0, a: 0, over: 0, under: 0, bodyOdds: '', goalOdds: '', kickoff_utc: null };
      }
      const m = byKey[key];
      if (leg.kind === 'body') {
        // Odds: prefer the stored Myanmar string the player app placed
        // with (leg.hcp, from m23_odds via the feed converter), fall back
        // to rendering the numeric line (lineToMyanmar).
        if (!m.bodyOdds) m.bodyOdds = leg.hcp || lineToMyanmar(leg.ah_line) || '';
        if (leg.pick === 'h') m.h += leg.stake || 0;
        else if (leg.pick === 'a') m.a += leg.stake || 0;
      } else if (leg.kind === 'goal') {
        if (!m.goalOdds) m.goalOdds = leg.over || lineToMyanmar(leg.gl_line) || '';
        if (leg.pick === 'over') m.over += leg.stake || 0;
        else if (leg.pick === 'under') m.under += leg.stake || 0;
      }
    });
  });
  const list = Object.keys(byKey).map(function (k) { return byKey[k]; });
  if (fixturesById) {
    list.forEach(function (m) {
      const fx = fixturesById[m.key];
      if (fx) {
        const ko = normalizeKickoff(fx.kickoff_utc); if (ko !== null) m.kickoff_utc = ko;
        if (fx.home_mm) m.home_mm = fx.home_mm;
        if (fx.away_mm) m.away_mm = fx.away_mm;
      }
    });
  }
  // Admin v2.18 (Pho Nov 21): a match with no goal bets has no goal line
  // from the bets — fall back to the match's own odds (m23_odds), so the
  // goal column always shows a line like Pho's paper spec. Same for the
  // body line on goal-only matches. Bet lines always win over the
  // fixture's lines; no odds row -> the line stays blank.
  if (oddsByFixture) {
    list.forEach(function (m) {
      const o = oddsByFixture[m.key];
      if (!o) return;
      if (!m.bodyOdds) m.bodyOdds = o.hcp || lineToMyanmar(o.ah_line) || '';
      if (!m.goalOdds) m.goalOdds = o.goal_line || lineToMyanmar(o.gl_line) || '';
    });
  }
  return sortBodyNetByKickoff(list);
}

// Sort body-ledger matches by kickoff ascending; matches with no known
// kickoff go last, keeping their current relative order (stable).
export function sortBodyNetByKickoff(matches) {
  return (matches || []).map(function (m, i) { return { m: m, i: i }; }).sort(function (a, b) {
    const ka = a.m.kickoff_utc, kb = b.m.kickoff_utc;
    const aKnown = typeof ka === 'number', bKnown = typeof kb === 'number';
    if (aKnown && bKnown) return (ka - kb) || (a.i - b.i);
    if (aKnown) return -1;
    if (bKnown) return 1;
    return a.i - b.i;
  }).map(function (x) { return x.m; });
}

// ---- Match kickoff time (Admin v1.7, type fix v1.8) ---------------------------
// normalizeKickoff (v1.8): m23_fixtures.kickoff_utc is a PocketBase
// DateTime field, so the API returns it as an ISO datetime STRING
// ("2026-11-21 20:00:00.000Z"), NOT a unix-seconds number. Accept BOTH:
// a finite number is unix seconds (used as-is); a string is parsed with
// Date.parse() and converted to whole unix seconds. Anything else -> null.
export function normalizeKickoff(value) {
  if (typeof value === 'number' && isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (!isNaN(ms)) return Math.floor(ms / 1000);
    return null;
  }
  return null;
}
// kickoff_utc is unix seconds UTC (or an ISO datetime string — see
// normalizeKickoff); the ledger shows Yangon HH:MM.
const YGN_TIME_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Yangon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function formatKickoffYangon(kickoffUtc) {
  const ko = normalizeKickoff(kickoffUtc);
  if (ko === null) return null;
  try { return YGN_TIME_FMT.format(new Date(ko * 1000)); } catch (e) { return null; }
}
// yangonDateOf (v1.9): the Yangon calendar date (YYYY-MM-DD) of a
// PocketBase DateTime value. m23_sessions.date is returned as a raw ISO
// datetime string ("2026-11-15 17:30:00.000Z" = 2026-11-16 00:00 Yangon),
// so the date part of the string is NOT the Yangon date. Accepts an ISO
// string or unix seconds (via normalizeKickoff); anything else -> null.
const YGN_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit' });
export function yangonDateOf(value) {
  const ko = normalizeKickoff(value);
  if (ko === null) return null;
  try { return YGN_DATE_FMT.format(new Date(ko * 1000)); } catch (e) { return null; }
}
// buildCloseAt (v1.9): the close_at value to store for a session whose
// date is `sessionDate` (ISO string or unix seconds) and whose picked
// close time is `time` ("HH:MM" from the Settings time input). Returns
// "YYYY-MM-DD HH:MM:00" (space format — PocketBase stores it as a
// DateTime and timeFromCloseAt extracts the same HH:MM back), or null
// when the date is missing/invalid or the time is not HH:MM. Never
// builds the old malformed form (raw ISO date + time, which PocketBase
// rejected with 400, so nothing was ever stored and the inputs always
// fell back to the 16:00 HTML default).
export function buildCloseAt(sessionDate, time) {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = yangonDateOf(sessionDate);
  if (d === null) return null;
  return d + ' ' + time + ':00';
}

// ---- Admin record date picker (Admin v2.3, Pho Nov 17) ----------------------
// MOUNG556-style calendar popup, SAME behaviour as Player v2.10's voucher
// calendar (openVouchCal/renderVouchCal/calCells there): month view, prev/
// next arrows, weekday header S M T W T F S, Sat/Sun red, today filled red
// circle, future dates greyed out + not selectable, grey Yesterday/Today
// buttons, backdrop-tap closes without changing the date, selected non-today
// date gets a red outline ring. The calendar grid itself is pure (calCells)
// so Node tests can exercise it without a DOM.

// fmtDateOnly: 'YYYY-MM-DD' -> 'DD.MM.YYYY' (Player v2.10, verbatim).
export function fmtDateOnly(d) {
  if (!d) return '';
  const p = String(d).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(d);
}
// ymdAdd: 'YYYY-MM-DD' shifted by `days` (Player v2.10, verbatim).
export function ymdAdd(ymd, days) {
  const p = String(ymd || '').split('-');
  if (p.length !== 3) return ymd;
  const d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10) + days));
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function pad2(n) { return ('0' + n).slice(-2); }
// Calendar grid cells for month (y, m 0-based): leading blanks are null;
// each day is {d, ymd, we (Sat/Sun), future, today, sel} (Player v2.10, verbatim).
export function calCells(y, m, todayYmd, selYmd) {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0 = Sunday
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) {
    const ymd = y + '-' + pad2(m + 1) + '-' + pad2(d);
    const wd = new Date(Date.UTC(y, m, d)).getUTCDay();
    cells.push({ d: d, ymd: ymd, we: (wd === 0 || wd === 6), future: !!(todayYmd && ymd > todayYmd), today: (ymd === todayYmd), sel: (ymd === selYmd) });
  }
  return cells;
}

// adminBetDate: the Yangon date (YYYY-MM-DD) of one bet row, for the Admin
// record screens (လယ်ဂျာ / ကြီးငယ် / လောင်းကစား).
//   2D/3D: the bet's SESSION's Yangon date (sessions are in state; a 3D
//     round's date is its session date, same as 2D's).
//   Football (kind 'fb'): the bet record's `created` Yangon date. The
//     screens never join football bets to fixtures for a date — fixtures
//     are only joined for kickoff TIMES (renderBs parlay / ledger cards),
//     so `created` is the date the screens already use.
// Returns null when the date cannot be resolved (no session row, unparsable
// session/created value) — such bets are SHOWN, never hidden (betMatchesDate).
export function adminBetDate(bet, sessions, kind) {
  if (!bet) return null;
  if (kind === 'fb') return bet.created ? yangonDateOf(bet.created) : null;
  if (bet.session) {
    const s = (sessions || []).find(function (r) { return r.id === bet.session; });
    if (s) return yangonDateOf(s.date);
    return null; // session row missing — unresolvable, shown
  }
  return null;
}
// betMatchesDate: true when the bet belongs on `ymd`, OR its date cannot
// be resolved (shown, never hidden). Only a KNOWN different date hides it.
export function betMatchesDate(bet, sessions, kind, ymd) {
  const d = adminBetDate(bet, sessions, kind);
  return d === null || d === ymd;
}
// filterBetsByDate: the selected date's bets (plus unresolvable ones).
export function filterBetsByDate(bets, sessions, kind, ymd) {
  return (bets || []).filter(function (b) { return betMatchesDate(b, sessions, kind, ymd); });
}

// ---- Summary periods (Admin v2.11, Pho Nov 20) ------------------------------
// The စာရင်းချုပ် screen is split by game, each with its own natural period:
//   2D  = the WEEK containing the picked date (Mon–Fri; 2D runs Mon–Fri, the
//         week's total is the Friday-evening total, closed on Monday).
//   3D  = the ROUND containing the picked date (1st or 16th draw).
//   1D  = the picked DAY itself (football is daily).
// Unlike betMatchesDate (which SHOWS unresolvable bets so ledger lists never
// hide a record), the period filters below EXCLUDE bets whose date cannot be
// resolved: an unresolvable bet would otherwise be counted in EVERY week /
// round / day and inflate every period total. There is no "all" period in the
// summary, so nothing is lost from any total the screen shows.
// weekdayOf: 0=Sun .. 6=Sat (UTC math, no timezone dependence — ymd is a
// calendar date already).
export function weekdayOf(ymd) {
  const p = String(ymd || '').split('-');
  if (p.length !== 3) return null;
  const d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
  return isNaN(d.getTime()) ? null : d.getUTCDay();
}
// weekdayNameMm (v2.13, Pho Nov 20): Burmese weekday name of a YYYY-MM-DD
// date, for the 3D round label ('16.11.2026 တနင်္လာ'). '' when unresolvable.
export function weekdayNameMm(ymd) {
  const names = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'];
  const wd = weekdayOf(ymd);
  return wd === null ? '' : names[wd];
}
// weekRange: {mon, fri} — the Monday and Friday of the week containing ymd.
export function weekRange(ymd) {
  const wd = weekdayOf(ymd);
  if (wd === null) return null;
  const mon = ymdAdd(ymd, -((wd + 6) % 7));
  return { mon: mon, fri: ymdAdd(mon, 4) };
}
// roundForDate: the 3D round date (1st or 16th) on or before ymd.
export function roundForDate(ymd) {
  const p = String(ymd || '').split('-');
  if (p.length !== 3) return null;
  return p[0] + '-' + p[1] + '-' + (parseInt(p[2], 10) <= 15 ? '01' : '16');
}
// betInRange: true when the bet's resolved date is within [fromYmd, toYmd]
// (inclusive, YYYY-MM-DD strings compare in order). Null date -> false.
export function betInRange(bet, sessions, kind, fromYmd, toYmd) {
  const d = adminBetDate(bet, sessions, kind);
  return d !== null && d >= fromYmd && d <= toYmd;
}
// betOnDate: true when the bet's resolved date is exactly ymd. Null -> false.
export function betOnDate(bet, sessions, kind, ymd) {
  return adminBetDate(bet, sessions, kind) === ymd;
}
// betNet2D3D (v2.14): one 2D/3D bet's net (stake - payout) or null when its
// session has no win_number yet (not drawn). Payouts via settle2D3DBet,
// the same function the app settles with, so the net matches actual payouts.
export function betNet2D3D(bet, sessions, settings, game) {
  const s = bet && bet.session ? (sessions || []).find(function (r) { return r.id === bet.session; }) : null;
  const win = s && s.win_number !== null && s.win_number !== undefined && String(s.win_number) !== '' ? String(s.win_number) : null;
  if (win === null) return null; // not drawn yet — excluded (Pho option A)
  const ratePer100 = game === '2d'
    ? (settings && settings.rate_2d !== undefined ? settings.rate_2d : 9000)
    : (settings && settings.rate_3d !== undefined ? settings.rate_3d : 60000);
  return (bet.total || bet.stake || 0) - settle2D3DBet(bet, win, ratePer100).win_amount;
}
// periodNet2D3D (v2.13, Pho Nov 20, option A): net profit of 2D/3D bets in a
// period = stake - payouts, counting ONLY bets whose session already has a
// win_number (drawn). A bet whose session has no win_number yet is EXCLUDED
// entirely — neither its stake nor any payout counts — so the net is the
// settled profit so far. Payouts use settle2D3DBet, the same function the
// app settles with (rate from settings, 2D 9000 / 3D 60000 per 100 by
// default), so the net matches what the app actually pays out. Returns
// {net, settled} where settled = number of bets counted.
export function periodNet2D3D(bets, sessions, settings, game) {
  let net = 0, settled = 0;
  (bets || []).forEach(function (b) {
    const n = betNet2D3D(b, sessions, settings, game);
    if (n === null) return;
    net += n; settled++;
  });
  return { net: net, settled: settled };
}
// fbBetNet (v2.17, Pho Nov 21 — Bets header net): one football bet's
// bookie-side net (stake - payout) from its STORED status/payout, or null
// when the bet is not decided yet (status 'open' or missing). Option A like
// the Summary: unsettled bets are excluded entirely. NOTE the Summary
// live-prices FB via footballDailyDetail; the Bets card uses the stored
// state so the header matches the rows on the same card (a bet whose row
// still says စောင့်နေတယ် never counts toward the header).
export function fbBetNet(bet) {
  if (!bet) return null;
  if (bet.status !== 'won' && bet.status !== 'lost' && bet.status !== 'settled') return null;
  return (bet.stake || 0) - (bet.payout || 0);
}
// periodNetFb (v2.17): net + settled count over football bets — same shape
// as periodNet2D3D, so the Bets header can sum all three games alike.
export function periodNetFb(bets) {
  let net = 0, settled = 0;
  (bets || []).forEach(function (b) {
    const n = fbBetNet(b);
    if (n === null) return;
    net += n; settled++;
  });
  return { net: net, settled: settled };
}
// periodNetByUser (v2.14, Pho Nov 20): per-player net {playerId: net} for
// 2D/3D bets in a period — settled sessions only (option A). Players with
// no settled bet in the period do not appear.
export function periodNetByUser(bets, sessions, settings, game) {
  const byUser = {};
  (bets || []).forEach(function (b) {
    const n = betNet2D3D(b, sessions, settings, game);
    if (n === null) return;
    byUser[b.player] = (byUser[b.player] || 0) + n;
  });
  return byUser;
}

// adminBetPeriod: the session period ('am'/'pm') of one 2D bet row, for the
// Admin v2.4 am/pm split (Pho Nov 17: "ခွဲပြမှ အမှန်ရမယ်" — morning and
// evening are separate draws and must never be mixed). Only 2D bets have
// am/pm periods; 3D rounds ('round') and football have none, so this
// returns null for them. Returns null when the period cannot be resolved
// (no session id, session row missing, or an unknown period value).
export function adminBetPeriod(bet, sessions, kind) {
  if (!bet || kind !== '2d') return null;
  if (bet.session) {
    const s = (sessions || []).find(function (r) { return r.id === bet.session; });
    if (s && (s.period === 'am' || s.period === 'pm')) return s.period;
    return null;
  }
  return null;
}
// split2DByPeriod: the selected date's 2D bets split into { am, pm }.
// A bet whose period cannot be resolved counts in AM (shown, never hidden,
// never double-counted) — the AM section is the default bucket, mirroring
// the v2.3 rule that unresolvable bets are shown, never hidden.
export function split2DByPeriod(bets, sessions, ymd) {
  const day = filterBetsByDate(bets, sessions, '2d', ymd);
  const am = [], pm = [];
  day.forEach(function (b) {
    if (adminBetPeriod(b, sessions, '2d') === 'pm') pm.push(b); else am.push(b);
  });
  return { am: am, pm: pm };
}

// ---- 2D period switch (Admin v2.5, Pho Nov 17) ---------------------------------
// The 2D screens (လယ်ဂျာ grid, ကြီးငယ် list, လောင်းကစား detail) follow the
// clock: at 11:00 the morning ledger shows, at 14:00 the evening ledger
// shows — morning and evening must never be mixed on screen. The switch
// itself is 'am' | 'pm' | 'both'; the AUTO default is by Yangon time, and
// a past picked date has no "current" period, so it defaults to 'both'.
// autoPeriodYangon takes an explicit `now` (Date, ms number or parseable
// string) so it is unit-testable; invalid input defaults to 'am'.
export function autoPeriodYangon(now) {
  const ms = now instanceof Date ? now.getTime()
    : (typeof now === 'number' ? now : new Date(now).getTime());
  if (isNaN(ms)) return 'am';
  // Yangon is UTC+6:30 — shift to Yangon wall-clock, then read the hour.
  const ygnHour = new Date(ms + 6.5 * 3600 * 1000).getUTCHours();
  return ygnHour < 14 ? 'am' : 'pm';
}
// defaultAdminPeriod: the switch default for the picked record date.
// 'both' when the date is not today (no current period to follow);
// the clock rule when it is today. Pure — the manual override lives in
// admin.js (state.adminPeriodManual), never here.
export function defaultAdminPeriod(adminDate, todayYmd, now) {
  if (typeof adminDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(adminDate)) return 'both';
  if (adminDate !== todayYmd) return 'both';
  return autoPeriodYangon(now);
}

// ---- 2D auto-schedule (Admin v2.0, Pho Nov 15 18:31-18:43) -----------------
// 2D opens Mon-Fri, morning AND evening (2 sessions/day); Sat + Sun CLOSED
// every week. Mon-Fri the morning session auto-opens 10:00 and the evening
// 14:00; auto-close is at the Settings close times (am 11:55 / pm 15:55 by
// default — carried forward from the latest same-period session's close_at).
// The Admin side ONLY creates today's missing sessions (open=true); the
// PLAYER gates the effective open state by the clock, and the automation
// NEVER flips a session from closed back to open, so Pho's manual holiday
// close (Admin toggle) is never undone. 3D untouched (1st/16th, manual).
// Football untouched.

// Default close times when no earlier session of the period has a close_at.
export const TWO_D_CLOSE_DEFAULTS = { am: '11:55', pm: '15:55' };

// isoForYangonDate (v2.0): the PocketBase DateTime value for 00:00 Yangon
// on `yangonDate` ("YYYY-MM-DD"). Yangon is UTC+6:30, so 00:00 Yangon is
// 17:30 UTC the PREVIOUS day. Returns an ISO string
// ("YYYY-MM-DDTHH:MM:SS.000Z"), or null for an invalid date. Verified
// against real stored rows: "2026-11-15 17:30:00.000Z" = 2026-11-16 Yangon,
// "2026-11-12 17:30:00.000Z" = 2026-11-13 Yangon.
export function isoForYangonDate(yangonDate) {
  if (typeof yangonDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(yangonDate)) return null;
  const p = yangonDate.split('-').map(Number);
  const ms = Date.UTC(p[0], p[1] - 1, p[2]) - (6.5 * 3600 * 1000);
  if (isNaN(ms)) return null;
  return new Date(ms).toISOString();
}
// closeTimeOf: 'HH:MM' out of a stored close_at ('YYYY-MM-DD HH:MM:SS' or
// ISO), or null. Same regex admin.js timeFromCloseAt uses.
export function closeTimeOf(closeAt) {
  if (!closeAt) return null;
  const m = String(closeAt).match(/(\d{2}):(\d{2})/);
  return m ? m[1] + ':' + m[2] : null;
}
// carriedCloseTime: the HH:MM for a new 2D session of `period` — taken from
// the LATEST existing 2D session of the same period that HAS a close_at
// (latest by stored date), else the default 11:55 (am) / 15:55 (pm).
export function carriedCloseTime(sessions, period) {
  const def = TWO_D_CLOSE_DEFAULTS[period] || TWO_D_CLOSE_DEFAULTS.am;
  let latest = null;
  (sessions || []).forEach(function (s) {
    if (s.game !== '2d' || s.period !== period) return;
    if (!closeTimeOf(s.close_at)) return;
    if (!latest || String(s.date).localeCompare(String(latest.date)) > 0) latest = s;
  });
  return latest ? closeTimeOf(latest.close_at) : def;
}
// winInputsFromSessions: the win-input values for the Admin results screen
// (v2.1, Pho Nov 16): {am, pm, round} as strings taken from the LATEST
// session of each game/period's saved win_number. '' when a session has no
// win_number saved yet. Pure — the DOM fill lives in admin.js
// (fillWinInputs, once on load only, so the 30s auto-refresh never
// clobbers a value the operator is typing).
export function winInputsFromSessions(sessions) {
  function latest(game, period) {
    let row = null;
    (sessions || []).forEach(function (s) {
      if (s.game !== game || s.period !== period) return;
      if (!row || String(s.date).localeCompare(String(row.date)) > 0) row = s;
    });
    return row;
  }
  function val(s) {
    if (!s || s.win_number === undefined || s.win_number === null) return '';
    return String(s.win_number);
  }
  return {
    am: val(latest('2d', 'am')),
    pm: val(latest('2d', 'pm')),
    round: val(latest('3d', 'round'))
  };
}
// missing2DPeriods: which 2D periods still need a session created for
// `yangonDate` ("YYYY-MM-DD", Yangon). Sat (6) / Sun (0) -> [] (weekend
// closed). Otherwise ['am','pm'] minus periods that already have a 2D
// session whose Yangon date (via yangonDateOf) equals yangonDate. 3D
// sessions and other games never count, and an existing row counts whether
// it is open or closed — creation only, never re-opening.
export function missing2DPeriods(yangonDate, sessions) {
  if (typeof yangonDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(yangonDate)) return [];
  const p = yangonDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  if (weekday === 0 || weekday === 6) return [];
  const have = {};
  (sessions || []).forEach(function (s) {
    if (s.game !== '2d') return;
    if (yangonDateOf(s.date) === yangonDate) have[s.period] = true;
  });
  const missing = [];
  if (!have.am) missing.push('am');
  if (!have.pm) missing.push('pm');
  return missing;
}
// winNumberForDate (v2.10): the winning number of one game/period's
// session whose Yangon date equals `ymd` — the session the admin-date
// screens (လယ်ဂျာ grid, ကြီးငယ် list) show. Null when no such session
// exists or it has no winning number yet. NEVER fall back to the latest
// session overall — on a past date that would paint the WRONG number green.
export function winNumberForDate(sessions, game, period, ymd) {
  const s = (sessions || []).find(function (r) {
    return r.game === game && (!period || r.period === period) && yangonDateOf(r.date) === ymd;
  });
  return (s && s.win_number !== null && s.win_number !== undefined && String(s.win_number) !== '') ? String(s.win_number) : null;
}

// ensureToday2DSessions: create today's missing 2D sessions via `pb`
// (pb.js or a fake in tests). `sessions` is the current m23_sessions list,
// `yangonDate` is today's Yangon date ("YYYY-MM-DD"). Returns the created
// rows (open=true, close_at carried forward, date = Yangon midnight). On
// Sat/Sun, or when nothing is missing, creates nothing. Never touches 3D
// or any other game; never re-opens a manually closed session.
export async function ensureToday2DSessions(pb, sessions, yangonDate) {
  const missing = missing2DPeriods(yangonDate, sessions);
  const created = [];
  const dateIso = isoForYangonDate(yangonDate);
  if (!dateIso) return created;
  for (let i = 0; i < missing.length; i++) {
    const period = missing[i];
    const closeAt = buildCloseAt(dateIso, carriedCloseTime(sessions, period));
    const row = await pb.create('m23_sessions', {
      game: '2d', period: period, date: dateIso, open: true, close_at: closeAt
    });
    created.push(row);
  }
  return created;
}
// Passed = kickoff time reached (kickoff_utc*1000 <= now). nowMs defaults
// to Date.now(); tests pass an explicit now. Unknown kickoff is NOT passed
// (old behaviour: hedgeable). NOTE: plain kickoff-passed only — the
// 5-minute auto-close rule lives in the PLAYER app, NOT here.
export function isKickoffPassed(kickoffUtc, nowMs) {
  const ko = normalizeKickoff(kickoffUtc);
  if (ko === null) return false;
  const now = (nowMs === undefined || nowMs === null) ? Date.now() : nowMs;
  return ko * 1000 <= now;
}
// Whether a hedge may still be placed/edited on a ledger match.
export function canHedgeMatch(m, nowMs) {
  if (!m) return false;
  return !isKickoffPassed(m.kickoff_utc, nowMs);
}
// Yangon HH:MM for one leg's fixture, or '' when the fixture/kickoff is unknown.
export function legKickoffTime(leg, fixturesById) {
  if (!leg || !fixturesById) return '';
  const fx = fixturesById[leg.fixture];
  if (!fx) return '';
  return formatKickoffYangon(fx.kickoff_utc) || '';
}
// Earliest kickoff (unix seconds) across a parlay bet's legs, or null when
// no leg has a known kickoff. Used to sort the parlay list by time.
export function parlayEarliestKickoff(bet, fixturesById) {
  let earliest = null;
  ((bet && bet.legs) || []).forEach(function (leg) {
    if (!fixturesById) return;
    const fx = fixturesById[leg.fixture];
    if (fx) {
      const ko = normalizeKickoff(fx.kickoff_utc);
      if (ko !== null && (earliest === null || ko < earliest)) earliest = ko;
    }
  });
  return earliest;
}
// Sort parlay list entries ({ n, v, bet }) by earliest leg kickoff
// ascending; bets with no known kickoff go last. Ties keep amount-first
// (v desc, then name asc) so the old biggest-first order survives when
// times are equal or unknown.
export function sortParlayEntriesByKickoff(entries, fixturesById) {
  return (entries || []).map(function (e, i) {
    return { e: e, i: i, ko: parlayEarliestKickoff(e.bet, fixturesById) };
  }).sort(function (a, b) {
    const aKnown = a.ko !== null, bKnown = b.ko !== null;
    if (aKnown && bKnown) {
      if (a.ko !== b.ko) return a.ko - b.ko;
    } else if (aKnown) return -1;
    else if (bKnown) return 1;
    return (b.e.v - a.e.v) || (a.e.n < b.e.n ? -1 : a.e.n > b.e.n ? 1 : 0) || (a.i - b.i);
  }).map(function (x) { return x.e; });
}

// ---- Body-ledger nets + hedges (Admin v1.6) --------------------------------
// Net per side: body = |home - away| (bigger side), goal = |over - under|.
// Equal amounts -> side null (renders 'မျှ').
export function bodyNetOf(m) {
  const h = m.h || 0, a = m.a || 0;
  if (h === a) return { net: 0, side: null };
  return h > a ? { net: h - a, side: 'h' } : { net: a - h, side: 'a' };
}
export function goalNetOf(m) {
  const o = m.over || 0, u = m.under || 0;
  if (o === u) return { net: 0, side: null };
  return o > u ? { net: o - u, side: 'over' } : { net: u - o, side: 'under' };
}
// Remaining after a hedge; over-net hedges stop at 0 (clamped at Save too).
export function remainingAfterHedge(net, hedgeAmt) {
  return Math.max(0, (net || 0) - (hedgeAmt || 0));
}
// Over-limit excess (Admin v2.19, Pho Nov 21): how much of a remainder sits
// above the per-bet limit — the amount Pho hedges away. 0 at/under the limit.
export function excessOverLimit(rem, lim) {
  return Math.max(0, (rem || 0) - (lim || 0));
}
// Ledger card header: '[bodyOdds] [Home short] & [Away short] / {[goalOdds]}'.
export function ledgerHeaderText(m) {
  const hs = teamShort(m.home_mm || m.home), as = teamShort(m.away_mm || m.away);
  const b = m.bodyOdds || '';
  const g = m.goalOdds || '';
  return (b ? b + ' ' : '') + hs + ' & ' + as + (g ? ' / {' + g + '}' : '');
}
// ledgerFbTableRow (v2.17, Pho Nov 21 — paper spec 'ဇယားပုံစံအကြမ်း'): one
// per-match row's display cells for the လယ်ဂျာ football body table. The
// table shows 2 rows per match: time | home+line | away | goal-over
// line+money, then home money | away money | goal-under line+money. Money
// is the TOTAL stake on that side (computeBodyNet aggregates all singles).
// Unknown kickoff -> '' time; no line -> '' (amounts still show).
export function ledgerFbTableRow(m) {
  const ko = m ? formatKickoffYangon(m.kickoff_utc) : null;
  return {
    time: ko || '',
    homeTeam: teamShort((m && m.home_mm) || (m && m.home) || ''),
    homeLine: (m && m.bodyOdds) || '',
    awayTeam: teamShort((m && m.away_mm) || (m && m.away) || ''),
    goalLine: (m && m.goalOdds) || '',
    h: (m && m.h) || 0,
    a: (m && m.a) || 0,
    over: (m && m.over) || 0,
    under: (m && m.under) || 0
  };
}
// One entry line for the စာရင်းချုပ် lists (Pho's EXACT format):
// body '(odds)Team amount', goal '(odds)Team(⬆️/⬇️)amount'.
// entry = { kind:'body'|'goal', odds, team (short), side ('over'|'under' for goal), amount }.
export function entryLineText(e) {
  const odds = e.odds || '';
  const team = e.team || '';
  const amt = e.amount || 0;
  if (e.kind === 'goal') {
    const dir = e.side === 'under' ? '⬇️' : '⬆️';
    return '(' + odds + ')' + team + '(' + dir + ')' + amt;
  }
  return '(' + odds + ')' + team + ' ' + amt;
}
// Gold hedge line on a ledger card: 'အကန် ⬆️150000' / 'အကန် Real 330000'.
// (body hedge shows the net-side team; goal hedge shows the arrow.)
export function hedgeLineText(h) {
  if (!h) return '';
  if (h.kind === 'goal') {
    const dir = h.side === 'under' ? '⬇️' : '⬆️';
    return 'အကန် ' + dir + (h.amount || 0);
  }
  return 'အကန် ' + (h.team || '') + ' ' + (h.amount || 0);
}
// Resolve a leg's team name Burmese-first (v2.18, Pho Nov 21): the
// fixture row's _mm when present, else the leg's English name. `which`
// is 'h' or 'a'. fixturesById is optional — without it, English.
export function legTeamName(leg, which, fixturesById) {
  const fx = (fixturesById || {})[(leg && leg.fixture) || ''];
  if (fx) return which === 'h' ? (fx.home_mm || fx.home || leg.home || '') : (fx.away_mm || fx.away || leg.away || '');
  return which === 'h' ? (leg.home || '') : (leg.away || '');
}
// Group body bets by bettor name -> [{ name, lines: [entryLineText] }].
// betsFb: body bets (type 'body'); nameOf: (playerId) -> display name.
// fixturesById (optional): map fixture PB id -> fixture row; when given,
// team names are Burmese-first via legTeamName (v2.18).
// Bettors sorted ascending by name; a bettor's lines in bet order.
// A leg becomes one entry: body -> its picked team; goal -> the match's
// home team (short) with the over/under arrow (goal lines carry no team
// of their own; Pho's format puts the home team there).
export function groupBettorEntries(betsFb, nameOf, fixturesById) {
  const byName = {};
  const order = [];
  (betsFb || []).forEach(function (b) {
    if (b.type !== 'body') return;
    const name = (nameOf && nameOf(b.player)) || String(b.player || '');
    if (!byName[name]) { byName[name] = []; order.push(name); }
    (b.legs || []).forEach(function (leg) {
      if (leg.kind === 'body') {
        const team = teamShort(legTeamName(leg, leg.pick === 'h' ? 'h' : 'a', fixturesById));
        byName[name].push(entryLineText({ kind: 'body', odds: leg.hcp || lineToMyanmar(leg.ah_line) || '', team: team, amount: leg.stake || 0 }));
      } else if (leg.kind === 'goal') {
        const team = teamShort(legTeamName(leg, 'h', fixturesById));
        byName[name].push(entryLineText({ kind: 'goal', odds: leg.over || lineToMyanmar(leg.gl_line) || '', team: team, side: leg.pick, amount: leg.stake || 0 }));
      }
    });
  });
  order.sort();
  return order.map(function (name) { return { name: name, lines: byName[name] }; });
}
// Group hedges by bookie -> [{ bookie, lines: [entryLineText] }].
// Bookies in first-appearance order; within a bookie, lines are ordered by
// match (first appearance) with the goal line before the body line per match.
export function groupHedgeEntries(hedges) {
  const byBookie = {};
  const bookieOrder = [];
  (hedges || []).forEach(function (h) {
    const bookie = h.bookie || '';
    if (!byBookie[bookie]) { byBookie[bookie] = []; bookieOrder.push(bookie); }
    byBookie[bookie].push(h);
  });
  return bookieOrder.map(function (bookie) {
    const rows = byBookie[bookie];
    // Order by match (first appearance), goal before body within a match.
    const fxOrder = [];
    const byFx = {};
    rows.forEach(function (h) {
      const fx = h.fixture || '';
      if (!byFx[fx]) { byFx[fx] = { goal: [], body: [] }; fxOrder.push(fx); }
      if (h.kind === 'goal') byFx[fx].goal.push(h); else byFx[fx].body.push(h);
    });
    const lines = [];
    fxOrder.forEach(function (fx) {
      byFx[fx].goal.forEach(function (h) { lines.push(entryLineText({ kind: 'goal', odds: h.odds || '', team: h.team || '', side: h.side, amount: h.amount || 0 })); });
      byFx[fx].body.forEach(function (h) { lines.push(entryLineText({ kind: 'body', odds: h.odds || '', team: h.team || '', amount: h.amount || 0 })); });
    });
    return { bookie: bookie, lines: lines };
  });
}
// 'စာရင်းချုပ် ကူးမယ်' copy text: headings + names + one-line entries,
// blank line between names, no totals.
export function fbsumCopyText(bettorGroups, hedgeGroups) {
  const parts = [];
  parts.push('ထိုးသားစာရင်း');
  (bettorGroups || []).forEach(function (g) {
    parts.push('');
    parts.push(g.name);
    g.lines.forEach(function (ln) { parts.push(ln); });
  });
  parts.push('');
  parts.push('အကန်စာရင်း');
  if (!hedgeGroups || !hedgeGroups.length) {
    parts.push('');
    parts.push('အကန် မရှိသေးပါ');
  } else {
    hedgeGroups.forEach(function (g) {
      parts.push('');
      parts.push(g.bookie);
      g.lines.forEach(function (ln) { parts.push(ln); });
    });
  }
  return parts.join('\n').replace(/\n+$/, '');
}
// Ledger copy-all: per match the header, amounts, post-hedge net line and
// an optional 'အကန် …' line; blank line between matches.
// matches: computeBodyNet rows; hedgeByKey: match key -> {body, goal} rows.
export function ledgerCopyText(matches, hedgeByKey) {
  const blocks = [];
  (matches || []).forEach(function (m) {
    const hedges = (hedgeByKey && hedgeByKey[m.key]) || {};
    const bn = bodyNetOf(m), gn = goalNetOf(m);
    const bRem = remainingAfterHedge(bn.net, hedges.body ? hedges.body.amount : 0);
    const gRem = remainingAfterHedge(gn.net, hedges.goal ? hedges.goal.amount : 0);
    const lines = [];
    lines.push(ledgerHeaderText(m));
    lines.push((m.h || 0) + ' ' + (m.a || 0) + ' ⬆️' + (m.over || 0));
    lines.push('⬇️' + (m.under || 0));
    const bTxt = bRem === 0 ? 'မျှ' : (bn.side === 'h' ? teamShort(m.home_mm || m.home) : teamShort(m.away_mm || m.away)) + ' ' + bRem;
    const gTxt = gRem === 0 ? 'မျှ' : '{' + (gn.side === 'over' ? '⬆️' : '⬇️') + gRem + '}';
    lines.push(bTxt + ' ' + gTxt);
    const hl = [];
    if (hedges.body) hl.push(hedgeLineText(hedges.body));
    if (hedges.goal) hl.push(hedgeLineText(hedges.goal));
    if (hl.length) lines.push(hl.join(' · '));
    blocks.push(lines.join('\n'));
  });
  return blocks.join('\n\n');
}

// ---- Hedge persistence (m23_hedges) ----------------------------------------
// Load all hedge rows (Admin signs in as superuser; players never read them).
export async function loadHedges(pb) {
  return pb.getAll('m23_hedges', { sort: '-created' });
}
// Index hedges by match key. m23_hedges.fixture is the fixture api_id, while
// computeBodyNet keys (and leg.fixture) are the fixture PB id, so the join
// maps api_id -> PB id via the fixtures list. A hedge whose fixture matches
// no known fixture is indexed under its api_id as a fallback key.
export function indexHedgesByMatch(hedges, fixtures) {
  const apiToPb = {};
  (fixtures || []).forEach(function (f) { if (f.api_id) apiToPb[f.api_id] = f.id; });
  const byMatch = {};
  (hedges || []).forEach(function (h) {
    const key = apiToPb[h.fixture] || h.fixture;
    if (!byMatch[key]) byMatch[key] = { body: null, goal: null };
    if (h.kind === 'body') byMatch[key].body = h;
    else if (h.kind === 'goal') byMatch[key].goal = h;
  });
  return byMatch;
}
// Distinct bookie names already used (for the hedge panel datalist; starts
// empty and grows from Pho's entries — no predefined list).
export function usedBookies(hedges) {
  const seen = {};
  const out = [];
  (hedges || []).forEach(function (h) {
    const b = (h.bookie || '').trim();
    if (b && !seen[b]) { seen[b] = true; out.push(b); }
  });
  return out;
}
// Save one match's hedges. existing = {body, goal} current rows for the
// match (or nulls); drafts = {body:{amount,bookie}|null, goal:{amount,bookie,side}|null};
// matchInfo = { fixtureApiId, date, home, away, bodyOdds, goalOdds,
//   bodyTeam (net-side short), goalTeam (home short) }.
// Amount > 0: create (no row) or update (row exists). Amount 0 / no draft:
// delete the row if one exists. Hedge amounts are clamped to the net at
// Save (remaining stops at 0) — the stored amount never exceeds the net.
export async function saveHedges(pb, existing, matchInfo, drafts) {
  const kinds = ['body', 'goal'];
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const draft = drafts ? drafts[kind] : null;
    const row = existing ? existing[kind] : null;
    const amt = draft ? Math.max(0, Math.round(draft.amount || 0)) : 0;
    if (amt <= 0) {
      if (row && row.id) await pb.del('m23_hedges', row.id);
      continue;
    }
    const body = {
      fixture: matchInfo.fixtureApiId,
      kind: kind,
      team: kind === 'body' ? matchInfo.bodyTeam : matchInfo.goalTeam,
      side: kind === 'goal' ? (draft.side || '') : '',
      odds: kind === 'body' ? (matchInfo.bodyOdds || '') : (matchInfo.goalOdds || ''),
      amount: amt,
      bookie: (draft.bookie || '').trim(),
      date: matchInfo.date || '',
      home: matchInfo.home || '',
      away: matchInfo.away || ''
    };
    if (row && row.id) await pb.update('m23_hedges', row.id, body);
    else await pb.create('m23_hedges', body);
  }
}

// ---- Football Daily result (Daily summary only, Pho) ----------------------
// Player's settled result, NO 1.5% rebate on player bets. Pho (Nov 15 08:54,
// CORRECTED): a body bettor who wins 10000 gets 9500 (5% commission only);
// who loses 10000 loses the full 10000. The 1.5% is ONLY for the hedge
// (အကန်) — '1.5%က အကန်အတွက်ပဲပြောတာ ၃ခုမတူ' (the three are different).
// So footballDailyResult returns the settled profit as-is (settleBodyBet /
// settleParlayBet already apply the 5% body / 15/20/30% parlay commissions;
// payouts to players are untouched). The 1.5% hedge rebate is a separate
// hedge calculation, NOT applied here.
// Hedge rebate rate (Pho, Nov 15 08:20): 1.5% on hedge amounts only.
export const FOOTBALL_REBATE = 0.015;
// Daily-summary result for ONE settled football bet (player's view;
// + = player wins, - = player loses). Returns null when the bet is not
// fully settled yet (open legs).
export function footballDailyResult(bet, fixturesById, settings) {
  const r = settleFbBet(bet, fixturesById, settings);
  if (!r) return null;
  return r.profit; // settled profit as-is: body win 9500 / loss -10000, parlay tier-commissioned
}
// Sum of the Daily results over settled football bets.
export function footballDailyTotal(fbBets, fixturesById, settings) {
  let total = 0;
  (fbBets || []).forEach(function (b) {
    const d = footballDailyResult(b, fixturesById, settings);
    if (d !== null && d !== undefined) total += d;
  });
  return total;
}
// Daily detail for ONE settled football bet: {gross, net} where gross is the
// pre-commission result and net is the settled profit (Pho's display format
// is 'gross (net)', e.g. '+100000 (+95000)' for a bettor win). Returns null
// when the bet is not fully settled yet.
export function footballDailyDetail(bet, fixturesById, settings) {
  const r = settleFbBet(bet, fixturesById, settings);
  if (!r) return null;
  const stake = bet.stake || 0;
  let gross = 0;
  if (bet.type === 'parlay') {
    let prod = 1, anyLoss = false;
    r.legs.forEach(function (l) {
      if (l.res === 'loss') anyLoss = true;
      prod *= legFactor(l.res, l.pyar);
    });
    gross = anyLoss ? -stake : stake * prod - stake;
  } else {
    // Gross (pre-commission) result per Pho Nov 17: a full win's gross is
    // the full stake; a boundary win/loss is the pyar amount; a full loss
    // is the full stake. Net (r.profit) already applies the 5% on wins.
    r.legs.forEach(function (l) {
      const st = l.stake || 0;
      if (l.res === 'win') gross += st;
      else if (l.res === 'halfWin') gross += st * (l.pyar || 0) / 100;
      else if (l.res === 'halfLoss') gross -= st * (l.pyar || 0) / 100;
      else if (l.res === 'loss') gross -= st;
    });
  }
  return { gross: gross, net: r.profit };
}

// ---- Hedge 1.5% rebate (Daily summary, hedge profit/loss only — Pho) -------
// Pho (Nov 15 08:56): the 1.5% goes 'အကန် အမြတ်/အရှုံး ထဲမှာ' (in the hedge
// profit/loss). A hedge is Pho's own bet with a hedge bookie, settled like a
// body bettor: the bookie takes 5% on Pho's wins, then gives 1.5% back.
//   hedge win:  gross x (1 - 0.05 + 0.015) = gross x 0.965
//   hedge loss: gross x (1 - 0.015)         = gross x 0.985
// (Pho's exact math: +10000 -> +9650, -10000 -> -9850.) Player bets get NO
// 1.5% (footballDailyResult above). The hedge odds are stored as a Myanmar
// string ('2+35', '3-25', '2+5', '3=', '='), so they are parsed back to a
// line before settling.
// Parse a Myanmar odds string back to its line value.
// '2+35' -> 2.35, '3-25' -> -3.25, '2+5' -> 2.5, '3=' -> 3, '=' -> 0,
// '=+5' -> 0.5, '=-25' -> -0.25. Returns null when unparseable.
export function myanmarToLine(str) {
  if (str == null || str === '') return null;
  const s = String(str).trim();
  if (s === '=') return 0;
  const m = s.match(/^(=|\d+)([+\-=])(\d*)$/);
  if (!m) return null;
  const goal = m[1] === '=' ? 0 : parseInt(m[1], 10);
  const sign = m[2];
  const pyarStr = m[3] || '';
  if (sign === '=' || !pyarStr) return goal;
  const frac = parseInt(pyarStr, 10) / Math.pow(10, pyarStr.length);
  const val = goal + frac;
  return sign === '-' ? -val : val;
}
// Settle ONE hedge against its fixture. Returns {res, pyar, gross} where
// gross is Pho's pre-rebate profit/loss (+ = Pho wins the hedge), or null
// when the fixture is not finished, the odds do not parse, or the hedged
// team cannot be mapped to home/away. `fixturesByApiId` maps api_id -> fixture.
export function settleHedge(h, fixturesByApiId) {
  if (!h || !h.fixture) return null;
  const fx = (fixturesByApiId || {})[h.fixture];
  if (!fx || fx.status !== 'finished') return null;
  const hg = fx.home_goals, ag = fx.away_goals;
  if (hg == null || ag == null) return null;
  const line = myanmarToLine(h.odds);
  if (line == null) return null;
  const amount = h.amount || 0;
  let leg = null;
  if (h.kind === 'body') {
    // Team names are Burmese-first since v2.18 (Pho Nov 21): new hedges
    // store the Burmese short name, old ones the English short name —
    // match either so old hedges still settle.
    const homeShort = teamShort(fx.home_mm || h.home || fx.home);
    const awayShort = teamShort(fx.away_mm || h.away || fx.away);
    const homeShortEn = teamShort(h.home || fx.home);
    const awayShortEn = teamShort(h.away || fx.away);
    let pick = null;
    if (h.team === homeShort || h.team === homeShortEn) pick = 'h';
    else if (h.team === awayShort || h.team === awayShortEn) pick = 'a';
    else return null;
    leg = { kind: 'body', pick: pick, ah_line: line };
  } else if (h.kind === 'goal') {
    if (h.side !== 'over' && h.side !== 'under') return null;
    leg = { kind: 'goal', pick: h.side, gl_line: line };
  } else {
    return null;
  }
  const r = settleLeg(leg, fx);
  if (!r) return null;
  // Pho Nov 17 14:14: hedges settle EXACTLY like player bets (အထိုးအကန်
  // အစား အကုန် အဲ့လိုပဲ) — the same main-line rule, so the same gross:
  // full win = full amount, pyar win = amount x pyar/100, pyar loss =
  // -amount x pyar/100, full loss = -amount, push = 0. (The 1.5% rebate
  // is NOT here — hedgeDailyResult applies win x0.965 / loss x0.985.)
  let gross = 0;
  if (r.res === 'win') gross = amount;
  else if (r.res === 'halfWin') gross = amount * (r.pyar || 0) / 100;
  else if (r.res === 'halfLoss') gross = -amount * (r.pyar || 0) / 100;
  else if (r.res === 'loss') gross = -amount;
  return { res: r.res, pyar: r.pyar || 0, gross: gross };
}
// Daily-summary result for ONE hedge (Pho's view; + = Pho wins the hedge).
// Applies the 1.5% hedge rebate: win x0.965, loss x0.985, push 0.
// Returns null when the hedge is not settled yet.
export function hedgeDailyResult(h, fixturesByApiId) {
  const s = settleHedge(h, fixturesByApiId);
  if (!s) return null;
  const g = s.gross;
  if (g > 0) return Math.round(g * 0.965);
  if (g < 0) return Math.round(g * 0.985);
  return 0;
}
// Sum of the hedge Daily results over settled hedges.
export function hedgeDailyTotal(hedges, fixturesByApiId) {
  let total = 0;
  (hedges || []).forEach(function (h) {
    const d = hedgeDailyResult(h, fixturesByApiId);
    if (d !== null && d !== undefined) total += d;
  });
  return total;
}

// ---- Ledger red state -------------------------------------------------------
// Blocked numbers show RED IDENTICAL to over-limit (same ' over' class,
// never a separate dark/strikethrough/'(ပိတ်)' treatment — Pho Nov 13).
export function cellClass(v, lim, blocked) {
  if (blocked) return ' over';
  if (v > lim) return ' over';
  if (v) return ' hot';
  return '';
}

// ---- Parlay -----------------------------------------------------------------
// NOTE (Pho Nov 17): parlay commission (comm_23/47/810 in m23_settings) no
// longer affects parlays — parlays now pay from the balanced table below.
// parlayCommission is kept (exported) only because Admin Settings still
// reads/writes those fields; it is no longer called by parlayPayout.
export function parlayCommission(nLegs, settings) {
  const s = settings || {};
  if (nLegs <= 3) return (s.comm_23 !== undefined ? s.comm_23 : 15);
  if (nLegs <= 7) return (s.comm_47 !== undefined ? s.comm_47 : 20);
  return (s.comm_810 !== undefined ? s.comm_810 : 30);
}

// Leg factor (schema §5): full win x2; partial win x(1+pyar/100);
// partial loss x(1-pyar/100); push x1; full loss = 0 (whole parlay pays 0).
export function legFactor(res, pyar) {
  const p = pyar || 0;
  if (res === 'win') return 2;
  if (res === 'halfWin') return 1 + p / 100;
  if (res === 'halfLoss') return 1 - p / 100;
  if (res === 'push') return 1;
  return 0; // 'loss' (or unset) — parlayPayout short-circuits on loss anyway
}

// Balanced parlay table (Pho Nov 17, APPROVED): pay a LITTLE MORE than the
// outside paper bookie's printed sheet, balanced across every draw cell.
// The old formula (legs x2, then 15/20/30% commission) paid far above the
// sheet at high legs (8 legs: 179.2x vs sheet 100x) — no commission tier
// could fix that (matching the sheet by formula would need ~57% at 7-8
// legs). The table IS the net return multiplier (stake included).
// All-win multipliers by legs (sheet 4-8 legs: 13/21/32/50/100, +~10%):
const PARLAY_ALLWIN = { 2: 3.5, 3: 7, 4: 14, 5: 23, 6: 35, 7: 55, 8: 110, 9: 200, 10: 350 };
// Draw rows, legs 4-8, draws 1-4 (sheet values x1.1, cleaned to .5 steps):
//   1 draw:  5/10/16/30/40  -> 5.5/11/18/33/44
//   2 draws: 2/4/6/12/22    -> 2.5/4.5/7/13.5/24.5
//   3 draws: -/3/4/7/12     -> 2/3.5/4.5/8/13.5 (4 legs: no sheet value, 2x)
//   4 draws: -/1/2/7/8      -> 1/1.1/2.5/8/9 (4 legs all-push: stake back)
const PARLAY_DRAWS = {
  4: { 1: 5.5, 2: 2.5, 3: 2, 4: 1 },
  5: { 1: 11, 2: 4.5, 3: 3.5, 4: 1.1 },
  6: { 1: 18, 2: 7, 3: 4.5, 4: 2.5 },
  7: { 1: 33, 2: 13.5, 3: 8, 4: 8 },
  8: { 1: 44, 2: 24.5, 3: 13.5, 4: 9 }
};

// Table multiplier for n legs with d pushes. Outside the printed rows
// (2-3 / 9-10 legs, or 5+ draws) the all-win value halves per draw,
// floored at 1x (stake back).
export function parlayTableMult(nLegs, nDraws) {
  const row = PARLAY_DRAWS[nLegs];
  if (row && row[nDraws] !== undefined) return row[nDraws];
  const base = PARLAY_ALLWIN[nLegs];
  if (base === undefined) return 1;
  return Math.max(1, base / Math.pow(2, nDraws));
}

export function parlayPayout(stake, legs, settings) {
  const ls = legs || [];
  if (!ls.length) return 0;
  let draws = 0;
  let scale = 1;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (l.res === 'loss') return 0;
    if (l.res === 'push') { draws++; continue; }
    scale *= legFactor(l.res, l.pyar) / 2;
  }
  return Math.round(stake * parlayTableMult(ls.length, draws) * scale);
}

// ---- Football leg settlement ------------------------------------------------
// pyar is stored as HUNDREDTHS of the line fraction (line -1.25 -> pyar 25,
// line 1.45 -> pyar 45, line -1.5 -> pyar 50). The displayed Myanmar string
// shows the same digits (".5" renders as "5"); the math needs hundredths.
// CORRECTED (Pho Nov 17): the pyar is the BOUNDARY (ပြားစွန်းး) amount
// ONLY — at the exact boundary the line's side wins/loses stake*pyar/100.
// A full win pays the FULL stake as profit (5% off), NOT the pyar rate:
// the old reading "1+45 -> 1000 wins 450" applied the pyar to EVERY win
// and was wrong.
export function pyarFromLine(line) {
  return Math.round((Math.abs(line) % 1) * 100);
}

// Evaluate one Asian-handicap leg (BODY only).
// `line` is the raw API line, `margin` is the score difference the line
// applies to (body pick h: hg-ag with line ah_line; body pick a: ag-hg with
// line -ah_line). adj = margin + line: >0 win, =0 push, <0 loss.
// CORRECTED (Pho Nov 17 — "စျေးဖွင့်တဲ့ မိန်း ၁ဂိုး ၂ဂိုး ကိုတည်ရမှာပြီးမှ
// ပြားယူ"): the MAIN line (the integer part, 1 or 2 goals) is the base;
// the pyar applies ONLY when the result lands exactly ON the main, IN
// THE LINE'S DIRECTION (line < 0 -> margin == +main; line > 0 -> margin
// == -main). If the result deviates from the main, it is a FULL win /
// FULL loss — no pyar, whatever the fraction is (.25/.5/.75 alike). The
// fraction sets only the pyar AMOUNT. Which side wins the pyar is decided
// by the LINE SIGN: line < 0 -> the pick wins it (halfWin), line > 0 ->
// the pick loses it (halfLoss).
// (This replaces the old quarter-split: a 1.75 line winning by 2 is a FULL
// win, not a pyar loss; a 1.5 line winning by 1 is a pyar win, not a loss.)
// NOTE: evalLine is for BODY legs only. Goal-total legs use evalGoalLine
// below — a goal total is always positive, so its pyar case is
// total == main and its win/loss compares total to |gl_line|; routing a
// goal leg through the evalLine sign-flip would make a NEGATIVE goal line
// ("3-45") always win for the over. Do NOT route goal legs through here.
export function evalLine(line, margin) {
  const pyar = pyarFromLine(line);
  const frac = Math.abs(line) % 1;
  const main = Math.trunc(Math.abs(line));
  const adj = margin + line;
  if (frac > 0) {
    const pyarMargin = line < 0 ? main : -main;
    if (margin === pyarMargin) {
      return { res: line < 0 ? 'halfWin' : 'halfLoss', pyar: pyar };
    }
  }
  return { res: adj > 0 ? 'win' : adj < 0 ? 'loss' : 'push', pyar: pyar };
}

// Goal-total evaluation (Pho Nov 17, "3-45" example). A goal line's sign
// is the pyar direction: "+" line (e.g. 2+25) -> the OVER wins the pyar
// at the main; "-" line (e.g. 3-45, "3 goals, 45 lose") -> the OVER LOSES
// the pyar at the main and the UNDER wins it. Away from the main the
// over/under is decided by total vs |gl_line|.
export function evalGoalLine(glLine, total, pick) {
  const g = Math.abs(glLine);
  const frac = g % 1;
  const main = Math.trunc(g);
  const pyar = Math.round(frac * 100);
  if (frac > 0 && total === main) {
    const overWinsPyar = glLine > 0;
    const won = pick === 'over' ? overWinsPyar : !overWinsPyar;
    return { res: won ? 'halfWin' : 'halfLoss', pyar: pyar };
  }
  if (total > g) return { res: pick === 'over' ? 'win' : 'loss', pyar: pyar };
  if (total < g) return { res: pick === 'over' ? 'loss' : 'win', pyar: pyar };
  return { res: 'push', pyar: pyar };
}

// Settle one leg against a finished fixture. Returns null when the fixture
// is not finished (scores missing) — the bet stays open.
// SETTLED (Pho Nov 13 12:44, CORRECTED Nov 17): body commission IS
// deducted — 5% on the PROFIT of every body bet (no big/small distinction;
// body_comm_small unused). The 5% applies to WINS only, never to losses.
// The stake is returned in full on a win; a boundary loss charges the
// pyar with NO commission; and the stake was already deducted when the bet
// was placed, so settlement only ever ADDS the payout back — a loss never
// deducts again (Pho Nov 17, "123 အကုန်").
export function settleLeg(leg, fixture) {
  if (!fixture || fixture.status !== 'finished') return null;
  const hg = fixture.home_goals;
  const ag = fixture.away_goals;
  if (hg === null || hg === undefined || ag === null || ag === undefined) return null;
  if (leg.kind === 'body') {
    const line = leg.ah_line;
    if (line === null || line === undefined) return null;
    if (leg.pick === 'h') return evalLine(line, hg - ag);
    if (leg.pick === 'a') return evalLine(-line, ag - hg);
    return null;
  }
  if (leg.kind === 'goal') {
    const line = leg.gl_line;
    if (line === null || line === undefined) return null;
    const total = hg + ag;
    // Goal legs use evalGoalLine, NOT the evalLine sign-flip: a goal
    // total is always positive, and a negative goal line ("3-45") must
    // still lose for the over below the main.
    if (leg.pick === 'over') return evalGoalLine(line, total, 'over');
    if (leg.pick === 'under') return evalGoalLine(line, total, 'under');
    return null;
  }
  return null;
}

// Body settlement (Pho Nov 17, confirmed by his numbers): 5% commission
// on WINS only, never on losses; the stake was already deducted when the
// bet was placed, so the payout is the amount credited BACK (a loss never
// deducts again). win -> stake + stake*0.95 (full win: profit = full
// stake); halfWin -> stake + stake*pyar/100*0.95 (boundary win: profit =
// pyar amount); halfLoss -> stake - stake*pyar/100 (boundary loss: lose
// the pyar, NO commission); push -> stake; loss -> 0.
export function settleBodyBet(bet, fixturesById, settings) {
  const legs = (bet.legs || []).map(function (leg) {
    const fx = fixturesById[leg.fixture];
    const r = settleLeg(leg, fx);
    if (!r) return Object.assign({}, leg, { res: null, pyar: 0, _open: true });
    return Object.assign({}, leg, { res: r.res, pyar: r.pyar, _open: false });
  });
  if (legs.some(function (l) { return l._open; })) return null; // not all finished
  // Commission rate: body_comm_big from settings (Pho: everything 5%).
  // Default 5 when settings is missing/empty. body_comm_small is unused.
  const comm = (settings && typeof settings.body_comm_big === 'number') ? settings.body_comm_big : 5;
  const keep = 1 - comm / 100;
  let payout = 0;
  legs.forEach(function (l) {
    const st = l.stake || 0;
    if (l.res === 'win') payout += st + st * keep;
    else if (l.res === 'halfWin') payout += st + st * (l.pyar || 0) / 100 * keep;
    else if (l.res === 'halfLoss') payout += st - st * (l.pyar || 0) / 100;
    else if (l.res === 'push') payout += st;
  });
  payout = Math.round(payout);
  const stake = bet.stake || 0;
  const status = payout === 0 ? 'lost' : payout > stake ? 'won' : payout === stake ? 'settled' : 'lost';
  return { status: status, payout: payout, profit: payout - stake, legs: legs };
}

export function settleParlayBet(bet, fixturesById, settings) {
  const legs = (bet.legs || []).map(function (leg) {
    const fx = fixturesById[leg.fixture];
    const r = settleLeg(leg, fx);
    if (!r) return Object.assign({}, leg, { res: null, pyar: 0, _open: true });
    return Object.assign({}, leg, { res: r.res, pyar: r.pyar, _open: false });
  });
  if (legs.some(function (l) { return l._open; })) return null;
  const stake = bet.stake || 0;
  const payout = parlayPayout(stake, legs, settings);
  let status;
  if (legs.some(function (l) { return l.res === 'loss'; })) status = 'lost';
  else if (payout > stake) status = 'won';
  else if (payout === stake) status = 'settled';
  else status = 'lost';
  return { status: status, payout: payout, profit: payout - stake, legs: legs };
}

export function settleFbBet(bet, fixturesById, settings) {
  if (bet.type === 'parlay') return settleParlayBet(bet, fixturesById, settings);
  return settleBodyBet(bet, fixturesById, settings);
}

// ---- 2D / 3D settlement -----------------------------------------------------
// ratePer100: 9000 (2D = 90x) / 60000 (3D = 600x). Direct and reverse are
// counted separately: a winning direct line pays amt x rate; a winning
// reverse line pays rev x rate. (For a palindrome such as 11, amt and rev
// are both stakes on the same number, so both pay — same as the ledger
// aggregation in aggregate2D.)
export function settle2D3DBet(bet, winNumber, ratePer100) {
  const rate = (ratePer100 || 0) / 100;
  let win = 0;
  (bet.lines || []).forEach(function (ln) {
    const n = String(ln.n);
    if (n === String(winNumber)) win += (ln.amt || 0) * rate;
    if (ln.rev && reverse2(n) === String(winNumber)) win += (ln.rev || 0) * rate;
  });
  win = Math.round(win);
  return { status: win > 0 ? 'won' : 'lost', win_amount: win };
}

// ---- PocketBase orchestration (pb = pb.js module or a fake in tests) --------
// Approve a top-up / withdraw request — schema §7 side effects, together:
//   topup:    wallet_tx(kind=topup, +amount, ref_id=request id) AND
//             player.balance += amount AND request approved + decided_at.
//   withdraw: wallet_tx(kind=withdraw, -amount) AND balance -= amount AND
//             request approved + decided_at.
// The balance invariant (balance = sum of wallet_tx) is kept by writing the
// tx row in the same step and storing balance_after on it.
export async function approveRequest(pb, req) {
  const now = new Date().toISOString();
  const player = await pb.getOne('m23_players', req.player);
  const amount = req.amount || 0;
  const isTopup = req.kind === 'topup';
  const signed = isTopup ? amount : -amount;
  const newBalance = (player.balance || 0) + signed;
  const tx = await pb.create('m23_wallet_tx', {
    player: req.player,
    kind: isTopup ? 'topup' : 'withdraw',
    amount: signed,
    ref_id: req.id,
    note: (isTopup ? 'ငွေသွင်း' : 'ငွေထုတ်') + ' — ' + (req.method || ''),
    balance_after: newBalance
  });
  await pb.update('m23_players', req.player, { balance: newBalance });
  const updated = await pb.update('m23_requests', req.id, { status: 'approved', decided_at: now });
  return { request: updated, tx: tx, newBalance: newBalance };
}

export async function rejectRequest(pb, req) {
  const now = new Date().toISOString();
  return pb.update('m23_requests', req.id, { status: 'rejected', decided_at: now });
}

// Settle one 2D or 3D session after Admin sets win_number.
// bets: placed m23_bets_2d (game '2d') or m23_bets_3d (game '3d') rows.
// Winners: bet -> won + win_amount, wallet_tx kind win_2d/win_3d (+win),
// player balance += win. Losers: bet -> lost + win_amount 0, no money moves.
export async function settleSession(pb, session, bets, settings) {
  const game = session.game;
  const collection = game === '2d' ? 'm23_bets_2d' : 'm23_bets_3d';
  const ratePer100 = game === '2d'
    ? (settings.rate_2d !== undefined ? settings.rate_2d : 9000)
    : (settings.rate_3d !== undefined ? settings.rate_3d : 60000);
  const winKind = game === '2d' ? 'win_2d' : 'win_3d';
  const balances = {}; // playerId -> current balance (read once, accumulated)
  let settled = 0, winners = 0, paidOut = 0;
  for (const bet of bets || []) {
    if (bet.status && bet.status !== 'placed') continue;
    const r = settle2D3DBet(bet, session.win_number, ratePer100);
    await pb.update(collection, bet.id, { status: r.status, win_amount: r.win_amount });
    settled++;
    if (r.win_amount > 0) {
      winners++;
      paidOut += r.win_amount;
      if (balances[bet.player] === undefined) {
        const pl = await pb.getOne('m23_players', bet.player);
        balances[bet.player] = pl.balance || 0;
      }
      balances[bet.player] += r.win_amount;
      await pb.create('m23_wallet_tx', {
        player: bet.player, kind: winKind, amount: r.win_amount,
        ref_id: bet.id, note: (game === '2d' ? '2D' : '3D') + ' အနိုင်',
        balance_after: balances[bet.player]
      });
    }
  }
  for (const pid of Object.keys(balances)) {
    await pb.update('m23_players', pid, { balance: balances[pid] });
  }
  return { settled: settled, winners: winners, paidOut: paidOut };
}

// Auto-settle toggle (Admin v2.16, Pho Nov 21 06:59).
// ONE toggle in the Admin app: Auto ON = the VPS job settles finished
// matches by itself every 30 min; Auto OFF = the VPS job skips
// settlement and Admin settles by hand from the Results screen
// (စာရင်းချုပ် button -> settleFootballNow + Summary screen).
// The toggle's value lives in m23_settings.body_comm_small — a DEAD
// field (small-match body commission, unused since schema §7 Q4 settled
// everything at 5%; NO code reads it). It is used ONLY because
// PocketBase silently drops unknown fields on record update, so a
// dedicated `auto_settle_fb` boolean cannot be written from the Admin
// app until the live m23_settings schema gains that field (a live
// schema change — needs Pho's approval). Until then:
//   body_comm_small === 0  -> Auto OFF
//   anything else, incl. missing / seed 8 -> Auto ON (default ON).
// When the schema gains auto_settle_fb, switch these two helpers to
// it — the Admin toggle and the VPS gate both read through here.
export function isAutoSettleOn(settings) {
  const s = settings || {};
  return s.body_comm_small !== 0;
}
export function autoSettlePatch(nextOn) {
  return { body_comm_small: nextOn ? 8 : 0 };
}

// Settle football bets whose fixtures are finished. Bets with any leg still
// open (fixture not finished) are skipped and left status=open.
// Winners are credited via wallet_tx kind win_fb (+payout) + balance.
// NOTE: settlement NEVER touches m23_fixtures — in manual mode (Auto OFF)
// unsettled fixtures stay listed on the Results screen for Admin to
// check; only bets/players/wallet_tx are written.
export async function settleFootball(pb, fbBets, fixturesById, settings) {
  const balances = {};
  let settled = 0, winners = 0, paidOut = 0, skipped = 0;
  for (const bet of fbBets || []) {
    if (bet.status && bet.status !== 'open') continue;
    const r = settleFbBet(bet, fixturesById, settings);
    if (!r) { skipped++; continue; }
    const legs = r.legs.map(function (l) {
      const c = Object.assign({}, l); delete c._open; return c;
    });
    await pb.update('m23_bets_fb', bet.id, {
      status: r.status, payout: r.payout, profit: r.profit, legs: legs
    });
    settled++;
    if (r.payout > 0) {
      winners++;
      paidOut += r.payout;
      if (balances[bet.player] === undefined) {
        const pl = await pb.getOne('m23_players', bet.player);
        balances[bet.player] = pl.balance || 0;
      }
      balances[bet.player] += r.payout;
      await pb.create('m23_wallet_tx', {
        player: bet.player, kind: 'win_fb', amount: r.payout,
        ref_id: bet.id, note: 'ဘောပွဲ အနိုင်',
        balance_after: balances[bet.player]
      });
    }
  }
  for (const pid of Object.keys(balances)) {
    await pb.update('m23_players', pid, { balance: balances[pid] });
  }
  return { settled: settled, winners: winners, paidOut: paidOut, skipped: skipped };
}
