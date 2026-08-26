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
let activeView = 'live';
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
  const minutes = etHourDecimal() * 60;
  if (minutes >= 20 * 60 || minutes < 6 * 60) return 1;
  if (minutes < 16 * 60) return 0;
  return Math.min(1, Math.max(0, (minutes - 16 * 60) / (4 * 60)));
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

function syncVideoPlayback() {
  const mix = getNightMix();
  const wantDay = mix < 1;
  const wantNight = mix > 0;
  if (wantDay) videoDay.play().catch(() => {});
  if (wantNight) videoNight.play().catch(() => {});
}

function renderView() {
  experience.dataset.view = activeView;
  experience.style.setProperty('--night-mix', getNightMix().toFixed(3));
  viewButtons.forEach((button) => button.classList.toggle('active', button.dataset.viewButton === activeView));
  const state = visibleState();
  personHotspots.classList.toggle('state-open', state === 'open');
  personHotspots.classList.toggle('state-closed', state !== 'open');
  document.querySelector('#viewLabel').textContent = activeView === 'live'
    ? 'Live'
    : `Previewing ${state === 'open' ? 'market-open' : 'after-hours'}`;
  document.querySelector('#heroLineOne').textContent = state === 'open' ? 'ON THE' : 'OFF THE';
  document.querySelector('#heroLineTwo').textContent = state === 'open' ? 'FLOOR.' : 'CLOCK.';
  document.querySelector('#heroDescription').innerHTML = state === 'open'
    ? 'Every desk is live.<br />The building is at work.'
    : 'The exchange sleeps.<br />The city doesn’t.';
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
document.querySelector('#openStory').addEventListener('click', () => openPersonCard(visibleState() === 'open' ? 'ivy' : 'mo'));
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

requestAnimationFrame(() => requestAnimationFrame(() => experience.classList.add('ready')));

setInterval(updateClock, 1000);
setInterval(loadRuntime, 60000);
setInterval(verifyOnChain, 45000);
loadRuntime();
schedulePlane();
