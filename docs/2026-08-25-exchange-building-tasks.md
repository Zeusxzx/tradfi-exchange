# Exchange Building Implementation Tasks

1. Scaffold a dependency-light Node application with static asset serving, health/config endpoints, Railway configuration, and tests. Verify with `npm test`.
2. Implement the official NYSE core-session calendar in `server.js`, including Eastern Time, published holidays, and early closes. Verify deterministic open, closed, holiday, weekend, and early-close cases.
3. Build the original SVG Manhattan block in `public/index.html` with separate office, street, apartment, transit, nightlife, and building-night-shift layers. Verify every lore target is keyboard accessible.
4. Implement the responsive editorial/glass visual system and day/night transitions in `public/styles.css`. Verify desktop and mobile screenshots.
5. Add market-state refresh, preview mode, character dossiers, trading-shell tabs, wallet connection, and safe disabled execution behavior in `public/app.js`. Verify syntax and browser interactions.
6. Run the complete test/build/smoke suite, deploy a new Railway production project, and verify the public `/health` response and rendered page.
