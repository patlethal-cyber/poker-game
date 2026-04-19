import { ACTIONS } from '../../utils/constants.js';
import { HandEvaluator } from '../../game/HandEvaluator.js';
import { callStackRatio } from './utils.js';

export class TightPassive {
    constructor() {
        this.name = 'Rock';
    }

    decide(gameState, validActions) {
        const strength = HandEvaluator.estimateStrength(gameState.holeCards, gameState.communityCards);
        const noise = (Math.random() - 0.5) * 0.04;
        const adjusted = Math.max(0, Math.min(1, strength + noise));
        const stackRisk = callStackRatio(validActions, gameState.playerChips);

        if (gameState.communityCards.length === 0) {
            return this._preflopDecision(adjusted, stackRisk, validActions);
        }
        return this._postflopDecision(adjusted, stackRisk, gameState, validActions);
    }

    _preflopDecision(strength, stackRisk, validActions) {
        if (strength < 0.40) return { type: ACTIONS.FOLD };

        if (stackRisk > 0.15 && strength < 0.55) return { type: ACTIONS.FOLD };
        if (stackRisk > 0.35 && strength < 0.70) return { type: ACTIONS.FOLD };

        if (strength > 0.75 && Math.random() < 0.10) {
            const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction) return { type: raiseAction.type, amount: raiseAction.minAmount };
        }

        const callAction = validActions.find(a => a.type === ACTIONS.CALL);
        const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
        return callAction ? { type: ACTIONS.CALL, amount: callAction.amount } : (checkAction ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD });
    }

    _postflopDecision(strength, stackRisk, gameState, validActions) {
        if (stackRisk > 0.20 && strength < 0.45) {
            const check = validActions.find(a => a.type === ACTIONS.CHECK);
            return check ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD };
        }

        if (strength > 0.55) {
            if (Math.random() < 0.10) {
                const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
                if (raiseAction) return { type: raiseAction.type, amount: raiseAction.minAmount };
            }
            const callAction = validActions.find(a => a.type === ACTIONS.CALL);
            const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
            return callAction ? { type: ACTIONS.CALL, amount: callAction.amount } : (checkAction ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD });
        }

        if (strength > 0.25) {
            const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
            if (checkAction) return { type: ACTIONS.CHECK };
            const callAction = validActions.find(a => a.type === ACTIONS.CALL);
            if (callAction && stackRisk < 0.10) return { type: ACTIONS.CALL, amount: callAction.amount };
            return { type: ACTIONS.FOLD };
        }

        const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
        return checkAction ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD };
    }
}
