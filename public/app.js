const world = document.querySelector('#world');
const marketKicker = document.querySelector('#marketKicker');
const marketClock = document.querySelector('#marketClock');
const marketReason = document.querySelector('#marketReason');
const marketBadge = document.querySelector('#marketBadge');
const sessionDetail = document.querySelector('#sessionDetail');
const executionDetail = document.querySelector('#executionDetail');
const tradeSubmit = document.querySelector('#tradeSubmit');
const tradeSubmitLabel = document.querySelector('#tradeSubmitLabel');
const tradeNote = document.querySelector('#tradeNote');
const navPreview = document.querySelector('#navPreview');
const navPreviewLabel = document.querySelector('#navPreviewLabel');
const sceneTime = document.querySelector('#sceneTime');
const walletButton = document.querySelector('#walletButton');
const walletLabel = document.querySelector('#walletLabel');
const toast = document.querySelector('#toast');
const loreCard = document.querySelector('#loreCard');
const closeLore = document.querySelector('#closeLore');
const previewButtons = [...document.querySelectorAll('[data-preview]')];
const characterTargets = [...document.querySelectorAll('[data-character]')];
const tradeTabs = [...document.querySelectorAll('[data-side]')];

const characterStories = {
  ivy: {
    number: 'EMPLOYEE 001',
    name: 'Ivy Mercado',
    role: 'Head trader / night DJ',
    open: 'Ivy runs the loudest desk on the second floor. She claims the closing bell is always a half-beat late.',
    closed: 'At 4:14 she is behind the booth at The Close, turning the final price candles into the night’s first track.',
    openLocation: 'CURRENTLY: EQUITIES DESK',
    closedLocation: 'CURRENTLY: THE CLOSE'
  },
  leo: {
    number: 'EMPLOYEE 009',
    name: 'Leo Bell',
    role: 'Official mascot / unofficial intern',
    open: 'Leo rings the opening bell, loses his badge twice a week, and somehow knows every holder by name.',
    closed: 'Leo lives across the street. His crown stays on until bedtime and his group chat never stops moving.',
    openLocation: 'CURRENTLY: THE FLOOR',
    closedLocation: 'CURRENTLY: WEST 11TH, APT 4B'
  },
  omar: {
    number: 'EMPLOYEE 032',
    name: 'Omar Price',
    role: 'Risk analyst / subway philosopher',
    open: 'Omar sees patterns before the screens do. Nobody understands his charts until three hours later.',
    closed: 'He takes the M train home and writes tomorrow’s market thesis on the back of old transfer slips.',
    openLocation: 'CURRENTLY: RISK & ODD LOTS',
    closedLocation: 'CURRENTLY: DOWNTOWN PLATFORM'
  },
  mo: {
    number: 'NIGHT SHIFT 001',
    name: 'Mo Green',
    role: 'Head janitor / floor historian',
    open: 'Mo sleeps while the traders make a mess of the place.',
    closed: 'He knows every rumor the floor has ever produced. If a ticker moved, Mo swept up the evidence.',
    openLocation: 'CURRENTLY: OFF DUTY',
    closedLocation: 'CURRENTLY: THIRD FLOOR'
  },
  sasha: {
    number: 'NIGHT SHIFT 002',
    name: 'Sasha Keys',
    role: 'Security / opening-bell keeper',
    open: 'Sasha watches the lobby and pretends not to hear Leo practicing the bell upstairs.',
    closed: 'Every light can go dark except the lobby. Sasha holds the keys and starts the coffee at 9:12 sharp.',
    openLocation: 'CURRENTLY: MAIN LOBBY',
    closedLocation: 'CURRENTLY: MAIN LOBBY'
  }
};

let publicConfig = null;
let marketStatus = null;
let previewMode = 'live';
let selectedSide = 'buy';
let countdownTimer = null;
let toastTimer = null;

function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function activeScene() {
  if (previewMode === 'live') return marketStatus?.state || 'closed';
  return previewMode;
}

function applyScene() {
  const scene = activeScene();
  world.dataset.scene = scene;
  navPreviewLabel.textContent = scene === 'open' ? 'See after hours' : 'See market open';
  previewButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.preview === previewMode);
  });
  if (loreCard.classList.contains('visible')) {
    hideLore();
  }
}

