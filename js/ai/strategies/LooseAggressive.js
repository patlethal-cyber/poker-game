import { HandEvaluator } from '../../game/HandEvaluator.js';
import {
    callStackRatio, getPotOdds,
    foldOrCheck, callOrCheck, buildRaise, allInIfAvailable
} from './utils.js';
import {
    PROFILES, applyNoise, derivePosition, streetFromGameState,
    shouldRaiseGTO, shouldBluff, shouldCallPotOdds, gtoBetSize
} from './gto.js';

export class LooseAggressive {
    constructor() {
        this.name = 'Maniac';
        this.profile = PROFILES.Maniac;
    }

    decide(gameState, validActions) {
        const profile = this.profile;
        const rawStrength = HandEvaluator.estimateStrength(gameState.holeCards, gameState.communityCards);
        const strength = applyNoise(rawStrength, profile.noise);
        const street = streetFromGameState(gameState);
        const position = derivePosition(gameState.seatIndex, gameState.dealerIndex, gameState.tableSize);
        const stackRisk = callStackRatio(validActions, gameState.playerChips);
        const potOdds = getPotOdds(gameState, validActions);

        // Signature chaos trait: rare bluff all-in on later streets.
        if (street !== 'preflop' && strength < profile.valueThresh[street] && Math.random() < 0.04) {
            return allInIfAvailable(validActions);
        }
        if (stackRisk > 0.75 && strength < 0.55) return foldOrCheck(validActions);

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
