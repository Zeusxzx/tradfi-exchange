const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const swaps = require('./swaps');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const NYSE_TIME_ZONE = 'America/New_York';

const NYSE_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19',
  '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25'
]);

const NYSE_EARLY_CLOSES = new Set([
  '2026-11-27', '2026-12-24', '2027-11-26', '2028-07-03', '2028-11-24'
]);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function easternParts(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: NYSE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function isTradingDate(parts) {
  return !['Sat', 'Sun'].includes(parts.weekday) && !NYSE_HOLIDAYS.has(parts.dateKey);
}

function sessionMinutes(parts) {
  return parts.hour * 60 + parts.minute + parts.second / 60;
}

function findNextOpen(fromDate) {
  const minuteBoundary = Math.floor(fromDate.getTime() / 60_000) * 60_000;
  for (let offsetMinutes = 1; offsetMinutes <= 60 * 24 * 10; offsetMinutes += 1) {
    const candidate = new Date(minuteBoundary + offsetMinutes * 60_000);
    const parts = easternParts(candidate);
    if (isTradingDate(parts) && parts.hour === 9 && parts.minute === 30) {
      return candidate.toISOString();
    }
  }
  return null;
}

/* ---- the contract is the clock -------------------------------------------
   The hook on the pool decides whether a swap goes through, and it decides by
   asking MarketCalendar. So the site must ask the same contract, not a copy of
   its calendar transcribed into JavaScript -- two calendars agree right up
   until the day they don't, and the failure looks like the site saying OPEN
   while every trade reverts.

   The chain answer is cached briefly and refreshed in the background: one RPC
   read serves every visitor, instead of every browser hitting the RPC itself.
   The local NYSE table stays as the fallback for when the RPC is unreachable,
   and as the source of the labels the contract does not carry (pre-market,
   early close, "9:30 AM-4:00 PM ET"). */
const CALENDAR = {
  address: process.env.MARKET_CALENDAR_ADDRESS || '0xdC9A372eFaB73F3D45E01ECE286d6be614a5E693',
  rpcUrl: process.env.MARKET_CALENDAR_RPC_URL || 'https://rpc.testnet.chain.robinhood.com',
  isMarketOpen: '0xd4ce85f3',
  nextOpen: '0x564be63f',
  ttlMs: 10_000,      // normal cadence
  ttlNearBellMs: 2_000 // within two minutes of an open or a close
};

let calendarCache = { at: 0, isOpen: null, nextOpenEpoch: null, error: null };
let calendarInFlight = null;

async function ethCall(data) {
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'eth_call',
    params: [{ to: CALENDAR.address, data }, 'latest']
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(CALENDAR.rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body, signal: controller.signal
    });
    if (!res.ok) throw new Error('rpc ' + res.status);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'rpc error');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function padHex32(value) {
  return value.toString(16).padStart(64, '0');
}

async function refreshCalendar(now = new Date()) {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  try {
    const [openRaw, nextRaw] = await Promise.all([
      ethCall(CALENDAR.isMarketOpen),
      ethCall(CALENDAR.nextOpen + padHex32(nowSeconds))
    ]);
    const isOpen = BigInt(openRaw) === 1n;
    const nextOpenEpoch = Number(BigInt(nextRaw));
    calendarCache = { at: Date.now(), isOpen, nextOpenEpoch, error: null };
  } catch (error) {
    // keep the last good answer, but remember why the refresh failed
    calendarCache = { ...calendarCache, at: Date.now(), error: error.message };
  }
  return calendarCache;
}

/* Seconds until the next opening or closing bell, by the local table. Only
   used to decide how hard to poll -- the contract still decides the answer. */
function secondsToBell(now = new Date()) {
  const parts = easternParts(now);
  const minutes = sessionMinutes(parts);
  const opensAt = 9 * 60 + 30;
  const closesAt = NYSE_EARLY_CLOSES.has(parts.dateKey) ? 13 * 60 : 16 * 60;
  return Math.min(Math.abs(minutes - opensAt), Math.abs(minutes - closesAt)) * 60;
}

function calendarSnapshot() {
  // The whole site is about one instant. Two minutes either side of a bell the
  // contract is re-read every couple of seconds so the flip lands on time; the
  // rest of the day a slower cadence is plenty and keeps the RPC quiet.
  const ttl = secondsToBell() < 120 ? CALENDAR.ttlNearBellMs : CALENDAR.ttlMs;
  const stale = Date.now() - calendarCache.at > ttl;
  if (stale && !calendarInFlight) {
    calendarInFlight = refreshCalendar().finally(() => { calendarInFlight = null; });
  }
  return calendarCache;
}

