# Nine Men's Morris

**[Play the full game](https://legedith.github.io/9-men-s-morris/)**

Full Nine Men's Morris for two human players: **24 points, nine pieces per player, mills, captures, sliding and flying**. Play together on one screen or invite a friend online. This replaces the earlier three-piece browser game; the original Java files remain as historical source, not the implementation of these rules.

## Rules implemented

The board has three concentric squares, four midpoint connections, 24 points and 16 mills. There are no diagonal connections and no line across the empty center.

**Place:** alternate placing one piece from hand until each player has placed all nine. Captured pieces are permanently removed, not returned to hand. Movement starts only after all eighteen placements and any pending capture are complete.

**Mill and capture:** close a marked straight line of three to remove one opposing piece. Complete that capture before your turn ends. Pieces inside mills are protected while any opposing piece lies outside a mill. If all opposing pieces are in mills, any may be captured. A mill is not an immediate victory. An existing, unchanged mill gives no extra capture; opening and later closing it earns another. Closing two mills at once earns one capture in this edition.

**Slide:** after placement, move one piece to an adjacent empty point along a board line. No jumping over pieces or moving diagonally.

**Fly:** this edition enables the common flying variation: a player reduced to exactly three pieces may move to any empty point, but only after placement is complete.

**Win:** leave the opponent with fewer than three pieces remaining (including any still in hand), or with no legal movement after placement.

**Draw conventions:** automatic threefold repetition of the same board and player-to-move, or 100 movement turns without a capture (50 moves each). The counter resets on a capture. These are explicit rules for this edition; traditional and tournament rulesets can differ.

Rules reference: [Masters Traditional Games](https://www.mastersgames.com/rules/morris-rules.htm). The in-game How to play dialog explains all conventions.

## Two-player modes

**Same device:** take turns on one screen. The board, including a pending capture, is saved in browser storage when available.

**Online:** choose **Play online → Create a room → Copy** and send the invite to your friend. They open it and press **Join**. A room code works too. The host is Amber (×), the guest Forest (○). No login, installation, microphone or camera.

The host keeps the room in memory and must keep the tab open. A disconnected guest can reconnect or refresh and rejoin from the same tab, including during a capture. Closing or refreshing the host tab ends the room. The original guest's seat is reserved against third-player takeover. Both players must agree to a rematch; the starting player alternates.

Use mouse, touch or keyboard. Tab/arrows navigate the points, Enter/Space acts, Escape deselects. Legal destinations and capture targets are highlighted. Symbols and text distinguish pieces as well as color.

## Upgrade from the old three-piece edition

Both players should reload the site and create a **new room**. Version 2 has a new storage key, wire-protocol version and PeerJS room namespace, so old 3×3 saves or clients cannot silently become full-game matches. Old local data is not deleted. Versioned asset URLs avoid mixing the old and new rules files.

## Hosting and privacy

The site is static HTML, CSS and JavaScript on GitHub Pages. Online mode loads pinned **PeerJS 1.5.5** from jsDelivr with an unpkg fallback. PeerServer Cloud supplies signaling; WebRTC carries the game actions. That PeerJS release includes public STUN/TURN defaults. [PeerJS source](https://github.com/peers/peerjs/blob/v1.5.5/lib/util.ts).

GitHub does not run a multiplayer application backend. Public connection services have no availability guarantee, and restrictive networks can block connections. Same-device mode does not depend on these services.

The host validates each action against round, revision, turn, board adjacency, mill protection and capture phase. The guest legally replays the received action history, including separate capture actions. Duplicate or stale captures cannot remove a second piece. This is friendly peer-hosted play, not a cheat-proof ranked service.

No analytics. Local matches use localStorage; guest rejoin tokens use sessionStorage. Online state stays in host memory. CDN/signaling/ICE providers see normal connection metadata, and WebRTC may reveal IP addresses to opponents. Share invitations privately and play with people you trust.

## Develop and test

All source development is on `main`. No application build or npm installation is required.

```sh
python3 -m http.server 8000
# Open http://localhost:8000
npm test
```

Use Node 22+ for tests. Serve the site over localhost HTTP or deployed HTTPS; opening index.html as a file is not supported by browser ES-module restrictions.

The 34 rules/protocol tests include all sixteen mills for both players, adjacency, flying, protected captures, double mills, reopened mills, placement/capture transitions, material and blockade wins, draws, immutable state, hostile snapshots and rematch consent. Seeded simulation additionally completes 100 legal games and replays every action.

```sh
pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/browser_test.py
python tests/browser_test.py --public
# Optional deployed-site check:
python tests/browser_test.py --public --url https://legedith.github.io/9-men-s-morris/
```

The browser suite checks the full board and placement phase, capture UI, protected mills, flying, capture victory, saved pending captures, phone/desktop layouts, and online play between independent browser contexts. Online checks exercise captures by both seats, turn retention, seat limits, guest refresh during a pending capture, legal sliding, resignations, mutual rematches and disconnect handling. Advanced local fixtures are generated by legal play and validated replay, not by injecting an arbitrary board.

The default online tests use real WebRTC data channels with an isolated test signaling adapter. `--public` uses the actual shipped PeerJS library and public services; there is no adapter. Neither is a guarantee of connectivity on every network.

## Deployment

`.github/workflows/pages.yml` runs rules tests, browser regression tests and the public-service smoke test before deployment. With the repository's existing legacy Pages source, tested static assets are copied from `main` to `gh-pages`, preserving branch history and old documentation. The workflow requests a build and verifies the live version.txt against the tested main commit. Treat `gh-pages` as publishing output, not development source.

The workflow also supports the GitHub Actions Pages publishing mode without changing application code. Only index.html, styles.css, src/, .nojekyll, LICENSE and version.txt are published; tests and the historical Java game are not application assets.

## Files and license

- `src/game.js`: pure rules, topology, replay and match actions.
- `src/app.js`: board UI and local/online interaction.
- `src/online.js`: rooms, synchronization and reconnection.
- `tests/`: rules, legally generated scenarios and browser regressions.
- `morris.java`, `gameBoard.java`: original three-piece console game retained for history.

The existing GPL-3.0 license applies. PeerJS is a separately MIT-licensed dependency loaded only for online play.
