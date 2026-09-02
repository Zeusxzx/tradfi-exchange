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
let lastLadder = [];
let bellWatch = null;

const people = {
  ivy: { number: 'EMPLOYEE 001', name: 'Ivy Mercado', role: 'Head trader · night DJ', open: 'Ivy moves between the center desk and the glass wall all day, reading the room faster than the screens. At the bell, she leaves the floor for a booth downtown.', closed: 'Ivy clocked out at the bell. She is across town turning the closing candles into the first track of the night.', openLocation: 'THIRD FLOOR · EQUITIES', closedLocation: 'OFF DUTY · LOWER EAST SIDE' },
  omar: { number: 'EMPLOYEE 017', name: 'Omar Price', role: 'Risk analyst', open: 'Omar is the one standing when everyone else sits. He watches four markets, two phones, and every door at once.', closed: 'His desk is dark. Omar is on the train home, writing tomorrow’s thesis in the margins of today’s close.', openLocation: 'SECOND FLOOR · RISK', closedLocation: 'OFF DUTY · DOWNTOWN TRAIN' },
  leo: { number: 'EMPLOYEE 009', name: 'Leo Bell', role: 'Opening-bell keeper', open: 'Leo opens the floor at 9:30 sharp and spends the rest of the session moving between desks, delivering coffee and bad opinions.', closed: 'Leo locked the bell away. He lives six blocks over and will be back before the first monitor wakes up.', openLocation: 'FIRST FLOOR · OPERATIONS', closedLocation: 'OFF DUTY · WEST VILLAGE' },
  mo: { number: 'NIGHT SHIFT 001', name: 'Mo Green', role: 'Building night manager', open: 'Mo sleeps while the building is loud.', closed: 'With four trading floors empty, Mo owns the building. He cleans one floor at a time while blue standby monitors keep him company.', openLocation: 'OFF DUTY', closedLocation: 'SECOND FLOOR · NIGHT SHIFT' },
  sasha: { number: 'NIGHT SHIFT 002', name: 'Sasha Keys', role: 'Security · bell keeper', open: 'Sasha holds the front desk while the floor runs above her.', closed: 'The exchange is dark, but the lobby never is. Sasha watches the city traffic and starts the first coffee at 9:12.', openLocation: 'GROUND FLOOR · LOBBY', closedLocation: 'GROUND FLOOR · NIGHT SHIFT' }
};