// keep the cache warm in the background so a visitor is never the one waiting
setInterval(() => { calendarSnapshot(); }, 2_000).unref?.();

function getMarketStatus(now = new Date()) {
  const parts = easternParts(now);
  const currentMinutes = sessionMinutes(parts);
  const opensAt = 9 * 60 + 30;
  const closesAt = NYSE_EARLY_CLOSES.has(parts.dateKey) ? 13 * 60 : 16 * 60;
  const tradingDate = isTradingDate(parts);
  const isOpen = tradingDate && currentMinutes >= opensAt && currentMinutes < closesAt;

  let reason = 'Market open';
  if (!tradingDate) {
    reason = NYSE_HOLIDAYS.has(parts.dateKey) ? 'NYSE holiday' : 'Weekend';
  } else if (currentMinutes < opensAt) {
    reason = 'Pre-market';
  } else if (currentMinutes >= closesAt) {
    reason = NYSE_EARLY_CLOSES.has(parts.dateKey) ? 'Early close' : 'After hours';
  }

  // The contract wins whenever it has answered. The local table only names the
  // state; it does not get to decide it.
  const chain = calendarSnapshot();
  const chainKnows = chain.isOpen !== null;
  const openNow = chainKnows ? chain.isOpen : isOpen;
  if (chainKnows && chain.isOpen !== isOpen) {
    // the two disagree -- say so out loud rather than picking silently
    reason = chain.isOpen ? 'Market open' : 'Closed on-chain';
  }

  return {
    isOpen: openNow,
    state: openNow ? 'open' : 'closed',
    source: chainKnows ? 'contract' : 'fallback',
    calendarAddress: CALENDAR.address,
    calendarError: chain.error,
    reason,
    timeZone: NYSE_TIME_ZONE,
    coreHours: NYSE_EARLY_CLOSES.has(parts.dateKey) ? '9:30 AM–1:00 PM ET' : '9:30 AM–4:00 PM ET',
    easternDate: parts.dateKey,
    earlyClose: NYSE_EARLY_CLOSES.has(parts.dateKey),
    checkedAt: now.toISOString(),
    nextOpenAt: openNow ? null : (
      // nextOpen(now) from the contract, in epoch seconds; it returns `now`
      // itself while the market is open, which is why it is only used here
      chainKnows && chain.nextOpenEpoch && chain.nextOpenEpoch > Math.floor(now.getTime() / 1000)
        ? new Date(chain.nextOpenEpoch * 1000).toISOString()
        : findNextOpen(now)
    ),
    // while the session is live the useful number is how long is left in it,
    // not when it next opens -- the panel counts down to the closing bell
    // the contract says whether it is open, not when it shuts; the closing bell
    // is 16:00 ET (13:00 on a half day), which the local table does carry
    closesInSeconds: openNow ? Math.round((closesAt - currentMinutes) * 60) : null
  };
}

/* The epoch millisecond of today's opening bell in New York, which is where
   a session's open/high/low/volume starts counting from. */
function sessionStartMs(now = new Date()) {
  const parts = easternParts(now);
  const minutesNow = parts.hour * 60 + parts.minute + parts.second / 60;
  const opensAt = 9 * 60 + 30;
  return now.getTime() - (minutesNow - opensAt) * 60000;
}

function getQuote() {
  const status = getMarketStatus();
  const q = swaps.quote(sessionStartMs());
  return {
    ...q,
    symbol: (process.env.TOKEN_SYMBOL || 'TRADFI'),
    isOpen: status.isOpen,
    sessionLabel: status.isOpen ? 'Open' : status.reason,
    coreHours: status.coreHours,
    prints: swaps.tape(40),
    ladder: swaps.ladder(sessionStartMs(), 18)
  };
}

