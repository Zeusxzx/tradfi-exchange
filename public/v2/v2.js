/* TradFiCoin v2 — behaviour.
   Same APIs as production; this file only decides how the numbers arrive.
   Rules kept throughout: nothing animates that the eye did not ask for,
   every value that changes is interpolated rather than swapped, and any
   number the chain has not produced yet shows an em dash, never a guess. */

const $ = (s) => document.querySelector(s);
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
/* Long numbers break a tight grid, and nobody reads 28,644,626,891 anyway. */
const compact = (n) => n === null || n === undefined ? '—'
  : Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
  : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + 'M'
  : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'K'
  : Math.round(n).toLocaleString('en-US');
const px = (v) => v === null || v === undefined ? '—'
  : (Math.abs(v) >= 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : v.toPrecision(5));

let config = null, status = null, closesAt = null, account = null, ladderRows = [];

/* ---- toast (Sonner geometry: spring in, hold, fade) --------------------- */
function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = message;
  $('#toaster').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 320);
  }, 3600);
}

/* ---- reveal on scroll: once, staggered by the element's own delay ------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

/* the masthead only earns its border once content is behind it */
const mast = $('#masthead');
addEventListener('scroll', () => mast.classList.toggle('stuck', scrollY > 8), { passive: true });

/* ---- a digit that changes should roll, not blink ------------------------ */
function paintClock(text) {
  const host = $('#clock');
  const chars = text.split('');
  if (host.children.length !== chars.length) {
    host.innerHTML = chars.map((c) => `<span class="${/[:D ]/.test(c) ? 'sep' : 'seg'}">${c}</span>`).join('');
    return;
  }
  chars.forEach((c, i) => {
    const node = host.children[i];
    if (node.textContent !== c) {
      node.textContent = c;
      node.animate(
        [{ transform: 'translateY(-42%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }
  });
}

/* ---- state -------------------------------------------------------------- */
function paintState() {
  if (!status) return;
  const open = status.isOpen;
  const label = open ? 'Open' : 'Closed';
  [['#mastChip', '#mastState'], ['#heroChip', '#heroState']].forEach(([chip, txt]) => {
    $(chip).dataset.state = open ? 'open' : 'closed';
    $(txt).textContent = label;
  });
  $('#tapeChip').dataset.state = open ? 'open' : 'closed';
  $('#tapeChip').lastElementChild.textContent = label;
  $('#clockLabel').textContent = open ? 'Closes in' : 'Opens in';
  $('#heroHours').textContent = status.coreHours;
  document.documentElement.style.setProperty('--night', open ? '0' : '1');
  $('#footSource').textContent = status.source === 'contract'
    ? 'State read from MarketCalendar on-chain' : 'State from local calendar (RPC unreachable)';
}

function tick() {
  const now = new Date();
  $('#heroNY').textContent = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now) + ' ET';
  if (!status) return;
  let total;
  if (status.isOpen) {
    if (closesAt === null && status.closesInSeconds != null) closesAt = Date.now() + status.closesInSeconds * 1000;
    total = closesAt === null ? 0 : Math.max(0, Math.floor((closesAt - now.getTime()) / 1000));
  } else {
    closesAt = null;
    const next = status.nextOpenAt ? new Date(status.nextOpenAt).getTime() : 0;
    total = Math.max(0, Math.floor((next - now.getTime()) / 1000));
  }
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60), s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  paintClock(d ? `${d}D ${p(h)}:${p(m)}` : `${p(h)}:${p(m)}:${p(s)}`);
}

/* ---- data --------------------------------------------------------------- */
async function loadCore() {
  const [c, s] = await Promise.all([
    fetch('/api/config', { cache: 'no-store' }).then((r) => r.json()),
    fetch('/api/market-status', { cache: 'no-store' }).then((r) => r.json())
  ]);
  config = c; status = s;
  document.querySelectorAll('[data-token-name]').forEach((e) => { e.textContent = c.tokenName; });
  document.querySelectorAll('[data-token-symbol]').forEach((e) => { e.textContent = '$' + c.tokenSymbol; });
  document.title = `${c.tokenName} — staging`;
  $('#heroTradeLabel').textContent = c.tradeable ? `Trade $${c.tokenSymbol}` : 'Not live yet';
  paintState(); paintAccount(); paintTicker();
}

async function loadQuote() {
  const q = await fetch('/api/quote', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  if (!q) return;
  const real = q.tradeCount > 0 || (q.prints && q.prints.length);
  $('#quoteSample').hidden = Boolean(real);
  $('#qLast').textContent = px(q.close ?? q.last?.price ?? null);
  const d = $('#qDelta');
  if (q.change === null || q.change === undefined) { d.textContent = '—'; d.className = 'delta'; }
  else {
    const up = q.change >= 0;
    d.className = 'delta ' + (up ? 'up' : 'dn');
    d.textContent = `${up ? '▲' : '▼'} ${(Math.abs(q.change) * 100).toFixed(2)}%`;
  }
  $('#qOpen').textContent = px(q.open); $('#qHigh').textContent = px(q.high);
  $('#qLow').textContent = px(q.low);  $('#qPrev').textContent = px(q.prevClose);
  $('#qVol').textContent = compact(q.volume);
  $('#qCount').textContent = q.tradeCount ? fmtInt(q.tradeCount) : '—';
  $('#qVol').title = q.volume === null ? '' : fmtInt(q.volume) + ' tokens';

  const frozen = $('#qFrozen');
  if (!status?.isOpen && q.last) {
    frozen.hidden = false;
    frozen.textContent = `Frozen at the close · last print ${px(q.last.price)} for ${fmtInt(q.last.size)}`;
  } else frozen.hidden = true;

  const tape = $('#tape');
  tape.innerHTML = (q.prints || []).length
    ? q.prints.map((t) => `<div class="tape-row ${t.side}">
        <span>${t.time}</span><span class="r px">${t.price}</span>
        <span class="r">${t.size}</span><span class="side">${t.side === 'buy' ? 'BOT' : 'SLD'}</span></div>`).join('')
    : `<div class="tape-row"><span class="muted" style="grid-column:1/-1">No prints yet — the tape starts with the pool.</span></div>`;

  ladderRows = q.ladder || [];
  const lad = $('#ladder');
  if (ladderRows.length) {
    const max = Math.max(...ladderRows.map((l) => Math.max(l.buySize, l.sellSize))) || 1;
    lad.innerHTML = ladderRows.map((l) => `<div class="lad-row${l.atLast ? ' at-last' : ''}"
        style="--bw:${(l.buySize / max * 42).toFixed(1)}%;--sw:${(l.sellSize / max * 42).toFixed(1)}%">
        <span class="b">${l.buySize ? fmtInt(l.buySize) : ''}</span>
        <span class="px">${l.price}</span>
        <span class="s">${l.sellSize ? fmtInt(l.sellSize) : ''}</span></div>`).join('');
    $('#ladCount').textContent = fmtInt(ladderRows.reduce((a, l) => a + l.trades, 0)) + ' trades';
  } else {
    lad.innerHTML = `<div class="lad-row"><span class="muted" style="grid-column:1/-1;text-align:center">
      Fills appear here as they happen.</span></div>`;
    $('#ladCount').textContent = '';
  }
}

async function loadHolders() {
  const s = await fetch('/api/token-stats', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  const body = $('#holders');
  if (!s || !s.topHolders || !s.topHolders.length) {
    body.innerHTML = `<tr><td colspan="4" class="muted">The register opens with the book.</td></tr>`;
    return;
  }
  $('#holderCount').textContent = s.holders ?? '—';
  body.innerHTML = s.topHolders.map((h, i) => `<tr>
      <td class="num muted">${i + 1}</td>
      <td class="mono">${h.address.slice(0, 10)}…${h.address.slice(-6)}</td>
      <td class="num mono">${fmtInt(h.amount)}</td>
      <td class="num mono">${(h.share * 100).toFixed(2)}%</td></tr>`).join('');
}

function paintTicker() {
  const unit = () => `<div class="ticker-unit">
      <span><b data-token-symbol>$${config?.tokenSymbol || 'TRADFI'}</b></span>
      <span>Core hours <b>09:30–16:00 ET</b></span>
      <span>Network <b>Robinhood Chain</b></span>
      <span>Supply <b>1,792,000,000</b></span>
      <span>Fee <b>1%</b></span></div>`;
  const track = $('#ticker');
  track.innerHTML = unit() + unit();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const kids = track.children;
    if (kids.length < 2) return;
    const span = kids[1].getBoundingClientRect().left - kids[0].getBoundingClientRect().left;
    if (span < 1) return;
    track.animate([{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-span}px,0,0)` }],
      { duration: span / 60 * 1000, iterations: Infinity, easing: 'linear' });
  }));
}

/* ---- wallet ------------------------------------------------------------- */
function paintAccount() {
  const body = $('#acct');
  if (!account) {
    body.innerHTML = `<p class="muted" style="font-size:var(--t-14)">
      Connect a wallet to see your position, your share of the supply and what it is worth.</p>`;
    return;
  }
  const supply = 1792000000;
  const share = account.balance === null ? null : account.balance / supply;
  body.innerHTML = `
    <p class="mono muted" style="font-size:var(--t-13);margin-bottom:var(--s4)">
      ${account.address.slice(0, 6)}…${account.address.slice(-4)}</p>
    <dl class="stats">
      <div class="stat"><dt>Position</dt><dd class="num">${account.balance === null ? '—' : fmtInt(account.balance)}</dd></div>
      <div class="stat"><dt>% outstanding</dt><dd class="num">${share === null ? '—' : (share * 100).toFixed(4) + '%'}</dd></div>
    </dl>`;
}

async function connect() {
  if (!window.ethereum) return toast('No EVM wallet found in this browser.');
  try {
    const a = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!a || !a.length) return;
    account = { address: a[0], balance: null };
    const short = `${a[0].slice(0, 5)}…${a[0].slice(-4)}`;
    $('#connect').textContent = short; $('#connect2').textContent = short;
    paintAccount(); toast('Wallet connected.');
  } catch { toast('Connection cancelled.'); }
}

$('#connect').addEventListener('click', connect);
$('#connect2').addEventListener('click', connect);
[$('#trade'), $('#heroTrade')].forEach((b) => b.addEventListener('click', () => {
  const url = config && config.tradeUrl;
  if (!url) return toast('The pool is not live yet.');
  window.open(url, '_blank', 'noopener,noreferrer');
}));

/* ---- run ---------------------------------------------------------------- */
loadCore().then(loadQuote).then(loadHolders).catch(() => toast('Market service unreachable.'));
setInterval(tick, 1000); tick();
setInterval(() => loadCore().catch(() => {}), 30000);
setInterval(() => loadQuote().catch(() => {}), 15000);
setInterval(() => loadHolders().catch(() => {}), 90000);
