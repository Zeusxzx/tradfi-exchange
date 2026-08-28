const experience = document.querySelector('#experience');
const viewButtons = [...document.querySelectorAll('[data-view-button]')];
const personTargets = [...document.querySelectorAll('[data-person]')];
const personCard = document.querySelector('#personCard');
const personHotspots = document.querySelector('.person-hotspots');
const tradeDrawer = document.querySelector('#tradeDrawer');
const drawerScrim = document.querySelector('#drawerScrim');
const walletButton = document.querySelector('#walletButton');
const walletLabel = document.querySelector('#walletLabel');
const tradeSubmit = document.querySelector('#tradeSubmit');
const toast = document.querySelector('#toast');
const trafficTicks = [...document.querySelectorAll('#trafficTicks i')];
const subwayDots = [...document.querySelectorAll('#subwayDots i')];
const subwayGauge = document.querySelector('#subwayGauge');
const trafficSub = document.querySelector('#trafficSub');
const subwaySub = document.querySelector('#subwaySub');
const planeSprite = document.querySelector('#planeSprite');
const skyStatus = document.querySelector('#skyStatus');
const skyTag = document.querySelector('#skyTag');
const videoDay = document.querySelector('#videoDay');
const videoNight = document.querySelector('#videoNight');
const tickerMarket = document.querySelector('#tickerMarket');
const tickerNext = document.querySelector('#tickerNext');
const chainProofDot = document.querySelector('#chainProofDot');
const chainProofStatus = document.querySelector('#chainProofStatus');
const chainProofLink = document.querySelector('#chainProofLink');

const people = {
  ivy: { number: 'EMPLOYEE 001', name: 'Ivy Mercado', role: 'Head trader · night DJ', open: 'Ivy moves between the center desk and the glass wall all day, reading the room faster than the screens. At the bell, she leaves the floor for a booth downtown.', closed: 'Ivy clocked out at the bell. She is across town turning the closing candles into the first track of the night.', openLocation: 'THIRD FLOOR · EQUITIES', closedLocation: 'OFF DUTY · LOWER EAST SIDE' },
  omar: { number: 'EMPLOYEE 017', name: 'Omar Price', role: 'Risk analyst', open: 'Omar is the one standing when everyone else sits. He watches four markets, two phones, and every door at once.', closed: 'His desk is dark. Omar is on the train home, writing tomorrow’s thesis in the margins of today’s close.', openLocation: 'SECOND FLOOR · RISK', closedLocation: 'OFF DUTY · DOWNTOWN TRAIN' },
  leo: { number: 'EMPLOYEE 009', name: 'Leo Bell', role: 'Opening-bell keeper', open: 'Leo opens the floor at 9:30 sharp and spends the rest of the session moving between desks, delivering coffee and bad opinions.', closed: 'Leo locked the bell away. He lives six blocks over and will be back before the first monitor wakes up.', openLocation: 'FIRST FLOOR · OPERATIONS', closedLocation: 'OFF DUTY · WEST VILLAGE' },
  mo: { number: 'NIGHT SHIFT 001', name: 'Mo Green', role: 'Building night manager', open: 'Mo sleeps while the building is loud.', closed: 'With four trading floors empty, Mo owns the building. He cleans one floor at a time while blue standby monitors keep him company.', openLocation: 'OFF DUTY', closedLocation: 'SECOND FLOOR · NIGHT SHIFT' },
  sasha: { number: 'NIGHT SHIFT 002', name: 'Sasha Keys', role: 'Security · bell keeper', open: 'Sasha holds the front desk while the floor runs above her.', closed: 'The exchange is dark, but the lobby never is. Sasha watches the city traffic and starts the first coffee at 9:12.', openLocation: 'GROUND FLOOR · LOBBY', closedLocation: 'GROUND FLOOR · NIGHT SHIFT' }
};

let publicConfig = null;
let marketStatus = null;
let activeView = (() => {
  const v = new URLSearchParams(location.search).get('view');
  return v === 'open' || v === 'closed' ? v : 'live';
})();
let selectedSide = 'buy';
let toastTimer;
let planeTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function visibleState() {
  if (activeView === 'live') return marketStatus?.state || 'closed';
  return activeView;
}

function etHourDecimal() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return Number(parts.hour) + Number(parts.minute) / 60 + Number(parts.second) / 3600;
}

