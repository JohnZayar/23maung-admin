// logic.js — pure PocketBase-independent logic for the 23မောင်း Admin app.
// No DOM, no fetch, no secrets. Imported by admin.js (browser) and by
// test-admin.mjs (Node tests with a fake PocketBase client).
//
// Rules implemented here come ONLY from:
//   - 23maung-schema.md (rates 90x / 650x, commission tiers, approval side
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

// ---- Football body NET (ကြီးငယ် ဘော်ဒီစာရင်း) ---------------------------------
// Mockup v2.4 netSide, verbatim logic: offset both sides, equal = "မျှ".
export function netSide(x, y, xName, yName) {
  if (x === y) return { side: 'မျှ', amt: 0 };
  return x > y ? { side: xName, amt: x - y } : { side: yName, amt: y - x };
}

// Net per match from m23_bets_fb legs of BODY placements only (parlay legs
// span matches, so they never net — they stay individual bets).
// A leg: { fixture, home, away, kind:'body'|'goal', pick:'h'|'a'|'over'|'under', stake }
export function computeBodyNet(fbBets) {
  const byKey = {};
  (fbBets || []).forEach(function (b) {
    if (b.type !== 'body') return;
    (b.legs || []).forEach(function (leg) {
      const key = leg.fixture || (leg.home + ' vs ' + leg.away);
      if (!byKey[key]) {
        byKey[key] = { home: leg.home || '', away: leg.away || '', h: 0, a: 0, over: 0, under: 0 };
      }
      const m = byKey[key];
      if (leg.kind === 'body') {
        if (leg.pick === 'h') m.h += leg.stake || 0;
        else if (leg.pick === 'a') m.a += leg.stake || 0;
      } else if (leg.kind === 'goal') {
        if (leg.pick === 'over') m.over += leg.stake || 0;
        else if (leg.pick === 'under') m.under += leg.stake || 0;
      }
    });
  });
  return Object.keys(byKey).map(function (k) { return byKey[k]; });
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

export function parlayPayout(stake, legs, settings) {
  const ls = legs || [];
  if (!ls.length) return 0;
  for (let i = 0; i < ls.length; i++) {
    if (ls[i].res === 'loss') return 0;
  }
  let prod = 1;
  ls.forEach(function (l) { prod *= legFactor(l.res, l.pyar); });
  const comm = parlayCommission(ls.length, settings);
  return Math.round(stake * prod * (1 - comm / 100));
}

// ---- Football leg settlement ------------------------------------------------
// pyar is stored as HUNDREDTHS of the line fraction (line -1.25 -> pyar 25,
// line 1.45 -> pyar 45, line -1.5 -> pyar 50). The displayed Myanmar string
// shows the same digits (".5" renders as "5"); the math needs hundredths.
// For a full win this is also the body profit rate (schema: 1+45 -> 1000 wins 450).
export function pyarFromLine(line) {
  return Math.round((Math.abs(line) % 1) * 100);
}

// Evaluate one Asian-handicap / goal-line leg.
// `line` is the raw API line, `margin` is the score difference the line
// applies to (body pick h: hg-ag with line ah_line; body pick a: ag-hg with
// line -ah_line; goal over: total with line gl_line; goal under: -total
// with line gl_line). adj = margin + line: >0 win, =0 push, <0 loss.
// Quarter lines (.25/.75) split into two half-lines (line +/- 0.25):
//   both win -> win, both loss -> loss, both push -> push,
//   win+push -> halfWin, loss+push -> halfLoss.
// (win+loss cannot occur: the halves differ by 0.5 and margins are integers.)
export function evalLine(line, margin) {
  const pyar = pyarFromLine(line);
  const frac = Math.abs(line) % 1;
  const isQuarter = Math.abs(frac - 0.25) < 1e-9 || Math.abs(frac - 0.75) < 1e-9;
  function outcome(adj) { return adj > 0 ? 'win' : adj < 0 ? 'loss' : 'push'; }
  if (!isQuarter) {
    return { res: outcome(margin + line), pyar: pyar };
  }
  const o1 = outcome(margin + line - 0.25);
  const o2 = outcome(margin + line + 0.25);
  if (o1 === 'win' && o2 === 'win') return { res: 'win', pyar: pyar };
  if (o1 === 'loss' && o2 === 'loss') return { res: 'loss', pyar: pyar };
  if (o1 === 'push' && o2 === 'push') return { res: 'push', pyar: pyar };
  if ((o1 === 'win' && o2 === 'push') || (o1 === 'push' && o2 === 'win')) return { res: 'halfWin', pyar: pyar };
  if ((o1 === 'loss' && o2 === 'push') || (o1 === 'push' && o2 === 'loss')) return { res: 'halfLoss', pyar: pyar };
  return { res: 'push', pyar: pyar }; // win+loss: settles as a push
}

// Settle one leg against a finished fixture. Returns null when the fixture
// is not finished (scores missing) — the bet stays open.
// SETTLED (Pho Nov 13 12:44): body commission IS deducted — 5% on the PROFIT
// of every body bet (no big/small distinction; body_comm_small unused).
// The stake is returned in full; only the pyar profit is reduced by 5%.
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
    // Over wins when total > gl_line, i.e. total + (-gl_line) > 0, so the
    // line enters evalLine negated; under wins when gl_line - total > 0.
    if (leg.pick === 'over') return evalLine(-line, total);
    if (leg.pick === 'under') return evalLine(line, -total);
    return null;
  }
  return null;
}

// Body settlement (per-leg pyar math, 5% commission on the PROFIT only —
// Pho Nov 13: everything 5%, no big/small): win -> stake +
// stake*pyar/100*0.95; halfWin -> stake + (stake/2)*pyar/100*0.95;
// halfLoss -> stake/2; push -> stake; loss -> 0.
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
    if (l.res === 'win') payout += st + st * (l.pyar || 0) / 100 * keep;
    else if (l.res === 'halfWin') payout += st + (st / 2) * (l.pyar || 0) / 100 * keep;
    else if (l.res === 'halfLoss') payout += st / 2;
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
// ratePer100: 9000 (2D = 90x) / 65000 (3D = 650x). Direct and reverse are
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
    : (settings.rate_3d !== undefined ? settings.rate_3d : 65000);
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

// Settle football bets whose fixtures are finished. Bets with any leg still
// open (fixture not finished) are skipped and left status=open.
// Winners are credited via wallet_tx kind win_fb (+payout) + balance.
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
