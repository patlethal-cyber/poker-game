import { HandEvaluator } from '../../game/HandEvaluator.js';
import {
    callStackRatio, getPotOdds,
    foldOrCheck, callOrCheck, buildRaise
} from './utils.js';
import {
    PROFILES, applyNoise, derivePosition, streetFromGameState,
    shouldRaiseGTO, shouldBluff, shouldCallPotOdds, gtoBetSize
} from './gto.js';

export class TightAggressive {
    constructor() {
        this.name = 'Shark';
        this.profile = PROFILES.Shark;
    }

    decide(gameState, validActions) {
        const profile = this.profile;
        const rawStrength = HandEvaluator.estimateStrength(gameState.holeCards, gameState.communityCards);
        const strength = applyNoise(rawStrength, profile.noise);
        const street = streetFromGameState(gameState);
        const position = derivePosition(gameState.seatIndex, gameState.dealerIndex, gameState.tableSize);
        const stackRisk = callStackRatio(validActions, gameState.playerChips);
        const potOdds = getPotOdds(gameState, validActions);

        // Safety valve — don't commit on weak hands regardless of frequencies.
        if (stackRisk > 0.6 && strength < 0.75) return foldOrCheck(validActions);

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
