import { ACTIONS } from '../../utils/constants.js';
import { HandEvaluator } from '../../game/HandEvaluator.js';
import { callStackRatio, getPotOdds } from './utils.js';

export class TightAggressive {
    constructor() {
        this.name = 'Shark';
    }

    decide(gameState, validActions) {
        const strength = HandEvaluator.estimateStrength(gameState.holeCards, gameState.communityCards);
        const noise = (Math.random() - 0.5) * 0.06;
        const adjusted = Math.max(0, Math.min(1, strength + noise));
        const stackRisk = callStackRatio(validActions, gameState.playerChips);

        if (gameState.communityCards.length === 0) {
            return this._preflopDecision(adjusted, stackRisk, gameState, validActions);
        }
        return this._postflopDecision(adjusted, stackRisk, gameState, validActions);
    }

    _preflopDecision(strength, stackRisk, gameState, validActions) {
        if (strength < 0.32) return { type: ACTIONS.FOLD };

        if (stackRisk > 0.3 && strength < 0.55) return { type: ACTIONS.FOLD };
        if (stackRisk > 0.6 && strength < 0.70) return { type: ACTIONS.FOLD };

        if (strength > 0.50 && Math.random() < 0.70) {
            const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction) {
                const pot = gameState.pot;
                const size = Math.floor(pot * (0.5 + strength * 0.5));
                return { type: raiseAction.type, amount: Math.max(raiseAction.minAmount, Math.min(size, raiseAction.maxAmount)) };
            }
        }

        const callAction = validActions.find(a => a.type === ACTIONS.CALL);
        const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
        return callAction ? { type: ACTIONS.CALL, amount: callAction.amount } : (checkAction ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD });
    }

    _postflopDecision(strength, stackRisk, gameState, validActions) {
        const potOdds = getPotOdds(gameState, validActions);

        if (stackRisk > 0.5 && strength < 0.55) return this._checkOrFold(validActions);
        if (stackRisk > 0.25 && strength < 0.35) return this._checkOrFold(validActions);

        if (strength > 0.55 && Math.random() < 0.70) {
            const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction) {
                const pot = gameState.pot;
                const size = Math.floor(pot * (0.4 + strength * 0.4));
                return { type: raiseAction.type, amount: Math.max(raiseAction.minAmount, Math.min(size, raiseAction.maxAmount)) };
            }
        }

        if (strength > 0.25 && strength > potOdds) {
            const callAction = validActions.find(a => a.type === ACTIONS.CALL);
            if (callAction) return { type: ACTIONS.CALL, amount: callAction.amount };
        }

        if (Math.random() < 0.12) {
            const betAction = validActions.find(a => a.type === ACTIONS.BET);
            if (betAction) {
                const size = Math.floor(betAction.minAmount * (1 + Math.random() * 0.3));
                return { type: ACTIONS.BET, amount: Math.min(size, betAction.maxAmount) };
            }
        }

        return this._checkOrFold(validActions);
    }

    _checkOrFold(validActions) {
        const check = validActions.find(a => a.type === ACTIONS.CHECK);
        return check ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD };
    }
}