function getNightMix() {
  if (activeView === 'open') return 0;
  if (activeView === 'closed') return 1;
  // The building follows the MARKET, not the sun. This used to be a daylight
  // curve (day 06:00-16:00 ET, dusk fade to 20:00), which showed the lit,
  // full trading floor at 7am on a Saturday - market shut, building busy.
  // Open means day. Shut means night. The 1.8s opacity transition on
  // .scene-night makes the bell itself the cross-fade.
  return marketStatus && marketStatus.isOpen ? 0 : 1;
}

function trafficLevel(hour) {
  const bumps = [{ c: 8.4, w: 1.4, a: .95 }, { c: 17.6, w: 1.7, a: 1 }, { c: 12.5, w: 2.6, a: .38 }];
  let v = .12;
  bumps.forEach((b) => { v += b.a * Math.exp(-((hour - b.c) ** 2) / (2 * b.w * b.w)); });
  if (hour < 5.5 || hour >= 23.5) v *= .18;
  return Math.min(1, v);
}

function subwaySnapshot(hour) {
  if (hour >= 2 && hour < 4) return { count: 1, total: 7, lone: true };
  const bumps = [{ c: 8.3, w: 1.3, a: .95 }, { c: 17.5, w: 1.6, a: 1 }, { c: 12.5, w: 2.5, a: .4 }, { c: 22, w: 1.1, a: .28 }];
  let v = .2;
  bumps.forEach((b) => { v += b.a * Math.exp(-((hour - b.c) ** 2) / (2 * b.w * b.w)); });
  const count = Math.max(1, Math.round(Math.min(1, v) * 7));
  return { count, total: 7, lone: false };
}

function representativeHour() {
  if (activeView === 'open') return 13;
  if (activeView === 'closed') return 23;
  return etHourDecimal();
}

function trafficDescriptor(level) {
  if (level < .3) return 'Light · FDR Dr';
  if (level < .65) return 'Building · FDR Dr';
  return 'Heavy · FDR Dr';
}

function renderSystems() {
  if (!trafficSub || !subwayGauge || !subwaySub) return;
  const hour = representativeHour();
  const level = trafficLevel(hour);
  const activeTicks = Math.max(1, Math.round(level * trafficTicks.length));
  trafficTicks.forEach((tick, i) => tick.classList.toggle('active', i < activeTicks));
  trafficSub.textContent = `${trafficDescriptor(level)} · live`;

  const subway = subwaySnapshot(hour);
  subwayDots.forEach((dot, i) => dot.classList.toggle('active', i < subway.count));
  subwayGauge.classList.toggle('lone', subway.lone);
  subwaySub.textContent = subway.lone ? 'Just one rider tonight' : `${subway.count}/${subway.total} cars busy`;
}

function schedulePlane() {
  if (!planeSprite || !skyTag || !skyStatus) return;
  clearTimeout(planeTimer);
  const delay = 40000 + Math.random() * 140000;
  planeTimer = setTimeout(() => {
    planeSprite.style.top = `${8 + Math.random() * 14}%`;
    planeSprite.classList.add('flying');
    skyTag.classList.add('active');
    skyStatus.textContent = '1 aircraft';
    setTimeout(() => {
      planeSprite.classList.remove('flying');
      skyTag.classList.remove('active');
      skyStatus.textContent = 'Clear';
      schedulePlane();
    }, 14000);
  }, delay);
}

function closePersonCard() {
  personCard.classList.remove('visible');
  personCard.setAttribute('aria-hidden', 'true');
}

function tryPlay(video) {
  if (!video.paused && !video.ended) return;
  const attempt = () => video.play().catch(() => {});
  if (video.readyState >= 2) {
    attempt();
  } else {
    video.addEventListener('loadeddata', attempt, { once: true });
    video.load();
  }
}

function syncVideoPlayback() {
  const mix = getNightMix();
  const wantDay = mix < 1;
  const wantNight = mix > 0;
  videoDay.preload = wantDay ? 'auto' : 'metadata';
  videoNight.preload = wantNight ? 'auto' : 'metadata';
  if (wantDay) tryPlay(videoDay);
  if (wantNight) tryPlay(videoNight);
}

// Browsers (esp. two competing autoplay <video> elements) can silently drop
// or interrupt an autoplay attempt with no error and no retry. Without this,
// a dropped attempt leaves the video permanently frozen on its poster frame
// forever -- which, since the poster is a static shot, looks identical to
// the old flat-image design even though the new build is fully deployed.
setInterval(() => {
  const mix = getNightMix();
  if (mix < 1) tryPlay(videoDay);
  if (mix > 0) tryPlay(videoNight);
}, 4000);

