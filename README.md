# Closing Bell / Exchange Building

A cinematic single-token trading shell for Robinhood Chain that follows the NYSE core session. The visual centerpiece is a GPT-generated photoreal Manhattan exchange with populated trading floors, aligned human-activity frames, and a full-night city state. The interface crossfades daylight into city light after the closing bell while the same building remains centered.

## Run locally

```bash
npm test
npm start
```

Open `http://localhost:3000`.

## Runtime configuration

The site is safe by default: without both a token address and trade route, no transaction action is enabled.

- `TOKEN_NAME` — display name, defaults to `Closing Bell`
- `TOKEN_SYMBOL` — ticker without `$`, defaults to `BELL`
- `TOKEN_ADDRESS` — audited Robinhood Chain token address
- `TRADE_URL` — reviewed execution or liquidity URL
- `RPC_URL` — optional Robinhood Chain RPC override
- `EXPLORER_URL` — optional block explorer override

Robinhood Chain mainnet is chain ID `4663` (`0x1237`) and uses ETH for gas.

## Market-hours enforcement

The display clock handles Eastern Time, weekdays, official NYSE holidays, and published 1:00 p.m. early closes for 2026–2028. This frontend and server are not a sufficient security boundary for a real time-locked asset. Production execution must enforce the same session rule inside an audited contract or server-authorized transaction path.
