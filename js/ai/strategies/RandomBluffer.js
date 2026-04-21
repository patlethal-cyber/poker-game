import { TightAggressive } from './TightAggressive.js';
import { LooseAggressive } from './LooseAggressive.js';
import { TightPassive } from './TightPassive.js';
import { LoosePassive } from './LoosePassive.js';
import {
    foldOrCheck, callOrCheck, buildRaise, allInIfAvailable
} from './utils.js';

/* Wildcard composes four GTO-flavored personas and rotates between them
 * every 3–6 hands, with a 10% chaos override on every decision.
 * Because each sub-strategy now routes through gto.js, the Wildcard
 * inherits GTO behavior per current persona without any new code here. */
export class RandomBluffer {
    constructor() {
        this.name = 'Wildcard';
        this.strategies = [
            new TightAggressive(),
            new LooseAggressive(),
            new TightPassive(),
            new LoosePassive()
        ];
        this.currentStrategy = this._pickRandom();
        this.handsSeen = 0;
        this._lastSeenHandKey = null;
        this.switchEvery = 3 + Math.floor(Math.random() * 4);
    }

    decide(gameState, validActions) {
        // Count a hand only once — track the hand identity so multiple preflop
        // decisions in the same hand don't inflate the counter.
        const handKey = gameState.street === 'preflop'
            ? `${gameState.tableSize}:${gameState.dealerIndex}:${gameState.bigBlind}`
            : null;
        if (handKey && handKey !== this._lastSeenHandKey) {
            this._lastSeenHandKey = handKey;
            this.handsSeen++;
            if (this.handsSeen % this.switchEvery === 0) {
                this.currentStrategy = this._pickRandom();
                this.switchEvery = 3 + Math.floor(Math.random() * 4);
            }
        }

        if (Math.random() < 0.05) {
            return this._chaosDecision(validActions);
        }
        return this.currentStrategy.decide(gameState, validActions);
    }

    _chaosDecision(validActions) {
        const r = Math.random();
        // Chaos all-in is rare and signature; raise + call + check fill out
        // the rest. Bounded to avoid tanking Wildcard's bb/100.
        if (r < 0.08) return allInIfAvailable(validActions);
        if (r < 0.45) {
            const raiseAction = validActions.find(a => a.type === 'raise' || a.type === 'bet');
            if (raiseAction) {
                const size = raiseAction.minAmount +
                    Math.floor(Math.random() * (raiseAction.maxAmount - raiseAction.minAmount));
                return buildRaise(validActions, size);
            }
        }
        if (r < 0.80) return callOrCheck(validActions);
        return foldOrCheck(validActions);
    }

    _pickRandom() {
        return this.strategies[Math.floor(Math.random() * this.strategies.length)];
    }
}
