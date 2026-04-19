import { ACTIONS } from '../../utils/constants.js';
import { HandEvaluator } from '../../game/HandEvaluator.js';
import { callStackRatio } from './utils.js';

export class LooseAggressive {
    constructor() {
        this.name = 'Maniac';
    }

    decide(gameState, validActions) {
        const strength = HandEvaluator.estimateStrength(gameState.holeCards, gameState.communityCards);
        const noise = (Math.random() - 0.5) * 0.12;
        const adjusted = Math.max(0, Math.min(1, strength + noise));
        const stackRisk = callStackRatio(validActions, gameState.playerChips);

        if (gameState.communityCards.length === 0) {
            return this._preflopDecision(adjusted, stackRisk, gameState, validActions);
        }
        return this._postflopDecision(adjusted, stackRisk, gameState, validActions);
    }

    _preflopDecision(strength, stackRisk, gameState, validActions) {
        if (strength < 0.18) return { type: ACTIONS.FOLD };

        if (stackRisk > 0.5 && strength < 0.45) return { type: ACTIONS.FOLD };
        if (stackRisk > 0.8 && strength < 0.60) return { type: ACTIONS.FOLD };

        if (Math.random() < 0.40) {
            const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction) {
                const size = Math.floor(raiseAction.minAmount * (1.2 + Math.random() * 0.8));
                return { type: raiseAction.type, amount: Math.min(size, raiseAction.maxAmount) };
            }
        }

        const callAction = validActions.find(a => a.type === ACTIONS.CALL);
        const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
        return callAction ? { type: ACTIONS.CALL, amount: callAction.amount } : (checkAction ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD });
    }

    _postflopDecision(strength, stackRisk, gameState, validActions) {
        if (stackRisk > 0.5 && strength < 0.30) {
            const check = validActions.find(a => a.type === ACTIONS.CHECK);
            return check ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD };
        }

        const isBluff = Math.random() < 0.30;

        if (strength > 0.25 || isBluff) {
            const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction && Math.random() < 0.65) {
                const pot = gameState.pot;
                const size = Math.floor(pot * (0.5 + Math.random() * 0.6));
                return { type: raiseAction.type, amount: Math.max(raiseAction.minAmount, Math.min(size, raiseAction.maxAmount)) };
            }
            const callAction = validActions.find(a => a.type === ACTIONS.CALL);
            if (callAction && stackRisk < 0.4) return { type: ACTIONS.CALL, amount: callAction.amount };
        }

        if (isBluff && Math.random() < 0.12 && strength > 0.15) {
            const allIn = validActions.find(a => a.type === ACTIONS.ALL_IN);
            if (allIn) return { type: ACTIONS.ALL_IN, amount: allIn.amount };
        }

        const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
        return checkAction ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD };
    }
}