function updateClock() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  sceneTime.textContent = `NEW YORK — ${formatter.format(new Date())} ET`;

  if (!marketStatus) return;
  if (marketStatus.isOpen) {
    marketClock.textContent = 'OPEN NOW';
    return;
  }
  if (!marketStatus.nextOpenAt) {
    marketClock.textContent = '--:--:--';
    return;
  }
  const milliseconds = Math.max(0, new Date(marketStatus.nextOpenAt).getTime() - Date.now());
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  marketClock.textContent = days > 0
    ? `${days}D ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTradeAvailability() {
  if (!marketStatus || !publicConfig) return;
  const executionConfigured = Boolean(publicConfig.tradeUrl && publicConfig.tokenAddress);

  sessionDetail.textContent = marketStatus.isOpen ? `Open · ${marketStatus.coreHours}` : `${marketStatus.reason} · ${marketStatus.coreHours}`;
  executionDetail.textContent = executionConfigured ? 'Configured route' : 'Awaiting contract';
  tradeSubmit.disabled = !marketStatus.isOpen || !executionConfigured;

  if (!marketStatus.isOpen) {
    tradeSubmitLabel.textContent = 'Returns at the opening bell';
    tradeNote.textContent = 'The order desk follows the real NYSE core session. Scene previews never enable a transaction.';
  } else if (!executionConfigured) {
    tradeSubmitLabel.textContent = 'Trading contract coming soon';
    tradeNote.textContent = 'The floor is open, but no audited token contract or liquidity route is configured. This interface cannot submit a transaction.';
  } else {
    tradeSubmitLabel.textContent = selectedSide === 'buy' ? `Buy $${publicConfig.tokenSymbol}` : `Sell $${publicConfig.tokenSymbol}`;
    tradeNote.textContent = 'You will review the execution route before signing anything in your wallet.';
  }
}

function renderMarketStatus() {
  if (!marketStatus) return;
  world.dataset.market = marketStatus.state;
  marketKicker.textContent = marketStatus.isOpen ? 'The floor is open' : 'The floor is closed';
  marketBadge.textContent = marketStatus.isOpen ? 'Open' : 'Closed';
  marketReason.textContent = `${marketStatus.reason} · ${marketStatus.coreHours}`;
  applyScene();
  updateTradeAvailability();
  updateClock();
}

async function loadRuntime() {
  try {
    const [configResponse, statusResponse] = await Promise.all([
      fetch('/api/config', { cache: 'no-store' }),
      fetch('/api/market-status', { cache: 'no-store' })
    ]);
    if (!configResponse.ok || !statusResponse.ok) throw new Error('Runtime service unavailable');
    publicConfig = await configResponse.json();
    marketStatus = await statusResponse.json();

    document.querySelectorAll('[data-token-name]').forEach((element) => {
      element.textContent = publicConfig.tokenName;
    });
    document.querySelectorAll('[data-token-symbol]').forEach((element) => {
      element.textContent = `$${publicConfig.tokenSymbol}`;
    });
    document.title = `${publicConfig.tokenName} — A coin that clocks in`;
    renderMarketStatus();
  } catch (error) {
    marketReason.textContent = 'Market clock unavailable';
    marketKicker.textContent = 'Status unavailable';
    marketBadge.textContent = 'Offline';
    tradeSubmit.disabled = true;
    tradeSubmitLabel.textContent = 'Market status unavailable';
    showToast('The New York market clock could not be reached. Trading remains disabled.');
  }
}

function showLore(characterKey) {
  const story = characterStories[characterKey];
  if (!story) return;
  const scene = activeScene();
  document.querySelector('#loreNumber').textContent = story.number;
  document.querySelector('#loreName').textContent = story.name;
  document.querySelector('#loreRole').textContent = story.role;
  document.querySelector('#loreStory').textContent = story[scene];
  document.querySelector('#loreLocation').textContent = scene === 'open' ? story.openLocation : story.closedLocation;
  loreCard.classList.add('visible');
  loreCard.setAttribute('aria-hidden', 'false');
}

function hideLore() {
  loreCard.classList.remove('visible');
  loreCard.setAttribute('aria-hidden', 'true');
}

function setPreview(mode) {
  previewMode = mode;
  applyScene();
}

async function connectWallet() {
  if (!window.ethereum) {
    showToast('No EVM wallet found. Install Robinhood Wallet, MetaMask, or another compatible wallet.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: publicConfig.chain.hexId }]
      });
    } catch (switchError) {
      if (switchError.code !== 4902) throw switchError;
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: publicConfig.chain.hexId,
          chainName: publicConfig.chain.name,
          nativeCurrency: { name: 'Ether', symbol: publicConfig.chain.currency, decimals: 18 },
          rpcUrls: [publicConfig.chain.rpcUrl],
          blockExplorerUrls: [publicConfig.chain.explorerUrl]
        }]
      });
    }
    walletButton.classList.add('connected');
    walletLabel.textContent = shortAddress(accounts[0]);
    showToast('Wallet connected to Robinhood Chain.');
  } catch (error) {
    showToast(error?.message || 'Wallet connection was cancelled.');
  }
}

previewButtons.forEach((button) => {
  button.addEventListener('click', () => setPreview(button.dataset.preview));
});

navPreview.addEventListener('click', () => {
  setPreview(activeScene() === 'open' ? 'closed' : 'open');
});

document.querySelector('#tourButton').addEventListener('click', () => {
  setPreview('closed');
  setTimeout(() => showLore('mo'), 300);
  document.querySelector('#building').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

characterTargets.forEach((target) => {
  target.addEventListener('click', () => showLore(target.dataset.character));
  target.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showLore(target.dataset.character);
    }
  });
});

closeLore.addEventListener('click', hideLore);
walletButton.addEventListener('click', connectWallet);

tradeTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    selectedSide = tab.dataset.side;
    tradeTabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
    document.querySelector('#amountLabel').textContent = selectedSide === 'buy' ? 'You pay' : 'You sell';
    document.querySelector('#amountCurrency').textContent = selectedSide === 'buy' ? 'ETH' : `$${publicConfig?.tokenSymbol || 'BELL'}`;
    updateTradeAvailability();
  });
});

tradeSubmit.addEventListener('click', () => {
  if (!marketStatus?.isOpen) {
    showToast('The order desk is closed until the next NYSE core session.');
    return;
  }
  if (!publicConfig?.tradeUrl || !publicConfig?.tokenAddress) {
    showToast('No audited trading route has been configured.');
    return;
  }
  window.open(publicConfig.tradeUrl, '_blank', 'noopener,noreferrer');
});

countdownTimer = setInterval(updateClock, 1_000);
setInterval(loadRuntime, 60_000);
window.addEventListener('beforeunload', () => clearInterval(countdownTimer));

loadRuntime();
