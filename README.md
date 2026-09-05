# Nani's Morris — summer vacation edition

**[Play in your browser](https://legedith.github.io/9-men-s-morris/)**

The little three-piece game I played with my nani, revived as a two-player browser game. This is the family's **3×3, three-piece, free-movement variant**, not standard Nine Men's Morris. The original Java implementation remains in `main` alongside the browser version.

## Play together

**Same device:** open the site and take turns. The local board is saved in your browser when storage is available.

**Online:** select **Play online → Create a room → Copy**. Send the invitation to your friend. They open it and press **Join**. A 12-character room code works too. The host plays Amber (×); the guest plays Forest (○). No account, install, camera or microphone is required.

The host must keep the tab open. The board pauses when the connection drops; the guest can reconnect or refresh and rejoin from the same tab. Both players must request a rematch. Closing or refreshing the host tab ends the room. A guest seat is reserved for its original session, so a third person cannot take it during a disconnect.

## Rules

1. Alternate placing one piece on an empty spot until each player has three.
2. Then select one of your pieces and move it to **any** empty spot. Adjacency is not required. There are no captures.
3. A row, column or diagonal of three wins immediately, even during placement.

The starter alternates on rematches. Two explicit draw safeguards prevent endless games: the same board and player-to-move appearing three times, or 200 movement turns. These safeguards and immediate placement-win detection fix omissions in the old console version without changing its free-movement rule.

Touch, mouse and keyboard are supported. Use Tab or arrow keys to choose a spot, Enter/Space to play, and Escape to deselect. Color is not the only piece identifier.

## What GitHub Pages does — and does not do

The site is plain HTML, CSS and JavaScript; there is no build step or application backend. Online mode loads **PeerJS 1.5.5**, pinned on jsDelivr with an unpkg fallback. PeerServer Cloud supplies signaling. WebRTC carries game messages; this PeerJS release includes public STUN/TURN defaults. See [PeerJS's release source](https://github.com/peers/peerjs/blob/v1.5.5/lib/util.ts) and [connection documentation](https://peerjs.com/client/getting-started).

This is **not** a claim that GitHub hosts a multiplayer server, or that there are no external services. Public connection services have no uptime guarantee. Restrictive networks can still block connections; try another network. Same-device mode does not contact these services.

The host validates every action against the current round, revision and turn. The guest replays received move history instead of trusting an arbitrary board. Stale/duplicate actions are rejected. Connection loss never resets a live round, and one player cannot unilaterally restart an online round. This is a friendly peer-hosted game, not a cheat-proof ranked service.

## Privacy

No analytics, login, chat, camera or microphone. Local matches use `localStorage`; guest rejoin tokens use `sessionStorage`. Room state lives in host memory. The CDN, signaling and ICE providers see normal network metadata; WebRTC can reveal an IP address to the opponent. Share invitations privately and play with people you trust. Details are available in the app's Connection & privacy dialog.

## Run locally

```sh
python3 -m http.server 8000
# Open http://localhost:8000
```

Use HTTP on localhost or HTTPS when deployed. Opening `index.html` as a file is not supported because browsers restrict ES module loading on file URLs.

## Tests

Node 22 or newer; no npm dependencies are needed for the rules/protocol tests:

```sh
npm test
```

The suite covers all winning lines, placement/movement validation, stale packets, rematch consent, resignation, draw safeguards, hostile snapshots, room-code parsing, and invariants over 6,762 reachable positions.

Browser tests use Python/Playwright:

```sh
pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/browser_test.py
python tests/browser_test.py --public
```

The default browser suite uses **real WebRTC data channels between independent browser contexts** with a test-only signaling adapter, not fake game-state synchronization. `--public` uses the shipped PeerJS library and public services with no adapter. Both cover joining, seat limits, synchronized play, guest refresh, rematches, resignation, and disconnect handling. The isolated suite also forces a data-channel loss. Public-service tests do not guarantee connectivity on every ISP or firewall.

## Publishing from main

All development lives on `main`. `.github/workflows/pages.yml` runs the rules, browser and public-connection smoke tests, then uploads only `index.html`, `styles.css`, `src/`, `.nojekyll` and `LICENSE` for Pages. Configure **Settings → Pages → Source → GitHub Actions** to use this workflow. The former `gh-pages` documentation branch is not the application source.

## Source map

- `src/game.js`: pure rules engine, replay validation and match protocol.
- `src/online.js`: PeerJS rooms, seat reservation, synchronization and reconnection.
- `src/app.js`: accessible board interaction and UI state.
- `tests/`: rules tests and browser regression tests.
- `morris.java`, `gameBoard.java`: original console game, retained for history.

The repository's existing GPL-3.0 license applies. PeerJS is a separate MIT-licensed dependency loaded only for online play.
