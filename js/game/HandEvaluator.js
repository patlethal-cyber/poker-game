import { RANK_VALUES, HAND_RANKINGS, HAND_NAMES } from '../utils/constants.js';

// All 21 combinations of 5 from 7
const COMBINATIONS_5_FROM_7 = [];
(function generateCombinations() {
    for (let i = 0; i < 7; i++)
        for (let j = i + 1; j < 7; j++)
            for (let k = j + 1; k < 7; k++)
                for (let l = k + 1; l < 7; l++)
                    for (let m = l + 1; m < 7; m++)
                        COMBINATIONS_5_FROM_7.push([i, j, k, l, m]);
})();

export class HandEvaluator {
    static evaluate(cards) {
        if (cards.length < 5) {
            return HandEvaluator.evaluateFive(cards.concat(
                Array(5 - cards.length).fill(null)
            ).slice(0, 5));
        }

        if (cards.length === 5) {
            return HandEvaluator.evaluateFive(cards);
        }

        let bestResult = null;
        const combos = cards.length === 7 ? COMBINATIONS_5_FROM_7 : HandEvaluator.getCombinations(cards.length, 5);

        for (const combo of combos) {
            const hand = combo.map(i => cards[i]);
            const result = HandEvaluator.evaluateFive(hand);
            if (!bestResult || result.score > bestResult.score) {
                bestResult = result;
            }
        }
        return bestResult;
    }

    static getCombinations(n, k) {
        const result = [];
        const combo = [];
        function generate(start) {
            if (combo.length === k) {
                result.push([...combo]);
                return;
            }
            for (let i = start; i < n; i++) {
                combo.push(i);
                generate(i + 1);
                combo.pop();
            }
        }
        generate(0);
        return result;
    }

    static evaluateFive(cards) {
        const validCards = cards.filter(c => c !== null);
        if (validCards.length < 5) {
            return { ranking: 0, score: 0, bestHand: validCards, name: 'Incomplete' };
        }

        const ranks = validCards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
        const suits = validCards.map(c => c.suit);

        const isFlush = suits.every(s => s === suits[0]);

        const straightHigh = HandEvaluator.getStraightHigh(ranks);
        const isStraight = straightHigh > 0;

        const freq = {};
        for (const r of ranks) {
            freq[r] = (freq[r] || 0) + 1;
        }
        const freqValues = Object.values(freq).sort((a, b) => b - a);
        const sortedByFreq = Object.entries(freq)
            .sort((a, b) => b[1] - a[1] || b[0] - a[0])
            .map(([rank]) => Number(rank));

        let ranking;
        let kickers;

        if (isFlush && isStraight) {
            if (straightHigh === 14) {
                ranking = HAND_RANKINGS.ROYAL_FLUSH;
            } else {
                ranking = HAND_RANKINGS.STRAIGHT_FLUSH;
            }
            kickers = [straightHigh];
        } else if (freqValues[0] === 4) {
            ranking = HAND_RANKINGS.FOUR_OF_A_KIND;
            kickers = sortedByFreq;
        } else if (freqValues[0] === 3 && freqValues[1] === 2) {
            ranking = HAND_RANKINGS.FULL_HOUSE;
            kickers = sortedByFreq;
        } else if (isFlush) {
            ranking = HAND_RANKINGS.FLUSH;
            kickers = ranks;
        } else if (isStraight) {
            ranking = HAND_RANKINGS.STRAIGHT;
            kickers = [straightHigh];
        } else if (freqValues[0] === 3) {
            ranking = HAND_RANKINGS.THREE_OF_A_KIND;
            kickers = sortedByFreq;
        } else if (freqValues[0] === 2 && freqValues[1] === 2) {
            ranking = HAND_RANKINGS.TWO_PAIR;
            kickers = sortedByFreq;
        } else if (freqValues[0] === 2) {
            ranking = HAND_RANKINGS.ONE_PAIR;
            kickers = sortedByFreq;
        } else {
            ranking = HAND_RANKINGS.HIGH_CARD;
            kickers = ranks;
        }

        let score = ranking * 1e10;
        for (let i = 0; i < kickers.length; i++) {
            score += kickers[i] * Math.pow(100, 4 - i);
        }

        return {
            ranking,
            score,
            bestHand: validCards,
            name: HAND_NAMES[ranking]
        };
    }

    static getStraightHigh(sortedRanks) {
        const unique = [...new Set(sortedRanks)].sort((a, b) => b - a);
        if (unique.length < 5) return 0;

        for (let i = 0; i <= unique.length - 5; i++) {
            if (unique[i] - unique[i + 4] === 4) {
                return unique[i];
            }
        }

        if (unique.includes(14) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) {
            return 5;
        }

        return 0;
    }

    static compare(evalA, evalB) {
        return evalA.score - evalB.score;
    }

    static estimateStrength(holeCards, communityCards) {
        const allCards = [...holeCards, ...communityCards];
        if (allCards.length < 2) return 0.5;

        const eval_ = communityCards.length >= 3
            ? HandEvaluator.evaluate(allCards)
            : null;

        if (!eval_) {
            return HandEvaluator.preflopStrength(holeCards);
        }

        const ranking = eval_.ranking;

        const baseStrength = {
            1: 0.05,
            2: 0.18,
            3: 0.38,
            4: 0.52,
            5: 0.58,
            6: 0.64,
            7: 0.74,
            8: 0.88,
            9: 0.95,
            10: 1.0
        };

        let strength = baseStrength[ranking] || 0.05;

        if (ranking === 2) {
            const holeRanks = holeCards.map(c => RANK_VALUES[c.rank]);
            const boardRanks = communityCards.map(c => RANK_VALUES[c.rank]);
            const maxBoardRank = Math.max(...boardRanks);
            const pairUsesHole = holeRanks.some(r => boardRanks.includes(r));
            const highHole = Math.max(...holeRanks);

            if (pairUsesHole && highHole >= maxBoardRank) {
                strength += 0.12;
            } else if (pairUsesHole) {
                strength += 0.05;
            }
        }

        if (ranking === 3) {
            const holeRanks = holeCards.map(c => RANK_VALUES[c.rank]);
            const boardRanks = communityCards.map(c => RANK_VALUES[c.rank]);
            const holeContributes = holeRanks.filter(r => boardRanks.includes(r)).length;
            if (holeContributes >= 2) strength += 0.08;
            else if (holeContributes === 1) strength += 0.03;
        }

        return Math.max(0, Math.min(1, strength));
    }

    static preflopStrength(holeCards) {
        const r1 = RANK_VALUES[holeCards[0].rank];
        const r2 = RANK_VALUES[holeCards[1].rank];
        const suited = holeCards[0].suit === holeCards[1].suit;
        const isPair = r1 === r2;
        const high = Math.max(r1, r2);
        const low = Math.min(r1, r2);
        const gap = high - low;

        let strength = ((high + low) - 6) / 24 * 0.5;

        if (isPair) {
            strength = 0.30 + (high - 2) / 12 * 0.60;
        } else {
            if (suited) strength += 0.06;
            if (gap === 1) strength += 0.04;
            else if (gap === 2) strength += 0.02;
            else if (gap >= 5) strength -= 0.06;

            if (high === 14) strength += 0.08;
            else if (high === 13) strength += 0.04;
        }

        return Math.max(0.02, Math.min(0.95, strength));
    }
}