function getPublicConfig() {
  return {
    tokenName: process.env.TOKEN_NAME || 'TradFiCoin',
    tokenSymbol: process.env.TOKEN_SYMBOL || 'TRADFI',
    tokenAddress: process.env.TOKEN_ADDRESS || '',
    tradeUrl: process.env.TRADE_URL || '',
    supply: '1,792,000,000',
    poolFee: '1%',
    chain: {
      id: 4663,
      hexId: '0x1237',
      name: 'Robinhood Chain',
      currency: 'ETH',
      rpcUrl: process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
      explorerUrl: process.env.EXPLORER_URL || 'https://robinhoodchain.blockscout.com'
    },
    // The MarketCalendar contract is the on-chain source of truth this whole site
    // is dramatizing. Rehearsed + proven on testnet; mainnet address is set once
    // TradFiCoin actually launches on Robinhood Chain mainnet (4663).
    marketCalendar: {
      // 4663 is Robinhood Chain mainnet, 46630 the testnet. This was pinned to
      // the testnet id, so flipping MARKET_CALENDAR_NETWORK=mainnet would have
      // shipped a mainnet address labelled with the testnet's chain.
      network: (process.env.MARKET_CALENDAR_NETWORK || 'testnet'),
      chainId: (process.env.MARKET_CALENDAR_NETWORK || 'testnet') === 'mainnet' ? 4663 : 46630,
      address: process.env.MARKET_CALENDAR_ADDRESS || '0xdC9A372eFaB73F3D45E01ECE286d6be614a5E693',
      rpcUrl: process.env.MARKET_CALENDAR_RPC_URL || 'https://rpc.testnet.chain.robinhood.com',
      // function selectors, computed offline (keccak256 of the signature) so the
      // browser can eth_call this contract with zero dependencies:
      isMarketOpenSelector: '0xd4ce85f3', // isMarketOpen()
      nextOpenSelector: '0x564be63f' // nextOpen(uint256)
    },
    // The page has two faces. Before the pool exists there is nothing to buy,
    // so the hero sells the idea and the Trade button is a placeholder. The
    // moment TOKEN_ADDRESS and TRADE_URL are both set the site flips itself
    // over to the live face -- no redeploy of the front end, just env vars.
    tradeable: Boolean(
      (process.env.TOKEN_ADDRESS || '').trim() && (process.env.TRADE_URL || '').trim()
    ),
    // what the tape is actually reading, so a wrong pool is visible from the
    // outside instead of just showing an empty tape
    pool: {
      id: swaps.CFG.poolId,
      source: swaps.CFG.poolIdSource,
      tokenIsToken0: swaps.CFG.tokenIsToken0,
      poolManager: swaps.CFG.poolManager,
      hook: (process.env.HOOK_ADDRESS || '').trim() || null,
      weth: (process.env.WETH_ADDRESS || '').trim() || null
    },
    repo: 'https://github.com/northclauder/TradFI'
  };
}

/* ---- live token stats -----------------------------------------------------
   Blockscout serves everything the page needs about the token itself --
   holder count, holder list, market cap, 24h volume -- as plain GETs. We proxy
   them rather than calling from the browser: it keeps connect-src at 'self',
   avoids their CORS policy, and lets one cached fetch serve every visitor. */
const EXPLORER_API = (process.env.EXPLORER_API_URL
  || 'https://explorer.testnet.chain.robinhood.com').replace(/\/$/, '');
const STATS_TOKEN = (process.env.STATS_TOKEN_ADDRESS
  || process.env.TOKEN_ADDRESS
  || '0x31200377343522bf566d3627768b9CcDb26bfFf4').trim();
const STATS_TTL_MS = 60_000;
let statsCache = { at: 0, value: null };

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toUnits(raw, decimals) {
  if (raw == null) return null;
  try {
    const d = BigInt(decimals || 18);
    const whole = BigInt(raw) / (10n ** d);
    return Number(whole);
  } catch { return null; }
}

async function getTokenStats() {
  if (statsCache.value && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.value;

  const base = `${EXPLORER_API}/api/v2/tokens/${STATS_TOKEN}`;
  const [token, holders] = await Promise.all([fetchJson(base), fetchJson(`${base}/holders`)]);

  const decimals = token && token.decimals ? Number(token.decimals) : 18;
  const supply = token ? toUnits(token.total_supply, decimals) : null;

  const list = (holders && Array.isArray(holders.items) ? holders.items : [])
    .slice(0, 20)
    .map((item, index) => {
      const amount = toUnits(item.value, decimals);
      return {
        rank: index + 1,
        address: (item.address && item.address.hash) || '',
        isContract: Boolean(item.address && item.address.is_contract),
        label: (item.address && item.address.name) || null,
        amount,
        share: supply && amount != null ? amount / supply : null
      };
    });

  const value = {
    symbol: (token && token.symbol) || 'TRADFI',
    supply,
    holders: token && token.holders_count != null ? Number(token.holders_count) : null,
    marketCap: token && token.circulating_market_cap != null ? Number(token.circulating_market_cap) : null,
    volume24h: token && token.volume_24h != null ? Number(token.volume_24h) : null,
    price: token && token.exchange_rate != null ? Number(token.exchange_rate) : null,
    topHolders: list,
    // No prints or ladder here. They used to be empty arrays on this payload,
    // which the front end faithfully adopted every 90 seconds -- wiping the
    // real tape /api/quote had just filled in. The tape has one source.
    explorerUrl: `${EXPLORER_API}/token/${STATS_TOKEN}`,
    fetchedAt: new Date().toISOString(),
    live: Boolean(token)
  };
  statsCache = { at: Date.now(), value };
  return value;
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(value));
}

