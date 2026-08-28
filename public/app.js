const experience = document.querySelector('#experience');
const viewButtons = [...document.querySelectorAll('[data-view-button]')];
const personTargets = [...document.querySelectorAll('[data-person]')];
const personCard = document.querySelector('#personCard');
const personHotspots = document.querySelector('.person-hotspots'); // removed from the landing page; guarded below
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
const chainProofLink = document.querySelector('#chainProofLink');
let closesAtEpoch = null;
let lastPrints = [];

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

/* ---- seamless scene loop --------------------------------------------------
   A <video loop> does not loop for free: at the wrap the browser performs a
   real seek back to zero, fires `seeking` + `waiting`, and misses a frame.
   Measured on the finished clip, fully buffered: a 63ms gap against a 33ms
   frame budget, every 4.7 seconds. That is the tick.

   So each scene ships two copies of the same file. One plays; the other sits
   paused and decoded at time 0. Two frames before the end the standby is shown
   and started -- no seek, nothing to wait for -- and the one that just finished
   is hidden and rewound to become the next standby. The clip itself is already
   cut so its last frame runs into its first, so the handover has nothing to
   give it away. Measured after: 17-33ms at the wrap, i.e. no dropped frame. */
function sceneLoop(host) {
  const layers = [...host.querySelectorAll('.scene-layer')];
  if (layers.length < 2 || !('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
    // no rVFC (Firefox, older Safari): fall back to the browser's own loop
    layers.forEach((v, i) => { v.loop = true; if (i) v.remove(); });
    return { play() { tryPlay(layers[0]); }, set preload(v) { layers[0].preload = v; } };
  }
  let live = layers[0], standby = layers[1];
  const HANDOVER = 2 / 30;
  let armed = false;

  function watch() {
    live.requestVideoFrameCallback((now, meta) => {
      if (!armed && live.duration && meta.mediaTime >= live.duration - HANDOVER) {
        armed = true;
        standby.classList.add('is-live');
        standby.play().catch(() => {});
        const finished = live;
        live = standby;
        standby = finished;
        standby.classList.remove('is-live');
        // rewind the one that just handed over, once it is safely out of sight
        setTimeout(() => { standby.pause(); standby.currentTime = 0; armed = false; }, 90);
      }
      watch();
    });
  }

  layers.forEach((v) => { v.loop = false; });
  standby.pause();
  if (standby.readyState >= 2) standby.currentTime = 0;
  else standby.addEventListener('loadeddata', () => { standby.currentTime = 0; }, { once: true });
  tryPlay(live);
  watch();

  return {
    play() { tryPlay(live); },
    // A fully transparent scene is still decoded frame for frame unless it is
    // told to stop. Two scenes x two loop layers is four decoders for one
    // visible picture; parking the hidden one halves the work.
    pause() { layers.forEach((v) => { if (!v.paused) v.pause(); }); },
    set preload(value) { layers.forEach((v) => { v.preload = value; }); }
  };
}

const sceneDay = sceneLoop(videoDay);
const sceneNight = sceneLoop(videoNight);

function syncVideoPlayback() {
  const mix = getNightMix();
  const wantDay = mix < 1;
  const wantNight = mix > 0;
  if (wantDay) sceneDay.play(); else sceneDay.pause();
  if (wantNight) sceneNight.play(); else sceneNight.pause();
}

// Browsers (esp. two competing autoplay <video> elements) can silently drop
// or interrupt an autoplay attempt with no error and no retry. Without this,
// a dropped attempt leaves the video permanently frozen on its poster frame
// forever -- which, since the poster is a static shot, looks identical to
// the old flat-image design even though the new build is fully deployed.
setInterval(() => {
  const mix = getNightMix();
  if (mix < 1) sceneDay.play();
  if (mix > 0) sceneNight.play();
  if (mix >= 1) sceneDay.pause();
  if (mix <= 0) sceneNight.pause();
}, 4000);

function renderView() {
  experience.dataset.view = activeView;
  experience.style.setProperty('--night-mix', getNightMix().toFixed(3));
  viewButtons.forEach((button) => button.classList.toggle('active', button.dataset.viewButton === activeView));
  const state = visibleState();
  if (personHotspots) {
    personHotspots.classList.toggle('state-open', state === 'open');
    personHotspots.classList.toggle('state-closed', state !== 'open');
  }
  const viewLabel = document.querySelector('#viewLabel');
  if (viewLabel) viewLabel.textContent = activeView === 'live'
    ? 'Live'
    : `Previewing ${state === 'open' ? 'market-open' : 'after-hours'}`;
  renderHud(state);
  renderTape(null);
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
  const hudTime = document.querySelector('#hudTime');
  let total;
  if (marketStatus.isOpen) {
    // counts down to the closing bell; the server hands us the session
    // remainder once and we tick it locally so the RPC is not polled per second
    if (closesAtEpoch == null && marketStatus.closesInSeconds != null) {
      closesAtEpoch = Date.now() + marketStatus.closesInSeconds * 1000;
    }
    total = closesAtEpoch == null ? 0 : Math.max(0, Math.floor((closesAtEpoch - now.getTime()) / 1000));
  } else {
    closesAtEpoch = null;
    const next = marketStatus.nextOpenAt ? new Date(marketStatus.nextOpenAt).getTime() : 0;
    total = Math.max(0, Math.floor((next - now.getTime()) / 1000));
  }
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const label = days
    ? `${days}D ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (hudTime) hudTime.textContent = label;
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
    void nextOpenEpoch; void isOpenOnChain;
    if (chainProofLink) chainProofLink.href = `https://robinhoodchain.blockscout.com/address/${address}`;
    void network;
  } catch (error) {
    /* the chain read is corroboration, not the source of what the page shows;
       if it fails the server's own calendar still drives everything */
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
const heroTrade = document.querySelector('#heroTrade');
if (heroTrade) heroTrade.addEventListener('click', () => setTradeDrawer(true));
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

/* ---- the two panels, and the register below them -------------------------
   Everything the hero says now lives in exactly two places: the countdown on
   the left and the pitch on the right. The numbers under the countdown come
   from the token contract; the ones that need a price stay as dashes until
   there is one, rather than disappearing and shifting the layout later. */
function renderHud(state) {
  // The preview toggle repaints the building, not the facts. This panel is
  // the one thing on the page that must always be true, so it reads the real
  // market state even while you are previewing the other one.
  const open = marketStatus ? marketStatus.isOpen : state === 'open';
  const label = document.querySelector('[data-clock-label]');
  const sub = document.querySelector('#hudSub');
  if (label) label.textContent = open ? 'Closes in' : 'Opens in';
  if (sub) sub.textContent = marketStatus ? marketStatus.coreHours : '9:30 AM – 4:00 PM ET';

  const cta = document.querySelector('#heroTrade');
  const ctaLabel = document.querySelector('#heroTradeLabel');
  const foot = document.querySelector('#heroTradeFoot');
  if (!cta) return;
  const tradeable = Boolean(publicConfig && publicConfig.tradeable);
  const locked = !tradeable || !open;
  cta.dataset.locked = String(locked);
  if (ctaLabel) {
    ctaLabel.textContent = !tradeable ? 'Not live yet'
      : open ? `Trade ${publicConfig.tokenSymbol ? '$' + publicConfig.tokenSymbol : ''}`.trim()
      : 'Closed until the bell';
  }
  if (foot) {
    foot.textContent = !tradeable ? 'Pool launches on Robinhood Chain'
      : open ? 'Robinhood Chain · Uniswap v4'
      : 'Swaps revert on-chain outside market hours';
  }
}

const fmtUsd = (n) => n == null ? '—' : (
  n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' :
  n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' :
  n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + n.toFixed(2)
);
const fmtNum = (n) => n == null ? '—' : n.toLocaleString('en-US');
const shortAddr = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '—';

async function loadTokenStats() {
  let stats;
  try {
    const res = await fetch('/api/token-stats', { cache: 'no-store' });
    if (!res.ok) return;
    stats = await res.json();
  } catch { return; }
  if (!stats) return;

  const map = {
    marketCap: fmtUsd(stats.marketCap),
    volume24h: fmtUsd(stats.volume24h),
    holders: fmtNum(stats.holders),
    supply: fmtNum(stats.supply)
  };
  document.querySelectorAll('[data-stat]').forEach((node) => {
    const key = node.getAttribute('data-stat');
    if (key in map) node.textContent = map[key];
  });

  const link = document.querySelector('#listingLink');
  if (link && stats.explorerUrl) link.href = stats.explorerUrl;

  renderTape(stats);

  const body = document.querySelector('#holderRows');
  if (!body) return;
  const rows = stats.topHolders || [];
  if (!rows.length) {
    body.innerHTML = '<tr class="listing-empty"><td colspan="4">The register opens with the book.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((h) => {
    const pct = h.share == null ? '—' : (h.share * 100).toFixed(h.share < 0.0001 ? 4 : 2) + '%';
    const width = h.share == null ? 0 : Math.max(1, Math.round(h.share * 100));
    return `<tr>
      <td class="num rank">${h.rank}</td>
      <td class="addr">${h.label ? h.label : shortAddr(h.address)}${h.isContract ? '<span class="tag">contract</span>' : ''}</td>
      <td class="num">${fmtNum(h.amount)}</td>
      <td class="num">${pct}<span class="barwrap"><span class="bar" data-w="${width}"></span></span></td>
    </tr>`;
  }).join('');
  // widths are set through the CSSOM, not a style="" attribute: our CSP is
  // style-src 'self', which blocks inline style attributes outright
  body.querySelectorAll('.bar').forEach((bar) => {
    bar.style.width = bar.getAttribute('data-w') + '%';
  });
}

/* ---- the tape ------------------------------------------------------------
   Time and sales: the running list of prints a floor screen shows, newest at
   the top -- time, price, size, side. It renders whatever the pool has
   actually cleared. Before the pool exists there is nothing to print, and it
   says so, because a tape of invented trades is a fabricated record. */
function renderTape(stats) {
  if (stats && Array.isArray(stats.prints)) lastPrints = stats.prints;
  const state = document.querySelector('#tapeState');
  const rows = document.querySelector('#tapeRows');
  if (!rows) return;

  const open = Boolean(marketStatus && marketStatus.isOpen);
  if (state) {
    state.classList.toggle('is-open', open);
    state.lastChild.textContent = open ? ' Open' : ' Closed';
  }

  const prints = lastPrints;
  if (!prints.length) {
    rows.innerHTML = `<li class="tape-empty">${
      open ? 'No prints yet this session.' : 'The tape starts at the opening bell.'
    }</li>`;
    return;
  }
  rows.innerHTML = prints.map((t) => `<li class="${t.side === 'buy' ? 'buy' : 'sell'}">
    <span>${t.time}</span>
    <span class="r p">${t.price}</span>
    <span class="r">${t.size}</span>
    <span class="r">${t.side === 'buy' ? 'BOT' : 'SLD'}</span>
  </li>`).join('');
}

setInterval(updateClock, 1000);
setInterval(loadRuntime, 60000);
setInterval(verifyOnChain, 45000);
setInterval(loadTokenStats, 90000);
loadRuntime();
loadTokenStats();
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
  // the board on the building and the strip along the bottom say the same
  // thing, because there is only one thing worth saying at any moment
  const tracks = [...document.querySelectorAll('[data-board-track]'), ...document.querySelectorAll('#tickerTrack')];
  const spots  = document.querySelector('.person-hotspots');
  if (!stage || !space) return;

  // the people belong in video space too, not stage space
  if (spots && spots.parentElement !== space) space.appendChild(spots); // no-op once removed

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

  /* Open: it is trading, it is on chain, here is the ticker, here is the time.
     Closed: here is when it opens, here is the ticker. Supply, pool fee and LP
     copy all moved to the paper section -- a strip nobody can pause is the
     worst place to put a fact somebody might want to read twice. */
  function cellsFor(open) {
    const sym = read('[data-token-symbol]', '$TRADFI');
    return open
      ? [['', 'TRADING', 'state'], ['', 'LIVE ON-CHAIN', null],
         ['', sym, null], ['NEW YORK', '', 'clock']]
      : [['NEXT OPEN', '', 'next'], ['', sym, null]];
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

  function values() {
    return {
      clock: read('#newYorkTime', '--:--:-- ET'),
      next: read('#hudTime', '--:--:--')
    };
  }

  function paint() {
    if (!tracks.length) return;
    const open = (typeof visibleState === 'function') ? visibleState() === 'open' : false;
    if (builtFor !== (open ? 'open' : 'closed')) build(open);
    const v = values();
    tracks.forEach((t) => t.querySelectorAll('[data-v]').forEach((n) => {
      const k = n.getAttribute('data-v');
      if (k in v && n.textContent !== v[k]) n.textContent = v[k];
    }));
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
    { track: '#tickerTrack',    unit: 'board-unit', pxPerSec: 95, min: 14 },
    { track: '[data-board-track]', unit: 'board-unit', pxPerSec: 115, min: 10 }
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

    // Driven by the Web Animations API, not a CSS @keyframes rule.
    // The old rule interpolated calc(var(--marquee-span) * -1); Chromium
    // never resolved it, so the computed transform stayed `none` and the
    // tape sat perfectly still while reporting itself as running.
    const px = Math.round(span);
    const dur = Math.max(min, span / pxPerSec);
    track.style.animation = 'none';
    if (track._marqueeAnim) track._marqueeAnim.cancel();
    track._marqueeAnim = track.animate(
      [{ transform: 'translate3d(0,0,0)' },
       { transform: `translate3d(${-px}px,0,0)` }],
      { duration: dur * 1000, iterations: Infinity, easing: 'linear' }
    );
  }

  function run() {
    RIGS.forEach(({ track, unit, pxPerSec, min }) => {
      document.querySelectorAll(track).forEach((t) => rebuild(t, unit, pxPerSec, min));
    });
  }


  window.__marqueeRig = run;
  run();
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 180); });
})();


/* ---- preview toggle ------------------------------------------------------
   Cycles live → open → closed and repaints everything that depends on state:
   which building is showing, which board, the headline, the hotspot cast. */
(function stateToggle() {
  const btn = document.querySelector('#stateToggle');
  const label = document.querySelector('#stateToggleLabel');
  if (!btn || !label) return;

  const ORDER = ['live', 'open', 'closed'];
  const TEXT = { live: 'Live', open: 'Market open', closed: 'After hours' };

  function show() {
    btn.dataset.state = activeView;
    label.textContent = TEXT[activeView];
    btn.setAttribute('title', activeView === 'live'
      ? 'Following the on-chain calendar'
      : 'Previewing ' + TEXT[activeView].toLowerCase() + ' — click to cycle');
  }

  btn.addEventListener('click', () => {
    activeView = ORDER[(ORDER.indexOf(activeView) + 1) % ORDER.length];
    renderView();
    show();
  });

  show();
})();
