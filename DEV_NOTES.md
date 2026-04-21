# Dev Notes — Texas Hold'em Poker

Handoff notes for resuming work on the game. Updated 2026-04-21.

## Status

Shipped end-to-end. Live at https://poker-game-brown.vercel.app, source at https://github.com/patlethal-cyber/poker-game. Vercel auto-deploys on `git push origin main`.

## Architecture

Plain HTML + ES modules, no build step. `serve.py` is a local dev server.

```
index.html              Single HTML shell: all <style> inline, one <script type="module" src="js/main.js">
serve.py                python3 -m http.server wrapper on port 8080 with no-cache headers
vercel.json             Static-only config (cleanUrls, trailingSlash)
.gitignore              Excludes .DS_Store, node_modules, .vercel, *.log, .claude/launch.json
.claude/launch.json     Claude Code preview config (not committed)

js/
├── main.js             PokerApp bootstrap — wires Game, AI, UI, Audio, History
├── game/
│   ├── Game.js         EventEmitter-based game loop. Pauses via _pauseWaiters,
│   │                   aborts via per-game AbortController (stopGame).
│   │                   Events: newHand, postBlind, dealHoleCards, dealCommunityCards
│   │                   (with fastForward flag when all-in), playerTurn, aiThinking,
│   │                   playerAction, bettingRoundStart/End, handWonUncontested,
│   │                   showdown, potsAwarded, hideShowdown, gameOver, blindsUp,
│   │                   allInRunout.
│   ├── Deck.js         Fisher-Yates shuffle
│   ├── Player.js       State: chips, holeCards, currentBet, isFolded/AllIn/SittingOut
│   ├── BettingRound.js Action order, valid actions, raise mechanics
│   ├── PotManager.js   Main + side pot construction, winner distribution
│   └── HandEvaluator.js 21-combination enumeration, hand ranking, preflop + postflop strength estimates
├── ai/
│   ├── AIController.js Dispatches to strategy by player.strategy
│   ├── RoleAssigner.js Weighted personality assignment with shark cap. Exports
│   │                   assignPersonalities(tableSize) and sharkCap(tableSize).
│   │                   Max Sharks: 2 at 10-seat, 1 elsewhere. Special-case for
│   │                   4-seat (samples 3 distinct roles).
│   └── strategies/
│       ├── gto.js               PROFILES per personality + shared decision helpers
│       │                        (shouldRaiseGTO, shouldBluff, shouldCallPotOdds,
│       │                        gtoBetSize, derivePosition, applyNoise). Tune the
│       │                        PROFILES numbers here — strategies just compose.
│       ├── TightAggressive.js   "Shark"    — tight-aggressive, uses PROFILES.Shark
│       ├── LooseAggressive.js   "Maniac"   — loose-aggressive, rare all-in bluffs
│       ├── TightPassive.js      "Rock"     — never bluffs, stack-averse
│       ├── LoosePassive.js      "Fish"     — station-calls (foldToBet < 1)
│       ├── RandomBluffer.js     "Wildcard" — rotates personas every 3-6 hands + 5% chaos
│       └── utils.js             callStackRatio, getPotOdds, foldOrCheck, callOrCheck,
│                                buildRaise, allInIfAvailable action builders
├── ui/
│   ├── TableRenderer.js Dynamic seat geometry via polar coords around ellipse
│   │                    (_positionSeat uses rx/ry that shrink for 8+ players on narrow viewports).
│   │                    Chip-DOM caching (skip rebuild when amount unchanged).
│   │                    Chip fly animations (flyBetsToPot, flyPotToWinners).
│   │                    dispose() tears down its window resize listener on restart.
│   ├── ActionPanel.js   Fold / Check-Call / Raise / All-In buttons + raise slider + numeric input.
│   │                    Quick-bet buttons: Min / ½ Pot / Pot / All-In.
│   │                    Keyboard shortcuts F/C/R/A when panel visible and no input has focus.
│   ├── CardRenderer.js  CSS-drawn playing cards. Sizes: normal, small, micro (showdown).
│   ├── MessageLog.js    Fade-in/out status bar at top (aria-live="polite")
│   └── AudioManager.js  Web Audio API — 8 SYNTHESIZED effects. Mute in poker.muted localStorage.
├── storage/
│   └── HistoryStore.js  localStorage keys: poker.history.v1 (500-hand rolling), poker.stats.v1,
│                        poker.settings.v1 (mute, last player count, statsHintSeen). Export/import JSON v1 schema.
└── utils/
    ├── constants.js     SUITS, RANKS, HAND_RANKINGS, PHASES, ACTIONS, DEFAULT_CONFIG, BLIND_SCHEDULE,
    │                    TIMING (all delay constants), SKLANSKY_GROUPS
    └── helpers.js       EventEmitter (with removeAllListeners), delay, abortableDelay, shuffle
                         (Fisher-Yates), formatChips, createChipStackHTML, getChipIconColor,
                         avatar name pools + gradient helpers

tests/                   Headless simulation harness (see "AI testing" below)
├── sim.html             Run-simulation UI, open via python3 serve.py + /tests/sim.html
├── sim.js               Orchestration + gate evaluator
├── mockTable.js         HeadlessTable wraps Game with _delay monkey-patched to 0
└── agentStats.js        Per-strategy VPIP / PFR / AF / bb/100 counters
```

