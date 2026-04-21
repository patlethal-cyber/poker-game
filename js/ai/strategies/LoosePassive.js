import { HandEvaluator } from '../../game/HandEvaluator.js';
import {
    callStackRatio, getPotOdds,
    foldOrCheck, callOrCheck, buildRaise
} from './utils.js';
import {
    PROFILES, applyNoise, derivePosition, streetFromGameState,
    shouldRaiseGTO, shouldBluff, shouldCallPotOdds, gtoBetSize
} from './gto.js';

export class LoosePassive {
    constructor() {
        this.name = 'Fish';
        this.profile = PROFILES.Fish;
    }

    decide(gameState, validActions) {
        const profile = this.profile;
        const rawStrength = HandEvaluator.estimateStrength(gameState.holeCards, gameState.communityCards);
        const strength = applyNoise(rawStrength, profile.noise);
        const street = streetFromGameState(gameState);
        const position = derivePosition(gameState.seatIndex, gameState.dealerIndex, gameState.tableSize);
        const stackRisk = callStackRatio(validActions, gameState.playerChips);
        const potOdds = getPotOdds(gameState, validActions);

        // Fish gets stubborn, but bails out on clearly unwinnable stack commits.
        if (stackRisk > 0.85 && strength < 0.45) return foldOrCheck(validActions);

        if (shouldRaiseGTO(strength, position, street, profile) ||
            shouldBluff(strength, gameState.pot, gameState.playerChips, street, profile)) {
            const size = gtoBetSize(gameState.pot, gameState.playerChips, street, profile, gameState.bigBlind);
            return buildRaise(validActions, size);
        }

        if (shouldCallPotOdds(strength, potOdds, street, profile)) {
            return callOrCheck(validActions);
        }
        return foldOrCheck(validActions);
    }
}
