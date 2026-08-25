# Exchange Building Product Specification

## Product direction

Exchange Building is a cinematic, single-token trading experience for Robinhood Chain. Its visual identity is a living cutaway Manhattan block rather than a conventional crypto dashboard. During NYSE core hours, the camera is close to a bright trading floor where miniature workers move between desks, monitors pulse, and the building feels electrically active. After the closing auction, the camera reveals the wider neighborhood: the same recurring characters leave work for apartments, a subway platform, a diner, a rooftop, and a nightclub. The mostly dark exchange remains inhabited by its janitor and security guard, so neither state feels empty.

The interface borrows structural ideas from the supplied references without copying their artwork: full-bleed cinematic scenery, a restrained floating glass navigation pill, editorial oversized type, white hairline borders, and information positioned around the image instead of covering its focal point. The artwork itself is original, code-native SVG and CSS so every character and location can be animated, clicked, keyboard-focused, and adapted for mobile.

The temporary product identity is **Closing Bell**, ticker **$BELL**. Both values, the token contract, RPC endpoint, explorer, and execution URL are runtime configuration values. Preview controls let visitors inspect the open and after-hours worlds, but they never change the real market status or enable a trade.

## Behavior and safety

The server calculates status using `America/New_York`, NYSE weekday rules, the official 2026–2028 holiday calendar, and published 1:00 p.m. early closes. It returns the current session status and next scheduled opening. The client refreshes this status and uses it to label the experience.

Wallet connection targets Robinhood Chain mainnet, chain ID `4663`, and requests an EVM wallet to switch or add the network. No custody or private-key handling exists in the site. Until a real audited token and execution route are configured, order submission remains unavailable and explains why. A production trading implementation must repeat the hours restriction inside the execution contract or server-authorized transaction path; disabling a browser button alone is not enforcement.

Character lore is intentionally small and repeatable. Clicking or focusing a visible character opens an accessible glass dossier with that character's day or night story. Motion respects `prefers-reduced-motion`. On small screens, the scene remains the primary experience while trading controls become a compact lower sheet.
