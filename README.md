# TradFiCoin — tradficoin.trade

The front end for **TRADFI**, a memecoin that can only be traded while the New
York Stock Exchange is open. The rule is not enforced here. It is enforced by a
Uniswap v4 hook that calls `MarketCalendar.isMarketOpen()` before every swap;
outside 09:30–16:00 ET the swap reverts with `MarketClosed(nextOpen)`.

Contracts: **[github.com/northclauder/TradFI](https://github.com/northclauder/TradFI)**
(separate repo, read-only from here — never modified by this project).

## Run locally

```bash
npm test      # 6 tests
npm start     # http://localhost:3000
```

No dependencies. Node 20+. `npm run check` = syntax + tests.

## What the server does

| Route | What it returns |
|---|---|
| `/health` | liveness for Railway |
| `/api/market-status` | open/closed, **read from the calendar contract**, with the local NYSE table as fallback |
| `/api/config` | token, chain, calendar, derived pool, `tradeable` |
| `/api/quote` | open/high/low/last/volume, the tape and the volume-at-price ladder, all decoded from `Swap` events |
| `/api/token-stats` | supply, holders, market cap, 24h volume, via Blockscout |

Market state comes from the chain, not from a copy of the calendar in
JavaScript. Two calendars agree right up until the day they don't, and that
failure looks like the site saying OPEN while every trade reverts. Within two
minutes of a bell the contract is re-read every 2s so the flip lands on time.

## Launch: the four values

Set these on Railway and the site flips itself over. **No redeploy, no code
change.**

| Variable | Where it comes from |
|---|---|
| `TOKEN_ADDRESS` | `TradFI token:` in the deploy output |
| `HOOK_ADDRESS` | `NYSEHoursHook:` in the deploy output |
| `WETH_ADDRESS` | the WETH the pool was paired against (`WETH` env of the deploy) |
| `TRADE_URL` | the Uniswap link for the pool |

From those the server **derives** the v4 pool id — `keccak256(abi.encode(
currency0, currency1, fee, tickSpacing, hooks))` with the pair sorted by
address and DeployLib's fixed 1% / tick-spacing 200 — and derives whether the
token is `token0`. Both were verified against the two real deploys in the
contracts repo. `/api/config` reports `pool.source: "derived"`, so a wrong
pool is visible from outside instead of just showing an empty tape.

Also set at mainnet launch:

| Variable | Value |
|---|---|
| `MARKET_CALENDAR_ADDRESS` | the mainnet `MarketCalendar:` from the deploy |
| `MARKET_CALENDAR_NETWORK` | `mainnet` |
| `MARKET_CALENDAR_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `SWAPS_RPC_URL` | same mainnet RPC |
| `POOL_MANAGER` | Robinhood Chain v4 PoolManager |
| `STATS_TOKEN_ADDRESS` | same as `TOKEN_ADDRESS` |
| `EXPLORER_API_URL` | mainnet Blockscout |

Escape hatches, only if a derivation is ever wrong: `POOL_ID`,
`TOKEN_IS_TOKEN0`, `POOL_FEE_PPM`, `POOL_TICK_SPACING`.

Cosmetic: `TOKEN_NAME`, `TOKEN_SYMBOL`, `RPC_URL`, `EXPLORER_URL`,
`SWAPS_LOOKBACK`.

## Before the pool exists

`tradeable` is false until **both** `TOKEN_ADDRESS` and `TRADE_URL` are set.
Until then the Trade button says so and does nothing.

## Known, and deliberate

- **The market cannot be paused.** `MarketCalendar` has no pause function, and
  `setCalendar` is hard-guarded to future years — the owner cannot close the
  market today, this week, or this year. That is the point of the "nobody holds
  a key" claim on the site. It is also irreversible: if the site ever needs an
  emergency halt, it has to come from a contract that does not exist yet.
- **The calendar covers 2026 and 2027.** `lastCalendarYear` is 2027 on chain.
  `setCalendar(2028, …)` must be called before January 2028 or 2028 runs with
  no holidays — every weekday trades, including Christmas.
- **Sample data.** The quote, tape, ladder, account and holders panels render
  placeholder numbers before the pool has a first swap. They are no longer
  labelled. Real chain data replaces them automatically.
- `/v2` is a staging design rebuild. The route returns 404; the source stays
  for diffing.