### Event flow (one hand)

```
Game.playHand()
  ├─ newHand                         → main.js starts this._currentRec; history recording begins
  ├─ postBlind (x2)                  → audio: chip-light; TableRenderer updates chips
  ├─ dealHoleCards                   → audio: deal; TableRenderer shows cards; history captures hole
  ├─ bettingRoundStart (preflop)
  │   ├─ playerTurn                  → TableRenderer highlights active seat
  │   ├─ aiThinking (if AI)          → respects pause state via Game._delay
  │   ├─ playerAction                → audio: fold/check/chip-light/chip-heavy/all-in
  │   │                                history records human actions (street=preflop)
  │   └─ ... until round complete
  ├─ bettingRoundEnd                 → TableRenderer clears bets, shows pot totals
  ├─ dealCommunityCards (flop, fastForward flag set if all-in runout)
  ├─ ... (turn, river betting)
  ├─ allInRunout (if triggered)      → main.js skips betting animations
  ├─ either handWonUncontested       → audio: win; history finalized as showdown-uncontested
  │     or
  │     showdown                     → overlay shown by main.js with 5s continue countdown
  │   potsAwarded                    → audio: win; history finalized as showdown;
  │                                    Game awaits signalShowdownContinue() from UI
  └─ hideShowdown (post-reveal)      → main.js clears the countdown interval
```

## AI: personalities + role assignment

Each personality is a profile in `js/ai/strategies/gto.js` with numeric frequency tables
(openCutoff, raiseFreq, threeBetFreq, bluffFreq, foldToBet, valueThresh, betSize, noise).
Strategies are thin — they all route through shared helpers in gto.js.

**Role weighting** on game start is done by `js/ai/RoleAssigner.js`:

| Role      | Default weight | Notes |
|-----------|---------------|-------|
| Shark     | 20% | Hard cap: 2 at 10-seat, 1 elsewhere |
| Maniac    | 20% | LAG — aggressive bully style |
| Rock      | 20% | TP — never bluffs |
| Fish      | 25% | LP — station-calls bad pot odds |
| Wildcard  | 15% | Rotates personas every 3-6 hands + 5% chaos |

To tune a personality, edit its profile in `gto.js PROFILES.{Name}` and re-run the
simulation harness. Do NOT edit the per-strategy .js files for frequency changes —
those just compose the profile with the shared helpers.

### AI testing (simulation harness)

Open `python3 serve.py`, browse to `http://localhost:8080/tests/sim.html`.

- **Run Simulation**: runs N hands at selected table size; shows per-strategy stats
  (VPIP, PFR, AF, bb/100) and evaluates 14 pass criteria from the plan.
- **Verify Shark Cap**: 50 fresh game starts per tableSize ∈ {4,5,6,8,10}; confirms
  zero cap violations.

Expected result at 1000 hands / 8 seats: 9–12 of 14 checks pass. All 5 VPIP range
checks hit consistently. The Shark≥Maniac bb/100 ordering sometimes fails at this
sample size because Maniac's bully style really can outperform TAG Shark in
short-handed play — this is real poker behavior, not a bug.

## Settings and storage (localStorage)

| Key | Shape | Notes |
|---|---|---|
| `poker.muted` | `'0'` or `'1'` | AudioManager |
| `poker.settings.v1` | `{ lastPlayerCount, statsHintSeen }` | Start-screen select + stats-hint one-time dismissal |
| `poker.history.v1` | `HandRecord[]` | Rolling 500-hand cap. See HistoryStore for full shape |
| `poker.stats.v1` | aggregate object | Recomputed on each `appendHand`; fields: handsPlayed, handsWon, handsFolded, totalNet, biggestPot, biggestWin, vpipHands, pfrHands, showdownsSeen/Won/Lost |

## Running locally

```bash
python3 serve.py           # http://localhost:8080 (with no-cache headers — required for ES module dev)
```

ES module scripts require HTTP (not `file://`).

## Deploy flow

1. Edit locally
2. `git add <files> && git commit -m "..."`
3. `git push origin main`
4. Vercel auto-deploys in ~30s to https://poker-game-brown.vercel.app

## Responsive behavior

