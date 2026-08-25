const experience = document.querySelector('#experience');
const viewButtons = [...document.querySelectorAll('[data-view-button]')];
const personTargets = [...document.querySelectorAll('[data-person]')];
const personCard = document.querySelector('#personCard');
const tradeDrawer = document.querySelector('#tradeDrawer');
const drawerScrim = document.querySelector('#drawerScrim');
const walletButton = document.querySelector('#walletButton');
const walletLabel = document.querySelector('#walletLabel');
const tradeSubmit = document.querySelector('#tradeSubmit');
const toast = document.querySelector('#toast');

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

function getNightMix() {
  if (activeView === 'open') return 0;
  if (activeView === 'closed') return 1;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  if (minutes >= 20 * 60 || minutes < 6 * 60) return 1;
  if (minutes < 16 * 60) return 0;
  return Math.min(1, Math.max(0, (minutes - 16 * 60) / (4 * 60)));
}

function closePersonCard() {
  personCard.classList.remove('visible');
  personCard.setAttribute('aria-hidden', 'true');
}

function renderView() {
  experience.dataset.view = activeView;
  experience.style.setProperty('--night-mix', getNightMix().toFixed(3));
  viewButtons.forEach((button) => button.classList.toggle('active', button.dataset.viewButton === activeView));
  const state = visibleState();
  document.querySelector('#viewLabel').textContent = activeView === 'live'
    ? `Live ${state === 'open' ? 'market-open' : 'after-hours'} view`
    : `${state === 'open' ? 'Market-open' : 'Full-night'} preview`;
  document.querySelector('#heroLineOne').textContent = state === 'open' ? 'ON THE' : 'OFF THE';
  document.querySelector('#heroLineTwo').textContent = state === 'open' ? 'FLOOR.' : 'CLOCK.';
  document.querySelector('#heroDescription').innerHTML = state === 'open'
    ? 'Every desk is live.<br />The building is at work.'
    : 'The exchange sleeps.<br />The city doesn’t.';
  closePersonCard();
}

function updateClock() {
  const now = new Date();
  document.querySelector('#newYorkTime').textContent = `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now)} ET`;
  if (activeView === 'live') experience.style.setProperty('--night-mix', getNightMix().toFixed(3));
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
  document.querySelector('#marketClock').textContent = days
    ? `${days}D ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTrade() {
  if (!marketStatus || !publicConfig) return;
  const configured = Boolean(publicConfig.tokenAddress && publicConfig.tradeUrl);
  document.querySelector('#drawerMarketLabel').textContent = marketStatus.isOpen ? 'Market open' : marketStatus.reason;
  document.querySelector('#drawerSession').textContent = marketStatus.coreHours;
  document.querySelector('#tokenStatus').textContent = configured ? 'Configured' : 'Awaiting contract';
  tradeSubmit.disabled = !marketStatus.isOpen || !configured;
  document.querySelector('#tradeSubmitLabel').textContent = !marketStatus.isOpen
    ? 'Returns at the opening bell'
    : configured ? `${selectedSide === 'buy' ? 'Buy' : 'Sell'} $${publicConfig.tokenSymbol}` : 'Trading contract coming soon';
  document.querySelector('#tradeNote').textContent = !marketStatus.isOpen
    ? 'The order desk follows the real NYSE core session. Visual previews never enable a transaction.'
    : configured ? 'Review the execution route before signing in your wallet.' : 'The floor is open, but no audited token contract or liquidity route is configured.';
}

function renderMarket() {
  experience.dataset.market = marketStatus.state;
  document.querySelector('#marketStateLabel').textContent = marketStatus.isOpen ? 'Market open' : 'Market closed';
  document.querySelector('#marketReason').textContent = `${marketStatus.reason} · ${marketStatus.coreHours}`;
  renderView();
  updateTrade();
  updateClock();
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
    document.title = `${publicConfig.tokenName} — The coin that clocks in`;
    renderMarket();
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
  document.querySelector('#amountCurrency').textContent = selectedSide === 'buy' ? 'ETH' : `$${publicConfig?.tokenSymbol || 'BELL'}`;
  updateTrade();
}));

tradeSubmit.addEventListener('click', () => {
  if (!marketStatus?.isOpen) return showToast('The order desk is closed.');
  if (!publicConfig?.tradeUrl || !publicConfig?.tokenAddress) return showToast('No audited trading route is configured.');
  window.open(publicConfig.tradeUrl, '_blank', 'noopener,noreferrer');
});

experience.addEventListener('pointermove', (event) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const x = (event.clientX / window.innerWidth - .5) * -7;
  const y = (event.clientY / window.innerHeight - .5) * -4;
  experience.style.setProperty('--px', `${x}px`);
  experience.style.setProperty('--py', `${y}px`);
});

setInterval(updateClock, 1000);
setInterval(loadRuntime, 60000);
loadRuntime();