function renderView() {
  experience.dataset.view = activeView;
  experience.style.setProperty('--night-mix', getNightMix().toFixed(3));
  viewButtons.forEach((button) => button.classList.toggle('active', button.dataset.viewButton === activeView));
  const state = visibleState();
  personHotspots.classList.toggle('state-open', state === 'open');
  personHotspots.classList.toggle('state-closed', state !== 'open');
  const viewLabel = document.querySelector('#viewLabel');
  if (viewLabel) viewLabel.textContent = activeView === 'live'
    ? 'Live'
    : `Previewing ${state === 'open' ? 'market-open' : 'after-hours'}`;
  document.querySelector('#heroLineOne').textContent = state === 'open' ? 'ON THE' : 'OFF THE';
  document.querySelector('#heroLineTwo').textContent = state === 'open' ? 'FLOOR.' : 'CLOCK.';
  document.querySelector('#heroDescription').innerHTML = state === 'open'
    ? 'The bell has rung.<br />Swaps clear until four.'
    : 'The exchange is shut.<br />The city isn’t.';
  renderSystems();
  syncVideoPlayback();
  closePersonCard();
}

function updateClock() {
  const now = new Date();
  document.querySelector('#newYorkTime').textContent = `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now)} ET`;
  if (activeView === 'live') {
    experience.style.setProperty('--night-mix', getNightMix().toFixed(3));
    renderSystems();
  }
  if (!marketStatus) return;
  if (marketStatus.isOpen) {
    document.querySelector('#marketClock').textContent = 'OPEN NOW';
    return;
  }
  const next = marketStatus.nextOpenAt ? new Date(marketStatus.nextOpenAt).getTime() : 0;
  const total = Math.max(0, Math.floor((next - now.getTime()) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const label = days
    ? `${days}D ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  document.querySelector('#marketClock').textContent = label;
  if (tickerNext) tickerNext.textContent = `NEXT OPEN ${label}`;
}

function updateTrade() {
  if (!marketStatus || !publicConfig) return;
  const configured = Boolean(publicConfig.tokenAddress && publicConfig.tradeUrl);
  document.querySelector('#drawerMarketLabel').textContent = marketStatus.isOpen ? 'Market open' : marketStatus.reason;
  document.querySelector('#drawerSession').textContent = marketStatus.coreHours;
  document.querySelector('#tokenStatus').textContent = configured ? 'Configured' : 'Awaiting mainnet launch';
  tradeSubmit.disabled = !marketStatus.isOpen || !configured;
  document.querySelector('#tradeSubmitLabel').textContent = !marketStatus.isOpen
    ? 'Returns at the opening bell'
    : configured ? `${selectedSide === 'buy' ? 'Buy' : 'Sell'} $${publicConfig.tokenSymbol}` : 'Pool not live yet';
  document.querySelector('#tradeNote').textContent = !marketStatus.isOpen
    ? 'The order desk follows the real NYSE core session, gated on-chain by the pool hook. Visual previews never enable a transaction.'
    : configured ? 'Review the execution route before signing in your wallet.' : 'The floor is open, but the mainnet pool hasn\'t launched yet.';
}

function renderMarket() {
  experience.dataset.market = marketStatus.state;
  document.querySelector('#marketStateLabel').textContent = marketStatus.isOpen ? 'Market open' : 'Market closed';
  document.querySelector('#marketReason').textContent = `${marketStatus.reason} · ${marketStatus.coreHours}`;
  if (tickerMarket) tickerMarket.textContent = `ON-CHAIN: MARKET ${marketStatus.isOpen ? 'OPEN' : 'CLOSED'}`;
  renderView();
  updateTrade();
  updateClock();
}

// --- real on-chain read, straight from the browser to Robinhood Chain, no backend ---
function padHex32(hex) { return hex.replace(/^0x/, '').padStart(64, '0'); }

async function rpcCall(rpcUrl, to, data) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] })
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

async function verifyOnChain() {
  if (!publicConfig?.marketCalendar) return;
  const { address, rpcUrl, isMarketOpenSelector, nextOpenSelector, network } = publicConfig.marketCalendar;
  try {
    const openResult = await rpcCall(rpcUrl, address, isMarketOpenSelector);
    const isOpenOnChain = BigInt(openResult) === 1n;
    const nowHex = '0x' + Math.floor(Date.now() / 1000).toString(16);
    const nextResult = await rpcCall(rpcUrl, address, nextOpenSelector + padHex32(nowHex));
    const nextOpenEpoch = Number(BigInt(nextResult));
    chainProofDot.classList.toggle('open', isOpenOnChain);
    chainProofStatus.textContent = isOpenOnChain
      ? `VERIFIED OPEN · ${network.toUpperCase()}`
      : `VERIFIED CLOSED · ${network.toUpperCase()}`;
    if (chainProofLink) chainProofLink.href = `https://robinhoodchain.blockscout.com/address/${address}`;
    if (!isOpenOnChain && nextOpenEpoch) {
      const mins = Math.max(0, Math.round((nextOpenEpoch * 1000 - Date.now()) / 60000));
      chainProofStatus.textContent += ` · opens in ~${mins}m`;
    }
  } catch (error) {
    chainProofStatus.textContent = 'Chain read failed — retrying';
    chainProofDot.classList.remove('open');
  }
}

async function loadRuntime() {
  try {
    const [configResponse, statusResponse] = await Promise.all([
      fetch('/api/config', { cache: 'no-store' }), fetch('/api/market-status', { cache: 'no-store' })
    ]);
    if (!configResponse.ok || !statusResponse.ok) throw new Error('Market service unavailable');
    publicConfig = await configResponse.json();
    marketStatus = await statusResponse.json();
    document.querySelectorAll('[data-token-name]').forEach((element) => { element.textContent = publicConfig.tokenName; });
    document.querySelectorAll('[data-token-symbol]').forEach((element) => { element.textContent = `$${publicConfig.tokenSymbol}`; });
    document.title = `${publicConfig.tokenName} — the memecoin that keeps banker's hours`;
    renderMarket();
    verifyOnChain();
  } catch {
    document.querySelector('#marketStateLabel').textContent = 'Status unavailable';
    document.querySelector('#marketReason').textContent = 'Trading remains disabled';
    tradeSubmit.disabled = true;
    showToast('The market clock could not be reached. Trading remains disabled.');
  }
}

function openPersonCard(key) {
  const person = people[key];
  if (!person) return;
  const state = visibleState();
  document.querySelector('#personNumber').textContent = person.number;
  document.querySelector('#personName').textContent = person.name;
  document.querySelector('#personRole').textContent = person.role;
  document.querySelector('#personStory').textContent = person[state];
  document.querySelector('#personLocation').textContent = state === 'open' ? person.openLocation : person.closedLocation;
  personCard.classList.add('visible');
  personCard.setAttribute('aria-hidden', 'false');
}

function setTradeDrawer(open) {
  tradeDrawer.classList.toggle('visible', open);
  drawerScrim.classList.toggle('visible', open);
  tradeDrawer.setAttribute('aria-hidden', String(!open));
}

async function connectWallet() {
  if (!window.ethereum) return showToast('No compatible EVM wallet found.');
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: publicConfig.chain.hexId }] });
    } catch (error) {
      if (error.code !== 4902) throw error;
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
        chainId: publicConfig.chain.hexId,
        chainName: publicConfig.chain.name,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [publicConfig.chain.rpcUrl],
        blockExplorerUrls: [publicConfig.chain.explorerUrl]
      }] });
    }
    walletButton.classList.add('connected');
    walletLabel.textContent = `${accounts[0].slice(0, 5)}…${accounts[0].slice(-4)}`;
    showToast('Connected to Robinhood Chain.');
  } catch (error) {
    showToast(error?.message || 'Wallet connection cancelled.');
  }
}