// /v2 was a staging rebuild. It is closed to the public -- the source stays in
// the repo so it can be diffed against production, but nothing serves it.
const BLOCKED_PREFIXES = ['/v2'];
function isBlocked(requestPath) {
  return BLOCKED_PREFIXES.some((p) => requestPath === p || requestPath.startsWith(p + '/'));
}

function serveStatic(requestPath, response, headers) {
  if (isBlocked(requestPath)) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }
  // a directory request ('/') means that directory's index.html;
  // without this a folder resolves to a directory stat and 500s
  const normalizedPath = requestPath.endsWith('/') ? requestPath + 'index.html' : requestPath;
  const filePath = path.resolve(PUBLIC_DIR, `.${normalizedPath}`);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    // A folder is not an error. '/v2' and '/v2/' both mean that folder's
    // index.html -- without this, dropping the trailing slash 500s.
    if (!statError && stat.isDirectory()) {
      serveStatic(requestPath.replace(/\/*$/, '') + '/index.html', response, headers);
      return;
    }
    if (statError || !stat.isFile()) {
      sendJson(response, statError && statError.code === 'ENOENT' ? 404 : 500, { error: 'Not found' });
      return;
    }

    const contentType = mimeTypes[path.extname(filePath)] || 'application/octet-stream';
    const baseHeaders = {
      'Content-Type': contentType,
      // 'no-cache' still lets the browser reuse a cached copy, but only after
      // revalidating with the server (a fast 304 if unchanged) -- unlike
      // max-age, it can never silently serve yesterday's JS/CSS after a
      // deploy. Media (large, rarely-changed) keeps a longer cache.
      'Cache-Control': contentType.startsWith('video/') ? 'public, max-age=3600' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self' https://rpc.mainnet.chain.robinhood.com https://rpc.testnet.chain.robinhood.com; img-src 'self' data:; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    };

    // Video needs HTTP range support: Safari/iOS refuses to play <video> sources
    // served without Accept-Ranges + 206 partial content.
    const isMedia = contentType.startsWith('video/');
    const rangeHeader = isMedia ? headers.range : undefined;
    if (isMedia && rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      const start = match && match[1] ? Number(match[1]) : 0;
      const end = match && match[2] ? Number(match[2]) : stat.size - 1;
      const chunkSize = end - start + 1;
      response.writeHead(206, {
        ...baseHeaders,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': chunkSize
      });
      fs.createReadStream(filePath, { start, end }).pipe(response);
      return;
    }

    response.writeHead(200, {
      ...baseHeaders,
      ...(isMedia ? { 'Accept-Ranges': 'bytes' } : {}),
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    if (url.pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'market-hours-exchange' });
      return;
    }
    if (url.pathname === '/api/market-status') {
      sendJson(response, 200, getMarketStatus());
      return;
    }
    if (url.pathname === '/api/config') {
      sendJson(response, 200, getPublicConfig());
      return;
    }
    if (url.pathname === '/api/quote') {
      sendJson(response, 200, getQuote());
      return;
    }
    if (url.pathname === '/api/token-stats') {
      getTokenStats()
        .then((stats) => sendJson(response, 200, stats))
        .catch(() => sendJson(response, 200, { live: false, topHolders: [] }));
      return;
    }
    serveStatic(url.pathname, response, request.headers);
  });
}

if (require.main === module) {
  swaps.start();
  createServer().listen(PORT, '0.0.0.0', () => {
    console.log(`Exchange Building listening on port ${PORT}`);
  });
}

module.exports = { createServer, easternParts, getMarketStatus, getPublicConfig, getTokenStats, getQuote, sessionStartMs };
