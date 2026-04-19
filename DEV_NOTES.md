# Dev Notes — Texas Hold'em Poker

Handoff notes for resuming work on the game. Updated 2026-04-19.

## Status

Shipped end-to-end. Live at https://poker-game-brown.vercel.app, source at https://github.com/patlethal-cyber/poker-game. Vercel auto-deploys on `git push origin main`.

## Architecture

Plain HTML + ES modules, no build step. `serve.py` is a local dev server.

```
index.html              Single HTML shell: all <style> inline, one <script type="module" src="js/main.js">
serve.py                python3 -m http.server wrapper on port 8080
vercel.json             Static-only config (cleanUrls, trailingSlash)
.gitignore              Excludes .DS_Store, node_modules, .vercel, *.log, .claude/launch.json
.claude/launch.json     Claude Code preview config (not committed)

js/
├── main.js             PokerApp bootstrap — wires Game, AI, UI, Audio, History
├── game/
│   ├── Game.js         EventEmitter-based game loop. Emits: newHand, postBlind, dealHoleCards,
│   │                   dealCommunityCards, playerTurn, aiThinking, playerAction, bettingRoundStart/End,
│   │                   handWonUncontested, showdown, potsAwarded, hideShowdown, gameOver, blindsUp
│   ├── Deck.js         Fisher-Yates shuffle
│   ├── Player.js       State: chips, holeCards, currentBet, isFolded/AllIn/SittingOut
│   ├── BettingRound.js Action order, valid actions, raise mechanics
│   ├── PotManager.js   Main + side pot construction, winner distribution
│   └── HandEvaluator.js 21-combination enumeration, hand ranking, preflop + postflop strength estimates
├── ai/
│   ├── AIController.js Dispatches to strategy by player.strategy
│   └── strategies/
│       ├── TightAggressive.js    "Shark"    — plays ~25%, raises strong
│       ├── LooseAggressive.js    "Maniac"   — plays ~45%, raises/bluffs a lot
│       ├── TightPassive.js       "Rock"     — plays ~18%, rarely raises
│       ├── LoosePassive.js       "Fish"     — plays ~50%, never bluffs, calls too much
│       ├── RandomBluffer.js      "Wildcard" — rotates among the other 4 every 3-6 hands + 10% chaos
│       └── utils.js              callStackRatio, getPotOdds
├── ui/
│   ├── TableRenderer.js Dynamic seat geometry via polar coords around ellipse
│   │                    (_positionSeat uses rx/ry that shrink for 8+ players on narrow viewports)
│   │                    Chip-DOM caching (skip rebuild when amount unchanged)
│   │                    Per-seat action-label tokens (prevent racey clears)
│   ├── ActionPanel.js   Fold / Check-Call / Raise / All-In buttons + raise slider + numeric input
│   │                    Quick-bet buttons: Min / ½ Pot / Pot / All-In
│   ├── CardRenderer.js  CSS-drawn playing cards (no SVG, no images)
│   ├── MessageLog.js    Fade-in/out status bar at top
│   └── AudioManager.js  Web Audio API — 8 SYNTHESIZED effects (not files):
│                        deal, chip-light, chip-heavy, fold, check, all-in, win, blinds-up.
│                        Mute state in localStorage as `poker.muted`. Lazy-inits AudioContext
│                        on first user gesture (autoplay policy).
├── storage/
│   └── HistoryStore.js  localStorage keys: poker.history.v1 (500-hand rolling), poker.stats.v1,
│                        poker.settings.v1 (mute, last player count). Export/import JSON v1 schema.
└── utils/
    ├── constants.js   SUITS, RANKS, HAND_RANKINGS, PHASES, ACTIONS, DEFAULT_CONFIG, BLIND_SCHEDULE,
    │                  SKLANSKY_GROUPS
    └── helpers.js     EventEmitter, delay, formatChips, createChipStackHTML, getChipIconColor

css/                   Shared stylesheets (but all actually inlined in index.html — these are unused
                       legacy; inline CSS is authoritative).
```

### Event flow (one hand)

```
Game.playHand()
  ├─ newHand                         → main.js starts this._currentRec; history recording begins
  ├─ postBlind (x2)                  → audio: chip-light; TableRenderer updates chips
  ├─ dealHoleCards                   → audio: deal; TableRenderer shows cards; history captures hole
  ├─ bettingRoundStart (preflop)
  │   ├─ playerTurn                  → TableRenderer highlights active seat
  │   ├─ aiThinking (if AI)
  │   ├─ playerAction                → audio: fold/check/chip-light/chip-heavy/all-in
  │   │                                history records human actions (street=preflop)
  │   └─ ... until round complete
  ├─ bettingRoundEnd                 → TableRenderer clears bets, shows pot totals
  ├─ dealCommunityCards (flop)       → audio: deal; history.finalStreet=flop, community updated
  ├─ ... (turn, river betting)
  ├─ either handWonUncontested       → audio: win; history finalized as showdown-uncontested
  │     or
  │     showdown → potsAwarded       → audio: win; history finalized as showdown
  └─ hideShowdown (post-reveal)
```

## Settings and storage (localStorage)

| Key | Shape | Notes |
|---|---|---|
| `poker.muted` | `'0'` or `'1'` | AudioManager |
| `poker.settings.v1` | `{ lastPlayerCount }` | Start-screen select remembers last value |
| `poker.history.v1` | `HandRecord[]` | Rolling 500-hand cap. See HistoryStore for full shape |
| `poker.stats.v1` | aggregate object | Recomputed on each `appendHand`; key fields: handsPlayed, handsWon, handsFolded, totalNet, biggestPot, biggestWin, vpipHands, pfrHands, showdownsSeen/Won/Lost |

## Running locally