viewButtons.forEach((button) => button.addEventListener('click', () => { activeView = button.dataset.viewButton; renderView(); }));
document.querySelector('#resetLive').addEventListener('click', () => { activeView = 'live'; renderView(); });
personTargets.forEach((target) => target.addEventListener('click', () => openPersonCard(target.dataset.person)));
/* '#openStory' lived in the nav that the landing rebuild removed. Bind it only
   if some other surface still renders it, instead of throwing on load. */
const openStoryBtn = document.querySelector('#openStory');
if (openStoryBtn) openStoryBtn.addEventListener('click', () => openPersonCard(visibleState() === 'open' ? 'ivy' : 'mo'));
document.querySelector('#closePerson').addEventListener('click', closePersonCard);
document.querySelector('#openTrade').addEventListener('click', () => setTradeDrawer(true));
document.querySelector('#closeTrade').addEventListener('click', () => setTradeDrawer(false));
drawerScrim.addEventListener('click', () => setTradeDrawer(false));
walletButton.addEventListener('click', connectWallet);

document.querySelectorAll('[data-side]').forEach((tab) => tab.addEventListener('click', () => {
  selectedSide = tab.dataset.side;
  document.querySelectorAll('[data-side]').forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
  document.querySelector('#amountLabel').textContent = selectedSide === 'buy' ? 'You pay' : 'You sell';
  document.querySelector('#amountCurrency').textContent = selectedSide === 'buy' ? 'ETH' : `$${publicConfig?.tokenSymbol || 'TRADFI'}`;
  updateTrade();
}));

