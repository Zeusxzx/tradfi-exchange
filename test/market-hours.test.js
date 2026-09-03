const test = require('node:test');
const assert = require('node:assert/strict');
const { getMarketStatus, getPublicConfig } = require('../server');

test('opens during a normal NYSE core session', () => {
  const status = getMarketStatus(new Date('2026-08-25T15:00:00.000Z'));
  assert.equal(status.isOpen, true);
  assert.equal(status.reason, 'Market open');
  assert.equal(status.coreHours, '9:30 AM–4:00 PM ET');
});

test('closes after the normal closing auction', () => {
  const status = getMarketStatus(new Date('2026-08-25T20:00:00.000Z'));
  assert.equal(status.isOpen, false);
  assert.equal(status.reason, 'After hours');
  assert.match(status.nextOpenAt, /:30:00\.000Z$/);
});

test('closes on an official holiday', () => {
  const status = getMarketStatus(new Date('2026-12-25T16:00:00.000Z'));
  assert.equal(status.isOpen, false);
  assert.equal(status.reason, 'NYSE holiday');
});

test('closes on weekends', () => {
  const status = getMarketStatus(new Date('2026-08-29T16:00:00.000Z'));
  assert.equal(status.isOpen, false);
  assert.equal(status.reason, 'Weekend');
});

test('honors the published 1 PM early close', () => {
  const beforeClose = getMarketStatus(new Date('2026-11-27T17:30:00.000Z'));
  const afterClose = getMarketStatus(new Date('2026-11-27T18:00:00.000Z'));
  assert.equal(beforeClose.isOpen, true);
  assert.equal(beforeClose.earlyClose, true);
  assert.equal(afterClose.isOpen, false);
  assert.equal(afterClose.reason, 'Early close');
});

test('exposes non-secret Robinhood Chain configuration', () => {
  const config = getPublicConfig();
  assert.equal(config.chain.id, 4663);
  assert.equal(config.chain.hexId, '0x1237');
  assert.equal(config.tokenAddress, '');
});

/* ---- launch wiring --------------------------------------------------------
   The pool id and which side of the pair the token sits on are derived, not
   handed over. Both are checked against the two real deploys recorded in the
   contracts repo's broadcast files, so a change to the derivation that would
   silently point the tape at the wrong pool fails here instead of on launch
   day. */
const swaps = require('../swaps');
const { keccak256 } = require('../keccak');

const WETH_TESTNET = '0x33e4191705c386532ba27cbf171db86919200b94';

test('keccak256 matches the known empty-string vector', () => {
  assert.equal(
    keccak256(Buffer.from('', 'utf8')),
    '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
  );
});

test('the calendar selectors the site eth_calls are the real ones', () => {
  assert.equal(keccak256(Buffer.from('isMarketOpen()')).slice(0, 10), '0xd4ce85f3');
  assert.equal(keccak256(Buffer.from('nextOpen(uint256)')).slice(0, 10), '0x564be63f');
});

test('pool id derives to the real Deploy.s.sol pool', () => {
  assert.equal(
    swaps.derivePoolId(
      '0x31200377343522bf566d3627768b9ccdb26bfff4', WETH_TESTNET,
      '0x4e0279e43be4c61ee09654c5261f2c0882080080'
    ),
    '0x5c02d1b18f7a022ccfaabc87d415ba3e396e7f70981c349c965a5f582a2630ba'
  );
});

test('pool id derives to the real DeployTestLaunch pool', () => {
  assert.equal(
    swaps.derivePoolId(
      '0x8afdccd79d9415a565713b660250b6d09b739c9a', WETH_TESTNET,
      '0xea21a36bb3b3f44262368b10ec01f5b35c178080'
    ),
    '0x5affb360ab201810b3715697f373e7e8990aacd3ac60b81394f2cf2a3efd7c44'
  );
});

test('token0 is the lower address of the pair', () => {
  assert.equal(swaps.deriveTokenIsToken0('0x31200377343522bf566d3627768b9ccdb26bfff4', WETH_TESTNET), true);
  assert.equal(swaps.deriveTokenIsToken0('0x8afdccd79d9415a565713b660250b6d09b739c9a', WETH_TESTNET), false);
});

test('a memecoin price never renders in scientific notation', () => {
  // TRADFI against WETH will live around 1e-8; toPrecision(5) would print
  // "2.3400e-8" on the tape, which reads as a broken row.
  for (const v of [2.34e-8, 1.7e-12, 0.0412, 1.2345, 31087540.26]) {
    assert.ok(!/e[-+]/i.test(swaps.fmtPrice(v)), `${v} -> ${swaps.fmtPrice(v)}`);
  }
  assert.equal(swaps.fmtPrice(null), '—');
});

