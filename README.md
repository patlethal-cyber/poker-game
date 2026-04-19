# Texas Hold'em Poker

A browser-based no-limit Texas Hold'em game. You vs. 3–9 AI opponents with five distinct playing styles.

## Features

- **4–10 player tables** — pick the count at the start screen.
- **Five AI styles** — Shark (TAG), Maniac (LAG), Rock (tight-passive), Fish (loose-passive), Wildcard (randomized mix).
- **Responsive UI** — plays on phones (portrait + landscape), tablets, and desktops. Dynamic seat geometry around an elliptical table.
- **Sound effects** — synthesized via Web Audio API (no asset downloads). Mute toggle persisted per-device.
- **Per-device history** — every hand is stored in `localStorage` (500-hand rolling cap). Screen shows aggregate stats (VPIP, PFR, showdown win%, total net, biggest pot/win). Export / import JSON for cross-device backup.

## Running locally

```bash
python3 serve.py        # http://localhost:8080
# or
python3 -m http.server  # http://localhost:8000
```

ES modules require an HTTP server — opening `index.html` via `file://` will not work.

## Architecture

```
js/
├── game/        # Pure game logic (Deck, Player, HandEvaluator, BettingRound, PotManager, Game)
├── ai/          # AIController + five strategy classes
├── ui/          # TableRenderer, ActionPanel, CardRenderer, MessageLog, AudioManager
├── storage/     # HistoryStore (localStorage, v1 schema)
├── utils/       # constants, helpers (EventEmitter, chip formatting)
└── main.js      # PokerApp — wires everything together
```

`index.html` contains all CSS inline and a single `<script type="module" src="js/main.js">`. No build step.

## Deploy to Vercel

1. Push this repo to GitHub.
2. On vercel.com: Import Project → select the repo → Framework: **Other** → Output directory: `.` → Deploy.
3. Subsequent pushes to `main` auto-deploy.

`vercel.json` is static-only (no serverless functions needed).