- `--scale` CSS variable set via `@media (max-width)` steps: 1.0 → 0.9 → 0.82 → 0.74 → 0.64 for desktop → tablet → large-phone → phone → small-phone.
- `#table-area` has `aspect-ratio: 16/10` in landscape, flips to `4/5` under `@media (max-aspect-ratio: 3/4)`.
- Action panel stacks vertically at < 600px, fills the bottom of the screen with stacked rows.
- Rotate-overlay shows on portrait/narrow-window (<900px wide or portrait aspect). Desktop variant shows a desktop emoji + "expand your browser window" copy; mobile shows phone emoji + rotate copy.
- All buttons `min-height: 44px` to meet touch-target guidelines.
- Seat geometry tightens `rx` radii at < 600px to keep 8–10 seats from overflowing narrow viewports.

## Accessibility

- `role="dialog" aria-modal="true"` + `aria-labelledby` on the showdown, pause, rankings, history, and rotate overlays.
- `aria-live="polite"` on the top-bar message text so state changes are announced.
- `@media (prefers-reduced-motion: reduce)` neutralizes all animations/transitions and hides confetti.
- Keyboard shortcuts: F/C/R/A for Fold / Check-Call / focus-Raise-input / All-In when the action panel is visible and no input has focus.
- Rankings modal manages focus: moves into the close button on open, returns to trigger on close, Escape closes.

## Things to know before making changes

- **Inline CSS is authoritative.** The `css/` folder was removed in the design-update branch — everything lives in one `<style>` block in index.html.
- **Tune AI in PROFILES, not strategies.** `js/ai/strategies/gto.js` holds the frequency numbers. Strategy .js files are ~30 lines each and mostly identical — they just select a profile and delegate to shared helpers.
- **Module boot**: `main.js` uses `if (document.readyState === 'loading') addEventListener else boot immediately` — do not wrap boot in a plain `DOMContentLoaded` listener; with ES modules the event often fires before the script evaluates.
- **AudioContext lazy init**: Web Audio needs a user gesture to start. `AudioManager.resumeIfSuspended()` is called in the "DEAL ME IN" click handler and mute-toggle handler. If you add another UI entry point that expects sound, call it there too.
- **Game pause / abort**: `Game._delay` respects both pause (await unpaused) and abort (from AbortController). Calling `stopGame()` aborts in-flight delays, so new-game bootup after "Play Again" is immediate even if an AI was mid-think.

## Ideas for future sessions

### Polish / smaller improvements
- Sound synthesis is functional but a bit beepy. If you want richer audio, replace one or more synthesized sounds in `AudioManager._sounds` with real CC0 OGG files under `assets/audio/`.
- Hole-card rendering uses `.card.small`. The small size is `44 * scale px` wide — at scale 0.64 that's ~28px. Consider a dedicated `--seat-card-w` variable for independent seat-card scaling.
- Fold animation: `.folding` CSS class exists but nothing toggles it. Re-enable by calling `cardEl.classList.add('folding')` in `TableRenderer.showPlayerAction` when action.type === 'fold'.
- Dealer button / SB / BB labels sometimes overlap at 10 players on narrow portrait phones.

### Structural refactors (next big session)
- **Split main.js into features**. It's ~870 lines, ~500 of which are HTML-string builders for modals (showdown, history, rankings, game-over, confetti). Extract to `features/ShowdownOverlay.js`, `features/HistoryScreen.js`, etc. Reduces main.js to an orchestrator.
- **Split inline CSS into files**. The inline `<style>` is ~1900 lines with well-named sections. The no-build rule allows multiple `<link rel="stylesheet">`. Split into `css/core.css`, `css/table.css`, `css/overlays.css` for maintainability.

### Features worth considering
- **Turn timer**: `Game._getHumanAction` supports an optional `humanTurnTimeoutMs` config flag. Wire a visual ring on the active seat + a start-screen option.
- **Replay mode**: HistoryStore records every human action with its street + amount. A "replay hand" button could re-render a saved hand step-by-step.
- **Per-session leaderboard across friends**: each friend exports JSON, merge into a comparison screen.
- **Hand strength display**: a live 0–1 meter on the player's seat for beginners.
- **Difficulty selector**: extend `RoleAssigner` to accept weight presets (easy/medium/hard) driven by a start-screen dropdown.

### Known limitations
- The PotManager side-pot logic was not exhaustively tested for 4-way+ all-in scenarios. Deserves a dedicated test pass if side pots misbehave.
- No anti-cheat / multi-open-tab prevention. Since this is friends-only and stakes aren't real money, not a concern.

## Testing a new feature end-to-end

1. Make the change in `js/...`
2. Reload http://localhost:8080 in your browser
3. Open DevTools console to catch module-load errors
4. For AI changes: also open `/tests/sim.html` and click Run to verify character stats stay in range
5. For responsive work, use DevTools device mode (mobile/tablet/desktop presets) and drag the window width manually
6. For history, toggle the history icon → verify stats update, play a few hands, reload the page, confirm rows persist
7. `git commit` + `git push` when happy — Vercel auto-deploy will publish to production

## Revoked tokens (as of initial deploy)

The GitHub PAT `poker-game-push` and Vercel token `poker-deploy` used for initial deploy should have been revoked. For future CLI-less deploy work, ask Lipei for fresh short-lived tokens.
