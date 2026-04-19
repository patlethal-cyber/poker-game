import { ACTIONS } from '../utils/constants.js';

export class BettingRound {
    constructor(players, startIndex, currentBet = 0, minRaise = 0) {
        this.players = players;
        this.currentBet = currentBet;
        this.minRaise = minRaise || currentBet;
        this.lastRaiseAmount = minRaise || currentBet;
        this.actionIndex = startIndex;
        this.lastAggressorIndex = -1;
        this.actionsThisRound = 0;
        this.playerActed = new Array(players.length).fill(false);
        this.isComplete = false;

        for (let i = 0; i < players.length; i++) {
            if (!players[i].isActive) {
                this.playerActed[i] = true;
            }
        }
    }

    get currentPlayer() {
        return this.players[this.actionIndex];
    }

    get currentPlayerIndex() {
        return this.actionIndex;
    }

    getValidActions() {
        const player = this.currentPlayer;
        const toCall = this.currentBet - player.currentBet;
        const actions = [];

        actions.push({ type: ACTIONS.FOLD });

        if (toCall <= 0) {
            actions.push({ type: ACTIONS.CHECK });
        } else {
            const callAmount = Math.min(toCall, player.chips);
            actions.push({ type: ACTIONS.CALL, amount: callAmount });
        }

        const chipsAfterCall = player.chips - Math.max(0, toCall);
        if (chipsAfterCall > 0) {
            const minRaiseTotal = this.currentBet + this.lastRaiseAmount;
            const minRaiseAmount = Math.min(minRaiseTotal - player.currentBet, player.chips);
            const maxRaiseAmount = player.chips;

            const minRaiseTo = player.currentBet + minRaiseAmount;
            const maxRaiseTo = player.currentBet + maxRaiseAmount;

            if (this.currentBet === 0) {
                actions.push({
                    type: ACTIONS.BET,
                    minAmount: this.minRaise,
                    maxAmount: maxRaiseAmount,
                    minRaiseTo: this.minRaise,
                    maxRaiseTo: maxRaiseAmount
                });
            } else {
                actions.push({
                    type: ACTIONS.RAISE,
                    minAmount: minRaiseAmount,
                    maxAmount: maxRaiseAmount,
                    minRaiseTo: minRaiseTo,
                    maxRaiseTo: maxRaiseTo
                });
            }
        }

        if (player.chips > 0) {
            actions.push({ type: ACTIONS.ALL_IN, amount: player.chips });
        }

        return actions;
    }

    processAction(action) {
        const player = this.currentPlayer;
        const playerIndex = this.actionIndex;

        switch (action.type) {
            case ACTIONS.FOLD:
                player.fold();
                break;

            case ACTIONS.CHECK:
                break;

            case ACTIONS.CALL: {
                const toCall = Math.min(this.currentBet - player.currentBet, player.chips);
                player.bet(toCall);
                break;
            }

            case ACTIONS.BET:
            case ACTIONS.RAISE: {
                const amount = action.amount;
                const raiseBy = amount - (this.currentBet - player.currentBet);
                player.bet(amount);
                this.currentBet = player.currentBet;
                this.lastRaiseAmount = Math.max(raiseBy, this.lastRaiseAmount);
                this.lastAggressorIndex = playerIndex;
                for (let i = 0; i < this.playerActed.length; i++) {
                    if (this.players[i].isActive && i !== playerIndex) {
                        this.playerActed[i] = false;
                    }
                }
                break;
            }

            case ACTIONS.ALL_IN: {
                const allInAmount = player.chips;
                player.bet(allInAmount);
                if (player.currentBet > this.currentBet) {
                    const raiseBy = player.currentBet - this.currentBet;
                    this.currentBet = player.currentBet;
                    if (raiseBy >= this.lastRaiseAmount) {
                        this.lastRaiseAmount = raiseBy;
                        this.lastAggressorIndex = playerIndex;
                        for (let i = 0; i < this.playerActed.length; i++) {
                            if (this.players[i].isActive && i !== playerIndex) {
                                this.playerActed[i] = false;
                            }
                        }
                    }
                }
                break;
            }
        }

        this.playerActed[playerIndex] = true;
        this.actionsThisRound++;

        const next = this._findNextPlayer();

        if (next === null) {
            this.isComplete = true;
            return { valid: true, action, nextPlayerIndex: null };
        }

        this.actionIndex = next;
        return { valid: true, action, nextPlayerIndex: next };
    }

    _findNextPlayer() {
        const n = this.players.length;
        for (let offset = 1; offset <= n; offset++) {
            const idx = (this.actionIndex + offset) % n;
            const player = this.players[idx];
            if (player.isActive && !this.playerActed[idx]) {
                return idx;
            }
        }
        return null;
    }

    get onlyOnePlayerRemaining() {
        return this.players.filter(p => p.isInHand).length <= 1;
    }

    get activePlayers() {
        return this.players.filter(p => p.isActive).length;
    }
}
