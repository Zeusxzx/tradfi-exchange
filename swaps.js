'use strict';
/* ---- reading the tape off the chain ---------------------------------------
   Every trade in a Uniswap v4 pool is a Swap event on the PoolManager
   singleton, tagged with the pool's id. That single event carries everything
   a quote block needs:

     amount0 / amount1   the two sides of the trade  -> size, and which way
     sqrtPriceX96        the pool price after it     -> the print
     fee                 the pool fee

   So there is no indexer, no price API and no third party in this. We read
   the chain the pool is on and do the arithmetic ourselves.

   The chain runs ~0.19s blocks -- about 467,000 a day -- and the RPC times
   out on getLogs spans past ~50k blocks. So this backfills in chunks once,
   then polls only what is new, and keeps a rolling window in memory. */

const SWAP_TOPIC = '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';
const Q96 = 2n ** 96n;

const CFG = {
  rpc: process.env.SWAPS_RPC_URL || process.env.MARKET_CALENDAR_RPC_URL
       || 'https://rpc.testnet.chain.robinhood.com',
  poolManager: process.env.POOL_MANAGER || '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  // the launched pool. Deploy.s.sol's pool is 0x5c02d1b1..., the rehearsal
  // pool that actually has a trade in it is 0x5affb360...
  poolId: process.env.POOL_ID || '0x5affb360ab201810b3715697f373e7e8990aacd3ac60b81394f2cf2a3efd7c44',
  // true when the token we quote is token0 of the pair
  tokenIsToken0: process.env.TOKEN_IS_TOKEN0 === 'true',
  lookbackBlocks: Number(process.env.SWAPS_LOOKBACK || 900000),
  chunk: 45000,
  pollMs: 15000,
  keep: 400
};

let trades = [];       // newest last
let head = 0;          // last block scanned
let ready = false;
let lastError = null;

function hexToBig(h) { return BigInt(h); }
function signed(word, bits) {
  const v = BigInt('0x' + word);
  const lim = 1n << BigInt(bits - 1);
  return v >= lim ? v - (1n << BigInt(bits)) : v;
}

async function rpc(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(CFG.rpc, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'rpc error');
    return json.result;
  } finally { clearTimeout(timer); }
}

/* sqrtPriceX96 is the square root of (token1 per token0), scaled by 2^96.
   Both sides of this pair are 18 decimals, so the decimal terms cancel and
   the only question left is which side of the pair the token sits on. */
function priceFromSqrt(sqrtX96) {
  const num = Number(sqrtX96) / Number(Q96);
  const oneForZero = num * num;              // token1 per token0
  if (!isFinite(oneForZero) || oneForZero === 0) return null;
  return CFG.tokenIsToken0 ? oneForZero : 1 / oneForZero;
}

function decode(log) {
  const raw = log.data.slice(2);
  const w = (i) => raw.slice(i * 64, (i + 1) * 64);
  const amount0 = signed(w(0), 256);
  const amount1 = signed(w(1), 256);
  const sqrtX96 = hexToBig('0x' + w(2));
  const price = priceFromSqrt(sqrtX96);
  // the token side of the trade tells us size, and its sign tells us which
  // way it went: negative means the pool paid it out, ie somebody bought
  const tokenAmt = CFG.tokenIsToken0 ? amount0 : amount1;
  const size = Number(tokenAmt < 0n ? -tokenAmt : tokenAmt) / 1e18;
  return {
    block: Number(log.blockNumber),
    tx: log.transactionHash,
    price,
    size,
    side: tokenAmt < 0n ? 'buy' : 'sell'
  };
}

async function getLogs(from, to) {
  return rpc('eth_getLogs', [{
    address: CFG.poolManager,
    topics: [SWAP_TOPIC, CFG.poolId],
    fromBlock: '0x' + from.toString(16),
    toBlock: '0x' + to.toString(16)
  }]);
}

async function stamp(blocks) {
  // one timestamp fetch per distinct block, not per trade
  const out = new Map();
  for (const b of blocks) {
    try {
      const blk = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), false]);
      if (blk) out.set(b, Number(BigInt(blk.timestamp)) * 1000);
    } catch { /* a missing timestamp is not worth failing the whole sweep */ }
  }
  return out;
}

async function sweep(from, to) {
  const found = [];
  for (let a = from; a <= to; a += CFG.chunk) {
    const b = Math.min(a + CFG.chunk - 1, to);
    try {
      const logs = await getLogs(a, b);
      for (const l of logs) found.push(decode(l));
    } catch (e) { lastError = e.message; }
  }
  if (found.length) {
    const times = await stamp([...new Set(found.map((t) => t.block))]);
    found.forEach((t) => { t.at = times.get(t.block) || Date.now(); });
    trades = trades.concat(found).slice(-CFG.keep);
  }
  return found.length;
}

async function tick() {
  try {
    const tip = Number(BigInt(await rpc('eth_blockNumber', [])));
    if (!head) head = Math.max(0, tip - CFG.lookbackBlocks);
    if (tip > head) { await sweep(head + 1, tip); head = tip; }
    ready = true; lastError = null;
  } catch (e) { lastError = e.message; }
}

function start() { tick(); setInterval(tick, CFG.pollMs); }

/* Open, high, low, last and volume for a window -- the numbers a quote block
   is made of. `since` is the session open; anything before it is the previous
   session, which is where prevClose comes from. */
function quote(sessionStartMs) {
  const inSession = trades.filter((t) => t.at >= sessionStartMs && t.price);
  const before = trades.filter((t) => t.at < sessionStartMs && t.price);
  const last = trades.filter((t) => t.price).slice(-1)[0] || null;
  const prevClose = before.length ? before[before.length - 1].price : null;

  let open = null, high = null, low = null, close = null, volume = 0;
  if (inSession.length) {
    open = inSession[0].price;
    close = inSession[inSession.length - 1].price;
    for (const t of inSession) {
      if (high === null || t.price > high) high = t.price;
      if (low === null || t.price < low) low = t.price;
      volume += t.size;
    }
  }
  const ref = prevClose !== null ? prevClose : open;
  const change = (close !== null && ref) ? (close - ref) / ref : null;

  return {
    ready, error: lastError,
    poolId: CFG.poolId,
    last: last ? { price: last.price, size: last.size, side: last.side, at: last.at, tx: last.tx } : null,
    open, high, low, close, prevClose, change,
    volume: inSession.length ? volume : null,
    tradeCount: inSession.length,
    totalSeen: trades.length
  };
}

function tape(limit = 40) {
  return trades.slice(-limit).reverse().map((t) => ({
    time: new Date(t.at).toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }),
    price: t.price === null ? '—' : t.price.toPrecision(5),
    size: Math.round(t.size).toLocaleString('en-US'),
    side: t.side,
    tx: t.tx
  }));
}

module.exports = { start, quote, tape, CFG };
