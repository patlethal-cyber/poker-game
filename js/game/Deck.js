import { SUITS, RANKS } from '../utils/constants.js';

export class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push({ rank, suit });
            }
        }
        this.shuffle();
    }

    shuffle() {
        // Fisher-Yates shuffle
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(count = 1) {
        if (this.cards.length < count) {
            throw new Error(`Not enough cards in deck: ${this.cards.length} remaining, ${count} requested`);
        }
        return this.cards.splice(0, count);
    }

    get remaining() {
        return this.cards.length;
    }
}