tradeSubmit.addEventListener('click', () => {
  if (!marketStatus?.isOpen) return showToast('The order desk is closed.');
  if (!publicConfig?.tradeUrl || !publicConfig?.tokenAddress) return showToast('No live pool yet — mainnet launch pending.');
  window.open(publicConfig.tradeUrl, '_blank', 'noopener,noreferrer');
});

document.querySelector('#building').addEventListener('pointermove', (event) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - .5) * -10;
  const y = ((event.clientY - rect.top) / rect.height - .5) * -6;
  experience.style.setProperty('--px', `${x}px`);
  experience.style.setProperty('--py', `${y}px`);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncVideoPlayback();
});

requestAnimationFrame(() => requestAnimationFrame(() => experience.classList.add('ready')));

/* Paint the view once up front. renderView() used to run only off the back of
   a successful chain read, so a ?view= override - or any failed read - left the
   page frozen on its markup defaults (night video, night copy) no matter what
   state it was actually meant to show. */
renderView();
updateClock();

setInterval(updateClock, 1000);
setInterval(loadRuntime, 60000);
setInterval(verifyOnChain, 45000);
/* keep the gate's open/shut dot in step with the live read */
setInterval(() => {
  const dot = document.querySelector('#chainProofDot');
  if (dot) dot.classList.toggle('is-open', !!(marketStatus && marketStatus.isOpen));
}, 1000);
loadRuntime();
schedulePlane();


/* ---- the hero overlay layer ---------------------------------------------
   The stage is now the whole viewport and the video covers it, so the video's
   rendered rect is usually bigger than the stage. Everything welded to the
   building (the boards, the people) lives inside #videoSpace, which is sized
   here to that exact rect - so a percentage inside it means the same point of
   the building at every window shape. */
