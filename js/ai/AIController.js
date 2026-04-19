import { ACTIONS } from '../utils/constants.js';
import { TightAggressive } from './strategies/TightAggressive.js';
import { LooseAggressive } from './strategies/LooseAggressive.js';
import { TightPassive } from './strategies/TightPassive.js';
import { LoosePassive } from './strategies/LoosePassive.js';
import { RandomBluffer } from './strategies/RandomBluffer.js';

const STRATEGIES = {
    'Shark': TightAggressive,
    'Maniac': LooseAggressive,
    'Rock': TightPassive,
    'Fish': LoosePassive,
    'Wildcard': RandomBluffer
};

export class AIController {
    constructor() {
        this.strategies = {};
        for (const [name, StrategyClass] of Object.entries(STRATEGIES)) {
            this.strategies[name] = new StrategyClass();
        }
    }

    async decide(player, gameState, validActions) {
        const strategyName = player.strategy || 'Fish';
        const strategy = this.strategies[strategyName] || this.strategies['Fish'];

        const action = strategy.decide(gameState, validActions);

        // Validate the action is in validActions
        return this._validateAction(action, validActions);
    }

    _validateAction(action, validActions) {
        const validTypes = validActions.map(a => a.type);

        if (!validTypes.includes(action.type)) {
            // Fallback: check or fold
            const check = validActions.find(a => a.type === ACTIONS.CHECK);
            if (check) return { type: ACTIONS.CHECK };
            return { type: ACTIONS.FOLD };
        }

        // Validate raise/bet amounts
        if (action.type === ACTIONS.RAISE || action.type === ACTIONS.BET) {
            const raiseAction = validActions.find(a => a.type === action.type);
            if (raiseAction) {
                action.amount = Math.max(raiseAction.minAmount, Math.min(action.amount, raiseAction.maxAmount));
            }
        }

        return action;
    }
}
