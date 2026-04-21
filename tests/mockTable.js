import { Game } from '../js/game/Game.js';
import { AIController } from '../js/ai/AIController.js';
import { assignPersonalities } from '../js/ai/RoleAssigner.js';

/* HeadlessTable wraps a real Game with all delays zeroed and the
 * "human" seat replaced by a baseline GTO bot, so we can run N hands
 * at full speed with no UI and collect per-personality stats. */
export class HeadlessTable {
    constructor(tableSize) {
        this.tableSize = tableSize;
        this.game = new Game({
            startingChips: 10000,
            smallBlind: 25,
            bigBlind: 50,
            aiThinkingDelayMin: 0,
            aiThinkingDelayMax: 0,
            blindEscalationHands: 99999     // disable blind escalation in sim
        });
        // Zero out every delay call.
        this.game._delay = () => Promise.resolve();
        this.game.aiController = new AIController();

        // Real UI resolves _showdownContinueResolver by clicking "Next Hand".
        // Headless: auto-resolve on potsAwarded so playHand can return.
        this.game.on('potsAwarded', () => {
            queueMicrotask(() => this.game.signalShowdownContinue?.());
        });

        const strategies = assignPersonalities(tableSize);
        // Seat 0 = reference "Shark" bot (stand-in for human player baseline).
        const players = [{ name: 'Ref', isHuman: false, strategy: 'Shark' }];
        for (let i = 0; i < tableSize - 1; i++) {
            players.push({ name: `P${i}`, isHuman: false, strategy: strategies[i] });
        }
        this.game.setupPlayers(players);
        this.strategyBySeat = players.map(p => p.strategy);
    }

    /* Play N hands, recycling chips at the start of each hand so the
     * population stays stable (lets us accumulate many data points without
     * busting players out). Returns nothing — use onEvent callbacks to collect. */
    async runHands(n, onEvent) {
        // Wire listeners
        this.game.on('playerAction', (data) => onEvent?.('playerAction', data));
        this.game.on('playerTurn', (data) => onEvent?.('playerTurn', data));
        this.game.on('showdown', (data) => onEvent?.('showdown', data));
        this.game.on('potsAwarded', (data) => onEvent?.('potsAwarded', data));
        this.game.on('handWonUncontested', (data) => onEvent?.('handWonUncontested', data));

        for (let h = 0; h < n; h++) {
            // Reset chips and pot state so all seats have equal stacks each hand.
            for (const p of this.game.players) {
                p.chips = 10000;
                p.isSittingOut = false;
                p.currentBet = 0;
                p.holeCards = [];
                p.isAllIn = false;
                p.isFolded = false;
            }
            // Record starting chips so delta can be computed
            const startChips = this.game.players.map(p => p.chips);
            onEvent?.('handStart', { startChips });

            try {
                await this.game.playHand();
            } catch (e) {
                onEvent?.('error', { hand: h, message: e?.message || String(e) });
                // Continue — don't let one bad hand kill the run
            }

            const endChips = this.game.players.map(p => p.chips);
            onEvent?.('handEnd', { startChips, endChips });
        }
    }
}
