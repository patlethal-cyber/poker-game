export class PotManager {
    constructor() {
        this.pots = [];
    }

    reset() {
        this.pots = [];
    }

    collectBets(players) {
        const bets = players
            .map((p, i) => ({ index: i, bet: p.currentBet, inHand: p.isInHand }))
            .filter(b => b.bet > 0);

        if (bets.length === 0) return;

        const allInAmounts = [...new Set(
            bets.filter(b => {
                const p = players[b.index];
                return p.isAllIn;
            }).map(b => b.bet)
        )].sort((a, b) => a - b);

        if (allInAmounts.length === 0) {
            const totalBets = bets.reduce((sum, b) => sum + b.bet, 0);
            const eligible = new Set();
            for (let i = 0; i < players.length; i++) {
                if (players[i].isInHand) eligible.add(i);
            }
            this._addToPot(totalBets, eligible);
        } else {
            let previousLevel = 0;

            for (const level of allInAmounts) {
                const tierAmount = level - previousLevel;
                if (tierAmount <= 0) continue;

                let potContribution = 0;
                const eligible = new Set();

                for (const b of bets) {
                    const contribute = Math.min(b.bet, level) - Math.min(b.bet, previousLevel);
                    if (contribute > 0) {
                        potContribution += contribute;
                    }
                    if (players[b.index].isInHand && b.bet >= level) {
                        eligible.add(b.index);
                    }
                }

                for (const b of bets) {
                    if (players[b.index].isInHand && players[b.index].isAllIn && b.bet === level) {
                        eligible.add(b.index);
                    }
                }

                if (potContribution > 0) {
                    this._addToPot(potContribution, eligible);
                }
                previousLevel = level;
            }

            const maxAllIn = allInAmounts[allInAmounts.length - 1];
            let remainder = 0;
            const remainderEligible = new Set();

            for (const b of bets) {
                const extra = b.bet - Math.min(b.bet, maxAllIn);
                if (extra > 0) {
                    remainder += extra;
                }
                if (players[b.index].isInHand && b.bet > maxAllIn) {
                    remainderEligible.add(b.index);
                }
            }

            if (remainder > 0) {
                this._addToPot(remainder, remainderEligible);
            }
        }

        for (const p of players) {
            p.resetBetForNewRound();
        }
    }

    _addToPot(amount, eligiblePlayerIndices) {
        if (this.pots.length > 0) {
            const lastPot = this.pots[this.pots.length - 1];
            if (this._setsEqual(lastPot.eligiblePlayerIndices, eligiblePlayerIndices)) {
                lastPot.amount += amount;
                return;
            }
        }
        this.pots.push({ amount, eligiblePlayerIndices: new Set(eligiblePlayerIndices) });
    }

    _setsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (const item of a) {
            if (!b.has(item)) return false;
        }
        return true;
    }

    distributePots(playerEvaluations) {
        const awards = [];

        for (let potIndex = 0; potIndex < this.pots.length; potIndex++) {
            const pot = this.pots[potIndex];
            const eligible = playerEvaluations.filter(pe =>
                pot.eligiblePlayerIndices.has(pe.playerIndex)
            );

            if (eligible.length === 0) {
                continue;
            }

            const bestScore = Math.max(...eligible.map(e => e.eval.score));
            const winners = eligible.filter(e => e.eval.score === bestScore);

            const share = Math.floor(pot.amount / winners.length);
            const remainder = pot.amount - share * winners.length;

            for (let i = 0; i < winners.length; i++) {
                awards.push({
                    playerIndex: winners[i].playerIndex,
                    amount: share + (i === 0 ? remainder : 0),
                    potIndex
                });
            }
        }

        return awards;
    }

    get totalPot() {
        return this.pots.reduce((sum, p) => sum + p.amount, 0);
    }

    get potDescriptions() {
        if (this.pots.length <= 1) {
            return [{ name: 'Main Pot', amount: this.totalPot }];
        }
        return this.pots.map((p, i) => ({
            name: i === 0 ? 'Main Pot' : `Side Pot ${i}`,
            amount: p.amount
        }));
    }
}