```bash
python3 serve.py           # http://localhost:8080
# or
python3 -m http.server     # http://localhost:8000
```

ES module scripts require HTTP (not `file://`).

## Deploy flow

1. Edit locally
2. `git add <files> && git commit -m "..."`
3. `git push origin main`
4. Vercel auto-deploys in ~30s to https://poker-game-brown.vercel.app

Vercel↔GitHub integration is set up on the `patlethal-cyber` / `patlethal0829-7648` accounts. No CLI needed on this machine.

## Responsive behavior

- `--scale` CSS variable set via `@media (max-width)` steps: 1.0 → 0.9 → 0.82 → 0.74 → 0.64 for desktop → tablet → large-phone → phone → small-phone.
- `#table-area` has `aspect-ratio: 16/10` in landscape, flips to `4/5` under `@media (max-aspect-ratio: 3/4)`.
- Action panel stacks vertically at < 600px, fills the bottom of the screen with stacked rows.
- Hover states guarded by `@media (hover: hover)` so mobile taps don't stick.
- All buttons `min-height: 44px` to meet touch-target guidelines.
- Seat geometry tightens `rx` radii at < 600px to keep 8–10 seats from overflowing narrow viewports.

## Things to know before making changes

- **Inline is authoritative for bugs**: during the consolidation, some `js/` modules had diverged from the running (inline) behavior. Inline versions were copied over the modules; if you find old logic elsewhere on disk, the `js/` version is what runs now.
- **Module boot**: `main.js` uses `if (document.readyState === 'loading') addEventListener else boot immediately` — do not wrap boot in a plain `DOMContentLoaded` listener; with ES modules the event often fires before the script evaluates.
- **AudioContext lazy init**: Web Audio needs a user gesture to start. `AudioManager.resumeIfSuspended()` is called in the "DEAL ME IN" click handler and mute-toggle handler. If you add another UI entry point that expects sound, call it there too.
- **Preview vs real server**: the project was developed while a stale `/tmp/poker-game` snapshot was being served on port 8080 by a forgotten Ruby server. A symlink `/tmp/poker-game/{index.html,js,css} → ~/Documents/Claude Code/poker-game/*` was created to make the preview serve live files. If the preview ever seems stale, check `lsof -i :8080` and that symlinks still point at the working copy.

## Ideas for future sessions

### Polish / bug fixes
- Sound synthesis is functional but a bit beepy. If you want richer audio, replace one or more synthesized sounds in `AudioManager._sounds` with real CC0 OGG files under `assets/audio/` and fetch/decode them in `init()`. The plan file in `~/.claude/plans/` has the original list of 8 sound types to source.
- Hole-card rendering uses `.card.small`. The small size is now `44 * scale px` wide — at scale 0.64 that's ~28px, which is tight. Consider a dedicated `--seat-card-w` variable if seat cards should be scaled independently from showdown cards.
- Fold animation is wired via the `folding` class + CSS keyframes in `cards.css`, but `CardRenderer.foldCard` was removed in Phase A. To re-enable, call `cardEl.classList.add('folding')` inside `TableRenderer.showPlayerAction` when action.type === 'fold'.
- Dealer button / SB / BB labels sometimes overlap at 10 players on narrow portrait phones. If testing on a phone shows clipping, tune `_positionLabel`'s angle offset or hide labels entirely on very narrow screens.

### Features worth considering
- **Turn timer**: `Game._getHumanAction` already supports an optional `humanTurnTimeoutMs` config flag (default null). Wire a UI countdown (visual ring or seconds label on the active seat) and a config for it on the start screen.
- **Replay mode**: HistoryStore records every human action with its street + amount. A "replay hand" button on the history screen could re-render a saved hand step-by-step.
- **Per-session leaderboard across friends**: still possible without a DB by having each friend export their JSON and sharing via chat/discord; a merged "compare" screen could accept multiple imported JSON files and show them side-by-side.
- **Strategy tuning**: the five AI strategies are in `js/ai/strategies/*.js`. Each is self-contained. If a particular AI feels too easy or too punishing, adjust the thresholds in `_preflopDecision` / `_postflopDecision`.
- **Hand strength display**: `HandEvaluator.estimateStrength(holeCards, communityCards)` returns 0–1. A small meter on the player's seat showing live strength could help beginners learn.
- **Multi-human play** (big lift — needs backend): explicitly out of scope per the initial plan. If it ever becomes a requirement, the existing game state is clean enough to be wrapped in WebSocket broadcasting, but expect meaningful rework.

### Known limitations
- The PotManager side-pot logic was not exhaustively tested for 4-way+ all-in scenarios. The algorithm is correct in theory but deserves a proper unit-test pass if side pots misbehave.
- No accessibility pass yet: missing ARIA roles, screen-reader support, keyboard shortcuts. Hover tooltips for strategy tags are text-only — fine for sighted users, bad for screen readers.
- No anti-cheat / multi-open-tab prevention. Since this is friends-only and stakes aren't real money, not a concern.

## Testing a new feature end-to-end

1. Make the change in `js/...`
2. Reload http://localhost:8080 in your browser (the preview uses symlinks, so no rebuild)
3. Open DevTools console to catch module-load errors
4. For responsive work, use DevTools device mode (mobile/tablet/desktop presets) and also drag the window width manually to spot missing breakpoints
5. For history, toggle the 📊 button → verify stats update, play a few hands, reload the page, confirm rows persist
6. `git commit` + `git push` when happy — Vercel auto-deploy will publish to production

## Revoked tokens (as of session end)

The GitHub PAT `poker-game-push` and Vercel token `poker-deploy` that were used for the initial deploy should have been revoked by Lipei. Do not attempt to reuse them — they're either expired, revoked, or both. For future CLI-less deploy work, ask Lipei for fresh short-lived tokens.