let publicConfig = null;
let marketStatus = null;
// The page follows the contract's calendar and nothing else. There is no
// preview mode and no manual switch: at 9:30 New York it is the day floor, at
// 4:00 it is the night floor, and that is the only thing that decides.
const activeView = 'live';
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
  const PREROLL  = 0.6;    // start the standby decoding well before it is needed
  const HANDOVER = 2 / 30; // and only swap what is visible at the last moment
  let armed = false, rolling = false;

  function watch() {
    live.requestVideoFrameCallback((now, meta) => {
      const d = live.duration;
      if (d) {
        // Spin the decoder up early, while the standby is still invisible.
        // Calling play() at the moment of the swap made the handover pay for
        // decoder start-up, and that showed as a hitch across the whole page
        // once every loop -- which is what the ticker looked like it was doing.
        if (!rolling && meta.mediaTime >= d - PREROLL) {
          rolling = true;
          standby.play().catch(() => {});
        }
        if (!armed && meta.mediaTime >= d - HANDOVER) {
          armed = true;
          // by now the standby is already producing frames, so this is a pure
          // opacity swap on two promoted layers: compositor only, no decode
          standby.classList.add('is-live');
          const finished = live;
          live = standby;
          standby = finished;
          standby.classList.remove('is-live');
          setTimeout(() => {
            standby.pause();
            standby.currentTime = 0;
            armed = false; rolling = false;
          }, 120);
        }
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
  // while the bullpen overlay is up the stage is invisible and deliberately
  // parked, so the watchdog must not wake it back up behind the overlay
  if (document.documentElement.dataset.bullpen === 'open') return;
  const mix = getNightMix();
  if (mix < 1) sceneDay.play();
  if (mix > 0) sceneNight.play();
  if (mix >= 1) sceneDay.pause();
  if (mix <= 0) sceneNight.pause();
}, 4000);

function renderView() {
  experience.dataset.view = activeView;
  // Mirror the state onto <html>. The theme tokens have to be reachable by
  // <body> and the overscroll area, and those are ancestors of <main> -- a
  // variable defined on a descendant cannot reach them, which is why the page
  // kept a white strip below the footer in the dark theme.
  document.documentElement.dataset.view = activeView;
  document.documentElement.dataset.market = experience.dataset.market || 'closed';
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

/* A countdown that redraws every digit every second reads as a flicker. Each
   character owns a box; only the ones whose value actually changed animate,
   and they slide rather than blink. */
function paintHudTime(text) {
  const host = document.querySelector('#hudTime');
  if (!host) return;
  const chars = text.split('');
  if (host.children.length !== chars.length) {
    host.innerHTML = chars.map((c) => `<span class="${/[0-9]/.test(c) ? 'd' : 'c'}">${c}</span>`).join('');
    return;
  }
  chars.forEach((c, i) => {
    const node = host.children[i];
    if (node.textContent === c) return;
    node.textContent = c;
    if (node.animate) node.animate(
      [{ transform: 'translateY(-40%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' }
    );
  });
}

function updateClock() {
  const now = new Date();
  const nyText = `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now)} ET`;
  document.querySelector('#newYorkTime').textContent = nyText;
  const heroNY = document.querySelector('#hudNY');
  if (heroNY) heroNY.textContent = nyText;
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
  if (hudTime) paintHudTime(label);

  // The countdown reaching zero is the whole point of the site. Do not wait for
  // the next 60-second poll to find out the bell rang -- ask immediately, and
  // keep asking every two seconds until the state actually flips.
  if (total <= 0 && !bellWatch) {
    bellWatch = setInterval(() => {
      const was = marketStatus && marketStatus.isOpen;
      loadRuntime().then(() => {
        if (marketStatus && marketStatus.isOpen !== was) {
          clearInterval(bellWatch); bellWatch = null;
        }
      });
    }, 2000);
    loadRuntime();
  }
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
  document.documentElement.dataset.market = marketStatus.state;
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

/* The server now reads MarketCalendar itself and every visitor is served that
   same cached answer, so the browser no longer duplicates the call -- one read
   for the whole site instead of one per visitor, which is what keeps a public
   RPC usable when a lot of people arrive at once. All that is left here is
   pointing the proof link at the contract the answer came from. */
function verifyOnChain() {
  const address = publicConfig?.marketCalendar?.address;
  if (address && chainProofLink) {
    chainProofLink.href = `https://robinhoodchain.blockscout.com/address/${address}`;
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
    document.title = `${publicConfig.tokenName} — a memecoin on New York Stock Exchange hours`;
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

personTargets.forEach((target) => target.addEventListener('click', () => openPersonCard(target.dataset.person)));
/* '#openStory' lived in the nav that the landing rebuild removed. Bind it only
   if some other surface still renders it, instead of throwing on load. */
const openStoryBtn = document.querySelector('#openStory');
if (openStoryBtn) openStoryBtn.addEventListener('click', () => openPersonCard(visibleState() === 'open' ? 'ivy' : 'mo'));
document.querySelector('#closePerson').addEventListener('click', closePersonCard);
const openTrade = document.querySelector('#openTrade');
if (openTrade) openTrade.addEventListener('click', () => setTradeDrawer(true));
/* Nobody trades on this site. The coin lives in a Uniswap v4 pool, so the
   button's whole job is to hand people off to it -- one hop, new tab, done.
   Until TRADE_URL is set there is nothing to hand off to, so it says so. */
const heroTrade = document.querySelector('#heroTrade');
if (heroTrade) heroTrade.addEventListener('click', () => {
  const url = publicConfig && publicConfig.tradeUrl;
  if (!url) { showToast('The pool is not live yet.'); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
});
document.querySelector('#closeTrade').addEventListener('click', () => setTradeDrawer(false));
drawerScrim.addEventListener('click', () => setTradeDrawer(false));
walletButton.addEventListener('click', connectAccount);

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
  const chip = document.querySelector('#hudChip');
  const chipLabel = document.querySelector('#hudChipLabel');
  if (chip) chip.dataset.state = open ? 'open' : 'closed';
  if (chipLabel) chipLabel.textContent = open ? 'Open' : 'Closed';

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
  /* The register is whoever actually holds the token -- pre-launch that is the
     pool and the deployer, and two rows is the true answer. It used to invent
     twenty holders to make the table look full. */
  const rows = stats.topHolders || [];
  const records = document.querySelector('.records');
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

/* ---- the floor: time & sales, and depth ----------------------------------
   Time and sales is how a trading floor actually shows orders arriving: one
   line per print, newest on top, time / price / size / side, green if it
   lifted the offer and red if it hit the bid. The order book beside it is the
   same data one step earlier -- resting bids and offers stacked away from the
   mid, deepest at the edges.

   Until the pool clears its first swap there is nothing real to draw, so both
   draw nothing and say so. No simulated print has ever been worth the doubt it
   casts on the real ones beside it. */
function renderTape(stats) {
  /* /api/quote owns the tape; /api/token-stats carries empty prints/ladder
     arrays and used to overwrite the real ones with them every 90 seconds, so
     a live tape would fill in and then blank itself on a timer. Only a
     non-empty array is allowed to take over. */
  if (stats && Array.isArray(stats.prints) && stats.prints.length) lastPrints = stats.prints;
  if (stats && Array.isArray(stats.ladder) && stats.ladder.length) lastLadder = stats.ladder;
  const state = document.querySelector('#tapeState');
  const rows = document.querySelector('#tapeRows');
  const book = document.querySelector('#bookRows');
  const spread = document.querySelector('#bookSpread');
  if (!rows) return;

  const open = Boolean(marketStatus && marketStatus.isOpen);
  if (state) {
    state.classList.toggle('is-open', open);
    state.lastChild.textContent = open ? ' Open' : ' Closed';
  }

  /* Nothing invented. Until the pool clears its first swap there is no tape,
     and the honest thing to show is that there is no tape -- a made-up print
     with no label on it is just a lie with a monospace font. */
  const real = lastPrints.length > 0;
  rows.innerHTML = real
    ? lastPrints.map((t) => `<li class="${t.side === 'buy' ? 'buy' : 'sell'}">
        <span>${t.time}</span><span class="r p">${t.price}</span>
        <span class="r">${t.size}</span><span class="r s">${t.side === 'buy' ? 'BOT' : 'SLD'}</span>
      </li>`).join('')
    : `<li class="tape-empty"><span>No trades yet. The tape starts at the pool's first swap.</span></li>`;

  /* Not resting orders -- an AMM has none. Every row is real volume that
     actually traded at that price this session, bought on one side, sold on
     the other. Before the first swap it says so instead of drawing one. */
  const realBook = lastLadder.length > 0;
  if (book) {
    if (realBook) {
      /* the bar widths do the arithmetic on *Raw; the cells print the
         server-formatted strings, so a 2.34e-8 price never reaches the DOM */
      const sizeOf = (l) => Math.max(Number(l.buySizeRaw) || 0, Number(l.sellSizeRaw) || 0);
      const max = Math.max(...lastLadder.map(sizeOf)) || 1;
      book.innerHTML = lastLadder.map((l) => {
        const pct = Math.round((sizeOf(l) / max) * 100);
        const side = (Number(l.buySizeRaw) || 0) >= (Number(l.sellSizeRaw) || 0) ? 'bid' : 'ask';
        return `<div class="book-row ${side}${l.atLast ? ' at-last' : ''}" data-w="${pct}">
          <span class="bs">${Number(l.buySizeRaw) ? l.buySize : ''}</span>
          <span class="c px">${l.price}</span>
          <span class="r as">${Number(l.sellSizeRaw) ? l.sellSize : ''}</span>
        </div>`;
      }).join('');
    } else {
      book.innerHTML = `<div class="book-empty">Nothing has traded yet. Every row here is real volume at a real price.</div>`;
    }
    book.querySelectorAll('.book-row').forEach((r) => {
      r.style.setProperty('--depth', r.getAttribute('data-w') + '%');
    });
  }
  if (spread) {
    const n = realBook ? lastLadder.reduce((a, l) => a + l.trades, 0) : 0;
    spread.textContent = realBook ? `${n.toLocaleString('en-US')} trades` : '';
  }
  if (rows && rows.closest('.floor-col')) rows.closest('.floor-col').classList.toggle('is-empty', !real);
  if (book && book.closest('.floor-col')) book.closest('.floor-col').classList.toggle('is-empty', !realBook);
}

/* ---- the quote block, and your side of it --------------------------------
   Every number here comes out of Swap events on the pool: open, high, low,
   last, volume, and the print itself. When the market shuts, the block does
   what a stock page does -- it freezes on the last trade and says so, rather
   than blanking. */
/* The same rule the server applies to the tape, applied to the quote block --
   this one formats client-side, so it kept printing 7.3890e-8 for a price the
   tape beside it was already rendering as 0.000000073890. Fixed decimals
   scaled to the magnitude, never an exponent. */
const px = (v) => {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  const decimals = a >= 1 ? Math.max(0, 5 - Math.floor(Math.log10(a)) - 1)
                          : Math.min(18, 4 - Math.floor(Math.log10(a)));
  return v.toFixed(decimals);
};

function paintQuote(q) {
  const el = document.querySelector('#quote');
  if (!el || !q) return;
  /* No last trade means no quote. Every field falls to an em dash rather than
     borrowing a number from a simulation -- the block fills itself in the
     moment the pool prints. */
  el.dataset.state = q.isOpen ? 'open' : 'closed';
  const st = document.querySelector('#quoteStatus span');
  if (st) st.textContent = q.isOpen ? 'Open' : (q.sessionLabel || 'Closed');

  const last = q.last;
  document.querySelector('#quoteLast').textContent = last ? px(last.price) : '—';

  const ch = document.querySelector('#quoteChange');
  if (q.change === null || q.change === undefined) { ch.textContent = '—'; ch.className = 'quote-change'; }
  else {
    const pct = q.change * 100;
    ch.textContent = (pct >= 0 ? '▲ +' : '▼ ') + pct.toFixed(2) + '%';
    ch.className = 'quote-change ' + (pct >= 0 ? 'up' : 'dn');
  }

  const set = (id, v) => { const n = document.querySelector(id); if (n) n.textContent = v; };
  set('#qOpen', px(q.open)); set('#qHigh', px(q.high)); set('#qLow', px(q.low));
  set('#qPrev', px(q.prevClose));
  set('#qVol', q.volume === null ? '—' : Math.round(q.volume).toLocaleString('en-US'));
  set('#qCount', q.tradeCount ? q.tradeCount.toLocaleString('en-US') : '—');

  // the frozen print
  const fz = document.querySelector('#quoteFrozen');
  if (fz) {
    if (!q.isOpen && last) {
      const t = new Date(last.at).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      fz.innerHTML = `Closed. Last trade <b>${px(last.price)}</b> × <b>${Math.round(last.size).toLocaleString('en-US')}</b> at <b>${t} ET</b>.`;
      fz.hidden = false;
    } else if (!q.isOpen) {
      fz.textContent = 'Closed. No trades on record yet.';
      fz.hidden = false;
    } else { fz.hidden = true; }
  }
}

async function loadQuote() {
  try {
    const res = await fetch('/api/quote', { cache: 'no-store' });
    if (!res.ok) return;
    const q = await res.json();
    paintQuote(q);
    if (q.prints && q.prints.length) lastPrints = q.prints;
    if (Array.isArray(q.ladder)) lastLadder = q.ladder;
    if ((q.prints && q.prints.length) || (q.ladder && q.ladder.length)) renderTape(null);
    lastQuotePrice = q.last ? q.last.price : null;
    if (accountAddress) paintAccount();
  } catch { /* the page is still readable without a quote */ }
}

/* ---- your account -------------------------------------------------------- */
let accountAddress = null;
let accountBalance = null;
let lastQuotePrice = null;

async function readBalance(addr) {
  const cfg = publicConfig;
  if (!cfg || !cfg.tokenAddress) return null;
  const data = '0x70a08231' + addr.toLowerCase().replace('0x', '').padStart(64, '0');
  try {
    const out = await rpcCall(cfg.marketCalendar.rpcUrl, cfg.tokenAddress, data);
    return Number(BigInt(out)) / 1e18;
  } catch { return null; }
}

function paintAccount() {
  const body = document.querySelector('#accountBody');
  if (!body) return;
  const supply = 1792000000;
  /* No wallet, no position. This used to render an invented 12,480,000 balance
     against an invented price; a made-up holding on a coin page is the one
     number nobody should ever see. Empty until a wallet is actually connected. */
  if (!accountAddress) {
    body.innerHTML = `<p class="account-empty">Connect a wallet to see your position.</p>`;
    return;
  }
  const bal = accountBalance;
  const share = bal === null ? null : bal / supply;
  const px0 = lastQuotePrice;
  const value = (bal !== null && px0) ? bal * px0 : null;
  body.innerHTML = `
    <p class="account-addr">${accountAddress.slice(0, 6)}…${accountAddress.slice(-4)}</p>
    <dl class="account-rows">
      <div><dt>Position</dt><dd>${bal === null ? '—' : Math.round(bal).toLocaleString('en-US')}</dd></div>
      <div><dt>% outstanding</dt><dd>${share === null ? '—' : (share * 100).toFixed(share < 0.0001 ? 4 : 2) + '%'}</dd></div>
      <div><dt>Last price</dt><dd>${px0 ? px(px0) : '—'}</dd></div>
      <div><dt>Value</dt><dd>${value === null ? '—' : (value >= 1
        ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : value.toPrecision(5))}</dd></div>
    </dl>`;
}

/* One wallet, two buttons. The masthead Connect and the panel's own button
   were separate handlers, so connecting at the top left the panel below still
   showing the example. They now share this, and both reflect the result. */
async function adoptAccount(address) {
  accountAddress = address;
  const short = `${address.slice(0, 5)}…${address.slice(-4)}`;
  const btn = document.querySelector('#accountConnect');
  if (btn) btn.textContent = short;
  if (walletButton) walletButton.classList.add('connected');
  if (walletLabel) walletLabel.textContent = short;
  accountBalance = await readBalance(address);
  paintAccount();
}

async function connectAccount() {
  if (!window.ethereum) return showToast('No compatible EVM wallet found.');
  try {
    const accts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accts && accts.length) await adoptAccount(accts[0]);
  } catch { showToast('Wallet connection cancelled.'); }
}

/* if the wallet is already authorised, or the user switches account in it,
   both places follow without a reload */
if (window.ethereum) {
  window.ethereum.request({ method: 'eth_accounts' })
    .then((a) => { if (a && a.length) adoptAccount(a[0]); })
    .catch(() => {});
  if (window.ethereum.on) {
    window.ethereum.on('accountsChanged', (a) => {
      if (a && a.length) adoptAccount(a[0]);
      else { accountAddress = null; accountBalance = null; paintAccount();
             if (walletLabel) walletLabel.textContent = 'Connect';
             if (walletButton) walletButton.classList.remove('connected');
             const btn = document.querySelector('#accountConnect');
             if (btn) btn.textContent = 'Connect wallet'; }
    });
  }
}

paintAccount();
const accountConnect = document.querySelector('#accountConnect');
if (accountConnect) accountConnect.addEventListener('click', connectAccount);

setInterval(loadQuote, 20000);
loadQuote();

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
    // write on a frame boundary: mutating text inside a track that is being
    // transformed can otherwise land mid-frame and cost that frame
    requestAnimationFrame(() => {
      tracks.forEach((t) => t.querySelectorAll('[data-v]').forEach((n) => {
        const k = n.getAttribute('data-v');
        if (k in v && n.textContent !== v[k]) n.textContent = v[k];
      }));
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

    track.appendChild(unit.cloneNode(true));

    // Measure the travel AFTER both copies are in the DOM, as the distance
    // between them -- which is the seamless distance by definition.
    //
    // It used to measure the first unit while it was the only child. In a
    // flex row narrower than its content a lone child gets shrunk, so the
    // number came back small: 814px against a real unit width of 874. Every
    // loop therefore jumped 60px backwards on the board and 156px on the
    // bottom strip. That was the jitter -- not the animation, the ruler.
    track.style.animation = 'none';

    // Measure the travel as the distance between the two copies -- the
    // seamless distance by definition -- but only once layout has settled.
    //
    // Measuring inline used to return a number taken while the row was still
    // being laid out (and, before flex:0 0 auto, while a lone child was being
    // shrunk). The board travelled 814px against a real 874px unit, so every
    // loop snapped 60px backwards. That was the jitter: not the animation,
    // the ruler. Now it measures on the next frame and checks its own work.
    const arm = () => {
      const kids = track.children;
      if (kids.length < 2) return;
      const span = Math.max(1, kids[1].getBoundingClientRect().left
                             - kids[0].getBoundingClientRect().left);
      if (track._marqueeSpan && Math.abs(track._marqueeSpan - span) < 0.5) return;
      track._marqueeSpan = span;
      const dur = Math.max(min, span / pxPerSec);
      const was = track._marqueeAnim;
      const progress = was && was.effect
        ? (was.currentTime || 0) / was.effect.getTiming().duration
        : 0;
      if (was) was.cancel();
      const anim = track.animate(
        [{ transform: 'translate3d(0,0,0)' },
         { transform: `translate3d(${-span}px,0,0)` }],
        { duration: dur * 1000, iterations: Infinity, easing: 'linear' }
      );
      // pick up where the old one left off, so a re-measure is not a visible restart
      anim.currentTime = (progress % 1) * dur * 1000;
      track._marqueeAnim = anim;
    };
    requestAnimationFrame(() => requestAnimationFrame(arm));
    // and check again once, after fonts and container queries have settled
    setTimeout(arm, 900);
    setTimeout(arm, 2500);
  }

  function run() {
    RIGS.forEach(({ track, unit, pxPerSec, min }) => {
      document.querySelectorAll(track).forEach((t) => rebuild(t, unit, pxPerSec, min));
    });
  }


  window.__marqueeRig = run;
  run();
  // the display face changes every advance width when it swaps in; measure again
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 180); });
})();



/* ---- enter the bullpen ----------------------------------------------------
   Not a route change: a page load would kill the zoom, and the whole point is
   that the camera never cuts. The stage scales into the lit window band while
   its overlays drop away, and the interior overlay is already opaque before
   the scale finishes -- so the stage can be reset behind it with nothing on
   screen to give it away. The hash is pushed so Back leaves the floor.       */
(function bullpen() {
  const view    = document.querySelector('#bullpen');
  const enter   = document.querySelector('#bullpenEnter');
  const exit    = document.querySelector('#bullpenExit');
  if (!view || !enter || !exit) return;

  const enterSub = document.querySelector('#bullpenEnterSub');
  const tag   = document.querySelector('#bullpenTag');
  const title = document.querySelector('#bullpenTitle');
  const copy  = document.querySelector('#bullpenCopy');
  const clockLabel = document.querySelector('#bullpenClockLabel');
  const clock = document.querySelector('#bullpenClock');
  const nyTime = document.querySelector('#bullpenNY');

  const ZOOM_MS = 1150;   // matches the scale transition in the stylesheet
  const HANDOFF = 620;    // the overlay starts coming up before the zoom ends
  let open = false, busy = null;

  /* The interior is two 720p loops. They are not built until somebody shows
     intent, so a visitor who never presses the button never pays for them;
     hovering the marker is enough intent to start the download, which is what
     makes the press feel instant. Same A/B rig as the tower, so the loop
     point costs no dropped frame. */
  let scenes = null;
  function ensureScenes() {
    if (scenes) return scenes;
    const d = document.querySelector('#bullpenDay');
    const n = document.querySelector('#bullpenNight');
    if (!d || !n) return null;
    [...d.querySelectorAll('video'), ...n.querySelectorAll('video')]
      .forEach((v) => { v.preload = 'auto'; });
    scenes = { day: sceneLoop(d), night: sceneLoop(n) };
    return scenes;
  }

  /* A <video preload="none"> that is asked to load late can come back with
     networkState LOADING and readyState 0 and simply sit there -- the request
     is open but no frames ever arrive, and the scene stays frozen on its
     poster, which looks exactly like a still image. Nudge anything that has
     not produced a frame; three tries, a second apart. */
  function kick(tries) {
    const n = tries === undefined ? 3 : tries;
    if (n <= 0 || !open) return;
    setTimeout(() => {
      if (!open) return;
      const stuck = [...document.querySelectorAll('#bullpenDay video, #bullpenNight video')]
        .filter((v) => v.readyState < 2);
      if (!stuck.length) return;
      stuck.forEach((v) => { try { v.load(); v.play().catch(() => {}); } catch (e) {} });
      kick(n - 1);
    }, 1200);
  }

  function copyFor() {
    const isOpen = visibleState() === 'open';
    if (enterSub) enterSub.textContent = isOpen ? 'The floor is running' : 'The floor is dark';
    if (!open) return;
    tag.textContent   = isOpen ? 'The floor · open' : 'The floor · closed';
    title.textContent = isOpen ? 'Everybody is here.' : 'Nobody is here.';
    copy.textContent  = isOpen
      ? 'The coin is trading. It stops at 4:00 PM New York time.'
      : 'The coin starts trading at 9:30 AM New York time.';
    if (clockLabel) clockLabel.textContent = isOpen ? 'Closes in' : 'Opens in';
  }

  /* the floor clock mirrors the hero clock rather than keeping its own timer */
  function tick() {
    if (!open) return;
    const t = document.querySelector('#hudTime');
    const n = document.querySelector('#newYorkTime');
    if (t && clock) clock.textContent = t.textContent;
    if (n && nyTime) nyTime.textContent = n.textContent;
  }
  setInterval(tick, 500);

  function go() {
    if (open || busy) return;
    open = true;
    experience.dataset.zoom = 'in';
    view.hidden = false;
    copyFor(); tick();
    const sc = ensureScenes();
    if (sc) { sc.day.play(); sc.night.play(); kick(); }
    // nothing on the stage is visible from in here; four decoders is enough
    sceneDay.pause(); sceneNight.pause();
    // The overlay must not start crossfading while the building is still small
    // or the two shots read as a dissolve instead of one continuous push. It
    // comes up at HANDOFF and finishes opaque exactly as the scale lands.
    setTimeout(() => { if (open) document.documentElement.dataset.bullpen = 'open'; }, HANDOFF);
    busy = setTimeout(() => {
      // the overlay is fully opaque by now, so resetting the stage is invisible
      delete experience.dataset.zoom;
      busy = null;
    }, ZOOM_MS + 220);
    if (location.hash !== '#bullpen') history.pushState({ bullpen: 1 }, '', '#bullpen');
  }

  function leave(pop) {
    if (!open) return;
    open = false;
    if (busy) { clearTimeout(busy); busy = null; }
    delete document.documentElement.dataset.bullpen;
    if (scenes) { scenes.day.pause(); scenes.night.pause(); }
    syncVideoPlayback();
    experience.dataset.zoom = 'out';
    setTimeout(() => { view.hidden = true; delete experience.dataset.zoom; }, 640);
    if (!pop && location.hash === '#bullpen') history.back();
  }

  enter.addEventListener('click', go);
  enter.addEventListener('pointerenter', ensureScenes, { once: true });
  enter.addEventListener('focus', ensureScenes, { once: true });
  exit.addEventListener('click', () => leave(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) leave(false); });
  window.addEventListener('popstate', () => { if (location.hash !== '#bullpen') leave(true); else go(); });
  if (location.hash === '#bullpen') setTimeout(go, 60);

  // the button subtitle has to follow whichever state is being shown, live or
  // previewed, so it is repainted on the same cadence as the rest of the page
  setInterval(copyFor, 1000);
  copyFor();
})();
