export class Player {
    constructor(name, chips, seatIndex, isHuman = false) {
        this.name = name;
        this.chips = chips;
        this.seatIndex = seatIndex;
        this.isHuman = isHuman;
        this.holeCards = [];
        this.currentBet = 0;
        this.isFolded = false;
        this.isAllIn = false;
        this.isSittingOut = false;
        this.strategy = null; // AI strategy name
        this.totalBetThisHand = 0;
    }

    bet(amount) {
        const actual = Math.min(amount, this.chips);
        this.chips -= actual;
        this.currentBet += actual;
        this.totalBetThisHand += actual;
        if (this.chips === 0) {
            this.isAllIn = true;
        }
        return actual;
    }

    fold() {
        this.isFolded = true;
    }

    resetForNewHand() {
        this.holeCards = [];
        this.currentBet = 0;
        this.isFolded = false;
        this.isAllIn = false;
        this.totalBetThisHand = 0;
        if (this.chips <= 0) {
            this.isSittingOut = true;
        }
    }

    resetBetForNewRound() {
        this.currentBet = 0;
    }

    get isActive() {
        return !this.isFolded && !this.isSittingOut && !this.isAllIn;
    }

    get isInHand() {
        return !this.isFolded && !this.isSittingOut;
    }
}
