import { ACTIONS } from '../../utils/constants.js';

export function callStackRatio(validActions, playerChips) {
    const callAction = validActions.find(a => a.type === ACTIONS.CALL);
    if (!callAction || playerChips <= 0) return 0;
    return callAction.amount / playerChips;
}

export function getPotOdds(gameState, validActions) {
    const callAction = validActions.find(a => a.type === ACTIONS.CALL);
    if (!callAction) return 0;
    return callAction.amount / (gameState.pot + callAction.amount);
}

/* ----- action builders — always return a valid action or fold as fallback ----- */

export function foldOrCheck(validActions) {
    const check = validActions.find(a => a.type === ACTIONS.CHECK);
    if (check) return { type: ACTIONS.CHECK };
    return { type: ACTIONS.FOLD };
}

export function callOrCheck(validActions) {
    const check = validActions.find(a => a.type === ACTIONS.CHECK);
    if (check) return { type: ACTIONS.CHECK };
    const call = validActions.find(a => a.type === ACTIONS.CALL);
    if (call) return { type: ACTIONS.CALL, amount: call.amount };
    return { type: ACTIONS.FOLD };
}

/** Build a raise/bet action clamped into the valid [min, max] range.
 *  Falls back to call → check → fold if no raise/bet action is legal. */
export function buildRaise(validActions, targetAmount) {
    const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
    if (!raiseAction) return callOrCheck(validActions);
    const clamped = Math.max(raiseAction.minAmount, Math.min(targetAmount, raiseAction.maxAmount));
    return { type: raiseAction.type, amount: clamped };
}

/** Handy all-in fallback used by aggressive branches. */
export function allInIfAvailable(validActions) {
    const allIn = validActions.find(a => a.type === ACTIONS.ALL_IN);
    if (allIn) return { type: ACTIONS.ALL_IN, amount: allIn.amount };
    return callOrCheck(validActions);
}
