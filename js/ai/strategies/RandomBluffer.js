import { ACTIONS } from '../../utils/constants.js';
import { TightAggressive } from './TightAggressive.js';
import { LooseAggressive } from './LooseAggressive.js';
import { TightPassive } from './TightPassive.js';
import { LoosePassive } from './LoosePassive.js';

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
        this.handsPlayed = 0;
        this.switchEvery = 3 + Math.floor(Math.random() * 4);
    }

    decide(gameState, validActions) {
        if (gameState.communityCards.length === 0) {
            this.handsPlayed++;
            if (this.handsPlayed % this.switchEvery === 0) {
                this.currentStrategy = this._pickRandom();
                this.switchEvery = 3 + Math.floor(Math.random() * 4);
            }
        }

        if (Math.random() < 0.10) {
            return this._chaosDecision(validActions, gameState);
        }

        return this.currentStrategy.decide(gameState, validActions);
    }

    _chaosDecision(validActions, gameState) {
        const r = Math.random();

        if (r < 0.15) {
            const allIn = validActions.find(a => a.type === ACTIONS.ALL_IN);
            if (allIn) return { type: ACTIONS.ALL_IN, amount: allIn.amount };
        }

        if (r < 0.5) {
            const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction) {
                const size = raiseAction.minAmount + Math.floor(Math.random() * (raiseAction.maxAmount - raiseAction.minAmount));
                return { type: raiseAction.type, amount: size };
            }
        }

        if (r < 0.75) {
            const callAction = validActions.find(a => a.type === ACTIONS.CALL);
            if (callAction) return { type: ACTIONS.CALL, amount: callAction.amount };
        }

        const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
        return checkAction ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD };
    }

    _pickRandom() {
        return this.strategies[Math.floor(Math.random() * this.strategies.length)];
    }
}
