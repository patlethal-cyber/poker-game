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