test('a real trade never renders as size 0', () => {
  assert.notEqual(swaps.fmtSize(0.396), '0');
  assert.notEqual(swaps.fmtSize(0.0081), '0');
  assert.equal(swaps.fmtSize(12400000), '12,400,000');
  assert.equal(swaps.fmtSize(0), '0');
});

test('the wire carries no part of the mechanism', () => {
  // this is a privacy assertion, not a formatting one. Anything added to these
  // payloads is readable by anyone who opens devtools, forever.
  const { getPublicConfig, getMarketStatus } = require('../server');
  const cfg = getPublicConfig();
  for (const k of ['marketCalendar', 'pool', 'repo']) {
    assert.equal(cfg[k], undefined, `/api/config leaks ${k}`);
  }
  const blob = JSON.stringify(cfg) + JSON.stringify(getMarketStatus());
  // nextOpenAt survives on purpose -- it is a timestamp the countdown needs,
  // not a description of how the answer was reached
  for (const needle of ['github', 'northclauder', 'Selector', 'poolManager',
                        'calendarAddress', 'isMarketOpen()', 'poolId',
                        'hookAddress', 'keccak', '0xd4ce85f3', '0x564be63f',
                        'MarketCalendar', 'NYSEHoursHook']) {
    assert.ok(!blob.includes(needle), `an API payload leaks "${needle}"`);
  }
});

test('nothing served to a browser carries a comment', () => {
  const fs = require('node:fs');
  const { stripJs, stripCss, stripHtml } = require('../strip');
  const cases = [
    ['public/app.js', stripJs, /\/\*|(^|[^:])\/\//m],
    ['public/styles.css', stripCss, /\/\*/],
    ['public/index.html', stripHtml, /<!--/]
  ];
  for (const [file, strip, pattern] of cases) {
    const out = strip(fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8'));
    assert.ok(!pattern.test(out), `${file} still carries a comment after stripping`);
    assert.ok(out.length > 1000, `${file} stripped to nothing -- the stripper broke`);
  }
});

test('the stripper does not corrupt code that merely looks like a comment', () => {
  const { stripJs } = require('../strip');
  assert.equal(stripJs('const u = "https://x.com/a"; // x').trim(), 'const u = "https://x.com/a";');
  assert.equal(stripJs('const r = /a\\/b/g; // x').trim(), 'const r = /a\\/b/g;');
  assert.equal(stripJs('const s = "/* kept */";').trim(), 'const s = "/* kept */";');
  assert.equal(stripJs('const x = a / b; // x').trim(), 'const x = a / b;');
});

test('the site is not tradeable until both the token and the route are set', () => {
  const { getPublicConfig } = require('../server');
  const t = process.env.TOKEN_ADDRESS, u = process.env.TRADE_URL;
  delete process.env.TOKEN_ADDRESS; delete process.env.TRADE_URL;
  assert.equal(getPublicConfig().tradeable, false);
  process.env.TOKEN_ADDRESS = '0x1111111111111111111111111111111111111111';
  assert.equal(getPublicConfig().tradeable, false, 'a token with no route is not tradeable');
  process.env.TRADE_URL = 'https://app.uniswap.org/swap';
  assert.equal(getPublicConfig().tradeable, true);
  if (t === undefined) delete process.env.TOKEN_ADDRESS; else process.env.TOKEN_ADDRESS = t;
  if (u === undefined) delete process.env.TRADE_URL; else process.env.TRADE_URL = u;
});

test('the quote block never prints an exponent either', () => {
  // the front end formats this one, so it needs the same rule as the tape;
  // this mirrors public/app.js's px()
  const px = (v) => {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a === 0) return '0';
    const d = a >= 1 ? Math.max(0, 5 - Math.floor(Math.log10(a)) - 1)
                     : Math.min(18, 4 - Math.floor(Math.log10(a)));
    return v.toFixed(d);
  };
  for (const v of [7.389e-8, 9.5e-8, 2.34e-12, 0.0412, 180.25]) {
    assert.ok(!/e[-+]/i.test(px(v)), `${v} -> ${px(v)}`);
  }
});

test('token-stats does not carry a tape that could overwrite the real one', async () => {
  const { getTokenStats } = require('../server');
  const stats = await getTokenStats();
  assert.equal(stats.prints, undefined, 'prints on token-stats blanked the live tape every 90s');
  assert.equal(stats.ladder, undefined, 'ladder on token-stats blanked the live ladder every 90s');
});

test('the closing countdown never goes negative when the two clocks disagree', () => {
  // the open/closed decision is the contract's; the closing bell comes from
  // the local table. If the contract holds the market open past 16:00 ET there
  // is no honest number of seconds to show, so there must be none.
  const { getMarketStatus } = require('../server');
  const s = getMarketStatus();
  assert.ok(s.closesInSeconds === null || s.closesInSeconds > 0,
    `closesInSeconds was ${s.closesInSeconds}`);
});