(function heroOverlay() {
  const stage  = document.querySelector('#building');
  const space  = document.querySelector('#videoSpace');
  const tracks = [...document.querySelectorAll('[data-board-track]')];
  const spots  = document.querySelector('.person-hotspots');
  if (!stage || !space) return;

  // the people belong in video space too, not stage space
  if (spots && spots.parentElement !== space) space.appendChild(spots);

  function sizeSpace() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const scale = Math.max(w / 1280, h / 720);
    space.style.width  = (1280 * scale) + 'px';
    space.style.height = (720 * scale) + 'px';
  }

  const read = (sel, fallback) => {
    const el = document.querySelector(sel);
    const t = el && el.textContent ? el.textContent.trim() : '';
    return t && t !== '—' && !/unavailable|disabled/i.test(t) ? t : fallback;
  };

  // price and 24h move come from the pool once it exists. Until then this
  // shows a dash - never an invented number on a page about trading.
  function tokenPrice() {
    const cfg = (typeof publicConfig !== 'undefined' && publicConfig) || null;
    if (cfg && cfg.price) return String(cfg.price);
    return '—';
  }
  function tokenChange() {
    const cfg = (typeof publicConfig !== 'undefined' && publicConfig) || null;
    if (cfg && (cfg.change24h || cfg.change24h === 0)) {
      const n = Number(cfg.change24h);
      return { text: (n >= 0 ? '+' : '') + n.toFixed(2) + '%', up: n >= 0 };
    }
    return null;
  }

  /* The board is built once per state and then only has its VALUES updated.
     It used to rewrite innerHTML every second, which tore down the marquee
     rig the instant it was applied - the strip would run out of content and
     snap back. Structure is stable; only the clock digits move. */
  let builtFor = null;

  function cellsFor(open) {
    const sym = read('[data-token-symbol]', '$TRADFI');
    return open
      ? [['', 'MARKET OPEN', 'state'], ['TRADING', 'LIVE ON-CHAIN', 'gate'],
         [sym, '', 'price'], ['24H', '', 'chg'],
         ['NEW YORK', '', 'clock'], ['SUPPLY', '1,792,000,000', null], ['POOL FEE', '1%', null]]
      : [['', 'MARKET CLOSED', 'state'], ['NEXT OPEN', '', 'next'],
         [sym, '', 'price'], ['24H', '', 'chg'],
         ['NEW YORK', '', 'clock'], ['SUPPLY', '1,792,000,000', null], ['POOL FEE', '1%', null]];
  }

  function build(open) {
    const html = cellsFor(open).map(([k, v, key]) => {
      const val = `<b${key ? ` data-v="${key}"` : ''}>${v}</b>`;
      return (k ? `<span><em>${k}</em> ${val}</span>` : `<span>${val}</span>`) + '<i></i>';
    }).join('');
    tracks.forEach((t) => { t._marqueeSource = null; t.innerHTML = html; });
    builtFor = open ? 'open' : 'closed';
    if (typeof window.__marqueeRig === 'function') window.__marqueeRig();
  }

  function values(open) {
    const chg = tokenChange();
    return {
      price: tokenPrice(),
      chg: chg ? chg.text : '—',
      clock: read('#newYorkTime', '--:--:-- ET'),
      next: read('#marketClock', '--:--:--')
    };
  }

  function paint() {
    if (!tracks.length) return;
    const open = (typeof visibleState === 'function') ? visibleState() === 'open' : false;
    if (builtFor !== (open ? 'open' : 'closed')) build(open);
    const v = values(open);
    const chg = tokenChange();
    document.querySelectorAll('[data-board-track] [data-v]').forEach((n) => {
      const k = n.getAttribute('data-v');
      if (k in v && n.textContent !== v[k]) n.textContent = v[k];
      if (k === 'chg') n.className = chg ? (chg.up ? 'up' : 'dn') : '';
    });
  }

  sizeSpace();
  paint();
  window.addEventListener('resize', sizeSpace);
  window.addEventListener('orientationchange', sizeSpace);
  if (window.ResizeObserver) new ResizeObserver(sizeSpace).observe(stage);
  setInterval(paint, 1000);
})();


/* ---- seamless marquees ---------------------------------------------------
   A track that animates one copy of its content to -50% only looks continuous
   if that copy is at least as wide as its container - otherwise the tail runs
   out mid-loop, you get dead space, and it snaps back. Build two units, each
   repeated until it fills the container, and travel exactly one unit. */
(function marquees() {
  const RIGS = [
    { track: '#tickerTrack',    unit: 'ticker-unit', pxPerSec: 62, min: 24 },
    { track: '[data-board-track]', unit: 'board-unit',  pxPerSec: 46, min: 20 }
  ];

  function rebuild(track, unitClass, pxPerSec, min) {
    const box = track.parentElement;
    if (!box || !box.clientWidth) return;

    // the source run is captured once and cached on the node, because paint()
    // rewrites the board's innerHTML every second
    let source = track._marqueeSource;
    const current = [...track.children].filter((n) => !n.classList.contains(unitClass));
    if (current.length) source = track._marqueeSource = current.map((n) => n.cloneNode(true));
    if (!source || !source.length) return;

    track.style.animation = 'none';
    track.textContent = '';

    const unit = document.createElement('span');
    unit.className = unitClass;
    source.forEach((n) => unit.appendChild(n.cloneNode(true)));
    track.appendChild(unit);

    let guard = 0;
    while (unit.scrollWidth < box.clientWidth && guard++ < 24) {
      source.forEach((n) => unit.appendChild(n.cloneNode(true)));
    }

    const span = unit.getBoundingClientRect().width;
    track.appendChild(unit.cloneNode(true));

    const name = 'marquee' + Math.round(span);
    const dur = Math.max(min, span / pxPerSec);
    track.style.setProperty('--marquee-span', span + 'px');
    track.style.animation = `marqueeRun ${dur}s linear infinite`;
    void name;
  }

  function run() {
    RIGS.forEach(({ track, unit, pxPerSec, min }) => {
      document.querySelectorAll(track).forEach((t) => rebuild(t, unit, pxPerSec, min));
    });
  }

  const style = document.createElement('style');
  style.textContent = '@keyframes marqueeRun{from{transform:translateX(0)}to{transform:translateX(calc(var(--marquee-span) * -1))}}';
  document.head.appendChild(style);

  window.__marqueeRig = run;
  run();
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 180); });
})();
